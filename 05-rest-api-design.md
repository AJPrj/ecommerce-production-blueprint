# PART V — REST API Design

## 1. Base conventions

Use:

```text
/api/v1/...
```

Rules:

- JSON request/response
- ISO-8601 timestamps
- Explicit currency code
- Stable public IDs
- Consistent pagination
- Consistent errors
- Idempotency for critical mutations
- Request/correlation ID support

## 2. Authentication

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/register
POST   /api/v1/auth/verify-email
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
GET    /api/v1/auth/me
```

Forgot-password must return a generic response to prevent account enumeration.

## 3. Customer

```text
GET    /api/v1/customers/me
PATCH  /api/v1/customers/me
GET    /api/v1/customers/me/addresses
POST   /api/v1/customers/me/addresses
PATCH  /api/v1/customers/me/addresses/{id}
DELETE /api/v1/customers/me/addresses/{id}
```

## 4. Catalog

```text
GET /api/v1/categories
GET /api/v1/categories/{slug}
GET /api/v1/products
GET /api/v1/products/{slug}
GET /api/v1/products/{id}/reviews
GET /api/v1/products/{id}/related
```

Filtering should be server-side.

Example:

```text
GET /api/v1/products?
category=electronics&
brand=samsung&
minPrice=100&
maxPrice=1000&
sort=priceAsc&
page=0&
size=24
```

Implemented category hierarchy uses `GET /api/v1/catalog/categories` and the
existing Admin-protected `GET/POST /api/v1/catalog/admin/taxonomy/categories`
and `PUT /api/v1/catalog/admin/taxonomy/categories/{id}`. Mutations also require
CSRF. Category responses add
nullable `parentId`; the public list includes active categories. Create/update
accepts `parentId` as a category UUID or `null` for a top-level category. These
are complete updates: an omitted parent also makes the category top-level.
Unknown parents, self-parent links and moves under descendants return 400.
Brands and attributes cannot have parents. Category slugs remain globally unique.

`GET /api/v1/catalog/products?category={slug}` includes products assigned directly
to the selected category or any depth of descendants, with the existing public
product visibility, price, sort and pagination rules. Public category
`productCount` uses the same subtree scope. Admin product `categoryId` filtering
remains an exact assignment filter. Activation is per category, without cascading
to children or changing existing product publication. Active children whose
parents are absent from the public list appear as roots in storefront navigation.
Hierarchy does not change category targeting for promotion or return rules.
Category deletion still requires children to be reassigned or removed first.

Product detail and Admin `details.variants[]` add nullable `shipping` with the same
measurement fields as product shipping. Admin `variants[]` create/update accepts
this measurement set: an object replaces the complete set. Null/omitted is
allowed in drafts, but product fallback applies only to single-SKU products.
Multi-variant publication and new orders require each SKU's own measurements. Drafts may omit required measurements; publication requires
complete positive integer weight/dimensions for every persisted variant. Optional
packaging weight accepts integer zero. The catalog `ProductDto` adds `variantCount`
and `variantOptions: [{id,name,sku,price,stock}]` for explicit inline selection
from product cards. Options use effective prices and nonnegative on-hand minus
reserved stock, batched with existing product mapping; no additional per-card
request or migration is required. Primary SKU comes first, then name/ID order.
Saved wishlist projections retain their exact SKU and an empty options list. No checkout/cart client
price or measurement fields are introduced; the server resolves and snapshots
complete effective measurements on new order lines through the existing APIs.

## 5. Search

```text
GET /api/v1/search/suggestions?q=phone
GET /api/v1/search?q=phone&page=0&size=24
```

Search implementation may start with PostgreSQL full-text/trigram capabilities and later move to OpenSearch/Elasticsearch if scale and relevance requirements justify it.

## 6. Wishlist

```text
GET    /api/v1/wishlist
POST   /api/v1/wishlist/items
DELETE /api/v1/wishlist/items/{variantId}
```

Implemented customer contract: all three operations require an active signed-in
customer and return `200` with `{ "items": ProductDto[] }` and `Cache-Control:
no-store`. POST accepts `{ "productVariantId": "<uuid>" }`; the customer identity
comes from the session. Mutations require the existing CSRF token. Repeated adds
and removals are idempotent, with one saved entry per customer/variant.

Entries are returned newest first with the saved variant's current catalog price
and available stock. Out-of-stock products can stay saved. Draft, archived and
deleted products are omitted and cannot be newly saved; saved entries can still
be removed by variant ID. Saving never reserves inventory. Adding a saved item to
the cart uses the existing authoritative cart API and keeps it in the wishlist.
Guest wishlist storage and merging are outside this account-backed contract.

## 7. Cart

```text
GET    /api/v1/cart
POST   /api/v1/cart/items
PATCH  /api/v1/cart/items/{itemId}
DELETE /api/v1/cart/items/{itemId}
POST   /api/v1/cart/coupon
DELETE /api/v1/cart/coupon
POST   /api/v1/cart/reprice
```

The server recalculates all monetary totals.

## 8. Checkout

```text
POST /api/v1/checkout/validate
POST /api/v1/checkout/shipping-options
POST /api/v1/checkout/payment-intent
POST /api/v1/orders
```

`POST /orders` requires:

```text
Idempotency-Key: <unique-client-generated-key>
```

The earlier specification used an idempotency header to prevent duplicate charges; standardize the name to `Idempotency-Key`. fileciteturn3file1L1215-L1229

## 9. Orders

```text
GET  /api/v1/orders
GET  /api/v1/orders/{id}
POST /api/v1/orders/{id}/cancel
GET  /api/v1/orders/{id}/tracking
GET  /api/v1/orders/{id}/invoice
```

Customer endpoints must enforce ownership.

## 10. Returns

```text
POST /api/v1/orders/{id}/returns
GET  /api/v1/returns
GET  /api/v1/returns/{id}
POST /api/v1/returns/{id}/cancel
```

## 11. Payments

```text
GET  /api/v1/orders/{id}/payments
POST /api/v1/payments/{id}/retry
POST /api/v1/payments/webhooks/{provider}
```

Webhook endpoint is authenticated using provider signature verification.

## 12. Admin APIs

```text
GET    /api/v1/admin/products
POST   /api/v1/admin/products
GET    /api/v1/admin/products/{id}
PATCH  /api/v1/admin/products/{id}
POST   /api/v1/admin/products/{id}/publish
POST   /api/v1/admin/products/{id}/archive

