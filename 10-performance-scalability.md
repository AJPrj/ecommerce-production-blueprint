# PART X — Performance & Scalability

## 1. Capacity planning

Define expected:

- Requests/sec
- Peak concurrent users
- Orders/minute
- Products
- Customers
- Daily order growth
- Image volume
- Report volume

Performance decisions should be based on measurements.

## 2. Performance budgets

Initial web targets:

- LCP < 2.5s
- CLS < 0.1
- Responsive interaction under normal conditions

The existing hardening document explicitly sets LCP and CLS targets and recommends route/bundle optimization. fileciteturn3file1L1515-L1523

## 3. Backend targets

Initial API targets:

- Catalog p95 < 500ms
- Product detail p95 < 400ms
- Cart p95 < 500ms
- Checkout/order command p95 < 1.5s excluding third-party waiting

Track:

- p50
- p95
- p99
- Error rate
- Throughput

## 4. Database performance

Use:

- Proper indexes
- Query plans
- Projection queries
- Pagination
- Batch fetching
- Connection pooling

Avoid:

- N+1
- `SELECT *`
- Large OFFSET at high page numbers
- Unbounded result sets
- Long transactions

## 5. Pagination

For admin datasets:

- Default 25/50 records
- Configurable upper bound
- Server-side filtering
- Server-side sorting

For very large datasets use keyset pagination.

## 6. Caching

Candidates:

- Categories
- Product detail
- Product listing
- Configuration
- Static tax metadata where safe

Define:

- Cache key
- TTL
- Owner
- Invalidation event
- Stale behavior

## 7. Redis

Use Redis for:

- Cache
- Rate limiting
- Short-lived workflow data
- Distributed coordination only where justified

Do not store irreplaceable business state only in Redis.

## 8. CDN

Use CDN for:

- Product images
- Static frontend assets
- Public cacheable content

Use object storage as the origin.

## 9. Images

Require:

- WebP/AVIF where supported
- Multiple sizes
- Thumbnail generation
- Metadata stripping where appropriate
- Lazy loading
- Reserved dimensions

## 10. Search

Start with PostgreSQL if requirements are moderate.

Upgrade to OpenSearch/Elasticsearch when:

- Relevance becomes complex
- Catalog grows substantially
- Faceting load is high
- Search traffic needs independent scaling

Do not introduce a search cluster before it is justified.

## 11. Horizontal scaling

Application nodes should be stateless.

Store shared state in:

- PostgreSQL
- Redis
- Object storage
- Durable queues/outbox

Then scale application instances horizontally.

## 12. Autoscaling

Scale on more than CPU where useful:

- CPU
- Memory
- Request rate
- Latency
- Queue depth
- Worker backlog

## 13. Database scaling path

1. Optimize queries
2. Add indexes
3. Tune PostgreSQL
4. Increase resources
5. Cache reads
6. Read replicas
7. Partition large tables where justified
8. Archive historical data where policy permits

## 14. Connection pool sizing

Do not set Hikari pool size independently on every instance.

Total possible DB connections is roughly:

`pool_size × application_instances`

Keep this below PostgreSQL capacity with headroom.

## 15. Async processing

Move long tasks off HTTP threads:

- Reports
- Email
- Image processing
- Invoice rendering
- Bulk imports
- Data exports

The source specification recommends asynchronous handling for email/invoice work; this blueprint prefers durable job/outbox processing for business-critical work over fire-and-forget async execution. fileciteturn3file1L1588-L1594

## 16. Load testing

Test:

- Normal load
- Peak load
- Spike load
- Long-duration soak
- Checkout concurrency
- Search
- Admin reports

## 17. Performance regression gates

CI should detect:

- Bundle size regression
- API latency regression
- Query count regression
- Slow query regression
- Core Web Vitals regression
