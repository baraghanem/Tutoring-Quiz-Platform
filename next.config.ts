/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure better-sqlite3 native addon is handled correctly
  serverExternalPackages: ['better-sqlite3'],
  experimental: {},
};

export default nextConfig;
