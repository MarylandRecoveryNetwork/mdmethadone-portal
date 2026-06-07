import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function HomePage() {
  // Logged-in users go to their dashboard; everyone else to the public finder.
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    const role = profile?.role;
    if (role === "global_admin" || role === "regional_admin") redirect("/admin/dashboard");
    if (role === "clinic_manager") redirect("/portal/dashboard");
  }

  redirect("/find-clinic");
}
