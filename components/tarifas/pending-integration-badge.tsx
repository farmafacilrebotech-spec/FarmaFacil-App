import { Badge } from '@/components/ui/badge';

/** Señala acciones/UI aún no conectadas a persistencia (Fase 3+). */
export function PendingIntegrationBadge({
  label = 'Pendiente de integración',
}: {
  label?: string;
}) {
  return (
    <Badge
      variant="outline"
      className="border-amber-500/40 bg-amber-500/10 font-normal text-amber-800 dark:text-amber-200"
    >
      {label}
    </Badge>
  );
}
