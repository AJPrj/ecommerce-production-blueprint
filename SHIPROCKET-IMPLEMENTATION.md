# Shiprocket implementation progress

Updated: 20 October 2026. The existing real Shiprocket adapter and assisted forward workflow are implemented. The owner-approved [HLD version 1.2](Shiprocket-Integration-HLD.md) changes the target to automatic prepaid/COD order creation with dashboard-managed MPS shipping. That redesigned workflow is **not yet implemented**. Existing test evidence remains historical; no new live shipment or production approval is claimed.

## Implemented forward integration — existing assisted foundation

- Migrations `V29`–`V31` add immutable provider intent, leased operations, account-scoped booking/AWB references, stored courier quotes, a deduplicated tracking inbox and polling leases. Previously applied migrations and original commercial snapshots are unchanged.
- Package preparation is local. The normal profile creates `UNASSIGNED` packages without tracking numbers; existing development profiles retain their clearly marked `SANDBOX` references. Preparation does not call a shipping provider.
- Fulfillment/Admin can queue `CREATE_PROVIDER_ORDER` using the existing shipment command API, a current package version, an `Idempotency-Key` and a reason. The intent, snapshot, operation, audit and outbox event commit together. Identical retries return the same operation; changed input or a stale version is rejected.
- A bounded worker claims operations in short transactions and contacts the provider after commit. Results require the current operation lease and booking version. Expired claims and uncertain creates use lookup-only recovery; an inconclusive lookup cannot authorize another create. Scheduler metrics expose successful/failed runs, claims and duration.
- The LIVE adapter calls Shiprocket authentication, order creation/lookup, serviceability, AWB assignment, label/manifest generation, pickup, cancellation/read confirmation and tracking APIs. It caches tokens server-side, serializes authentication, refreshes once after 401, bounds response size/timeouts and never blindly retries an uncertain mutation. No provider-specific request or secret is exposed to the browser.
- Existing admin package cards support create → courier rates → offer approval/AWB → label → pickup → explicit handover/dispatch. Commands use current versions and durable idempotency keys. Rates expire; incomplete offers cannot be booked. Quoted and booked carrier costs are separate and never rewrite the customer fee/GST. Unknown booked cost stays unknown.
- Label and manifest downloads use an authenticated, private application proxy with trusted-host/public-address checks, disabled redirects, an eight-megabyte PDF limit and bounded download time. Provider document URLs stay on the server.
- Cancellation is a durable provider command. Local allocation release/repacking and order-item cancellation remain blocked until the remote outcome is confirmed; handed-over parcels use exceptions/returns. Carrier scans never dispatch stock, collect COD, restock or issue refunds. Dispatch requires a confirmed AWB, label, pickup and explicit handover confirmation, consuming the existing reservation once.
- Shiprocket callbacks use mandatory `x-api-key` verification at `/api/v1/logistics/events`. Minimal verified scan evidence is committed before HTTP 200. Tracking is deduplicated per account/mode/AWB/status/time and projected asynchronously. Unmapped statuses/AWBs and missing local dispatch enter review; bounded polling is the backstop. RTO/lost remain exception evidence and are not customer delivery.
- Customer returns use eligible quantities from each delivered package, independent of whole-order delivery status. Backend and customer UI preserve saved policy/windows, ownership and remaining return allocations. Tracking quantities subtract claims against the qualifying package rather than subtracting all historical returns from a new delivery.

The provider boundary has `DISABLED`, `MOCK` and `LIVE` modes. The normal default is `DISABLED`. LIVE routes to the real adapter when API-user credentials and registered pickup configuration are supplied. MOCK remains deterministic development/test behavior, selected explicitly. Operations retain their original provider mode/account; a configuration switch cannot reinterpret an old operation. The mock's remote state is in memory, so an interrupted request after restart can remain unknown rather than inventing a successful lookup.

The current create flow accepts **one complete prepaid package with no cancellation/return history**. Its commercial snapshot consists of the original line amounts in full. COD and split-package provider creation remain blocked until the shared quantity allocation contract and all financial callers are implemented. Existing development fulfillment/COD workflows remain available for packages without an integration booking.

