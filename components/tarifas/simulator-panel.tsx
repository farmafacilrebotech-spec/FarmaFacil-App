'use client';

import * as React from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import {
  calculateQuote,
  getPlan,
  formatCentsEur,
  formatBpsPercent,
  type BillingInterval,
  type CommercialPlanId,
  type CommercialTariffConfig,
  type SaasCohortPricing,
} from '@/lib/tarifas';
import type { QuotePharmacyOption } from '@/lib/commercial/quote-types';
import { defaultValidUntilIso } from '@/lib/commercial/quote-document';
import { saveCommercialQuoteAction } from '@/app/(app)/tarifas/quote-actions';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
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
  pharmacies = [],
  canSaveQuotes = false,
  onQuoteSaved,
}: {
  config: CommercialTariffConfig;
  pharmacies?: QuotePharmacyOption[];
  canSaveQuotes?: boolean;
  onQuoteSaved?: (quoteId: string) => void;
  /** @deprecated La rentabilidad interna ya no se muestra en esta pantalla. */
  canViewInternalCosts?: boolean;
}) {
  const router = useRouter();
  const lock = React.useRef(false);
  const [pharmacyId, setPharmacyId] = React.useState<string>('none');
  const [clientName, setClientName] = React.useState('');
  const [contactName, setContactName] = React.useState('');
  const [contactEmail, setContactEmail] = React.useState('');
  const [planId, setPlanId] = React.useState<CommercialPlanId>('general');
  const [interval, setInterval] = React.useState<BillingInterval>('monthly');
  const [cohortPricing, setCohortPricing] =
    React.useState<SaasCohortPricing>('normal');
  const [kioskCount, setKioskCount] = React.useState(1);
  const [onsiteIncluded, setOnsiteIncluded] = React.useState(false);
  const [notes, setNotes] = React.useState('');
  const [validUntil, setValidUntil] = React.useState(defaultValidUntilIso());
  const [saving, setSaving] = React.useState(false);

  const plan = getPlan(config, planId);
  const isPilot = planId === 'pilot';
  const selectedPharmacy =
    pharmacyId !== 'none'
      ? pharmacies.find((p) => p.id === pharmacyId) ?? null
      : null;

  React.useEffect(() => {
    if (isPilot) {
      setKioskCount(0);
      setOnsiteIncluded(false);
      setCohortPricing('normal');
    }
  }, [isPilot]);

  React.useEffect(() => {
    if (!selectedPharmacy) return;
    setClientName(selectedPharmacy.name);
    if (selectedPharmacy.email) {
      setContactEmail((prev) => prev.trim() || selectedPharmacy.email || '');
    }
  }, [selectedPharmacy]);

  const quote = React.useMemo(
    () =>
      calculateQuote(config, {
        planId,
        interval,
        kioskCount: isPilot ? 0 : kioskCount,
        onsiteInstallIncluded: isPilot ? false : onsiteIncluded,
        cohortPricing: isPilot ? 'normal' : cohortPricing,
        includeAppSignupFee: !isPilot,
      }),
    [
      config,
      planId,
      interval,
      cohortPricing,
      kioskCount,
      isPilot,
      onsiteIncluded,
    ]
  );

  const periodLabel = interval === 'monthly' ? 'mes' : 'año';

  async function onSave() {
    if (!canSaveQuotes || lock.current || isPilot) return;
    lock.current = true;
    setSaving(true);
    try {
      const result = await saveCommercialQuoteAction({
        pharmacyId: pharmacyId === 'none' ? null : pharmacyId,
        pharmacyName: selectedPharmacy?.name ?? null,
        clientName: clientName.trim() || selectedPharmacy?.name || '',
        contactName,
        contactEmail,
        planId,
        interval,
        cohortPricing,
        kioskCount,
        onsiteInstallIncluded: onsiteIncluded,
        notes,
        validUntil,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Presupuesto ${result.referenceCode} guardado.`, {
        description: 'Revísalo en la pestaña Presupuestos.',
      });
      onQuoteSaved?.(result.quoteId);
      router.refresh();
    } finally {
      setSaving(false);
      lock.current = false;
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <Card className="space-y-5 p-5 shadow-soft">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Datos de la oferta
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Calcula en vivo y, si procede, guarda una propuesta asociada a
            farmacia y contacto.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Farmacia (opcional)</Label>
          <Select value={pharmacyId} onValueChange={setPharmacyId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar farmacia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Cliente potencial (sin farmacia)</SelectItem>
              {pharmacies.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sim-client">Nombre comercial</Label>
          <Input
            id="sim-client"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Farmacia o cliente potencial"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sim-contact">Persona de contacto</Label>
            <Input
              id="sim-contact"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Nombre y apellidos"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sim-email">Email de contacto</Label>
            <Input
              id="sim-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contacto@farmacia.es"
            />
          </div>
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
                <SelectItem value="annual">
                  Anual SaaS (−{formatBpsPercent(config.saasAnnualDiscountBps)})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Cohorte / descuento SaaS</Label>
          <Select
            value={cohortPricing}
            onValueChange={(v) => setCohortPricing(v as SaasCohortPricing)}
            disabled={isPilot}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Tarifa normal</SelectItem>
              <SelectItem value="launch_2027">
                Lanzamiento 2027 (−60 % SaaS · máx.{' '}
                {config.assumptions.launchSlots2027} plazas)
              </SelectItem>
              <SelectItem value="cohort_2027_in_2028">
                Cohorte 2027 en 2028 (−30 % SaaS)
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            El alquiler del kiosko no entra en el descuento SaaS. Prepago anual
            previsto:{' '}
            {formatBpsPercent(config.assumptions.annualPrepayAdoptionBps)}{' '}
            (tesorería sigue mensual).
          </p>
        </div>

        {isPilot && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            Piloto: 15 días · 0 € · sin kioskos físicos ni alquiler. No se
            guarda como presupuesto de contratación; actívalo solo en «Gestión
            de pilotos».
          </div>
        )}

        {config.assumptions.equivalenceSurchargeBps > 0 ? (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Recargo de equivalencia / subida de venta activo:{' '}
            {formatBpsPercent(config.assumptions.equivalenceSurchargeBps)} sobre
            precios de venta SaaS, alta y personalización. No aplica al alquiler
            ni a costes.
          </div>
        ) : null}

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
                setKioskCount(
                  Math.max(0, Math.floor(Number(e.target.value) || 0))
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Personalización kiosko (unitario)</Label>
            <Input
              disabled
              value={formatCentsEur(config.kioskHardwareUnitCents)}
              readOnly
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sim-onsite">Instalación presencial</Label>
            <Select
              value={onsiteIncluded ? 'included' : 'excluded'}
              onValueChange={(v) => setOnsiteIncluded(v === 'included')}
              disabled={isPilot}
            >
              <SelectTrigger id="sim-onsite">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excluded">No incluida</SelectItem>
                <SelectItem value="included">Incluida</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Extra contractual sin importe: no modifica precios, IVA ni cuotas.
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sim-valid">Vigencia de la oferta</Label>
            <Input
              id="sim-valid"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              disabled={isPilot}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sim-notes">Notas del presupuesto</Label>
          <Textarea
            id="sim-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observaciones comerciales (se guardan con la propuesta)"
            rows={3}
          />
        </div>

        <Button
          type="button"
          className="w-full gap-1.5 sm:w-auto"
          disabled={!canSaveQuotes || saving || isPilot}
          onClick={() => void onSave()}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar propuesta
        </Button>
        {!canSaveQuotes ? (
          <p className="text-[11px] text-muted-foreground">
            Necesitas permiso platform.commercial_quotes.manage para guardar.
          </p>
        ) : null}
      </Card>

      <div className="space-y-4">
        <Card className="p-5 shadow-soft">
          <h3 className="text-sm font-semibold text-foreground">Pago único</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <Row
              label="Alta de la aplicación (pago único)"
              value={formatCentsEur(quote.appSignupFeeCents)}
            />
            <Row
              label="Personalización kiosko"
              value={formatCentsEur(quote.hardwareCents)}
            />
            <Row
              label="Instalación presencial"
              value={quote.onsiteInstallIncluded ? 'Incluida' : 'No incluida'}
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
              label={`Plan ${plan.name} (SaaS)`}
              value={formatCentsEur(quote.planRecurringCents)}
            />
            <Row
              label={`Alquiler kiosko (${quote.kioskCount})`}
              value={formatCentsEur(quote.kioskLicenseRecurringCents)}
            />
            <Row
              label="Cuota neta sin IVA"
              value={formatCentsEur(quote.recurringNetCents)}
              strong
            />
            <Row
              label="IVA cuota"
              value={formatCentsEur(quote.recurringVatCents)}
            />
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
            <p className="mt-1 text-xs text-muted-foreground">
              {clientName.trim()}
              {contactName.trim() ? ` · ${contactName.trim()}` : ''}
            </p>
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
            <Row
              label="IVA año 1"
              value={formatCentsEur(quote.firstYearVatCents)}
            />
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
          <p className="mt-3 text-[11px] text-muted-foreground">
            El alta de la aplicación forma parte del pago inicial / año 1 y no
            se incluye en las cuotas de años posteriores. Vigencia de oferta:{' '}
            {validUntil || '—'}.
          </p>
        </Card>
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
