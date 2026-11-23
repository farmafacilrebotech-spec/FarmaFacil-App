'use client';

import * as React from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  FileCode,
  FileImage,
  FileText,
  Link as LinkIcon,
  Loader2,
  Package,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';

import type { PharmacyHomeEntrypoint } from '@/lib/pharmacies/pharmacy-home-entrypoint';
import {
  buildOfficialQrPngDataUrl,
  buildOfficialQrSvgString,
  downloadDataUrl,
  downloadTextFile,
  officialQrFilenames,
} from '@/lib/pharmacies/qr-download';
import {
  buildPharmacyQrPosterPdf,
  downloadBlob,
  isPharmacyQrPosterDownloadEnabled,
  isPharmacyQrPosterTemplateReady,
  pharmacyQrPosterLayoutForFormat,
  posterPageFormatLabel,
  PHARMACY_QR_POSTER_AWAITING_APPROVAL_MESSAGE,
  PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE,
  type PosterPageFormat,
} from '@/lib/pharmacies/pharmacy-qr-poster';
import { buildPharmacyAdPosterPdf } from '@/lib/pharmacies/pharmacy-ad-poster';
import {
  defaultWelcomePackContractSlot,
  downloadWelcomePack,
  openPdfBlob,
  printPdfBlob,
} from '@/lib/pharmacies/pharmacy-welcome-pack';
import {
  PHARMACY_MATERIALS_SUPERADMIN_ONLY_MESSAGE,
  PHARMACY_TENANT_MATERIALS_CONTACT_MESSAGE,
} from '@/lib/pharmacies/pharmacy-materials-access';
import { isPrintSafePharmacyPublicUrl } from '@/lib/pharmacies/print-entrypoint-url';
import { ScannableQr } from '@/components/kiosk/scannable-qr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type BusyKind =
  | 'png'
  | 'svg'
  | 'access-preview'
  | 'access-pdf'
  | 'access-print'
  | 'ad-preview'
  | 'ad-pdf'
  | 'ad-print'
  | 'pack'
  | null;

/**
 * QR oficial de la farmacia (mismo public_entrypoints / URL que el kiosko).
 * No regenera el public_id desde la UI (permanente).
 * Material publicitario (carteles, vista previa, PDF, impresión, pack): solo con
 * `canGenerateMaterials` (SuperAdmin; calculado en servidor). Owner/Admin: solo PNG/SVG.
 */
