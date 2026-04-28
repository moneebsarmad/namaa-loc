import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

const browserSupabaseUrlEnvKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL"
] as const;

const browserSupabaseAnonKeyEnvKeys = [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY"
] as const;

export const browserSupabaseEnvKeys = {
  url: browserSupabaseUrlEnvKeys,
  anonKey: browserSupabaseAnonKeyEnvKeys
} as const;

function readFirstEnvValue(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];

    if (value) {
      return value;
    }
  }

  return undefined;
}

function requireEnvValue(names: readonly string[], label: string): string {
  const value = readFirstEnvValue(names);

  if (!value) {
    throw new Error(
      `Missing Supabase ${label}. Set one of: ${names.join(", ")}.`
    );
  }

  return value;
}

export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    requireEnvValue(browserSupabaseUrlEnvKeys, "URL"),
    requireEnvValue(browserSupabaseAnonKeyEnvKeys, "anon key")
  );
}
