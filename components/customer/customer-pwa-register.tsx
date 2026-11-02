'use client';

import * as React from 'react';

/**
 * Registra el service worker de recursos estáticos del área cliente.
 * No añade push ni offline de datos.
 */
export function CustomerPwaRegister() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    const path = window.location.pathname;
    if (!path.startsWith('/cuenta') && !path.startsWith('/e/')) return;

    void navigator.serviceWorker
      .register('/sw-customer.js', { scope: '/' })
      .catch((err) => {
        console.warn('[customer-pwa] sw register', err);
      });
  }, []);

  return null;
}
