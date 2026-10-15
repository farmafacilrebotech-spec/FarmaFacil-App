-- =============================================================================
-- 035_kiosk_devices_permissions_v1.sql
-- Módulo kiosk + permisos de dispositivos. Asignación OWNER/ADMIN.
-- Depende de: 004 (permissions/roles), 005 (modules), 034 (schema kiosk).
-- NO APLICAR automáticamente.
-- =============================================================================

INSERT INTO public.modules (key, name, description, is_core, is_active)
VALUES (
  'kiosk',
  'Kiosko',
  'Dispositivos tablet y experiencia de mostrador / sala de espera',
  false,
  true
)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

INSERT INTO public.permissions (key, module_key, description)
VALUES
  (
    'kiosk.devices.view',
    'kiosk',
    'Ver dispositivos kiosko vinculados a la farmacia'
  ),
  (
    'kiosk.devices.manage',
    'kiosk',
    'Generar códigos de emparejamiento y revocar dispositivos'
  )
ON CONFLICT (key) DO UPDATE
SET
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description;

-- OWNER y ADMIN: view + manage
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key IN ('PHARMACY_OWNER', 'PHARMACY_ADMIN')
  AND p.key IN ('kiosk.devices.view', 'kiosk.devices.manage')
ON CONFLICT DO NOTHING;

-- Adjuntar módulo kiosk a planes existentes (sin límites especiales en v1)
INSERT INTO public.plan_modules (plan_id, module_id, default_limits)
SELECT pl.id, m.id, '{}'::jsonb
FROM public.plans pl
CROSS JOIN public.modules m
WHERE m.key = 'kiosk'
  AND pl.key IN ('starter', 'pro', 'business', 'enterprise')
ON CONFLICT (plan_id, module_id) DO NOTHING;

-- Entitlements para farmacias ya existentes (activas): alta del módulo kiosk
INSERT INTO public.pharmacy_entitlements (
  pharmacy_id,
  module_id,
  status,
  source,
  source_plan_id,
  limits,
  config
)
SELECT
  s.pharmacy_id,
  m.id,
  'active',
  'plan',
  s.plan_id,
  '{}'::jsonb,
  '{}'::jsonb
FROM public.subscriptions s
INNER JOIN public.modules m ON m.key = 'kiosk'
WHERE s.status IN ('trialing', 'active', 'past_due')
ON CONFLICT (pharmacy_id, module_id) DO NOTHING;

-- DOWN (desarrollo):
-- DELETE FROM public.role_permissions WHERE permission_id IN
--   (SELECT id FROM public.permissions WHERE key LIKE 'kiosk.%');
-- DELETE FROM public.permissions WHERE key LIKE 'kiosk.%';
-- DELETE FROM public.plan_modules WHERE module_id IN
--   (SELECT id FROM public.modules WHERE key = 'kiosk');
-- DELETE FROM public.pharmacy_entitlements WHERE module_id IN
--   (SELECT id FROM public.modules WHERE key = 'kiosk');
-- DELETE FROM public.modules WHERE key = 'kiosk';
