# PART XIV — Testing Strategy

## 1. Testing philosophy

Production readiness comes from testing failure modes, not just happy paths.

Test business invariants, concurrency, retries, security and recovery.

## 2. Unit tests

Test:

- Pricing
- Tax
- Coupon rules
- Inventory policy
- Order transitions
- Payment transitions
- Return eligibility
- Refund calculation
- Permission rules

Domain tests should be fast and independent.

## 3. Backend integration tests

Use Testcontainers with:

- PostgreSQL
- Redis
- Mock external services where appropriate

Verify:

- Real SQL
- Constraints
- Transactions
- Locking
- Migrations
- Serialization

## 4. API tests

Verify:

- Status codes
- Schemas
- Authorization
- Validation
- Error contracts
- Idempotency
- Pagination
- Filtering

## 5. Contract tests

Keep OpenAPI contract synchronized with implementation.

For critical external integrations, test provider request/response contracts.

## 6. Frontend tests

Test:

- Components
- Forms
- Validation
- State transitions
- Routing
- Permission rendering
- Error handling

## 7. E2E tests

Critical journeys:

### Customer

`Register -> Verify -> Login -> Search -> Product -> Cart -> Checkout -> Payment -> Order -> Tracking`

### Admin

`Login -> Dashboard -> Product -> Edit -> Publish`

`Order -> Status update -> Shipment`

`Return -> Approve -> Refund`

## 8. Payment tests

Must cover:

- Success
- Failure
- Timeout
- User cancellation
- 3DS/extra authentication if applicable
- Duplicate webhook
- Out-of-order webhook
- Delayed webhook
- Partial refund
- Full refund
- Refund failure
- Gateway reconciliation

## 9. Inventory concurrency tests

Create a scenario with:

- Stock = 1
- Two concurrent checkout attempts

Expected:

- One succeeds
- One receives inventory conflict
- Stock never becomes negative

## 10. Idempotency tests

Send identical order command twice.

Expected:

- One business effect
- Same/replayable result
- No duplicate payment
- No duplicate order

## 11. Security tests

Test:

- IDOR
- Privilege escalation
- CSRF
- XSS
- SQL injection
- Session expiry
- Rate limits
- File upload abuse
- Brute force
- Open redirect
- Mass assignment

## 12. Database tests

Verify:

- FK integrity
- Unique constraints
- Check constraints
- Indexes
- Migration upgrades
- Roll-forward compatibility
- Transaction rollback

## 13. Performance tests

Use realistic datasets.

Test:

- Catalog
- Search
- Cart
- Checkout
- Admin tables
- Reports

Include p95/p99 and throughput thresholds.

## 14. Soak tests

Run for hours to identify:

- Memory leaks
- Connection leaks
- Queue buildup
- Slow degradation
- Cache growth

## 15. Chaos/failure tests

Where infrastructure maturity permits:

- Kill application pod
- Restart worker
- Disconnect Redis
- Simulate DB failover
- Delay payment gateway
- Duplicate webhook
- Drop notification provider

## 16. Release smoke suite

After deployment:

- Health
- Authentication
- Product listing
- Product detail
- Cart
- Checkout sandbox
- Order read
- Admin login
- Basic DB operation

## 17. Test data

Use deterministic synthetic data.

Never copy production PII into lower environments without an approved anonymization process.

## 18. Quality gates

A production release should fail if:

- Unit tests fail
- Integration tests fail
- Security high-severity gate fails
- Migration compatibility fails
- Critical E2E fails
- Performance regression exceeds threshold
