import type { Metadata } from 'next';

import { LegalDocShell } from '@/components/legal/legal-doc-shell';
import { PrivacyContent } from '@/components/legal/privacy-content';
import { PRIVACY_VERSION } from '@/lib/legal/versions';

export const metadata: Metadata = {
  title: 'Política de Privacidad · FarmaFácil',
  description:
    'Política de Privacidad de FarmaFácil (borrador pendiente de revisión jurídica).',
};

export default function PrivacidadPage() {
  return (
    <LegalDocShell
      title="Política de Privacidad"
      docKind="privacy"
      version={PRIVACY_VERSION}
    >
      <PrivacyContent />
    </LegalDocShell>
  );
}
