# Shiprocket implementation progress

Updated: 20 October 2026. [HLD v1.3](Shiprocket-Integration-HLD.md) records the owner's clarification: **multiple items in one standard Shiprocket order, one parcel estimate and one AWB**. The earlier MPS interpretation is superseded.

## Implemented application flow

- Accepted COD and verified prepaid capture commit one durable order shipping job. Checkout/payment replay cannot create another job. Unpaid online orders wait for capture.
- New orders save `ASSISTED` or `DASHBOARD_ORDER`, provider mode and account. Historical orders keep their saved workflow; switching configuration does not backfill them.
- Product shipping measurements and optional complete per-unit packaging overrides feed a deterministic planner. Admin configures box presets, measured tare, material g/m², construction factor, clearance and padding. Missing required data produces a durable actionable **not created in Shiprocket** alert while keeping the customer order confirmed.
- Individually protected units fit into one estimated outer carton. One unit reuses its unit box; multiple units add the selected outer carton's tare. Conservative rotation/fit and capacity checks may require a larger configured preset than an expert packer needs.
- Local shipment preparation and immutable real-provider intent commit together. The existing leased worker sends `POST /orders/create/adhoc` after commit. All remaining line quantities and commercial shares appear in one provider order; COD is represented once.
- Staff manage courier selection, AWB, labels and pickup in Shiprocket. Dashboard-mode records reject competing assisted webapp mutations. Known provider order/shipment reads discover AWBs even when local tracking is still null.
- Verified webhooks and bounded polling feed the local customer timeline. Early unknown-AWB scans are requeued after verified discovery. Proven transport consumes the existing reservation once for dashboard-mode records. Historical assisted records retain explicit handover.
- Individual-quantity cancellation before AWB returns a durable pending request. Fresh provider checks, confirmed cancellation of the old order, exactly-once local release and remaining-item replacement precede refunds. AWB races and uncertain cancellations remain rejected/reviewed without false cancellation or refunds.
- New-mode commercial allocations retain original per-component unit paise across cancellation, return/refund caps, replacement snapshots and COD collection. Original order totals remain immutable; assisted records keep their prior allocation behavior.
- Saved-policy-eligible returns automatically become approved and queue one independent linked reverse order. Registered pickup-address lookup supplies the warehouse destination. Staff arrange reverse shipping in Shiprocket.
- Reverse tracking enters return history. It never confirms warehouse receipt, restocks items, collects COD or issues a refund. Existing receipt, inspection, online-refund and verified COD payout controls remain authoritative.
- Admin settings/fulfillment show forward and reverse work, safe failures and versioned retries. Cancellation history distinguishes requested, review, rejected and confirmed outcomes.

## Existing assisted workflow

The V29–V31 foundation remains available for saved assisted records: local package preparation, queued provider creation, courier quotes/approval, AWB, private label/manifest downloads, pickup and explicit physical handover. Its initial create contract remains one complete prepaid package without adjustments; new COD/remaining-item automation belongs to saved `DASHBOARD_ORDER` orders.

The real adapter keeps authentication server-side, caches tokens, renews once after verified 401, bounds responses/timeouts and never blindly retries an uncertain mutation. Private document downloads retain trusted-host/public-address checks, disabled redirects and PDF size limits.

Provider mode defaults to `DISABLED`. Explicit `MOCK` is development-only and stores simulated remote state in memory; it cannot invent a successful lookup after process restart. `LIVE` selects the real Shiprocket API.

## Runtime enablement

Deploy the compatible backend migrations and frontend before enabling the new workflow. Configure these on the **backend hosting service**:

~~~dotenv
SHIPPING_WORKFLOW_MODE=DASHBOARD_ORDER
SHIPPING_PROVIDER_MODE=LIVE

SHIPROCKET_EMAIL=<dedicated API-user email>
SHIPROCKET_PASSWORD=<secret-store value>
SHIPROCKET_PICKUP_LOCATION=<exact active registered pickup nickname>
SHIPROCKET_PICKUP_POSTCODE=<matching six-digit pincode>

SHIPPING_WORKER_ENABLED=true
SHIPPING_TRACKING_WORKER_ENABLED=true
SHIPROCKET_WEBHOOK_SECRET=<same strong token configured in Shiprocket>
~~~

