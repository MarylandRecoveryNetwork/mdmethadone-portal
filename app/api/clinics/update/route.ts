import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ClinicUpdatePayload } from "@/types/database";

/**
 * PATCH /api/clinics/update
 * Updates clinic profile fields — contact info, medications offered, payment options.
 * Clinic managers can only update their own clinic. Admins can update any.
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role, clinic_id").eq("id", session.user.id).single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  let body: ClinicUpdatePayload;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { clinic_id, ...updates } = body;
  if (!clinic_id) return NextResponse.json({ error: "clinic_id required" }, { status: 400 });

  const isAdmin = ["global_admin", "regional_admin"].includes(profile.role);
  if (!isAdmin && profile.clinic_id !== clinic_id)
    return NextResponse.json({ error: "Forbidden — can only update your own clinic" }, { status: 403 });

  const allowedFields = [
    "phone_number", "website_url", "intake_email", "hours", "description",
    "offers_methadone", "offers_buprenorphine", "offers_naltrexone",
    "accepts_medicaid", "accepts_medicare", "accepts_private",
    "sliding_scale", "uninsured_ok", "telehealth",
  ];
  const safeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowedFields) {
    if (key in updates) safeUpdates[key] = (updates as Record<string, unknown>)[key];
  }

  const { error } = await supabase.from("clinics").update(safeUpdates).eq("id", clinic_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("audit_logs").insert({
    action: "clinic_profile_update",
    clinic_id,
    user_id: session.user.id,
    user_role: profile.role,
    after_state: safeUpdates,
    notes: `Clinic profile updated by ${profile.role}`,
  });

  return NextResponse.json({ success: true });
}
