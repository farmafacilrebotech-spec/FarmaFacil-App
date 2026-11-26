import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  posterDownloadFilename,
  posterFilenameSafeId,
  posterPdfTitle,
  STAGING_POSTER_FILENAME_TAG,
} from './pharmacy-poster-meta.ts';

describe('posterFilenameSafeId', () => {
  it('conserva public_id de 16 caracteres', () => {
    assert.equal(posterFilenameSafeId('Ab12cd34Ef56gh78'), 'ab12cd34ef56gh78');
  });

  it('nunca expone un UUID como nombre', () => {
    assert.equal(
      posterFilenameSafeId('3f2b8c1e-9d4a-4b7e-8a11-2c5d6e7f8a90'),
      'farmacia'
    );
    assert.equal(posterFilenameSafeId('3f2b8c1e9d4a4b7e8a112c5d6e7f8a90'), 'farmacia');
  });

  it('vacío → farmacia', () => {
    assert.equal(posterFilenameSafeId(''), 'farmacia');
    assert.equal(posterFilenameSafeId(null), 'farmacia');
  });
});

describe('posterDownloadFilename', () => {
  it('producción: nombres descriptivos sin sufijo', () => {
    assert.equal(
      posterDownloadFilename({ kind: 'acceso', format: 'a4', publicId: 'abc123' }),
      'farmafacil-cartel-acceso-a4-abc123.pdf'
    );
    assert.equal(
      posterDownloadFilename({ kind: 'publicitario', format: 'a3', publicId: 'abc123' }),
      'farmafacil-cartel-publicitario-a3-abc123.pdf'
    );
    assert.equal(
      posterDownloadFilename({ kind: 'pack', publicId: 'abc123' }),
      'farmafacil-pack-bienvenida-abc123.pdf'
    );
  });

  it('A5 incluido en el nombre', () => {
    assert.equal(
      posterDownloadFilename({ kind: 'acceso', format: 'a5', publicId: 'abc123' }),
      'farmafacil-cartel-acceso-a5-abc123.pdf'
    );
  });

  it('staging: contiene PRUEBA-STAGING', () => {
    for (const kind of ['acceso', 'publicitario', 'pack'] as const) {
      const name = posterDownloadFilename({
        kind,
        format: 'a4',
        publicId: 'abc123',
        staging: true,
      });
      assert.ok(name.includes(STAGING_POSTER_FILENAME_TAG), name);
      assert.ok(name.endsWith('.pdf'));
    }
  });

  it('UUID como publicId no aparece en el nombre', () => {
    const uuid = '3f2b8c1e-9d4a-4b7e-8a11-2c5d6e7f8a90';
    const name = posterDownloadFilename({
      kind: 'acceso',
      format: 'a4',
      publicId: uuid,
    });
    assert.ok(!name.includes(uuid));
    assert.equal(name, 'farmafacil-cartel-acceso-a4-farmacia.pdf');
  });
});

describe('posterPdfTitle', () => {
  it('añade etiqueta de pruebas solo en staging', () => {
    assert.ok(
      !posterPdfTitle({ kind: 'acceso', pharmacyName: 'Farmacia Sol' }).includes(
        STAGING_POSTER_FILENAME_TAG
      )
    );
    assert.ok(
      posterPdfTitle({
        kind: 'acceso',
        pharmacyName: 'Farmacia Sol',
        staging: true,
      }).includes(STAGING_POSTER_FILENAME_TAG)
    );
  });
});
