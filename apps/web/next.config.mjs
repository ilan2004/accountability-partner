/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@accountability/db', '@accountability/shared'],
  env: {
    DATABASE_URL: process.env.DATABASE_URL || 'file:../../packages/db/dev.db',
  },
}

export default nextConfig
