import { redirect } from 'next/navigation';

import { requireActivePharmacyMembership } from '@/lib/auth/access';
import { loadPharmacyCommercialGate } from '@/lib/pharmacies/commercial-access';
import { loadPharmacyTenantContext } from '@/lib/pharmacies/tenant';
import { PharmacyAccessSuspended } from '@/components/pharmacy-tenant/pharmacy-access-suspended';
import { PharmacyTenantShell } from '@/components/pharmacy-tenant/pharmacy-tenant-shell';

export const dynamic = 'force-dynamic';

/**
 * Layout tenant: aislado del panel SuperAdmin ((app)).
 * 1) Membership active
 * 2) Operatividad comercial → si no, pantalla informativa (sin datos operativos)
 * 3) Contexto completo solo si operable (evita SELECT de branding/catálogo bloqueados)
 */
export default async function PharmacyTenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { pharmacyId: string };
}) {
  const membership = await requireActivePharmacyMembership(params.pharmacyId);

  if (!membership.ok) {
    if (membership.reason === 'unauthenticated') {
      redirect('/login');
    }
    redirect('/access-denied');
  }

  const commercial = await loadPharmacyCommercialGate(params.pharmacyId);
  if (!commercial.ok) {
    redirect('/access-denied');
  }

  if (!commercial.gate.operable) {
    return (
      <PharmacyAccessSuspended
        gate={commercial.gate}
        userEmail={membership.profile.email}
      />
    );
  }

  const result = await loadPharmacyTenantContext(params.pharmacyId);
  if (!result.ok) {
    if (result.reason === 'unauthenticated') {
      redirect('/login');
    }
    redirect('/access-denied');
  }

  return (
    <PharmacyTenantShell context={result.context}>{children}</PharmacyTenantShell>
  );
}
