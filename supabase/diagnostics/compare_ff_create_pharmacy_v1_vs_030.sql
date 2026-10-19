-- =============================================================================
-- FarmaFácil — Comparar ff_create_pharmacy_v1 (PRODUCCIÓN) vs migración 030
-- SOLO LECTURA. No modifica datos. No muestra secretos.
--
-- Uso:
--   1) Ejecutar en SQL Editor (producción).
--   2) Revisar las filas de "señales" (deben coincidir con Esperado 030).
--   3) Copiar function_definition y, si hace falta, diff local contra:
--        supabase/migrations/030_create_pharmacy_trial_defaults_v1.sql
--   4) Tras aplicar 042, already_has_qr_ensure debe pasar a true.
-- =============================================================================

-- Identidad / seguridad
SELECT
  p.proname,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_args,
  p.prosecdef AS is_security_definer,  -- 030/042 esperan FALSE (INVOKER)
  pg_catalog.pg_get_userbyid(p.proowner) AS owner_name
FROM pg_catalog.pg_proc p
INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'ff_create_pharmacy_v1';

-- Conteo de parámetros (030/042: 22)
SELECT
  cardinality(string_to_array(
    trim(both FROM pg_catalog.pg_get_function_identity_arguments(p.oid)),
    ','
  )) AS param_count_approx,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_args
FROM pg_catalog.pg_proc p
INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'ff_create_pharmacy_v1';

-- Señales del cuerpo (Esperado PRE-042 = cuerpo 030)
WITH def AS (
  SELECT pg_catalog.pg_get_functiondef(p.oid) AS src
  FROM pg_catalog.pg_proc p
  INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'ff_create_pharmacy_v1'
)
SELECT
  (src ILIKE '%SECURITY INVOKER%') AS has_security_invoker,           -- esperado: true
  (src ILIKE '%SECURITY DEFINER%') AS has_security_definer,           -- esperado: false
  (src ILIKE '%trial_start%') AS has_trial_start,                     -- esperado: true
  (src ILIKE '%trial_end%') AS has_trial_end,                         -- esperado: true
  (src ILIKE '%30 days%') AS has_30_day_trial,                        -- esperado: true
  (src ILIKE '%pharmacy_branding%') AS inserts_branding,              -- esperado: true
  (src ILIKE '%pharmacy_settings%') AS inserts_settings,              -- esperado: true
  (src ILIKE '%pharmacy_entitlements%') AS inserts_entitlements,      -- esperado: true
  (src ILIKE '%plan_modules%') AS uses_plan_modules,                  -- esperado: true
  (src ILIKE '%not_authenticated%') AS checks_auth,                   -- esperado: true
  (src ILIKE '%ff_ensure_pharmacy_home_entrypoint%') AS has_qr_ensure,-- PRE-042: false; POST-042: true
  (src ILIKE '%p_settings_email%') AS has_p_settings_email,           -- esperado: true (22º param)
  (src ILIKE '%RETURNS uuid%' OR src ILIKE '%returns uuid%') AS returns_uuid
FROM def;

-- Definición completa (pegar en diff local vs 030)
SELECT pg_catalog.pg_get_functiondef(p.oid) AS function_definition
FROM pg_catalog.pg_proc p
INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'ff_create_pharmacy_v1';

-- Huella del CREATE completo normalizado (espacios/comentarios -- eliminados).
-- No comparar este md5 con hashes offline del cuerpo AS $$ alone.
-- Útil para: (a) archivar PRE-042, (b) confirmar que POST-042 cambió el cuerpo.
WITH def AS (
  SELECT pg_catalog.pg_get_functiondef(p.oid) AS src
  FROM pg_catalog.pg_proc p
  INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'ff_create_pharmacy_v1'
),
norm AS (
  SELECT
    lower(
      regexp_replace(
        regexp_replace(src, '--[^\n]*', '', 'g'),
        '\s+',
        '',
        'g'
      )
    ) AS compact
  FROM def
)
SELECT
  length(compact) AS compact_length,
  md5(compact) AS md5_compact_full_def
FROM norm;

-- =============================================================================
-- Interpretación PRE-042 (estado actual confirmado por el equipo):
--   has_security_invoker=true, has_trial_*=true, has_qr_ensure=false, 22 params
-- POST-042:
--   mismos flags + has_qr_ensure=true
-- =============================================================================
