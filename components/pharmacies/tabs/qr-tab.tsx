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
  Layers,
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
  stagingQrFilenames,
} from '@/lib/pharmacies/qr-download';
import {
  buildPharmacyQrPosterPdf,
  downloadBlob,
  isPharmacyQrPosterDownloadEnabled,
  isPharmacyQrPosterTemplateReady,
  pharmacyAccessCartelLayout,
  pharmacyFlyerLayout,
  posterPageFormatLabel,
  PHARMACY_QR_POSTER_AWAITING_APPROVAL_MESSAGE,
  PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE,
  type PosterPageFormat,
} from '@/lib/pharmacies/pharmacy-qr-poster';
import { buildPharmacyAdPosterPdf } from '@/lib/pharmacies/pharmacy-ad-poster';
import { buildPharmacyFlyerSheetPdf } from '@/lib/pharmacies/pharmacy-flyer-sheet';
import {
  defaultWelcomePackContractSlot,
  downloadWelcomePack,
  discardReservedPdfWindow,
  openPdfBlob,
  printPdfBlob,
  reservePdfWindow,
} from '@/lib/pharmacies/pharmacy-welcome-pack';
import { posterDownloadFilename } from '@/lib/pharmacies/pharmacy-poster-meta';
import {
  PHARMACY_MATERIALS_SUPERADMIN_ONLY_MESSAGE,
  PHARMACY_TENANT_MATERIALS_CONTACT_MESSAGE,
} from '@/lib/pharmacies/pharmacy-materials-access';
import { assertPharmacyMaterialsAccessAction } from '@/app/(app)/farmacias/materials-actions';
import {
  isMaterialSafePharmacyPublicUrl,
  pharmacyStagingPublicUrl,
} from '@/lib/pharmacies/print-entrypoint-url';
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
  | 'png-staging'
  | 'svg-staging'
  | 'access-preview'
  | 'access-pdf'
  | 'access-print'
  | 'flyer-preview'
  | 'flyer-pdf'
  | 'flyer-print'
  | 'flyer-sheet'
  | 'ad-preview'
  | 'ad-pdf'
  | 'ad-print'
  | 'pack'
  | null;

type AdFormat = Extract<PosterPageFormat, 'a4' | 'a3'>;

