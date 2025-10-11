import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useAuth, withAuthProvider } from '@/contexts/AuthContext'
// import { GetServerSidePropsContext } from 'next'
// import { createSSRSupabaseClient } from '@/lib/supabase'

function SignUp() {
  const { signUp, signInWithNotion, signInWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')

  const handleNotionSignUp = async () => {
    try {
      setLoading(true)
      setError('')
      await signInWithNotion()
    } catch (error: any) {
      setError(error.message || 'Failed to sign up with Notion')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    try {
      setLoading(true)
      setError('')
      await signInWithGoogle()
    } catch (error: any) {
      setError(error.message || 'Failed to sign up with Google')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    if (formData.username.length < 2) {
      setError('Username must be at least 2 characters long')
      setLoading(false)
      return
    }

    try {
      // Use AuthContext signUp method which handles user creation properly
      await signUp(formData.email, formData.password, formData.username)
      
      // Success! The AuthContext will handle redirects automatically
      setError('') // Clear any previous errors
      
      // Show success message briefly before redirect
      setError('') // Use this to clear errors, we'll show success differently
      
    } catch (error: any) {
      console.error('Sign up error:', error)
      
      // Handle specific error types
      if (error.message?.includes('email_address_invalid')) {
        setError('Please enter a valid email address')
      } else if (error.message?.includes('weak_password')) {
        setError('Password is too weak. Please use a stronger password.')
      } else if (error.message?.includes('email_address_not_authorized')) {
        setError('This email address is not authorized to sign up')
      } else {
        setError(error.message || 'Failed to create account. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join the Accountability Partner system
          </p>
        </div>
        
        {/* OAuth Options */}
        <div className="mt-8 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          {/* Notion Sign Up - Featured */}
          <button
            onClick={handleNotionSignUp}
            disabled={loading}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.047 1.167-.466 1.167-1.261V6.354c0-.793-.28-1.214-.933-1.167L6.226 5.8c-.746.047-.974.42-.974 1.167v.32zm14.337-.7c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.327-1.635.047l-4.98-3.928c-.326-.233-.326-.607 0-.84l4.98-3.928c.467-.373 1.075-.373 1.635.047v-.933l.7.14c.42.047.513.467.42.887zm-8.96 2.054l-4.888 6.088c-.42.514-.7.654-.98.374-.327-.28-.327-.607 0-1.027l4.888-6.041c.28-.374.56-.42.887-.14.327.28.373.607.093.746z"/>
            </svg>
            {loading ? 'Connecting...' : 'Continue with Notion'}
          </button>
          
          {/* Google Sign Up */}
          <button
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Connecting...' : 'Continue with Google'}
          </button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or sign up with email</span>
            </div>
          </div>
        </div>
        
        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Your username (e.g., ilan usman)"
              />
              <p className="mt-1 text-xs text-gray-500">
                Use the same name you'll use as assignee in Notion tasks
              </p>
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="your@email.com"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="At least 6 characters"
              />
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Repeat your password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </div>

          <div className="text-center">
            <span className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/auth/signin" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign in
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}

export default withAuthProvider(SignUp)

// Disable SSG for this page since it uses browser contexts
export async function getServerSideProps() {
  return {
    props: {},
  };
}

// Temporarily disabled SSR to debug 404 issues
// export async function getServerSideProps(context: GetServerSidePropsContext) {
//   const { createSSRSupabaseClient } = await import('../../lib/supabase')
//   const supabase = createSSRSupabaseClient(context)
//   
//   const { data: { user } } = await supabase.auth.getUser()
// 
//   if (user) {
//     return {
//       redirect: {
//         destination: '/dashboard',
//         permanent: false,
//       },
//     }
//   }
// 
//   return {
//     props: {},
//   }
// }
