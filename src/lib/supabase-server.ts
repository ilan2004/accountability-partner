import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Get environment variables (validation happens at runtime)
function getSupabaseEnv() {
  // During build, Next.js might not have access to runtime env vars
  // Provide dummy values to prevent build errors
  const isBuildTime = process.env.NODE_ENV === 'production' && 
                      !process.env.NEXT_PUBLIC_SUPABASE_URL &&
                      process.env.VERCEL === '1'
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 
                      (isBuildTime ? 'https://dummy.supabase.co' : undefined)
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                          (isBuildTime ? 'dummy-anon-key' : undefined)
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                                  (isBuildTime ? 'dummy-service-key' : undefined)

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    isBuildTime
  }
}

function validateSupabaseEnv() {
  const { supabaseUrl, supabaseAnonKey, isBuildTime } = getSupabaseEnv()
  
  // Skip validation during build time
  if (isBuildTime) {
    console.warn('Using dummy Supabase values during build. Real values must be set at runtime.')
    return
  }
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }
}

// Server client for server-side operations (App Router)
export async function createServerSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()
  validateSupabaseEnv()
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
      remove(name: string, options: any) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch (error) {
          // The `delete` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  })
}

// Middleware client for updating sessions
export function createMiddlewareSupabaseClient(
  request: NextRequest,
  response: NextResponse
) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()
  validateSupabaseEnv()
  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        request.cookies.set({ name, value, ...options })
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: any) {
        request.cookies.set({ name, value: '', ...options })
        response.cookies.set({ name, value: '', ...options })
      },
    },
  })
}

// Admin client with service role key for server-side operations that need elevated permissions
export function createAdminClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseEnv()
  if (!supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  return createServerClient(supabaseUrl, supabaseServiceRoleKey, {
    cookies: {
      get() { return undefined },
      set() {},
      remove() {},
    },
  })
}
