-- RockPay Care Phase 2
-- Reuses support_tickets; adds messages, ticket numbers, staff updates, waiting status.

-- ========== STATUS: waiting_for_customer ============
DO $$ BEGIN
  ALTER TYPE public.ticket_status ADD VALUE IF NOT EXISTS 'waiting_for_customer';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ========== TICKET COLUMNS ============
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS ticket_number text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_number
  ON public.support_tickets (ticket_number)
  WHERE ticket_number IS NOT NULL;

-- Backfill ticket numbers for any existing rows
UPDATE public.support_tickets
SET ticket_number = 'RP-' || upper(substr(replace(id::text, '-', ''), 1, 6))
WHERE ticket_number IS NULL;

CREATE OR REPLACE FUNCTION public.next_ticket_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n text;
  i int := 0;
BEGIN
  LOOP
    n := 'RP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.support_tickets WHERE ticket_number = n);
    i := i + 1;
    IF i > 30 THEN
      RAISE EXCEPTION 'could not allocate ticket number';
    END IF;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.next_ticket_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_ticket_number() TO authenticated, service_role;

-- ========== MESSAGES ============
CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket
  ON public.support_messages (ticket_id, created_at ASC);

GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Customer: own tickets only, never internal notes
DROP POLICY IF EXISTS "customer read messages" ON public.support_messages;
CREATE POLICY "customer read messages" ON public.support_messages
  FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR (
      is_internal = false
      AND EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = ticket_id AND t.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "customer insert messages" ON public.support_messages;
CREATE POLICY "customer insert messages" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.user_id = auth.uid()
        AND t.status NOT IN ('closed')
    )
  );

DROP POLICY IF EXISTS "staff insert messages" ON public.support_messages;
CREATE POLICY "staff insert messages" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
    AND sender_id = auth.uid()
  );

-- ========== TICKET UPDATE POLICIES ============
GRANT UPDATE ON public.support_tickets TO authenticated;

DROP POLICY IF EXISTS "staff update tickets" ON public.support_tickets;
CREATE POLICY "staff update tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Customers cannot change status/description via client (no update policy for them)

