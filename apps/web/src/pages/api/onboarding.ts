import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@accountability/db'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { partnerEmail, notionDatabaseId, notionToken } = req.body

  if (!partnerEmail || !notionDatabaseId || !notionToken) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    // Check if user already has a pair
    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        pairAsUser1: true,
        pairAsUser2: true,
      },
    })

    if (existingUser?.pairAsUser1 || existingUser?.pairAsUser2) {
      return res.status(400).json({ error: 'You already have a pair' })
    }

    // Find or create partner
    let partner = await prisma.user.findUnique({
      where: { email: partnerEmail },
    })

    if (!partner) {
      // Create placeholder user for partner (they'll complete profile when they sign up)
      partner = await prisma.user.create({
        data: {
          email: partnerEmail,
          name: partnerEmail.split('@')[0], // Use email prefix as temporary name
        },
      })
    }

    // Create the pair
    const pair = await prisma.pair.create({
      data: {
        user1Id: session.user.id,
        user2Id: partner.id,
      },
    })

    // Create Notion config
    await prisma.notionConfig.create({
      data: {
        pairId: pair.id,
        databaseId: notionDatabaseId,
        integrationToken: notionToken,
      },
    })

    // Create default settings
    await prisma.settings.create({
      data: {
        pairId: pair.id,
        timezone: 'Asia/Kolkata',
        warningTime: '20:00',
        summaryTime: '23:55',
        notificationTemplates: JSON.stringify({
          completed: '✅ {owner} completed: {task}\nDue: {due}\n🔗 {link}',
          created: '📝 {owner} created: {task}\nDue: {due}',
          status_changed: '📊 {owner} updated: {task}\nStatus: {previousStatus} → {newStatus}',
        }),
      },
    })

    // TODO: Send invitation email to partner if they're a new user

    return res.status(200).json({ success: true, pairId: pair.id })
  } catch (error) {
    console.error('Onboarding error:', error)
    return res.status(500).json({ error: 'Failed to complete onboarding' })
  }
}
