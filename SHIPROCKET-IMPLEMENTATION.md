# Shiprocket implementation progress

Updated: 17 October 2026. Implements the first development slice of [the HLD](Shiprocket-Integration-HLD.md). The carrier integration is **in progress**; this document does not approve live fulfillment.

## Implemented foundation

- Migration `V29` adds a package version, immutable provider-create snapshots, unique active forward bookings and durable leased operations. Existing migrations and commercial snapshots are unchanged.
- Package preparation is local. The normal profile creates `UNASSIGNED` packages without tracking numbers; existing development profiles retain their clearly marked `SANDBOX` references. Preparation does not call a shipping provider.
- Fulfillment/Admin can queue `CREATE_PROVIDER_ORDER` using the existing shipment command API, a current package version, an `Idempotency-Key` and a reason. The intent, snapshot, operation, audit and outbox event commit together. Identical retries return the same operation; changed input or a stale version is rejected.
- A bounded worker claims operations in short transactions and contacts the provider after commit. Results require the current operation lease and booking version. Expired claims and uncertain creates use lookup-only recovery; an inconclusive lookup cannot authorize another create. Scheduler metrics expose successful/failed runs, claims and duration.
- The existing admin package cards show persisted provider-order progress, offer explicit simulated creation and poll local job state. Provider order creation does not mean AWB assignment, courier booking, pickup or dispatch. Integrated packages block the legacy dispatch/cancellation commands until those coordinated workflows exist.
- Customer returns use eligible quantities from each delivered package, independent of whole-order delivery status. Backend and customer UI preserve saved policy/windows, ownership and remaining return allocations. Tracking quantities subtract claims against the qualifying package rather than subtracting all historical returns from a new delivery.

The provider boundary has `DISABLED`, `MOCK` and `LIVE` modes. The normal default is `DISABLED`; `LIVE` fails closed because the accepted Shiprocket adapter is still pending. Only an explicit `MOCK` configuration creates simulated provider records. The mock's remote state is in memory: after a process restart, an interrupted operation may remain unknown for review rather than inventing a successful lookup.

The current create flow accepts **one complete prepaid package with no cancellation/return history**. Its commercial snapshot consists of the original line amounts in full. COD and split-package provider creation remain blocked until the shared quantity allocation contract and all financial callers are implemented. Existing development fulfillment/COD workflows remain available for packages without an integration booking.

## Local configuration and API

To opt in for local development, set these on the backend process:

```powershell
$env:SHIPPING_PROVIDER_MODE = 'MOCK'
$env:SHIPPING_WORKER_ENABLED = 'true'
```

The worker defaults to batches of 20, a 60-second lease and a five-second scheduling delay. Backend properties under `commerce.shipping.integration` can tune these values. Worker startup does not switch provider mode automatically. No Shiprocket credentials are used by this foundation.

All browser mutations retain session authentication and CSRF. Provider creation requires Admin/Fulfillment; authorized operations readers can inspect safe status projections. Finance/Reporting and customers cannot access these shipping operations endpoints.

| API | Behavior |
|---|---|
| `POST /api/v1/admin/operations/shipments` | Local package preparation; existing contract |
| `GET /api/v1/admin/operations/shipments/{id}/provider-booking` | Package version, provider mode, safe booking/job details, allowed actions and a reason when unavailable; excludes private payload |
| `POST /api/v1/admin/operations/shipments/{id}/commands` | `{"status":"CREATE_PROVIDER_ORDER","reason":"Packed and checked","version":0}` with `Idempotency-Key`; HTTP 202 returns a persisted operation. Existing fulfillment commands retain HTTP 200 |
| `GET /api/v1/admin/operations/shipping-jobs/{id}` | Safe durable operation state, attempts and failure code |

Do not change the provider mode to process an operation saved for another mode. Booking references are separate from customer tracking/AWB references. Unknown outcomes and frozen inputs require reconciliation; this release does not offer a manual command that declares an uncertain create failed or starts a replacement blindly.

## Verification and next phases

Verification for this slice is recorded in [the implementation tracker](IMPLEMENTATION-TRACKER.md). Automated suites cover intent replay, authorization/CSRF, immutable snapshots, concurrency, expired leases, uncertain create recovery, stock preservation, mixed-package returns and admin recovery states. Component/provider mocks are development evidence, not real Shiprocket acceptance.

Remaining HLD work:

1. Shared stable commercial quantity allocations and historical review; adapt COD, cancellation and return/refund callers before enabling split/COD booking.
2. Package estimation, serviceability, Standard/Express policy, checkout shipping quote/review-hash integration and immutable customer delivery promises.
3. Actual Shiprocket authentication/token handling, verified request/response fixtures, account-scoped references and read/recovery contracts.
4. Assisted courier selection, AWB, private labels/manifest, pickup and handover prerequisites; coordinated provider cancellation and replacement generations.
5. Verified webhook inbox, tracking/polling, RTO/lost state aggregation, return-linked reverse parcels and quantity-aware warehouse receipt.
6. Live account/operations acceptance and existing invoice, tax, secrets, privacy and production release gates.
