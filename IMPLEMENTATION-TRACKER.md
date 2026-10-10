# E-Commerce Implementation Tracker

Last updated: 2026-10-10

Business-policy answers are recorded in [COMMERCE-DECISIONS.md](COMMERCE-DECISIONS.md). Stage 0 decision work is **complete for development scope**; missing seller identity, privacy/retention policy, and production operations choices are explicit launch blockers. Stage 1 remains **in progress**: production tax approval, invoice output, real-provider evidence, and frontend workflow evidence are not complete. Backend API integration coverage exercises COD checkout, order ownership, a stock conflict, and Razorpay sandbox success, decline/retry, and order retrieval flows.

This tracker records implementation evidence against [17-implementation-roadmap.md](17-implementation-roadmap.md). A feature is not marked complete solely because code exists; its acceptance evidence and business decisions must also be complete.

## Production-readiness priority order

Use this as the working order for the remaining gaps; the stage checklists below remain the detailed source of status and acceptance evidence.

1. **Close commercial decisions (Stage 0):** Development decisions are recorded: Kerala as the single v1 dispatch state, GST-inclusive prices, synthetic development tax data, shipping/rounding/invoice/credit-note defaults, and cancellation/return defaults. Production remains blocked until the seller/Admin validates real tax and invoice details and the business assigns hosting, secrets, notification, privacy, and operational owners.
2. **Prove checkout and payments (Stage 1):** classify/configure catalog tax data; complete finance validation; test PostgreSQL concurrency, duplicate/replayed/out-of-order provider events, reservation expiry and consumption, and real Razorpay Test Mode delivery/recovery.
3. **Implement live order operations (Stage 2):** build shipment/tracking and return/refund workflows, including admin authorization, audit, inventory disposition, and customer status updates. Connect exactly-once reservation consumption to fulfillment.
4. **Harden and operate production (Stage 3):** complete production security review (including removal/rotation of seeded development admin access and actuator exposure review), durable outbox workers with retries and failure visibility, monitoring/alerts/runbooks, production deployment and rollback evidence, and a tested backup restore against approved RPO/RTO.
5. **Complete release evidence:** reconcile the Spring Boot version used by the application with the blueprint baseline; pass backend and frontend CI, staging smoke/E2E, security/dependency scans, and load/recovery checks before launch.

## Stage 0 — Decisions and contracts

Status: **Complete for development decisions; production launch blocked**

- [x] Select Razorpay as the online payment provider; keep COD as a separate option.
- [x] Choose a configurable GST design that fails checkout for unclassified products.
- [x] Record seller/dispatch state and whether catalog prices include GST: v1 dispatches only from Kerala (GST state code `32`); catalog prices are GST-inclusive. Environment variables can override these application defaults.
- [x] Record development defaults for the existing ₹79 shipping charge/free-over-₹1,499 rule, inclusive GST, paise rounding, invoice/credit-note requirements, cancellation cutoff, and seven-day returns for eligible items. The Admin is the named approver; actual values and representative cases still need approval before production use.
- [x] Record legal seller name/address/GSTIN, invoice numbering, and sample invoice/credit-note output as seller/Admin-owned production launch blockers because the values have not been supplied.
- [x] Record production hosting, secret manager, notification provider, privacy/PII retention policy, and named operational owners as unresolved launch blockers; the business still needs to assign decision owners and select providers.
- [x] Record cancellation and return defaults; their workflows are Stage 2 implementation work, and final public eligibility and return-shipping terms remain pre-launch requirements.

## Stage 1 — Checkout, payments, inventory, and GST

Status: **In progress**

Implemented in the current tree:

