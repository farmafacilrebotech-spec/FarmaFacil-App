/**
 * Conserva una farmacia elegida (publicId) antes de login/registro
 * para poder guardarla después en Mis farmacias.
 * Solo cliente (localStorage). No crea relación en servidor.
 */

export const PENDING_SAVE_PHARMACY_KEY = 'ff_pending_save_pharmacy_v1';

export type PendingSavePharmacy = {
  publicId: string;
  pharmacyName?: string;
  savedAt: number;
};

export function readPendingSavePharmacy(): PendingSavePharmacy | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PENDING_SAVE_PHARMACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSavePharmacy;
    if (!parsed?.publicId || typeof parsed.publicId !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePendingSavePharmacy(input: {
  publicId: string;
  pharmacyName?: string;
}): void {
  if (typeof window === 'undefined') return;
  const payload: PendingSavePharmacy = {
    publicId: input.publicId.trim().toLowerCase(),
    pharmacyName: input.pharmacyName,
    savedAt: Date.now(),
  };
  window.localStorage.setItem(PENDING_SAVE_PHARMACY_KEY, JSON.stringify(payload));
}

export function clearPendingSavePharmacy(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PENDING_SAVE_PHARMACY_KEY);
}
