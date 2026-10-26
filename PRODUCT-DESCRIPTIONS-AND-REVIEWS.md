# Product descriptions and customer reviews

Implemented 2026-10-26. This extends the catalog and the review rules in Part VI.

## Description authoring

Product pages have Description and Reviews tabs. The existing description field
(maximum 5,000 characters) accepts paragraphs separated by blank lines, headings
prefixed with `## `, and bullet lines prefixed with `- `. The storefront and Admin
draft preview render this small format as escaped React elements. Raw HTML is
displayed literally. Existing plain text remains compatible. The purchase area
shows a short introduction and links to the full description. Product facts come
from saved catalog data; no material, safety, dimensions or care claims are inferred.

In Admin > Products > General, supply confirmed product features, size/material
information and care instructions where applicable. This change does not rewrite
existing product descriptions or copy the reference merchant's text.

## Reviews

- Migration V44 adds `product_reviews`, one review per customer/product, rating
  1–5, title 1–120 characters and body 10–3,000 characters. No synthetic reviews
  are inserted. Reviews apply to the product across its variants.
- Public lists show only APPROVED reviews, newest first, ten per page. Customers
  sign in to submit, edit or remove their own review. The server derives ownership
  from the active customer account; first name (or “Customer”) is public, while
  email, surname and customer identifiers are omitted.
- New and edited reviews are PENDING. Admin > Product reviews provides pending,
  approved and hidden queues, twenty per page, with approve/hide commands. Edits
  withdraw the old published rating until approved again. Hidden reviews remain
  visible to their author and staff. There is no verified-purchase badge because
  submission does not require a purchase.
- Moderation checks `expectedUpdatedAt`, preventing approval of a stale version
  after an edit. Moderation writes an audit event. CSRF and CUSTOMER/ADMIN method
  authorization protect writes. User-row locking and a unique database constraint
  serialize duplicate submissions; identical retries retain their status. Changed
  submissions require a ten-second gap per account across products. Review text
  renders as escaped plain text; attachments and HTML are unsupported.
- Product list/detail/Admin/wishlist DTOs aggregate only approved reviews, in one
  batched query per projection batch. No approvals means zero rating/count. The
  existing homepage Bestsellers heuristic now receives these real review values;
  it remains a rating/review heuristic rather than sales-volume ranking.

## API contracts

All paths use `/api/v1/catalog`:

| Method and path | Access / behavior |
|---|---|
| GET `/products/{id}/reviews?page=0` | Public; published product required; items, totalItems, page, totalPages and summary |
| GET `/products/{id}/reviews/mine` | CUSTOMER; own review or empty body; no-store |
| PUT `/products/{id}/reviews/mine` | CUSTOMER + CSRF; `{rating,title,body}`; returns saved review |
| DELETE `/products/{id}/reviews/mine` | CUSTOMER + CSRF; idempotent own removal, including unavailable products |
| GET `/admin/reviews?status=PENDING&page=0` | ADMIN; PENDING/APPROVED/HIDDEN queues; no-store |
| PATCH `/admin/reviews/{id}` | ADMIN + CSRF; `{status,expectedUpdatedAt}`, APPROVED/HIDDEN only; stale version returns 409 |

Review fields: id, productId, productName, author, rating, title, body, status,
createdAt, updatedAt. Summary fields: rating (average), reviews (count),
distribution (five counts ordered one star through five stars). Invalid input
returns 400; rapid changed submissions return 429. Pagination is zero-based and
bounded to pages 0–10,000. Private endpoints remain separate from public responses.

Rebuild/restart the backend to apply V44 and expose the endpoints, then refresh
the frontend. No new environment settings or live-provider changes are needed.

## Verification

Focused PostgreSQL integration tests cover approval visibility, rating aggregation,
editing, ownership, authentication/roles/CSRF, integer validation, unavailable
products, stale moderation and concurrent identical submissions. Frontend tests
cover safe description formatting, keyboard tabs, guest sign-in, review submission,
pending state, draft preservation, removal, pagination, retry and moderation.
Execution results are recorded in the implementation tracker after verification.
