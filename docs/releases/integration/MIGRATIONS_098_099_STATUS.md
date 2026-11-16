# Estado migraciones 098 / 099 (staging 2026-11-16)

Proyecto: `dazfdcjscnpfvhcyjddt`. **No reaplicar a ciegas.**

## Resumen

| Migración | En repo | Objetos en staging | Acción |
|-----------|---------|--------------------|--------|
| 097 contracts | sí | tabla `commercial_contracts` + recovery log | Ya aplicada (2026-11-16) |
| 098 CLI branding/orders | sí | funciones + policy presentes | **Reconciliada por contenido** (SQL CLI previo). No reaplicar salvo entorno nuevo. |
| 099 identity SA-only | sí | triggers + funciones enforce presentes | **Reconciliada por contenido** (SQL staging identity). No reaplicar salvo entorno nuevo. |

## 098 — dependencias y equivalencia

Depende de: 044, 064, 067, 071, 072, staff_hide v1/v1b/v1c.

Verificado en staging:

- `ff_order_linked_to_auth_uid` existe
- `ff_list_my_customer_orders_v1` incluye `pharmacyName`
- `ff_resolve_public_entrypoint_v1` incluye `visible_name` + `logo_url`
- `ff_customer_list_saved_pharmacies_v1` incluye `saved_at`
- policy `pharmacy_order_items_select_own_customer` existe
- recovery log `verify_098_cli_already_present`

Conclusión: el SQL manual CLI ya dejó el esquema en el estado de 098. La migración oficial sirve para **reproducción en DB nueva / baseline**, no requiere reaplicación destructiva ahora.

## 099 — dependencias y equivalencia

Depende de helpers `ff_has_platform_permission` / `platform.pharmacies.write`.

Verificado:

- `trg_pharmacy_branding_identity`
- `trg_pharmacy_settings_identity`
- `ff_enforce_pharmacy_branding_identity`

## Reconstrucción reproducible

- Existe dump recuperable: `integration-backups-20261116/staging/public_full.dump` + `schema_public_auth.sql` + `data_critical.sql`.
- No existe `supabase_migrations.schema_migrations` de app → el historial numerado **no** es la fuente de verdad operativa; lo son los objetos + recovery log + dumps.
- Una DB vacía necesita baseline histórico (pre-089) + cola 089–099; documentado como requisito de baseline, no como “marcar aplicadas”.

## Funcionalidades vs esquema

Cliente/QR/pedidos/contratos/identidad: esquema necesario **presente** en staging.
