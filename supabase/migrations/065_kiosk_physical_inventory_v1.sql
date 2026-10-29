-- =============================================================================
-- 065_kiosk_physical_inventory_v1.sql
-- Inventario físico de kioskos (activos permanentes KSK-NNNN).
-- Separado de pharmacy_devices (pairing runtime) y del simulador comercial.
--
-- No destructivo respecto a pairing: solo añade columna nullable
-- pharmacy_devices.kiosk_asset_id (queda NULL en filas existentes).
-- No crea activos desde pharmacy_devices; el alta es manual.
--
-- NO APLICAR en producción sin autorización expresa.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permisos plataforma
-- -----------------------------------------------------------------------------
INSERT INTO public.platform_permissions (key, module_key, description)
VALUES
  (
    'platform.kiosk_inventory.read',
    'kiosk_inventory',
    'Consultar inventario físico de kioskos, historial y coberturas'
  ),
  (
    'platform.kiosk_inventory.write',
    'kiosk_inventory',
    'Alta, estados, asignaciones y seguros del inventario físico de kioskos'
  )
ON CONFLICT (key) DO UPDATE
SET
  module_key = EXCLUDED.module_key,
  description = EXCLUDED.description;

INSERT INTO public.platform_role_permissions (platform_role_id, platform_permission_id)
SELECT r.id, p.id
FROM public.platform_roles r
CROSS JOIN public.platform_permissions p
WHERE r.key = 'PLATFORM_SUPERADMIN'
  AND p.key IN (
    'platform.kiosk_inventory.read',
    'platform.kiosk_inventory.write'
  )
ON CONFLICT DO NOTHING;

-- Soporte kioskos: técnico (inventario), sin tarifas/contratos/pagos.
INSERT INTO public.platform_role_permissions (platform_role_id, platform_permission_id)
SELECT r.id, p.id
FROM public.platform_roles r
CROSS JOIN public.platform_permissions p
WHERE r.key = 'PLATFORM_SUPPORT'
  AND p.key IN (
    'platform.kiosk_inventory.read',
    'platform.kiosk_inventory.write'
  )
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Secuencia de códigos permanentes (nunca se reutiliza)
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.kiosk_asset_code_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

COMMENT ON SEQUENCE public.kiosk_asset_code_seq IS
  'Secuencia monótona para asset_code KSK-NNNN. No reutilizar valores.';

CREATE OR REPLACE FUNCTION public.ff_kiosk_asset_next_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_n bigint;
  v_width int;
BEGIN
  v_n := nextval('public.kiosk_asset_code_seq');
  v_width := GREATEST(4, length(v_n::text));
  RETURN 'KSK-' || lpad(v_n::text, v_width, '0');
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_asset_next_code() IS
  'Genera el siguiente identificador permanente KSK-…. Solo uso interno/RPC.';

REVOKE ALL ON FUNCTION public.ff_kiosk_asset_next_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_asset_next_code()
  TO postgres, service_role;

-- -----------------------------------------------------------------------------
-- Activos físicos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kiosk_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code text NOT NULL,
  -- Serie USB ICOD («Serial» en Diagnóstico USB). Identifica el conjunto kiosko FarmaFácil
  -- (tablet + impresora viajan juntas). No es un segundo serial de tablet.
  equipment_serial text,
  model text,
  vendor text,
  received_at date,
  purchase_order_ref text,
  status text NOT NULL DEFAULT 'pending_identification',
  current_pharmacy_id uuid
    REFERENCES public.pharmacies (id) ON DELETE SET NULL,
  paired_device_id uuid
    REFERENCES public.pharmacy_devices (id) ON DELETE SET NULL,
  notes text,
  created_by uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT kiosk_assets_code_format_chk CHECK (
    asset_code ~ '^KSK-[0-9]{4,}$'
  ),
  CONSTRAINT kiosk_assets_status_chk CHECK (
    status = ANY (ARRAY[
      'pending_identification',
      'warehouse',
      'assigned',
      'repair',
      'retired'
    ])
  ),
  CONSTRAINT kiosk_assets_assigned_pharmacy_chk CHECK (
    (status = 'assigned' AND current_pharmacy_id IS NOT NULL)
    OR (status IS DISTINCT FROM 'assigned')
  ),
  CONSTRAINT kiosk_assets_equipment_serial_not_blank_chk CHECK (
    equipment_serial IS NULL OR length(btrim(equipment_serial)) > 0
  )
);

