'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Phone,
  Globe,
  Clock,
  Moon,
  Sun,
  Lock,
  LogOut,
  Monitor,
  Save,
  LogIn,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import { PageHeader } from '@/components/shared/page-header';

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

function IconInput({
  icon: Icon,
  ...props
}: {
  icon: React.ComponentType<{ className?: string }>;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="h-10 pl-9" {...props} />
    </div>
  );
}

export default function PerfilPage() {
  const router = useRouter();
  const themeCtx = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const [name, setName] = React.useState('Admin FarmaFácil');
  const [email, setEmail] = React.useState('admin@farmafacil.es');
  const [phone, setPhone] = React.useState('+34 600 00 00 00');
  const [language, setLanguage] = React.useState('es');
  const [timezone, setTimezone] = React.useState('Europe/Madrid');
  const [currentTheme, setCurrentTheme] = React.useState('light');

  React.useEffect(() => {
    if (mounted) setCurrentTheme(themeCtx.theme ?? 'light');
  }, [mounted, themeCtx.theme]);

  const themeOptions = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Oscuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Mi perfil"
        description="Gestiona tu información personal y preferencias"
      />

      {/* Avatar + name */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <Avatar className="h-20 w-20 border-2 border-border">
            <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
              AF
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-lg font-semibold text-foreground">{name}</h2>
            <p className="text-sm text-muted-foreground">{email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              SuperAdministrador · Miembro desde enero 2023
            </p>
          </div>
          <Button variant="outline" size="sm">
            Cambiar avatar
          </Button>
        </div>
      </div>

      {/* Personal info */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
        <h3 className="mb-5 text-base font-semibold text-foreground">
          Datos personales
        </h3>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Nombre">
            <IconInput
              icon={User}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Email">
            <IconInput
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Teléfono">
            <IconInput
              icon={Phone}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
        <h3 className="mb-5 text-base font-semibold text-foreground">
          Preferencias
        </h3>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Idioma">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-10">
                <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ca">Català</SelectItem>
                <SelectItem value="eu">Euskara</SelectItem>
                <SelectItem value="gl">Galego</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Zona horaria">
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="h-10">
                <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/Madrid">Europe/Madrid (GMT+1)</SelectItem>
                <SelectItem value="Europe/London">Europe/London (GMT+0)</SelectItem>
                <SelectItem value="America/New_York">America/New_York (GMT-5)</SelectItem>
                <SelectItem value="America/Mexico_City">America/Mexico_City (GMT-6)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Theme selector */}
        <div className="mt-5">
          <Label className="mb-2 block text-sm font-medium text-foreground">
            Tema
          </Label>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const active = currentTheme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => themeCtx.setTheme(opt.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border p-4 transition-all',
                    active
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/30 hover:bg-muted/40'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5',
                      active ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <span
                    className={cn(
                      'text-sm font-medium',
                      active ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
        <h3 className="mb-5 flex items-center gap-2 text-base font-semibold text-foreground">
          <Lock className="h-4 w-4 text-muted-foreground" /> Cambiar contraseña
        </h3>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Contraseña actual">
            <Input type="password" placeholder="••••••••" className="h-10" />
          </Field>
          <div className="hidden sm:block" />
          <Field label="Nueva contraseña">
            <Input type="password" placeholder="••••••••" className="h-10" />
          </Field>
          <Field label="Confirmar contraseña">
            <Input type="password" placeholder="••••••••" className="h-10" />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Save className="h-4 w-4" /> Actualizar contraseña
          </Button>
        </div>
      </div>

      {/* Sessions */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
        <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-foreground">
          <LogIn className="h-4 w-4 text-muted-foreground" /> Sesiones activas
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Cierra las sesiones abiertas en otros dispositivos.
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3">
              <Monitor className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Este dispositivo · Chrome
                </p>
                <p className="text-xs text-muted-foreground">
                  Madrid, España · Activa ahora
                </p>
              </div>
            </div>
            <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
              Actual
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <Monitor className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Safari · iPhone
                </p>
                <p className="text-xs text-muted-foreground">
                  Hace 2 días
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-destructive">
              Cerrar
            </Button>
          </div>
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => router.push('/login')}
          >
            <LogOut className="h-4 w-4" /> Cerrar todas las sesiones
          </Button>
        </div>
      </div>

      {/* Save bar */}
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5">
          <Save className="h-4 w-4" /> Guardar cambios
        </Button>
      </div>
    </div>
  );
}
