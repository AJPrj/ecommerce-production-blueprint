# PART XVIII — Dedicated Admin Console Blueprint

**Status:** Proposed implementation specification, aligned with the repository blueprint and the implementation tracker dated 2026-10-10. **Scope:** Admin-only React experience and corresponding server-authorized workflows. **Source of truth for implementation state:** `IMPLEMENTATION-TRACKER.md` and `STAGE-2-OPERATIONS.md`; the presence of an item in this document does not mean it is implemented.

## 1. Goal and product boundaries

Build a **dedicated, production-grade administration console** for a single-seller e-commerce business, not a customer dashboard with an admin tab. It must let authorized staff run catalog, stock, sales, fulfillment, returns, refunds, finance, tax, reporting and configuration workflows. Every action must have a meaningful authorization and business-state check on the backend.

- Primary entry points: `/admin/login` for staff authentication, `/admin` for a role-aware landing page.
- Customer paths retain their own storefront shell. Do not show cart, wishlist, customer checkout or customer navigation in the admin shell.
- Follow the existing **React + TypeScript + React-Bootstrap + Bootstrap 5 + SASS tokens** direction. Start within the current frontend application, with a separate lazy-loaded admin route subtree; do not introduce a second backend or microservice solely for this UI.
- Reuse the Java 21/Spring Boot modular-monolith services and existing REST contracts. PostgreSQL is authoritative for money, inventory, payment, tax, audit, and orders; Redis is supporting infrastructure.
- A dedicated admin frontend deployment/domain may become useful later for isolation, but is **not** an initial prerequisite. Do not assume a separate React project, database, or identity store.
- Stage 0 development decisions: dispatch state Kerala (`32`), GST-inclusive catalog pricing, Razorpay online payments and COD as an independent method. These defaults are subject to business/tax approvals before production.

### What this document does not change

This specification does **not** relax the existing immutable-order-snapshot, idempotency, row-locking, audit, CSRF, role/permission, or state-machine rules. In particular, the admin UI cannot mark a payment captured, overwrite historical order totals, increase stock without a signed adjustment, skip return inspection, or force illegal shipment transitions.

## 2. Navigation and page inventory

### Admin shell

- **Desktop:** persistent collapsible left sidebar, top bar with current workspace, breadcrumb, authorized global search, notifications, current staff identity and logout; main content region with page title, filters and a primary contextual action.
- **Tablet/mobile:** navigation drawer, compact top bar, responsive tables/cards and accessible command menus. Preserve workflow completeness on narrow screens.
- Keep a visible **Back to store** link in the top bar on every admin page, including mobile and collapsed-sidebar layouts. It opens the storefront home (`/`) in the same tab and preserves the staff session.
- Show/hide navigation based on the authenticated actor's capabilities returned by the backend. Direct URL access must still receive an independently enforced `403` if permission is absent.
- Each page has a stable URL and reload-safe state. Keep filters, sorting, pagination and active tab in URL search params where appropriate, but never include secrets or customer PII.

