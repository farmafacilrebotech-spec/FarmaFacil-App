-- =============================================================================
-- DIAGNÓSTICO SOLO LECTURA — quién quedaría no operable tras 027–032
-- Ejecutar ANTES o JUSTO DESPUÉS de aplicar 027–028 (columnas + helper).
-- Si 027 aún no está: comentar grace_period_ends_at / commercial_reason /
-- suspension_reason en los SELECT.
-- NO hace UPDATE. NO borra datos.
-- =============================================================================

-- A) Suscripciones corrientes y evaluación de operabilidad (espejo SQL 028)
WITH current_subs AS (
  SELECT DISTINCT ON (s.pharmacy_id)
    s.pharmacy_id,
    s.id AS subscription_id,
    s.status AS subscription_status,
    s.trial_start,
    s.trial_end,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    s.grace_period_ends_at,
    s.commercial_reason,
    s.created_at AS subscription_created_at
  FROM public.subscriptions s
  WHERE s.status = ANY (ARRAY['trialing', 'active', 'past_due', 'paused'])
  ORDER BY s.pharmacy_id, s.updated_at DESC
),
ended_subs AS (
  SELECT DISTINCT ON (s.pharmacy_id)
    s.pharmacy_id,
    s.id AS subscription_id,
    s.status AS subscription_status,
    s.trial_end,
    s.current_period_end,
    s.cancel_at_period_end,
    s.grace_period_ends_at,
    s.commercial_reason
  FROM public.subscriptions s
  WHERE s.status = ANY (ARRAY['cancelled', 'expired'])
  ORDER BY s.pharmacy_id, s.updated_at DESC
),
picked AS (
  SELECT
    ph.id AS pharmacy_id,
    ph.name AS pharmacy_name,
    ph.status AS pharmacy_status,
    ph.suspension_reason,
    coalesce(cs.subscription_id, es.subscription_id) AS subscription_id,
    coalesce(cs.subscription_status, es.subscription_status) AS subscription_status,
    cs.trial_end,
    cs.current_period_end,
    coalesce(cs.cancel_at_period_end, false) AS cancel_at_period_end,
    cs.grace_period_ends_at,
    coalesce(cs.commercial_reason, es.commercial_reason) AS commercial_reason,
    cs.subscription_created_at
  FROM public.pharmacies ph
  LEFT JOIN current_subs cs ON cs.pharmacy_id = ph.id
  LEFT JOIN ended_subs es ON es.pharmacy_id = ph.id AND cs.pharmacy_id IS NULL
)
SELECT
  pharmacy_id,
  pharmacy_name,
  pharmacy_status,
  subscription_status,
  trial_end,
  current_period_end,
  cancel_at_period_end,
  grace_period_ends_at,
  suspension_reason,
  commercial_reason,
  CASE
    WHEN pharmacy_status = 'suspended' THEN 'pharmacy_suspended'
    WHEN pharmacy_status = 'archived' THEN 'pharmacy_archived'
    WHEN subscription_status IS NULL THEN 'no_valid_subscription'
    WHEN subscription_status = 'paused' THEN 'subscription_paused'
    WHEN subscription_status = 'cancelled' THEN 'subscription_cancelled'
    WHEN subscription_status = 'expired' THEN 'subscription_expired'
    WHEN subscription_status = 'trialing'
      AND (trial_end IS NULL OR trial_end <= pg_catalog.now()) THEN 'trial_ended'
    WHEN subscription_status = 'active'
      AND cancel_at_period_end = true
      AND (current_period_end IS NULL OR current_period_end <= pg_catalog.now())
      THEN 'period_ended_after_cancel'
    WHEN subscription_status = 'past_due'
      AND (grace_period_ends_at IS NULL OR grace_period_ends_at <= pg_catalog.now())
      THEN 'grace_ended'
    WHEN subscription_status = 'trialing'
      AND trial_end > pg_catalog.now() THEN 'ok'
    WHEN subscription_status = 'active'
      AND cancel_at_period_end = false THEN 'ok'
    WHEN subscription_status = 'active'
      AND cancel_at_period_end = true
      AND current_period_end > pg_catalog.now() THEN 'ok'
    WHEN subscription_status = 'past_due'
      AND grace_period_ends_at > pg_catalog.now() THEN 'ok'
    ELSE 'no_valid_subscription'
  END AS operability_reason,
  (CASE
    WHEN pharmacy_status = 'suspended' THEN false
    WHEN pharmacy_status = 'archived' THEN false
    WHEN subscription_status = 'trialing'
      AND trial_end IS NOT NULL
      AND trial_end > pg_catalog.now() THEN true
    WHEN subscription_status = 'active'
      AND cancel_at_period_end = false THEN true
    WHEN subscription_status = 'active'
      AND cancel_at_period_end = true
      AND current_period_end IS NOT NULL
      AND current_period_end > pg_catalog.now() THEN true
    WHEN subscription_status = 'past_due'
      AND grace_period_ends_at IS NOT NULL
      AND grace_period_ends_at > pg_catalog.now() THEN true
    ELSE false
  END) AS would_be_operable
FROM picked
ORDER BY would_be_operable ASC, pharmacy_name ASC;

-- B) Solo las que quedarían bloqueadas
-- (reutilizar filtro: would_be_operable = false — ejecutar A y filtrar en cliente,
--  o esta variante compacta)

SELECT
  ph.id AS pharmacy_id,
  ph.name,
  ph.status AS pharmacy_status,
  s.status AS subscription_status,
  s.trial_end,
  s.cancel_at_period_end,
  s.current_period_end,
  s.grace_period_ends_at
FROM public.pharmacies ph
LEFT JOIN LATERAL (
  SELECT *
  FROM public.subscriptions s2
  WHERE s2.pharmacy_id = ph.id
  ORDER BY
    CASE WHEN s2.status = ANY (ARRAY['trialing','active','past_due','paused']) THEN 0 ELSE 1 END,
    s2.updated_at DESC
  LIMIT 1
) s ON true
WHERE
  ph.status IN ('suspended', 'archived')
  OR s.id IS NULL
  OR s.status IN ('paused', 'cancelled', 'expired')
  OR (s.status = 'trialing' AND (s.trial_end IS NULL OR s.trial_end <= now()))
  OR (
    s.status = 'active'
    AND s.cancel_at_period_end = true
    AND (s.current_period_end IS NULL OR s.current_period_end <= now())
  )
  OR (
    s.status = 'past_due'
    AND (s.grace_period_ends_at IS NULL OR s.grace_period_ends_at <= now())
  )
ORDER BY ph.name;

-- C) Trials legacy sin trial_end (candidatos a backfill selectivo; ver trial_end_missing_v1.sql)
SELECT count(*) AS trialing_without_trial_end
FROM public.subscriptions
WHERE status = 'trialing' AND trial_end IS NULL;
