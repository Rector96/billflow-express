-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('super_admin','admin','support');
CREATE TYPE public.wallet_tx_type AS ENUM ('deposit','bill_payment','refund','reversal','adjustment');
CREATE TYPE public.tx_status AS ENUM ('pending','successful','failed','reversed');
CREATE TYPE public.ticket_category AS ENUM ('payment_not_received','wrong_amount','pending_transaction','token_not_received','other');
CREATE TYPE public.ticket_status AS ENUM ('open','in_progress','resolved','closed');
CREATE TYPE public.notification_type AS ENUM ('success','warning','pending','information','security');

-- ========== SHARED ==========
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ========== ROLES ==========
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('super_admin','admin','support'));
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  email text,
  billpay_id text NOT NULL UNIQUE,
  avatar_url text,
  account_status text NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','suspended','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billpay_id_format CHECK (billpay_id ~ '^[0-9]{8}$')
);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_billpay_id ON public.profiles(billpay_id);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== WALLETS ==========
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric(18,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallets_user_id ON public.wallets(user_id);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own wallet" ON public.wallets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE TRIGGER trg_wallets_updated BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== WALLET LEDGER ==========
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.wallet_tx_type NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  balance_before numeric(18,2) NOT NULL,
  balance_after numeric(18,2) NOT NULL,
  reference text NOT NULL UNIQUE,
  status public.tx_status NOT NULL DEFAULT 'pending',
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wtx_user_created ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX idx_wtx_status ON public.wallet_transactions(status);
CREATE INDEX idx_wtx_reference ON public.wallet_transactions(reference);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own ledger" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- ========== BILL TRANSACTIONS ==========
CREATE TABLE public.bill_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  service text NOT NULL,
  provider text NOT NULL,
  product text,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  customer_identifier text NOT NULL,
  internal_reference text NOT NULL UNIQUE,
  external_reference text,
  status public.tx_status NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_btx_user_created ON public.bill_transactions(user_id, created_at DESC);
CREATE INDEX idx_btx_status ON public.bill_transactions(status);
CREATE INDEX idx_btx_reference ON public.bill_transactions(internal_reference);
GRANT SELECT ON public.bill_transactions TO authenticated;
GRANT ALL ON public.bill_transactions TO service_role;
ALTER TABLE public.bill_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own bill tx" ON public.bill_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE TRIGGER trg_btx_updated BEFORE UPDATE ON public.bill_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== SAVED PAYMENTS ==========
CREATE TABLE public.saved_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service text NOT NULL,
  provider text NOT NULL,
  nickname text NOT NULL,
  customer_identifier text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, service, provider, customer_identifier)
);
CREATE INDEX idx_saved_user ON public.saved_payments(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_payments TO authenticated;
GRANT ALL ON public.saved_payments TO service_role;
ALTER TABLE public.saved_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own saved payments" ON public.saved_payments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_saved_updated BEFORE UPDATE ON public.saved_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== NOTIFICATIONS ==========
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  type public.notification_type NOT NULL DEFAULT 'information',
  read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user_created ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ========== SUPPORT TICKETS ==========
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.bill_transactions(id) ON DELETE SET NULL,
  category public.ticket_category NOT NULL DEFAULT 'other',
  description text NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_user ON public.support_tickets(user_id, created_at DESC);
CREATE INDEX idx_tickets_status ON public.support_tickets(status);
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "create own tickets" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== BILLPAY ID ==========
CREATE OR REPLACE FUNCTION public.generate_billpay_id()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE candidate text; i int := 0;
BEGIN
  LOOP
    candidate := lpad((10000000 + floor(random() * 89999999))::bigint::text, 8, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE billpay_id = candidate);
    i := i + 1;
    IF i > 50 THEN RAISE EXCEPTION 'could not allocate billpay id'; END IF;
  END LOOP;
  RETURN candidate;
END; $$;

CREATE OR REPLACE FUNCTION public.new_reference(prefix text)
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT prefix || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8));
$$;

