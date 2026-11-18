/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite `NEXT_DIST_DIR=.next-perf-prod` para builds locales sin pisar `.next` del dev.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // PRE-05C: no reescribir Location 127.0.0.1→localhost en middleware
  // (rompe cookies host-only y Server Actions con Failed to fetch / CORS).
  skipMiddlewareUrlNormalize: true,
  experimental: {
    // Necesario en Next 13.5 para 'use server' (logout / actions).
    serverActions: true,
    // pdf-parse v2 (pdfjs) no debe empaquetarse en el bundle de server actions.
    // Chromium / puppeteer-core: PRE-05B HTML→PDF en Vercel y server actions.
    serverComponentsExternalPackages: [
      'pdf-parse',
      'puppeteer-core',
      '@sparticuz/chromium',
    ],
  },
};

module.exports = nextConfig;
