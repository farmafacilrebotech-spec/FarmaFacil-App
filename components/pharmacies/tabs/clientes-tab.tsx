'use client';

import * as React from 'react';
import { Plus, Upload, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';

export function ClientesTab() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Clientes
          </h3>
          <p className="text-sm text-muted-foreground">
            Gestiona la base de clientes de esta farmacia
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Upload className="h-4 w-4" /> Importar Excel
          </Button>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Nuevo cliente
          </Button>
        </div>
      </div>

      <EmptyState
        icon={Users}
        title="Sin clientes importados"
        description="Esta farmacia aún no tiene clientes. Importa un archivo Excel o crea el primer cliente manualmente."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Upload className="h-4 w-4" /> Importar Excel
            </Button>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Nuevo cliente
            </Button>
          </div>
        }
      />
    </div>
  );
}
