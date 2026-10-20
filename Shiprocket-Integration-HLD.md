# Shiprocket integration — High-level design

- **Version:** 1.3 — dashboard-managed standard orders.
- **Prepared:** 16 October 2026. **Revised:** 20 October 2026.
- **Owner clarification:** One Shiprocket order contains all purchased items, one estimated physical parcel and one AWB. MPS and separate physical boxes are outside this release.
- **Delivery model:** React/Spring Boot modular monolith; PostgreSQL retains commerce authority. See [implementation progress](SHIPROCKET-IMPLEMENTATION.md) for verification and rollout status.

## 1. Outcome and scope

Accepted COD and verified prepaid capture automatically queue one forward Shiprocket order. Staff select the courier, assign the AWB, print documents and schedule pickup in Shiprocket. Customers track, request eligible item cancellation and request policy-based returns in the webapp.

This version supersedes the earlier MPS interpretation. Multiple order items do not require an MPS contract when shipped in one physical parcel. Separate customer orders are never merged by postcode. The full saved delivery address and pickup origin identify the shipment.

The implementation retains the existing assisted workflow for historical records. Checkout courier comparison, Standard/Express selection, multiple origins, separate physical parcels, exchanges, automatic courier purchasing and automatic NDR decisions are later scope.

## 2. Workflow

~~~mermaid
flowchart TD
    A[Accepted COD or verified prepaid capture] --> B[Durable shipping job]
    B --> C{Product and packaging data complete?}
    C -->|No| D[Confirmed customer order + Admin alert]
    D -->|Correction and versioned retry| B
    C -->|Yes| E[One parcel estimate and immutable provider intent]
    E --> F[Leased worker creates Shiprocket order with all remaining items]
    F --> G[Staff book and ship in Shiprocket]
    G --> H[Order reads discover AWB + verified webhooks/API tracking]
    H --> I[Local customer timeline]
    H --> J[Proven transport consumes reserved inventory once]
    I --> K[Pre-AWB item cancellation request]
    K --> L[Fresh provider read and confirmed old-order cancellation]
    L --> M[Release selected units and refund captured prepaid share]
    L --> N[Queue remaining items as a replacement provider order]
    I --> O[Eligible delivered-item return]
    O --> P[Automatic policy acceptance + linked reverse order]
    P --> Q[Staff arrange reverse pickup in Shiprocket]
    Q --> R[Warehouse receipt and successful inspection]
    R --> S[Existing prepaid refund or controlled COD payout]
~~~

## 3. Commerce and identity invariants

- PostgreSQL stores accepted orders, reservations, original financial snapshots, provider intent, jobs and tracking. Redis is supporting infrastructure.
- A browser payment-success message does not authorize shipping. Capture must be verified through the existing payment service, webhook or reconciliation path.
- One active forward provider generation represents one customer order and all its remaining quantities. A cancelled provider generation remains historical.
- Customer order numbers remain stable across provider replacement. Merchant references, Shiprocket order/shipment IDs and AWBs remain separate.
- Original prices, discounts, shipping fees, GST, captured balances and refund entitlement never change because staff change a carrier or parcel in Shiprocket.
- The COD collectible amount is the saved remaining order amount, represented once.
- Unknown remote outcomes never establish failure or authorize a second create/cancel mutation.
- Existing [commerce](COMMERCE-DECISIONS.md), tax, invoice, privacy and production release gates remain applicable.

## 4. Creation and workflow snapshots

Set `SHIPPING_WORKFLOW_MODE=DASHBOARD_ORDER` only for the approved rollout. The default remains `ASSISTED`. Checkout saves the workflow, provider mode and account identity on new orders. Changing runtime configuration does not reinterpret old jobs or automatically backfill old orders.

COD acceptance writes a unique order shipping job in the accepting transaction. Prepaid checkout saves the workflow but does not queue creation until verified capture commits. Duplicate checkout/payment events converge on one job. External authentication or order creation never runs under checkout, payment or inventory locks.

