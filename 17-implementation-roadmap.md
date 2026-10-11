# Production Implementation Roadmap

## Purpose

This document turns the production blueprint into an ordered implementation plan for the current Java backend and React application. The blueprint remains the requirements source; this roadmap records the observed baseline, the recommended sequence, the work to do, and the evidence required to call each stage complete.

The roadmap is intentionally gated. Money, order state, tax, and inventory correctness come first. Fulfillment and administrative workflows follow. Production security, reliability, deployment, and disaster recovery close the release path.

## Current baseline

At the time this roadmap was first assessed, the repository had the following gaps. Implementation has since begun; current progress and remaining acceptance evidence are recorded in [IMPLEMENTATION-TRACKER.md](IMPLEMENTATION-TRACKER.md).

- The foundation already included Spring Boot/React, PostgreSQL migrations, Redis-backed sessions/cart, catalog APIs and screens, COD checkout, customer order history, checkout inventory row locking, and basic logging/Prometheus configuration.
- Stage 1 has since added Razorpay payment records and provider calls, signature-checked/deduplicated webhooks, refund/reconciliation paths, durable stock reservations and expiry, and database-driven GST classification/rates with immutable order tax snapshots.
- Kerala seller state and GST-inclusive prices are selected. Development defaults for shipping tax, rounding, invoice/credit-note requirements, cancellation, and returns are recorded in `COMMERCE-DECISIONS.md`; the Admin/tax approver must validate them against the actual business before production use.
- Synthetic HSN/SAC strings and 5%, 12%, and 18% rates live only in the separate demo database. Production catalog classification/rates and seller invoice identity remain missing.
- Seller-charged delivery is now tax-snapshotted by line under the provisional ancillary/composite-supply rule, with deterministic paise allocation. Invoice/credit-note generation and the actual dispatch trigger remain unimplemented.
- Inventory reservation, release/expiry, and idempotent consumption are implemented. Migration `V18` establishes movement-ledger opening balances; an Admin reconciliation API compares movement totals and active reservations to stock without silently repairing discrepancies. The expiry job records run outcomes, duration, and expired-reservation metrics. Consumption is not yet connected to a fulfillment command.
- Shipment, return, carrier, and operational admin workflows remain unimplemented. The existing fulfillment screen is not production workflow evidence.
- Backend unit/context and PostgreSQL integration/API coverage now includes final-unit checkout, same-key duplicate checkout, non-mutating checkout quotes with stale-hash rejection, payment-setup concurrency and timeout recovery, webhook replay/out-of-order handling and failure review, reservation expiry and consumption, inventory discrepancy review, customer/admin authorization, and exclusion of synthetic GST fixtures from the normal profile. Six React checkout workflow tests cover quote display/hash submission and checkout flows. Live Razorpay Test Mode delivery and finance validation remain outstanding.
- Production CI/CD, infrastructure-as-code, deployment, security review, and disaster-recovery evidence remain outstanding.

## Implementation status

As of 2026-10-10, Stage 0 decision work is **complete for development scope**, with seller identity, privacy/retention, and production operations recorded as launch blockers. Stage 1 is **in progress**. The code has a Razorpay adapter, a test-only sandbox adapter, provider-order idempotency recovery by receipt, scheduled recovery for stale payment setup, a database lease against concurrent provider-order creation, configurable GST rules, required server-side checkout quotes with stale-hash rejection, durable cart fingerprints for replay after session clearing, checkout tax snapshots, race-safe stock reservation expiry, inventory movement reconciliation, guarded/idempotent inventory consumption, Admin payment/inventory review APIs, and customer checkout/payment UI. Shipping GST is calculated using a documented provisional composite-supply assumption and stored separately from product tax. PostgreSQL tests prove final-unit checkout does not oversell, same-key checkout replays a single order even after the cart is cleared, stale quotes create no order or reservation, concurrent payment setup converges on one payment/provider order, duplicate/out-of-order webhooks cannot regress a captured payment, expiry metrics report outcomes, inventory mismatches surface for Admin review, and fulfillment consumption is idempotent. On 2026-10-10 the backend suite passed with 47 tests and zero failures/errors; six React checkout tests and the React production build passed. Invoice/credit-note output, finance-approved production tax data, live Razorpay Test Mode delivery, Stage 2, and Stage 3 evidence remain outstanding. See the tracker for acceptance gates.