| Nav group | Page | Proposed route | Purpose |
|---|---|---|---|
| Overview | Dashboard | `/admin` | KPIs, actionable queues, risk alerts |
| Catalog | Products | `/admin/products` | Search, filter, draft, edit, publish/archive, confirmed deletion that releases category links and retains commercial/inventory history |
| Catalog | Product editor | `/admin/products/new`, `/admin/products/:id/edit` | Structured product authoring and validation |
| Catalog | Categories, brands, attributes | `/admin/catalog/categories`, `/admin/catalog/brands`, `/admin/catalog/attributes` | Controlled catalog taxonomy |
| Stock | Inventory | `/admin/inventory` | On-hand, reserved, available, thresholds |
| Stock | Movements/reconciliation | `/admin/inventory/movements`, `/admin/inventory/reconciliation` | Auditable adjustments and discrepancy review |
| Commerce | Orders | `/admin/orders`, `/admin/orders/:number` | Search/detail; immutable order/payment snapshots |
| Commerce | Shipping / Fulfillment | `/admin/orders/:number#shipping-fulfillment` | Section inside each order; separately authorized package/provider/dispatch commands. `/admin/fulfillment` is a compatibility redirect, not a second sidebar entry. |
| Commerce | Returns | `/admin/returns`, `/admin/returns/:id` | Eligibility, decisions, receipt, inspection |
| Commerce | Refunds | `/admin/refunds` | Refund request/retry and payment-linked outcomes |
| Finance | Payments and exceptions | `/admin/payments` | Razorpay/COD view, failure and webhook-review queues |
| Finance | GST/Tax | `/admin/tax` | Tax category, HSN/SAC, effective dates, rule approval |
| Finance | Reports/reconciliation | `/admin/reports`, `/admin/reports/reconciliation` | Revenue and finance ledger comparison |
| Customers | Customer lookup | `/admin/customers`, `/admin/customers/:id` | Authorized support lookup only |
| Marketing | Promotions | `/admin/promotions`, `/admin/coupons` | Discount and eligibility configuration |
| Configuration | Business settings | `/admin/settings` | Shipping, return, supplier and policy configuration |
| Security | Staff and roles | `/admin/staff`, `/admin/roles` | Controlled identity administration |
| Security | Audit history | `/admin/audit` | Read-only privileged change history |

**Route labels above are the target UI information architecture, not assertions that corresponding UI pages or APIs are already available.** Preserve currently used `/admin/login` and `/admin/fulfillment` routes. Implement secondary pages only after verifying the real application repository and current router.

## 3. Admin dashboard — first page after staff login

Dashboard content should be **role-aware and actionable**. A finance user should not receive unauthorized customer-address data simply because it appears on a dashboard. A fulfillment user should see package queues, exceptions, and ready-to-dispatch totals rather than finance-only reconciliation details.

### Layout

1. Header: `Overview`, date range, last updated time, reload and relevant shortcut actions.
2. Summary cards: placed orders, orders needing attention, gross merchandise value, captured payments, refunds, low-stock SKUs and failed processing (shown only where permitted).
3. Sales trend: time-bucketed series, with transparent definition and prior-period comparison when supported.
4. Operational cards: payment mismatch queue, shipment exceptions, returns requiring inspection, pending refunds, stock mismatches.
5. Recent activity: last authorized orders, shipments, returns and admin events, each linked to details.
6. Environment/readiness banner for demo profiles or unfinished provider integrations; never label sandbox shipments, unapproved GST configuration or order confirmations as production-ready evidence.

### KPI definitions (must be finalized in a reporting contract)

| Metric | Working definition | Safety note |
|---|---|---|
| Orders placed | Orders created during selected interval, excluding test fixtures | Count from durable orders |
| Gross merchandise value | Sum of immutable merchandise line totals for orders in interval | Do not conflate with captured revenue |
| Captured payments | Successfully captured provider amounts in interval | Separate COD obligations and eventual collections |
| Net captured | Captured amounts less **confirmed** provider refunds within the defined window | Show time window and money-unit semantics |
| Pending fulfillment | Orders/allocations requiring authorized action | Include split-shipment remaining quantities |
| Low-stock SKUs | Variants where available quantity is at/below configured threshold | Available = on-hand minus active reservations |
| Payment exceptions | Outstanding durable reconciliation/webhook review records | Never infer capture from browser callbacks |
| Returns requiring action | Returns awaiting decision, receipt, inspection or refund retry | Keep stage-specific counts |

**Data contract:** Prefer one dedicated read-only aggregated endpoint such as **proposed** `GET /api/v1/admin/dashboard?from=...&to=...`, implemented only when existing read APIs cannot efficiently supply the data. Server enforces capabilities on each metric, bounded time ranges and pagination for details, and returns `asOf`, currency and exact metric definitions. Do not fetch all orders into React to compute financial totals. An unavailable KPI must show `Unavailable`, not a misleading zero.

