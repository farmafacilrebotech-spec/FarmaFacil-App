# PR #23 — Informe final de preparación (sin ejecutar)

**Fecha:** 2026-11-12  
**Actualización 12/11/2026:** follow-up logos listado **publicado** vía **PR #26** → `main` `5d61f8b` · Vercel Production Ready · https://app.farmafacil.solutions · **sin SQL/migraciones** · sin Emails (#25).  
**Veredicto histórico:** **GO condicionado** a (1) aterrizar el follow-up de logos en listado, (2) confirmar backup recuperable, (3) tu autorización explícita de SQL prod + deploy.  
**No ejecutado en esta sesión (histórico):** SQL producción · copia staging→prod.

---

## 0. Situación de código

| Pieza | Estado |
|-------|--------|
| PR #23 (`feature/pharmacy-clients-and-qr`) | **Ya fusionada en `origin/main`** (`da03582`) |
| `main` posterior | También incluye #21, #22, #24 (planes comerciales) |
| Gap visual residual | Listado `/farmacias` (y dashboard) **no pasaban `logoUrl`** → corregido en worktree (pendiente commit/PR follow-up) |
| Worktree | `.worktrees/pharmacy-clients-qr` @ `e2a3d43` + cambios locales de listado |

**Implicación:** la “publicación de PR #23” es en la práctica **deploy de `main` (o cherry-pick del follow-up de logos) + SQL prod pendiente**, no un merge de la PR abierta.

---

## 1. Follow-up logos (este ajuste)

- `listPharmacies` une `pharmacy_branding.logo_url`.
- `PharmaciesTable` + dashboard usan `PharmacyLogo` con `logoUrl`.
- Fallback iniciales si falta logo o falla la imagen; `object-contain`.
- `revalidatePath('/farmacias')` y `/dashboard` en upload/remove.
- Permisos: sin cambio — solo SA (`platform.pharmacies.write`).

Docs: `docs/pharmacies/MANUAL_LOGOS_FARMACIA.md`, `docs/pharmacies/PRUEBAS_LOGOS_LISTADO.md`.

---

## 2. Dependencias y conflictos con main

| Tema | Notas |
|------|-------|
| Solape histórico #23 ∩ #21 | Solo `package.json` / lock (jspdf) — ya resuelto en merges a main |
| #22 | Ya en main |
| #24 planes | Ya en main — **revisar en el mismo deploy** si se publica `main` completo |
| Emails PR #25 | Rama aparte; **no** mezclar |

Recomendación: publicar el follow-up de logos como PR pequeña sobre `main` actual, o incluirlo en el próximo deploy de `main` tras merge del follow-up.

---

## 3. Migraciones / Storage / RLS (producción)

Preflight solo lectura previo (`tmp/prod-pr23-preflight-readonly.json`, proyecto `gsnohwsvjxpjfcsstnfd`):

| Objeto | Prod |
|--------|------|
| Columna `pharmacy_branding.logo_url` | Existe |
| Bucket `pharmacy-logos` | **Ausente** |
| Policies Storage logos | **Ausentes** |
| Triggers/fns identity SA | **Ausentes** |
| `pharmacies_update` | Aún con `settings.update` (pre-identity) |
| staff_hide RPCs | **Ausentes** |
| `customer_profile_id` | Existe (SELECT aún amplio) |

### Orden SQL propuesto (solo tras OK explícito)

1. `docs/migrations/prod_pharmacy_logos_storage_v1.sql`  
2. `docs/migrations/prod_pharmacy_identity_rls_v1.sql`  
3. `docs/migrations/prod_staff_hide_customer_profile_id_v1.sql`  
4. `docs/migrations/prod_staff_hide_customer_profile_id_v1b.sql`  
5. `docs/migrations/prod_staff_hide_customer_profile_id_v1c.sql`  
6. Deploy app (con follow-up logos + cartel `pdfDownloadEnabled: true` ya en rama mergeada)  
7. Post-check: SA logo en ficha **y listado**; Owner DENY identidad; STAFF DENY cpi; cartel QR.

**DOWN emergencia:**  
`prod_staff_hide_customer_profile_id_DOWN.sql` → `prod_pharmacy_identity_rls_DOWN.sql` → `prod_pharmacy_logos_storage_DOWN.sql` → revert deploy.

**Prohibido:** copiar datos de staging a producción.

---

## 4. Copia de seguridad recuperable — estado

| Pregunta | Respuesta |
|----------|-----------|
| ¿Existe dump completo / restore point documentado en repo? | **No** |
| ¿PITR Supabase confirmado en esta sesión? | **No verificado** (no se ha consultado el panel de billing/backups) |
| Decisión previa documentada | GO/NO-GO aceptó publicar **sin backup completo** (datos de prueba) con rollback = DOWN + redeploy |
| ¿Es seguro afirmar “copia recuperable”? | **No**, hasta que confirmes en Supabase Dashboard (Proyecto prod → Database → Backups / PITR) o un dump externo |

**Bloqueante blando:** si exiges copia recuperable antes de SQL, confirma PITR o haz un backup manual **antes** de autorizar el paso 1.

---

## 5. Checklist autorización final (responde GO por ítem)

- [ ] Confirmar backup/PITR prod recuperable **o** aceptar riesgo DOWN-only  
- [x] Merge/push del follow-up logos listado → **PR #26** merged `5d61f8b` (12/11/2026)  
- [ ] Ejecutar SQL prod 1→5 *(no requerido para logos listado)*  
- [x] Deploy app (Vercel `main`) → Production Ready  
- [x] Post-check listado + ficha + permisos (logos) — sin mutar datos  
- [x] No mezclar Emails (#25) ni Cartera no autorizada  


---

## 6. Rollback (procedimiento)

1. Revertir deploy a commit previo de `main`.  
2. Aplicar scripts DOWN en orden inverso (arriba).  
3. Si hay PITR: restore al timestamp previo al SQL.  
4. DOWN **no** recupera objetos Storage ya borrados ni filas alteradas fuera de policies.