## Delivery principles

1. PostgreSQL is the durable source of truth for orders, payments, reservations, tax snapshots, audit, and outbox state. Redis may support sessions, carts, caching, or rate limiting, but must not be the only copy of commercial state.
2. The backend calculates and persists all financial totals. The browser submits choices and customer data, never authoritative prices, tax, shipping cost, or stock counts.
3. State changes use explicit transitions with legal-state checks. Payment, order, shipment, return, and refund state must not be freely overwritten.
4. Every external side effect is retry-safe or idempotent. Persist local intent before relying on a provider callback; use an outbox for effects that follow a committed transaction.
5. Database changes use expand/contract migrations so old and new application versions can overlap during rollout.
6. A stage is complete only when its code, migrations, tests, operational notes, and acceptance evidence agree. A checked tracker box alone is not completion evidence.

## Stage 0 — Decisions and contracts

Resolve decisions that affect data shape and provider integration before building dependent features. Record the decisions in `ARCHITECTURE-DECISIONS.md` or an approved product/operations document.

### Work

- Select the initial payment provider and supported methods, currency, capture/refund behavior, sandbox access, webhook signing scheme, and provider timeout/retry limits. Preserve COD as an explicit method if the business wants it.
- Have finance/tax stakeholders confirm seller state/location, supported destinations, GST-inclusive or GST-exclusive catalog prices, product tax/HSN classification ownership, rounding policy, invoice fields, credit-note rules, and effective-date handling.
- Confirm reservation policy: when stock is reserved, reservation expiry duration, payment-failure and customer-cancellation handling, and when reserved stock becomes consumed.
- Confirm shipping/return policy inputs: serviceable regions, shipping methods/rates, delivery estimate source, return window by product/category, pickup/refund workflow, and split-shipment expectations.
- Choose initial production hosting, secret manager, email/SMS provider, object storage (if product media is uploaded), and the person/team accountable for production operations.
- Define PII retention/deletion requirements and payment-data boundaries. Do not store card credentials or sensitive authentication data in this application.

### Exit criteria

- Decisions above are recorded with an owner and an answer; unresolved choices are explicitly marked as launch blockers.
- API and state-machine contracts for checkout, payment, inventory reservation, shipment, return, and refund are reviewed before implementation begins.

## Stage 1 — Correct and testable checkout, payments, inventory, and GST

**Outcome:** a customer can place an order through supported payment methods with authoritative totals, race-safe stock reservations, durable state, and replay-safe provider events.

### 1A. Commercial schema and order snapshots

Add forward-only Flyway migrations and corresponding entities/repositories for the missing durable commercial records. Adapt names to existing conventions; avoid rewriting deployed migrations.

- Payment: internal ID, order ID, provider, provider payment/intent reference, amount, currency, state, captured/refunded totals, timestamps, and safe failure metadata.
- Provider webhook event: provider + unique provider event ID, received/processed state, timestamps, and safe payload/reference needed for investigation. Apply retention and redaction policy to raw payloads.
- Inventory reservation: order/line/variant, quantity, state, expiry, creation and transition timestamps. Ensure uniqueness and constraints prevent double release or double consumption.
- Inventory movement: variant, signed quantity, reason, actor/source, reference, and timestamp. Capture reservation, release, consumption, and admin adjustment as distinct movements.
- Order/line snapshots: currency, variant/SKU/name, quantity, unit price, discount, line totals, tax category and component breakdown, shipping choice/cost, and address snapshot. Historical totals must not change when catalog or tax rules change.
- Idempotency: scope keys by operation and actor/customer; persist request hash, processing/result state, replayable response/reference, and expiry. Keep uniqueness in PostgreSQL.
- Add database constraints and indexes for state, unique provider event IDs, provider references, reservation expiry, payment/order lookup, and inventory history.

### 1B. Inventory reservation lifecycle

Build the reservation workflow around the existing row-level lock and `on_hand - reserved` invariant.

