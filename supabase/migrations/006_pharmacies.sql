-- =============================================================================
-- 006_pharmacies.sql
-- Tenants (farmacias) + FK diferida profiles.last_pharmacy_id.
-- Soft-archive vía status + archived_at/archived_by. Sin hard delete normal.
-- =============================================================================

CREATE TABLE public.pharmacies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  cif text,
  email text,
  phone text,
  web text,
  address_line text,
  postal_code text,
  city text,
  province text,
  country text NOT NULL DEFAULT 'ES',
  status text NOT NULL DEFAULT 'draft',
  plan_id uuid REFERENCES public.plans (id) ON DELETE RESTRICT,
  logo_color text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  archived_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  suspended_at timestamptz,
  archived_at timestamptz,
  CONSTRAINT pharmacies_status_chk CHECK (
    status = ANY (
      ARRAY[
        'draft',
        'pending_contract',
        'contract_sent',
        'contract_signed',
        'pending_setup',
        'active',
        'suspended',
        'archived'
      ]
    )
  ),
  CONSTRAINT pharmacies_name_not_blank_chk CHECK (length(trim(name)) > 0),
  CONSTRAINT pharmacies_archived_consistency_chk CHECK (
    (status = 'archived' AND archived_at IS NOT NULL)
    OR (status <> 'archived' AND archived_at IS NULL AND archived_by IS NULL)
  )
);

COMMENT ON TABLE public.pharmacies IS
  'Tenant FarmaFácil. Sin hard delete normal: suspender o archivar (status + archived_at).';
COMMENT ON COLUMN public.pharmacies.status IS
  'Ciclo de vida del tenant. archived es soft-delete; suspended es pausa operativa.';
COMMENT ON COLUMN public.pharmacies.archived_at IS
  'Momento de archivado. No borrar la fila.';
COMMENT ON COLUMN public.pharmacies.created_by IS
  'Trazabilidad operativa. La auditoría completa vive en audit_logs.';
COMMENT ON COLUMN public.pharmacies.updated_by IS
  'Último editor operativo. No sustituye audit_logs.';

CREATE INDEX pharmacies_plan_id_idx ON public.pharmacies (plan_id);
CREATE INDEX pharmacies_status_idx ON public.pharmacies (status);
CREATE INDEX pharmacies_created_by_idx ON public.pharmacies (created_by);
CREATE INDEX pharmacies_created_at_idx ON public.pharmacies (created_at DESC);

CREATE TRIGGER pharmacies_set_updated_at
  BEFORE UPDATE ON public.pharmacies
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

-- FK diferida: preferencia UI (no autorización)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_last_pharmacy_id_fkey
  FOREIGN KEY (last_pharmacy_id)
  REFERENCES public.pharmacies (id)
  ON DELETE SET NULL;

-- DOWN (desarrollo):
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_last_pharmacy_id_fkey;
-- DROP TRIGGER IF EXISTS pharmacies_set_updated_at ON public.pharmacies;
-- DROP TABLE IF EXISTS public.pharmacies;
