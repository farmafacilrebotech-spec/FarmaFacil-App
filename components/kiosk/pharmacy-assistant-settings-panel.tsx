'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2, MessageSquarePlus, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { savePharmacyAssistantSettingsAction } from '@/app/f/[pharmacyId]/asistente/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AssistantCommercialUiState } from '@/lib/kiosk/assistant/entitlement-status';
import type {
  AssistantFaqItem,
  PharmacyAssistantSettings,
  PharmacyAssistantUsageMonthly,
} from '@/lib/kiosk/assistant/settings';
import { tenantHref } from '@/lib/pharmacies/tenant-nav';

export function PharmacyAssistantSettingsPanel({
  pharmacyId,
  uiState,
  moduleUsable,
  settings,
  usage,
  monthlyLimit,
  canEdit,
}: {
  pharmacyId: string;
  uiState: AssistantCommercialUiState;
  moduleUsable: boolean;
  settings: PharmacyAssistantSettings;
  usage: PharmacyAssistantUsageMonthly | null;
  monthlyLimit: number | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [assistantName, setAssistantName] = React.useState(
    settings.assistantName
  );
  const [welcomeMessage, setWelcomeMessage] = React.useState(
    settings.welcomeMessage
  );
  const [customInstructions, setCustomInstructions] = React.useState(
    settings.customInstructions
  );
  const [servicesInfo, setServicesInfo] = React.useState(settings.servicesInfo);
  const [hoursInfo, setHoursInfo] = React.useState(settings.hoursInfo);
  const [faqs, setFaqs] = React.useState<AssistantFaqItem[]>(
    settings.faqs.length ? settings.faqs : []
  );

  const statusCopy =
    uiState === 'demo_active'
      ? 'Modo DEMO activo (contenido genérico en kiosko; puedes preparar textos para cuando se contrate).'
      : uiState === 'contracted_active'
        ? 'Módulo contratado. Los cambios se aplican al asistente del kiosko.'
        : 'El módulo no está disponible. Contacta con FarmaFácil para activar DEMO o contratar.';

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    const result = await savePharmacyAssistantSettingsAction({
      pharmacyId,
      assistantName,
      welcomeMessage,
      customInstructions,
      faqs,
      servicesInfo,
      hoursInfo,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">Asistente IA</h2>
        <p className="mt-1 text-sm text-muted-foreground">{statusCopy}</p>
        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <p>
            Uso del mes ({usage?.periodYm ?? '—'}):{' '}
            <span className="font-medium text-foreground">
              {usage?.requestCount ?? 0}
              {monthlyLimit != null ? ` / ${monthlyLimit}` : ''}
            </span>
          </p>
          <p>
            Tokens in/out:{' '}
            <span className="font-medium text-foreground">
              {usage?.promptTokens ?? 0} / {usage?.completionTokens ?? 0}
            </span>
          </p>
          <p>
            Coste est. (¢ USD):{' '}
            <span className="font-medium text-foreground">
              {usage?.estimatedCostCents ?? 0}
            </span>
          </p>
          <p>
            Consultas al farmacéutico:{' '}
            <span className="font-medium text-foreground">
              {settings.pharmacistConsultEnabled ? 'Activadas' : 'Desactivadas'}
            </span>
            <span className="block text-[11px] font-normal">
              Solo FarmaFácil puede cambiar este permiso.
            </span>
          </p>
        </div>
        {!moduleUsable ? (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
            Sin módulo activo no se realizan llamadas a OpenAI desde el kiosko.
          </p>
        ) : null}
      </div>

      <form onSubmit={onSave} className="space-y-4 rounded-xl border border-border bg-card p-4">
        <fieldset disabled={!canEdit || busy} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="asst-name">Nombre del asistente</Label>
            <Input
              id="asst-name"
              value={assistantName}
              onChange={(e) => setAssistantName(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asst-welcome">Mensaje de bienvenida</Label>
            <Textarea
              id="asst-welcome"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={3}
              maxLength={800}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asst-hours">Horarios</Label>
            <Textarea
              id="asst-hours"
              value={hoursInfo}
              onChange={(e) => setHoursInfo(e.target.value)}
              rows={2}
              maxLength={1000}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asst-services">Servicios</Label>
            <Textarea
              id="asst-services"
              value={servicesInfo}
              onChange={(e) => setServicesInfo(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asst-instructions">
              Instrucciones personalizadas
            </Label>
            <Textarea
              id="asst-instructions"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Tono, barrio, avisos de la farmacia… Nunca anulan las reglas sanitarias de FarmaFácil."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Preguntas frecuentes</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={faqs.length >= 20}
                onClick={() =>
                  setFaqs((prev) => [
                    ...prev,
                    { question: '', answer: '' },
                  ])
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Añadir
              </Button>
            </div>
            {faqs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Todavía no hay FAQs propias.
              </p>
            ) : null}
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="space-y-2 rounded-lg border border-border/80 p-3"
              >
                <Input
                  placeholder="Pregunta"
                  value={faq.question}
                  onChange={(e) =>
                    setFaqs((prev) =>
                      prev.map((f, i) =>
                        i === idx ? { ...f, question: e.target.value } : f
                      )
                    )
                  }
                  maxLength={200}
                />
                <Textarea
                  placeholder="Respuesta"
                  value={faq.answer}
                  onChange={(e) =>
                    setFaqs((prev) =>
                      prev.map((f, i) =>
                        i === idx ? { ...f, answer: e.target.value } : f
                      )
                    )
                  }
                  rows={2}
                  maxLength={800}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() =>
                    setFaqs((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            ))}
          </div>
        </fieldset>

        {canEdit ? (
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar configuración
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            No tienes permiso para editar la configuración del asistente.
          </p>
        )}
      </form>

      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <MessageSquarePlus className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Consultas al farmacéutico
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {settings.pharmacistConsultEnabled
                ? 'Bandeja de mensajes del kiosko. FarmaFácil gestiona la activación comercial.'
                : 'La bandeja existe, pero las consultas digitales están desactivadas para esta farmacia. FarmaFácil gestiona la activación.'}
            </p>
            <Link
              href={tenantHref(pharmacyId, 'asistente/consultas')}
              className="mt-2 inline-flex text-sm font-medium text-primary hover:underline"
            >
              Ir a la bandeja de consultas
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
