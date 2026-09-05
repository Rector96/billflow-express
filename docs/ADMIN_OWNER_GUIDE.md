# RockPay Admin — Owner guide

## How many admin roles?

There are **3 staff roles** in the database (`user_roles.role`):

| Role | Who | What they can do |
|------|-----|------------------|
| **super_admin** | You (company owner) + trusted leads | Full ops: users, wallet adjust, staff list, settings (margins), all dashboards |
| **admin** | Operations managers | View ops, manage users, settings |
| **support** | Care agents | **View only** — tickets, users read, transactions read |

There is **no fixed number of admin users**. You can grant any number of people each role by inserting rows into `user_roles`.

Permissions (app code in `src/lib/admin.ts`):

- `super_admin` → view, users_manage, staff_manage, wallet_adjust, settings  
- `admin` → view, users_manage, settings  
- `support` → view only  

## How to access admin as company owner

1. **Create / use your login** on the live app (same email you use for RockPay).
2. In **Supabase SQL Editor**, grant yourself `super_admin` (replace the UUID):

```sql
-- Find your user id
select id, email from auth.users order by created_at desc limit 20;

-- Grant owner access
insert into public.user_roles (user_id, role)
values ('YOUR-USER-UUID-HERE', 'super_admin')
on conflict do nothing;

-- Optional: ensure is_staff sees you
select public.is_staff('YOUR-USER-UUID-HERE');
```

3. Open the admin URL on your deployed site:

```text
https://YOUR-NETLIFY-DOMAIN/admin
```

4. Log in with that account if prompted. Non-staff users are redirected to `/home`.

> **Security note:** `src/routes/admin.tsx` still contains a **demo auto-login** path for preview environments. On production, ensure real Supabase auth is configured and consider removing demo credentials before go-live.

## Admin pages (what each does)

| URL | Page | Purpose |
|-----|------|---------|
| `/admin` | **Dashboard** | KPIs: users, funding, success/fail counts, volume charts, live activity |
| `/admin/users` | **Users** | Search customers, open profiles, suspend (if permitted) |
| `/admin/users/$userId` | **User detail** | One customer’s wallet & activity |
| `/admin/transactions` | **Transactions** | All wallet/bill txs; filter pending/failed; search refs |
| `/admin/reconciliation` | **Reconciliation** | Match provider vs ledger (ops) |
| `/admin/wallet` | **Wallet** | Platform wallet overview / adjustments (privileged) |
| `/admin/services` | **Services** | Success rates by bill service (data, cable, etc.) |
| `/admin/care` | **Care** | Support tickets queue |
| `/admin/care/$ticketId` | **Ticket** | Single ticket thread |
| `/admin/reports` | **Reports** | Reporting views |
| `/admin/activity` | **Activity** | Recent operational events |
| `/admin/audit-logs` | **Audit logs** | Who changed what (when audit RPC exists) |
| `/admin/staff` | **Staff** | Lists everyone in `user_roles` |
| `/admin/settings` | **Settings** | Paystack notes + **catalogue margin rules** (data %, exam flat ₦, etc.) |

## Vendor status (VTpass vs VTUAfrica)

| Vendor | Powers | Active when |
|--------|--------|-------------|
| **VTpass** | Airtime, data, cable, electricity | `VTPASS_*` env vars on Netlify |
| **VTUAfrica** | WAEC, NECO, NABTEB, JAMB exam pins | `VTUAFRICA_API_KEY` on Netlify |

Margins for both are controlled under **Admin → Settings** (after `app_settings` migration).

## Checklist so admin does not fail

1. Run migrations in Supabase (including `app_settings` margins + admin ops RPCs).
2. Grant at least one `super_admin` (you).
3. Set `VITE_SUPABASE_*` and `SUPABASE_*` on Netlify; redeploy.
4. Set `VTPASS_*` for live bills; add `VTUAFRICA_API_KEY` when ready for exam pins.
5. Open `/admin` while logged in as that super_admin.

If a page shows “missing function”, apply the named migration in the error message via Supabase SQL.
