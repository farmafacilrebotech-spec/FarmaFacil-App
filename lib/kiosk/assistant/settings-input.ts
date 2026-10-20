export type AssistantFaqItem = {
  question: string;
  answer: string;
};

function parseFaqs(raw: unknown): AssistantFaqItem[] {
  if (!Array.isArray(raw)) return [];
  const out: AssistantFaqItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const q = String((item as { question?: unknown }).question ?? '').trim();
    const a = String((item as { answer?: unknown }).answer ?? '').trim();
    if (!q || !a) continue;
    out.push({ question: q.slice(0, 200), answer: a.slice(0, 800) });
    if (out.length >= 20) break;
  }
  return out;
}

export function sanitizeAssistantSettingsInput(input: {
  assistantName?: string;
  welcomeMessage?: string;
  customInstructions?: string;
  faqs?: unknown;
  servicesInfo?: string;
  hoursInfo?: string;
}):
  | {
      ok: true;
      value: {
        assistantName: string;
        welcomeMessage: string;
        customInstructions: string;
        faqs: AssistantFaqItem[];
        servicesInfo: string;
        hoursInfo: string;
      };
    }
  | { ok: false; error: string } {
  const assistantName =
    String(input.assistantName ?? '').trim() || 'Asistente FarmaFácil';
  if (assistantName.length > 80) {
    return { ok: false, error: 'El nombre del asistente es demasiado largo.' };
  }
  const welcomeMessage = String(input.welcomeMessage ?? '').trim();
  if (welcomeMessage.length > 800) {
    return { ok: false, error: 'El mensaje de bienvenida es demasiado largo.' };
  }
  const customInstructions = String(input.customInstructions ?? '').trim();
  if (customInstructions.length > 2000) {
    return {
      ok: false,
      error: 'Las instrucciones personalizadas son demasiado largas.',
    };
  }
  const servicesInfo = String(input.servicesInfo ?? '').trim();
  if (servicesInfo.length > 2000) {
    return {
      ok: false,
      error: 'La información de servicios es demasiado larga.',
    };
  }
  const hoursInfo = String(input.hoursInfo ?? '').trim();
  if (hoursInfo.length > 1000) {
    return {
      ok: false,
      error: 'La información de horarios es demasiado larga.',
    };
  }

  return {
    ok: true,
    value: {
      assistantName,
      welcomeMessage,
      customInstructions,
      faqs: parseFaqs(input.faqs),
      servicesInfo,
      hoursInfo,
    },
  };
}
