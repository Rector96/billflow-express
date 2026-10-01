-- Wallet / financial operations hardening.
-- Read-only operational surfaces only: no wallet math changes, no funding behavior changes.
-- Keeps Paystack crediting and existing ledger semantics intact.

CREATE INDEX IF NOT EXISTS idx_wtx_provider_status_created
  ON public.wallet_transactions (provider, status, created_at DESC)
  WHERE provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wtx_provider_reference
  ON public.wallet_transactions (provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wtx_provider_transaction_id
  ON public.wallet_transactions (provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wtx_wallet_created
  ON public.wallet_transactions (wallet_id, created_at DESC);

-- Staff-only read model for funding operations. It deliberately exposes no
-- auth secrets and does not permit balance mutation.
CREATE OR REPLACE FUNCTION public.admin_wallet_funding_queue(
  _query text DEFAULT '',
  _status text DEFAULT 'all',
  _limit integer DEFAULT 50,
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
  q text := lower(trim(coalesce(_query, '')));
  s text := lower(trim(coalesce(_status, 'all')));
  lim integer := least(greatest(coalesce(_limit, 50), 1), 100);
  off integer := greatest(coalesce(_offset, 0), 0);
BEGIN
  IF uid IS NULL OR NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF s NOT IN ('all', 'pending', 'successful', 'failed', 'reversed') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  RETURN jsonb_build_object(
    'total_count', (
      SELECT count(*)
      FROM public.wallet_transactions w
      LEFT JOIN public.profiles p ON p.user_id = w.user_id
      WHERE w.type = 'deposit'
        AND (s = 'all' OR w.status::text = s)
        AND (
          q = '' OR
          lower(coalesce(w.reference, '')) LIKE '%' || q || '%' OR
          lower(coalesce(w.provider_reference, '')) LIKE '%' || q || '%' OR
          lower(coalesce(w.provider_transaction_id, '')) LIKE '%' || q || '%' OR
          lower(coalesce(p.full_name, '')) LIKE '%' || q || '%' OR
          lower(coalesce(p.email, '')) LIKE '%' || q || '%' OR
          lower(coalesce(p.phone, '')) LIKE '%' || q || '%' OR
          w.user_id::text = q
        )
    ),
    'rows', coalesce((
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC)
      FROM (
        SELECT
          w.id,
          w.reference,
          w.provider,
          w.provider_reference,
          w.provider_transaction_id,
          w.amount,
          w.status,
          w.balance_before,
          w.balance_after,
          w.description,
          w.created_at,
          w.completed_at,
          w.updated_at,
          w.user_id,
          p.full_name AS user_label,
          p.email AS user_email,
          p.phone AS user_phone
        FROM public.wallet_transactions w
        LEFT JOIN public.profiles p ON p.user_id = w.user_id
        WHERE w.type = 'deposit'
          AND (s = 'all' OR w.status::text = s)
          AND (
            q = '' OR
            lower(coalesce(w.reference, '')) LIKE '%' || q || '%' OR
            lower(coalesce(w.provider_reference, '')) LIKE '%' || q || '%' OR
            lower(coalesce(w.provider_transaction_id, '')) LIKE '%' || q || '%' OR
            lower(coalesce(p.full_name, '')) LIKE '%' || q || '%' OR
            lower(coalesce(p.email, '')) LIKE '%' || q || '%' OR
            lower(coalesce(p.phone, '')) LIKE '%' || q || '%' OR
            w.user_id::text = q
          )
        ORDER BY w.created_at DESC
        LIMIT lim OFFSET off
      ) t
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_wallet_funding_queue(text, text, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_wallet_funding_queue(text, text, integer, integer)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
