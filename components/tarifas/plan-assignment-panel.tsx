'use client';

import * as React from 'react';
import { Info } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import {
  PLAN_CATALOG_EXPECTATIONS,
  type CommercialPlanCode,
} from '@/lib/commercial/plan-catalog-mode';
import type { QuotePharmacyOption } from '@/lib/commercial/quote-types';
import { changePharmacyPlanAction } from '@/app/(app)/farmacias/actions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PLAN_TO_KEY: Record<
  Exclude<CommercialPlanCode, 'piloto'>,
  string
> = {
  general: 'general',
  personalizado: 'personalized',
  asistente_ia_personalizado: 'ai_personalized',
};

/**
 * Contratación / asignación de plan comercial.
 * Farmacia por nombre · sin UUID · sin mensajes de migración 056.
 * Assign no reserva plaza ni finaliza piloto implícitamente (093).
 */
export function PlanAssignmentPanel({
  canManage,
  pharmacies = [],
  initialPharmacyId = null,
}: {
  canManage: boolean;
  pharmacies?: QuotePharmacyOption[];
  initialPharmacyId?: string | null;
}) {
  const router = useRouter();
  const mutationLock = React.useRef(false);
  const [pharmacyId, setPharmacyId] = React.useState(
    initialPharmacyId?.trim() || 'none'
  );
  const [plan, setPlan] = React.useState<Exclude<CommercialPlanCode, 'piloto'>>(
    'general'
  );
  const [endOpenPilot, setEndOpenPilot] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (initialPharmacyId?.trim()) {
      setPharmacyId(initialPharmacyId.trim());
    }
  }, [initialPharmacyId]);

  const expectation = PLAN_CATALOG_EXPECTATIONS.find((p) => p.planCode === plan);
  const paidPlans = PLAN_CATALOG_EXPECTATIONS.filter((p) => p.planCode !== 'piloto');

  async function assignPlan() {
    if (!canManage || mutationLock.current) return;
    if (pharmacyId === 'none') {
      toast.error('Selecciona una farmacia por nombre.');
      return;
    }
    mutationLock.current = true;
    setBusy(true);
    try {
      const result = await changePharmacyPlanAction(
        pharmacyId,
        PLAN_TO_KEY[plan],
        {
          endOpenPilot,
          useLaunchPromo: false,
          reason: 'tarifas_contratacion_panel',
        }
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Plan «${expectation?.label ?? plan}» asignado.`, {
        description:
          'Sin reserva automática de plaza. Firma jurídica definitiva sigue bloqueada.',
      });
      router.refresh();
    } finally {
      setBusy(false);
      mutationLock.current = false;
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-muted/20 p-4">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Dominios separados
            </p>
            <ul className="list-inside list-disc text-xs">
              <li>Estado de la farmacia (operativo)</li>
              <li>Piloto (acceso temporal a un plan G/P/IA)</li>
              <li>Plaza promocional (gestión en Contratos / ficha)</li>
              <li>Presupuesto y contrato</li>
              <li>Suscripción y funcionalidades activas</li>
            </ul>
            <p className="text-xs">
              Asignar plan <strong>no</strong> reserva plaza ni finaliza
              pilotos sin confirmación. La firma jurídica definitiva permanece
              bloqueada.
            </p>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden shadow-soft">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Plan → catálogo (referencia)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Plan
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Catálogo
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Asistente
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Notas
                </th>
              </tr>
            </thead>
            <tbody>
              {paidPlans.map((row) => (
                <tr
                  key={row.planCode}
                  className="border-b border-border/70 last:border-0"
                >
                  <td className="px-4 py-2.5 font-medium">{row.label}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline">
                      {row.catalogMode === 'generic' ? 'Genérico' : 'Propio'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {row.assistantPersonalized
                      ? 'Personalizado'
                      : 'Genérico / demo'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {row.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-4 p-5 shadow-soft">
        <h3 className="text-sm font-semibold text-foreground">
          Asignar plan comercial
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Farmacia</Label>
            <Select
              value={pharmacyId}
              onValueChange={setPharmacyId}
              disabled={!canManage || busy}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar por nombre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Seleccionar…</SelectItem>
                {pharmacies.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select
              value={plan}
              onValueChange={(v) =>
                setPlan(v as Exclude<CommercialPlanCode, 'piloto'>)
              }
              disabled={!canManage || busy}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paidPlans.map((p) => (
                  <SelectItem key={p.planCode} value={p.planCode}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={endOpenPilot}
            onChange={(e) => setEndOpenPilot(e.target.checked)}
            disabled={!canManage || busy}
          />
          <span>
            Si hay un piloto activo, finalizarlo expresamente antes de asignar
            el plan de pago (no se hace de forma implícita).
          </span>
        </label>
        <Button
          type="button"
          disabled={!canManage || busy || pharmacyId === 'none'}
          onClick={() => void assignPlan()}
        >
          Asignar plan
        </Button>
      </Card>
    </div>
  );
}
