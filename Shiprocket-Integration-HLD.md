# Shiprocket integration — High-level design

- **Version:** 1.2 — owner-approved dashboard-managed MPS design; implementation pending.
- **Prepared:** 16 October 2026. **Revised:** 20 October 2026.
- **Delivery model:** Existing React/Spring Boot modular monolith; automatic provider creation, shipping in Shiprocket, customer tracking/cancellation/returns in the webapp.
- **Evidence:** The owner reports MPS enabled and successful webhook registration. These are setup reports, not verified MPS API fixtures or end-to-end acceptance.

## 1. Purpose and design outcome

A confirmed customer order automatically becomes one Shiprocket order with a multi-packet shipment (MPS), one customer-facing master AWB and separately packed purchased units. Staff select couriers, assign AWBs, print labels and schedule forward/reverse pickup in Shiprocket. The application synchronizes those actions and retains authority over customer orders, money, inventory and return policy.

Version 1.2 records the decisions approved on 20 October 2026. It supersedes version 1.1's initial webapp-assisted/package-by-package target. This is a documentation/plan revision only. See [implementation progress](SHIPROCKET-IMPLEMENTATION.md) for existing behavior; design approval does not enable features or change live settings.

Use [commerce decisions](COMMERCE-DECISIONS.md) for financial/return policy and [architecture decisions](ARCHITECTURE-DECISIONS.md) for domain boundaries. Existing tax, invoice, privacy and production release gates remain in force.

## 2. Existing baseline and scope

V29–V31 implement manual local preparation, queued provider creation for one complete prepaid package without adjustment history, assisted courier/AWB/documents/pickup, explicit local handover, verified tracking and provider cancellation. Automatic post-order creation, MPS/COD allocation, dashboard synchronization and automatic reverse-business orchestration remain implementation work. Extend existing customer cancellation, inspection, refund and COD-ledger services rather than duplicating them.

The approved first release includes:

- Prepaid orders after verified payment capture and COD orders after local acceptance.
- One forward master for one customer order, full delivery-address snapshot and pickup origin. Never combine separate customer orders by postcode.
- One separately packed unit for each purchased unit: quantity three means three estimated packets under the master.
- Automatic creation without a required staff preparation/create click; actionable Admin alerts when required data is missing.
- Forward/reverse courier selection, AWB, labels/manifest and pickup managed in Shiprocket.
- One customer master tracking reference, internal packet evidence, partial-delivery visibility and review where evidence is insufficient.
- Individual-item/quantity self-service cancellation before AWB assignment; support-only exceptions afterward.
- Policy-based return acceptance, automatic reverse-order creation, warehouse receipt/inspection and agreed refund timing.

Checkout courier comparison, Standard/Express selection, multiple warehouses, merging separate customer orders, automatic courier purchasing, exchanges and automatic NDR decisions are later extensions. Preserve the saved customer shipping-price policy; checkout carrier pricing is not a prerequisite.

## 3. Decisions and invariants

| Decision | Required behavior |
|---|---|
| Durable authority | PostgreSQL stores orders, allocations, snapshots, jobs and tracking; Redis is supporting infrastructure |
| Creation trigger | Verified prepaid capture or accepted COD commits one idempotent shipping work item; browser success is insufficient |
| Grouping | One order/address/origin has one active forward master generation with multiple physical packets |
| Money | Carrier costs and dashboard edits cannot rewrite customer totals, GST, paid amounts or refund entitlement |
| COD | Represent the saved unpaid master amount once; do not repeat the entire collectible amount on every packet |
| Packing | Stable quantity identities, per-unit estimates and versioned Admin defaults; never invent product measurements |
| Frozen evidence | Preserve original snapshots; changes create desired and provider-confirmed revisions |
| Cancellation cutoff | First confirmed master or child AWB closes normal self-service cancellation; stale local absence is not proof |
| Dispatch | Proven physical pickup/in-transit invokes the shared exactly-once inventory operation; AWB/label/scheduled pickup alone does not dispatch |
| Delivery | One AWB does not prove every packet arrived; partial/ambiguous outcomes cannot grant undelivered quantities return eligibility |
| Returns | Evaluate saved policy and remaining delivered quantities automatically; accepted returns have independent reverse identities |
| Refunds | Confirm cancellation before initiating prepaid cancellation refunds; return refunds follow receipt and successful inspection |
| Recovery | Unknown remote outcomes remain pending/review; no duplicate bookings, stock movements, reservation releases or refunds |

