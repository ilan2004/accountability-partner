import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@accountability/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get user's pair
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      pairAsUser1: true,
      pairAsUser2: true,
    },
  });

  const pairId = user?.pairAsUser1?.id || user?.pairAsUser2?.id;

  if (!pairId) {
    return res.status(404).json({ error: 'No pair found' });
  }

  if (req.method === 'GET') {
    try {
      // Get settings
      const settings = await prisma.settings.findUnique({
        where: { pairId },
      });

      // Get Notion config
      const notionConfig = await prisma.notionConfig.findUnique({
        where: { pairId },
        select: {
          databaseId: true,
          // Don't expose the token for security
        },
      });

      return res.status(200).json({
        settings: settings || {
          timezone: 'Asia/Kolkata',
          warningTime: '20:00',
          summaryTime: '23:55',
          whatsappGroupJid: '',
          notificationTemplates: '{}',
        },
        notionConfig: {
          databaseId: notionConfig?.databaseId || '',
        },
      });
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }
  } 
  
  else if (req.method === 'POST') {
    try {
      const { settings, notionConfig } = req.body;

      // Update or create settings
      if (settings) {
        await prisma.settings.upsert({
          where: { pairId },
          update: {
            timezone: settings.timezone,
            warningTime: settings.warningTime,
            summaryTime: settings.summaryTime,
            whatsappGroupJid: settings.whatsappGroupJid,
            notificationTemplates: settings.notificationTemplates,
          },
          create: {
            pairId,
            timezone: settings.timezone,
            warningTime: settings.warningTime,
            summaryTime: settings.summaryTime,
            whatsappGroupJid: settings.whatsappGroupJid,
            notificationTemplates: settings.notificationTemplates,
          },
        });
      }

      // Update Notion config if provided
      if (notionConfig?.databaseId) {
        await prisma.notionConfig.upsert({
          where: { pairId },
          update: {
            databaseId: notionConfig.databaseId,
          },
          create: {
            pairId,
            databaseId: notionConfig.databaseId,
            integrationToken: notionConfig.token || '',
          },
        });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to update settings:', error);
      return res.status(500).json({ error: 'Failed to update settings' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
