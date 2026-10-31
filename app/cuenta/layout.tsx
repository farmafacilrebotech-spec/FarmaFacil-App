import type { Metadata } from 'next';

import { CustomerPwaRegister } from '@/components/customer/customer-pwa-register';

export const metadata: Metadata = {
  title: 'FarmaFácil · Mi cuenta',
  description:
    'Tu cuenta FarmaFácil: Mis farmacias, perfil, direcciones y pedidos.',
  applicationName: 'FarmaFácil',
  manifest: '/manifest.webmanifest',
  themeColor: '#2EC4C7',
  appleWebApp: {
    capable: true,
    title: 'FarmaFácil',
    statusBarStyle: 'default',
  },
  openGraph: {
    title: 'FarmaFácil · Mi cuenta',
    description:
      'Acceso de cliente FarmaFácil: Mis farmacias, perfil y pedidos.',
    images: ['/images/logos/farmafacil-logo-512.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FarmaFácil · Mi cuenta',
    description:
      'Acceso de cliente FarmaFácil: Mis farmacias, perfil y pedidos.',
    images: ['/images/logos/farmafacil-logo-512.png'],
  },
  icons: {
    icon: [
      { url: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
    ],
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

export default function CustomerAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CustomerPwaRegister />
      {children}
    </>
  );
}
