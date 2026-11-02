import type { Metadata } from 'next';

/**
 * Metadatos PWA en el árbol público /e (QR farmacia).
 * El panel staff (/dashboard, etc.) conserva el layout raíz.
 */
export const metadata: Metadata = {
  applicationName: 'FarmaFácil',
  manifest: '/manifest.webmanifest',
  themeColor: '#2EC4C7',
  appleWebApp: {
    capable: true,
    title: 'FarmaFácil',
    statusBarStyle: 'default',
  },
  openGraph: {
    title: 'FarmaFácil',
    description:
      'Catálogo y cuenta de cliente FarmaFácil. No es el acceso de profesionales.',
    images: ['/images/logos/farmafacil-logo-512.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FarmaFácil',
    description:
      'Catálogo y cuenta de cliente FarmaFácil. No es el acceso de profesionales.',
    images: ['/images/logos/farmafacil-logo-512.png'],
  },
  icons: {
    apple: [{ url: '/icons/apple-touch-180.png', sizes: '180x180' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
  },
};

export default function PublicEntrypointLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
