/**
 * Helpers puros para UI cliente de plazas de lanzamiento.
 * Sin imports de supabase/server ni next/headers.
 */

import { formatEurFromCents } from '@/lib/pharmacies/commercial-assign-pricing';

const LAUNCH_EVENT_LABELS_ES: Record<string, string> = {
  reserved: 'Reservada',
  released: 'Liberada',
  confirmed: 'Confirmada',
  extended: 'Ampliada',
  expired: 'Caducada',
  holder_reserved: 'Reservada por titular',
  sa_reserved: 'Reservada por SuperAdmin',
  re_reserved: 'Reservada nuevamente',
};

/** Tabla de evolución SaaS 2027/2028/2029+ para los tres planes comerciales. */
export const LAUNCH_PROMO_ECONOMY_TABLE = [
  {
    planId: 'general' as const,
    planLabel: 'General',
    y2027Cents: 3900,
    y2028Cents: 6825,
    y2029Cents: 9750,
  },
  {
    planId: 'personalized' as const,
    planLabel: 'Personalizado',
    y2027Cents: 6900,
    y2028Cents: 12075,
    y2029Cents: 17250,
  },
  {
    planId: 'ai_personalized' as const,
    planLabel: 'Asistente IA',
    y2027Cents: 9900,
    y2028Cents: 17325,
    y2029Cents: 24750,
  },
] as const;

export function launchSeatEventLabelEs(eventType: string): string {
  const key = (eventType || '').toLowerCase();
  return LAUNCH_EVENT_LABELS_ES[key] || eventType;
}

/** Evolución SaaS promoción 2027 (alineada con motor comercial). */
export function launchPromoEconomyForSku(sku: string): {
  y2027Label: string;
  y2028Label: string;
  y2029Label: string;
  discountLines: string[];
} {
  const planId =
    sku === 'personalized' || sku === 'personalizado'
      ? 'personalized'
      : sku === 'ai_personalized' || sku === 'asistente_ia_personalizado'
        ? 'ai_personalized'
        : 'general';
  const table: Record<
    string,
    { y27: number; y28: number; y29: number }
  > = {
    general: { y27: 3900, y28: 6825, y29: 9750 },
    personalized: { y27: 6900, y28: 12075, y29: 17250 },
    ai_personalized: { y27: 9900, y28: 17325, y29: 24750 },
  };
  const row = table[planId] ?? table.general;
  return {
    y2027Label: `${formatEurFromCents(row.y27)} / mes`,
    y2028Label: `${formatEurFromCents(row.y28)} / mes`,
    y2029Label: `${formatEurFromCents(row.y29)} / mes`,
    discountLines: [
      '2027: −60 % SaaS',
      '2028: −30 % SaaS',
      '2029 y posteriores: tarifa normal vigente',
    ],
  };
}
