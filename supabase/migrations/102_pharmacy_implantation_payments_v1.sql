-- =============================================================================
-- 102_pharmacy_implantation_payments_v1.sql
-- Registro de implantaciones / pagos previos (sin pasarela).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pharmacy_implantation_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies (id) ON DELETE CASCADE,
  trial_id uuid REFERENCES public.pharmacy_commercial_trials (id) ON DELETE SET NULL,
  concept text NOT NULL,
  net_cents integer NOT NULL CHECK (net_cents >= 0),
  tax_cents integer NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  payment_date date NOT NULL DEFAULT (CURRENT_DATE),
  payment_status text NOT NULL DEFAULT 'recorded',
  amount_paid_cents integer NOT NULL DEFAULT 0 CHECK (amount_paid_cents >= 0),
  document_ref text,
  notes text,
  recorded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  applied_to_quote_id uuid REFERENCES public.commercial_quotes (id) ON DELETE SET NULL,
  applied_cents integer NOT NULL DEFAULT 0 CHECK (applied_cents >= 0),
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pharmacy_implantation_payments_concept_chk CHECK (
    concept = ANY (ARRAY['app_setup', 'kiosk_customization'])
  ),
  CONSTRAINT pharmacy_implantation_payments_status_chk CHECK (
    payment_status = ANY (ARRAY['recorded', 'confirmed', 'refunded', 'void'])
  ),
  CONSTRAINT pharmacy_implantation_payments_totals_chk CHECK (
    total_cents = net_cents + tax_cents
  ),
  CONSTRAINT pharmacy_implantation_payments_applied_chk CHECK (
    applied_cents <= amount_paid_cents
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS pharmacy_implantation_payments_quote_once_uidx
  ON public.pharmacy_implantation_payments (id)
  WHERE applied_to_quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pharmacy_implantation_payments_pharmacy_idx
  ON public.pharmacy_implantation_payments (pharmacy_id, payment_date DESC);

COMMENT ON TABLE public.pharmacy_implantation_payments IS
  'Pagos de implantación (190 € app / 1090 € kiosko). No es descuento comercial genérico.';

ALTER TABLE public.pharmacy_implantation_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY pharmacy_implantation_payments_select
  ON public.pharmacy_implantation_payments
  FOR SELECT TO authenticated
  USING (
    public.ff_has_platform_permission('platform.pharmacies.read')
    OR public.ff_has_platform_permission('platform.commercial_quotes.manage')
  );

CREATE POLICY pharmacy_implantation_payments_write
  ON public.pharmacy_implantation_payments
  FOR ALL TO authenticated
  USING (
    public.ff_has_platform_permission('platform.commercial_quotes.manage')
    OR public.ff_has_platform_permission('platform.subscriptions.manage')
  )
  WITH CHECK (
    public.ff_has_platform_permission('platform.commercial_quotes.manage')
    OR public.ff_has_platform_permission('platform.subscriptions.manage')
  );

GRANT SELECT, INSERT, UPDATE ON public.pharmacy_implantation_payments TO authenticated;
