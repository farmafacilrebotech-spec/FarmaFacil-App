'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  IMPLANTATION_CONCEPTS,
  implantationPendingCents,
  type ImplantationConcept,
  type ImplantationPaymentRow,
} from '@/lib/commercial/implantation-payments';
import { formatCentsEur } from '@/lib/tarifas';
import {
  listPharmacyImplantationPaymentsAction,
  recordPharmacyImplantationPaymentAction,
} from '@/app/(app)/farmacias/implantation-actions';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Registro manual de implantaciones abonadas (sin pasarela).
 * La compensación se aplica al crear el presupuesto de la farmacia.
 */
export function ImplantationPaymentsPanel({
  pharmacyId,
  canManage,
}: {
  pharmacyId: string;
  canManage: boolean;
}) {
  const [payments, setPayments] = React.useState<ImplantationPaymentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [concept, setConcept] = React.useState<ImplantationConcept>('app_setup');
  const [saving, setSaving] = React.useState(false);

  const reload = React.useCallback(async () => {
    setLoading(true);
    const result = await listPharmacyImplantationPaymentsAction(pharmacyId);
    if (result.ok) setPayments(result.payments);
    else toast.error(result.error);
    setLoading(false);
  }, [pharmacyId]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  async function handleRecord() {
    if (!canManage || saving) return;
    setSaving(true);
    try {
      const result = await recordPharmacyImplantationPaymentAction({
        pharmacyId,
        concept,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Implantación registrada.');
      await reload();
    } finally {
      setSaving(false);
    }
  }

  const def = IMPLANTATION_CONCEPTS[concept];

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">
          Implantaciones y pagos previos
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Registro de alta de app (190 €) y personalización de kiosko (1.090 €).
          Al crear un presupuesto se compensan automáticamente sin doble cobro.
        </p>
      </header>

      {canManage ? (
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Concepto</label>
            <Select
              value={concept}
              onValueChange={(v) => setConcept(v as ImplantationConcept)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.keys(IMPLANTATION_CONCEPTS) as ImplantationConcept[]
                ).map((key) => (
                  <SelectItem key={key} value={key}>
                    {IMPLANTATION_CONCEPTS[key].label} ·{' '}
                    {formatCentsEur(IMPLANTATION_CONCEPTS[key].defaultNetCents)}{' '}
                    + IVA
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void handleRecord()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              `Registrar (${formatCentsEur(def.defaultNetCents)} + IVA)`
            )}
          </Button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay implantaciones registradas.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {payments.map((p) => {
            const pending = implantationPendingCents(p);
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {IMPLANTATION_CONCEPTS[p.concept]?.label ?? p.concept}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.paymentDate} · pagado {formatCentsEur(p.amountPaidCents)} ·{' '}
                    {p.paymentStatus}
                    {p.documentRef ? ` · ref ${p.documentRef}` : ''}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-foreground">
                    Pendiente compensar:{' '}
                    <span className="font-medium">
                      {formatCentsEur(pending)}
                    </span>
                  </p>
                  {p.appliedToQuoteId ? (
                    <p className="text-muted-foreground">
                      Aplicado a presupuesto
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
