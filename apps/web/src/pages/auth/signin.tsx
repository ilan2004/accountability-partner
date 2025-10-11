import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth, withAuthProvider } from '@/contexts/AuthContext';
import Link from 'next/link';

function SignIn() {
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { user, signIn, signUp, signInWithGoogle, signInWithMagicLink, signInWithNotion } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    // Handle error from URL params
    const urlError = router.query.error as string;
    if (urlError) {
      switch (urlError) {
        case 'callback':
          setError('Authentication failed. Please try again.');
          break;
        case 'unexpected':
          setError('An unexpected error occurred. Please try again.');
          break;
        default:
          setError('Authentication error. Please try again.');
      }
    }
  }, [router.query.error]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      setMessage('');
      await signInWithGoogle();
    } catch (error: any) {
      setError(error.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleNotionSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      setMessage('');
      await signInWithNotion();
    } catch (error: any) {
      setError(error.message || 'Failed to sign in with Notion');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError(null);

    try {
      if (isSignUp) {
        await signUp(email, password, name);
        setMessage('Account created successfully! Redirecting...');
      } else {
        await signIn(email, password);
        setMessage('Signed in successfully! Redirecting...');
      }
      // Redirect is now handled automatically by AuthContext
    } catch (error: any) {
      setError(error.message || `Failed to ${isSignUp ? 'sign up' : 'sign in'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLinkSignIn = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    setLoading(true);
    setMessage('');
    setError(null);

    try {
      await signInWithMagicLink(email);
      setMessage('Check your email for the login link!');
    } catch (error: any) {
      setError(error.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-4xl font-bold text-gray-800">
          Accountability Partner
        </h1>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {isSignUp ? 'Create your account' : 'Sign in to your account'}
        </h2>
        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setMessage('');
            }}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700">
              <p className="text-sm">{error}</p>
            </div>
          )}
          
          {message && (
            <div className="mb-4 p-3 rounded-md bg-green-50 border border-green-200 text-green-700">
              <p className="text-sm">{message}</p>
            </div>
          )}
          
          {/* Notion Sign In - Featured */}
          <button
            onClick={handleNotionSignIn}
            disabled={loading}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.047 1.167-.466 1.167-1.261V6.354c0-.793-.28-1.214-.933-1.167L6.226 5.8c-.746.047-.974.42-.974 1.167v.32zm14.337-.7c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.327-1.635.047l-4.98-3.928c-.326-.233-.326-.607 0-.84l4.98-3.928c.467-.373 1.075-.373 1.635.047v-.933l.7.14c.42.047.513.467.42.887zm-8.96 2.054l-4.888 6.088c-.42.514-.7.654-.98.374-.327-.28-.327-.607 0-1.027l4.888-6.041c.28-.374.56-.42.887-.14.327.28.373.607.093.746z"/>
            </svg>
            {loading ? 'Connecting...' : 'Continue with Notion'}
          </button>
          
          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Signing in...' : 'Continue with Google'}
          </button>
          
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or</span>
            </div>
          </div>
          
          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isSignUp && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Username (Required) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={isSignUp}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="e.g., ilan usman (match your Notion assignee name)"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Use the same name you'll use as assignee in Notion tasks
                </p>
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="you@example.com"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Password (min 6 characters)"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || !email || !password || (isSignUp && !name)}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Create account' : 'Sign in')}
            </button>
          </form>
          
          {/* Magic Link Option */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or sign in with magic link</span>
              </div>
            </div>
            
            <button
              onClick={handleMagicLinkSignIn}
              disabled={loading || !email}
              className="mt-4 w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
          </div>
          
          {/* Username Guidance */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-3">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Username Tips:</h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Use the same name you'll assign to tasks in Notion</li>
              <li>• Example: If your Notion assignee is "ilan usman", use "ilan usman" as username</li>
              <li>• This ensures notifications work properly when you complete tasks</li>
            </ul>
          </div>
          
          <div className="mt-4 text-center text-sm text-gray-600">
            <Link href="/" className="text-indigo-600 hover:text-indigo-500">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withAuthProvider(SignIn);

// Disable SSG for this page since it uses browser contexts
export async function getServerSideProps() {
  return {
    props: {},
  };
}
