-- =============================================================================
-- 088_email_drafts_trash_templates_dedupe_v1.sql
-- Papelera de borradores + índice único system_key en plantillas.
-- NO APLICAR en producción sin autorización.
-- =============================================================================

ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS trashed_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS email_drafts_trashed_at_idx
  ON public.email_drafts (trashed_at DESC NULLS LAST);

COMMENT ON COLUMN public.email_drafts.trashed_at IS
  '088: NULL = activo; no null = en papelera.';

-- Dedupe seguro: conservar la plantilla más reciente por system_key;
-- reasignar borradores y archivar duplicados.
DO $$
DECLARE
  r record;
  keep_id uuid;
  dup_id uuid;
BEGIN
  IF to_regclass('public.email_templates') IS NULL THEN
    RETURN;
  END IF;
  FOR r IN
    SELECT system_key
    FROM public.email_templates
    WHERE system_key IS NOT NULL
    GROUP BY system_key
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO keep_id
    FROM public.email_templates
    WHERE system_key = r.system_key
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    FOR dup_id IN
      SELECT id FROM public.email_templates
      WHERE system_key = r.system_key AND id <> keep_id
    LOOP
      UPDATE public.email_drafts
      SET template_id = keep_id
      WHERE template_id = dup_id;
      UPDATE public.email_templates
      SET status = 'archived',
          system_key = NULL,
          name = left(name || ' (duplicado archivado)', 200),
          updated_at = now()
      WHERE id = dup_id;
    END LOOP;
  END LOOP;
END $$;

-- Un system_key activo como máximo
CREATE UNIQUE INDEX IF NOT EXISTS email_templates_system_key_uq
  ON public.email_templates (system_key)
  WHERE system_key IS NOT NULL AND status = 'active';