## Approved target — dashboard-managed MPS, 20 October 2026

These are approved requirements, not current application behavior:

1. Verified prepaid capture or accepted COD automatically commits a shipping work item. The worker creates one Shiprocket order/MPS master for the customer order and its complete address/origin; separate customer orders are never grouped by postcode.
2. Estimate one independently packed unit per purchased unit. Use product measurements, suitable Admin box presets, measured box tare plus allowances, or the configured surface-area/material-weight fallback. A product complete-tare override takes precedence and is not counted twice.
3. Keep the customer order confirmed when measurements/configuration are missing. Show an actionable Admin alert saying the order was not created in Shiprocket, with affected SKUs/fields, and allow safe resume after correction.
4. Staff select couriers, assign AWBs, print documents and schedule forward/reverse pickup through Shiprocket. Normal new-mode orders do not require the current webapp package/create/handover clicks.
5. Discover master/child AWBs through scheduled provider-order reads even before a local AWB exists. Combine verified webhooks with bounded API reconciliation; customer refreshes read our saved timeline.
6. Proven pickup/in-transit evidence invokes the existing exactly-once dispatch operation for proven quantities. This deliberately changes the current missing-dispatch review behavior; AWB assignment and scheduled pickup still do not consume stock.
7. Show one customer master tracking reference, preserve available packet evidence, show Partially delivered and alert Admin for partial delivery, and review uncertain item delivery rather than granting return eligibility to every item.
8. Allow individual-item/quantity self-service cancellation only before confirmed master/child AWB assignment. Resolve concurrent booking and provider updates before reporting success, releasing reservations or initiating prepaid refunds. Post-AWB exceptions are Support/Admin work.
9. Automatically accept eligible returns under the saved policy and create linked reverse orders. Staff arrange reverse transport in Shiprocket. Prepaid return refunds follow actual warehouse receipt and successful inspection; COD refunds retain verified-collection and controlled-payout rules.

The owner reports MPS enabled and successful webhook registration. Exact MPS creation/update/packet/label/COD and reverse API contracts still require verified fixtures; ordinary order creation is not proof of MPS support. Original financial snapshots, quantity shares, privacy and tax/invoice release gates remain unchanged. Apply the new cancellation policy prospectively through saved effective policy; do not reduce cancellation promises on historical orders.

### Implementation sequence

| Phase | Required work |
|---|---|
| 1 | Verify account MPS/update/reverse contracts; add master/packet identities and shared commercial allocations; preserve existing assisted records |
| 2 | Add SKU/box/material/default settings, per-unit planner, actionable alerts and idempotent prepaid/COD shipping triggers |
| 3 | Implement MPS creation, awaiting-AWB dashboard discovery, packet mappings and local tracking |
| 4 | Connect proven transport evidence to shared inventory dispatch; implement pre-AWB item cancellation, safe updates/replacements and cutoff UI |
| 5 | Implement policy-based return acceptance, reverse creation/sync, partial-delivery/receipt/QC and refund integration |
| 6 | Run controlled account acceptance and deploy compatible readers/writers before enabling the new mode |

The existing LIVE mode and worker environment variables below select the current adapter; setting them alone does not enable this design. Save a workflow-mode/configuration revision when the new mode is implemented. Do not reinterpret old assisted jobs after a configuration change. See HLD sections 6, 13, 16 and 17 for formulas, cancellation/refund rules, test cases and rollout gates.

## Current configuration and API

For deterministic local development, set `SHIPPING_PROVIDER_MODE=MOCK`. For real account integration, configure the backend process or secret manager:

```powershell
$env:SHIPPING_PROVIDER_MODE = 'LIVE'
$env:SHIPROCKET_EMAIL = '<dedicated Shiprocket API-user email>'
$env:SHIPROCKET_PASSWORD = '<API-user password from your secret store>'
$env:SHIPROCKET_PICKUP_LOCATION = '<exact registered pickup location name>'
$env:SHIPROCKET_PICKUP_POSTCODE = '<matching six-digit pickup pincode>'
$env:SHIPROCKET_WEBHOOK_SECRET = '<token also configured in the Shiprocket dashboard>'
$env:SHIPPING_WORKER_ENABLED = 'true'
$env:SHIPPING_TRACKING_WORKER_ENABLED = 'true'
```

