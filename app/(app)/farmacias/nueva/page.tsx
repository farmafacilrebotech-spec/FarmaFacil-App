'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  UserCircle,
  FileText,
  CreditCard,
  Palette,
  ClipboardCheck,
  CheckCircle2,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Save,
  Upload,
  Info,
  Eye,
  RefreshCw,
  Store,
  ExternalLink,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QrCode } from '@/components/shared/qr-code';

/* ------------------------------------------------------------------ */
/*  Step definitions                                                  */
/* ------------------------------------------------------------------ */

const steps = [
  { id: 1, label: 'Datos de la farmacia', icon: Building2, short: 'Empresa' },
  { id: 2, label: 'Responsable y acceso', icon: UserCircle, short: 'Responsable' },
  { id: 3, label: 'Contrato y plan', icon: FileText, short: 'Contrato' },
  { id: 4, label: 'Forma de pago', icon: CreditCard, short: 'Pago' },
  { id: 5, label: 'Personalización', icon: Palette, short: 'Diseño' },
  { id: 6, label: 'Revisión y alta', icon: ClipboardCheck, short: 'Revisión' },
] as const;

/* ------------------------------------------------------------------ */
/*  Form state                                                        */
/* ------------------------------------------------------------------ */

interface FormData {
  // Step 1
  name: string;
  legalName: string;
  cif: string;
  address: string;
  postalCode: string;
  city: string;
  province: string;
  phone: string;
  email: string;
  web: string;
  // Step 2
  adminName: string;
  adminLastName: string;
  adminRole: string;
  adminEmail: string;
  adminPhone: string;
  sendInvite: boolean;
  // Step 3
  plan: string;
  contractModality: string;
  startDate: string;
  duration: string;
  renewalDate: string;
  contractStatus: string;
  generateFromTemplate: boolean;
  // Step 4
  paymentMethod: string;
  paymentFrequency: string;
  paymentAmount: string;
  paymentDay: string;
  billingName: string;
  billingCif: string;
  billingAddress: string;
  iban: string;
  paymentNotes: string;
  // Step 5
  primaryColor: string;
  secondaryColor: string;
  visibleName: string;
  welcomeMessage: string;
  customPhone: string;
  whatsapp: string;
  schedule: string;
  publicUrl: string;
}

const initial: FormData = {
  name: '',
  legalName: '',
  cif: '',
  address: '',
  postalCode: '',
  city: '',
  province: '',
  phone: '',
  email: '',
  web: '',
  adminName: '',
  adminLastName: '',
  adminRole: 'Administrador de farmacia',
  adminEmail: '',
  adminPhone: '',
  sendInvite: true,
  plan: 'professional',
  contractModality: 'annual',
  startDate: '',
  duration: '12',
  renewalDate: '',
  contractStatus: 'draft',
  generateFromTemplate: true,
  paymentMethod: 'sepa',
  paymentFrequency: 'monthly',
  paymentAmount: '',
  paymentDay: '1',
  billingName: '',
  billingCif: '',
  billingAddress: '',
  iban: '',
  paymentNotes: '',
  primaryColor: '#2EC4C7',
  secondaryColor: '#0EA5E9',
  visibleName: '',
  welcomeMessage: '',
  customPhone: '',
  whatsapp: '',
  schedule: 'L-V 9:00-21:30 · S 9:30-14:00',
  publicUrl: '',
};

/* ------------------------------------------------------------------ */
/*  Plan / contract / payment options                                 */
/* ------------------------------------------------------------------ */

const planOptions = [
  { value: 'essential', label: 'Essential', desc: '1 farmacia · 500 clientes · soporte email' },
  { value: 'professional', label: 'Professional', desc: '1 farmacia · 2.000 clientes · soporte prioritario' },
  { value: 'premium', label: 'Premium', desc: '3 farmacias · 10.000 clientes · API + integraciones' },
  { value: 'custom', label: 'Personalizado', desc: 'Ilimitado · contrato a medida' },
];

