import { createBrowserClient } from '@supabase/ssr'

// Environment validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Browser client for client-side operations
export function createClient() {
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!)
}

// Export types for external use
export type { Database } from '@/types/database'
