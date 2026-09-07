# PART IV — Backend Architecture

## 1. Architecture decision

Use a **modular monolith** with strong domain boundaries.

This provides:

- One deployable unit
- One primary transactional database
- ACID transactions across core workflows
- Easier local development
- Lower operational complexity
- Clear path to future service extraction

Do not split into microservices until there is a concrete reason.

## 2. Suggested module structure

```text
com.company.ecommerce
├── common
├── identity
├── customer
├── catalog
├── pricing
├── inventory
├── cart
├── checkout
├── order
├── payment
├── shipping
├── promotion
├── tax
├── returnrefund
├── review
├── notification
├── reporting
├── file
├── support
├── audit
├── integration
└── application
```

Each module should have:

```text
api/
application/
domain/
persistence/
integration/
```

Keep controllers thin. Business rules belong in application/domain services.

## 3. Layer responsibilities

### API

- HTTP mapping
- DTOs
- Authentication context
- Validation
- Response codes

### Application

- Use cases
- Transaction boundaries
- Orchestration
- Authorization checks
- Idempotency

### Domain

- Invariants
- State transitions
- Value objects
- Business policies

### Persistence

- JPA entities/repositories
- Query projections
- Locking
- Transactional persistence

### Integration

- Payment gateway
- Shipping provider
- Email/SMS
- Object storage
- Tax/e-invoice services

## 4. DTO discipline

Never expose JPA entities directly from REST APIs.

Use:

- Request DTO
- Response DTO
- Command/query objects
- Mapping layer

Prevent accidental exposure of:

- Password hashes
- Internal identifiers
- Audit fields
- Sensitive payment data
- Internal integration payloads

## 5. Transactions

Transactions should be defined around business invariants.

Example order placement transaction:

1. Validate checkout snapshot
2. Lock/validate inventory
3. Recalculate authoritative pricing
4. Calculate tax
5. Create order
6. Create order items/snapshots
7. Reserve inventory
8. Persist payment intent reference
9. Persist outbox event
10. Commit

Do not hold a DB transaction open while waiting for a slow external payment API unless the provider's protocol specifically requires it.

Prefer payment-intent creation followed by a controlled state machine.

## 6. Concurrency

Use optimistic locking for mutable aggregates where suitable.

Use row-level locking for inventory reservation/critical counters.

Example:

```sql
SELECT ...
FROM inventory
WHERE product_variant_id = ?
FOR UPDATE;
```

Then validate availability and update in the same transaction.

## 7. State machines

Implement explicit transition rules.

Example order:

```text
PENDING_PAYMENT
  -> PAID
  -> CANCELLED

PAID
  -> CONFIRMED
  -> CANCELLED

CONFIRMED
  -> PROCESSING
  -> CANCELLED

PROCESSING
  -> PACKED

PACKED
  -> SHIPPED

SHIPPED
  -> DELIVERED
  -> DELIVERY_FAILED
```

Reject illegal transitions with a business conflict response.

## 8. Validation

Three levels:

1. UI validation
2. API DTO validation
3. Domain validation

The third level is authoritative.

## 9. Error handling

Use a consistent problem response model:

```json
{
  "type": "https://api.example.com/problems/...",
  "title": "Business rule violation",
  "status": 409,
  "code": "INVENTORY_UNAVAILABLE",
  "detail": "One or more items are no longer available.",
  "instance": "/api/v1/orders",
  "traceId": "..."
}
```

Never return stack traces to clients.

## 10. Authentication and authorization

Use Spring Security.

Authorization should support:

- Customer ownership
- Staff roles
- Fine-grained permissions
- Resource-level checks

Example:

`order:read`, `order:cancel`, `refund:create`, `inventory:adjust`, `product:publish`

Do not rely on role names alone.

## 11. Scheduled/background work

Use durable job mechanisms for important work.

Examples:

- Email
- Invoice generation
- Report generation
- Abandoned cart processing
- Inventory alerts
- Webhook retry
- Reconciliation
- Data export

For critical jobs, use a persisted job/outbox model rather than relying only on in-memory async execution.

## 12. External integrations

Wrap each integration behind an interface:

```text
PaymentGateway
ShippingProvider
EmailProvider
SmsProvider
TaxProvider
ObjectStorage
```

This isolates vendor-specific behavior.

## 13. Reporting architecture

Operational queries must not destroy transactional performance.

Use:

- Indexed read models
- Aggregation tables
- Asynchronous report jobs
- Read replicas only where consistency requirements permit
- Materialized views where justified

Do not automatically route every GET to a replica; some reads require read-after-write consistency.

## 14. API documentation

Use OpenAPI as a versioned contract.

Generate:

- API documentation
- Client types where practical
- Contract tests

The source requirements explicitly call for REST/OpenAPI documentation. fileciteturn3file1L1030-L1034
