# Stage 2 development workflows and acceptance evidence

The existing development/assisted contracts below remain applicable to saved `ASSISTED` records. The dashboard standard-order section describes the new opt-in workflow and its distinct dispatch/cancellation/return behavior.

Status: development workflows and dedicated web admin modules are implemented and automated tests pass. Production acceptance has not been signed off. See [ADMIN-CONSOLE-IMPLEMENTATION.md](ADMIN-CONSOLE-IMPLEMENTATION.md) for the current routes, V24–V28 changes and configuration.

## Working flows

- Staff sign in at `/admin/login` and open the role-aware `/admin` overview. The dedicated sidebar exposes authorized operations, catalog, finance and administration pages; `/admin/fulfillment` remains available to authorized fulfillment staff.
- The order queue reads persisted orders, supports order-number search and bounded pagination, and opens order/package details.
- Prepare a package with explicit line quantities and dimensions. Multiple packages can allocate an order, but their combined active allocations cannot exceed its remaining quantities.
- Dispatch consumes only that package's stock. The payment and order are locked before reservation and stock changes; the shipment transition, stock movement, history, audit and outbox event commit together. Repeated dispatch does not consume twice.
- Customers open **Track delivery and returns** from their order page. Tracking refreshes every 30 seconds and offers manual refresh. Each package has its own timeline.
- Customers request eligible quantities from delivered packages, including when another package remains in transit. Eligibility and the return window are saved on each order line at checkout and evaluated against the specific package delivery time. The default remains seven days; `commerce.returns.excluded-categories` accepts category slugs for future orders. Configuration changes do not rewrite existing promises.
- Returns allocate against specific delivered packages, preserving separate delivery windows for split shipments. Rejected or customer-cancelled requests release their return allocation.
- Staff approve/reject requests, record pickup scheduling and receipt, then inspect. Receipt quarantines units; only an explicit restock decision adds a signed inventory movement. A repeated inspection cannot restock twice. A failed inspection blocks the refund.
- Refund staff select an amount within the immutable goods/tax/delivery allocation and the captured payment balance. The original order totals remain unchanged. The Stage 1 refund service handles provider requests and payment ledger updates.
- Saved addresses can be listed, added, edited and deleted at `/account/addresses`; changes do not alter an order's address snapshot.

The legacy development carrier generates **SANDBOX / DEV-** references in `demo`, `payment-sandbox` or `fulfillment-sandbox` profiles without booking a real courier. Normal-profile preparation creates an **UNASSIGNED** package locally. The separately configured [real Shiprocket forward integration](SHIPROCKET-IMPLEMENTATION.md) adds provider creation, courier quotes, AWB, documents, pickup, cancellation and verified tracking through migrations `V29`–`V31`. Provider-backed dispatch requires confirmed AWB/label/pickup and explicit physical handover. MOCK remains a separate development mode.

Cancelling an unbooked prepared package frees its allocation for repacking. It does **not** cancel the customer's order, release the order reservation, or issue a refund. Once provider intent exists, request `CANCEL_BOOKING` and confirm the provider outcome before local cancellation/repacking or affected item cancellation. An unknown remote outcome retains allocation protection. For saved dashboard orders, customer cancellation coordination now performs provider confirmation and remaining-item replacement automatically. Other order cancellation and partial remainder refunds use the existing V23 recovery workflows.

## Dashboard-managed standard orders

The owner clarified [HLD v1.3](Shiprocket-Integration-HLD.md) on 20 October 2026: all items belong to one standard Shiprocket order with one parcel estimate and one AWB. Separate physical parcels/MPS are outside this release.

For new orders saved with `DASHBOARD_ORDER`, accepted COD and verified prepaid capture automatically queue shipping. Admin configures measured box presets, material/default allowances and product measurements. Missing required inputs keep the customer order confirmed and show an actionable not-created alert; current-version retries resume preparation.

Staff assign the courier/AWB, print documents and schedule forward/reverse pickup in Shiprocket. The application discovers dashboard AWBs even while local tracking is empty. Verified webhooks and bounded polling update the local customer timeline. Proven transport evidence invokes exactly-once reservation consumption for this saved workflow; AWB/label/pickup scheduling alone does not dispatch stock.

