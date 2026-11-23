import { cn } from '@/lib/utils';

/**
 * Cabecera fija (sticky) para el shell cliente/PWA en móvil.
 *
 * - `sticky` (no `fixed`): ocupa flujo, así que NO tapa el contenido.
 * - `pt-[env(safe-area-inset-top)]`: respeta notch/Dynamic Island cuando el
 *   viewport lo expone (standalone); si es 0 no añade espacio.
 * - Requiere que los ancestros no usen `overflow-x-hidden` (rompe sticky);
 *   los shells usan `overflow-x-clip`.
 */
export function CustomerStickyHeader({
  children,
  className,
  innerClassName = 'max-w-lg',
}: {
  children: React.ReactNode;
  className?: string;
  /** Ancho máximo del contenido interno (alineado con el shell). */
  innerClassName?: string;
}) {
  return (
    <div
      data-testid="customer-sticky-header"
      className={cn(
        'sticky top-0 z-30 border-b border-slate-200/70 bg-[#F7FAFA]/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-[#F7FAFA]/80',
        className
      )}
    >
      <div
        className={cn('mx-auto w-full min-w-0 px-4 py-2', innerClassName)}
      >
        {children}
      </div>
    </div>
  );
}
