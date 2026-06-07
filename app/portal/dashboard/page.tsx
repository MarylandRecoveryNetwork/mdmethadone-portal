import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Metadata } from "next";
import PortalClient from "./PortalClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clinic Dashboard | MD Methadone Finder",
  robots: { index: false, follow: false },
};

export default async function PortalDashboardPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login?redirect=/portal/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, clinic_id, is_active")
    .eq("id", session.user.id)
    .single();

  if (!profile?.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=" + encodeURIComponent("Account pending activation."));
  }

  // Admins go to the admin dashboard
  if (profile.role === "global_admin" || profile.role === "regional_admin") {
    redirect("/admin/dashboard");
  }

  if (!profile.clinic_id) {
    return (
      <div style={{ fontFamily: "DM Sans, sans-serif", background: "#080808", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#f2ead8" }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: "2rem" }}>
          <div style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: "#b8952a", marginBottom: 12 }}>NO CLINIC ASSIGNED</div>
          <p style={{ color: "#7a7060", fontSize: 15 }}>
            Your account is not yet linked to a clinic.<br />
            Email <a href="mailto:admin@mdmethadone.help" style={{ color: "#b8952a" }}>admin@mdmethadone.help</a> to complete setup.
          </p>
        </div>
      </div>
    );
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name, city, county, phone_number, offers_methadone, offers_buprenorphine, offers_naltrexone, accepts_medicaid, accepts_medicare, accepts_private, sliding_scale, uninsured_ok, telehealth")
    .eq("id", profile.clinic_id)
    .single();

  const { data: status } = await supabase
    .from("clinic_status")
    .select("*")
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  return (
    <PortalClient
      profile={profile}
      clinic={clinic}
      initialStatus={status}
    />
  );
}
