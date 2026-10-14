import Link from 'next/link';

import { commercialSupportContact } from '@/lib/pharmacies/commercial-access';
import type { PharmacyCommercialGate } from '@/lib/pharmacies/commercial-access';
import { SignOutButton } from '@/components/auth/sign-out-button';

/**
 * Pantalla de bloqueo comercial (server component).
 * No renderiza navegación operativa del tenant.
 */
export function PharmacyAccessSuspended({
  gate,
  userEmail,
}: {
  gate: PharmacyCommercialGate;
  userEmail?: string | null;
}) {
  const support = commercialSupportContact();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-teal-50/40 px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
          FarmaFácil
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          {gate.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Farmacia: <span className="font-medium text-slate-800">{gate.pharmacyName}</span>
        </p>
        <p className="mt-4 text-sm leading-relaxed text-slate-700">
          {gate.message}
        </p>
        <p className="mt-4 text-sm text-slate-600">
          Para regularizar el acceso o consultar el estado de la suscripción,
          escribe a{' '}
          <a
            className="font-medium text-teal-800 underline underline-offset-2"
            href={`mailto:${support}?subject=${encodeURIComponent(
              `Acceso farmacia ${gate.pharmacyName}`
            )}`}
          >
            {support}
          </a>
          .
        </p>
        {userEmail ? (
          <p className="mt-2 text-xs text-slate-500">Sesión: {userEmail}</p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Ir al inicio de sesión
          </Link>
          <SignOutButton className="inline-flex h-10 items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800" />
        </div>
        <p className="mt-6 text-xs leading-relaxed text-slate-500">
          Tus datos, usuarios y configuración se conservan. Este bloqueo es
          comercial y no elimina la información de la farmacia.
        </p>
      </div>
    </div>
  );
}