1. In a single transaction, lock affected variant rows in deterministic ID order, re-read active product/variant and available quantity, then create reservations and movement records.
2. Persist the order and the exact priced/taxed snapshot under the same checkout operation. Make repeated checkout requests with the same idempotency key return the original result; reject reuse with a different request fingerprint.
3. Release reservations exactly once on payment failure, payment expiry, order cancellation, or reservation expiry. Record each release as a movement.
4. On fulfillment, consume reserved quantity and reduce on-hand quantity exactly once. A retry of fulfillment must not consume stock a second time.
5. Provide an expiry worker with bounded batches, safe concurrent execution, retry visibility, and metrics. Reconcile inventory counts from movements/reservations and surface discrepancies instead of silently repairing unexplained differences.
6. Keep catalog stock adjustment as an auditable admin command with a reason; enforce that adjustment cannot make available quantity negative.

### 1C. Payment domain and provider adapter

- Introduce a provider-neutral payment interface with a sandbox implementation for automated tests and the selected provider adapter for real integration.
- Implement explicit payment transitions such as `CREATED`, `REQUIRES_ACTION`, `AUTHORIZED`, `CAPTURED`, `FAILED`, `CANCELLED`, `EXPIRED`, `PARTIALLY_REFUNDED`, and `REFUNDED`; define allowed transitions and amount/currency checks.
- Add authenticated checkout APIs for validation, shipping options, payment-intent creation, and order placement according to the API blueprint. Do not treat a browser redirect or success callback as proof of payment.
- Support asynchronous payment confirmation. Where provider flow requires it, keep the order pending until a signature-verified event confirms the expected provider reference, amount, and currency.
- Implement webhook signature validation, provider event deduplication, legal transition checks, row locking where needed, durable event persistence, and an idempotent response to duplicate delivery.
- Add payment retry only where the provider and current payment state allow it. Retries must reuse a safe idempotency key or create a new, linked attempt according to the provider contract.
- Implement refund commands with amount bounds (`new refunds <= captured - previously refunded`), reason, actor, provider reference, and safe idempotency. Refund state changes and local records must remain consistent when the provider times out.
- Add scheduled reconciliation between provider and local payment state; mismatches become visible work items/alerts and are never silently marked paid.
- Retain COD only as a separate explicit payment flow with its own order confirmation/cancellation rules; do not route COD through card-payment state.

### 1D. GST/tax engine

- Replace the hard-coded 18% calculation with a rule-driven engine using seller location, ship-to/place-of-supply, product tax category/HSN, effective date, and inclusive/exclusive pricing policy.
- Calculate and preserve applicable component breakdowns, including CGST/SGST or IGST as determined by the tax policy. Define precision and rounding at line and order level and test reconciliation to the payable total.
- Add product tax classification and effective-dated tax-rule storage/configuration. Validate missing or invalid tax classification before checkout rather than defaulting to a possibly incorrect rate.
- Persist tax amount/rate/components and classification snapshots on order lines. Later rule changes must not alter old order, invoice, or refund calculations.
- Implement invoice and credit-note data requirements only after finance confirms the required fields and numbering policy. Keep legal/tax sign-off as a go-live gate.

### 1E. Checkout API and React experience

- Replace the single all-in-one checkout assumption with explicit validate, shipping-options, payment-intent, and order-placement operations. Keep all amount calculation on the backend.
- Return structured conflicts for changed price, unavailable stock, expired reservation, invalid address, unsupported destination, payment-required action, and provider failure so the UI can recover without duplicating the order.
- Persist enough client checkout state to recover after refresh, while treating the server-side order/payment state as authoritative. Reuse idempotency key for retry of the same submit; do not reuse it for a materially changed request.
- Show payment action/redirect, pending, failure, retry, and confirmed states. Confirmation page reads the order from the API and never derives payment success from query parameters.
- Present backend-calculated line totals, discounts, shipping, tax breakdown, and final payable total before submission; refresh/revalidate when address or shipping option changes.

### Stage 1 verification and exit criteria

- Unit tests cover price/tax rounding, tax jurisdiction split, allowed state transitions, refund limits, reservation expiry/release/consume, and idempotency request fingerprints.
- PostgreSQL integration tests run migrations and verify constraints, rollback behavior, and order/payment/reservation snapshots.
- Concurrency test: two independent customers attempt to buy the final unit; no oversell occurs and only valid reservations/orders survive.
- Idempotency tests cover simultaneous duplicate requests, replay after success, mismatched payload under the same key, and retry after a transient provider error.
- Webhook tests cover valid signature, invalid signature, duplicate event, out-of-order event, wrong amount/currency/reference, and delayed event.
- Provider sandbox tests cover success, decline, timeout, customer action, duplicate callback, and refund. Test secrets are isolated from production.
- API/React flow tests cover COD (if retained), successful online payment, failure/retry, refresh recovery, stock conflict, changed totals, and order confirmation.
- A reconciliation test proves provider/local mismatches are surfaced without falsely changing payment to captured.
- Finance/tax owner approves representative GST cases and sample invoice/credit-note outputs before production payment is enabled.