`SHIPPING_ACCOUNT_KEY` optionally names the configured account (default `primary`); saved jobs and tracking must use the same account identity. A saved account/mode mismatch requires reconciliation in the original environment.

Register `https://<backend-host>/api/v1/logistics/events` with that same webhook security token. The frontend host is not the callback target. API-user permissions must include order creation/read/cancellation, tracking and pickup-address reads for reverse shipping. Production API base remains `https://apiv2.shiprocket.in/v1/external`; there is no assumed Shiprocket sandbox.

In Admin → Settings, enter measured unit/outer box presets and the required allowances. In the product editor's Shipping tab, enter positive weight and all dimensions; optionally enter complete per-unit packaging weight. Product tax classification/approval remains a separate checkout gate and is not bypassed.

Normal provider batches default to 20; existing forward operation leases default to 60 seconds. Cancellation/reverse work uses two-minute fenced leases. Planning and operation scheduling defaults to five seconds. Forward tracking's configured polling interval defaults to 30 minutes; reverse reads normally poll every 30 minutes. The existing tracking properties can be configured directly for forward polling.

Docker images need no Shiprocket credentials at build time. Keep runtime secrets out of Dockerfiles, build arguments and committed workflow values. Publishing an image does not set environment variables or activate a Render service.

## Schema and API

- `V33__shipping_order_planning.sql`: saved workflow/provider/account, revisioned packaging settings, unique automatic order jobs and operation/shipment links.
- `V34__dashboard_item_cancellation.sql`: pending cancellation quantities, provider attempt evidence, one unresolved request per order and fenced recovery.
- `V35__dashboard_reverse_orders.sql`: independent reverse identities, immutable intent, leases, retry state and reverse tracking mappings.

These extend V29–V31; previously applied migrations are unchanged. Run migrations before writers that depend on the new columns/tables.

| API | Access and behavior |
|---|---|
| `GET/PUT /api/v1/admin/shipping/packaging` | Admin only; expected revision and audit reason on save |
| `GET /api/v1/admin/shipping/jobs` | Authorized operations readers; safe forward preparation/provider status |
| `POST /api/v1/admin/shipping/jobs/{id}/retry` | Admin/Fulfillment; current version and reason; held local planning only |
| `GET /api/v1/admin/shipping/reverse-jobs` | Authorized operations readers; safe reverse preparation/provider status |
| `POST /api/v1/admin/shipping/reverse-jobs/{id}/retry` | Admin/Fulfillment/Returns; current version and reason; frozen unknown requests use lookup |
| Existing customer cancellation routes | Same ownership/idempotency contract; pending provider outcome is explicit |
| Existing Admin cancellation retry | Reconcile held cancellation or retry the original confirmed refund, under existing roles |
| Existing tracking/return routes | Saved workflow/policy, owner-only reads and normal warehouse/refund controls |
| `POST /api/v1/logistics/events` | Mandatory provider token; durable minimal tracking inbox |

All browser mutations retain session authentication, CSRF and backend authorization. No job/status response includes credentials, private provider requests or addresses.

## Recovery and release limits

- Missing measurements/defaults: correct catalog/settings and retry the held preparation.
- Unknown create/cancel: inspect the saved operation and reconcile by its existing provider/merchant identity. Do not create another order to work around an uncertain result.
- AWB discovered during item cancellation: customer cancellation stops; staff resolve booking/packing exceptions.
- Reverse address/permission/configuration failure: keep the eligible return approved, fix the input/permission and retry its work.
- Reverse carrier delivery: record warehouse receipt and inspection separately before refund/restock actions.
- Runtime mode switch: old orders and saved operations remain bound to their original workflow/account.
- One ordinary parcel is supported. Separate physical parcels need a separately verified carrier/MPS design.
- Staff must use webapp commercial operations for item/financial changes; arbitrary manual Shiprocket amount/item edits are not automatically reconciled into the commerce ledger.

Verification is recorded in [the tracker](IMPLEMENTATION-TRACKER.md). Local PostgreSQL, deterministic provider and local HTTP-wire tests do not use a real Shiprocket account. Controlled account acceptance, serviceability/wallet/permissions, production-matching PostgreSQL 16 CI, invoice/tax approval, secrets/privacy review and deployment/rollback evidence remain operator-owned release gates. No live provider mutation, deployment or production activation is claimed.
