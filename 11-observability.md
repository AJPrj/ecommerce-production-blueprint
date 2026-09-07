# PART XI — Observability

## 1. Three pillars

Implement:

1. Logs
2. Metrics
3. Traces

Plus business-level telemetry.

The existing hardening requirements already call for structured logs, Prometheus metrics, tracing and alerting. fileciteturn3file1L1603-L1612

## 2. Structured logs

Emit JSON.

Fields:

```text
timestamp
level
service
environment
traceId
spanId
requestId
userId (where policy permits)
route
method
status
durationMs
errorCode
```

Never log:

- Passwords
- Access tokens
- Cookies
- CVV
- Full payment credentials
- Unnecessary PII

## 3. Correlation

Every inbound request gets a correlation/request ID.

Propagate it across:

- Backend calls
- Async jobs
- Outbox messages
- External integrations

## 4. Metrics

### Technical

- HTTP request count
- HTTP latency
- 4xx/5xx
- DB connection pool usage
- DB query latency
- Redis latency
- JVM memory
- GC
- CPU
- Thread pools
- Queue depth

### Business

- Orders created
- Orders completed
- Payment success/failure
- Refund total
- Checkout conversion
- Cart abandonment
- Inventory low
- Return rate

Example names:

```text
ecommerce_orders_created_total
ecommerce_payment_success_total
ecommerce_payment_failure_total
ecommerce_order_placement_duration_seconds
ecommerce_inventory_reservation_failure_total
```

## 5. Tracing

Trace:

```text
Browser
 -> API
 -> Service
 -> PostgreSQL
 -> Payment Provider
 -> Outbox Worker
 -> Notification Provider
```

Use OpenTelemetry-compatible propagation.

## 6. Dashboards

### Application

- RPS
- p95/p99
- 5xx
- saturation

### Database

- CPU
- connections
- locks
- slow queries
- cache hit ratio
- replication lag

### Commerce

- orders/minute
- payment conversion
- checkout failure
- refund volume

### Workers

- queue depth
- processing time
- retry count
- dead-letter count

## 7. Alerting

Alert on symptoms and business impact.

Examples:

- Sustained 5xx
- p95 latency above SLO
- DB connection exhaustion
- Replication lag
- Payment failure spike
- Outbox backlog
- Dead-letter growth
- Inventory inconsistency
- Backup failure

The source hardening document proposes alerts for 5xx, DB CPU and payment failures; this blueprint broadens alerting toward SLOs and queue/data correctness. fileciteturn3file1L1603-L1612

## 8. Health endpoints

Provide:

```text
/actuator/health/liveness
/actuator/health/readiness
```

Liveness should indicate whether the process is alive.

Readiness should indicate whether the instance can safely receive traffic.

Do not make readiness depend on every optional external service.

## 9. Error tracking

Use an error tracking platform where appropriate.

Group errors by:

- Exception type
- Route
- Release
- Environment

Attach correlation IDs.

## 10. SLOs

Define:

- Availability
- Latency
- Error budget
- Payment processing success
- Checkout success

Review SLOs monthly.
