import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/users/me - Get current user profile
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user from database with settings
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        settings (
          reminder_time,
          summary_time,
          timezone
        )
      `)
      .eq('notion_id', session.user.id)
      .single()

    if (error || !user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Get user task statistics
    const { data: taskStats } = await supabase
      .rpc('get_completion_rate', { user_uuid: user.id })

    const { data: todayTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .or('due_date.is.null,due_date.eq.' + new Date().toISOString().split('T')[0])

    const completedToday = todayTasks?.filter(task => task.status === 'done').length || 0
    const totalToday = todayTasks?.length || 0

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        stats: {
          completion_rate: taskStats || 0,
          today: {
            completed: completedToday,
            total: totalToday,
            completion_rate: totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0
          }
        }
      }
    })

  } catch (error) {
    console.error('GET /api/users/me error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/users/me - Update current user profile
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { name, whatsapp_number } = body

    // Update user
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        ...(name && { name }),
        ...(whatsapp_number && { whatsapp_number })
      })
      .eq('notion_id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating user:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update user' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully'
    })

  } catch (error) {
    console.error('PUT /api/users/me error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
