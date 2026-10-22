-- =============================================================================
-- 054_master_catalog_generic_v1.sql
-- Catálogo maestro genérico FF-GEN-001..100 + modalidad generic|own.
--
-- Alcance:
--   - Tabla central ff_master_catalog_products (100 tipos, sin marca/precio/imagen)
--   - pharmacy_settings.catalog_mode (generic|own)
--   - pharmacy_products: source+=generic, subcategory, availability_status,
--     master_catalog_id; protección anti-edición de genéricos por farmacia
--   - RPCs: attach / sync / set_catalog_mode (sin DELETE masivo)
--
-- NO APLICAR sin autorización. No toca staging/prod desde este archivo solo.
-- Depende de: 020, 022, 009 (pharmacy_settings), 050/051 (comercial, opcional wire en 055).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Maestro central
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ff_master_catalog_products (
  id text PRIMARY KEY,
  category_id text NOT NULL,
  category_name text NOT NULL,
  subcategory_name text NOT NULL,
  generic_product_type text NOT NULL,
  record_type text NOT NULL DEFAULT 'generic_request_type',
  availability_status text NOT NULL DEFAULT 'confirm_with_pharmacy',
  active_standard_catalog boolean NOT NULL DEFAULT true,
  available_in_plans text[] NOT NULL DEFAULT ARRAY['pilot','general']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ff_master_catalog_id_ff_gen_chk CHECK (id ~ '^FF-GEN-[0-9]{3}$'),
  CONSTRAINT ff_master_catalog_record_type_chk CHECK (record_type = 'generic_request_type'),
  CONSTRAINT ff_master_catalog_availability_chk CHECK (
    availability_status = ANY (ARRAY['confirm_with_pharmacy', 'available', 'unavailable'])
  ),
  CONSTRAINT ff_master_catalog_name_not_blank_chk CHECK (length(btrim(generic_product_type)) > 0),
  CONSTRAINT ff_master_catalog_category_not_blank_chk CHECK (
    length(btrim(category_id)) > 0 AND length(btrim(category_name)) > 0
  ),
  CONSTRAINT ff_master_catalog_subcategory_not_blank_chk CHECK (
    length(btrim(subcategory_name)) > 0
  )
);

COMMENT ON TABLE public.ff_master_catalog_products IS
  'Catálogo maestro genérico FarmaFácil (FF-GEN-*). Sin marcas, precios ni stock. Solo SuperAdmin escribe.';

CREATE INDEX IF NOT EXISTS ff_master_catalog_category_idx
  ON public.ff_master_catalog_products (category_id);

CREATE INDEX IF NOT EXISTS ff_master_catalog_active_idx
  ON public.ff_master_catalog_products (active_standard_catalog)
  WHERE active_standard_catalog;

CREATE TRIGGER ff_master_catalog_products_set_updated_at
  BEFORE UPDATE ON public.ff_master_catalog_products
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

ALTER TABLE public.ff_master_catalog_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ff_master_catalog_select ON public.ff_master_catalog_products;
CREATE POLICY ff_master_catalog_select ON public.ff_master_catalog_products
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_platform_permission('platform.commercial_trials.manage')
  );

DROP POLICY IF EXISTS ff_master_catalog_write ON public.ff_master_catalog_products;
CREATE POLICY ff_master_catalog_write ON public.ff_master_catalog_products
  FOR ALL TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.write')
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.pharmacies.write')
  );

GRANT SELECT ON TABLE public.ff_master_catalog_products TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.ff_master_catalog_products TO authenticated;
-- Sin DELETE: el maestro se desactiva con active_standard_catalog=false.

