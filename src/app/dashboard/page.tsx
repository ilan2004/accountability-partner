'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ClipboardList, CheckCircle2, Zap, Users, TrendingUp, Clock, MessageSquare, Plus, ChevronRight, Activity, Loader2, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [systemStatus, setSystemStatus] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = async () => {
    try {
      setError(null)
      
      // Fetch both dashboard stats and system status
      const [statsResponse, statusResponse] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/dashboard/system-status')
      ])
      
      if (!statsResponse.ok) {
        if (statsResponse.status === 401) {
          router.push('/login')
          return
        }
        throw new Error('Failed to fetch dashboard data')
      }
      
      const statsData = await statsResponse.json()
      const statusData = await statusResponse.json()
      
      if (statsData.success) {
        setDashboardData(statsData.data)
      }
      
      if (statusData.success) {
        setSystemStatus(statusData.data)
      }
      
      if (!statsData.success) {
        throw new Error(statsData.error || 'Failed to load dashboard')
      }
    } catch (err) {
      console.error('Dashboard error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      setRefreshing(true)
      fetchDashboardData()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchDashboardData()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-red-600">{error}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { user, stats, recentActivity } = dashboardData || {}

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b sticky top-0 z-50">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold">AP</span>
              </div>
              <h1 className="text-2xl font-bold">
                Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="ml-2 hidden sm:inline">Refresh</span>
              </Button>
              <Button onClick={handleSignOut} variant="outline" size="sm">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        {user && (
          <Card className="bg-primary text-primary-foreground mb-8">
            <CardContent className="pt-8 pb-8">
              <h2 className="text-3xl font-bold mb-2">
                Welcome back, {user.name}! 👋
              </h2>
              <p className="text-primary-foreground/90 text-lg">
                Let's make today count. Your accountability partner is counting on you!
              </p>
              {stats?.todayTasks?.total > 0 && (
                <p className="text-primary-foreground/70 text-sm mt-2">
                  You have {stats.todayTasks.total - stats.todayTasks.completed} tasks remaining today
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Tasks</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.todayTasks?.total || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.todayTasks?.completed || 0} completed
              </p>
              <Progress 
                value={stats?.todayTasks?.progress || 0} 
                className="mt-2" 
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Week Progress</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.weekProgress?.percentage || 0}%</div>
              <p className="text-xs text-muted-foreground">
                {stats?.weekProgress?.completed || 0} of {stats?.weekProgress?.total || 0} tasks
              </p>
              <Progress 
                value={stats?.weekProgress?.percentage || 0} 
                className="mt-2" 
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Partners</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.partners?.count || 0}</div>
              <div className="flex gap-2 mt-2">
                {stats?.partners?.list?.map((partner: any) => (
                  <Badge key={partner.id} variant="secondary">
                    {partner.name}
                  </Badge>
                )) || (
                  <p className="text-xs text-muted-foreground">No partners yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Day Streak</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.streak || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.streak === 0 ? 'Start your streak!' : 'Keep it going!'}
              </p>
              <div className="flex gap-1 mt-2">
                {[...Array(Math.min(stats?.streak || 0, 7))].map((_, i) => (
                  <div key={i} className="h-2 w-2 rounded-full bg-primary" />
                ))}
                {stats?.streak > 7 && (
                  <span className="text-xs text-muted-foreground ml-1">+{stats.streak - 7}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Timeline */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Recent Activity
              </span>
              {refreshing && (
                <Badge variant="secondary" className="text-xs">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Updating...
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((activity: any, index: number) => (
                  <div key={activity.id}>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          {activity.type === 'completed' ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : (
                            <Clock className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">
                          {activity.type === 'completed' ? 'Completed' : 'Updated'}{' '}
                          <span className="font-semibold">{activity.taskName}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    {index < recentActivity.length - 1 && <Separator className="mt-4" />}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground text-sm py-4">
                No recent activity. Start by creating some tasks!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions & Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-between" asChild>
                <Link href="/tasks">
                  View Today's Tasks
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-between" asChild>
                <Link href="/partners">
                  Check Partner Progress
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-between" asChild>
                <Link href="/reports">
                  Weekly Report
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">WhatsApp Bot</span>
                <Badge 
                  variant="secondary" 
                  className={systemStatus?.whatsapp?.connected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}
                >
                  {systemStatus?.whatsapp?.status || 'Unknown'}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Notion Sync</span>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  {systemStatus?.notion?.status || 'Unknown'}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Next Sync</span>
                <span className="text-sm font-medium flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {systemStatus?.notion?.nextSync ? 
                    formatDistanceToNow(new Date(systemStatus.notion.nextSync), { addSuffix: true }) : 
                    'Unknown'
                  }
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Message</span>
                <span className="text-sm font-medium">
                  {systemStatus?.messaging?.lastMessage ? 
                    new Date(systemStatus.messaging.lastMessage).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                    'Unknown'
                  }
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
