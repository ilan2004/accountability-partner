import { GetServerSidePropsContext } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'

export default function Onboarding() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [partnerEmail, setPartnerEmail] = useState('')
  const [notionDatabaseId, setNotionDatabaseId] = useState('')
  const [notionToken, setNotionToken] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partnerEmail,
          notionDatabaseId,
          notionToken,
        }),
      })

      if (res.ok) {
        router.push('/dashboard')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to complete onboarding')
      }
    } catch (error) {
      console.error('Onboarding error:', error)
      alert('Failed to complete onboarding')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Welcome! Let's Get Started</h1>
          <p className="text-gray-600 mb-8">
            To use the Accountability Partner system, we need to set up a few things first.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="partnerEmail" className="block text-sm font-medium text-gray-700">
                Your Partner's Email Address
              </label>
              <input
                type="email"
                id="partnerEmail"
                required
                value={partnerEmail}
                onChange={(e) => setPartnerEmail(e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="partner@example.com"
              />
              <p className="mt-1 text-sm text-gray-500">
                We'll invite them to join your accountability pair.
              </p>
            </div>

            <div>
              <label htmlFor="notionDatabaseId" className="block text-sm font-medium text-gray-700">
                Notion Database ID
              </label>
              <input
                type="text"
                id="notionDatabaseId"
                required
                value={notionDatabaseId}
                onChange={(e) => setNotionDatabaseId(e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="32-character database ID"
              />
              <p className="mt-1 text-sm text-gray-500">
                Get this from your shared Notion tasks database URL.
              </p>
            </div>

            <div>
              <label htmlFor="notionToken" className="block text-sm font-medium text-gray-700">
                Notion Integration Token
              </label>
              <input
                type="password"
                id="notionToken"
                required
                value={notionToken}
                onChange={(e) => setNotionToken(e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="secret_..."
              />
              <p className="mt-1 text-sm text-gray-500">
                Your Notion integration secret token.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Setup Instructions:</h3>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>Create a shared Notion database with Title, Status, Due, and Owner properties</li>
                <li>Create a Notion integration at notion.so/my-integrations</li>
                <li>Share the database with your integration</li>
                <li>Copy the database ID from the URL and integration token</li>
              </ol>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Setting up...' : 'Complete Setup'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerSession(context.req, context.res, authOptions)

  if (!session) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    }
  }

  // Check if user already has a pair using Supabase
  const { createSSRSupabaseClient } = await import('../lib/supabase')
  const supabase = createSSRSupabaseClient(context)
  
  const { data: pairs, error } = await supabase
    .from('Pair')
    .select('*')
    .or(`user1Id.eq.${session.user.id},user2Id.eq.${session.user.id}`)
    .limit(1)

  if (error) {
    console.error('Error checking for existing pair:', error)
  }

  if (pairs && pairs.length > 0) {
    // Already has a pair, redirect to dashboard
    return {
      redirect: {
        destination: '/dashboard',
        permanent: false,
      },
    }
  }

  return {
    props: {},
  }
}
