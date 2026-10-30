# Homepage merchandising

The landing page uses a dedicated backend projection for Featured products,
Bestsellers and Special products. It evaluates the whole catalog rather than
reusing the first catalog search page. Admin choices and completed sales
determine the sections; ratings and review counts remain product information.

## Featured and special selections

Staff with `catalog.write` manage two ordered selections in **Admin > Homepage**.
The page is available at `/admin/storefront/homepage`.
Each section supports up to 40 unique saved product IDs, including backup choices.
Move products up or down to change their priority. A product can appear in both
sections, but cannot repeat within one section.

The homepage shows the first four currently eligible choices per section.
Eligibility requires an active, published, nondeleted product and available stock
in at least one variant. Available stock is `max(0, onHand - reserved)`. Special
products additionally require a real discount on at least one available variant:
the product's positive compare-at price must exceed that variant's effective
selling price. An unset variant override uses the product base price.

Saved choices remain visible to staff when they become unavailable, with an
eligibility reason. They stop occupying a public slot and the next eligible
backup can appear. Deleted choices retain their saved ID with a null product
projection. Staff can remove them or keep them as a reminder. A deleted reference
can remain only in the section where it was already saved; it cannot be newly
selected or transferred to another section. Initial selections are empty, and
fewer than four qualifying choices have no unrelated filler. Empty public
sections are hidden.

The special-section banner uses the largest whole-number discount percentage
among available discounted variants in its displayed products, rounded down.
The server recalculates it from current compare-at and selling prices. The
heading alone is shown when a positive discount rounds below one percent.
Selection does not create a coupon or change checkout pricing.

## Automatic bestsellers

Bestsellers are the four eligible products with the most **net paid delivered
units over the last 90 days**, aggregated across all their variants.

1. Select delivered shipment lines by their `delivered_at` timestamp in the
   rolling window. Count their delivered quantities, including delivered parts
   of split orders; a whole-order `DELIVERED` filter would lose those units.
2. Require a full recorded online capture, including its historical evidence
   when payment status is `PARTIALLY_REFUNDED` or `REFUNDED`. For COD, require
   verified collection for that specific delivered shipment. Delivery alone does
   not confirm collection. Refunded payment states do not discard unrelated kept
   units.
3. Subtract accepted return quantities allocated to the same shipment and order
   line through `return_shipment_allocations`. Accepted states are `INSPECTED`,
   `REFUND_PENDING` and `REFUNDED`. Requested, approved, cancelled, rejected or
   QC-rejected returns are not completed accepted returns. Refund rupees are not
   converted into units, and refunds are not subtracted a second time.
4. Sum nonnegative remaining quantities by product across all variants. Products
   with no positive units do not qualify. Break equal totals by distinct orders
   with remaining eligible units, descending, then product ID for stable ordering.
5. Apply current homepage eligibility before taking four results, so a sold-out
   or unpublished leader does not prevent the next eligible product appearing.

The window describes when units were delivered, not when orders were placed or
refunds were paid. Accepted returns against those deliveries reduce their current
net total even when the return is processed later. Cancelled/unshipped quantities
never enter delivered quantity and need no additional cancellation subtraction.
Test/demo sales are included if they are in the active database; no fabricated
sales or rating-based fallback fills an empty section.

## Editable testimonials

**Admin > Storefront > Homepage** also manages up to 40 ordered testimonials.
Add, edit, remove or move stories, then use **Preview changes** and **Save
homepage**. Each story has a required customer name, comment and whole-number
rating from 1 to 5; optional customer details/location, purchased item and avatar;
and a **Show Verified Buyer tag** checkbox. Staff attest to the purchase when
enabling that badge. This editorial setting is independent of product reviews
and does not calculate or change product ratings.

Avatars support the existing validated image upload flow, HTTP/HTTPS image
URLs or safe same-origin asset paths. Missing or failed images display customer initials. Uploaded database
images become public when referenced by a saved testimonial; an unsaved Admin
preview does not publish them. Removing the reference withdraws public access
unless an active product or another saved testimonial still uses the image.
External storage images retain their existing provider access behavior.

