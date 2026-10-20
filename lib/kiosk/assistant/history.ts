import type { AssistantChatMessage } from './types';

/** Espejo de ASSISTANT_MAX_* en types.ts (evita import de valores para node:test). */
const MAX_USER_CHARS = 500;
const MAX_HISTORY_MESSAGES = 12;

export function normalizeUserMessage(
  raw: string
): { ok: true; text: string } | { ok: false; reason: 'empty' | 'too_long' } {
  const text = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return { ok: false, reason: 'empty' };
  if (text.length > MAX_USER_CHARS) {
    return { ok: false, reason: 'too_long' };
  }
  return { ok: true, text };
}

/**
 * Recorta historial cliente → solo user/assistant, sin system, longitud acotada.
 * No inventa mensajes.
 */
export function sanitizeHistoryForModel(
  history: unknown,
  maxMessages: number = MAX_HISTORY_MESSAGES
): AssistantChatMessage[] {
  if (!Array.isArray(history)) return [];
  const out: AssistantChatMessage[] = [];

  for (const item of history) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const role = row.role === 'user' || row.role === 'assistant' ? row.role : null;
    if (!role) continue;
    const content = String(row.content ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, MAX_USER_CHARS * 2);
    if (!content) continue;
    out.push({ role, content });
  }

  if (out.length <= maxMessages) return out;
  return out.slice(out.length - maxMessages);
}
