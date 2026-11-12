/**
 * Allowlist de destinatarios para envíos reales controlados (staging).
 *
 * Si `FF_CORPORATE_EMAIL_TEST_RECIPIENTS` está definido (CSV de emails),
 * To / CC / CCO deben estar todos dentro de esa lista.
 * Sin la variable → no aplica (otros entornos / dry-run sin allowlist).
 */

export function parseCorporateEmailTestRecipients(
  env: NodeJS.ProcessEnv = process.env
): string[] | null {
  const raw = (env.FF_CORPORATE_EMAIL_TEST_RECIPIENTS ?? '').trim();
  if (!raw) return null;
  const list = raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.length ? [...new Set(list)] : null;
}

export function assertCorporateEmailRecipientsAllowed(
  emails: string[],
  env: NodeJS.ProcessEnv = process.env
): { ok: true } | { ok: false; error: string } {
  const allow = parseCorporateEmailTestRecipients(env);
  if (!allow) return { ok: true };

  const normalized = emails
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const blocked = normalized.filter((e) => !allow.includes(e));
  if (blocked.length === 0) return { ok: true };

  return {
    ok: false,
    error:
      'Envío restringido a destinatarios de prueba autorizados. ' +
      `No permitido: ${blocked.join(', ')}.`,
  };
}
