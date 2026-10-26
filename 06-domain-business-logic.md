# PART VI — Domain & Business Logic

## 1. Core domains

- Identity
- Customer
- Catalog
- Pricing
- Inventory
- Cart
- Checkout
- Order
- Payment
- Shipping
- Promotion
- Tax
- Returns/Refunds
- Reviews
- Notification
- Reporting
- Audit

## 2. Catalog domain

### Product

Contains stable product-level information.

### Variant

Represents purchasable SKU-level identity.

A variant should own:

- SKU
- Price override
- Inventory identity
- Barcode where applicable
- Weight/dimensions
- Variant attributes
- Active state

Do not use product-level stock for a variant-driven catalog.

## 3. Pricing

Price calculation should be deterministic.

Input:

- Product/variant
- Quantity
- Customer context
- Currency
- Promotion
- Coupon
- Effective date

Output:

- Unit price
- Line discount
- Subtotal
- Shipping
- Tax
- Grand total

Store calculation snapshots on the order.

## 4. Coupon engine

Evaluate:

- Active period
- Customer eligibility
- Product/category applicability
- Minimum order value
- Maximum discount
- Usage limit
- Per-customer limit
- Stackability
- Currency
- Exclusions

Coupon validation is advisory until final order calculation.

## 5. Inventory

Maintain:

- On hand
- Reserved
- Available

Conceptually:

`available = on_hand - reserved`

Reservation flow:

```text
Requested
 -> Validate
 -> Lock inventory row
 -> Verify available quantity
 -> Increase reserved
 -> Create reservation
 -> Commit
```

On payment/order failure:

`reserved -> released`

On fulfillment:

`reserved -> consumed`

Every adjustment creates an inventory movement.

## 6. Cart

Cart is not an order.

At checkout:

- Re-read product state
- Re-read price
- Re-read promotions
- Recalculate tax
- Revalidate inventory
- Recalculate shipping

The browser's displayed total is never trusted.

## 7. Checkout

Checkout creates a short-lived commercial snapshot.

Recommended sequence:

```text
Cart
 -> Checkout validation
 -> Inventory validation
 -> Pricing calculation
 -> Tax calculation
 -> Shipping selection
 -> Payment intent
 -> Order creation
 -> Reservation
 -> Payment confirmation
 -> Fulfillment
```

Where gateway architecture supports asynchronous confirmation, order may remain `PENDING_PAYMENT` until a verified event confirms payment.

## 8. Order aggregate

Order should contain:

- Public order number
- Customer reference
- Currency
- Items
- Price snapshot
- Tax snapshot
- Discount snapshot
- Shipping snapshot
- Billing/shipping address snapshots
- Payment references
- Shipment references
- Status history

Order data should be commercially immutable after confirmation. Corrections should use explicit adjustment/refund workflows.

## 9. Payment state machine

Example:

```text
CREATED
 -> REQUIRES_ACTION
 -> AUTHORIZED
 -> CAPTURED
 -> PARTIALLY_REFUNDED
 -> REFUNDED
```

Failure states:

`FAILED`, `CANCELLED`, `EXPIRED`

Never transition payment to captured solely from a frontend callback.

## 10. Payment webhook processing

1. Verify signature
2. Parse provider event
3. Check provider event ID
4. Check whether already processed
5. Map provider state
6. Lock affected payment/order if required
7. Apply legal state transition
8. Persist event
9. Write outbox event
10. Return success

Duplicate webhook must be harmless.

## 11. Refunds

Rules:

- Refund <= captured amount - previously refunded amount
- Partial refund supported
- Refund reason recorded
- Actor recorded
- Gateway reference recorded
- Order/payment state updated transactionally
- Customer notification emitted asynchronously

## 12. Shipping

Model:

- Shipping zone
- Method
- Rate
- Shipment
- Package
- Carrier
- Tracking number
- Tracking event

Shipment lifecycle should be separate from order lifecycle.

One order may have multiple shipments.

## 13. Returns

Return eligibility depends on:

- Order state
- Delivery date
- Product policy
- Return window
- Product category
- Quantity already returned
- Previous refund

Return lifecycle:

`REQUESTED -> APPROVED -> PICKUP_SCHEDULED -> RECEIVED -> INSPECTED -> REFUND_PENDING -> REFUNDED`

Rejected path:

`REQUESTED -> REJECTED`

## 14. Tax

Tax engine inputs:

- Seller location
- Customer location
- Place of supply
- Product tax category
- HSN/SAC
- Tax-effective date
- Exemption
- Tax-inclusive/exclusive configuration

Output must preserve component breakdown.

For India-ready ecommerce, store tax snapshots on each order line so historical invoices do not change when future tax rules change.

## 15. Reviews

The implemented text-review lifecycle, ownership, moderation, aggregation and abuse controls
are specified in [Product descriptions and customer reviews](PRODUCT-DESCRIPTIONS-AND-REVIEWS.md).

Rules:

- Optional verified-purchase marker
- One or configurable number per product/order item
- Moderation lifecycle
- Rating aggregation
- Abuse controls
- Review image validation

## 16. Notifications

Events:

- Order placed
- Payment success/failure
- Shipment created
- Delivery
- Return approved/rejected
- Refund processed
- Low inventory
- New order
- System alerts

Delivery channels:

- In-app
- Email
- SMS/WhatsApp if legally and operationally appropriate

Notification delivery must be retryable.

## 17. Audit

Audit events should capture:

- Actor
- Action
- Resource type
- Resource ID
- Timestamp
- Outcome
- Request/correlation ID
- Before/after values where appropriate
- Source/IP metadata where policy permits

Never place secrets or payment credentials into audit payloads.

## 18. Domain events

Useful events:

```text
OrderPlaced
PaymentCaptured
PaymentFailed
InventoryReserved
InventoryReleased
OrderConfirmed
OrderShipped
OrderDelivered
ReturnRequested
ReturnApproved
RefundCompleted
ProductPublished
InventoryLow
```

Domain events become outbox messages when external delivery is required.
