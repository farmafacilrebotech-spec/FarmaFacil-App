-- =============================================================================
-- 027_subscription_commercial_fields_v1.sql
-- Campos comerciales para gracia por impago y motivo de bloqueo.
--
-- Reglas de negocio (Fase 1):
--   - Prueba gratuita: 30 días (se aplica en create / RPC).
--   - Impago: 7 días de gracia (grace_period_ends_at).
--   - Cancelación comercial NO archiva la farmacia.
--
-- NO toca memberships, auth.users ni otras tablas.
-- NO APLICAR automáticamente: revisar y aplicar manualmente.
-- =============================================================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS commercial_reason text;

COMMENT ON COLUMN public.subscriptions.grace_period_ends_at IS
  'Fin del periodo de gracia por impago (past_due). Tras esta fecha la farmacia deja de ser operable hasta reactivar o suspender explícitamente.';
COMMENT ON COLUMN public.subscriptions.commercial_reason IS
  'Motivo comercial legible (impago, cancelación, trial vencido, …). No sustituye al status.';

ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS suspension_reason text;

COMMENT ON COLUMN public.pharmacies.suspension_reason IS
  'Motivo de suspensión operativa del tenant (p.ej. impago). Independiente de subscriptions.status.';

-- Consistencia suave: gracia solo tiene sentido en past_due (o historial limpio).
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_grace_past_due_chk;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_grace_past_due_chk CHECK (
    grace_period_ends_at IS NULL
    OR status = 'past_due'
  );

CREATE INDEX IF NOT EXISTS subscriptions_grace_period_ends_at_idx
  ON public.subscriptions (grace_period_ends_at)
  WHERE grace_period_ends_at IS NOT NULL;

-- DOWN (desarrollo):
-- ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_grace_past_due_chk;
-- DROP INDEX IF EXISTS public.subscriptions_grace_period_ends_at_idx;
-- ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS commercial_reason;
-- ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS grace_period_ends_at;
-- ALTER TABLE public.pharmacies DROP COLUMN IF EXISTS suspension_reason;
