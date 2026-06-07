import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { LiveStatusRow } from "@/types/database";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; color: string; blurb: string }> = {
  accepting:     { label: "Accepting New Patients", color: "#1db954", blurb: "This clinic is currently accepting new patients. Call to begin intake." },
  waitlist:      { label: "Waitlist",               color: "#b8860b", blurb: "This clinic is adding new patients to a waitlist. Call for current wait times." },
  not_accepting: { label: "Not Accepting Patients", color: "#e03e3e", blurb: "This clinic is not taking new patients right now. Call to confirm or check back later." },
};

// Major commercial health plans operating in Maryland (informational).
const MD_PRIVATE_INSURERS = [
  "CareFirst BlueCross BlueShield",
  "Aetna",
  "Cigna",
  "UnitedHealthcare / Optum",
  "Kaiser Permanente",
  "Carelon Behavioral Health",
];

function countyLabel(county: string): string {
  return county === "Baltimore City" ? "Baltimore City" : `${county} County`;
}

async function getClinic(slug: string): Promise<LiveStatusRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_methadone_live_status")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as LiveStatusRow) || null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getClinic(slug);
  if (!c) return { title: "Clinic Not Found | Maryland Methadone Finder" };
  const where = [c.city, c.county ? countyLabel(c.county) : null].filter(Boolean).join(", ");
  const title = `${c.name} — Methadone Clinic in ${countyLabel(c.county)}, Maryland | Maryland Methadone Finder`;
  const description =
    `${c.name} is a methadone / opioid treatment program (OTP) in ${where}, Maryland. ` +
    `${STATUS_META[c.accepting_status]?.label || "See current intake status"}. ` +
    `Medications: ${[c.offers_methadone && "methadone", c.offers_buprenorphine && "buprenorphine", c.offers_naltrexone && "naltrexone"].filter(Boolean).join(", ") || "MAT"}.`;
  return {
    title,
    description,
    alternates: { canonical: `https://www.marylandmethadone.help/facilities/md/${slug}` },
    openGraph: { title, description, type: "website" },
  };
}

