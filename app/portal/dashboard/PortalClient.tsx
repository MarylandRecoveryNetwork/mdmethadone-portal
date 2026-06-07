"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { AcceptingStatus } from "@/types/database";

type Clinic = {
  id: string; name: string; city: string | null; county: string; phone_number: string | null;
  offers_methadone: boolean; offers_buprenorphine: boolean; offers_naltrexone: boolean;
  accepts_medicaid: boolean; accepts_medicare: boolean; accepts_private: boolean;
  sliding_scale: boolean; uninsured_ok: boolean; telehealth: boolean;
};

type Status = {
  accepting_status: AcceptingStatus; waitlist_note: string | null; updated_at: string;
} | null;

const STATUS_OPTIONS: { key: AcceptingStatus; label: string; color: string; desc: string }[] = [
  { key: "accepting",     label: "ACCEPTING",     color: "#1db954", desc: "Taking new patients now" },
  { key: "waitlist",      label: "WAITLIST",      color: "#d4af4f", desc: "New patients added to waitlist" },
  { key: "not_accepting", label: "NOT ACCEPTING", color: "#e03e3e", desc: "Not taking new patients" },
];

const SERVICE_FIELDS: [keyof Clinic, string][] = [
  ["offers_methadone",     "Methadone"],
  ["offers_buprenorphine", "Buprenorphine (Suboxone)"],
  ["offers_naltrexone",    "Naltrexone (Vivitrol)"],
  ["telehealth",           "Telehealth available"],
];
const PAYMENT_FIELDS: [keyof Clinic, string][] = [
  ["accepts_medicaid", "Medicaid"],
  ["accepts_medicare", "Medicare"],
  ["accepts_private",  "Private insurance"],
  ["sliding_scale",    "Sliding scale fee"],
  ["uninsured_ok",     "Uninsured / self-pay OK"],
];

export default function PortalClient({ profile, clinic, initialStatus }: {
  profile: { email: string; full_name: string; role: string };
  clinic: Clinic | null;
  initialStatus: Status;
}) {
  const router   = useRouter();
  const supabase = createClient();
  const [isPending, start] = useTransition();

  const [accepting, setAccepting] = useState<AcceptingStatus>(initialStatus?.accepting_status || "accepting");
  const [note,      setNote]      = useState(initialStatus?.waitlist_note || "");
  const [flags,     setFlags]     = useState<Record<string, boolean>>(clinic ? {
    offers_methadone: clinic.offers_methadone, offers_buprenorphine: clinic.offers_buprenorphine,
    offers_naltrexone: clinic.offers_naltrexone, telehealth: clinic.telehealth,
    accepts_medicaid: clinic.accepts_medicaid, accepts_medicare: clinic.accepts_medicare,
    accepts_private: clinic.accepts_private, sliding_scale: clinic.sliding_scale, uninsured_ok: clinic.uninsured_ok,
  } : {});
  const [result,  setResult]  = useState<"idle"|"ok"|"error">("idle");
  const [last,    setLast]    = useState<string|null>(null);
  const [errMsg,  setErrMsg]  = useState<string|null>(null);

  const broadcast = () => start(async () => {
    setResult("idle"); setErrMsg(null);
    try {
      const res = await fetch("/api/status/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: clinic?.id,
          accepting_status: accepting,
          waitlist_note: accepting === "waitlist" ? note : null,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }

      await fetch("/api/clinics/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic_id: clinic?.id, ...flags }),
      });

      setResult("ok");
      setLast(new Date().toLocaleTimeString("en-US", { hour12: true }));
    } catch (e: unknown) {
      setResult("error");
      setErrMsg(e instanceof Error ? e.message : "Update failed");
    }
  });

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push("/login"); };

  if (!clinic) return null;

  const btnBg = result === "ok" ? "#1db954" : result === "error" ? "#e03e3e" : "#b8952a";

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.hdr}>
        <div>
          <div style={S.hName}>{clinic.name}</div>
          <div style={S.hMeta}>{clinic.city ? clinic.city + " · " : ""}{clinic.county} · {profile.email}</div>
        </div>
        <button onClick={handleSignOut} style={S.signOutBtn}>Sign Out</button>
      </div>

      <div style={S.notice}>Update this whenever your intake availability changes. Patients see it in real time.</div>

      {/* Section A: Accepting status */}
      <div style={S.secLabel}>ARE YOU TAKING NEW PATIENTS?</div>
      <div style={S.statusGrid}>
        {STATUS_OPTIONS.map(o => (
          <button key={o.key}
            onClick={() => setAccepting(o.key)}
            style={{
              ...S.statusBtn,
              borderColor: accepting === o.key ? o.color : "#2e2a22",
              background: accepting === o.key ? o.color : "#161616",
              color: accepting === o.key ? "#000" : "#c8bfaa",
            }}>
            <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>{o.label}</div>
            <div style={{ fontSize: 10, opacity: .8, marginTop: 3 }}>{o.desc}</div>
          </button>
        ))}
      </div>

      {accepting === "waitlist" && (
        <div style={{ padding: "0 1.25rem 1rem" }}>
          <label style={S.acuityGroupLabel}>Waitlist note (optional — shown to patients)</label>
          <input style={S.input} value={note} onChange={e => setNote(e.target.value)}
            placeholder="e.g. ~2 week wait, call to be added" maxLength={80} />
        </div>
      )}

      {/* Section B: Services */}
      <div style={S.secLabel}>MEDICATIONS &amp; SERVICES</div>
      {SERVICE_FIELDS.map(([k, l]) => (
        <Toggle key={k} label={l} val={!!flags[k]} onChange={v => setFlags(p => ({ ...p, [k]: v }))} />
      ))}

      {/* Section C: Payment */}
      <div style={S.secLabel}>PAYMENT &amp; INSURANCE</div>
      {PAYMENT_FIELDS.map(([k, l]) => (
        <Toggle key={k} label={l} val={!!flags[k]} onChange={v => setFlags(p => ({ ...p, [k]: v }))} />
      ))}

      {/* Broadcast */}
      <button style={{ ...S.broadcastBtn, background: btnBg, opacity: isPending ? .5 : 1 }} onClick={broadcast} disabled={isPending}>
        {isPending ? "Saving…" : result === "ok" ? "✓ Status Live" : result === "error" ? "⚠ Failed — Retry" : "PUBLISH STATUS"}
      </button>
      {last && result === "ok" && <div style={S.confirm}>✓ Live as of {last}</div>}
      {errMsg && <div style={{ ...S.confirm, color: "#e03e3e" }}>Error: {errMsg}</div>}

      {/* Footer */}
      <div style={S.footer}>
        <div>marylandmethadone.help · {profile.role}</div>
        <div style={{ marginTop: 6 }}><a href="/find-clinic" style={{ color: "#b8952a", fontSize: 11 }}>View public finder →</a></div>
      </div>
    </div>
  );
}

