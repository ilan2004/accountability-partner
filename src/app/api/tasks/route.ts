import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Schema for creating a task
const CreateTaskSchema = z.object({
  task_name: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  effort_level: z.enum(['low', 'medium', 'high']).default('medium'),
  due_date: z.string().optional(), // ISO date string
})

// GET /api/tasks - Get user's tasks
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

    // Get search params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get user from database
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('notion_id', session.user.id)
      .single()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Build query
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Add status filter if provided
    if (status) {
      query = query.eq('status', status)
    }

    const { data: tasks, error } = await query

    if (error) {
      console.error('Error fetching tasks:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch tasks' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: tasks,
      pagination: {
        limit,
        offset,
        count: tasks.length
      }
    })

  } catch (error) {
    console.error('GET /api/tasks error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = CreateTaskSchema.parse(body)

    // Get user from database
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('notion_id', session.user.id)
      .single()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Create task
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        ...validatedData,
        due_date: validatedData.due_date ? new Date(validatedData.due_date).toISOString().split('T')[0] : null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating task:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create task' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: task,
      message: 'Task created successfully'
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('POST /api/tasks error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
