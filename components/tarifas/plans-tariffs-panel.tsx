'use client';

import * as React from 'react';
import { Check, Minus, Info } from 'lucide-react';

import {
  FEATURE_COMPARISON_ROWS,
  INTERNAL_PLAN_KEYS_UNMAPPED,
  planAnnualCents,
  formatBpsPercent,
  formatCentsEur,
  type CommercialPlanId,
  type CommercialTariffConfig,
} from '@/lib/tarifas';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PLAN_ORDER: CommercialPlanId[] = [
  'pilot',
  'general',
  'personalized',
  'ai_personalized',
];

function FeatureValue({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="mx-auto h-4 w-4 text-primary" aria-label="Sí" />
    ) : (
      <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" aria-label="No" />
    );
  }
  return <span className="text-sm font-medium text-foreground">{value}</span>;
}

export function PlansTariffsPanel({
  config,
  onChange,
  canViewInternalCosts = false,
}: {
  config: CommercialTariffConfig;
  onChange: (next: CommercialTariffConfig) => void;
  /** Costes internos: solo SuperAdmin con commercial_tariffs.write */
  canViewInternalCosts?: boolean;
}) {
  const plansById = React.useMemo(() => {
    const map = new Map(config.plans.map((p) => [p.id, p]));
    return map;
  }, [config.plans]);

  function updateGlobal(
    patch: Partial<
      Pick<
        CommercialTariffConfig,
        | 'vatBps'
        | 'saasAnnualDiscountBps'
        | 'kioskLicenseAnnualDiscountBps'
        | 'kioskHardwareUnitCents'
        | 'kioskLicenseMonthlyCents'
        | 'kioskInternalCostCents'
      >
    >
  ) {
    const next = { ...config, ...patch };
    if (!canViewInternalCosts) {
      next.kioskInternalCostCents = null;
    }
    onChange(next);
  }

  function updatePlanMonthly(id: CommercialPlanId, euros: number) {
    onChange({
      ...config,
      plans: config.plans.map((p) =>
        p.id === id
          ? {
              ...p,
              monthlyCents: Math.max(0, Math.round(euros * 100)),
            }
          : p
      ),
    });
  }

  return (
    <div className="space-y-6">
      <Card className="border-dashed border-primary/30 bg-primary/5 p-4">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Configuración comercial provisional (solo sesión)
            </p>
            <p>
              Los cambios no se guardan en base de datos. No afectan a
              suscripciones ni a las claves internas{' '}
              <span className="font-mono text-xs">
                {INTERNAL_PLAN_KEYS_UNMAPPED.join(', ')}
              </span>
              .
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLAN_ORDER.map((id) => {
          const plan = plansById.get(id);
          if (!plan) return null;
          const annual = planAnnualCents(config, id);
          return (
            <Card
              key={id}
              className={cn(
                'flex flex-col gap-3 p-5 shadow-soft',
                id === 'ai_personalized' && 'ring-1 ring-primary/30'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {plan.tagline}
                  </p>
                </div>
                <Badge variant={plan.active ? 'default' : 'secondary'}>
                  {plan.active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  {plan.monthlyCents === 0
                    ? 'Gratis'
                    : formatCentsEur(plan.monthlyCents)}
                  {plan.monthlyCents > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      /mes
                    </span>
                  )}
                </p>
                {plan.monthlyCents > 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Anual: {formatCentsEur(annual)}{' '}
                    <span className="text-xs">
                      (−{formatBpsPercent(config.saasAnnualDiscountBps)})
                    </span>
                  </p>
                )}
                {plan.trialDays != null && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {plan.trialDays} días · ampliación +{plan.extensionDays}{' '}
                    días (1 vez)
                  </p>
                )}
              </div>
              {id !== 'pilot' && (
                <div className="space-y-1.5 border-t border-border pt-3">
                  <Label htmlFor={`price-${id}`} className="text-xs">
                    Precio mensual sin IVA (€)
                  </Label>
                  <Input
                    id={`price-${id}`}
                    type="number"
                    min={0}
                    step={0.01}
                    value={(plan.monthlyCents / 100).toFixed(2)}
                    onChange={(e) =>
                      updatePlanMonthly(id, Number(e.target.value) || 0)
                    }
                  />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="p-5 shadow-soft">
        <h3 className="text-sm font-semibold text-foreground">
          Parámetros globales (provisional)
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="IVA (%)"
            value={config.vatBps / 100}
            onChange={(v) =>
              updateGlobal({ vatBps: Math.round(v * 100) })
            }
          />
          <Field
            label="Dto. anual planes (%)"
            value={config.saasAnnualDiscountBps / 100}
            onChange={(v) =>
              updateGlobal({
                saasAnnualDiscountBps: Math.round(v * 100),
              })
            }
          />
          <Field
            label="Dto. anual licencia kiosko (%)"
            value={config.kioskLicenseAnnualDiscountBps / 100}
            onChange={(v) =>
              updateGlobal({
                kioskLicenseAnnualDiscountBps: Math.round(v * 100),
              })
            }
          />
          <Field
            label="Hardware kiosko (€)"
            value={config.kioskHardwareUnitCents / 100}
            onChange={(v) =>
              updateGlobal({
                kioskHardwareUnitCents: Math.round(v * 100),
              })
            }
          />
          <Field
            label="Licencia kiosko / mes (€)"
            value={config.kioskLicenseMonthlyCents / 100}
            onChange={(v) =>
              updateGlobal({
                kioskLicenseMonthlyCents: Math.round(v * 100),
              })
            }
          />
          {canViewInternalCosts && config.kioskInternalCostCents != null ? (
            <Field
              label="Coste interno hardware (€)"
              value={config.kioskInternalCostCents / 100}
              onChange={(v) =>
                updateGlobal({
                  kioskInternalCostCents: Math.round(v * 100),
                })
              }
            />
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Coste interno hardware (€)</Label>
              <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                No incluido en datos de servidor sin
                platform.commercial_tariffs.write (RPC 052).
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden shadow-soft">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Comparativa de funcionalidades
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Descripción comercial. No activa módulos en la plataforma.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Funcionalidad
                </th>
                {PLAN_ORDER.map((id) => (
                  <th
                    key={id}
                    className="px-3 py-3 text-center font-medium text-foreground"
                  >
                    {plansById.get(id)?.name ?? id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_COMPARISON_ROWS.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-border/70 last:border-0"
                >
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {row.label}
                  </td>
                  {PLAN_ORDER.map((id) => (
                    <td key={id} className="px-3 py-2.5 text-center">
                      <FeatureValue value={row.values[id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={0}
        step={0.01}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}
