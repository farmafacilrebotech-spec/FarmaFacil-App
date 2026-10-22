'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save } from 'lucide-react';

import type {
  CommercialOnboardingPlan,
  CreatePharmacyInput,
} from '@/lib/pharmacies/types';
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
} from '@/lib/pharmacies/labels';
import { listOnboardingModalities } from '@/lib/commercial/pharmacy-onboarding';
import { createPharmacyAction } from '@/app/(app)/farmacias/actions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Step = 1 | 2 | 3;

const MODALITIES = listOnboardingModalities();

export function NewPharmacyForm() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>(1);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [legalName, setLegalName] = React.useState('');
  const [cif, setCif] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [web, setWeb] = React.useState('');
  const [addressLine, setAddressLine] = React.useState('');
  const [postalCode, setPostalCode] = React.useState('');
  const [city, setCity] = React.useState('');
  const [province, setProvince] = React.useState('');
  const [country, setCountry] = React.useState('ES');

  const [commercialPlan, setCommercialPlan] =
    React.useState<CommercialOnboardingPlan>('piloto');

  const [visibleName, setVisibleName] = React.useState('');
  const [primaryColor, setPrimaryColor] = React.useState(DEFAULT_PRIMARY_COLOR);
  const [secondaryColor, setSecondaryColor] = React.useState(
    DEFAULT_SECONDARY_COLOR
  );
  const [welcomeMessage, setWelcomeMessage] = React.useState('');
  const [schedule, setSchedule] = React.useState('');
  const [whatsapp, setWhatsapp] = React.useState('');

  const selectedModality = MODALITIES.find((m) => m.planCode === commercialPlan);

  function canAdvance(): boolean {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) {
      return Boolean(commercialPlan) && selectedModality?.creatable === true;
    }
    return true;
  }

  async function onSubmit() {
    if (!commercialPlan || submitting) return;
    if (!selectedModality?.creatable) {
      setError(
        'Esta modalidad aún no se puede dar de alta. Elige Piloto o espera la asignación de plan (056).'
      );
      return;
    }
    setError(null);
    setSubmitting(true);

    const payload: CreatePharmacyInput = {
      name: name.trim(),
      commercial_plan: commercialPlan,
      legal_name: legalName.trim() || undefined,
      cif: cif.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      web: web.trim() || undefined,
      address_line: addressLine.trim() || undefined,
      postal_code: postalCode.trim() || undefined,
      city: city.trim() || undefined,
      province: province.trim() || undefined,
      country: country.trim() || 'ES',
      primary_color: primaryColor.trim() || undefined,
      secondary_color: secondaryColor.trim() || undefined,
      welcome_message: welcomeMessage.trim() || undefined,
      visible_name: visibleName.trim() || undefined,
      schedule: schedule.trim() || undefined,
      whatsapp: whatsapp.trim() || undefined,
      settings_phone: phone.trim() || undefined,
      settings_email: email.trim() || undefined,
      logo_color: primaryColor.trim() || undefined,
    };

    try {
      const result = await createPharmacyAction(payload);
      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      router.push(`/farmacias/${result.pharmacyId}`);
      router.refresh();
    } catch {
      setError('No se ha podido crear la farmacia. Inténtalo de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/farmacias"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Farmacias
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Nueva farmacia
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alta comercial: Piloto prepara 15 días sin iniciar el reloj. Catálogo
          genérico (100) y QR listos; la activación exige readiness.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 1, label: 'Datos' },
            { id: 2, label: 'Modalidad' },
            { id: 3, label: 'Personalización' },
          ] as const
        ).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              step === s.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {s.id}. {s.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre comercial *" className="sm:col-span-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Farmacia Centro"
              />
            </Field>
            <Field label="Razón social">
              <Input
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Farmacia Centro S.L."
              />
            </Field>
            <Field label="CIF / NIF">
              <Input
                value={cif}
                onChange={(e) => setCif(e.target.value)}
                placeholder="B12345678"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="info@farmacia.es"
              />
            </Field>
            <Field label="Teléfono">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 900 000 000"
              />
            </Field>
            <Field label="Web" className="sm:col-span-2">
              <Input
                value={web}
                onChange={(e) => setWeb(e.target.value)}
                placeholder="https://..."
              />
            </Field>
            <Field label="Dirección" className="sm:col-span-2">
              <Input
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="Calle Mayor 1"
              />
            </Field>
            <Field label="Código postal">
              <Input
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="28001"
              />
            </Field>
            <Field label="Ciudad">
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Madrid"
              />
            </Field>
            <Field label="Provincia">
              <Input
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder="Madrid"
              />
            </Field>
            <Field label="País">
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="ES"
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Modalidad comercial. Solo <strong>Piloto</strong> está disponible
              para alta hoy (preparación sin reloj). General, Personalizado e IA
              personalizado requieren la asignación de plan (migración 056, no
              aplicada).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {MODALITIES.map((modality) => {
                const selected = commercialPlan === modality.planCode;
                return (
                  <button
                    key={modality.planCode}
                    type="button"
                    disabled={!modality.creatable}
                    onClick={() => {
                      if (modality.creatable) {
                        setCommercialPlan(modality.planCode);
                      }
                    }}
                    className={cn(
                      'rounded-xl border p-4 text-left transition-colors',
                      !modality.creatable && 'cursor-not-allowed opacity-60',
                      selected && modality.creatable
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-foreground">
                        {modality.label}
                      </p>
                      {!modality.creatable ? (
                        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Próximamente
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                          Disponible
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {modality.summary}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              Tras crear: invita al propietario → reenvía el email si hace falta
              → primer acceso con contraseña → membership active → checklist de
              readiness → «Activar piloto» (15 días) en Tarifas.
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre visible" className="sm:col-span-2">
              <Input
                value={visibleName}
                onChange={(e) => setVisibleName(e.target.value)}
                placeholder={name || 'Nombre en kiosco / app'}
              />
            </Field>
            <Field label="Color primario">
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer p-1"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#2EC4C7"
                />
              </div>
            </Field>
            <Field label="Color secundario">
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer p-1"
                />
                <Input
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  placeholder="#0EA5E9"
                />
              </div>
            </Field>
            <Field label="Mensaje de bienvenida" className="sm:col-span-2">
              <Textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                rows={3}
                placeholder="¡Bienvenido a nuestra farmacia!"
              />
            </Field>
            <Field label="Horario" className="sm:col-span-2">
              <Input
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="L-V 9:00-21:30 · S 9:30-14:00"
              />
            </Field>
            <Field label="WhatsApp" className="sm:col-span-2">
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+34 600 000 000"
              />
            </Field>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={step === 1 || submitting}
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          >
            Anterior
          </Button>
          <div className="flex gap-2">
            {step < 3 ? (
              <Button
                type="button"
                disabled={!canAdvance()}
                onClick={() => setStep((s) => (s < 3 ? ((s + 1) as Step) : s))}
              >
                Siguiente
              </Button>
            ) : (
              <Button
                type="button"
                disabled={!canAdvance() || submitting}
                onClick={() => void onSubmit()}
                className="gap-1.5"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {submitting ? 'Preparando…' : 'Preparar farmacia piloto'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
