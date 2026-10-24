# E-Commerce Implementation Tracker

Last updated: 2026-10-24

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

- [x] Add shipment packages, line allocations, history, signed/deduplicated carrier events, split shipments and customer tracking. Local package preparation is separate from provider booking; real Shiprocket forward integration and its current package restrictions are recorded below.
- [x] Consume each dispatched package's reserved units exactly once; retain counters for the order's remaining reservation and reconcile those counters with movements.
- [x] Add customer return requests with ownership, original order policy snapshots, delivery windows per package, quantity limits and durable idempotency.
- [x] Add approval/rejection/cancellation, receipt into quarantine, inspection and exactly-once restocking; failed inspection blocks refund.
- [x] Route approved online return refunds through the Stage 1 service, preserve original order totals, retain refund amount/reason for retries and synchronize confirmed outcomes.
- [x] Replace the static fulfillment dashboard with API-backed order/return queues and actions; add customer tracking/returns and saved-address screens.
- [x] Add Fulfillment, Returns, Refunds, Support, Finance and Reporting roles with server authorization and staff login; add privileged audit and transactional outbox records.
- [x] Add a bounded financial reconciliation report based on durable payment/refund records, including mismatch visibility.
- [x] Record automated verification: on 2026-10-11, backend formatting and all 63 tests passed (13 suites, including 16 Stage 2 integration tests) against a fresh PostgreSQL database migrated through V22; all 11 React tests and the production build passed. Finance and operations acceptance remain separate unchecked gates below.
- [ ] Integrate and prove a real carrier's booking, label printing, reverse pickup, timeouts/retries and exception recovery.
- [x] Implement customer order cancellation/partial remainder refunds and COD collection/manual refund commands with durable evidence, role separation, audit and stable retries (V23). The 2026-10-14 backend run verifies the 19 cancellation/COD integration cases. Earlier fixtures incorrectly used `COD_PENDING`; they now use the actual `COD_DUE` contract without weakening fulfillment checks.
- [ ] Implement rejected-return disposal or return-to-customer operations after business/carrier acceptance.
- [x] Implement effective-dated Admin policy editing and public disclosure of category exclusions/return-shipping terms (V25); existing order return snapshots remain immutable. Final public policy values still require business approval.
- [ ] Obtain finance sign-off on reconciliation fixtures/refund allocation and operations sign-off on carrier exception/manual recovery procedures. Automated tests do not constitute those approvals.

## Dedicated web admin console — 2026-10-14

Status: **Administration modules implemented; automated verification passed; production and browser acceptance remain separate**

Implementation details and configuration are in [ADMIN-CONSOLE-IMPLEMENTATION.md](ADMIN-CONSOLE-IMPLEMENTATION.md). The supplied desktop reference now informs the actual `/admin` shell and overview, with independent storefront layout and lazy route pages. Every proposed navigation group has real backend-backed workflows: catalog/taxonomy/variants/publication/images, inventory/history/reconciliation, orders/fulfillment/returns/refunds/COD, payments/tax/reports, customers, promotions/coupons, settings, staff/roles and audit.

- Server capability projections control menus and page access; APIs independently enforce role grants and least-privilege data projections. Staff permission/status changes revoke versioned sessions. The Redis namespace upgrade requires users to sign in again.
- V24–V28 add catalog versions/publication/taxonomy/thresholds, effective policies/tax approvals, staff authorization versions, promotion usage and verified image receipts. Signed stock deltas replace stale available-stock edits; metadata saves cannot silently adjust stock. Review pagination no longer skips page-boundary records.
- New normal-profile GST approval gates fail closed; demo/payment-sandbox fixtures remain isolated development behavior. Dashboard reporting explicitly distinguishes booked merchandise, the selected order cohort's current online ledger, COD and current operational queues.
- S3-compatible signing and confirmation are implemented and tested against a local stub/known signature vector. Storage stays unavailable until configured; no real bucket/provider operation was performed. Promotion stacking and usage policy are documented in [ADMIN-PROMOTIONS.md](ADMIN-PROMOTIONS.md) and require business acceptance.
- Backend verification on 2026-10-14: `gradlew.bat --gradle-user-home .gradle --no-daemon spotlessApply test` passed **137 tests, 0 failures/errors, 22 suites** against the isolated local `ecommerce_admin_console_test_20261014` PostgreSQL database through V28. Coverage includes original commerce concurrency/replay workflows plus dashboard/identity/policy/catalog/promotion/upload safety.
- React verification on 2026-10-14: `npm.cmd run test -- --pool=forks` passed **50 tests across 7 files**; `npm.cmd run build` passed. This includes staff capability/deep-link behavior, authorized finance queue links, catalog/GST/upload, operations/review/denial, promotion and checkout flows. Forked workers avoid intermittent Windows thread startup timeouts; address-entry tests omit artificial typing delays while retaining workflow assertions. Lint completed with nonblocking React refresh/effect/ref and expression-style warnings; Sass still reports existing deprecation notices.
- Live browser/screenshot verification could not run because no Browser connection was available. Component/API tests do not constitute desktop user acceptance, a live carrier/Razorpay exercise, financial/tax approval or production release approval.

