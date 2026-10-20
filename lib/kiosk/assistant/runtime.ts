import { createClient } from '@/lib/supabase/server';
import { sha256Hex } from '@/lib/kiosk/crypto';
import {
  parseKioskSessionCookie,
  readKioskSessionCookie,
} from '@/lib/kiosk/session-cookie';
import type { AssistantFaqItem } from '@/lib/kiosk/assistant/settings-input';

export type AssistantRuntimeMode = 'demo' | 'contracted';

export type AssistantRuntimeSettings = {
  assistantName: string;
  welcomeMessage: string;
  customInstructions: string;
  faqs: AssistantFaqItem[];
  servicesInfo: string;
  hoursInfo: string;
};

export type AssistantRuntimeContext = {
  pharmacyId: string;
  deviceId: string;
  mode: AssistantRuntimeMode;
  catalogAccess: boolean;
  pharmacistConsultEnabled: boolean;
  monthlyRequestLimit: number;
  requestCount: number;
  periodYm: string;
  settings: AssistantRuntimeSettings;
};

export type AssistantRuntimeFailure =
  | {
      ok: false;
      code:
        | 'session_invalid'
        | 'commercially_blocked'
        | 'module_disabled'
        | 'limit_exceeded'
        | 'rpc_error';
      message: string;
      requestCount?: number;
      monthlyRequestLimit?: number;
    }
  | { ok: true; context: AssistantRuntimeContext };

function parseFaqs(raw: unknown): AssistantFaqItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const question = String(
        (item as { question?: unknown }).question ?? ''
      ).trim();
      const answer = String((item as { answer?: unknown }).answer ?? '').trim();
      if (!question || !answer) return null;
      return { question, answer };
    })
    .filter((x): x is AssistantFaqItem => x != null)
    .slice(0, 20);
}

function parseSettings(raw: unknown): AssistantRuntimeSettings {
  const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    assistantName: String(s.assistant_name ?? 'Asistente FarmaFácil'),
    welcomeMessage: String(s.welcome_message ?? ''),
    customInstructions: String(s.custom_instructions ?? ''),
    faqs: parseFaqs(s.faqs),
    servicesInfo: String(s.services_info ?? ''),
    hoursInfo: String(s.hours_info ?? ''),
  };
}

function parseOkContext(
  payload: Record<string, unknown>
): AssistantRuntimeContext | null {
  const pharmacyId = String(payload.pharmacy_id ?? '');
  const deviceId = String(payload.device_id ?? '');
  const mode = payload.mode === 'contracted' ? 'contracted' : 'demo';
  if (!pharmacyId || !deviceId) return null;

  const settings = parseSettings(payload.settings);
  // Defensa en profundidad: DEMO nunca arrastra FAQs/instrucciones privadas.
  if (mode === 'demo') {
    settings.customInstructions = '';
    settings.faqs = [];
    settings.servicesInfo = '';
    settings.hoursInfo = '';
    settings.welcomeMessage = '';
  }

  return {
    pharmacyId,
    deviceId,
    mode,
    catalogAccess: mode === 'contracted' && payload.catalog_access === true,
    pharmacistConsultEnabled:
      mode === 'contracted' && payload.pharmacist_consult_enabled === true,
    monthlyRequestLimit: Number(payload.monthly_request_limit) || 0,
    requestCount: Number(payload.request_count) || 0,
    periodYm: String(payload.period_ym ?? ''),
    settings,
  };
}

function readCredentialHash(): string | null {
  const raw = readKioskSessionCookie();
  const parsed = parseKioskSessionCookie(raw);
  if (!parsed) return null;
  return sha256Hex(parsed.credential);
}

