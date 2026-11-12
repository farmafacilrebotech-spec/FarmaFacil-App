# PR #23 — Informe GO/NO-GO (pre-publicación)

**Fecha:** 2026-11-11  
**Veredicto:** **GO condicionado** a tu autorización final de SQL prod + undraft/merge/deploy.  
**No ejecutado:** SQL prod · merge · deploy.  
**PR #21 / #22:** intactas.

---

## Decisiones aplicadas en esta preparación

1. Push de commits a `feature/pharmacy-clients-and-qr` (mantener DRAFT).  
2. `pdfDownloadEnabled: true` (sin depender del flag local).  
3. staff_hide cerrado en **staging** (v1+v1b+v1c) con smoke real.  
4. Preflight **solo lectura** prod `gsnohwsvjxpjfcsstnfd`.  
5. Publicar sin backup completo (datos de prueba) — aceptado por ti.  
6. #21/#22 sin tocar.

---

## Evidencia staging

| Control | Resultado |
|---------|-----------|
| Identity RLS smoke | ALL PASSED (re-run previo) |
| staff_hide v1+v1b+v1c apply | OK |
| staff_hide smoke | ALL PASSED (STAFF DENY cpi; Owner/Admin/Farm RPC OK; cliente RPC OK) |
| Pedidos STAFF (select ops sin cpi) | OK |
| `pdfDownloadEnabled` | `true` + tests layout |
| `test:pharmacy-qr` / `test:pharmacy-clients` | PASS (tras cambios) |

---

## Preflight producción (solo lectura)

| Objeto | Estado prod |
|--------|-------------|
| Proyecto | `gsnohwsvjxpjfcsstnfd` ✓ |
| `pharmacy_branding.logo_url` | Existe |
| `pharmacy_orders.customer_profile_id` | Existe |
| Bucket `pharmacy-logos` | **Ausente** |
| Policies Storage logos | **Ausentes** |
| Triggers/fns identity | **Ausentes** |
| `pharmacies_update` | Aún permite `settings.update` (pre-PR23) |
| staff_hide RPCs | **Ausentes** |
| `authenticated` SELECT cpi / tabla orders | **Sí** (sin endurecer) |
| `profiles.account_kind` | Existe |
| `_ff_staging_recovery_log` | No existe (prod SQL sin usarla) |

---

## SQL exacto a ejecutar en prod (orden)

> Solo tras tu **autorización final**. Preferible sesión directa / SQL editor sobre `gsnohwsvjxpjfcsstnfd`.

1. `docs/migrations/prod_pharmacy_logos_storage_v1.sql`  
2. `docs/migrations/prod_pharmacy_identity_rls_v1.sql`  
3. `docs/migrations/prod_staff_hide_customer_profile_id_v1.sql`  
4. `docs/migrations/prod_staff_hide_customer_profile_id_v1b.sql`  
5. `docs/migrations/prod_staff_hide_customer_profile_id_v1c.sql`  
6. Undraft + merge PR #23 → deploy app (con tipografía/cartel/`pdfDownloadEnabled`/RPC cliente).  
7. Post-check: SA logo; Owner DENY identidad; STAFF DENY cpi; Owner/Admin/Farm clientes; cartel QR canónico; área cliente pedidos.

**DOWN (emergencia):**  
`prod_staff_hide_customer_profile_id_DOWN.sql` → `prod_pharmacy_identity_rls_DOWN.sql` → `prod_pharmacy_logos_storage_DOWN.sql` → revert app.

**Límite sin Pro/PITR:** DOWN no recupera objetos Storage ni filas; no hay restore point garantizado.

**No incluyen:** migraciones #21 (076+), #22, copia de datos staging.

---

## Conflictos / dependencias

- Solape #23∩#21: solo `package.json` / lock (jspdf). Publicar #23 primero es seguro.  
- #22 base = branch #21 → no afectada.  
- staff_hide exige v1c + cambio app `listCustomerOrders` (ya en rama).

---

## Riesgos residuales

- Sin PITR: rollback manual vía DOWN + redeploy.  
- Staging sin `account_kind`: gate cliente en app puede fallar ahí; **prod sí tiene** la columna.  
- Tras merge, Vercel no debe definir `NEXT_PUBLIC_FF_POSTER_PDF_LOCAL` (ya no es necesario).

---

## Checklist autorización final (responde GO)

- [ ] Ejecutar SQL prod 1→5  
- [ ] Undraft PR #23  
- [ ] Merge a `main` + deploy  
- [ ] Verificar en prod real  
- [ ] Luego continuar con PR #21 → #22  
