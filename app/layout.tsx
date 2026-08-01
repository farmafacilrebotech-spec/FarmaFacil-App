import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FarmaFácil · Panel de gestión',
  description:
    'La plataforma de gestión definitiva para farmacias. Controla farmacias, clientes, catálogo, pedidos y contratos desde un único panel.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/images/logos/farmafacil-logo.jpeg', type: 'image/jpeg' },
    ],
    apple: '/images/logos/farmafacil-mark.svg',
  },
  openGraph: {
    title: 'FarmaFácil · Panel de gestión',
    description:
      'La plataforma de gestión definitiva para farmacias. Controla farmacias, clientes, catálogo, pedidos y contratos desde un único panel.',
    images: ['/images/logos/farmafacil-logo.jpeg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
