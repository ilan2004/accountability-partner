import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user from database
    const { data: user } = await supabase
      .from('users')
      .select('id, name')
      .eq('notion_id', session.user.id)
      .single()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Get today's date
    const today = new Date().toISOString().split('T')[0]
    const startOfWeek = new Date()
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    const weekStart = startOfWeek.toISOString().split('T')[0]

    // Get today's tasks
    const { data: todayTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('due_date', today)

    // Get this week's tasks
    const { data: weekTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .gte('due_date', weekStart)
      .lte('due_date', today)

    // Get user's partner
    const { data: partners } = await supabase
      .from('users')
      .select('id, name')
      .neq('id', user.id)
      .limit(1)

    // Calculate streak (simple version - consecutive days with completed tasks)
    const { data: recentCompletedTasks } = await supabase
      .from('tasks')
      .select('completed_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(30)

    let streak = 0
    if (recentCompletedTasks && recentCompletedTasks.length > 0) {
      const dates = recentCompletedTasks
        .map(t => new Date(t.completed_at).toISOString().split('T')[0])
        .filter((date, index, self) => self.indexOf(date) === index)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

      let currentDate = new Date()
      for (const date of dates) {
        const taskDate = new Date(date)
        const diffDays = Math.floor((currentDate.getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24))
        
        if (diffDays === streak) {
          streak++
        } else {
          break
        }
      }
    }

    // Calculate statistics
    const todayCompleted = todayTasks?.filter(t => t.status === 'completed').length || 0
    const todayTotal = todayTasks?.length || 0
    const weekCompleted = weekTasks?.filter(t => t.status === 'completed').length || 0
    const weekTotal = weekTasks?.length || 0
    const weekProgress = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0

    // Get recent activity
    const { data: recentActivity } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name
        },
        stats: {
          todayTasks: {
            total: todayTotal,
            completed: todayCompleted,
            progress: todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0
          },
          weekProgress: {
            percentage: weekProgress,
            completed: weekCompleted,
            total: weekTotal
          },
          partners: {
            count: partners?.length || 0,
            list: partners || []
          },
          streak: streak
        },
        recentActivity: recentActivity?.map(task => ({
          id: task.id,
          type: task.status === 'completed' ? 'completed' : 'updated',
          taskName: task.task_name,
          timestamp: task.updated_at,
          status: task.status
        })) || []
      }
    })

  } catch (error) {
    console.error('GET /api/dashboard/stats error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
