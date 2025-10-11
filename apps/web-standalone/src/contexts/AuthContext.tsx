'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signInWithNotion: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Validate environment variables
  React.useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('🚨 Missing Supabase environment variables!');
      console.log('NEXT_PUBLIC_SUPABASE_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    }
  }, []);

  const supabase = React.useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Ensure user exists in our database if session exists
      if (session?.user) {
        ensureUserExists(session.user);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Handle sign in - ensure user record exists in our database
      if (event === 'SIGNED_IN' && session?.user) {
        // Ensure user exists asynchronously (don't wait for it)
        ensureUserExists(session.user).catch(error => {
          console.warn('Failed to ensure user exists:', error);
        });
        
        // Handle redirect after successful authentication
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          
          // Only redirect if user is on auth pages or callback page
          if (currentPath.startsWith('/auth/')) {
            // Simple redirect to dashboard - let dashboard handle further routing
            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 1000);
          }
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, name?: string) => {
    if (!name) {
      throw new Error('Username is required for signup');
    }

    console.log('🔍 AuthContext signUp called with:', { email, name });
    console.log('🔧 Supabase client config:', {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 50) + '...' : 'server'
    });

    let createdUser: User | null = null;

    try {
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

      console.log('📤 signUp result:', {
        success: !error,
        hasUser: !!data.user,
        hasSession: !!data.session,
        error: error?.message
      });

      if (error) {
        console.error('❌ Supabase signup error details:', {
          message: error.message,
          status: error.status,
          name: error.name,
          cause: error.cause
        });

        // Handle specific auth errors with more detail
        if (error.message.includes('Database error saving new user')) {
          console.log('🔄 Retrying signup (settings may be propagating)...');

          // Try one more time after a brief delay
          await new Promise(resolve => setTimeout(resolve, 2000));

          const { data: retryData, error: retryError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: name,
                username: name,
              },
            },
          });

          if (retryError) {
            console.error('❌ Retry also failed:', retryError.message);
            throw new Error(`Signup failed after retry. This might be a temporary Supabase issue. Original error: ${error.message}`);
          } else {
            console.log('✅ Retry succeeded!');
            createdUser = retryData.user ?? null;
          }
        } else if (error.message.includes('email_address_invalid')) {
          throw new Error('Please enter a valid email address.');
        } else if (error.message.includes('weak_password')) {
          throw new Error('Password is too weak. Please use a stronger password.');
        } else if (error.message.includes('email_address_not_authorized')) {
          throw new Error('This email domain is not authorized. Try using a Gmail or common email provider.');
        } else {
          // Generic error with more context
          throw new Error(`Signup failed: ${error.message}. Please try again or contact support.`);
        }
      } else {
        createdUser = data.user ?? null;
      }

    } catch (error: any) {
      console.error('💥 SignUp try/catch error:', error);
      throw error;
    }

    // Create user record using API endpoint (bypasses RLS issues)
    if (createdUser) {
      try {
        const response = await fetch('/api/auth/create-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name,
            email: email,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          console.error('Error creating user profile:', result.error);
        } else {
          console.log('User profile created successfully:', result.user);
        }
      } catch (profileError) {
        console.error('Error creating user profile:', profileError);
      }
    }

    // If user is created but not confirmed (due to email confirmation being enabled),
    // we'll need to handle this at the Supabase project level
    if (createdUser && !createdUser.email_confirmed_at) {
      // User needs email confirmation - this should be disabled in Supabase dashboard
      console.warn('Email confirmation is enabled. Please disable it in Supabase dashboard.');
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signInWithNotion = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'notion',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const ensureUserExists = async (user: User) => {
    try {
      // Check if user exists in our User table
      const { data: existingUser, error: checkError } = await supabase
        .from('User')
        .select('id')
        .eq('id', user.id)
        .single();

      // If we get an RLS error or user doesn't exist, use the API endpoint
      if (checkError || !existingUser) {
        const response = await fetch('/api/auth/create-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: user.user_metadata?.username || user.user_metadata?.full_name || user.email?.split('@')[0],
            email: user.email!,
          }),
        });
        
        if (!response.ok) {
          const result = await response.json();
          console.error('Error ensuring user exists:', result.error);
        }
      }
    } catch (error) {
      console.error('Error ensuring user exists:', error);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithMagicLink,
    signInWithNotion,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Component that ensures children are wrapped in AuthProvider even if missing higher in the tree
export const EnsureAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    return <AuthProvider>{children}</AuthProvider>;
  }
  return <>{children}</>;
};

// Higher-order component to wrap any component with AuthProvider
export function withAuthProvider<P extends {}>(Wrapped: React.ComponentType<P>) {
  const ComponentWithProvider = (props: P) => (
    <AuthProvider>
      <Wrapped {...(props as P)} />
    </AuthProvider>
  );

  ComponentWithProvider.displayName = `withAuthProvider(${(Wrapped as any).displayName || Wrapped.name || 'Component'})`;
  return ComponentWithProvider;
}
