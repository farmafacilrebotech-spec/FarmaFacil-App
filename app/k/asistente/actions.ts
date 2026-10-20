'use server';

import {
  formatCatalogHitsForPrompt,
  searchAssistantCatalog,
} from '@/lib/kiosk/assistant/catalog-search';
import { estimateAssistantCostCents } from '@/lib/kiosk/assistant/cost';
import { getAssistantOpenAiConfig } from '@/lib/kiosk/assistant/config';
import {
  normalizeUserMessage,
  sanitizeHistoryForModel,
} from '@/lib/kiosk/assistant/history';
import { callOpenAiChatCompletion } from '@/lib/kiosk/assistant/openai';
import { buildAssistantSystemPrompt } from '@/lib/kiosk/assistant/prompt';
import { checkAssistantRateLimit } from '@/lib/kiosk/assistant/rate-limit';
import {
  beginAssistantTurn,
  finalizeAssistantTurn,
  releaseAssistantTurn,
} from '@/lib/kiosk/assistant/runtime';
import {
  evaluateAssistantSafety,
  resolveConsultPharmacistReply,
} from '@/lib/kiosk/assistant/safety';
import {
  canReserveQuota,
  demoSafePromptSettings,
  resolveQuotaAfterProviderCall,
} from '@/lib/kiosk/assistant/turn-gates';
import type {
  AssistantProductCard,
  AssistantSendResult,
} from '@/lib/kiosk/assistant/types';
import { loadAssistantRuntimeStatus } from '@/lib/kiosk/assistant/runtime';
import { requireValidKioskDeviceSession } from '@/lib/kiosk/device-session';
import { loadKioskHomeContext } from '@/lib/kiosk/home-context';

/**
 * Envía un turno al asistente. La farmacia sale solo de la sesión validada.
 * Si hay intención de producto: búsqueda controlada (demo o RPC 043), jamás SQL libre.
 */
