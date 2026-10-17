/**
 * Distinción cancelación vs revocación (puro; sin I/O).
 * npm run test:invite-auth (incluye este archivo vía patrón o script dedicado)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatMembershipListSummary,
  inviteBlockMessageForMembership,
  isCancelledInvitation,
  isRevokedFormerMember,
  membershipStatusLabel,
  membershipStatusTone,
  reinviteConfirmDescription,
  resolveInviteAgainstExistingMembership,
  summarizeMembershipList,
} from './membership-invite-state.ts';

describe('isCancelledInvitation / isRevokedFormerMember', () => {
  it('revoked sin accepted_at → invitación cancelada', () => {
    assert.equal(isCancelledInvitation('revoked', null), true);
    assert.equal(isCancelledInvitation('revoked', ''), true);
    assert.equal(isRevokedFormerMember('revoked', null), false);
  });

  it('revoked con accepted_at → ex-miembro revocado', () => {
    assert.equal(
      isCancelledInvitation('revoked', '2024-01-01T00:00:00Z'),
      false
    );
    assert.equal(
      isRevokedFormerMember('revoked', '2024-01-01T00:00:00Z'),
      true
    );
  });

  it('otros estados no son cancelación ni baja', () => {
    assert.equal(isCancelledInvitation('invited', null), false);
    assert.equal(isCancelledInvitation('active', '2024-01-01T00:00:00Z'), false);
    assert.equal(isRevokedFormerMember('active', '2024-01-01T00:00:00Z'), false);
  });
});

describe('membershipStatusLabel / tone', () => {
  it('distingue etiqueta cancelada vs revocado (SuperAdmin y tenant)', () => {
    assert.equal(membershipStatusLabel('revoked', null), 'Invitación cancelada');
    assert.equal(
      membershipStatusLabel('revoked', '2024-01-01T00:00:00Z'),
      'Revocado'
    );
    assert.equal(membershipStatusLabel('invited', null), 'Invitado');
    assert.equal(membershipStatusLabel('active', '2024-01-01T00:00:00Z'), 'Activo');
  });

  it('tono warning para cancelada, danger para revocado', () => {
    assert.equal(membershipStatusTone('revoked', null), 'warning');
    assert.equal(
      membershipStatusTone('revoked', '2024-01-01T00:00:00Z'),
      'danger'
    );
    assert.equal(membershipStatusTone('invited', null), 'primary');
    assert.equal(membershipStatusTone('active', null), 'success');
  });
});

describe('summarizeMembershipList / formatMembershipListSummary', () => {
  it('flujo completo: invitar → cancelar → reinvitar → aceptar → revocar', () => {
    // Invitado
    let counts = summarizeMembershipList([
      { status: 'invited', accepted_at: null },
    ]);
    assert.deepEqual(
      { ...counts },
      {
        total: 1,
        active: 0,
        invited: 1,
        cancelledInvitations: 0,
        revokedFormer: 0,
        suspended: 0,
      }
    );
    assert.match(formatMembershipListSummary(counts), /1 invitado/);

    // Cancelar antes de aceptar
    counts = summarizeMembershipList([
      { status: 'revoked', accepted_at: null },
    ]);
    assert.equal(counts.cancelledInvitations, 1);
    assert.equal(counts.invited, 0);
    assert.match(formatMembershipListSummary(counts), /cancelada/);

    // Reinvitar → Invitado
    counts = summarizeMembershipList([
      { status: 'invited', accepted_at: null },
    ]);
    assert.equal(counts.invited, 1);

    // Aceptar → Activo
    counts = summarizeMembershipList([
      { status: 'active', accepted_at: '2024-10-01T00:00:00Z' },
    ]);
    assert.equal(counts.active, 1);

    // Revocar tras aceptar → Revocado
    counts = summarizeMembershipList([
      { status: 'revoked', accepted_at: '2024-10-01T00:00:00Z' },
    ]);
    assert.equal(counts.revokedFormer, 1);
    assert.equal(counts.cancelledInvitations, 0);
    assert.match(formatMembershipListSummary(counts), /1 revocado/);
  });

  it('total incluye historial; invitados no cuentan canceladas', () => {
    const counts = summarizeMembershipList([
      { status: 'active', accepted_at: '2024-01-01T00:00:00Z' },
      { status: 'invited', accepted_at: null },
      { status: 'revoked', accepted_at: null },
      { status: 'revoked', accepted_at: '2024-02-01T00:00:00Z' },
      { status: 'suspended', accepted_at: '2024-01-15T00:00:00Z' },
    ]);
    assert.equal(counts.total, 5);
    assert.equal(counts.active, 1);
    assert.equal(counts.invited, 1);
    assert.equal(counts.cancelledInvitations, 1);
    assert.equal(counts.revokedFormer, 1);
    assert.equal(counts.suspended, 1);
    const text = formatMembershipListSummary(counts);
    assert.match(text, /5 usuarios/);
    assert.match(text, /1 activo/);
    assert.match(text, /1 invitado/);
    assert.match(text, /cancelada/);
    assert.match(text, /revocado/);
  });
});

describe('inviteBlockMessageForMembership', () => {
  it('mensajes de respaldo distintos para cancelada vs revocada', () => {
    const cancelled = inviteBlockMessageForMembership('revoked', null);
    const revoked = inviteBlockMessageForMembership(
      'revoked',
      '2024-01-01T00:00:00Z'
    );
    assert.match(cancelled, /invitación cancelada/i);
    assert.match(revoked, /acceso revocado/i);
    assert.notEqual(cancelled, revoked);
  });

  it('idempotencia: invited / active / suspended', () => {
    assert.match(
      inviteBlockMessageForMembership('invited', null),
      /invitación pendiente/
    );
    assert.match(inviteBlockMessageForMembership('active', null), /miembro activo/);
    assert.match(
      inviteBlockMessageForMembership('suspended', null),
      /suspendido/
    );
  });
});

describe('resolveInviteAgainstExistingMembership', () => {
  it('sin membership en esta farmacia → create (incluye usuario de otra farmacia)', () => {
    assert.deepEqual(resolveInviteAgainstExistingMembership(null), {
      kind: 'create',
    });
    assert.deepEqual(resolveInviteAgainstExistingMembership(undefined), {
      kind: 'create',
    });
  });

  it('invitación cancelada (revoked + accepted_at null) → reinvite', () => {
    assert.deepEqual(
      resolveInviteAgainstExistingMembership({
        id: 'm-cancel',
        status: 'revoked',
        accepted_at: null,
      }),
      { kind: 'reinvite', membershipId: 'm-cancel', acceptedAt: null }
    );
  });

  it('antiguo empleado revocado (accepted_at set) → reinvite', () => {
    assert.deepEqual(
      resolveInviteAgainstExistingMembership({
        id: 'm-rev',
        status: 'revoked',
        accepted_at: '2024-06-01T00:00:00Z',
      }),
      {
        kind: 'reinvite',
        membershipId: 'm-rev',
        acceptedAt: '2024-06-01T00:00:00Z',
      }
    );
  });

  it('invitación pendiente → block', () => {
    assert.deepEqual(
      resolveInviteAgainstExistingMembership({
        id: 'm-inv',
        status: 'invited',
        accepted_at: null,
      }),
      { kind: 'block', status: 'invited', acceptedAt: null }
    );
  });

  it('usuario activo → block', () => {
    assert.deepEqual(
      resolveInviteAgainstExistingMembership({
        id: 'm-act',
        status: 'active',
        accepted_at: '2024-01-01T00:00:00Z',
      }),
      {
        kind: 'block',
        status: 'active',
        acceptedAt: '2024-01-01T00:00:00Z',
      }
    );
  });

  it('flujo invitar → cancelar → volver a invitar → aceptar (estados)', () => {
    // 1) Primera invitación
    assert.equal(
      resolveInviteAgainstExistingMembership(null).kind,
      'create'
    );
    // 2) Tras cancel_invitation: revoked sin accepted_at
    const afterCancel = resolveInviteAgainstExistingMembership({
      id: 'm1',
      status: 'revoked',
      accepted_at: null,
    });
    assert.equal(afterCancel.kind, 'reinvite');
    // 3) Tras reinvite: invited (pendiente) — aceptar es RPC aparte
    const pending = resolveInviteAgainstExistingMembership({
      id: 'm1',
      status: 'invited',
      accepted_at: null,
    });
    assert.equal(pending.kind, 'block');
    // 4) Tras accept: active
    const active = resolveInviteAgainstExistingMembership({
      id: 'm1',
      status: 'active',
      accepted_at: '2024-10-01T00:00:00Z',
    });
    assert.equal(active.kind, 'block');
  });
});

describe('reinviteConfirmDescription', () => {
  it('copy distinto si nunca aceptó', () => {
    const cancelled = reinviteConfirmDescription(null);
    const former = reinviteConfirmDescription('2024-01-01T00:00:00Z');
    assert.match(cancelled, /no es una reactivación/i);
    assert.match(former, /no se reactivará el acceso automáticamente/i);
    assert.notEqual(cancelled, former);
  });
});
