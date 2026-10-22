import Link from 'next/link';

import { commercialSupportContact } from '@/lib/pharmacies/commercial-access';
import type { PharmacyCommercialGate } from '@/lib/pharmacies/commercial-access';
import { COMMERCIAL_PILOT_DURATION_DAYS } from '@/lib/commercial/pharmacy-onboarding';
import { SignOutButton } from '@/components/auth/sign-out-button';

/**
 * Pantalla de preparación (piloto ready, sin activar).
 * Autenticación + membership OK; sin shell operativo ni pedidos.
 */
export function PharmacyPilotPreparation({
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
          Farmacia:{' '}
          <span className="font-medium text-slate-800">{gate.pharmacyName}</span>
        </p>
        <p className="mt-4 text-sm leading-relaxed text-slate-700">
          {gate.message}
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>
            Piloto comercial: preparado, pendiente de activación
          </li>
          <li>
            {COMMERCIAL_PILOT_DURATION_DAYS} días disponibles, todavía no
            iniciados
          </li>
          <li>Sin acceso a pedidos ni módulos operativos hasta la activación</li>
        </ul>
        <p className="mt-4 text-sm text-slate-600">
          Si necesitas confirmar el estado o la fecha de activación, escribe a{' '}
          <a
            className="font-medium text-teal-800 underline underline-offset-2"
            href={`mailto:${support}?subject=${encodeURIComponent(
              `Piloto farmacia ${gate.pharmacyName}`
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
          Esta pantalla no concede acceso operativo. La activación del piloto
          solo se realiza desde el flujo comercial FarmaFácil tras readiness.
        </p>
      </div>
    </div>
  );
}
