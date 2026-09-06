'use client'

import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '../../src/database.types'

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error('Supabase is not configured. Add the environment values before signing in.')
  }

  browserClient ??= createBrowserClient<Database>(url, key)
  return browserClient
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
}
