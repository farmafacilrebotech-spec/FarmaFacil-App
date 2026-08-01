'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Mail, ShieldCheck } from 'lucide-react';

import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';

export default function InvitePage() {
  const router = useRouter();
  const [accepted, setAccepted] = React.useState(false);

  return (
    <div className="animate-slide-up">
      <div className="mb-8 flex justify-center">
        <BrandLogo size={44} showTagline />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft-lg">
        {/* Pharmacy header */}
        <div className="flex flex-col items-center gap-3 bg-gradient-to-b from-primary/5 to-transparent px-8 py-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-semibold text-white shadow-soft">
            <span
              className="flex h-full w-full items-center justify-center rounded-2xl"
              style={{ backgroundColor: '#2EC4C7' }}
            >
              FC
            </span>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Farmacia Central
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Madrid, Madrid
            </p>
          </div>
        </div>

        <div className="px-8 py-6">
          {!accepted ? (
            <>
              <div className="mb-6 text-center">
                <h2 className="text-lg font-semibold text-foreground">
                  Has sido invitado a FarmaFácil
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Admin FarmaFácil
                  </span>{' '}
                  te ha invitado como{' '}
                  <span className="font-medium text-foreground">
                    Administrador de Farmacia
                  </span>{' '}
                  de Farmacia Central.
                </p>
              </div>

              <div className="mb-6 flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Invitación enviada a
                  </p>
                  <p className="text-sm text-muted-foreground">
                    marta@farmaciacentral.es
                  </p>
                </div>
              </div>

              <Button
                className="h-11 w-full gap-1.5"
                size="lg"
                onClick={() => setAccepted(true)}
              >
                <ShieldCheck className="h-4 w-4" /> Aceptar invitación
              </Button>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Al aceptar, se creará tu cuenta de acceso a la farmacia.
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-foreground">
                Invitación aceptada
              </h2>
              <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                Tu cuenta está lista. Configura tu contraseña para acceder
                al panel de Farmacia Central.
              </p>
              <Button
                className="mt-6 h-11 gap-1.5"
                size="lg"
                onClick={() => router.push('/first-access')}
              >
                Configurar acceso
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
