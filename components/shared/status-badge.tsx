import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

const toneMap: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary border-primary/15',
  success: 'bg-success/10 text-success border-success/15',
  warning: 'bg-warning/10 text-warning border-warning/15',
  danger: 'bg-destructive/10 text-destructive border-destructive/15',
  neutral: 'bg-muted text-muted-foreground border-border',
};

export function StatusBadge({
  tone,
  children,
  dot = true,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 font-medium', toneMap[tone], className)}
    >
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            tone === 'primary' && 'bg-primary',
            tone === 'success' && 'bg-success',
            tone === 'warning' && 'bg-warning',
            tone === 'danger' && 'bg-destructive',
            tone === 'neutral' && 'bg-muted-foreground'
          )}
        />
      )}
      {children}
    </Badge>
  );
}

export function toneForPharmacyStatus(status: string): Tone {
  switch (status) {
    case 'active':
      return 'success';
    case 'contract_signed':
    case 'pending_setup':
      return 'primary';
    case 'pending_contract':
    case 'contract_sent':
      return 'warning';
    case 'suspended':
      return 'danger';
    case 'draft':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function toneForContractStatus(status: string): Tone {
  switch (status) {
    case 'signed':
      return 'success';
    case 'sent':
      return 'primary';
    case 'expiring':
      return 'warning';
    case 'expired':
      return 'danger';
    case 'draft':
    case 'none':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function toneForOrderStatus(status: string): Tone {
  switch (status) {
    case 'delivered':
      return 'success';
    case 'prepared':
      return 'primary';
    case 'preparing':
      return 'warning';
    case 'pending':
      return 'neutral';
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function toneForProductStatus(status: string): Tone {
  switch (status) {
    case 'in_stock':
      return 'success';
    case 'low_stock':
      return 'warning';
    case 'out_of_stock':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function toneForUserStatus(status: string): Tone {
  switch (status) {
    case 'active':
    case 'invite_accepted':
      return 'success';
    case 'invite_sent':
      return 'primary';
    case 'pending':
      return 'warning';
    case 'suspended':
    case 'disabled':
      return 'danger';
    default:
      return 'neutral';
  }
}
