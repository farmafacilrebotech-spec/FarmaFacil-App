import * as React from 'react';
import {
  AlertTriangle,
  CreditCard,
  ShoppingCart,
  Store,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActivityItem } from '@/lib/types';

const iconFor: Record<ActivityItem['type'], LucideIcon> = {
  order: ShoppingCart,
  pharmacy: Store,
  client: UserPlus,
  payment: CreditCard,
  alert: AlertTriangle,
};

const toneFor: Record<ActivityItem['type'], string> = {
  order: 'bg-primary/10 text-primary',
  pharmacy: 'bg-chart-5/10 text-chart-5',
  client: 'bg-chart-2/10 text-chart-2',
  payment: 'bg-success/10 text-success',
  alert: 'bg-warning/10 text-warning',
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <ol className="space-y-1">
      {items.map((item, i) => {
        const Icon = iconFor[item.type];
        return (
          <li key={item.id}>
            <div
              className={cn(
                'group flex gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50',
                i !== items.length - 1 && 'border-b border-border/40'
              )}
            >
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  toneFor[item.type]
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {item.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {item.time}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