Preserve immutable financial snapshots and deterministic goods/discount/delivery/tax shares per quantity through cancellation and returns. Retain the effective shipping-fee policy and tax service; this design grants no new tax/invoice approval.

## 4. Component architecture

~~~mermaid
flowchart TD
    C[Customer checkout] --> O[Verified payment / accepted COD]
    O --> P[Automatic packet plan and allocations]
    P --> J[Durable provider-create job]
    J --> S[Shiprocket order and MPS]
    A[Staff in Shiprocket dashboard] --> S
    S --> W[Verified webhooks]
    S --> R[Order and tracking API reconciliation]
    W --> D[Local inbox and shipment projection]
    R --> D
    D --> I[Shared inventory transitions]
    D --> T[Customer tracking]
    T --> X[Cancellation / policy-based return]
    X --> J
~~~

Reuse the provider adapter, leased workers, tracking inbox and commerce modules. Add packet planning, MPS mapping and dashboard reconciliation within the modular monolith; no separate backend, broker or worker deployment is required.

## 5. Customer workflow and checkout integration

1. Existing checkout validates customer/address, stock, financial quote, approved tax data and saved policy.
2. Place the local order and reserve quantities under existing transaction/idempotency rules. Unpaid online orders do not create live shipping orders.
3. Verified capture, including webhook/reconciliation recovery, or accepted COD commits the shipping work item once. Repeated payment events cannot create another master.
4. The worker plans packets and creates the provider order after commit. The customer sees order confirmation and shipment preparation.
5. Missing shipping measurements/configuration keep the confirmed order and reservations and alert Admin. Unpaid-payment expiry remains a separate rule.
6. Store Shiprocket order/shipment IDs; the customer order number remains unchanged across provider generations.
7. Staff ship through Shiprocket; the backend discovers AWBs and progress and serves the local tracking timeline.

Provider outages do not roll back confirmed orders or automatically refund them. Retry safe operations and alert on aging failures. Do not fabricate serviceability or delivery promises. Checkout Standard/Express and provider-quote review hashes are later, separately enabled extensions.

## 6. Packet planning, weight and dimensions

### Per-unit planning

Read variant weight/dimensions and versioned packaging configuration. Create one packet estimate for every purchased unit. Select a standard box using a documented deterministic fit rule, allowed rotations, usable internal dimensions, padding clearance, capacity limits and stable tie breaking. Save chosen box, original inputs, units, configuration revision and result.

Use outer box dimensions for shipping. Product dimensions are not parcel dimensions; adding all product lengths/widths/heights is not an MPS packing algorithm. Retain each packet's measurements and translate combined MPS fields only according to the verified provider contract.

### Packaging weight precedence

1. A product packaging-weight override represents complete per-unit tare; do not add the same allowances twice.
2. Otherwise use the selected box's measured empty weight plus configured tape/padding allowances.
3. If measured weight is unset, estimate from box surface area, material grams per square metre, construction allowance and tape/padding.
4. An unset product override falls back to Admin configuration. Missing required product measurements, suitable boxes or fallback inputs instead blocks provider creation and alerts Admin.

For outer box dimensions L, W and H in metres:

~~~text
surface_area_m2 = 2 * (L*W + L*H + W*H)
estimated_tare_g = surface_area_m2 * material_g_per_m2 * construction_factor
                   + tape_padding_allowance_g
packet_gross_g = product_unit_weight_g + selected_tare_g
master_actual_weight_g = sum(packet_gross_g for all remaining purchased units)
~~~