export default async function FacilityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getClinic(slug);
  if (!c) notFound();

  const sm = STATUS_META[c.accepting_status] || STATUS_META.accepting;
  const tel = (c.phone_number || "").replace(/[^\d]/g, "");
  const meds = [
    c.offers_methadone && "Methadone",
    c.offers_buprenorphine && "Buprenorphine (Suboxone)",
    c.offers_naltrexone && "Naltrexone (Vivitrol)",
  ].filter(Boolean) as string[];
  const pays = [
    c.accepts_medicaid && "Medicaid",
    c.accepts_medicare && "Medicare",
    c.accepts_private && "Private insurance",
    c.uninsured_ok && "Self-pay",
    c.sliding_scale && "Sliding scale",
  ].filter(Boolean) as string[];
  const fullAddr = [c.address, c.city, "MD", c.zip].filter(Boolean).join(", ");
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.name + " " + fullAddr)}`;
  const streetHref = c.lat != null && c.lng != null
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${c.lat},${c.lng}` : null;
  const referHref = `https://mail.google.com/mail/?view=cm&fs=1&to=info@marylandmethadone.help&su=${encodeURIComponent("Referral / Admissions Inquiry — " + c.name)}&body=${encodeURIComponent("I am inquiring about admissions / a referral for " + c.name + ".")}`;
  const osm = c.lat != null && c.lng != null
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${c.lng - 0.02}%2C${c.lat - 0.015}%2C${c.lng + 0.02}%2C${c.lat + 0.015}&layer=mapnik&marker=${c.lat}%2C${c.lng}`
    : null;
  const updated = c.status_updated_at
    ? new Date(c.status_updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  // JSON-LD structured data for SEO / rich results
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name: c.name,
    address: { "@type": "PostalAddress", streetAddress: c.address, addressLocality: c.city, addressRegion: "MD", postalCode: c.zip, addressCountry: "US" },
    telephone: c.phone_number || undefined,
    url: c.website_url || `https://www.marylandmethadone.help/facilities/md/${slug}`,
    medicalSpecialty: "Addiction Medicine",
    ...(c.lat != null && c.lng != null ? { geo: { "@type": "GeoCoordinates", latitude: c.lat, longitude: c.lng } } : {}),
  };

  return (
    <div style={S.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* top nav */}
      <nav style={S.nav}>
        <a href="/find-clinic" style={S.brand}>Maryland Methadone Finder</a>
        <a href="tel:988" style={S.crisis}>⚠ Crisis: 988</a>
      </nav>

      <div style={S.wrap}>
        {/* breadcrumbs */}
        <div style={S.crumbs}>
          <a href="/find-clinic" style={S.crumbLink}>Find a Clinic</a>
          <span style={S.crumbSep}>›</span>
          <span>{countyLabel(c.county)}</span>
          <span style={S.crumbSep}>›</span>
          <span style={{ color: "#1a1a1a" }}>{c.name}</span>
        </div>

        {/* header */}
        <div style={S.header}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 style={S.h1}>{c.name}</h1>
            <div style={S.sub}>{fullAddr}</div>
            <div style={{ ...S.statusBadge, background: sm.color }}>● {sm.label}</div>
            {updated && <div style={S.updated}>Status updated {updated}</div>}
          </div>
          <div style={S.ctaCol}>
            {c.phone_number && <a href={`tel:${tel}`} style={S.callBtn}>📞 Call {c.phone_number}</a>}
            <a href={mapsHref} target="_blank" rel="noopener" style={S.dirBtn}>🧭 Get Directions</a>
            {streetHref && <a href={streetHref} target="_blank" rel="noopener" style={S.dirBtn}>🌐 Street View</a>}
            <a href={referHref} target="_blank" rel="noopener" style={S.dirBtn}>✉️ Refer / Inquire</a>
            {c.website_url && <a href={c.website_url} target="_blank" rel="noopener" style={S.dirBtn}>🔗 Website</a>}
          </div>
        </div>

        {/* status blurb */}
        <div style={{ ...S.statusNote, borderColor: sm.color }}>{sm.blurb}
          {c.accepting_status === "waitlist" && c.waitlist_note ? ` — ${c.waitlist_note}` : ""}
        </div>

        {/* content grid */}
        <div style={S.grid}>
          <div style={S.card}>
            <div style={S.cardTitle}>Medications Offered (MAT)</div>
            {meds.length ? <div style={S.tags}>{meds.map(m => <span key={m} style={S.tag}>{m}</span>)}</div>
              : <div style={S.muted}>Call to confirm medication options.</div>}
            <div style={S.note}>Medication for opioid use disorder (MOUD). Verify specifics with the clinic.</div>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Insurance & Payment</div>
            {pays.length ? <div style={S.tags}>{pays.map(p => <span key={p} style={S.tag}>{p}</span>)}</div>
              : <div style={S.muted}>Call to ask about insurance and payment options.</div>}
            {c.telehealth && <div style={{ ...S.tag, marginTop: 10, display: "inline-block", background: "#e7f0ff", color: "#1a4fa0", borderColor: "#b9d2ff" }}>Telehealth available</div>}
            {c.accepts_private && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Major Maryland plans commonly accepted:</div>
                <div style={S.tags}>{MD_PRIVATE_INSURERS.map(p => <span key={p} style={S.tag}>{p}</span>)}</div>
                <div style={S.note}>Verify your specific plan and copay with the clinic before your first visit.</div>
              </div>
            )}
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Location & Hours</div>
            <div style={S.kv}><b>Address:</b> {fullAddr}</div>
            <div style={S.kv}><b>County:</b> {countyLabel(c.county)} ({c.region} Maryland)</div>
            {c.hours && <div style={S.kv}><b>Hours:</b> {c.hours}</div>}
            {c.phone_number && <div style={S.kv}><b>Phone:</b> <a href={`tel:${tel}`}>{c.phone_number}</a></div>}
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>About</div>
            {c.description
              ? <div style={S.kv}>{c.description}</div>
              : <div style={S.muted}>{c.name} is a state-listed opioid treatment program (OTP) in {countyLabel(c.county)}, Maryland.</div>}
            <div style={{ ...S.note, marginTop: 12 }}>
              Is this your clinic? <a href={`mailto:admin@marylandmethadone.help?subject=Claim profile: ${encodeURIComponent(c.name)}`}>Claim this profile</a> to keep your status and details up to date.
            </div>
          </div>
        </div>

        {/* map */}
        {osm && (
          <div style={S.mapBox}>
            <iframe title={`Map of ${c.name}`} src={osm} style={{ width: "100%", height: 320, border: "none" }} loading="lazy" />
          </div>
        )}

        {/* footer */}
        <div style={S.footer}>
          <p>If you are in crisis, call or text <b>988</b>. Maryland 211 offers 24/7 referral help — dial <b>211</b>.</p>
          <p style={{ marginTop: 8 }}>
            This page is informational. Always call the clinic to confirm current availability, hours, and intake requirements.
            {" "}<a href="/find-clinic">← Back to all clinics</a>
          </p>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:   { background: "#f7f6f2", minHeight: "100vh", color: "#1a1a1a", fontFamily: "'DM Sans', system-ui, sans-serif" },
  nav:    { background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 1.25rem", height: 52, borderBottom: "3px solid #FFB81C" },
  brand:  { color: "#FFB81C", fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 16, textDecoration: "none" },
  crisis: { background: "#E03E3E", color: "#fff", padding: "5px 12px", borderRadius: 3, fontSize: 12, fontWeight: 600, textDecoration: "none" },
  wrap:   { maxWidth: 980, margin: "0 auto", padding: "1.5rem 1.25rem 3rem" },
  crumbs: { fontSize: 12, color: "#6b6760", marginBottom: "1rem", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontFamily: "'DM Mono', monospace" },
  crumbLink: { color: "#b8860b", textDecoration: "none" },
  crumbSep: { color: "#bbb" },
  header: { display: "flex", gap: "1.5rem", flexWrap: "wrap", background: "#fff", border: "1px solid rgba(26,26,26,.12)", borderRadius: 6, padding: "1.5rem" },
  h1:     { fontFamily: "Georgia, serif", fontSize: 28, lineHeight: 1.15, margin: 0 },
  sub:    { color: "#6b6760", fontSize: 14, marginTop: 6 },
  statusBadge: { display: "inline-block", color: "#fff", fontWeight: 700, fontSize: 13, padding: "6px 14px", borderRadius: 4, marginTop: 14, letterSpacing: .3 },
  updated: { fontSize: 11, color: "#8a857c", marginTop: 8, fontFamily: "'DM Mono', monospace" },
  ctaCol: { display: "flex", flexDirection: "column", gap: 8, minWidth: 200 },
  callBtn: { background: "#FFB81C", color: "#1a1a1a", fontWeight: 700, textAlign: "center", padding: "12px 16px", borderRadius: 4, textDecoration: "none", fontSize: 15 },
  dirBtn: { background: "#fff", color: "#1a1a1a", border: "1px solid rgba(26,26,26,.2)", textAlign: "center", padding: "10px 16px", borderRadius: 4, textDecoration: "none", fontSize: 13 },
  statusNote: { background: "#fff", borderLeft: "4px solid", borderRadius: 4, padding: "12px 16px", margin: "1rem 0", fontSize: 14, border: "1px solid rgba(26,26,26,.12)" },
  grid:   { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1rem" },
  card:   { background: "#fff", border: "1px solid rgba(26,26,26,.12)", borderRadius: 6, padding: "1.25rem" },
  cardTitle: { fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: 1.5, color: "#b8860b", textTransform: "uppercase", marginBottom: 12 },
  tags:   { display: "flex", flexWrap: "wrap", gap: 6 },
  tag:    { fontSize: 12, padding: "4px 10px", borderRadius: 3, background: "rgba(255,184,28,.12)", color: "#8a6d12", border: "1px solid rgba(255,184,28,.4)" },
  kv:     { fontSize: 14, marginBottom: 8, lineHeight: 1.6 },
  muted:  { color: "#6b6760", fontSize: 14 },
  note:   { fontSize: 12, color: "#8a857c", marginTop: 10, lineHeight: 1.5 },
  mapBox: { background: "#fff", border: "1px solid rgba(26,26,26,.12)", borderRadius: 6, overflow: "hidden", marginBottom: "1rem" },
  footer: { fontSize: 12, color: "#6b6760", lineHeight: 1.7, borderTop: "1px solid rgba(26,26,26,.12)", paddingTop: "1rem", marginTop: "1rem" },
};
