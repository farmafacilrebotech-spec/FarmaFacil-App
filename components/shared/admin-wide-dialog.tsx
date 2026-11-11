'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Dialog amplio SuperAdmin: scroll interno, responsive, confirmación al
 * descartar cambios sin guardar.
 */
export function AdminWideDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  dirty = false,
  className,
  size = 'xl',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dirty?: boolean;
  className?: string;
  size?: 'lg' | 'xl' | '2xl' | 'full';
}) {
  const [discardOpen, setDiscardOpen] = React.useState(false);

  function requestClose(next: boolean) {
    if (!next && dirty) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(next);
  }

  const width =
    size === 'full'
      ? 'max-w-[min(96vw,1200px)]'
      : size === '2xl'
        ? 'max-w-4xl'
        : size === 'xl'
          ? 'max-w-3xl'
          : 'max-w-2xl';

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent
          className={cn(
            width,
            'flex max-h-[min(92vh,900px)] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:rounded-xl',
            className
          )}
        >
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {children}
          </div>
          {footer ? (
            <DialogFooter className="shrink-0 border-t border-border px-5 py-3 sm:justify-end">
              {footer}
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Hay cambios sin guardar. Si cierras ahora, se perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDiscardOpen(false);
                onOpenChange(false);
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