The construction factor estimates seams/flaps for the selected box/material; it is not a universal cardboard formula. All numeric settings are Admin-configurable and require calibration. No production density/factor/allowance is invented here. Use decimal arithmetic, documented rounding and positive bounds; keep grams/cm internally and explicitly convert at the adapter. Carrier volumetric/chargeable weight remains distinct from actual weight.

### Missing data and correction

Persist an actionable Admin alert: **Not created in Shiprocket — product measurements missing**, naming SKUs, quantities and missing fields. Use equivalent explicit reasons for missing configuration, unsuitable boxes and unsupported MPS mapping. Keep the customer order confirmed, do not claim provider creation or cancel/refund automatically, and retain resumable work. Correction and retry must not duplicate creation.

Staff may correct final measurements in Shiprocket before booking. Save provider-observed values alongside the original estimate with timestamps/history; do not change customer charges. Material discrepancies or invalid packet counts enter review. Small estimation variance is expected, but no arbitrary variance is declared free from carrier billing consequences.

### MPS contract gate

The owner confirms account MPS enablement. Before enabling this mode, prove the exact API representation for master creation, packet counts/measurements, labels, child references and total COD. Ordinary adhoc creation or an undocumented package-count field does not prove MPS support. Unsupported mapping alerts Admin; do not silently create independent AWBs or represent loose packets as an ordinary single parcel.

## 7. State model and dispatch

These are proposed logical states, not implemented enum or migration claims:

| Layer | Required states/evidence |
|---|---|
| Sync work | Pending, packaging details required, create pending, created awaiting AWB, unknown outcome, Admin review |
| Provider milestones | Order/shipment IDs, master/child AWBs, packet mapping, documents/pickup and observed measurements |
| Fulfillment | Prepared, dispatched, in transit, partially delivered, delivered, exception; aggregate packet quantities |
| Cancellation | Requested, reconciling, confirmed, rejected due to cutoff, support review; refund state is separate |
| Reverse | Policy evaluation, accepted, create pending/created, pickup/in transit, partial receipt, inspection, refund pending/completed |

Dashboard mode removes mandatory webapp handover from the normal path. Verified pickup/in-transit evidence resolves account/master/packet identity and invokes the shared idempotent dispatch service for proven quantities. Reservation consumption, stock movement, shipment history, audit and projection commit atomically. Duplicate webhook/poll evidence cannot consume twice. Contradictory cancellation, insufficient stock or unknown scope requires review, not bypass.

Apply master scans to all packets only when verified provider semantics establish complete scope; otherwise require packet evidence or audited staff confirmation. This explicitly changes the current projector, which reviews missing local dispatch rather than automatically dispatching.

Customers retain one master reference. Some confirmed deliveries produce **Partially delivered** and an Admin alert. Master delivered proves whole-order delivery only with verified complete-shipment semantics. Ambiguous receipt cannot mark every item delivered or start all return windows. RTO/lost remain exceptions; reverse delivered means arrival at the seller.

## 8. Data model changes

Use additive migrations after the actual current schema; V29–V31 already exist. Reuse existing records where semantics fit:

| Record | Required additions |
|---|---|
| Packaging configuration | Box internal/outer dimensions, capacity, measured tare, material density, allowances/defaults, effective revision and validation |
| Product shipping data | Unit weight/dimensions, optional complete tare override, version |
| Master fulfillment | Order/address/origin, saved workflow mode, account/environment, generation and active booking/master reference |
| Packet plan/allocation | Stable unit/share identity, box, frozen estimate, provider child IDs/AWBs if available, quantities and evidence |
| Commercial shares | Original goods/discount/delivery/tax/payable components and nonoverlapping active/cancelled/returned claims |
| Booking and operation | Forward master or reverse group, immutable payload revisions, merchant reference, lease/version, desired update and safe result |
| Dashboard observation | Confirmed master/child references, measurements, amount checks, status/freshness and cutoff evidence |
| Cancellation/reverse | Requested quantities, policy/provider results, forward links, independent reverse generation, receipt/QC/refund links |
| Alerts/inbox | Durable reason/age, verified source, dedupe identity, master/packet scope and review outcome |

