import { cn } from '@/lib/utils';

/**
 * Enlace de navegación del área cliente.
 * Usa <a href> nativo (navegación de documento) para evitar soft-nav de
 * Next App Router que a veces enfoca el enlace sin cambiar de ruta.
 */
export function CustomerAuthLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        'relative z-10 inline-flex min-h-[44px] items-center justify-center touch-manipulation',
        className
      )}
    >
      {children}
    </a>
  );
}
