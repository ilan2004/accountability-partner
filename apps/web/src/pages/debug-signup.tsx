import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';

export default function DebugSignup() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testDirectSupabaseSignup = async () => {
    setLoading(true);
    setResult('Testing direct Supabase signup...\n');
    
    const supabase = createBrowserSupabaseClient();
    
    const email = `debugtest${Date.now().toString().slice(-6)}@test.com`;
    const password = 'TestPassword123!';
    const name = 'Debug Test User';
    
    try {
      setResult(prev => prev + `📧 Testing with: ${email}\n`);
      setResult(prev => prev + `🔧 Environment check:\n`);
      setResult(prev => prev + `   URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30)}...\n`);
      setResult(prev => prev + `   Has Key: ${!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}\n\n`);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            username: name,
          },
        },
      });

      if (error) {
        setResult(prev => prev + `❌ Signup failed: ${error.message}\n`);
        setResult(prev => prev + `   Status: ${error.status}\n`);
        setResult(prev => prev + `   Details: ${JSON.stringify(error, null, 2)}\n`);
      } else {
        setResult(prev => prev + `✅ Signup successful!\n`);
        setResult(prev => prev + `   User ID: ${data.user?.id}\n`);
        setResult(prev => prev + `   Email: ${data.user?.email}\n`);
        setResult(prev => prev + `   Has Session: ${!!data.session}\n`);
        setResult(prev => prev + `   Metadata: ${JSON.stringify(data.user?.user_metadata, null, 2)}\n`);
        
        // Clean up
        if (data.user) {
          setResult(prev => prev + `\n🧹 Cleaning up test user...\n`);
          
          const serviceSupabase = createBrowserSupabaseClient();
          // Note: This won't work from browser, but we'll try
          const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(data.user.id);
          
          if (deleteError) {
            setResult(prev => prev + `⚠️ Could not delete (expected): ${deleteError.message}\n`);
          } else {
            setResult(prev => prev + `✅ Test user deleted\n`);
          }
        }
      }
    } catch (error: any) {
      setResult(prev => prev + `💥 Exception caught: ${error.message}\n`);
      setResult(prev => prev + `   Stack: ${error.stack}\n`);
    } finally {
      setLoading(false);
    }
  };

  const testAuthContextSignup = async () => {
    setLoading(true);
    setResult('Testing AuthContext signup...\n');
    
    try {
      const { useAuth } = await import('@/contexts/AuthContext');
      // Note: This won't work directly, but we'll show the attempt
      setResult(prev => prev + `📝 This would call useAuth().signUp(...)\n`);
      setResult(prev => prev + `💡 Use the signup form instead for this test\n`);
    } catch (error: any) {
      setResult(prev => prev + `❌ Error: ${error.message}\n`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Signup Debug Tool</h1>
        
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Environment Check</h2>
          <div className="space-y-2 text-sm font-mono">
            <div>SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 50)}...</div>
            <div>HAS_ANON_KEY: {!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'YES' : 'NO'}</div>
            <div>NODE_ENV: {process.env.NODE_ENV}</div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Actions</h2>
          <div className="space-x-4">
            <button
              onClick={testDirectSupabaseSignup}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              Test Direct Supabase Signup
            </button>
            
            <button
              onClick={testAuthContextSignup}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              Test AuthContext (Info Only)
            </button>
            
            <button
              onClick={() => setResult('')}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
            >
              Clear Results
            </button>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm whitespace-pre-wrap font-mono overflow-auto max-h-96">
            {result || 'No tests run yet. Click a test button above.'}
            {loading && '\n\n⏳ Running test...'}
          </pre>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <h3 className="font-semibold text-blue-800 mb-2">Instructions:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>1. Click "Test Direct Supabase Signup" to test the exact same call as AuthContext</li>
            <li>2. Check the browser console for detailed logs</li>
            <li>3. If this works but the signup form doesn't, there's a React state issue</li>
            <li>4. If this fails, there's an environment or Supabase config issue</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
