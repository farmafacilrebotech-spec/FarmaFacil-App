/**
 * Controles de aplicación (además del prompt) para derivar al farmacéutico
 * o a urgencias ante consultas clínicas / de riesgo.
 */

const EMERGENCY_RE =
  /\b(urgencia|emergencia|no\s+respira|infarto|ictus|sobredosis|sangrado\s+abundante|convulsion|envenen)/i;

const CLINICAL_RE =
  /\b(dosis|posolog[ií]a|cu[aá]nto\s+tomar|interacci[oó]n|contraindic|embaraz|lactancia|para\s+mi\s+hijo|diagn[oó]stico|me\s+duele|tengo\s+fiebre|antib[ií]otic|receta|psiqui[aá]tric|quimioterap|insulina)\b/i;

const PRESCRIPTION_BUY_RE =
  /\b(comprar|conseguir|conseguirme|sin\s+receta|pasar\s+sin)\b.{0,40}\b(receta|antib[ií]otic|benzodiacepin|ansiol[ií]tic|opioide|morfina|tramadol)\b/i;

export type SafetyDecision =
  | { action: 'allow' }
  | { action: 'escalate_pharmacist'; reply: string }
  | { action: 'escalate_emergency'; reply: string };

export const PHARMACIST_ESCALATION_REPLY =
  'Esta consulta requiere la valoración de un profesional sanitario. Por favor, acude al mostrador y consulta al farmacéutico de la farmacia. El asistente no puede diagnosticar, indicar dosis ni valorar tu caso concreto.';

export const EMERGENCY_ESCALATION_REPLY =
  'Si crees que se trata de una urgencia, contacta de inmediato con el 112 o acude a un servicio de urgencias. El asistente del kiosko no sustituye la atención sanitaria urgente.';

export function evaluateAssistantSafety(userText: string): SafetyDecision {
  const text = userText.trim();
  if (!text) return { action: 'allow' };

  if (EMERGENCY_RE.test(text)) {
    return { action: 'escalate_emergency', reply: EMERGENCY_ESCALATION_REPLY };
  }
  if (PRESCRIPTION_BUY_RE.test(text) || CLINICAL_RE.test(text)) {
    return {
      action: 'escalate_pharmacist',
      reply: PHARMACIST_ESCALATION_REPLY,
    };
  }
  return { action: 'allow' };
}

/** Respuesta fija: acudir al mostrador (DEMO o sin consulta digital). */
export const CONSULT_PHARMACIST_QUICK_REPLY =
  'Perfecto. Acércate al mostrador y el equipo farmacéutico te atenderá. Pueden ayudarte con dudas clínicas, medicamentos con receta y cualquier valoración personalizada.';

/**
 * CONTRATADO con pharmacist_consult_enabled: orientar a usar el formulario
 * del botón (no inventar que ya se envió nada).
 */
export const CONSULT_PHARMACIST_DIGITAL_HINT_REPLY =
  'Puedes enviar una consulta breve al equipo farmacéutico con el botón «Consultar al farmacéutico». No incluyas datos personales. Si prefieres, acércate al mostrador.';

/**
 * Respuesta informativa cuando el botón no abre envío digital.
 */
export function resolveConsultPharmacistReply(input: {
  mode: 'demo' | 'contracted';
  pharmacistConsultEnabled: boolean;
}): string {
  if (
    input.mode === 'contracted' &&
    input.pharmacistConsultEnabled === true
  ) {
    return CONSULT_PHARMACIST_DIGITAL_HINT_REPLY;
  }
  return CONSULT_PHARMACIST_QUICK_REPLY;
}
