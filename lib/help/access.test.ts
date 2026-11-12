import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { filterHelpDocsForAudiences, HELP_DOCS } from './catalog.ts';

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
});
