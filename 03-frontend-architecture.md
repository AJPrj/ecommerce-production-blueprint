# PART III — Frontend Architecture

## 1. Recommended architecture

Use React + TypeScript with a feature-oriented architecture.

Prefer a single frontend repository with clearly separated applications/routes:

```text
frontend/
  src/
    app/
    routes/
    features/
      auth/
      catalog/
      search/
      cart/
      checkout/
      orders/
      returns/
      wishlist/
      account/
      notifications/
      admin/
      inventory/
      payments/
      reports/
    components/
      ui/
      forms/
      tables/
      feedback/
    api/
    store/
    hooks/
    lib/
    styles/
    types/
```

The customer and admin areas should be independently code-split.

## 2. State management

Use Redux Toolkit or Zustand for true application state.

Use a server-state solution such as TanStack Query where appropriate instead of placing every API response into global state.

Separate:

- Server state
- UI state
- Form state
- Session state
- Cached reference data

Do not create a global store containing everything.

## 3. Routing

Use route guards for:

- Authenticated customer routes
- Admin routes
- Permission-specific admin routes

The frontend guard is only UX protection. Backend authorization remains mandatory.

## 4. API client

Create a single typed API client layer.

Responsibilities:

- Base URL
- Credentials
- Request IDs
- Idempotency headers
- Serialization
- Error normalization
- Refresh/session handling
- Retry policy
- Timeout
- Abort/cancellation

Do not scatter raw Axios/fetch calls throughout components.

## 5. Authentication

Preferred browser model:

- Secure, HttpOnly, SameSite cookies for session/refresh credentials where compatible with deployment.
- Short-lived access/session material.
- CSRF protection when cookie authentication is used.
- Never place long-lived sensitive tokens in localStorage.

The earlier source specified HttpOnly cookies; this blueprint retains the security goal while making CSRF and session rotation explicit. fileciteturn3file1L1124-L1146

## 6. Forms

Use React Hook Form plus a schema validation library.

Every form supports:

- Client validation
- Server validation
- Dirty tracking
- Submit state
- Field-level errors
- General error
- Successful save
- Unsaved-change warning

Never assume client validation is authoritative.

## 7. Component architecture

Create reusable primitives:

- Button
- Input
- Select
- CurrencyInput
- DateRange
- Modal
- Drawer
- Toast
- Alert
- Badge
- Table
- Pagination
- DataGrid
- EmptyState
- ErrorState
- Skeleton
- FileUploader
- ConfirmDialog
- StatusTimeline

Then compose domain components from these primitives.

## 8. API caching

Cache only data where stale data is acceptable.

Good candidates:

- Categories
- Product detail
- Product listing
- Shipping metadata
- Static configuration

Never blindly cache:

- Inventory availability during checkout
- Payment status
- Order authorization decisions

## 9. Optimistic updates

Use only where rollback is safe.

Good:

- Wishlist toggle
- Read/unread notification
- Local preference

Avoid optimistic mutation for:

- Payment
- Inventory reservation
- Order placement
- Refunds

## 10. File uploads

Use presigned object-storage URLs.

Flow:

1. Request upload authorization
2. Upload directly to object storage
3. Confirm upload with backend
4. Backend validates ownership/content metadata
5. Persist asset reference

Do not stream large images through the application server unnecessarily.

## 11. Frontend security

- Escape rendered user content
- Sanitize rich text at trust boundary
- Do not inject arbitrary HTML
- Never expose secrets
- Avoid sensitive data in URLs
- Use CSP-compatible code
- Prevent open redirects
- Validate file types and sizes
- Do not trust hidden UI fields for authorization

## 12. Performance

- Route-level code splitting
- Lazy admin bundle
- Image optimization
- Responsive image sizes
- Lazy loading below-fold content
- Virtualization for genuinely large lists
- Debounced search
- Abort stale requests
- Avoid unnecessary re-renders
- Analyze bundles in CI

## 13. SEO/customer storefront

If organic search matters, use an SSR/SSG-capable React architecture for public product/category pages or another SEO strategy. Keep the admin console CSR-oriented.

The earlier specification explicitly called out SEO/speed for the storefront and CSR/code splitting for the admin application. fileciteturn3file1L1051-L1055

## 14. Error boundaries

Provide:

- Application-level boundary
- Route-level boundary
- Feature-level recovery where useful

Log correlation/request IDs, not sensitive user data.

## 15. Frontend observability

Capture:

- Route performance
- API latency
- JS errors
- Failed mutations
- Checkout abandonment signals
- Web vitals
- Client-side correlation ID

Avoid logging payment credentials, passwords, full addresses or unnecessary PII.
