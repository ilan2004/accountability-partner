import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Schema for updating settings
const UpdateSettingsSchema = z.object({
  reminder_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).optional(),
  summary_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).optional(),
  timezone: z.string().optional(),
})

// GET /api/settings - Get user settings
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

    // Get user settings
    const { data: settings, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      // If no settings found, return default settings
      const defaultSettings = {
        reminder_time: '06:00:00',
        summary_time: '22:00:00',
        timezone: 'Asia/Kolkata'
      }

      return NextResponse.json({
        success: true,
        data: defaultSettings
      })
    }

    return NextResponse.json({
      success: true,
      data: settings
    })

  } catch (error) {
    console.error('GET /api/settings error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/settings - Update user settings
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

    // Parse and validate request body
    const body = await request.json()
    const validatedData = UpdateSettingsSchema.parse(body)

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

    // Update or insert settings (upsert)
    const { data: settings, error } = await supabase
      .from('settings')
      .upsert({
        user_id: user.id,
        ...validatedData
      })
      .select()
      .single()

    if (error) {
      console.error('Error updating settings:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: settings,
      message: 'Settings updated successfully'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('PUT /api/settings error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
