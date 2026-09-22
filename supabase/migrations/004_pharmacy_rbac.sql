-- =============================================================================
-- 004_pharmacy_rbac.sql
-- RBAC de farmacia (tenant). Separado del RBAC de plataforma.
-- =============================================================================

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roles_key_format_chk CHECK (key ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT roles_key_key UNIQUE (key)
);

COMMENT ON TABLE public.roles IS
  'Roles de farmacia (PHARMACY_OWNER, PHARMACY_ADMIN, PHARMACIST, STAFF).';

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  module_key text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT permissions_key_format_chk CHECK (key ~ '^[a-z][a-z0-9_.]*$'),
  CONSTRAINT permissions_key_key UNIQUE (key)
);

COMMENT ON TABLE public.permissions IS
  'Permisos de farmacia namespaced. Distintos de los entitlements comerciales.';

CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL
    REFERENCES public.roles (id) ON DELETE RESTRICT,
  permission_id uuid NOT NULL
    REFERENCES public.permissions (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX role_permissions_permission_id_idx
  ON public.role_permissions (permission_id);

COMMENT ON TABLE public.role_permissions IS
  'Asignación N:M entre roles y permisos de farmacia.';

-- DOWN (desarrollo):
-- DROP TABLE IF EXISTS public.role_permissions;
-- DROP TABLE IF EXISTS public.permissions;
-- DROP TABLE IF EXISTS public.roles;
