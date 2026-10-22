'use client';

import * as React from 'react';
import { Info, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import {
  PLAN_ASSIGN_RPC_STATUS,
  PLAN_CATALOG_EXPECTATIONS,
  type CatalogMode,
  type CommercialPlanCode,
} from '@/lib/commercial/plan-catalog-mode';
import {
  attachMasterCatalogAction,
  setPharmacyCatalogModeAction,
} from '@/app/(app)/tarifas/actions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PendingIntegrationBadge } from './pending-integration-badge';

/**
 * Preparación de contratación / cambio de plan.
 * Sin RPC unificada (056 en drafts). Operaciones parciales: mode + attach.
 * No pagos ni conversión automática.
 */
export function PlanAssignmentPanel({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const mutationLock = React.useRef(false);
  const [pharmacyId, setPharmacyId] = React.useState('');
  const [plan, setPlan] = React.useState<CommercialPlanCode>('general');
  const [busy, setBusy] = React.useState(false);

  const expectation = PLAN_CATALOG_EXPECTATIONS.find((p) => p.planCode === plan);

  async function applyCatalogModeOnly() {
    if (!canManage || mutationLock.current) return;
    const id = pharmacyId.trim();
    if (!id) {
      toast.error('Indica el UUID de la farmacia.');
      return;
    }
    const mode = (expectation?.catalogMode ?? 'generic') as CatalogMode;
    mutationLock.current = true;
    setBusy(true);
    try {
      const modeResult = await setPharmacyCatalogModeAction(id, mode);
      if (!modeResult.ok) {
        toast.error(modeResult.error);
        return;
      }
      if (mode === 'generic') {
        const attach = await attachMasterCatalogAction(id);
        if (!attach.ok) {
          toast.error(attach.error);
          return;
        }
        toast.success(`Modalidad → ${mode}. Catálogo maestro adjuntado.`, {
          description:
            attach.activeGeneric != null
              ? `${attach.activeGeneric} genéricos activos.`
              : undefined,
        });
      } else {
        toast.success(`Modalidad → ${mode}.`, {
          description:
            'Los productos genéricos no se borran; dejan de mostrarse en público.',
        });
      }
      router.refresh();
    } finally {
      setBusy(false);
      mutationLock.current = false;
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-dashed border-amber-500/40 bg-amber-500/5 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Contratación / cambio de plan — pendiente de migración 056
            </p>
            <p>
              No existe una RPC que sincronice a la vez plan comercial,
              suscripción técnica, entitlements y catalog_mode. Borrador:{' '}
              <code className="text-xs">{PLAN_ASSIGN_RPC_STATUS.draftMigration}</code>
            </p>
            <p>
              Mientras tanto puedes alinear solo la modalidad de catálogo (sin
              cobros ni activación de piloto).
            </p>
            <div className="pt-1">
              <PendingIntegrationBadge label="RPC assign pendiente" />
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden shadow-soft">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Expectativa plan → catálogo
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Plan comercial
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  catalog_mode
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
              {PLAN_CATALOG_EXPECTATIONS.map((row) => (
                <tr
                  key={row.planCode}
                  className="border-b border-border/70 last:border-0"
                >
                  <td className="px-4 py-2.5 font-medium">{row.label}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline">{row.catalogMode}</Badge>
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
        <div className="flex gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Alinear modalidad (operación parcial)
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Usa{' '}
              {PLAN_ASSIGN_RPC_STATUS.interimRpcs.map((r) => (
                <code key={r} className="mr-1 text-[11px]">
                  {r}
                </code>
              ))}
              . No crea suscripción de pago ni convierte piloto.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="plan-pharmacy-id">UUID farmacia</Label>
            <Input
              id="plan-pharmacy-id"
              value={pharmacyId}
              onChange={(e) => setPharmacyId(e.target.value)}
              placeholder="uuid…"
              disabled={!canManage || busy}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Plan objetivo (solo guía de modalidad)</Label>
            <Select
              value={plan}
              onValueChange={(v) => setPlan(v as CommercialPlanCode)}
              disabled={!canManage || busy}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAN_CATALOG_EXPECTATIONS.map((p) => (
                  <SelectItem key={p.planCode} value={p.planCode}>
                    {p.label} → {p.catalogMode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          type="button"
          disabled={!canManage || busy || !pharmacyId.trim()}
          onClick={() => void applyCatalogModeOnly()}
        >
          Aplicar catalog_mode ({expectation?.catalogMode ?? 'generic'})
        </Button>
      </Card>
    </div>
  );
}