const contractStatusOptions = [
  { value: 'draft', label: 'Borrador' },
  { value: 'pending', label: 'Pendiente de envío' },
  { value: 'sent', label: 'Enviado' },
  { value: 'signed', label: 'Firmado' },
];

const paymentMethodOptions = [
  { value: 'sepa', label: 'Domiciliación bancaria' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'other', label: 'Otra' },
];

const paymentFrequencyOptions = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'annual', label: 'Anual' },
];

/* ------------------------------------------------------------------ */
/*  Validation                                                        */
/* ------------------------------------------------------------------ */

function isStepValid(step: number, d: FormData): boolean {
  switch (step) {
    case 1:
      return !!(d.name && d.cif && d.address && d.postalCode && d.city && d.province && d.phone && d.email);
    case 2:
      return !!(d.adminName && d.adminLastName && d.adminEmail && d.adminPhone);
    case 3:
      return !!(d.plan && d.contractModality && d.startDate && d.duration && d.contractStatus);
    case 4:
      return !!(d.paymentMethod && d.paymentFrequency && d.paymentAmount && d.paymentDay && d.billingName && d.billingCif);
    case 5:
      return !!(d.primaryColor && d.visibleName && d.schedule);
    case 6:
      return true;
    default:
      return true;
  }
}

/* ------------------------------------------------------------------ */
/*  Shared field components                                           */
/* ------------------------------------------------------------------ */

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p className="text-sm text-foreground">{children}</p>
    </div>
  );
}

function SimulatedBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/5 px-4 py-2.5">
      <Info className="h-4 w-4 shrink-0 text-warning" />
      <p className="text-xs text-muted-foreground">
        Estos datos son simulados. No se realizará ningún cobro real.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page component                                               */
/* ------------------------------------------------------------------ */

