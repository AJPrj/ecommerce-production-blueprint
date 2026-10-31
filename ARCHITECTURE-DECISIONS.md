# Key Architecture Decisions

## 1. Modular monolith first
Chosen to preserve transactional simplicity and reduce operational overhead. Domain boundaries remain explicit so services can be extracted later.

## 2. PostgreSQL is the source of truth
Orders, inventory, payments, tax snapshots, audit and other business-critical state live in PostgreSQL.

## 3. Redis is supporting infrastructure
Used for caching/rate limiting/short-lived coordination, never as the sole source of business truth.

## 4. Transactional outbox
Used for reliable delivery of side effects after database commits.

## 5. Server-authoritative commerce
The server calculates price, discount, tax, shipping and inventory availability.

## 6. Immutable commercial snapshots
Orders retain product, price, tax and address snapshots so historical documents remain correct.

## 7. Durable idempotency
Critical commands are safe to retry.

## 8. Explicit state machines
Orders, payments, returns and shipments cannot be mutated into arbitrary states.

## 9. Compatibility-first database changes
Schema changes follow expand/contract and support overlapping application versions.

## 10. Measure before distributing
Read replicas, search clusters, partitioning and microservices are introduced based on measured bottlenecks and operational requirements.

## 11. Record commercial rules and provisional assumptions
The current Kerala dispatch, GST-inclusive price, shipping, rounding, invoice, credit-note, cancellation, and return decisions are recorded in [COMMERCE-DECISIONS.md](COMMERCE-DECISIONS.md). Its development defaults are not production tax approval; synthetic GST data stays isolated in the demo database.

## 12. PostgreSQL catalog images for small deployments

The owner approved PostgreSQL image storage when S3 is absent for a shop of approximately 100 products on Railway or a VPS. New uploads use a separate bounded binary media table, server image validation/optimization, stable image URLs and HTTP caching; ordinary product responses contain only references. `AUTO` chooses database storage only when S3 settings are entirely absent. Explicit `DATABASE`/`S3` modes are supported, and S3 request failures never trigger a silent storage switch. Existing image URLs remain compatible. Database capacity/backups include media; automatic orphan cleanup and migration of existing bytes to S3 are separate work. Publication now requires description/image, effective GST classification and complete positive shipping measurements while retaining incomplete drafts.

## 13. Explicit variant choice and per-SKU shipping measurements

Multi-variant products require a customer choice before purchase, and catalog
cards offer an inline chooser using compact batched variant/price/stock projections.
Older responses without options route to the product page for selection. Each
variant of a multi-variant product must have its own complete unit measurements
and optional packaging weight/class. Product fallback is retained only for a
single SKU. Publication validates every persisted variant, and checkout rejects
missing multi-variant measurements. New orders snapshot complete
effective measurements so forward and return planning remain stable across
catalog changes. Legacy/incomplete order lines retain the established correction
and held-plan retry flow. Financial snapshots and created provider intent remain
immutable. V43 adds nullable JSONB overrides/snapshots without inventing values
for existing rows.

## 14. Server-selected homepage merchandising

PostgreSQL stores ordered, versioned featured/special selections, including backup
choices. A dedicated public catalog projection evaluates the whole eligible
catalog and returns up to four products per section. Bestsellers use net paid
delivered quantities over 90 days across variants, with verified shipment-level
COD collection and accepted return allocations. Current variant inventory and
effective compare-at discounts govern display and its maximum discount claim.
Unsaved Admin preview shares the same calculation without writing configuration.
No rating heuristic, first-page slicing, fixed discount claim or filler supplies
the landing sections. See [Homepage merchandising](HOMEPAGE-MERCHANDISING.md).

## 15. Customer recovery through existing SMTP

Customer password recovery reuses the configured SMTP provider with a dedicated
sender, a trusted frontend reset URL, hashed single-use PostgreSQL tokens and
authorization-version session revocation. Request throttles persist bounded
hashed slots across instances. A bounded asynchronous queue prevents SMTP timing
from revealing account existence. Short-lived recovery email is replaceable and
does not persist its bearer token in an outbox; restart or delivery failure
requires another request. This is a limited, explicit exception to durable
notification processing, leaving commercial order-email outbox behavior intact.
See [Customer password recovery](PASSWORD-RECOVERY.md) for contracts and setup.

## 16. Immutable customer tax documents

The initial single-seller B2C flow issues one final packing invoice from saved
unit commercial allocations, before courier handover. PostgreSQL atomically
stores the annual sequence, immutable snapshot, bounded PDF bytes/hash and
optional customer-email intent. This small-store storage choice avoids a
database/object-store dual write; backups include document bytes. Downloads and
resends use the archive. Source-linked full-unit credit notes preserve original
documents and remain separate from payment refunds. Issuance stays disabled
until actual seller identity, regular GST scheme, numbering and business
acceptance are supplied. See [Invoicing](INVOICING.md).
