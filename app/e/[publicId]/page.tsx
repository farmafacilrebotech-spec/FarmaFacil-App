import Link from 'next/link';

import { BrandLogo } from '@/components/brand';
import { resolvePublicEntrypoint } from '@/lib/kiosk/resolve-public-entrypoint';

export const dynamic = 'force-dynamic';

/**
 * Destino público del QR de farmacia.
 * NO autentica al visitante. NO crea sesión de cliente.
 * Página informativa hasta que exista el portal de cuenta.
 */
export default async function PublicPharmacyEntrypointPage({
  params,
}: {
  params: { publicId: string };
}) {
  const resolved = await resolvePublicEntrypoint(params.publicId);

  if (!resolved.ok) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <BrandLogo size={80} />
        <div className="mt-8 max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-soft-lg">
          <h1 className="text-xl font-semibold text-foreground">
            Código no disponible
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {resolved.reason === 'inactive'
              ? 'Este código QR está desactivado o ha caducado.'
              : resolved.reason === 'error'
                ? 'No se ha podido verificar este código en este momento. Inténtalo de nuevo en unos minutos.'
                : 'No hemos encontrado una farmacia asociada a este código.'}
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex text-sm font-medium text-primary hover:underline"
          >
            Ir al acceso de FarmaFácil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#2EC4C7] px-4">
      <BrandLogo size={96} />
      <div className="mt-8 w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          FarmaFácil
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {resolved.pharmacyName}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Has escaneado el código oficial de esta farmacia. El acceso personal
          de clientes (teléfono y contraseña) está en preparación.
        </p>
        <p className="mt-3 text-xs text-slate-400">
          Este código identifica la farmacia. No inicia sesión automáticamente
          ni abre el panel de gestión.
        </p>
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Pronto podrás entrar a tu cuenta de cliente desde aquí. Mientras
          tanto, si eres profesional de la farmacia, usa el acceso de
          empleados.
        </div>
        <Link
          href="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[#2EC4C7] px-6 py-4 text-base font-semibold text-white"
        >
          Acceso profesionales
        </Link>
      </div>
    </div>
  );
}
