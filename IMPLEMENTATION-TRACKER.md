# E-Commerce Implementation Tracker

Last updated: 2026-10-10

Business-policy answers are recorded in [COMMERCE-DECISIONS.md](COMMERCE-DECISIONS.md). Stage 0 decision work is **complete for development scope**; missing seller identity, privacy/retention policy, and production operations choices are explicit launch blockers. Stage 1 remains **in progress**: production tax approval, invoice output, and real-provider evidence are not complete. Backend API and React checkout flows have integration and user-level coverage for pre-order GST quotes, stale quote rejection, COD, stock conflicts, Razorpay success, decline/retry, refresh recovery, changed totals, and the Admin payment review queue.

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
- [x] Persist a signed webhook receipt before applying its business transition; serialize duplicate processing, leave transient failures retryable as `RECEIVED`, and durably record permanent failures with safe provider references and error codes using migration `V17`.
- [x] Expose a bounded, paginated, Admin-only payment review queue for reconciliation mismatches and failed webhook events; return safe references/error codes without raw webhook payloads. PostgreSQL API integration tests prove Admin access and customer denial.
- [x] Add migration `V18` to establish inventory movement opening balances; expose a paginated Admin reconciliation API that compares on-hand stock, active reservations, and movement totals without silently repairing differences.
- [x] Instrument the bounded reservation-expiry job with success/failure counts, expired-reservation count, and duration metrics; unit tests prove failures remain visible to the scheduler.
- [x] Protect provider-order creation with a database lease and recover an order by its unique receipt after a timeout.
- [x] Reconcile stale payment setup by receipt; reject provider-order creation when the local payment state is no longer payable.
- [x] Prevent reservation expiry from releasing stock after a concurrent payment capture; gate full-order consumption and make repeated consumption idempotent.
- [x] Add React checkout for COD/Razorpay, state selection, pending/review/expired messaging, refresh recovery, and line-level GST display.
- [x] Add authenticated `POST /api/v1/checkout/quote` backed by the same server pricing calculation as order creation. The quote returns product and delivery GST, totals, and a review hash without creating an order or reservation; order placement requires the hash, recalculates under stock locks, and rejects stale totals before order/reservation writes.
- [x] Add migration `V19` to persist the checkout cart fingerprint separately from the request fingerprint. Same-key retries can replay the saved order after the server clears the cart, while a changed nonempty cart under the same key is rejected.
- [x] Add an isolated `demo` Spring profile and separate local database with conspicuously synthetic GST categories/rates for checkout development; the demo migration is excluded from the normal migration path and is not production tax data.
- [x] Add unit/context coverage for GST cases, checkout idempotency/stock conflict, sandbox provider behavior, payment setup retry/recovery, expiry racing a completed payment, webhook signature/deduplication, and out-of-order capture/failure transitions.
- [x] Execute the database lease query against the migrated PostgreSQL database in an integration test.
- [x] Full backend test run on 2026-10-10 passed (47 tests, 0 failures/errors), including application startup and Flyway validation through `V19`, quote non-mutation, quote-required validation, stale quote rejection, and same-key replay after cart clearing.
- [x] PostgreSQL integration tests prove two customers competing for the final unit produce one order/reservation; simultaneous same-key checkout replays one order; concurrent payment setup converges on one persisted payment/provider order; webhook replay/out-of-order failure does not regress capture; unpaid reservation expiry releases stock; captured-payment expiry preserves stock for review; and repeated fulfillment consumption changes stock once.
- [x] MockMvc API integration tests cover COD checkout totals and cart clearing, customer order ownership, stock conflict handling, Razorpay sandbox checkout, signed payment confirmation, pending and captured order retrieval, and failed-attempt retry followed by capture.
- [x] PostgreSQL webhook integration tests prove amount/currency mismatches cannot capture funds and put the order into review; a signed unknown-order event remains recorded as failed with its provider reference, and duplicate delivery does not create another event. Admin queue tests verify both issue types are visible to admins and denied to customers.
- [x] PostgreSQL inventory reconciliation test proves an on-hand/movement mismatch is reported to an Admin and denied to a customer; the normal payment profile test proves the synthetic `DEMO-GST-*` fixtures are absent.
- [x] React Testing Library/Vitest checkout tests cover quote display/hash submission, COD, Razorpay confirmation, decline/retry without duplicate order placement, refresh recovery with changed server totals, changed-input idempotency, and stock-conflict messaging (6 tests passed on 2026-10-10).
- [x] React production build passed on 2026-10-10 after the quote flow update; Sass emits existing mixed-declaration deprecation warnings.

