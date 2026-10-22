'use client';

import { FileStack, Save } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PendingIntegrationBadge } from './pending-integration-badge';

/**
 * Interfaz de presupuestos preparada para Fase 3.
 * Sin datos ficticios ni apariencia de registros guardados.
 */
export function QuotesPanel() {
  return (
    <div className="space-y-6">
      <Card className="flex flex-col items-start gap-4 p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              Presupuestos guardados
            </h3>
            <PendingIntegrationBadge label="Persistencia en Fase 3" />
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Aquí se listarán borradores, enviados, aceptados, rechazados y
            caducados. Cada presupuesto conservará una instantánea de importes
            y condiciones. En esta fase no hay almacenamiento.
          </p>
        </div>
        <Button type="button" disabled className="gap-1.5 shrink-0">
          <Save className="h-4 w-4" />
          Guardar presupuesto
        </Button>
      </Card>

      <Card className="overflow-hidden shadow-soft">
        <div className="border-b border-border px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Columnas previstas
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Cliente / farmacia
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Plan
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Modalidad
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Total año 1
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Estado
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Actualizado
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="px-4 py-16">
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <FileStack className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        Sin presupuestos almacenados
                      </p>
                      <p className="max-w-md text-sm text-muted-foreground">
                        No se muestran ejemplos ficticios. Cuando autorices la
                        Fase 3, los presupuestos se guardarán en Supabase con
                        snapshot comercial.
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            Detalle de presupuesto
          </h3>
          <PendingIntegrationBadge />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Vista preparada para consultar líneas, IVA, notas, vinculación a
          farmacia, duplicado y cambio de estado (borrador → enviado →
          aceptado / rechazado / caducado). Selecciona un presupuesto cuando
          exista persistencia.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled>
            Duplicar
          </Button>
          <Button type="button" variant="outline" size="sm" disabled>
            Cambiar estado
          </Button>
          <Button type="button" variant="outline" size="sm" disabled>
            Vincular farmacia
          </Button>
        </div>
      </Card>
    </div>
  );
}
