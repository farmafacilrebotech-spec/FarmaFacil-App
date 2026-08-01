'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type IconType = 'pharmacy' | 'clients' | 'orders' | 'revenue' | 'today' | 'products';

const iconPaths: Record<IconType, React.ReactNode> = {
  pharmacy: (
    <path d="M3 9.5 12 4l9 5.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5Z" />
  ),
  clients: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.4" />
      <path d="M17 14.5a5 5 0 0 1 3.5 4.5" />
    </>
  ),
  orders: (
    <>
      <path d="M5 7h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 7Z" />
      <path d="M9 7V5.5a3 3 0 0 1 6 0V7" />
    </>
  ),
  revenue: <path d="M12 2v20M6 6h9a2.5 2.5 0 0 1 0 5H9a2.5 2.5 0 0 0 0 5h9" />,
  today: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  products: (
    <>
      <path d="M5 8h14l-1 11a2 2 0 0 1-2 1.8H8A2 2 0 0 1 6 19L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
};

import { DeltaBadge } from './page-header';
import { Sparkline } from './sparkline';

export function KpiCard({
  label,
  value,
  delta,
  trend,
  icon,
  className,
}: {
  label: string;
  value: string;
  delta: number;
  trend: number[];
  icon: IconType;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-md',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            {iconPaths[icon]}
          </svg>
        </div>
        <DeltaBadge delta={delta} />
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <Sparkline data={trend} width={96} height={32} />
      </div>
    </div>
  );
}
