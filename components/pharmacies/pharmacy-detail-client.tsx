'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  LayoutDashboard,
  FileText,
  QrCode,
  Palette,
  Users,
  User,
  Pill,
  ShoppingCart,
  Activity,
  Globe,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  Pencil,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

import type {
  PharmacyDetail,
  PlanSummary,
  PharmacyMember,
  PharmacyRoleOption,
} from '@/lib/pharmacies/types';
import {
  PHARMACY_STATUS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
} from '@/lib/pharmacies/labels';
import {
  updatePharmacyGeneralAction,
  updatePharmacyPersonalizationAction,
} from '@/app/(app)/farmacias/actions';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  StatusBadge,
  toneForPharmacyStatus,
} from '@/components/shared/status-badge';
import { PharmacyLogo } from '@/components/brand';
import { ChangePlanDialog } from '@/components/pharmacies/change-plan-dialog';
import { PharmacyUsersPanel } from '@/components/pharmacies/pharmacy-users-panel';

const tabs = [
  { id: 'general', label: 'General', icon: LayoutDashboard, ready: true },
  { id: 'personalizacion', label: 'Personalización', icon: Palette, ready: true },
  { id: 'contrato', label: 'Contrato', icon: FileText, ready: false },
  { id: 'qr', label: 'QR', icon: QrCode, ready: false },
  { id: 'usuarios', label: 'Usuarios', icon: Users, ready: true },
  { id: 'clientes', label: 'Clientes', icon: User, ready: false },
  { id: 'catalogo', label: 'Catálogo', icon: Pill, ready: false },
  { id: 'pedidos', label: 'Pedidos', icon: ShoppingCart, ready: false },
  { id: 'actividad', label: 'Actividad', icon: Activity, ready: false },
] as const;

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-foreground">
          {value || '—'}
        </p>
      </div>
    </div>
  );
}

function PendingPanel({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Esta sección todavía no está implementada. No se muestran datos
        ficticios.
      </p>
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

function SuccessBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </div>
  );
}

type GeneralForm = {
  name: string;
  legal_name: string;
  cif: string;
  email: string;
  phone: string;
  web: string;
  address_line: string;
  postal_code: string;
  city: string;
  province: string;
  country: string;
};

type PersonalizationForm = {
  primary_color: string;
  secondary_color: string;
  welcome_message: string;
  visible_name: string;
  schedule: string;
  phone: string;
  whatsapp: string;
  email: string;
};