### Shiprocket forward integration — 2026-10-17

Status: **Real forward adapter/workflow implemented; full HLD and live acceptance remain in progress**. See [the HLD](Shiprocket-Integration-HLD.md) and [implementation progress](SHIPROCKET-IMPLEMENTATION.md).

- Added additive migrations `V29`–`V31`, local preparation, frozen provider intent, leased/fenced workers, quote snapshots and a verified tracking inbox. Mode defaults to DISABLED; LIVE uses the actual Shiprocket adapter with API credentials and registered origin, while MOCK is explicit development behavior.
- Implemented real authentication/token reuse and one-401 refresh, forward creation/exact lookup, serviceability, AWB, label/manifest, pickup, cancellation/read confirmation and tracking API contracts. Local HTTP stub tests cover transport/auth/error behavior without a real provider account.
- Extended existing admin package cards/commands with quote approval, separate carrier costs, private PDF access, pickup readiness, physical handover, persisted job recovery and safe cancellation. Booking/pickup changes no stock; explicit dispatch consumes once. Ambiguous creates/AWB operations reconcile by lookup, never blind replay.
- Added backend/UI eligibility for returns from delivered packages while other packages remain in transit, preserving saved windows and package-specific remaining quantities.
- Shiprocket callbacks use mandatory `x-api-key`, durable per-scan deduplication and account/mode/AWB validation, with bounded polling. Missing dispatch/unmapped/RTO evidence cannot fabricate delivery, financial collection, restock or refunds.
- Provider creation currently accepts only a complete prepaid package without adjustment history. Shared commercial quantity allocations, split/COD provider booking, checkout shipping choices, automatic cancellation orchestration, reverse-parcel workflows and rich RTO intake remain open. Reverse API primitives are implemented but not enabled as the business workflow.
- Full backend suite on 2026-10-17 passed **179 tests in 29 suites, 0 failures/errors**, using isolated `ecommerce_shiprocket_test_20261016` PostgreSQL through `V31`. After further account, timeout, audit and document-download hardening, the shipping suite passed **44 tests in 7 suites, 0 failures/errors** and shipping formatting checks passed. Final frontend shipping/operations checks passed **44 tests across 2 files**; production build passed with existing Sass warnings. Focused frontend lint passed with two nonblocking React warnings about the provider panel's clock initialization and initial loading effect. The original missing-handover-field regression was fixed without changing global JSON validation or weakening handover requirements.
- No real-account shipment, live wallet action, browser acceptance or production approval was performed.

### Shiprocket dashboard-managed standard orders — 2026-10-20

Status: **Implemented in the working tree; controlled account acceptance remains open.** The owner clarified one standard order containing all items, one parcel estimate and one AWB. The [standard-order HLD](Shiprocket-Integration-HLD.md) supersedes the earlier MPS interpretation; [runtime/recovery instructions](SHIPROCKET-IMPLEMENTATION.md) explain the opt-in rollout.

