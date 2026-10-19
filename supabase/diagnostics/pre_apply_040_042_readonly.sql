-- =============================================================================
-- FarmaFácil — Diagnóstico SOLO LECTURA antes de aplicar 040 / 041 / 042
--
-- Ejecutar en SQL Editor de Supabase (producción o staging).
-- NO modifica datos. NO muestra secretos ni claves.
--
-- Revisar resultados y guardar salida antes del apply.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) Extensión pgcrypto: ¿instalada? ¿en qué esquema?
-- -----------------------------------------------------------------------------
SELECT
  e.extname AS extension,
  n.nspname AS schema_name,
  e.extversion AS version
FROM pg_catalog.pg_extension e
INNER JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'pgcrypto';

-- Localización de gen_random_bytes (si existe)
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name
FROM pg_catalog.pg_proc p
INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'gen_random_bytes'
ORDER BY n.nspname;

-- -----------------------------------------------------------------------------
-- B) Definición actual de ff_create_pharmacy_v1 (producción)
--    Comparar mentalmente con migración 030 (trial 30d) antes de aplicar 042.
-- -----------------------------------------------------------------------------
SELECT
  p.proname AS function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_args,
  p.prosecdef AS is_security_definer,
  n.nspname AS schema_name
FROM pg_catalog.pg_proc p
INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'ff_create_pharmacy_v1';

-- Cuerpo completo (puede ser largo; copiar a diff vs 030/042)
SELECT pg_catalog.pg_get_functiondef(p.oid) AS function_definition
FROM pg_catalog.pg_proc p
INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'ff_create_pharmacy_v1';

-- Señales rápidas en el cuerpo (trial / entrypoint)
SELECT
  (pg_catalog.pg_get_functiondef(p.oid) ILIKE '%trial_end%') AS has_trial_end,
  (pg_catalog.pg_get_functiondef(p.oid) ILIKE '%30 days%') AS has_30_day_trial,
  (pg_catalog.pg_get_functiondef(p.oid) ILIKE '%ff_ensure_pharmacy_home_entrypoint%') AS already_has_qr_ensure,
  (pg_catalog.pg_get_functiondef(p.oid) ILIKE '%SECURITY INVOKER%'
    OR pg_catalog.pg_get_functiondef(p.oid) NOT ILIKE '%SECURITY DEFINER%') AS looks_invoker
FROM pg_catalog.pg_proc p
INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'ff_create_pharmacy_v1';

-- -----------------------------------------------------------------------------
-- C) Dependencias de kiosko (040/041 las requieren)
-- -----------------------------------------------------------------------------
SELECT
  t.table_name,
  true AS exists
FROM (VALUES
  ('pharmacy_devices'),
  ('pharmacy_device_sessions'),
  ('pharmacy_device_pairing_codes'),
  ('public_entrypoints'),
  ('pharmacy_products'),
  ('pharmacies'),
  ('pharmacy_branding')
) AS t(table_name)
LEFT JOIN information_schema.tables ist
  ON ist.table_schema = 'public'
 AND ist.table_name = t.table_name
ORDER BY t.table_name;

SELECT
  p.proname AS function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
FROM pg_catalog.pg_proc p
INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'ff_kiosk_validate_device_session_v1',
    'ff_kiosk_pharmacy_runtime_allowed',
    'ff_kiosk_consume_pairing_code_v1',
    'ff_pharmacy_is_operable',
    'ff_can_read_pharmacy_operational',
    'ff_has_pharmacy_permission',
    'ff_kiosk_get_home_context_v1',
    'ff_ensure_pharmacy_home_entrypoint_v1',
    'ff_kiosk_create_order_v1'
  )
ORDER BY p.proname;

-- Tablas de pedidos (040): deben NO existir aún si 040 no está aplicada
SELECT
  t.table_name,
  (ist.table_name IS NOT NULL) AS already_exists
FROM (VALUES
  ('pharmacy_orders'),
  ('pharmacy_order_items'),
  ('pharmacy_order_counters')
) AS t(table_name)
LEFT JOIN information_schema.tables ist
  ON ist.table_schema = 'public'
 AND ist.table_name = t.table_name;

-- -----------------------------------------------------------------------------
-- D) Migraciones registradas (si usáis supabase_migrations.schema_migrations)
-- -----------------------------------------------------------------------------
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 40;

-- Si la consulta anterior falla (tabla ausente), probar:
-- SELECT * FROM supabase_migrations.schema_migrations ORDER BY 1 DESC LIMIT 40;

-- -----------------------------------------------------------------------------
-- E) Farmacias y entrypoints (public.public_entrypoints)
-- -----------------------------------------------------------------------------
SELECT
  count(*) AS pharmacies_total,
  count(*) FILTER (WHERE status IS DISTINCT FROM 'archived') AS pharmacies_not_archived,
  count(*) FILTER (WHERE status = 'active') AS pharmacies_active,
  count(*) FILTER (WHERE status = 'pending_setup') AS pharmacies_pending_setup,
  count(*) FILTER (WHERE status = 'suspended') AS pharmacies_suspended
FROM public.pharmacies;

SELECT
  count(*) AS entrypoints_total,
  count(*) FILTER (WHERE purpose = 'pharmacy_home') AS pharmacy_home_total,
  count(*) FILTER (WHERE purpose = 'pharmacy_home' AND is_active) AS pharmacy_home_active
FROM public.public_entrypoints;

-- Duplicados pharmacy_home (debe ser 0 filas)
SELECT
  pharmacy_id,
  count(*) AS home_count
FROM public.public_entrypoints
WHERE purpose = 'pharmacy_home'
GROUP BY pharmacy_id
HAVING count(*) > 1;

-- Farmacias sin pharmacy_home (candidatas a backfill 042)
SELECT
  p.id,
  p.name,
  p.status
FROM public.pharmacies p
WHERE p.status IS DISTINCT FROM 'archived'
  AND NOT EXISTS (
    SELECT 1
    FROM public.public_entrypoints pe
    WHERE pe.pharmacy_id = p.id
      AND pe.purpose = 'pharmacy_home'
  )
ORDER BY p.created_at
LIMIT 100;

-- public_id duplicados globales (debe ser 0)
SELECT
  public_id,
  count(*) AS n
FROM public.public_entrypoints
GROUP BY public_id
HAVING count(*) > 1;

-- =============================================================================
-- FIN — Interpretación breve
-- =============================================================================
-- 1) pgcrypto: anotar schema_name (extensions o public). 042 lo resuelve solo.
-- 2) ff_create_pharmacy_v1: has_trial_end / has_30_day_trial deben ser true
--    (cuerpo 030). already_has_qr_ensure false → 042 aún no aplicada.
-- 3) Tablas kiosko + ff_kiosk_* deben existir antes de 040/041.
-- 4) pharmacy_orders* already_exists = false antes de 040.
-- 5) home_count duplicados = 0; backfill creará home donde falte.
-- =============================================================================
