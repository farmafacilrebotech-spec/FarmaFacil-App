-- =============================================================================
-- 096_commercial_quote_cancelled_pdf_docs_v1.sql
-- - Estado anulado (cancelled) en commercial_quotes
-- - Tabla de documentos PDF privados vinculados a la versión del presupuesto
-- SOLO staging. No tocar producción.
-- =============================================================================

ALTER TABLE public.commercial_quotes
  DROP CONSTRAINT IF EXISTS commercial_quotes_status_chk;

ALTER TABLE public.commercial_quotes
  ADD CONSTRAINT commercial_quotes_status_chk CHECK (
    status = ANY (
      ARRAY[
        'draft'::text,
        'sent'::text,
        'accepted'::text,
        'rejected'::text,
        'expired'::text,
        'cancelled'::text
      ]
    )
  );

CREATE TABLE IF NOT EXISTS public.commercial_quote_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.commercial_quotes (id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_path text NOT NULL,
  content_sha256 text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size >= 0),
  mime_type text NOT NULL DEFAULT 'application/pdf',
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_quote_documents_mime_chk CHECK (mime_type = 'application/pdf'),
  CONSTRAINT commercial_quote_documents_filename_chk CHECK (length(btrim(filename)) > 0),
  CONSTRAINT commercial_quote_documents_path_chk CHECK (length(btrim(storage_path)) > 0)
);

CREATE INDEX IF NOT EXISTS commercial_quote_documents_quote_id_idx
  ON public.commercial_quote_documents (quote_id, created_at DESC);

COMMENT ON TABLE public.commercial_quote_documents IS
  '096: PDF corporativo emitido vinculado a la versión del presupuesto. Privado.';

ALTER TABLE public.commercial_quote_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_quote_documents_all ON public.commercial_quote_documents;
CREATE POLICY commercial_quote_documents_all ON public.commercial_quote_documents
  FOR ALL
  USING (public.ff_has_platform_permission('platform.commercial_quotes.manage'))
  WITH CHECK (public.ff_has_platform_permission('platform.commercial_quotes.manage'));

GRANT SELECT, INSERT ON public.commercial_quote_documents TO authenticated;
GRANT ALL ON public.commercial_quote_documents TO service_role;
