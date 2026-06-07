"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

type Tab = "login" | "register" | "reset";

export default function LoginClient({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const supabase  = createClient();
  const router    = useRouter();

  const [tab,       setTab]      = useState<Tab>("login");
  const [email,     setEmail]    = useState("");
  const [password,  setPassword] = useState("");
  const [fullName,  setFullName] = useState("");
  const [showPass,  setShowPass] = useState(false);
  const [loading,   setLoading]  = useState(false);
  const [msg,       setMsg]      = useState<{ type: "error"|"success"; text: string } | null>(null);
  const [redirectTo, setRedirectTo] = useState("/find-clinic");

  useEffect(() => {
    searchParams.then(p => {
      if (p?.redirect) setRedirectTo(p.redirect);
      if (p?.error)    setMsg({ type: "error", text: decodeURIComponent(p.error) });
    });
  }, [searchParams]);

  // ── Email / Password Login ─────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMsg({ type: "error", text: "Invalid email or password. Please try again." });
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", data.user.id)
      .single();

    if (!profile?.is_active) {
      await supabase.auth.signOut();
      setMsg({ type: "error", text: "Account pending activation. Contact admin@marylandmethadone.help" });
      setLoading(false);
      return;
    }

    const role = profile.role;
    const dest = role === "global_admin" || role === "regional_admin"
      ? "/admin/dashboard"
      : role === "clinic_manager"
      ? "/portal/dashboard"
      : redirectTo;

    router.push(dest);
    router.refresh();
  };

  // ── Register ───────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    if (!fullName.trim()) {
      setMsg({ type: "error", text: "Full name is required." });
      setLoading(false);
      return;
    }
    if (password.length < 8) {
      setMsg({ type: "error", text: "Password must be at least 8 characters." });
      setLoading(false);
      return;
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMsg({ type: "error", text: data.error || "Registration failed." });
    } else {
      setMsg({
        type: "success",
        text: "Account created! An administrator will activate your access within 24 hours. " +
              "Email admin@marylandmethadone.help to expedite.",
      });
      setTab("login");
      setPassword("");
    }
    setLoading(false);
  };

  // ── Password Reset ─────────────────────────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/login`,
    });

    if (error) {
      setMsg({ type: "error", text: error.message });
    } else {
      setMsg({ type: "success", text: "Password reset email sent. Check your inbox." });
    }
    setLoading(false);
  };

  return (
    <div style={S.page}>
      {/* ── LEFT PANEL ─────────────────────────────────────────── */}
      <div style={S.left}>
        <div style={S.leftInner}>
          <a href="/find-clinic" style={S.backLink}>← Back to Clinic Finder</a>
          <div style={S.brand}>
            <div style={S.brandName}>Maryland Methadone Finder</div>
            <div style={S.brandSub}>marylandmethadone.help · Staff Portal</div>
          </div>
          <div style={S.tagline}>
            Help patients find a clinic<br />that is accepting new admissions
          </div>
          <div style={S.pillRow}>
            {["Methadone", "Buprenorphine", "Naltrexone", "Same-day intake"].map(p => (
              <span key={p} style={S.pill}>✓ {p}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────── */}
      <div style={S.right}>
        <div style={S.card}>
          {/* Tabs */}
          <div style={S.tabs}>
            {(["login", "register", "reset"] as Tab[]).map(t => (
              <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }}
                onClick={() => { setTab(t); setMsg(null); }}>
                {t === "login" ? "Sign In" : t === "register" ? "Register" : "Reset"}
              </button>
            ))}
          </div>

          {/* Message */}
          {msg && (
            <div style={{ ...S.msg, background: msg.type === "error" ? "rgba(224,62,62,.12)" : "rgba(29,185,84,.12)", borderColor: msg.type === "error" ? "#e03e3e" : "#1db954", color: msg.type === "error" ? "#e07070" : "#1db954" }}>
              {msg.text}
            </div>
          )}

          {/* ── LOGIN ── */}
          {tab === "login" && (
            <form onSubmit={handleLogin} style={S.form}>
              <div style={S.fg}>
                <label style={S.label}>Email Address</label>
                <input style={S.input} type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@email.com" required autoComplete="email" />
              </div>
              <div style={S.fg}>
                <label style={S.label}>Password</label>
                <div style={{ position: "relative" }}>
                  <input style={{ ...S.input, paddingRight: 44 }}
                    type={showPass ? "text" : "password"}
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Your password" required autoComplete="current-password" />
                  <button type="button" style={S.eyeBtn}
                    onClick={() => setShowPass(!showPass)}>
                    {showPass ? "🙈" : "👁"}
                  </button>
                </div>
              </div>
              <button type="submit" style={S.cta} disabled={loading}>
                {loading ? "Signing in…" : "Sign In"}
              </button>
              <button type="button" style={S.forgotBtn}
                onClick={() => { setTab("reset"); setMsg(null); }}>
                Forgot password?
              </button>
              <p style={S.note}>
                No account? <button type="button" style={S.inlineLink}
                  onClick={() => setTab("register")}>Register your clinic</button>
              </p>
            </form>
          )}

          {/* ── REGISTER ── */}
          {tab === "register" && (
            <form onSubmit={handleRegister} style={S.form}>
              <p style={S.regNote}>
                All email providers accepted — gmail, outlook, or clinic domain.
                Accounts require admin approval before access is granted.
              </p>
              <div style={S.fg}>
                <label style={S.label}>Full Name *</label>
                <input style={S.input} type="text" value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Your full name" required />
              </div>
              <div style={S.fg}>
                <label style={S.label}>Email Address *</label>
                <input style={S.input} type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@email.com" required autoComplete="email" />
              </div>
              <div style={S.fg}>
                <label style={S.label}>Password * (min 8 characters)</label>
                <input style={S.input} type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create a password" required minLength={8} />
              </div>
              <button type="submit" style={S.cta} disabled={loading}>
                {loading ? "Creating account…" : "Create Account"}
              </button>
              <p style={S.note}>
                Already registered? <button type="button" style={S.inlineLink}
                  onClick={() => setTab("login")}>Sign in</button>
              </p>
            </form>
          )}

          {/* ── RESET ── */}
          {tab === "reset" && (
            <form onSubmit={handleReset} style={S.form}>
              <p style={S.regNote}>
                Enter your email address and we will send you a link to reset your password.
              </p>
              <div style={S.fg}>
                <label style={S.label}>Email Address</label>
                <input style={S.input} type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@email.com" required />
              </div>
              <button type="submit" style={S.cta} disabled={loading}>
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
              <button type="button" style={S.forgotBtn}
                onClick={() => setTab("login")}>
                ← Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  page:       { display: "flex", minHeight: "100vh", fontFamily: "DM Sans, system-ui, sans-serif" },
  left:       { flex: "0 0 420px", background: "linear-gradient(160deg, #0a2342 0%, #0d0d0d 100%)", padding: "3rem", display: "flex", flexDirection: "column", justifyContent: "center", borderRight: "1px solid rgba(184,149,42,.2)" },
  leftInner:  { maxWidth: 340 },
  backLink:   { fontFamily: "DM Mono, monospace", fontSize: 11, color: "rgba(184,149,42,.6)", letterSpacing: 1, marginBottom: "2rem", display: "block", transition: "color .2s" },
  brand:      { marginBottom: "2rem" },
  brandName:  { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, color: "#f2ead8", lineHeight: 1.2 },
  brandSub:   { fontFamily: "DM Mono, monospace", fontSize: 11, color: "#b8952a", letterSpacing: 2, marginTop: 6 },
  tagline:    { fontSize: 17, color: "#a89880", lineHeight: 1.6, marginBottom: "2rem", fontStyle: "italic" },
  pillRow:    { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "2.5rem" },
  pill:       { fontFamily: "DM Mono, monospace", fontSize: 9, color: "#b8952a", border: "1px solid rgba(184,149,42,.3)", padding: "3px 8px", letterSpacing: 1 },
  right:      { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", background: "#080808" },
  card:       { width: "100%", maxWidth: 420, background: "#161616", border: "1px solid rgba(184,149,42,.18)", padding: "2rem" },
  tabs:       { display: "flex", gap: 1, marginBottom: "1.5rem", borderBottom: "1px solid #1a1a1a" },
  tab:        { flex: 1, padding: "10px", background: "transparent", border: "none", color: "#555", fontFamily: "DM Mono, monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" },
  tabOn:      { color: "#b8952a", borderBottom: "2px solid #b8952a" },
  msg:        { padding: "10px 14px", borderRadius: 2, border: "1px solid", fontSize: 13, marginBottom: "1.25rem", lineHeight: 1.5 },
  form:       { display: "flex", flexDirection: "column", gap: 0 },
  fg:         { marginBottom: "1rem" },
  label:      { display: "block", fontFamily: "DM Mono, monospace", fontSize: 9, color: "#7a7060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 },
  input:      { width: "100%", background: "#0f0f0f", border: "1px solid #2e2a22", color: "#f2ead8", padding: "11px 14px", fontFamily: "DM Sans, sans-serif", fontSize: 14, outline: "none", transition: "border-color .2s", borderRadius: 2 },
  eyeBtn:     { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#555" },
  cta:        { width: "100%", background: "#b8952a", color: "#000", padding: "13px", fontFamily: "DM Mono, monospace", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", border: "none", cursor: "pointer", marginTop: "0.5rem", marginBottom: "0.75rem", borderRadius: 2 },
  forgotBtn:  { background: "none", border: "none", color: "#555", fontFamily: "DM Mono, monospace", fontSize: 10, cursor: "pointer", letterSpacing: 1, marginBottom: "1.25rem" },
  divider:    { position: "relative", textAlign: "center", margin: "0.75rem 0", borderTop: "1px solid #1a1a1a" },
  dividerTxt: { position: "relative", top: "-9px", background: "#161616", padding: "0 10px", fontFamily: "DM Mono, monospace", fontSize: 9, color: "#444", letterSpacing: 2 },
  oauthRow:   { display: "flex", gap: 8, marginBottom: "1rem" },
  oauthBtn:   { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#0f0f0f", border: "1px solid #2e2a22", color: "#c8bfaa", padding: "10px", fontFamily: "DM Mono, monospace", fontSize: 11, cursor: "pointer", letterSpacing: 1, borderRadius: 2 },
  oauthIcon:  { fontWeight: 700, fontSize: 14, color: "#b8952a" },
  note:       { fontFamily: "DM Mono, monospace", fontSize: 10, color: "#555", textAlign: "center", marginTop: "0.5rem" },
  inlineLink: { background: "none", border: "none", color: "#b8952a", fontFamily: "DM Mono, monospace", fontSize: 10, cursor: "pointer", letterSpacing: 1 },
  regNote:    { fontSize: 13, color: "#7a7060", lineHeight: 1.6, marginBottom: "1.25rem" },
};
