import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { PageHeader } from '@/components/shared/page-header';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';

/**
 * Pantalla de módulo tenant: misma estructura visual que el panel original,
 * sin datos mock de otras farmacias.
 */
export function PharmacyTenantModulePage({
  title,
  description,
  moduleTitle,
  moduleDescription,
  icon,
  children,
}: {
  title: string;
  description: string;
  moduleTitle: string;
  moduleDescription: string;
  icon: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title={title} description={description} />
      {children ? (
        children
      ) : (
        <ModulePlaceholder
          icon={icon}
          title={moduleTitle}
          description={moduleDescription}
        />
      )}
    </div>
  );
}
