import Link from 'next/link';

import { BrandLogo } from '@/components/brand';

/**
 * Estado informativo para funciones del kiosko aún no conectadas.
 * No simula que funcionan.
 */
export function KioskComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#2EC4C7] px-6">
      <BrandLogo size={96} />
      <div className="mt-8 w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {description}
        </p>
        <Link
          href="/k"
          className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-[#2EC4C7] px-6 py-4 text-base font-semibold text-white shadow-md active:scale-[0.99]"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
