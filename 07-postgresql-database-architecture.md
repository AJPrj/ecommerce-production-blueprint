# PART VII — PostgreSQL Database Architecture

## 1. Database principles

Use PostgreSQL 16+ as the system of record.

Requirements:

- Strong FK integrity
- NOT NULL where required
- CHECK constraints
- Unique constraints
- Carefully designed indexes
- Transactional consistency
- Explicit ownership of data
- Migration discipline
- Backup/PITR
- Query observability

## 2. Identifier strategy

Recommended:

- PostgreSQL `uuid` public identifiers
- Application-generated UUIDv7 where supported by the application stack
- Do not expose sequential internal identifiers where enumeration is a concern

If UUIDv7 generation is unavailable, use secure UUID generation and revisit ordering/index strategy based on measured workload.

## 3. Common columns

Most mutable business tables:

```text
id uuid primary key
created_at timestamptz not null
updated_at timestamptz not null
version bigint not null default 0
```

Use optimistic locking where appropriate.

Do not add soft delete to every table automatically.

Transactional records such as payments, order events and audit records should normally be retained rather than silently deleted.

## 4. Core tables

### Identity

```text
users
roles
permissions
user_roles
role_permissions
user_sessions
email_verification_tokens
password_reset_tokens
```

The implemented customer recovery schema is added by `V48` as
`customer_password_resets`: one hashed, expiring token per user, bound to the
current authorization version. `password_reset_throttles` uses bounded hashed
slots for shared request limits. No raw reset token or email payload is stored
in PostgreSQL. See [Customer password recovery](PASSWORD-RECOVERY.md).

### Customer

```text
customer_profiles
addresses
customer_addresses
customer_preferences
```

### Catalog

```text
categories
brands
products
product_variants
product_images
attributes
attribute_values
product_variant_attributes
homepage_configuration
homepage_product_selections
```

V45 adds the singleton homepage version and ordered featured/special references.
Section/position and section/product uniqueness prevent duplicates; positions
are bounded to 0-39. Saves advance the expected version, replace selections and
append audit in one transaction. Retained soft-deleted products remain references
that are omitted publicly. A partial delivered-shipment timestamp index supports
the 90-day bestseller query; return allocations and payment/collection ledgers
remain the source for net units. See [Homepage merchandising](HOMEPAGE-MERCHANDISING.md).

### Inventory

```text
inventory
inventory_reservations
inventory_movements
```

### Commerce

```text
carts
cart_items
wishlists
wishlist_items
orders
order_items
order_addresses
order_status_history
```

### Payments

```text
payments
payment_attempts
payment_transactions
payment_webhooks
refunds
```

### Shipping

```text
shipping_zones
shipping_methods
shipping_rates
shipments
shipment_items
shipment_tracking_events
```

### Promotions

```text
coupons
coupon_rules
coupon_usage
promotions
promotion_products
promotion_categories
```

### Tax

```text
tax_categories
tax_rates
tax_rules
tax_rule_versions
tax_invoices
tax_invoice_lines
credit_notes
debit_notes
```

### Returns

```text
returns
return_items
return_status_history
return_evidence
```

### Reviews/communications

```text
reviews
review_images
notifications
notification_deliveries
support_tickets
support_messages
```

### Operations

```text
audit_logs
idempotency_keys
outbox_events
job_executions
report_jobs
file_assets
```

## 5. Order schema principles

`orders` should store:

- customer_id
- order_number
- currency
- subtotal
- discount_total
- shipping_total
- tax_total
- grand_total
- payment_status
- fulfillment_status
- order_status
- placed_at
- version

`order_items` should store immutable snapshots:

- product_id
- variant_id
- SKU
- product name
- variant description
- unit price
- quantity
- discount
- taxable amount
- tax amount
- total

Do not reconstruct historical invoices from today's product table.

## 6. Address snapshots

Orders should contain dedicated `order_addresses`.

Never depend on the customer's current address to render an old invoice.

