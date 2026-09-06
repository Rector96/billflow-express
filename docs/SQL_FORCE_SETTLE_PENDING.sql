-- Run in Supabase SQL Editor NOW.
-- Marks stuck pending bills as successful when VTpass already returned code 000
-- (and status is not an explicit fail / still-processing).
-- Then aligns wallet_transactions so History stops showing Pending.

UPDATE public.bill_transactions
SET
  status = 'successful',
  updated_at = now(),
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('settled_by', 'force_sql_000')
WHERE status = 'pending'
  AND coalesce(metadata->>'vtpass_code', '') IN ('000', '00', '0')
  AND lower(coalesce(metadata->>'vtpass_status', '')) NOT IN (
    'failed', 'reversed', 'refunded', 'cancelled', 'canceled', 'pending', 'initiated', 'processing'
  );

UPDATE public.bill_transactions
SET
  status = 'failed',
  updated_at = now(),
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('settled_by', 'force_sql_fail')
WHERE status = 'pending'
  AND (
    coalesce(metadata->>'vtpass_code', '') IN (
      '010','011','012','013','014','016','017','018','019',
      '021','022','023','024','027','028','030','031','032',
      '034','035','040','083','087','091'
    )
    OR lower(coalesce(metadata->>'vtpass_status', '')) IN ('failed', 'reversed', 'refunded')
  );

-- Align history ledger with bills
UPDATE public.wallet_transactions wt
SET status = bt.status,
    updated_at = now()
FROM public.bill_transactions bt
WHERE wt.metadata->>'bill_reference' = bt.internal_reference
  AND wt.status IS DISTINCT FROM bt.status
  AND bt.status IN ('successful', 'failed');

-- Show result counts
SELECT status, count(*) FROM public.bill_transactions GROUP BY status ORDER BY status;
SELECT status, count(*) FROM public.wallet_transactions WHERE type = 'bill_payment' GROUP BY status ORDER BY status;
