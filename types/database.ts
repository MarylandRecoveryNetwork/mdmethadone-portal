// ═══════════════════════════════════════════════════════════
// MD Methadone Finder — Database TypeScript Types
// Matches the Supabase schema in /supabase/schema.sql
// ═══════════════════════════════════════════════════════════

export type UserRole =
  | "global_admin"
  | "regional_admin"
  | "clinic_manager"
  | "viewer";

export type RegionType =
  | "Central"
  | "Western"
  | "Capital"
  | "Southern"
  | "Eastern";

// Whether a clinic is taking new patients right now.
export type AcceptingStatus = "accepting" | "waitlist" | "not_accepting";

export type FreshnessStatus = "live" | "warning" | "stale";

export type AuditAction =
  | "status_update"
  | "clinic_profile_update"
  | "user_login"
  | "user_logout"
  | "admin_override"
  | "account_created";

// ── CLINICS ───────────────────────────────────────────────
export interface Clinic {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  city: string | null;
  county: string;
  region: RegionType;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  phone_number: string | null;
  website_url: string | null;
  intake_email: string | null;
  hours: string | null;
  // Medications offered
  offers_methadone: boolean;
  offers_buprenorphine: boolean; // Suboxone / Subutex
  offers_naltrexone: boolean;    // Vivitrol
  // Payment / access
  accepts_medicaid: boolean;
  accepts_medicare: boolean;
  accepts_private: boolean;
  sliding_scale: boolean;
  uninsured_ok: boolean;
  telehealth: boolean;
  description: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

// ── CLINIC STATUS ─────────────────────────────────────────
export interface ClinicStatus {
  id: string;
  clinic_id: string;
  accepting_status: AcceptingStatus;
  waitlist_note: string | null;   // e.g. "~2 week wait"
  updated_at: string;
  updated_by: string | null;
  next_update_due: string | null;
}

// ── PROFILES ──────────────────────────────────────────────
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  clinic_id: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── AUDIT LOGS ────────────────────────────────────────────
export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: UserRole | null;
  ip_address: string | null;
  user_agent: string | null;
  action: AuditAction;
  clinic_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
}

// ── LIVE STATUS VIEW ──────────────────────────────────────
export interface LiveStatusRow {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  city: string | null;
  county: string;
  region: RegionType;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  phone_number: string | null;
  website_url: string | null;
  intake_email: string | null;
  hours: string | null;
  offers_methadone: boolean;
  offers_buprenorphine: boolean;
  offers_naltrexone: boolean;
  accepts_medicaid: boolean;
  accepts_medicare: boolean;
  accepts_private: boolean;
  sliding_scale: boolean;
  uninsured_ok: boolean;
  telehealth: boolean;
  accepting_status: AcceptingStatus;
  waitlist_note: string | null;
  status_updated_at: string | null;
  freshness_status: FreshnessStatus;
  description: string | null;
}

// ── API PAYLOADS ──────────────────────────────────────────
export interface StatusUpdatePayload {
  clinic_id: string;
  accepting_status: AcceptingStatus;
  waitlist_note?: string;
  notes?: string;
}

export interface ClinicUpdatePayload {
  clinic_id: string;
  phone_number?: string;
  website_url?: string;
  intake_email?: string;
  hours?: string;
  description?: string;
  offers_methadone?: boolean;
  offers_buprenorphine?: boolean;
  offers_naltrexone?: boolean;
  accepts_medicaid?: boolean;
  accepts_medicare?: boolean;
  accepts_private?: boolean;
  sliding_scale?: boolean;
  uninsured_ok?: boolean;
  telehealth?: boolean;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  clinic_id?: string;
}
