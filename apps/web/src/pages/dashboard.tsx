import { GetServerSidePropsContext } from 'next';
import { useRouter } from 'next/router';
import { createSSRSupabaseClient } from '@/lib/supabase';
import Layout from '@/components/Layout';
import { useState } from 'react';

interface DashboardProps {
  tasks: any[];
  recentEvents: any[];
  userProfile: {
    notionId?: string;
    name: string;
    email: string;
  } | null;
  stats: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
  };
}

export default function Dashboard({ tasks, recentEvents, userProfile, stats }: DashboardProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const router = useRouter();

  const filteredTasks = tasks.filter(task => {
    if (filter === 'pending') return task.status !== 'Done';
    if (filter === 'completed') return task.status === 'Done';
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Done':
        return 'bg-green-100 text-green-800';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'No due date';
    return new Date(date).toLocaleDateString();
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'completed':
        return '✅';
      case 'created':
        return '📝';
      default:
        return '📊';
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">Track your tasks and accountability progress</p>
        </div>

        {/* Notion Connection Status */}
        {!userProfile?.notionId && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-yellow-800">
                  Connect your Notion account
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>To sync your tasks and receive WhatsApp notifications, please connect your Notion account.</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => router.push('/auth/notion-connect')}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Connect Notion
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="rounded-md bg-blue-500 p-3">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Tasks</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.totalTasks}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="rounded-md bg-green-500 p-3">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Completed</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.completedTasks}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="rounded-md bg-yellow-500 p-3">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.pendingTasks}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="rounded-md bg-red-500 p-3">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Overdue</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.overdueTasks}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tasks List */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Tasks</h3>
                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      filter === 'all'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilter('pending')}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      filter === 'pending'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    onClick={() => setFilter('completed')}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      filter === 'completed'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Completed
                  </button>
                </div>
              </div>
              <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {filteredTasks.map((task) => (
                  <li key={task.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {task.title}
                        </p>
                        <div className="mt-2 flex items-center text-sm text-gray-500">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                            {task.status}
                          </span>
                          <span className="mx-2">•</span>
                          <span>Due: {formatDate(task.dueDate)}</span>
                          <span className="mx-2">•</span>
                          <span>{task.owner.name}</span>
                        </div>
                      </div>
                      <a
                        href={task.notionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-4 text-indigo-600 hover:text-indigo-900"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recent Events */}
          <div>
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Activity</h3>
              </div>
              <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {recentEvents.map((event) => (
                  <li key={event.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 text-2xl">
                        {getEventIcon(event.eventType)}
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{event.taskMirror.owner.name}</span>
                          {event.eventType === 'completed' && ' completed '}
                          {event.eventType === 'created' && ' created '}
                          {event.eventType === 'status_changed' && ' updated '}
                          <span className="font-medium">"{event.taskMirror.title}"</span>
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {new Date(event.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const supabase = createSSRSupabaseClient(context);
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    };
  }

  // Check user's Notion connection status
  const { data: userProfile } = await supabase
    .from('User')
    .select('notionId, name, email')
    .eq('id', user.id)
    .single();

  // Get user's pair
  const { data: pairs } = await supabase
    .from('Pair')
    .select('*')
    .or(`user1Id.eq.${user.id},user2Id.eq.${user.id}`)
    .limit(1);

  const pairId = pairs?.[0]?.id;

  if (!pairId) {
    // User doesn't have a pair yet, redirect to onboarding
    return {
      redirect: {
        destination: '/onboarding',
        permanent: false,
      },
    };
  }

  // Get the pair users to filter tasks
  const pair = pairs[0];
  const pairUserIds = [pair.user1Id, pair.user2Id];

  // Fetch tasks for both users in the pair
  const { data: tasks } = await supabase
    .from('TaskMirror')
    .select(`
      *,
      owner:User!ownerId(*)
    `)
    .in('ownerId', pairUserIds)
    .order('dueDate', { ascending: true });

  // Fetch recent events
  const { data: recentEvents } = await supabase
    .from('TaskEvent')
    .select(`
      *,
      taskMirror:TaskMirror!taskMirrorId(
        *,
        owner:User!ownerId(*)
      )
    `)
    .in('taskMirrorId', (tasks || []).map(t => t.id))
    .order('createdAt', { ascending: false })
    .limit(10);

  // Calculate stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const safeTasks = tasks || [];
  const stats = {
    totalTasks: safeTasks.length,
    completedTasks: safeTasks.filter(t => t.status === 'Done').length,
    pendingTasks: safeTasks.filter(t => t.status !== 'Done').length,
    overdueTasks: safeTasks.filter(t => 
      t.status !== 'Done' && t.dueDate && new Date(t.dueDate) < today
    ).length,
  };

  return {
    props: {
      tasks: JSON.parse(JSON.stringify(safeTasks)),
      recentEvents: JSON.parse(JSON.stringify(recentEvents || [])),
      userProfile: JSON.parse(JSON.stringify(userProfile)),
      stats,
    },
  };
}
