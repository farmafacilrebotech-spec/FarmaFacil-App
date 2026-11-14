import Link from 'next/link';
import { FileText } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { listSaSubscriptions } from '@/lib/platform/sa-subscriptions';
import { getLaunchPromoDashboard } from '@/lib/pharmacies/launch-seats';
import { LaunchPromoGlobalPanel } from '@/components/pharmacies/launch-promo-2027-panel';
import {
  getCurrentProfile,
  hasPlatformSuperAdminRole,
} from '@/lib/auth/platform';
import { subscriptionStatusLabelEs } from '@/lib/pharmacies/labels';
import { formatDate } from '@/lib/format';
import { commercialPlanLabel } from '@/lib/commercial/commercial-plan-labels';

export const dynamic = 'force-dynamic';

function dateCell(
  value: string | null,
  emptyLabel: string
): { text: string; muted: boolean } {
  if (!value) return { text: emptyLabel, muted: true };
  return { text: formatDate(value), muted: false };
}

/**
 * Contratos y suscripciones:
 * - Formalización contractual pendiente de validación jurídica (sin firma).
 * - Suscripción/facturación desde subscriptions.
 * - Plazas launch_2027 (misma fuente que la ficha).
 */
export default async function ContratosPage() {
  const [subs, launch, profileResult] = await Promise.all([
    listSaSubscriptions(100),
    getLaunchPromoDashboard(),
    getCurrentProfile(),
  ]);
  const saTotal = profileResult.profile?.id
    ? await hasPlatformSuperAdminRole(profileResult.profile.id)
    : { ok: false };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        title="Contratos y suscripciones"
        description="Documento contractual ≠ estado del servicio. Firmas no activadas."
      />

      <LaunchPromoGlobalPanel
        summary={launch.summary}
        seats={launch.seats}
        events={launch.events}
        canManage={saTotal.ok}
      />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">A. Contratos (documento)</h2>
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-medium">Formalización contractual pendiente</p>
          <p className="mt-1 text-muted-foreground">
            La emisión y firma de contratos legales está pendiente de
            validación jurídica. Todavía no se habilita la firma contractual
            desde esta pantalla.
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
        <p className="text-xs text-muted-foreground">
          Cada fila es un registro de suscripción. Si una farmacia aparece más
          de una vez, suele tratarse de historial (p. ej. cancelada/vencida)
          además de la vigente. No se inventan fechas: si no hay dato, se
          indica expresamente.
        </p>
        {!subs.ok ? (
          <p className="text-sm text-destructive">{subs.error}</p>
        ) : subs.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay suscripciones registradas.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Farmacia</th>
                  <th className="px-3 py-2 font-medium">Vigencia</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">
                    Fin de periodo de suscripción
                  </th>
                  <th className="px-3 py-2 font-medium">Fin de piloto</th>
                </tr>
              </thead>
              <tbody>
                {subs.rows.map((r) => {
                  const period = dateCell(
                    r.currentPeriodEnd,
                    'Sin fecha de periodo'
                  );
                  const pilot = dateCell(
                    r.trialEndsAt,
                    r.status.toLowerCase() === 'trialing'
                      ? 'Sin fecha de piloto'
                      : 'Sin piloto'
                  );
                  const isLegacyPlan =
                    r.planName &&
                    /starter|pro|business|enterprise/i.test(
                      `${r.planName} ${r.planLabel}`
                    );
                  return (
                    <tr key={r.id} className="border-b border-border/70">
                      <td className="px-3 py-2">
                        <Link
                          href={`/farmacias/${r.pharmacyId}?tab=contrato`}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {r.pharmacyName ?? r.pharmacyId.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.isCurrent ? (
                          <span className="font-medium text-teal-800 dark:text-teal-200">
                            Vigente
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Histórico
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {subscriptionStatusLabelEs(r.status)}
                      </td>
                      <td className="px-3 py-2">
                        {r.planLabel}
                        {r.planName ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({r.planName})
                          </span>
                        ) : null}
                        {isLegacyPlan ? (
                          <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-200">
                            Plan anterior pendiente de asignación comercial
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={
                          period.muted
                            ? 'px-3 py-2 text-xs text-muted-foreground'
                            : 'px-3 py-2 text-xs'
                        }
                      >
                        {period.text}
                      </td>
                      <td
                        className={
                          pilot.muted
                            ? 'px-3 py-2 text-xs text-muted-foreground'
                            : 'px-3 py-2 text-xs'
                        }
                      >
                        {pilot.text}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          Detalle y transiciones en la ficha de farmacia (panel de suscripción).
          Plan activo y plaza promocional se distinguen en la pestaña Contrato.
        </p>
        <p className="text-xs text-muted-foreground">
          Referencia de planes comerciales:{' '}
          {commercialPlanLabel('general')},{' '}
          {commercialPlanLabel('personalized')},{' '}
          {commercialPlanLabel('ai_personalized')}.
        </p>
      </section>
    </div>
  );
}