INSERT INTO public.ff_master_catalog_products (
  id, category_id, category_name, subcategory_name, generic_product_type,
  record_type, availability_status, active_standard_catalog, available_in_plans
) VALUES
  ('FF-GEN-001', 'cuidado_facial', 'Cuidado facial', 'Limpieza facial', 'Limpiador facial suave para piel normal o seca', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-002', 'cuidado_facial', 'Cuidado facial', 'Limpieza facial', 'Limpiador facial para piel mixta o grasa', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-003', 'cuidado_facial', 'Cuidado facial', 'Limpieza facial', 'Agua micelar', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-004', 'cuidado_facial', 'Cuidado facial', 'Limpieza facial', 'Desmaquillante de ojos', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-005', 'cuidado_facial', 'Cuidado facial', 'Limpieza facial', 'Aceite o bálsamo limpiador facial', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-006', 'cuidado_facial', 'Cuidado facial', 'Limpieza facial', 'Tónico facial', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-007', 'cuidado_facial', 'Cuidado facial', 'Hidratación facial', 'Hidratante facial de textura ligera', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-008', 'cuidado_facial', 'Cuidado facial', 'Hidratación facial', 'Hidratante facial de textura rica', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-009', 'cuidado_facial', 'Cuidado facial', 'Hidratación facial', 'Hidratante facial para piel sensible', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-010', 'cuidado_facial', 'Cuidado facial', 'Hidratación facial', 'Hidratante facial para piel mixta o grasa', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-011', 'cuidado_facial', 'Cuidado facial', 'Cuidado cosmético específico', 'Sérum facial hidratante', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-012', 'cuidado_facial', 'Cuidado facial', 'Cuidado cosmético específico', 'Sérum facial con vitamina C', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-013', 'cuidado_facial', 'Cuidado facial', 'Cuidado cosmético específico', 'Contorno de ojos', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-014', 'cuidado_facial', 'Cuidado facial', 'Cuidado cosmético específico', 'Bálsamo labial sin protección solar', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-015', 'cuidado_facial', 'Cuidado facial', 'Cuidado cosmético específico', 'Exfoliante facial suave', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-016', 'cuidado_corporal_higiene', 'Cuidado corporal e higiene', 'Baño y ducha', 'Gel de ducha de uso diario', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-017', 'cuidado_corporal_higiene', 'Cuidado corporal e higiene', 'Baño y ducha', 'Limpiador corporal sin jabón', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-018', 'cuidado_corporal_higiene', 'Cuidado corporal e higiene', 'Baño y ducha', 'Aceite de baño o ducha', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-019', 'cuidado_corporal_higiene', 'Cuidado corporal e higiene', 'Hidratación corporal', 'Loción corporal', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-020', 'cuidado_corporal_higiene', 'Cuidado corporal e higiene', 'Hidratación corporal', 'Crema corporal', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-021', 'cuidado_corporal_higiene', 'Cuidado corporal e higiene', 'Hidratación corporal', 'Bálsamo corporal', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-022', 'cuidado_corporal_higiene', 'Cuidado corporal e higiene', 'Manos y pies', 'Crema de manos', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-023', 'cuidado_corporal_higiene', 'Cuidado corporal e higiene', 'Manos y pies', 'Crema para pies', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-024', 'cuidado_corporal_higiene', 'Cuidado corporal e higiene', 'Desodorantes', 'Desodorante en roll-on', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-025', 'cuidado_corporal_higiene', 'Cuidado corporal e higiene', 'Desodorantes', 'Desodorante en spray', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-026', 'cuidado_corporal_higiene', 'Cuidado corporal e higiene', 'Higiene íntima', 'Producto de higiene íntima de uso externo', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-027', 'cuidado_corporal_higiene', 'Cuidado corporal e higiene', 'Higiene íntima', 'Toallitas de higiene íntima', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-028', 'cuidado_corporal_higiene', 'Cuidado corporal e higiene', 'Higiene complementaria', 'Jabón de manos', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-029', 'cuidado_corporal_higiene', 'Cuidado corporal e higiene', 'Higiene complementaria', 'Toallitas húmedas de uso general', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-030', 'cuidado_corporal_higiene', 'Cuidado corporal e higiene', 'Afeitado', 'Producto cosmético para el cuidado después del afeitado', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-031', 'proteccion_solar', 'Protección solar', 'Protección facial', 'Protector solar facial de uso diario SPF 50+', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-032', 'proteccion_solar', 'Protección solar', 'Protección facial', 'Protector solar facial de textura ligera SPF 50+', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-033', 'proteccion_solar', 'Protección solar', 'Protección facial', 'Protector solar facial con color SPF 50+', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-034', 'proteccion_solar', 'Protección solar', 'Protección corporal', 'Protector solar corporal en crema o loción', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-035', 'proteccion_solar', 'Protección solar', 'Protección corporal', 'Protector solar corporal en spray', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-036', 'proteccion_solar', 'Protección solar', 'Protección corporal', 'Protector solar corporal SPF 30', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-037', 'proteccion_solar', 'Protección solar', 'Protección infantil', 'Protector solar infantil en crema o loción', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-038', 'proteccion_solar', 'Protección solar', 'Protección infantil', 'Protector solar infantil en spray', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-039', 'proteccion_solar', 'Protección solar', 'Formatos específicos', 'Protector solar en formato stick', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-040', 'proteccion_solar', 'Protección solar', 'Formatos específicos', 'Bálsamo labial con protección solar', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-041', 'proteccion_solar', 'Protección solar', 'Formatos específicos', 'Protector solar para el cuero cabelludo o la raya del pelo', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-042', 'proteccion_solar', 'Protección solar', 'Después del sol', 'Producto hidratante para después del sol', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-043', 'higiene_bucodental', 'Higiene bucodental', 'Cepillos dentales', 'Cepillo dental manual para adulto', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-044', 'higiene_bucodental', 'Higiene bucodental', 'Cepillos dentales', 'Cepillo dental manual infantil', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-045', 'higiene_bucodental', 'Higiene bucodental', 'Cepillos dentales', 'Recambios para cepillo eléctrico', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-046', 'higiene_bucodental', 'Higiene bucodental', 'Pastas dentales', 'Pasta dental de uso diario', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-047', 'higiene_bucodental', 'Higiene bucodental', 'Pastas dentales', 'Pasta dental para dientes sensibles', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-048', 'higiene_bucodental', 'Higiene bucodental', 'Pastas dentales', 'Pasta dental infantil', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-049', 'higiene_bucodental', 'Higiene bucodental', 'Limpieza interdental y complementaria', 'Colutorio de uso diario', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-050', 'higiene_bucodental', 'Higiene bucodental', 'Limpieza interdental y complementaria', 'Hilo dental', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-051', 'higiene_bucodental', 'Higiene bucodental', 'Limpieza interdental y complementaria', 'Cepillos interdentales', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-052', 'higiene_bucodental', 'Higiene bucodental', 'Limpieza interdental y complementaria', 'Limpiador lingual', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-053', 'higiene_bucodental', 'Higiene bucodental', 'Accesorios', 'Irrigador bucal', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-054', 'higiene_bucodental', 'Higiene bucodental', 'Ortodoncia', 'Cera para ortodoncia', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-055', 'cuidado_capilar', 'Cuidado capilar', 'Champús', 'Champú de uso frecuente', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-056', 'cuidado_capilar', 'Cuidado capilar', 'Champús', 'Champú para cabello seco', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-057', 'cuidado_capilar', 'Cuidado capilar', 'Champús', 'Champú para cabello graso', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-058', 'cuidado_capilar', 'Cuidado capilar', 'Champús', 'Champú para cabello teñido', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-059', 'cuidado_capilar', 'Cuidado capilar', 'Acondicionamiento', 'Acondicionador', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-060', 'cuidado_capilar', 'Cuidado capilar', 'Acondicionamiento', 'Mascarilla capilar', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-061', 'cuidado_capilar', 'Cuidado capilar', 'Acondicionamiento', 'Acondicionador sin aclarado', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-062', 'cuidado_capilar', 'Cuidado capilar', 'Acondicionamiento', 'Sérum o aceite para el cabello', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-063', 'cuidado_capilar', 'Cuidado capilar', 'Accesorios', 'Cepillo o peine para el cabello', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-064', 'bebe_maternidad', 'Bebé y maternidad', 'Higiene infantil', 'Gel de baño infantil', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-065', 'bebe_maternidad', 'Bebé y maternidad', 'Higiene infantil', 'Champú infantil', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-066', 'bebe_maternidad', 'Bebé y maternidad', 'Higiene infantil', 'Toallitas infantiles', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-067', 'bebe_maternidad', 'Bebé y maternidad', 'Higiene infantil', 'Bastoncillos infantiles', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-068', 'bebe_maternidad', 'Bebé y maternidad', 'Cuidado de la piel', 'Crema hidratante infantil', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-069', 'bebe_maternidad', 'Bebé y maternidad', 'Cambio de pañal', 'Crema para el cambio de pañal', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-070', 'bebe_maternidad', 'Bebé y maternidad', 'Cambio de pañal', 'Pañales', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-071', 'bebe_maternidad', 'Bebé y maternidad', 'Alimentación infantil', 'Chupete', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-072', 'bebe_maternidad', 'Bebé y maternidad', 'Alimentación infantil', 'Biberón', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-073', 'bebe_maternidad', 'Bebé y maternidad', 'Alimentación infantil', 'Tetina de recambio', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-074', 'bebe_maternidad', 'Bebé y maternidad', 'Lactancia', 'Discos absorbentes de lactancia', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-075', 'bebe_maternidad', 'Bebé y maternidad', 'Lactancia', 'Crema para el cuidado del pecho durante la lactancia', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-076', 'bebe_maternidad', 'Bebé y maternidad', 'Maternidad', 'Compresas de maternidad', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-077', 'primeros_auxilios_cuidado_casa', 'Primeros auxilios y cuidado en casa', 'Apósitos y curas', 'Tiritas o apósitos adhesivos surtidos', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-078', 'primeros_auxilios_cuidado_casa', 'Primeros auxilios y cuidado en casa', 'Apósitos y curas', 'Apósitos resistentes al agua', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-079', 'primeros_auxilios_cuidado_casa', 'Primeros auxilios y cuidado en casa', 'Apósitos y curas', 'Apósitos para ampollas', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-080', 'primeros_auxilios_cuidado_casa', 'Primeros auxilios y cuidado en casa', 'Apósitos y curas', 'Gasas estériles', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-081', 'primeros_auxilios_cuidado_casa', 'Primeros auxilios y cuidado en casa', 'Apósitos y curas', 'Esparadrapo o cinta médica', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-082', 'primeros_auxilios_cuidado_casa', 'Primeros auxilios y cuidado en casa', 'Apósitos y curas', 'Venda elástica', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-083', 'primeros_auxilios_cuidado_casa', 'Primeros auxilios y cuidado en casa', 'Antisépticos', 'Alcohol antiséptico para piel sana', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-084', 'primeros_auxilios_cuidado_casa', 'Primeros auxilios y cuidado en casa', 'Antisépticos', 'Agua oxigenada de uso cutáneo', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-085', 'primeros_auxilios_cuidado_casa', 'Primeros auxilios y cuidado en casa', 'Antisépticos', 'Antiséptico cutáneo de clorhexidina', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-086', 'primeros_auxilios_cuidado_casa', 'Primeros auxilios y cuidado en casa', 'Antisépticos', 'Antiséptico cutáneo de povidona yodada', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-087', 'primeros_auxilios_cuidado_casa', 'Primeros auxilios y cuidado en casa', 'Medición y cuidado en casa', 'Termómetro digital', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-088', 'primeros_auxilios_cuidado_casa', 'Primeros auxilios y cuidado en casa', 'Medición y cuidado en casa', 'Suero fisiológico en monodosis', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-089', 'primeros_auxilios_cuidado_casa', 'Primeros auxilios y cuidado en casa', 'Medición y cuidado en casa', 'Compresa de frío instantáneo', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-090', 'primeros_auxilios_cuidado_casa', 'Primeros auxilios y cuidado en casa', 'Medición y cuidado en casa', 'Bolsa reutilizable de frío o calor', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-091', 'bienestar_cuidado_estacional', 'Bienestar y cuidado estacional', 'Salud sexual', 'Preservativos', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-092', 'bienestar_cuidado_estacional', 'Bienestar y cuidado estacional', 'Salud sexual', 'Lubricante íntimo', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-093', 'bienestar_cuidado_estacional', 'Bienestar y cuidado estacional', 'Higiene menstrual', 'Compresas menstruales', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-094', 'bienestar_cuidado_estacional', 'Bienestar y cuidado estacional', 'Higiene menstrual', 'Salvaslips', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-095', 'bienestar_cuidado_estacional', 'Bienestar y cuidado estacional', 'Higiene menstrual', 'Tampones', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-096', 'bienestar_cuidado_estacional', 'Bienestar y cuidado estacional', 'Higiene menstrual', 'Copa menstrual', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-097', 'bienestar_cuidado_estacional', 'Bienestar y cuidado estacional', 'Cuidado estacional', 'Repelente de insectos para adultos', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-098', 'bienestar_cuidado_estacional', 'Bienestar y cuidado estacional', 'Cuidado estacional', 'Repelente de insectos infantil', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-099', 'bienestar_cuidado_estacional', 'Bienestar y cuidado estacional', 'Cuidado estacional', 'Producto para el cuidado de la piel tras picaduras', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[]),
  ('FF-GEN-100', 'bienestar_cuidado_estacional', 'Bienestar y cuidado estacional', 'Cuidado estacional', 'Gel hidroalcohólico para manos', 'generic_request_type', 'confirm_with_pharmacy', true, ARRAY['pilot','general']::text[])
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  category_name = EXCLUDED.category_name,
  subcategory_name = EXCLUDED.subcategory_name,
  generic_product_type = EXCLUDED.generic_product_type,
  record_type = EXCLUDED.record_type,
  availability_status = EXCLUDED.availability_status,
  active_standard_catalog = EXCLUDED.active_standard_catalog,
  available_in_plans = EXCLUDED.available_in_plans,
  updated_at = now();

