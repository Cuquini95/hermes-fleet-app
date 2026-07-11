import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Vercel environment values can accidentally include trailing line breaks when pasted.
// Supabase trims the URL internally, but the API key is used directly in HTTP headers,
// where a newline makes every Storage request fail before it reaches Supabase.
const SUPABASE_URL = (
  import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
).trim();
const SUPABASE_ANON_KEY = (
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'
).trim();

const isPlaceholder =
  SUPABASE_URL.includes('placeholder') || SUPABASE_ANON_KEY.includes('placeholder');

/**
 * Shared Supabase client. Null when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing or set to
 * the placeholder values, so callers can gracefully degrade (e.g. in local dev without Supabase).
 */
export const supabase: SupabaseClient | null = isPlaceholder
  ? null
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** True when a real Supabase client was constructed (env vars present and non-placeholder). */
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
