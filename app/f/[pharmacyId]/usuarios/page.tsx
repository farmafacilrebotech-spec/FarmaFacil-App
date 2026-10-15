import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/shared/page-header';
import { PharmacyUsersPanel } from '@/components/pharmacies/pharmacy-users-panel';
import {
  listPharmacyMembers,
  listPharmacyRoles,
} from '@/lib/pharmacies/queries';
import { requirePharmacyMembershipManage } from '@/lib/pharmacies/membership-authz';
import { buildPharmacyUsersCapabilities } from '@/lib/pharmacies/membership-capabilities';

export const dynamic = 'force-dynamic';

/**
 * Usuarios y accesos (tenant).
 * Reutiliza PharmacyUsersPanel + invite/membership actions.
 * Autorización: memberships.manage + jerarquía OWNER/ADMIN.
 */
export default async function PharmacyUsuariosPage({
  params,
}: {
  params: { pharmacyId: string };
}) {
  const pharmacyId = params.pharmacyId;
  const auth = await requirePharmacyMembershipManage(pharmacyId);
  if (!auth.ok) {
    redirect(`/f/${pharmacyId}/dashboard`);
  }

  const [members, roles] = await Promise.all([
    listPharmacyMembers(pharmacyId),
    listPharmacyRoles(),
  ]);

  const capabilities = buildPharmacyUsersCapabilities({
    actor: auth.actor,
    roles,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Usuarios y accesos"
        description="Invita y gestiona quién puede entrar a esta farmacia."
      />
      <PharmacyUsersPanel
        pharmacyId={pharmacyId}
        members={members}
        roles={roles}
        capabilities={capabilities}
      />
    </div>
  );
}