Enforce one active forward master generation per integrated order; unique account/mode provider references; idempotency/version constraints; positive packet allocations; stable share ownership; bounded COD/refund claims. Different returns against one forward order need independent reverse identities. Cancelled generations cannot own active quantities twice.

Pending/unknown operations retain allocation protection. Preserve original estimates and financial history. Backfill only conclusive mappings; historical records keep their saved assisted mode otherwise. Upgrade/disable older writers that would bypass new allocation and cutoff rules before rollout.

## 9. Application API design

Existing routes remain authoritative; extensions below are proposed until implemented:

| Surface | Required behavior |
|---|---|
| Checkout/payment/COD acceptance | Durable automatic shipping intent; no provider I/O under order/stock locks |
| Existing customer cancellation API | Individual quantity request, fresh provider eligibility, pending outcome and separate refund status |
| Owner-only tracking | Master reference, safe packet/quantity evidence, partial delivery, freshness and policy-derived actions |
| Existing return APIs | Automatic saved-policy acceptance, reverse work and distinct receipt/QC/refund stages |
| Admin settings/catalog | Versioned box/material defaults and SKU measurements; no secrets |
| Admin overview/fulfillment | Missing-data/sync alerts, reconcile/retry and support exceptions |
| Provider-booking/job reads | Master/packet hierarchy, desired revisions and observations without private payloads |
| POST /api/v1/logistics/events | Existing mandatory token, durable inbox and HTTP 200 acknowledgement |
| Existing assisted commands | Retain for saved assisted records; no competing webapp AWB/pickup writer for dashboard-managed masters |

Retain browser session/CSRF, ownership/roles, versions and durable idempotency. Queue external effects with HTTP 202 as appropriate; same-key retries return the same operation, changed input/stale versions conflict. Return safe code/detail/trace information. Do not add a second checkout or require customer knowledge of provider IDs.

## 10. Shiprocket API boundary and credentials

Production base: https://apiv2.shiprocket.in/v1/external. Verify current reference and account fixtures:

| Capability | Boundary |
|---|---|
| Authentication | POST /auth/login; server-side API-user credentials and cached token |
| Forward creation | Existing POST /orders/create/adhoc is the ordinary-order boundary; prove exact MPS representation |
| Dashboard discovery | GET /orders/show/{id} and verified shipment reads; exact merchant-reference lookup for uncertain creates |
| Tracking | GET /courier/track/awb/{awb} or /courier/track/shipment/{id} |
| Pre-AWB update | POST /orders/update/adhoc; verify MPS item, amount and packet changes |
| Cancellation | POST /orders/cancel and supported shipment cancellation where relevant; read-confirm outcomes |
| Reverse creation | POST /orders/create/return; prove reverse/MPS packet/account mapping |
| AWB/documents/pickup | Staff execute in Shiprocket for this mode; existing adapter mutations remain for compatible assisted records |

Serialize token renewal, bound calls/response sizes, refresh auth at most once after a verified auth failure and never blindly replay uncertain mutations. Inject secrets server-side. Mode/account switches cannot reinterpret saved jobs. Save master/child/provider IDs separately from customer/merchant references. Unsupported fields or MPS/reverse semantics are acceptance blockers, not guesses.

## 11. Webhooks and reconciliation

Use verified webhooks for timely tracking and scheduled API reads for dashboard discovery, missed updates and uncertain-operation recovery. Customer refreshes read local data, not Shiprocket.

Require TLS, bounded JSON, constant-time x-api-key verification and the exact existing CSRF exemption. Persist minimal verified evidence before HTTP 200; reject invalid authentication/input and do not acknowledge failed database writes. Process asynchronously. Deduplicate scans across callbacks/polls by account, mode, direction, master/packet scope, status and event time. Preserve chronology and review unknown mappings.

