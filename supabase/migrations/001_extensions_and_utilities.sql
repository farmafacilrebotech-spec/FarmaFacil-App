-- =============================================================================
-- 001_extensions_and_utilities.sql
-- Extensiones y utilidades compartidas del kernel FarmaFácil.
-- =============================================================================

-- gen_random_uuid() está disponible en Postgres moderno / Supabase.
-- pgcrypto se declara por compatibilidad con entornos que lo requieran.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- updated_at genérico
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ff_set_updated_at() IS
  'Trigger helper: asigna NEW.updated_at = now().';

REVOKE ALL ON FUNCTION public.ff_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_set_updated_at() TO postgres;
GRANT EXECUTE ON FUNCTION public.ff_set_updated_at() TO service_role;

-- -----------------------------------------------------------------------------
-- Validación de rutas internas (public_entrypoints)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_is_safe_internal_route(p_route text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_route IS NOT NULL
    AND length(p_route) >= 1
    AND length(p_route) <= 512
    AND p_route LIKE '/%'
    AND p_route NOT LIKE '//%'
    AND position('://' IN p_route) = 0
    AND position('\\' IN p_route) = 0
    AND position(' ' IN p_route) = 0
    AND p_route ~ '^/[a-zA-Z0-9/_\-.\{\}]*$';
$$;

COMMENT ON FUNCTION public.ff_is_safe_internal_route(text) IS
  'Valida que una ruta sea interna (path absoluto) y no una URL externa abierta.';

REVOKE ALL ON FUNCTION public.ff_is_safe_internal_route(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_is_safe_internal_route(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ff_is_safe_internal_route(text) TO service_role;

-- DOWN (desarrollo):
-- DROP FUNCTION IF EXISTS public.ff_is_safe_internal_route(text);
-- DROP FUNCTION IF EXISTS public.ff_set_updated_at();
-- (pgcrypto suele dejarse instalado)
