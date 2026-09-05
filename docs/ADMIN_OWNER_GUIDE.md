# RockPay Admin — Owner guide

## Roles (`user_roles.role`)

| Role | Who | What they can do |
|------|-----|------------------|
| **super_admin** | Owner + trusted leads | Full ops: users, wallet freeze, staff, settings, dashboards |
| **admin** | Operations | View ops, manage users, suspend, freeze wallet |
| **support** | Care agents | View-oriented — tickets, users read, transactions read |

Grant roles in Supabase (never invent passwords in SQL):

```sql
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 20;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE lower(email) = lower('you@example.com')
ON CONFLICT (user_id, role) DO NOTHING;
```

Then log in normally and open `/admin`.

## Daily ops

| Menu | Use |
|------|-----|
| Users | Click row → suspend / freeze funds / close |
| Transactions | Search status, requery pending where available |
| Pricing | Live `pricing_rules` markups |
| Care | Reply → customer notification |
| Audit Logs | Who changed account/wallet status |

## Enforcement ladder

1. Suspend account  
2. Freeze wallet (pause funds)  
3. Close account  
Always enter a reason (audit).

## SQL helpers

- `docs/SQL_TRANSACTION_PIN.sql` — customer PIN RPCs  
- `docs/SQL_ADMIN_WALLET_AND_CARE.sql` — wallet freeze + pricing SELECT  

Full ops manual: `docs/ADMIN_MANUAL.md`.
