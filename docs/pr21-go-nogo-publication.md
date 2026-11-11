# PR #21 — Informe de publicación (actualizado)

Fecha: **2026-11-11** · Branch `feature/sa-proveedores-kiosk` · PR [#21](https://github.com/farmafacilrebotech-spec/FarmaFacil-App/pull/21)  
**Sin merge / sin deploy / sin migraciones en producción en esta sesión.**

Reutiliza la auditoría previa (2026-11-10) y la amplía con 081–082, preflight prod live y smokes staging del 11-nov.

---

## Veredicto

### **GO CONDICIONAL — preparado para publicación tras autorización expresa**

Bloqueantes técnicos del informe anterior están cerrados a nivel de código + staging.  
**Sigue prohibido** merge/deploy/aplicar SQL en prod hasta que Pilar autorice expresamente.

| Ámbito | Estado |
|--------|--------|
| Alcance funcional Proveedores + Inventario | **Completo** (staging green) |
| Merge con `origin/main` | **Limpio** (0 detrás, 20 commits delante) |
| Tests unitarios módulo | **43/43 PASS** |
| Smoke staging proveedores | **ALL PASSED** |
| Smoke staging inventario/exhibition | **OK** |
| Migraciones prod 076–082 | **Pendientes de aplicar** (preflight confirmado) |
| `079_STAGING_REMEDIATE_*` | **Excluida** (no aplicar) |
| PR #22 / #23 | **Fuera de alcance** (no mezclar) |
| `OPENAI_API_KEY` | **No configurar** (IA PDF desactivada) |
| Datos DEMO staging → prod | **Prohibido** |

### Bloqueantes pendientes (solo proceso / autorización)

1. **Autorización explícita** de Pilar para: backup → SQL 076–082 → merge → deploy.
2. **Backup verificable** de producción antes del SQL (aún no ejecutado).
3. Confirmar en Vercel Production que **no** existe `OPENAI_API_KEY` (ni al publicar).

No hay conflictos de merge ni huecos de esquema descubiertos que impidan la ventana.

---

## 1. Estado PR #21 vs `origin/main`

| Campo | Valor |
|-------|--------|
| Título | feat(superadmin): módulo Proveedores (076, reutiliza WIP 068) |
| Base / head | `main` ← `feature/sa-proveedores-kiosk` |
| Draft | **No** (OPEN) |
| Ahead / behind | **20 / 0** |
| Merge dry-run | **OK** (sin conflictos reales) |
| Checks | Vercel Preview + `farmafacil-app` + `kiosk-physical-inventory` **SUCCESS** |
| Diff | ~67 files, +15.7k / −375 |

### Fuera de este release

- **PR #22** `feature/sa-subscription-ui-redesign` — Gestionar suscripción / planes.
- **PR #23** `feature/pharmacy-clients-and-qr` — Clientes + QR (draft).

---

## 2. Alcance funcional (confirmado)

| Capacidad | Estado |
|-----------|--------|
| Menú SA Proveedores | Sí |
| Directorio proveedores (alta/edición/archivo, contactos, actividad) | Sí |
| Presupuestos + líneas + adjuntos signed URL | Sí |
| Comparador de ofertas / coste real | Sí |
| Presupuesto aceptado → pedido (sin auto-confirmar) | Sí |
| Pedidos generales + IVA/transporte | Sí |
| Numeración anual `YYYY/########` al confirmar (080) | Sí |
| Extensión 1:1 compras de kioskos (079) | Sí |
| Recepción → activos KSK (sin farmacia) | Sí |
| Inventario: Pedido / Recibido / Asignado / **En exposición** / Reparación / Retirado | Sí (081) |
| Historial estados + notas append (082) | Sí |
| Pegatina oficial KSK | Sí |
| Extracción PDF con IA | Código presente; **inactivo sin `OPENAI_API_KEY`** |

---

## 3. Preflight producción (`gsnohwsvjxpjfcsstnfd`) — solo lectura 2026-11-11

| Objeto | Prod |
|--------|------|
| `kiosk_assets` (065) | **Presente** |
| `platform_suppliers` / quotes / SPO / `kiosk_purchase_orders` | **Ausentes** |
| `kiosk_asset_status_events` / counters 080 | **Ausentes** |
| `ff_kiosk_asset_next_code` / `ff_kiosk_inventory_set_status_v1` | Presentes (065) |
| `ff_supplier_po_confirm_v1` / `ff_kiosk_purchase_receive_v1` | **Ausentes** |
| Permisos `platform.suppliers.*` / `platform.kiosk_purchasing.*` | **0** |
| Buckets `supplier-docs` / `kiosk-purchase-docs` | **No** |
| Activos | **1** → **`KSK-0001`** |
| `KSK-0001` | `warehouse`, serial `00000000000589e1c8`, sin farmacia, modelo Android K2101, vendor OKOM |
| `kiosk_asset_code_seq` | `last_value=1` → próximo **`KSK-0002`** |
| CHECK status | sin `exhibition` (081 pendiente) |
| Columna `purchase_order_id` en assets | **No** (076 la añade nullable) |

### Impacto en `KSK-0001`

Las migraciones 076–082 **no** renumeran, no borran y no cambian el `asset_code` existente.  
081 solo amplía el CHECK de status (incluye `warehouse` actual) y crea historial.  
082 solo cambia el append de notas en `set_status`.  
076 añade `purchase_order_id` nullable si falta.

---

## 4. Migraciones exactas a aplicar en producción

**Orden obligatorio:**

1. `076_platform_suppliers_and_kiosk_purchases_v1.sql`
2. `077_supplier_quote_po_workflow_v1.sql`
3. `078_supplier_po_shipping_vat_flag_v1.sql`
4. `079_unify_supplier_purchase_kiosk_extension_v1.sql`
5. `080_supplier_po_annual_numbering_v1.sql`
6. `081_kiosk_inventory_ui_statuses_v1.sql`
7. `082_kiosk_status_notes_append_v1.sql`

### Excluir expresamente

- `079_STAGING_REMEDIATE_chino_duplicates.sql` — **solo staging**, UUIDs de staging, **NO producción**.
- Cualquier seed DEMO (`staging-seed-demo-quote-compare.mjs`, filas `[DEMO]`).
- Scripts de smoke que escriben en staging.

### Dependencia previa

- **065** ya está en producción (confirmado). El bloque condicional de 076 añadirá `kiosk_assets.purchase_order_id`.

### Staging (referencia)

076–082 + exhibition + append notes: **presentes**. Smokes 2026-11-11 OK.

---

## 5. Tests ejecutados en esta preparación

### Automáticos (worktree)

```text
node --experimental-strip-types --test lib/suppliers/*.test.ts lib/kiosk-inventory/purchase-types.test.ts
→ 43 pass / 0 fail
```

Incluye: `purchase-math`, `po-number`, `quote-compare`, `quote-pdf-extract`, `unify-purchase`, `workflow`, `types`, `purchase-types`.

### Staging (escritura solo staging, guardrail anti-prod)

| Script | Resultado |
|--------|-----------|
| `staging-suppliers-smoke.mjs` | ALL PASSED (CRUD SA, RLS deny, storage policies) |
| `staging-kiosk-inventory-status-smoke.mjs` | OK (pendientes → recepción → exhibition → auditoría) |

### Pendientes manuales UI (recomendados en ventana post-deploy)

Ver checklist §7.

---

## 6. Secuencia de publicación (cuando se autorice)

### A. Backup verificable (antes de cualquier SQL)

1. Snapshot/backup del proyecto Supabase producción `gsnohwsvjxpjfcsstnfd` (panel).
2. Dump dirigido mínimo:
   - `public.kiosk_assets` (fila `KSK-0001`)
   - `public.kiosk_asset_code_seq`
   - defs: `ff_kiosk_inventory_set_status_v1`, `ff_kiosk_asset_next_code`
3. Guardar en `supabase/diagnostics/pre_076_prod_<timestamp>/` con:
   - conteos pre
   - `SELECT * FROM kiosk_assets WHERE asset_code='KSK-0001'`
   - hash/nombre del snapshot
4. Anotar **deployment Vercel Production** actual (commit `main`) para rollback web.

### B. SQL producción (orden §4)

1. Aplicar **076** → verify tablas/permisos/buckets.
2. **077** → verify.
3. **078** → verify.
4. **079** → verify (sin STAGING_REMEDIATE).
5. **080** → verify counters + RPC confirm.
6. **081** → verify CHECK incluye `exhibition` + `kiosk_asset_status_events`; **`KSK-0001` sigue igual**.
7. **082** → verify `set_status` append notes.
8. Re-check: `KSK-0001` intacto; seq ≥ 1; sin filas DEMO.

> Preferido: **migraciones antes del merge**. El `main` actual no usa esas tablas; el SQL queda inerte hasta el deploy.

### C. Merge + deploy

1. Merge **solo** PR #21 → `main` (squash o merge commit según política).
2. **No** incluir #22 ni #23.
3. Esperar deploy Vercel `farmafacil-app` (y preview inventario si aplica).
4. Verificar env Production: **sin** `OPENAI_API_KEY`.

### D. Smoke post-despliegue producción

1. Login SuperAdmin.
2. `/proveedores` carga; soporte no ve el ítem.
3. Alta proveedor borrador + presupuesto manual (sin IA).
4. Confirmar pedido → número `2026/00000001` (o año vigente).
5. Pedido categoría kioskos → extensión con mismo número.
6. **No** recibir sobre `KSK-0001`; si se prueba recepción, 1 ud laboratorio → debe crear **`KSK-0002`**.
7. Inventario: ver `KSK-0001` warehouse; cambiar a **En exposición** y volver; notas se anexan.
8. Pegatina de `KSK-0001` genera sin error.
9. Intento lectura PDF IA → mensaje “falta OPENAI_API_KEY” / cumplimentar a mano.
10. Sin regresión pairing / farmacias / pedidos QR.

### E. Recuperación ante errores

| Fallo | Acción |
|-------|--------|
| Build/deploy web | Rollback Vercel al deployment anotado en §A.4 |
| SQL a medias (p. ej. falla 080) | No continuar; aplicar `080_ROLLBACK.md`… hacia atrás según lo aplicado; restaurar snapshot si el estado es dudoso |
| 081/082 mal | `082_ROLLBACK.md` / `081_ROLLBACK.md` — **no borran KSK**; si hay filas `exhibition`, pasarlas a `warehouse` antes de quitar el CHECK |
| 076 completo a revertir | `076_ROLLBACK.md` (DROP tablas nuevas) — solo si no hay datos de negocio que conservar |
| UI rota con SQL OK | Rollback Vercel; dejar SQL (tablas inocuas) o revertir SQL si se decide abortar el módulo |
| Recepción duplicada | RPC ya protege `exceeds_remaining` / unique serial |

---

## 7. Checklist de pruebas

### Pre-merge (hecho / staging)

- [x] Unit tests módulo proveedores/inventario
- [x] Smoke RLS + CRUD proveedores staging
- [x] Smoke recepción + exhibition staging
- [x] Preflight prod: 065 sí / 076–082 no / `KSK-0001` intacto
- [x] Confirmado exclusión STAGING_REMEDIATE y DEMO
- [x] Confirmado no mezclar #22/#23
- [x] IA PDF gated por ausencia de `OPENAI_API_KEY`

### Post-deploy producción (pendiente autorización)

- [ ] Backup verificado
- [ ] 076→082 aplicadas y verified
- [ ] `KSK-0001` sin cambios de código/serial/status indebido
- [ ] Menú SA Proveedores OK
- [ ] Flujo presupuesto → pedido → número
- [ ] Extensión kiosk + (opcional) recepción → `KSK-0002`
- [ ] Estado En exposición + historial/notas
- [ ] Pegatina
- [ ] IA PDF sigue desactivada
- [ ] Sin datos DEMO en prod

---

## 8. Recomendación final

| Pregunta | Respuesta |
|----------|-----------|
| ¿Se puede publicar ya sin más desarrollo? | **Sí, con ventana controlada** |
| ¿Ejecutar merge/SQL/deploy ahora? | **NO** — esperar autorización expresa |
| ¿Qué autorizar exactamente? | Backup → SQL 076–082 (sin REMEDIATE) → merge PR #21 → smoke → sin OPENAI |

Siguiente mensaje esperado del operador: **«Autorizo publicación PR #21»** (o equivalente), tras revisar este informe.
