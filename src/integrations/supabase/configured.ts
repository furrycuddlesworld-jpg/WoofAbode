// Whether the backend is connected. Lives outside the auto-generated client file
// so the generated module stays untouched.
export const isSupabaseConfigured = Boolean(
  import.meta.env["VITE_SUPABASE_URL"] && import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
);
