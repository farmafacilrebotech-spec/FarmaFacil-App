# Propuesta 4.2 — «Cartera comercial» vs «Farmacias» · SOLO DISEÑO

- **Fecha:** 2026-11-23 · **Estado:** propuesta (autorizada para diseño; **no se implementa nada**).
- **Origen:** hallazgo #11 de `DIAGNOSTICO_QA_2026-11-23.md` — separar Cartera comercial de Farmacias activadas.
- **Restricciones:** sin migraciones nuevas ahora (en particular **no** migración 105), sin tocar producción.

## 1. Problema

SuperAdmin necesita gestionar **prospectos y relación comercial** (quién podría contratar, en qué punto está, con qué consentimiento
de comunicación), pero hoy solo existe la entidad `pharmacies`, que representa **tenants reales** (con panel, QR, catálogo,
memberships, entitlements y estado de ciclo de vida). Mezclar ambas provoca:

- Farmacias «fantasma» creadas solo para llevar un seguimiento (ensucian listados, contadores, métricas y selectores).
- Riesgo de activar por error servicio/trial sobre algo que solo era un lead.
- Emails comerciales sin base de consentimiento clara (ver `lib/email/pharmacy-portfolio-recipients.ts`).

## 2. Situación actual (verificada)

| Concepto | Estado | Evidencia |
|---|---|---|
| Farmacias (tenants) | Operativo | tablas `pharmacies`, `pharmacy_memberships`, `pharmacy_entitlements`; `app/(app)/farmacias/*` |
| Estados de farmacia | `pending_setup`, `active`, suspendida, archivada | `lib/pharmacies/commercial-lifecycle.ts`, `pharmacies.status` |
| Cartera comercial | **No existe** (stub) | `pharmacy-portfolio-recipients.ts` devuelve `available:false`; `MANUAL_SUPERADMIN.md §5` «no_publicado (FUT-CARTERA)» |
| Presupuestos / contratos | Operativo (borrador; legal pendiente) | `commercial_quotes`, `commercial_contracts` (`quote_id` NOT NULL; `pharmacy_id` **nullable**) |
| Emails comerciales | Bloqueados sin habilitación | `corporate-send-policy.ts`; `MANUAL_EMAILS.md` («Cartera + ack») |

Dato clave: `commercial_quotes`/`commercial_contracts` ya admiten `pharmacy_id` nulo, es decir, el modelo comercial **ya anticipa**
documentos previos a la existencia del tenant.

## 3. Principio rector

> **Cartera = relación comercial (prospecto/cliente potencial o contratado). Farmacia = tenant operativo.**
> Una entrada de Cartera **puede** convertirse en Farmacia; una Farmacia **no** debe crearse para «apuntar» a alguien.
> El vínculo es opcional y unidireccional (`portfolio_account.pharmacy_id` nullable).

## 4. Opciones evaluadas

| Opción | Descripción | Pros | Contras | Veredicto |
|---|---|---|---|---|
| A | Seguir usando `pharmacies` con estado `lead`/`prospect` | Cero tablas nuevas | Contamina tenants, rompe RLS/contadores, riesgo de activación accidental | **Descartada** |
| B | Tabla nueva `commercial_portfolio_accounts` (+ contactos + consentimientos), vínculo opcional a `pharmacies` | Separación limpia, consentimiento explícito, reutiliza quotes/contracts | Migración nueva (posterior), UI nueva | **Recomendada** |
| C | CRM externo (HubSpot, etc.) + sincronización | Funcionalidad completa ya hecha | Coste, RGPD/transferencias, integración, doble fuente de verdad | Alternativa a medio plazo |
| D | Solo copy/IA en UI de SA (sin datos) | Sin migración | No resuelve el problema operativo | Insuficiente |

**Recomendación:** opción **B** en dos fases; C solo si el volumen comercial lo justifica.

## 5. Modelo de datos propuesto (referencia; NO aplicar)

```
commercial_portfolio_accounts
  id uuid PK
  display_name text NOT NULL            -- nombre comercial de la farmacia/grupo
  legal_name text, tax_id text          -- opcionales
  city text, province text
  stage text CHECK in ('prospect','contacted','demo','proposal','negotiation','won','lost','on_hold')
  source text                           -- web, evento, referido, import
  owner_profile_id uuid → profiles      -- comercial responsable
  pharmacy_id uuid NULL → pharmacies    -- se rellena al convertir (UNIQUE parcial)
  notes text, next_action_at timestamptz
  created_at / updated_at / archived_at

commercial_portfolio_contacts
  id, account_id → accounts, name, role, email, phone, is_primary

commercial_portfolio_consents            -- base para emails comerciales
  id, contact_id → contacts, channel ('email'), basis ('consent','legitimate_interest'),
  granted_at, revoked_at, evidence text, source text

commercial_portfolio_events              -- timeline (llamada, email, demo, cambio de etapa)
  id, account_id, kind, summary, created_by, created_at
```

- `commercial_quotes.portfolio_account_id uuid NULL` (opcional, fase posterior) para enlazar presupuestos con la cuenta antes de que
  exista la farmacia.