The planner creates one local shipment and one immutable provider operation in its transaction. The existing leased provider worker executes the real `POST /orders/create/adhoc` after commit. A local queue entry is not proof that Shiprocket created the order; the provider operation must succeed.

## 5. Product data and packaging configuration

Use the catalog's existing product weight and length/width/height. Each purchased unit receives a protective packing estimate; quantity three means three estimated protected units **inside the single final parcel**, not three independently shipped parcels.

Admin configures box codes, usable internal dimensions, outer dimensions, maximum packed weight, optional measured empty weights, padding clearance, tape/padding allowance, material g/m² and a construction factor. There are no invented production measurements or material defaults.

Per-unit tare precedence:

1. A product override is complete protective packaging weight per unit, including its unit box, tape and padding. Explicit zero is supported; unset falls back.
2. Otherwise use the selected unit box's measured empty weight plus configured tape/padding.
3. Otherwise estimate from its outer surface area, material g/m², construction factor and tape/padding.

~~~text
surface_area_m2 = 2 * (L*W + L*H + W*H)       # outer dimensions in metres
estimated_tare_g = ceil(surface_area_m2 * material_g_per_m2 * construction_factor
                        + tape_padding_g)
protected_unit_g = product_unit_g + selected_unit_tare_g

one unit: final parcel uses its selected unit box and gross weight
multiple units: final gross = sum(protected_unit_g) + outer_carton_tare_g
~~~

The construction factor estimates flaps/seams and must be calibrated. Measured weights are preferred. For multiple units, the final outer carton has its own tare; that is additional to the separately protected units. The UI discloses this calculation to Admin, without adding a customer packaging charge.

Select the smallest fitting preset by outer volume and stable code ordering. Unit fitting permits rotations and requires clearance on both sides. Final carton fitting uses disjoint three-dimensional spaces with rotations and a conservative guillotine heuristic; it never accepts overlapping units. This estimate can require a larger carton than an experienced packer. Capacity and dimensions are both checked.

The planning cap is 1,000 units per order and the existing application parcel limits are 100 kg and 300 cm per dimension. Larger/unsupported orders require review. Grams and centimetres are internal units; the adapter converts weight to kilograms. Carrier volumetric/chargeable weight remains separate.

## 6. Missing data and operator correction

Keep the accepted customer order and its reservations when required product data, a suitable box or necessary packaging defaults are missing. Show **Not created in Shiprocket — packaging details required**, with affected SKUs and actionable fields or configuration reasons.

Admin saves settings using an expected revision and reason. Admin/Fulfillment may retry a held forward plan using its current job version and a reason. Retry clears the old estimate and cannot create a duplicate active provider order.

Staff may correct actual measurements in Shiprocket before courier booking. Such edits do not rewrite customer totals. Automatic reconciliation of arbitrary dashboard item/financial edits is outside this release; staff must use the webapp cancellation/refund workflow for customer commercial changes.

## 7. Dashboard shipping and tracking

Normal dashboard-mode records expose status/reconciliation in the webapp; the backend also rejects competing assisted courier/AWB/pickup/dispatch commands. Historical assisted records retain their original commands and explicit handover requirement.

Poll known Shiprocket order/shipment IDs even while local AWB is null. Read-confirm identity, account and mode, then attach the dashboard-assigned AWB under booking-version and poll-lease fences. A changed or colliding AWB requires reconciliation. Requeue verified early scans after discovery.

Verified webhooks are primary for timely scans; bounded API polling is the backstop and discovers dashboard changes. Customer refresh reads saved local data. Forward polling uses the configured tracking interval (default 30 minutes); reverse polling uses a 30-minute normal interval with a shorter failure retry. Webhooks alone are not assumed to report AWB assignment.

The callback is the backend HTTPS `POST /api/v1/logistics/events`, authenticated by mandatory constant-time `x-api-key` verification using `SHIPROCKET_WEBHOOK_SECRET`. Persist bounded minimal scan evidence before HTTP 200. Deduplicate by mode/account/AWB/status/time; retain invalid mappings/statuses for review. Provider payloads, recipient data and document URLs are not returned to customers.

