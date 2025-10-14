import { createAdminClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/auth/create-user - Create user with admin privileges to bypass RLS
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      notion_id, 
      name, 
      notion_access_token, 
      notion_workspace_id, 
      notion_workspace_name, 
      notion_task_database_id 
    } = body

    if (!notion_id || !name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: notion_id, name' },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS policies
    const adminSupabase = createAdminClient()

    // Check if user already exists
    const { data: existingUser } = await adminSupabase
      .from('users')
      .select('*')
      .eq('notion_id', notion_id)
      .single()

    if (existingUser) {
      return NextResponse.json({
        success: true,
        data: existingUser,
        message: 'User already exists'
      })
    }

    // Create new user
    const userData = {
      notion_id,
      name,
      whatsapp_number: null,
      notion_access_token,
      notion_workspace_id,
      notion_workspace_name,
      notion_task_database_id
    }

    const { data: newUser, error: insertError } = await adminSupabase
      .from('users')
      .insert([userData])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating user:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create user', details: insertError.message },
        { status: 500 }
      )
    }

    // Create default settings for this user
    const { error: settingsError } = await adminSupabase
      .from('settings')
      .insert([{
        user_id: newUser.id,
        reminder_time: '06:00:00',
        summary_time: '22:00:00',
        timezone: 'Asia/Kolkata'
      }])

    if (settingsError && settingsError.code !== '23505') { // Ignore duplicate key errors
      console.error('Error creating settings:', settingsError)
      // Don't fail user creation because of settings error
    }

    return NextResponse.json({
      success: true,
      data: newUser,
      message: 'User created successfully'
    })

  } catch (error: any) {
    console.error('POST /api/auth/create-user error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
