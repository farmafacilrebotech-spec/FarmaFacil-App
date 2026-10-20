'use client';

import * as React from 'react';

import { getPharmacyAssistantPendingConsultCountAction } from '@/app/f/[pharmacyId]/asistente/consultas/actions';
import { CONSULT_DASHBOARD_POLL_MS } from '@/lib/kiosk/assistant/consults/types';
import { cn } from '@/lib/utils';

/**
 * Contador de consultas pendientes junto al ítem «Asistente» del sidebar.
 */
export function AssistantConsultPendingBadge({
  pharmacyId,
  collapsed,
}: {
  pharmacyId: string;
  collapsed: boolean;
}) {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      const result =
        await getPharmacyAssistantPendingConsultCountAction(pharmacyId);
      if (cancelled || !result.ok) return;
      setCount(result.count);
    }
    void load();
    const id = window.setInterval(() => {
      void load();
    }, CONSULT_DASHBOARD_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pharmacyId]);

  if (count < 1) return null;

  return (
    <span
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white',
        collapsed && 'lg:absolute lg:right-1 lg:top-1'
      )}
      aria-label={`${count} consultas pendientes`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
