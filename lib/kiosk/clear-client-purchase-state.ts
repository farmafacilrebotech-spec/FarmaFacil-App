/**
 * Limpia estado de compra del cliente en sessionStorage
 * (carrito + asistente + turno de cliente).
 * No toca la cookie de dispositivo.
 *
 * Para invalidar el turno en servidor, usar endKioskClientPurchaseSession().
 */

import { clearStoredAssistantConversation } from '@/lib/kiosk/assistant/conversation-state';
import { KIOSK_CART_STORAGE_KEY } from '@/lib/kiosk/cart-state';
import { clearStoredClientTurn } from '@/lib/kiosk/client-turn-state';

export function clearKioskClientPurchaseState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(KIOSK_CART_STORAGE_KEY);
  } catch {
    // ignore
  }
  clearStoredAssistantConversation();
  clearStoredClientTurn();
}
