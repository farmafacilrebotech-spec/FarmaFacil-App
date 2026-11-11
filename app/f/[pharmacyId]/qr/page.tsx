import { QrCode } from 'lucide-react';

import { QrTab } from '@/components/pharmacies/tabs/qr-tab';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { getPharmacyHomeEntrypoint } from '@/lib/pharmacies/pharmacy-home-entrypoint';
import { requirePharmacyQrAccess } from '@/lib/pharmacies/pharmacy-clients-access';
import { pharmacyPrintPublicUrl } from '@/lib/pharmacies/print-entrypoint-url';
import { loadPharmacyTenantContext } from '@/lib/pharmacies/tenant';

export const dynamic = 'force-dynamic';

export default async function PharmacyQrPage({
  params,
}: {
  params: { pharmacyId: string };
}) {
  const pharmacyId = params.pharmacyId;
  const gate = await requirePharmacyQrAccess(pharmacyId);

  if (!gate.ok) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="QR de mi farmacia"
          description="Código público y cartel para imprimir"
        />
        <EmptyState
          icon={QrCode}
          title="Sin acceso al QR"
          description={gate.error}
        />
      </div>
    );
  }

  const [ep, tenant] = await Promise.all([
    getPharmacyHomeEntrypoint(pharmacyId),
    loadPharmacyTenantContext(pharmacyId),
  ]);

  const pharmacyName =
    tenant.ok && tenant.context.pharmacy.name.trim()
      ? tenant.context.pharmacy.name.trim()
      : 'Farmacia';
  const pharmacyLogoUrl =
    tenant.ok ? tenant.context.pharmacy.logoUrl ?? null : null;
  const pharmacyPrimaryColor =
    tenant.ok ? tenant.context.pharmacy.primaryColor ?? null : null;

  const entrypoint = ep.ok ? ep.entrypoint : null;
  const loadError = ep.ok ? null : ep.error;
  const printUrl =
    entrypoint?.publicId != null
      ? pharmacyPrintPublicUrl(entrypoint.publicId)
      : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="QR de mi farmacia"
        description="Código público de producción y materiales para imprimir"
      />
      <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Las descargas (PNG, SVG y cartel PDF) usan siempre el enlace de
        producción <span className="font-mono">app.farmafacil.solutions</span>,
        nunca localhost ni entornos de prueba.
      </p>
      <QrTab
        pharmacyName={pharmacyName}
        pharmacyLogoUrl={pharmacyLogoUrl}
        pharmacyPrimaryColor={pharmacyPrimaryColor}
        entrypoint={entrypoint}
        loadError={loadError}
        publicUrlOverride={printUrl}
        showPdfPoster
      />
    </div>
  );
}
