import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; full_name?: string; phone?: string; clinic_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { email, password, full_name, phone, clinic_id } = body;
  if (!email?.trim() || !password || !full_name?.trim())
    return NextResponse.json({ error: "email, password, and full_name are required" }, { status: 400 });
  if (password.length < 8)
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const admin = createAdminClient();
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(), password,
    email_confirm: true,
    user_metadata: { full_name: full_name.trim() },
  });

  if (authErr) {
    const isExists = authErr.message.toLowerCase().includes("already");
    return NextResponse.json({ error: isExists ? "Email already registered" : authErr.message },
      { status: isExists ? 409 : 500 });
  }

  const { error: profileErr } = await admin.from("profiles").insert({
    id: authData.user.id,
    email: email.trim().toLowerCase(),
    full_name: full_name.trim(),
    phone: phone?.trim() || null,
    role: "viewer",
    clinic_id: clinic_id || null,
    is_active: false,
  });

  if (profileErr) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: "Account creation failed" }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    action: "account_created", user_id: authData.user.id,
    user_email: email.trim().toLowerCase(), user_role: "viewer",
    notes: `New registration — pending activation. Clinic: ${clinic_id || "unassigned"}`,
  });

  return NextResponse.json({
    success: true,
    message: "Account created. An administrator will activate your access within 24 hours. Contact admin@marylandmethadone.help to expedite.",
  });
}