Individual-quantity cancellation is available before AWB assignment. A pending request does not release stock or initiate a refund. The worker reads Shiprocket, confirms cancellation of the old unassigned order, applies the selected local quantities, then queues remaining items with their original financial shares. COD collection is reduced; captured prepaid refunds follow confirmed cancellation. Booking races and uncertain outcomes require review. Historical assisted orders retain their old cutoff.

Eligible new-mode returns are automatically approved under the saved policy and create linked reverse orders. Reverse delivery scans enter history; warehouse receipt, inspection, restocking and refunds remain separate controlled actions. COD refund limits and Finance payout evidence remain unchanged.

Enable `SHIPPING_WORKFLOW_MODE=DASHBOARD_ORDER` only after compatible backend/frontend deployment, migrations and Admin packaging setup. Both shipping and tracking workers must run, with backend runtime credentials/pickup/webhook settings. See [runtime instructions and recovery](SHIPROCKET-IMPLEMENTATION.md). Local verification does not authorize a production rollout or replace real-account acceptance.

## API and permission contracts

All browser mutations require the existing session and CSRF token. Shipment creation and return requests require an `Idempotency-Key`; reusing a key with changed inputs returns a conflict.

| Operation | Endpoint | Allowed roles |
|---|---|---|
| Order queue/detail | `GET /api/v1/admin/operations/orders[/{number}]` | Admin, Fulfillment, Returns, Refunds, Support |
| Prepare shipment | `POST /api/v1/admin/operations/shipments` | Admin, Fulfillment |
| Dispatch/recover/cancel package | `POST /api/v1/admin/operations/shipments/{id}/commands` | Admin, Fulfillment |
| Return queue | `GET /api/v1/admin/operations/returns` | Admin, Fulfillment, Returns, Refunds, Support |
| Return decision/receipt | `POST /api/v1/admin/operations/returns/{id}/commands` | Admin, Returns |
| Inspect | `POST /api/v1/admin/operations/returns/{id}/inspection` | Admin, Returns |
| Request/retry refund | `POST /api/v1/admin/operations/returns/{id}/refund` | Admin, Refunds |
| Reconciliation | `GET /api/v1/admin/operations/reconciliation` | Admin, Finance, Reporting |
| Tracking, return request/detail/cancel | `/api/v1/orders/{number}/tracking`, `/api/v1/orders/{number}/returns`, `/api/v1/returns` | Signed-in owner only |
| Saved addresses | `/api/v1/addresses[/{id}]` | Signed-in owner only |

Finance and Reporting roles cannot read the order/address operations queue. Roles are assigned through controlled identity administration; registration cannot choose a staff role.

Carrier events use `POST /api/v1/shipping/webhooks/carrier` with an HMAC-SHA256 `X-Carrier-Signature` over the exact request body. The body includes `eventId`, `shipmentId`, `status`, `occurredAt`, and `detail`. Accepted carrier states are `IN_TRANSIT`, `DELIVERED`, and `EXCEPTION`. A duplicate event is harmless; a reused event ID with changed content is rejected. Delayed/illegal transitions are recorded as ignored and cannot regress delivery or consume stock.

## State transitions

- Shipment: `PREPARED → DISPATCHED → IN_TRANSIT → DELIVERED`; dispatch/in-transit may enter `EXCEPTION`, followed by verified recovery to in-transit/delivered. Only prepared packages can be cancelled.
- Return: `REQUESTED → APPROVED → PICKUP_SCHEDULED → RECEIVED → INSPECTED → REFUND_PENDING → REFUNDED`. Staff may record receipt directly after approval. Requested returns may be rejected/cancelled. Failed inspection ends in `QC_REJECTED`.
- Return inventory: `AWAITING_RECEIPT → QUARANTINED → RESTOCKED` or retained quarantine/rejected inspection.

For assisted returns, pickup scheduling remains a recorded staff operation. Saved dashboard returns automatically create linked reverse orders; staff arrange pickup in Shiprocket. Customer evidence uploads remain future work.

## Verification matrix

The repository test suites are the executable evidence. On 2026-10-11, `spotlessJavaCheck test` passed 63 backend tests across 13 suites, including 16 Stage 2 integration tests, against a fresh PostgreSQL database migrated through V22. `npm test -- --maxWorkers=1 --reporter=verbose` passed 11 React tests, and `npm run build` succeeded. The finance and operations approvals below remain open.

