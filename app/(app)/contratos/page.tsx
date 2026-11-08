import Link from 'next/link';
import { FileText } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { listSaSubscriptions } from '@/lib/platform/sa-subscriptions';

export const dynamic = 'force-dynamic';

/**
 * Separación A/B:
 * A) Contratos legales PDF — requieren migración 069 + gates jurídicos (no inventados).
 * B) Suscripción/facturación — listado real desde subscriptions.
 */
export default async function ContratosPage() {
  const subs = await listSaSubscriptions(100);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        title="Contratos y suscripciones"
        description="Documento contractual ≠ estado del servicio. Firmas no activadas."
      />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">A. Contratos (documento)</h2>
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-medium">Listado legal no publicado en main</p>
          <p className="mt-1 text-muted-foreground">
            El generador y la tabla <code className="text-xs">commercial_contracts</code>{' '}
            viven en el worktree de 069. Emisión/firma bloqueadas hasta
            confirmación ReBoTech + jurídico. No se muestran contratos
            ficticios.
          </p>
          <p className="mt-2">
            Presupuestos comerciales:{' '}
            <Link href="/tarifas" className="underline">
              Tarifas y simulador
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">B. Suscripción y facturación</h2>
        {!subs.ok ? (
          <p className="text-sm text-destructive">{subs.error}</p>
        ) : subs.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay suscripciones registradas.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Farmacia</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Fin periodo / trial</th>
                </tr>
              </thead>
              <tbody>
                {subs.rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/70">
                    <td className="px-3 py-2">
                      <Link
                        href={`/farmacias/${r.pharmacyId}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {r.pharmacyName ?? r.pharmacyId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2">
                      {r.planLabel}
                      {r.planName ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({r.planName})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.currentPeriodEnd
                        ? new Date(r.currentPeriodEnd).toLocaleDateString('es-ES')
                        : r.trialEndsAt
                          ? `trial ${new Date(r.trialEndsAt).toLocaleDateString('es-ES')}`
                          : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          Detalle y transiciones en la ficha de farmacia (panel de suscripción).
        </p>
      </section>
    </div>
  );
}
