import { NextRequest, NextResponse } from 'next/server'
import { geminiService } from '@/services/gemini'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { z } from 'zod'

// Schema for task parsing request
const ParseTaskSchema = z.object({
  message: z.string().min(1).max(500),
  context: z.object({
    user: z.string().optional(),
    currentDate: z.string().optional(),
  }).optional()
})

// POST /api/ai/parse-task - Parse natural language task input
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

    // Get current user
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('notion_id', session.user.id)
      .single()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const { message, context } = ParseTaskSchema.parse(body)

    // Get user's existing tasks for context
    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    // Parse task intent with Gemini
    const parseResult = await geminiService.parseTaskIntent(message, {
      user: context?.user || user.name,
      existingTasks: existingTasks || [],
      currentDate: context?.currentDate || new Date().toISOString().split('T')[0]
    })

    // If it's an add_task action, we can optionally create the task immediately
    if (parseResult.action === 'add_task' && parseResult.task_name && !parseResult.clarification_needed) {
      try {
        const { data: newTask, error: createError } = await supabase
          .from('tasks')
          .insert({
            user_id: user.id,
            task_name: parseResult.task_name,
            description: parseResult.description || null,
            priority: parseResult.priority || 'medium',
            effort_level: parseResult.effort_level || 'medium',
            due_date: parseResult.due_date || null,
          })
          .select()
          .single()

        if (!createError && newTask) {
          return NextResponse.json({
            success: true,
            data: {
              parseResult,
              taskCreated: true,
              task: newTask
            },
            message: 'Task parsed and created successfully'
          })
        }
      } catch (createError) {
        console.error('Error creating task:', createError)
        // Continue without creating task, just return parse result
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        parseResult,
        taskCreated: false
      },
      message: 'Task parsed successfully'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('POST /api/ai/parse-task error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/ai/parse-task - Test endpoint for development
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Gemini AI task parsing endpoint is ready',
    usage: {
      method: 'POST',
      body: {
        message: 'Add call with client tomorrow at 10 AM',
        context: {
          user: 'Ilan',
          currentDate: '2025-10-12'
        }
      }
    }
  })
}
