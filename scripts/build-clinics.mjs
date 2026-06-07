// Transform the Maryland OTP master CSV into:
//   1) the CLINICS array injected into public/tracker/index.html
//   2) supabase/clinics-import.csv (for Supabase Table Editor import)
//
// Run:  node scripts/build-clinics.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const SRC = "C:/Users/House Guest/Downloads/maryland_methadone_clinics_master.csv";

// ── city → county / region / approx coordinates ──────────────────
// region: Central | Western | Capital | Southern | Eastern
const CITY = {
  "aberdeen":        ["Harford","Central",39.5096,-76.1641],
  "annapolis":       ["Anne Arundel","Central",38.9784,-76.4922],
  "baltimore":       ["Baltimore City","Central",39.2904,-76.6122],
  "bel air":         ["Harford","Central",39.5359,-76.3483],
  "belcamp":         ["Harford","Central",39.4715,-76.2380],
  "brooklyn park":   ["Anne Arundel","Central",39.2237,-76.6105],
  "chestertown":     ["Kent","Eastern",39.2090,-76.0661],
  "columbia":        ["Howard","Central",39.2037,-76.8610],
  "cumberland":      ["Allegany","Western",39.6529,-78.7625],
  "dundalk":         ["Baltimore","Central",39.2509,-76.5205],
  "earleville":      ["Cecil","Eastern",39.4126,-75.9241],
  "easton":          ["Talbot","Eastern",38.7743,-76.0763],
  "edgewood":        ["Harford","Central",39.4187,-76.2944],
  "eldersburg":      ["Carroll","Central",39.4043,-76.9486],
  "elkridge":        ["Howard","Central",39.2126,-76.7141],
  "elkton":          ["Cecil","Eastern",39.6068,-75.8333],
  "ellicott city":   ["Howard","Central",39.2674,-76.7983],
  "essex":           ["Baltimore","Central",39.3092,-76.4750],
  "frederick":       ["Frederick","Western",39.4143,-77.4105],
  "germantown":      ["Montgomery","Capital",39.1732,-77.2717],
  "glen burnie":     ["Anne Arundel","Central",39.1626,-76.6247],
  "grasonville":     ["Queen Anne's","Eastern",38.9590,-76.2105],
  "hagerstown":      ["Washington","Western",39.6418,-77.7200],
  "havre de grace":  ["Harford","Central",39.5496,-76.0913],
  "jessup":          ["Anne Arundel","Central",39.1487,-76.7758],
  "joppa":           ["Harford","Central",39.4187,-76.3536],
  "lansdowne":       ["Baltimore","Central",39.2429,-76.6622],
  "laurel":          ["Prince George's","Capital",39.0993,-76.8483],
  "lavale":          ["Allegany","Western",39.6479,-78.8056],
  "lexington park":  ["St. Mary's","Southern",38.2668,-76.4527],
  "ocean city":      ["Worcester","Eastern",38.3365,-75.0849],
  "pikesville":      ["Baltimore","Central",39.3743,-76.7225],
  "pocomoke city":   ["Worcester","Eastern",38.0757,-75.5680],
  "prince frederick":["Calvert","Southern",38.5404,-76.5874],
  "rockville":       ["Montgomery","Capital",39.0840,-77.1528],
  "rosedale":        ["Baltimore","Central",39.3315,-76.5152],
  "salisbury":       ["Wicomico","Eastern",38.3607,-75.5994],
  "takoma park":     ["Montgomery","Capital",38.9779,-77.0075],
  "timonium":        ["Baltimore","Central",39.4376,-76.6097],
  "waldorf":         ["Charles","Southern",38.6246,-76.9391],
  "westminster":     ["Carroll","Central",39.5754,-76.9958],
  "woodlawn":        ["Baltimore","Central",39.3215,-76.7280],
};

// Correctional / detention OTPs — excluded from the public, patient-facing finder.
const EXCLUDE = /correctional|detention|central booking|transition center/i;

// ── tiny CSV parser (handles quoted fields with commas) ──────────
function parseCSV(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\r") {}
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const kebab = s => s.toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60);
const normCity = s => s.toLowerCase().replace(/,?\s*md\s*$/,"").replace(/\s+/g," ").trim();
// deterministic small offset so same-city pins don't perfectly stack (approx map)
function jitter(seed) {
  let h = 0; for (const ch of seed) h = (h*31 + ch.charCodeAt(0)) >>> 0;
  const a = ((h % 1000)/1000 - 0.5) * 0.03;
  const b = (((h>>>10) % 1000)/1000 - 0.5) * 0.03;
  return [a, b];
}