DO $$
BEGIN
  IF (SELECT count(*) FROM public.ff_master_catalog_products) <> 100 THEN
    RAISE EXCEPTION 'ff_master_catalog_products must contain exactly 100 rows';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) Modalidad por farmacia
-- -----------------------------------------------------------------------------
ALTER TABLE public.pharmacy_settings
  ADD COLUMN IF NOT EXISTS catalog_mode text;

-- Farmacias ya existentes con catálogo propio (manual/import): 'own'.
-- Solo 'generic' si no hay productos propios activos (evita vaciar kiosko en prod).
-- NO adjunta el maestro ni crea trials; solo rellena la columna nueva.
UPDATE public.pharmacy_settings s
SET catalog_mode = CASE
  WHEN EXISTS (
    SELECT 1
    FROM public.pharmacy_products pp
    WHERE pp.pharmacy_id = s.pharmacy_id
      AND pp.is_active IS TRUE
      AND pp.source IN ('manual', 'import')
  ) THEN 'own'
  ELSE 'generic'
END
WHERE s.catalog_mode IS NULL;

ALTER TABLE public.pharmacy_settings
  ALTER COLUMN catalog_mode SET DEFAULT 'generic';

ALTER TABLE public.pharmacy_settings
  ALTER COLUMN catalog_mode SET NOT NULL;