## 4. Detailed page behavior

### 4.1 Products / catalog

- Product list: paginated server search, category/brand/status filters, SKU search, stock and publication indicators; open editor in dedicated route.
- Editor tabs: **General, Pricing, Tax, Inventory, Variants, Images, Shipping, SEO, Publication** (as defined in `02-ui-ux-design.md`).
- Save draft, preview, publish, archive; server rejects incomplete/invalid tax classifications and illegal operations. Surface `409` concurrent-edit conflicts with reload/compare guidance.
- Each sellable variant has a SKU and its own stock accounting. Image uploads use presigned object-storage URLs and server-side confirmation; track progress/failures.
- The owner-approved small-shop storage option also supports PostgreSQL uploads when S3 is absent, with a dedicated media table, image optimization, Admin-only upload/preview and cached public reads through active product references. S3 errors never silently change storage providers; see architecture decision 12.
- Publication requires name/category/SKU/positive price, description, primary image, active HSN/SAC classification with an effective GST rate, and positive unit weight plus all dimensions. Incomplete drafts may omit description/image/tax/shipping; zero stock remains valid. Missing-field summaries link to the appropriate editor sections.
- Publishing/archiving is an explicit audited command, not a client-side toggle.

### 4.2 Inventory

- Show on-hand, active reserved, available quantity, low-stock thresholds and history per variant.
- Adjustments require reason, actor, safe quantity rules and idempotency where necessary; append inventory movement records. Never allow manual editing of derived available quantity.
- Mismatch/reconciliation views present durable ledger differences for investigation; **never silently auto-repair** a discrepancy.
- If an allocation or concurrent checkout changed stock, return the backend conflict and refresh affected variant data.

### 4.3 Orders and fulfillment

- Orders list: server-side paginated order number/search/status/date filters; use separate **order**, **payment**, **shipment** states in the UI.
- Order detail: immutable line-price/GST/shipping/address snapshots, payment attempts, package allocations, tracking, return history, audit events and allowed actions.
- Preserve Stage 2 command workflow: prepare package with line quantities/dimensions; dispatch exactly once; show delayed/duplicate-carrier events as historical events, not invalid state transitions.
- Shipment lifecycle: `PREPARED -> DISPATCHED -> IN_TRANSIT -> DELIVERED`; exceptions require verified recovery, and only prepared packages may be cancelled.
- Cancelling a **prepared package** only frees its package allocation. It **does not** cancel the customer order or automatically refund/release its reservation.
- Real carrier booking, printing and reverse pickup are launch dependencies; sandbox `DEV-` references are not production labels.

### 4.4 Returns, inspection and refunds

- Return queue: filter by state and action required; show delivered package and policy snapshot for each requested item quantity.
- Approved path: `REQUESTED -> APPROVED -> PICKUP_SCHEDULED -> RECEIVED -> INSPECTED -> REFUND_PENDING -> REFUNDED` with documented alternative/rejection paths.
- Receipt moves inventory into **quarantine**. Inspection explicitly decides restock or rejection; rejected QC must not enable refund by accident.
- Refund amount cannot exceed return allocation/captured balance minus prior refunds. Keep original paid order total immutable; execute through existing Stage 1 provider-aware refund service using stable retry identifiers.
- COD returns cannot be represented as automatically refunded until collection verification and a verified manual payout flow exist. Show an actionable blocked state.

### 4.5 Payments, finance and GST

- Payment view: provider, safe references, amount/currency, attempts, verified capture status, webhook processing, reconciliation discrepancies and refund ledger. Do not show raw card data, full webhook payloads or secrets.
- GST setup: category + HSN/SAC, applicable effective-dated rates, seller state, inclusive-price policy, approval state and a representative quote preview for finance review.
- Development-only synthetic rates/HSN values remain isolated under `demo` profile; never publish or carry them into production catalog configuration.
- Initial policy currently assumes Kerala (`32`), GST-inclusive prices and ₹79 shipping below ₹1,499 merchandise subtotal, free otherwise. Shipping/GST proportional allocation and paise rounding are **provisional** and require tax-owner sign-off. See `COMMERCE-DECISIONS.md`.
- Production tax invoices and credit notes must not be exposed as generated/valid until seller identity, numbering, document output and approvals are available. Order confirmations are not tax invoices.
- Reporting must distinguish booked orders, captured online payments, COD collection, refunds, tax, and shipping. Financial statements should be derived from persisted ledger/snapshots rather than frontend estimates.

