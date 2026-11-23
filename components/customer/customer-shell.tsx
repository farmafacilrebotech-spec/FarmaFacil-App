import { BrandLogo, PharmacyLogo } from '@/components/brand';
import { CustomerAuthLink } from '@/components/customer/customer-auth-link';
import { CustomerStickyHeader } from '@/components/customer/customer-sticky-header';
import { CustomerPwaRegister } from '@/components/customer/customer-pwa-register';
import { InstallPwaHint } from '@/components/customer/install-pwa-hint';
import { cn } from '@/lib/utils';

export function CustomerShell({
  publicId,
  pharmacyLabel,
  pharmacyLogoUrl,
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
  pharmacyLogoUrl?: string | null;
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
      <div className="relative z-0 flex min-h-[100dvh] min-h-screen items-start justify-center overflow-x-hidden overflow-y-auto bg-background px-4 py-6 sm:items-center sm:py-8">
        <CustomerPwaRegister />
        <div className="relative z-10 w-full min-w-0 max-w-[420px] animate-slide-up">
          <div className="mb-6 flex justify-center sm:mb-8">
            {/*
              Logo oficial completo, sin máscara circular ni scale que recorte
              el aro / FARMAFÁCIL / cruz. Mismo asset que farmacia; sin tagline.
            */}
            <BrandLogo size={112} />
          </div>

          {pharmacyLabel ? (
            <div className="mb-4 flex flex-col items-center gap-2 text-center">
              {pharmacyLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pharmacyLogoUrl}
                  alt=""
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-2xl bg-white object-contain shadow-sm ring-1 ring-border"
                />
              ) : null}
              <p className="text-sm font-medium text-foreground">
                {pharmacyLabel}
              </p>
            </div>
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
    // overflow-x-clip (no hidden): hidden convierte el contenedor en scroll
    // container y rompe `position: sticky` de la cabecera.
    <div className="min-h-screen overflow-x-clip bg-[#F7FAFA]">
      <CustomerPwaRegister />
      <CustomerStickyHeader>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <BrandLogo size={36} />
          <div className="flex min-w-0 flex-col items-end text-right">
            {publicId ? (
              <CustomerAuthLink
                href={catalogHref}
                className="min-h-0 text-xs font-medium text-slate-600 hover:underline sm:text-sm"
              >
                Volver al catálogo
              </CustomerAuthLink>
            ) : null}
            <CustomerAuthLink
              href="/cuenta/mis-farmacias"
              className="min-h-0 text-xs font-medium text-[#2EC4C7] hover:underline sm:text-sm"
            >
              Mis farmacias
            </CustomerAuthLink>
          </div>
        </div>
        <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
          <h1 className="min-w-0 truncate text-lg font-semibold text-[#0F2A2E] sm:text-2xl">
            {title}
          </h1>
          {pharmacyLabel ? (
            <div className="flex min-w-0 max-w-[55%] shrink-0 items-center gap-1.5">
              <PharmacyLogo
                name={pharmacyLabel}
                logoUrl={pharmacyLogoUrl}
                logoColor="#2EC4C7"
                size={24}
                rounded="lg"
                className="bg-white ring-1 ring-slate-100"
              />
              <p className="min-w-0 truncate text-xs font-medium text-slate-700 sm:text-sm">
                {pharmacyLabel}
              </p>
            </div>
          ) : null}
        </div>
      </CustomerStickyHeader>
      <div className="mx-auto w-full min-w-0 max-w-lg px-4 pb-6 pt-4">
        <header className="mb-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            FarmaFácil · Mi cuenta
          </p>
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
