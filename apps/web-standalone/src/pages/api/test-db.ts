import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase';

type Data = {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const supabase = createServerSupabaseClient(req, res);

  try {
    // Test database access
    const [usersResult, tasksResult, pairsResult] = await Promise.all([
      supabase.from('User').select('*', { count: 'exact', head: true }),
      supabase.from('TaskMirror').select('*', { count: 'exact', head: true }),
      supabase.from('Pair').select('*', { count: 'exact', head: true })
    ]);

    // Get some sample data
    const { data: sampleUser } = await supabase
      .from('User')
      .select('name, email')
      .limit(1)
      .single();

    const { data: sampleTask } = await supabase
      .from('TaskMirror')
      .select(`
        title, 
        status,
        owner:User!ownerId(name)
      `)
      .limit(1)
      .single();

    const data = {
      counts: {
        users: usersResult.count || 0,
        tasks: tasksResult.count || 0,
        pairs: pairsResult.count || 0,
      },
      samples: {
        user: sampleUser ? { name: sampleUser.name, email: sampleUser.email } : null,
        task: sampleTask ? { 
          title: sampleTask.title, 
          status: sampleTask.status, 
          owner: (sampleTask.owner as any)?.name || 'Unknown'
        } : null,
      },
    };

    res.status(200).json({
      success: true,
      message: 'Database connection successful',
      data,
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
