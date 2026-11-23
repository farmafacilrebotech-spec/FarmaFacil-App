import { notFound, redirect } from 'next/navigation';

import { HelpDocView } from '@/components/help/help-doc-view';
import { canAccessHelpDoc } from '@/lib/help/access';

export const dynamic = 'force-dynamic';

export default async function HelpDocPage({
  params,
}: {
  params: { docId: string };
}) {
  const access = await canAccessHelpDoc(params.docId);
  if (!access.ok) {
    if (access.reason === 'unauthenticated') {
      redirect(`/login?next=/ayuda/${params.docId}`);
    }
    if (access.reason === 'not_found') notFound();
    redirect('/access-denied');
  }

  return <HelpDocView doc={access.doc} backHref="/ayuda" />;
}