## 8. Dispatch, delivery and warehouse authority

For saved dashboard-mode orders, verified pickup/in-transit or delivery evidence against the confirmed AWB invokes the shared inventory consumption operation once, then projects the scan. AWB assignment, labels and a scheduled pickup do not consume stock.

The single parcel's delivery determines its assigned quantities' delivery/return eligibility. Do not use this model to ship separate physical boxes under an ordinary AWB. Existing historical split-package return windows remain package-specific.

Exceptions, loss and RTO are evidence for operations review. They do not represent customer delivery, warehouse receipt, restocking, COD collection or a refund. A reverse-delivered carrier scan is recorded in return history; warehouse staff must still confirm receipt and inspect.

## 9. Saved cancellation promise and customer API

New dashboard orders save the before-AWB rule through their workflow snapshot. Checkout quotes disclose `BEFORE_AWB` and bind that promise into their review hash; a workflow switch invalidates a stale quote. Tracking reads use the saved workflow. Historical assisted orders keep the existing until-dispatch promise.

Customers select individual items/quantities. After any assigned AWB in that order's provider history, normal self-service cancellation closes; support handles exceptions and eligible delivered items follow the saved return policy.

The existing cancellation API returns the durable record. `CANCELLATION_REQUESTED` and `CANCELLATION_REVIEW` are pending states, not successful cancellation or refund. Same-key replay returns the same record; changed input conflicts. Only one unresolved provider cancellation per order is allowed.

## 10. Pre-AWB cancellation and replacement

1. Validate ownership, remaining quantities and the saved cutoff; commit the requested items without changing stock or money.
2. Wait for any in-flight or unknown creation to resolve. Pause competing local planning.
3. Read Shiprocket immediately. A newly discovered AWB rejects normal cancellation and closes the local action.
4. For an unassigned order, durably record the cancellation attempt before the provider mutation. Confirm cancellation through the provider response/read-back.
5. If booking changes or an outcome is uncertain, hold for review. Never report cancelled quantities, release reservations or initiate a refund from an inconclusive result.
6. After confirmed pre-AWB cancellation, the shared cancellation service invalidates the old local prepared parcel, applies only the selected quantities and releases those reservations once.
7. Queue a new generation containing remaining items and their original commercial shares. COD uses the reduced collectible amount. A fully cancelled order has no replacement.
8. Initiate captured prepaid cancellation refunds only after this local confirmed transition. COD does not refund uncollected money.

Recovery after an uncertain cancel is lookup-only. Admin's cancellation review retry rechecks the saved operation and cannot blindly post cancellation again. The unavoidable external booking race may require staff to reconcile a remotely cancelled order; no automatic success/refund is inferred.

## 11. Commercial quantity allocations

Dashboard-mode cancellation, returns, provider snapshots and COD collection use original quantity shares. Gross goods, discounts, delivery and GST component paise use stable unit ordinals, with remainders assigned to the earliest units. Taxable bases balance each unit's gross amount against its allocated tax; splitting every component independently must not change the COD/refund amount. Original component totals remain exact across cancelled and remaining quantities. Inconsistent or negative unit components require review.

Provider replacements use only remaining line quantities and components. Their inclusive item-minus-discount-plus-delivery amount must reconcile with the remaining gross entitlement before creation; an incompatible provider presentation produces a review alert. Original order snapshots are immutable. Historical assisted allocations retain their prior algorithm. Reverse shipment declared item values are transport metadata; they do not set refund entitlement.

## 12. Policy-based returns and reverse orders

The existing return service checks ownership, saved category eligibility/window, actual delivered quantities and prior claims. A qualifying dashboard-mode request automatically becomes `APPROVED` and commits a unique reverse job. Other workflows retain their existing staff decision flow.

The reverse worker estimates the selected quantities' one return parcel, resolves the original registered pickup location and matching postcode through the account's pickup-address API, and saves a private immutable request. Missing packing/address permissions or data produce an Admin review/packing alert. No warehouse address is guessed from the customer's postcode or the seller's legal address.

