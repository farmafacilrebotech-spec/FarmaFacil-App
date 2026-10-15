import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  // Sin size-adjust automático (hincha tipografía en Safari vs Chrome).
  // fallback explícito sans: evita Times/serif mientras carga Inter o si falla.
  adjustFontFallback: false,
  fallback: [
    'ui-sans-serif',
    'system-ui',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'sans-serif',
  ],
});

export const metadata: Metadata = {
  title: 'FarmaFácil · Panel de gestión',
  description:
    'La plataforma de gestión definitiva para farmacias. Controla farmacias, clientes, catálogo, pedidos y contratos desde un único panel.',
  // Explícito: evita diferencias de escala inicial Safari/Chrome.
  viewport: {
    width: 'device-width',
    initialScale: 1,
  },
  icons: {
    icon: [
      {
        url: '/images/logos/farmafacil-favicon-16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        url: '/images/logos/farmafacil-favicon-32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/images/logos/farmafacil-apple-touch.png',
  },
  openGraph: {
    title: 'FarmaFácil · Panel de gestión',
    description:
      'La plataforma de gestión definitiva para farmacias. Controla farmacias, clientes, catálogo, pedidos y contratos desde un único panel.',
    images: ['/images/logos/farmafacil-logo-512.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // --font-inter en <html>: el preflight de Tailwind usa var(--font-inter).
    // inter.className + font-sans en html y body: stack sans coherente
    // (Inter → system-ui) en Safari y Chrome, sin depender del UA serif.
    <html
      lang="es"
      className={`${inter.variable} ${inter.className} font-sans antialiased`}
      suppressHydrationWarning
    >
      <body className={`${inter.className} font-sans antialiased`}>
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