COMMENT ON TABLE public.kiosk_assets IS
  'Inventario físico de kioskos. asset_code permanente; independiente del pairing.';

COMMENT ON COLUMN public.kiosk_assets.asset_code IS
  'Identificador interno permanente (p. ej. KSK-0001). Nunca se reutiliza ni cambia.';

COMMENT ON COLUMN public.kiosk_assets.equipment_serial IS
  'Serie USB ICOD (campo Serial del Diagnóstico USB). Identifica el conjunto kiosko FarmaFácil.';

COMMENT ON COLUMN public.kiosk_assets.paired_device_id IS
  'Vínculo opcional al pharmacy_devices activo de pairing; nullable tras revoke.';

CREATE UNIQUE INDEX IF NOT EXISTS kiosk_assets_asset_code_uidx
  ON public.kiosk_assets (asset_code);

CREATE UNIQUE INDEX IF NOT EXISTS kiosk_assets_equipment_serial_uidx
  ON public.kiosk_assets (lower(btrim(equipment_serial)))
  WHERE equipment_serial IS NOT NULL;

CREATE INDEX IF NOT EXISTS kiosk_assets_status_idx
  ON public.kiosk_assets (status);

CREATE INDEX IF NOT EXISTS kiosk_assets_current_pharmacy_id_idx
  ON public.kiosk_assets (current_pharmacy_id)
  WHERE current_pharmacy_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS kiosk_assets_paired_device_id_idx
  ON public.kiosk_assets (paired_device_id)
  WHERE paired_device_id IS NOT NULL;

DROP TRIGGER IF EXISTS kiosk_assets_set_updated_at ON public.kiosk_assets;
CREATE TRIGGER kiosk_assets_set_updated_at
  BEFORE UPDATE ON public.kiosk_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

-- -----------------------------------------------------------------------------
-- Historial de asignaciones (nunca borrar al cambiar de farmacia)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kiosk_asset_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL
    REFERENCES public.kiosk_assets (id) ON DELETE RESTRICT,
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE RESTRICT,
  pharmacy_device_id uuid
    REFERENCES public.pharmacy_devices (id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  shipped_at date,
  installed_at date,
  ended_at timestamptz,
  end_reason text,
  created_by uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT kiosk_asset_assignments_ended_after_start_chk CHECK (
    ended_at IS NULL OR ended_at >= started_at
  ),
  CONSTRAINT kiosk_asset_assignments_end_reason_chk CHECK (
    (ended_at IS NULL AND end_reason IS NULL)
    OR (ended_at IS NOT NULL)
  ),
  CONSTRAINT kiosk_asset_assignments_installed_after_ship_chk CHECK (
    installed_at IS NULL
    OR shipped_at IS NULL
    OR installed_at >= shipped_at
  )
);

COMMENT ON TABLE public.kiosk_asset_assignments IS
  'Historial de vinculaciones activo↔farmacia. Una sola fila abierta por activo.';

CREATE UNIQUE INDEX IF NOT EXISTS kiosk_asset_assignments_one_open_uidx
  ON public.kiosk_asset_assignments (asset_id)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS kiosk_asset_assignments_asset_id_idx
  ON public.kiosk_asset_assignments (asset_id, started_at DESC);

CREATE INDEX IF NOT EXISTS kiosk_asset_assignments_pharmacy_id_idx
  ON public.kiosk_asset_assignments (pharmacy_id, started_at DESC);

-- -----------------------------------------------------------------------------
-- Historial de pólizas de seguro
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kiosk_asset_insurance_coverages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL
    REFERENCES public.kiosk_assets (id) ON DELETE RESTRICT,
  policy_ref text NOT NULL,
  insurer_name text,
  coverage_start date NOT NULL,
  coverage_end date,
  notes text,
  created_by uuid
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT kiosk_asset_insurance_policy_not_blank_chk CHECK (
    length(btrim(policy_ref)) > 0
  ),
  CONSTRAINT kiosk_asset_insurance_dates_chk CHECK (
    coverage_end IS NULL OR coverage_end >= coverage_start
  )
);

