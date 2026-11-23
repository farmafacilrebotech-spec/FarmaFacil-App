/**
 * Nombre visible de farmacia para UX pública y materiales (QR, catálogo, cuenta,
 * pedidos, kiosko, carteles).
 *
 * Prioridad: pharmacy_settings.visible_name → pharmacies.name.
 * `pharmacies.name` es el nombre fiscal/legal: NO usar este helper en facturas,
 * contratos, presupuestos legales ni documentos jurídicos.
 */

function clean(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** visible_name con fallback a name (y opcionalmente a un último recurso). */
export function resolvePharmacyDisplayName(input: {
  visibleName?: string | null;
  name?: string | null;
  fallback?: string;
}): string {
  return clean(input.visibleName) || clean(input.name) || input.fallback || 'Farmacia';
}

/**
 * Elige el primer nombre no vacío (p. ej. el resuelto por la RPC de entrypoint
 * con visible_name, antes que el devuelto por RPCs que aún usan pharmacies.name).
 */
export function firstNonEmptyPharmacyName(
  ...candidates: Array<string | null | undefined>
): string {
  for (const c of candidates) {
    const v = clean(c);
    if (v) return v;
  }
  return '';
}

type SettingsEmbed =
  | { visible_name: string | null }
  | { visible_name: string | null }[]
  | null
  | undefined;

/** Extrae visible_name de un embed PostgREST (objeto, array o null). */
export function visibleNameFromSettingsEmbed(settings: SettingsEmbed): string | null {
  const row = Array.isArray(settings) ? settings[0] : settings;
  const v = clean(row?.visible_name ?? null);
  return v || null;
}
