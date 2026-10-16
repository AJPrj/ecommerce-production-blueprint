# Admin promotions and coupon implementation

The web console exposes automatic promotions at `/admin/promotions` and coupon rules at `/admin/coupons`. Both pages require the server's Admin-only `promotions.write` capability. Rule changes persist in PostgreSQL through migration `V27__promotion_rules_and_order_usage.sql`, require a reason and current version, and append privileged audit events. Concurrent edits return `409` while the editor preserves unsaved fields.

Supported rules have an active period, INR fixed or percentage discount, minimum merchandise subtotal, optional maximum discount, total and per-customer usage caps, selected customers, product/category inclusions, and product/category exclusions. Empty inclusion lists mean all merchandise; selected product and category inclusions are combined with OR. Exclusions take precedence. Percentage values cannot exceed 100%; discount allocation never exceeds the eligible merchandise amount.

The initial stacking policy is explicit and enforced: one offer per order. An eligible customer-selected coupon replaces automatic offers. Without a coupon, the engine selects the greatest eligible automatic discount, with stable rule-ID ordering for ties. Stackable rules are rejected. At most 200 rules may be active to bound checkout evaluation. Broader combinations require an approved policy and a different tested contract.

Usage is recorded once when an order is placed, including unpaid online orders. Cancelled and expired orders retain their usage history; the current implementation does not automatically restore coupon usage. This conservative policy prevents quota reuse through cancellation and needs business acceptance alongside other commercial defaults.

## Implemented API contracts

- `GET /api/v1/admin/promotions?kind=AUTOMATIC|COUPON&page=0&limit=25&search=...`: bounded Admin-only listing, including durable usage counts.
- `GET /api/v1/admin/promotions/{id}`: saved rule for reload-safe editing.
- `POST /api/v1/admin/promotions` and `PUT /api/v1/admin/promotions/{id}`: validated, audited configuration; update requires the saved `version`.
- `POST /api/v1/admin/promotions/{id}/preview`: saved-rule validation against server-priced variant quantities and an optional customer. Preview is advisory, consumes no usage, and excludes delivery and GST.
- Authenticated `GET`, `POST`, and `DELETE /api/v1/cart/coupon`: read, validate/select, or remove a session coupon. Browser mutations use the existing CSRF client.
- `POST /api/v1/checkout/quote` and `/api/v1/checkout` accept an optional `couponCode`; absent codes use the selected session coupon. A quote returns `discountTotal`, `promotionName`, `couponCode`, and per-line `discountAmount` in addition to the existing totals.

Final checkout locks inventory in variant order and promotion rules in rule-ID order, then re-reads usage counts after acquiring the rule locks. It recomputes eligibility, prices, discounts and GST, and rejects a changed quote before order, usage, or stock writes. Usage and order/reservation writes share the transaction. Replayed checkout commands retain one saved order and one promotion usage row.

Order subtotal retains the original merchandise subtotal. Each line retains the original unit price, a separate discount amount, and the net paid line total. GST is recalculated on that net amount, so existing cancellation and return allocation uses discounted paid values. Delivery threshold and proportional delivery allocation use the original merchandise subtotal, preserving the configured shipping basis. Historical discounts and tax snapshots stay unchanged after rule edits.

Zero-value orders cannot be sent to online payment. Checkout rejects that payment choice before recording the order, usage, or reservation and tells the customer to select the supported COD path or remove the offer. The customer confirmation includes the persisted discount separately from subtotal, GST and delivery.

## Verification added

`PromotionIntegrationTest` covers Admin/CSRF enforcement, version conflicts and audit, eligibility/exclusions/caps, GST after discounts, unchanged order snapshots, replayed usage, concurrent final-use competition across independent inventory rows, stale-quote rollback, best automatic selection, explicit coupon precedence, minimum spend, validity, currency, stacking rejection, and zero-value online rejection before writes. Frontend tests cover editor confirmation/conflict recovery, permissions, saved-rule preview, rejected coupons, and checkout retry keys across coupon changes.

Execution results and remaining business/production acceptance belong in `IMPLEMENTATION-TRACKER.md`. These contracts do not establish real payment, carrier, invoice, finance, tax, or production deployment approval.