GET    /api/v1/admin/orders
GET    /api/v1/admin/orders/{id}
POST   /api/v1/admin/orders/{id}/status

GET    /api/v1/admin/inventory
POST   /api/v1/admin/inventory/adjustments

GET    /api/v1/admin/customers
GET    /api/v1/admin/customers/{id}

GET    /api/v1/admin/returns
POST   /api/v1/admin/returns/{id}/approve
POST   /api/v1/admin/returns/{id}/reject
POST   /api/v1/admin/returns/{id}/refund

GET    /api/v1/admin/reports
POST   /api/v1/admin/reports/jobs
GET    /api/v1/admin/reports/jobs/{id}
```

## 13. Pagination

Use:

```json
{
  "content": [],
  "page": 0,
  "size": 25,
  "totalElements": 120,
  "totalPages": 5
}
```

For very high-volume feeds, prefer cursor/keyset pagination.

## 14. HTTP semantics

- 200: successful retrieval/update
- 201: resource created
- 202: accepted asynchronous job
- 204: successful deletion/no-content action
- 400: malformed request
- 401: unauthenticated
- 403: authenticated but unauthorized
- 404: resource absent
- 409: business/concurrency conflict
- 422: semantic validation failure where used consistently
- 429: rate limit
- 5xx: server/integration failure

## 15. Idempotency

Required for:

- Order creation
- Payment initiation
- Refund
- Return creation where duplicate submission is harmful
- Other externally effectful commands

Persist the idempotency key, request fingerprint, resulting status and replayable response/reference.

## 16. API security

- Validate content type
- Request size limits
- Rate limiting
- Authorization on every protected endpoint
- No mass assignment
- DTO allowlists
- Safe file upload
- No sensitive information in error responses
- Audit privileged mutations

## 17. API compatibility

Never remove or rename fields abruptly.

Use:

1. Add new field
2. Release clients
3. Migrate consumers
4. Deprecate old field
5. Remove in a future breaking version
