'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'

export default function AuthDebugPage() {
  const [loading, setLoading] = useState(true)
  const [authState, setAuthState] = useState<any>({})
  const [testResults, setTestResults] = useState<any>({})
  const supabase = createClient()

  useEffect(() => {
    checkAuthState()
  }, [])

  const checkAuthState = async () => {
    setLoading(true)
    const results: any = {}

    try {
      // 1. Check session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      results.session = {
        exists: !!session,
        error: sessionError?.message,
        userId: session?.user?.id,
        email: session?.user?.email,
        provider: session?.user?.app_metadata?.provider
      }

      // 2. Check user
      if (session) {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        results.user = {
          exists: !!user,
          error: userError?.message,
          metadata: user?.user_metadata
        }
      }

      // 3. Check auth state
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state change:', event, session?.user?.id)
      })

      // 4. Test API endpoint
      try {
        const response = await fetch('/api/auth/test')
        const apiData = await response.json()
        results.api = apiData
      } catch (e: any) {
        results.api = { error: e.message }
      }

      // 5. Check cookies
      results.cookies = {
        hasCookies: document.cookie.includes('sb-'),
        cookies: document.cookie.split(';').filter(c => c.includes('sb-')).map(c => c.trim().split('=')[0])
      }

      // Clean up listener
      authListener.subscription.unsubscribe()

      setTestResults(results)
      setAuthState({
        session,
        isAuthenticated: !!session,
        provider: session?.user?.app_metadata?.provider || 'none'
      })
    } catch (error: any) {
      console.error('Debug error:', error)
      setTestResults({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const clearAuthState = async () => {
    // Clear all Supabase cookies
    document.cookie.split(";").forEach((c) => {
      if (c.includes('sb-')) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      }
    })
    
    // Sign out
    await supabase.auth.signOut()
    
    // Clear local storage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key)
      }
    })
    
    window.location.reload()
  }

  const testNotionLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'notion',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      
      if (error) {
        alert(`Error: ${error.message}`)
      }
    } catch (error: any) {
      alert(`Exception: ${error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Debug Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Auth Status */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Current Status</h3>
              <div className="flex items-center gap-4">
                <Badge variant={authState.isAuthenticated ? "default" : "secondary"}>
                  {authState.isAuthenticated ? "Authenticated" : "Not Authenticated"}
                </Badge>
                {authState.provider && (
                  <Badge variant="outline">Provider: {authState.provider}</Badge>
                )}
              </div>
            </div>

            {/* Session Check */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Session Check</h3>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  {testResults.session?.exists ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span>Session exists: {testResults.session?.exists ? 'Yes' : 'No'}</span>
                </div>
                {testResults.session?.userId && (
                  <p className="text-sm text-muted-foreground">User ID: {testResults.session.userId}</p>
                )}
                {testResults.session?.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{testResults.session.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            {/* API Test Results */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">API Test Results</h3>
              <div className="bg-muted p-4 rounded-lg">
                {testResults.api && (
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(testResults.api, null, 2)}
                  </pre>
                )}
              </div>
            </div>

            {/* Cookie Check */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Cookie Status</h3>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  {testResults.cookies?.hasCookies ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span>Supabase cookies present: {testResults.cookies?.hasCookies ? 'Yes' : 'No'}</span>
                </div>
                {testResults.cookies?.cookies?.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Cookies: {testResults.cookies.cookies.join(', ')}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <Button onClick={checkAuthState} variant="outline">
                Refresh Status
              </Button>
              <Button onClick={clearAuthState} variant="destructive">
                Clear All Auth Data
              </Button>
              <Button onClick={testNotionLogin}>
                Test Notion Login
              </Button>
              <Button onClick={() => window.location.href = '/'} variant="outline">
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Troubleshooting Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Click "Clear All Auth Data" to start fresh</li>
              <li>Click "Test Notion Login" to attempt authentication</li>
              <li>After redirecting back, check if session exists</li>
              <li>Check browser console for any error messages</li>
              <li>If still not working, check Supabase dashboard:</li>
              <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                <li>Authentication → Providers → Notion is enabled</li>
                <li>Redirect URL is set to: http://localhost:3000/auth/callback</li>
                <li>Site URL is set to: http://localhost:3000</li>
              </ul>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
