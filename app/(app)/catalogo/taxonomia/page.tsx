import { Tags } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { TaxonomyAdminPanel } from '@/components/catalogo/taxonomy-admin-panel';
import {
  FF_COMMERCIAL_CATEGORY_COUNT,
  FF_TAXONOMY_CATEGORIES,
  LEGACY_CATEGORY_ALIASES,
  listCommercialCategories,
} from '@/lib/catalog/taxonomy';
import { resolvePlatformAccess } from '@/lib/auth/platform';
import { redirect } from 'next/navigation';

export default async function CatalogoTaxonomiaPage() {
  const access = await resolvePlatformAccess();
  if (access.status === 'unauthenticated') redirect('/login');
  if (access.status !== 'authorized') redirect('/dashboard');

  const commercial = listCommercialCategories();
  const internal = FF_TAXONOMY_CATEGORIES.filter((c) => !c.isCommercial);

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6">
      <PageHeader
        title="Taxonomía FarmaFácil"
        description="Categorías globales del catálogo comercial. Las farmacias no alteran esta taxonomía; solo pueden destacar categorías en su catálogo propio."
        actions={
          <Badge variant="outline" className="font-normal">
            <Tags className="mr-1.5 h-3.5 w-3.5" />
            {FF_COMMERCIAL_CATEGORY_COUNT} comerciales · SuperAdmin
          </Badge>
        }
      />
      <TaxonomyAdminPanel
        commercial={commercial}
        internal={internal}
        legacyAliases={Object.entries(LEGACY_CATEGORY_ALIASES).map(
          ([legacy, slug]) => ({ legacy, slug })
        )}
      />
    </div>
  );
}