- [x] Add forward-only payment, webhook, reservation, movement, tax-rule, and refund schema migrations (`V11`–`V13`).
- [x] Add authoritative GST calculation with effective-dated rules, local CGST/SGST versus interstate IGST, inclusive/exclusive pricing, and fail-closed classification/configuration checks.
- [x] Snapshot GST, HSN/SAC, place of supply, product/variant, price, address, and order totals at checkout.
- [x] Include seller-charged shipping in the GST calculation under the documented provisional composite-supply rule; migration `V16` stores the inclusive delivery allocation and taxable value/CGST/SGST/IGST per order line, preserving paise. This requires tax-owner validation before production use.
- [x] Reserve stock under inventory row locks; persist signed movement records; expire online reservations through a bounded scheduled job.
- [x] Use checkout idempotency and serialize duplicate requests by key; reject a reused key with a different request fingerprint.
- [x] Add Razorpay order creation, verified client confirmation, signed/deduplicated webhooks, amount/currency/reference checks, reconciliation, and idempotent admin refund commands.
- [x] Protect provider-order creation with a database lease and recover an order by its unique receipt after a timeout.
- [x] Reconcile stale payment setup by receipt; reject provider-order creation when the local payment state is no longer payable.
- [x] Prevent reservation expiry from releasing stock after a concurrent payment capture; gate full-order consumption and make repeated consumption idempotent.
- [x] Add React checkout for COD/Razorpay, state selection, pending/review/expired messaging, refresh recovery, and line-level GST display.
- [x] Add an isolated `demo` Spring profile and separate local database with conspicuously synthetic GST categories/rates for checkout development; the demo migration is excluded from the normal migration path and is not production tax data.
- [x] Add unit/context coverage for GST cases, checkout idempotency/stock conflict, sandbox provider behavior, payment setup retry/recovery, expiry racing a completed payment, webhook signature/deduplication, and out-of-order capture/failure transitions.
- [x] Execute the database lease query against the migrated PostgreSQL database in an integration test.
- [x] Full backend test run on 2026-10-10 passed (36 tests, 0 failures/errors), including application startup and Flyway schema validation for the new shipping-tax snapshot columns.
- [x] PostgreSQL integration tests prove two customers competing for the final unit produce one order/reservation; simultaneous same-key checkout replays one order; concurrent payment setup converges on one persisted payment/provider order; webhook replay/out-of-order failure does not regress capture; unpaid reservation expiry releases stock; captured-payment expiry preserves stock for review; and repeated fulfillment consumption changes stock once.
- [x] MockMvc API integration tests cover COD checkout totals and cart clearing, customer order ownership, stock conflict handling, Razorpay sandbox checkout, signed payment confirmation, pending and captured order retrieval, and failed-attempt retry followed by capture.
- [x] React production build passed on 2026-10-10 after the shipping-tax breakdown and return-policy copy updates; Sass emits existing mixed-declaration deprecation warnings.

Still required before Stage 1 can be called complete:

- [ ] Admin/finance validate representative GST-inclusive outputs; real product classifications and effective-dated tax rates still need approved configuration before production checkout can succeed. The 5%, 12%, 18% rates and HSN/SAC strings in the separate demo DB are synthetic only.
- [ ] Implement invoice/credit-note document generation and associated tests after seller identity, financial-year numbering, dispatch timing, and sample output are approved. Checkout/order summaries are not tax invoices.
- [ ] Exercise a real Razorpay Test Mode account end to end, including configured webhook delivery and provider timeout/retry behavior. Test credentials/dashboard access are not available in the repository.
- [ ] Connect exactly-once reservation consumption to the fulfillment command when Stage 2 fulfillment is implemented.
- [ ] Add React workflow tests for payment success, decline/retry, refresh recovery, stock conflicts, and changed totals. API-level coverage exists for COD checkout, stock conflicts, signed sandbox payment confirmation, and order retrieval; it does not replace browser-flow coverage.

## Stage 2 — Fulfillment, returns, and admin operations

Status: **Not started**

- [ ] Shipment/package/carrier models, state transitions, carrier adapter, tracking events, and customer tracking.
- [ ] Return request, eligibility, inspection/quarantine/restock, and refund workflow.
- [ ] API-backed fulfillment and returns admin queues, authorization tests, privileged audit, and operational reports.

## Stage 3 — Security, reliability, deployment, and disaster recovery

Status: **Not started**

- [ ] Complete production CORS/cookie/CSRF/header, rate-limit, privacy, dependency/security scan, and authorization review.
- [ ] Complete durable outbox processing, external dependency timeouts, alerts, runbooks, and failure drills.
- [ ] Add production-matching CI/CD, container images, infrastructure configuration, staging smoke tests, and rollback evidence.
- [ ] Demonstrate encrypted backup/PITR restore against approved RPO/RTO and record the DR drill.

## Launch blockers

- Admin/tax validation of GST calculations and real product classifications/rates remain unresolved; only synthetic demo values exist.
- Seller legal name/address/GSTIN and approved invoice numbering/sample outputs are missing; document generation cannot yet be verified.
- Shipping follows a provisional composite-supply rule with proportional line allocation. Confirm it against actual seller/carrier contracts before production use.
- Production hosting, secret management, notification provider, and operational owner are undecided.
- Privacy/PII retention, deletion requirements, and their accountable owner are not decided.
- Razorpay test/live credentials and dashboard webhook configuration are not supplied in this repository; no credentials or account/UPI details belong in the application database.
- Remaining Stage 1 payment/provider/API evidence, Stage 2 operations, and Stage 3 production/DR gates remain outstanding.
