'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  Download,
  Eye,
  FileText,
  Loader2,
  Mail,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import {
  downloadContractPdfAction,
  previewContractAction,
  sendContractEmailAction,
  upsertContractDraftAction,
} from '@/app/(app)/contratos/actions';
import type { CommercialContractListItem } from '@/lib/contracts/types';
import type { ContractPreviewModel } from '@/lib/contracts/types';
import { CONTRACT_TEMPLATE_LABELS } from '@/lib/contracts/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type AcceptedQuoteOption = {
  id: string;
  referenceCode: string | null;
  pharmacyName: string | null;
  planName: string | null;
  kioskCount: number;
  contactEmail: string | null;
};

export function ContractsWorkspace({
  contracts,
  contractsError,
  acceptedQuotes,
  emailReady,
  emailMissing,
  initialQuoteId,
  canManage,
}: {
  contracts: CommercialContractListItem[];
  contractsError?: string | null;
  acceptedQuotes: AcceptedQuoteOption[];
  emailReady: boolean;
  emailMissing: string[];
  initialQuoteId?: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [quoteId, setQuoteId] = React.useState(
    initialQuoteId ?? acceptedQuotes[0]?.id ?? ''
  );
  const [signerName, setSignerName] = React.useState('');
  const [signerNif, setSignerNif] = React.useState('');
  const [signerTitle, setSignerTitle] = React.useState('');
  const [preview, setPreview] = React.useState<ContractPreviewModel | null>(
    null
  );
  const [busy, setBusy] = React.useState(false);
  const lock = React.useRef(false);

  React.useEffect(() => {
    if (initialQuoteId) setQuoteId(initialQuoteId);
  }, [initialQuoteId]);

  const prepareInput = () => ({
    quoteId,
    pharmacySignerName: signerName,
    pharmacySignerNif: signerNif,
    pharmacySignerTitle: signerTitle,
  });

  async function runPreview() {
    if (!quoteId || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await previewContractAction(prepareInput());
      if (!result.ok) {
        toast.error(result.error);
        setPreview(null);
        return;
      }
      setPreview(result.preview);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  async function saveDraft() {
    if (!quoteId || lock.current || !canManage) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await upsertContractDraftAction(prepareInput());
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        'Borrador guardado. No firma ni activa el servicio. ReBoTech pendiente no impide guardar.'
      );
      router.refresh();
      await runPreviewQuiet();
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  async function runPreviewQuiet() {
    const result = await previewContractAction(prepareInput());
    if (result.ok) setPreview(result.preview);
  }

  async function downloadPdf() {
    if (!quoteId || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await downloadContractPdfAction({
        ...prepareInput(),
        signable: false,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const bin = atob(result.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        result.isDraft
          ? 'PDF de borrador descargado (no firmable).'
          : 'PDF descargado.'
      );
      router.refresh();
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  async function sendEmail() {
    if (!quoteId || lock.current || !canManage) return;
    if (!emailReady) {
      toast.error(
        `Envío no disponible: falta ${emailMissing.join(', ') || 'configuración de email'}. No se marca como enviado.`
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const result = await sendContractEmailAction(prepareInput());
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const dry =
        typeof result.providerId === 'string' &&
        /^dry-run-/i.test(result.providerId);
      toast.success(
        dry
          ? 'Envío simulado [PRUEBA STAGING] (sin Resend).'
          : 'Email enviado (confirmado por el proveedor).'
      );
      router.refresh();
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="space-y-4">
        <Card className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <Image
              src="/images/logos/farmafacil-logo-512.png"
              alt="FarmaFácil"
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-full object-contain"
            />
            <div>
              <h2 className="text-base font-semibold">
                Preparar desde presupuesto
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Plantilla maestra única. Aceptar presupuesto no firma ni activa
                el servicio. ReBoTech pendiente: borradores sí; firma y emisión
                definitiva no.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Presupuesto aceptado</Label>
            <Select
              value={quoteId || undefined}
              onValueChange={(v) => {
                setQuoteId(v);
                setPreview(null);
              }}
              disabled={!canManage || busy}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar presupuesto…" />
              </SelectTrigger>
              <SelectContent>
                {acceptedQuotes.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {(q.referenceCode ?? q.id.slice(0, 8)) +
                      ' · ' +
                      (q.pharmacyName ?? 'Sin farmacia') +
                      (q.planName ? ` · ${q.planName}` : '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {acceptedQuotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay presupuestos aceptados, o la migración 069 aún no está
                aplicada.
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="signer-name">Representante farmacia</Label>
              <Input
                id="signer-name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Nombre y apellidos"
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signer-nif">NIF representante</Label>
              <Input
                id="signer-nif"
                value={signerNif}
                onChange={(e) => setSignerNif(e.target.value)}
                placeholder="NIF/NIE"
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signer-title">Cargo</Label>
              <Input
                id="signer-title"
                value={signerTitle}
                onChange={(e) => setSignerTitle(e.target.value)}
                placeholder="Titular / apoderado…"
                disabled={busy}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="gap-1.5"
              disabled={!quoteId || busy}
              onClick={() => void runPreview()}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Vista previa
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              disabled={!quoteId || busy || !canManage}
              onClick={() => void saveDraft()}
            >
              <Save className="h-4 w-4" />
              Guardar borrador
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              disabled={!quoteId || busy}
              onClick={() => void downloadPdf()}
            >
              <Download className="h-4 w-4" />
              PDF borrador
            </Button>
            <Button
              type="button"
              className="gap-1.5"
              disabled={!quoteId || busy || !canManage}
              onClick={() => void sendEmail()}
            >
              <Mail className="h-4 w-4" />
              {emailReady ? 'Enviar borrador' : 'Envío no disponible'}
            </Button>
          </div>

          {!emailReady ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              Email corporativo no configurado (
              {(emailMissing.length
                ? emailMissing
                : ['RESEND_API_KEY', 'EMAIL_FROM']
              ).join(', ')}
              ). No se simula el envío ni se marca como enviado.
            </p>
          ) : null}
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-base font-semibold">Contratos guardados</h2>
          {contractsError ? (
            <p className="text-sm text-destructive">{contractsError}</p>
          ) : null}
          {contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin borradores aún.</p>
          ) : (
            <ul className="space-y-2">
              {contracts.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    className="text-left font-medium hover:underline"
                    onClick={() => {
                      setQuoteId(c.quoteId);
                      setPreview(null);
                    }}
                  >
                    {c.quoteReference ?? c.quoteId.slice(0, 8)} ·{' '}
                    {CONTRACT_TEMPLATE_LABELS[c.templateKey]}
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{c.lifecycleStatus}</Badge>
                    {c.signedAt ? (
                      <Badge>Firmado</Badge>
                    ) : (
                      <Badge variant="secondary">Borrador / sin firmar</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-5">
        {!preview ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <FileText className="h-10 w-10 opacity-40" />
            <p className="max-w-sm text-sm">
              Genera la vista previa para ver el contrato común, los datos
              faltantes y el estado jurídico / ReBoTech.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Image
                  src="/images/logos/farmafacil-logo-512.png"
                  alt="FarmaFácil"
                  width={48}
                  height={48}
                  className="h-12 w-12 shrink-0 rounded-full object-contain"
                />
                <div>
                  <h2 className="text-base font-semibold">
                    Vista previa — {preview.templateLabel}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {preview.masterTemplateVersion} · Presupuesto{' '}
                    {preview.quoteReference ?? preview.quoteId} · snapshot v
                    {preview.snapshotVersion}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {preview.isDraft ? (
                  <Badge variant="secondary">BORRADOR</Badge>
                ) : null}
                <Badge
                  variant={
                    preview.legalApproval === 'approved'
                      ? 'default'
                      : 'secondary'
                  }
                >
                  {preview.legalApproval === 'approved'
                    ? 'Aprobado jurídico'
                    : 'Borrador jurídico'}
                </Badge>
                <Badge
                  variant={
                    preview.rebotechEntityConfirmed ? 'default' : 'outline'
                  }
                >
                  {preview.rebotechEntityConfirmed
                    ? 'ReBoTech confirmada'
                    : 'ReBoTech pendiente'}
                </Badge>
                <Badge
                  variant={preview.readyForSignature ? 'default' : 'outline'}
                >
                  {preview.readyForSignature
                    ? 'Listo para firmar'
                    : 'Firma bloqueada'}
                </Badge>
              </div>
            </div>

            {preview.isDraft ? (
              <div className="rounded-md border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-sm font-medium text-amber-950 dark:text-amber-100">
                Documento en borrador. No es un contrato definitivo ni firmable
                hasta completar datos, confirmar ReBoTech y aprobar la plantilla
                jurídicamente.
              </div>
            ) : null}

            {preview.missingFields.filter((m) => m.required).length > 0 ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm">
                <div className="mb-2 flex items-center gap-2 font-medium text-amber-950 dark:text-amber-100">
                  <AlertTriangle className="h-4 w-4" />
                  Campos obligatorios pendientes
                </div>
                <ul className="list-disc space-y-1.5 pl-5 text-amber-950/90 dark:text-amber-50/90">
                  {preview.missingFields
                    .filter((m) => m.required)
                    .map((m) => (
                      <li key={m.key}>
                        <span className="font-medium">{m.label}</span>
                        {m.where ? (
                          <span className="text-muted-foreground">
                            {' '}
                            — completar en: {m.where}
                          </span>
                        ) : null}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}

            {preview.unresolvedMarkers.length > 0 ? (
              <div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                Marcadores sin resolver:{' '}
                {preview.unresolvedMarkers.slice(0, 12).join(', ')}
                {preview.unresolvedMarkers.length > 12
                  ? ` (+${preview.unresolvedMarkers.length - 12})`
                  : ''}
              </div>
            ) : null}

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Info
                label="ReBoTech / FarmaFácil"
                value={[
                  preview.farmafacil.legalName,
                  preview.farmafacil.cif
                    ? `CIF ${preview.farmafacil.cif}`
                    : 'CIF pendiente',
                  preview.farmafacil.address ?? 'Domicilio pendiente',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <Info
                label="Farmacia"
                value={[
                  preview.pharmacy.legalName,
                  preview.pharmacy.cif
                    ? `CIF ${preview.pharmacy.cif}`
                    : 'CIF pendiente',
                  preview.pharmacy.address,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <Info
                label="Cuota recurrente (snapshot)"
                value={preview.amounts.formatted.CUOTA_RECURRENTE}
              />
              <Info
                label="Trazabilidad presupuesto"
                value={`${preview.quoteReference ?? preview.quoteId} · v${preview.snapshotVersion}`}
              />
            </div>

            <div
              className={cn(
                'max-h-[520px] overflow-auto rounded-md border border-border bg-muted/20 p-4 text-sm leading-relaxed whitespace-pre-wrap'
              )}
            >
              {preview.filledBody}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 px-3 py-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">{value || '—'}</p>
    </div>
  );
}
