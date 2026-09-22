-- =============================================================================
-- 007_memberships_entitlements.sql
-- Membresías de farmacia + entitlements comerciales por tenant.
-- Ciclo de vida por status (sin hard delete normal).
-- =============================================================================

CREATE TABLE public.pharmacy_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  role_id uuid NOT NULL
    REFERENCES public.roles (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'invited',
  invited_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  invited_at timestamptz,
  accepted_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pharmacy_memberships_pharmacy_profile_key
    UNIQUE (pharmacy_id, profile_id),
  CONSTRAINT pharmacy_memberships_status_chk CHECK (
    status = ANY (ARRAY['invited', 'active', 'suspended', 'revoked'])
  )
);

COMMENT ON TABLE public.pharmacy_memberships IS
  'Acceso usuario↔farmacia. Solo status=active concede acceso tenant vía RLS.';
COMMENT ON COLUMN public.pharmacy_memberships.status IS
  'invited|active|suspended|revoked. Sin hard delete normal. invited/suspended/revoked no autorizan.';
COMMENT ON COLUMN public.pharmacy_memberships.updated_by IS
  'Quién cambió rol/estado. invited_by cubre el alta; no se añade archived_* (status basta).';

CREATE INDEX pharmacy_memberships_profile_id_idx
  ON public.pharmacy_memberships (profile_id);
CREATE INDEX pharmacy_memberships_role_id_idx
  ON public.pharmacy_memberships (role_id);
CREATE INDEX pharmacy_memberships_pharmacy_id_status_idx
  ON public.pharmacy_memberships (pharmacy_id, status);
CREATE INDEX pharmacy_memberships_active_profile_idx
  ON public.pharmacy_memberships (profile_id, pharmacy_id)
  WHERE status = 'active';

CREATE TRIGGER pharmacy_memberships_set_updated_at
  BEFORE UPDATE ON public.pharmacy_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

CREATE TABLE public.pharmacy_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE RESTRICT,
  module_id uuid NOT NULL
    REFERENCES public.modules (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active',
  source text NOT NULL DEFAULT 'plan',
  source_plan_id uuid REFERENCES public.plans (id) ON DELETE SET NULL,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pharmacy_entitlements_pharmacy_module_key
    UNIQUE (pharmacy_id, module_id),
  CONSTRAINT pharmacy_entitlements_status_chk CHECK (
    status = ANY (ARRAY['active', 'trial', 'suspended', 'cancelled'])
  ),
  CONSTRAINT pharmacy_entitlements_source_chk CHECK (
    source = ANY (ARRAY['plan', 'addon', 'comp', 'internal'])
  ),
  CONSTRAINT pharmacy_entitlements_limits_object_chk
    CHECK (jsonb_typeof(limits) = 'object'),
  CONSTRAINT pharmacy_entitlements_config_object_chk
    CHECK (jsonb_typeof(config) = 'object')
);

COMMENT ON TABLE public.pharmacy_entitlements IS
  'Módulos contratados/activados por farmacia. Desactivar = status, nunca borrar datos de dominio.';
COMMENT ON COLUMN public.pharmacy_entitlements.limits IS
  'Límites efectivos (p. ej. max_users). Enforcement comercial en servidor además de RLS.';
COMMENT ON COLUMN public.pharmacy_entitlements.created_by IS
  'Trazabilidad operativa de alta/cambio de entitlement.';

CREATE INDEX pharmacy_entitlements_module_id_idx
  ON public.pharmacy_entitlements (module_id);
CREATE INDEX pharmacy_entitlements_pharmacy_id_status_idx
  ON public.pharmacy_entitlements (pharmacy_id, status);
CREATE INDEX pharmacy_entitlements_source_plan_id_idx
  ON public.pharmacy_entitlements (source_plan_id);

CREATE TRIGGER pharmacy_entitlements_set_updated_at
  BEFORE UPDATE ON public.pharmacy_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

-- DOWN (desarrollo):
-- DROP TRIGGER IF EXISTS pharmacy_entitlements_set_updated_at ON public.pharmacy_entitlements;
-- DROP TABLE IF EXISTS public.pharmacy_entitlements;
-- DROP TRIGGER IF EXISTS pharmacy_memberships_set_updated_at ON public.pharmacy_memberships;
-- DROP TABLE IF EXISTS public.pharmacy_memberships;
