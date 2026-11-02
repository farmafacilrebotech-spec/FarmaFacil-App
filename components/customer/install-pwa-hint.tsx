'use client';

import * as React from 'react';

function detectPlatform(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'other';
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
}

/**
 * Instrucciones discretas para añadir FarmaFácil a la pantalla de inicio.
 * No se presenta como App Store / Google Play.
 */
export function InstallPwaHint() {
  const [open, setOpen] = React.useState(false);
  const [platform, setPlatform] = React.useState<'ios' | 'android' | 'other'>(
    'other'
  );
  const [standalone, setStandalone] = React.useState(true);

  React.useEffect(() => {
    setPlatform(detectPlatform());
    setStandalone(isStandalone());
  }, []);

  if (standalone) return null;

  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
      <button
        type="button"
        className="w-full text-left font-medium text-[#0F2A2E] hover:underline"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Añadir FarmaFácil a la pantalla de inicio
        <span className="ml-1 text-xs font-normal text-slate-400">
          {open ? '· ocultar' : '· ver cómo'}
        </span>
      </button>
      {open ? (
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-slate-500">
          <p>
            Así podrás abrir Mis farmacias sin escanear el QR cada vez. No es
            una app de la App Store ni de Google Play: se instala desde el
            navegador.
          </p>
          {platform === 'ios' ? (
            <ol className="list-decimal space-y-1 pl-4">
              <li>Abre esta página en Safari.</li>
              <li>
                Pulsa el botón Compartir{' '}
                <span aria-hidden="true">(□↑)</span>.
              </li>
              <li>Elige «Añadir a pantalla de inicio».</li>
              <li>Confirma con «Añadir».</li>
            </ol>
          ) : null}
          {platform === 'android' ? (
            <ol className="list-decimal space-y-1 pl-4">
              <li>Abre esta página en Chrome.</li>
              <li>Menú ⋮ → «Instalar aplicación» o «Añadir a pantalla de inicio».</li>
              <li>Confirma la instalación.</li>
            </ol>
          ) : null}
          {platform === 'other' ? (
            <p>
              En el menú del navegador busca «Añadir a pantalla de inicio» o
              «Instalar aplicación». En iPhone usa Safari; en Android, Chrome.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
