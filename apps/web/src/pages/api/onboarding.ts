import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createServerSupabaseClient(req, res)
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { partnerEmail, notionDatabaseId, notionToken } = req.body

  if (!partnerEmail || !notionDatabaseId || !notionToken) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    // Check if user already has a pair
    const { data: existingPairs } = await supabase
      .from('Pair')
      .select('*')
      .or(`user1Id.eq.${user.id},user2Id.eq.${user.id}`)
      .limit(1)

    if (existingPairs && existingPairs.length > 0) {
      return res.status(400).json({ error: 'You already have a pair' })
    }

    // Find or create partner
    let { data: partner } = await supabase
      .from('User')
      .select('*')
      .eq('email', partnerEmail)
      .single()

    if (!partner) {
      // Create placeholder user for partner (they'll complete profile when they sign up)
      const { data: newPartner, error: partnerError } = await supabase
        .from('User')
        .insert({
          email: partnerEmail,
          name: partnerEmail.split('@')[0], // Use email prefix as temporary name
        })
        .select()
        .single()

      if (partnerError) {
        throw partnerError
      }
      partner = newPartner
    }

    // Create the pair
    const { data: pair, error: pairError } = await supabase
      .from('Pair')
      .insert({
        user1Id: user.id,
        user2Id: partner.id,
      })
      .select()
      .single()

    if (pairError) {
      throw pairError
    }

    // Create Notion config
    const { error: notionError } = await supabase
      .from('NotionConfig')
      .insert({
        pairId: pair.id,
        databaseId: notionDatabaseId,
        integrationToken: notionToken,
      })

    if (notionError) {
      throw notionError
    }

    // Create default settings
    const { error: settingsError } = await supabase
      .from('Settings')
      .insert({
        pairId: pair.id,
        timezone: 'Asia/Kolkata',
        warningTime: '20:00',
        summaryTime: '23:55',
        notificationTemplates: JSON.stringify({
          completed: '✅ {owner} completed: {task}\nDue: {due}\n🔗 {link}',
          created: '📝 {owner} created: {task}\nDue: {due}',
          status_changed: '📊 {owner} updated: {task}\nStatus: {previousStatus} → {newStatus}',
        }),
      })

    if (settingsError) {
      throw settingsError
    }

    // TODO: Send invitation email to partner if they're a new user

    return res.status(200).json({ success: true, pairId: pair.id })
  } catch (error) {
    console.error('Onboarding error:', error)
    return res.status(500).json({ error: 'Failed to complete onboarding' })
  }
}
