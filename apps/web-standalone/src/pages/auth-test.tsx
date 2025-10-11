import { useState, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';

export default function AuthTest() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    // Check current session
    const checkSession = async () => {
      try {
        console.log('🔍 Checking session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Session error:', error);
          setError(error.message);
        } else {
          console.log('✅ Session:', !!session);
          setUser(session?.user || null);
        }
      } catch (err) {
        console.error('💥 Unexpected error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, [supabase]);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      console.log('🔄 Starting Google sign in...');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        console.error('❌ Google sign in error:', error);
        setError(error.message);
      } else {
        console.log('✅ Google sign in initiated');
      }
    } catch (err) {
      console.error('💥 Unexpected error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      console.log('🔄 Signing out...');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Sign out error:', error);
        setError(error.message);
      } else {
        console.log('✅ Signed out');
        setUser(null);
      }
    } catch (err) {
      console.error('💥 Unexpected error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">Auth Test</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}
        
        {loading ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2">Loading...</p>
          </div>
        ) : user ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-100 border border-green-300 rounded">
              <h2 className="font-semibold text-green-800">Signed in as:</h2>
              <p className="text-sm text-green-700">{user.email}</p>
              <p className="text-xs text-green-600">ID: {user.id}</p>
            </div>
            
            <button
              onClick={signOut}
              className="w-full py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600 text-center">Not signed in</p>
            
            <button
              onClick={signInWithGoogle}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Sign in with Google
            </button>
          </div>
        )}
        
        <div className="mt-6 text-center">
          <a href="/auth/signin" className="text-blue-600 hover:text-blue-800 underline">
            Back to Sign In Page
          </a>
        </div>
      </div>
    </div>
  );
}
