'use client';

import * as React from 'react';
import { Save, Upload, Clock, MessageSquare } from 'lucide-react';
import type { Pharmacy } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PersonalizacionTab({ pharmacy }: { pharmacy: Pharmacy }) {
  const c = pharmacy.customization;
  const [primary, setPrimary] = React.useState(c.primaryColor);
  const [secondary, setSecondary] = React.useState(c.secondaryColor);
  const [welcome, setWelcome] = React.useState(c.welcomeMessage);
  const [schedule, setSchedule] = React.useState(c.schedule);
  const [address, setAddress] = React.useState(pharmacy.address);
  const [phone, setPhone] = React.useState(pharmacy.phone);
  const [email, setEmail] = React.useState(pharmacy.email);
  const [whatsapp, setWhatsapp] = React.useState(c.whatsapp);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* Logo upload */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <h4 className="text-sm font-semibold text-foreground">Logotipo</h4>
          <div className="mt-4 flex flex-col items-center gap-4">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-2xl text-2xl font-semibold text-white shadow-soft"
              style={{ backgroundColor: primary }}
            >
              {pharmacy.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Upload className="h-4 w-4" /> Subir logo
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              PNG o SVG · máximo 2 MB · 512×512 px recomendado
            </p>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h4 className="text-sm font-semibold text-foreground">
            Vista previa
          </h4>
          <div
            className="mt-3 rounded-lg p-4"
            style={{ backgroundColor: primary }}
          >
            <p className="text-sm font-medium text-white">{welcome}</p>
          </div>
          <div className="mt-2 flex gap-2">
            <span
              className="h-6 w-6 rounded-full border border-border"
              style={{ backgroundColor: primary }}
            />
            <span
              className="h-6 w-6 rounded-full border border-border"
              style={{ backgroundColor: secondary }}
            />
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="lg:col-span-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Color principal">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background"
                />
                <Input value={primary} onChange={(e) => setPrimary(e.target.value)} className="flex-1" />
              </div>
            </Field>
            <Field label="Color secundario">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondary}
                  onChange={(e) => setSecondary(e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background"
                />
                <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} className="flex-1" />
              </div>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Mensaje de bienvenida">
                <Textarea
                  value={welcome}
                  onChange={(e) => setWelcome(e.target.value)}
                  rows={2}
                  placeholder="¡Bienvenido a nuestra farmacia!"
                />
              </Field>
            </div>
            <Field label="Horario">
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={schedule} onChange={(e) => setSchedule(e.target.value)} className="pl-9" placeholder="L-V 9:00-21:30" />
              </div>
            </Field>
            <Field label="WhatsApp">
              <div className="relative">
                <MessageSquare className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="pl-9" placeholder="+34 611 22 33 44" />
              </div>
            </Field>
            <Field label="Dirección">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <Field label="Teléfono">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="mt-6 flex justify-end border-t border-border pt-5">
            <Button size="sm" className="gap-1.5">
              <Save className="h-4 w-4" /> Guardar cambios
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