ALTER TABLE public.pharmacy_settings
  DROP CONSTRAINT IF EXISTS pharmacy_settings_catalog_mode_chk;

ALTER TABLE public.pharmacy_settings
  ADD CONSTRAINT pharmacy_settings_catalog_mode_chk
  CHECK (catalog_mode = ANY (ARRAY['generic', 'own']));

COMMENT ON COLUMN public.pharmacy_settings.catalog_mode IS
  'generic = catálogo maestro proyectado; own = solo productos manual/import. Sin DELETE al cambiar.';

-- -----------------------------------------------------------------------------
-- 3) Extensiones pharmacy_products
-- -----------------------------------------------------------------------------
ALTER TABLE public.pharmacy_products
  ADD COLUMN IF NOT EXISTS subcategory text;

ALTER TABLE public.pharmacy_products
  ADD COLUMN IF NOT EXISTS availability_status text;

ALTER TABLE public.pharmacy_products
  ADD COLUMN IF NOT EXISTS master_catalog_id text
    REFERENCES public.ff_master_catalog_products (id) ON DELETE RESTRICT;

UPDATE public.pharmacy_products
SET availability_status = CASE
  WHEN source = 'demo' THEN 'confirm_with_pharmacy'
  ELSE COALESCE(availability_status, 'available')