const raw = readFileSync(SRC, "utf8");
const rows = parseCSV(raw).filter(r => r.length >= 6 && r[0].trim());
const header = rows.shift(); // drop header line

const seen = new Set();
const clinics = [];
let excluded = [];

for (const r of rows) {
  const [name, street, city, , zip, phone, cert] = r.map(x => (x||"").trim());
  if (!name) continue;
  if (EXCLUDE.test(name)) { excluded.push(name); continue; }

  const key = normCity(city);
  const geo = CITY[key];
  if (!geo) { console.warn("⚠ no city mapping for:", city, "(", name, ")"); }
  const [county, region, baseLat, baseLng] = geo || ["Unknown","Central",null,null];

  let lat = null, lng = null;
  if (baseLat != null) {
    const [da, db] = jitter(name + street);
    lat = +(baseLat + da).toFixed(5);
    lng = +(baseLng + db).toFixed(5);
  }

  // unique slug from name + city + leading street number
  const num = (street.match(/^\d+/) || [""])[0];
  let slug = kebab(`${name}-${city}-${num}`);
  while (seen.has(slug)) slug += "-x";
  seen.add(slug);

  clinics.push({
    slug, name, address: street, city, county, region, zip,
    lat, lng, phone, website: "",
    // ── DEFAULTS — verify per clinic (see SETUP / portal) ──
    methadone: true,        // all are SAMHSA-certified OTPs → dispense methadone
    buprenorphine: false,   // unknown from source — clinic can toggle on
    naltrexone: false,      // unknown from source
    medicaid: true,         // MD Medicaid covers OTP; nearly all accept it
    private: true,          // most MD OTPs bill major commercial plans
    uninsured: true,        // self-pay accepted
    medicare: false, sliding: false, telehealth: false,
    is_active: true,
    is_verified: /certified/i.test(cert),
  });
}

// ── 1) write the CLINICS array into index.html ───────────────────
const arrText = "const CLINICS = [\n" + clinics.map(c => {
  const j = o => JSON.stringify(o);
  return `  { slug:${j(c.slug)}, name:${j(c.name)}, address:${j(c.address)}, city:${j(c.city)}, county:${j(c.county)}, region:${j(c.region)}, zip:${j(c.zip)}, lat:${c.lat}, lng:${c.lng}, phone:${j(c.phone)}, website:${j(c.website)}, methadone:${c.methadone}, buprenorphine:${c.buprenorphine}, naltrexone:${c.naltrexone}, medicaid:${c.medicaid}, medicare:${c.medicare}, private:${c.private}, sliding:${c.sliding}, uninsured:${c.uninsured}, telehealth:${c.telehealth} },`;
}).join("\n") + "\n];";

const htmlPath = join(root, "public", "tracker", "index.html");
let html = readFileSync(htmlPath, "utf8");
html = html.replace(/const CLINICS = \[[\s\S]*?\n\];/, arrText);
writeFileSync(htmlPath, html, "utf8");

// ── 2) write the Supabase import CSV ─────────────────────────────
const cols = ["slug","name","address","city","county","region","zip","lat","lng","phone_number","website_url","intake_email","hours","offers_methadone","offers_buprenorphine","offers_naltrexone","accepts_medicaid","accepts_medicare","accepts_private","sliding_scale","uninsured_ok","telehealth","is_active","is_verified"];
const esc = v => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
};
const csvLines = [cols.join(",")];
for (const c of clinics) {
  csvLines.push([
    c.slug, c.name, c.address, c.city, c.county, c.region, c.zip, c.lat ?? "", c.lng ?? "",
    c.phone, "", "", "",
    c.methadone, c.buprenorphine, c.naltrexone,
    c.medicaid, c.medicare, c.private, c.sliding, c.uninsured, c.telehealth,
    c.is_active, c.is_verified,
  ].map(esc).join(","));
}
writeFileSync(join(root, "supabase", "clinics-import.csv"), csvLines.join("\n") + "\n", "utf8");

console.log(`✓ ${clinics.length} clinics written to index.html + supabase/clinics-import.csv`);
console.log(`✓ excluded ${excluded.length} correctional/detention programs:`);
excluded.forEach(n => console.log("   - " + n));
console.log(`✓ counties: ${[...new Set(clinics.map(c=>c.county))].sort().join(", ")}`);
