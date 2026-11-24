# Propuesta técnica — Avisos de recogida y vinculación kiosko↔App

**Fecha:** 2026-11-24  
**Estado:** propuesta de diseño · **no autoriza** ramas de implementación, migraciones, staging, prod ni APK  
**Pilotos objetivo:** diciembre 2026  
**Compatibilidad:** mantiene stock no bloqueante (PR #30 `5427b0d`)

---

## 0. Estado paralelo (contexto)

| Ítem | Estado |
|------|--------|
| PR #30 catálogo Fase B + stock no bloqueante | OPEN · tip `5427b0d` · preview Vercel OK · **tests unitarios OK** |
| Pruebas integrales PR #30 (Excel reimport, duplicados, revert, RLS E2E en BD) | **Pendientes** — requieren BD aislada |
| Migraciones propuestas 089/090 | **No aplicadas** (staging/prod prohibidos) |
| BD local aislada (Docker/Supabase) | **No disponible** (`DOCKER_DOWN`) |
| PR #28 / #29 | No interrumpir cierre |

---

## 1. Inventario: reutilizar vs construir

### 1.1 Reutilizable ya existente

| Capacidad | Dónde | Notas |
|-----------|-------|-------|
| Estado «listo para recoger» | `pharmacy_orders.status = ready` · `lib/orders/transitions.ts` · labels | No inventar estado paralelo |
| Circuit pedidos farmacia | `pharmacy-orders-panel.tsx` · RPCs `ff_update_pharmacy_order_status_v1` | Extender detalle, no duplicar |
| WhatsApp manual `wa.me` | `lib/orders/whatsapp-notify.ts` | Hoy solo `public_qr` + `ready`; ampliar a kiosko con teléfono |
| Teléfono en pedido | `pharmacy_orders.customer_phone` (+ name/note/privacy) · mig 057 | Reutilizar columna; marcar consentimiento aviso |
| Create pedido kiosko | `ff_kiosk_create_order_v1` · `kiosk-cart-view` · ticket | Insertar paso teléfono **antes** de ticket/print |
| Ticket + print | `kiosk-order-ticket.tsx` · bridge Android | Mantener; **añadir QR de acceso seguro** (hoy no va en ticket) |
| Catálogo QR + PII + consentimiento | `public-catalog-request-*` · normalización ES | Ampliar a internacional (+34 default) |
| Cuenta cliente / Mis farmacias / PWA | `app/cuenta`, `app/e/.../cuenta`, `sw-customer.js`, `customer_saved_pharmacies` | SW hoy solo cache estático |
| Link opcional al crear QR | `ff_public_catalog_create_request_v1` + `p_link_to_customer` (072) | Solo si sesión customer |
| Quote tokens públicos | `pharmacy_order_quote_tokens` (062/063) | **Patrón a copiar** para token de vinculación pedido |
| RLS tenant + own customer | 040 / 064 · staff_hide docs | Extender a nuevas tablas PII |
| Stock no bloqueante | PR #30 | No tocar |

### 1.2 Gaps (hay que desarrollar)

| Gap | Criticidad piloto dic. |
|-----|------------------------|
| Paso kiosko «¿te avisamos?» + teclado táctil + intl phone | **P0** |
| Persistencia consentimiento aviso + dedupe create order | **P0** |
| Panel: aviso solicitado, WA registrado (fecha/usuario), distinto de `ready` | **P0** |
| Mensaje WA alineado al copy aprobado (sin importe obligatorio / branding) | **P0** |
| QR ticket → landing segura de estado/vínculo (token, no `display_number`) | **P0/P1** |
| Sustituir/acotar `ff_customer_claim_order_v1` por **token**, no por teléfono | **P0 seguridad** |
| Tabla + UI notificaciones in-app área cliente | **P1** |
| Emisión al pasar a `ready` (idempotente) | **P1** |
| Web Push (VAPID, SW `push`, suscripciones, permiso) | **P2** (si da tiempo; no bloquea piloto si hay in-app + WA) |
| Política retención/borrado teléfono (legal) | **Bloqueo jurídico** paralelo |
| Denegar SA Comercial sobre PII operativa | **P0 permisos** |

### 1.3 Riesgo de seguridad actual (claim por teléfono)

`ff_customer_claim_order_v1` (064/071) vincula si el teléfono del perfil coincide con `customer_phone` del pedido.

Eso **contradice** la regla aprobada: *«No vincular automáticamente pedidos por coincidencia de teléfono»* y facilita apropiación si alguien registra el mismo móvil.

**Decisión de diseño:** la vinculación kiosko↔App debe hacerse **solo** con token opaco de un solo uso / corta vida embebido en el QR del ticket (mismo patrón que quote tokens). El claim por teléfono queda **deprecado o restringido** (p. ej. solo pedidos `public_qr` ya consentidos + MFA futura — fuera de piloto).

---

## 2. Modelo de datos propuesto (**no aplicar**)

Numeración tentativa tras tip actual (~088 en main / 104 en INT): **propuesta `091+` o siguiente libre tras coordinar #28/#29** — nunca 105/106 conflictivos. Solo `proposed/` o draft hasta autorización + BD aislada.

### 2.1 Extensión `pharmacy_orders`

| Columna | Tipo | Uso |
|---------|------|-----|
| `pickup_notify_requested` | bool NOT NULL DEFAULT false | Cliente pidió aviso |
| `pickup_notify_channel_pref` | text nullable (`whatsapp` \| `app` \| `any`) | Preferencia; no envío auto WA |
| `pickup_consent_at` | timestamptz | Consentimiento uso teléfono solo gestión/aviso |
| `customer_phone` | (existente) | Reutilizar; **nullable** en kiosko |
| `source` | (existente) | `kiosk` \| `public_qr` \| … |

No crear tabla comercial de teléfonos. No insertar en CRM clientes por el aviso.

### 2.2 Tokens de acceso/vinculación (nuevo)

```
pharmacy_order_access_tokens
  id uuid PK
  order_id uuid → pharmacy_orders ON DELETE CASCADE
  pharmacy_id uuid NOT NULL
  token_hash text UNIQUE NOT NULL   -- nunca el token en claro en BD
  purpose text CHECK (purpose IN ('status_view','claim_link'))
  expires_at timestamptz NOT NULL
  consumed_at timestamptz
  created_at timestamptz
```

QR ticket → `https://{app}/o/{publicToken}` (token alta entropía).  
RPC: `ff_get_order_by_access_token_v1` (sin PII de otros), `ff_claim_order_by_access_token_v1` (auth customer → set `customer_profile_id`).

### 2.3 Registro de avisos (idempotente)

```
pharmacy_order_pickup_alerts
  id uuid PK
  order_id uuid
  pharmacy_id uuid
  channel text CHECK (channel IN ('whatsapp_manual','in_app','push'))
  status text CHECK (status IN ('opened_client','recorded','sent_attempt','failed','skipped'))
  -- opened_client = se abrió wa.me (NO implica enviado)
  -- recorded = trabajador marcó «aviso realizado»
  actor_profile_id uuid nullable
  dedupe_key text UNIQUE  -- p.ej. order_id||channel||'ready_v1'
  meta jsonb  -- sin teléfono en claro si se puede; o cifrado/app-level
  created_at, updated_at
```

Regla: al entrar en `ready`, crear como máximo **una** fila `in_app` (+ una `push` si procede) por `dedupe_key`. Reentradas a `ready` no duplican.

### 2.4 Notificaciones área cliente

```
customer_notifications
  id uuid PK
  profile_id uuid NOT NULL
  pharmacy_id uuid
  order_id uuid
  kind text  -- 'order_ready'
  title text
  body text
  read_at timestamptz
  created_at
  UNIQUE (order_id, kind)  -- anti-duplicado
```

### 2.5 Push (fase P2)

```
customer_push_subscriptions
  id, profile_id, endpoint, p256dh, auth, user_agent, created_at, revoked_at
```

VAPID keys solo en secretos servidor. Envíos externos **off** en QA (flag `FF_PUSH_ENABLED=false`).

### 2.6 RLS / permisos

- Lectura teléfono pedido: `orders.view` + membresía farmacia operable; **excluir** rol plataforma `commercial` / SA Comercial.
- SuperAdmin Total: solo si ya tiene permiso operativo equivalente (o vía impersonación auditada — decidir; por defecto **mínimo**: SA Comercial **sin** PII).
- Customer: solo sus `customer_notifications` y pedidos `customer_profile_id = auth.uid()`.
- Tokens: solo RPC DEFINER; sin SELECT abierto del hash.

### 2.7 Retención (pendiente legal)

Propuesta técnica provisional (no aplicar sin OK legal):

- Teléfono pedido: borrar o anonimizar a los **N días** tras `delivered`/`cancelled` (N TBD jurídico).
- No copiar a Cartera ni marketing.
- Logs app: no imprimir teléfono; tickets/QR sin teléfono.

---

## 3. Flujos de interfaz

### 3.1 Kiosko (P0)

Tras confirmar carrito / **antes** de imprimir ticket:

1. Pantalla: «¿Quieres que te avisemos cuando tu pedido esté listo?»
2. Teclado numérico grande; prefijo `+34` editable (intl).
3. Texto legal corto: uso exclusivo gestión + aviso recogida.
4. Botones:
   - «Confirmar pedido y recibir aviso» (valida teléfono)
   - «Continuar sin aviso»
5. Create order **idempotente** (client `idempotency_key` ya parcialmente en kiosk create — reforzar UI disable + mismo key).
6. Ticket + QR acceso (token) + print actual.
7. Wipe PII de sessionStorage/React state al éxito, cancel, idle carrito.

### 3.2 Panel farmacia — detalle pedido (P0)

Campos:

- Origen (`source`)
- Aviso solicitado (sí/no)
- Teléfono (si authorized)
- Cuenta vinculada (sí/no · sin PII extra)
- Estado App notify (`pending` / `delivered_in_app` / `read` / `n/a`)
- Estado WA (`not_applicable` / `ready_to_notify` / `wa_opened` / `marked_sent`)
- Fecha + usuario último «aviso realizado»

Botón «Avisar por WhatsApp» si `pickup_notify_requested` && phone && status∈{`ready`} && permiso.  
Abrir `wa.me` ≠ enviado → CTA secundario «Marcar aviso realizado».

Copy WA (plantilla):

```
¡Hola! Tu pedido nº {displayNumber} ya está preparado. Puedes pasar a recogerlo en {pharmacyVisibleName}. ¡Gracias por confiar en nosotros!

Tu farmacia, más cerca de ti.
FarmaFácil
```

Sin productos, sin notas clínicas, sin teléfono en URL distinta al destinatario.

### 3.3 App cliente (P1–P2)

- Inbox notificaciones + badge contador no leídas.
- Tap → `/e/{publicId}/cuenta/pedidos/{orderId}` (o ruta global cuenta).
- Push opcional tras permiso; no exige teléfono.
- Landing `/o/{token}`: estado pedido · login/registro · vincular · instalar PWA · activar push · guardar farmacia (todo voluntario).

Si al vincular ya está `ready` → crear notificación in-app **si no existe** (mismo UNIQUE).

---

## 4. Estimación orientativa

| Entrega | Alcance | Esfuerzo (orden) |
|---------|---------|------------------|
| **E0** Diseño+seguridad tokens + permisos SA Comercial | Docs + contratos RPC | 0,5–1 d |
| **E1 P0 Piloto** Kiosko teléfono opcional + create + wipe + WA panel + alert log + copy | UI+actions+tests; mig draft | 3–5 d |
| **E2 P0/P1** QR token en ticket + landing estado/claim seguro | UI+RPC+tests | 2–4 d |
| **E3 P1** In-app notifications on `ready` + badge + historial | UI+trigger+tests | 2–3 d |
| **E4 P2** Web Push + SW | Infra+flags QA off | 3–5 d |
| **Legal** retención teléfono | Fuera eng. | paralelo |

**Camino crítico pilotos diciembre (aprobado):** **E2 → E1 → E3**. E4 opcional.  
No activar recogida de teléfonos hasta deshabilitar claim por teléfono.

---

## 5. Orden de ejecución recomendado

```
A. Cerrar / no bloquear PR #28, #29, #30
A0. P0 seguridad: fail-closed ff_customer_claim_order_v1 (staging→prod con OK)
B. BD local/smoke: 089/090 + integrales #30
C. Autorizar rama ÚNICA feat/pickup-notify-kiosk-app (después)
D. E2 token QR + claim atómico (sustituye teléfono)
E. E1 kiosko teléfono opcional + WA panel
F. E3 in-app on ready
G. E4 push opcional
H. Revisión legal retención
```

**No** en paralelo con merge conflictivo de catálogo; **no** APK salvo print bridge ya existente (sin cambios APK pedidos).

---

## 6. Checklist QA (piloto)

### Kiosko
- [ ] Pedido sin teléfono → OK, ticket/QR, sin aviso solicitado
- [ ] Pedido con teléfono válido ES / intl → `pickup_notify_requested`
- [ ] Teléfono inválido → no crea / error claro
- [ ] Doble tap no duplica pedido
- [ ] Idle/cancel limpia PII de sesión
- [ ] Ticket sin teléfono visible; QR no embebe teléfono

### Farmacia
- [ ] Detalle muestra origen + flags aviso
- [ ] STAFF/Owner/Admin con permiso ven teléfono; SA Comercial **no**
- [ ] Multifarmacia: farmacia B no ve pedido/teléfono de A
- [ ] WA abre mensaje correcto (nombre farmacia + displayNumber)
- [ ] «Marcar aviso» registra actor+fecha; distinto de solo `ready`
- [ ] Reabrir WA no marca solo; marcar dos veces idempotente

### App / vínculo
- [ ] Token inválido/expirado → no filtra pedidos ajenos
- [ ] displayNumber solo no permite claim
- [ ] Login + claim con token OK; sin match teléfono requerido
- [ ] Ya linked → already; otro usuario → forbidden
- [ ] Ready al claim → una sola notificación in-app
- [ ] Badge / leído / deep link al pedido
- [ ] Push solo con permiso; QA con flag off no llama red externa

### Regresiones
- [ ] Stock no bloqueante intacto
- [ ] Catálogo QR / quote acceptance intactos
- [ ] Mis farmacias voluntario
- [ ] Sin WhatsApp Business API / SMS

---

## 7. Incorporación al plan maestro

Añadir workstream **«Avisos recogida + vínculo kiosko-App»** como prioridad piloto diciembre, **después** del cierre técnico #28/#29/#30 y **condicionado** a BD aislada para migraciones.

Dependencias: circuito `ready`, `whatsapp-notify`, PWA cliente, patrón tokens 062.  
No bloquea Cartera/expediente; sí comparte reglas PII (SA Comercial sin datos operativos de clientes finales).

---

## 8. Resumen ejecutivo

| Pregunta | Respuesta |
|----------|-----------|
| ¿Se puede hacer sin sistema paralelo de pedidos? | **Sí** — extender `ready` + panel existente |
| ¿Hay push hoy? | **No** — hay que construirlo (P2) |
| ¿Hay WA manual hoy? | **Sí** — ampliar + auditar «enviado» |
| ¿Vinculación segura hoy? | **Parcial** — claim por teléfono **no cumple** nueva política; hace falta token en QR |
| ¿Empezar ya a codear? | **No** hasta no interrumpir #28–#30 y tener tronco + BD aislada |
| ¿Valor mínimo piloto? | Kiosko teléfono opcional + WA panel auditado + token QR + in-app on ready |
