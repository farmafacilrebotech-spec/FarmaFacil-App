'use client';

import * as React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import {
  getPharmacyAssistantPendingConsultCountAction,
  listPharmacyAssistantConsultsAction,
  replyPharmacyAssistantConsultAction,
  resolvePharmacyAssistantConsultAction,
} from '@/app/f/[pharmacyId]/asistente/consultas/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  CONSULT_DASHBOARD_POLL_MS,
  type PharmacistConsultStatus,
  type PharmacistConsultSummary,
} from '@/lib/kiosk/assistant/consults/types';
import { cn } from '@/lib/utils';

const STATUS_FILTERS: Array<{
  value: PharmacistConsultStatus | 'all';
  label: string;
}> = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'answered', label: 'Respondidas' },
  { value: 'resolved', label: 'Resueltas' },
  { value: 'expired', label: 'Caducadas' },
];

function statusBadgeClass(status: PharmacistConsultStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'answered':
      return 'bg-sky-50 text-sky-900 border-sky-200';
    case 'resolved':
      return 'bg-emerald-50 text-emerald-900 border-emerald-200';
    case 'expired':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return '';
  }
}

function statusLabel(status: PharmacistConsultStatus): string {
  switch (status) {
    case 'pending':
      return 'Pendiente';
    case 'answered':
      return 'Respondida';
    case 'resolved':
      return 'Resuelta';
    case 'expired':
      return 'Caducada';
    default:
      return status;
  }
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function PharmacyAssistantConsultsPanel({
  pharmacyId,
  initialConsults,
  initialPendingCount,
  canManage,
}: {
  pharmacyId: string;
  initialConsults: PharmacistConsultSummary[];
  initialPendingCount: number;
  canManage: boolean;
}) {
  const [consults, setConsults] = React.useState(initialConsults);
  const [pendingCount, setPendingCount] = React.useState(initialPendingCount);
  const [filter, setFilter] = React.useState<PharmacistConsultStatus | 'all'>(
    'pending'
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialConsults.find((c) => c.status === 'pending')?.id ??
      initialConsults[0]?.id ??
      null
  );
  const [reply, setReply] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const selected = consults.find((c) => c.id === selectedId) ?? null;
  const visible =
    filter === 'all' ? consults : consults.filter((c) => c.status === filter);

  async function refresh() {
    setError(null);
    const [listed, counted] = await Promise.all([
      listPharmacyAssistantConsultsAction(pharmacyId, { limit: 80 }),
      getPharmacyAssistantPendingConsultCountAction(pharmacyId),
    ]);
    if (!listed.ok) {
      setError(listed.error);
      return;
    }
    setConsults(listed.consults);
    if (counted.ok) setPendingCount(counted.count);
  }

  React.useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, CONSULT_DASHBOARD_POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll estable
  }, [pharmacyId]);

  React.useEffect(() => {
    if (!selected) {
      setReply('');
      return;
    }
    setReply(selected.pharmacistReply ?? '');
  }, [selected?.id, selected?.pharmacistReply]);

  async function sendReply() {
    if (!selected || !canManage) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    const result = await replyPharmacyAssistantConsultAction({
      pharmacyId,
      consultId: selected.id,
      reply,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(
      result.late
        ? 'Respuesta guardada (fuera de ventana del kiosko: el cliente ya no la verá en pantalla).'
        : 'Respuesta enviada al kiosko.'
    );
    await refresh();
  }

  async function markResolved() {
    if (!selected || !canManage) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    const result = await resolvePharmacyAssistantConsultAction({
      pharmacyId,
      consultId: selected.id,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(
      result.unchanged ? 'Ya estaba resuelta.' : 'Consulta marcada como resuelta.'
    );
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Bandeja</h2>
          {pendingCount > 0 ? (
            <Badge className="bg-amber-500 text-white hover:bg-amber-500">
              {pendingCount} pendiente{pendingCount === 1 ? '' : 's'}
            </Badge>
          ) : (
            <Badge variant="outline">Sin pendientes</Badge>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm',
              filter === f.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted/50'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {visible.length === 0 ? (
              <li className="px-4 py-8 text-sm text-muted-foreground">
                No hay consultas en este filtro.
              </li>
            ) : (
              visible.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      'flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/40',
                      selectedId === c.id && 'bg-muted/60'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        {c.displayCode}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {c.channel === 'customer_portal'
                            ? 'Portal'
                            : 'Kiosko'}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(c.status)}
                        >
                          {statusLabel(c.status)}
                        </Badge>
                      </div>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {c.clientMessage}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatWhen(c.createdAt)}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card className="space-y-4 p-4">
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Selecciona una consulta para ver el detalle.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold">
                    {selected.displayCode}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Recibida {formatWhen(selected.createdAt)} · Caduca kiosko{' '}
                    {formatWhen(selected.expiresAt)}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={statusBadgeClass(selected.status)}
                >
                  {statusLabel(selected.status)}
                </Badge>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Mensaje del cliente
                </p>
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground">
                  {selected.clientMessage}
                </p>
              </div>

              <div>
                <label
                  htmlFor="consult-reply"
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Respuesta al kiosko
                </label>
                <textarea
                  id="consult-reply"
                  rows={5}
                  value={reply}
                  disabled={!canManage || busy || selected.status === 'resolved'}
                  onChange={(e) => setReply(e.target.value)}
                  maxLength={2000}
                  placeholder="Respuesta clara y breve. Evita datos personales."
                  className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={
                    !canManage ||
                    busy ||
                    !reply.trim() ||
                    selected.status === 'resolved'
                  }
                  onClick={() => void sendReply()}
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Enviar respuesta
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    !canManage ||
                    busy ||
                    selected.status === 'resolved' ||
                    selected.status === 'pending'
                  }
                  onClick={() => void markResolved()}
                >
                  Marcar resuelta
                </Button>
              </div>

              {!canManage ? (
                <p className="text-sm text-muted-foreground">
                  Solo puedes consultar. Se necesita permiso de farmacéutico
                  para responder.
                </p>
              ) : null}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
