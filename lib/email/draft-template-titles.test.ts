import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildDraftTemplateTitleMap } from './draft-template-titles.ts';

describe('buildDraftTemplateTitleMap', () => {
  it('resuelve por templateId y por systemKey sin funciones', () => {
    const map = buildDraftTemplateTitleMap(
      [
        { templateSlug: 'lanzadera', templateId: 'uuid-1' },
        { templateSlug: 'blank', templateId: null },
        { templateSlug: 'custom', templateId: 'uuid-2' },
      ],
      [
        { id: 'uuid-1', name: 'Lanzadera editada', systemKey: 'lanzadera' },
        { id: 'uuid-2', name: 'Mi plantilla', systemKey: null },
      ]
    );
    assert.equal(map['uuid-1'], 'Lanzadera editada');
    assert.equal(map['uuid-2'], 'Mi plantilla');
    assert.equal(map.blank, 'En blanco');
    assert.equal(typeof map, 'object');
    assert.ok(JSON.parse(JSON.stringify(map)));
  });
});
