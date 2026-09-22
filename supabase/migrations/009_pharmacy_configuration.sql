-- =============================================================================
-- 009_pharmacy_configuration.sql
-- Branding, settings y public_entrypoints (destinos internos controlados).
-- =============================================================================

CREATE TABLE public.pharmacy_branding (
  pharmacy_id uuid PRIMARY KEY
    REFERENCES public.pharmacies (id) ON DELETE RESTRICT,
  logo_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  font_family text,
  border_radius numeric(5, 2),
  kiosk_wallpaper_url text,
  welcome_message text,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pharmacy_branding_primary_color_chk CHECK (
    primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  CONSTRAINT pharmacy_branding_secondary_color_chk CHECK (
    secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  CONSTRAINT pharmacy_branding_accent_color_chk CHECK (
    accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  CONSTRAINT pharmacy_branding_border_radius_chk CHECK (
    border_radius IS NULL
    OR (border_radius >= 0 AND border_radius <= 64)
  ),
  CONSTRAINT pharmacy_branding_font_family_chk CHECK (
    font_family IS NULL
    OR (
      length(font_family) BETWEEN 1 AND 80
      AND font_family !~ '[[:cntrl:]]'
    )
  ),
  CONSTRAINT pharmacy_branding_logo_url_safe_chk CHECK (
    logo_url IS NULL
    OR (
      length(logo_url) <= 2048
      AND logo_url !~* '^\s*(javascript|data|vbscript):'
    )
  ),
  CONSTRAINT pharmacy_branding_kiosk_wallpaper_url_safe_chk CHECK (
    kiosk_wallpaper_url IS NULL
    OR (
      length(kiosk_wallpaper_url) <= 2048
      AND kiosk_wallpaper_url !~* '^\s*(javascript|data|vbscript):'
    )
  )
);

COMMENT ON TABLE public.pharmacy_branding IS
  'Identidad visual por tenant (panel, kiosco, cliente). URLs/paths a Storage; no binarios en BD.';
COMMENT ON COLUMN public.pharmacy_branding.border_radius IS
  'Radio en px (0–64). La app interpreta el valor sin hardcodear marca.';
COMMENT ON COLUMN public.pharmacy_branding.logo_url IS
  'Path Storage o URL https controlada por la app. No open redirect / javascript:.';

CREATE TRIGGER pharmacy_branding_set_updated_at
  BEFORE UPDATE ON public.pharmacy_branding
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

CREATE TABLE public.pharmacy_settings (
  pharmacy_id uuid PRIMARY KEY
    REFERENCES public.pharmacies (id) ON DELETE RESTRICT,
  visible_name text,
  schedule text,
  phone text,
  whatsapp text,
  email text,
  timezone text NOT NULL DEFAULT 'Europe/Madrid',
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pharmacy_settings_extra_object_chk
    CHECK (jsonb_typeof(extra) = 'object')
);

COMMENT ON TABLE public.pharmacy_settings IS
  'Ajustes operativos visibles de la farmacia.';

CREATE TRIGGER pharmacy_settings_set_updated_at
  BEFORE UPDATE ON public.pharmacy_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

CREATE TABLE public.public_entrypoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL
    REFERENCES public.pharmacies (id) ON DELETE RESTRICT,
  public_id text NOT NULL,
  purpose text NOT NULL DEFAULT 'pharmacy_home',
  internal_route text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  access_count bigint NOT NULL DEFAULT 0,
  last_access_at timestamptz,
  qr_asset_path text,
  qr_version integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_entrypoints_public_id_key UNIQUE (public_id),
  CONSTRAINT public_entrypoints_pharmacy_purpose_key UNIQUE (pharmacy_id, purpose),
  CONSTRAINT public_entrypoints_purpose_chk CHECK (
    purpose = ANY (ARRAY['pharmacy_home', 'campaign', 'product', 'invite'])
  ),
  CONSTRAINT public_entrypoints_public_id_format_chk CHECK (
    public_id ~ '^[a-z0-9][a-z0-9\-]{2,63}$'
  ),
  CONSTRAINT public_entrypoints_internal_route_safe_chk CHECK (
    public.ff_is_safe_internal_route(internal_route)
  ),
  CONSTRAINT public_entrypoints_qr_version_chk CHECK (qr_version >= 1),
  CONSTRAINT public_entrypoints_access_count_chk CHECK (access_count >= 0),
  CONSTRAINT public_entrypoints_metadata_object_chk CHECK (
    jsonb_typeof(metadata) = 'object'
  )
);

COMMENT ON TABLE public.public_entrypoints IS
  'Destinos públicos estables. internal_route es path interno; prohibidas URLs externas abiertas.';
COMMENT ON COLUMN public.public_entrypoints.public_id IS
  'Identificador estable URL-safe. Regenerar QR no debe cambiar este valor.';
COMMENT ON COLUMN public.public_entrypoints.internal_route IS
  'Ruta interna controlada por la app. Resolución pública vía Route Handler (service_role).';
COMMENT ON COLUMN public.public_entrypoints.access_count IS
  'Contador de accesos. Solo incrementable vía ff_record_entrypoint_access (service_role).';
COMMENT ON COLUMN public.public_entrypoints.last_access_at IS
  'Último acceso registrado. Protegido frente a UPDATE directo de clientes.';
COMMENT ON COLUMN public.public_entrypoints.expires_at IS
  'Caducidad opcional del entrypoint. NULL = sin expiración.';
COMMENT ON COLUMN public.public_entrypoints.is_active IS
  'Desactivación lógica. Sustituye al hard delete.';

CREATE INDEX public_entrypoints_pharmacy_id_idx
  ON public.public_entrypoints (pharmacy_id);
CREATE INDEX public_entrypoints_is_active_idx
  ON public.public_entrypoints (is_active)
  WHERE is_active = true;
CREATE INDEX public_entrypoints_expires_at_idx
  ON public.public_entrypoints (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE TRIGGER public_entrypoints_set_updated_at
  BEFORE UPDATE ON public.public_entrypoints
  FOR EACH ROW
  EXECUTE FUNCTION public.ff_set_updated_at();

-- DOWN (desarrollo):
-- DROP TRIGGER IF EXISTS public_entrypoints_set_updated_at ON public.public_entrypoints;
-- DROP TABLE IF EXISTS public.public_entrypoints;
-- DROP TRIGGER IF EXISTS pharmacy_settings_set_updated_at ON public.pharmacy_settings;
-- DROP TABLE IF EXISTS public.pharmacy_settings;
-- DROP TRIGGER IF EXISTS pharmacy_branding_set_updated_at ON public.pharmacy_branding;
-- DROP TABLE IF EXISTS public.pharmacy_branding;
