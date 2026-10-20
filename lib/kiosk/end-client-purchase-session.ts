/**
 * Cierra el turno de cliente en servidor (best-effort) y limpia sessionStorage.
 * Usar al abandonar, idle, «Nueva», finalizar compra.
 */

import { abandonKioskClientTurnAction } from '@/app/k/asistente/consult-actions';
import { clearKioskClientPurchaseState } from '@/lib/kiosk/clear-client-purchase-state';
import { readStoredClientTurn } from '@/lib/kiosk/client-turn-state';

export async function endKioskClientPurchaseSession(): Promise<void> {
  const turn = readStoredClientTurn();
  if (turn?.token) {
    try {
      await abandonKioskClientTurnAction({ turnToken: turn.token });
    } catch {
      // Fail-open local: siempre limpiamos storage.
    }
  }
  clearKioskClientPurchaseState();
}