| Gate | Evidence |
|---|---|
| Split shipments, duplicate allocation, illegal transition, repeated/concurrent dispatch | `OperationsIntegrationTest` against PostgreSQL, including remaining reservation counters and movement counts |
| Invalid signature, duplicate/changed carrier event and delayed scan | Signed carrier API tests; final order status remains delivered |
| Delivery/window/category policy, excess/concurrent return quantities, rejected/cancelled request | Return API/service integration tests |
| Old versus new package delivery windows | Return allocations are tied to individual shipments |
| Quarantine, exactly-once restock, failed inspection | Inventory balance and movement assertions |
| Partial refund, timeout after provider commit, retry, repeated callback | Sandbox provider plus durable Stage 1 refund ledger |
| Role separation and customer IDOR | Staff login/command tests; other real customer records cannot access tracking, returns or addresses |
| Financial reconciliation | Known fixture: captured ₹200; processed partial refund ₹100; net captured ₹100; original order total stays ₹200. A deliberately inconsistent ledger surfaces a mismatch without repair |
| UI workflows | React Testing Library covers queue → package → dispatch, customer tracking → return, return decision → inspection → refund, failure/retry, and hidden Support commands |

UI tests mock API/provider boundaries. These tests do not demonstrate a real courier or live Razorpay account.

## Recovery procedures for operations review

1. **Package creation response lost:** retry with the same idempotency key and quantities. After a browser reload, inspect the package list before preparing another package.
2. **Dispatch conflict:** inspect reserved/on-hand stock and the inventory reconciliation queue. Do not edit order totals or bypass the failed stock check.
3. **Carrier exception:** inspect the package timeline and verify the carrier's evidence. Record an action reason before marking recovery. Delivered and cancelled packages cannot be reopened.
4. **Callback ID collision:** retain the conflict and investigate the provider's event ID/payload; do not issue a new stock movement.
5. **Received return:** keep units quarantined until inspection. Rejected inspection requires support follow-up; it cannot trigger an online refund.
6. **Refund timeout:** use the return's retry action. The return fixes the original amount, reason and key; subsequent staff retries reuse those values. The payment reconciliation job handles existing pending refund records, and the return status job links confirmed outcomes. If a failure occurred before a refund ledger entry was created, staff retry is still required.
7. **COD refund:** record verified collection evidence first. Refund staff may request a manual refund after accepted inspection; Finance approves and records an external payout reference. The API enforces collected balance, role separation and durable retry references. No automated bank transfer or unverified payout is represented as completed.
8. **Notifications:** shipment/return events are persisted in the transactional outbox. Email/SMS delivery awaits the notification provider and Stage 3 worker.

The finance report is bounded to at most 100 rows per request, uses durable payment/refund records, flags mismatches, and records an audit event. Large asynchronous export jobs remain future work.

## Remaining acceptance decisions and implementation

- Complete controlled real-account acceptance of the dashboard standard-order workflow, including pickup/address permissions, prepaid/COD creation, manual AWB assignment, callbacks/polling, cancellation races and reverse transport. Local automated tests are recorded in [implementation progress](SHIPROCKET-IMPLEMENTATION.md); checkout delivery choices and separately shipped parcels remain later scope.
- Customer order cancellations, partial remainder refunds and COD collection/manual refund commands are implemented and verified. Rejected-return disposal/return-to-customer handling still needs its business/carrier workflow.
- Admin policy editing and pre-purchase shipping/return disclosure are implemented; final exclusions and shipping terms still require business acceptance. Existing policy snapshots preserve the promise made at checkout.
- Complete the invoice/credit-note and tax-owner gates already tracked in Stage 1.
- Finance must review the known reconciliation fixtures and refund allocation policy; operations must sign off the exception/recovery procedures against the selected carrier.

Schema: `V20` extends fulfillment/returns and adds audit/command/address records plus partial reservation counters. `V21` snapshots order-line return policy and records per-package return allocations. `V22` adds lookup indexes for shipment, return, allocation, and history reads. V33 adds dashboard order planning/settings, V34 adds confirmed item-cancellation orchestration, and V35 adds independent reverse orders/tracking. Roll forward with Flyway; do not edit previously applied migrations.
