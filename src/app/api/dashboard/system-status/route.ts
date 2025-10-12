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

    // Check WhatsApp bot status (mock for now)
    const whatsappStatus = {
      connected: true, // In real implementation, check actual connection
      lastPing: new Date().toISOString()
    }

    // Check Notion sync status
    const { data: user } = await supabase
      .from('users')
      .select('notion_last_sync')
      .eq('notion_id', session.user.id)
      .single()

    const notionLastSync = user?.notion_last_sync ? new Date(user.notion_last_sync) : null
    const now = new Date()
    const nextSync = notionLastSync 
      ? new Date(notionLastSync.getTime() + 5 * 60 * 1000) // 5 minutes after last sync
      : now

    // Get last message time (mock for now)
    const lastMessageTime = new Date()
    lastMessageTime.setHours(22, 0, 0, 0) // 10:00 PM

    return NextResponse.json({
      success: true,
      data: {
        whatsapp: {
          status: whatsappStatus.connected ? 'Connected' : 'Disconnected',
          connected: whatsappStatus.connected
        },
        notion: {
          status: 'Active',
          lastSync: notionLastSync?.toISOString() || null,
          nextSync: nextSync.toISOString()
        },
        messaging: {
          lastMessage: lastMessageTime.toISOString(),
          nextMessage: new Date().setHours(6, 0, 0, 0) > new Date().getTime() 
            ? new Date().setHours(6, 0, 0, 0) // Next 6:00 AM
            : new Date(new Date().setDate(new Date().getDate() + 1)).setHours(6, 0, 0, 0) // Tomorrow 6:00 AM
        }
      }
    })

  } catch (error) {
    console.error('GET /api/dashboard/system-status error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
