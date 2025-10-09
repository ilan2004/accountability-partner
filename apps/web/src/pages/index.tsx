export default function Home() {
  // Check environment variables (in real app, these would come from server-side)
  const envStatus = {
    notion: {
      token: process.env.NEXT_PUBLIC_NOTION_TOKEN ? '✓ Loaded' : '✗ Missing',
      databaseId: process.env.NEXT_PUBLIC_NOTION_DATABASE_ID ? '✓ Loaded' : '✗ Missing',
    },
    timezone: process.env.NEXT_PUBLIC_TZ || 'Asia/Kolkata',
    nodeEnv: process.env.NODE_ENV || 'development',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-center text-gray-800">
          Accountability Partner
        </h1>
        <p className="mt-4 text-center text-gray-600">
          Track tasks, stay accountable, achieve together.
        </p>
        <div className="mt-8 text-center">
          <p className="text-green-600 font-semibold">✅ Web app running successfully!</p>
        </div>
        
        <div className="mt-12 max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4">Environment Status</h2>
          <div className="space-y-2 text-left">
            <p className="text-gray-700">
              <span className="font-medium">Node Environment:</span> {envStatus.nodeEnv}
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Timezone:</span> {envStatus.timezone}
            </p>
            <p className="text-sm text-gray-500 mt-4">
              Note: For security, sensitive environment variables are only accessible server-side.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
