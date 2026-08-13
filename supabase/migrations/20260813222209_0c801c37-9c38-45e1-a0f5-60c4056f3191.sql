ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_reference text,
  ADD COLUMN IF NOT EXISTS provider_transaction_id text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_reference_key
  ON public.wallet_transactions (reference);

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_provider_reference_key
  ON public.wallet_transactions (provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

DROP TRIGGER IF EXISTS trg_wtx_updated ON public.wallet_transactions;
CREATE TRIGGER trg_wtx_updated BEFORE UPDATE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 1. Signed-in user starts a Paystack top-up: records a PENDING ledger row.
CREATE OR REPLACE FUNCTION public.create_wallet_funding_intent(_amount numeric)
RETURNS TABLE(reference text, email text, amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); w public.wallets%ROWTYPE; ref text; uemail text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 100 OR _amount > 1000000 THEN RAISE EXCEPTION 'invalid amount'; END IF;

  SELECT * INTO w FROM public.wallets WHERE user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet not found'; END IF;
  IF w.status <> 'active' THEN RAISE EXCEPTION 'wallet not active'; END IF;

  SELECT COALESCE(p.email, u.email) INTO uemail
  FROM auth.users u LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = uid;
  IF uemail IS NULL OR uemail = '' THEN RAISE EXCEPTION 'email required'; END IF;

  ref := public.new_reference('WAL');

  INSERT INTO public.wallet_transactions
    (wallet_id, user_id, type, amount, balance_before, balance_after, reference,
     status, description, provider, provider_reference, metadata)
  VALUES (w.id, uid, 'deposit', round(_amount,2), w.balance, w.balance, ref,
          'pending', 'Wallet funding via Paystack', 'paystack', ref,
          jsonb_build_object('mode','test','channel','paystack'));

  RETURN QUERY SELECT ref, uemail, round(_amount,2);
END; $$;

-- 2. Backend-only: credit the wallet once, after Paystack verification succeeded.
CREATE OR REPLACE FUNCTION public.complete_paystack_funding(
  _reference text, _paid_amount numeric, _provider_transaction_id text, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(status tx_status, credited boolean, balance_after numeric, amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE tx public.wallet_transactions%ROWTYPE; w public.wallets%ROWTYPE; before numeric; after numeric;
BEGIN
  SELECT * INTO tx FROM public.wallet_transactions
   WHERE provider = 'paystack' AND provider_reference = _reference
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction not found'; END IF;

  IF tx.status = 'successful' THEN
    RETURN QUERY SELECT tx.status, false, tx.balance_after, tx.amount;
    RETURN;
  END IF;
  IF tx.status <> 'pending' THEN RAISE EXCEPTION 'transaction not pending'; END IF;
  IF round(_paid_amount,2) <> round(tx.amount,2) THEN RAISE EXCEPTION 'amount mismatch'; END IF;

  SELECT * INTO w FROM public.wallets WHERE id = tx.wallet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet not found'; END IF;

  before := w.balance;
  after := before + round(tx.amount,2);
  UPDATE public.wallets SET balance = after WHERE id = w.id;

  UPDATE public.wallet_transactions SET
    status = 'successful',
    balance_before = before,
    balance_after = after,
    completed_at = now(),
    provider_transaction_id = _provider_transaction_id,
    description = 'Wallet funding via Paystack',
    metadata = tx.metadata || jsonb_build_object('paystack', COALESCE(_payload,'{}'::jsonb))
  WHERE id = tx.id;

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (tx.user_id, 'Wallet funded',
    'Your wallet was credited with NGN ' || to_char(round(tx.amount,2),'FM999,999,990.00') || ' via Paystack.',
    'success', jsonb_build_object('reference', tx.reference, 'provider','paystack','mode','test'));

  RETURN QUERY SELECT 'successful'::tx_status, true, after, round(tx.amount,2);
END; $$;

-- 3. Backend-only: mark a funding attempt failed / still pending. Never touches balance.
CREATE OR REPLACE FUNCTION public.settle_paystack_funding(
  _reference text, _status tx_status, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(status tx_status, amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE tx public.wallet_transactions%ROWTYPE;
BEGIN
  IF _status NOT IN ('pending','failed') THEN RAISE EXCEPTION 'invalid status'; END IF;

  SELECT * INTO tx FROM public.wallet_transactions
   WHERE provider = 'paystack' AND provider_reference = _reference
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction not found'; END IF;

  IF tx.status = 'successful' THEN
    RETURN QUERY SELECT tx.status, tx.amount;
    RETURN;
  END IF;

  UPDATE public.wallet_transactions SET
    status = _status,
    completed_at = CASE WHEN _status = 'failed' THEN now() ELSE NULL END,
    metadata = tx.metadata || jsonb_build_object('paystack', COALESCE(_payload,'{}'::jsonb))
  WHERE id = tx.id;

  RETURN QUERY SELECT _status, tx.amount;
END; $$;

REVOKE ALL ON FUNCTION public.create_wallet_funding_intent(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_wallet_funding_intent(numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.complete_paystack_funding(text, numeric, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_paystack_funding(text, numeric, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.settle_paystack_funding(text, tx_status, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_paystack_funding(text, tx_status, jsonb) TO service_role;