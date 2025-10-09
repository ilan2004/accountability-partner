/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@accountability/shared", "@accountability/db"],
};

export default nextConfig;
