-- STAGING ONLY — rollback bucket logos
DROP POLICY IF EXISTS pharmacy_logos_public_read ON storage.objects;
DROP POLICY IF EXISTS pharmacy_logos_insert ON storage.objects;
DROP POLICY IF EXISTS pharmacy_logos_update ON storage.objects;
DROP POLICY IF EXISTS pharmacy_logos_delete ON storage.objects;

-- No borra objetos automáticamente; vaciar bucket en dashboard si procede.
DELETE FROM storage.buckets WHERE id = 'pharmacy-logos';