COMMENT ON TABLE public.kiosk_asset_insurance_coverages IS
  'Historial de coberturas de seguro por activo. Al cambiar de póliza se cierra la vigente.';

CREATE UNIQUE INDEX IF NOT EXISTS kiosk_asset_insurance_one_open_uidx
  ON public.kiosk_asset_insurance_coverages (asset_id)
  WHERE coverage_end IS NULL;

CREATE INDEX IF NOT EXISTS kiosk_asset_insurance_asset_id_idx
  ON public.kiosk_asset_insurance_coverages (asset_id, coverage_start DESC);

-- -----------------------------------------------------------------------------
-- Vínculo opcional desde pharmacy_devices → activo (no duplica pairing)
-- -----------------------------------------------------------------------------
ALTER TABLE public.pharmacy_devices
  ADD COLUMN IF NOT EXISTS kiosk_asset_id uuid
    REFERENCES public.kiosk_assets (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pharmacy_devices.kiosk_asset_id IS
  'Activo físico asociado (nullable). El pairing puede rotar; el activo permanece.';

CREATE INDEX IF NOT EXISTS pharmacy_devices_kiosk_asset_id_idx
  ON public.pharmacy_devices (kiosk_asset_id)
  WHERE kiosk_asset_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.kiosk_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_asset_insurance_coverages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kiosk_assets_select ON public.kiosk_assets;
CREATE POLICY kiosk_assets_select ON public.kiosk_assets
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.kiosk_inventory.read'));

DROP POLICY IF EXISTS kiosk_assets_insert ON public.kiosk_assets;
CREATE POLICY kiosk_assets_insert ON public.kiosk_assets
  FOR INSERT TO authenticated
  WITH CHECK (public.ff_has_platform_permission('platform.kiosk_inventory.write'));

DROP POLICY IF EXISTS kiosk_assets_update ON public.kiosk_assets;
CREATE POLICY kiosk_assets_update ON public.kiosk_assets
  FOR UPDATE TO authenticated
  USING (public.ff_has_platform_permission('platform.kiosk_inventory.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.kiosk_inventory.write'));

-- Sin DELETE: el historial y los códigos no se borran desde la app.

DROP POLICY IF EXISTS kiosk_asset_assignments_select ON public.kiosk_asset_assignments;
CREATE POLICY kiosk_asset_assignments_select ON public.kiosk_asset_assignments
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.kiosk_inventory.read'));

DROP POLICY IF EXISTS kiosk_asset_assignments_insert ON public.kiosk_asset_assignments;
CREATE POLICY kiosk_asset_assignments_insert ON public.kiosk_asset_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.ff_has_platform_permission('platform.kiosk_inventory.write'));

DROP POLICY IF EXISTS kiosk_asset_assignments_update ON public.kiosk_asset_assignments;
CREATE POLICY kiosk_asset_assignments_update ON public.kiosk_asset_assignments
  FOR UPDATE TO authenticated
  USING (public.ff_has_platform_permission('platform.kiosk_inventory.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.kiosk_inventory.write'));

DROP POLICY IF EXISTS kiosk_asset_insurance_select ON public.kiosk_asset_insurance_coverages;
CREATE POLICY kiosk_asset_insurance_select ON public.kiosk_asset_insurance_coverages
  FOR SELECT TO authenticated
  USING (public.ff_has_platform_permission('platform.kiosk_inventory.read'));

DROP POLICY IF EXISTS kiosk_asset_insurance_insert ON public.kiosk_asset_insurance_coverages;
CREATE POLICY kiosk_asset_insurance_insert ON public.kiosk_asset_insurance_coverages
  FOR INSERT TO authenticated
  WITH CHECK (public.ff_has_platform_permission('platform.kiosk_inventory.write'));

