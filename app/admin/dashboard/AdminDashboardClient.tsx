"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { AcceptingStatus } from "@/types/database";

type Tab = "overview" | "clinics" | "audit" | "users";

type Clinic = { id: string; name: string; city: string | null; county: string; region: string; is_active: boolean };
type StatusRow = { clinic_id: string; accepting_status: AcceptingStatus; updated_at: string };
type AuditRow = { id: string; action: string; user_email: string; clinic_id: string; notes: string; created_at: string };

export default function AdminDashboardClient({ profile, initialClinics, initialStatuses, initialAudit }: {
  profile: { full_name: string; email: string; role: string };
  initialClinics: Clinic[];
  initialStatuses: StatusRow[];
  initialAudit: AuditRow[];
}) {
  const router   = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("overview");

  const statusByClinic = new Map(initialStatuses.map(s => [s.clinic_id, s]));
  const accepting   = initialStatuses.filter(s => s.accepting_status === "accepting").length;
  const waitlist    = initialStatuses.filter(s => s.accepting_status === "waitlist").length;
  const notAcc      = initialStatuses.filter(s => s.accepting_status === "not_accepting").length;
  const noStatus    = initialClinics.length - initialStatuses.length;

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push("/login"); };

  const badge = (s?: StatusRow) => {
    if (!s) return <span style={{ color: "#555" }}>—</span>;
    const c = s.accepting_status === "accepting" ? "#1db954" : s.accepting_status === "waitlist" ? "#d4af4f" : "#e03e3e";
    return <span style={{ color: c, fontFamily: "DM Mono, monospace", fontSize: 10 }}>{s.accepting_status.replace("_", " ").toUpperCase()}</span>;
  };

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div>
          <div style={S.hTitle}>MD METHADONE — ADMIN</div>
          <div style={S.hSub}>{profile.full_name} · {profile.email} · {profile.role}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/find-clinic" target="_blank" rel="noopener" style={S.hBtn}>↗ Live Site</a>
          <button onClick={handleSignOut} style={{ ...S.hBtn, cursor: "pointer", border: "none" }}>Sign Out</button>
        </div>
      </div>

      <div style={S.statsBar}>
        {[
          { n: initialClinics.length, l: "CLINICS",       c: "#b8952a" },
          { n: accepting,             l: "ACCEPTING",     c: "#1db954" },
          { n: waitlist,              l: "WAITLIST",      c: "#d4af4f" },
          { n: notAcc,                l: "NOT ACCEPTING", c: "#e03e3e" },
          { n: noStatus,              l: "NO STATUS YET", c: "#555" },
        ].map(({ n, l, c }) => (
          <div key={l} style={S.statCard}>
            <div style={{ ...S.statN, color: c }}>{n}</div>
            <div style={S.statL}>{l}</div>
          </div>
        ))}
      </div>

      <div style={S.tabs}>
        {(["overview", "clinics", "audit", "users"] as Tab[]).map(t => (
          <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }} onClick={() => setTab(t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={S.content}>
        {tab === "overview" && (
          <div>
            {noStatus > 0 && (
              <div style={S.alertBox}>
                <div style={S.alertTitle}>⚠ {noStatus} clinics have no published status yet</div>
                <p style={{ fontSize: 13, color: "#a08060", marginTop: 6 }}>
                  These clinics will show as &quot;status unknown&quot; on the public finder until a manager
                  publishes one, or you set it in Supabase → Table Editor → clinic_status.
                </p>
              </div>
            )}
            <div style={S.cardGrid}>
              {[
                { title: "Clinics", body: "View every clinic and its current accepting status.", action: () => setTab("clinics"), label: "View Clinics →" },
                { title: "Audit Log", body: "Record of all status changes, logins, and edits.", action: () => setTab("audit"), label: "View Audit Log →" },
                { title: "Users", body: "Approve registrations, assign clinics, manage roles.", action: () => setTab("users"), label: "Manage Users →" },
              ].map(({ title, body, action, label }) => (
                <div key={title} style={S.iCard}>
                  <div style={S.iTitle}>{title}</div>
                  <div style={S.iBody}>{body}</div>
                  <button style={S.iBtn} onClick={action}>{label}</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "clinics" && (
          <div>
            <div style={S.secTitle}>{initialClinics.length} Clinics</div>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>{["Name", "City", "County", "Region", "Status"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {initialClinics.slice(0, 100).map(c => (
                    <tr key={c.id}>
                      <td style={S.td}>{c.name}</td>
                      <td style={S.td}>{c.city || "—"}</td>
                      <td style={S.td}>{c.county}</td>
                      <td style={S.td}>{c.region}</td>
                      <td style={S.td}>{badge(statusByClinic.get(c.id))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {initialClinics.length > 100 && (
                <div style={{ fontFamily: "DM Mono,monospace", fontSize: 10, color: "#555", padding: "12px", textAlign: "center" }}>
                  Showing 100 of {initialClinics.length} — use Supabase Table Editor to view all
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "audit" && (
          <div>
            <div style={S.secTitle}>Audit Log — Last 150 Events</div>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>{["Timestamp", "Action", "User", "Notes"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {initialAudit.map(log => (
                    <tr key={log.id}>
                      <td style={S.td}>{new Date(log.created_at).toLocaleString()}</td>
                      <td style={{ ...S.td, color: "#7ec8e3", fontFamily: "DM Mono, monospace", fontSize: 10 }}>{log.action?.replace(/_/g, " ")}</td>
                      <td style={S.td}>{log.user_email || "—"}</td>
                      <td style={S.td}>{log.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "users" && (
          <div style={{ maxWidth: 680 }}>
            <div style={S.secTitle}>User Management</div>
            <p style={S.secBody}>
              To activate a new registration or change a user&apos;s role, go to
              Supabase → Table Editor → profiles.
              Set <code style={S.code}>is_active = true</code> and assign the correct
              <code style={S.code}>role</code> and <code style={S.code}>clinic_id</code>.
            </p>
            <div style={S.iCard}>
              <div style={S.iTitle}>Role Reference</div>
              <div style={S.iBody}>
                <code style={S.code}>global_admin</code> — Full system access, all clinics<br />
                <code style={S.code}>regional_admin</code> — Regional clinic access, audit read<br />
                <code style={S.code}>clinic_manager</code> — Update own clinic status + profile<br />
                <code style={S.code}>viewer</code> — Read-only (default after registration)
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap:     { fontFamily: "DM Sans, system-ui, sans-serif", background: "#080808", minHeight: "100vh", color: "#f2ead8" },
  header:   { background: "#0d0d0d", borderBottom: "3px solid #b8952a", padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" },
  hTitle:   { fontFamily: "DM Mono, monospace", fontSize: 13, color: "#b8952a", letterSpacing: 3 },
  hSub:     { fontFamily: "DM Mono, monospace", fontSize: 10, color: "#555", marginTop: 3 },
  hBtn:     { fontFamily: "DM Mono, monospace", fontSize: 10, color: "#b8952a", border: "1px solid #b8952a", padding: "6px 14px", background: "transparent", borderRadius: 2, textDecoration: "none" },
  statsBar: { display: "flex", gap: 1, background: "#111", borderBottom: "1px solid #1a1a1a" },
  statCard: { flex: 1, padding: "12px", background: "#0d0d0d", textAlign: "center" as const },
  statN:    { fontFamily: "DM Mono, monospace", fontSize: 26, lineHeight: "1" },
  statL:    { fontFamily: "DM Mono, monospace", fontSize: 8, color: "#555", letterSpacing: 2, marginTop: 2 },
  tabs:     { display: "flex", background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" },
  tab:      { padding: "10px 20px", background: "transparent", border: "none", color: "#555", fontFamily: "DM Mono, monospace", fontSize: 10, letterSpacing: 2, cursor: "pointer" },
  tabOn:    { color: "#b8952a", borderBottom: "2px solid #b8952a" },
  content:  { padding: "1.5rem" },
  alertBox: { background: "#1a0a0a", border: "1px solid rgba(224,62,62,.3)", padding: "1rem", marginBottom: "1.5rem", borderRadius: 2 },
  alertTitle: { color: "#e03e3e", fontFamily: "DM Mono, monospace", fontSize: 11 },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 },
  iCard:    { background: "#111", border: "1px solid #1a1a1a", padding: "1.25rem", borderRadius: 2 },
  iTitle:   { fontFamily: "DM Mono, monospace", fontSize: 11, color: "#b8952a", letterSpacing: 1, marginBottom: 8 },
  iBody:    { fontSize: 13, color: "#7a7060", lineHeight: 1.6, marginBottom: 12 },
  iBtn:     { background: "transparent", border: "1px solid #b8952a", color: "#b8952a", padding: "7px 14px", fontFamily: "DM Mono, monospace", fontSize: 10, letterSpacing: 1, cursor: "pointer", borderRadius: 2 },
  secTitle: { fontFamily: "DM Mono, monospace", fontSize: 11, color: "#b8952a", letterSpacing: 2, marginBottom: 12 },
  secBody:  { fontSize: 13, color: "#7a7060", lineHeight: 1.7, marginBottom: "1rem" },
  table:    { width: "100%", borderCollapse: "collapse" as const, fontSize: 12 },
  th:       { background: "#111", padding: "8px 12px", textAlign: "left" as const, fontFamily: "DM Mono, monospace", fontSize: 9, color: "#555", letterSpacing: 1, fontWeight: 400, whiteSpace: "nowrap" as const },
  td:       { padding: "8px 12px", borderBottom: "1px solid #111", color: "#c8bfaa", fontSize: 12 },
  code:     { fontFamily: "DM Mono, monospace", background: "#1a1a1a", padding: "1px 6px", color: "#b8952a", fontSize: 11 },
};
