'use client';

import * as React from 'react';

import {
  withoutInternalCosts,
  type CommercialTariffConfig,
} from '@/lib/tarifas';
import type {
  CommercialPilotRow,
  PilotKpis,
} from '@/lib/commercial/pilots-queries';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlansTariffsPanel } from './plans-tariffs-panel';
import { SimulatorPanel } from './simulator-panel';
import { QuotesPanel } from './quotes-panel';
import { PilotsPanel } from './pilots-panel';
import { PlanAssignmentPanel } from './plan-assignment-panel';

export type TarifasWorkspaceProps = {
  canManageTrials: boolean;
  canWriteMaster: boolean;
  canViewInternalCosts: boolean;
  /** Configuración ya filtrada en servidor (sin costes si no hay write). */
  initialConfig: CommercialTariffConfig;
  pilots: {
    rows: CommercialPilotRow[];
    kpis: PilotKpis;
    error: string | null;
  };
};

export function TarifasWorkspace({
  canManageTrials,
  canWriteMaster,
  canViewInternalCosts,
  initialConfig,
  pilots,
}: TarifasWorkspaceProps) {
  const [config, setConfig] = React.useState<CommercialTariffConfig>(() =>
    canViewInternalCosts ? initialConfig : withoutInternalCosts(initialConfig)
  );

  function onConfigChange(next: CommercialTariffConfig) {
    setConfig(canViewInternalCosts ? next : withoutInternalCosts(next));
  }

  return (
    <Tabs defaultValue="planes" className="space-y-6">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
        <TabsTrigger value="planes" className="flex-none">
          Planes y tarifas
        </TabsTrigger>
        <TabsTrigger value="contratacion" className="flex-none">
          Contratación
        </TabsTrigger>
        <TabsTrigger value="simulador" className="flex-none">
          Simulador
        </TabsTrigger>
        <TabsTrigger value="presupuestos" className="flex-none">
          Presupuestos
        </TabsTrigger>
        <TabsTrigger value="pilotos" className="flex-none">
          Gestión de pilotos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="planes" className="mt-0 focus-visible:outline-none">
        <PlansTariffsPanel
          config={config}
          onChange={onConfigChange}
          canViewInternalCosts={canViewInternalCosts}
        />
      </TabsContent>
      <TabsContent
        value="contratacion"
        className="mt-0 focus-visible:outline-none"
      >
        <PlanAssignmentPanel canManage={canManageTrials || canWriteMaster} />
      </TabsContent>
      <TabsContent
        value="simulador"
        className="mt-0 focus-visible:outline-none"
      >
        <SimulatorPanel config={config} />
      </TabsContent>
      <TabsContent
        value="presupuestos"
        className="mt-0 focus-visible:outline-none"
      >
        <QuotesPanel />
      </TabsContent>
      <TabsContent value="pilotos" className="mt-0 focus-visible:outline-none">
        <PilotsPanel
          initialRows={pilots.rows}
          initialKpis={pilots.kpis}
          loadError={pilots.error}
          canManage={canManageTrials}
        />
      </TabsContent>
    </Tabs>
  );
}
