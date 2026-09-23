import Link from 'next/link';

import { BrandLogo } from '@/components/brand';
import {
  LEGAL_DOCS_EFFECTIVE_DATE,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from '@/lib/legal/versions';

export function LegalDocShell({
  title,
  docKind,
  version,
  children,
}: {
  title: string;
  docKind: 'terms' | 'privacy';
  version: string;
  children: React.ReactNode;
}) {
  const counterpart =
    docKind === 'terms'
      ? { href: '/legal/privacidad', label: 'Política de Privacidad' }
      : { href: '/legal/terminos', label: 'Términos y Condiciones' };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-5">
          <BrandLogo size={36} showTagline />
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Acceder
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Borrador pendiente de revisión jurídica
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Versión {version}
          {docKind === 'terms'
            ? ` · Términos ${TERMS_VERSION}`
            : ` · Privacidad ${PRIVACY_VERSION}`}
          {' · '}
          Vigencia orientativa: {LEGAL_DOCS_EFFECTIVE_DATE}
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
          {children}
        </div>

        <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>
            Documento relacionado:{' '}
            <Link
              href={counterpart.href}
              className="font-medium text-primary hover:underline"
            >
              {counterpart.label}
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
