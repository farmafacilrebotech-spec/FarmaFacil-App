-- =============================================================================
-- 015_pharmacy_management_table_grants.sql
-- GRANT mínimos para el flujo V1 de alta/gestión de farmacias (SuperAdmin).
--
-- Alcance V1:
--   - Resolver plan: SELECT plans, modules, plan_modules
--   - CRUD parcial: pharmacies, pharmacy_branding, pharmacy_settings,
--     subscriptions, pharmacy_entitlements (SELECT/INSERT/UPDATE)
--
-- Fuera de alcance (sin GRANT aquí):
--   - public_entrypoints
--   - pharmacy_memberships
--   - DELETE / ALL / privilegios a anon
--
-- No toca RLS ni policies. La autorización sigue en RBAC + RLS.
-- Los helpers SECURITY DEFINER (ff_*) ya encapsulan lecturas de
-- platform_* / memberships; las policies de estas tablas no hacen
-- FROM/JOIN directos a otras tablas → no se requieren GRANT adicionales
-- solo para evaluar policies (a diferencia del caso profiles en 014).
-- =============================================================================

-- Catálogo comercial (solo lectura para resolver plan_id y módulos del plan)
GRANT SELECT ON TABLE public.plans TO authenticated;
GRANT SELECT ON TABLE public.modules TO authenticated;
GRANT SELECT ON TABLE public.plan_modules TO authenticated;

-- Tenant farmacia
GRANT SELECT, INSERT, UPDATE ON TABLE public.pharmacies TO authenticated;

-- Configuración inicial 1:1
GRANT SELECT, INSERT, UPDATE ON TABLE public.pharmacy_branding TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.pharmacy_settings TO authenticated;

-- Comercial / entitlements
GRANT SELECT, INSERT, UPDATE ON TABLE public.subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.pharmacy_entitlements TO authenticated;
