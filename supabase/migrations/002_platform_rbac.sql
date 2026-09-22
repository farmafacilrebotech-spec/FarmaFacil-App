-- =============================================================================
-- 002_platform_rbac.sql
-- RBAC de plataforma (ReBoTech / FarmaFácil global). Separado del RBAC de farmacia.
-- =============================================================================

CREATE TABLE public.platform_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_roles_key_format_chk
    CHECK (key ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT platform_roles_key_key UNIQUE (key)
);

COMMENT ON TABLE public.platform_roles IS
  'Roles globales de plataforma. El SuperAdmin se asigna solo vía platform_user_roles.';

CREATE TABLE public.platform_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  module_key text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_permissions_key_format_chk
    CHECK (key ~ '^[a-z][a-z0-9_.]*$'),
  CONSTRAINT platform_permissions_key_key UNIQUE (key)
);

COMMENT ON TABLE public.platform_permissions IS
  'Permisos globales de plataforma (namespaced).';

CREATE TABLE public.platform_role_permissions (
  platform_role_id uuid NOT NULL
    REFERENCES public.platform_roles (id) ON DELETE RESTRICT,
  platform_permission_id uuid NOT NULL
    REFERENCES public.platform_permissions (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (platform_role_id, platform_permission_id)
);

CREATE INDEX platform_role_permissions_permission_id_idx
  ON public.platform_role_permissions (platform_permission_id);

COMMENT ON TABLE public.platform_role_permissions IS
  'Asignación N:M entre roles y permisos de plataforma.';

-- platform_user_roles se crea en 003 tras profiles (depende de profiles.id).

-- DOWN (desarrollo):
-- DROP TABLE IF EXISTS public.platform_role_permissions;
-- DROP TABLE IF EXISTS public.platform_permissions;
-- DROP TABLE IF EXISTS public.platform_roles;