## 7. Money

Never use floating point.

Recommended:

```text
numeric(19,4)
```

or a carefully defined integer-minor-unit model.

Every monetary value needs an associated currency context.

Tax calculation may require higher precision internally before final rounding.

## 8. Tax storage

Store tax component snapshots such as:

```text
taxable_amount
cgst_amount
sgst_amount
igst_amount
other_tax_amount
total_tax
tax_rate_snapshot
hsn_sac_snapshot
place_of_supply_snapshot
```

Do not calculate historical tax from current tax tables.

## 9. Inventory schema

`inventory`:

```text
product_variant_id unique
on_hand_quantity
reserved_quantity
reorder_level
version
```

`inventory_movements`:

```text
variant_id
quantity_delta
movement_type
reference_type
reference_id
reason
actor_id
created_at
```

`inventory_reservations`:

```text
variant_id
order_id
quantity
status
expires_at
created_at
```

Use constraints to prevent invalid quantities.

## 10. Critical indexes

Examples:

```sql
CREATE INDEX idx_orders_customer_created
ON orders(customer_id, created_at DESC);

CREATE INDEX idx_orders_created
ON orders(created_at DESC);

CREATE INDEX idx_order_items_order
ON order_items(order_id);

CREATE INDEX idx_products_category
ON products(category_id);

CREATE INDEX idx_inventory_variant
ON inventory(product_variant_id);

CREATE INDEX idx_inventory_movements_variant_created
ON inventory_movements(product_variant_id, created_at DESC);
```

Add indexes from real query plans, not from guesswork.

## 11. Search indexes

For PostgreSQL-based search, evaluate:

- `tsvector` full-text search
- `pg_trgm` similarity/search
- GIN indexes

Example conceptual design:

```text
search_vector tsvector
```

with a GIN index.

Move to a dedicated search engine only when search relevance/scale requires it.

## 12. Constraints

Examples:

- SKU unique
- Product slug unique
- Category slug unique within store scope
- Coupon code unique within applicable scope
- Quantity > 0
- Monetary values >= 0 where appropriate
- Tax rate >= 0
- Reserved quantity >= 0
- On-hand quantity >= 0 unless oversell policy exists

## 13. Multi-store/tenant readiness

If the business will become multi-store/SaaS, introduce:

```text
stores
```

and scope relevant records by `store_id`.

Do not retrofit tenant isolation after production data exists.

If this is definitely a single-store application, the architecture can still preserve domain boundaries without forcing multi-tenancy everywhere.

## 14. JPA strategy

- Avoid exposing entities through APIs
- Avoid N+1 queries
- Use projections for list pages
- Use batch operations where appropriate
- Use explicit fetch strategies
- Use `@Version` for optimistic locking
- Keep transactions narrow
- Review generated SQL

Native SQL is allowed when it is the right tool for specialized reporting/performance, but it must be parameterized and reviewed. Do not ban it as a security mechanism; parameterization and authorization are the actual controls.

## 15. Migration strategy

Use Flyway.

Rules:

- Forward-only migrations
- Small migrations
- Expand/contract
- Backward-compatible releases
- No destructive migration in the same release as application dependency removal

For a column removal:

1. Stop writing
2. Deploy code that no longer reads
3. Verify
4. Remove column later

This preserves the compatibility principle from the existing specification. fileciteturn3file1L1619-L1629

## 16. Partitioning

Do not partition everything.

Candidates at large scale:

- audit_logs
- event histories
- payment webhooks
- tracking events

Partition only after workload/data volume justifies it.

## 17. Connection management

Use HikariCP.

Do not blindly choose pool size from a formula. Size it based on:

- DB CPU
- Query latency
- concurrent transactions
- application instances
- PostgreSQL max connections

The previous hardening document proposes HikariCP and indexing as production controls; this blueprint keeps those controls but requires capacity-based tuning rather than a universal formula. fileciteturn3file1L1588-L1593
