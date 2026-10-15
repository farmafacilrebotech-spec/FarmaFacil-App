'use client';

import { Users } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';

/**
 * Legacy tab — no conectada al detalle actual (PharmacyUsersPanel).
 * Sin datos ficticios.
 */
export function UsuariosTab() {
  return (
    <EmptyState
      icon={Users}
      title="Usuarios"
      description="Gestiona miembros desde el panel de usuarios de la farmacia. No se muestran datos de demostración."
    />
  );
}
