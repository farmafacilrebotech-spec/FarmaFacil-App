import type { Metadata } from 'next';

/**
 * Layout mínimo para /q/[token] (R4).
 * Sin PII ni scripts de analítica propios de esta ruta.
 * referrer no-referrer reduce fugas del token vía Referer.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default function PublicQuoteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