- Saved `DASHBOARD_ORDER` orders automatically queue accepted COD or verified prepaid capture once. Packing settings/product measurements, conservative single-carton estimation and actionable not-created alerts precede immutable real-provider intent.
- Staff ship through Shiprocket. Known-order polling discovers AWBs before local tracking exists; verified transport invokes shared exactly-once dispatch. Historical assisted records retain their original behavior.
- Before-AWB item cancellation has durable requested/review/rejected outcomes, fresh provider checks, confirmed old-order cancellation, shared quantity/financial allocations and remaining-item replacement. Unknown mutation recovery is lookup-only.
- Saved-policy-eligible returns automatically approve and create independent linked reverse orders. Reverse tracking cannot confirm warehouse receipt, restock units or initiate refunds. Existing receipt/QC/online-refund/COD payout gates remain in force.
- V33 retains the original gallery seed; V34 stores requested cancellation/attempt/lease evidence, V35 stores reverse identities/intent/recovery/tracking, and V36 stores workflow/settings/planning. Planning was moved to V36 to avoid the existing applied V33 gallery migration. Runtime mode changes do not backfill or reinterpret historical records.
- Verification: the final local backend regression run passed **219 tests across 34 suites**, including automatic COD creation, capture timing, missing packing data, role/CSRF/revision protection, AWB discovery, duplicate transport, cancellation/replacement, AWB races, unknown-cancel recovery, automatic reverse creation, original component conservation and exact remaining COD amounts after tax rounding. Scoped Spotless checks and the deployable `bootJar` build passed. The isolated local PostgreSQL server is version 13; PostgreSQL 16 CI and controlled live-account acceptance remain required.
- Frontend verification passed **154 tests across 22 files** and the TypeScript/Vite production build. The independent full rerun resolved the earlier checkout timeout during simultaneous backend work without relaxing the test timeout. Changed-file lint reported no errors and six existing warnings. That deployable JAR contained the initial shipping migrations and workers; rebuild with restored gallery V33 and shipping V34–V36 for the migration-number collision fix. No real provider mutation, deployment or production activation was performed.
- Remaining release work: operator-owned account/serviceability/wallet/permission acceptance, production-matching CI, tax/invoice/secret/privacy gates and deployment/rollback evidence. Standard/Express checkout, separate physical parcels and arbitrary dashboard item/financial edit reconciliation remain outside this release.

### Migration-number collision recovery — 2026-10-21

- The local application database had already applied `V33__seed_product_gallery_images.sql` with checksum `1105221108`. Restored that exact migration and moved the conflicting shipping planning migration to V36; V34/V35 remain unchanged. No repair or validation bypass is required for that gallery history.
- `MigrationUpgradeIntegrationTest` migrates an isolated schema to the original V33, verifies its applied checksum, upgrades through V36 and verifies existing catalog data survives. The complete backend run passed **220 tests across 35 suites, zero failures/errors/skips**, against a separate PostgreSQL **16.15** database. Scoped Spotless checks, a clean `bootJar` build and packaged-migration inspection passed. The existing application database was inspected read-only and left unchanged.
- This production-version local database check supplements the earlier PostgreSQL 13 evidence; CI, controlled live-provider acceptance and deployment approval remain separate requirements.

### Automatic parcel estimates — 2026-10-21

- The owner reported successful deployed Shiprocket order creation after correcting product measurements and packaging configuration. This is owner-reported creation evidence; the complete live tracking/cancellation/return lifecycle has not been accepted, and it does not prove the new estimator fallback.
- Approved refinement: optional final-box presets, product dimensions plus packing clearance, per-unit protection allowances/complete overrides, and exactly one outer-carton tare. Without a usable preset, a deterministic non-overlapping layout and configured cardboard area density/construction factor estimate the parcel; Admin sees a nonblocking review-before-AWB warning. Missing required inputs or unsupported dimensions/weight still hold preparation.
- Admin accepts material density in g/ft² or g/m² and saves canonical g/m². Existing settings/plan JSON is reused without a migration. Explicit retries resume corrected held jobs; existing immutable intents and created provider orders remain unchanged.
- Backend verification passed **230 tests across 35 suites, zero failures/errors/skips**, against isolated local PostgreSQL **16.15** database `ecommerce_migration_fix_test_20261021`; scoped Spotless and `bootJar` passed. An earlier full run had nine tracking-class loading failures and a missing Gradle binary report; an unchanged-code rerun with isolated temporary build output passed. The cause of the missing build files has not been established.
- Frontend verification passed **158 tests across 22 files**, including the **8 focused packaging tests**; changed-file lint and the TypeScript/Vite production build passed with existing Sass warnings. The final full run used one fork worker and standard timeouts; worker replacement was normal file isolation, and no cache/configuration changes were needed. This evidence does not constitute deployment or controlled live-account acceptance of the new estimator.

### Order customer search and shipping summaries — 2026-10-22

