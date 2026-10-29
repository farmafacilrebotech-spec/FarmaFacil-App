'use client';

import * as React from 'react';
import { Check, Minus, Info } from 'lucide-react';

import {
  FEATURE_COMPARISON_ROWS,
  INTERNAL_PLAN_KEYS_UNMAPPED,
  planAnnualCents,
  planAnnualReferenceCents,
  saasMonthlySaleCents,
  formatBpsPercent,
  formatCentsEur,
  formatCentsEurWhole,
  type CommercialPlanId,
  type CommercialTariffConfig,
  type SaasCohortPricing,
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

const PAID_PLANS: CommercialPlanId[] = [
  'general',
  'personalized',
  'ai_personalized',
];

const COHORT_COLUMNS: Array<{ key: SaasCohortPricing; label: string }> = [
  { key: 'normal', label: 'Normal' },
  { key: 'launch_2027', label: 'Cohorte 2027 en 2027 (−60 %)' },
  { key: 'cohort_2027_in_2028', label: 'Cohorte 2027 en 2028 (−30 %)' },
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

  const assumptions = config.assumptions;

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

  function updateAssumptions(
    patch: Partial<CommercialTariffConfig['assumptions']>
  ) {
    onChange({
      ...config,
      assumptions: { ...config.assumptions, ...patch },
    });
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
          const annualRef = planAnnualReferenceCents(config, id);
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
                    : formatCentsEur(saasMonthlySaleCents(config, id))}
                  {plan.monthlyCents > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      /mes
                    </span>
                  )}
                </p>
                {plan.monthlyCents > 0 && (
                  <>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Anual exacto: {formatCentsEur(annual)}{' '}
                      <span className="text-xs">
                        (−{formatBpsPercent(config.saasAnnualDiscountBps)} SaaS)
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Referencia prepago (−15 %, redondeo al €):{' '}
                      {formatCentsEurWhole(annualRef)}
                    </p>
                  </>
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
                    Tarifa base mensual sin IVA (€)
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
          Cuotas SaaS por cohorte (sin alquiler de kiosko)
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          El descuento de lanzamiento 2027 no se aplica a altas de otros años.
          Tope: {assumptions.launchSlots2027} plazas · previsión 2027:{' '}
          {assumptions.forecastSignups2027} altas (dato independiente).
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-3 py-2 font-medium text-muted-foreground">
                  Plan
                </th>
                {COHORT_COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className="px-3 py-2 text-right font-medium text-foreground"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PAID_PLANS.map((id) => (
                <tr key={id} className="border-b border-border/70 last:border-0">
                  <td className="px-3 py-2.5 text-foreground">
                    {plansById.get(id)?.name ?? id}
                    {id === 'ai_personalized' ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Misma cuota SaaS con o sin kiosko; alquiler aparte
                      </span>
                    ) : null}
                  </td>
                  {COHORT_COLUMNS.map((c) => (
                    <td
                      key={c.key}
                      className="px-3 py-2.5 text-right tabular-nums"
                    >
                      {formatCentsEur(saasMonthlySaleCents(config, id, c.key))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5 shadow-soft">
        <h3 className="text-sm font-semibold text-foreground">
          Parámetros globales (provisional)
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="IVA (%)"
            value={config.vatBps / 100}
            onChange={(v) => updateGlobal({ vatBps: Math.round(v * 100) })}
          />
          <Field
            label="Dto. anual planes SaaS (%)"
            value={config.saasAnnualDiscountBps / 100}
            onChange={(v) =>
              updateGlobal({
                saasAnnualDiscountBps: Math.round(v * 100),
              })
            }
          />
          <Field
            label="Recargo equivalencia / subida venta (%)"
            value={assumptions.equivalenceSurchargeBps / 100}
            onChange={(v) =>
              updateAssumptions({
                equivalenceSurchargeBps: Math.max(0, Math.round(v * 100)),
              })
            }
            hint="Editable. 0 % por defecto; 4 % si se confirma. No altera tarifas base, costes ni alquiler."
          />
          <Field
            label="Personalización kiosko (€)"
            value={config.kioskHardwareUnitCents / 100}
            onChange={(v) =>
              updateGlobal({
                kioskHardwareUnitCents: Math.round(v * 100),
              })
            }
          />
          <Field
            label="Alquiler kiosko / mes (€)"
            value={config.kioskLicenseMonthlyCents / 100}
            onChange={(v) =>
              updateGlobal({
                kioskLicenseMonthlyCents: Math.round(v * 100),
              })
            }
            hint="Fuera del descuento SaaS y del prepago anual."
          />
          <Field
            label="Alta de aplicación (€)"
            value={assumptions.appSignupFeeCents / 100}
            onChange={(v) =>
              updateAssumptions({
                appSignupFeeCents: Math.round(v * 100),
              })
            }
          />
          {canViewInternalCosts && config.kioskInternalCostCents != null ? (
            <Field
              label="Coste interno kiosko (€)"
              value={config.kioskInternalCostCents / 100}
              onChange={(v) =>
                updateGlobal({
                  kioskInternalCostCents: Math.round(v * 100),
                })
              }
            />
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Coste interno kiosko (€)</Label>
              <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                No incluido en datos de servidor sin
                platform.commercial_tariffs.write (RPC 052).
              </p>
            </div>
          )}
          <Field
            label="Seguro por kiosko (€/año)"
            value={assumptions.kioskInsuranceAnnualCents / 100}
            onChange={(v) =>
              updateAssumptions({
                kioskInsuranceAnnualCents: Math.round(v * 100),
              })
            }
          />
          <Field
            label="Adopción prepago anual (%)"
            value={assumptions.annualPrepayAdoptionBps / 100}
            onChange={(v) =>
              updateAssumptions({
                annualPrepayAdoptionBps: Math.max(0, Math.round(v * 100)),
              })
            }
            hint="0 % hasta validarlo. Tesorería sigue en cobros mensuales."
          />
          <Field
            label="Churn mensual (%)"
            value={assumptions.monthlyChurnBps / 100}
            onChange={(v) =>
              updateAssumptions({
                monthlyChurnBps: Math.max(0, Math.round(v * 100)),
              })
            }
            hint={`Equivalente anual aproximado: ${formatBpsPercent(assumptions.approximateAnnualChurnBps)}.`}
          />
        </div>
      </Card>

      <Card className="p-5 shadow-soft">
        <h3 className="text-sm font-semibold text-foreground">
          Aprovisionamiento de kioskos (cantidades)
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Valores en unidades o meses — no son porcentajes.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <UnitField
            label="Inventario inicial"
            value={assumptions.initialKioskInventoryUnits}
            suffix="unidades"
            onChange={(v) =>
              updateAssumptions({
                initialKioskInventoryUnits: Math.max(0, Math.floor(v)),
              })
            }
          />
          <UnitField
            label="Lote de compra posterior"
            value={assumptions.kioskPurchaseBatchUnits}
            suffix="unidades"
            onChange={(v) =>
              updateAssumptions({
                kioskPurchaseBatchUnits: Math.max(0, Math.floor(v)),
              })
            }
          />
          <UnitField
            label="Plazo de entrega"
            value={assumptions.kioskDeliveryMonths}
            suffix="meses"
            onChange={(v) =>
              updateAssumptions({
                kioskDeliveryMonths: Math.max(0, Math.floor(v)),
              })
            }
          />
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {assumptions.kioskProvisioningHypotheses.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
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
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
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
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function UnitField({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          step={1}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
        <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}