The storefront uses the saved order, individual ratings and badge choices with
the existing responsive carousel design. Hover or keyboard focus pauses automatic
rotation. An empty list hides the section; it never substitutes sample stories.
Migration V46 carries the four previously hardcoded cards into editable records.
Avatar uploads and homepage saving show separate progress and failure states;
save/preview is disabled during an in-progress upload. Older backends show an unavailable
notice for testimonial editing while product configuration remains usable.

## Complete collection listings

Each nonempty homepage section has a **View all** link to its own collection:
`/collections/featured`, `/collections/bestsellers` or `/collections/special`.
The links remain visible on mobile. All three collections are also available
from the shopping-category menu and the category-page sidebar. The Offers link
and footer Specials link open the Special Products collection.

Collection pages use the existing product grid/list controls, price filter,
sorting, page size and pagination. Featured and Special include every currently
eligible saved selection, including choices beyond the homepage's four slots.
Their default order is staff selection order. Bestsellers includes every
currently eligible product with positive net paid delivered units in the same
90-day window, ordered by the same ranking and tie-breakers as the homepage.
Unrelated catalog products never fill a collection. All Products remains at
`/category/all`; real category slugs remain independent of collection URLs.

Collections reuse the eligibility rules above, so unavailable choices do not
appear publicly. Changing price, sort or page size resets pagination while
keeping the current collection. An empty collection offers a link to All Products;
request failures offer retry. Unknown collection slugs show a missing-collection
message.

## API contracts

All paths below begin `/api/v1/catalog`.

| Method and path | Behavior |
|---|---|
| GET `/homepage` | Public server-calculated homepage projection |
| GET `/collections/{collection}` | Public complete collection with server-side filtering, sorting and pagination |
| GET `/admin/homepage` | `catalog.write`; saved configuration, current selection eligibility and preview |
| PUT `/admin/homepage` | `catalog.write` + CSRF; replace ordered selections and supplied testimonials with optimistic version checking and an audit event |
| POST `/admin/homepage/preview` | `catalog.write` + CSRF; calculate unsaved choices without configuration, version or audit writes |

The public response contains `featured`, `bestsellers` and `special` arrays of the
existing product DTO, plus `specialMaxDiscountPercent` and
`bestsellerWindowDays` (90), plus an ordered `testimonials` array. Products retain real approved review summaries and
compact variant options for the existing card selector and wishlist flow.
Unselected multi-variant products still require an explicit variant choice.

`collection` is `featured`, `bestsellers` or `special`. The collection endpoint
returns the existing catalog page shape:
`{items: ProductDto[], totalItems, page, size, totalPages}`. Query parameters are
`q`, `minPrice`, `maxPrice`, `sort`, `direction`, `page` and `size`. Page numbering
starts at zero, default size is 24, and sizes 1-50 are accepted. The default
`sort=featured` retains selection order or bestseller rank; `price-low`,
`price-high` and `newest` retain collection membership and use the existing
catalog price/date semantics. Filtering and pagination execute in PostgreSQL
before mapping the page's product DTOs. Unknown collection names return 404;
invalid pagination or price ranges return 400. Public responses use
`Cache-Control: no-store`. No additional migration or configuration is needed;
rebuild/restart the backend and refresh the matching frontend.

Admin configuration contains `version`, `featured`, `special`, `testimonials` and `preview`.
Each selection is `{productId, product, eligible, reason}`; `product` can be null
for a retained deleted or unavailable reference. The preview has the same shape
as the public projection. Save and preview accept
`{version, featuredProductIds: [UUID, ...], specialProductIds: [UUID, ...]}`.
They may also supply `testimonials: [{id, name, location, image, rating, quote,
productMention, verifiedBuyer}, ...]`. Omitting `testimonials` or sending null
preserves the saved list, including during preview; an empty array clears it on
save. IDs are unique nonblank strings up to 80 characters, names up to 160,
comments up to 4,000, details/purchased items up to 240 and image URLs up to 2,048.
Optional blank fields normalize to null. `verifiedBuyer` is a required boolean.
Same-origin avatar paths are supported by the backend, and database-media paths
must reference an existing uploaded image. The editor applies the same safe
same-origin and HTTP/HTTPS URL rules without credentials.
Unsafe protocols, duplicate IDs, null entries, invalid ratings and more than 40
stories return 400. Products and testimonials share one version and transaction;
a stale 409 cannot partially replace either list. Preview validates all supplied
stories without publishing them, advancing the version or creating audit events.
`version` is a required nonnegative integer. Both selections are complete
replacements: send an empty array to clear a section. Unknown new product IDs,
duplicates within a section and more than 40 choices return 400. A stale save
returns 409 and does not overwrite another staff member's choices. Preview
validates the input but does not compare its version against the saved version.
It does not publish a draft or reserve stock. Private responses use
`Cache-Control: no-store`.

