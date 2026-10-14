-- =============================================================================
-- DIAGNÓSTICO (solo lectura) — suscripciones trialing sin trial_end
-- =============================================================================
-- Tras aplicar 028, estas filas dejan de ser operables (trial exige trial_end).
-- NO ejecutar el UPDATE automáticamente. Revisar el SELECT y decidir caso a caso.
--
-- Política propuesta (NO reinicia trials de 30 días desde hoy):
--   trial_start := coalesce(trial_start, current_period_start, created_at)
--   trial_end   := trial_start + interval '30 days'
--   current_period_end := coalesce(current_period_end, trial_end)
--
-- Efecto:
--   - Si el alta fue hace >30 días → trial_end en el pasado → sigue bloqueada
--     (correcto: no regalar un trial nuevo).
--   - Si el alta fue hace <30 días → conserva el resto del periodo original.
-- =============================================================================

-- 1) Registros afectados (lectura)
SELECT
  s.id AS subscription_id,
  s.pharmacy_id,
  ph.name AS pharmacy_name,
  ph.status AS pharmacy_status,
  s.status AS subscription_status,
  s.trial_start,
  s.trial_end,
  s.current_period_start,
  s.current_period_end,
  s.created_at,
  s.updated_at,
  CASE
    WHEN s.trial_end IS NULL THEN 'missing_trial_end'
    WHEN s.trial_end <= pg_catalog.now() THEN 'trial_already_ended'
    ELSE 'trial_ok'
  END AS diagnosis,
  coalesce(s.trial_start, s.current_period_start, s.created_at)
    + interval '30 days' AS proposed_trial_end_if_backfilled_from_start
FROM public.subscriptions s
INNER JOIN public.pharmacies ph ON ph.id = s.pharmacy_id
WHERE s.status = 'trialing'
  AND s.trial_end IS NULL
ORDER BY s.created_at ASC;

-- 2) Conteo
SELECT count(*) AS trialing_without_trial_end
FROM public.subscriptions
WHERE status = 'trialing'
  AND trial_end IS NULL;

-- 3) UPDATE propuesto (NO ejecutar aquí; copiar tras revisión manual)
-- UPDATE public.subscriptions s
-- SET
--   trial_start = coalesce(s.trial_start, s.current_period_start, s.created_at),
--   trial_end = coalesce(s.trial_start, s.current_period_start, s.created_at)
--               + interval '30 days',
--   current_period_end = coalesce(
--     s.current_period_end,
--     coalesce(s.trial_start, s.current_period_start, s.created_at)
--       + interval '30 days'
--   ),
--   updated_at = pg_catalog.now()
-- WHERE s.status = 'trialing'
--   AND s.trial_end IS NULL
--   AND s.id IN (
--     -- pegar UUIDs revisados del SELECT (1)
--   );
