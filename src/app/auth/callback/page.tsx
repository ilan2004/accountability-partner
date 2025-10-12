import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'

// Force dynamic rendering for this authentication page
export const dynamic = 'force-dynamic'

export default async function AuthCallback({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; redirectedFrom?: string }>
}) {
  const supabase = await createServerSupabaseClient()
  const params = await searchParams

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code)
    
    if (error) {
      console.error('Error exchanging code for session:', error)
      redirect('/login?error=auth_callback_error')
    }

    if (data.session) {
      const { user } = data.session
      
      // Use admin client to check and create users (bypass RLS)
      const adminSupabase = createAdminClient()
      
      // Check if user exists in our database
      const { data: existingUser } = await adminSupabase
        .from('users')
        .select('*')
        .eq('notion_id', user.id)
        .single()

      // If user doesn't exist, create them
      if (!existingUser) {
        const { error: insertError } = await adminSupabase
          .from('users')
          .insert({
            notion_id: user.id,
            name: user.user_metadata?.name || user.email || 'User',
          })

        if (insertError) {
          console.error('Error creating user:', insertError)
          // Continue anyway, they might still be able to use the app
        }
      }

      // Redirect to the originally requested page or dashboard
      const redirectTo = params.redirectedFrom || '/dashboard'
      redirect(redirectTo)
    }
  }

  // Fallback redirect if something went wrong
  redirect('/login?error=auth_failed')
}
