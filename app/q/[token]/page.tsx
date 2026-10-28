import type { Metadata } from 'next';

import { BrandLogo } from '@/components/brand';
import { PublicQuoteClient } from '@/components/orders/public-quote-client';
import { getPublicQrQuoteByToken } from '@/lib/orders/public-quote';
import { computeQuoteSessionKey } from '@/lib/orders/quote-token-cookie';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Presupuesto · FarmaFácil',
  description: 'Consulta y responde a tu presupuesto de farmacia.',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

/**
 * Pantalla pública de presupuesto (R4).
 * sessionKey en RSC; cookie httpOnly vía Server Action (no set en RSC).
 * El token no se pasa como prop al cliente (solo URL).
 */
export default async function PublicQuotePage({
  params,
}: {
  params: { token: string };
}) {
  const token = decodeURIComponent(params.token ?? '').trim();
  const quote = await getPublicQrQuoteByToken(token);
  const sessionKey = quote.ok ? computeQuoteSessionKey(token) : null;

  return (
    <div className="min-h-screen bg-[#F7FAFA] px-4 py-8">
      <div className="mx-auto mb-6 flex w-full max-w-lg items-center justify-between">
        <BrandLogo size={48} />
      </div>

      {!quote.ok || !sessionKey ? (
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-foreground">
            Enlace no disponible
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {quote.ok
              ? 'No se ha podido preparar la sesión del enlace.'
              : quote.error}
          </p>
        </div>
      ) : (
        <PublicQuoteClient initial={quote} sessionKey={sessionKey} />
      )}
    </div>
  );
}