Still required before Stage 1 can be called complete:

- [ ] Admin/finance validate representative GST-inclusive outputs; real product classifications and effective-dated tax rates still need approved configuration before production checkout can succeed. The 5%, 12%, 18% rates and HSN/SAC strings in the separate demo DB are synthetic only.
- [ ] Implement invoice/credit-note document generation and associated tests after seller identity, financial-year numbering, dispatch timing, and sample output are approved. Checkout/order summaries are not tax invoices.
- [ ] Exercise a real Razorpay Test Mode account end to end, including configured webhook delivery and provider timeout/retry behavior. Test credentials/dashboard access are not available in the repository.
- [x] Connect reservation consumption to the Stage 2 dispatch command, with partial quantities and idempotent/concurrent dispatch coverage. Production carrier acceptance remains outstanding.
- [x] Add API and React flow tests for COD, online success, decline/retry, refresh recovery, stock conflicts, changed totals, and order confirmation. React tests exercise the customer components with mocked API/provider boundaries; real-provider delivery remains a separate gate.

## Stage 2 — Fulfillment, returns, and admin operations

Status: **In progress — development workflows implemented; verification and external acceptance tracked below**

Contracts, role matrix, recovery procedures, fixture expectations, and limitations are in [STAGE-2-OPERATIONS.md](STAGE-2-OPERATIONS.md).

- [x] Add shipment packages, line allocations, history, signed/deduplicated carrier events, split shipments and customer tracking. The carrier is a development sandbox; normal-profile label creation fails until a real adapter exists.
- [x] Consume each dispatched package's reserved units exactly once; retain counters for the order's remaining reservation and reconcile those counters with movements.
- [x] Add customer return requests with ownership, original order policy snapshots, delivery windows per package, quantity limits and durable idempotency.
- [x] Add approval/rejection/cancellation, receipt into quarantine, inspection and exactly-once restocking; failed inspection blocks refund.
- [x] Route approved online return refunds through the Stage 1 service, preserve original order totals, retain refund amount/reason for retries and synchronize confirmed outcomes.
- [x] Replace the static fulfillment dashboard with API-backed order/return queues and actions; add customer tracking/returns and saved-address screens.
- [x] Add Fulfillment, Returns, Refunds, Support, Finance and Reporting roles with server authorization and staff login; add privileged audit and transactional outbox records.
- [x] Add a bounded financial reconciliation report based on durable payment/refund records, including mismatch visibility.
- [ ] Record final backend/React verification totals after the complete suites pass.
- [ ] Integrate and prove a real carrier's booking, label printing, reverse pickup, timeouts/retries and exception recovery.
- [ ] Implement customer order cancellation/partial remainder refunds, COD collection/manual refund handling, and rejected-return disposal or return-to-customer operations.
- [ ] Finish Admin policy editing and public disclosure of category exclusions and return-shipping terms.
- [ ] Obtain finance sign-off on reconciliation fixtures/refund allocation and operations sign-off on carrier exception/manual recovery procedures. Automated tests do not constitute those approvals.

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
- Real-provider delivery/recovery and finance/tax approval remain Stage 1 gates; Stage 2 operations and Stage 3 production/DR gates also remain outstanding.
