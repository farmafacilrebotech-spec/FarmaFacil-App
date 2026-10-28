'use client';

import * as React from 'react';

import {
  decidePublicQuoteAction,
  establishPublicQuoteSessionAction,
} from '@/app/q/[token]/actions';
import type { PublicQuoteView } from '@/lib/orders/public-quote-map';

function formatEuro(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} €`;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const STATE_COPY: Record<string, string> = {
  awaiting_decision: 'Pendiente de tu respuesta',
  accepted: 'Presupuesto aceptado',
  rejected: 'Presupuesto rechazado',
  expired: 'Presupuesto caducado',
  stale_version: 'Presupuesto actualizado',
  cancelled: 'Solicitud cancelada',
};

function tokenFromPathname(): string {
  if (typeof window === 'undefined') return '';
  const raw = window.location.pathname.split('/q/')[1] ?? '';
  return decodeURIComponent(raw.split('/')[0] ?? '').trim();
}

export function PublicQuoteClient({
  initial,
  sessionKey,
}: {
  initial: Extract<PublicQuoteView, { ok: true }>;
  /** Fingerprint corto ligado a la cookie de ESTE presupuesto (no el token). */
  sessionKey: string;
}) {
  const [quote, setQuote] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [sessionReady, setSessionReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [doneMessage, setDoneMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function establish() {
      const token = tokenFromPathname();
      const result = await establishPublicQuoteSessionAction({
        token,
        sessionKey,
      });
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setSessionReady(false);
        return;
      }
      setSessionReady(true);
    }
    void establish();
    return () => {
      cancelled = true;
    };
  }, [sessionKey]);

  async function decide(decision: 'accepted' | 'rejected') {
    if (busy || !quote.canDecide || !sessionReady) return;
    setBusy(true);
    setError(null);
    const result = await decidePublicQuoteAction({ decision, sessionKey });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDoneMessage(
      decision === 'accepted'
        ? 'Has aceptado el presupuesto. La farmacia podrá preparar tu pedido. No se ha realizado ningún cobro.'
        : 'Has rechazado el presupuesto. La farmacia ha sido informada.'
    );
    setQuote((prev) => ({
      ...prev,
      quoteState: decision === 'accepted' ? 'accepted' : 'rejected',
      canDecide: false,
      decision,
      decidedAt: result.decidedAt,
    }));
  }

  const availableLines = quote.lines.filter((l) => l.availability === 'available');
  const unavailableLines = quote.lines.filter(
    (l) => l.availability === 'unavailable'
  );

  return (
    <div className="mx-auto w-full max-w-lg space-y-5">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          FarmaFácil · Presupuesto
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[#0F2A2E]">
          {quote.pharmacyName}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Solicitud #{quote.displayNumber} · Versión {quote.quoteVersion}
        </p>
        <p className="mt-2 text-sm font-medium text-[#0F2A2E]">
          {STATE_COPY[quote.quoteState] ?? quote.quoteState}
        </p>
      </header>

      {quote.quoteState === 'stale_version' ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          La farmacia ha actualizado el presupuesto. Solicita un enlace nuevo.
        </p>
      ) : null}

      {quote.quoteState === 'expired' ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Este presupuesto caducó el {formatDate(quote.expiresAt)}. Contacta con
          la farmacia si aún lo necesitas.
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Productos</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {availableLines.map((line, idx) => (
            <li key={`a-${idx}`} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {line.productName}
                  </p>
                  <p className="mt-0.5 text-xs text-emerald-700">Disponible</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {line.quantity} × {formatEuro(line.unitPrice, quote.currency)}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-slate-900">
                  {formatEuro(line.lineTotal, quote.currency)}
                </p>
              </div>
            </li>
          ))}
          {unavailableLines.map((line, idx) => (
            <li key={`u-${idx}`} className="bg-slate-50 px-4 py-3 opacity-80">
              <p className="text-sm font-medium text-slate-700 line-through">
                {line.productName}
              </p>
              <p className="mt-0.5 text-xs text-rose-700">No disponible</p>
              <p className="mt-1 text-xs text-slate-500">
                No se incluye en el importe del presupuesto.
              </p>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">Total</span>
          <span className="text-lg font-semibold tabular-nums text-[#0F2A2E]">
            {formatEuro(quote.totalAmount, quote.currency)}
          </span>
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <dt className="text-xs text-slate-500">Caducidad</dt>
          <dd className="mt-0.5 font-medium text-slate-800">
            {formatDate(quote.expiresAt)}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <dt className="text-xs text-slate-500">Decisión</dt>
          <dd className="mt-0.5 font-medium text-slate-800">
            {quote.decidedAt ? formatDate(quote.decidedAt) : '—'}
          </dd>
        </div>
      </dl>

      {doneMessage ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {doneMessage}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </p>
      ) : null}

      {quote.canDecide ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={busy || !sessionReady}
            onClick={() => void decide('accepted')}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#0F2A2E] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Guardando…' : 'Aceptar presupuesto'}
          </button>
          <button
            type="button"
            disabled={busy || !sessionReady}
            onClick={() => void decide('rejected')}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 disabled:opacity-60"
          >
            Rechazar presupuesto
          </button>
        </div>
      ) : null}

      <p className="text-center text-xs text-slate-400">
        No se crea cuenta ni se realiza cobro online. FarmaFácil no comparte este
        enlace con terceros.
      </p>
    </div>
  );
}
