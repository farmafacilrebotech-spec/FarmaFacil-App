-- =============================================================================
-- 005_plans_modules.sql
-- Catálogo comercial: planes, módulos y composición plan→módulos.
-- =============================================================================

CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plans_key_format_chk CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT plans_key_key UNIQUE (key)
);

COMMENT ON TABLE public.plans IS
  'Planes comerciales. Asignan módulos y límites base vía plan_modules.';

CREATE TRIGGER plans_set_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

CREATE TABLE public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  name text NOT NULL,
  description text,
  is_core boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT modules_key_format_chk CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT modules_key_key UNIQUE (key)
);

COMMENT ON TABLE public.modules IS
  'Catálogo de módulos de producto. is_core marca capacidades base del kernel.';

CREATE TABLE public.plan_modules (
  plan_id uuid NOT NULL
    REFERENCES public.plans (id) ON DELETE RESTRICT,
  module_id uuid NOT NULL
    REFERENCES public.modules (id) ON DELETE RESTRICT,
  default_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, module_id),
  CONSTRAINT plan_modules_default_limits_object_chk
    CHECK (jsonb_typeof(default_limits) = 'object')
);

CREATE INDEX plan_modules_module_id_idx ON public.plan_modules (module_id);

COMMENT ON TABLE public.plan_modules IS
  'Módulos incluidos en un plan y límites cuantitativos base (jsonb).';

-- DOWN (desarrollo):
-- DROP TABLE IF EXISTS public.plan_modules;
-- DROP TABLE IF EXISTS public.modules;
-- DROP TRIGGER IF EXISTS plans_set_updated_at ON public.plans;
-- DROP TABLE IF EXISTS public.plans;
