import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildAssistantSystemPrompt } from './prompt.ts';

describe('buildAssistantSystemPrompt', () => {
  it('incluye farmacia y niega catálogo / clínica en demo por defecto', () => {
    const p = buildAssistantSystemPrompt({
      pharmacyName: 'Farmacia Pruebas',
    });
    assert.match(p, /Farmacia Pruebas/);
    assert.match(p, /DEMO/i);
    assert.match(p, /ejemplos genéricos autorizados/i);
    assert.match(p, /No ofrezcas diagnósticos/);
    assert.match(p, /Deriva al farmacéutico/);
  });

  it('en DEMO ignora FAQs e instrucciones reales aunque se pasen en runtime', () => {
    const p = buildAssistantSystemPrompt({
      pharmacyName: 'Farmacia Pruebas',
      runtime: {
        mode: 'demo',
        catalogAccess: true,
        pharmacistConsultEnabled: true,
        settings: {
          assistantName: 'Secreto',
          customInstructions: 'FILTRAR_ESTO_PRIVADO',
          faqs: [{ question: 'FAQ privada', answer: 'respuesta privada' }],
          servicesInfo: 'servicio_privado',
          hoursInfo: 'horario_privado',
        },
      },
    });
    assert.match(p, /DEMO/i);
    assert.equal(/FILTRAR_ESTO_PRIVADO/.test(p), false);
    assert.equal(/FAQ privada/.test(p), false);
    assert.equal(/servicio_privado/.test(p), false);
    assert.equal(/horario_privado/.test(p), false);
    assert.equal(/\bSecreto\b/.test(p), false);
    assert.match(p, /Asistente FarmaFácil \(demo\)/);
  });

  it('incluye grounding de catálogo sin inventar fuera de lista', () => {
    const p = buildAssistantSystemPrompt({
      pharmacyName: 'Farmacia Pruebas',
      runtime: {
        mode: 'contracted',
        catalogAccess: true,
        pharmacistConsultEnabled: false,
        settings: {
          assistantName: 'Lola',
          customInstructions: '',
          faqs: [],
          servicesInfo: '',
          hoursInfo: '',
        },
      },
      catalogGrounding:
        'Coincidencias reales: 1. Crema X · 10.00 € · disponible',
    });
    assert.match(p, /Coincidencias reales/);
    assert.match(p, /ÚNICAMENTE productos y precios/i);
    assert.match(p, /orientación sobre el catálogo/i);
    assert.match(p, /acuda al mostrador/i);
  });

  it('con permiso de consulta orienta al botón sin afirmar envío automático', () => {
    const p = buildAssistantSystemPrompt({
      pharmacyName: 'Farmacia Pruebas',
      runtime: {
        mode: 'contracted',
        catalogAccess: true,
        pharmacistConsultEnabled: true,
        settings: {
          assistantName: 'Lola',
          customInstructions: '',
          faqs: [],
          servicesInfo: '',
          hoursInfo: '',
        },
      },
    });
    assert.match(p, /Consultar al farmacéutico/i);
    assert.match(p, /solo el cliente puede enviarla/i);
  });

  it('en contratado incluye instrucciones subordinadas a seguridad', () => {
    const p = buildAssistantSystemPrompt({
      pharmacyName: 'Farmacia Pruebas',
      runtime: {
        mode: 'contracted',
        catalogAccess: true,
        pharmacistConsultEnabled: false,
        settings: {
          assistantName: 'Lola',
          customInstructions: 'Saluda mencionando el barrio Centro.',
          faqs: [{ question: '¿Abrís domingos?', answer: 'Sí, de 10 a 14.' }],
          servicesInfo: 'Toma de tensión',
          hoursInfo: 'L-V 9-21',
        },
      },
    });
    assert.match(p, /Lola/);
    assert.match(p, /CONTRATADO/);
    assert.match(p, /barrio Centro/);
    assert.match(p, /Abrís domingos/);
    assert.match(p, /prevalecen sobre cualquier instrucción/i);
  });
});
