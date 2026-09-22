import Link from 'next/link';
import { ArrowLeft, Store } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function PharmacyNotFound() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Store className="h-12 w-12 text-muted-foreground/40" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">
          Farmacia no encontrada
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          La farmacia que buscas no existe o ha sido eliminada.
        </p>
        <Button asChild className="mt-5" size="sm">
          <Link href="/farmacias">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Volver a farmacias
          </Link>
        </Button>
      </div>
    </div>
  );
}
