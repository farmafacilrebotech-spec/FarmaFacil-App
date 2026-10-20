import type { AssistantOpenAiConfig } from './config';
import type { AssistantChatMessage } from './types';

export type OpenAiChatResult =
  | {
      ok: true;
      content: string;
      promptTokens: number;
      completionTokens: number;
    }
  | { ok: false; code: 'timeout' | 'provider_error'; message: string };

/**
 * Llamada Chat Completions vía fetch (sin SDK). Solo servidor.
 * No registra el contenido de los mensajes.
 */
export async function callOpenAiChatCompletion(input: {
  config: Extract<AssistantOpenAiConfig, { ok: true }>;
  systemPrompt: string;
  messages: AssistantChatMessage[];
  fetchImpl?: typeof fetch;
}): Promise<OpenAiChatResult> {
  const fetchFn = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.config.timeoutMs);

  try {
    const res = await fetchFn(`${input.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.config.model,
        temperature: 0.4,
        max_tokens: 350,
        messages: [
          { role: 'system', content: input.systemPrompt },
          ...input.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // No filtramos el cuerpo del proveedor al cliente (puede contener detalles).
      console.error('[kiosk-assistant] provider status', res.status);
      return {
        ok: false,
        code: 'provider_error',
        message:
          'No se ha podido obtener una respuesta del asistente en este momento. Inténtalo de nuevo o consulta al farmacéutico.',
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    };
    const content = String(data.choices?.[0]?.message?.content ?? '').trim();
    if (!content) {
      return {
        ok: false,
        code: 'provider_error',
        message:
          'El asistente no ha devuelto una respuesta útil. Prueba de nuevo o pregunta en el mostrador.',
      };
    }

    return {
      ok: true,
      content,
      promptTokens: Math.max(0, Number(data.usage?.prompt_tokens) || 0),
      completionTokens: Math.max(0, Number(data.usage?.completion_tokens) || 0),
    };
  } catch (err) {
    const aborted =
      err instanceof Error &&
      (err.name === 'AbortError' || /aborted/i.test(err.message));
    if (aborted) {
      return {
        ok: false,
        code: 'timeout',
        message:
          'La respuesta está tardando demasiado. Inténtalo de nuevo o consulta al farmacéutico.',
      };
    }
    console.error('[kiosk-assistant] provider unexpected');
    return {
      ok: false,
      code: 'provider_error',
      message:
        'No se ha podido contactar con el asistente. Comprueba la conexión o pregunta en el mostrador.',
    };
  } finally {
    clearTimeout(timer);
  }
}
