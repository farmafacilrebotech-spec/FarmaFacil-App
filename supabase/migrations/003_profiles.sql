-- =============================================================================
-- 003_profiles.sql
-- Perfiles de aplicación (1:1 con auth.users). Sin roles automáticos.
-- last_pharmacy_id se declara sin FK aquí; la FK se añade en 006_pharmacies.sql.
-- =============================================================================

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  phone text,
  avatar_url text,
  locale text NOT NULL DEFAULT 'es',
  timezone text NOT NULL DEFAULT 'Europe/Madrid',
  is_active boolean NOT NULL DEFAULT true,
  last_pharmacy_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_email_key UNIQUE (email),
  CONSTRAINT profiles_email_format_chk
    CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

COMMENT ON TABLE public.profiles IS
  'Perfil de aplicación. auth.users es la fuente de verdad de autenticación; email se sincroniza desde Auth.';
COMMENT ON COLUMN public.profiles.last_pharmacy_id IS
  'Preferencia de UI únicamente. NUNCA usar como prueba de autorización.';

CREATE INDEX profiles_is_active_idx ON public.profiles (is_active);
CREATE INDEX profiles_last_pharmacy_id_idx ON public.profiles (last_pharmacy_id);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

-- -----------------------------------------------------------------------------
-- Asignación de roles de plataforma (tras profiles)
-- -----------------------------------------------------------------------------
CREATE TABLE public.platform_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  platform_role_id uuid NOT NULL
    REFERENCES public.platform_roles (id) ON DELETE RESTRICT,
  granted_by uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_user_roles_profile_role_key UNIQUE (profile_id, platform_role_id)
);

CREATE INDEX platform_user_roles_profile_id_idx
  ON public.platform_user_roles (profile_id);
CREATE INDEX platform_user_roles_platform_role_id_idx
  ON public.platform_user_roles (platform_role_id);

COMMENT ON TABLE public.platform_user_roles IS
  'Única vía legítima para conceder capacidades de plataforma (p. ej. PLATFORM_SUPERADMIN).';

-- -----------------------------------------------------------------------------
-- Trigger: crear / sincronizar profile desde auth.users (idempotente)
-- NO concede roles de plataforma ni de farmacia.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_full_name text;
BEGIN
  v_full_name := NULLIF(
    trim(
      COALESCE(
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.raw_user_meta_data ->> 'name',
        ''
      )
    ),
    ''
  );

  INSERT INTO public.profiles AS p (id, email, full_name)
  VALUES (
    NEW.id,
    lower(trim(NEW.email)),
    v_full_name
  )
  ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = COALESCE(p.full_name, EXCLUDED.full_name),
      updated_at = pg_catalog.now();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ff_handle_new_user() IS
  'Crea o actualiza profiles al insertar auth.users. Idempotente. Sin concesión de roles.';

REVOKE ALL ON FUNCTION public.ff_handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_handle_new_user() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.ff_handle_new_user() TO service_role;

CREATE OR REPLACE FUNCTION public.ff_sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
    SET
      email = lower(trim(NEW.email)),
      updated_at = pg_catalog.now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ff_sync_profile_email() IS
  'Sincroniza profiles.email cuando cambia auth.users.email.';

REVOKE ALL ON FUNCTION public.ff_sync_profile_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_sync_profile_email() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.ff_sync_profile_email() TO service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.ff_sync_profile_email();

-- DOWN (desarrollo):
-- DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS public.ff_sync_profile_email();
-- DROP FUNCTION IF EXISTS public.ff_handle_new_user();
-- DROP TABLE IF EXISTS public.platform_user_roles;
-- DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
-- DROP TABLE IF EXISTS public.profiles;