DROP POLICY IF EXISTS kiosk_asset_insurance_update ON public.kiosk_asset_insurance_coverages;
CREATE POLICY kiosk_asset_insurance_update ON public.kiosk_asset_insurance_coverages
  FOR UPDATE TO authenticated
  USING (public.ff_has_platform_permission('platform.kiosk_inventory.write'))
  WITH CHECK (public.ff_has_platform_permission('platform.kiosk_inventory.write'));

GRANT SELECT, INSERT, UPDATE ON public.kiosk_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.kiosk_asset_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.kiosk_asset_insurance_coverages TO authenticated;
GRANT ALL ON public.kiosk_assets TO service_role;
GRANT ALL ON public.kiosk_asset_assignments TO service_role;
GRANT ALL ON public.kiosk_asset_insurance_coverages TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.kiosk_asset_code_seq TO service_role;

-- -----------------------------------------------------------------------------
-- RPC: recepción de lote (N activos individuales)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_inventory_receive_batch_v1(
  p_count integer,
  p_model text DEFAULT NULL,
  p_vendor text DEFAULT NULL,
  p_received_at date DEFAULT CURRENT_DATE,
  p_purchase_order_ref text DEFAULT NULL,
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
  v_i int;
  v_serial text;
  v_id uuid;
  v_code text;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_codes text[] := ARRAY[]::text[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;
  IF NOT public.ff_has_platform_permission('platform.kiosk_inventory.write') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  IF p_count IS NULL OR p_count < 1 OR p_count > 500 THEN
    RETURN jsonb_build_object('status', 'invalid_count');
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

    v_code := public.ff_kiosk_asset_next_code();
    INSERT INTO public.kiosk_assets (
      asset_code,
      equipment_serial,
      model,
      vendor,
      received_at,
      purchase_order_ref,
      status,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      v_code,
      v_serial,
      NULLIF(btrim(COALESCE(p_model, '')), ''),
      NULLIF(btrim(COALESCE(p_vendor, '')), ''),
      COALESCE(p_received_at, CURRENT_DATE),
      NULLIF(btrim(COALESCE(p_purchase_order_ref, '')), ''),
      CASE WHEN v_serial IS NULL THEN 'pending_identification' ELSE 'warehouse' END,
      NULLIF(btrim(COALESCE(p_notes, '')), ''),
      v_uid,
      v_uid
    )
    RETURNING id INTO v_id;

    v_ids := array_append(v_ids, v_id);
    v_codes := array_append(v_codes, v_code);
  END LOOP;

  INSERT INTO public.audit_logs (
    actor_profile_id, pharmacy_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_uid,
    NULL,
    'kiosk_inventory.receive_batch',
    'kiosk_assets',
    v_ids[1]::text,
    jsonb_build_object(
      'count', p_count,
      'codes', to_jsonb(v_codes),
      'purchase_order_ref', p_purchase_order_ref,
      'model', p_model,
      'vendor', p_vendor
    )
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'count', p_count,
    'asset_ids', to_jsonb(v_ids),
    'asset_codes', to_jsonb(v_codes)
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('status', 'duplicate_serial');
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_inventory_receive_batch_v1(integer, text, text, date, text, text[], text) IS
  'Alta de N activos en almacén con códigos permanentes nuevos.';

REVOKE ALL ON FUNCTION public.ff_kiosk_inventory_receive_batch_v1(integer, text, text, date, text, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_inventory_receive_batch_v1(integer, text, text, date, text, text[], text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RPC: asignar a farmacia (cierra asignación previa si hubiera; no crea otro activo)
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
  -- El envío no exige serie: el conjunto tablet+impresora se identifica con
  -- equipment_serial cuando esté disponible, pero no bloquea la logística.

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
    updated_by = v_uid
  WHERE id = p_asset_id;

  IF p_device_id IS NOT NULL THEN
    UPDATE public.pharmacy_devices
    SET kiosk_asset_id = p_asset_id
    WHERE id = p_device_id;
  END IF;

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

REVOKE ALL ON FUNCTION public.ff_kiosk_inventory_assign_v1(uuid, uuid, uuid, text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_inventory_assign_v1(uuid, uuid, uuid, text, date, date)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RPC: desvincular (cierra asignación; no borra historial ni el activo)
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
  IF v_status NOT IN ('warehouse', 'pending_identification', 'repair', 'retired') THEN
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
    updated_by = v_uid
  WHERE id = p_asset_id;

  UPDATE public.pharmacy_devices
  SET kiosk_asset_id = NULL
  WHERE kiosk_asset_id = p_asset_id;

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

REVOKE ALL ON FUNCTION public.ff_kiosk_inventory_unassign_v1(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_inventory_unassign_v1(uuid, text, text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RPC: cambiar estado técnico (repair/retired/warehouse) sin tocar historial
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
    'pending_identification', 'warehouse', 'assigned', 'repair', 'retired'
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

  IF p_status IN ('warehouse', 'pending_identification', 'repair', 'retired')
     AND v_asset.current_pharmacy_id IS NOT NULL THEN
    -- Cierra asignación vigente; no borra historial.
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
      updated_by = v_uid
    WHERE id = p_asset_id;
  ELSE
    UPDATE public.kiosk_assets
    SET
      status = p_status,
      notes = CASE
        WHEN p_notes IS NULL OR btrim(p_notes) = '' THEN notes
        ELSE btrim(p_notes)
      END,
      updated_by = v_uid
    WHERE id = p_asset_id;
  END IF;

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

REVOKE ALL ON FUNCTION public.ff_kiosk_inventory_set_status_v1(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_inventory_set_status_v1(uuid, text, text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RPC: registrar serie del conjunto (USB ICOD) tras configuración en soporte
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_inventory_set_serials_v1(
  p_asset_id uuid,
  p_equipment_serial text DEFAULT NULL,
  p_mark_pending boolean DEFAULT false,
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
  v_serial text;
  v_new_status text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;
  IF NOT public.ff_has_platform_permission('platform.kiosk_inventory.write') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  SELECT * INTO v_asset FROM public.kiosk_assets WHERE id = p_asset_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF p_mark_pending THEN
    -- No inventar series: deja equipment_serial NULL y marca pendiente.
    UPDATE public.kiosk_assets
    SET
      equipment_serial = NULL,
      status = CASE
        WHEN status = 'assigned' THEN status
        WHEN status = 'retired' THEN status
        ELSE 'pending_identification'
      END,
      notes = CASE
        WHEN p_notes IS NULL OR btrim(p_notes) = '' THEN notes
        ELSE btrim(p_notes)
      END,
      updated_by = v_uid
    WHERE id = p_asset_id;

    INSERT INTO public.audit_logs (
      actor_profile_id, pharmacy_id, action, entity_type, entity_id, metadata
    ) VALUES (
      v_uid,
      v_asset.current_pharmacy_id,
      'kiosk_inventory.mark_pending_identification',
      'kiosk_assets',
      p_asset_id::text,
      jsonb_build_object(
        'previous_equipment_serial_cleared',
        v_asset.equipment_serial IS NOT NULL
      )
    );

    RETURN jsonb_build_object('status', 'ok', 'asset_id', p_asset_id, 'pending', true);
  END IF;

  v_serial := NULLIF(btrim(COALESCE(p_equipment_serial, '')), '');
  IF v_serial IS NULL THEN
    RETURN jsonb_build_object('status', 'serial_required');
  END IF;

  v_new_status := v_asset.status;
  IF v_asset.status = 'pending_identification' THEN
    v_new_status := 'warehouse';
  END IF;

  BEGIN
    UPDATE public.kiosk_assets
    SET
      equipment_serial = v_serial,
      status = v_new_status,
      notes = CASE
        WHEN p_notes IS NULL OR btrim(p_notes) = '' THEN notes
        ELSE btrim(p_notes)
      END,
      updated_by = v_uid
    WHERE id = p_asset_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('status', 'duplicate_serial');
  END;

  INSERT INTO public.audit_logs (
    actor_profile_id, pharmacy_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_uid,
    v_asset.current_pharmacy_id,
    'kiosk_inventory.set_serials',
    'kiosk_assets',
    p_asset_id::text,
    jsonb_build_object(
      'equipment_serial_set', true,
      'status', v_new_status
    )
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'asset_id', p_asset_id,
    'asset_status', v_new_status
  );
END;
$$;

COMMENT ON FUNCTION public.ff_kiosk_inventory_set_serials_v1(uuid, text, boolean, text) IS
  'Registra la serie USB ICOD del conjunto kiosko FarmaFácil; o marca pendiente sin inventar serie.';

REVOKE ALL ON FUNCTION public.ff_kiosk_inventory_set_serials_v1(uuid, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_inventory_set_serials_v1(uuid, text, boolean, text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RPC: asociar / cambiar póliza (cierra cobertura abierta previa)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_kiosk_inventory_set_insurance_v1(
  p_asset_id uuid,
  p_policy_ref text,
  p_insurer_name text DEFAULT NULL,
  p_coverage_start date DEFAULT CURRENT_DATE,
  p_coverage_end date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_open_id uuid;
  v_new_id uuid;
  v_start date;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;
  IF NOT public.ff_has_platform_permission('platform.kiosk_inventory.write') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  IF p_asset_id IS NULL OR NULLIF(btrim(COALESCE(p_policy_ref, '')), '') IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_input');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kiosk_assets WHERE id = p_asset_id) THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  v_start := COALESCE(p_coverage_start, CURRENT_DATE);

  SELECT id INTO v_open_id
  FROM public.kiosk_asset_insurance_coverages
  WHERE asset_id = p_asset_id AND coverage_end IS NULL
  FOR UPDATE;

  IF v_open_id IS NOT NULL THEN
    UPDATE public.kiosk_asset_insurance_coverages
    SET coverage_end = GREATEST(v_start - 1, coverage_start)
    WHERE id = v_open_id;
  END IF;

  INSERT INTO public.kiosk_asset_insurance_coverages (
    asset_id, policy_ref, insurer_name, coverage_start, coverage_end, notes, created_by
  )
  VALUES (
    p_asset_id,
    btrim(p_policy_ref),
    NULLIF(btrim(COALESCE(p_insurer_name, '')), ''),
    v_start,
    p_coverage_end,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    v_uid
  )
  RETURNING id INTO v_new_id;

  UPDATE public.kiosk_assets SET updated_by = v_uid WHERE id = p_asset_id;

  INSERT INTO public.audit_logs (
    actor_profile_id, pharmacy_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_uid,
    NULL,
    'kiosk_inventory.set_insurance',
    'kiosk_assets',
    p_asset_id::text,
    jsonb_build_object(
      'coverage_id', v_new_id,
      'policy_ref', p_policy_ref,
      'closed_previous', v_open_id IS NOT NULL
    )
  );

  RETURN jsonb_build_object('status', 'ok', 'coverage_id', v_new_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ff_kiosk_inventory_set_insurance_v1(uuid, text, text, date, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_kiosk_inventory_set_insurance_v1(uuid, text, text, date, date, text)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Sin backfill desde pharmacy_devices.
-- Las vinculaciones de pairing existentes no se tocan: kiosk_asset_id queda NULL.
-- El inventario físico se da de alta manualmente (KSK-0001, …) y se vincula
-- a farmacia / pairing técnico cuando proceda en la ficha del activo.
-- -----------------------------------------------------------------------------

-- DOWN (desarrollo):
-- DROP FUNCTION IF EXISTS public.ff_kiosk_inventory_set_insurance_v1(uuid, text, text, date, date, text);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_inventory_set_serials_v1(uuid, text, boolean, text);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_inventory_set_status_v1(uuid, text, text);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_inventory_unassign_v1(uuid, text, text);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_inventory_assign_v1(uuid, uuid, uuid, text, date, date);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_inventory_receive_batch_v1(integer, text, text, date, text, text[], text);
-- DROP FUNCTION IF EXISTS public.ff_kiosk_asset_next_code();
-- ALTER TABLE public.pharmacy_devices DROP COLUMN IF EXISTS kiosk_asset_id;
-- DROP TABLE IF EXISTS public.kiosk_asset_insurance_coverages;
-- DROP TABLE IF EXISTS public.kiosk_asset_assignments;
-- DROP TABLE IF EXISTS public.kiosk_assets;
-- DROP SEQUENCE IF EXISTS public.kiosk_asset_code_seq;
