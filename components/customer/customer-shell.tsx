import Link from 'next/link';

import { BrandLogo } from '@/components/brand';

export function CustomerShell({
  publicId,
  pharmacyLabel,
  title,
  children,
}: {
  publicId: string;
  pharmacyLabel?: string | null;
  title: string;
  children: React.ReactNode;
}) {
  const base = `/e/${publicId}`;
  return (
    <div className="min-h-screen bg-[#F7FAFA] px-4 py-6">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-5 flex items-center justify-between gap-3">
          <BrandLogo size={48} />
          <Link
            href={`${base}/catalogo`}
            className="text-sm font-medium text-slate-600 hover:underline"
          >
            Volver al catálogo
          </Link>
        </div>
        <header className="mb-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            FarmaFácil · Mi cuenta
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[#0F2A2E]">{title}</h1>
          {pharmacyLabel ? (
            <p className="mt-1 text-sm text-slate-500">
              Contexto farmacia: {pharmacyLabel}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-slate-400">
            Tu cuenta es global FarmaFácil. Visitar el QR no comparte tu perfil
            con la farmacia.
          </p>
        </header>
        {children}
      </div>
    </div>
  );
}
