-- =============================================================================
-- 082_kiosk_status_notes_append_v1.sql
-- Al cambiar estado, las notas nuevas se ANEXAN al historial (no lo borran).
-- El motivo del evento de auditoría sigue siendo solo la línea nueva.
-- Incremental. No reescribe 081. No renumera ni borra activos.
-- =============================================================================

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
  v_note text := NULLIF(btrim(COALESCE(p_notes, '')), '');
  v_notes_next text;
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

  IF v_note IS NULL THEN
    v_notes_next := v_asset.notes;
  ELSIF v_asset.notes IS NULL OR btrim(v_asset.notes) = '' THEN
    v_notes_next := v_note;
  ELSE
    v_notes_next := btrim(v_asset.notes) || E'\n' || v_note;
  END IF;

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
      notes = v_notes_next,
      updated_by = v_uid,
      updated_at = pg_catalog.now()
    WHERE id = p_asset_id;
  ELSE
    UPDATE public.kiosk_assets
    SET
      status = p_status,
      notes = v_notes_next,
      updated_by = v_uid,
      updated_at = pg_catalog.now()
    WHERE id = p_asset_id;
  END IF;

  INSERT INTO public.kiosk_asset_status_events (
    asset_id, from_status, to_status, reason, created_by
  ) VALUES (
    p_asset_id, v_asset.status, p_status, v_note, v_uid
  );

  INSERT INTO public.audit_logs (
    actor_profile_id, pharmacy_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_uid,
    v_asset.current_pharmacy_id,
    'kiosk_inventory.set_status',
    'kiosk_assets',
    p_asset_id::text,
    jsonb_build_object('from', v_asset.status, 'to', p_status, 'note', v_note)
  );

  RETURN jsonb_build_object('status', 'ok', 'asset_id', p_asset_id);
END;
$$;
