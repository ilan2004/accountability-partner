'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'
import { getAuthCallbackURL } from '@/lib/utils/url'

// Force dynamic rendering for this authentication page
export const dynamic = 'force-dynamic'

function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectedFrom = searchParams.get('redirectedFrom')
  const urlError = searchParams.get('error')
  const supabase = createClient()

  useEffect(() => {
    // Set error from URL if present
    if (urlError) {
      setError(decodeURIComponent(urlError))
    }

    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/dashboard')
      }
    }
    checkUser()
  }, [router, supabase, urlError])

  const handleNotionLogin = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'notion',
        options: {
          redirectTo: getAuthCallbackURL(redirectedFrom),
        },
      })

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error during login:', error)
      setError(error instanceof Error ? error.message : 'Failed to login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary rounded-xl flex items-center justify-center mb-6">
            <span className="text-primary-foreground font-bold text-2xl">AP</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">
            Welcome back
          </h2>
          <p className="mt-2 text-muted-foreground">
            Sign in to your Accountability Partners account
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in with Notion</CardTitle>
            <CardDescription>
              Connect your Notion account to sync your tasks and start tracking progress
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleNotionLogin}
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting to Notion...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5 mr-2"
                    viewBox="0 0 100 100"
                    fill="currentColor"
                  >
                    <path d="M6.017 0C2.734 0 0 2.733 0 6.017v87.966C0 97.267 2.734 100 6.017 100h87.966c3.283 0 6.017-2.733 6.017-6.017V6.017C100 2.733 97.266 0 93.983 0H6.017zm2.494 15.482h53.473c1.898 0 2.871.43 3.633 1.054.762.643 1.27 1.505 1.523 3.15.079.605.117 1.21.117 2.026v48.965c0 5.415-.82 8.149-2.324 10.367-1.504 2.218-3.722 4.455-5.921 5.94-2.218 1.504-4.971 2.324-10.367 2.324H31.678c-5.415 0-8.168-.82-10.367-2.324-2.218-1.485-4.436-3.722-5.94-5.94-1.485-2.218-2.306-4.952-2.306-10.367V34.312c0-5.415.82-8.168 2.305-10.367 1.505-2.237 3.723-4.455 5.941-5.94.664-.449 1.348-.801 2.071-1.095-.02.137-.039.293-.039.45v40.523c0 1.015.273 1.269 1.172 1.367.82.078 2.129.098 4.035.098h5.402c.351 0 .625-.078.859-.234.235-.156.41-.43.547-.84.137-.41.215-.957.254-1.66.04-.703.06-1.562.06-2.578V17.527c0-.586.038-1.074.117-1.445.156-.703.546-1.133.878-1.387.332-.273.82-.41 1.797-.41z"/>
                  </svg>
                  Continue with Notion
                </>
              )}
            </Button>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                By signing in, you agree to sync your tasks and receive WhatsApp notifications
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>
            This is a private system for Ilan and Sidra's accountability partnership.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
