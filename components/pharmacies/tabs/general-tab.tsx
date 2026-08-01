import * as React from 'react';
import { Globe, Mail, Phone, MapPin, Calendar, CreditCard, User } from 'lucide-react';
import type { Pharmacy } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { planLabels, statusLabels } from '@/lib/mock-data';
import { StatusBadge, toneForPharmacyStatus } from '@/components/shared/status-badge';
import { PharmacyLogo } from '@/components/brand';

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function GeneralTab({ pharmacy }: { pharmacy: Pharmacy }) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* Logo + status */}
      <div className="space-y-4">
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-6 text-center">
          <PharmacyLogo
            name={pharmacy.name}
            logoColor={pharmacy.logoColor}
            size={80}
            rounded="2xl"
            className="shadow-soft"
          />
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {pharmacy.name}
          </h3>
          <p className="text-sm text-muted-foreground">{pharmacy.legalName}</p>
          <div className="mt-3 flex items-center gap-2">
            <StatusBadge tone={toneForPharmacyStatus(pharmacy.status)}>
              {statusLabels[pharmacy.status]}
            </StatusBadge>
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
              {planLabels[pharmacy.plan]}
            </span>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="lg:col-span-2">
        <div className="grid grid-cols-1 gap-x-8 gap-y-0 sm:grid-cols-2">
          <div className="divide-y divide-border sm:border-r sm:border-border sm:pr-8">
            <InfoRow icon={User} label="Razón social" value={pharmacy.legalName} />
            <InfoRow icon={CreditCard} label="CIF" value={pharmacy.cif} />
            <InfoRow
              icon={MapPin}
              label="Dirección"
              value={`${pharmacy.address}, ${pharmacy.postalCode}`}
            />
            <InfoRow icon={MapPin} label="Ciudad" value={pharmacy.city} />
            <InfoRow icon={MapPin} label="Provincia" value={pharmacy.province} />
          </div>
          <div className="divide-y divide-border sm:pl-8">
            <InfoRow icon={Phone} label="Teléfono" value={pharmacy.phone} />
            <InfoRow icon={Mail} label="Email" value={pharmacy.email} />
            <InfoRow
              icon={Globe}
              label="Web"
              value={pharmacy.web || '—'}
            />
            <InfoRow
              icon={User}
              label="Administrador"
              value={pharmacy.adminUser.name}
            />
            <InfoRow
              icon={Calendar}
              label="Fecha de alta"
              value={formatDate(pharmacy.joinedAt)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
