import { BrandLogo } from '@/components/brand';
import { CustomerAuthLink } from '@/components/customer/customer-auth-link';
import { CustomerPwaRegister } from '@/components/customer/customer-pwa-register';
import { InstallPwaHint } from '@/components/customer/install-pwa-hint';
import { cn } from '@/lib/utils';

export function CustomerShell({
  publicId,
  pharmacyLabel,
  title,
  subtitle,
  children,
  showInstallHint = true,
  /** `auth`: logo grande centrado + columna tipo acceso farmacia (sin «Panel de gestión»). */
  variant = 'default',
}: {
  /** Si falta, la navegación usa rutas globales `/cuenta`. */
  publicId?: string | null;
  pharmacyLabel?: string | null;
  title: string;
  /** Texto de apoyo bajo el título (solo variant auth; el form puede omitirlo). */
  subtitle?: string | null;
  children: React.ReactNode;
  showInstallHint?: boolean;
  variant?: 'default' | 'auth';
}) {
  const cuentaBase = publicId ? `/e/${publicId}/cuenta` : '/cuenta';
  const catalogHref = publicId
    ? `/e/${publicId}/catalogo`
    : '/cuenta/mis-farmacias';

  if (variant === 'auth') {
    return (
      <div className="relative z-0 flex min-h-[100dvh] min-h-screen items-start justify-center overflow-y-auto bg-background px-4 py-6 sm:items-center sm:py-8">
        <CustomerPwaRegister />
        <div className="relative z-10 w-full max-w-[420px] animate-slide-up">
          <div className="mb-6 flex justify-center sm:mb-8">
            {/*
              Logo oficial completo, sin máscara circular ni scale que recorte
              el aro / FARMAFÁCIL / cruz. Mismo asset que farmacia; sin tagline.
            */}
            <BrandLogo size={112} />
          </div>

          {pharmacyLabel ? (
            <p className="mb-4 text-center text-sm text-muted-foreground">
              Contexto farmacia: {pharmacyLabel}
            </p>
          ) : null}

          <div className="relative z-10 w-full">{children}</div>

          <nav
            aria-label="Navegación de cuenta"
            className="relative z-10 mt-6 flex flex-col items-center gap-1 text-center text-sm"
          >
            {publicId ? (
              <CustomerAuthLink
                href={catalogHref}
                className="w-full font-medium text-muted-foreground hover:text-foreground"
              >
                Volver al catálogo
              </CustomerAuthLink>
            ) : (
              <CustomerAuthLink
                href="/cuenta/mis-farmacias"
                className="w-full font-medium text-muted-foreground hover:text-foreground"
              >
                Mis farmacias
              </CustomerAuthLink>
            )}
            <CustomerAuthLink
              href={cuentaBase}
              className="w-full font-medium text-muted-foreground hover:text-foreground"
            >
              Volver a Mi cuenta
            </CustomerAuthLink>
          </nav>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7FAFA] px-4 py-6">
      <CustomerPwaRegister />
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-5 flex items-center justify-between gap-3">
          <BrandLogo size={56} />
          <div className="flex flex-col items-end gap-1 text-right">
            {publicId ? (
              <CustomerAuthLink
                href={catalogHref}
                className="min-h-0 text-sm font-medium text-slate-600 hover:underline"
              >
                Volver al catálogo
              </CustomerAuthLink>
            ) : null}
            <CustomerAuthLink
              href="/cuenta/mis-farmacias"
              className="min-h-0 text-sm font-medium text-[#2EC4C7] hover:underline"
            >
              Mis farmacias
            </CustomerAuthLink>
          </div>
        </div>
        <header className="mb-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            FarmaFácil · Mi cuenta
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[#0F2A2E]">{title}</h1>
          {pharmacyLabel ? (
            <p className="mt-1 text-sm text-slate-500">
              Contexto farmacia: {pharmacyLabel}
            </p>
          ) : null}
          {subtitle ? (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          ) : null}
          <p className="mt-2 text-xs text-slate-400">
            Tu cuenta es global FarmaFácil. Visitar el QR no comparte tu perfil
            con la farmacia ni la guarda automáticamente.
          </p>
        </header>
        {showInstallHint ? (
          <div className="mb-4">
            <InstallPwaHint />
          </div>
        ) : null}
        {children}
        <p className={cn('mt-6 text-center text-xs text-slate-400')}>
          <CustomerAuthLink href={cuentaBase} className="min-h-0 hover:underline">
            Mi cuenta
          </CustomerAuthLink>
        </p>
      </div>
    </div>
  );
}
