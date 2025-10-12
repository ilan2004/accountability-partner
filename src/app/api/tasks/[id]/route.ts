import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Schema for updating a task
const UpdateTaskSchema = z.object({
  task_name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(['not_started', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  effort_level: z.enum(['low', 'medium', 'high']).optional(),
  due_date: z.string().optional(), // ISO date string
})

// Helper function to get authenticated user
async function getAuthenticatedUser(supabase: any) {
  const { data: { session }, error: authError } = await supabase.auth.getSession()
  
  if (authError || !session) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('notion_id', session.user.id)
    .single()

  if (!user) {
    return { error: 'User not found', status: 404 }
  }

  return { user, session }
}

// Helper function to verify task ownership
async function verifyTaskOwnership(supabase: any, taskId: string, userId: string) {
  const { data: task, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .eq('user_id', userId)
    .single()

  if (error || !task) {
    return { error: 'Task not found', status: 404 }
  }

  return { task }
}

// GET /api/tasks/[id] - Get specific task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    
    const authResult = await getAuthenticatedUser(supabase)
    if ('error' in authResult) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const taskResult = await verifyTaskOwnership(supabase, id, authResult.user.id)
    if ('error' in taskResult) {
      return NextResponse.json(
        { success: false, error: taskResult.error },
        { status: taskResult.status }
      )
    }

    return NextResponse.json({
      success: true,
      data: taskResult.task
    })

  } catch (error) {
    console.error('GET /api/tasks/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/tasks/[id] - Update specific task
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    
    const authResult = await getAuthenticatedUser(supabase)
    if ('error' in authResult) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    // Verify task exists and belongs to user
    const taskResult = await verifyTaskOwnership(supabase, id, authResult.user.id)
    if ('error' in taskResult) {
      return NextResponse.json(
        { success: false, error: taskResult.error },
        { status: taskResult.status }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = UpdateTaskSchema.parse(body)

    // Prepare update data
    const updateData: any = { ...validatedData }
    if (validatedData.due_date) {
      updateData.due_date = new Date(validatedData.due_date).toISOString().split('T')[0]
    }

    // Update task
    const { data: updatedTask, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', authResult.user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating task:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update task' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updatedTask,
      message: 'Task updated successfully'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('PUT /api/tasks/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/tasks/[id] - Delete specific task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    
    const authResult = await getAuthenticatedUser(supabase)
    if ('error' in authResult) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    // Verify task exists and belongs to user
    const taskResult = await verifyTaskOwnership(supabase, id, authResult.user.id)
    if ('error' in taskResult) {
      return NextResponse.json(
        { success: false, error: taskResult.error },
        { status: taskResult.status }
      )
    }

    // Delete task
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', authResult.user.id)

    if (error) {
      console.error('Error deleting task:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete task' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully'
    })

  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