- **RLS:** solo plataforma con permiso nuevo `platform.commercial_portfolio.manage` (SuperAdmin Total/Comercial); **sin acceso** de
  roles de farmacia ni clientes. Sin `DELETE` (archivado lógico), igual que `pharmacy_products`.
- **No** se crean `entitlements`, trials ni memberships desde Cartera: la conversión es una **acción explícita** que reutiliza los
  RPC existentes de creación de farmacia (`091_create_pharmacy_no_auto_trial_v1`) y asignación de plan (`083/093/095`).

## 6. Flujo de conversión «Cartera → Farmacia»

1. SA abre una cuenta en etapa `won` (o decide anticipar) → botón «Crear farmacia desde cartera».
2. Se muestran los datos a copiar (nombre, ciudad, contacto) con revisión manual; se crea la farmacia en `pending_setup`
   (**sin trial automático**, ya garantizado por 091).
3. Se guarda `portfolio_account.pharmacy_id`; la cuenta pasa a `won` y se registra evento.
4. Presupuesto → aceptación → contrato (BORRADOR) siguen su flujo actual; **firma y activación siguen siendo pasos explícitos**.
5. La farmacia aparece en «Farmacias» solo a partir del paso 2; antes solo existe en Cartera.

## 7. UX propuesta en SuperAdmin

| Área | Cartera comercial (nueva) | Farmacias (actual) |
|---|---|---|
| Ruta | `/cartera` (menú «Comercial») | `/farmacias` |
| Qué lista | Cuentas, contactos, etapa, próxima acción, consentimiento | Tenants con estado operativo, plan, QR, productos |
| Acciones | Cambiar etapa, añadir contacto/evento, importar plantilla, convertir | Gestionar logo, catálogo, QR, usuarios, plan |
| Indicadores | Embudo por etapa, conversiones | Activas, `pending_setup`, suspendidas |
| Etiquetas | Chip «En cartera» en cuentas sin farmacia | Chip «Origen: cartera» si `pharmacy_id` enlazado |

Reglas de copy: nunca llamar «farmacia» a una cuenta sin tenant; nunca mostrar acciones operativas (QR, catálogo) en Cartera.

## 8. Integración con Emails

- `listPharmacyPortfolioCommercialRecipients` pasaría a leer `commercial_portfolio_consents` (solo contactos con base vigente y
  no revocada). Hasta entonces permanece `available:false` (sin inventar filas).
- El bloqueo backend de emails **comerciales** sin habilitación se mantiene; Cartera aporta la base legal, no la elimina.
- Baja/revocación: enlace de baja actualiza `revoked_at` y se refleja de inmediato en destinatarios.

## 9. Importación (plantilla)

El worktree de «plantilla import» mencionado en `INDICE_PANTALLAS.md` (FUT-CARTERA) sería la base: CSV/XLSX con
`display_name, city, province, contact_name, contact_email, source, consent_basis, consent_date`. Reutilizar el parser
`lib/import/*` (preview con altas/duplicados/errores, igual que el import de catálogo). Deduplicación por `tax_id` o
`lower(email)` del contacto principal.

## 10. Plan por fases (cuando se autorice)

| Fase | Contenido | Migración | Riesgo |
|---|---|---|---|
| 0 | Decisiones (§11) + copy en UI SA que explique la diferencia (sin datos) | No | Bajo |
| 1 | Tablas accounts/contacts/events + permiso + `/cartera` lectura/alta/edición | Sí (nueva, **tras 104**; no 105 hasta que se autorice) | Medio |
| 2 | Consentimientos + integración con Emails comerciales | Sí | Medio (legal/RGPD) |
| 3 | Conversión Cartera → Farmacia + vínculo con presupuestos | Sí | Medio |
| 4 | Importación XLSX/CSV + embudo | No | Bajo |

## 11. Decisiones pendientes

1. ¿Opción B (modelo propio) o C (CRM externo)?
2. ¿Una cuenta puede ser un **grupo** con varias farmacias (cadena)? Si sí, añadir `parent_account_id`.
3. ¿Quién puede ver/editar Cartera: solo SA Total y Comercial, o también Soporte (solo lectura)?
4. Base legal por defecto de contactos importados (consentimiento explícito vs interés legítimo) — requiere revisión jurídica.
5. ¿Los presupuestos deben poder crearse desde Cartera antes de existir la farmacia (`portfolio_account_id`)?

## 12. Pruebas previstas

- RLS: farmacia/cliente/soporte sin permiso no leen ni escriben Cartera.
- Conversión: crea farmacia en `pending_setup` **sin** entitlement/trial; idempotente (segundo intento no duplica).
- Emails: contacto sin consentimiento o revocado queda excluido de destinatarios comerciales.
- UI: ninguna cuenta de Cartera aparece en `/farmacias`, selectores de farmacia ni contadores del dashboard.

## 13. Fuera de alcance

Facturación, cobros, firma electrónica, campañas automáticas, scoring de leads, sincronización con CRM externo.
