# Dedicated web admin console implementation

The React application now has a separate lazy-loaded staff console at `/admin`, with the supplied desktop dashboard as its visual foundation. Staff enter at `/admin/login`. The storefront keeps its own layout. The administration shell has a collapsible sidebar, workspace breadcrumbs, order-number search, permitted action queues, current staff identity and server logout. Sidebar links and protected pages use capabilities returned by Spring Boot; every API separately authorizes the caller.

## Implemented pages

| Routes | Behavior |
|---|---|
| `/admin` | Authorized dashboard aggregates, 7/30/90-day range, merchandise trend, current action queues, recent orders, configurable low-stock watchlist, bounded summary export and readiness notice |
| `/admin/products`, `/admin/products/new`, `/admin/products/:id/edit` | Server search/filter/sort/pagination; draft/published/archived states; nine editor tabs; variants; preview; audited publication; stale-edit conflicts and dirty-navigation protection |
| `/admin/catalog/categories`, `/admin/catalog/brands`, `/admin/catalog/attributes` | Controlled taxonomy authoring and activation, validated attributes and audit |
| `/admin/inventory`, `/admin/inventory/movements`, `/admin/inventory/reconciliation` | On-hand/reserved/available per SKU, thresholds, reasoned signed adjustments, persistent retry references, movement history and discrepancy investigation |
| `/admin/orders`, `/admin/orders/:number`, `/admin/fulfillment` | Bounded order search/state/date filters, immutable commercial/GST/shipping snapshots, payment/refund references, returns, audit and role/state actions; split packages, dispatch and carrier history |
| `/admin/returns`, `/admin/returns/:id`, `/admin/refunds` | Reloadable queues/details and state filters, decision/receipt/quarantine/inspection, confirmed provider refund results, retry and COD request flow |
| `/admin/payments` | Safe payment reconciliation and failed webhook references; corrected page-boundary handling |
| `/admin/cod` | Verified collection records, manual refund approval/payout evidence and durable histories |
| `/admin/tax` | GST categories, HSN/SAC, effective rates, real-classification/rate/policy approvals, nonmutating representative tax preview and release blockers |
| `/admin/reports`, `/admin/reports/reconciliation` | Bounded durable online-payment/COD/refund reconciliation without delivery addresses for Finance/Reporting |
| `/admin/customers`, `/admin/customers/:id` | Audited Admin/Support lookup with masked contact fields, no address projection and authorized recent order references |
| `/admin/promotions`, `/admin/coupons` | Persisted validity/eligibility/limits, audited versioned edits, saved-rule preview and authoritative checkout application; see `ADMIN-PROMOTIONS.md` |
| `/admin/settings` | Effective-dated shipping/returns/seller/tax/supplier policies, reasons and audit, optimistic revision checks; existing order snapshots stay immutable |
| `/admin/staff`, `/admin/roles` | Controlled provisioning, grant/revoke/activation, reason and audit, self-edit and last-active-Admin safeguards, server-defined capability preview |
| `/admin/audit` | Read-only action/resource/pseudonymous-actor/time filtering, bounded pages and safe state/request references |

## Data and permission contracts

`GET /api/v1/admin/capabilities` returns the caller's role grants and granular capabilities. Unknown grants fail closed. `/admin/dashboard?days=7|30|90` returns `asOf`, the bounded date window, INR, `Asia/Kolkata`, exact metric definitions and only authorized projections. Financial values are aggregated from persisted snapshots and ledgers, never calculated from downloaded order pages.

Reporting semantics are explicit: booked merchandise is the net saved merchandise line total; online captures and confirmed online refunds are the current ledger position for orders created in the selected window, because no capture-event timestamp contract exists yet. These values are not labeled as cash movement during that interval. COD and pending refunds remain separate. Action queues span current unresolved records across all dates. Test/demo database fixtures are included and the environment notice identifies development profiles. Unsupported metric values render as unavailable.

Operations retain `/api/v1/admin/operations/**`; catalog retains `/api/v1/catalog/admin/**`. New administration reads/commands use `/api/v1/admin/{customers,staff,roles,settings,promotions,audit}`. Settings apply only at their effective time; checkout captures the current return promise and monetary/tax snapshots. `/api/v1/public/business-policy` exposes only the current public shipping and return terms.

Normal-profile checkout requires approved real GST classification, the effective rate and current seller/price policy. `demo` and `payment-sandbox` profiles retain fixture workflows. Synthetic identifiers cannot receive production tax approval. Saving configuration or approving its tax treatment does not establish production readiness or generate a valid invoice.

Staff access changes increment durable `users.auth_version`; real browser principals carry their version and the request filter rejects stale/disabled sessions. The Redis namespace is now `ecommerce:session:v2`, which deliberately requires existing users to sign in again after upgrade. Browser-authenticated commands retain CSRF protection; API requests have timeouts and request IDs. No raw session tokens are stored in browser storage.

## Database and storage setup

Flyway applies additive migrations V24–V28: catalog versions/taxonomy/variants/publication/thresholds, effective business policies and tax approvals, authorization versions, promotion usage and image-upload receipts. Do not edit migrations once applied; use a forward migration for further changes.

Image upload uses a signed PUT and server-side confirmation before adding its URL to the draft. Configure all six server-only variables to enable S3-compatible storage:

- `CATALOG_STORAGE_ENDPOINT`
- `CATALOG_STORAGE_BUCKET`
- `CATALOG_STORAGE_REGION`
- `CATALOG_STORAGE_ACCESS_KEY`
- `CATALOG_STORAGE_SECRET_KEY`
- `CATALOG_STORAGE_PUBLIC_BASE_URL`

The public base URL must serve the bucket's object-key root. Configure bucket CORS for the web application's origin and the headers returned by the signing API. JPEG, PNG and WebP uploads are bounded to 5 MiB. Signing binds the exact file, receipt, media type and length; conditional writes prevent overwrites. Confirmation verifies object metadata and bounded bytes/checksum, ownership and expiry, and is safely repeatable. Redirects are not followed. Unconfigured storage fails closed; verified image URL authoring remains available. No real bucket or provider settings were changed during implementation.

## Verification and release boundaries

Execution results belong in `IMPLEMENTATION-TRACKER.md`. Component/API tests cover staff permissions and deep links, dashboard/error states, pagination boundaries, stock conflicts/idempotency, draft/publication, GST, staff safeguards/session revocation, policy snapshots, promotions and uploads. The integration suite uses a separate local PostgreSQL database.

Real carrier booking/labels/reverse pickup, real Razorpay acceptance, invoice/credit-note document output, seller/finance/tax acceptance, privacy/retention decisions, production security/MFA/rate limits, outbox operations, deployment and backup-restore evidence remain production release gates. Building the administration modules does not close these external or operational gates.
