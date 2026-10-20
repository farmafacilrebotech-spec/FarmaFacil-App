'use client';

import * as React from 'react';

import { clearStoredAssistantConversation } from '@/lib/kiosk/assistant/conversation-state';
import {
  KIOSK_CART_IDLE_MS,
  KIOSK_CART_STORAGE_KEY,
  addOrUpdateCartLine,
  bindCartToPharmacy,
  cartDisplayTotal,
  cartLineCount,
  clearCart,
  emptyKioskCart,
  isCartIdle,
  parseStoredCart,
  removeCartLine,
  serializeCart,
  setCartLineQuantity,
  type KioskCartLine,
  type KioskCartState,
} from '@/lib/kiosk/cart-state';
import { endKioskClientPurchaseSession } from '@/lib/kiosk/end-client-purchase-session';

type KioskCartContextValue = {
  cart: KioskCartState;
  itemCount: number;
  displayTotal: number;
  addProduct: (input: {
    productId: string;
    name: string;
    brand: string | null;
    unitPrice: number;
    stock: number;
  }) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeLine: (productId: string) => void;
  clear: () => void;
  touchActivity: () => void;
};

const KioskCartContext = React.createContext<KioskCartContextValue | null>(
  null
);

export function KioskCartProvider({
  pharmacyId,
  children,
}: {
  pharmacyId: string;
  children: React.ReactNode;
}) {
  const [cart, setCart] = React.useState<KioskCartState>(() =>
    emptyKioskCart(pharmacyId)
  );
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const stored = parseStoredCart(
      typeof window !== 'undefined'
        ? window.sessionStorage.getItem(KIOSK_CART_STORAGE_KEY)
        : null
    );
    const now = Date.now();
    if (stored) {
      let next = bindCartToPharmacy(stored, pharmacyId);
      if (isCartIdle(next, now)) {
        next = clearCart(next);
        clearStoredAssistantConversation();
        void endKioskClientPurchaseSession();
      }
      setCart(next);
    } else {
      setCart(emptyKioskCart(pharmacyId));
    }
    setHydrated(true);
  }, [pharmacyId]);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(KIOSK_CART_STORAGE_KEY, serializeCart(cart));
    } catch {
      // ignore quota
    }
  }, [cart, hydrated]);

  // Idle: vacía carrito de compra, no la cookie de dispositivo.
  React.useEffect(() => {
    if (!hydrated || cart.lines.length === 0) return;
    const id = window.setInterval(() => {
      setCart((prev) => {
        if (isCartIdle(prev, Date.now(), KIOSK_CART_IDLE_MS)) {
          void endKioskClientPurchaseSession();
          return clearCart(prev);
        }
        return prev;
      });
    }, 15_000);
    return () => window.clearInterval(id);
  }, [hydrated, cart.lines.length]);

  // Throttle: evita re-render + sessionStorage en cada toque (idle sigue actualizándose).
  const lastActivityWriteAt = React.useRef(0);
  const touchActivity = React.useCallback(() => {
    const now = Date.now();
    if (now - lastActivityWriteAt.current < 4_000) return;
    lastActivityWriteAt.current = now;
    setCart((prev) => {
      if (now - prev.updatedAt < 4_000) return prev;
      return { ...prev, updatedAt: now };
    });
  }, []);

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

  const value = React.useMemo<KioskCartContextValue>(
    () => ({
      cart,
      itemCount: cartLineCount(cart),
      displayTotal: cartDisplayTotal(cart),
      addProduct: (input) => {
        setCart((prev) =>
          addOrUpdateCartLine(bindCartToPharmacy(prev, pharmacyId), {
            ...input,
            quantityDelta: 1,
          })
        );
      },
      setQuantity: (productId, quantity) => {
        setCart((prev) => setCartLineQuantity(prev, productId, quantity));
      },
      removeLine: (productId) => {
        setCart((prev) => removeCartLine(prev, productId));
      },
      clear: () => {
        void endKioskClientPurchaseSession();
        setCart((prev) => clearCart(prev));
      },
      touchActivity,
    }),
    [cart, pharmacyId, touchActivity]
  );

  return (
    <KioskCartContext.Provider value={value}>
      {children}
    </KioskCartContext.Provider>
  );
}

export function useKioskCart(): KioskCartContextValue {
  const ctx = React.useContext(KioskCartContext);
  if (!ctx) {
    throw new Error('useKioskCart debe usarse dentro de KioskCartProvider');
  }
  return ctx;
}

export type { KioskCartLine };
