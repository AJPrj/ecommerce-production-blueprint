# PART I — Product Requirements

## 1. Product vision

Build a production-grade ecommerce platform that combines a high-conversion customer shopping experience with a secure business operations platform.

The product is not a collection of pages. It is a transaction system whose core responsibilities are:

- Discover products
- Maintain accurate catalog information
- Maintain inventory
- Calculate prices, discounts, shipping and tax
- Accept and reconcile payments
- Create and fulfill orders
- Track shipments
- Process returns/refunds
- Communicate status changes
- Provide business reporting
- Maintain security, auditability and operational control

## 2. User types

### Customer

Can browse, search, register/login, manage profile and addresses, maintain wishlist/cart, checkout, pay, view orders, track delivery, request returns/refunds, review products and contact support.

### Guest

Can browse and optionally checkout as guest if the business policy allows it. Guest orders must still have a durable order identity and secure access mechanism.

### Business Administrator

Full administrative access subject to authorization policy.

### Operations Manager

Catalog, inventory, fulfillment and operational order actions.

### Customer Support

Customer/order visibility and support workflows, with sensitive financial/destructive actions restricted.

### Finance

Payments, refunds, tax reports, reconciliation and financial exports.

### Reporting/Read-only User

Can view approved reports without mutation permissions.

## 3. Customer capabilities

### Discovery

- Homepage/storefront
- Categories and subcategories
- Product listing
- Search
- Search suggestions
- Filtering
- Sorting
- Product comparison where useful
- Recently viewed
- Recommendations
- Promotions

### Product

- Gallery
- Zoom
- Variants
- Price
- Sale price
- Availability
- Ratings/reviews
- Specifications
- Shipping information
- Return policy
- Related products
- Frequently bought together

### Cart

- Add/remove/update quantity
- Save for later
- Coupon
- Shipping estimate
- Tax estimate
- Price-change handling
- Stock-change handling
- Persistent cart for authenticated users

### Checkout

- Customer information
- Address
- Delivery method
- Tax
- Discounts
- Payment
- Review
- Order creation
- Confirmation

Checkout must be resumable where practical and must tolerate browser refreshes, network retries and payment redirects.

### Orders

- Order history
- Order detail
- Invoice
- Cancellation where eligible
- Tracking
- Buy again
- Return/refund request

### Account

- Profile
- Email/phone
- Password/security
- Addresses
- Preferences
- Notifications
- Privacy controls

## 4. Admin capabilities

### Dashboard

Meaningful KPIs:

- Gross/net sales
- Orders
- Average order value
- Customers
- Refunds
- Pending fulfillment
- Low inventory
- Payment failures

Metrics must define exactly what they mean. For example, revenue should not ambiguously mix authorized, captured, refunded and cancelled transactions.

### Catalog

- Products
- Variants
- Images
- Categories
- Brands
- Attributes
- SEO
- Draft/published/archive lifecycle

### Inventory

- On-hand
- Reserved
- Available
- Reorder level
- Adjustments
- Movement history
- Reservation visibility
- Inventory audit

### Orders

- Search/filter
- Order details
- Status transitions
- Fulfillment
- Shipment
- Internal notes
- Cancellation
- Return
- Refund

### Customers

- Search
- Profile
- Orders
- Returns
- Support
- Account status
- Privacy/data actions

### Marketing

- Coupons
- Promotions
- Product/category targeting
- Eligibility
- Usage limits
- Scheduling

### Finance

- Payment transactions
- Payment attempts
- Refunds
- Reconciliation
- Tax reports
- Invoice access

### Reporting

- Sales
- Orders
- Product performance
- Inventory
- Customers
- Refunds
- Tax
- Operational reports
- CSV/export jobs

Heavy reports should be asynchronous and return a job reference rather than blocking a request.

## 5. India/GST readiness

The platform should support configurable Indian tax workflows rather than hardcoding today's rates.

Model:

- Business GSTIN
- Customer GSTIN where applicable
- HSN/SAC
- Place of supply
- Supply state
- Seller state
- CGST
- SGST/UTGST
- IGST
- Tax-inclusive/exclusive pricing
- Tax exemptions where applicable
- Tax invoice numbering
- Credit/debit notes
- Tax reporting
- Configurable effective dates

Tax rules must be versioned/effective-dated. Do not embed tax rates directly into application logic.

Actual tax/legal configuration should be validated with the business's tax/finance advisor before production.

## 6. Business invariants

The following must always be true:

1. Order totals are calculated by the backend.
2. Payment amount must match the authorized order/payment intent.
3. An order cannot be marked paid solely because the client says so.
4. Inventory cannot become negative unless an explicitly approved oversell policy exists.
5. Reserved stock cannot exceed on-hand stock.
6. A successful payment webhook cannot create two orders.
7. A refund cannot exceed refundable captured amount.
8. A cancelled order cannot silently return to fulfillment.
9. A published product must satisfy publication validation.
10. A coupon cannot be used outside its effective period or eligibility rules.
11. Commercial order data is immutable after confirmation except through controlled adjustment workflows.
12. Every privileged mutation is attributable to an actor.

## 7. Non-functional requirements

### Availability

Target initial production SLO:

- 99.9% monthly availability for core APIs, excluding planned maintenance within policy.

### Performance

Initial targets:

- Product listing p95 < 500 ms under expected load
- Product detail p95 < 400 ms
- Cart operations p95 < 500 ms
- Order placement p95 < 1.5 s excluding third-party payment redirect/processing
- Search p95 < 500 ms
- Background jobs have explicit processing SLOs

These are starting targets and must be validated with load testing.

### Security

- OWASP-aligned controls
- Strong authentication
- Least privilege
- Secure sessions/tokens
- Rate limiting
- Auditability
- Secrets management
- Encryption in transit and at rest

### Scalability

Design for:

- Thousands to millions of products
- Large order history
- High read traffic
- Traffic spikes during promotions
- Concurrent checkout
- Large report datasets

## 8. Product lifecycle

Recommended lifecycle:

`DRAFT -> ACTIVE -> ARCHIVED`

Orders:

`PENDING_PAYMENT -> PAID -> CONFIRMED -> PROCESSING -> PACKED -> SHIPPED -> DELIVERED`

With explicit exception states for:

- Payment failed
- Cancelled
- Delivery failed
- Return/refund
- Partial fulfillment

Do not let arbitrary clients set statuses. State transitions belong to domain services.
