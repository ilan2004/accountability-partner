import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@accountability/db', '@accountability/shared'],
  output: 'standalone',
  outputFileTracingRoot: path.join(process.cwd(), '../../'),
  env: {
    DATABASE_URL: process.env.DATABASE_URL || 'file:../../packages/db/dev.db',
  },
}

export default nextConfig
