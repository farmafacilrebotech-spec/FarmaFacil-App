import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  // Safari aplica de forma inconsistente size-adjust/ascent-override del
  // Arial fallback de next/font (~107%), hinchando tipografía vs Chrome.
  adjustFontFallback: false,
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
    // --font-inter DEBE vivir en <html>: el preflight de Tailwind fija
    // font-family: var(--font-inter) en html. Si la variable solo está en
    // body, html queda con fuente UA (Safari → tipografía distinta/más ancha).
    <html lang="es" className={inter.variable} suppressHydrationWarning>
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
