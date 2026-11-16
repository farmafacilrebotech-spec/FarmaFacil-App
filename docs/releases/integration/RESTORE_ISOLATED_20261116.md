# Restauración aislada del dump staging — 2026-11-16

## A) Validación de archivo (sin restaurar)

| Check | Resultado |
|-------|-----------|
| Formato | PostgreSQL custom dump v1.16-0 (gzip) |
| Tamaño | ~1.1 MB |
| `pg_restore -l` | TOC 1561 entradas, sin error |
| SHA-256 | `56a4994d87792d4e27fc4e1e1886b2feac34694077ad8760099f95b567f99ad3` |
| TABLE DATA | 79 |
| FUNCTION | ~397 entradas TOC |

**Conclusión A:** el archivo es un dump custom íntegro y listable.

## B) Restauración efectiva (Docker aislado)

Entorno: `postgres:16-alpine` en contenedor `ff-staging-restore-iso`, puerto `55432`, DB `ff_staging_restore`.  
Roles stub: `anon`, `authenticated`, `service_role` + schema `auth.uid()`.

| Check post-restore | Resultado |
|--------------------|-----------|
| Tablas `public` | **79** |
| Funciones `public` | **153** |
| `ff_order_linked_to_auth_uid` (098) | **true** |
| Trigger `trg_pharmacy_branding_identity` (099) | **true** |
| `commercial_contracts` (097) | **false** (097 se aplicó en staging **después** de este dump) |
| Filas `pharmacies` | 7 |
| Contenedor | destruido tras verificación |

`pg_restore` exit 1 con warnings (ACL/`transaction_timeout`/policies a roles Supabase); **objetos de negocio restaurados**.

**Conclusión B:** el dump **sí se puede restaurar de forma efectiva** en Postgres aislado. No equivale a un clon 1:1 de staging actual (falta 097 post-dump y ecosistema auth completo).

Evidencias: AgentStores `e2e-evidence-20261116-8961c23/restore-isolated/`.
