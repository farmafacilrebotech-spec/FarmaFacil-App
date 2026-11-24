# P0 — Revisión solo lectura: `ff_customer_claim_order_v1`

**Fecha:** 2026-11-24 (actualizado post-contención)  
**Alcance inicial:** lectura de código + inspección staging.  
**Staging:** P0 fail-closed **aplicado** — ver `P0_CLAIM_ORDER_STAGING_RESULT_2026-11-24.md`.  
**Producción:** auditoría **solo lectura** — vulnerable; ver `P0_CLAIM_ORDER_PROD_AUDIT_2026-11-24.md`. Apply prod **no** autorizado.

---

## 1. Qué hace

SECURITY DEFINER. Entrada: `p_order_id uuid`.

1. Requiere `auth.uid()` (si null → `unauthenticated`).
2. Perfil con `ff_profile_is_customer_kind` (customer|both); si no → `forbidden`.
3. `SELECT … FOR UPDATE` del pedido por **UUID**.
4. Si ya tiene `customer_profile_id` de otro → `forbidden`; si es el mismo → `ok/already`.
5. Compara dígitos de `profiles.phone` vs `pharmacy_orders.customer_phone`.
6. Si coinciden y el pedido está libre → `UPDATE … SET customer_profile_id = auth.uid()`.

Fuente: `supabase/migrations/064_…` y replace en `071_dual_role_customer_staff_v1.sql`.  
Riesgo ya documentado en `docs/migrations/071_SECURITY_NOTES.md` (competición por mismo teléfono).

---

## 2. ¿Está accesible en staging / producción?

### Staging (`dazfdcj…`) — **CONFIRMADO activo**

| Check | Resultado |
|-------|-----------|
| Función presente | **Sí** |
| Security | **DEFINER** |
| `EXECUTE` grants | **`anon`, `authenticated`, `postgres`, `service_role`** |
| Pedidos sin link con teléfono (agregado) | **125** / 176 totales |
| Pedidos ya linked | 50 |

Nota: migración 064 en repo hace `GRANT … TO authenticated, service_role` y `REVOKE FROM PUBLIC`, pero en staging **también figura `anon`**. El cuerpo exige `auth.uid()`, así que anon no completa el claim; el grant sobra y debe revocarse.

Notas antiguas (`staging_064_APPLY_NOTES.md`, 2026-11-11) decían «claim ausente»; el estado **actual** de staging lo tiene. Se aplicó 064/071 completo con posterioridad.

### Producción

- **No auditada en vivo** en esta pasada (consulta DB prod no autorizada por el entorno).
- Existe runbook `071_PUBLISH_RUNBOOK.md` / `071_APPLY_PROCEDURE.md` que incluyen esta función.
- **Acción:** autorizar un `SELECT` análogo solo a `pg_proc` + grants + conteos agregados en prod, o asumir riesgo hasta verificar.

### App / UI

- **Cero** referencias TypeScript/TSX a `ff_customer_claim_order` / `claimOrder` en el monorepo buscado.
- Superficie práctica: **PostgREST** `/rest/v1/rpc/ff_customer_claim_order_v1` para cualquier cliente que conozca el nombre y tenga sesión customer|both.

---

## 3. ¿Permite vincular pedidos ajenos?

**Condicionalmente sí**, si el atacante:

1. Tiene (o registra) cuenta customer con el **mismo teléfono normalizado** que el del pedido, y
2. Conoce el **`order_id` UUID** (no basta el `display_number` ante este RPC).

No hay OTP, no hay token de ticket, no hay prueba de posesión del pedido más allá del teléfono.

UUID v4 reduce enumeración masiva, pero el UUID puede filtrarse por logs, deep links, responses de create-order, soporte, o XSS. Teléfonos en pedidos QR públicos amplían la base de «unlinked_with_phone» (125 en staging).

Tras el claim, RLS `pharmacy_orders_select_own_customer` expone al atacante el pedido (líneas, importes, farmacia, metadatos). No debería ver pedidos de otras farmacias sin link, pero **sí** se apropia del historial de ese pedido.

---

## 4. Datos potencialmente expuestos tras claim indebido

- Contenido del pedido (productos, cantidades, PVP).
- `display_number`, estado, timestamps.
- Farmacia asociada.
- Posible `customer_name` / nota si estaban en la fila.
- El teléfono ya lo «conocía» el atacante para el match.

No expone automáticamente el resto de pedidos de la víctima ni CRM de la farmacia.

---

## 5. Contención recomendada (P0 — **no aplicada**)

Corrección mínima independiente (rama dedicada cuando se autorice):

```sql
-- 1) Quitar execute a anon (inmediato)
REVOKE ALL ON FUNCTION public.ff_customer_claim_order_v1(uuid) FROM PUBLIC, anon;

-- 2) Desactivar lógica de teléfono hasta token QR (fail closed)
CREATE OR REPLACE FUNCTION public.ff_customer_claim_order_v1(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- P0 contención 2026-11-24: claim por teléfono deshabilitado.
  -- Sustituir por ff_claim_order_by_access_token_v1 (E2 avisos).
  RETURN jsonb_build_object(
    'status', 'disabled',
    'message', 'Claim por teléfono deshabilitado. Use el enlace seguro del ticket.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ff_customer_claim_order_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ff_customer_claim_order_v1(uuid)
  TO authenticated, service_role;
```

Aplicar primero en **staging** con OK explícito; prod solo tras verificación + autorización.  
No requiere WhatsApp/avisos; es hotfix de seguridad separable.

Hasta entonces: no documentar públicamente el RPC; no añadir UI de claim por teléfono.

---

## 6. Severidad

| Dimensión | Valor |
|-----------|-------|
| Severidad | **Alta** (apropiación de pedido con teléfono + UUID) |
| Explotabilidad staging | Media (RPC vivo; UI ausente; UUID + phone) |
| Explotabilidad prod | **Desconocida** hasta audit live |
| Contención | Fail-closed del RPC · luego E2 token |

**Informe inmediato:** vulnerabilidad **activa en staging**. Contención SQL lista arriba; **no aplicada** (restricciones vigentes).
