'use client';

import * as React from 'react';

import {
  calculateQuote,
  getPlan,
  formatCentsEur,
  type BillingInterval,
  type CommercialPlanId,
  type CommercialTariffConfig,
} from '@/lib/tarifas';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export function SimulatorPanel({
  config,
  canViewInternalCosts = false,
}: {
  config: CommercialTariffConfig;
  canViewInternalCosts?: boolean;
}) {
  const [clientName, setClientName] = React.useState('');
  const [planId, setPlanId] = React.useState<CommercialPlanId>('general');
  const [interval, setInterval] = React.useState<BillingInterval>('monthly');
  const [kioskCount, setKioskCount] = React.useState(1);
  const [onsiteEuros, setOnsiteEuros] = React.useState(0);
  const [extraEuros, setExtraEuros] = React.useState(0);
  const [oneTimeDiscountEuros, setOneTimeDiscountEuros] = React.useState(0);
  const [recurringDiscountEuros, setRecurringDiscountEuros] =
    React.useState(0);
  const [notes, setNotes] = React.useState('');

  const plan = getPlan(config, planId);
  const isPilot = planId === 'pilot';

  React.useEffect(() => {
    if (isPilot) {
      setKioskCount(0);
      setOnsiteEuros(0);
      setExtraEuros(0);
      setOneTimeDiscountEuros(0);
      setRecurringDiscountEuros(0);
    }
  }, [isPilot]);

  const quote = React.useMemo(
    () =>
      calculateQuote(config, {
        planId,
        interval,
        kioskCount: isPilot ? 0 : kioskCount,
        onsiteInstallCents: Math.round(onsiteEuros * 100),
        additionalServicesCents: Math.round(extraEuros * 100),
        oneTimeDiscountCents: Math.round(oneTimeDiscountEuros * 100),
        recurringExtraDiscountCents: Math.round(recurringDiscountEuros * 100),
      }),
    [
      config,
      planId,
      interval,
      kioskCount,
      isPilot,
      onsiteEuros,
      extraEuros,
      oneTimeDiscountEuros,
      recurringDiscountEuros,
    ]
  );

  const periodLabel = interval === 'monthly' ? 'mes' : 'año';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <Card className="space-y-5 p-5 shadow-soft">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Datos de la oferta
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Cálculo en memoria. No se guarda ni se factura.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sim-client">Farmacia o cliente potencial</Label>
          <Input
            id="sim-client"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Nombre comercial (opcional)"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select
              value={planId}
              onValueChange={(v) => setPlanId(v as CommercialPlanId)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Facturación</Label>
            <Select
              value={interval}
              onValueChange={(v) => setInterval(v as BillingInterval)}
              disabled={isPilot}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensual</SelectItem>
                <SelectItem value="annual">Anual (−dto.)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isPilot && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            Piloto: 15 días · 0 € · sin kioskos físicos ni licencias. La
            ampliación de +15 días se gestiona en «Gestión de pilotos», no
            como descuento.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sim-kiosks">N.º de kioskos</Label>
            <Input
              id="sim-kiosks"
              type="number"
              min={0}
              step={1}
              disabled={isPilot}
              value={isPilot ? 0 : kioskCount}
              onChange={(e) =>
                setKioskCount(Math.max(0, Math.floor(Number(e.target.value) || 0)))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Hardware unitario</Label>
            <Input
              disabled
              value={formatCentsEur(config.kioskHardwareUnitCents)}
              readOnly
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sim-onsite">Instalación presencial (€)</Label>
            <Input
              id="sim-onsite"
              type="number"
              min={0}
              step={0.01}
              disabled={isPilot}
              value={onsiteEuros}
              onChange={(e) => setOnsiteEuros(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sim-extra">Otros servicios (€)</Label>
            <Input
              id="sim-extra"
              type="number"
              min={0}
              step={0.01}
              disabled={isPilot}
              value={extraEuros}
              onChange={(e) => setExtraEuros(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sim-ot-disc">Dto. puntual pago único (€)</Label>
            <Input
              id="sim-ot-disc"
              type="number"
              min={0}
              step={0.01}
              disabled={isPilot}
              value={oneTimeDiscountEuros}
              onChange={(e) =>
                setOneTimeDiscountEuros(Number(e.target.value) || 0)
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sim-rec-disc">
              Dto. extraordinario cuota (€/{periodLabel})
            </Label>
            <Input
              id="sim-rec-disc"
              type="number"
              min={0}
              step={0.01}
              disabled={isPilot}
              value={recurringDiscountEuros}
              onChange={(e) =>
                setRecurringDiscountEuros(Number(e.target.value) || 0)
              }
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sim-notes">Notas del presupuesto</Label>
          <Textarea
            id="sim-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observaciones comerciales (no se persisten en Fase 2)"
            rows={3}
          />
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="p-5 shadow-soft">
          <h3 className="text-sm font-semibold text-foreground">Pago único</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Hardware" value={formatCentsEur(quote.hardwareCents)} />
            <Row
              label="Instalación presencial"
              value={formatCentsEur(quote.onsiteInstallCents)}
            />
            <Row
              label="Servicios adicionales"
              value={formatCentsEur(quote.additionalServicesCents)}
            />
            <Row
              label="Descuentos puntuales"
              value={`−${formatCentsEur(quote.oneTimeDiscountCents)}`}
            />
            <Row
              label="Neto sin IVA"
              value={formatCentsEur(quote.oneTimeNetCents)}
              strong
            />
            <Row label="IVA" value={formatCentsEur(quote.oneTimeVatCents)} />
            <Row
              label="Total con IVA"
              value={formatCentsEur(quote.oneTimeGrossCents)}
              strong
            />
          </dl>
        </Card>

        <Card className="p-5 shadow-soft">
          <h3 className="text-sm font-semibold text-foreground">
            Suscripción ({periodLabel})
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <Row
              label={`Plan ${plan.name}`}
              value={formatCentsEur(quote.planRecurringCents)}
            />
            <Row
              label={`Licencias kiosko (${quote.kioskCount})`}
              value={formatCentsEur(quote.kioskLicenseRecurringCents)}
            />
            <Row
              label="Dto. extraordinario"
              value={`−${formatCentsEur(quote.recurringExtraDiscountCents)}`}
            />
            <Row
              label="Cuota neta sin IVA"
              value={formatCentsEur(quote.recurringNetCents)}
              strong
            />
            <Row label="IVA cuota" value={formatCentsEur(quote.recurringVatCents)} />
            <Row
              label="Cuota con IVA"
              value={formatCentsEur(quote.recurringGrossCents)}
              strong
            />
          </dl>
        </Card>

        <Card className="border-primary/20 bg-primary/5 p-5 shadow-soft">
          <h3 className="text-sm font-semibold text-foreground">
            Resumen primer año
          </h3>
          {clientName.trim() ? (
            <p className="mt-1 text-xs text-muted-foreground">{clientName.trim()}</p>
          ) : null}
          <dl className="mt-3 space-y-2 text-sm">
            <Row
              label="Pago inicial sin IVA"
              value={formatCentsEur(quote.oneTimeNetCents)}
            />
            <Row
              label="Suscripciones año 1 sin IVA"
              value={formatCentsEur(quote.firstYearSubscriptionCents)}
            />
            <Row
              label="Total año 1 sin IVA"
              value={formatCentsEur(quote.firstYearNetCents)}
              strong
            />
            <Row label="IVA año 1" value={formatCentsEur(quote.firstYearVatCents)} />
            <Row
              label="Total año 1 con IVA"
              value={formatCentsEur(quote.firstYearGrossCents)}
              strong
              highlight
            />
            <Row
              label="Recurrente años posteriores (sin IVA)"
              value={formatCentsEur(quote.laterYearsRecurringNetCents)}
            />
          </dl>
        </Card>

        {canViewInternalCosts && config.kioskInternalCostCents != null ? (
          <Card className="border-border/80 bg-muted/30 p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Rentabilidad hardware (interno)
              </h3>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Solo SuperAdmin · no comercial
              </span>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <Row
                label="Precio de venta"
                value={formatCentsEur(quote.hardwareSaleCents)}
              />
              <Row
                label="Coste estimado"
                value={formatCentsEur(quote.hardwareCostCents)}
              />
              <Row
                label="Beneficio bruto"
                value={formatCentsEur(quote.hardwareProfitCents)}
                strong
              />
              <Row
                label="Margen bruto"
                value={
                  quote.hardwareMarginPercent == null
                    ? '—'
                    : `${quote.hardwareMarginPercent.toLocaleString('es-ES', {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                      })} %`
                }
                strong
              />
            </dl>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  highlight,
}: {
  label: string;
  value: string;
  strong?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'tabular-nums text-foreground',
          strong && 'font-semibold',
          highlight && 'text-base text-primary'
        )}
      >
        {value}
      </dd>
    </div>
  );
}
