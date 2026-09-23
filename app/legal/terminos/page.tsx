import type { Metadata } from 'next';

import { LegalDocShell } from '@/components/legal/legal-doc-shell';
import { TermsContent } from '@/components/legal/terms-content';
import { TERMS_VERSION } from '@/lib/legal/versions';

export const metadata: Metadata = {
  title: 'Términos y Condiciones · FarmaFácil',
  description:
    'Términos y Condiciones de uso de FarmaFácil (borrador pendiente de revisión jurídica).',
};

export default function TerminosPage() {
  return (
    <LegalDocShell
      title="Términos y Condiciones de uso de FarmaFácil"
      docKind="terms"
      version={TERMS_VERSION}
    >
      <TermsContent />
    </LegalDocShell>
  );
}
