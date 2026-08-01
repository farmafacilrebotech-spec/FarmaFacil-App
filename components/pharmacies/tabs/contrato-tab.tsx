'use client';

import * as React from 'react';
import {
  FileText,
  Download,
  Eye,
  RefreshCw,
  Calendar,
  Send,
  PenLine,
  Clock,
} from 'lucide-react';
import type { Pharmacy } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { contractStatusLabels } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import {
  StatusBadge,
  toneForContractStatus,
} from '@/components/shared/status-badge';

function DateRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-foreground">
          {value ? formatDate(value) : '—'}
        </p>
      </div>
    </div>
  );
}

export function ContratoTab({ pharmacy }: { pharmacy: Pharmacy }) {
  const c = pharmacy.contract;
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* Document preview */}
      <div className="lg:col-span-2">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                Contrato {c.version}
              </span>
            </div>
            <StatusBadge tone={toneForContractStatus(c.status)}>
              {contractStatusLabels[c.status]}
            </StatusBadge>
          </div>
          {/* Fake document */}
          <div className="bg-muted/20 p-8">
            <div className="mx-auto max-w-md space-y-3 rounded-lg bg-card p-8 shadow-soft">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: pharmacy.logoColor }}
                >
                  <FileText className="h-5 w-5" />
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Contrato
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {c.version}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-2 w-full rounded bg-muted" />
                <div className="h-2 w-5/6 rounded bg-muted" />
                <div className="h-2 w-4/6 rounded bg-muted" />
                <div className="h-2 w-full rounded bg-muted" />
                <div className="h-2 w-3/4 rounded bg-muted" />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-4">
                <div>
                  <p className="text-[10px] font-medium uppercase text-muted-foreground">
                    Firmado
                  </p>
                  <p className="text-xs font-medium text-foreground">
                    {c.signedAt ? formatDate(c.signedAt) : 'Pendiente'}
                  </p>
                </div>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: pharmacy.logoColor }}
                >
                  <PenLine className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-4">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Eye className="h-4 w-4" /> Visualizar
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-4 w-4" /> Descargar PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> Sustituir contrato
            </Button>
          </div>
        </div>
      </div>

      {/* Side info */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <h4 className="text-sm font-semibold text-foreground">
            Estado del contrato
          </h4>
          <div className="mt-3">
            <StatusBadge tone={toneForContractStatus(c.status)} dot={false}>
              {contractStatusLabels[c.status]}
            </StatusBadge>
          </div>
          <div className="mt-2 divide-y divide-border">
            <DateRow icon={Send} label="Fecha de envío" value={c.sentAt} />
            <DateRow icon={PenLine} label="Fecha de firma" value={c.signedAt} />
            <DateRow icon={Clock} label="Fecha de renovación" value={c.renewalAt} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-5">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold text-foreground">
              Próxima renovación
            </h4>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {c.renewalAt ? formatDate(c.renewalAt) : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {c.status === 'expiring'
              ? 'El contrato vence pronto. Inicia la renovación.'
              : c.status === 'expired'
                ? 'El contrato ha expirado. Contacta con la farmacia.'
                : 'El contrato está vigente.'}
          </p>
        </div>
      </div>
    </div>
  );
}