## Stage 2 — Fulfillment, returns, refunds, and admin operations

**Current development progress (2026-10-11):** shipment/return APIs, split-package stock consumption, sandbox carrier events, customer tracking, return inspection/refund recovery, role-scoped staff queues, saved addresses, and reconciliation fixtures are implemented. Backend formatting and 63 tests passed on a fresh PostgreSQL database through migration V22; 11 React tests and the production build passed. See [STAGE-2-OPERATIONS.md](STAGE-2-OPERATIONS.md) for the contracts and verification matrix. Real-carrier integration, order cancellation/COD recovery, and finance/operations sign-off remain open; Stage 2 is not complete.

**Prerequisite:** Stage 1 order, payment, inventory, tax, and audit records are stable. Any administrative refund uses the Stage 1 refund service; it must not directly edit totals or payment state.

### 2A. Fulfillment and shipping

- Add shipment, package, shipment-item allocation, carrier, tracking event, and shipment state-history models. Support one order split across multiple shipments if required by operations.
- Implement explicit shipment transitions, label/AWB creation, dispatch, in-transit, delivered, exception, and cancellation paths. Keep shipment lifecycle separate from order lifecycle.
- Define a carrier adapter and sandbox/fake adapter. Protect external calls with bounded timeouts, idempotency, retry policy, and circuit breaker; shipment creation retries must not create duplicate labels/shipments.
- Accept authenticated/deduplicated carrier tracking webhooks or poll the carrier under a durable job. Persist status updates and publish customer notifications through the outbox.
- Consume reserved inventory exactly once at the agreed fulfillment point. Handle partial shipments and partial cancellations without corrupting remaining reservations.
- Add customer order tracking view and admin queue/detail screens with empty, loading, permission, and error states.

### 2B. Returns and refunds

- Add return request and line-item quantities, reason, evidence references where supported, eligibility/policy snapshot, decision actor, inspection outcome, and state history.
- Enforce delivered-order eligibility, return window, category policy, quantity already returned, and amount already refunded. Define cancellation and rejected paths.
- Implement pickup/receipt/inspection steps where the operating model needs them. Keep returned inventory quarantined until inspection/restock decision; restock as a movement, never by directly incrementing a display count.
- Route approved refund through the payment refund service with idempotency. Partial returns and partial refunds must preserve the order's immutable original totals and update derived payment/order status correctly.
- Notify customer of request, approval/rejection, pickup/inspection, and refund outcome through durable outbox events.

### 2C. Admin and finance workflows

- Define granular roles/permissions for catalog, inventory, order support, fulfillment, returns, refunds, finance, and read-only reporting. Enforce authorization server-side for every operation.
- Build admin APIs for order search/detail/status commands, inventory queries/adjustments, shipment operations, return decisions, refund requests, customer lookup, and reports. Use allowlisted filters/sorts and standardized pagination.
- Replace the static fulfillment dashboard with API-backed queues and actions. Add order/return detail and clear command results; hide/disable actions the actor cannot perform.
- Add reason codes, actor identity, before/after values where appropriate, request/correlation ID, and timestamp to privileged audit events. Never include secrets or payment credentials.
- Implement financial reconciliation/report exports as traceable jobs if large; report job status and allow authorized retrieval. Keep report numbers based on durable order/payment/refund records.
- Add customer profile/address management, order tracking, and return-request screens needed for support load reduction.

### Stage 2 verification and exit criteria

- Integration tests cover shipment state transitions, duplicate carrier callbacks, split shipments, partial fulfillment, and exactly-once reserved-stock consumption.
- Return tests cover policy window, ineligible order, excessive quantity, duplicate request, rejected return, restock/quarantine, partial refund, refund retry, and repeated provider callback.
- Authorization tests prove each role can perform only its allowed admin commands; include IDOR tests for customer-owned orders, addresses, returns, and tracking.
- UI workflow tests exercise order queue to shipment, customer tracking, return request to decision, and refund result, including failure/retry states.
- Finance verifies a reconciliation report against known fixtures; operations signs off carrier exception and manual recovery procedures.

