-- Server-owned Hub payment intents.
--
-- A payment intent is created before opening Paystack Inline. It binds the
-- authenticated customer, canonical service, server-calculated NGN amount,
-- Paystack reference, and validated order payload. The browser cannot read or
-- write this table. Trusted server functions and the webhook use service_role.
--
-- The webhook must independently verify the Paystack transaction before
-- changing status to paid or creating a hub_orders row.

CREATE TABLE IF NOT EXISTS public.hub_payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service text NOT NULL CHECK (length(trim(service)) BETWEEN 2 AND 80),
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  payment_reference text NOT NULL UNIQUE
    CHECK (length(payment_reference) BETWEEN 8 AND 128),
  paystack_domain text NOT NULL
    CHECK (paystack_domain IN ('test', 'live')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'expired')),
  order_payload jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(order_payload) = 'object'),
  provider_transaction_id bigint,
  paid_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_payment_intents_provider_tx_positive
    CHECK (provider_transaction_id IS NULL OR provider_transaction_id > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS hub_payment_intents_provider_tx_unique
  ON public.hub_payment_intents (provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS hub_payment_intents_user_created_idx
  ON public.hub_payment_intents (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS hub_payment_intents_pending_expiry_idx
  ON public.hub_payment_intents (expires_at)
  WHERE status = 'pending';

ALTER TABLE public.hub_payment_intents ENABLE ROW LEVEL SECURITY;

-- No client policy is intentionally created. This table contains the
-- authoritative customer/order binding and must only be accessed by trusted
-- server code using the Supabase service role.
REVOKE ALL ON TABLE public.hub_payment_intents FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.hub_payment_intents TO service_role;

COMMENT ON TABLE public.hub_payment_intents IS
  'Server-only Paystack intents for Hub services; webhook reconciliation source of truth.';
COMMENT ON COLUMN public.hub_payment_intents.order_payload IS
  'Validated server-stored order details captured before checkout; never trust webhook/browser metadata as a replacement.';
COMMENT ON COLUMN public.hub_payment_intents.amount_kobo IS
  'Exact expected Paystack charge in kobo, calculated by trusted server code.';
