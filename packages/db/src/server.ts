import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

const serverSupabaseUrlEnvKeys = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"] as const;
const serverSupabaseAnonKeyEnvKeys = [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY"
] as const;
const serverSupabaseServiceRoleKeyEnvKey = "SUPABASE_SERVICE_ROLE_KEY";

export const serverSupabaseEnvKeys = {
  url: serverSupabaseUrlEnvKeys,
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

function requireFirstEnvValue(names: readonly string[]): string {
  for (const name of names) {
    const value = process.env[name];

    if (value) {
      return value;
    }
  }

  throw new Error(
    `Missing required Supabase server environment variable. Set one of: ${names.join(", ")}.`
  );
}

export function createSupabaseServiceRoleClient(
  cookies: SupabaseServerCookieMethods = emptyCookieMethods
): SupabaseClient<Database> {
  return createServerClient<Database>(
    requireFirstEnvValue(serverSupabaseUrlEnvKeys),
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

export async function createSupabaseServerClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    requireFirstEnvValue(serverSupabaseUrlEnvKeys),
    requireFirstEnvValue(serverSupabaseAnonKeyEnvKeys),
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => {
          cookieStore.set({ name, value, ...options });
        },
        remove: (name, options) => {
          cookieStore.set({ name, value: "", ...options });
        }
      },
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false
      }
    }
  );
}