## Stage 3 — Security, reliability, observability, deployment, and DR

**Prerequisite:** Stages 1 and 2 acceptance criteria pass in a production-like environment. Production launch remains blocked until the go-live gates in blueprint part XV are green.

### 3A. Security and privacy

- Replace localhost-only CORS with environment-specific allowlists; review credentialed CORS and CSRF behavior for the actual cookie/session deployment.
- Configure secure, HttpOnly, SameSite cookies, session rotation/fixation controls, session revocation, TLS, HSTS, CSP, and security headers for production.
- Add API rate limits and brute-force controls for login, registration, checkout, payment, and sensitive admin operations. Return standardized 429 responses.
- Enforce request-size/content-type limits, DTO validation, safe filtering/sorting, and upload type/size/scanning policy if uploads are added.
- Add admin MFA where risk/business policy requires it, privileged audit logs, PII classification/retention, deletion/anonymization workflows, and breach/credential-rotation procedures.
- Add dependency/SCA, SAST, secret scanning, container scanning, SBOM, and staging DAST gates. Document any accepted finding with owner and expiry.

### 3B. Reliability and background processing

- Complete transactional outbox publisher with leases/claiming, attempts, next-attempt time, last error, dead-letter state, safe replay, and queue-age/failed-event metrics.
- Make notification, payment, carrier, reservation-expiry, and reconciliation jobs durable and observable; define safe retry conditions and manual replay procedure.
- Add bounded connection/read/overall timeouts and circuit breakers for each external dependency. Degrade non-critical email/analytics/recommendations without failing order correctness.
- Add payment, shipment, inventory, and outbox reconciliation jobs with dashboards/alerts and an operator playbook.
- Test worker restart/crash after side effect, Redis outage, DB outage, payment timeout, provider outage, duplicate event, and deployment during checkout.
- Use distributed locks only for work that cannot be safely claimed through database locking/constraints. Configure and test lock expiry and ownership.

### 3C. Observability and performance

- Add request/correlation IDs end-to-end, structured logs with PII redaction, distributed traces, error tracking, and business metrics for checkout conversion, payment failures, inventory conflicts, refunds, outbox backlog, and worker age.
- Publish dashboards for API/application, PostgreSQL, Redis, payments, fulfillment, and workers; define actionable alert thresholds, on-call ownership, SLOs, and runbooks.
- Measure representative customer/admin flows, API p95/p99, database plans, connection pool usage, image delivery, and frontend bundle/Core Web Vitals. Set budgets based on measured target traffic.
- Run load, peak, soak, and checkout-concurrency tests before launch; tune indexes, pagination, and caching from observed bottlenecks.

### 3D. CI/CD and production infrastructure

- Add reproducible frontend/backend builds and pipeline gates for lint/typecheck, unit/integration tests, migration validation on production-matching PostgreSQL, security scans, artifact/image build, SBOM, and staging smoke/E2E tests.
- Add multi-stage non-root container images and environment-specific configuration for local, test, staging, and production. Do not bake secrets into source, images, or frontend bundles.
- Provision production resources via reviewed infrastructure-as-code or an equivalent reproducible platform configuration: TLS/edge controls, private DB networking, resource limits, health probes, restricted network access, object storage security, and secret-manager references.
- Deploy to staging, validate migrations and payment sandbox, then document production approval, rollout, post-deployment checks, and rollback. Use expand/contract schema changes compatible with overlapping app versions.
- Confirm CDN/cache invalidation and static asset rollback for React. Confirm backend image retention and database migration recovery strategy.

### 3E. Disaster recovery

- Confirm business-approved RPO/RTO. Blueprint starting targets are RPO 15 minutes and RTO 1 hour; treat them as targets until demonstrated on the selected platform.
- Configure encrypted PostgreSQL base backups plus WAL archiving/PITR in a separate failure domain, with retention and separate backup credentials. Restrict/alert backup deletion.
- Define Redis recovery expectations; Redis loss must not lose durable orders, payment state, inventory, or returns.
- Add isolated restore environment and scripted integrity/smoke checks. Record restore duration and compare it to RTO.
- Document and drill database loss/PITR, region or zone loss, bad release, corruption, credential compromise, backup compromise, and worker recovery.
- Keep incident contacts, escalation, DNS/CDN steps, secret rotation, validation, and recovery commands in a runbook without secrets.

