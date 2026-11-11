# PR #21 — Preparación final (sin ejecutar publicación)

Fecha: **2026-11-11** · Sin SQL prod · Sin merge · Sin deploy · Sin tocar #22/#23.

## Resumen ejecutivo

| Ítem | Estado |
|------|--------|
| Backup Supabase Production | **PENDIENTE** (procedimiento listo; captura no hecha) |
| Migraciones 076–082 | **PREPARADAS** (lista exacta; REMEDIATE excluido) |
| Vercel recovery | **IDENTIFICADA** (`78d8871` / deploy GitHub `7674490724`) |
| Datos staging → prod | **Confirmado: no se trasladan** |
| `KSK-0001` / farmacias | **Intactos con el SQL previsto** (preflight previo) |
| `OPENAI_API_KEY` en Vercel Prod | **PENDIENTE de confirmar en dashboard** |

---

## 1. Backup recuperable

### Estado: **PENDIENTE de verificación/captura en ventana**

No se ha generado en esta sesión un snapshot nominado ni un dump local pre-076.  
En planes de pago, Supabase mantiene **backups diarios automáticos** en:

`Supabase Dashboard → Project gsnohwsvjxpjfcsstnfd → Database → Backups`

### Cómo disponer de backup verificable (cuando autorices la ventana)

1. Abrir **Database → Backups** y anotar el backup diario más reciente (timestamp).
2. (Recomendado) Export lógico dirigido a disco local:
   - `kiosk_assets` (fila `KSK-0001`)
   - `kiosk_asset_code_seq`
   - defs `ff_kiosk_inventory_set_status_v1`, `ff_kiosk_asset_next_code`
   - Guardar en `supabase/diagnostics/pre_076_prod_<timestamp>/`
3. Anotar si el proyecto tiene **PITR** (add-on) o solo daily backups.

### Dónde estará

| Artefacto | Ubicación |
|-----------|-----------|
| Daily / PITR | Panel Supabase del proyecto prod |
| Dump dirigido | `supabase/diagnostics/pre_076_prod_<timestamp>/` (crear al autorizar) |

### Cómo restaurar

1. **In-place (Dashboard):** Database → Backups → elegir backup **anterior al apply 076** → Restore (downtime; sobrescribe el estado actual).
2. **Restore to a new project** (preferible para validar): clonar desde backup/PITR, verificar, y solo entonces decidir in-place o recuperación selectiva.
3. **Parcial app:** si solo falla el front, no restaurar DB; rollback Vercel (§2).
4. **Parcial SQL:** usar `*_ROLLBACK.md` 082→076 **antes** de un restore completo, si el fallo es acotado y no hay datos nuevos de proveedores que conservar.

---

## 2. Vercel Production — punto de recuperación

| Campo | Valor |
|-------|--------|
| Proyecto | `farmafacil-app` (`prj_ezYhkMp2xjm2S5NJs1NO5z5mfMLB`) |
| Commit actual en `main` / Production | **`78d8871a9bdbc0a50839654d18d3746ed3829f8e`** |
| Mensaje | `feat(superadmin): cierre pantallas vacías … (#20)` |
| GitHub Deployment ID | **`7674490724`** |
| Environment | `Production – farmafacil-app` |
| Created | 2026-11-10T05:34:28Z |
| Status | success |