export default function NewPharmacyPage() {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [data, setData] = React.useState<FormData>(initial);
  const [confirmed, setConfirmed] = React.useState(false);
  const [simulatedId] = React.useState(
    () => 'FF-' + Math.random().toString(36).slice(2, 7).toUpperCase()
  );

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const canAdvance = isStepValid(step, data);
  const currentStep = steps.find((s) => s.id === step)!;

  function next() {
    if (step < 6) setStep((s) => s + 1);
  }
  function back() {
    if (step > 1) setStep((s) => s - 1);
  }
  function goToStep(n: number) {
    setStep(n);
  }

  /* ------------------------------------------------------------ */
  /*  Confirmation screen                                         */
  /* ------------------------------------------------------------ */

  if (confirmed) {
    return <ConfirmationScreen data={data} id={simulatedId} />;
  }

  /* ------------------------------------------------------------ */
  /*  Wizard layout                                               */
  /* ------------------------------------------------------------ */

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/farmacias"
          className="mb-3 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Farmacias
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Nueva farmacia
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Asistente guiado de alta. Completa los datos paso a paso.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 self-start">
            <Save className="h-4 w-4" /> Guardar borrador
          </Button>
        </div>
      </div>

      {/* Mobile step indicator */}
      <div className="mb-5 lg:hidden">
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Paso {step} de {steps.length}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {currentStep.label}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {steps.map((s) => (
              <span
                key={s.id}
                className={cn(
                  'h-1.5 w-6 rounded-full transition-colors',
                  step >= s.id ? 'bg-primary' : 'bg-muted'
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        {/* Desktop vertical stepper */}
        <aside className="hidden lg:block">
          <nav className="sticky top-20">
            <ol className="space-y-1">
              {steps.map((s) => {
                const done = step > s.id;
                const active = step === s.id;
                const Icon = s.icon;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => goToStep(s.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary/10 text-primary'
                          : done
                            ? 'text-foreground hover:bg-muted/50'
                            : 'text-muted-foreground hover:bg-muted/50'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                          active && 'bg-primary text-primary-foreground',
                          done && 'bg-success/15 text-success',
                          !active && !done && 'bg-muted text-muted-foreground'
                        )}
                      >
                        {done ? <Check className="h-3.5 w-3.5" /> : s.id}
                      </span>
                      <span className="flex-1">{s.short}</span>
                      <Icon className="h-4 w-4 opacity-50" />
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </aside>

        {/* Form area */}
        <div className="min-w-0">
          <div className="rounded-xl border border-border bg-card p-6 shadow-soft lg:p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">
                {currentStep.label}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {stepSubtitles[step]}
              </p>
            </div>

            <div className="animate-fade-in" key={step}>
              {step === 1 && <Step1 data={data} set={set} />}
              {step === 2 && <Step2 data={data} set={set} />}
              {step === 3 && <Step3 data={data} set={set} />}
              {step === 4 && <Step4 data={data} set={set} />}
              {step === 5 && <Step5 data={data} set={set} />}
              {step === 6 && (
                <Step6 data={data} onEdit={goToStep} onCreate={() => setConfirmed(true)} />
              )}
            </div>
          </div>

          {/* Bottom action bar */}
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-soft">
            <Button
              variant="ghost"
              size="sm"
              onClick={back}
              disabled={step === 1}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" /> Atrás
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">Guardar borrador</span>
                <span className="sm:hidden">Borrador</span>
              </Button>
              {step < 6 ? (
                <Button
                  size="sm"
                  onClick={next}
                  disabled={!canAdvance}
                  className="gap-1.5"
                >
                  Continuar <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setConfirmed(true)}
                  className="gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" /> Crear farmacia
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step subtitles                                                    */
/* ------------------------------------------------------------------ */

const stepSubtitles: Record<number, string> = {
  1: 'Información básica de la empresa farmacéutica.',
  2: 'Persona responsable que administrará la farmacia en la plataforma.',
  3: 'Selecciona el plan y los datos del contrato.',
  4: 'Configura cómo se realizará el cobro de la suscripción.',
  5: 'Personaliza la apariencia de la farmacia en la app.',
  6: 'Revisa todos los datos antes de crear la farmacia.',
};

/* ------------------------------------------------------------------ */
/*  Step 1 — Datos de la farmacia                                     */
/* ------------------------------------------------------------------ */

function Step1({
  data,
  set,
}: {
  data: FormData;
  set: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Nombre comercial" required>
          <Input
            value={data.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Farmacia Central"
          />
        </Field>
        <Field label="Razón social" required>
          <Input
            value={data.legalName}
            onChange={(e) => set('legalName', e.target.value)}
            placeholder="Farmacia Central S.L."
          />
        </Field>
        <Field label="CIF / NIF" required>
          <Input
            value={data.cif}
            onChange={(e) => set('cif', e.target.value)}
            placeholder="B-12345678"
          />
        </Field>
        <Field label="Teléfono" required>
          <Input
            value={data.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+34 911 23 45 67"
          />
        </Field>
        <Field label="Email" required>
          <Input
            type="email"
            value={data.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="contacto@farmacia.es"
          />
        </Field>
        <Field label="Web" hint="Opcional">
          <Input
            value={data.web}
            onChange={(e) => set('web', e.target.value)}
            placeholder="www.farmacia.es"
          />
        </Field>
      </div>

      <div className="border-t border-border pt-5">
        <p className="mb-4 text-sm font-medium text-foreground">
          Dirección postal
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Dirección" required>
              <Input
                value={data.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="Calle Gran Vía 42"
              />
            </Field>
          </div>
          <Field label="Código postal" required>
            <Input
              value={data.postalCode}
              onChange={(e) => set('postalCode', e.target.value)}
              placeholder="28013"
            />
          </Field>
          <Field label="Localidad" required>
            <Input
              value={data.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="Madrid"
            />
          </Field>
          <Field label="Provincia" required>
            <Input
              value={data.province}
              onChange={(e) => set('province', e.target.value)}
              placeholder="Madrid"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 2 — Responsable y acceso                                     */
/* ------------------------------------------------------------------ */

function Step2({
  data,
  set,
}: {
  data: FormData;
  set: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <InfoBanner>
        Esta persona será el <strong>administrador principal</strong> de la
        farmacia. Recibirá las credenciales de acceso y podrá gestionar
        usuarios, clientes, catálogo y pedidos.
      </InfoBanner>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Nombre" required>
          <Input
            value={data.adminName}
            onChange={(e) => set('adminName', e.target.value)}
            placeholder="Marta"
          />
        </Field>
        <Field label="Apellidos" required>
          <Input
            value={data.adminLastName}
            onChange={(e) => set('adminLastName', e.target.value)}
            placeholder="Rivas García"
          />
        </Field>
        <Field label="Cargo" hint="Rol dentro de la farmacia">
          <Input
            value={data.adminRole}
            onChange={(e) => set('adminRole', e.target.value)}
            placeholder="Titular"
          />
        </Field>
        <Field label="Rol inicial">
          <Input
            value={data.adminRole === 'Administrador de farmacia' ? 'Administrador de farmacia' : data.adminRole}
            disabled
            className="bg-muted/50"
          />
        </Field>
        <Field label="Email de acceso" required>
          <Input
            type="email"
            value={data.adminEmail}
            onChange={(e) => set('adminEmail', e.target.value)}
            placeholder="marta@farmacia.es"
          />
        </Field>
        <Field label="Teléfono" required>
          <Input
            value={data.adminPhone}
            onChange={(e) => set('adminPhone', e.target.value)}
            placeholder="+34 611 22 33 44"
          />
        </Field>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <Switch
          checked={data.sendInvite}
          onCheckedChange={(v) => set('sendInvite', v)}
          id="send-invite"
        />
        <div className="flex-1">
          <Label htmlFor="send-invite" className="text-sm font-medium text-foreground">
            Enviar invitación al finalizar
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Se enviará un email con las instrucciones de acceso al responsable.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 3 — Contrato y plan                                          */
/* ------------------------------------------------------------------ */

function Step3({
  data,
  set,
}: {
  data: FormData;
  set: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium text-foreground">
          Tipo de plan <span className="text-destructive">*</span>
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {planOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set('plan', opt.value)}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                data.plan === opt.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/30 hover:bg-muted/40'
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                  data.plan === opt.value
                    ? 'border-primary bg-primary'
                    : 'border-border'
                )}
              >
                {data.plan === opt.value && (
                  <Check className="h-3 w-3 text-primary-foreground" />
                )}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {opt.label}
                </p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Modalidad del contrato" required>
            <Select
              value={data.contractModality}
              onValueChange={(v) => set('contractModality', v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="annual">Anual</SelectItem>
                <SelectItem value="biannual">Bienal</SelectItem>
                <SelectItem value="monthly">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Fecha de inicio" required>
            <Input
              type="date"
              value={data.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </Field>
          <Field label="Duración (meses)" required>
            <Select
              value={data.duration}
              onValueChange={(v) => set('duration', v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="12">12 meses</SelectItem>
                <SelectItem value="24">24 meses</SelectItem>
                <SelectItem value="36">36 meses</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Fecha de renovación" hint="Calculada automáticamente">
            <Input
              type="date"
              value={data.renewalDate}
              onChange={(e) => set('renewalDate', e.target.value)}
              placeholder="Se calcula según duración"
            />
          </Field>
          <Field label="Estado inicial del contrato" required>
            <Select
              value={data.contractStatus}
              onValueChange={(v) => set('contractStatus', v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contractStatusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <p className="mb-4 text-sm font-medium text-foreground">Documento</p>
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <Checkbox
              id="gen-template"
              checked={data.generateFromTemplate}
              onCheckedChange={(v) => set('generateFromTemplate', v === true)}
            />
            <div className="flex-1">
              <Label htmlFor="gen-template" className="text-sm font-medium text-foreground">
                Generar contrato desde plantilla
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Se creará un contrato con los datos introducidos, listo para enviar.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-4">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Subir contrato existente
              </p>
              <p className="text-xs text-muted-foreground">
                PDF o DOCX · máximo 10 MB
              </p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto">
              Examinar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 4 — Forma de pago                                            */
/* ------------------------------------------------------------------ */

function Step4({
  data,
  set,
}: {
  data: FormData;
  set: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
}) {
  const showIban = data.paymentMethod === 'sepa' || data.paymentMethod === 'transfer';
  return (
    <div className="space-y-6">
      <SimulatedBanner />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Forma de pago" required>
          <Select
            value={data.paymentMethod}
            onValueChange={(v) => set('paymentMethod', v)}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentMethodOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Periodicidad" required>
          <Select
            value={data.paymentFrequency}
            onValueChange={(v) => set('paymentFrequency', v)}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentFrequencyOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Importe (€)" required>
          <Input
            type="number"
            value={data.paymentAmount}
            onChange={(e) => set('paymentAmount', e.target.value)}
            placeholder="249,00"
          />
        </Field>
        <Field label="Día de cobro" required>
          <Select
            value={data.paymentDay}
            onValueChange={(v) => set('paymentDay', v)}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Día 1</SelectItem>
              <SelectItem value="5">Día 5</SelectItem>
              <SelectItem value="10">Día 10</SelectItem>
              <SelectItem value="15">Día 15</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="border-t border-border pt-5">
        <p className="mb-4 text-sm font-medium text-foreground">
          Datos de facturación
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Nombre o razón social" required>
            <Input
              value={data.billingName}
              onChange={(e) => set('billingName', e.target.value)}
              placeholder="Farmacia Central S.L."
            />
          </Field>
          <Field label="CIF / NIF" required>
            <Input
              value={data.billingCif}
              onChange={(e) => set('billingCif', e.target.value)}
              placeholder="B-12345678"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Dirección de facturación">
              <Input
                value={data.billingAddress}
                onChange={(e) => set('billingAddress', e.target.value)}
                placeholder="Calle Gran Vía 42, 28013 Madrid"
              />
            </Field>
          </div>
          {showIban && (
            <div className="sm:col-span-2">
              <Field label="IBAN" hint="Cuenta bancaria para domiciliación">
                <Input
                  value={data.iban}
                  onChange={(e) => set('iban', e.target.value)}
                  placeholder="ES00 0000 0000 0000 0000 0000"
                />
              </Field>
            </div>
          )}
          <div className="sm:col-span-2">
            <Field label="Observaciones" hint="Opcional">
              <Textarea
                value={data.paymentNotes}
                onChange={(e) => set('paymentNotes', e.target.value)}
                rows={2}
                placeholder="Notas internas sobre la forma de pago…"
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 5 — Personalización                                          */
/* ------------------------------------------------------------------ */

function Step5({
  data,
  set,
}: {
  data: FormData;
  set: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Form */}
      <div className="space-y-6">
        <div className="rounded-lg border border-dashed border-border p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl text-lg font-semibold text-white"
              style={{ backgroundColor: data.primaryColor }}
            >
              {(data.visibleName || data.name || 'FF')
                .split(' ')
                .map((w) => w[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Logotipo</p>
              <p className="text-xs text-muted-foreground">
                PNG o SVG · máx. 2 MB · 512×512 px
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Upload className="h-4 w-4" /> Subir
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Color principal" required>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={data.primaryColor}
                onChange={(e) => set('primaryColor', e.target.value)}
                className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background"
              />
              <Input
                value={data.primaryColor}
                onChange={(e) => set('primaryColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </Field>
          <Field label="Color secundario">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={data.secondaryColor}
                onChange={(e) => set('secondaryColor', e.target.value)}
                className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background"
              />
              <Input
                value={data.secondaryColor}
                onChange={(e) => set('secondaryColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </Field>
          <Field label="Nombre visible" required>
            <Input
              value={data.visibleName}
              onChange={(e) => set('visibleName', e.target.value)}
              placeholder="Farmacia Central"
            />
          </Field>
          <Field label="Teléfono">
            <Input
              value={data.customPhone}
              onChange={(e) => set('customPhone', e.target.value)}
              placeholder="+34 911 23 45 67"
            />
          </Field>
          <Field label="WhatsApp">
            <Input
              value={data.whatsapp}
              onChange={(e) => set('whatsapp', e.target.value)}
              placeholder="+34 611 22 33 44"
            />
          </Field>
          <Field label="Horario">
            <Input
              value={data.schedule}
              onChange={(e) => set('schedule', e.target.value)}
              placeholder="L-V 9:00-21:30"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Mensaje de bienvenida">
              <Textarea
                value={data.welcomeMessage}
                onChange={(e) => set('welcomeMessage', e.target.value)}
                rows={2}
                placeholder="¡Bienvenido a nuestra farmacia!"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="URL pública" hint="Se generará automáticamente al crear la farmacia">
              <Input
                value={data.publicUrl}
                onChange={(e) => set('publicUrl', e.target.value)}
                placeholder="farmafacil.app/p/farmacia-central"
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="lg:pl-2">
        <p className="mb-3 text-sm font-medium text-foreground">Vista previa</p>
        <div className="overflow-hidden rounded-xl border border-border shadow-soft">
          <div
            className="p-5 text-white"
            style={{ backgroundColor: data.primaryColor }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-lg font-semibold">
                {(data.visibleName || data.name || 'FF')
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <div>
                <p className="text-base font-semibold">
                  {data.visibleName || 'Farmacia'}
                </p>
                <p className="text-xs opacity-80">{data.schedule}</p>
              </div>
            </div>
          </div>
          <div className="space-y-3 bg-card p-5">
            <p className="text-sm text-foreground">
              {data.welcomeMessage || '¡Bienvenido a nuestra farmacia!'}
            </p>
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: data.primaryColor }}
              />
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: data.secondaryColor }}
              />
              <span className="text-xs text-muted-foreground">
                Colores de marca
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <ExternalLink className="h-3.5 w-3.5" />
              {data.publicUrl || 'farmafacil.app/p/...'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 6 — Revisión y alta                                          */
/* ------------------------------------------------------------------ */

function Step6({
  data,
  onEdit,
  onCreate,
}: {
  data: FormData;
  onEdit: (step: number) => void;
  onCreate: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <ReviewSection title="Empresa" step={1} onEdit={onEdit}>
          <ReviewRow label="Nombre comercial" value={data.name || '—'} />
          <ReviewRow label="Razón social" value={data.legalName || '—'} />
          <ReviewRow label="CIF / NIF" value={data.cif || '—'} />
          <ReviewRow
            label="Dirección"
            value={[data.address, data.postalCode, data.city, data.province].filter(Boolean).join(', ') || '—'}
          />
          <ReviewRow label="Teléfono" value={data.phone || '—'} />
          <ReviewRow label="Email" value={data.email || '—'} />
        </ReviewSection>

        <ReviewSection title="Responsable" step={2} onEdit={onEdit}>
          <ReviewRow
            label="Nombre"
            value={[data.adminName, data.adminLastName].filter(Boolean).join(' ') || '—'}
          />
          <ReviewRow label="Cargo" value={data.adminRole || '—'} />
          <ReviewRow label="Email" value={data.adminEmail || '—'} />
          <ReviewRow label="Teléfono" value={data.adminPhone || '—'} />
          <ReviewRow
            label="Invitación"
            value={data.sendInvite ? 'Se enviará al finalizar' : 'No enviar'}
          />
        </ReviewSection>

        <ReviewSection title="Contrato" step={3} onEdit={onEdit}>
          <ReviewRow
            label="Plan"
            value={planOptions.find((p) => p.value === data.plan)?.label || '—'}
          />
          <ReviewRow
            label="Modalidad"
            value={data.contractModality === 'annual' ? 'Anual' : data.contractModality === 'biannual' ? 'Bienal' : 'Mensual'}
          />
          <ReviewRow label="Fecha de inicio" value={data.startDate || '—'} />
          <ReviewRow label="Duración" value={data.duration ? `${data.duration} meses` : '—'} />
          <ReviewRow
            label="Estado"
            value={contractStatusOptions.find((c) => c.value === data.contractStatus)?.label || '—'}
          />
        </ReviewSection>

        <ReviewSection title="Forma de pago" step={4} onEdit={onEdit}>
          <ReviewRow
            label="Método"
            value={paymentMethodOptions.find((p) => p.value === data.paymentMethod)?.label || '—'}
          />
          <ReviewRow
            label="Periodicidad"
            value={paymentFrequencyOptions.find((p) => p.value === data.paymentFrequency)?.label || '—'}
          />
          <ReviewRow label="Importe" value={data.paymentAmount ? `${data.paymentAmount} €` : '—'} />
          <ReviewRow label="Día de cobro" value={`Día ${data.paymentDay}`} />
          <ReviewRow label="Facturación" value={data.billingName || '—'} />
        </ReviewSection>

        <ReviewSection title="Personalización" step={5} onEdit={onEdit}>
          <ReviewRow label="Nombre visible" value={data.visibleName || '—'} />
          <ReviewRow
            label="Color principal"
            value={
              <span className="flex items-center gap-2">
                <span
                  className="h-4 w-4 rounded border border-border"
                  style={{ backgroundColor: data.primaryColor }}
                />
                {data.primaryColor}
              </span>
            }
          />
          <ReviewRow label="Horario" value={data.schedule || '—'} />
          <ReviewRow label="WhatsApp" value={data.whatsapp || '—'} />
        </ReviewSection>
      </div>

      {/* What happens next */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <p className="text-sm font-semibold text-foreground">
          Al confirmar se realizarán las siguientes acciones:
        </p>
        <ul className="mt-3 space-y-2">
          {[
            'Se creará la farmacia con los datos introducidos.',
            'Se preparará el usuario administrador y se enviará la invitación si está activada.',
            'Se generará el código QR de la farmacia.',
            'El contrato quedará con el estado seleccionado.',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={onCreate} className="gap-2">
          <CheckCircle2 className="h-5 w-5" /> Crear farmacia
        </Button>
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: number;
  onEdit: (step: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => onEdit(step)}
        >
          Editar
        </Button>
      </div>
      <dl className="divide-y divide-border">{children}</dl>
    </div>
  );
}

function ReviewRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Confirmation screen                                               */
/* ------------------------------------------------------------------ */

function ConfirmationScreen({ data, id }: { data: FormData; id: string }) {
  const router = useRouter();
  const simulatedUrl = `farmafacil.app/p/${(data.name || 'farmacia')
    .toLowerCase()
    .replace(/\s+/g, '-')}`;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-col items-center rounded-xl border border-border bg-card p-8 text-center shadow-soft lg:p-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success animate-fade-in">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-xl font-semibold text-foreground">
          Farmacia creada
        </h2>
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {data.name || 'Nueva farmacia'}
          </span>{' '}
          se ha registrado correctamente en la plataforma.
        </p>

        {/* QR + ID */}
        <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <QrCode value={id} size={140} />
          </div>
          <div className="space-y-3 text-left">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Identificador
              </p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-foreground">
                {id}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                URL pública
              </p>
              <p className="mt-0.5 text-sm font-medium text-primary">
                {simulatedUrl}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Estado
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {contractStatusOptions.find((c) => c.value === data.contractStatus)?.label}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            className="gap-1.5"
            onClick={() => router.push('/farmacias/ph1')}
          >
            <Eye className="h-4 w-4" /> Ver farmacia
          </Button>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => router.push('/farmacias')}
          >
            <Store className="h-4 w-4" /> Volver al listado
          </Button>
          <Button
            variant="ghost"
            className="gap-1.5"
            onClick={() => router.push('/farmacias/nueva')}
          >
            <RefreshCw className="h-4 w-4" /> Crear otra
          </Button>
        </div>
      </div>
    </div>
  );
}
