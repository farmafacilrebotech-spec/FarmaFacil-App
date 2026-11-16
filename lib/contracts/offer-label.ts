/**
 * Etiqueta comercial unificada plan + servicios del snapshot.
 * Evita mostrar «SaaS Personalizado» y «Completo + kiosco» como planes distintos.
 */

export function normalizeCommercialPlanBaseName(
  planId: string,
  planName: string
): string {
  const id = (planId || '').trim();
  if (id === 'personalized') return 'Personalizado';
  if (id === 'ai_personalized') return 'Asistente IA personalizado';
  if (id === 'catalog' || id === 'generic') return 'Catálogo';
  const name = (planName || '').trim();
  return name.replace(/^SaaS\s+/i, '').trim() || name || '—';
}

/**
 * Nombre de oferta para portada/PDF a partir del presupuesto aceptado.
 * Ej.: Personalizado + kiosco → «Personalizado con kiosco».
 */
export function commercialOfferLabel(input: {
  planId: string;
  planName: string;
  kioskCount: number;
}): string {
  const base = normalizeCommercialPlanBaseName(input.planId, input.planName);
  const kiosks = Number(input.kioskCount) || 0;
  if (kiosks <= 0) return base;
  if (/kiosco/i.test(base)) return base;
  return `${base} con kiosco`;
}