Register the public HTTPS callback `https://<backend-host>/api/v1/logistics/events` in the Shiprocket dashboard and set its security token to the same value as `SHIPROCKET_WEBHOOK_SECRET`. This application requires that token even though the provider dashboard makes it optional. The backend API base is the trusted production endpoint `https://apiv2.shiprocket.in/v1/external`; there is no assumed Shiprocket sandbox. LIVE account mutations may charge the wallet or schedule a real pickup. Account exercises and production activation remain operator-controlled and subject to the existing invoice/tax/operations release gates.

Provider workers default to batches of 20, a 60-second lease and five-second scheduling delay. Tracking polling defaults to 30 minutes, with bounded batches. Properties under `commerce.shipping.integration` and `commerce.shipping.tracking` tune these values. `SHIPPING_ACCOUNT_KEY` optionally identifies the configured account (default `primary`); both integration and tracking must use the same identity. Worker startup does not switch provider mode automatically.

All browser mutations retain session authentication and CSRF. Provider creation requires Admin/Fulfillment; authorized operations readers can inspect safe status projections. Finance/Reporting and customers cannot access these shipping operations endpoints.

| API | Behavior |
|---|---|
| `POST /api/v1/admin/operations/shipments` | Local package preparation; existing contract |
| `GET /api/v1/admin/operations/shipments/{id}/provider-booking` | Package version, provider mode, safe booking/job details, allowed actions and a reason when unavailable; excludes private payload |
| `POST /api/v1/admin/operations/shipments/{id}/commands` | `{"status":"CREATE_PROVIDER_ORDER","reason":"Packed and checked","version":0}` with `Idempotency-Key`; HTTP 202 returns a persisted operation. Existing fulfillment commands retain HTTP 200 |
| `POST /api/v1/admin/operations/shipments/{id}/courier-quotes` | `{ "version": <current booking version> }`; refreshes provider serviceability outside database transactions, then binds stored offers to the unchanged booking |
| Existing shipment commands | `BOOK_COURIER` includes `quoteId`/`offerId`; `GENERATE_LABEL`, `GENERATE_MANIFEST`, `REQUEST_PICKUP`, `CANCEL_BOOKING`, `RECONCILE` use durable jobs. `DISPATCHED` additionally requires `handoverConfirmed=true` and current version |
| `GET /api/v1/admin/operations/shipments/{id}/label` | Authorized private PDF download; provider URL is never returned |
| `GET /api/v1/admin/operations/shipments/{id}/manifest` | Authorized private manifest PDF download; provider URL is never returned |
| `GET /api/v1/admin/operations/shipping-jobs/{id}` | Safe durable operation state, attempts and failure code |
| `POST /api/v1/logistics/events` | Provider callback with `x-api-key`; exact CSRF exemption, mandatory token and durable inbox |

Do not change the provider mode to process an operation saved for another mode. Booking references are separate from customer tracking/AWB references. Unknown outcomes and frozen inputs require reconciliation; this release does not offer a manual command that declares an uncertain create failed or starts a replacement blindly.

## Verification and next phases

Verification is recorded in [the implementation tracker](IMPLEMENTATION-TRACKER.md). A local HTTP server verifies real adapter wire contracts and token/error behavior; PostgreSQL integration tests verify the admin workflow, recovery and stock invariants. Component tests verify the LIVE action/confirmation flow. These checks do not send requests to a real Shiprocket account.

Remaining approved HLD work:

1. Complete the six dashboard-managed MPS phases above, including shared COD/partial-cancellation allocations and safe treatment of historical assisted records.
2. Verify master/packet delivery semantics, dashboard measurement/amount observations, cancellation races, reverse-service capabilities and unknown-operation recovery.
3. Complete rich RTO/lost intake and operator review beyond the current exception projection.
4. Record controlled account/operations acceptance and satisfy existing invoice, tax, secrets, privacy, rate-limit and production release gates.
5. Later extensions: checkout serviceability/Standard–Express choices and associated shipping-quote/review-hash promises. They are not prerequisites for this initial dashboard-managed release.
