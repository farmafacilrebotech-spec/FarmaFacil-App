/**
 * Distinción conceptual entre invitación cancelada y baja de miembro.
 *
 * En BD ambas terminan en status = 'revoked' (cancel_invitation y revoke).
 * accepted_at distingue el historial:
 * - null → nunca aceptó (invitación cancelada o nunca completada)
 * - set  → perteneció a la farmacia (acceso revocado / reincorporación)
 *
 * Módulo puro (sin imports locales) para tests Node strip-types.
 */

const STATUS_LABELS: Record<string, string> = {
  invited: 'Invitado',
  active: 'Activo',
  suspended: 'Suspendido',
  revoked: 'Revocado',
};

/** Invitación cancelada: revoked sin haber aceptado nunca. */
export function isCancelledInvitation(
  status: string,
  acceptedAt: string | null | undefined
): boolean {
  return status === 'revoked' && (acceptedAt == null || acceptedAt === '');
}

/** Ex-miembro: revoked tras haber estado activo (accepted_at set). */
export function isRevokedFormerMember(
  status: string,
  acceptedAt: string | null | undefined
): boolean {
  return status === 'revoked' && !isCancelledInvitation(status, acceptedAt);
}

export function membershipStatusLabel(
  status: string,
  acceptedAt: string | null | undefined
): string {
  if (isCancelledInvitation(status, acceptedAt)) {
    return 'Invitación cancelada';
  }
  return STATUS_LABELS[status] ?? status;
}

/** Tono de badge coherente con la etiqueta (cancelada ≠ baja). */
export function membershipStatusTone(
  status: string,
  acceptedAt: string | null | undefined
): 'success' | 'primary' | 'warning' | 'danger' | 'neutral' {
  if (isCancelledInvitation(status, acceptedAt)) {
    return 'warning';
  }
  switch (status) {
    case 'active':
      return 'success';
    case 'invited':
      return 'primary';
    case 'suspended':
    case 'revoked':
      return 'danger';
    default:
      return 'neutral';
  }
}

export type MembershipListCounts = {
  total: number;
  active: number;
  invited: number;
  cancelledInvitations: number;
  revokedFormer: number;
  suspended: number;
};

/**
 * Contadores del listado visible (misma fuente que la tabla).
 * revoked se parte por accepted_at; no cuenta como «Invitado».
 */
export function summarizeMembershipList(
  members: readonly {
    status: string;
    accepted_at?: string | null;
  }[]
): MembershipListCounts {
  let active = 0;
  let invited = 0;
  let cancelledInvitations = 0;
  let revokedFormer = 0;
  let suspended = 0;

  for (const m of members) {
    if (m.status === 'active') active += 1;
    else if (m.status === 'invited') invited += 1;
    else if (m.status === 'suspended') suspended += 1;
    else if (isCancelledInvitation(m.status, m.accepted_at)) {
      cancelledInvitations += 1;
    } else if (isRevokedFormerMember(m.status, m.accepted_at)) {
      revokedFormer += 1;
    }
  }

  return {
    total: members.length,
    active,
    invited,
    cancelledInvitations,
    revokedFormer,
    suspended,
  };
}

/** Texto de resumen bajo el título del panel (SuperAdmin y tenant). */
export function formatMembershipListSummary(counts: MembershipListCounts): string {
  if (counts.total === 0) {
    return 'Todavía no hay usuarios en esta farmacia.';
  }

  const parts: string[] = [
    `${counts.total} usuario${counts.total === 1 ? '' : 's'}`,
    `${counts.active} activo${counts.active === 1 ? '' : 's'}`,
    `${counts.invited} invitado${counts.invited === 1 ? '' : 's'}`,
  ];

  if (counts.cancelledInvitations > 0) {
    parts.push(
      `${counts.cancelledInvitations} invitación${counts.cancelledInvitations === 1 ? '' : 'es'} cancelada${counts.cancelledInvitations === 1 ? '' : 's'}`
    );
  }
  if (counts.revokedFormer > 0) {
    parts.push(
      `${counts.revokedFormer} revocado${counts.revokedFormer === 1 ? '' : 's'}`
    );
  }
  if (counts.suspended > 0) {
    parts.push(
      `${counts.suspended} suspendido${counts.suspended === 1 ? '' : 's'}`
    );
  }

  return parts.join(' · ');
}

/** Mensaje al intentar invitar de nuevo cuando NO procede reutilizar (idempotencia). */
export function inviteBlockMessageForMembership(
  status: string,
  acceptedAt: string | null | undefined
): string {
  if (status === 'invited') {
    return 'Este email ya tiene una invitación pendiente en esta farmacia. Usa «Reenviar invitación» o «Cancelar invitación» desde la lista.';
  }
  if (status === 'active') {
    return 'Este email ya es miembro activo de esta farmacia.';
  }
  if (status === 'suspended') {
    return 'Este email pertenece a un miembro suspendido de esta farmacia. Reactiva o revoca el acceso desde la lista.';
  }
  // revoked debería resolverse con reinvite desde el diálogo; mensaje de respaldo.
  if (isCancelledInvitation(status, acceptedAt)) {
    return 'Este email ya tuvo una invitación cancelada en esta farmacia.';
  }
  if (status === 'revoked') {
    return 'Este email pertenece a un miembro con acceso revocado en esta farmacia.';
  }
  return 'Este email ya tiene acceso registrado en esta farmacia.';
}

export type InviteAgainstExistingDecision =
  | { kind: 'create' }
  | {
      kind: 'reinvite';
      membershipId: string;
      acceptedAt: string | null;
    }
  | {
      kind: 'block';
      status: string;
      acceptedAt: string | null;
    };

/**
 * Decisión pura al invitar contra una membership ya existente en ESTA farmacia.
 * - null → primera invitación (crear)
 * - revoked → reutilizar fila (reinvite → invited; requiere aceptación)
 * - invited/active/suspended → bloquear
 *
 * No mira otras farmacias: el caller solo pasa la fila de pharmacy_id actual.
 */
export function resolveInviteAgainstExistingMembership(
  existing:
    | {
        id: string;
        status: string;
        accepted_at?: string | null;
      }
    | null
    | undefined
): InviteAgainstExistingDecision {
  if (!existing) {
    return { kind: 'create' };
  }
  if (existing.status === 'revoked') {
    return {
      kind: 'reinvite',
      membershipId: existing.id,
      acceptedAt: existing.accepted_at ?? null,
    };
  }
  return {
    kind: 'block',
    status: existing.status,
    acceptedAt: existing.accepted_at ?? null,
  };
}

export function reinviteConfirmDescription(
  acceptedAt: string | null | undefined
): string {
  if (acceptedAt == null || acceptedAt === '') {
    return 'Se abrirá de nuevo una invitación pendiente para esta farmacia (misma cuenta). No es una reactivación de un empleado que ya estuvo activo.';
  }
  return 'Se creará de nuevo una invitación pendiente para esta farmacia (misma cuenta). El usuario deberá aceptarla; no se reactivará el acceso automáticamente.';
}
