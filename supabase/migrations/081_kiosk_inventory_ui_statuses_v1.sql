-- =============================================================================
-- 081_kiosk_inventory_ui_statuses_v1.sql
-- Añade estado «exhibition» (exposición) y tabla de historial de estados.
-- Actualiza RPC set_status y recepción de compras para marcar activos
-- recibidos como warehouse (disponible / RECIBIDO en UI).
-- Incremental. No renumera ni borra activos. Staging primero.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ampliar CHECK de estado
-- -----------------------------------------------------------------------------
ALTER TABLE public.kiosk_assets
  DROP CONSTRAINT IF EXISTS kiosk_assets_status_chk;

ALTER TABLE public.kiosk_assets
  ADD CONSTRAINT kiosk_assets_status_chk CHECK (
    status = ANY (ARRAY[
      'pending_identification',
      'warehouse',
      'assigned',
      'exhibition',
      'repair',
      'retired'
    ])
  );

COMMENT ON COLUMN public.kiosk_assets.status IS
  'pending_identification|warehouse=recibido disponible; assigned; exhibition; repair; retired. Las unidades PEDIDO (pendientes) no son filas de esta tabla.';

-- -----------------------------------------------------------------------------
-- Historial de cambios de estado
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kiosk_asset_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL
    REFERENCES public.kiosk_assets (id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  reason text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS kiosk_asset_status_events_asset_idx
  ON public.kiosk_asset_status_events (asset_id, created_at DESC);

ALTER TABLE public.kiosk_asset_status_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kiosk_asset_status_events_select ON public.kiosk_asset_status_events;
CREATE POLICY kiosk_asset_status_events_select ON public.kiosk_asset_status_events
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.kiosk_inventory.read'));

DROP POLICY IF EXISTS kiosk_asset_status_events_insert ON public.kiosk_asset_status_events;
CREATE POLICY kiosk_asset_status_events_insert ON public.kiosk_asset_status_events
  FOR INSERT TO authenticated
  WITH CHECK (public.ff_has_platform_permission('platform.kiosk_inventory.write'));

GRANT SELECT, INSERT ON public.kiosk_asset_status_events TO authenticated;

-- -----------------------------------------------------------------------------
-- set_status: permite exhibition + escribe historial
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_inventory_set_status_v1(
  p_asset_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_asset public.kiosk_assets%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;
  IF NOT public.ff_has_platform_permission('platform.kiosk_inventory.write') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  IF p_status IS NULL OR p_status NOT IN (
    'pending_identification', 'warehouse', 'assigned', 'exhibition', 'repair', 'retired'
  ) THEN
    RETURN jsonb_build_object('status', 'invalid_status');
  END IF;

  SELECT * INTO v_asset FROM public.kiosk_assets WHERE id = p_asset_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF p_status = 'assigned' AND v_asset.current_pharmacy_id IS NULL THEN
    RETURN jsonb_build_object('status', 'needs_assignment');
  END IF;

  -- exhibition / warehouse / repair / retired / pending: cierran asignación si había farmacia
  IF p_status IN (
       'warehouse', 'pending_identification', 'repair', 'retired', 'exhibition'
     )
     AND v_asset.current_pharmacy_id IS NOT NULL THEN
    UPDATE public.kiosk_asset_assignments
    SET ended_at = pg_catalog.now(),
        end_reason = 'status:' || p_status
    WHERE asset_id = p_asset_id AND ended_at IS NULL;

    UPDATE public.pharmacy_devices
    SET kiosk_asset_id = NULL
    WHERE kiosk_asset_id = p_asset_id;

    UPDATE public.kiosk_assets
    SET
      status = p_status,
      current_pharmacy_id = NULL,
      paired_device_id = NULL,
      notes = CASE
        WHEN p_notes IS NULL OR btrim(p_notes) = '' THEN notes
        ELSE btrim(p_notes)
      END,
      updated_by = v_uid,
      updated_at = pg_catalog.now()
    WHERE id = p_asset_id;
  ELSE
    UPDATE public.kiosk_assets
    SET
      status = p_status,
      notes = CASE
        WHEN p_notes IS NULL OR btrim(p_notes) = '' THEN notes
        ELSE btrim(p_notes)
      END,
      updated_by = v_uid,
      updated_at = pg_catalog.now()
    WHERE id = p_asset_id;
  END IF;

  INSERT INTO public.kiosk_asset_status_events (
    asset_id, from_status, to_status, reason, created_by
  ) VALUES (
    p_asset_id, v_asset.status, p_status,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    v_uid
  );

  INSERT INTO public.audit_logs (
    actor_profile_id, pharmacy_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_uid,
    v_asset.current_pharmacy_id,
    'kiosk_inventory.set_status',
    'kiosk_assets',
    p_asset_id::text,
    jsonb_build_object('from', v_asset.status, 'to', p_status)
  );

  RETURN jsonb_build_object('status', 'ok', 'asset_id', p_asset_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- assign: escribe historial de estado al pasar a assigned
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_inventory_assign_v1(
  p_asset_id uuid,
  p_pharmacy_id uuid,
  p_device_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_shipped_at date DEFAULT NULL,
  p_installed_at date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_asset public.kiosk_assets%ROWTYPE;
  v_open_id uuid;
  v_shipped date;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;
  IF NOT public.ff_has_platform_permission('platform.kiosk_inventory.write') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  IF p_asset_id IS NULL OR p_pharmacy_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pharmacies WHERE id = p_pharmacy_id) THEN
    RETURN jsonb_build_object('status', 'pharmacy_not_found');
  END IF;

  SELECT * INTO v_asset FROM public.kiosk_assets WHERE id = p_asset_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_asset.status = 'retired' THEN
    RETURN jsonb_build_object('status', 'retired');
  END IF;

  IF p_device_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pharmacy_devices d
      WHERE d.id = p_device_id
        AND d.pharmacy_id = p_pharmacy_id
        AND d.status = 'active'
    ) THEN
      RETURN jsonb_build_object('status', 'device_mismatch');
    END IF;
  END IF;

  v_shipped := COALESCE(p_shipped_at, CURRENT_DATE);
  IF p_installed_at IS NOT NULL AND p_installed_at < v_shipped THEN
    RETURN jsonb_build_object('status', 'invalid_dates');
  END IF;

  SELECT id INTO v_open_id
  FROM public.kiosk_asset_assignments
  WHERE asset_id = p_asset_id AND ended_at IS NULL
  FOR UPDATE;

  IF v_open_id IS NOT NULL THEN
    UPDATE public.kiosk_asset_assignments
    SET ended_at = pg_catalog.now(),
        end_reason = 'reassigned'
    WHERE id = v_open_id;
  END IF;

  INSERT INTO public.kiosk_asset_assignments (
    asset_id, pharmacy_id, pharmacy_device_id, shipped_at, installed_at, created_by
  )
  VALUES (p_asset_id, p_pharmacy_id, p_device_id, v_shipped, p_installed_at, v_uid);

  UPDATE public.kiosk_assets
  SET
    status = 'assigned',
    current_pharmacy_id = p_pharmacy_id,
    paired_device_id = COALESCE(p_device_id, paired_device_id),
    notes = CASE
      WHEN p_notes IS NULL OR btrim(p_notes) = '' THEN notes
      ELSE btrim(p_notes)
    END,
    updated_by = v_uid,
    updated_at = pg_catalog.now()
  WHERE id = p_asset_id;

  IF p_device_id IS NOT NULL THEN
    UPDATE public.pharmacy_devices
    SET kiosk_asset_id = p_asset_id
    WHERE id = p_device_id;
  END IF;

  INSERT INTO public.kiosk_asset_status_events (
    asset_id, from_status, to_status, reason, created_by
  ) VALUES (
    p_asset_id, v_asset.status, 'assigned',
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    v_uid
  );

  INSERT INTO public.audit_logs (
    actor_profile_id, pharmacy_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_uid,
    p_pharmacy_id,
    'kiosk_inventory.assign',
    'kiosk_assets',
    p_asset_id::text,
    jsonb_build_object(
      'pharmacy_id', p_pharmacy_id,
      'device_id', p_device_id,
      'previous_open_closed', v_open_id IS NOT NULL
    )
  );

  RETURN jsonb_build_object('status', 'ok', 'asset_id', p_asset_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- unassign: permite next_status exhibition + historial
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_inventory_unassign_v1(
  p_asset_id uuid,
  p_end_reason text DEFAULT 'unassigned',
  p_next_status text DEFAULT 'warehouse'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_asset public.kiosk_assets%ROWTYPE;
  v_open_id uuid;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;
  IF NOT public.ff_has_platform_permission('platform.kiosk_inventory.write') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  v_status := COALESCE(NULLIF(btrim(p_next_status), ''), 'warehouse');
  IF v_status NOT IN (
    'warehouse', 'pending_identification', 'exhibition', 'repair', 'retired'
  ) THEN
    RETURN jsonb_build_object('status', 'invalid_status');
  END IF;

  SELECT * INTO v_asset FROM public.kiosk_assets WHERE id = p_asset_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT id INTO v_open_id
  FROM public.kiosk_asset_assignments
  WHERE asset_id = p_asset_id AND ended_at IS NULL
  FOR UPDATE;

  IF v_open_id IS NOT NULL THEN
    UPDATE public.kiosk_asset_assignments
    SET ended_at = pg_catalog.now(),
        end_reason = COALESCE(NULLIF(btrim(p_end_reason), ''), 'unassigned')
    WHERE id = v_open_id;
  END IF;

  UPDATE public.kiosk_assets
  SET
    status = v_status,
    current_pharmacy_id = NULL,
    paired_device_id = NULL,
    updated_by = v_uid,
    updated_at = pg_catalog.now()
  WHERE id = p_asset_id;

  UPDATE public.pharmacy_devices
  SET kiosk_asset_id = NULL
  WHERE kiosk_asset_id = p_asset_id;

  INSERT INTO public.kiosk_asset_status_events (
    asset_id, from_status, to_status, reason, created_by
  ) VALUES (
    p_asset_id, v_asset.status, v_status,
    COALESCE(NULLIF(btrim(p_end_reason), ''), 'unassigned'),
    v_uid
  );

  INSERT INTO public.audit_logs (
    actor_profile_id, pharmacy_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_uid,
    v_asset.current_pharmacy_id,
    'kiosk_inventory.unassign',
    'kiosk_assets',
    p_asset_id::text,
    jsonb_build_object(
      'end_reason', p_end_reason,
      'next_status', v_status,
      'had_open_assignment', v_open_id IS NOT NULL
    )
  );

  RETURN jsonb_build_object('status', 'ok', 'asset_id', p_asset_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- Recepción desde compra: activos nuevos → warehouse (RECIBIDO en UI)
-- (misma firma que 076; no crea KSK al confirmar pedido)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_purchase_receive_v1(
  p_purchase_order_id uuid,
  p_count integer,
  p_received_at date DEFAULT CURRENT_DATE,
  p_serials text[] DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_po public.kiosk_purchase_orders%ROWTYPE;
  v_remaining int;
  v_i int;
  v_serial text;
  v_id uuid;
  v_code text;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_codes text[] := ARRAY[]::text[];
  v_receipt_id uuid;
  v_status text;
  v_asset_status text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;
  IF NOT (
    public.ff_has_platform_permission('platform.kiosk_inventory.write')
    OR public.ff_has_platform_permission('platform.kiosk_purchasing.write')
  ) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  SELECT * INTO v_po
  FROM public.kiosk_purchase_orders
  WHERE id = p_purchase_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_po.status = 'cancelado' THEN
    RETURN jsonb_build_object('status', 'cancelled');
  END IF;
  IF p_count IS NULL OR p_count < 1 OR p_count > 500 THEN
    RETURN jsonb_build_object('status', 'invalid_count');
  END IF;

  v_remaining := v_po.quantity - v_po.received_quantity;
  IF p_count > v_remaining THEN
    RETURN jsonb_build_object(
      'status', 'exceeds_remaining',
      'remaining', v_remaining
    );
  END IF;
  IF p_serials IS NOT NULL AND cardinality(p_serials) > 0
     AND cardinality(p_serials) IS DISTINCT FROM p_count THEN
    RETURN jsonb_build_object('status', 'serials_count_mismatch');
  END IF;

  FOR v_i IN 1..p_count LOOP
    v_serial := NULL;
    IF p_serials IS NOT NULL AND cardinality(p_serials) >= v_i THEN
      v_serial := NULLIF(btrim(p_serials[v_i]), '');
    END IF;

    -- Con serie → warehouse; sin serie → pending_identification (ambos = RECIBIDO en UI).
    v_asset_status := CASE
      WHEN v_serial IS NULL THEN 'pending_identification'
      ELSE 'warehouse'
    END;

    v_code := public.ff_kiosk_asset_next_code();
    INSERT INTO public.kiosk_assets (
      asset_code, equipment_serial, model, vendor, received_at,
      purchase_order_ref, purchase_order_id, status, notes, created_by, updated_by
    ) VALUES (
      v_code,
      v_serial,
      v_po.model,
      v_po.supplier_name,
      COALESCE(p_received_at, CURRENT_DATE),
      v_po.order_number,
      v_po.id,
      v_asset_status,
      NULLIF(btrim(COALESCE(p_notes, '')), ''),
      v_uid,
      v_uid
    )
    RETURNING id INTO v_id;

    INSERT INTO public.kiosk_asset_status_events (
      asset_id, from_status, to_status, reason, created_by
    ) VALUES (
      v_id, NULL, v_asset_status, 'Recepción de compra', v_uid
    );

    v_ids := array_append(v_ids, v_id);
    v_codes := array_append(v_codes, v_code);
  END LOOP;

  UPDATE public.kiosk_purchase_orders
  SET
    received_quantity = received_quantity + p_count,
    updated_by = v_uid,
    updated_at = pg_catalog.now()
  WHERE id = v_po.id;

  v_status := public.ff_kiosk_po_refresh_status(v_po.id);

  INSERT INTO public.kiosk_purchase_receipts (
    purchase_order_id, quantity, received_at, asset_ids, notes, created_by
  ) VALUES (
    v_po.id, p_count, COALESCE(p_received_at, CURRENT_DATE), v_ids,
    NULLIF(btrim(COALESCE(p_notes, '')), ''), v_uid
  )
  RETURNING id INTO v_receipt_id;

  INSERT INTO public.audit_logs (
    actor_profile_id, pharmacy_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_uid, NULL, 'kiosk_purchasing.receive', 'kiosk_purchase_orders', v_po.id::text,
    jsonb_build_object(
      'receipt_id', v_receipt_id,
      'count', p_count,
      'codes', to_jsonb(v_codes),
      'status', v_status
    )
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'count', p_count,
    'asset_ids', to_jsonb(v_ids),
    'asset_codes', to_jsonb(v_codes),
    'receipt_id', v_receipt_id,
    'order_status', v_status,
    'remaining', (v_po.quantity - v_po.received_quantity - p_count)
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('status', 'duplicate_serial');
END;
$$;
