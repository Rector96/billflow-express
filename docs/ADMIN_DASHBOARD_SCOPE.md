# RockPay Admin Dashboard Scope

The admin dashboard is an operations console, not a decorative statistics page.

## Priority views

1. Customers: safe identity lookup, account status, wallet summary, recent transactions.
2. Transactions: searchable lifecycle and provider evidence.
3. Support queue: pending/failed/problem transactions requiring staff attention.
4. Wallet funding: payment attempts, confirmed credits, failed attempts, reconciliation state.
5. Services: catalogue, verification and purchase health for Airtime, Data, Electricity, Cable TV and Education.
6. Pricing: active rules, effective customer pricing, provider cost, margin and controlled changes.
7. Reconciliation: exceptions between wallet, transactions, provider settlement and profit.
8. Staff access: roles and permission boundaries.
9. Audit: immutable operational history for privileged actions.
10. Reports: bounded, exportable operational and financial reporting.

## Design rule

Do not introduce a large visual redesign merely to satisfy this scope. Extend the existing RockPay admin shell and components, keeping mobile usability and established navigation while adding the missing operational capabilities incrementally.
