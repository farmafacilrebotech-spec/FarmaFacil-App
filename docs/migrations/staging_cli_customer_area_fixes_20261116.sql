-- =============================================================================
-- STAGING ONLY — correcciones área cliente / pedidos (2026-11-16)
-- Proyecto: dazfdcjscnpfvhcyjddt
-- NO aplicar en producción sin autorización.
--
-- Cubre:
--   CLI-03  listado Mis farmacias (saved_at + logo + visible_name + dual-role)
--   CLI-04  nombre visible en resolve / catálogo / create request / orders
--   CLI-16  líneas de pedido: policy customer sin SELECT customer_profile_id
--   CLI-13  Mis pedidos: farmacia + conteos en RPC cliente
--
-- Dependencias previas en staging: 064, 067, 071, 072, staff_hide v1/v1b/v1c.
-- =============================================================================

-- (Aplicado interactivamente en staging el 2026-11-16. Este archivo documenta
--  el estado esperado para auditoría / reaplicación controlada.)

-- Ver también:
--   staging_public_entrypoint_logo_url_v1.sql
--   supabase/migrations/064|067|071|072_*.sql
