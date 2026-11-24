# P0 — Auditoría solo lectura `ff_customer_claim_order_v1` (producción)

**Fecha:** 2026-11-24T21:13Z  
**Entorno:** producción `gsnohw…`  
**Alcance:** SELECT de catálogo/pg_proc/agregados. **Sin** pruebas de apropiación. **Sin** DML/DDL.

## Hallazgos

| Ítem | Resultado |
|------|-----------|
| Función existe | **Sí** |
| Cuerpo | Match por teléfono activo (`phone_mismatch` / update linkage) — **vulnerable** |
| Fail-closed staging | **No** replicado en prod |
| Grants EXECUTE | `authenticated`, `postgres`, `service_role` · **anon ausente** |
| Pedidos (agregado) | unlinked_with_phone=**6** · linked=**1** · total=**26** |
| `pg_stat_user_functions` | calls=**0** para esta función (no evidencia positiva de uso; tampoco prueba ausencia histórica) |
| Evidencia de uso indebido | **No** encontrada en registros disponibles |

Definición capturada (solo lectura):  
`docs/qa/share/backups/prod_claim_order_def_20261124T211340Z.sql`

## Corrección urgente preparada (NO aplicada)

Archivo local: `supabase/proposed/P0_disable_claim_order_by_phone_PROD_CANDIDATE.sql`  
Misma lógica fail-closed que staging: cuerpo → `status=disabled`; revoke `anon`; sin DELETE de pedidos/teléfonos.

### Solicitud de autorización (pendiente)

Se solicita **autorización explícita y específica** para aplicar en producción **únicamente** ese candidato P0, con el mismo protocolo que staging:

1. Backup def + grants previo.
2. Apply del candidato.
3. Verificación RPC → `disabled`.
4. Conteos pedidos invariantes.
5. Sin otras migraciones.

Hasta esa autorización: **producción permanece vulnerable**; staging ya está contenida.

## Recuperación segura (post-apply futuro)

Igual que staging: **no** restaurar la definición BEFORE (reabre phone-match). Mantener fail-closed hasta E2 token claim.
