import * as React from 'react';
import { cn } from '@/lib/utils';

export function ModulePlaceholder({
  title,
  description,
  icon: Icon,
  className,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-20 text-center',
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
      <p className="mt-4 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        Disponible en la Fase 2
      </p>
    </div>
  );
}
