-- =============================================================================
-- RECOVERY / DOWN for 071_dual_role_customer_staff_v1
-- =============================================================================
-- SOLO tras autorización. Idempotente en la medida de lo posible.
-- NO elimina memberships, platform_user_roles, direcciones, pedidos ni
-- customer_saved_pharmacies.
--
-- LIMITACIÓN DEL MODELO XOR (staff|customer):
--   Un usuario `both` representa DOS capacidades a la vez (panel + cliente).
--   El CHECK anterior solo admite UNA. Cualquier conversión both→staff o
--   both→customer IMPLICA pérdida de una de las dos áreas en el modelo de
--   datos / gates de aplicación.
--
-- POR TANTO: si existen filas both, el rollback completo a XOR queda
-- BLOQUEADO. Preferir recuperación hacia delante (permanecer en 071 y
-- parchear). Ver 071_APPLY_PROCEDURE.md § Recovery.
-- =============================================================================

DO $$
DECLARE
  v_both bigint;
BEGIN
  SELECT count(*) INTO v_both
  FROM public.profiles
  WHERE account_kind = 'both';

  IF v_both > 0 THEN
    RAISE EXCEPTION
      '071 DOWN bloqueado: % perfil(es) con account_kind=both. El modelo XOR no puede representarlos sin perder panel o área cliente. No se degrada en silencio. Use recuperación hacia delante (docs/migrations/071_APPLY_PROCEDURE.md).',
      v_both;
  END IF;

  RAISE NOTICE '071 DOWN: 0 perfiles both — se puede retirar objetos 071 sin conversión de account_kind.';
END $$;

-- -----------------------------------------------------------------------------
-- Retirada de objetos introducidos solo por 071 (seguro si no hay both)
-- -----------------------------------------------------------------------------
-- Requiere que NINGUNA policy/RPC 071-updated quede dependiendo del helper
-- antes de dropear. Restaurar cuerpos 064/067 DESPUÉS de este bloque fallará
-- a medias si se interrumpe: ejecutar en transacción y verificar.

DROP FUNCTION IF EXISTS public.ff_customer_enable_self_v1(boolean, boolean, text, text, text);
DROP FUNCTION IF EXISTS public.ff_profile_is_customer_kind(text);

-- Restaurar CHECK XOR solo si no hay both (ya garantizado arriba) ni valor 'both'.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE account_kind NOT IN ('staff', 'customer')
  ) THEN
    RAISE EXCEPTION '071 DOWN: valores account_kind fuera de staff|customer; abortado.';
  END IF;

  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_kind_chk;
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_account_kind_chk CHECK (
      account_kind = ANY (ARRAY['staff', 'customer'])
    );
END $$;

-- -----------------------------------------------------------------------------
-- OBLIGATORIO a continuación (manual / script):
-- Re-aplicar secciones de 064 y 067 para:
--   ff_handle_new_user, ff_profiles_protect_account_kind,
--   ff_customer_claim_order_v1, save/unsave/list pharmacies,
--   policies customer_addresses_insert_own / saved_pharmacies_*,
--   ff_accept_pharmacy_membership_v1 (versión 024 sin customer→both).
-- Sin ese paso, policies que llamaban ff_profile_is_customer_kind quedan rotas
-- (ya dropeada) — por eso este DOWN solo es válido si se completa la restauración.
--
-- Índice teléfono (opcional, alinear con 064):
-- DROP INDEX IF EXISTS public.profiles_phone_customer_idx;
-- CREATE INDEX IF NOT EXISTS profiles_phone_customer_idx ON public.profiles (phone)
--   WHERE account_kind = 'customer' AND phone IS NOT NULL;
--
-- Degradación silenciosa both→staff/customer: PROHIBIDA en este procedimiento.
-- =============================================================================
