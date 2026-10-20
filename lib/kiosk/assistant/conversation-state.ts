/**
 * Persistencia temporal de la conversación del asistente (sessionStorage).
 * Misma ventana de inactividad que el carrito; nunca localStorage ni Supabase.
 */

import type {
  AssistantChatMessage,
  AssistantProductCard,
} from './types';

/** Misma ventana que el carrito / ASSISTANT_IDLE_MS (types). */
export const ASSISTANT_IDLE_MS = 3 * 60 * 1000;
export const KIOSK_ASSISTANT_IDLE_MS = ASSISTANT_IDLE_MS;
export const KIOSK_ASSISTANT_STORAGE_KEY = 'ff_kiosk_assistant_v1';

export type AssistantConversationBinding = {
  pharmacyId: string;
  deviceId: string;
  sessionId: string;
};

/** Consultas activas de esta conversación (solo IDs; sin historial OpenAI). */
export type AssistantActiveConsult = {
  id: string;
  displayCode: string;
  /** true cuando la respuesta del farmacéutico ya se mostró en el chat. */
  replyDelivered: boolean;
};

export type AssistantConversationState = AssistantConversationBinding & {
  messages: AssistantChatMessage[];
  /** Claves = índice de mensaje (string) → tarjetas de producto. */
  productsByMessage: Record<string, AssistantProductCard[]>;
  activeConsults: AssistantActiveConsult[];
  updatedAt: number;
};

export function emptyAssistantConversation(
  welcomeText: string,
  binding: AssistantConversationBinding
): AssistantConversationState {
  return {
    pharmacyId: binding.pharmacyId,
    deviceId: binding.deviceId,
    sessionId: binding.sessionId,
    messages: [{ role: 'assistant', content: welcomeText }],
    productsByMessage: {},
    activeConsults: [],
    updatedAt: Date.now(),
  };
}

export function conversationHasClientTurn(
  state: AssistantConversationState
): boolean {
  return state.messages.length > 1;
}

export function isConversationIdle(
  state: AssistantConversationState,
  nowMs: number,
  idleMs: number = ASSISTANT_IDLE_MS
): boolean {
  if (!conversationHasClientTurn(state)) return false;
  return nowMs - state.updatedAt >= idleMs;
}

/**
 * Si cambió farmacia, dispositivo o sesión de dispositivo → conversación nueva.
 */
export function bindConversationToSession(
  state: AssistantConversationState,
  binding: AssistantConversationBinding,
  welcomeText: string
): AssistantConversationState {
  if (
    state.pharmacyId !== binding.pharmacyId ||
    state.deviceId !== binding.deviceId ||
    state.sessionId !== binding.sessionId
  ) {
    return emptyAssistantConversation(welcomeText, binding);
  }
  return state;
}

export function touchConversation(
  state: AssistantConversationState,
  nowMs: number = Date.now()
): AssistantConversationState {
  if (nowMs - state.updatedAt < 4_000) return state;
  return { ...state, updatedAt: nowMs };
}

function parseProductCard(raw: unknown): AssistantProductCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? '');
  const name = String(row.name ?? '');
  const price = Number(row.price);
  const stock = Number(row.stock);
  if (!id || !name || !Number.isFinite(price) || price < 0) return null;
  if (!Number.isFinite(stock) || stock < 0) return null;
  return {
    id,
    name,
    brand: row.brand == null ? null : String(row.brand),
    price,
    stock: Math.floor(stock),
    available: row.available === true,
    canAddToCart: row.canAddToCart === true,
    imageUrl:
      row.imageUrl == null || row.imageUrl === ''
        ? null
        : String(row.imageUrl),
  };
}

export function parseStoredConversation(
  raw: string | null
): AssistantConversationState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<AssistantConversationState>;
    if (!data || typeof data !== 'object') return null;
    const pharmacyId = String(data.pharmacyId ?? '');
    const deviceId = String(data.deviceId ?? '');
    const sessionId = String(data.sessionId ?? '');
    if (!pharmacyId || !deviceId || !sessionId) return null;
    if (!Array.isArray(data.messages)) return null;

    const messages: AssistantChatMessage[] = [];
    for (const item of data.messages) {
      if (!item || typeof item !== 'object') continue;
      const role =
        (item as AssistantChatMessage).role === 'user' ||
        (item as AssistantChatMessage).role === 'assistant'
          ? (item as AssistantChatMessage).role
          : null;
      if (!role) continue;
      const content = String((item as AssistantChatMessage).content ?? '')
        .trim()
        .slice(0, 2000);
      if (!content) continue;
      messages.push({ role, content });
    }
    if (messages.length === 0) return null;

    const productsByMessage: Record<string, AssistantProductCard[]> = {};
    const rawMap =
      data.productsByMessage && typeof data.productsByMessage === 'object'
        ? data.productsByMessage
        : {};
    for (const [key, value] of Object.entries(rawMap)) {
      if (!Array.isArray(value)) continue;
      const cards = value
        .map(parseProductCard)
        .filter((p): p is AssistantProductCard => p != null)
        .slice(0, 12);
      if (cards.length > 0) productsByMessage[key] = cards;
    }

    const activeConsults: AssistantActiveConsult[] = [];
    const rawConsults = Array.isArray(data.activeConsults)
      ? data.activeConsults
      : [];
    for (const item of rawConsults) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Partial<AssistantActiveConsult>;
      const id = String(row.id ?? '');
      const displayCode = String(row.displayCode ?? '');
      if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !displayCode) continue;
      activeConsults.push({
        id,
        displayCode: displayCode.slice(0, 32),
        replyDelivered: row.replyDelivered === true,
      });
      if (activeConsults.length >= 5) break;
    }

    return {
      pharmacyId,
      deviceId,
      sessionId,
      messages: messages.slice(0, 40),
      productsByMessage,
      activeConsults,
      updatedAt:
        typeof data.updatedAt === 'number' && Number.isFinite(data.updatedAt)
          ? data.updatedAt
          : Date.now(),
    };
  } catch {
    return null;
  }
}

export function serializeConversation(
  state: AssistantConversationState
): string {
  return JSON.stringify(state);
}

export function clearStoredAssistantConversation(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(KIOSK_ASSISTANT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function readStoredAssistantConversation(): AssistantConversationState | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseStoredConversation(
      window.sessionStorage.getItem(KIOSK_ASSISTANT_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function writeStoredAssistantConversation(
  state: AssistantConversationState
): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      KIOSK_ASSISTANT_STORAGE_KEY,
      serializeConversation(state)
    );
  } catch {
    // ignore quota
  }
}
