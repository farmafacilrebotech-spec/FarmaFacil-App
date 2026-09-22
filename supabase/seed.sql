-- =============================================================================
-- seed.sql — Catálogos idempotentes del kernel FarmaFácil
-- NO incluye usuarios, farmacias, suscripciones ni datos de dominio.
-- Ejecutar DESPUÉS de migrations 001–012.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Platform roles
-- -----------------------------------------------------------------------------
INSERT INTO public.platform_roles (key, name, description, is_system)
VALUES
  ('PLATFORM_SUPERADMIN', 'SuperAdministrador', 'Administración global de FarmaFácil / ReBoTech', true),
  ('PLATFORM_SUPPORT', 'Soporte', 'Soporte con acceso de contexto auditado a farmacias', true)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system;

-- -----------------------------------------------------------------------------
-- Platform permissions (12) — catálogo funcional, no hipergranular
-- -----------------------------------------------------------------------------
INSERT INTO public.platform_permissions (key, module_key, description)
VALUES
  ('platform.pharmacies.read', 'pharmacies', 'Listar y consultar farmacias'),
  ('platform.pharmacies.write', 'pharmacies', 'Crear y modificar farmacias (incl. archivar/suspender)'),
  ('platform.users.read', 'users', 'Consultar usuarios y membresías'),
  ('platform.users.write', 'users', 'Gestionar usuarios y membresías'),
  ('platform.plans.read', 'plans', 'Consultar planes y módulos'),
  ('platform.plans.write', 'plans', 'Gestionar planes, módulos y plan_modules'),
  ('platform.subscriptions.read', 'subscriptions', 'Consultar suscripciones'),
  ('platform.subscriptions.manage', 'subscriptions', 'Crear/actualizar suscripciones y ciclo de vida'),
  ('platform.entitlements.manage', 'plans', 'Gestionar entitlements de farmacias'),
  ('platform.audit.read', 'audit', 'Leer audit_logs globales'),
  ('platform.support.enter_pharmacy_context', 'support', 'Entrar en contexto de farmacia (debe auditarse)'),
  ('platform.admins.manage', 'admins', 'Asignar o revocar roles de plataforma')
ON CONFLICT (key) DO UPDATE
SET
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description;

INSERT INTO public.platform_role_permissions (platform_role_id, platform_permission_id)
SELECT r.id, p.id
FROM public.platform_roles r
CROSS JOIN public.platform_permissions p
WHERE r.key = 'PLATFORM_SUPERADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO public.platform_role_permissions (platform_role_id, platform_permission_id)
SELECT r.id, p.id
FROM public.platform_roles r
INNER JOIN public.platform_permissions p ON p.key IN (
  'platform.pharmacies.read',
  'platform.users.read',
  'platform.plans.read',
  'platform.subscriptions.read',
  'platform.audit.read',
  'platform.support.enter_pharmacy_context'
)
WHERE r.key = 'PLATFORM_SUPPORT'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Pharmacy roles
-- -----------------------------------------------------------------------------
INSERT INTO public.roles (key, name, description, is_system)
VALUES
  ('PHARMACY_OWNER', 'Propietario', 'Propietario principal de la farmacia', true),
  ('PHARMACY_ADMIN', 'Administrador', 'Administrador de la farmacia', true),
  ('PHARMACIST', 'Farmacéutico', 'Rol operativo amplio', true),
  ('STAFF', 'Empleado', 'Rol operativo limitado', true)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system;

-- -----------------------------------------------------------------------------
-- Pharmacy permissions (11) — kernel actual; módulos futuros añadirán keys
-- -----------------------------------------------------------------------------
INSERT INTO public.permissions (key, module_key, description)
VALUES
  ('pharmacy.view', 'pharmacies', 'Ver datos básicos de la farmacia'),
  ('memberships.view', 'users', 'Ver miembros de la farmacia'),
  ('memberships.manage', 'users', 'Invitar, suspender o cambiar roles'),
  ('branding.view', 'branding', 'Ver branding'),
  ('branding.update', 'branding', 'Editar branding'),
  ('settings.view', 'pharmacies', 'Ver ajustes'),
  ('settings.update', 'pharmacies', 'Editar ajustes'),
  ('entrypoints.view', 'entrypoint_qr', 'Ver entrypoints / QR'),
  ('entrypoints.manage', 'entrypoint_qr', 'Gestionar entrypoints / QR'),
  ('activity.view', 'pharmacies', 'Ver timeline de actividad'),
  ('audit.view', 'pharmacies', 'Ver auditoría de la farmacia')
ON CONFLICT (key) DO UPDATE
SET
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'PHARMACY_OWNER'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'PHARMACY_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
INNER JOIN public.permissions p ON p.key IN (
  'pharmacy.view',
  'memberships.view',
  'branding.view',
  'settings.view',
  'settings.update',
  'entrypoints.view',
  'activity.view'
)
WHERE r.key = 'PHARMACIST'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
INNER JOIN public.permissions p ON p.key IN (
  'pharmacy.view',
  'branding.view',
  'settings.view',
  'entrypoints.view',
  'activity.view'
)
WHERE r.key = 'STAFF'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Modules (solo core del kernel)
-- -----------------------------------------------------------------------------
INSERT INTO public.modules (key, name, description, is_core, is_active)
VALUES
  ('kernel', 'Kernel', 'Capacidades base de plataforma', true, true),
  ('pharmacies', 'Farmacias', 'Gestión del tenant farmacia', true, true),
  ('users', 'Usuarios', 'Membresías y usuarios de farmacia', true, true),
  ('branding', 'Branding', 'Personalización visual', true, true),
  ('entrypoint_qr', 'QR / Entrypoints', 'Identificadores públicos y QR', true, true)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_core = EXCLUDED.is_core,
  is_active = EXCLUDED.is_active;

-- -----------------------------------------------------------------------------
-- Plans
-- -----------------------------------------------------------------------------
INSERT INTO public.plans (key, name, description, is_active, sort_order)
VALUES
  ('starter', 'Starter', 'Plan inicial para farmacias pequeñas', true, 10),
  ('pro', 'Pro', 'Plan profesional', true, 20),
  ('business', 'Business', 'Plan para redes y mayor volumen', true, 30),
  ('enterprise', 'Enterprise', 'Plan a medida', true, 40)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.plan_modules (plan_id, module_id, default_limits)
SELECT pl.id, m.id,
  CASE pl.key
    WHEN 'starter' THEN '{"max_users": 3, "max_products": 500}'::jsonb
    WHEN 'pro' THEN '{"max_users": 10, "max_products": 2000}'::jsonb
    WHEN 'business' THEN '{"max_users": 25, "max_products": 10000}'::jsonb
    WHEN 'enterprise' THEN '{"max_users": 100, "max_products": 100000}'::jsonb
    ELSE '{}'::jsonb
  END
FROM public.plans pl
CROSS JOIN public.modules m
WHERE m.key IN ('kernel', 'pharmacies', 'users', 'branding', 'entrypoint_qr')
  AND pl.key IN ('starter', 'pro', 'business', 'enterprise')
ON CONFLICT (plan_id, module_id) DO UPDATE
SET default_limits = EXCLUDED.default_limits;

COMMIT;
