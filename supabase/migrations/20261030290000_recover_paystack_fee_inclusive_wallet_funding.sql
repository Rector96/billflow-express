-- Recover a Paystack wallet deposit when Paystack's verified bank-transfer
-- charge includes a separately reported fee. The wallet is credited only for
-- the original requested amount, never the fee-inclusive charged amount.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.wallet_transactions
    WHERE provider = 'paystack'
      AND provider_transaction_id IS NOT NULL
    GROUP BY provider, provider_transaction_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate Paystack provider transaction IDs exist; reconcile them before applying this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_paystack_transaction_id_key
  ON public.wallet_transactions (provider, provider_transaction_id)
  WHERE provider = 'paystack' AND provider_transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.recover_paystack_funding(
  _reference text,
  _requested_subunits bigint,
  _charged_subunits bigint,
  _fee_subunits bigint,
  _provider_transaction_id text,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  status public.tx_status,
  credited boolean,
  balance_after numeric,
  amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  tx public.wallet_transactions%ROWTYPE;
  w public.wallets%ROWTYPE;
  before_balance numeric;
  after_balance numeric;
  provider_tx_id text;
  previous_reason text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _reference IS NULL OR btrim(_reference) = '' THEN
    RAISE EXCEPTION 'reference required';
  END IF;

  provider_tx_id := NULLIF(btrim(_provider_transaction_id), '');
  IF provider_tx_id IS NULL OR provider_tx_id !~ '^[0-9]+$' OR provider_tx_id::numeric <= 0 THEN
    RAISE EXCEPTION 'valid provider transaction id required';
  END IF;

  IF _requested_subunits IS NULL OR _requested_subunits <= 0
     OR _charged_subunits IS NULL OR _charged_subunits <= 0
     OR _fee_subunits IS NULL OR _fee_subunits <= 0
     OR _charged_subunits <> _requested_subunits + _fee_subunits THEN
    RAISE EXCEPTION 'invalid fee-inclusive amount reconciliation';
  END IF;

  SELECT *
    INTO tx
    FROM public.wallet_transactions
   WHERE provider = 'paystack'
     AND provider_reference = _reference
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction not found';
  END IF;

  IF tx.type IS DISTINCT FROM 'deposit' THEN
    RAISE EXCEPTION 'transaction is not a deposit';
  END IF;

  IF tx.status = 'successful' THEN
    IF tx.provider_transaction_id IS DISTINCT FROM provider_tx_id THEN
      RAISE EXCEPTION 'successful transaction provider ID mismatch';
    END IF;
    RETURN QUERY SELECT tx.status, false, tx.balance_after, tx.amount;
    RETURN;
  END IF;

  previous_reason := tx.metadata #>> '{paystack,reason}';
  IF tx.status <> 'failed' OR previous_reason IS DISTINCT FROM 'validation_mismatch' THEN
    RAISE EXCEPTION 'transaction is not eligible for fee-inclusive recovery';
  END IF;

  IF round(tx.amount * 100) <> _requested_subunits THEN
    RAISE EXCEPTION 'requested amount does not match wallet funding intent';
  END IF;

  -- Prevent a Paystack transaction ID from being attached to two wallet credits.
  IF EXISTS (
    SELECT 1
      FROM public.wallet_transactions other_tx
     WHERE other_tx.provider = 'paystack'
       AND other_tx.provider_transaction_id = provider_tx_id
       AND other_tx.id <> tx.id
  ) THEN
    RAISE EXCEPTION 'Paystack transaction ID has already been used';
  END IF;

  SELECT *
    INTO w
    FROM public.wallets
   WHERE id = tx.wallet_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet not found';
  END IF;

  IF w.user_id IS DISTINCT FROM tx.user_id THEN
    RAISE EXCEPTION 'wallet owner mismatch';
  END IF;

  IF w.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'wallet not active';
  END IF;

  IF upper(coalesce(w.currency, '')) <> 'NGN' THEN
    RAISE EXCEPTION 'wallet currency mismatch';
  END IF;

  before_balance := w.balance;
  after_balance := before_balance + round(tx.amount, 2);

  UPDATE public.wallets
     SET balance = after_balance
   WHERE id = w.id;

  UPDATE public.wallet_transactions
     SET status = 'successful',
         balance_before = before_balance,
         balance_after = after_balance,
         completed_at = now(),
         provider_transaction_id = provider_tx_id,
         description = 'Wallet funding via Paystack',
         metadata = coalesce(tx.metadata, '{}'::jsonb)
                    || jsonb_build_object(
                      'paystack',
                      coalesce(tx.metadata->'paystack', '{}'::jsonb)
                      || coalesce(_payload, '{}'::jsonb)
                      || jsonb_build_object(
                        'recovered_fee_inclusive', true,
                        'requested_subunits', _requested_subunits,
                        'charged_subunits', _charged_subunits,
                        'fee_subunits', _fee_subunits
                      )
                    )
   WHERE id = tx.id;

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    tx.user_id,
    'Wallet funded',
    'Your wallet was credited with NGN ' || to_char(round(tx.amount, 2), 'FM999,999,990.00') || ' via Paystack.',
    'success',
    jsonb_build_object(
      'reference', tx.reference,
      'provider', 'paystack',
      'mode', coalesce(tx.metadata->>'mode', 'unknown'),
      'recovered_fee_inclusive', true
    )
  );

  RETURN QUERY
    SELECT 'successful'::public.tx_status, true, after_balance, round(tx.amount, 2);
END;
$function$;

REVOKE ALL ON FUNCTION public.recover_paystack_funding(text, bigint, bigint, bigint, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_paystack_funding(text, bigint, bigint, bigint, text, jsonb)
  TO service_role;

NOTIFY pgrst, 'reload schema';
