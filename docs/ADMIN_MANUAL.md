# RockPay Admin — Operations Manual

## Access
1. Staff account in Supabase Auth.
2. Role in `user_roles`: `super_admin` | `admin` | `support`.
3. Open `/admin` after normal login.

| Role | Can do |
|------|--------|
| **support** | View users, txs, care, audit (limited write) |
| **admin** | Suspend/reactivate, freeze wallet, care replies |
| **super_admin** | All of the above + staff management |

## Navigation map
| Menu | Purpose |
|------|---------|
| **Dashboard** | High-level counts |
| **Users** | Search customers → **click row** for full profile |
| **Transactions** | Wallet + bill ledger, status, search |
| **Reconciliation** | Match provider refs / pending |
| **Wallet** | Funding / wallet ops |
| **Services** | Success rates by bill type |
| **Pricing** | Live `pricing_rules` markups |
| **Care** | Support tickets; replies notify the customer |
| **Reports** | Exports / summaries |
| **Activity** | Recent operational activity |
| **Audit Logs** | Who changed what (status, care, wallet) |
| **Staff** | Role assignments (super_admin) |
| **Settings** | Env notes (keys stay on Netlify) |

## Users — enforcement ladder
Open **Users** → click a user.

1. **Suspend account** — product access restricted (`suspended`).
2. **Freeze funds** — wallet `frozen`; balance kept, spend blocked.
3. **Close account** — permanent closed.
4. **Reactivate / Unfreeze** when resolved.

Always enter a **reason** (audit log).

## Care & notifications
Staff reply (not internal note) creates an in-app **notification** for the customer.

## Pricing & money
- Engine: `pricing.server.ts` + table `pricing_rules`.
- **Admin → Pricing** lists rules.
- Airtime: face value; other services: markup from rules.
- Secrets only on Netlify.

## SQL if missing
1. `docs/SQL_TRANSACTION_PIN.sql`
2. `docs/SQL_ADMIN_WALLET_AND_CARE.sql`