Reconcile created masters even while AWB is null: the current AWB-only polling selection is insufficient. Discover dashboard-assigned master/child AWBs, courier, pickup, packet details, measurements and booking state from known provider orders. Webhooks are not assumed to report every AWB assignment. Resolve unknown AWBs through verified account-scoped references, never postcode/customer guesses.

Use bounded leased batches, configurable backoff and rate budgets. Proposed starting intervals: 2–5 minutes for awaiting-AWB/recent dashboard changes, about 30 minutes for moving-shipment backstop reads. These are application settings, not provider SLAs. Cancellation needs immediate fresh eligibility and outcome reads. Stop normal polling for terminal records while retaining unresolved/exception recovery; expose last-updated time honestly.

## 12. Durable operations and failure recovery

Persist intent with the triggering order/payment/return transition. Claim a lease briefly, call outside the transaction, then apply results under lease/version fences. One unresolved mutation per active generation; lease expiry does not prove provider failure.

| Failure | Recovery |
|---|---|
| Missing data/configuration | Confirmed order retained; actionable alert; safe resume after correction |
| Create timeout/crash after success | Exact reference lookup; attach one confirmed match; unknown/review if inconclusive |
| Unsupported MPS | Block and alert; no silent single-parcel or independent-AWB fallback |
| AWB assigned during cancellation | Reconcile; close normal cancellation or review; no false success/refund |
| Update timeout/mismatched read-back | Keep desired revision pending; confirm items, packets and amounts |
| Pre-AWB replacement | Confirm old cancellation/no shipping exposure, then create a new generation using remaining shares |
| Dashboard commercial edits | Flag mismatch; do not overwrite original finances or infer cancellation from amount alone |
| 429/read transient failure | Bounded backoff/jitter and Retry-After, with stale indicators |
| Mutation timeout/5xx | Reconcile before retry; exhausted attempts cannot establish success/failure |
| Duplicate transport/financial event | Existing idempotent transitions/ledger prevent repeated dispatch, release, restock or refund |
| Restart/Redis failure | PostgreSQL retains durable intent and allocations |

Reuse bounded client timeouts; do not add generic mutation retries. Audit requested changes, provider observations and accepted/rejected outcomes with safe references.

## 13. Cancellation, RTO and reverse shipping

### Individual-item cancellation before AWB

Customers request specific remaining quantities until courier booking begins. Check current provider state, not stale local AWB absence. First confirmed master or child AWB closes normal self-service cancellation. Later exceptions are Support/Admin work; normal customer actions do not promise booking rebuild. Shipped goods follow the saved return policy; interception/RTO remains exceptional operations work.

Apply this cutoff through a new effective policy saved on future orders. Historical orders retain their original cancellation/return promises; neither migration nor a workflow-mode switch may retroactively shorten them. Customer policy wording and backend allowed actions must use the same saved revision. Existing return windows, exclusions and mandatory-rights disclosures remain unchanged.

1. Lock/version the order and selected shares; persist the request/idempotency and pause competing local creation/update work.
2. If creation has not started, remove selected quantities from the desired shipment. Resolve in-flight/unknown creation first.
3. For a confirmed unbooked provider record, use a proven pre-AWB item update and reconcile packet count, weight/dimensions and remaining amount. If MPS updates cannot safely express this, confirm old provider cancellation before creating a replacement generation. Full cancellation needs no replacement.
4. Read-confirm the result. Dashboard staff are independent writers: local locks cannot prevent concurrent booking. New AWB/uncertain scope remains requested/review or is rejected using confirmed evidence; no success while cancelled units may still ship.
5. After confirmed removal/cancellation, finalize only selected quantities, release reservation once and initiate the existing prepaid refund. For COD, confirm the reduced saved/provider collectible amount; uncollected COD has no refund.

Preserve original totals and goods/tax/discount/delivery shares; do not move cancelled amounts onto remaining items or invent a new fee policy. Refund initiation and confirmed completion remain distinct. Staff check pending cancellation alerts before AWB assignment and book before sealing/label finalization; this SOP does not eliminate the external race.

### Policy-based returns