### 4.6 Customers, promotions, settings, staff and audit

- Customer views expose the **minimum necessary** fields for support; actions must be permission-filtered, paginated and logged. Respect customer privacy, retention and deletion decisions.
- Customer-email policy approved on 2026-10-24: `ADMIN` sees full email addresses in customer lists and records; `SUPPORT` sees masked emails by default. Staff with `customers.email.reveal` (the existing Admin/Support role grant) can explicitly reveal one customer's email through a CSRF-protected, audited request. Phone masking remains unchanged. Every successful reveal records the actor and customer reference without recording the customer's email; failed audit persistence prevents disclosure.
- Promotions/coupons have validity, eligibility, usage caps, stacking and preview validation; the backend re-evaluates at checkout.
- Settings changes (shipping, return windows/exclusions, tax-related defaults) need clear effectivity, reason and audit; **never retroactively rewrite** checkout order policy or tax snapshots.
- Staff management assigns capabilities through controlled identity administration, never self-service registration. Sensitive grants and revoked sessions must propagate correctly.
- Audit log is append-only to normal application users; filter by actor, action, resource and time, with safe redaction.

## 5. Roles and permissions

Role names and currently implemented Stage 2 grants come from `STAGE-2-OPERATIONS.md`; the wider matrix below is a **proposed** extension for pages not yet covered by executable contracts. Use granular backend permission names and deny-by-default; do not treat visible menu items as authorization.

| Capability | Admin | Fulfillment | Returns | Refunds | Support | Finance | Reporting |
|---|---|---|---|---|---|---|---|
| Operations order queue/detail | Yes | Yes | Yes | Yes | Yes | No | No |
| Prepare/dispatch package | Yes | Yes | No | No | No | No | No |
| Return queue (read) | Yes | Yes | Yes | Yes | Yes | No | No |
| Return decision / receipt / inspection | Yes | No | Yes | No | No | No | No |
| Request/retry refund | Yes | No | No | Yes | No | No | No |
| Operations reconciliation | Yes | No | No | No | No | Yes | Yes |
| Catalog editing / publishing | Yes | No | No | No | No | No | No |
| Tax configuration approval | Yes | No | No | No | No | No | No |
| Staff roles/settings changes | Yes | No | No | No | No | No | No |

No generic “all orders” API should leak shipping-address fields to Finance/Reporting. Add separate constrained finance projections where needed. All role exceptions must be explicitly documented and integration-tested.

## 6. API wiring: documented versus proposed

The general contract in `05-rest-api-design.md` enumerates an admin API surface, but that list is a **design contract**, not proof every endpoint is implemented. The Stage 2 paths below have stronger implementation/test evidence in the tracker. Before coding, inspect the application repo's controllers and generated OpenAPI.

