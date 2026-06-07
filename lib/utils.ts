import type { FreshnessStatus } from "@/types/database";

/**
 * Freshness of a clinic's "accepting" status from its updated_at timestamp.
 * Methadone intake status changes less often than bed counts, so the windows
 * are measured in days, not hours.
 */
export function getFreshness(updatedAt: string | null): FreshnessStatus {
  if (!updatedAt) return "stale";
  const ageDays = (Date.now() - new Date(updatedAt).getTime()) / 86_400_000;
  if (ageDays < 7)  return "live";
  if (ageDays < 30) return "warning";
  return "stale";
}

/**
 * Human-readable age string from a timestamp
 */
export function ageString(updatedAt: string | null): string {
  if (!updatedAt) return "unknown";
  const m = Math.round((Date.now() - new Date(updatedAt).getTime()) / 60_000);
  if (m < 60)   return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}

/**
 * Route by user role
 */
export function getDashboardRoute(role: string): string {
  switch (role) {
    case "global_admin":
    case "regional_admin":
      return "/admin/dashboard";
    case "clinic_manager":
      return "/portal/dashboard";
    default:
      return "/find-clinic";
  }
}

/**
 * Escape CSV field
 */
export function csvEsc(val: string | null | undefined): string {
  if (!val) return "";
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
