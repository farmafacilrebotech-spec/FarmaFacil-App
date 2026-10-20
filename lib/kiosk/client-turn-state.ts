/**
 * Turno de cliente del kiosko (sessionStorage).
 * Independiente de la cookie de dispositivo: identifica al usuario actual en el tablet.
 * El plaintext solo vive en el navegador; el servidor hashea antes de llamar a SQL.
 */

export const KIOSK_CLIENT_TURN_STORAGE_KEY = 'ff_kiosk_client_turn_v1';

export type KioskClientTurnBinding = {
  pharmacyId: string;
  deviceId: string;
  sessionId: string;
};

export type KioskClientTurnState = KioskClientTurnBinding & {
  /** Token secreto (base64url). Nunca loguear. */
  token: string;
  createdAt: number;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  const b64 =
    typeof btoa === 'function'
      ? btoa(bin)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateKioskClientTurnToken(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Entorno de test Node sin Web Crypto completo
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToBase64Url(bytes);
}

export function emptyKioskClientTurn(
  binding: KioskClientTurnBinding
): KioskClientTurnState {
  return {
    ...binding,
    token: generateKioskClientTurnToken(),
    createdAt: Date.now(),
  };
}

export function bindClientTurnToSession(
  state: KioskClientTurnState,
  binding: KioskClientTurnBinding
): KioskClientTurnState {
  if (
    state.pharmacyId !== binding.pharmacyId ||
    state.deviceId !== binding.deviceId ||
    state.sessionId !== binding.sessionId
  ) {
    return emptyKioskClientTurn(binding);
  }
  return state;
}

export function parseStoredClientTurn(
  raw: string | null
): KioskClientTurnState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<KioskClientTurnState>;
    const pharmacyId = String(data.pharmacyId ?? '');
    const deviceId = String(data.deviceId ?? '');
    const sessionId = String(data.sessionId ?? '');
    const token = String(data.token ?? '');
    if (!pharmacyId || !deviceId || !sessionId || token.length < 32) {
      return null;
    }
    return {
      pharmacyId,
      deviceId,
      sessionId,
      token,
      createdAt:
        typeof data.createdAt === 'number' && Number.isFinite(data.createdAt)
          ? data.createdAt
          : Date.now(),
    };
  } catch {
    return null;
  }
}

export function readStoredClientTurn(): KioskClientTurnState | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseStoredClientTurn(
      window.sessionStorage.getItem(KIOSK_CLIENT_TURN_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function writeStoredClientTurn(state: KioskClientTurnState): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      KIOSK_CLIENT_TURN_STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch {
    // ignore
  }
}

export function clearStoredClientTurn(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(KIOSK_CLIENT_TURN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Obtiene el turno actual o crea uno nuevo ligado a la sesión de dispositivo.
 */
export function getOrCreateClientTurn(
  binding: KioskClientTurnBinding
): KioskClientTurnState {
  const stored = readStoredClientTurn();
  if (stored) {
    const bound = bindClientTurnToSession(stored, binding);
    if (bound.token !== stored.token) {
      writeStoredClientTurn(bound);
    }
    return bound;
  }
  const next = emptyKioskClientTurn(binding);
  writeStoredClientTurn(next);
  return next;
}
