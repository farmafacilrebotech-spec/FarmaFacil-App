import type { LucideIcon } from 'lucide-react';

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
}: {
  title: string;
  description: string;
  moduleTitle: string;
  moduleDescription: string;
  icon: LucideIcon;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title={title} description={description} />
      <ModulePlaceholder
        icon={icon}
        title={moduleTitle}
        description={moduleDescription}
      />
    </div>
  );
}
