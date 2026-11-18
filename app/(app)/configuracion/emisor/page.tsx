import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { createClient } from '@/lib/supabase/server';
import { hasPlatformPermission } from '@/lib/auth/platform';
import { IssuerProfileForm } from '@/components/configuracion/issuer-profile-form';

export const dynamic = 'force-dynamic';

export default async function EmisorConfigPage() {
  const canManage = await hasPlatformPermission('platform.subscriptions.manage');
  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader title="Emisor corporativo" description="Acceso restringido." />
        <p className="text-sm text-muted-foreground">
          Solo SuperAdmin puede gestionar los datos del emisor.
        </p>
      </div>
    );
  }

  const supabase = createClient();
  const { data } = await supabase
    .from('platform_issuer_profile')
    .select(
      'id, commercial_name, legal_name, tax_id, fiscal_address, phone, billing_email, web, bank_iban, bank_holder, notes, is_current'
    )
    .eq('is_current', true)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/configuracion"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Configuración
        </Link>
      </div>
      <PageHeader
        title="Datos del emisor"
        description="Usados en documentos nuevos. No inventar NIF, domicilio ni IBAN: déjalos vacíos hasta verificación. Históricos conservan su snapshot."
      />
      <IssuerProfileForm
        initial={{
          id: data?.id ?? null,
          commercialName: data?.commercial_name ?? 'FarmaFácil',
          legalName: data?.legal_name ?? '',
          taxId: data?.tax_id ?? '',
          fiscalAddress: data?.fiscal_address ?? '',
          phone: data?.phone ?? '',
          billingEmail: data?.billing_email ?? '',
          web: data?.web ?? '',
          bankIban: data?.bank_iban ?? '',
          bankHolder: data?.bank_holder ?? '',
          notes: data?.notes ?? '',
        }}
      />
    </div>
  );
}