| UI feature | API contract | Evidence or implementation guidance |
|---|---|---|
| Product list/editor | `GET/POST /api/v1/admin/products`, `GET/PATCH /api/v1/admin/products/{id}` | Blueprint contract; verify implementation |
| Product publication | `POST /api/v1/admin/products/{id}/publish` and `/archive` | Blueprint contract; verify implementation |
| Generic order list | `GET /api/v1/admin/orders` | Blueprint contract; verify implementation |
| Staff operations orders | `GET /api/v1/admin/operations/orders[/{number}]` | Stage 2 documented development workflow |
| Create shipment | `POST /api/v1/admin/operations/shipments` | Stage 2 documented workflow; `Idempotency-Key` |
| Shipment commands | `POST /api/v1/admin/operations/shipments/{id}/commands` | Stage 2 state-validated dispatch/recover/cancel |
| Return queue/commands | `GET /api/v1/admin/operations/returns`, `POST /api/v1/admin/operations/returns/{id}/commands` | Stage 2 roles/state validation |
| Return inspection | `POST /api/v1/admin/operations/returns/{id}/inspection` | Stage 2 quarantined restock workflow |
| Refund requests | `POST /api/v1/admin/operations/returns/{id}/refund` | Stage 2 durable refund path |
| Financial reconciliation | `GET /api/v1/admin/operations/reconciliation` | Stage 2 bounded read; role-constrained |
| Inventory adjustment | `POST /api/v1/admin/inventory/adjustments` | General blueprint contract; verify specific handler |
| Customer lookup | `GET /api/v1/admin/customers[/{id}]` | Admin full email / Support masked email, additive `emailMasked` flag; masked phone; audited reads; `Cache-Control: no-store` |
| Reveal customer email | `POST /api/v1/admin/customers/{id}/reveal-email` | `customers.email.reveal`, CSRF; `{email}` response after transactional `CUSTOMER_EMAIL_REVEALED` audit; `Cache-Control: no-store` |
| Dashboard aggregates | **Proposed** `GET /api/v1/admin/dashboard` | Only add after checking existing reporting APIs |
| Audit log listing | **Proposed** `GET /api/v1/admin/audit` | Design and authorize separately; no claim implemented |

All requests use the existing typed API client with credentials, request/correlation IDs, abort, normalization and bounded retry rules. Mutating browser calls carry an appropriate CSRF token; commands that can have external effects use durable idempotency. Do not retry non-idempotent mutations blindly.

## 7. Suggested React structure

Structure is **illustrative** and must be reconciled with actual frontend paths before implementation:

```text
frontend/src/
  app/
    routes/
      AdminRoutes.tsx             # lazy-loaded admin route tree
  features/
    admin/
      layout/
        AdminLayout.tsx
        AdminSidebar.tsx
        AdminTopbar.tsx
        AdminBreadcrumbs.tsx
      auth/
        AdminLoginPage.tsx
        AdminRouteGuard.tsx
        PermissionGate.tsx
      dashboard/
        AdminDashboardPage.tsx
        dashboardApi.ts
      products/
        ProductsPage.tsx
        ProductEditorPage.tsx
      inventory/
        InventoryPage.tsx
        InventoryReconciliationPage.tsx
      orders/
        AdminOrdersPage.tsx
        AdminOrderDetailPage.tsx
      fulfillment/
        FulfillmentPage.tsx
      returns/
        ReturnsPage.tsx
        ReturnDetailPage.tsx
      payments/
        PaymentsPage.tsx
      tax/
        TaxSettingsPage.tsx
      reports/
        ReportsPage.tsx
      settings/
        AdminSettingsPage.tsx
      shared/
        AdminDataTable.tsx
        CommandConfirmDialog.tsx
        StatusHistory.tsx
        AdminErrorState.tsx
```

- Route-split the admin bundle from the storefront and lazy-load heavy reporting/editor pages.
- Reuse existing design tokens, typed API functions, error boundaries, pagination, dialogs and loading feedback rather than creating duplicate abstractions.
- Use TanStack Query or the project's existing server-state library for backend data, invalidating affected queries after **confirmed** successful mutations. Never perform unsafe optimistic payment, inventory, shipment, order or refund transitions.
- Use React Hook Form with schema validation, dirty warnings and mapped backend field errors for editors.
- Avoid mixing operations-layer APIs with generic admin CRUD if they represent the same business action; prefer implemented state-machine commands.

## 8. Error, accessibility and loading UX

Every page handles `loading`, `empty`, `filtered empty`, `success`, `partial data`, `failure`, `permission denied` and `concurrent conflict` states.

