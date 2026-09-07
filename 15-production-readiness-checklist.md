# PART XV — Production Readiness Checklist

## A. Product

- [ ] Customer journeys are complete
- [ ] Admin workflows are complete
- [ ] Checkout is resilient to refresh/retry
- [ ] Order lifecycle is defined
- [ ] Return/refund policy is implemented
- [ ] Shipping lifecycle is defined
- [ ] Tax rules are configurable
- [ ] India/GST requirements have been validated with finance/tax stakeholders
- [ ] Invoice/credit-note requirements are implemented
- [ ] Business policies are documented

## B. UI/UX

- [ ] Customer application responsive
- [ ] Admin application responsive
- [ ] All critical flows clickable
- [ ] Loading states implemented
- [ ] Empty states implemented
- [ ] Error states implemented
- [ ] Permission states implemented
- [ ] 401/403/404/500 experiences implemented
- [ ] Accessibility review completed
- [ ] Keyboard navigation tested
- [ ] Mobile touch targets verified
- [ ] Core Web Vitals measured

## C. Frontend

- [ ] TypeScript strictness enabled
- [ ] API client centralized
- [ ] Server state separated from UI state
- [ ] Auth/session handling centralized
- [ ] Route-level code splitting
- [ ] Bundle budgets defined
- [ ] Error boundaries
- [ ] Upload security
- [ ] CSP-compatible implementation
- [ ] No secrets in frontend
- [ ] E2E suite enabled

## D. Backend

- [ ] Modular boundaries defined
- [ ] DTOs separate from entities
- [ ] Global error model
- [ ] Bean validation
- [ ] Domain validation
- [ ] Authorization on every protected endpoint
- [ ] Idempotency implemented
- [ ] Optimistic locking where needed
- [ ] Inventory locking verified
- [ ] Payment state machine implemented
- [ ] Webhook deduplication implemented
- [ ] Outbox implemented
- [ ] Durable background jobs
- [ ] External API timeouts
- [ ] Circuit breakers
- [ ] Retry policy
- [ ] Reconciliation jobs

## E. API

- [ ] `/api/v1` convention
- [ ] OpenAPI published
- [ ] Error schema standardized
- [ ] Pagination standardized
- [ ] Filtering/sorting allowlisted
- [ ] Idempotency-Key standardized
- [ ] Request/correlation IDs
- [ ] Rate limiting
- [ ] Request size limits
- [ ] No entity leakage
- [ ] API compatibility policy

## F. Database

- [ ] PostgreSQL production configuration reviewed
- [ ] Flyway enabled
- [ ] Constraints implemented
- [ ] FK relationships verified
- [ ] Unique indexes verified
- [ ] Query indexes based on real workloads
- [ ] Order snapshots implemented
- [ ] Address snapshots implemented
- [ ] Tax snapshots implemented
- [ ] Inventory reservations implemented
- [ ] Inventory movements audited
- [ ] Payment webhook persistence
- [ ] Idempotency table
- [ ] Outbox table
- [ ] Audit table
- [ ] Connection pool sized
- [ ] Slow-query monitoring
- [ ] Backup/PITR configured
- [ ] Restore tested

## G. Security

- [ ] Strong password hashing
- [ ] MFA for privileged users where appropriate
- [ ] Session rotation
- [ ] Secure cookies
- [ ] CSRF controls where applicable
- [ ] Strict CORS
- [ ] CSP
- [ ] HSTS
- [ ] Rate limiting
- [ ] Brute-force protection
- [ ] IDOR testing
- [ ] XSS testing
- [ ] SQL injection testing
- [ ] File upload scanning
- [ ] Secret manager
- [ ] Secret rotation
- [ ] Dependency scanning
- [ ] Container scanning
- [ ] SBOM
- [ ] Audit logging
- [ ] PII classification

## H. Reliability

- [ ] Idempotency
- [ ] Outbox
- [ ] Retry with backoff
- [ ] Dead-letter handling
- [ ] Circuit breakers
- [ ] Timeouts
- [ ] Payment reconciliation
- [ ] Inventory reconciliation
- [ ] Webhook replay safety
- [ ] Graceful degradation
- [ ] Read-replica consistency rules
- [ ] Worker recovery
- [ ] Deployment compatibility

## I. Performance

- [ ] Load test completed
- [ ] Peak test completed
- [ ] Checkout concurrency tested
- [ ] Database query plans reviewed
- [ ] N+1 eliminated
- [ ] Pagination enforced
- [ ] CDN configured
- [ ] Image optimization configured
- [ ] Redis strategy validated
- [ ] API p95 targets measured
- [ ] Frontend performance budgets measured

## J. Observability

- [ ] Structured JSON logs
- [ ] Correlation IDs
- [ ] Metrics
- [ ] Distributed traces
- [ ] Error tracking
- [ ] Application dashboard
- [ ] DB dashboard
- [ ] Payment dashboard
- [ ] Worker dashboard
- [ ] Alerts
- [ ] SLOs
- [ ] Runbooks

## K. CI/CD

- [ ] Reproducible builds
- [ ] Automated tests
- [ ] SAST
- [ ] SCA
- [ ] Secret scanning
- [ ] Container scanning
- [ ] SBOM
- [ ] Migration validation
- [ ] Staging deployment
- [ ] Automated smoke tests
- [ ] Production approval
- [ ] Rollback plan
- [ ] Zero-downtime migration strategy

## L. Infrastructure

- [ ] Production TLS
- [ ] WAF/edge controls where required
- [ ] CDN
- [ ] Kubernetes/container platform hardened
- [ ] Resource requests/limits
- [ ] HPA
- [ ] PDB
- [ ] Network policies
- [ ] Private DB networking
- [ ] Secrets manager
- [ ] Object storage security
- [ ] Backup storage isolation

## M. Disaster recovery

- [ ] RPO defined
- [ ] RTO defined
- [ ] WAL archiving
- [ ] Backup encryption
- [ ] Backup retention
- [ ] PITR tested
- [ ] Restore drill completed
- [ ] DR environment/runbook
- [ ] Incident contacts
- [ ] Security recovery procedure

## N. Go-live gates

Do not launch until all critical items are green:

1. Checkout correctness
2. Payment correctness
3. Inventory correctness
4. Security review
5. Database backup/restore
6. Monitoring/alerting
7. Rollback procedure
8. Incident runbook
9. Business/tax validation
10. Production smoke test

## O. First 30 days after launch

Track daily:

- Error rate
- p95/p99 latency
- Checkout conversion
- Payment failures
- Duplicate order attempts
- Inventory conflicts
- Refund volume
- Return rate
- Outbox failures
- Worker backlog
- DB CPU/connections
- Slow queries
- Security events

Perform a post-launch architecture review after sufficient real traffic has been collected.