Selection eligibility reasons are `PRODUCT_UNAVAILABLE` (missing or deleted),
`NOT_PUBLISHED` (inactive or unpublished), `OUT_OF_STOCK`, `NO_DISCOUNT` (special
only), or null for an eligible choice.

Stock, publication, payment and return state may change after preview or a public
read. The next read recalculates eligibility; cart and checkout retain their
existing authoritative validation. Featured, bestseller and special overlap is
allowed and does not alter price or stock.

## Persistence and rollout

Migration `V45__homepage_merchandising.sql` stores configuration in PostgreSQL
with an optimistic version and ordered section items. Saves and their privileged
audit event commit together. Initial configuration has empty selections; staff
make the first choices explicitly. Restart the matching backend to apply V45
before using the updated storefront or Admin page, then refresh the frontend.
No new provider credentials or environment settings are required.

Migration `V46__homepage_testimonials.sql` adds ordered testimonial records and
preserves V45 product selections/version. Restart the updated backend to apply
V46, then refresh the frontend before editing testimonials. No additional
environment configuration is required.

## Verification

Testimonial verification on 2026-10-30 passed 37 PostgreSQL integration tests
across testimonials, homepage/collections, database media and migration upgrade
preservation. Scoped formatting/check, Java main/test compilation and `bootJar`
passed. The isolated database was removed afterward; external providers and email
remained disabled. The migration test preserves existing V45 selections/version.

Frontend verification passed 65 tests across six suites, covering all editor
fields, order/removal, validation, preview/save/conflict recovery, image uploads,
public rendering, avatar fallback and carousel behavior. TypeScript/Vite build
passed. Scoped lint has zero errors and four existing effect warnings; existing
Sass notices remain. Browser visual acceptance is unverified because no browser
connection was available. Restart the updated backend for V46 and refresh the
frontend to use the feature.

Complete collection verification on 2026-10-26 passed 32 PostgreSQL integration
tests across the homepage/collections and variant/catalog suites, including six
new cases covering products beyond four, selection/rank ordering, SQL pagination
and totals, filters/sorts, variant eligibility, empty pages and invalid requests.
Scoped Spotless, main/test compilation and `bootJar` passed. The temporary
database was removed and external providers remained disabled.

Frontend collection and related regression checks passed 114 distinct tests
across 12 suites, plus the TypeScript/Vite build and scoped lint. One Admin
measurement test timed out in the parallel run; the entire 16-test suite passed
on an isolated rerun without code or timeout changes. Existing route Fast Refresh
warnings and Sass notices remain. Browser visual acceptance is unverified because
no browser connection was available.

Verification on 2026-10-26 passed 52 PostgreSQL integration tests in six suites,
including 16 homepage cases and migration preservation from original V33 through
V45 on PostgreSQL 16.15. Coverage includes ordering/backups, unavailable saved
choices, all-variant stock/discount checks, whole-catalog rankings, split
deliveries, delivery windows, return allocations, COD evidence, stable ties,
stale saves, access/CSRF and nonmutating preview. The isolated database was
removed after verification. Scoped Spotless, compilation and `bootJar` passed.

The 65 passing frontend tests across nine files include server-selected
rendering, empty sections, cancellation/retry, product-card variant choice and
Admin selection/reordering/preview/conflict recovery. The TypeScript/Vite build
passed; scoped lint has no errors and retains React effect/Fast Refresh warnings.
Existing Sass notices remain. No browser connection was available for visual
acceptance. Full execution evidence is recorded in the implementation tracker.
