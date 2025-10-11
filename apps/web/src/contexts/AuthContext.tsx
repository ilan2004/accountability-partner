'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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

  const supabase = createBrowserSupabaseClient();

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
        await ensureUserExists(session.user);
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
    
    if (error) throw error;
    
    // Create user record immediately with the username
    if (data.user) {
      try {
        const { error: profileError } = await supabase
          .from('User')
          .upsert({
            id: data.user.id,
            email: email,
            name: name, // Use the provided username
            emailVerified: data.user.email_confirmed_at ? new Date(data.user.email_confirmed_at) : null,
            image: data.user.user_metadata?.avatar_url,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          
        if (profileError) {
          console.error('Error creating user profile:', profileError);
        }
      } catch (profileError) {
        console.error('Error creating user profile:', profileError);
      }
    }
    
    // If user is created but not confirmed (due to email confirmation being enabled),
    // we'll need to handle this at the Supabase project level
    if (data.user && !data.user.email_confirmed_at) {
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

  const ensureUserExists = async (user: User) => {
    try {
      // Check if user exists in our User table
      const { data: existingUser } = await supabase
        .from('User')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!existingUser) {
        // Create user record if it doesn't exist
        const { error } = await supabase
          .from('User')
          .insert({
            id: user.id,
            email: user.email!,
            name: user.user_metadata?.username || user.user_metadata?.full_name || user.email?.split('@')[0],
            emailVerified: user.email_confirmed_at ? new Date(user.email_confirmed_at) : null,
            image: user.user_metadata?.avatar_url,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

        if (error) {
          console.error('Error creating user record:', error);
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
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
