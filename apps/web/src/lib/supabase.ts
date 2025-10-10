import { createClient } from '@supabase/supabase-js';
import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { NextApiRequest, NextApiResponse } from 'next';
import { GetServerSidePropsContext } from 'next';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Browser client (for client-side operations)
export const createBrowserSupabaseClient = () =>
  createBrowserClient(supabaseUrl, supabaseAnonKey);

// Simple client (for non-SSR operations)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server client for API routes
export const createServerSupabaseClient = (req?: NextApiRequest, res?: NextApiResponse) => {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: (name: string) => {
        if (req?.cookies) {
          return req.cookies[name];
        }
        return undefined;
      },
      set: (name: string, value: string, options: any) => {
        if (res) {
          res.setHeader('Set-Cookie', `${name}=${value}; ${Object.entries(options).map(([k, v]) => `${k}=${v}`).join('; ')}`);
        }
      },
      remove: (name: string, options: any) => {
        if (res) {
          res.setHeader('Set-Cookie', `${name}=; Max-Age=0; ${Object.entries(options).map(([k, v]) => `${k}=${v}`).join('; ')}`);
        }
      },
    },
  });
};

// Server client for getServerSideProps
export const createSSRSupabaseClient = (context: GetServerSidePropsContext) => {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: (name: string) => {
        return context.req.cookies[name] || undefined;
      },
      set: (name: string, value: string, options: any) => {
        context.res.setHeader('Set-Cookie', `${name}=${value}; ${Object.entries(options).map(([k, v]) => `${k}=${v}`).join('; ')}`);
      },
      remove: (name: string, options: any) => {
        context.res.setHeader('Set-Cookie', `${name}=; Max-Age=0; ${Object.entries(options).map(([k, v]) => `${k}=${v}`).join('; ')}`);
      },
    },
  });
};

// Service role client (for admin operations)
export const createServiceSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

// Database types (we'll update this after setting up the schema)
export type Database = {
  public: {
    Tables: {
      // We'll add our table types here after migrating the schema
    };
  };
};
