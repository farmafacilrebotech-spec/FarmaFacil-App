-- Ajusta RLS del emisor a permisos existentes (settings.manage no está en catálogo).

DROP POLICY IF EXISTS platform_issuer_profile_sa_select ON public.platform_issuer_profile;
DROP POLICY IF EXISTS platform_issuer_profile_sa_write ON public.platform_issuer_profile;
DROP POLICY IF EXISTS platform_issuer_audit_sa_select ON public.platform_issuer_profile_audit;

CREATE POLICY platform_issuer_profile_sa_select
  ON public.platform_issuer_profile FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_has_platform_permission('platform.subscriptions.manage')
  );

CREATE POLICY platform_issuer_profile_sa_write
  ON public.platform_issuer_profile FOR ALL TO authenticated
  USING (public.ff_has_platform_permission('platform.subscriptions.manage'))
  WITH CHECK (public.ff_has_platform_permission('platform.subscriptions.manage'));

CREATE POLICY platform_issuer_audit_sa_select
  ON public.platform_issuer_profile_audit FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.subscriptions.manage'));
