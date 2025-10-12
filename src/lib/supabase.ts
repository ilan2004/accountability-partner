import { createBrowserClient } from '@supabase/ssr'

// Get environment variables with build-time fallbacks
function getSupabaseClientEnv() {
  const isBuildTime = typeof window === 'undefined' && 
                      process.env.NODE_ENV === 'production' && 
                      !process.env.NEXT_PUBLIC_SUPABASE_URL
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 
                      (isBuildTime ? 'https://dummy.supabase.co' : undefined)
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                          (isBuildTime ? 'dummy-anon-key' : undefined)
  
  return { supabaseUrl, supabaseAnonKey, isBuildTime }
}

// Browser client for client-side operations
export function createClient() {
  const { supabaseUrl, supabaseAnonKey, isBuildTime } = getSupabaseClientEnv()
  
  // Validate at runtime (not build time)
  if (!isBuildTime && (!supabaseUrl || !supabaseAnonKey)) {
    throw new Error('Missing Supabase environment variables')
  }
  
  // Return dummy client during build
  if (isBuildTime) {
    console.warn('Using dummy Supabase client during build')
    return createBrowserClient(supabaseUrl!, supabaseAnonKey!)
  }
  
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!)
}

// Export types for external use
export type { Database } from '@/types/database'
