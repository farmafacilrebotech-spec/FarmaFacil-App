import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  filterHelpDocsForAudiences,
  HELP_DOCS,
  HELP_HUB_STUB_SECTIONS,
  helpAudiencesForPharmacyRole,
} from './catalog.ts';

describe('help center access', () => {
  it('oculta documento de pruebas a farmacia/cliente', () => {
    const docs = filterHelpDocsForAudiences(['pharmacy_admin', 'customer']);
    assert.equal(
      docs.some((d) => d.internalTests),
      false
    );
    assert.ok(docs.some((d) => d.id === 'manual-cliente'));
  });

  it('SuperAdmin Total ve pruebas internas', () => {
    const docs = filterHelpDocsForAudiences(['sa_total']);
    assert.ok(docs.some((d) => d.id === 'plan-pruebas'));
    assert.ok(docs.length === HELP_DOCS.filter((d) => d.audiences.includes('sa_total')).length);
  });

  it('Soporte no ve plan de pruebas', () => {
    const docs = filterHelpDocsForAudiences(['sa_soporte']);
    assert.equal(
      docs.some((d) => d.id === 'plan-pruebas'),
      false
    );
  });

  it('audiencias de ayuda por rol de farmacia', () => {
    assert.deepEqual(helpAudiencesForPharmacyRole('PHARMACY_OWNER'), [
      'pharmacy_admin',
      'pharmacy_staff',
    ]);
    assert.deepEqual(helpAudiencesForPharmacyRole('PHARMACY_ADMIN'), [
      'pharmacy_admin',
      'pharmacy_staff',
    ]);
    assert.deepEqual(helpAudiencesForPharmacyRole('PHARMACIST'), [
      'pharmacy_staff',
    ]);
    assert.deepEqual(helpAudiencesForPharmacyRole('PHARMACY_STAFF'), [
      'pharmacy_staff',
    ]);
  });

  it('owner/admin ven manual de farmacia; nunca pruebas internas ni manual SA', () => {
    const docs = filterHelpDocsForAudiences(
      helpAudiencesForPharmacyRole('PHARMACY_OWNER')
    );
    assert.ok(docs.some((d) => d.id === 'manual-farmacia'));
    assert.equal(docs.some((d) => d.internalTests), false);
    assert.equal(docs.some((d) => d.id === 'manual-sa-total'), false);
  });

  it('staff/farmacéutico no ven documentos internos de gestión', () => {
    const docs = filterHelpDocsForAudiences(
      helpAudiencesForPharmacyRole('PHARMACIST')
    );
    assert.equal(docs.some((d) => d.internalTests), false);
    assert.equal(docs.some((d) => d.id === 'manual-sa-total'), false);
  });

  it('el hub declara primeros pasos, manuales, FAQ y soporte', () => {
    assert.deepEqual(
      HELP_HUB_STUB_SECTIONS.map((s) => s.id),
      ['primeros-pasos', 'manuales', 'faq', 'soporte']
    );
  });
});
