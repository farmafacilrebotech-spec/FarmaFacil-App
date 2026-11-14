import {
  listTrashedEmailDraftsAction,
  listTrashedEmailSendsAction,
} from '@/app/(app)/emails/actions';
import { EmailsShell } from '@/components/email/emails-shell';
import { TrashMailbox } from '@/components/email/trash-mailbox';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';

export const dynamic = 'force-dynamic';

export default async function EmailsTrashPage() {
  await assertEmailsPageAccess();
  const [draftsListed, sendsListed] = await Promise.all([
    listTrashedEmailDraftsAction(),
    listTrashedEmailSendsAction(),
  ]);

  const drafts = draftsListed.ok ? draftsListed.drafts : [];
  const sends = sendsListed.ok ? sendsListed.sends : [];
  const error =
    (!draftsListed.ok ? draftsListed.error : null) ||
    (!sendsListed.ok ? sendsListed.error : null);

  return (
    <EmailsShell title="Papelera">
      {error ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {error}
        </div>
      ) : (
        <TrashMailbox drafts={drafts} sends={sends} />
      )}
    </EmailsShell>
  );
}
