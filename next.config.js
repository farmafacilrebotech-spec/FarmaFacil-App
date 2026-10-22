/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite `NEXT_DIST_DIR=.next-perf-prod` para builds locales sin pisar `.next` del dev.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  experimental: {
    // Necesario en Next 13.5 para 'use server' (logout / actions).
    serverActions: true,
  },
};

module.exports = nextConfig;
