import { createSupabaseBrowserClient } from "@namaa-loc/db";
import type { SupabaseClient } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClient | null = null

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance

  supabaseInstance = createSupabaseBrowserClient() as SupabaseClient
  return supabaseInstance
}

// Lazy getter for backwards compatibility
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return Reflect.get(getSupabase(), prop)
  },
})
