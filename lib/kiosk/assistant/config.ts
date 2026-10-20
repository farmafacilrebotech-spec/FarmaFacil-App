export type AssistantOpenAiConfig =
  | {
      ok: true;
      apiKey: string;
      model: string;
      timeoutMs: number;
      baseUrl: string;
    }
  | { ok: false; reason: 'missing_api_key' };

/**
 * Configuración servidor-only. Nunca exponer al cliente.
 * Modelo configurable; no se asume que la clave exista.
 */
export function getAssistantOpenAiConfig(
  env: NodeJS.ProcessEnv = process.env
): AssistantOpenAiConfig {
  const apiKey = (env.OPENAI_API_KEY ?? '').trim();
  if (!apiKey) {
    return { ok: false, reason: 'missing_api_key' };
  }

  const model = (env.OPENAI_MODEL ?? 'gpt-4o-mini').trim() || 'gpt-4o-mini';
  const timeoutRaw = Number(env.OPENAI_TIMEOUT_MS ?? 25_000);
  const timeoutMs =
    Number.isFinite(timeoutRaw) && timeoutRaw >= 5_000 && timeoutRaw <= 60_000
      ? Math.floor(timeoutRaw)
      : 25_000;
  const baseUrl = (
    env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  ).trim().replace(/\/$/, '');

  return { ok: true, apiKey, model, timeoutMs, baseUrl };
}
