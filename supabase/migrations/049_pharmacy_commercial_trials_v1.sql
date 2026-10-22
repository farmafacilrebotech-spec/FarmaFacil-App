-- =============================================================================
-- 049_pharmacy_commercial_trials_v1.sql
-- Pilotos comerciales v1 (15 días + ampliación única +15).
--
-- NO backfill de trials legacy 30d (subscriptions.trialing sin esta fila).
-- Depende de: 008 subscriptions, 006 pharmacies, 047, 048 (FK converted_quote_id).
-- NO APLICAR sin autorización expresa.
-- =============================================================================

INSERT INTO public.platform_permissions (key, module_key, description)
VALUES
  (
    'platform.commercial_trials.manage',
    'commercial',
    'Preparar, activar, ampliar y finalizar pilotos comerciales 15d'
  )
ON CONFLICT (key) DO UPDATE
SET
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description;

INSERT INTO public.platform_role_permissions (platform_role_id, platform_permission_id)
SELECT r.id, p.id
FROM public.platform_roles r
CROSS JOIN public.platform_permissions p
WHERE r.key = 'PLATFORM_SUPERADMIN'
  AND p.key = 'platform.commercial_trials.manage'
ON CONFLICT DO NOTHING;

CREATE TABLE public.pharmacy_commercial_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE RESTRICT,
  program text NOT NULL DEFAULT 'commercial_v1_15d',
  status text NOT NULL DEFAULT 'draft',
  -- Fechas del ciclo comercial 15d
  prepared_at timestamptz,
  activated_at timestamptz,
  original_ends_at timestamptz,
  ends_at timestamptz,
  ended_at timestamptz,
  -- Ampliación única
  extension_used boolean NOT NULL DEFAULT false,
  extended_at timestamptz,
  extended_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  extension_reason text,
  -- Conversión / cancelación
  converted_at timestamptz,
  converted_quote_id uuid REFERENCES public.commercial_quotes (id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  -- Suscripción creada al activar (nullable hasta activate)
  subscription_id uuid REFERENCES public.subscriptions (id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pharmacy_commercial_trials_program_chk CHECK (
    program = 'commercial_v1_15d'
  ),
  CONSTRAINT pharmacy_commercial_trials_status_chk CHECK (
    status = ANY (
      ARRAY[
        'draft',
        'ready',
        'active',
        'extended',
        'ended',
        'converted',
        'cancelled'
      ]
    )
  ),
  CONSTRAINT pharmacy_commercial_trials_extension_consistency_chk CHECK (
    (
      extension_used = false
      AND extended_at IS NULL
      AND extended_by IS NULL
      AND extension_reason IS NULL
    )
    OR (
      extension_used = true
      AND extended_at IS NOT NULL
      AND extended_by IS NOT NULL
      AND extension_reason IS NOT NULL
      AND length(trim(extension_reason)) > 0
    )
  ),
  CONSTRAINT pharmacy_commercial_trials_active_dates_chk CHECK (
    status NOT IN ('active', 'extended')
    OR (
      activated_at IS NOT NULL
      AND ends_at IS NOT NULL
      AND original_ends_at IS NOT NULL
    )
  )
);

COMMENT ON TABLE public.pharmacy_commercial_trials IS
  'Pilotos comerciales 15d (+ ampliación única). Legacy 30d NO se inserta aquí.';
COMMENT ON COLUMN public.pharmacy_commercial_trials.program IS
  'Solo commercial_v1_15d. Trials 30d legacy se detectan por ausencia de fila.';
COMMENT ON COLUMN public.pharmacy_commercial_trials.extension_used IS
  'Máximo una ampliación. Si true, no hay más ampliaciones ni reactivaciones por extensión.';

CREATE TRIGGER pharmacy_commercial_trials_set_updated_at
  BEFORE UPDATE ON public.pharmacy_commercial_trials
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

-- Como máximo un trial “abierto” por farmacia (preparación / en curso)
CREATE UNIQUE INDEX pharmacy_commercial_trials_one_open_per_pharmacy_uidx
  ON public.pharmacy_commercial_trials (pharmacy_id)
  WHERE status = ANY (ARRAY['draft', 'ready', 'active', 'extended']);

CREATE INDEX pharmacy_commercial_trials_status_ends_idx
  ON public.pharmacy_commercial_trials (status, ends_at);

CREATE INDEX pharmacy_commercial_trials_pharmacy_created_idx
  ON public.pharmacy_commercial_trials (pharmacy_id, created_at DESC);

ALTER TABLE public.pharmacy_commercial_trials ENABLE ROW LEVEL SECURITY;

CREATE POLICY pharmacy_commercial_trials_select ON public.pharmacy_commercial_trials
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.commercial_trials.manage')
    OR public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_has_platform_permission('platform.subscriptions.read')
  );

-- Escrituras solo vía RPC (sin policy INSERT/UPDATE directas para authenticated).
-- Las RPC usarán SECURITY INVOKER con permisos de plataforma + grants a tablas
-- o SECURITY DEFINER con re-check (ver 050). Aquí: sin ALL write policy →
-- force path = RPC definer o service. Optamos por grant + RPC INVOKER en 050
-- con platform permission check (como create pharmacy).

GRANT SELECT ON public.pharmacy_commercial_trials TO authenticated;
GRANT INSERT, UPDATE ON public.pharmacy_commercial_trials TO authenticated;

CREATE POLICY pharmacy_commercial_trials_write ON public.pharmacy_commercial_trials
  FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.commercial_trials.manage'))
  WITH CHECK (public.ff_has_platform_permission('platform.commercial_trials.manage'));

-- DOWN (desarrollo):
-- DROP TABLE IF EXISTS public.pharmacy_commercial_trials;
-- DELETE FROM public.platform_permissions WHERE key = 'platform.commercial_trials.manage';
