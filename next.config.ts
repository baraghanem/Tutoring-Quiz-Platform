import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure better-sqlite3 native addon is handled correctly
  serverExternalPackages: ['better-sqlite3'],
  experimental: {},
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
