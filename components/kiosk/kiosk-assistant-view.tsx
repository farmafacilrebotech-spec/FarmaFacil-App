'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  MessageCircleHeart,
  RefreshCw,
  Send,
  ShoppingCart,
  Stethoscope,
  X,
} from 'lucide-react';

import {
  createKioskPharmacistConsultAction,
  pollKioskPharmacistConsultAction,
} from '@/app/k/asistente/consult-actions';
import { sendKioskAssistantMessageAction } from '@/app/k/asistente/actions';
import { KioskAssistantProductCards } from '@/components/kiosk/kiosk-assistant-product-cards';
import { useKioskCart } from '@/components/kiosk/kiosk-cart-provider';
import {
  ASSISTANT_IDLE_MS,
  bindConversationToSession,
  emptyAssistantConversation,
  isConversationIdle,
  readStoredAssistantConversation,
  writeStoredAssistantConversation,
  type AssistantActiveConsult,
  type AssistantConversationBinding,
  type AssistantConversationState,
} from '@/lib/kiosk/assistant/conversation-state';
import {
  CONSULT_CLIENT_MESSAGE_MAX,
  CONSULT_KIOSK_POLL_MS,
} from '@/lib/kiosk/assistant/consults/types';
import {
  ASSISTANT_MAX_USER_CHARS,
  type AssistantChatMessage,
  type AssistantProductCard,
} from '@/lib/kiosk/assistant/types';
import { getOrCreateClientTurn } from '@/lib/kiosk/client-turn-state';
import { endKioskClientPurchaseSession } from '@/lib/kiosk/end-client-purchase-session';
import { cn } from '@/lib/utils';

type QuickId =
  | 'search_product'
  | 'personal_care'
  | 'faq'
  | 'consult_pharmacist';

const QUICK_REPLIES: Array<{
  id: QuickId;
  label: string;
  userText?: string;
  intent?: 'consult_pharmacist';
}> = [
  {
    id: 'search_product',
    label: 'Buscar un producto',
    userText: 'Busco una crema hidratante para piel seca.',
  },
  {
    id: 'personal_care',
    label: 'Cuidado personal',
    userText: '¿Qué productos tenéis para higiene bucal?',
  },
  {
    id: 'faq',
    label: 'Preguntas frecuentes',
    userText:
      '¿Qué tipo de dudas habituales puedes ayudarme a resolver en el kiosko?',
  },
  {
    id: 'consult_pharmacist',
    label: 'Consultar al farmacéutico',
    intent: 'consult_pharmacist',
  },
];

function productsMapToRecord(
  map: Record<number, AssistantProductCard[]>
): Record<string, AssistantProductCard[]> {
  const out: Record<string, AssistantProductCard[]> = {};
  for (const [k, v] of Object.entries(map)) {
    if (v?.length) out[k] = v;
  }
  return out;
}

function productsRecordToMap(
  record: Record<string, AssistantProductCard[]>
): Record<number, AssistantProductCard[]> {
  const out: Record<number, AssistantProductCard[]> = {};
  for (const [k, v] of Object.entries(record)) {
    const idx = Number(k);
    if (!Number.isInteger(idx) || !v?.length) continue;
    out[idx] = v;
  }
  return out;
}

function newClientRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `consult-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function KioskAssistantView({
  pharmacyName,
  assistantName = 'Asistente FarmaFácil',
  welcomeText,
  mode = 'demo',
  pharmacistConsultEnabled = false,
  sessionBinding,
}: {
  pharmacyName: string;
  assistantName?: string;
  welcomeText: string;
  mode?: 'demo' | 'contracted';
  /** CONTRATADO + permiso comercial: habilita envío digital. */
  pharmacistConsultEnabled?: boolean;
  sessionBinding: AssistantConversationBinding;
}) {
  const router = useRouter();
  const { itemCount, touchActivity: touchCart, clear: clearCart } =
    useKioskCart();
  const [messages, setMessages] = React.useState<AssistantChatMessage[]>([
    { role: 'assistant', content: welcomeText },
  ]);
  const [productsByMessage, setProductsByMessage] = React.useState<
    Record<number, AssistantProductCard[]>
  >({});
  const [activeConsults, setActiveConsults] = React.useState<
    AssistantActiveConsult[]
  >([]);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showQuick, setShowQuick] = React.useState(true);
  const [hydrated, setHydrated] = React.useState(false);
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [consultDraft, setConsultDraft] = React.useState('');
  const [consultSending, setConsultSending] = React.useState(false);
  const lastActivityAt = React.useRef(Date.now());
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const deliveredIdsRef = React.useRef<Set<string>>(new Set());

  const digitalConsultEnabled =
    mode === 'contracted' && pharmacistConsultEnabled === true;

  function currentTurnToken(): string {
    return getOrCreateClientTurn(sessionBinding).token;
  }

  const touchActivity = React.useCallback(() => {
    lastActivityAt.current = Date.now();
    touchCart();
  }, [touchCart]);

  React.useEffect(() => {
    function onActivity() {
      touchActivity();
    }
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    return () => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [touchActivity]);

  const initialMessage = React.useMemo(
    (): AssistantChatMessage => ({ role: 'assistant', content: welcomeText }),
    [welcomeText]
  );

  React.useEffect(() => {
    const now = Date.now();
    const stored = readStoredAssistantConversation();
    if (stored) {
      let next = bindConversationToSession(
        stored,
        sessionBinding,
        welcomeText
      );
      if (isConversationIdle(next, now)) {
        next = emptyAssistantConversation(welcomeText, sessionBinding);
        void endKioskClientPurchaseSession();
      }
      setMessages(next.messages);
      setProductsByMessage(productsRecordToMap(next.productsByMessage));
      setActiveConsults(next.activeConsults);
      deliveredIdsRef.current = new Set(
        next.activeConsults
          .filter((c) => c.replyDelivered)
          .map((c) => c.id)
      );
      setShowQuick(next.messages.length <= 1);
      lastActivityAt.current = next.updatedAt;
    } else {
      setMessages([initialMessage]);
      setProductsByMessage({});
      setActiveConsults([]);
      setShowQuick(true);
    }
    setHydrated(true);
  }, [sessionBinding, welcomeText, initialMessage]);

  React.useEffect(() => {
    if (!hydrated) return;
    const state: AssistantConversationState = {
      pharmacyId: sessionBinding.pharmacyId,
      deviceId: sessionBinding.deviceId,
      sessionId: sessionBinding.sessionId,
      messages,
      productsByMessage: productsMapToRecord(productsByMessage),
      activeConsults,
      updatedAt: lastActivityAt.current,
    };
    writeStoredAssistantConversation(state);
  }, [messages, productsByMessage, activeConsults, hydrated, sessionBinding]);

  React.useEffect(() => {
    if (!hydrated) return;
    const id = window.setInterval(() => {
      if (Date.now() - lastActivityAt.current >= ASSISTANT_IDLE_MS) {
        void endKioskClientPurchaseSession().then(() => {
          clearCart();
          setMessages([initialMessage]);
          setProductsByMessage({});
          setActiveConsults([]);
          setDraft('');
          setConsultDraft('');
          setComposeOpen(false);
          setError(null);
          setShowQuick(true);
          router.replace('/k');
        });
      }
    }, 15_000);
    return () => window.clearInterval(id);
  }, [router, initialMessage, hydrated, clearCart]);

  // Poll respuestas del farmacéutico solo para consultas de esta conversación.
  React.useEffect(() => {
    if (!hydrated || !digitalConsultEnabled) return;
    const pending = activeConsults.filter((c) => !c.replyDelivered);
    if (pending.length === 0) return;

    let cancelled = false;
    async function tick() {
      for (const item of pending) {
        if (cancelled) return;
        if (deliveredIdsRef.current.has(item.id)) continue;
        const result = await pollKioskPharmacistConsultAction({
          consultId: item.id,
          turnToken: currentTurnToken(),
        });
        if (cancelled) return;
        if (!result.ok) {
          if (
            result.code === 'session_missing' ||
            result.code === 'session_invalid'
          ) {
            await endKioskClientPurchaseSession();
            clearCart();
            router.replace('/k/pair');
            return;
          }
          if (
            result.code === 'turn_revoked' ||
            result.code === 'forbidden' ||
            result.code === 'not_found'
          ) {
            setActiveConsults((prev) =>
              prev.filter((c) => c.id !== item.id)
            );
          }
          continue;
        }

        if (result.consult.status === 'expired') {
          if (!deliveredIdsRef.current.has(item.id)) {
            deliveredIdsRef.current.add(item.id);
            setActiveConsults((prev) =>
              prev.map((c) =>
                c.id === item.id ? { ...c, replyDelivered: true } : c
              )
            );
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: result.consult.late
                  ? `La consulta ${result.consult.displayCode} ha caducado. Si el farmacéutico respondió más tarde, acércate al mostrador con ese código.`
                  : `La consulta ${result.consult.displayCode} ha caducado sin respuesta en pantalla. Acércate al mostrador si aún necesitas ayuda.`,
              },
            ]);
          }
          continue;
        }

        if (
          (result.consult.status === 'answered' ||
            result.consult.status === 'resolved') &&
          result.consult.reply &&
          !deliveredIdsRef.current.has(item.id)
        ) {
          deliveredIdsRef.current.add(item.id);
          setActiveConsults((prev) =>
            prev.map((c) =>
              c.id === item.id ? { ...c, replyDelivered: true } : c
            )
          );
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `Respuesta del farmacéutico (${result.consult.displayCode}):\n${result.consult.reply}`,
            },
          ]);
          touchActivity();
        }
      }
    }

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, CONSULT_KIOSK_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    hydrated,
    digitalConsultEnabled,
    activeConsults,
    clearCart,
    router,
    touchActivity,
  ]);

  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending, productsByMessage, composeOpen]);

  function resetConversation() {
    touchActivity();
    void endKioskClientPurchaseSession().then(() => {
      // Nuevo turno local tras invalidar el anterior en servidor.
      getOrCreateClientTurn(sessionBinding);
      setMessages([initialMessage]);
      setProductsByMessage({});
      setActiveConsults([]);
      deliveredIdsRef.current = new Set();
      setDraft('');
      setConsultDraft('');
      setComposeOpen(false);
      setError(null);
      setShowQuick(true);
      setSending(false);
      inputRef.current?.focus();
    });
  }

  function abandonPurchaseSession() {
    void endKioskClientPurchaseSession().then(() => {
      clearCart();
      setMessages([initialMessage]);
      setProductsByMessage({});
      setActiveConsults([]);
      deliveredIdsRef.current = new Set();
      setDraft('');
      setConsultDraft('');
      setComposeOpen(false);
      setError(null);
      setShowQuick(true);
    });
  }

  function openConsultComposer() {
    touchActivity();
    setError(null);
    if (!digitalConsultEnabled) {
      void sendMessage('', 'consult_pharmacist');
      return;
    }
    setComposeOpen(true);
    setShowQuick(false);
  }

  async function submitPharmacistConsult() {
    if (consultSending || !digitalConsultEnabled) return;
    touchActivity();
    setError(null);
    const text = consultDraft.trim();
    if (!text) {
      setError('Escribe tu consulta antes de enviarla.');
      return;
    }

    setConsultSending(true);
    const result = await createKioskPharmacistConsultAction({
      message: text,
      clientRequestId: newClientRequestId(),
      turnToken: currentTurnToken(),
    });
    setConsultSending(false);

    if (!result.ok) {
      if (
        result.code === 'session_missing' ||
        result.code === 'session_invalid'
      ) {
        await endKioskClientPurchaseSession();
        clearCart();
        router.replace('/k/pair');
        return;
      }
      if (result.code === 'commercially_blocked') {
        router.replace('/k');
        return;
      }
      if (
        result.code === 'invalid_turn' ||
        result.code === 'turn_revoked' ||
        result.code === 'turn_mismatch'
      ) {
        await endKioskClientPurchaseSession();
        getOrCreateClientTurn(sessionBinding);
        setError(result.message);
        return;
      }
      if (result.code === 'consults_disabled') {
        setComposeOpen(false);
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: 'Quiero consultar al farmacéutico.' },
          { role: 'assistant', content: result.message },
        ]);
        return;
      }
      setError(result.message);
      return;
    }

    setComposeOpen(false);
    setConsultDraft('');
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      {
        role: 'assistant',
        content: `Consulta enviada (${result.consult.displayCode}). El equipo farmacéutico te responderá aquí cuando pueda. No hace falta quedarte delante de la pantalla todo el tiempo, pero si cambias de cliente o se reinicia el kiosko, la respuesta no se mostrará al siguiente usuario.`,
      },
    ]);
    setActiveConsults((prev) => {
      if (prev.some((c) => c.id === result.consult.id)) return prev;
      return [
        ...prev,
        {
          id: result.consult.id,
          displayCode: result.consult.displayCode,
          replyDelivered: false,
        },
      ].slice(-5);
    });
  }

  async function sendMessage(raw: string, intent?: 'consult_pharmacist') {
    if (sending) return;
    touchActivity();
    setError(null);

    if (intent === 'consult_pharmacist' && digitalConsultEnabled) {
      openConsultComposer();
      return;
    }

    const text = raw.trim();
    if (!intent && !text) return;

    const historyForApi = messages.filter(
      (m, idx) => !(idx === 0 && m.role === 'assistant')
    );

    if (!intent) {
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      setDraft('');
      setShowQuick(false);
    } else {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: 'Quiero consultar al farmacéutico.' },
      ]);
      setShowQuick(false);
    }

    setSending(true);
    const result = await sendKioskAssistantMessageAction({
      message: intent ? '' : text,
      history: historyForApi,
      intent,
    });
    setSending(false);

    if (!result.ok) {
      if (
        result.code === 'session_missing' ||
        result.code === 'session_invalid' ||
        result.code === 'session_revoked'
      ) {
        await endKioskClientPurchaseSession();
        clearCart();
        router.replace('/k/pair');
        return;
      }
      if (result.code === 'commercially_blocked') {
        router.replace('/k');
        return;
      }
      if (
        result.code === 'module_disabled' ||
        result.code === 'limit_exceeded'
      ) {
        router.refresh();
        setError(result.message);
        return;
      }
      setError(result.message);
      return;
    }

    setMessages((prev) => {
      const next = [
        ...prev,
        { role: 'assistant' as const, content: result.reply },
      ];
      const assistantIdx = next.length - 1;
      if (result.products && result.products.length > 0) {
        queueMicrotask(() => {
          setProductsByMessage((map) => ({
            ...map,
            [assistantIdx]: result.products!,
          }));
        });
      }
      return next;
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(draft);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#e8f7f7]">
      <header className="sticky top-0 z-20 border-b border-[#2EC4C7]/25 bg-[#2EC4C7] px-4 pb-4 pt-4 text-white shadow-md sm:px-6 lg:px-8 lg:pb-5 lg:pt-5">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 lg:gap-4">
          <Link
            href="/k"
            onClick={abandonPurchaseSession}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 active:scale-95 lg:h-16 lg:w-16"
            aria-label="Volver al inicio"
          >
            <ArrowLeft className="h-7 w-7 lg:h-8 lg:w-8" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
              {assistantName}
            </h1>
            <p className="truncate text-sm text-white/80 lg:text-base">
              {pharmacyName}
              {mode === 'demo' ? ' · Demo' : ''}
            </p>
          </div>
          <Link
            href="/k/carrito"
            className="relative flex h-14 min-w-[3.5rem] items-center justify-center rounded-2xl bg-white px-3 text-[#1a9a9d] shadow active:scale-95 sm:px-4 lg:h-16"
            aria-label="Ir al carrito"
          >
            <ShoppingCart className="h-6 w-6 lg:h-7 lg:w-7" />
            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-1 text-xs font-bold text-white">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={resetConversation}
            className="flex h-14 items-center gap-2 rounded-2xl bg-white px-3 text-sm font-semibold text-[#1a9a9d] shadow active:scale-95 sm:px-4 lg:h-16 lg:text-base"
          >
            <RefreshCw className="h-5 w-5" />
            <span className="hidden sm:inline">Nueva</span>
          </button>
        </div>
      </header>

      <div
        ref={listRef}
        className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8 lg:py-5"
      >
        <ul className="space-y-3 lg:space-y-4">
          {messages.map((m, i) => (
            <li
              key={`${m.role}-${i}`}
              className={cn(
                'flex flex-col',
                m.role === 'user' ? 'items-end' : 'items-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[92%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-base leading-relaxed shadow-sm sm:max-w-[85%] sm:px-5 sm:py-4 sm:text-lg lg:text-xl',
                  m.role === 'user'
                    ? 'rounded-br-lg bg-[#2EC4C7] text-white'
                    : 'rounded-bl-lg bg-white text-slate-800 ring-1 ring-slate-200/70'
                )}
              >
                {m.content}
              </div>
              {m.role === 'assistant' && productsByMessage[i]?.length ? (
                <div className="mt-1 w-full max-w-[92%] sm:max-w-[85%]">
                  <KioskAssistantProductCards
                    products={productsByMessage[i]}
                    demoMode={mode === 'demo'}
                  />
                </div>
              ) : null}
            </li>
          ))}
          {sending ? (
            <li className="flex justify-start">
              <div className="flex items-center gap-2 rounded-3xl rounded-bl-lg bg-white px-4 py-3 text-slate-500 shadow-sm ring-1 ring-slate-200/70 sm:px-5 sm:py-4">
                <Loader2 className="h-5 w-5 animate-spin text-[#2EC4C7]" />
                <span className="text-base sm:text-lg">Preparando respuesta…</span>
              </div>
            </li>
          ) : null}
        </ul>

        {showQuick && messages.length <= 1 ? (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q.id}
                type="button"
                disabled={sending || consultSending}
                onClick={() => {
                  if (q.intent === 'consult_pharmacist') {
                    openConsultComposer();
                    return;
                  }
                  void sendMessage(q.userText ?? '', q.intent);
                }}
                className="rounded-2xl border border-[#2EC4C7]/35 bg-white px-4 py-4 text-left text-base font-semibold text-slate-800 shadow-sm active:scale-[0.99] disabled:opacity-60 sm:py-5 sm:text-lg"
              >
                {q.label}
              </button>
            ))}
          </div>
        ) : null}

        {composeOpen ? (
          <div className="mt-5 rounded-3xl border border-[#2EC4C7]/35 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Consulta al farmacéutico
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Escribe una duda breve. No incluyas nombre, teléfono ni datos
                  personales. No se envía el historial del chat.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea
              rows={4}
              value={consultDraft}
              maxLength={CONSULT_CLIENT_MESSAGE_MAX}
              disabled={consultSending}
              onChange={(e) => {
                touchActivity();
                setConsultDraft(e.target.value);
              }}
              placeholder="Ej.: Busco orientación sobre protectores solares infantiles…"
              className="w-full resize-none rounded-2xl border-0 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-4 focus:ring-[#2EC4C7]/35 disabled:opacity-60"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={consultSending || !consultDraft.trim()}
                onClick={() => void submitPharmacistConsult()}
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {consultSending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Stethoscope className="h-5 w-5" />
                )}
                Enviar consulta
              </button>
              <button
                type="button"
                disabled={consultSending}
                onClick={() => setComposeOpen(false)}
                className="inline-flex h-12 items-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-base text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <div className="sticky bottom-0 border-t border-slate-200/80 bg-[#e8f7f7]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              disabled={sending || consultSending}
              onClick={openConsultComposer}
              className="inline-flex h-12 items-center gap-2 self-start rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60 sm:h-14 sm:text-base"
            >
              <Stethoscope className="h-5 w-5" />
              Consultar al farmacéutico
            </button>
            <p className="max-w-xl text-xs leading-snug text-slate-500 sm:text-sm">
              {digitalConsultEnabled
                ? 'Envía una consulta breve al equipo de la farmacia. No se comparte el historial del chat.'
                : 'Te orientaremos a acudir al mostrador para atención farmacéutica.'}
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex items-end gap-2 sm:gap-3">
            <label className="sr-only" htmlFor="kiosk-assistant-input">
              Escribe tu consulta
            </label>
            <textarea
              id="kiosk-assistant-input"
              ref={inputRef}
              rows={2}
              value={draft}
              maxLength={ASSISTANT_MAX_USER_CHARS}
              disabled={sending}
              onChange={(e) => {
                touchActivity();
                setDraft(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(draft);
                }
              }}
              placeholder="Escribe tu consulta…"
              className="min-h-[3.5rem] flex-1 resize-none rounded-2xl border-0 bg-white px-4 py-3 text-base text-slate-900 shadow-inner outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-4 focus:ring-[#2EC4C7]/35 disabled:opacity-60 sm:min-h-[4rem] sm:text-lg lg:text-xl"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#2EC4C7] text-white shadow-md active:scale-95 disabled:opacity-50 sm:h-16 sm:w-16"
              aria-label="Enviar"
            >
              {sending ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Send className="h-6 w-6" />
              )}
            </button>
          </form>

          <p className="flex items-start gap-2 text-xs leading-snug text-slate-500 sm:text-sm">
            <MessageCircleHeart className="mt-0.5 h-4 w-4 shrink-0 text-[#1a9a9d]" />
            Orientación general: no sustituye al profesional sanitario. Ante
            dudas clínicas o urgencias, consulta al farmacéutico o a urgencias.
          </p>
        </div>
      </div>
    </div>
  );
}
