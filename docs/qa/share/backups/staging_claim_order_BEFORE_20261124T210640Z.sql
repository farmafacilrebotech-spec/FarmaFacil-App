-- backup ff_customer_claim_order_v1 @ staging 2026-11-24 21:06:40.819925+00

CREATE OR REPLACE FUNCTION public.ff_customer_claim_order_v1(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.pharmacy_orders%ROWTYPE;
  v_phone text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid AND public.ff_profile_is_customer_kind(p.account_kind)
  ) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  SELECT * INTO v_order
  FROM public.pharmacy_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_order.customer_profile_id IS NOT NULL THEN
    IF v_order.customer_profile_id = v_uid THEN
      RETURN jsonb_build_object('status', 'ok', 'already', true);
    END IF;
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  SELECT phone INTO v_phone FROM public.profiles WHERE id = v_uid;
  IF v_phone IS NULL OR v_order.customer_phone IS NULL
     OR regexp_replace(v_phone, '[^0-9]', '', 'g')
        IS DISTINCT FROM regexp_replace(v_order.customer_phone, '[^0-9]', '', 'g')
  THEN
    RETURN jsonb_build_object('status', 'phone_mismatch');
  END IF;

  UPDATE public.pharmacy_orders
  SET customer_profile_id = v_uid,
      updated_at = pg_catalog.now()
  WHERE id = p_order_id
    AND customer_profile_id IS NULL;

  RETURN jsonb_build_object('status', 'ok', 'order_id', p_order_id);
END;
$function$
;

