import { redirect } from 'next/navigation';

import { SuppliersHub } from '@/components/suppliers/suppliers-hub';
import { PageHeader } from '@/components/shared/page-header';
import {
  hasKioskInventoryWrite,
  hasKioskPurchasingRead,
  hasKioskPurchasingWrite,
  hasSuppliersRead,
  hasSuppliersWrite,
} from '@/lib/kiosk-inventory/authz';
import {
  listKioskPurchaseDocuments,
  listKioskPurchaseOrders,
} from '@/lib/kiosk-inventory/purchase-queries';
import type { KioskPurchaseDocumentMeta } from '@/lib/kiosk-inventory/purchase-types';
import {
  compareMaterialOffers,
  listSupplierActivity,
  listSupplierContacts,
  listSupplierQuotes,
  listSuppliers,
} from '@/lib/suppliers/queries';
import type {
  SupplierActivityRow,
  SupplierContactRow,
} from '@/lib/suppliers/types';

export const dynamic = 'force-dynamic';

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams?: { material?: string; q?: string; status?: string };
}) {
  if (!(await hasSuppliersRead()) && !(await hasKioskPurchasingRead())) {
    redirect('/access-denied');
  }

  const material = (searchParams?.material ?? '').trim().toLowerCase();
  const [
    suppliersRes,
    quotesRes,
    purchasesRes,
    canWrite,
    canPurchasingWrite,
    canReceive,
    canSeeFinancial,
    compareRes,
  ] = await Promise.all([
    listSuppliers({
      q: searchParams?.q,
      status:
        searchParams?.status === 'archived'
          ? 'archived'
          : searchParams?.status === 'all'
            ? 'all'
            : 'active',
    }),
    listSupplierQuotes(),
    listKioskPurchaseOrders(),
    hasSuppliersWrite(),
    hasKioskPurchasingWrite(),
    hasKioskInventoryWrite(),
    hasKioskPurchasingRead(),
    material
      ? compareMaterialOffers(material)
      : Promise.resolve({ ok: true as const, offers: [] }),
  ]);

  const suppliers = suppliersRes.ok ? suppliersRes.suppliers : [];
  const contactsBySupplier: Record<string, SupplierContactRow[]> = {};
  const activityBySupplier: Record<string, SupplierActivityRow[]> = {};

  await Promise.all(
    suppliers.slice(0, 30).map(async (s) => {
      const [c, a] = await Promise.all([
        listSupplierContacts(s.id),
        listSupplierActivity(s.id, 20),
      ]);
      if (c.ok) contactsBySupplier[s.id] = c.contacts;
      if (a.ok) activityBySupplier[s.id] = a.rows;
    })
  );

  const documentsByOrderId: Record<string, KioskPurchaseDocumentMeta[]> = {};
  if (purchasesRes.ok && canSeeFinancial) {
    await Promise.all(
      purchasesRes.orders.slice(0, 20).map(async (o) => {
        const docs = await listKioskPurchaseDocuments(o.id);
        if (docs.ok) documentsByOrderId[o.id] = docs.documents;
      })
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Proveedores"
        description="Directorio FarmaFácil, presupuestos de materiales y compras. Solo SuperAdmin autorizado. Documentos en Storage privado."
      />
      <SuppliersHub
        suppliers={suppliers}
        quotes={quotesRes.ok ? quotesRes.quotes : []}
        contactsBySupplier={contactsBySupplier}
        activityBySupplier={activityBySupplier}
        compareOffers={compareRes.ok ? compareRes.offers : []}
        compareKey={material}
        purchases={purchasesRes.ok ? purchasesRes.orders : []}
        documentsByOrderId={documentsByOrderId}
        canWrite={canWrite}
        canPurchasingWrite={canPurchasingWrite}
        canReceive={canReceive}
        canSeeFinancial={canSeeFinancial}
        loadError={suppliersRes.ok ? null : suppliersRes.error}
        purchasesError={purchasesRes.ok ? null : purchasesRes.error}
      />
    </div>
  );
}
