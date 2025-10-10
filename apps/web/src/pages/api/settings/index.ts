import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createServerSupabaseClient(req, res);
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get user's pair
  const { data: pairs } = await supabase
    .from('Pair')
    .select('*')
    .or(`user1Id.eq.${user.id},user2Id.eq.${user.id}`)
    .limit(1);

  const pairId = pairs?.[0]?.id;

  if (!pairId) {
    return res.status(404).json({ error: 'No pair found' });
  }

  if (req.method === 'GET') {
    try {
      // Get settings
      const { data: settings } = await supabase
        .from('Settings')
        .select('*')
        .eq('pairId', pairId)
        .single();

      // Get Notion config
      const { data: notionConfig } = await supabase
        .from('NotionConfig')
        .select('databaseId')
        .eq('pairId', pairId)
        .single();

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
        const { error: settingsError } = await supabase
          .from('Settings')
          .upsert({
            pairId,
            timezone: settings.timezone,
            warningTime: settings.warningTime,
            summaryTime: settings.summaryTime,
            whatsappGroupJid: settings.whatsappGroupJid,
            notificationTemplates: settings.notificationTemplates,
          });

        if (settingsError) {
          throw settingsError;
        }
      }

      // Update Notion config if provided
      if (notionConfig?.databaseId) {
        const { error: notionError } = await supabase
          .from('NotionConfig')
          .upsert({
            pairId,
            databaseId: notionConfig.databaseId,
            integrationToken: notionConfig.token || '',
          });

        if (notionError) {
          throw notionError;
        }
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to update settings:', error);
      return res.status(500).json({ error: 'Failed to update settings' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
