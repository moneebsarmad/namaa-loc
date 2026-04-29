import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

export function createSupabaseBrowserClient(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
): SupabaseClient<Database> {
  if (!url) throw new Error("Missing Supabase URL.");
  if (!anonKey) throw new Error("Missing Supabase anon key.");
  return createBrowserClient<Database>(url, anonKey);
}
