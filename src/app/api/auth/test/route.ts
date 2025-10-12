import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Test basic connection
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    // Try to query users table (will fail if not authenticated with proper permissions)
    let usersData = null
    let usersError = null
    
    if (session) {
      const result = await supabase.from('users').select('*').limit(1)
      usersData = result.data
      usersError = result.error
    }
    
    return NextResponse.json({
      success: true,
      hasSession: !!session,
      sessionError: sessionError?.message || null,
      userId: session?.user?.id || null,
      userEmail: session?.user?.email || null,
      provider: session?.user?.app_metadata?.provider || null,
      usersTableAccess: {
        canAccess: !usersError,
        error: usersError?.message || null,
        rowCount: usersData?.length || 0
      },
      env: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
