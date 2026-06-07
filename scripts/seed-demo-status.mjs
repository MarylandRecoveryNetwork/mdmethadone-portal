// Distribute demo statuses across clinics so the map shows all three colors.
// Mix: ~60% accepting, ~20% waitlist, ~20% not_accepting (scattered by clinic id).
// These are PLACEHOLDER statuses — clinics/admin can update real ones anytime.
// Run:  node scripts/seed-demo-status.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: rows, error } = await sb.from("clinic_status").select("id").order("id");
if (error) { console.error(error); process.exit(1); }

const WAIT_NOTES = ["~1 week wait", "~2 week wait", "Call to join waitlist", "Short waitlist"];
let counts = { accepting: 0, waitlist: 0, not_accepting: 0 };
const now = new Date().toISOString();

let i = 0;
for (const r of rows) {
  const m = i % 5;                                   // 0,1,2 -> accepting | 3 -> waitlist | 4 -> not_accepting
  const s = m < 3 ? "accepting" : m === 3 ? "waitlist" : "not_accepting";
  const note = s === "waitlist" ? WAIT_NOTES[i % WAIT_NOTES.length] : null;
  const { error: e } = await sb.from("clinic_status")
    .update({ accepting_status: s, waitlist_note: note, updated_at: now })
    .eq("id", r.id);
  if (e) { console.error("update failed", r.id, e.message); }
  else counts[s]++;
  i++;
}

console.log(`✓ updated ${rows.length} clinics:`, counts);
