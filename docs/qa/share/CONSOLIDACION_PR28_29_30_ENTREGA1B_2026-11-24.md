# Consolidación PR #28 / #29 / #30 + ENTREGA 1B

**Fecha:** 2026-11-24  
**Merges:** **no** (solo checklist y orden).  
**Avisos recogida:** no abrir rama; orden E2→E1→E3 (E4 opcional) permanece en propuesta.

## Estado actual

| PR | Base | Mergeable | Bloqueo CI | URL |
|----|------|-----------|------------|-----|
| **#28** QA block1 | `integration/farmafacil-release` | MERGEABLE | **Playwright full FAILURE** | https://github.com/farmafacilrebotech-spec/FarmaFacil-App/pull/28 |
| **#29** Entrega1 Fase 0 | `fix/qa-2026-11-23-block1` (#28) | MERGEABLE | Vercel OK | https://github.com/farmafacilrebotech-spec/FarmaFacil-App/pull/29 |
| **#30** Catálogo Fase B | **`main`** | MERGEABLE | **Vercel FAILURE** (app + kiosk) | https://github.com/farmafacilrebotech-spec/FarmaFacil-App/pull/30 |

## Orden de integración propuesto (sin merge hoy)

```
1) #28  →  integration   (desbloquear Playwright)
2) #29  →  #28 / integration   (stack ya correcto)
3) Retarget #30: main → integration (o rebase sobre #29)
4) #30  →  integration   tras 089/090 auth + CI verde
```

**No** merge a `main` de #30 mientras base sea `main` y falte cadena 089/090 + deuda 079/083.

## Checklist validación conjunta

### Seguridad / pedidos (transversal)

- [x] Staging: claim phone **fail-closed** (P0 aplicado 2026-11-24)
- [ ] Prod: apply P0 — **pendiente autorización específica**
- [x] Staging: RPCs create/status presentes; conteos 125/50/176 invariantes
- [ ] E2E manual pedido: crear → preparar → consulta titular → entrega (staging, sin claim-by-phone)

### #28

- [ ] Re-run / fix **Playwright full**
- [ ] Preview Vercel OK (ya)
- [ ] Pack SA / permisos / datos staging sin regresiones

### #29 (ENTREGA 1 cierre técnico)

- [ ] PDF / emails staging / pack ACL revisados en preview
- [ ] Draft `106_visible_name_…` no choca con 089/090 (reservado)
- [ ] E2E subset verde tras merge de #28

### #30 + ENTREGA 1B rendimiento

- [x] Unit: `test:product-import` / taxonomy / master-catalog (sesión previa)
- [x] Perf CPU sintético 100…20k (`PERF_CATALOG_SYNTHETIC_2026-11-24.md`)
- [x] Smoke BD real `:54532` — import/idempotencia/dup/equiv/revert/RLS/stock/**500 filas en 57 ms**
- [ ] Fix **Vercel build** #30
- [ ] Retarget base fuera de `main` aislado
- [ ] Auth apply **089/090** staging (separada; no hoy)
- [ ] Preview E2E import wizard contra staging **con** 089/090

### Fuera de alcance ahora

- Rama avisos recogida (E2 token → E1 phone → E3)
- Merges
- APK
- Migraciones staging distintas de P0 claim
- Cualquier write prod

## ENTREGA 1B — cierre técnico rendimiento

| Capa | Evidencia | Estado |
|------|-----------|--------|
| Validación/plan CPU | PERF sintético ≤ ~5 ms @ 20k | **OK** |
| Escritura BD batch 500 | smoke `:54532` **57 ms**, 0 errores | **OK** |
| Histórico 1-insert staging | ~4,5 min @ 2k (referencia; mitigado por lotes×100) | Documentado |
| Latencia PostgREST/Vercel↔Supabase | No medida en preview con 089/090 | **Pendiente** post-auth staging |

## Decisiones pendientes

1. **Autorizar P0 fail-closed en producción** (`P0_disable_claim_order_by_phone_PROD_CANDIDATE.sql`).
2. Autorizar higiene migraciones (mover `079_STAGING_*`, script local 083) — ver `MIGRATION_DEBT_…`.
3. Autorizar apply 089/090 en staging tras #28/#29 estables.
4. Retarget #30 → integration / rebase #29.
5. Cuándo abrir rama avisos (solo tras E2 diseño OK; **no ahora**).