function Toggle({ label, val, onChange }: { label: string; val: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 1.25rem", borderBottom: "1px solid #111" }}>
      <span style={{ fontSize: 13, color: "#a89880", maxWidth: "75%" }}>{label}</span>
      <button style={{ fontFamily: "DM Mono,monospace", fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 2, cursor: "pointer", background: val ? "#b8952a" : "#1e1e1e", color: val ? "#000" : "#888", border: `1px solid ${val ? "#b8952a" : "#333"}` }}
        onClick={() => onChange(!val)} aria-pressed={val}>
        {val ? "YES" : "NO"}
      </button>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap:       { maxWidth: 480, margin: "0 auto", fontFamily: "DM Sans,system-ui,sans-serif", background: "#0d0d0d", minHeight: "100vh" },
  hdr:        { background: "#1a1a1a", padding: "1rem 1.25rem", borderBottom: "1px solid rgba(184,149,42,.2)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  hName:      { fontWeight: 600, fontSize: 15, color: "#f2ead8" },
  hMeta:      { fontFamily: "DM Mono,monospace", fontSize: 10, color: "#7a7060", marginTop: 3 },
  signOutBtn: { background: "none", border: "1px solid #333", color: "#555", fontFamily: "DM Mono,monospace", fontSize: 9, padding: "5px 10px", cursor: "pointer", letterSpacing: 1 },
  notice:     { background: "#111", padding: "8px 1.25rem", fontFamily: "DM Mono,monospace", fontSize: 10, color: "#555", borderBottom: "1px solid #1a1a1a" },
  secLabel:   { fontFamily: "DM Mono,monospace", fontSize: 10, color: "#b8952a", letterSpacing: 2, padding: "1.25rem 1.25rem .5rem" },
  statusGrid: { display: "grid", gridTemplateColumns: "1fr", gap: 8, padding: "0 1.25rem" },
  statusBtn:  { padding: "14px 16px", border: "2px solid", borderRadius: 3, cursor: "pointer", textAlign: "left" as const, transition: "all .15s" },
  acuityGroupLabel: { display: "block", fontFamily: "DM Mono,monospace", fontSize: 9, color: "#7a7060", letterSpacing: 1, marginBottom: 6 },
  input:      { width: "100%", background: "#0f0f0f", border: "1px solid #2e2a22", color: "#f2ead8", padding: "10px 12px", fontFamily: "DM Sans,sans-serif", fontSize: 14, outline: "none", borderRadius: 2 },
  broadcastBtn: { width: "calc(100% - 2.5rem)", margin: "1.5rem 1.25rem 0", padding: 18, fontFamily: "DM Mono,monospace", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, border: "none", cursor: "pointer", color: "#000", borderRadius: 2 },
  confirm:    { textAlign: "center" as const, fontFamily: "DM Mono,monospace", fontSize: 11, color: "#1db954", padding: "8px 1.25rem" },
  footer:     { padding: "1.25rem", fontFamily: "DM Mono,monospace", fontSize: 10, color: "#444", marginTop: "1rem", borderTop: "1px solid #1a1a1a", textAlign: "center" as const, lineHeight: 1.8 },
};
