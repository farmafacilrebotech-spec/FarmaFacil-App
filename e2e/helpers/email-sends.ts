import { createClient } from '@supabase/supabase-js';

/** Comprueba en staging si hay un email_sends reciente con el marcador. */
export async function findRecentSendBySubjectMarker(
  marker: string,
  recipient: string
): Promise<{ id: string; subject: string; dry_run: boolean } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.E2E_SA_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!url || !anon || !email || !password) return null;

  const sb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: authErr } = await sb.auth.signInWithPassword({
    email,
    password,
  });
  if (authErr) return null;

  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data, error } = await sb
    .from('email_sends')
    .select('id, subject, recipient_email, dry_run, created_at')
    .gte('created_at', since)
    .ilike('subject', `%${marker}%`)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error || !data?.length) {
    // fallback: any [PRUEBA] to recipient in window
    const { data: d2 } = await sb
      .from('email_sends')
      .select('id, subject, recipient_email, dry_run, created_at')
      .gte('created_at', since)
      .ilike('subject', '%[PRUEBA]%')
      .eq('recipient_email', recipient.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(3);
    const hit = d2?.[0];
    return hit
      ? {
          id: String(hit.id),
          subject: String(hit.subject),
          dry_run: Boolean(hit.dry_run),
        }
      : null;
  }
  const hit = data[0];
  return {
    id: String(hit.id),
    subject: String(hit.subject),
    dry_run: Boolean(hit.dry_run),
  };
}
