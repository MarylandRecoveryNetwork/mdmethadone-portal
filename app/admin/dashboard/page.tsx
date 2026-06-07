import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Metadata } from "next";
import AdminDashboardClient from "./AdminDashboardClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Dashboard | MD Methadone Finder",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login?redirect=/admin/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (!profile || !["global_admin", "regional_admin"].includes(profile.role)) {
    redirect("/portal/dashboard");
  }

  const [clinicRes, statusRes, auditRes] = await Promise.all([
    supabase.from("clinics").select("id, name, city, county, region, is_active").order("name"),
    supabase.from("clinic_status").select("clinic_id, accepting_status, updated_at"),
    supabase.from("audit_logs").select("id, action, user_email, clinic_id, notes, created_at").order("created_at", { ascending: false }).limit(150),
  ]);

  return (
    <AdminDashboardClient
      profile={profile}
      initialClinics={clinicRes.data || []}
      initialStatuses={statusRes.data || []}
      initialAudit={auditRes.data || []}
    />
  );
}