export async function sendKioskAssistantMessageAction(input: {
  message: string;
  history?: unknown;
  intent?: 'consult_pharmacist';
}): Promise<AssistantSendResult> {
  const session = await requireValidKioskDeviceSession();
  if (!session.ok) {
    if (session.reason === 'commercially_blocked') {
      return {
        ok: false,
        code: 'commercially_blocked',
        message: 'El kiosko no está disponible por el estado comercial.',
      };
    }
    if (session.reason === 'revoked') {
      return {
        ok: false,
        code: 'session_revoked',
        message: 'Sesión de kiosko no válida.',
      };
    }
    if (session.reason === 'missing') {
      return {
        ok: false,
        code: 'session_missing',
        message: 'Sesión de kiosko no válida.',
      };
    }
    return {
      ok: false,
      code: 'session_invalid',
      message: 'Sesión de kiosko no válida.',
    };
  }

  if (input.intent === 'consult_pharmacist') {
    const runtime = await loadAssistantRuntimeStatus();
    const mode =
      runtime.ok && runtime.context.mode === 'contracted'
        ? 'contracted'
        : 'demo';
    const pharmacistConsultEnabled =
      runtime.ok &&
      runtime.context.mode === 'contracted' &&
      runtime.context.pharmacistConsultEnabled === true;
    return {
      ok: true,
      reply: resolveConsultPharmacistReply({
        mode,
        pharmacistConsultEnabled,
      }),
      escalated: true,
      products: [],
    };
  }

  const normalized = normalizeUserMessage(input.message);
  if (!normalized.ok) {
    return {
      ok: false,
      code: normalized.reason === 'too_long' ? 'message_too_long' : 'empty_message',
      message:
        normalized.reason === 'too_long'
          ? 'El mensaje es demasiado largo. Resúmelo un poco, por favor.'
          : 'Escribe un mensaje para continuar.',
    };
  }

  const rate = checkAssistantRateLimit({
    pharmacyId: session.session.pharmacyId,
    deviceId: session.session.deviceId,
  });
  if (!rate.allowed) {
    return {
      ok: false,
      code: 'rate_limited',
      message:
        'Has enviado demasiadas consultas seguidas. Espera unos minutos o pregunta en el mostrador.',
    };
  }

  const safety = evaluateAssistantSafety(normalized.text);
  if (safety.action === 'escalate_emergency') {
    return { ok: true, reply: safety.reply, escalated: true, products: [] };
  }
  if (safety.action === 'escalate_pharmacist') {
    return { ok: true, reply: safety.reply, escalated: true, products: [] };
  }

  const config = getAssistantOpenAiConfig();
  const preReserve = canReserveQuota({
    openAiConfigured: config.ok,
    moduleUsable: true,
    limitExceeded: false,
  });
  if (!preReserve.ok || !config.ok) {
    return {
      ok: false,
      code: 'config_missing',
      message:
        'El asistente aún no está configurado en este entorno. Puedes consultar al farmacéutico en el mostrador.',
    };
  }

  const turn = await beginAssistantTurn();
  if (!turn.ok) {
    if (turn.code === 'module_disabled') {
      return { ok: false, code: 'module_disabled', message: turn.message };
    }
    if (turn.code === 'limit_exceeded') {
      return { ok: false, code: 'limit_exceeded', message: turn.message };
    }
    if (turn.code === 'commercially_blocked') {
      return {
        ok: false,
        code: 'commercially_blocked',
        message: turn.message,
      };
    }
    if (turn.code === 'session_invalid') {
      return { ok: false, code: 'session_invalid', message: turn.message };
    }
    return { ok: false, code: 'busy', message: turn.message };
  }

  if (turn.context.pharmacyId !== session.session.pharmacyId) {
    console.error('[assistant] pharmacy mismatch');
    await releaseAssistantTurn();
    return {
      ok: false,
      code: 'session_invalid',
      message: 'Sesión de kiosko no válida.',
    };
  }

  const catalog = await searchAssistantCatalog({
    userMessage: normalized.text,
    mode: turn.context.mode,
    catalogAccess: turn.context.catalogAccess,
    pharmacyId: session.session.pharmacyId,
    limit: 6,
  });

  const productCards: AssistantProductCard[] = catalog.products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    price: p.price,
    stock: p.stock,
    available: p.available,
    canAddToCart: p.canAddToCart,
    imageUrl: null,
  }));

  const catalogGrounding = catalog.sought
    ? formatCatalogHitsForPrompt(catalog.products)
    : null;

  const home = await loadKioskHomeContext(session.session);
  const pharmacyName =
    home.pharmacyName || session.session.displayName || 'Tu farmacia';

  const promptSettings = demoSafePromptSettings({
    mode: turn.context.mode,
    settings: {
      assistantName: turn.context.settings.assistantName,
      customInstructions: turn.context.settings.customInstructions,
      faqs: turn.context.settings.faqs,
      servicesInfo: turn.context.settings.servicesInfo,
      hoursInfo: turn.context.settings.hoursInfo,
    },
  });

  const prior = sanitizeHistoryForModel(input.history);
  const messages = [
    ...prior,
    { role: 'user' as const, content: normalized.text },
  ];

  const completion = await callOpenAiChatCompletion({
    config,
    systemPrompt: buildAssistantSystemPrompt({
      pharmacyName,
      runtime: {
        mode: turn.context.mode,
        catalogAccess:
          turn.context.mode === 'contracted' && turn.context.catalogAccess,
        pharmacistConsultEnabled:
          turn.context.mode === 'contracted' &&
          turn.context.pharmacistConsultEnabled,
        settings: promptSettings,
      },
      catalogGrounding,
    }),
    messages,
  });

  const quotaOutcome = resolveQuotaAfterProviderCall({
    reserved: true,
    providerOk: completion.ok,
  });

  if (quotaOutcome === 'release_reservation') {
    await releaseAssistantTurn();
  }

  if (!completion.ok) {
    return {
      ok: false,
      code: completion.code,
      message: completion.message,
    };
  }

  if (quotaOutcome === 'finalize_usage') {
    const estimatedCostCents = estimateAssistantCostCents({
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
    });
    await finalizeAssistantTurn({
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      estimatedCostCents,
    });
  }

  return {
    ok: true,
    reply: completion.content,
    escalated: false,
    products: productCards,
  };
}