Evaluate ownership, saved window/exclusions, proven delivery and unclaimed quantity under the existing order lock. Eligible requests are automatically accepted without discretionary approval and commit a reverse-create job. Ineligible requests show reasons; ambiguous delivery/data enters review.

Each accepted return/reverse generation has independent provider/merchant IDs, allocated quantities and a packet plan. Disjoint returns against the same forward master must not overlap claims. The worker creates the reverse order with buyer pickup and seller destination; staff book reverse transport in Shiprocket. Missing data or unsupported reverse mapping creates an alert without inventing pickup success. Forward/reverse timelines remain separate.

Reverse delivered is transport evidence. Staff record actual receipt into quarantine, inspect and explicitly decide restock. Initiate prepaid return refunds after successful receipt/inspection for eligible quantities only; failed/partial QC cannot refund/restock unreceived or rejected units. COD return refunds require verified collections and the existing controlled payout/approval/reference process; no automatic bank transfer is implied. RTO/lost alone triggers neither refund nor restock.

## 14. Admin and customer UI

| Surface | Required behavior |
|---|---|
| Customer order/tracking | One master reference, preparation, partial delivery, cancellation pending and distinct refund progress |
| Customer actions | Individual quantities before fresh AWB cutoff; returns for proven eligible delivered units |
| Admin overview/fulfillment | Not-created alerts with SKU/field reasons, unknown operations, partial delivery, age, retry/reconcile |
| Admin settings | Boxes, measured tare, material g/m², construction/padding defaults, effective revision and bounds |
| Product editor | Shipping measurements/optional complete tare override and readiness validation |
| Admin order/return | Master/packet identity, estimate vs observation, quantity claims, reverse linkage and support audit |
| Shiprocket dashboard | Normal forward/reverse courier, label/manifest and pickup operations |

New-mode orders do not require routine webapp preparation, courier comparison, AWB or handover clicks. Saved assisted records retain their compatible actions. Use existing roles, ownership, settings-version checks and privacy projections. Outbox notification intent is not proof of sent email/SMS.

## 15. Security, observability and operations

Keep browser authentication/CSRF, ownership, scoped staff roles, rate limits and privacy rules. Credentials/private provider document URLs stay server-side; retain bounded trusted-host document handling. Log no secrets or unnecessary addresses.

Monitor job age, missing-data alerts, unknown mutations, awaiting-AWB age, read freshness, webhook lag, mapping errors, partial deliveries and refund reconciliation. Audit configuration/estimate revisions, dashboard observations, cancellation results and warehouse/financial decisions. Reconcile reservations and movements after exceptions. Existing production alert ownership/retention decisions remain required.

## 16. Required verification

| Area | Acceptance evidence |
|---|---|
| Trigger | Captured prepaid and accepted COD each enqueue once; unpaid online/replayed events cannot create duplicate masters |
| Packing | Three units produce three estimates; overrides/measured/fallback, fitting, units, bounds and rounding |
| Missing data | Confirmed order kept, exact Admin alert, safe resume after correction |
| MPS | Supported creation/count/combined-dimension fields, child labels/IDs, master AWB and account permissions proven |
| Money | Stable component/share conservation, partial cancellation, COD represented once, no double GST or refund/collection overclaim |
| Dashboard | AWB-null discovery, portal assignment/pickup/measurement synchronization without webapp booking |
| Cancellation | Queued/in-flight create, pre-AWB update/replacement, timeouts, concurrent dashboard AWB and cutoff UI |
| Dispatch/tracking | Duplicate poll/webhook consumes once; scheduled pickup does not; scope, chronology, partial/RTO/unknown evidence |
| Returns | Automatic saved-policy acceptance, concurrent claims, reverse retry, partial receipt/QC, refund and COD payout |
| Security/UI | Ownership/revocation/CSRF, safe alerts/documents, one master customer view and unavailable-data handling |
| Upgrade/regression | Additive schema, historical assisted records, overlapping writers, existing commerce concurrency/replay suites |

Historical tracker test counts prove only the prior implementation. This revision claims no new runtime, MPS or live acceptance.

