import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  customerLoginPathFromReturn,
  isCustomerAccountReturnPath,
} from './auth-return.ts';

describe('customer auth return paths', () => {
  it('detecta rutas globales y por QR', () => {
    assert.equal(isCustomerAccountReturnPath('/cuenta'), true);
    assert.equal(isCustomerAccountReturnPath('/cuenta/mis-farmacias'), true);
    assert.equal(
      isCustomerAccountReturnPath('/e/abc123abc123abc1/cuenta'),
      true
    );
    assert.equal(
      isCustomerAccountReturnPath('/e/abc123abc123abc1/cuenta/perfil'),
      true
    );
    assert.equal(isCustomerAccountReturnPath('/login'), false);
    assert.equal(isCustomerAccountReturnPath('/auth/continue'), false);
    assert.equal(isCustomerAccountReturnPath(null), false);
  });

  it('resuelve login cliente desde next', () => {
    assert.equal(customerLoginPathFromReturn('/cuenta'), '/cuenta/entrar');
    assert.equal(
      customerLoginPathFromReturn('/e/pubidpubidpubid1/cuenta'),
      '/e/pubidpubidpubid1/cuenta/entrar'
    );
  });
});