- `/admin/orders` and the shared operations queue show the ordering account's name, email and phone, plus saved Shiprocket order/shipment IDs, last provider status, booking state, AWB, courier and sync time. Search covers those customer fields, order numbers, provider references and tracking numbers, with a 254-character limit, literal wildcard handling and existing state/date filters. Matching several bookings still returns one order per page entry. Finance/Reporting keep their separate ledger-only access.
- Shipping summaries load in one batch for the current page and retain cancelled, replacement, split and local-only shipment records. V37 adds a verified provider-status sync timestamp and indexes for current tracking observations and booking history. Verified dashboard reads save status before AWB assignment; newer same-state carrier scans remain visible without accepting regressive scans. The page labels cached status explicitly; cancelled bookings can retain an older last provider status alongside their confirmed local cancellation state. Direct Shiprocket dashboard links are deferred at the owner's request.
- Backend verification passed **29 tests across 4 suites, zero failures/errors/skips**: order queue/search/projection/authorization/pagination, existing Admin filters/permissions, verified tracking/lease behavior and an upgrade from the original V33 through V37. Scoped Spotless checks and `bootJar` passed; the JAR includes the original V33 plus V34–V37. Tests used the separate `ecommerce_order_queue_test_20261022` database on local PostgreSQL **13.8**; its temporary server was stopped after verification. Production-version PostgreSQL 16 verification, live provider acceptance and deployment remain separate.
- Frontend focused verification passed **41 tests** (34 operations and 7 Admin console). The full forked single-worker run passed **169 of 170 tests across 22 files**; an unchanged promotions version-conflict test hit its default five-second timeout. Its isolated rerun passed **3/3 tests** with the same timeout and no source/configuration changes. Changed-file lint passed without errors and reported three existing React ref/effect warnings. Browser visual acceptance could not run because no browser is connected. Initial thread-worker startup failure was avoided using the project's established fork-worker option.
- Final TypeScript/Vite production build passed on **23 October 2026** after resuming verification, with existing Sass deprecation notices. No provider mutation or deployment was performed.

### Category deletion — 2026-10-23

- Added category-only Delete beside Edit, with a dialog naming the selected category and slug. Pending commands cannot be submitted twice or dismissed; failed deletion preserves the row and editor draft. Confirmed success updates Admin and storefront category caches. Brands and attributes retain their existing workflows.
- Added Admin-only, CSRF-protected `DELETE /api/v1/catalog/admin/taxonomy/categories/{id}` with expected name/slug checks, transactional deletion/audit, and 409 guidance for changed or referenced categories. All products (including draft/archived), child categories and included/excluded promotion references block removal. An absent category returns 204 without another audit event, allowing safe retries after a lost response. Unavailable endpoints remain errors in the UI.
- Promotion validation now runs under its existing configuration lock shared with category deletion, preventing concurrent promotion saves from retaining deleted category IDs. Taxonomy updates reject an affected-row count of zero after concurrent deletion. Existing business-policy and order snapshots are preserved. No schema migration or live category deletion is part of this change; the running backend must be restarted to load the new endpoint.
- Verification passed **24 backend tests across 3 suites** (10 deletion, 7 catalog administration, 7 promotions), with zero failures/errors/skips. Coverage includes authorization/CSRF, stale confirmation, reference guards, one audit across retries and deterministic promotion/edit races. Scoped Spotless checks, `bootJar`, packaged DTO inspection and diff checks passed. Tests used the separate `ecommerce_category_delete_test_20261023` database on PostgreSQL **13.8**; the temporary server was stopped and the existing backend on port 8080 was left running unchanged.
- Frontend verification passed **17 focused tests across 3 files**, the TypeScript/Vite production build and scoped lint with zero errors. Existing route fast-refresh warnings and Sass notices remain. Confirmation/cancellation, unavailable endpoints, lost-response retries, duplicate prevention, draft preservation, cache updates and other taxonomy pages are covered. Browser visual verification was unavailable because no browser is connected; no actual category was deleted through the user's running application.

### Draft archiving and category reassignment — 2026-10-24

- Draft and published products now expose Archive in both the product list and saved-product editor; new unsaved and already-archived products do not show it. Archiving is a separate confirmed command, so incomplete drafts can be archived without saving or publishing their fields. Pending commands cannot be duplicated. Cancel/error preserves unsaved edits; a successful confirmed archive discards them and returns to the list. Responses for an editor that has been closed or changed to another product refresh the original target's cache without redirecting the new page or replacing its draft.
- Archived product metadata saves preserve `ARCHIVED`, including category reassignment and omitted `active` inputs. The editor labels an unpublished archived save as Save changes. Blank descriptions are allowed for unpublished drafts, matching the backend DTO; published-field and GST gates remain in place. This fixes the observed incomplete fixture's reassignment path without adding a separate category-move API.
- Category deletion remains blocked by every linked product, including drafts and archived records. Its confirmation now explains that archiving retains the category link and offers View products to reassign in a new tab, filtered to the exact category across all publication states. Move products through Edit → Category → Save before deleting the unused category, or deactivate it to retain the links. Existing product inventory, reservations and historical order/policy snapshots are preserved. No migration or automatic fixture-data cleanup is introduced.

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
