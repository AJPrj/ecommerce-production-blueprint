# PART IX — Reliability & Distributed Systems

## 1. Reliability philosophy

The most important reliability property is correctness of money, inventory and order state.

A fast incorrect checkout is worse than a slow checkout.

## 2. Idempotency

Implement durable idempotency for effectful commands.

Table:

```text
idempotency_keys
----------------
id
scope
actor_id
key
request_hash
status
response_status
response_reference
created_at
expires_at
```

Unique constraint on the appropriate scope + key.

## 3. Transactional outbox

When a transaction changes business state and needs an external side effect:

```text
DB transaction
  ├── update order
  ├── update inventory
  └── insert outbox event
       ↓ commit
Outbox worker
       ↓
Email / Webhook / Queue / Notification
```

Never rely on:

`DB commit -> send email -> hope`

## 4. Outbox states

```text
PENDING
PROCESSING
PUBLISHED
FAILED
DEAD_LETTER
```

Include:

- Attempts
- Next attempt time
- Last error
- Locked/lease timestamp

## 5. Retry policy

Retry only transient failures.

Use:

- Exponential backoff
- Jitter
- Maximum attempts
- Dead-letter state

Never retry non-idempotent operations blindly.

## 6. Circuit breakers

Use Resilience4j or equivalent for external systems:

- Payment gateway
- Shipping provider
- Email provider
- Tax provider

The existing hardening specification calls for circuit breakers around payment gateway calls. fileciteturn3file1L1595-L1602

## 7. Timeouts

Every external call must have:

- Connection timeout
- Read timeout
- Overall operation timeout

No unbounded HTTP calls.

## 8. Payment reliability

Treat payment provider as an asynchronous state source.

Possible sequence:

```text
Create payment intent
 -> Customer authentication
 -> Provider processing
 -> Webhook
 -> Verify
 -> Update payment
 -> Update order
```

Browser success pages are not payment proof.

## 9. Inventory race conditions

Use database transactions and locking.

Do not:

1. Read stock
2. Return from transaction
3. Later update stock

That is race-prone.

Instead perform check + reservation in one atomic workflow.

## 10. Webhook reliability

For every webhook:

- Verify authenticity
- Persist provider event ID
- Deduplicate
- Apply state transition
- Persist raw event only when safe/necessary
- Publish internal event
- Return provider-compatible success

## 11. Distributed locks

Avoid distributed locks unless necessary.

Prefer database constraints/transactions.

Use Redis locks only for problems that truly require cross-instance coordination and design lock expiry carefully.

## 12. Caching reliability

Use:

- TTL
- Versioned cache keys
- Explicit invalidation
- Stampede prevention for hot keys

Never treat Redis cache as the system of record.

## 13. Read replicas

Use only for workloads tolerant of replication lag.

Examples:

- Historical reports
- Analytics
- Large catalog browsing

Keep read-after-write flows on primary where needed.

## 14. Graceful degradation

If recommendations fail:

- Product page still works.

If notification service fails:

- Order still completes.

If analytics fails:

- Commerce transaction still completes.

If payment gateway fails:

- Order remains in a recoverable state; never mark it paid.

## 15. Job processing

Every durable job should support:

- Retry
- Visibility/lease
- Failure reason
- Attempt count
- Manual replay where safe

## 16. Reconciliation

Create scheduled reconciliation for:

- Payment gateway vs local payments
- Shipment provider vs local shipment state
- Inventory inconsistencies
- Outbox failures

Reconciliation is essential because external systems can diverge.

## 17. Failure scenarios

Explicitly test:

- DB unavailable
- Redis unavailable
- Payment timeout
- Payment webhook duplicated
- Payment webhook delayed
- Shipping API timeout
- Email provider outage
- Node crash during checkout
- Two users buying last unit
- Deployment during order placement
- Duplicate order submission
- Worker crash after external side effect

## 18. Zero-downtime principle

Application versions must overlap safely.

Database migrations must be compatible with both old and new application versions during rollout.