END
WHERE availability_status IS NULL;

ALTER TABLE public.pharmacy_products
  ALTER COLUMN availability_status SET DEFAULT 'available';

ALTER TABLE public.pharmacy_products
  DROP CONSTRAINT IF EXISTS pharmacy_products_availability_status_chk;

ALTER TABLE public.pharmacy_products
  ADD CONSTRAINT pharmacy_products_availability_status_chk
  CHECK (
    availability_status = ANY (ARRAY['confirm_with_pharmacy', 'available', 'unavailable'])
  );

ALTER TABLE public.pharmacy_products
  DROP CONSTRAINT IF EXISTS pharmacy_products_source_chk;

ALTER TABLE public.pharmacy_products
  ADD CONSTRAINT pharmacy_products_source_chk
  CHECK (source = ANY (ARRAY['manual', 'import', 'demo', 'generic']));

COMMENT ON COLUMN public.pharmacy_products.source IS
  'manual | import | demo (legacy) | generic (proyección del maestro FF-GEN).';
COMMENT ON COLUMN public.pharmacy_products.master_catalog_id IS
  'FK al maestro cuando source=generic. Null para propios.';
COMMENT ON COLUMN public.pharmacy_products.availability_status IS
  'confirm_with_pharmacy para genéricos; available/unavailable para propios.';

