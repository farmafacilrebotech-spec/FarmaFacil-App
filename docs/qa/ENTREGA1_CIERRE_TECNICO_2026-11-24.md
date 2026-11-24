# ENTREGA 1 — Cierre técnico Fase 0 (0.2 / 0.3)

**Fecha:** 2026-11-24  
**Rama:** `fix/entrega1-cierre-tecnico-fase0`  
**Base:** tip de `fix/qa-2026-11-23-block1` (PR #28 **no** mergeado a integration)  
**Staging actual / producción:** intactos (sin deploy, sin mig, sin datos QA tocados)

---

## 1. Correcciones realizadas

| Área | Cambio |
|------|--------|
| PDF presupuesto Vercel | `maxDuration` 60→**120**; `setContent` `domcontentloaded` + 30s; args serverless Chromium |
| Email staging | Prefijo central **`[PRUEBA STAGING]`**; dry-run reforzado en staging; contratos usan dry-run + allowlist + `sendTransactionalEmail` |
| Pack / carteles | Server Action `assertPharmacyMaterialsAccessAction` antes de generar PDF |
| E2E CLI-05 | Esperar redirect a `/catalogo` tras logout |
| E2E order-circuit | Abrir detalle por botón/link + esperar «Confirmar valoración» |
| visible_name | Draft SQL `supabase/migrations/drafts/106_…sql.draft` (**no aplicado**) |

## 2. Causas raíz

| Fallo | Causa |
|-------|-------|
| Timeout PDF E2E/Vercel | Cold start Chromium + `maxDuration` 60s insuficientes |
| CLI-05 ERR_ABORTED | Race: goto `/cuenta` mientras sign-out redirige a catálogo |
| Order-circuit select | Click en texto de **lista** (match «disponib/precio»); detalle no abierto |
| Pack ACL | Solo gate UI; faltaba assert servidor |
| Email contratos | Bypass de dry-run/allowlist/prefijo (fetch Resend directo) |
| WebKit | Browser no instalado en cache del agente |

## 3. Tests

Ver salida en informe de ejecución / CI del PR.

## 4. Preview

Sin sustituir staging: abrir PR con preview Vercel del branch si el proyecto lo genera automáticamente; **no** promover a `farmafacil-staging`.

## 5. Pruebas manuales nuevas (desde QA-72)

| ID | Prueba |
|----|--------|
| QA-72 | Descarga PDF presupuesto SA en preview (no staging QA) |
| QA-73 | Envío simulado presupuesto: estado simulated, sin Resend |
| QA-74 | Logout cliente → catálogo → cuenta pide login |
| QA-75 | Circuito pedido: valoración Disponible + precio desde detalle |
| QA-76 | Pack bienvenida: SA OK; Owner denegado (toast + sin PDF) |
| QA-77 | Contrato email dry-run: asunto con `[PRUEBA STAGING]` / simulated |
| QA-78 | WebKit smoke login + `/e/…` |

## 6. Bloqueos

- Merge PR #28 y esta rama: **esperar autorización**
- Deploy / sustituir staging: **no**
- Migración visible_name: solo draft
- Pack PDF bytes 100% server-side: pendiente (jsPDF DOM)
- Generador canónico Chromium vs pdf-lib: spike documentado; Chromium endurecido, decisión formal Fase 3

## 7. Confirmación

Staging QA y producción **no** modificados por esta entrega.
