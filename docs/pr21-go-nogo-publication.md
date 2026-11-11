# PR #21 — Informe de publicación (validación previa)

Fecha: 2026-11-10 · Branch `feature/sa-proveedores-kiosk` · **Sin merge / sin deploy**.

## Veredicto

### **NO-GO para publicar en producción ahora**

Motivos principales:

1. **Producción no tiene 076–080** (módulo Proveedores / pedidos / numeración / extensión kiosk).
2. Publicar el código de la PR sin esas migraciones rompería `/proveedores` y las RPCs nuevas.
3. Hace falta un plan de despliegue **staging-green → backup prod → migraciones 076→080 → smoke** con ventana y autorización explícita.

### **GO condicional de staging (circuito recepción)**

Staging ha quedado validado para el circuito completo de recepción DEMO tras aplicar **065**.

---

## 1. Estado de migraciones

| Migración | Staging `dazfdcjscnpfvhcyjddt` | Producción `gsnohwsvjxpjfcsstnfd` |
|-----------|--------------------------------|-----------------------------------|
| **065** inventario físico (`kiosk_assets`) | **Aplicada 2026-11-10** (esta validación) | **Presente** |
| **076** proveedores + compras kiosk | Presente | **Ausente** |
| **077** workflow quote/PO + `client_request_id` | Presente | **Ausente** |
| **078** `shipping_includes_vat` | Presente | **Ausente** |
| **079** unificación extensión 1:1 | Presente | **Ausente** |
| **080** numeración anual + confirm RPC | Presente | **Ausente** |

### Dependencias / orden

**Staging (hecho):** 076–080 primero (histórico) → **065 después** → enlace `kiosk_assets.purchase_order_id` (bloque condicional de 076).

**Producción (futuro, no ejecutado):**

1. Backup DB producción.
2. **076 → 077 → 078 → 079 → 080** (065 ya existe).
3. Verificar que el bloque condicional de 076 añade `purchase_order_id` (065 ya está).
4. Smoke SuperAdmin: directorio → presupuesto → pedido → confirmación número → extensión kiosk → recepción.
5. **No** llevar seeds DEMO.

---

## 2. Backup y rollback (staging 065)

- Metadatos pre-apply: `/tmp/ff-staging-065-prebackup.json` (conteos; no dump completo).
- Notas: `supabase/migrations/065_STAGING_APPLY_NOTES.md`
- Rollback: `supabase/migrations/065_STAGING_ROLLBACK.md`  
  **No ejecutar** si se quieren conservar los 10 activos DEMO `KSK-0001…0010`.

Rollback 080: `supabase/migrations/080_ROLLBACK.md` (no borra números ya asignados).

---

## 3. Prueba DEMO recepción (staging) — RESULTADO OK

Flujo ejecutado solo con datos `[DEMO]` / `DEMO-PR21-*`:

| Paso | Resultado |
|------|-----------|
| Presupuesto 10 kioskos | OK (`[DEMO] Compra 10 kioskos recepción`) |
| Aceptar presupuesto | OK (`aprobado`) |
| Pedido único categoría kioskos | OK |
| Confirmar + número | **`2026/00000003`** |
| Extensión «Compras de kioskos» mismo nº | OK |
| Recepción 10 uds | OK → **10 activos** `KSK-0001`…`KSK-0010` |
| Reintento recepción | `exceeds_remaining` · **sigue en 10** (sin duplicar) |
| Estado extensión | `recibido` 10/10 |
| Asignación a farmacias | **0** (ninguna) |
| Receipts | 1 |

IDs de referencia (staging): ver `/tmp/ff-demo-kiosk-recv.json`.

---

## 4. Pedidos históricos en «Pedido» con número «—»

En staging (tras 080):

- `pedido` con número: **1+** (p. ej. DEMO confirmados).
- `pedido` **sin** número: **2** filas legacy (creadas el 2026-11-10 antes de la confirmación RPC), títulos aprox. «Nueva línea» / «El pedido completo».

### Tratamiento seguro propuesto (sin inventar historia)

1. **No auto-renumerar** en silencio.
2. UI: mostrar «Sin número (legacy)» + UUID interno.
3. Acción opcional SuperAdmin «Asignar número correlativo» que llame a `ff_supplier_po_confirm_v1` **una sola vez** (la RPC ya permite legacy `pedido` sin número y es idempotente si ya tiene número).
4. Usar `ordered_at` existente o `created_at::date` como fecha de numeración.
5. Documentar cada asignación en `platform_supplier_activity` / audit.
6. **Producción:** al desplegar 080, los pedidos nuevos nacerán bien; no habrá backfill automático.

---

## 5. Riesgos permisos / RLS

- Proveedores: `platform.suppliers.read/write` (+ approve en flujo).
- Inventario: `platform.kiosk_inventory.read/write` (065).
- Purchasing: `platform.kiosk_purchasing.*` (076).
- Recepción: inventory.write **o** purchasing.write.
- Storage privado `supplier-docs` / `kiosk-purchase-docs`.
- SECURITY DEFINER RPCs con `auth.uid()` + `ff_has_platform_permission`.

En prod, hasta aplicar 076, las tablas/permisos de proveedores **no existen**.

---

## 6. Datos DEMO

- Identificados: `tax_id DEMO-PR21-*`, títulos `[DEMO]…`, notas `DEMO-PR21-COMPARE`.
- **No se incluyen en migraciones** ni en el código de deploy.
- Limpieza: `docs/pr21-demo-quote-compare-cleanup.md` (+ borrar activos DEMO / pedidos DEMO bajo autorización).
- **Confirmado:** no trasladar DEMO a producción.

---

## 7. Pruebas

### Automáticas (repo)

- `purchase-math`, `po-number`, `quote-compare`, `unify-purchase`, workflow/types: OK en CI local previa.

### Manuales staging pendientes / recomendadas antes de GO prod

- [ ] UI recepción desde panel (además del RPC SQL ya OK).
- [ ] Doble clic confirmar pedido en UI.
- [ ] Comparador con ofertas DEMO merchandising.
- [ ] Pedido no-kiosk con número + edición sin cambiar número.
- [ ] Verificar pedidos legacy «—» en UI.
- [ ] Smoke post-076 en **staging clon/prod-like** si se quiere ensayo del orden prod.

### Smoke post-despliegue producción (cuando se autorice)

1. Login SuperAdmin.
2. `/proveedores` carga.
3. Alta borrador → confirmar → ver `YYYY/########`.
4. Categoría kioskos → aparece extensión con mismo número.
5. Recepción 1 ud DEMO/laboratorio → 1 `KSK-…` (sin farmacia).
6. Comparador abre sin error.
7. Sin regresión pairing / `pharmacy_devices`.

---

## 8. Recomendación

| Ámbito | Decisión |
|--------|----------|
| Cerrar trabajo funcional PR #21 en staging | **GO** (comparador, pedidos, numeración, recepción DEMO OK, inventario estados 081 DEMO OK) |
| Merge a `main` / deploy producción | **NO-GO** hasta plan de migraciones 076–080 en prod + backup + smoke |
| Aplicar más SQL en producción ahora | **NO** |

Siguiente paso cuando se autorice publicación: checklist de migraciones prod (076→080), ventana, backup, smoke; opcional backfill controlado de pedidos legacy sin número **solo tras decisión explícita**.
