import type { ContractTemplateKey } from './types.ts';

/**
 * Elige plantilla según plan y servicios del presupuesto aceptado.
 * Regla operativa documentada en docs/contracts-gap-analysis.md
 * (pendiente confirmación jurídica para Personalizado vs Catálogo).
 */
export function selectContractTemplateKey(input: {
  planId: string;
  kioskCount: number;
}): ContractTemplateKey {
  const kiosks = Number(input.kioskCount) || 0;
  if (kiosks > 0) return 'full-kiosk';
  if (input.planId === 'ai_personalized') return 'catalog-ai';
  return 'catalog';
}
