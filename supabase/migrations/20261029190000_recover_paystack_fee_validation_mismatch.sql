-- Restricted recovery path for a Paystack funding row incorrectly marked failed
-- after a provider amount/fee validation mismatch.
-- This function is service-role only and MUST only be called after a fresh
-- server-side Paystack verification of the same reference.

CREATE OR REPLACE FUNCTION public.recover_paystack_funding(
  _reference text,
  _requested_subunits bigint,
  _charged_subunits bigint,
  _fee_subunits bigint,
  _provider_transaction_id text,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(status tx_status, credited boolean, balance_after numeric, amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tx public.wallet_transactions%ROWTYPE;
  w public.wallets%ROWTYPE;
  before_balance numeric;
  after_balance numeric;
BEGIN
  IF _reference IS NULL OR btrim(_reference) = '' THEN
    RAISE EXCEPTION 'reference required';
  END IF;
  IF _provider_transaction_id IS NULL OR btrim(_provider_transaction_id) = '' THEN
    RAISE EXCEPTION 'provider transaction id required';
  END IF;
  IF _requested_subunits IS NULL OR _charged_subunits IS NULL OR _fee_subunits IS NULL
     OR _requested_subunits <= 0 OR _fee_subunits < 0
     OR _charged_subunits <> _requested_subunits + _fee_subunits THEN
    RAISE EXCEPTION 'invalid verified amount breakdown';
  END IF;

  -- These fields must come from the server's fresh Paystack verification response.
  IF COALESCE(_payload->>'gateway_status', '') <> 'success'
     OR COALESCE(_payload->>'currency', '') <> 'NGN'
     OR COALESCE((_payload->>'reference_match')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'provider verification evidence incomplete';
  END IF;

  SELECT * INTO tx
  FROM public.wallet_transactions
  WHERE provider = 'paystack' AND provider_reference = _reference
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'transaction not found'; END IF;

  -- Idempotency: an already successful row is never credited twice.
  IF tx.status = 'successful' THEN
    RETURN QUERY SELECT tx.status, false, tx.balance_after, tx.amount;
    RETURN;
  END IF;

  -- Deliberately narrow: this path cannot recover arbitrary failures.
  IF tx.status <> 'failed' THEN
    RAISE EXCEPTION 'transaction is not failed';
  END IF;
  IF COALESCE(tx.metadata->'paystack'->>'reason', '') <> 'validation_mismatch' THEN
    RAISE EXCEPTION 'transaction is not an eligible validation-mismatch recovery';
  END IF;
  IF round(tx.amount * 100)::bigint <> _requested_subunits THEN
    RAISE EXCEPTION 'requested amount does not match wallet intent';
  END IF;

  SELECT * INTO w FROM public.wallets WHERE id = tx.wallet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet not found'; END IF;
  IF w.status <> 'active' THEN RAISE EXCEPTION 'wallet not active'; END IF;

  before_balance := w.balance;
  after_balance := before_balance + round(tx.amount, 2);

  UPDATE public.wallets SET balance = after_balance WHERE id = w.id;

  UPDATE public.wallet_transactions SET
    status = 'successful',
    balance_before = before_balance,
    balance_after = after_balance,
    completed_at = now(),
    updated_at = now(),
    provider_transaction_id = _provider_transaction_id,
    description = 'Wallet funding via Paystack (verified recovery)',
    metadata = COALESCE(tx.metadata, '{}'::jsonb) ||
      jsonb_build_object(
        'paystack_recovery',
        jsonb_build_object(
          'recovered_at', now(),
          'reason', 'verified_fee_inclusive_amount_mismatch',
          'requested_subunits', _requested_subunits,
          'charged_subunits', _charged_subunits,
          'fee_subunits', _fee_subunits,
          'provider_transaction_id', _provider_transaction_id,
          'verification', COALESCE(_payload, '{}'::jsonb)
        )
      )
  WHERE id = tx.id;

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    tx.user_id,
    'Wallet funded',
    'Your wallet was credited with NGN ' || to_char(round(tx.amount, 2), 'FM999,999,990.00') || ' via Paystack.',
    'success',
    jsonb_build_object('reference', tx.reference, 'provider', 'paystack', 'recovered', true)
  );

  RETURN QUERY SELECT 'successful'::tx_status, true, after_balance, round(tx.amount, 2);
END;
$$;

REVOKE ALL ON FUNCTION public.recover_paystack_funding(text, bigint, bigint, bigint, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_paystack_funding(text, bigint, bigint, bigint, text, jsonb)
  TO service_role;
