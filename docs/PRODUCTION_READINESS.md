# RockPay production-readiness standard

This document defines the operating standard for the RockPay production hardening pass. It is a control checklist, not a claim that the application is already production-ready.

## Core principles

- Never invent provider data, prices, customer names, tokens, or transaction outcomes.
- A successful customer payment must be backed by a confirmed provider outcome.
- If provider confirmation is unavailable after debit, keep the transaction pending and make the confirmation path explicit.
- Wallet debit, provider settlement, and RockPay profit are separate accounting events.
- Profit is recorded only for successful provider-backed transactions and must be idempotent.
- Requery must remain available for unresolved provider transactions.
- Admin actions must be authenticated, authorized, auditable, and least-privilege.
- Customer support must be able to identify a customer and trace a payment without exposing secrets or financial credentials.
- Financial and operational records must be searchable by transaction ID, provider request ID, user/customer, status, service, and date.
- Production operation must not depend on mock catalogue data.

## Admin operating areas

The admin surface should ultimately cover:

1. Dashboard: transaction volume, successful/failed/pending counts, wallet funding, service health, and operational alerts.
2. Customers: search by customer identity and account identifiers available to staff; view account status, wallet balance, transaction history, and support-relevant activity without exposing secrets.
3. Transactions: search/filter by transaction ID, provider request ID, customer, service, status, date, and provider; inspect the full lifecycle and provider response metadata.
4. Support: locate a customer or transaction quickly, understand the current state, and record/track support actions without altering financial records directly.
5. Wallets/funding: inspect funding attempts and confirmed credits; distinguish payment initiation from confirmed wallet credit; provide reconciliation visibility rather than manual balance edits.
6. Pricing: view active rules, priorities, provider/product specificity, effective customer price, and profit/margin controls; changes require authorization and audit history.
7. Service/provider health: show catalogue/verification/payment availability and recent provider failures separately from customer payment outcomes.
8. Reconciliation: surface mismatches between wallet, bill transactions, provider settlement, and recorded profit.
9. Audit log: record sensitive admin actions with actor, action, target, timestamp, and result.
10. Access control: role-based permissions so support staff cannot perform privileged financial/configuration operations unless explicitly authorized.

## Scale expectation

The application should be engineered and tested for growth toward 100,000+ registered users and substantially higher transaction volume. This requires indexed search paths, bounded queries, pagination, idempotent writes, safe retries, provider timeouts, observability, and load testing before declaring production readiness.

## Current status

This document is intentionally a standard and gap checklist. Passing the checklist requires evidence from code review, database/security verification, automated tests, provider sandbox/live integration tests, and load/operational testing. It must not be used as evidence that those checks have already passed.