| HTTP/state | Admin behavior |
|---|---|
| 400 / 422 | Show localized field errors and actionable validation summary |
| 401 | Redirect into staff re-authentication, preserving a safe relative return URL |
| 403 | Dedicated access-denied page; do not reveal protected record content |
| 404 | Helpful not-found state and back-to-queue link |
| 409 | Explain stale state, refresh records and preserve unsaved editor changes if safe |
| 429 | Explain rate limit; retry only after safe interval |
| 5xx / network | Stable error state with manual retry, request ID and safe support guidance |
| Submitted/processing | Show durable operation/reference and final observed state; never claim immediate completion |

Support keyboard navigation, visible focus, semantic landmarks, screen-reader status announcements, accessible confirmation dialogs, labels and non-color-only status indications (WCAG 2.1 AA or stronger current standard). Use responsive tables or card transformations without hiding business-critical actions.

## 9. Authentication, security and audit

- Admin route requires an authenticated staff session plus capability lookup. Use Spring Security authorization on **every** API endpoint; route guard is solely a client UX convenience.
- Prefer Secure/HttpOnly/SameSite cookies for applicable browser session design, CSRF protection for cookie-authenticated mutations, session rotation/revocation and login throttling.
- Enable MFA for staff where feasible; require stronger verification/approval for high-impact operations as business policy dictates.
- Staff role assignment cannot be requested from customer signup. Do not expose raw tokens in localStorage, URL, analytics, logs or browser components.
- Audit product publication, settings/tax approvals, inventory corrections, shipment actions, return decisions, refunds, identity changes and security events; persist actor, operation, reason, resource, timestamp, safe request ID and before/after metadata where allowed.
- Never log provider secrets, card details, payment credentials, full addresses or unnecessary PII. Preserve audit immutability and retention policy.
- Database transaction/state-machine validations remain responsible for exactly-once effects; admin UI disabled buttons are **not** a concurrency control.

## 10. Acceptance journeys (end-to-end)

**Journey A — Staff entry:** authorized staff opens `/admin/login`, signs in, sees only permitted navigation and dashboard modules, refreshes a deep admin URL, then logs out. Customer and unauthenticated users get `403` or re-auth flow, respectively. No staff self-registration path exists.

**Journey B — Catalog publish:** admin opens products, edits an existing draft, configures SKU variants and tax classification, validates images, previews and publishes. Reload shows persisted state. Missing required tax/category fields, concurrent edits or rejected uploads show actionable errors; mutation is audited.

**Journey C — Stock conflict:** stock staff inspects available/reserved numbers and submits a reasoned adjustment while checkout activity occurs. Backend serializes changes, preserves the invariant, emits movement history, and surfaces `409` with refreshed data when necessary.

**Journey D — Split shipment:** Fulfillment staff opens order queue, prepares two packages for separate quantities, dispatches one and retries after a lost response. Stock is consumed exactly once for dispatched quantities. A `DEV-` carrier reference in sandbox is clearly labeled as simulated.

**Journey E — Return/partial refund:** Returns staff approves a delivered package-line return, records receipt and inspection; Refunds staff requests a bounded online refund and safely retries a provider timeout. Confirmed refund transitions without rewriting original order totals. Failed QC and COD refund blockers are visible and enforceable.

**Journey F — Finance exception:** Finance staff can review bounded payment/refund reconciliation and safe reference details but cannot open an operations order page to read delivery addresses, issue unauthorized refunds or mutate payment capture state.

**Journey G — GST release gate:** admin configures finance-approved real GST classifications, views a server-generated representative breakdown and completes sign-off. Synthetic demo identifiers are visibly barred from production; missing seller GSTIN/invoice numbering blocks release claims.

**Journey H — Failure handling:** test `401`, `403`, `404`, `409`, `429`, `5xx`, offline, partial processing, duplicate commands, refresh/re-entry and very large paginated datasets in each relevant workflow.

## 11. Testing and release gates

