'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Rocket } from 'lucide-react';

import type {
  LaunchSeatDetail,
  LaunchSeatEvent,
  LaunchSeatsSummary,
} from '@/lib/pharmacies/launch-seats';
import { formatDate } from '@/lib/format';
import {
  releaseLaunchSeatAction,
  reserveLaunchSeatAction,
} from '@/app/(app)/farmacias/launch-seat-actions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_LABEL: Record<string, string> = {
  none: 'Sin plaza',
  reserved: 'Reservada',
  confirmed: 'Confirmada',
  released: 'Liberada',
};

function SummaryStrip({ summary }: { summary: LaunchSeatsSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Total plazas" value={String(summary.maxSlots)} />
      <Stat label="Reservadas" value={String(summary.reservedCount)} />
      <Stat label="Confirmadas" value={String(summary.confirmedCount)} />
      <Stat label="Disponibles" value={String(summary.remaining)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

/** Bloque ficha farmacia → Contrato */
export function LaunchPromoPharmacyBlock({
  pharmacyId,
  currentPlanKey,
  summary,
  seat,
  events,
  canManage,
}: {
  pharmacyId: string;
  currentPlanKey: string | null;
  summary: LaunchSeatsSummary;
  seat: LaunchSeatDetail | null;
  events: LaunchSeatEvent[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [releaseOpen, setReleaseOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [reserveSku, setReserveSku] = React.useState(
    currentPlanKey === 'personalized' || currentPlanKey === 'personalizado'
      ? 'personalized'
      : currentPlanKey === 'ai_personalized' ||
          currentPlanKey === 'asistente_ia_personalizado'
        ? 'ai_personalized'
        : 'general'
  );

  const active = seat && seat.rawStatus === 'active';

  async function onReserve() {
    setError(null);
    setOkMsg(null);
    setBusy(true);
    const r = await reserveLaunchSeatAction(pharmacyId, reserveSku);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setOkMsg(r.message);
    router.refresh();
  }

  async function onRelease() {
    setError(null);
    setOkMsg(null);
    setBusy(true);
    const r = await releaseLaunchSeatAction(pharmacyId, reason);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setReleaseOpen(false);
    setReason('');
    setOkMsg(r.message);
    router.refresh();
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-300">
          <Rocket className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">
            Promoción de lanzamiento 2027
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Primeras {summary.maxSlots} farmacias · −60 % sobre tarifa lista.
            Liberar no cambia el plan ni desactiva la farmacia.
          </p>
        </div>
      </div>

      <SummaryStrip summary={summary} />

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
        <Field
          label="Estado de la plaza"
          value={STATUS_LABEL[seat?.status ?? 'none']}
        />
        <Field
          label="Fecha de reserva"
          value={seat?.reservedAt ? formatDate(seat.reservedAt) : '—'}
        />
        <Field label="Plan asociado" value={seat?.planLabel ?? '—'} />
        <Field label="Descuentos aplicables" value={seat?.discountLabel ?? '—'} />
        <Field
          label="Cuota promocional"
          value={
            seat
              ? `${seat.promoMonthlyLabel} / mes (lista ${seat.listMonthlyLabel})`
              : '—'
          }
        />
        <Field
          label="Reservada por"
          value={seat?.reservedByLabel ?? '—'}
        />
      </dl>

      {seat?.releaseBlockReason ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          {seat.releaseBlockReason}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      {okMsg ? (
        <p className="text-sm text-teal-700 dark:text-teal-300">{okMsg}</p>
      ) : null}

      {canManage ? (
        <div className="flex flex-wrap items-end gap-3">
          {!active ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="launch-sku">Plan para la plaza</Label>
                <Select value={reserveSku} onValueChange={setReserveSku}>
                  <SelectTrigger id="launch-sku" className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="personalized">Personalizado</SelectItem>
                    <SelectItem value="ai_personalized">
                      Asistente IA personalizado
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                disabled={busy || summary.remaining <= 0}
                onClick={() => void onReserve()}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Reservar plaza
              </Button>
              {summary.remaining <= 0 ? (
                <p className="text-xs text-muted-foreground">
                  No hay plazas disponibles.
                </p>
              ) : null}
            </>
          ) : seat?.canRelease ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setReleaseOpen(true)}
            >
              Liberar plaza
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Solo SuperAdmin Total puede reservar o liberar plazas.
        </p>
      )}

      {events.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Historial reciente
          </h4>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {events.slice(0, 8).map((e) => (
              <li key={e.id}>
                {formatDate(e.createdAt)} · {e.eventType}
                {e.actorLabel ? ` · ${e.actorLabel}` : ''}
                {e.reason ? ` — ${e.reason}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AlertDialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar plaza de lanzamiento</AlertDialogTitle>
            <AlertDialogDescription>
              La farmacia seguirá activa con su plan y suscripción actuales. La
              plaza volverá al pool disponible ({summary.remaining + 1} tras
              liberar, máx. {summary.maxSlots}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="release-reason">Motivo (obligatorio)</Label>
            <Textarea
              id="release-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Plaza de prueba liberada tras cambio de plan"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              disabled={busy || reason.trim().length < 3}
              onClick={() => void onRelease()}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar liberación
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}

/** Bloque global Contratos y suscripciones */
export function LaunchPromoGlobalPanel({
  summary,
  seats,
  events,
  canManage,
}: {
  summary: LaunchSeatsSummary;
  seats: LaunchSeatDetail[];
  events: LaunchSeatEvent[];
  canManage: boolean;
}) {
  const activeSeats = seats.filter((s) => s.rawStatus === 'active');

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-300">
          <Rocket className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold">
            Promoción de lanzamiento 2027
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Contador único compartido con la ficha de cada farmacia.
            {canManage
              ? ''
              : ' Solo SuperAdmin Total puede reservar o liberar.'}
          </p>
        </div>
      </div>

      <SummaryStrip summary={summary} />

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Farmacia</th>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Cuota promo</th>
              <th className="px-3 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {activeSeats.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No hay plazas activas.
                </td>
              </tr>
            ) : (
              activeSeats.map((s) => (
                <tr key={s.reservationId} className="border-b border-border/70">
                  <td className="px-3 py-2">
                    <Link
                      href={`/farmacias/${s.pharmacyId}?tab=contrato`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {s.pharmacyName ?? s.pharmacyId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {s.reservedAt ? formatDate(s.reservedAt) : '—'}
                  </td>
                  <td className="px-3 py-2">{s.planLabel}</td>
                  <td className="px-3 py-2">{STATUS_LABEL[s.status]}</td>
                  <td className="px-3 py-2">{s.promoMonthlyLabel}</td>
                  <td className="px-3 py-2 text-xs">
                    <Link
                      href={`/farmacias/${s.pharmacyId}?tab=contrato`}
                      className="underline underline-offset-2"
                    >
                      Gestionar en ficha
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Historial de reservas y liberaciones</h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin eventos registrados (requiere migración 089 en el entorno).
          </p>
        ) : (
          <ul className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            {events.map((e) => (
              <li key={e.id}>
                {formatDate(e.createdAt)} ·{' '}
                <span className="font-medium text-foreground">
                  {e.pharmacyName ?? e.pharmacyId.slice(0, 8)}
                </span>{' '}
                · {e.eventType}
                {e.actorLabel ? ` · ${e.actorLabel}` : ''}
                {e.reason ? ` — ${e.reason}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