/**
 * QR oficial de la farmacia (mismo public_entrypoints / URL que el kiosko).
 * No regenera el public_id desde la UI (permanente).
 * Material publicitario (carteles, flyers, pliego, vista previa, PDF, impresión,
 * pack): solo con `canGenerateMaterials` (SuperAdmin; calculado en servidor).
 * Owner/Admin: solo PNG/SVG.
 *
 * En staging el material usa por defecto el QR de STAGING (con marca de agua
 * «PRUEBA - STAGING»); el QR oficial de producción sigue descargable aparte.
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
  /** Servidor: FF_APP_ENV=staging o host farmafacil-staging → QR de pruebas + producción. */
  isStagingEnv = false,
}: {
  pharmacyName: string;
  pharmacyLogoUrl?: string | null;
  pharmacyPrimaryColor?: string | null;
  entrypoint: PharmacyHomeEntrypoint | null;
  loadError?: string | null;
  publicUrlOverride?: string | null;
  canGenerateMaterials?: boolean;
  showTenantMaterialsContact?: boolean;
  isStagingEnv?: boolean;
}) {
  const [busy, setBusy] = React.useState<BusyKind>(null);
  const [adFormat, setAdFormat] = React.useState<AdFormat>('a4');

  /** URL de producción (siempre print-safe). */
  const publicUrl = publicUrlOverride?.trim() || entrypoint?.publicUrl || '';
  const stagingUrl =
    isStagingEnv && entrypoint?.publicId
      ? pharmacyStagingPublicUrl(entrypoint.publicId)
      : null;
  /** URL que codifican los materiales: staging en staging, producción si no. */
  const materialUrl = stagingUrl ?? publicUrl;

  function assertMaterialsAllowed(): boolean {
    if (!canGenerateMaterials) {
      toast.error(PHARMACY_MATERIALS_SUPERADMIN_ONLY_MESSAGE);
      return false;
    }
    return true;
  }

  async function assertMaterialsAllowedServer(): Promise<boolean> {
    if (!assertMaterialsAllowed()) return false;
    const gate = await assertPharmacyMaterialsAccessAction();
    if (!gate.ok) {
      toast.error(gate.error);
      return false;
    }
    return true;
  }

  function assertMaterialUrlSafe(): boolean {
    if (
      !isMaterialSafePharmacyPublicUrl(materialUrl, {
        allowStaging: isStagingEnv,
      })
    ) {
      toast.error(
        isStagingEnv
          ? 'El material de pruebas solo admite la URL de staging o la de producción. Revisa la configuración.'
          : 'El material impreso solo se genera con la URL de producción. Revisa la configuración.'
      );
      return false;
    }
    return true;
  }

  async function assertBuildPreconditions() {
    const gate = await assertPharmacyMaterialsAccessAction();
    if (!gate.ok) {
      throw new Error(gate.error);
    }
    if (!entrypoint || !materialUrl) {
      throw new Error('Falta el acceso público de la farmacia');
    }
    if (!assertMaterialUrlSafe()) {
      throw new Error('URL no apta para el material');
    }
    return entrypoint;
  }

  async function buildAccessPdf() {
    const ep = await assertBuildPreconditions();
    const layout = pharmacyAccessCartelLayout();
    if (!isPharmacyQrPosterTemplateReady(layout)) {
      throw new Error(PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE);
    }
    if (!isPharmacyQrPosterDownloadEnabled(layout)) {
      throw new Error(PHARMACY_QR_POSTER_AWAITING_APPROVAL_MESSAGE);
    }
    // Cartel A5 original sin huecos de logo/nombre: solo se personaliza el QR.
    return buildPharmacyQrPosterPdf({
      pharmacyName,
      publicUrl: materialUrl,
      publicId: ep.publicId,
      primaryColor: pharmacyPrimaryColor,
      layout,
      kind: 'acceso',
      staging: isStagingEnv,
    });
  }

  async function buildFlyerPdf() {
    const ep = await assertBuildPreconditions();
    const layout = pharmacyFlyerLayout();
    if (!isPharmacyQrPosterTemplateReady(layout)) {
      throw new Error(PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE);
    }
    return buildPharmacyQrPosterPdf({
      pharmacyName,
      publicUrl: materialUrl,
      publicId: ep.publicId,
      logoUrl: pharmacyLogoUrl,
      primaryColor: pharmacyPrimaryColor,
      layout,
      kind: 'flyer',
      staging: isStagingEnv,
    });
  }

  async function buildAdPdf(format: AdFormat) {
    const ep = await assertBuildPreconditions();
    return buildPharmacyAdPosterPdf({
      pharmacyName,
      publicUrl: materialUrl,
      publicId: ep.publicId,
      format,
      pharmacyLogoUrl,
      primaryColor: pharmacyPrimaryColor,
      staging: isStagingEnv,
    });
  }

  /** Resultado de abrir el PDF en pestaña nueva (aviso si el navegador la bloquea). */
  function notifyPopupBlocked(opened: boolean) {
    if (!opened) {
      toast.warning(
        'El navegador ha bloqueado la pestaña nueva. Permite ventanas emergentes para este sitio o usa «Descargar PDF».'
      );
    }
  }

  /**
   * Preview / descarga / impresión comunes. La pestaña de vista previa se
   * reserva ANTES de cualquier await (si no, el navegador la bloquea).
   */
  async function runPreview(
    kind: BusyKind,
    build: () => Promise<{ blob: Blob; nameWarning?: string | null }>,
    okMessage: string
  ) {
    setBusy(kind);
    const reserved = reservePdfWindow();
    try {
      const { blob, nameWarning } = await build();
      const opened = openPdfBlob(blob, reserved);
      notifyPopupBlocked(opened);
      if (nameWarning) toast.warning(nameWarning);
      else if (opened) toast.success(okMessage);
    } catch (err) {
      discardReservedPdfWindow(reserved);
      toast.error(err instanceof Error ? err.message : 'No se pudo previsualizar');
    } finally {
      setBusy(null);
    }
  }

  async function runDownload(
    kind: BusyKind,
    build: () => Promise<{ blob: Blob; nameWarning?: string | null }>,
    filename: string,
    okMessage: string
  ) {
    setBusy(kind);
    try {
      const { blob, nameWarning } = await build();
      downloadBlob(filename, blob);
      if (nameWarning) toast.warning(nameWarning);
      else toast.success(okMessage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo descargar');
    } finally {
      setBusy(null);
    }
  }

  async function runPrint(
    kind: BusyKind,
    build: () => Promise<{ blob: Blob; nameWarning?: string | null }>,
    okMessage: string
  ) {
    setBusy(kind);
    const reserved = reservePdfWindow();
    try {
      const { blob, nameWarning } = await build();
      printPdfBlob(blob, reserved);
      if (nameWarning) toast.warning(nameWarning);
      else toast.success(okMessage);
    } catch (err) {
      discardReservedPdfWindow(reserved);
      toast.error(err instanceof Error ? err.message : 'No se pudo imprimir');
    } finally {
      setBusy(null);
    }
  }

  const fileId = entrypoint?.publicId;
  const accessFilename = () =>
    posterDownloadFilename({
      kind: 'acceso',
      format: 'a5',
      publicId: fileId,
      staging: isStagingEnv,
    });
  const flyerFilename = () =>
    posterDownloadFilename({
      kind: 'flyer',
      format: 'a6',
      publicId: fileId,
      staging: isStagingEnv,
    });
  const adFilename = () =>
    posterDownloadFilename({
      kind: 'publicitario',
      format: adFormat,
      publicId: fileId,
      staging: isStagingEnv,
    });

  async function onFlyerSheetDownload() {
    setBusy('flyer-sheet');
    try {
      const ep = await assertBuildPreconditions();
      const { blob, nameWarning, pages } = await buildPharmacyFlyerSheetPdf({
        pharmacyName,
        publicUrl: materialUrl,
        publicId: ep.publicId,
        logoUrl: pharmacyLogoUrl,
        primaryColor: pharmacyPrimaryColor,
        staging: isStagingEnv,
      });
      downloadBlob(
        posterDownloadFilename({
          kind: 'pliego-flyers',
          format: 'a4',
          publicId: ep.publicId,
          staging: isStagingEnv,
        }),
        blob
      );
      if (nameWarning) toast.warning(nameWarning);
      else toast.success(`Pliego de 10 flyers A6 descargado (${pages} páginas A4)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar el pliego');
    } finally {
      setBusy(null);
    }
  }

  async function onWelcomePack() {
    if (!(await assertMaterialsAllowedServer())) return;
    if (!entrypoint || !materialUrl) return;
    if (!assertMaterialUrlSafe()) return;
    if (!isPharmacyQrPosterDownloadEnabled(pharmacyAccessCartelLayout())) {
      toast.error(PHARMACY_QR_POSTER_AWAITING_APPROVAL_MESSAGE);
      return;
    }
    setBusy('pack');
    try {
      const result = await downloadWelcomePack({
        pharmacyName,
        publicUrl: materialUrl,
        publicId: entrypoint.publicId,
        logoUrl: pharmacyLogoUrl,
        primaryColor: pharmacyPrimaryColor,
        contract: defaultWelcomePackContractSlot(),
        adFormat,
        staging: isStagingEnv,
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
    canGenerateMaterials &&
    isPharmacyQrPosterDownloadEnabled(pharmacyAccessCartelLayout()) &&
    isPharmacyQrPosterTemplateReady(pharmacyFlyerLayout());

  return (
    <div className="space-y-10">
      {stagingUrl && entrypoint ? (
        <QrBlock
          variant="staging"
          pharmacyName={pharmacyName}
          publicId={entrypoint.publicId}
          url={stagingUrl}
          busy={busy}
          setBusy={setBusy}
          canGenerateMaterials={canGenerateMaterials}
          showTenantMaterialsContact={showTenantMaterialsContact}
        />
      ) : null}

      <QrBlock
        variant="production"
        showHeading={Boolean(stagingUrl)}
        pharmacyName={pharmacyName}
        publicId={entrypoint.publicId}
        url={publicUrl}
        busy={busy}
        setBusy={setBusy}
        canGenerateMaterials={canGenerateMaterials}
        showTenantMaterialsContact={showTenantMaterialsContact}
      />

      {showTenantMaterialsContact && !canGenerateMaterials ? (
        <p
          className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
          data-testid="pharmacy-qr-materials-contact"
        >
          {PHARMACY_TENANT_MATERIALS_CONTACT_MESSAGE}
        </p>
      ) : null}

      {canGenerateMaterials ? (
        <section
          className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-soft sm:p-6"
          data-testid="pharmacy-qr-materials"
        >
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Material publicitario
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Material personalizado con los datos actuales de esta farmacia. Se
              regenera al descargarlo; no requiere Canva ni crea accesos nuevos.
            </p>
            {isStagingEnv ? (
              <p
                className="mt-2 rounded-md border border-amber-500/60 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                data-testid="pharmacy-qr-materials-staging-note"
              >
                <strong>PRUEBA — STAGING.</strong> En este entorno el material
                lleva el QR de staging y una marca de agua «PRUEBA - STAGING»; no
                imprimir para farmacias reales. El QR oficial de producción
                (PNG/SVG) se descarga aparte en «QR oficial de producción».
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                El QR de los materiales usa siempre la URL de producción.
              </p>
            )}
          </div>

          {!materialsReady ? (
            <p className="text-xs text-muted-foreground">
              {!isPharmacyQrPosterTemplateReady(pharmacyAccessCartelLayout())
                ? PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE
                : PHARMACY_QR_POSTER_AWAITING_APPROVAL_MESSAGE}{' '}
              PNG y SVG del QR ya están disponibles.
            </p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              <MaterialCard
                testId="pharmacy-material-access"
                title="Plantilla 1 · Cartel acceso mostrador A5"
                description="Cartel corporativo para el mostrador con el QR de acceso de la farmacia. El diseño original no incluye logo ni nombre: solo se personaliza el QR."
                fixedFormatLabel="A5 (148 × 210 mm)"
                busy={busy}
                busyPreview="access-preview"
                busyPdf="access-pdf"
                busyPrint="access-print"
                onPreview={() =>
                  void runPreview(
                    'access-preview',
                    buildAccessPdf,
                    'Vista previa del cartel de acceso A5'
                  )
                }
                onDownload={() =>
                  void runDownload(
                    'access-pdf',
                    buildAccessPdf,
                    accessFilename(),
                    'Cartel de acceso A5 descargado'
                  )
                }
                onPrint={() =>
                  void runPrint(
                    'access-print',
                    buildAccessPdf,
                    'Abriendo impresión del cartel de acceso A5'
                  )
                }
              />
              <MaterialCard
                testId="pharmacy-material-flyer"
                title="Plantilla 2 · Flyer A6"
                description="Flyer de acceso con logotipo, nombre de la farmacia y QR. Descarga uno o el pliego de 10 flyers listo para cortar."
                fixedFormatLabel="A6 (105 × 148 mm)"
                busy={busy}
                busyPreview="flyer-preview"
                busyPdf="flyer-pdf"
                busyPrint="flyer-print"
                onPreview={() =>
                  void runPreview(
                    'flyer-preview',
                    buildFlyerPdf,
                    'Vista previa del flyer A6'
                  )
                }
                onDownload={() =>
                  void runDownload(
                    'flyer-pdf',
                    buildFlyerPdf,
                    flyerFilename(),
                    'Flyer A6 descargado'
                  )
                }
                onPrint={() =>
                  void runPrint(
                    'flyer-print',
                    buildFlyerPdf,
                    'Abriendo impresión del flyer A6'
                  )
                }
                extra={
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    disabled={busy !== null}
                    onClick={() => void onFlyerSheetDownload()}
                  >
                    {busy === 'flyer-sheet' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Layers className="h-3.5 w-3.5" />
                    )}
                    Descargar pliego 10 flyers (A4)
                  </Button>
                }
              />
              <MaterialCard
                testId="pharmacy-material-ad"
                title="Plantilla 3 · Cartel publicitario"
                description="Campaña «¿Y si llevaras tu farmacia en el bolsillo?» con logotipo, nombre y QR de la farmacia."
                format={adFormat}
                formatOptions={[
                  { value: 'a4', label: 'A4 (210 × 297 mm)' },
                  { value: 'a3', label: 'A3 (297 × 420 mm)' },
                ]}
                onFormatChange={(f) => setAdFormat(f === 'a3' ? 'a3' : 'a4')}
                busy={busy}
                busyPreview="ad-preview"
                busyPdf="ad-pdf"
                busyPrint="ad-print"
                onPreview={() =>
                  void runPreview(
                    'ad-preview',
                    () => buildAdPdf(adFormat),
                    'Vista previa del cartel publicitario'
                  )
                }
                onDownload={() =>
                  void runDownload(
                    'ad-pdf',
                    () => buildAdPdf(adFormat),
                    adFilename(),
                    `Cartel publicitario ${posterPageFormatLabel(adFormat)} descargado`
                  )
                }
                onPrint={() =>
                  void runPrint(
                    'ad-print',
                    () => buildAdPdf(adFormat),
                    'Abriendo impresión del cartel publicitario'
                  )
                }
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
                  1 cartel de acceso A5 + pliego de 10 flyers A6 (A4) + 1 cartel
                  publicitario en {posterPageFormatLabel(adFormat)} (según la
                  plantilla 3). El contrato se añadirá cuando la formalización
                  jurídica esté disponible.
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

function QrBlock({
  variant,
  showHeading = true,
  pharmacyName,
  publicId,
  url,
  busy,
  setBusy,
  canGenerateMaterials,
  showTenantMaterialsContact,
}: {
  variant: 'staging' | 'production';
  showHeading?: boolean;
  pharmacyName: string;
  publicId: string;
  url: string;
  busy: BusyKind;
  setBusy: (b: BusyKind) => void;
  canGenerateMaterials: boolean;
  showTenantMaterialsContact: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  const isStaging = variant === 'staging';
  const filenames = isStaging
    ? stagingQrFilenames(publicId)
    : officialQrFilenames(publicId);
  const pngKind: BusyKind = isStaging ? 'png-staging' : 'png';
  const svgKind: BusyKind = isStaging ? 'svg-staging' : 'svg';

  async function copyUrl() {
    if (!url) return;
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('URL copiada');
    } catch {
      toast.error('No se ha podido copiar la URL');
    }
  }

  async function downloadPng() {
    if (!url) return;
    setBusy(pngKind);
    try {
      const dataUrl = await buildOfficialQrPngDataUrl(url);
      downloadDataUrl(filenames.png, dataUrl);
      toast.success(isStaging ? 'PNG de pruebas descargado' : 'PNG descargado');
    } catch {
      toast.error('No se ha podido generar el PNG');
    } finally {
      setBusy(null);
    }
  }

  async function downloadSvg() {
    if (!url) return;
    setBusy(svgKind);
    try {
      const svg = await buildOfficialQrSvgString(url);
      downloadTextFile(filenames.svg, svg);
      toast.success(isStaging ? 'SVG de pruebas descargado' : 'SVG descargado');
    } catch {
      toast.error('No se ha podido generar el SVG');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      className={
        isStaging
          ? 'space-y-4 rounded-xl border-2 border-amber-500/60 bg-amber-50/60 p-4 sm:p-5'
          : 'space-y-4'
      }
      data-testid={isStaging ? 'pharmacy-qr-staging' : 'pharmacy-qr-production'}
    >
      {showHeading ? (
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {isStaging ? 'QR de pruebas STAGING' : 'QR oficial de producción'}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {isStaging
              ? 'Solo para pruebas en el entorno de staging (farmafacil-staging.vercel.app). No imprimir ni colocar en farmacias reales.'
              : 'Enlace canónico app.farmafacil.solutions para escaparate, pegatinas y material impreso. El public_id no cambia.'}
          </p>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <ScannableQr
              value={url}
              size={220}
              label={`${isStaging ? 'QR de pruebas' : 'QR oficial'} de ${pharmacyName}`}
            />
          </div>
          <p className="mt-5 text-sm font-medium text-foreground">
            {pharmacyName}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {publicId}
          </p>
          <p className="mt-3 max-w-sm text-center text-xs text-muted-foreground">
            {isStaging
              ? 'Código de pruebas (staging). Mismo public_id que producción, dominio distinto.'
              : 'Código permanente. Identifica la farmacia; no inicia sesión de clientes ni abre el panel de gestión.'}
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {isStaging ? 'URL pública de pruebas' : 'URL pública oficial'}
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              {isStaging
                ? 'Enlace del entorno de staging para pruebas de QA.'
                : canGenerateMaterials || showTenantMaterialsContact
                  ? 'Enlace de producción para escaparate, pegatinas y material impreso.'
                  : 'Misma URL en kiosko, escaparate, tarjetas y SuperAdmin.'}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input readOnly value={url} className="pl-9 font-mono text-xs" />
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
              {isStaging
                ? 'Descargas del QR de pruebas'
                : 'Descargas del código QR'}
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                className="gap-2"
                disabled={busy !== null}
                onClick={() => void downloadPng()}
              >
                {busy === pngKind ? (
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
                {busy === svgKind ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileCode className="h-4 w-4" />
                )}
                SVG vectorial
              </Button>
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Download className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {isStaging
                ? `Archivos: ${filenames.png} / ${filenames.svg}`
                : 'Ideal para pegatinas y escaparate. El contenido del QR no cambia al renombrar la farmacia.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function MaterialCard({
  testId,
  title,
  description,
  format,
  formatOptions,
  fixedFormatLabel,
  onFormatChange,
  busy,
  busyPreview,
  busyPdf,
  busyPrint,
  onPreview,
  onDownload,
  onPrint,
  extra,
}: {
  testId: string;
  title: string;
  description: string;
  /** Formato seleccionable (solo si hay `formatOptions`). */
  format?: PosterPageFormat;
  formatOptions?: { value: PosterPageFormat; label: string }[];
  /** Formato fijo (sin selector). */
  fixedFormatLabel?: string;
  onFormatChange?: (f: PosterPageFormat) => void;
  busy: BusyKind;
  busyPreview: BusyKind;
  busyPdf: BusyKind;
  busyPrint: BusyKind;
  onPreview: () => void;
  onDownload: () => void;
  onPrint: () => void;
  extra?: React.ReactNode;
}) {
  const selectId = `fmt-${testId}`;
  return (
    <div
      className="space-y-4 rounded-lg border border-border bg-muted/20 p-4"
      data-testid={testId}
    >
      <div>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={selectId} className="text-xs">
          Formato
        </Label>
        {formatOptions && format && onFormatChange ? (
          <Select
            value={format}
            onValueChange={(v) => onFormatChange(v as PosterPageFormat)}
          >
            <SelectTrigger id={selectId} className="w-full sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {formatOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p id={selectId} className="text-sm font-medium text-foreground">
            {fixedFormatLabel}
          </p>
        )}
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
        {extra}
      </div>
    </div>
  );
}