export function PharmacyDetailClient({
  pharmacy: initialPharmacy,
  plans,
  members,
  roles,
}: {
  pharmacy: PharmacyDetail;
  plans: PlanSummary[];
  members: PharmacyMember[];
  roles: PharmacyRoleOption[];
}) {
  const router = useRouter();
  const [pharmacy, setPharmacy] = React.useState(initialPharmacy);
  const [activeTab, setActiveTab] = React.useState('general');
  const [editingGeneral, setEditingGeneral] = React.useState(false);
  const [editingPersonalization, setEditingPersonalization] =
    React.useState(false);
  const [changePlanOpen, setChangePlanOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const [generalForm, setGeneralForm] = React.useState<GeneralForm>({
    name: '',
    legal_name: '',
    cif: '',
    email: '',
    phone: '',
    web: '',
    address_line: '',
    postal_code: '',
    city: '',
    province: '',
    country: 'ES',
  });

  const [personalizationForm, setPersonalizationForm] =
    React.useState<PersonalizationForm>({
      primary_color: DEFAULT_PRIMARY_COLOR,
      secondary_color: DEFAULT_SECONDARY_COLOR,
      welcome_message: '',
      visible_name: '',
      schedule: '',
      phone: '',
      whatsapp: '',
      email: '',
    });

  React.useEffect(() => {
    setPharmacy(initialPharmacy);
  }, [initialPharmacy]);

  const color =
    pharmacy.branding?.primary_color ||
    pharmacy.logo_color ||
    DEFAULT_PRIMARY_COLOR;

  function startEditGeneral() {
    setError(null);
    setSuccess(null);
    setEditingPersonalization(false);
    setGeneralForm({
      name: pharmacy.name ?? '',
      legal_name: pharmacy.legal_name ?? '',
      cif: pharmacy.cif ?? '',
      email: pharmacy.email ?? '',
      phone: pharmacy.phone ?? '',
      web: pharmacy.web ?? '',
      address_line: pharmacy.address_line ?? '',
      postal_code: pharmacy.postal_code ?? '',
      city: pharmacy.city ?? '',
      province: pharmacy.province ?? '',
      country: pharmacy.country ?? 'ES',
    });
    setEditingGeneral(true);
  }

  function startEditPersonalization() {
    setError(null);
    setSuccess(null);
    setEditingGeneral(false);
    setPersonalizationForm({
      primary_color:
        pharmacy.branding?.primary_color || DEFAULT_PRIMARY_COLOR,
      secondary_color:
        pharmacy.branding?.secondary_color || DEFAULT_SECONDARY_COLOR,
      welcome_message: pharmacy.branding?.welcome_message ?? '',
      visible_name: pharmacy.settings?.visible_name ?? '',
      schedule: pharmacy.settings?.schedule ?? '',
      phone: pharmacy.settings?.phone ?? '',
      whatsapp: pharmacy.settings?.whatsapp ?? '',
      email: pharmacy.settings?.email ?? '',
    });
    setEditingPersonalization(true);
  }

  function cancelEdit() {
    setEditingGeneral(false);
    setEditingPersonalization(false);
    setError(null);
    setSaving(false);
  }

  async function saveGeneral() {
    if (saving) return;
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const result = await updatePharmacyGeneralAction(pharmacy.id, {
        name: generalForm.name,
        legal_name: generalForm.legal_name,
        cif: generalForm.cif,
        email: generalForm.email,
        phone: generalForm.phone,
        web: generalForm.web,
        address_line: generalForm.address_line,
        postal_code: generalForm.postal_code,
        city: generalForm.city,
        province: generalForm.province,
        country: generalForm.country,
      });

      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }

      setPharmacy((prev) => ({
        ...prev,
        name: generalForm.name.trim(),
        legal_name: generalForm.legal_name.trim() || null,
        cif: generalForm.cif.trim() || null,
        email: generalForm.email.trim() || null,
        phone: generalForm.phone.trim() || null,
        web: generalForm.web.trim() || null,
        address_line: generalForm.address_line.trim() || null,
        postal_code: generalForm.postal_code.trim() || null,
        city: generalForm.city.trim() || null,
        province: generalForm.province.trim() || null,
        country: generalForm.country.trim() || 'ES',
      }));
      setEditingGeneral(false);
      setSuccess('Cambios guardados correctamente.');
      router.refresh();
    } catch {
      setError('No se han podido guardar los cambios. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  async function savePersonalization() {
    if (saving) return;
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const result = await updatePharmacyPersonalizationAction(
        pharmacy.id,
        {
          primary_color: personalizationForm.primary_color,
          secondary_color: personalizationForm.secondary_color,
          welcome_message: personalizationForm.welcome_message,
        },
        {
          visible_name: personalizationForm.visible_name,
          schedule: personalizationForm.schedule,
          phone: personalizationForm.phone,
          whatsapp: personalizationForm.whatsapp,
          email: personalizationForm.email,
        }
      );

      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }

      const primary = personalizationForm.primary_color.trim() || null;
      const secondary = personalizationForm.secondary_color.trim() || null;

      setPharmacy((prev) => ({
        ...prev,
        branding: {
          pharmacy_id: prev.id,
          logo_url: prev.branding?.logo_url ?? null,
          primary_color: primary,
          secondary_color: secondary,
          accent_color: prev.branding?.accent_color ?? null,
          font_family: prev.branding?.font_family ?? null,
          border_radius: prev.branding?.border_radius ?? null,
          kiosk_wallpaper_url: prev.branding?.kiosk_wallpaper_url ?? null,
          welcome_message:
            personalizationForm.welcome_message.trim() || null,
        },
        settings: {
          pharmacy_id: prev.id,
          visible_name: personalizationForm.visible_name.trim() || null,
          schedule: personalizationForm.schedule.trim() || null,
          phone: personalizationForm.phone.trim() || null,
          whatsapp: personalizationForm.whatsapp.trim() || null,
          email: personalizationForm.email.trim() || null,
          timezone: prev.settings?.timezone || 'Europe/Madrid',
        },
      }));
      setEditingPersonalization(false);
      setSuccess('Personalización guardada correctamente.');
      router.refresh();
    } catch {
      setError('No se han podido guardar los cambios. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/farmacias"
          className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Farmacias
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <PharmacyLogo
              name={pharmacy.name}
              logoColor={color}
              size={64}
              rounded="2xl"
              className="shadow-soft"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  {pharmacy.name}
                </h1>
                <StatusBadge tone={toneForPharmacyStatus(pharmacy.status)}>
                  {PHARMACY_STATUS_LABELS[pharmacy.status] ?? pharmacy.status}
                </StatusBadge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {[pharmacy.legal_name, pharmacy.city, pharmacy.province]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span>
                    Plan:{' '}
                    <span className="font-medium text-foreground">
                      {pharmacy.plan?.name ?? '—'}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setChangePlanOpen(true)}
                  >
                    Cambiar plan
                  </Button>
                </span>
                {pharmacy.subscription && (
                  <span>
                    Suscripción:{' '}
                    <span className="font-medium text-foreground">
                      {SUBSCRIPTION_STATUS_LABELS[
                        pharmacy.subscription.status
                      ] ?? pharmacy.subscription.status}
                    </span>
                    {pharmacy.subscription.provider
                      ? ` · ${pharmacy.subscription.provider}`
                      : ''}
                  </span>
                )}
                <span>
                  Alta:{' '}
                  <span className="font-medium text-foreground">
                    {formatDate(pharmacy.created_at)}
                  </span>
                </span>
              </div>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/farmacias">Volver al listado</Link>
          </Button>
        </div>

        <div className="border-t border-border px-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    cancelEdit();
                    setSuccess(null);
                  }}
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                    active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {!tab.ready && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Pronto
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {success ? <SuccessBanner message={success} /> : null}

      <div>
        {activeTab === 'general' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Datos generales
              </h2>
              {!editingGeneral ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={startEditGeneral}
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
              ) : null}
            </div>

            {editingGeneral ? (
              <div className="rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nombre comercial *" className="sm:col-span-2">
                    <Input
                      value={generalForm.name}
                      onChange={(e) =>
                        setGeneralForm((f) => ({ ...f, name: e.target.value }))
                      }
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Razón social">
                    <Input
                      value={generalForm.legal_name}
                      onChange={(e) =>
                        setGeneralForm((f) => ({
                          ...f,
                          legal_name: e.target.value,
                        }))
                      }
                      disabled={saving}
                    />
                  </Field>
                  <Field label="CIF / NIF">
                    <Input
                      value={generalForm.cif}
                      onChange={(e) =>
                        setGeneralForm((f) => ({ ...f, cif: e.target.value }))
                      }
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      value={generalForm.email}
                      onChange={(e) =>
                        setGeneralForm((f) => ({ ...f, email: e.target.value }))
                      }
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Teléfono">
                    <Input
                      value={generalForm.phone}
                      onChange={(e) =>
                        setGeneralForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Web" className="sm:col-span-2">
                    <Input
                      value={generalForm.web}
                      onChange={(e) =>
                        setGeneralForm((f) => ({ ...f, web: e.target.value }))
                      }
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Dirección" className="sm:col-span-2">
                    <Input
                      value={generalForm.address_line}
                      onChange={(e) =>
                        setGeneralForm((f) => ({
                          ...f,
                          address_line: e.target.value,
                        }))
                      }
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Código postal">
                    <Input
                      value={generalForm.postal_code}
                      onChange={(e) =>
                        setGeneralForm((f) => ({
                          ...f,
                          postal_code: e.target.value,
                        }))
                      }
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Ciudad">
                    <Input
                      value={generalForm.city}
                      onChange={(e) =>
                        setGeneralForm((f) => ({ ...f, city: e.target.value }))
                      }
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Provincia">
                    <Input
                      value={generalForm.province}
                      onChange={(e) =>
                        setGeneralForm((f) => ({
                          ...f,
                          province: e.target.value,
                        }))
                      }
                      disabled={saving}
                    />
                  </Field>
                  <Field label="País">
                    <Input
                      value={generalForm.country}
                      onChange={(e) =>
                        setGeneralForm((f) => ({
                          ...f,
                          country: e.target.value,
                        }))
                      }
                      disabled={saving}
                    />
                  </Field>
                </div>

                {error ? (
                  <div className="mt-4">
                    <ErrorBanner message={error} />
                  </div>
                ) : null}

                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={cancelEdit}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    disabled={saving || !generalForm.name.trim()}
                    onClick={() => void saveGeneral()}
                    className="gap-1.5"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="rounded-xl border border-border bg-card p-6 text-center">
                  <PharmacyLogo
                    name={pharmacy.name}
                    logoColor={color}
                    size={80}
                    rounded="2xl"
                    className="mx-auto shadow-soft"
                  />
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    {pharmacy.settings?.visible_name || pharmacy.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {pharmacy.legal_name || '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-2 sm:p-4 lg:col-span-2">
                  <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                    <div className="divide-y divide-border sm:border-r sm:border-border sm:pr-6">
                      <InfoRow
                        icon={CreditCard}
                        label="CIF"
                        value={pharmacy.cif}
                      />
                      <InfoRow
                        icon={MapPin}
                        label="Dirección"
                        value={[pharmacy.address_line, pharmacy.postal_code]
                          .filter(Boolean)
                          .join(', ')}
                      />
                      <InfoRow
                        icon={MapPin}
                        label="Ciudad"
                        value={pharmacy.city}
                      />
                      <InfoRow
                        icon={MapPin}
                        label="Provincia"
                        value={pharmacy.province}
                      />
                      <InfoRow
                        icon={MapPin}
                        label="País"
                        value={pharmacy.country}
                      />
                    </div>
                    <div className="divide-y divide-border sm:pl-6">
                      <InfoRow
                        icon={Phone}
                        label="Teléfono"
                        value={pharmacy.phone}
                      />
                      <InfoRow
                        icon={Mail}
                        label="Email"
                        value={pharmacy.email}
                      />
                      <InfoRow icon={Globe} label="Web" value={pharmacy.web} />
                      <InfoRow
                        icon={Calendar}
                        label="Creada"
                        value={formatDate(pharmacy.created_at)}
                      />
                      <InfoRow
                        icon={CreditCard}
                        label="Plan"
                        value={pharmacy.plan?.name}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'personalizacion' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Personalización
              </h2>
              {!editingPersonalization ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={startEditPersonalization}
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
              ) : null}
            </div>

            {editingPersonalization ? (
              <div className="rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground">
                      Branding
                    </h3>
                    <Field label="Color primario">
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          value={
                            personalizationForm.primary_color ||
                            DEFAULT_PRIMARY_COLOR
                          }
                          onChange={(e) =>
                            setPersonalizationForm((f) => ({
                              ...f,
                              primary_color: e.target.value,
                            }))
                          }
                          className="h-10 w-14 cursor-pointer p-1"
                          disabled={saving}
                        />
                        <Input
                          value={personalizationForm.primary_color}
                          onChange={(e) =>
                            setPersonalizationForm((f) => ({
                              ...f,
                              primary_color: e.target.value,
                            }))
                          }
                          placeholder="#2EC4C7"
                          disabled={saving}
                        />
                      </div>
                    </Field>
                    <Field label="Color secundario">
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          value={
                            personalizationForm.secondary_color ||
                            DEFAULT_SECONDARY_COLOR
                          }
                          onChange={(e) =>
                            setPersonalizationForm((f) => ({
                              ...f,
                              secondary_color: e.target.value,
                            }))
                          }
                          className="h-10 w-14 cursor-pointer p-1"
                          disabled={saving}
                        />
                        <Input
                          value={personalizationForm.secondary_color}
                          onChange={(e) =>
                            setPersonalizationForm((f) => ({
                              ...f,
                              secondary_color: e.target.value,
                            }))
                          }
                          placeholder="#0EA5E9"
                          disabled={saving}
                        />
                      </div>
                    </Field>
                    <Field label="Mensaje de bienvenida">
                      <Textarea
                        value={personalizationForm.welcome_message}
                        onChange={(e) =>
                          setPersonalizationForm((f) => ({
                            ...f,
                            welcome_message: e.target.value,
                          }))
                        }
                        rows={3}
                        disabled={saving}
                      />
                    </Field>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground">
                      Ajustes
                    </h3>
                    <Field label="Nombre visible">
                      <Input
                        value={personalizationForm.visible_name}
                        onChange={(e) =>
                          setPersonalizationForm((f) => ({
                            ...f,
                            visible_name: e.target.value,
                          }))
                        }
                        disabled={saving}
                      />
                    </Field>
                    <Field label="Horario">
                      <Input
                        value={personalizationForm.schedule}
                        onChange={(e) =>
                          setPersonalizationForm((f) => ({
                            ...f,
                            schedule: e.target.value,
                          }))
                        }
                        disabled={saving}
                      />
                    </Field>
                    <Field label="Teléfono">
                      <Input
                        value={personalizationForm.phone}
                        onChange={(e) =>
                          setPersonalizationForm((f) => ({
                            ...f,
                            phone: e.target.value,
                          }))
                        }
                        disabled={saving}
                      />
                    </Field>
                    <Field label="WhatsApp">
                      <Input
                        value={personalizationForm.whatsapp}
                        onChange={(e) =>
                          setPersonalizationForm((f) => ({
                            ...f,
                            whatsapp: e.target.value,
                          }))
                        }
                        disabled={saving}
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        value={personalizationForm.email}
                        onChange={(e) =>
                          setPersonalizationForm((f) => ({
                            ...f,
                            email: e.target.value,
                          }))
                        }
                        disabled={saving}
                      />
                    </Field>
                    <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      Zona horaria: Europe/Madrid (fija en V1)
                    </div>
                  </div>
                </div>

                {error ? (
                  <div className="mt-4">
                    <ErrorBanner message={error} />
                  </div>
                ) : null}

                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={cancelEdit}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={() => void savePersonalization()}
                    className="gap-1.5"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground">
                    Branding
                  </h3>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        Color primario
                      </span>
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <span
                          className="h-5 w-5 rounded-full border border-border"
                          style={{
                            backgroundColor:
                              pharmacy.branding?.primary_color || color,
                          }}
                        />
                        {pharmacy.branding?.primary_color || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        Color secundario
                      </span>
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <span
                          className="h-5 w-5 rounded-full border border-border"
                          style={{
                            backgroundColor:
                              pharmacy.branding?.secondary_color ||
                              DEFAULT_SECONDARY_COLOR,
                          }}
                        />
                        {pharmacy.branding?.secondary_color || '—'}
                      </span>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        Mensaje de bienvenida
                      </p>
                      <p className="mt-1 font-medium text-foreground">
                        {pharmacy.branding?.welcome_message || '—'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground">
                    Ajustes
                  </h3>
                  <div className="mt-4 space-y-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Nombre visible</p>
                      <p className="mt-1 font-medium text-foreground">
                        {pharmacy.settings?.visible_name || pharmacy.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Horario</p>
                      <p className="mt-1 font-medium text-foreground">
                        {pharmacy.settings?.schedule || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Teléfono</p>
                      <p className="mt-1 font-medium text-foreground">
                        {pharmacy.settings?.phone || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">WhatsApp</p>
                      <p className="mt-1 font-medium text-foreground">
                        {pharmacy.settings?.whatsapp || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="mt-1 font-medium text-foreground">
                        {pharmacy.settings?.email || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Zona horaria</p>
                      <p className="mt-1 font-medium text-foreground">
                        {pharmacy.settings?.timezone || 'Europe/Madrid'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'usuarios' && (
          <PharmacyUsersPanel
            pharmacyId={pharmacy.id}
            members={members}
            roles={roles}
            onSuccessMessage={(message) => {
              setSuccess(message);
              setError(null);
            }}
          />
        )}

        {activeTab !== 'general' &&
          activeTab !== 'personalizacion' &&
          activeTab !== 'usuarios' && (
          <PendingPanel
            title={tabs.find((t) => t.id === activeTab)?.label ?? 'Sección'}
          />
        )}
      </div>

      <ChangePlanDialog
        open={changePlanOpen}
        onOpenChange={setChangePlanOpen}
        pharmacyId={pharmacy.id}
        currentPlan={pharmacy.plan}
        plans={plans}
        onSuccess={(plan) => {
          setPharmacy((prev) => ({
            ...prev,
            plan,
            subscription: prev.subscription
              ? { ...prev.subscription, plan }
              : prev.subscription,
          }));
          setSuccess(`Plan actualizado a ${plan.name}.`);
          setError(null);
          router.refresh();
        }}
      />
    </div>
  );
}