- **Unit/component tests:** sidebar permission filtering, deep-link restoration, pagination/filter serialization, editor dirty tracking, error states and accessible navigation.
- **Mocked UI flows:** products publish, staff order queue, split-shipment commands, return inspection, refund timeout/retry, reconciliation read-only behavior, tax misconfiguration, network failure and loading.
- **Backend integration:** reject role escalation and IDOR, verify CSRF handling, illegal state transitions, idempotent command replay, refund limits, consistent order snapshot and transactional stock movements against PostgreSQL.
- **Security:** protected direct URLs, staff session revocation, unknown permissions, XSS sanitization, upload validation, race conditions, least-privilege projections and audit redaction.
- **Performance:** server-side page/filter/sort, bounded reports and date ranges, lazy routes, explicit timeouts, no unbounded dashboard aggregation and no unrestricted bulk exports.
- **Release readiness:** replace seeded development admin credentials, complete tax/finance and real-provider acceptance, production carrier adapter/recovery, privacy policy decisions, security review, monitoring and tested backup restore. No UI polish can waive these gates.

## 12. Practical delivery plan, mapped to existing progress

| Phase | Deliverable | Definition of done |
|---|---|---|
| A — Foundation | Distinct `/admin` shell and staff login/deep-link authorization | Routing, accessible sidebar, 401/403 states, logout and role-gated tests |
| B — Integrate existing workflows | Existing fulfillment, returns, payment and stock review screens under one navigation | Real API-backed data, no duplicate state logic, audited command flows |
| C — Catalog and commerce | Product editor, inventory, orders, GST administration | Verify each API; handle drafts, conflicts, approvals and relevant audits |
| D — Dashboard and reporting | Capability-filtered KPIs, alerts and finance views | Definitions match backend queries/ledger, bounded queries, tested role projections |
| E — Broader administration | Customers, promotions, roles, settings, audit and notification views | Least privilege, publication/approval flows, privacy rules and E2E journeys |
| F — Production sign-off | Operations, provider, security, finance, tax and DR gates | Evidence and sign-off recorded in `IMPLEMENTATION-TRACKER.md` |

**Do not assume phases B or C need fresh services:** `IMPLEMENTATION-TRACKER.md` reports some of these workflows already implemented and tested as of 2026-10-11, although production acceptance remains open. Verify actual controller/frontend coverage first and prioritize composition over duplication.

## 13. Links to existing source-of-truth documents

- [00-README.md](00-README.md) — technology baseline and architecture position.
- [01-product-requirements.md](01-product-requirements.md) — business requirements.
- [02-ui-ux-design.md](02-ui-ux-design.md) — design tokens, admin screens, editor and tables.
- [03-frontend-architecture.md](03-frontend-architecture.md) — React structure, typed API client and route splitting.
- [05-rest-api-design.md](05-rest-api-design.md) — general REST contract and admin endpoints.
- [06-domain-business-logic.md](06-domain-business-logic.md) — domain transitions and invariants.
- [07-postgresql-database-architecture.md](07-postgresql-database-architecture.md) — persistent model.
- [08-security.md](08-security.md) — staff/session, authorization and auditing.
- [COMMERCE-DECISIONS.md](COMMERCE-DECISIONS.md) — recorded development defaults and missing approvals.
- [STAGE-2-OPERATIONS.md](STAGE-2-OPERATIONS.md) — actual staff roles, live operations contracts, states and limitations.
- [IMPLEMENTATION-TRACKER.md](IMPLEMENTATION-TRACKER.md) — authoritative implementation/evidence status.
- [17-implementation-roadmap.md](17-implementation-roadmap.md) — release sequence and gates.

---

**Implementation instruction:** Build this Admin Console on top of the existing storefront project's React frontend and Spring Boot modular monolith. Before adding a route, page, endpoint or database table, inspect existing application code and migrations. Reuse implemented workflows; add only verified gaps; preserve deployed API/migration compatibility and require backend authorization, audit, state validation and tests for every administrative mutation.
