'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { deleteEmailDraftAction } from '@/app/(app)/emails/actions';
import { Button } from '@/components/ui/button';

export function DraftsDeleteButton({ draftId }: { draftId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!window.confirm('¿Eliminar este borrador?')) return;
    setBusy(true);
    const result = await deleteEmailDraftAction(draftId);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Borrador eliminado.');
    router.refresh();
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      disabled={busy}
      onClick={() => void onDelete()}
    >
      {busy ? '…' : 'Eliminar'}
    </Button>
  );
}
