import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  catalogModeLabel,
  pharmacyPlanDisplayLabel,
  trialStatusLabel,
} from './commercial-ui-labels.ts';

describe('commercial-ui-labels', () => {
  it('traduce estados de piloto', () => {
    assert.equal(trialStatusLabel('ready'), 'Preparado');
    assert.equal(trialStatusLabel('converted'), 'Convertido en cliente');
    assert.equal(trialStatusLabel('cancelled'), 'Cancelado');
  });

  it('no muestra Starter como plan comercial en ficha con trial', () => {
    assert.match(
      pharmacyPlanDisplayLabel({
        openTrialStatus: 'ready',
        openTrialSku: 'personalized',
        planKey: 'starter',
        planName: 'Starter',
      }),
      /En prueba · Personalizado/
    );
  });

  it('marca Starter legacy si no hay trial', () => {
    assert.match(
      pharmacyPlanDisplayLabel({
        planKey: 'starter',
        planName: 'Starter',
      }),
      /legacy interno/i
    );
  });

  it('etiqueta catálogo', () => {
    assert.match(catalogModeLabel('generic'), /genérico/i);
    assert.match(catalogModeLabel('own'), /propio/i);
  });
});