## 17. Implementation plan

| Phase | Work | Completion gate |
|---|---|---|
| 1 — Contracts and allocations | Verify MPS/update/reverse fixtures; master/packet generations and shared commercial quantities; preserve assisted records | No guessed mapping; COD/cancellation/refund conservation and upgrade tests |
| 2 — Packing and automatic intent | SKU/box/default settings, per-unit planner, Admin alerts, prepaid/COD triggers | Missing data keeps orders; retries/capture/COD create one desired master |
| 3 — Dashboard synchronization | MPS creation, AWB-null discovery, child mapping, observations and local tracking | Dashboard shipping reflected; unknown-create recovery proven |
| 4 — Dispatch and cancellation | Verified transport invokes shared dispatch; fresh pre-AWB update/replacement and cutoff | Inventory, amount adjustment, dashboard-race and duplicate-refund tests |
| 5 — Returns/exceptions | Policy acceptance, reverse creation/sync, packet-aware delivery, receipt/QC/refunds | No overclaims, premature delivery, double restock/refund |
| 6 — Acceptance/rollout | Operator-approved account exercises, monitoring/runbook and new-mode activation | Complete lifecycle evidence and upgraded/disabled incompatible writers |

Gate automatic live creation until required synchronization, dispatch, cancellation and financial invariants are deployed together. LIVE alone must not reinterpret existing records. Save a workflow-mode/configuration revision; its exact property name is an implementation detail, not an environment variable already supported.

## 18. Setup, approved decisions and release gates

The owner reports MPS enablement and webhook registration. Preserve dedicated API-user credentials, registered pickup, mandatory callback token, account identity and existing worker settings. Current environment variables enable the assisted foundation; they do not implement this redesign.

Approved: prepaid + COD; separately packed purchased units under one master; measured tare before calculated fallback; Admin alerts for missing data; webhooks plus reconciliation; individual cancellation before AWB; policy-based returns and automatic reverse creation; cancellation refunds after confirmation and return refunds after receipt/successful inspection. Numeric packing settings may be entered later; absent required inputs block provider creation visibly.

Still verify exact MPS/reverse fields, supported pre-AWB packet/amount edits, complete/partial delivery semantics and account dashboard behavior. Existing tax/invoice, secrets, privacy/rate limits, operations and production acceptance gates remain. Razorpay Test Mode does not make Shiprocket LIVE a sandbox.

## 19. Sources and implementation handoff

- [Implementation progress](SHIPROCKET-IMPLEMENTATION.md), [tracker](IMPLEMENTATION-TRACKER.md), [Stage 2 operations](STAGE-2-OPERATIONS.md), [commerce decisions](COMMERCE-DECISIONS.md).
- [Architecture](ARCHITECTURE-DECISIONS.md), [security](08-security.md), [reliability](09-reliability-distributed-systems.md), [testing](14-testing-strategy.md).
- Reuse existing shipping application/provider/jobs/tracking, order/payment acceptance, cancellation/commercial allocation/COD and return services plus fulfillment/settings/catalog/customer tracking UI. Verify actual interfaces before code changes; this revision is not a source audit.

Provider references consulted during design, including the MPS support page checked 20 October 2026:

- [Official API reference](https://apidocs.shiprocket.in/?version=latest): payload authority; prove chosen MPS/update/cancellation contracts.
- [Official MPS guide](https://support.shiprocket.in/support/solutions/articles/152000000706-what-is-multi-packet-shipment-how-to-create-it-): packets, master AWB and individual labels; dashboard support is not proof of adapter/API mapping.
- [Forward lifecycle](https://apidocs-test.shiprocket.in/guides/order-lifecycle/), [webhooks](https://apidocs-test.shiprocket.in/guides/webhooks/), [returns](https://apidocs-test.shiprocket.in/guides/returns-workflow/).

The apidocs-test documentation host is not a sandbox API. Resolve account/reference differences with recorded fixtures, not guessed fields. Documentation approval is neither implementation evidence nor production activation.
