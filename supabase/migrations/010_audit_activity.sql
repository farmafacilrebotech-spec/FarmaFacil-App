-- =============================================================================
-- 009_audit_activity.sql
-- audit_logs (inmutable, compliance) y activity_events (timeline de producto).
-- =============================================================================

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  pharmacy_id uuid REFERENCES public.pharmacies (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  ip inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_action_not_blank_chk CHECK (length(trim(action)) > 0),
  CONSTRAINT audit_logs_metadata_object_chk CHECK (jsonb_typeof(metadata) = 'object')
);

COMMENT ON TABLE public.audit_logs IS
  'Auditoría inmutable de seguridad/compliance. Sin UPDATE/DELETE para roles normales. INSERT solo vía función controlada.';

CREATE INDEX audit_logs_pharmacy_id_created_at_idx
  ON public.audit_logs (pharmacy_id, created_at DESC);
CREATE INDEX audit_logs_actor_profile_id_created_at_idx
  ON public.audit_logs (actor_profile_id, created_at DESC);
CREATE INDEX audit_logs_action_created_at_idx
  ON public.audit_logs (action, created_at DESC);
CREATE INDEX audit_logs_created_at_idx
  ON public.audit_logs (created_at DESC);

CREATE TABLE public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid REFERENCES public.pharmacies (id) ON DELETE SET NULL,
  actor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_events_type_not_blank_chk CHECK (length(trim(type)) > 0),
  CONSTRAINT activity_events_title_not_blank_chk CHECK (length(trim(title)) > 0),
  CONSTRAINT activity_events_metadata_object_chk CHECK (jsonb_typeof(metadata) = 'object')
);

COMMENT ON TABLE public.activity_events IS
  'Timeline de producto visible en UI. Separado de audit_logs.';

CREATE INDEX activity_events_pharmacy_id_created_at_idx
  ON public.activity_events (pharmacy_id, created_at DESC);
CREATE INDEX activity_events_actor_profile_id_idx
  ON public.activity_events (actor_profile_id);
CREATE INDEX activity_events_created_at_idx
  ON public.activity_events (created_at DESC);

-- DOWN (desarrollo):
-- DROP TABLE IF EXISTS public.activity_events;
-- DROP TABLE IF EXISTS public.audit_logs;
