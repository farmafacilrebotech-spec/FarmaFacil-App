/** @type {import('next').NextConfig} */
const nextConfig = {
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
