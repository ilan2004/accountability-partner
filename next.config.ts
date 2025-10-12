import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Disable ESLint during builds on Railway to avoid build failures
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable type checking during builds to speed up deployment
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ['@supabase/supabase-js'],
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
