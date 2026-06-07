import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase admin client using the service_role key.
 * NEVER import this in client components — service role key would be exposed.
 * Used only in API routes for operations that bypass RLS (user creation, etc.)
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Add these to your .env.local and Vercel environment variables."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