function mapFailure(
  status: string,
  payload: Record<string, unknown>
): Extract<AssistantRuntimeFailure, { ok: false }> {
  if (status === 'commercially_blocked') {
    return {
      ok: false,
      code: 'commercially_blocked',
      message: 'El kiosko no está disponible por el estado comercial.',
    };
  }
  if (status === 'module_disabled') {
    return {
      ok: false,
      code: 'module_disabled',
      message:
        'El Asistente IA no está activado para esta farmacia. Puedes preguntar en el mostrador.',
    };
  }
  if (status === 'limit_exceeded') {
    return {
      ok: false,
      code: 'limit_exceeded',
      message:
        'Se ha alcanzado el límite mensual del asistente. Puedes consultar al farmacéutico en el mostrador.',
      requestCount: Number(payload.request_count) || undefined,
      monthlyRequestLimit: Number(payload.monthly_request_limit) || undefined,
    };
  }
  return {
    ok: false,
    code: 'session_invalid',
    message: 'Sesión de kiosko no válida.',
  };
}

/**
 * Estado del asistente sin consumir cuota (pantalla /k/asistente).
 */
export async function loadAssistantRuntimeStatus(): Promise<AssistantRuntimeFailure> {
  const hash = readCredentialHash();
  if (!hash) {
    return {
      ok: false,
      code: 'session_invalid',
      message: 'Sesión de kiosko no válida.',
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_kiosk_assistant_runtime_status_v1',
    {
      p_credential_hash: hash,
    }
  );

  if (error) {
    console.error('[assistant] runtime status', error.message);
    return {
      ok: false,
      code: 'rpc_error',
      message: 'No se ha podido comprobar el estado del asistente.',
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const status = String(payload.status ?? '');
  if (status === 'ok') {
    const context = parseOkContext(payload);
    if (!context) {
      return {
        ok: false,
        code: 'rpc_error',
        message: 'Respuesta de estado del asistente incompleta.',
      };
    }
    return { ok: true, context };
  }
  return mapFailure(status, payload);
}

/**
 * Reserva 1 petición mensual de forma atómica antes de llamar a OpenAI.
 */
export async function beginAssistantTurn(): Promise<AssistantRuntimeFailure> {
  const hash = readCredentialHash();
  if (!hash) {
    return {
      ok: false,
      code: 'session_invalid',
      message: 'Sesión de kiosko no válida.',
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_kiosk_assistant_begin_turn_v1', {
    p_credential_hash: hash,
  });

  if (error) {
    console.error('[assistant] begin turn', error.message);
    return {
      ok: false,
      code: 'rpc_error',
      message: 'No se ha podido iniciar la consulta del asistente.',
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const status = String(payload.status ?? '');
  if (status === 'ok') {
    const context = parseOkContext(payload);
    if (!context) {
      return {
        ok: false,
        code: 'rpc_error',
        message: 'Respuesta de reserva del asistente incompleta.',
      };
    }
    return { ok: true, context };
  }
  return mapFailure(status, payload);
}

/**
 * Libera 1 reserva si la llamada al proveedor falló.
 */
export async function releaseAssistantTurn(): Promise<void> {
  const hash = readCredentialHash();
  if (!hash) return;

  const supabase = createClient();
  const { error } = await supabase.rpc('ff_kiosk_assistant_release_turn_v1', {
    p_credential_hash: hash,
  });

  if (error) {
    console.error('[assistant] release turn', error.message);
  }
}

/**
 * Registra tokens/coste tras la respuesta del proveedor (no suma request_count).
 */
export async function finalizeAssistantTurn(input: {
  promptTokens: number;
  completionTokens: number;
  estimatedCostCents: number;
}): Promise<void> {
  const hash = readCredentialHash();
  if (!hash) return;

  const supabase = createClient();
  const { error } = await supabase.rpc('ff_kiosk_assistant_finalize_turn_v1', {
    p_credential_hash: hash,
    p_prompt_tokens: Math.max(0, Math.floor(input.promptTokens)),
    p_completion_tokens: Math.max(0, Math.floor(input.completionTokens)),
    p_estimated_cost_cents: Math.max(0, input.estimatedCostCents),
  });

  if (error) {
    console.error('[assistant] finalize turn', error.message);
  }
}
