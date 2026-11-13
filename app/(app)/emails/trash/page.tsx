import { listTrashedEmailDraftsAction } from '@/app/(app)/emails/actions';
import { EmailsShell } from '@/components/email/emails-shell';
import { TrashMailbox } from '@/components/email/trash-mailbox';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';

export const dynamic = 'force-dynamic';

export default async function EmailsTrashPage() {
  await assertEmailsPageAccess();
  const listed = await listTrashedEmailDraftsAction();

  return (
    <EmailsShell title="Papelera">
      {!listed.ok ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {listed.error}
        </div>
      ) : (
        <TrashMailbox drafts={listed.drafts} />
      )}
    </EmailsShell>
  );
}
