/**
 * Tarifas estimadas (USD → céntimos de USD) para modelos Chat Completions.
 * Ajustables por env sin redeploy de lógica: ASSISTANT_COST_PROMPT_PER_1M_CENTS /
 * ASSISTANT_COST_COMPLETION_PER_1M_CENTS (céntimos USD por millón de tokens).
 *
 * Defaults aproximados gpt-4o-mini: ~0.15 / 0.60 USD por 1M tokens.
 */

const DEFAULT_PROMPT_CENTS_PER_1M = 15;
const DEFAULT_COMPLETION_CENTS_PER_1M = 60;

function envCents(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function estimateAssistantCostCents(input: {
  promptTokens: number;
  completionTokens: number;
}): number {
  const promptRate = envCents(
    'ASSISTANT_COST_PROMPT_PER_1M_CENTS',
    DEFAULT_PROMPT_CENTS_PER_1M
  );
  const completionRate = envCents(
    'ASSISTANT_COST_COMPLETION_PER_1M_CENTS',
    DEFAULT_COMPLETION_CENTS_PER_1M
  );
  const prompt = Math.max(0, input.promptTokens) * (promptRate / 1_000_000);
  const completion =
    Math.max(0, input.completionTokens) * (completionRate / 1_000_000);
  return Math.round((prompt + completion) * 10000) / 10000;
}
