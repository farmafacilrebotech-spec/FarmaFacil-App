# PR #22 — GO/NO-GO y procedimiento de publicación

**Fecha:** 2026-11-11  
**PR:** https://github.com/farmafacilrebotech-spec/FarmaFacil-App/pull/22  
**Rama:** `feature/sa-subscription-ui-redesign` @ `c2f8c11`  
**Base:** `main` (retargeted; sync merge post-#21/#23)  
**Commits del PR vs main:** `a1d03e5` (feat) + `c2f8c11` (merge main)

---

## Veredicto

**GO CONDICIONAL (UI)** — listo para merge/deploy **solo tras autorización explícita**.

No es un cutover de precios ni de catálogo técnico. No requiere SQL en producción. No migra suscripciones automáticamente.

### Condiciones del GO

1. Checks Vercel Preview en verde para el tip `c2f8c11`.
2. Confirmación humana de que se acepta publicar **solo UI** (General/Personalizado/IA pueden quedar *no asignables* si no hay filas `plans` comerciales).
3. No aplicar draft `056` ni alterar `plans` / tarifas en el mismo publish.

### NO-GO si…

- Se interpreta el merge como “activar planes comerciales / precios nuevos”.
- Se pretende cambiar planes de farmacias existentes de forma masiva.
- Fallan checks de Vercel Preview en el tip actual.

---

## 1. Base y alcance

| Antes | Después (prep) |
|-------|----------------|
| Base `feature/sa-proveedores-kiosk` | Base **`main`** |
| Tip `a1d03e5` (sin #21/#23 en árbol) | Tip `c2f8c11` = merge de `origin/main` + feat |

**Diff vs `origin/main` (6 archivos, solo comerciales UI):**

- `app/(app)/farmacias/actions.ts` (+ gates #23 `requireSuperAdminPharmacyWrite` conservados)
- `components/pharmacies/change-plan-dialog.tsx`
- `components/pharmacies/manage-subscription-dialog.tsx` *(nuevo)*
- `components/pharmacies/pharmacy-subscription-panel.tsx`
- `lib/pharmacies/commercial-plan-catalog.ts` *(nuevo)*
- `lib/pharmacies/queries.ts`

**No reintroduce regresiones de #21/#23:** merge automático de `actions.ts`; logos/identity SA-only intactos. Cero overlap con proveedores/inventario/clientes/QR en el diff del PR.

---

## 2. Planes: vigentes vs legacy

| Oferta comercial (UI) | Clave UI | Alias DB / tarifas | Legacy kernel |
|-----------------------|----------|--------------------|---------------|
| Piloto | `piloto` | `pilot` | — (fuera del selector de cambio; va por Tarifas) |
| General | `general` | `general` | — |
| Personalizado | `personalizado` | `personalized` | — |
| IA | `asistente_ia_personalizado` | `ai_personalized`, `ia` | — |
| — | — | — | `starter` / `pro` / `business` / `enterprise` (etiquetados legacy) |

**Precios comerciales (047, no tocados por #22):**

| SKU | Mensual | Anual | Nota |
|-----|---------|-------|------|
| pilot | 0 | 0 | 15+15 días |
| general | 3900¢ | 39780¢ | descuento anual SaaS 1500 bps (15 %) en seed 047 |
| personalized | 6900¢ | 70380¢ | idem |
| ai_personalized | 9900¢ | 100980¢ | idem |

Capa técnica `plans` (staging observado): solo `starter|pro|business|enterprise` activos. Farmacias staging: todas en `starter`. Sin filas técnicas `general`/`personalizado`/`asistente_ia_personalizado` → UI las muestra **no asignables**.

---

## 3. Precios, descuentos, simulador, presupuestos, suscripciones

| Superficie | ¿Modificada por #22? |
|------------|----------------------|
| Tarifas / precios / descuentos lanzamiento (047) | **No** |
| Simulador (`/tarifas`) | **No** |
| Presupuestos comerciales | **No** |
| Filas `subscriptions` / `pharmacies.plan_id` al merge | **No** (sin auto-migración) |
| SA “Cambiar plan” (confirmado) | Sí → RPC existente `ff_change_pharmacy_plan_v1` |
| SA “Gestionar suscripción” | Sí → RPC existente `ff_transition_pharmacy_subscription_v1` |

`listActivePlans()` ahora lista **todas** las filas activas de `plans` (antes filtraba kernel). `changePharmacyPlanAction` exige fila activa real; no inventa productos.

---

## 4. SQL en producción

**Ninguno requerido para PR #22.**

| SQL | Acción en este publish |
|-----|------------------------|
| Migraciones del PR | *(ninguna)* |
| `079_STAGING_REMEDIATE` / 076–082 | No tocar (#21 ya aplicado) |
| Draft `056_commercial_plan_assign_catalog_mode_v1` | **No aplicar** |
| Seeds de precios | **No** |

**Datos existentes:** solo cambian si un SuperAdmin confirma una acción en los diálogos. No hay rewrite Starter→General.

*(Auditoría SQL prod omitida a petición: “No ejecutes SQL en producción”. Evidencia de planes tomada de código + staging `dazfdcjscnpfvhcyjddt`.)*

---

## 5. Tests / build / checks

| Check | Resultado |
|-------|-----------|
| Unit (`lib/pharmacies/*`, labels, catalog-mode) | **182 pass / 0 fail** |
| `tsc --noEmit` | **OK** (tras `npm ci`) |
| `npm run build` | **OK** |
| Vercel Preview Comments | SUCCESS |
| Vercel – kiosk-physical-inventory | SUCCESS |
| Vercel – farmafacil-app | Verificar tip `c2f8c11` en verde antes del merge |

---

## 6. Procedimiento de publicación (cuando autorices)

1. Confirmar tip `c2f8c11` y checks Preview en verde.
2. **No** ejecutar SQL en Supabase Production.
3. Merge **solo** PR #22 → `main` (squash o merge commit según política del repo).
4. Verificar deploy Vercel Production Ready en `app.farmafacil.solutions`.
5. Smoke manual SA:
   - Ficha farmacia → Contrato → Gestionar suscripción (abrir sin mutar).
   - Cambiar plan: ver oferta vigente + legacy; cancelar sin confirmar.
   - Confirmar que farmacia en Starter/Pro se etiqueta legacy.
   - Regresión rápida: `/proveedores`, `/inventario-kioskos`, logos/cartel QR (#23).
6. **No** configurar ni aplicar 056. **No** tocar `SUPPLIER_QUOTE_PDF_AI_ENABLED`.
7. No iniciar otros publishes hasta validar #22 en prod.

### Rollback

- Revert del merge commit en `main` + redeploy.  
- Sin SQL que revertir.

---

## 7. Pendientes post-GO (fuera de #22)

- Filas técnicas `plans` / asignación comercial (draft 056) — **solo con autorización aparte**.
- Pase UI manual en Preview/prod con sesión SA.
- Confirmar distribución real de `plans` en producción en el preflight del día del publish (lectura autorizada).
