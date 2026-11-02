// Supabase client. Lovable Cloud fills in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ?? "";
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ??
  (import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined) ??
  "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

export const supabase = createClient(
  SUPABASE_URL || "http://localhost:54321",
  SUPABASE_PUBLISHABLE_KEY || "missing-key",
  {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: typeof window !== "undefined",
      autoRefreshToken: typeof window !== "undefined",
    },
  },
);
