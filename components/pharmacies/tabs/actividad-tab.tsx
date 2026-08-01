'use client';

import * as React from 'react';
import {
  FileText,
  Image as ImageIcon,
  QrCode as QrIcon,
  UserPlus,
  ShoppingCart,
  CreditCard,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PharmacyActivityItem } from '@/lib/types';

const iconFor: Record<PharmacyActivityItem['type'], LucideIcon> = {
  contract: FileText,
  logo: ImageIcon,
  qr: QrIcon,
  user: UserPlus,
  order: ShoppingCart,
  payment: CreditCard,
  config: Settings,
};

const toneFor: Record<PharmacyActivityItem['type'], string> = {
  contract: 'bg-primary/10 text-primary',
  logo: 'bg-chart-5/10 text-chart-5',
  qr: 'bg-chart-3/10 text-chart-3',
  user: 'bg-chart-2/10 text-chart-2',
  order: 'bg-primary/10 text-primary',
  payment: 'bg-success/10 text-success',
  config: 'bg-muted text-muted-foreground',
};

export function ActividadTab({
  activity,
}: {
  activity: PharmacyActivityItem[];
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-2 h-full w-px bg-border" />

        <ol className="space-y-6">
          {activity.map((item) => {
            const Icon = iconFor[item.type];
            return (
              <li key={item.id} className="relative">
                <div className="absolute -left-6 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-card">
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full',
                      toneFor[item.type]
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="ml-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.time}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Por {item.user}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
