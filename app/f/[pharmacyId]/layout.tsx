import { redirect } from 'next/navigation';

import {
  redirectPathAfterLostPharmacyAccess,
  requireActivePharmacyMembership,
} from '@/lib/auth/access';
import { loadPharmacyCommercialGate } from '@/lib/pharmacies/commercial-access';
import { loadPharmacyTenantContext } from '@/lib/pharmacies/tenant';
import { PharmacyAccessSuspended } from '@/components/pharmacy-tenant/pharmacy-access-suspended';
import { PharmacyPilotPreparation } from '@/components/pharmacy-tenant/pharmacy-pilot-preparation';
import { PharmacyTenantShell } from '@/components/pharmacy-tenant/pharmacy-tenant-shell';

export const dynamic = 'force-dynamic';

/**
 * Layout tenant: aislado del panel SuperAdmin ((app)).
 * 1) Membership active (cualquier rol) para esta farmacia
 * 2) Resolución comercial (piloto + suscripción):
 *    - preparation → pantalla de preparación (sin shell operativo)
 *    - blocked → pantalla informativa
 *    - operational → contexto + shell
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
    // Perdió acceso a esta farmacia → otra active o selector (validado en servidor).
    redirect(await redirectPathAfterLostPharmacyAccess(params.pharmacyId));
  }

  const commercial = await loadPharmacyCommercialGate(params.pharmacyId);
  if (!commercial.ok) {
    redirect('/access-denied');
  }

  if (commercial.gate.accessMode === 'preparation') {
    return (
      <PharmacyPilotPreparation
        gate={commercial.gate}
        userEmail={membership.profile.email}
      />
    );
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
