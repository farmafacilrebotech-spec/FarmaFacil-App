# Resultados — `staging_pharmacy_identity_rls_v1.sql` (staging)

**Fecha:** 2026-11-11  
**Proyecto:** `dazfdcjscnpfvhcyjddt`  
**SQL aplicado:** sí (idempotente; incluye corrección bypass `service_role` sin `current_user`)  
**Prod espejo:** **no** aplicado

## Incidencia durante apply

1. Primer smoke falló porque restores con `service_role` quedaban bloqueados por el trigger.  
2. Bypass con `current_user IN ('postgres',…)` era incorrecto en `SECURITY DEFINER` (siempre el owner) y abría el hueco a todos.  
3. **Fix final:** bypass únicamente si `auth.role() = 'service_role'`. Re-aplicado y re-verificado.

## Smoke identidad

| Actor | `pharmacies.*` | `logo_url` | `visible_name` |
|-------|----------------|------------|----------------|
| SuperAdmin | ALLOW | ALLOW | ALLOW |
| Owner | DENY | DENY (trigger) | DENY (trigger) |
| Admin | DENY | DENY | DENY |
| Farmacéutico | DENY | DENY (RLS 0 filas) | DENY (trigger) |
| STAFF | DENY | DENY | DENY |

## Operativo conservado

| Prueba | Resultado |
|--------|-----------|
| Owner `pharmacy_settings.schedule` | PASS |
| Owner `pharmacy_branding.primary_color` | PASS |
| Farmacéutico `schedule` + assistant upsert | PASS |
| Farmacéutico color branding | DENY (sin `branding.update`) |
| STAFF schedule | DENY |
| Policies pedidos/catálogo/stock/assistant presentes | PASS (18 policies spot-check) |

## Logo + cartel

| Prueba | Resultado |
|--------|-----------|
| SA upload Storage `pharmacy-logos` | PASS |
| SA update `logo_url` | PASS |
| Fetch público logo | PASS |
| PDF zonas logo izq / nombre dcha | PASS |
| QR → `https://app.farmafacil.solutions/e/2mo6cq0yjss6ratr` | PASS |

## Readiness PR #23 (staging)

- Storage logos: aplicado + OK  
- Identity RLS: aplicado + OK  
- App SA-gates + UI tenant read-only: OK  
- Pendiente para **publicar**: push commits, visual OK cartel en panel, SQL prod (`prod_pharmacy_identity_rls_v1.sql`) + Storage prod tras autorización, merge/deploy  
- Bloqueante previo PR #21 (backup/PITR) es independiente; publicar #23 después de #21 según plan
