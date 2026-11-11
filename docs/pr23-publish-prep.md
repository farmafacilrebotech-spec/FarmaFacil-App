# PR #23 — Preparación de publicación (sin ejecutar)

**Fecha auditoría:** 2026-11-11  
**Estado:** ESPERANDO confirmación explícita para SQL prod / push / undraft / merge / deploy.  
**Producción:** `gsnohwsvjxpjfcsstnfd` · **Staging:** `dazfdcjscnpfvhcyjddt`

---

## 1. Estado de ramas y dependencias

| Pieza | Estado |
|-------|--------|
| `origin/main` | `78d8871` (#20) |
| PR #23 | OPEN **DRAFT** · base `main` · head `feature/pharmacy-clients-and-qr` · [URL](https://github.com/farmafacilrebotech-spec/FarmaFacil-App/pull/23) |
| Worktree #23 | `.worktrees/pharmacy-clients-qr` @ `7ea24e1` · **ahead 9** vs remote |
| PR #21 | OPEN · base `main` · `feature/sa-proveedores-kiosk` · worktree `sa-proveedores` |
| PR #22 | OPEN · **base = branch de #21** · `feature/sa-subscription-ui-redesign` |

**Solapamiento de archivos #23 ∩ #21:** solo `package.json` / `package-lock.json` (jspdf + scripts test en #23).  
**Conclusión:** #23 puede publicarse **antes** de #21 sin traer Proveedores. #22 sigue dependiendo de #21 y no se toca.

---

## 2. SQL staging — evidencia real (no presupuesta)

| Artefacto | Staging | Evidencia |
|-----------|---------|-----------|
| Storage `pharmacy-logos` | **APLICADO** | bucket público 2 MB leído vía API; NOTES apply |
| Identity RLS v1 | **APLICADO** | smoke re-ejecutado 2026-11-11 → **ALL PASSED** (`tmp/staging-pharmacy-identity-rls-smoke.json` / rerun log) |
| `customer_profile_id` mínimo (064) | **Presente** | `SELECT customer_profile_id` → HTTP 200 |
| staff_hide RPCs v1/v1b | **NO evidenciadas** | `ff_list_pharmacy_linked_clients_v1` / `ff_pharmacy_can_view_linked_clients` → **404** en staging |
| Identity / Storage en prod | **No aplicados** (docs) | Sondeo live prod **no ejecutado** en esta sesión (requiere OK explícito) |

Smoke identidad (re-run): SA ALLOW name/logo/visible_name; Owner/Admin/Farm/STAFF DENY identidad; Owner schedule + primary_color ALLOW; assistant_settings policy intacta.

---

## 3. Permisos app (código)

- Identidad / logo / visible_name: solo SuperAdmin (actions + triggers staging).
- Ops Owner/Admin: horarios, contactos kiosk, colores branding (conservados).
- Clientes: Owner/Admin/Farmacéutico; STAFF denegado en UI+RSC+tests.
- Aislamiento: membership + `pharmacy_id` / RLS pedidos.
- Residual PostgREST: sin staff_hide v1b, un JWT STAFF con `orders.view` **podría** seguir leyendo `customer_profile_id` fuera de la UI. Mitigación app sí; endurecimiento SQL **pendiente de decisión**.

---

## 4. Cartel / QR

- Diseño aprobado; tipografía/logo OK.
- URL impresión: `https://app.farmafacil.solutions/e/{publicId}` (SA ficha con `publicUrlOverride`).
- `pdfDownloadEnabled: false` en layout; descarga solo con `NEXT_PUBLIC_FF_POSTER_PDF_LOCAL=1`.
- **Antes de merge a prod:** activar `pdfDownloadEnabled: true` (o el cartel no se descargará en producción). No poner el flag local en Vercel prod.

---

## 5. SQL exacto propuesto para producción (orden)

> Ninguno ejecutado. Tras OK explícito:

1. **Preflight read-only** prod (`gsnohwsvjxpjfcsstnfd`): bucket `pharmacy-logos`, columna `logo_url`, triggers identity, `customer_profile_id`, policies `pharmacies_update`.
2. Confirmar **backup/PITR** disponible (límite: sin dump completo, rollback = DOWN scripts + redeploy app; no restore point-in-time garantizado si PITR off).
3. `docs/migrations/prod_pharmacy_logos_storage_v1.sql`
4. `docs/migrations/prod_pharmacy_identity_rls_v1.sql`
5. *(Opcional / recomendado seguridad STAFF)* espejo prod de `staging_staff_hide_customer_profile_id_v1.sql` + `v1b` — **solo si se autoriza**; hoy **no** hay evidencia de apply ni en staging.
6. App: push 9 commits → undraft PR → merge a `main` → deploy (sin mezclar #21/#22).
7. Post-check: SA sube logo, Owner no cambia identidad, cartel PDF con QR canónico, clientes roles.

**Fuera de alcance SQL prod #23:** migraciones 076–082 (#21), cambios suscripción (#22), copia de datos staging→prod, kiosk/pedidos/catálogo/área cliente (no se alteran por estos SQL).

---

## 6. Recuperación

| Pieza | DOWN |
|-------|------|
| Storage logos | `prod_pharmacy_logos_storage_DOWN.sql` (policies+bucket; objetos pueden quedar huérfanos) |
| Identity RLS | `prod_pharmacy_identity_rls_DOWN.sql` (restaura `pharmacies_update` con `settings.update`) |
| App | revert merge / redeploy `main` previo |

**Límite sin backup completo:** DOWN no restaura filas ni logos borrados; no deshace uploads; PITR es la red de seguridad real.

---

## 7. Checks / tests locales

- `npm run test:pharmacy-qr` → 29 PASS  
- `npm run test:pharmacy-clients` → 8 PASS  
- Identity smoke staging → ALL PASSED  
- CI GitHub (remote tip): Vercel preview pass — **no incluye** los 9 commits locales aún sin push  
- Build completo Next: no bloqueante documentado aquí; Preview Vercel OK en remote

---

## 8. Bloqueadores antes de autorizar publish

1. **Push** de 9 commits locales a `origin/feature/pharmacy-clients-and-qr`.
2. Decisión: **`pdfDownloadEnabled: true`** para prod.
3. Decisión: ¿aplicar **staff_hide** en staging (verificar) y luego prod, o aceptar mitigación solo-app?
4. **Preflight prod** read-only autorizado.
5. Confirmación **PITR/backup** prod.
6. Undraft + merge solo tras SQL (o SQL tras merge hot — preferible SQL Storage+identity **antes** del deploy que sube logos).

---

## 9. PR #21 / #22

Quedan **intactas**. No merge, no SQL 076+, no cambio de bases. Orden posterior acordado: verificar #23 en prod → luego #21 → luego #22.