-- ========== CREATE TICKET RPC ============
CREATE OR REPLACE FUNCTION public.create_care_ticket(
  _category public.ticket_category,
  _description text,
  _subject text DEFAULT NULL,
  _reason text DEFAULT NULL,
  _transaction_id uuid DEFAULT NULL,
  _reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  tx_id uuid := _transaction_id;
  existing_id uuid;
  existing_num text;
  tid uuid;
  tnum text;
  body text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  body := nullif(trim(coalesce(_description, '')), '');
  IF body IS NULL OR length(body) < 2 THEN
    body := coalesce(nullif(trim(_reason), ''), 'Support request');
  END IF;

  -- Resolve transaction by internal_reference if needed
  IF tx_id IS NULL AND _reference IS NOT NULL AND length(trim(_reference)) > 0 THEN
    SELECT id INTO tx_id
    FROM public.bill_transactions
    WHERE internal_reference = trim(_reference)
      AND user_id = uid
    LIMIT 1;

    -- Fallback: wallet ledger reference owned by user
    IF tx_id IS NULL THEN
      -- leave null; ticket still valid without bill_transactions link
      NULL;
    END IF;
  END IF;

  -- Duplicate guard: same user + same tx + open/in_progress/waiting
  IF tx_id IS NOT NULL THEN
    SELECT id, ticket_number INTO existing_id, existing_num
    FROM public.support_tickets
    WHERE user_id = uid
      AND transaction_id = tx_id
      AND status IN ('open', 'in_progress', 'waiting_for_customer')
    ORDER BY created_at DESC
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'id', existing_id,
        'ticket_number', existing_num,
        'duplicate', true
      );
    END IF;
  END IF;

  tnum := public.next_ticket_number();

  INSERT INTO public.support_tickets (
    user_id, transaction_id, category, description, status, ticket_number, subject, reason
  ) VALUES (
    uid,
    tx_id,
    _category,
    body,
    'open',
    tnum,
    coalesce(nullif(trim(_subject), ''), left(body, 80)),
    nullif(trim(_reason), '')
  )
  RETURNING id INTO tid;

  INSERT INTO public.support_messages (ticket_id, sender_id, body, is_internal)
  VALUES (tid, uid, body, false);

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    uid,
    'RockPay Care request opened',
    'Your request ' || tnum || ' is open. We will respond soon.',
    'information'
  );

  RETURN jsonb_build_object(
    'id', tid,
    'ticket_number', tnum,
    'duplicate', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_care_ticket(public.ticket_category, text, text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_care_ticket(public.ticket_category, text, text, text, uuid, text) TO authenticated, service_role;

-- ========== STAFF REPLY / NOTE / STATUS ============
CREATE OR REPLACE FUNCTION public.staff_care_reply(
  _ticket_id uuid,
  _body text,
  _internal boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  mid uuid;
  owner uuid;
  tnum text;
  msg text;
BEGIN
  IF uid IS NULL OR NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  msg := nullif(trim(_body), '');
  IF msg IS NULL THEN
    RAISE EXCEPTION 'empty message';
  END IF;

  SELECT user_id, ticket_number INTO owner, tnum
  FROM public.support_tickets WHERE id = _ticket_id;
  IF owner IS NULL THEN
    RAISE EXCEPTION 'ticket not found';
  END IF;

  INSERT INTO public.support_messages (ticket_id, sender_id, body, is_internal)
  VALUES (_ticket_id, uid, msg, coalesce(_internal, false))
  RETURNING id INTO mid;

  UPDATE public.support_tickets
  SET updated_at = now(),
      status = CASE
        WHEN coalesce(_internal, false) THEN status
        WHEN status = 'waiting_for_customer' THEN 'in_progress'
        WHEN status = 'open' THEN 'in_progress'
        ELSE status
      END
  WHERE id = _ticket_id;

  IF NOT coalesce(_internal, false) THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      owner,
      'RockPay Care replied',
      'New reply on ' || coalesce(tnum, 'your request') || '.',
      'information'
    );
  END IF;

  PERFORM public.admin_write_audit(
    CASE WHEN coalesce(_internal, false) THEN 'care_internal_note' ELSE 'care_staff_reply' END,
    'support_ticket',
    _ticket_id::text,
    NULL,
    jsonb_build_object('ticket_number', tnum, 'internal', coalesce(_internal, false))
  );

  RETURN mid;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_care_reply(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_care_reply(uuid, text, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.staff_care_set_status(
  _ticket_id uuid,
  _status public.ticket_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  owner uuid;
  tnum text;
  prev public.ticket_status;
BEGIN
  IF uid IS NULL OR NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT user_id, ticket_number, status INTO owner, tnum, prev
  FROM public.support_tickets WHERE id = _ticket_id;
  IF owner IS NULL THEN
    RAISE EXCEPTION 'ticket not found';
  END IF;

  UPDATE public.support_tickets SET status = _status, updated_at = now()
  WHERE id = _ticket_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    owner,
    'RockPay Care update',
    'Request ' || coalesce(tnum, '') || ' is now ' || replace(_status::text, '_', ' ') || '.',
    'information'
  );

  PERFORM public.admin_write_audit(
    'care_status_change',
    'support_ticket',
    _ticket_id::text,
    NULL,
    jsonb_build_object('from', prev, 'to', _status, 'ticket_number', tnum)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_care_set_status(uuid, public.ticket_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_care_set_status(uuid, public.ticket_status) TO authenticated, service_role;

-- ========== STAFF QUEUE STATS ============
CREATE OR REPLACE FUNCTION public.admin_care_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN jsonb_build_object(
    'open', (SELECT count(*) FROM public.support_tickets WHERE status = 'open'),
    'investigating', (SELECT count(*) FROM public.support_tickets WHERE status = 'in_progress'),
    'waiting', (SELECT count(*) FROM public.support_tickets WHERE status = 'waiting_for_customer'),
    'resolved_today', (
      SELECT count(*) FROM public.support_tickets
      WHERE status = 'resolved'
        AND updated_at >= date_trunc('day', now())
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_care_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_care_stats() TO authenticated, service_role;
