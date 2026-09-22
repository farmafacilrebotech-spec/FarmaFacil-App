-- =============================================================================
-- 008_subscriptions.sql
-- Suscripciones comerciales por farmacia (provider-agnostic).
-- Stripe u otros proveedores vía provider + IDs externos.
-- Sin hard delete normal: ciclo de vida por status.
-- =============================================================================

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL
    REFERENCES public.plans (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'trialing',
  provider text NOT NULL DEFAULT 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_status_chk CHECK (
    status = ANY (
      ARRAY[
        'trialing',
        'active',
        'past_due',
        'paused',
        'cancelled',
        'expired'
      ]
    )
  ),
  CONSTRAINT subscriptions_provider_format_chk CHECK (
    provider ~ '^[a-z][a-z0-9_]*$'
  ),
  CONSTRAINT subscriptions_trial_range_chk CHECK (
    trial_start IS NULL
    OR trial_end IS NULL
    OR trial_end >= trial_start
  ),
  CONSTRAINT subscriptions_period_range_chk CHECK (
    current_period_start IS NULL
    OR current_period_end IS NULL
    OR current_period_end >= current_period_start
  ),
  CONSTRAINT subscriptions_cancelled_consistency_chk CHECK (
    (status = 'cancelled' AND cancelled_at IS NOT NULL)
    OR (status <> 'cancelled')
  )
);

COMMENT ON TABLE public.subscriptions IS
  'Suscripción comercial por farmacia. Provider-agnostic (manual, stripe, …). Sin hard delete.';
COMMENT ON COLUMN public.subscriptions.provider IS
  'Proveedor de cobro: manual|stripe|… Extensible sin acoplar el esquema a un PSP.';
COMMENT ON COLUMN public.subscriptions.provider_customer_id IS
  'ID de cliente en el proveedor externo (nullable si provider=manual).';
COMMENT ON COLUMN public.subscriptions.provider_subscription_id IS
  'ID de suscripción en el proveedor externo (nullable si provider=manual).';
COMMENT ON COLUMN public.subscriptions.status IS
  'trialing|active|past_due|paused|cancelled|expired. cancelled/expired sustituyen al borrado.';

CREATE INDEX subscriptions_pharmacy_id_idx
  ON public.subscriptions (pharmacy_id);
CREATE INDEX subscriptions_plan_id_idx
  ON public.subscriptions (plan_id);
CREATE INDEX subscriptions_status_idx
  ON public.subscriptions (status);
CREATE INDEX subscriptions_provider_idx
  ON public.subscriptions (provider);
CREATE INDEX subscriptions_provider_customer_id_idx
  ON public.subscriptions (provider, provider_customer_id)
  WHERE provider_customer_id IS NOT NULL;
CREATE UNIQUE INDEX subscriptions_provider_subscription_uidx
  ON public.subscriptions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
-- Como máximo una suscripción “corriente” por farmacia
CREATE UNIQUE INDEX subscriptions_one_current_per_pharmacy_uidx
  ON public.subscriptions (pharmacy_id)
  WHERE status = ANY (ARRAY['trialing', 'active', 'past_due', 'paused']);

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

-- DOWN (desarrollo):
-- DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON public.subscriptions;
-- DROP TABLE IF EXISTS public.subscriptions;