Create through `POST /orders/create/return`, linked to the original Shiprocket order. Reverse orders are prepaid transport records for both original payment methods; they do not collect COD again or request a provider payout. Staff arrange reverse courier/AWB/pickup through Shiprocket.

Reverse IDs/AWBs are separate from forward IDs. Read-confirm the reverse AWB and project its verified scans into return history. Unknown creation uses exact-reference lookup and remains unresolved if no unique match is proven. A failed poll never sends an already-created return back through creation.

## 13. Receipt, inspection and refunds

Warehouse receipt quarantines returned units. Explicit successful inspection controls restocking and refund eligibility; rejected inspection cannot refund. Existing idempotent inventory, online refund and COD verified-collection/payout controls remain authoritative.

Prepaid cancellation refunds follow confirmed cancellation. Prepaid return refunds follow actual receipt and successful inspection. COD cancellation reduces the collectible balance; COD return payouts remain the existing controlled process and cannot exceed verified collected/refundable funds. No carrier scan authorizes financial action.

## 14. Administration and API surfaces

| Surface | Behavior |
|---|---|
| `GET/PUT /api/v1/admin/shipping/packaging` | Admin-only revisioned box/material settings; mutation reason and CSRF required |
| `GET /api/v1/admin/shipping/jobs` | Authorized operations readers see safe forward preparation/provider state |
| `POST /api/v1/admin/shipping/jobs/{id}/retry` | Admin/Fulfillment retry held local planning with expected version and reason |
| `GET /api/v1/admin/shipping/reverse-jobs` | Authorized operations readers inspect safe reverse work state |
| `POST /api/v1/admin/shipping/reverse-jobs/{id}/retry` | Admin/Fulfillment/Returns reconcile held reverse work with version and reason |
| Existing cancellation API | Durable requested/confirmed/review/rejected outcome and separate refund status |
| Existing cancellation review retry | Admin/Refunds recheck held provider cancellation; existing refund authorization stays enforced |
| Existing tracking/return APIs | Ownership, saved policy, local timeline, receipt/QC/refund authority |
| `POST /api/v1/logistics/events` | Provider token and durable inbox; exact existing CSRF exemption |
| Existing provider operation APIs | Safe reconciliation and historical assisted workflow |

Keep browser session authentication, CSRF, backend roles and customer ownership. Mutations need version/idempotency protection where applicable. Return fixed safe failure details; never expose API-user credentials or private snapshots.

## 15. Persistence and recovery

Reuse V29–V31 provider bookings, immutable payloads, operation leases and tracking inbox. V33 adds saved workflow/provider/account, packaging revisions and unique order-planning jobs. V34 adds durable requested cancellation items, cancellation-attempt evidence and leases. V35 adds independent reverse jobs and reverse tracking mappings. Previously applied migrations are not rewritten.

Claim work in short transactions, perform network I/O outside them, and fence writes by the current lease, identity and relevant version. Lease expiry is not provider failure. Same-reference lookup must prove one matching remote order before accepting recovery. Alerts and original requests survive restart/Redis loss.

## 16. Verification and release

Verify COD/prepaid capture timing, duplicate triggers, rollback, missing product/default data, monetary residuals, one-parcel fit, stale settings/retry versions, role/CSRF/ownership, account switches, AWB-null discovery, early/duplicate scans, exactly-once consumption, pre-AWB partial cancellation, AWB races, uncertain mutations, policy-based reverse creation, and receipt/QC/refund separation.

Local mock-provider and HTTP-wire tests are development evidence. They do not prove account serviceability, wallet/permission readiness, carrier acceptance, invoice/tax approval or real-account lifecycle acceptance.

Deploy compatible backend migrations/readers and frontend before selecting the new mode. Configure runtime secrets on the backend hosting service, not in Docker build arguments or image-publishing secrets. Validate Admin packaging and all saleable product measurements. The owner controls any real-account shipment, production activation and rollback exercise.