CREATE UNIQUE INDEX IF NOT EXISTS pharmacy_products_pharmacy_master_uidx
  ON public.pharmacy_products (pharmacy_id, master_catalog_id)
  WHERE master_catalog_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pharmacy_products_master_catalog_id_idx
  ON public.pharmacy_products (master_catalog_id)
  WHERE master_catalog_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pharmacy_products_pharmacy_source_active_idx
  ON public.pharmacy_products (pharmacy_id, source, is_active);

-- -----------------------------------------------------------------------------
-- 4) Protección: farmacias no editan genéricos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_pharmacy_products_guard_generic_()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_platform boolean;
BEGIN
  v_platform := public.ff_has_platform_permission('platform.pharmacies.write');

  IF TG_OP = 'INSERT' THEN
    IF NEW.source = 'generic' AND NOT v_platform THEN
      RAISE EXCEPTION 'generic_catalog_readonly'
        USING ERRCODE = '42501',
              MESSAGE = 'Solo SuperAdmin / RPC de attach puede crear productos del catálogo maestro.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.source = 'generic' OR NEW.source = 'generic' THEN
      IF NOT v_platform THEN
        -- Farmacia: no puede tocar filas genéricas ni convertir propias en generic.
        RAISE EXCEPTION 'generic_catalog_readonly'
          USING ERRCODE = '42501',
                MESSAGE = 'El catálogo maestro genérico no es editable por la farmacia.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pharmacy_products_guard_generic
  ON public.pharmacy_products;
CREATE TRIGGER pharmacy_products_guard_generic
  BEFORE INSERT OR UPDATE ON public.pharmacy_products
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_pharmacy_products_guard_generic_();

REVOKE ALL ON FUNCTION public.ff_pharmacy_products_guard_generic_() FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 5) Helpers de modalidad / listado público
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_pharmacy_catalog_mode(p_pharmacy_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    (SELECT s.catalog_mode FROM public.pharmacy_settings s WHERE s.pharmacy_id = p_pharmacy_id),
    'generic'
  );
$$;

COMMENT ON FUNCTION public.ff_pharmacy_catalog_mode(uuid) IS
  'Devuelve generic|own para la farmacia (default generic).';

