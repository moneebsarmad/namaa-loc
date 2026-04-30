import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "@namaa-loc/db";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (!supabaseClient) {
    try {
      supabaseClient = createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }

  return supabaseClient;
}
