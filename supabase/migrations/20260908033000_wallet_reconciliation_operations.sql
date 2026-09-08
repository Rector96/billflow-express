-- Read-only wallet reconciliation surface for staff.
-- This detects ledger-chain and wallet-balance inconsistencies without mutating money.

CREATE OR REPLACE FUNCTION public.admin_wallet_reconciliation(
  _limit integer DEFAULT 100,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  lim integer := least(greatest(coalesce(_limit, 100), 1), 250);
  off integer := greatest(coalesce(_offset, 0), 0);
BEGIN
  IF uid IS NULL OR NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN jsonb_build_object(
    'wallet_count', (SELECT count(*) FROM public.wallets),
    'wallet_balance_total', coalesce((SELECT sum(balance) FROM public.wallets), 0),
    'ledger_deposit_total', coalesce((SELECT sum(amount) FROM public.wallet_transactions WHERE type = 'deposit' AND status = 'successful'), 0),
    'ledger_debit_total', coalesce((SELECT sum(amount) FROM public.wallet_transactions WHERE type = 'debit' AND status = 'successful'), 0),
    'ledger_refund_total', coalesce((SELECT sum(amount) FROM public.wallet_transactions WHERE type = 'refund' AND status = 'successful'), 0),
    'pending_funding_count', (SELECT count(*) FROM public.wallet_transactions WHERE type = 'deposit' AND provider = 'paystack' AND status = 'pending'),
    'pending_funding_total', coalesce((SELECT sum(amount) FROM public.wallet_transactions WHERE type = 'deposit' AND provider = 'paystack' AND status = 'pending'), 0),
    'anomalies', coalesce((
      SELECT jsonb_agg(row_to_json(a)::jsonb ORDER BY a.severity DESC, a.created_at DESC)
      FROM (
        SELECT
          'wallet_balance_chain'::text AS issue,
          'high'::text AS severity,
          w.id AS wallet_id,
          w.user_id,
          p.full_name AS user_label,
          p.email AS user_email,
          w.balance AS current_balance,
          wtx.created_at,
          'Latest ledger balance_after does not equal wallet balance'::text AS detail
        FROM public.wallets w
        JOIN LATERAL (
          SELECT wt.balance_after, wt.created_at
          FROM public.wallet_transactions wt
          WHERE wt.wallet_id = w.id AND wt.status = 'successful'
          ORDER BY wt.created_at DESC, wt.id DESC
          LIMIT 1
        ) wtx ON true
        LEFT JOIN public.profiles p ON p.user_id = w.user_id
        WHERE round(w.balance,2) <> round(wtx.balance_after,2)

        UNION ALL

        SELECT
          'ledger_chain'::text,
          'high'::text,
          w.id,
          w.user_id,
          p.full_name,
          p.email,
          w.balance,
          x.created_at,
          'A successful ledger entry balance_before does not match the preceding successful balance_after'::text
        FROM public.wallets w
        JOIN LATERAL (
          SELECT wt.id, wt.balance_before, wt.created_at,
                 lag(wt.balance_after) OVER (ORDER BY wt.created_at, wt.id) AS prior_after
          FROM public.wallet_transactions wt
          WHERE wt.wallet_id = w.id AND wt.status = 'successful'
          ORDER BY wt.created_at DESC, wt.id DESC
          LIMIT 250
        ) x ON true
        LEFT JOIN public.profiles p ON p.user_id = w.user_id
        WHERE x.prior_after IS NOT NULL
          AND round(x.balance_before,2) <> round(x.prior_after,2)

        UNION ALL

        SELECT
          'funding_balance_delta'::text,
          'high'::text,
          wt.wallet_id,
          wt.user_id,
          p.full_name,
          p.email,
          wt.balance_after,
          wt.created_at,
          'Successful deposit amount does not equal balance_after minus balance_before'::text
        FROM public.wallet_transactions wt
        LEFT JOIN public.profiles p ON p.user_id = wt.user_id
        WHERE wt.type = 'deposit'
          AND wt.status = 'successful'
          AND round(wt.balance_after - wt.balance_before, 2) <> round(wt.amount, 2)

        UNION ALL

        SELECT
          'pending_funding_age'::text,
          CASE WHEN wt.created_at < now() - interval '24 hours' THEN 'high' ELSE 'medium' END,
          wt.wallet_id,
          wt.user_id,
          p.full_name,
          p.email,
          wt.amount,
          wt.created_at,
          'Paystack funding has remained pending beyond the expected operational window'::text
        FROM public.wallet_transactions wt
        LEFT JOIN public.profiles p ON p.user_id = wt.user_id
        WHERE wt.type = 'deposit'
          AND wt.provider = 'paystack'
          AND wt.status = 'pending'
          AND wt.created_at < now() - interval '30 minutes'
      ) a
      OFFSET off LIMIT lim
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_wallet_reconciliation(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_wallet_reconciliation(integer, integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
