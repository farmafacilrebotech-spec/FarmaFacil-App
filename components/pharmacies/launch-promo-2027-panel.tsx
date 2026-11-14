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
import {
  LAUNCH_PROMO_ECONOMY_TABLE,
  launchPromoEconomyForSku,
  launchSeatEventLabelEs,
} from '@/lib/pharmacies/launch-seats-ui';
import { formatEurFromCents } from '@/lib/pharmacies/commercial-assign-pricing';
import { commercialPlanLabel } from '@/lib/commercial/commercial-plan-labels';
import { formatDate } from '@/lib/format';
import {
  confirmLaunchSeatAction,
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

function EconomyBlock({ sku }: { sku: string }) {
  const eco = launchPromoEconomyForSku(sku);
  return (
    <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 px-3 py-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-200">
        Evolución económica del plan asociado a la plaza
      </p>
      <ul className="mt-2 space-y-1 text-muted-foreground">
        {eco.discountLines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <dl className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">2027</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {eco.y2027Label}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">2028</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {eco.y2028Label}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">2029 y posteriores</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {eco.y2029Label}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        Solo SaaS. La cuota mensual de uso del kiosko FarmaFácil no participa
        en estos descuentos.
      </p>
    </div>
  );
}

/** Tabla global: tres planes comerciales 2027 / 2028 / 2029+. */
function GlobalEconomyTable() {
  return (
    <div className="overflow-x-auto rounded-lg border border-teal-500/20 bg-teal-500/5 px-3 py-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-200">
        Evolución económica SaaS (tres planes)
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        2027 (−60 %), 2028 (−30 %) y 2029 y posteriores (tarifa normal). Distinto
        del plan activo de la farmacia y del plan promocional reservado en una
        plaza.
      </p>
      <table className="mt-3 w-full min-w-[480px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-1.5 pr-2 font-medium">Plan</th>
            <th className="py-1.5 pr-2 font-medium">2027</th>
            <th className="py-1.5 pr-2 font-medium">2028</th>
            <th className="py-1.5 font-medium">2029 y posteriores</th>
          </tr>
        </thead>
        <tbody>
          {LAUNCH_PROMO_ECONOMY_TABLE.map((row) => (
            <tr key={row.planId} className="border-t border-border/60">
              <td className="py-1.5 pr-2 font-medium text-foreground">
                {row.planLabel}
              </td>
              <td className="py-1.5 pr-2 tabular-nums">
                {formatEurFromCents(row.y2027Cents)}
              </td>
              <td className="py-1.5 pr-2 tabular-nums">
                {formatEurFromCents(row.y2028Cents)}
              </td>
              <td className="py-1.5 tabular-nums">
                {formatEurFromCents(row.y2029Cents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        Solo SaaS. La cuota mensual de uso del kiosko FarmaFácil no participa
        en estos descuentos.
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
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [confirmNotes, setConfirmNotes] = React.useState('');
  const [reserveSku, setReserveSku] = React.useState(
    currentPlanKey === 'personalized' || currentPlanKey === 'personalizado'
      ? 'personalized'
      : currentPlanKey === 'ai_personalized' ||
          currentPlanKey === 'asistente_ia_personalizado'
        ? 'ai_personalized'
        : 'general'
  );

  const active = seat && seat.rawStatus === 'active';
  const isReserved = seat?.status === 'reserved';
  const isConfirmed = seat?.status === 'confirmed';
  const economySku = seat?.commercialSkuKey || reserveSku;

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

  async function onConfirm() {
    setError(null);
    setOkMsg(null);
    setBusy(true);
    const r = await confirmLaunchSeatAction(
      pharmacyId,
      'staging_fixture',
      confirmNotes.trim() || '[STAGING_FIXTURE]'
    );
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setConfirmOpen(false);
    setOkMsg(
      `${r.message} No activa piloto, no cambia el plan ni genera cobros.`
    );
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
            Primeras {summary.maxSlots} farmacias. Confirmar o liberar no activa
            piloto, no contrata servicios ni genera cobros.
          </p>
        </div>
      </div>

      <SummaryStrip summary={summary} />
      <EconomyBlock sku={economySku} />

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
        <Field
          label="Plan activo de la farmacia"
          value={
            currentPlanKey ? commercialPlanLabel(currentPlanKey) : 'Sin plan'
          }
        />
        <Field
          label="Plan promocional reservado"
          value={
            seat?.planLabel
              ? `${seat.planLabel} (${STATUS_LABEL[seat.status] ?? seat.status})`
              : 'Sin plaza promocional'
          }
        />
        <Field
          label="Estado de la plaza"
          value={STATUS_LABEL[seat?.status ?? 'none']}
        />
        <Field
          label="Fecha de reserva"
          value={seat?.reservedAt ? formatDate(seat.reservedAt) : '—'}
        />
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
          value={seat?.reservedByLabel?.trim() || '—'}
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
          ) : isReserved ? (
            <>
              <Button
                type="button"
                className="bg-[#1ABBB3] text-white hover:bg-[#159e97]"
                disabled={busy}
                onClick={() => setConfirmOpen(true)}
              >
                Confirmar plaza
              </Button>
              {seat?.canRelease ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#1ABBB3] text-[#1ABBB3] hover:bg-[#1ABBB3]/10"
                  disabled={busy}
                  onClick={() => setReleaseOpen(true)}
                >
                  Liberar plaza
                </Button>
              ) : null}
            </>
          ) : isConfirmed ? (
            <p className="text-xs text-muted-foreground">
              Plaza confirmada. Liberación ordinaria no disponible.
            </p>
          ) : seat?.canRelease ? (
            <Button
              type="button"
              variant="outline"
              className="border-[#1ABBB3] text-[#1ABBB3] hover:bg-[#1ABBB3]/10"
              disabled={busy}
              onClick={() => setReleaseOpen(true)}
            >
              Liberar plaza
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Solo SuperAdmin Total puede reservar, confirmar o liberar plazas.
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
                {formatDate(e.createdAt)} · {launchSeatEventLabelEs(e.eventType)}
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
              plaza volverá al pool disponible. No cambia el piloto ni genera
              cobros.
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar plaza de lanzamiento</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma la reserva promocional. No activa piloto, no cambia el
              plan activo ni genera cobros. En staging se usa fixture de
              formalización.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-notes">Notas</Label>
            <Textarea
              id="confirm-notes"
              value={confirmNotes}
              onChange={(e) => setConfirmNotes(e.target.value)}
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              className="bg-[#1ABBB3] text-white hover:bg-[#159e97]"
              disabled={busy}
              onClick={() => void onConfirm()}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar plaza
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
      <GlobalEconomyTable />

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
            Sin eventos de reserva o liberación registrados todavía.
          </p>
        ) : (
          <ul className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            {events.map((e) => (
              <li key={e.id}>
                {formatDate(e.createdAt)} ·{' '}
                <span className="font-medium text-foreground">
                  {e.pharmacyName ?? e.pharmacyId.slice(0, 8)}
                </span>{' '}
                · {launchSeatEventLabelEs(e.eventType)}
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
