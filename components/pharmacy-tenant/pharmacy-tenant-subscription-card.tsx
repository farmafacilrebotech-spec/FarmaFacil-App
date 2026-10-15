import { CreditCard } from 'lucide-react';

import { formatDate } from '@/lib/format';
import type { TenantSubscriptionSummary } from '@/lib/pharmacies/tenant-subscription-summary';
import { Card } from '@/components/ui/card';

function DateValue({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="font-medium text-foreground">{formatDate(value)}</span>
  );
}

export function PharmacyTenantSubscriptionCard({
  summary,
}: {
  summary: TenantSubscriptionSummary;
}) {
  const periodLabel = summary.cancelAtPeriodEnd
    ? 'Finaliza el'
    : 'Renovación / fin de periodo';

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 border-b border-border bg-muted/30 px-6 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Mi suscripción
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Información comercial de solo lectura. Para cambios, contacta con
            FarmaFácil.
          </p>
        </div>
      </div>

      <dl className="grid gap-6 p-6 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Plan actual
          </dt>
          <dd className="mt-1 text-sm font-medium text-foreground">
            {summary.planName ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Estado de la suscripción
          </dt>
          <dd className="mt-1 text-sm font-medium text-foreground">
            {summary.subscriptionStatusLabel ?? 'Sin suscripción registrada'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fin del periodo de prueba
          </dt>
          <dd className="mt-1 text-sm">
            <DateValue value={summary.trialEnd} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {periodLabel}
          </dt>
          <dd className="mt-1 text-sm">
            <DateValue value={summary.periodEnd} />
          </dd>
        </div>
        {summary.cancelAtPeriodEnd ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cancelación programada
            </dt>
            <dd className="mt-1 text-sm font-medium text-amber-800 dark:text-amber-300">
              Sí
              {summary.periodEnd
                ? ` · acceso hasta ${formatDate(summary.periodEnd)}`
                : ''}
            </dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Add-on Kiosko
          </dt>
          <dd className="mt-1 text-sm font-medium text-foreground">
            {summary.kioskAddonLabel}
          </dd>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.kioskAddonDescription}
          </p>
          {summary.kioskEndsAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Vencimiento del add-on:{' '}
              <span className="text-foreground">
                {formatDate(summary.kioskEndsAt)}
              </span>
            </p>
          ) : null}
        </div>
      </dl>
    </Card>
  );
}
