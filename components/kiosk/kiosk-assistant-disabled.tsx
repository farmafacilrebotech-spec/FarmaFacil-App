import Link from 'next/link';
import { ArrowLeft, BotOff } from 'lucide-react';

export function KioskAssistantDisabled({
  pharmacyName,
  reason,
}: {
  pharmacyName: string;
  reason: 'module_disabled' | 'limit_exceeded' | 'error';
}) {
  const title =
    reason === 'limit_exceeded'
      ? 'Límite mensual alcanzado'
      : reason === 'error'
        ? 'Asistente no disponible'
        : 'Asistente no activado';

  const body =
    reason === 'limit_exceeded'
      ? 'Esta farmacia ha alcanzado el límite mensual del Asistente IA. Puedes consultar al farmacéutico en el mostrador o usar el buscador del kiosko.'
      : reason === 'error'
        ? 'No se ha podido comprobar el estado del asistente. Puedes preguntar en el mostrador.'
        : 'El Asistente IA no está contratado ni autorizado en modo demo para esta farmacia. Pregunta en el mostrador o usa las otras opciones del kiosko.';

  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-lg flex-col px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/k"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-foreground"
          aria-label="Volver al inicio"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {pharmacyName || 'FarmaFácil'}
          </p>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <BotOff className="h-8 w-8" />
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
        <Link
          href="/k"
          className="mt-2 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
