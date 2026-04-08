import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Серверный клиент Supabase.
 * Использует service_role ключ — обходит RLS.
 * НИКОГДА не передавать на клиент.
 *
 * Ленивая инициализация: создаёт клиент только при первом вызове,
 * чтобы не падать во время Next.js build (когда env ещё не загружены).
 */
export function getSupabaseServer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase service role credentials. Check SUPABASE_SERVICE_ROLE_KEY in .env.local.'
    )
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