### Stage 3 verification and exit criteria

- CI blocks merge/release on failing checks and records artifacts, migration results, SBOM, and security scan results.
- Staging smoke suite verifies health, login, catalog, cart, sandbox payment, order retrieval, metrics, and rollback-compatible migration behavior.
- Security review includes authorization/IDOR, XSS, SQL injection, CSRF/CORS, rate-limit, cookie/header, and secret-leak checks.
- Failure drills demonstrate bounded recovery and no false paid state, duplicate refund, oversell, or lost committed order during dependency/worker failures.
- Restore drill demonstrates the approved RPO/RTO and validates order, payment, inventory, and reconciliation consistency.
- Production runbooks, alert routing, on-call owner, rollback plan, tax/finance approval, payment-provider approval, and production smoke evidence are signed off.

## Cross-stage test strategy

Keep tests close to each behavior and run the full relevant suite at every merge/release gate:

| Layer | Required evidence |
| --- | --- |
| Domain/unit | Pricing and GST rules, rounding, state transitions, refund bounds, reservation math, eligibility/policy rules |
| PostgreSQL integration | Flyway clean install/upgrade, constraints, transaction rollback, row locks, snapshots, idempotency, outbox claiming |
| API/contract | Request validation, standardized errors, auth/ownership, idempotency headers, payment/webhook and admin contracts |
| Concurrency | Final-unit checkout race, duplicate order/payment/refund submissions, simultaneous webhook/job processing |
| Provider sandbox | Payment action/success/failure/timeout, verified and duplicate webhooks, refund and reconciliation |
| React workflow | Checkout recovery and totals, tracking, return, admin fulfillment, permission/loading/empty/error states |
| E2E/release smoke | Customer purchase path and core admin operational path against staging-like services |
| Performance/resilience | Load/peak/soak, dependency timeouts, worker crash/restart, DB/Redis/provider outage, deployment overlap |
| DR | Isolated restore, integrity validation, commerce smoke test, measured RPO/RTO |

## Suggested work breakdown

Create implementation tickets from these work packages, keeping each package independently reviewable:

1. **Decision records and API/state diagrams** — Stage 0.
2. **Schema and domain records** — payments, tax snapshots, reservations/movements, event/idempotency records.
3. **Checkout/inventory lifecycle** — atomic validation, reservation, expiry, release, consume, and replay behavior.
4. **Payment gateway path** — provider adapter, intent, webhook, payment state machine, refund, reconciliation.
5. **GST and commercial snapshots** — effective rules, classification, component breakdown, invoice/credit-note output.
6. **Customer checkout UI and critical-path tests** — payment actions, recovery, order confirmation, concurrency and provider test coverage.
7. **Shipment and returns domain** — stateful backend workflows, carrier integration, policies, refund coordination.
8. **Admin and customer operations UI** — role-scoped queues, details, tracking, returns, inventory, audit and reporting.
9. **Security and reliability controls** — authorization audit, rate limits, outbox, resilience, privacy and observability.
10. **CI/CD, infrastructure, performance and DR** — deployable artifacts, staging gates, production controls, restore and incident drills.

## Release gates

### Gate A — Commercial correctness

Do not enable online payments until payment state/webhooks, reservation release/consume, GST calculations and snapshots, idempotency, critical-path concurrency tests, and finance/tax approval are complete.

### Gate B — Operational readiness

Do not hand orders to live fulfillment until shipment/return state machines, admin authorization/audit, carrier failure handling, refund routing, and operations procedures are tested.

### Gate C — Production readiness

Do not launch until the production checklist's critical gates are evidenced: checkout/payment/inventory correctness, security review, verified backup/restore, monitoring/alerts, rollback and incident runbooks, business/tax validation, and production smoke test.

## Progress tracking

When work starts, update `IMPLEMENTATION-TRACKER.md` so checked status means the acceptance criteria above have evidence. Track each item as `Not started`, `In progress`, `Blocked`, or `Done` with links to its PR, test report, decision record, or operational evidence. Keep business/legal approvals and infrastructure drills visible as explicit dependencies; they cannot be inferred from code completion.