export function QrTab({
  pharmacyName,
  /** logo_url de pharmacy_branding; null = sin logo (no sustituir por FarmaFácil). */
  pharmacyLogoUrl = null,
  /** primary_color de branding; si contraste insuficiente → fallback oscuro. */
  pharmacyPrimaryColor = null,
  entrypoint,
  loadError,
  /** Sustituye entrypoint.publicUrl (p. ej. URL canónica de producción para impresión). */
  publicUrlOverride,
  /** Solo SuperAdmin (servidor): carteles PDF, vista previa, impresión y pack. */
  canGenerateMaterials = false,
  /** Panel tenant: mensaje para solicitar material personalizado a FarmaFácil. */
  showTenantMaterialsContact = false,
}: {
  pharmacyName: string;
  pharmacyLogoUrl?: string | null;
  pharmacyPrimaryColor?: string | null;
  entrypoint: PharmacyHomeEntrypoint | null;
  loadError?: string | null;
  publicUrlOverride?: string | null;
  canGenerateMaterials?: boolean;
  showTenantMaterialsContact?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState<BusyKind>(null);
  const [accessFormat, setAccessFormat] =
    React.useState<PosterPageFormat>('a4');
  const [adFormat, setAdFormat] = React.useState<PosterPageFormat>('a4');

  const publicUrl = publicUrlOverride?.trim() || entrypoint?.publicUrl || '';

  function assertMaterialsAllowed(): boolean {
    if (!canGenerateMaterials) {
      toast.error(PHARMACY_MATERIALS_SUPERADMIN_ONLY_MESSAGE);
      return false;
    }
    return true;
  }

  function assertPrintSafe(): boolean {
    if (!isPrintSafePharmacyPublicUrl(publicUrl)) {
      toast.error(
        'El material impreso solo se genera con la URL de producción. Revisa la configuración.'
      );
      return false;
    }
    return true;
  }

  function safePublicId(): string {
    return (
      (entrypoint?.publicId || '')
        .replace(/[^a-z0-9-]/gi, '')
        .toLowerCase() || 'farmacia'
    );
  }

  async function copyUrl() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard?.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('URL copiada');
    } catch {
      toast.error('No se ha podido copiar la URL');
    }
  }

  async function downloadPng() {
    if (!entrypoint || !publicUrl) return;
    setBusy('png');
    try {
      const dataUrl = await buildOfficialQrPngDataUrl(publicUrl);
      const { png } = officialQrFilenames(entrypoint.publicId);
      downloadDataUrl(png, dataUrl);
      toast.success('PNG descargado');
    } catch {
      toast.error('No se ha podido generar el PNG');
    } finally {
      setBusy(null);
    }
  }

  async function downloadSvg() {
    if (!entrypoint || !publicUrl) return;
    setBusy('svg');
    try {
      const svg = await buildOfficialQrSvgString(publicUrl);
      const { svg: filename } = officialQrFilenames(entrypoint.publicId);
      downloadTextFile(filename, svg);
      toast.success('SVG descargado');
    } catch {
      toast.error('No se ha podido generar el SVG');
    } finally {
      setBusy(null);
    }
  }

  async function buildAccessPdf(format: PosterPageFormat) {
    if (!canGenerateMaterials) {
      throw new Error(PHARMACY_MATERIALS_SUPERADMIN_ONLY_MESSAGE);
    }
    if (!entrypoint || !publicUrl) {
      throw new Error('Falta el acceso público de la farmacia');
    }
    if (!assertPrintSafe()) {
      throw new Error('URL no apta para impresión');
    }
    if (!isPharmacyQrPosterTemplateReady()) {
      throw new Error(PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE);
    }
    if (!isPharmacyQrPosterDownloadEnabled()) {
      throw new Error(PHARMACY_QR_POSTER_AWAITING_APPROVAL_MESSAGE);
    }
    return buildPharmacyQrPosterPdf({
      pharmacyName,
      publicUrl,
      publicId: entrypoint.publicId,
      logoUrl: pharmacyLogoUrl,
      primaryColor: pharmacyPrimaryColor,
      layout: pharmacyQrPosterLayoutForFormat(format),
    });
  }

  async function buildAdPdf(format: PosterPageFormat) {
    if (!canGenerateMaterials) {
      throw new Error(PHARMACY_MATERIALS_SUPERADMIN_ONLY_MESSAGE);
    }
    if (!entrypoint || !publicUrl) {
      throw new Error('Falta el acceso público de la farmacia');
    }
    if (!assertPrintSafe()) {
      throw new Error('URL no apta para impresión');
    }
    return buildPharmacyAdPosterPdf({
      pharmacyName,
      publicUrl,
      publicId: entrypoint.publicId,
      format,
      pharmacyLogoUrl,
    });
  }

  async function onAccessPreview() {
    setBusy('access-preview');
    try {
      const { blob, nameWarning } = await buildAccessPdf(accessFormat);
      openPdfBlob(blob);
      if (nameWarning) toast.warning(nameWarning);
      else toast.success('Vista previa del cartel de acceso');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo previsualizar');
    } finally {
      setBusy(null);
    }
  }

  async function onAccessDownload() {
    setBusy('access-pdf');
    try {
      const { blob, nameWarning } = await buildAccessPdf(accessFormat);
      downloadBlob(
        `farmafacil-cartel-acceso-${accessFormat}-${safePublicId()}.pdf`,
        blob
      );
      if (nameWarning) toast.warning(nameWarning);
      else toast.success(`Cartel de acceso ${posterPageFormatLabel(accessFormat)} descargado`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo descargar');
    } finally {
      setBusy(null);
    }
  }

  async function onAccessPrint() {
    setBusy('access-print');
    try {
      const { blob, nameWarning } = await buildAccessPdf(accessFormat);
      printPdfBlob(blob);
      if (nameWarning) toast.warning(nameWarning);
      else toast.success('Abriendo impresión del cartel de acceso');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo imprimir');
    } finally {
      setBusy(null);
    }
  }

  async function onAdPreview() {
    setBusy('ad-preview');
    try {
      const { blob } = await buildAdPdf(adFormat);
      openPdfBlob(blob);
      toast.success('Vista previa del cartel publicitario');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo previsualizar');
    } finally {
      setBusy(null);
    }
  }

  async function onAdDownload() {
    setBusy('ad-pdf');
    try {
      const { blob } = await buildAdPdf(adFormat);
      downloadBlob(
        `farmafacil-cartel-publicitario-${adFormat}-${safePublicId()}.pdf`,
        blob
      );
      toast.success(
        `Cartel publicitario ${posterPageFormatLabel(adFormat)} descargado`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo descargar');
    } finally {
      setBusy(null);
    }
  }

  async function onAdPrint() {
    setBusy('ad-print');
    try {
      const { blob } = await buildAdPdf(adFormat);
      printPdfBlob(blob);
      toast.success('Abriendo impresión del cartel publicitario');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo imprimir');
    } finally {
      setBusy(null);
    }
  }

  async function onWelcomePack() {
    if (!assertMaterialsAllowed()) return;
    if (!entrypoint || !publicUrl) return;
    if (!assertPrintSafe()) return;
    if (!isPharmacyQrPosterDownloadEnabled()) {
      toast.error(PHARMACY_QR_POSTER_AWAITING_APPROVAL_MESSAGE);
      return;
    }
    setBusy('pack');
    try {
      const result = await downloadWelcomePack({
        pharmacyName,
        publicUrl,
        publicId: entrypoint.publicId,
        logoUrl: pharmacyLogoUrl,
        primaryColor: pharmacyPrimaryColor,
        contract: defaultWelcomePackContractSlot(),
      });
      if (result.contractNote) {
        toast.message('Pack descargado', {
          description: result.contractNote,
        });
      } else {
        toast.success(`Pack de bienvenida descargado (${result.pages} páginas)`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo generar el pack'
      );
    } finally {
      setBusy(null);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        {loadError}
      </div>
    );
  }

  if (!entrypoint) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        Esta farmacia aún no tiene QR oficial. Vuelve a abrir esta ficha tras
        completar el alta o contacta con soporte si el problema continúa.
      </div>
    );
  }

  const materialsReady =
    canGenerateMaterials && isPharmacyQrPosterDownloadEnabled();

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <ScannableQr
              value={publicUrl}
              size={220}
              label={`QR oficial de ${pharmacyName}`}
            />
          </div>
          <p className="mt-5 text-sm font-medium text-foreground">
            {pharmacyName}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {entrypoint.publicId}
          </p>
          <p className="mt-3 max-w-sm text-center text-xs text-muted-foreground">
            Código permanente. Identifica la farmacia; no inicia sesión de
            clientes ni abre el panel de gestión.
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              URL pública oficial
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              {canGenerateMaterials || showTenantMaterialsContact
                ? 'Enlace de producción para escaparate, pegatinas y material impreso.'
                : 'Misma URL en kiosko, escaparate, tarjetas y SuperAdmin.'}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  readOnly
                  value={publicUrl}
                  className="pl-9 font-mono text-xs"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => void copyUrl()}
                aria-label="Copiar URL"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              Descargas del código QR
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                className="gap-2"
                disabled={busy !== null}
                onClick={() => void downloadPng()}
              >
                {busy === 'png' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileImage className="h-4 w-4" />
                )}
                PNG (alta res.)
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={busy !== null}
                onClick={() => void downloadSvg()}
              >
                {busy === 'svg' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileCode className="h-4 w-4" />
                )}
                SVG vectorial
              </Button>
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Download className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Ideal para pegatinas y escaparate. El contenido del QR no cambia al
              renombrar la farmacia.
            </p>
          </div>
        </div>
      </div>

      {showTenantMaterialsContact && !canGenerateMaterials ? (
        <p
          className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
          data-testid="pharmacy-qr-materials-contact"
        >
          {PHARMACY_TENANT_MATERIALS_CONTACT_MESSAGE}
        </p>
      ) : null}

      {canGenerateMaterials ? (
        <section className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Material publicitario
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Carteles personalizados con el nombre, el logotipo (si existe) y el
              QR de acceso público de esta farmacia. Se regeneran al descargarlos
              con los datos actuales; no requieren Canva ni crean accesos nuevos.
            </p>
          </div>

          {!materialsReady ? (
            <p className="text-xs text-muted-foreground">
              {!isPharmacyQrPosterTemplateReady()
                ? PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE
                : PHARMACY_QR_POSTER_AWAITING_APPROVAL_MESSAGE}{' '}
              PNG y SVG del QR ya están disponibles.
            </p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <MaterialCard
                title="Plantilla 1 · Cartel de acceso QR"
                description="Plantilla corporativa con nombre, logotipo de la farmacia, QR e identidad FarmaFácil."
                format={accessFormat}
                onFormatChange={setAccessFormat}
                busy={busy}
                busyPreview="access-preview"
                busyPdf="access-pdf"
                busyPrint="access-print"
                onPreview={() => void onAccessPreview()}
                onDownload={() => void onAccessDownload()}
                onPrint={() => void onAccessPrint()}
              />
              <MaterialCard
                title="Plantilla 2 · Cartel publicitario"
                description="Campaña «¿Y si llevaras tu farmacia en el bolsillo?» · Consulta · Pide · Recoge."
                format={adFormat}
                onFormatChange={setAdFormat}
                busy={busy}
                busyPreview="ad-preview"
                busyPdf="ad-pdf"
                busyPrint="ad-print"
                onPreview={() => void onAdPreview()}
                onDownload={() => void onAdDownload()}
                onPrint={() => void onAdPrint()}
              />
            </div>
          )}

          {materialsReady ? (
            <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Pack de bienvenida
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Incluye ambos carteles en A4 y A3. El contrato se añadirá cuando
                  la formalización jurídica esté disponible.
                </p>
              </div>
              <Button
                className="gap-2 shrink-0"
                disabled={busy !== null}
                onClick={() => void onWelcomePack()}
              >
                {busy === 'pack' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Package className="h-4 w-4" />
                )}
                Descargar pack de bienvenida
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function MaterialCard({
  title,
  description,
  format,
  onFormatChange,
  busy,
  busyPreview,
  busyPdf,
  busyPrint,
  onPreview,
  onDownload,
  onPrint,
}: {
  title: string;
  description: string;
  format: PosterPageFormat;
  onFormatChange: (f: PosterPageFormat) => void;
  busy: BusyKind;
  busyPreview: BusyKind;
  busyPdf: BusyKind;
  busyPrint: BusyKind;
  onPreview: () => void;
  onDownload: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
      <div>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`fmt-${title}`} className="text-xs">
          Formato
        </Label>
        <Select
          value={format}
          onValueChange={(v) => onFormatChange(v as PosterPageFormat)}
        >
          <SelectTrigger id={`fmt-${title}`} className="w-full sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
            <SelectItem value="a3">A3 (297 × 420 mm)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={busy !== null}
          onClick={onPreview}
        >
          {busy === busyPreview ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          Vista previa
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={busy !== null}
          onClick={onDownload}
        >
          {busy === busyPdf ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          Descargar PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={busy !== null}
          onClick={onPrint}
        >
          {busy === busyPrint ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Printer className="h-3.5 w-3.5" />
          )}
          Imprimir
        </Button>
      </div>
    </div>
  );
}
