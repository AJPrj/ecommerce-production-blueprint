# Commerce Admin — Dashboard design notes

This is a visual concept for the dedicated admin console described by `18-admin-console-blueprint.md` in `AJPrj/ecommerce-production-blueprint`.

## Visual language

- Distinct, dark sidebar shell for staff-only operations, separated from the storefront.
- Neutral content canvas, compact mint/teal emphasis, restrained warning tones, readable typography and white action cards.
- Mobile adapts to a navigation drawer, 2-column metrics and card-style order rows.
- Dashboard includes KPIs, trend exploration, actionable exception queues, recent orders, low-stock alerts, and production-readiness notes.

## Quick preview

Open `admin-dashboard-preview.html` in a normal browser. Everything is static/demo; there is no live API or authentication. The following controls work inside the illustration: period selection, section navigation placeholders, order search, notifications, refresh demo status, CSV export of sample orders, and mobile navigation drawer.

## Real application integration

- Place the React component under your existing `frontend/src/features/admin/dashboard/` structure, with your current React Router staff route guard.
- Keep the modular monolith. Reuse the current Stage 2 operations endpoints for fulfillment, returns, refunds and finance reconciliation. Consult OpenAPI and implemented controllers before adding anything.
- Dashboard reads should be role-scoped, bounded and aggregated on the server. `GET /api/v1/admin/dashboard?period=7d` is a **proposed** API only. Do not assume it exists.
- Display separate GMV, online captures and COD exposure; never imply a browser dashboard can mark payments paid or adjust inventory directly.
- Server-side Spring Security role/permission checks are mandatory; filtered nav is only a UX convenience. Read models should be least-privilege and avoid unnecessary customer PII.
- Sample values are fictitious and cannot prove production tax, payment, shipping or accounting readiness.

## Important limitations

- The HTML prototype does not perform actual admin actions. Navigation beyond overview is a conceptual placeholder.
- React starter is intentionally API-neutral; it has typed props and a demo fixture, not a production implementation or verified build in the actual application repository.
- The example dates and samples are illustrative. Financial metric definitions, prior-period comparisons, and rollups must be agreed upon in a server reporting contract.
- Production shipment integrations, GST approvals, invoice documents and real Razorpay Test Mode evidence are separate launch gates in the implementation tracker.
