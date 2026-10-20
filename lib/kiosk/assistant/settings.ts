import { createClient } from '@/lib/supabase/server';
import type { AssistantFaqItem } from '@/lib/kiosk/assistant/settings-input';
import { sanitizeAssistantSettingsInput } from '@/lib/kiosk/assistant/settings-input';

export type { AssistantFaqItem };
export { sanitizeAssistantSettingsInput };

export type PharmacyAssistantSettings = {
  pharmacyId: string;
  assistantName: string;
  welcomeMessage: string;
  customInstructions: string;
  faqs: AssistantFaqItem[];
  servicesInfo: string;
  hoursInfo: string;
  pharmacistConsultEnabled: boolean;
};

export type PharmacyAssistantUsageMonthly = {
  pharmacyId: string;
  periodYm: string;
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostCents: number;
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

export async function getPharmacyAssistantSettings(
  pharmacyId: string
): Promise<PharmacyAssistantSettings | null> {
  if (!pharmacyId || !/^[0-9a-f-]{36}$/i.test(pharmacyId)) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacy_assistant_settings')
    .select(
      'pharmacy_id, assistant_name, welcome_message, custom_instructions, faqs, services_info, hours_info, pharmacist_consult_enabled'
    )
    .eq('pharmacy_id', pharmacyId)
    .maybeSingle();

  if (error) {
    console.error('[assistant] get settings', error.message);
    return null;
  }
  if (!data) {
    return {
      pharmacyId,
      assistantName: 'Asistente FarmaFácil',
      welcomeMessage: '',
      customInstructions: '',
      faqs: [],
      servicesInfo: '',
      hoursInfo: '',
      pharmacistConsultEnabled: false,
    };
  }

  return {
    pharmacyId: String(data.pharmacy_id),
    assistantName: String(data.assistant_name ?? 'Asistente FarmaFácil'),
    welcomeMessage: String(data.welcome_message ?? ''),
    customInstructions: String(data.custom_instructions ?? ''),
    faqs: parseFaqs(data.faqs),
    servicesInfo: String(data.services_info ?? ''),
    hoursInfo: String(data.hours_info ?? ''),
    pharmacistConsultEnabled: data.pharmacist_consult_enabled === true,
  };
}

export async function getPharmacyAssistantUsageCurrentMonth(
  pharmacyId: string
): Promise<PharmacyAssistantUsageMonthly | null> {
  if (!pharmacyId || !/^[0-9a-f-]{36}$/i.test(pharmacyId)) return null;

  const periodYm = new Date().toISOString().slice(0, 7);
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacy_assistant_usage_monthly')
    .select(
      'pharmacy_id, period_ym, request_count, prompt_tokens, completion_tokens, estimated_cost_cents'
    )
    .eq('pharmacy_id', pharmacyId)
    .eq('period_ym', periodYm)
    .maybeSingle();

  if (error) {
    console.error('[assistant] get usage', error.message);
    return null;
  }

  if (!data) {
    return {
      pharmacyId,
      periodYm,
      requestCount: 0,
      promptTokens: 0,
      completionTokens: 0,
      estimatedCostCents: 0,
    };
  }

  return {
    pharmacyId: String(data.pharmacy_id),
    periodYm: String(data.period_ym),
    requestCount: Number(data.request_count) || 0,
    promptTokens: Number(data.prompt_tokens) || 0,
    completionTokens: Number(data.completion_tokens) || 0,
    estimatedCostCents: Number(data.estimated_cost_cents) || 0,
  };
}
