import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const isSupabaseConfigured = Boolean(
  url &&
  anonKey &&
  !url.includes('your-project-ref') &&
  !anonKey.includes('your-anon-public-key') &&
  anonKey.length > 20
)

// Only the public anon key is ever used in the browser. Authorization is enforced by RLS.
export const supabase = createClient(
  isSupabaseConfigured ? url! : 'http://localhost:54321',
  isSupabaseConfigured ? anonKey! : 'unconfigured',
  { auth: { persistSession: true, autoRefreshToken: true } },
)

