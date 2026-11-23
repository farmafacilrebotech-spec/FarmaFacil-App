import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  firstNonEmptyPharmacyName,
  resolvePharmacyDisplayName,
  visibleNameFromSettingsEmbed,
} from './display-name.ts';

describe('resolvePharmacyDisplayName', () => {
  it('prefiere visible_name', () => {
    assert.equal(
      resolvePharmacyDisplayName({ visibleName: ' Farmacia Sol ', name: 'SL Legal' }),
      'Farmacia Sol'
    );
  });
  it('fallback a name cuando visible_name vacío/null', () => {
    assert.equal(resolvePharmacyDisplayName({ visibleName: '  ', name: 'SL Legal' }), 'SL Legal');
    assert.equal(resolvePharmacyDisplayName({ visibleName: null, name: 'SL Legal' }), 'SL Legal');
  });
  it('último recurso', () => {
    assert.equal(resolvePharmacyDisplayName({}), 'Farmacia');
    assert.equal(resolvePharmacyDisplayName({ fallback: 'Tu farmacia' }), 'Tu farmacia');
  });
});

describe('firstNonEmptyPharmacyName', () => {
  it('devuelve el primero no vacío', () => {
    assert.equal(firstNonEmptyPharmacyName('', null, ' A ', 'B'), 'A');
    assert.equal(firstNonEmptyPharmacyName(undefined), '');
  });
});

describe('visibleNameFromSettingsEmbed', () => {
  it('objeto, array y null', () => {
    assert.equal(visibleNameFromSettingsEmbed({ visible_name: ' X ' }), 'X');
    assert.equal(visibleNameFromSettingsEmbed([{ visible_name: 'Y' }]), 'Y');
    assert.equal(visibleNameFromSettingsEmbed(null), null);
    assert.equal(visibleNameFromSettingsEmbed({ visible_name: '' }), null);
  });
});
