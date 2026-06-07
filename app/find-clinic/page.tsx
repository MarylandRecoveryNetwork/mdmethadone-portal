import { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import ClinicFinderPage from "./ClinicFinderPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Find a Methadone Clinic Now | Maryland OTP Finder",
  description:
    "Real-time directory of Maryland methadone clinics and opioid treatment programs (OTPs). See which clinics are accepting new patients today.",
};

export default async function FindClinicPage() {
  const supabase = await createClient();

  const { data: status } = await supabase
    .from("v_methadone_live_status")
    .select("slug, accepting_status, waitlist_note, status_updated_at, freshness_status")
    .order("county");

  return <ClinicFinderPage initialData={status || []} />;
}
