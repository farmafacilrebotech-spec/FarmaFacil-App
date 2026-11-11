-- =============================================================================
-- PRODUCCIÓN — rollback Storage pharmacy-logos (PR #23)
-- Proyecto: gsnohwsvjxpjfcsstnfd
-- Elimina policies + bucket. NO borra automáticamente objetos ya subidos.
-- =============================================================================

DROP POLICY IF EXISTS pharmacy_logos_public_read ON storage.objects;
DROP POLICY IF EXISTS pharmacy_logos_insert ON storage.objects;
DROP POLICY IF EXISTS pharmacy_logos_update ON storage.objects;
DROP POLICY IF EXISTS pharmacy_logos_delete ON storage.objects;

DELETE FROM storage.buckets WHERE id = 'pharmacy-logos';
