'use client';

import * as React from 'react';
import Link from 'next/link';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function MailboxIconAction({
  label,
  children,
  href,
  onClick,
  disabled,
  className,
}: {
  label: string;
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const btnClass = cn(
    'inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors disabled:opacity-40',
    className
  );

  const control = href ? (
    <Link href={href} aria-label={label} className={btnClass}>
      {children}
    </Link>
  ) : (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={btnClass}
      onClick={onClick}
    >
      {children}
    </button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{control}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