**Rollback app:** Vercel Dashboard → Deployments → redeploy/promote el deployment de `78d8871` (o Instant Rollback al deployment de Production previo al merge de #21).

---

## 3. Migraciones exactas

Aplicar **solo** (orden):

1. `076_platform_suppliers_and_kiosk_purchases_v1.sql`
2. `077_supplier_quote_po_workflow_v1.sql`
3. `078_supplier_po_shipping_vat_flag_v1.sql`
4. `079_unify_supplier_purchase_kiosk_extension_v1.sql`
5. `080_supplier_po_annual_numbering_v1.sql`
6. `081_kiosk_inventory_ui_statuses_v1.sql`
7. `082_kiosk_status_notes_append_v1.sql`

**Excluir expresamente:** `079_STAGING_REMEDIATE_chino_duplicates.sql`  
(cabecera: *NO APLICAR en producción*; UUIDs de staging).

065 ya está en prod (dependencia satisfecha).

---

## 4. Sin datos staging → producción

- Las 7 migraciones crean esquema/permisos/RPCs; **no** insertan proveedores, pedidos ni DEMO.
- Seeds/smokes (`staging-seed-demo-quote-compare.mjs`, smokes) tienen guardrail anti-prod y **no** forman parte del publish.
- STAGING_REMEDIATE excluido.

---

## 5. `KSK-0001` y farmacias

Preflight de solo lectura **previo** (misma preparación, no repetido en este paso por tu veto a SQL prod):

- 1 activo: `KSK-0001`, `warehouse`, serial `00000000000589e1c8`, sin farmacia.
- Seq → próximo `KSK-0002`.
- 076–082 no renumeran, no borran assets, no tocan filas de `pharmacies`.
- 081 amplía CHECK de status (sigue permitiendo `warehouse`).
- 076 añade `purchase_order_id` nullable en assets.

---

## 6. Dependencias / `OPENAI_API_KEY` (sin secretos)

| Ámbito | Hallazgo |
|--------|----------|
| Código | Extracción PDF IA falla cerrado si falta la key |
| `.env.local` (máquina) | `OPENAI_API_KEY` **SET** (longitud reportada; valor no mostrado) |
| Vercel Production | **No verificado por API** (sin token Vercel en entorno) → **comprobar en dashboard** que **no** exista `OPENAI_API_KEY` / no añadirla al publicar |

**Política de publicación:** no configurar `OPENAI_API_KEY` en Production.

---

## 7. Smoke post-despliegue (inmediato)

1. Login SuperAdmin → `/proveedores` carga.
2. Alta proveedor + presupuesto **manual** (sin IA).
3. Confirmar pedido → número `YYYY/########`.
4. Pedido categoría kioskos → extensión mismo número.
5. Inventario: `KSK-0001` sigue igual; pegatina OK.
6. (Opcional) Recepción 1 ud laboratorio → crea **`KSK-0002`** (no tocar 0001).
7. Estado **En exposición** + notas append.
8. Intento PDF IA → mensaje de no configurada.
9. Sin regresión farmacias / pairing / pedidos QR.
10. Confirmar cero filas DEMO en tablas nuevas.

---

## 8. Recuperación específica por fallo de migración

| Fallo | Acción |
|-------|--------|
| Error a mitad de 076–082 | **STOP**; no merge/deploy (si aún no); rollback SQL del último archivo aplicado (`082`…`076` ROLLBACK.md) |
| 081/082 mal, assets OK | Rollback 082 luego 081; si hay `exhibition`, pasar a `warehouse` antes de quitar CHECK |
| 076 reversible y sin datos negocio | `076_ROLLBACK.md` (DROP tablas nuevas) |
| Estado dudoso / datos corruptos | Restore Dashboard al backup **pre-076** (o restore-to-new-project + análisis) |
| App mala, DB OK | Rollback Vercel a `78d8871` |
| App + DB mal | Rollback Vercel **y** restore DB pre-076 |

Orden preferido de publicación cuando autorices: **backup → SQL 076–082 + verify (incl. KSK-0001) → merge solo #21 → smoke → sin OPENAI**.

---

## Operaciones que requieren tu autorización expresa

1. Captura/verificación de backup prod (panel + dump dirigido).
2. Aplicar SQL 076→082 en `gsnohwsvjxpjfcsstnfd`.
3. Merge PR #21 → `main`.
4. Deploy Production (automático tras merge o promote).
5. Cualquier rollback DB o Instant Rollback Vercel en incidente.

**Esperando:** «Autorizo publicación PR #21» (o autorización parcial: p. ej. solo backup).