GRANT EXECUTE ON FUNCTION public.ff_pharmacy_catalog_mode(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ff_pharmacy_product_visible_in_active_catalog(
  p_source text,
  p_catalog_mode text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    -- own: catálogo de la farmacia + demo legacy (no oculta semillas existentes).
    WHEN p_catalog_mode = 'own' THEN p_source IN ('manual', 'import', 'demo')
    -- generic: maestro proyectado + demo legacy hasta migración de datos.
    ELSE p_source IN ('generic', 'demo')
  END;
$$;

GRANT EXECUTE ON FUNCTION public.ff_pharmacy_product_visible_in_active_catalog(text, text)
  TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6) Attach idempotente (100 genéricos)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_attach_master_catalog_v1(
  p_pharmacy_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_inserted int := 0;
  v_existing int := 0;
  v_total int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.pharmacies.write') THEN
    RAISE EXCEPTION 'forbidden_pharmacies_write' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.pharmacies WHERE id = p_pharmacy_id) THEN
    RAISE EXCEPTION 'pharmacy_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::int INTO v_total
  FROM public.ff_master_catalog_products m
  WHERE m.active_standard_catalog;

  -- Insert missing projections (no price/stock fiction beyond schema defaults 0)
  WITH ins AS (
    INSERT INTO public.pharmacy_products (
      pharmacy_id, sku, ean, name, description, brand, category, subcategory,
      price, stock, min_stock, is_active, is_featured,
      source, source_ref, master_catalog_id, availability_status,
      created_by, updated_by
    )
    SELECT
      p_pharmacy_id,
      m.id,
      NULL,
      m.generic_product_type,
      NULL,
      NULL,
      m.category_name,
      m.subcategory_name,
      0,
      0,
      0,
      true,
      false,
      'generic',
      'ff_master_v1:' || m.id,
      m.id,
      m.availability_status,
      v_uid,
      v_uid
    FROM public.ff_master_catalog_products m
    WHERE m.active_standard_catalog
      AND NOT EXISTS (
        SELECT 1 FROM public.pharmacy_products pp
        WHERE pp.pharmacy_id = p_pharmacy_id
          AND (
            pp.source_ref = 'ff_master_v1:' || m.id
            OR pp.master_catalog_id = m.id
            OR (pp.sku = m.id AND pp.source IN ('generic', 'demo'))
          )
      )
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_inserted FROM ins;

  SELECT count(*)::int INTO v_existing
  FROM public.pharmacy_products pp
  WHERE pp.pharmacy_id = p_pharmacy_id
    AND (
      pp.source = 'generic'
      OR (pp.source = 'demo' AND pp.source_ref LIKE 'farmafacil_demo_v1:%')
    )
    AND pp.is_active;

  -- Ensure settings row + mode generic if still default attach context
  INSERT INTO public.pharmacy_settings (pharmacy_id, catalog_mode, updated_by)
  VALUES (p_pharmacy_id, 'generic', v_uid)
  ON CONFLICT (pharmacy_id) DO UPDATE
    SET catalog_mode = CASE
          WHEN public.pharmacy_settings.catalog_mode = 'own' THEN 'own'
          ELSE 'generic'
        END,
        updated_by = v_uid;

  RETURN jsonb_build_object(
    'status', 'ok',
    'pharmacy_id', p_pharmacy_id,
    'master_active', v_total,
    'inserted', v_inserted,
    'active_generic_or_demo_rows', v_existing,
    'catalog_mode', public.ff_pharmacy_catalog_mode(p_pharmacy_id)
  );
END;
$$;

COMMENT ON FUNCTION public.ff_attach_master_catalog_v1(uuid) IS
  'Proyecta el maestro FF-GEN a pharmacy_products (idempotente). Sin DELETE. Solo platform.pharmacies.write.';

REVOKE ALL ON FUNCTION public.ff_attach_master_catalog_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_attach_master_catalog_v1(uuid)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7) Sync maestro → proyecciones (UPDATE metadatos; no inventa precio)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_sync_master_catalog_v1(
  p_pharmacy_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_updated int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.ff_has_platform_permission('platform.pharmacies.write') THEN
    RAISE EXCEPTION 'forbidden_pharmacies_write' USING ERRCODE = '42501';
  END IF;

  WITH u AS (
    UPDATE public.pharmacy_products pp
    SET
      name = m.generic_product_type,
      category = m.category_name,
      subcategory = m.subcategory_name,
      availability_status = m.availability_status,
      brand = NULL,
      -- price/stock no se inventan: se mantienen en 0 para genéricos
      price = 0,
      stock = 0,
      is_active = CASE WHEN m.active_standard_catalog THEN pp.is_active ELSE false END,
      updated_by = v_uid
    FROM public.ff_master_catalog_products m
    WHERE pp.master_catalog_id = m.id
      AND pp.source = 'generic'
      AND (p_pharmacy_id IS NULL OR pp.pharmacy_id = p_pharmacy_id)
    RETURNING pp.id
  )
  SELECT count(*)::int INTO v_updated FROM u;

  -- Attach faltantes si se pide farmacia concreta
  IF p_pharmacy_id IS NOT NULL THEN
    PERFORM public.ff_attach_master_catalog_v1(p_pharmacy_id);
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'updated', v_updated,
    'pharmacy_id', p_pharmacy_id
  );
END;
$$;

COMMENT ON FUNCTION public.ff_sync_master_catalog_v1(uuid) IS
  'Sincroniza name/categoría/disponibilidad desde el maestro a proyecciones generic. Sin DELETE.';

REVOKE ALL ON FUNCTION public.ff_sync_master_catalog_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_sync_master_catalog_v1(uuid)
  TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8) Cambio de modalidad (soft; sin DELETE)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ff_set_pharmacy_catalog_mode_v1(
  p_pharmacy_id uuid,
  p_mode text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_prev text;
  v_mode text := lower(btrim(COALESCE(p_mode, '')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF v_mode NOT IN ('generic', 'own') THEN
    RAISE EXCEPTION 'invalid_catalog_mode' USING ERRCODE = '23514';
  END IF;
  IF NOT (
    public.ff_has_platform_permission('platform.pharmacies.write')
    OR public.ff_has_platform_permission('platform.commercial_trials.manage')
  ) THEN
    RAISE EXCEPTION 'forbidden_catalog_mode' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.pharmacies WHERE id = p_pharmacy_id) THEN
    RAISE EXCEPTION 'pharmacy_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_prev := public.ff_pharmacy_catalog_mode(p_pharmacy_id);

  INSERT INTO public.pharmacy_settings (pharmacy_id, catalog_mode, updated_by)
  VALUES (p_pharmacy_id, v_mode, v_uid)
  ON CONFLICT (pharmacy_id) DO UPDATE
    SET catalog_mode = v_mode, updated_by = v_uid;

  IF v_mode = 'generic' THEN
    -- Re-asegurar proyección; no borra propios
    PERFORM public.ff_attach_master_catalog_v1(p_pharmacy_id);
  END IF;

  PERFORM public.ff_write_audit_log(
    'catalog.mode.set',
    p_pharmacy_id,
    'pharmacy_settings',
    p_pharmacy_id::text,
    jsonb_build_object('from', v_prev, 'to', v_mode),
    NULL,
    NULL
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'pharmacy_id', p_pharmacy_id,
    'from', v_prev,
    'to', v_mode,
    'note', 'Sin DELETE: el filtrado público usa catalog_mode + source'
  );
END;
$$;

COMMENT ON FUNCTION public.ff_set_pharmacy_catalog_mode_v1(uuid, text) IS
  'Cambia catalog_mode generic|own sin borrar productos. Filtrado por source en lecturas.';

REVOKE ALL ON FUNCTION public.ff_set_pharmacy_catalog_mode_v1(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ff_set_pharmacy_catalog_mode_v1(uuid, text)
  TO authenticated, service_role;

-- =============================================================================
-- DOWN (manual):
-- DROP FUNCTION IF EXISTS public.ff_set_pharmacy_catalog_mode_v1(uuid, text);
-- DROP FUNCTION IF EXISTS public.ff_sync_master_catalog_v1(uuid);
-- DROP FUNCTION IF EXISTS public.ff_attach_master_catalog_v1(uuid);
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_product_visible_in_active_catalog(text, text);
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_catalog_mode(uuid);
-- DROP TRIGGER IF EXISTS pharmacy_products_guard_generic ON public.pharmacy_products;
-- DROP FUNCTION IF EXISTS public.ff_pharmacy_products_guard_generic_();
-- ALTER TABLE public.pharmacy_products DROP COLUMN IF EXISTS master_catalog_id;
-- ALTER TABLE public.pharmacy_products DROP COLUMN IF EXISTS availability_status;
-- ALTER TABLE public.pharmacy_products DROP COLUMN IF EXISTS subcategory;
-- ALTER TABLE public.pharmacy_settings DROP COLUMN IF EXISTS catalog_mode;
-- DROP TABLE IF EXISTS public.ff_master_catalog_products;
-- =============================================================================
