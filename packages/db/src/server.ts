import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

const serverSupabaseUrlEnvKey = "SUPABASE_URL";
const serverSupabaseServiceRoleKeyEnvKey = "SUPABASE_SERVICE_ROLE_KEY";

export const serverSupabaseEnvKeys = {
  url: serverSupabaseUrlEnvKey,
  serviceRoleKey: serverSupabaseServiceRoleKeyEnvKey
} as const;

export type SupabaseServerCookieMethods = CookieMethodsServer;

const emptyCookieMethods: SupabaseServerCookieMethods = {
  getAll: () => []
};

function requireEnvValue(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required Supabase server environment variable: ${name}.`);
  }

  return value;
}

export function createSupabaseServiceRoleClient(
  cookies: SupabaseServerCookieMethods = emptyCookieMethods
): SupabaseClient<Database> {
  return createServerClient<Database>(
    requireEnvValue(serverSupabaseUrlEnvKey),
    requireEnvValue(serverSupabaseServiceRoleKeyEnvKey),
    {
      cookies,
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false
      }
    }
  );
}
