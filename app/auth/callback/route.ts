import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/find-clinic";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll()    { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && session) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", session.user.id)
        .single();

      // First OAuth login — create a pending profile
      if (!profile) {
        await supabase.from("profiles").insert({
          id:        session.user.id,
          email:     session.user.email,
          full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || "",
          role:      "viewer",
          is_active: false,
        });
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent("Account created — pending admin activation. Email info@mdaddiction.help")}`, requestUrl.origin)
        );
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent("Account pending activation. Contact info@mdaddiction.help")}`, requestUrl.origin)
        );
      }

      const role = profile.role;
      const dest = role === "global_admin" || role === "regional_admin"
        ? "/admin/dashboard"
        : role === "clinic_manager"
        ? "/portal/dashboard"
        : next;

      return NextResponse.redirect(new URL(dest, requestUrl.origin));
    }
  }

  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent("Authentication failed. Please try again.")}`, requestUrl.origin)
  );
}
