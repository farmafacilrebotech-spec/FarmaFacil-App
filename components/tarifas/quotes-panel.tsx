'use client';

import * as React from 'react';
import {
  Download,
  FileStack,
  Mail,
  FileSignature,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import type { CommercialQuoteListItem } from '@/lib/commercial/quote-types';
import {
  COMMERCIAL_QUOTE_STATUS_LABELS,
  type CommercialQuoteStatus,
} from '@/lib/commercial/quote-types';
import {
  downloadQuoteHtmlFile,
  openQuotePrintWindow,
} from '@/lib/commercial/quote-document';
import { formatCentsEur } from '@/lib/tarifas';
import {
  getCommercialQuoteDocumentAction,
  getCommercialEmailSendReadiness,
  sendCommercialQuoteEmailAction,
  updateCommercialQuoteStatusAction,
} from '@/app/(app)/tarifas/quote-actions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export function QuotesPanel({
  quotes,
  loadError,
  canManage,
  emailReady,
  emailMissing,
  onPrepareContract,
}: {
  quotes: CommercialQuoteListItem[];
  loadError?: string | null;
  canManage: boolean;
  emailReady: boolean;
  emailMissing: string[];
  onPrepareContract?: (pharmacyId: string | null) => void;
}) {
  const router = useRouter();
  const lock = React.useRef(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(
    quotes[0]?.id ?? null
  );
  const [busy, setBusy] = React.useState(false);
  const [sendOpen, setSendOpen] = React.useState(false);

  React.useEffect(() => {
    if (!selectedId && quotes[0]) setSelectedId(quotes[0].id);
    if (selectedId && !quotes.some((q) => q.id === selectedId)) {
      setSelectedId(quotes[0]?.id ?? null);
    }
  }, [quotes, selectedId]);

  const selected = quotes.find((q) => q.id === selectedId) ?? null;

  async function downloadSelected() {
    if (!selected || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await getCommercialQuoteDocumentAction(selected.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      openQuotePrintWindow(result.html);
      downloadQuoteHtmlFile(result.html, result.filename);
      toast.success('Presupuesto listo para guardar como PDF.', {
        description:
          'Se ha abierto la impresión del sistema y una copia HTML descargable.',
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se ha podido generar el PDF.'
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  async function changeStatus(status: CommercialQuoteStatus) {
    if (!selected || lock.current || !canManage) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await updateCommercialQuoteStatusAction({
        quoteId: selected.id,
        status,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Estado → ${COMMERCIAL_QUOTE_STATUS_LABELS[status]}`);
      router.refresh();
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  async function confirmSend() {
    if (!selected || lock.current || !canManage) return;
    if (!emailReady) {
      toast.error('Envío por email no disponible', {
        description: `Falta configurar: ${(emailMissing.length
          ? emailMissing
          : ['RESEND_API_KEY', 'EMAIL_FROM']
        ).join(', ')}. No se ha enviado ningún correo.`,
      });
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      // Revalidar readiness en servidor (no confiar solo en el flag de página).
      const readiness = await getCommercialEmailSendReadiness();
      if (!readiness.canSend) {
        toast.error('Envío por email no disponible', {
          description: `Falta configurar: ${readiness.missing.join(', ')}. No se ha enviado ningún correo.`,
        });
        setSendOpen(false);
        return;
      }
      const result = await sendCommercialQuoteEmailAction({
        quoteId: selected.id,
        confirmed: true,
      });
      if (!result.ok) {
        toast.error(result.error, {
          description: 'No se ha enviado ningún correo.',
        });
        return;
      }
      if (result.emailStatus !== 'sent') {
        toast.error('El presupuesto no se ha enviado.', {
          description: 'Revisa la configuración de email del servidor.',
        });
        return;
      }
      toast.success(`Presupuesto enviado a ${result.to}`);
      setSendOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col items-start gap-3 p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            Presupuestos guardados
          </h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Borradores, enviados, aceptados y rechazados con snapshot de
            importes. La aceptación no firma ni activa servicios. El piloto se
            gestiona aparte.
          </p>
          {!emailReady ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Envío por email no disponible. Falta configurar:{' '}
              {(emailMissing.length
                ? emailMissing
                : ['RESEND_API_KEY', 'EMAIL_FROM']
              ).join(', ')}
              . No se enviará ningún correo hasta entonces; la descarga del
              presupuesto sí está disponible.
            </p>
          ) : null}
        </div>
      </Card>

      <Card className="overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Cliente / farmacia
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Plan
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Modalidad
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Total año 1
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Estado
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Actualizado
                </th>
              </tr>
            </thead>
            <tbody>
              {loadError ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-destructive"
                  >
                    {loadError}
                  </td>
                </tr>
              ) : quotes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <FileStack className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          Sin presupuestos almacenados
                        </p>
                        <p className="max-w-md text-sm text-muted-foreground">
                          Guarda una propuesta desde el simulador asociando
                          farmacia y persona de contacto.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                quotes.map((q) => (
                  <tr
                    key={q.id}
                    className={cn(
                      'cursor-pointer border-b border-border/70 last:border-0 hover:bg-muted/30',
                      selectedId === q.id && 'bg-primary/5'
                    )}
                    onClick={() => setSelectedId(q.id)}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">
                        {q.pharmacyName || q.prospectName || '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {q.referenceCode ?? q.id.slice(0, 8)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 capitalize">
                      {q.commercialSkuKey.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-2.5">
                      {q.billingInterval === 'monthly' ? 'Mensual' : 'Anual'}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {formatCentsEur(q.firstYearGrossCents)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline">
                        {COMMERCIAL_QUOTE_STATUS_LABELS[q.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {formatDate(q.updatedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selected ? (
        <Card className="space-y-4 p-5 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Detalle · {selected.referenceCode ?? selected.id.slice(0, 8)}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {selected.contactName} · {selected.contactEmail}
              </p>
              <p className="text-xs text-muted-foreground">
                Vigencia:{' '}
                {selected.validUntil ? formatDate(selected.validUntil) : '—'}
              </p>
            </div>
            <Badge variant="secondary">
              {COMMERCIAL_QUOTE_STATUS_LABELS[selected.status]}
            </Badge>
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Row
              label="Pago inicial neto"
              value={formatCentsEur(selected.oneTimeNetCents)}
            />
            <Row
              label="Cuota recurrente neta"
              value={formatCentsEur(selected.recurringNetCents)}
            />
            <Row
              label="Año 1 neto"
              value={formatCentsEur(selected.firstYearNetCents)}
            />
            <Row
              label="Año 1 con IVA"
              value={formatCentsEur(selected.firstYearGrossCents)}
            />
            <Row
              label="Alta aplicación"
              value={
                selected.snapshot
                  ? formatCentsEur(selected.snapshot.appSignupFeeCents)
                  : '—'
              }
            />
            <Row
              label="Personalización kiosko"
              value={
                selected.snapshot
                  ? formatCentsEur(selected.snapshot.hardwareCents)
                  : '—'
              }
            />
            <Row
              label="Instalación presencial"
              value={
                selected.snapshot?.onsiteInstallIncluded
                  ? 'Incluida (sin importe)'
                  : 'No incluida'
              }
            />
            <Row label="Kioskos" value={String(selected.kioskCount)} />
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() => void downloadSelected()}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Descargar presupuesto
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={busy || !canManage || !selected.contactEmail}
              title={
                emailReady
                  ? 'Enviar presupuesto al email de contacto'
                  : `Envío no disponible. Falta: ${(emailMissing.length
                      ? emailMissing
                      : ['RESEND_API_KEY', 'EMAIL_FROM']
                    ).join(', ')}`
              }
              onClick={() => {
                if (!emailReady) {
                  toast.error('Envío por email no disponible', {
                    description: `Falta configurar: ${(emailMissing.length
                      ? emailMissing
                      : ['RESEND_API_KEY', 'EMAIL_FROM']
                    ).join(', ')}. La descarga del presupuesto sí está disponible. No se ha enviado ningún correo.`,
                  });
                }
                setSendOpen(true);
              }}
            >
              <Mail className="h-4 w-4" />
              {emailReady
                ? 'Enviar por email'
                : 'Enviar por email (no disponible)'}
            </Button>
            {selected.status === 'accepted' ? (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  onPrepareContract?.(selected.pharmacyId)
                }
              >
                <FileSignature className="h-4 w-4" />
                Preparar contrato
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Cambiar estado</span>
            <Select
              disabled={!canManage || busy}
              onValueChange={(v) =>
                void changeStatus(v as CommercialQuoteStatus)
              }
            >
              <SelectTrigger className="h-8 w-[180px]">
                <SelectValue placeholder="Seleccionar…" />
              </SelectTrigger>
              <SelectContent>
                {(
                  [
                    'draft',
                    'sent',
                    'accepted',
                    'rejected',
                    'expired',
                  ] as CommercialQuoteStatus[]
                ).map((s) => (
                  <SelectItem key={s} value={s} disabled={s === selected.status}>
                    {COMMERCIAL_QUOTE_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Historial
            </h4>
            {selected.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin eventos.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {selected.history
                  .slice()
                  .reverse()
                  .map((h, i) => (
                    <li
                      key={`${h.at}-${i}`}
                      className="rounded-md border border-border/70 px-3 py-2"
                    >
                      <span className="font-medium">
                        {h.from
                          ? `${COMMERCIAL_QUOTE_STATUS_LABELS[h.from]} → `
                          : ''}
                        {COMMERCIAL_QUOTE_STATUS_LABELS[h.to]}
                      </span>
                      <span className="text-muted-foreground">
                        {' '}
                        · {formatDateTime(h.at)}
                      </span>
                      {h.note ? (
                        <div className="text-xs text-muted-foreground">
                          {h.note}
                        </div>
                      ) : null}
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Envíos de email
            </h4>
            {selected.emailSends.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin envíos.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {selected.emailSends
                  .slice()
                  .reverse()
                  .map((e, i) => (
                    <li
                      key={`${e.at}-${i}`}
                      className="rounded-md border border-border/70 px-3 py-2"
                    >
                      <span className="font-medium">{e.to}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        · {e.status} · {formatDateTime(e.at)}
                      </span>
                      {e.error ? (
                        <div className="text-xs text-destructive">{e.error}</div>
                      ) : null}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </Card>
      ) : null}

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {emailReady
                ? 'Confirmar envío por email'
                : 'Envío por email no disponible'}
            </DialogTitle>
            <DialogDescription>
              {emailReady
                ? 'Se enviará el presupuesto a la dirección de contacto guardada. Solo se usará el remitente configurado en el servidor (EMAIL_FROM).'
                : 'No se puede enviar todavía: faltan variables de entorno en el servidor. No se ha enviado ni se enviará ningún correo hasta configurarlas.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              Destinatario:{' '}
              <strong>{selected?.contactEmail ?? '—'}</strong>
            </p>
            {!emailReady ? (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-100">
                Falta configurar:{' '}
                <strong>
                  {(emailMissing.length
                    ? emailMissing
                    : ['RESEND_API_KEY', 'EMAIL_FROM']
                  ).join(', ')}
                </strong>
                . Puedes descargar el presupuesto mientras tanto.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Tras confirmar, se registrará la fecha, el destinatario y el
                estado del envío. No se mostrará éxito si el envío falla.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setSendOpen(false)}
            >
              {emailReady ? 'Cancelar' : 'Cerrar'}
            </Button>
            <Button
              type="button"
              disabled={busy || !emailReady || !canManage}
              onClick={() => void confirmSend()}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando…
                </>
              ) : emailReady ? (
                'Confirmar y enviar'
              ) : (
                'Envío no disponible'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums font-medium text-foreground">{value}</dd>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES');
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-ES');
}
