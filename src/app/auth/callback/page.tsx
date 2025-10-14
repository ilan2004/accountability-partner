'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

function AuthCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')
      const redirectedFrom = searchParams.get('redirectedFrom')
      
      console.log('Auth callback params:', { code, error, errorDescription, redirectedFrom })
      
      // Handle OAuth errors
      if (error) {
        console.error('OAuth error:', error, errorDescription)
        router.push(`/login?error=${encodeURIComponent(errorDescription || error)}`)
        return
      }
      
      // No code provided
      if (!code) {
        console.log('No code provided')
        router.push('/login?error=no_code')
        return
      }
      
      try {
        const supabase = createClient()
        
        // Exchange code for session - this happens automatically in the client
        // when the page loads with a valid code
        
        // Wait a bit for the auth to process
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Check if we have a session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          throw sessionError
        }
        
        if (!session) {
          console.error('No session after auth callback')
          throw new Error('Authentication failed - no session created')
        }
        
        console.log('Authentication successful:', session.user.id)
        
        // Create user in database if needed using API endpoint
        try {
          const response = await fetch('/api/auth/create-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              notion_id: session.user.id,
              name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            })
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            console.error('Error creating user via API:', errorData)
            // Don't fail auth because of this
          }
        } catch (apiError) {
          console.error('API error:', apiError)
          // Continue anyway
        }
        
        // Redirect to dashboard or requested page
        const redirectTo = redirectedFrom || '/dashboard'
        console.log('Redirecting to:', redirectTo)
        router.push(redirectTo)
        
      } catch (error: any) {
        console.error('Auth callback error:', error)
        setError(error.message || 'Authentication failed')
        setTimeout(() => {
          router.push(`/login?error=${encodeURIComponent(error.message || 'auth_failed')}`)
        }, 2000)
      }
    }
    
    handleCallback()
  }, [router, searchParams])
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {error ? (
            <div className="text-center space-y-4">
              <div className="text-red-600 font-medium">{error}</div>
              <div className="text-sm text-muted-foreground">Redirecting to login...</div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-muted-foreground">Completing authentication...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <AuthCallbackInner />
    </Suspense>
  )
}
