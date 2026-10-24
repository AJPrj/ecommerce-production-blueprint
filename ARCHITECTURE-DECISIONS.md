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
