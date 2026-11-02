# 071 — notas de seguridad (doble rol)

## Consentimiento

- Staff → área cliente: solo `ff_customer_enable_self_v1` con `p_privacy_accepted = true`.
- Registra `privacy_accepted_at` (y marketing opcional) en servidor.
- Metadata de Auth **no** puede fijar `account_kind = both`.

## Aislamiento

- Direcciones / pedidos cliente / Mis farmacias: anclados a `auth.uid()` / `profile_id`.
- Accept membership: solo filas `profile_id = auth.uid()` en estado `invited`.

## GUC `ff.allow_account_kind_change`

Tokens locales de transacción: `enable_self_v1`, `accept_membership_v1`, `platform_admin_v1`.  
No usar el literal `1`. PostgREST no expone `SET` arbitrario; el riesgo residual es SQL privilegiado.

## `platform.users.write`

Sin token admin: solo upgrades `staff|customer → both`.  
Degradaciones requieren token `platform_admin_v1` + permiso.

## Riesgo heredado: claim de pedidos por teléfono

`ff_customer_claim_order_v1` vincula un pedido no reclamado si el teléfono normalizado coincide.  
Dos usuarios con el mismo número podrían competir por el claim.

**Recomendación (fuera de esta tarea):** exigir coincidencia de email o un OTP de verificación antes del claim; o limitar claim a pedidos creados en la misma sesión/dispositivo. No modificar el flujo de pedidos en 071 salvo necesidad crítica para el doble rol.
