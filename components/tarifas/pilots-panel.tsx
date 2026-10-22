'use client';

import * as React from 'react';
import {
  FlaskConical,
  CalendarPlus,
  Play,
  Ban,
  Loader2,
  ClipboardCheck,
  Plus,
  ExternalLink,
  QrCode,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import type {
  CommercialPilotRow,
  PilotKpis,
  ReadinessCheck,
} from '@/lib/commercial/pilots-queries';
import {
  activateCommercialTrialAction,
  createPharmacyCommercialPrepAction,
  endCommercialTrialAction,
  extendCommercialTrialAction,
  getTrialReadinessAction,
} from '@/app/(app)/tarifas/actions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const COLUMNS = [
  'Farmacia',
  'Estado piloto',
  'Catálogo',
  'Activación',
  'Vencimiento',
  'Días',
  'Ampliación',
  'Acciones',
] as const;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function statusBadge(status: CommercialPilotRow['trialStatus']) {
  const map: Record<
    CommercialPilotRow['trialStatus'],
    { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
  > = {
    draft: { label: 'Borrador', variant: 'outline' },
    ready: { label: 'Listo (sin reloj)', variant: 'secondary' },
    active: { label: 'Activo', variant: 'default' },
    extended: { label: 'Ampliado', variant: 'default' },
    ended: { label: 'Finalizado', variant: 'outline' },
    cancelled: { label: 'Cancelado', variant: 'destructive' },
  };
  const cfg = map[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function PilotsPanel({
  initialRows,
  initialKpis,
  loadError,
  canManage,
}: {
  initialRows: CommercialPilotRow[];
  initialKpis: PilotKpis;
  loadError?: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  /** Evita doble envío / clics repetidos en mutaciones comerciales. */
  const mutationLock = React.useRef(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [city, setCity] = React.useState('');
  const [lastQrUrl, setLastQrUrl] = React.useState<string | null>(null);

  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [activateTarget, setActivateTarget] =
    React.useState<CommercialPilotRow | null>(null);
  const [endTarget, setEndTarget] = React.useState<CommercialPilotRow | null>(
    null
  );
  const [extendTarget, setExtendTarget] =
    React.useState<CommercialPilotRow | null>(null);
  const [extendReason, setExtendReason] = React.useState('');
  const [endReason, setEndReason] = React.useState('');

  const [readinessOpen, setReadinessOpen] = React.useState(false);
  const [readinessLoading, setReadinessLoading] = React.useState(false);
  const [readinessPharmacy, setReadinessPharmacy] = React.useState<string | null>(
    null
  );
  const [readinessReady, setReadinessReady] = React.useState<boolean | null>(
    null
  );
  const [readinessChecks, setReadinessChecks] = React.useState<
    ReadinessCheck[]
  >([]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || mutationLock.current) return;
    mutationLock.current = true;
    setCreating(true);
    setLastQrUrl(null);
    try {
      const result = await createPharmacyCommercialPrepAction({
        name,
        email,
        phone,
        city,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Farmacia comercial preparada (piloto sin activar).', {
        description: result.publicUrl
          ? `QR: ${result.publicUrl}`
          : 'Revisa la ficha de farmacia para el QR.',
      });
      setLastQrUrl(result.publicUrl);
      setName('');
      setEmail('');
      setPhone('');
      setCity('');
      setCreateOpen(false);
      router.refresh();
    } finally {
      setCreating(false);
      mutationLock.current = false;
    }
  }

  async function openReadiness(row: CommercialPilotRow) {
    if (readinessLoading) return;
    setReadinessPharmacy(row.pharmacyName);
    setReadinessOpen(true);
    setReadinessLoading(true);
    setReadinessReady(null);
    setReadinessChecks([]);
    const result = await getTrialReadinessAction(row.pharmacyId);
    setReadinessLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setReadinessReady(result.ready);
    setReadinessChecks(result.checks);
  }

  async function confirmActivate() {
    if (!activateTarget || mutationLock.current) return;
    mutationLock.current = true;
    const pharmacyId = activateTarget.pharmacyId;
    setBusyId(pharmacyId);
    setActivateTarget(null);
    try {
      const result = await activateCommercialTrialAction(pharmacyId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.trialStatus === 'active' || result.trialStatus === 'extended'
          ? 'Piloto activado (15 días).'
          : `Piloto: ${result.trialStatus}`
      );
      router.refresh();
    } finally {
      setBusyId(null);
      mutationLock.current = false;
    }
  }

  async function confirmExtend() {
    if (!extendTarget || mutationLock.current) return;
    mutationLock.current = true;
    const pharmacyId = extendTarget.pharmacyId;
    const reason = extendReason;
    setBusyId(pharmacyId);
    try {
      const result = await extendCommercialTrialAction(pharmacyId, reason);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Piloto ampliado +15 días.');
      setExtendTarget(null);
      setExtendReason('');
      router.refresh();
    } finally {
      setBusyId(null);
      mutationLock.current = false;
    }
  }

  async function confirmEnd() {
    if (!endTarget || mutationLock.current) return;
    mutationLock.current = true;
    const pharmacyId = endTarget.pharmacyId;
    const reason = endReason;
    setBusyId(pharmacyId);
    setEndTarget(null);
    setEndReason('');
    try {
      const result = await endCommercialTrialAction(pharmacyId, reason);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Piloto finalizado (sin conversión automática).');
      router.refresh();
    } finally {
      setBusyId(null);
      mutationLock.current = false;
    }
  }

  const kpis = [
    { label: 'Activos', value: initialKpis.active },
    { label: 'Vencen en 3 días', value: initialKpis.expiringSoon },
    { label: 'Finalizados', value: initialKpis.ended },
    { label: 'Ampliados', value: initialKpis.extended },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-dashed border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Pilotos comerciales (15 días + ampliación única)
            </p>
            <p>
              Crear farmacia prepara el piloto en estado{' '}
              <span className="font-medium text-foreground">ready</span> con
              catálogo genérico y QR. El reloj solo arranca con «Activar
              piloto». No hay conversión automática al finalizar.
            </p>
            {lastQrUrl ? (
              <p className="flex flex-wrap items-center gap-2 pt-1 text-foreground">
                <QrCode className="h-3.5 w-3.5" />
                Último QR:{' '}
                <a
                  href={lastQrUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {lastQrUrl}
                </a>
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4 shadow-soft">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {kpi.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
              {kpi.value}
            </p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Listado de pilotos
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Datos en vivo desde pharmacy_commercial_trials.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={!canManage}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Preparar farmacia comercial
          </Button>
        </div>

        {loadError ? (
          <p className="px-5 py-8 text-center text-sm text-destructive">
            {loadError}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {COLUMNS.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 font-medium text-muted-foreground"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {initialRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={COLUMNS.length}
                      className="px-4 py-14 text-center text-sm text-muted-foreground"
                    >
                      No hay pilotos comerciales todavía.
                    </td>
                  </tr>
                ) : (
                  initialRows.map((row) => {
                    const busy = busyId === row.pharmacyId;
                    const canActivate = row.trialStatus === 'ready';
                    const canExtend =
                      (row.trialStatus === 'active' ||
                        row.trialStatus === 'extended' ||
                        row.trialStatus === 'ended') &&
                      !row.extensionUsed;
                    const canEnd =
                      row.trialStatus === 'active' ||
                      row.trialStatus === 'extended';
                    return (
                      <tr
                        key={row.trialId}
                        className="border-b border-border/70 last:border-0"
                      >
                        <td className="px-4 py-3">
                          <div className="min-w-0 space-y-0.5">
                            <Link
                              href={`/farmacias/${row.pharmacyId}`}
                              className="font-medium text-foreground underline-offset-2 hover:underline"
                            >
                              {row.pharmacyName}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              Farmacia: {row.pharmacyStatus}
                              {row.publicUrl ? (
                                <>
                                  {' · '}
                                  <a
                                    href={row.publicUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline"
                                  >
                                    QR <ExternalLink className="h-3 w-3" />
                                  </a>
                                </>
                              ) : null}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">{statusBadge(row.trialStatus)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {row.catalogMode} · {row.genericProductCount} genéricos
                        </td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {formatDate(row.activatedAt)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {formatDate(row.endsAt)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {row.daysRemaining == null ? (
                            '—'
                          ) : (
                            <span
                              className={cn(
                                row.daysRemaining <= 3 &&
                                  row.daysRemaining >= 0 &&
                                  'font-medium text-amber-600'
                              )}
                            >
                              {row.daysRemaining}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {row.extensionUsed ? 'Usada' : 'Disponible'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 px-2"
                              disabled={!canManage || busy}
                              onClick={() => void openReadiness(row)}
                            >
                              <ClipboardCheck className="h-3.5 w-3.5" />
                              Readiness
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 gap-1 px-2"
                              disabled={!canManage || !canActivate || busy}
                              onClick={() => setActivateTarget(row)}
                            >
                              {busy && canActivate ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                              Activar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 px-2"
                              disabled={!canManage || !canExtend || busy}
                              onClick={() => {
                                setExtendReason('');
                                setExtendTarget(row);
                              }}
                            >
                              <CalendarPlus className="h-3.5 w-3.5" />
                              Ampliar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 px-2"
                              disabled={!canManage || !canEnd || busy}
                              onClick={() => {
                                setEndReason('');
                                setEndTarget(row);
                              }}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Finalizar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preparar farmacia comercial</DialogTitle>
            <DialogDescription>
              Crea la farmacia en pending_setup, trial ready, catálogo genérico
              (100) y QR. No inicia el piloto.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void onCreate(e)} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="prep-name">Nombre *</Label>
              <Input
                id="prep-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={creating}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="prep-email">Email</Label>
                <Input
                  id="prep-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={creating}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prep-phone">Teléfono</Label>
                <Input
                  id="prep-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={creating}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prep-city">Ciudad</Label>
              <Input
                id="prep-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={creating}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={creating}
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparando…
                  </>
                ) : (
                  'Preparar (sin activar)'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={readinessOpen} onOpenChange={setReadinessOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Readiness · {readinessPharmacy}</DialogTitle>
            <DialogDescription>
              Checklist de condiciones para activar el piloto.
            </DialogDescription>
          </DialogHeader>
          {readinessLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Consultando…
            </p>
          ) : (
            <div className="space-y-3">
              <Badge variant={readinessReady ? 'default' : 'secondary'}>
                {readinessReady ? 'Listo para activar' : 'Pendiente'}
              </Badge>
              <ul className="space-y-2 text-sm">
                {readinessChecks.map((c) => (
                  <li
                    key={c.key}
                    className="flex gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <span
                      className={cn(
                        'mt-0.5 h-2 w-2 shrink-0 rounded-full',
                        c.ok ? 'bg-emerald-500' : 'bg-amber-500'
                      )}
                    />
                    <div>
                      <p className="font-medium text-foreground">{c.key}</p>
                      {c.detail ? (
                        <p className="text-xs text-muted-foreground">{c.detail}</p>
                      ) : null}
                      {!c.ok && c.required ? (
                        <p className="text-xs text-amber-700">{c.required}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!activateTarget}
        onOpenChange={(o) => !o && setActivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Activar piloto de 15 días?</AlertDialogTitle>
            <AlertDialogDescription>
              Arrancará el reloj comercial y la suscripción trial de{' '}
              <strong>{activateTarget?.pharmacyName}</strong>. Solo si el
              checklist de readiness está completo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmActivate();
              }}
            >
              Activar piloto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!extendTarget}
        onOpenChange={(o) => !o && setExtendTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ampliar piloto +15 días</DialogTitle>
            <DialogDescription>
              Solo una vez. Motivo obligatorio (mín. 3 caracteres) para{' '}
              {extendTarget?.pharmacyName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="extend-reason">Motivo</Label>
            <Input
              id="extend-reason"
              value={extendReason}
              onChange={(e) => setExtendReason(e.target.value)}
              placeholder="Ej. retraso en onboarding del titular"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setExtendTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={extendReason.trim().length < 3}
              onClick={() => void confirmExtend()}
            >
              Confirmar ampliación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!endTarget} onOpenChange={(o) => !o && setEndTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar piloto</DialogTitle>
            <DialogDescription>
              Sin conversión automática a plan de pago. Farmacia:{' '}
              {endTarget?.pharmacyName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="end-reason">Motivo (opcional)</Label>
            <Input
              id="end-reason"
              value={endReason}
              onChange={(e) => setEndReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEndTarget(null)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void confirmEnd()}>
              Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
