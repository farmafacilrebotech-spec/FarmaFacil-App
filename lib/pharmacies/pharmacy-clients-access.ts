/**
 * Quién puede ver clientes de la farmacia y gestionar el QR impreso.
 * Clientes: Owner / Admin / Farmacéutico (vía orders.view), nunca STAFF
 * sin decisión expresa.
 * QR: Owner / Admin.
 */

import { requireActivePharmacyMembership } from '@/lib/auth/access';
import { requireOrdersView } from '@/lib/orders/authz';
import {
  roleCanManagePharmacyQr,
  roleCanViewPharmacyClients,
} from '@/lib/pharmacies/pharmacy-clients-roles';

export {
  roleCanManagePharmacyQr,
  roleCanViewPharmacyClients,
} from '@/lib/pharmacies/pharmacy-clients-roles';

export async function requirePharmacyClientsAccess(pharmacyId: string): Promise<
  | { ok: true; actorId: string; roleKey: string }
  | { ok: false; error: string }
> {
  const membership = await requireActivePharmacyMembership(pharmacyId);
  if (!membership.ok) {
    return { ok: false, error: 'No tienes acceso activo a esta farmacia.' };
  }
  if (!roleCanViewPharmacyClients(String(membership.membership.roleKey))) {
    return {
      ok: false,
      error:
        'Tu rol no tiene acceso al listado de clientes. Contacta con el propietario o administrador.',
    };
  }
  const orders = await requireOrdersView(pharmacyId);
  if (!orders.ok) {
    return { ok: false, error: orders.error };
  }
  return {
    ok: true,
    actorId: membership.profile.id,
    roleKey: String(membership.membership.roleKey),
  };
}

export async function requirePharmacyQrAccess(pharmacyId: string): Promise<
  | { ok: true; actorId: string; roleKey: string }
  | { ok: false; error: string }
> {
  const membership = await requireActivePharmacyMembership(pharmacyId);
  if (!membership.ok) {
    return { ok: false, error: 'No tienes acceso activo a esta farmacia.' };
  }
  if (!roleCanManagePharmacyQr(String(membership.membership.roleKey))) {
    return {
      ok: false,
      error:
        'Solo el propietario o el administrador pueden gestionar el QR de la farmacia.',
    };
  }
  return {
    ok: true,
    actorId: membership.profile.id,
    roleKey: String(membership.membership.roleKey),
  };
}
