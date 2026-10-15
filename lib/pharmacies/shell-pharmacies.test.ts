import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  pharmacySwitcherMode,
  type ShellPharmacyOption,
} from './shell-pharmacies.ts';

const p = (id: string, name: string): ShellPharmacyOption => ({
  id,
  name,
  city: null,
  province: null,
  logoColor: null,
});

describe('pharmacySwitcherMode', () => {
  it('hides when there are no pharmacies', () => {
    assert.equal(pharmacySwitcherMode([]), 'hidden');
  });

  it('shows static name for a single authorized pharmacy', () => {
    assert.equal(pharmacySwitcherMode([p('a', 'Farmacia Pruebas')]), 'static');
  });

  it('shows select only among multiple authorized pharmacies', () => {
    assert.equal(
      pharmacySwitcherMode([p('a', 'Una'), p('b', 'Otra')]),
      'select'
    );
  });
});