-- ========== BOOTSTRAP (profile + wallet for current user) ==========
CREATE OR REPLACE FUNCTION public.bootstrap_current_user(_full_name text DEFAULT NULL, _phone text DEFAULT NULL)
RETURNS TABLE (
  profile_id uuid, billpay_id text, full_name text, phone text, email text,
  avatar_url text, account_status text, wallet_id uuid, balance numeric, currency text, wallet_status text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); uemail text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT u.email INTO uemail FROM auth.users u WHERE u.id = uid;

  INSERT INTO public.profiles (user_id, full_name, phone, email, billpay_id)
  VALUES (uid, COALESCE(NULLIF(_full_name,''), split_part(COALESCE(uemail,''),'@',1)), _phone, uemail, public.generate_billpay_id())
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = COALESCE(NULLIF(EXCLUDED.full_name,''), public.profiles.full_name),
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        email = COALESCE(EXCLUDED.email, public.profiles.email);

  INSERT INTO public.wallets (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  SELECT p.id, p.billpay_id, p.full_name, p.phone, p.email, p.avatar_url, p.account_status,
         w.id, w.balance, w.currency, w.status
  FROM public.profiles p JOIN public.wallets w ON w.user_id = p.user_id
  WHERE p.user_id = uid;
END; $$;
GRANT EXECUTE ON FUNCTION public.bootstrap_current_user(text, text) TO authenticated;

-- ========== DEMO WALLET FUNDING (atomic) ==========
CREATE OR REPLACE FUNCTION public.demo_fund_wallet(_amount numeric, _description text DEFAULT 'Demo wallet funding')
RETURNS TABLE (reference text, balance_after numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); w public.wallets%ROWTYPE; ref text; before numeric; after numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 1000000 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet not found'; END IF;
  IF w.status <> 'active' THEN RAISE EXCEPTION 'wallet not active'; END IF;

  before := w.balance;
  after := before + round(_amount, 2);
  ref := public.new_reference('WAL');

  UPDATE public.wallets SET balance = after WHERE id = w.id;
  INSERT INTO public.wallet_transactions
    (wallet_id, user_id, type, amount, balance_before, balance_after, reference, status, description, metadata)
  VALUES (w.id, uid, 'deposit', round(_amount,2), before, after, ref, 'successful', _description,
          jsonb_build_object('demo', true, 'channel', 'demo_funding'));

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (uid, 'Wallet funded (demo)',
          'Your wallet was credited with NGN ' || to_char(round(_amount,2),'FM999,999,990.00') || ' in demo mode.',
          'success', jsonb_build_object('demo', true, 'reference', ref));

  RETURN QUERY SELECT ref, after;
END; $$;
GRANT EXECUTE ON FUNCTION public.demo_fund_wallet(numeric, text) TO authenticated;

-- ========== DEMO BILL PAYMENT (atomic) ==========
CREATE OR REPLACE FUNCTION public.demo_bill_payment(
  _service text, _provider text, _product text, _amount numeric,
  _customer_identifier text, _status public.tx_status, _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (bill_id uuid, internal_reference text, balance_after numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); w public.wallets%ROWTYPE; ref text; wref text;
        before numeric; after numeric; bid uuid; meta jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF _status NOT IN ('successful','pending','failed') THEN RAISE EXCEPTION 'invalid status'; END IF;

  SELECT * INTO w FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet not found'; END IF;

  before := w.balance;
  meta := COALESCE(_metadata,'{}'::jsonb) || jsonb_build_object('demo', true);
  ref := public.new_reference('BIL');

  IF _status = 'failed' THEN
    after := before;
  ELSE
    IF before < round(_amount,2) THEN RAISE EXCEPTION 'insufficient_funds'; END IF;
    after := before - round(_amount,2);
    UPDATE public.wallets SET balance = after WHERE id = w.id;
  END IF;

  INSERT INTO public.bill_transactions
    (user_id, wallet_id, service, provider, product, amount, customer_identifier, internal_reference, status, metadata)
  VALUES (uid, w.id, _service, _provider, _product, round(_amount,2), _customer_identifier, ref, _status, meta)
  RETURNING id INTO bid;

  wref := public.new_reference('WAL');
  INSERT INTO public.wallet_transactions
    (wallet_id, user_id, type, amount, balance_before, balance_after, reference, status, description, metadata)
  VALUES (w.id, uid, 'bill_payment', round(_amount,2), before, after, wref, _status,
          _provider || ' ' || _service || ' (demo)',
          meta || jsonb_build_object('bill_reference', ref, 'bill_id', bid));

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (uid,
    CASE _status WHEN 'successful' THEN _provider || ' payment successful'
                 WHEN 'pending' THEN _provider || ' payment pending'
                 ELSE _provider || ' payment failed' END,
    'Demo ' || _service || ' payment of NGN ' || to_char(round(_amount,2),'FM999,999,990.00') || '.',
    CASE _status WHEN 'successful' THEN 'success'::public.notification_type
                 WHEN 'pending' THEN 'pending'::public.notification_type
                 ELSE 'warning'::public.notification_type END,
    jsonb_build_object('demo', true, 'reference', ref));

  RETURN QUERY SELECT bid, ref, after;
END; $$;
GRANT EXECUTE ON FUNCTION public.demo_bill_payment(text, text, text, numeric, text, public.tx_status, jsonb) TO authenticated;

-- ========== ADMIN STATS ==========
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'active_users', (SELECT count(*) FROM public.profiles WHERE account_status = 'active'),
    'wallet_count', (SELECT count(*) FROM public.wallets),
    'wallet_balance_total', (SELECT COALESCE(sum(balance),0) FROM public.wallets),
    'bill_transactions', (SELECT count(*) FROM public.bill_transactions),
    'bill_successful', (SELECT count(*) FROM public.bill_transactions WHERE status='successful'),
    'bill_pending', (SELECT count(*) FROM public.bill_transactions WHERE status='pending'),
    'bill_failed', (SELECT count(*) FROM public.bill_transactions WHERE status='failed'),
    'bill_volume', (SELECT COALESCE(sum(amount),0) FROM public.bill_transactions WHERE status='successful'),
    'support_open', (SELECT count(*) FROM public.support_tickets WHERE status IN ('open','in_progress')),
    'support_total', (SELECT count(*) FROM public.support_tickets)
  ) INTO result;
  RETURN result;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;