import Link from 'next/link';
import { ShieldOff } from 'lucide-react';

import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { tenantHref } from '@/lib/pharmacies/tenant-nav';

/**
 * Pantalla coherente cuando el rol no puede entrar a un apartado del panel.
 * Evita redirects silenciosos al dashboard.
 */
export function PharmacySectionAccessDenied({
  pharmacyId,
  title = 'Acceso no disponible',
}: {
  pharmacyId: string;
  title?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <EmptyState
        icon={ShieldOff}
        title={title}
        description="Tu usuario no tiene permiso para acceder a este apartado de la aplicación."
        action={
          <Button asChild>
            <Link href={tenantHref(pharmacyId, 'dashboard')}>
              Volver al dashboard
            </Link>
          </Button>
        }
      />
    </div>
  );
}
