import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { StatusUpdatePayload, AcceptingStatus } from "@/types/database";

const VALID: AcceptingStatus[] = ["accepting", "waitlist", "not_accepting"];

/**
 * POST /api/status/update
 * Upserts a clinic's "accepting new patients" status.
 * Clinic managers can only update their own clinic; admins can update any.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role, clinic_id, email").eq("id", session.user.id).single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  let body: StatusUpdatePayload;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { clinic_id, accepting_status, waitlist_note, notes } = body;
  if (!clinic_id || !accepting_status)
    return NextResponse.json({ error: "clinic_id and accepting_status required" }, { status: 400 });
  if (!VALID.includes(accepting_status))
    return NextResponse.json({ error: "accepting_status must be accepting, waitlist, or not_accepting" }, { status: 400 });

  const isAdmin = ["global_admin", "regional_admin"].includes(profile.role);
  if (!isAdmin && profile.clinic_id !== clinic_id)
    return NextResponse.json({ error: "Forbidden — can only update your own clinic" }, { status: 403 });

  const now = new Date();
  const nextDue = new Date(now.getTime() + 7 * 86_400_000); // nudge to re-confirm weekly

  const { data: updated, error } = await supabase
    .from("clinic_status")
    .upsert({
      clinic_id,
      accepting_status,
      waitlist_note: waitlist_note ?? null,
      updated_at: now.toISOString(),
      updated_by: session.user.id,
      next_update_due: nextDue.toISOString(),
    }, { onConflict: "clinic_id" })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("audit_logs").insert({
    action: "status_update", clinic_id,
    user_id: session.user.id, user_email: profile.email, user_role: profile.role,
    ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
    after_state: updated,
    notes: notes || null,
  });

  return NextResponse.json({ success: true, updated, timestamp: updated.updated_at });
}

/**
 * GET /api/status/update?clinic_id=xxx
 * Returns the current status for a clinic.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clinic_id = req.nextUrl.searchParams.get("clinic_id");
  if (!clinic_id) return NextResponse.json({ error: "clinic_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("clinic_status").select("*").eq("clinic_id", clinic_id).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}
