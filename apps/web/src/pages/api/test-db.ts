import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@accountability/db';

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

  try {
    // Test database access
    const users = await prisma.user.count();
    const tasks = await prisma.taskMirror.count();
    const pairs = await prisma.pair.count();

    // Get some sample data
    const sampleUser = await prisma.user.findFirst();
    const sampleTask = await prisma.taskMirror.findFirst({
      include: {
        owner: true,
      },
    });

    const data = {
      counts: {
        users,
        tasks,
        pairs,
      },
      samples: {
        user: sampleUser ? { name: sampleUser.name, email: sampleUser.email } : null,
        task: sampleTask ? { title: sampleTask.title, status: sampleTask.status, owner: sampleTask.owner.name } : null,
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
