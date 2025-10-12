'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Zap, Users, ArrowRight, BarChart3, MessageSquare, Target } from 'lucide-react'

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setIsLoggedIn(true)
      }
    }
    checkAuth()
  }, [supabase])

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 w-full z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center space-x-2">
            <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">AP</span>
            </div>
            <span className="text-xl font-bold">
              Accountability Partners
            </span>
          </div>
          <div className="flex items-center space-x-4">
            {isLoggedIn ? (
              <Button asChild>
                <Link href="/dashboard">
                  Go to Dashboard
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/login">
                  Get Started
                </Link>
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-24 px-6">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center space-y-6">
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              Stay Accountable,
              <br />
              <span className="text-muted-foreground">Achieve Together</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto">
              A personalized accountability system that syncs with Notion and sends
              WhatsApp reminders to keep you both on track.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {!isLoggedIn && (
                <Button size="lg" className="text-lg" asChild>
                  <Link href="/login">
                    Start Your Journey
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              )}
              <Button size="lg" variant="outline" className="text-lg" asChild>
                <Link href="#features">
                  Learn More
                </Link>
              </Button>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-border/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
              <CardHeader>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Daily Task Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Automatically sync tasks from Notion and track progress throughout the day.</CardDescription>
              </CardContent>
            </Card>

            <Card className="border-border/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
              <CardHeader>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>WhatsApp Updates</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Get morning summaries and evening reports directly in your WhatsApp group.</CardDescription>
              </CardContent>
            </Card>

            <Card className="border-border/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
              <CardHeader>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Partner Accountability</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Stay motivated with real-time updates about each other's progress.</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-muted/50">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-muted-foreground">
              Built specifically for your partnership's success
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Morning Motivation</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Daily task list at 6:00 AM</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Personalized encouragement messages</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Priority highlights for important tasks</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Evening Reflection</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Completion summary at 10:00 PM</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Progress celebration messages</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Motivational feedback for tomorrow</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6">
        <div className="container max-w-7xl mx-auto">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="p-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-4xl font-bold mb-2 flex items-center justify-center">
                    <Users className="h-8 w-8 mr-2" />
                    2
                  </div>
                  <div className="opacity-90">Partners</div>
                </div>
                <div>
                  <div className="text-4xl font-bold mb-2 flex items-center justify-center">
                    <Zap className="h-8 w-8 mr-2" />
                    24/7
                  </div>
                  <div className="opacity-90">Automated Sync</div>
                </div>
                <div>
                  <div className="text-4xl font-bold mb-2 flex items-center justify-center">
                    <Target className="h-8 w-8 mr-2" />
                    100%
                  </div>
                  <div className="opacity-90">Accountability</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t">
        <div className="container max-w-7xl mx-auto text-center">
          <p className="text-muted-foreground">
            © 2025 Accountability Partners System
          </p>
        </div>
      </footer>
    </div>
  )
}
