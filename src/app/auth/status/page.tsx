'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default function AuthStatusPage() {
  const [user, setUser] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting session:', error)
        }
        
        setSession(session)
        setUser(session?.user || null)
        
        // Also check the user
        if (session?.user) {
          const { data: { user } } = await supabase.auth.getUser()
          console.log('User from getUser:', user)
        }
      } catch (error) {
        console.error('Auth check error:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session?.user?.id)
      setSession(session)
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading authentication status...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Authentication Status:</span>
              <Badge variant={user ? "default" : "secondary"}>
                {user ? "Authenticated" : "Not Authenticated"}
              </Badge>
            </div>

            {user && (
              <>
                <div className="space-y-2 border rounded-lg p-4">
                  <h3 className="font-medium mb-2">User Information:</h3>
                  <div className="text-sm space-y-1">
                    <p><span className="font-medium">ID:</span> {user.id}</p>
                    <p><span className="font-medium">Email:</span> {user.email || 'N/A'}</p>
                    <p><span className="font-medium">Provider:</span> {user.app_metadata?.provider || 'N/A'}</p>
                    <p><span className="font-medium">Created:</span> {new Date(user.created_at).toLocaleString()}</p>
                  </div>
                </div>

                <div className="space-y-2 border rounded-lg p-4">
                  <h3 className="font-medium mb-2">User Metadata:</h3>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(user.user_metadata, null, 2)}
                  </pre>
                </div>

                {session && (
                  <div className="space-y-2 border rounded-lg p-4">
                    <h3 className="font-medium mb-2">Session Information:</h3>
                    <div className="text-sm space-y-1">
                      <p><span className="font-medium">Access Token:</span> {session.access_token ? '✓ Present' : '✗ Missing'}</p>
                      <p><span className="font-medium">Refresh Token:</span> {session.refresh_token ? '✓ Present' : '✗ Missing'}</p>
                      <p><span className="font-medium">Expires:</span> {new Date(session.expires_at * 1000).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-4 pt-4">
              {user ? (
                <>
                  <Button asChild>
                    <Link href="/dashboard">Go to Dashboard</Link>
                  </Button>
                  <Button variant="outline" onClick={handleSignOut}>
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
