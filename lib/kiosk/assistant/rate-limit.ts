/**
 * Rate-limit en memoria por dispositivo y farmacia (Fase 1).
 * En serverless el contador es por instancia; suficiente para abuso básico.
 */

export const ASSISTANT_RATE_WINDOW_MS = 15 * 60 * 1000;
export const ASSISTANT_RATE_MAX_PER_DEVICE = 20;
export const ASSISTANT_RATE_MAX_PER_PHARMACY = 80;

export type AssistantRateBucket = {
  windowStartedAt: number;
  count: number;
};

type Store = Map<string, AssistantRateBucket>;

const deviceStore: Store = new Map();
const pharmacyStore: Store = new Map();

function touch(
  store: Store,
  key: string,
  nowMs: number,
  max: number
): { allowed: boolean; bucket: AssistantRateBucket } {
  const existing = store.get(key) ?? null;
  let bucket: AssistantRateBucket;
  if (!existing || existing.windowStartedAt + ASSISTANT_RATE_WINDOW_MS < nowMs) {
    bucket = { windowStartedAt: nowMs, count: 0 };
  } else {
    bucket = existing;
  }

  if (bucket.count >= max) {
    store.set(key, bucket);
    return { allowed: false, bucket };
  }

  bucket = { ...bucket, count: bucket.count + 1 };
  store.set(key, bucket);
  return { allowed: true, bucket };
}

export function checkAssistantRateLimit(input: {
  pharmacyId: string;
  deviceId: string;
  nowMs?: number;
  stores?: { device: Store; pharmacy: Store };
}): { allowed: boolean; scope: 'device' | 'pharmacy' | null } {
  const now = input.nowMs ?? Date.now();
  const devices = input.stores?.device ?? deviceStore;
  const pharmacies = input.stores?.pharmacy ?? pharmacyStore;

  const device = touch(
    devices,
    `d:${input.deviceId}`,
    now,
    ASSISTANT_RATE_MAX_PER_DEVICE
  );
  if (!device.allowed) return { allowed: false, scope: 'device' };

  const pharmacy = touch(
    pharmacies,
    `p:${input.pharmacyId}`,
    now,
    ASSISTANT_RATE_MAX_PER_PHARMACY
  );
  if (!pharmacy.allowed) return { allowed: false, scope: 'pharmacy' };

  return { allowed: true, scope: null };
}

/** Solo para tests: vacía almacenes globales. */
export function resetAssistantRateLimitStoresForTests(): void {
  deviceStore.clear();
  pharmacyStore.clear();
}
