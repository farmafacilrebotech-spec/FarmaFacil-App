export type AssistantRole = 'user' | 'assistant' | 'system';

export type AssistantChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/** Producto mostrado en el chat (origen: búsqueda controlada, no inventado). */
export type AssistantProductCard = {
  id: string;
  name: string;
  brand: string | null;
  /** Null en genéricos: sin PVP inventado (no usar 0). */
  price: number | null;
  /** Null en genéricos: sin stock inventado. */
  stock: number | null;
  available: boolean;
  canAddToCart: boolean;
  imageUrl?: string | null;
};

export type AssistantSendResult =
  | {
      ok: true;
      reply: string;
      escalated: boolean;
      products?: AssistantProductCard[];
    }
  | {
      ok: false;
      code:
        | 'session_missing'
        | 'session_invalid'
        | 'session_revoked'
        | 'commercially_blocked'
        | 'module_disabled'
        | 'limit_exceeded'
        | 'rate_limited'
        | 'message_too_long'
        | 'empty_message'
        | 'config_missing'
        | 'provider_error'
        | 'timeout'
        | 'busy';
      message: string;
    };

export const ASSISTANT_MAX_USER_CHARS = 500;
export const ASSISTANT_MAX_HISTORY_MESSAGES = 12;
export const ASSISTANT_IDLE_MS = 3 * 60 * 1000;

export const ASSISTANT_WELCOME_TEXT =
  'Hola, soy el Asistente FarmaFácil. Puedo orientarte sobre consultas habituales y categorías de parafarmacia. No sustituyo al farmacéutico: si tu duda es clínica o personalizada, pídele ayuda en el mostrador.';
