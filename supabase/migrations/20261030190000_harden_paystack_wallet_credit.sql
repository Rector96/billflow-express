-- Harden Paystack wallet crediting at the database boundary.
-- The server must verify Paystack before calling this function; this function
-- independently enforces ledger, wallet ownership, wallet state and currency.

CREATE OR REPLACE FUNCTION public.complete_paystack_funding(
  _reference text,
  _paid_amount numeric,
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
BEGIN
  IF _reference IS NULL OR btrim(_reference) = '' THEN
    RAISE EXCEPTION 'reference required';
  END IF;

  provider_tx_id := NULLIF(btrim(_provider_transaction_id), '');
  IF provider_tx_id IS NULL THEN
    RAISE EXCEPTION 'provider transaction id required';
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

  IF tx.status = 'successful' THEN
    RETURN QUERY SELECT tx.status, false, tx.balance_after, tx.amount;
    RETURN;
  END IF;

  IF tx.status <> 'pending' THEN
    RAISE EXCEPTION 'transaction not pending';
  END IF;

  IF tx.type IS DISTINCT FROM 'deposit' THEN
    RAISE EXCEPTION 'transaction is not a deposit';
  END IF;

  IF _paid_amount IS NULL OR round(_paid_amount, 2) <> round(tx.amount, 2) THEN
    RAISE EXCEPTION 'amount mismatch';
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
                    || jsonb_build_object('paystack', coalesce(_payload, '{}'::jsonb))
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
      'mode', coalesce(tx.metadata->>'mode', 'unknown')
    )
  );

  RETURN QUERY
    SELECT 'successful'::public.tx_status, true, after_balance, round(tx.amount, 2);
END;
$function$;

-- Keep this RPC callable only by the trusted server role.
REVOKE ALL ON FUNCTION public.complete_paystack_funding(text, numeric, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_paystack_funding(text, numeric, text, jsonb)
  TO service_role;

NOTIFY pgrst, 'reload schema';
