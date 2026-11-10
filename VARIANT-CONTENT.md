# Shared products and complete sellable variants

Owner-approved implementation, 2026-11-07. Supersedes the shared content and
price-override authoring model for products saved through the new editor.

## Ownership and Admin workflow

The product owns name, category, brand, optional common overview, GST
classification, SEO, reviews and overall publication. Each variant owns its SKU,
option attributes, description, primary image, ordered additional images, selling
price, list price, stock and shipping measurements. A product with one sellable
item uses the same model with one variant; there is no separate parent SKU form.

Admin navigation is Product details, Sellable item/Variants, SEO and Publication.
The variant overview shows image, name, SKU, price, availability, status and
missing fields. Its selected workspace contains Details, Images, Pricing,
Inventory and Shipping. Images can be uploaded, reused explicitly, promoted to
primary, reordered or removed. Description copying is explicit. Duplicating a
variant copies content/attributes/measurements into independent fields, clears
its identity and SKU, resets stock to zero and starts in DRAFT. Existing SKU stock
is adjusted only through the audited Inventory workflow.

Variant statuses are DRAFT, PUBLISHED and ARCHIVED. PUBLISHED means eligible for
sale only while the parent product is also published. Drafts require a name and
unique SKU, but can omit content, prices and measurements. A PUBLISHED variant
requires its own description, an effective primary image, positive selling price, list price
at least selling price, and complete positive unit measurements. Additional
images are optional. At least one PUBLISHED variant is needed to publish the
family. A new incomplete DRAFT does not block an already complete live SKU.

### Main item image fallback (owner approved, 2026-11-08)

The existing primary SKU is the main item and is labelled as the shared image
source in Admin. For a new product the first variant is the main item. A variant
with both an empty primary image and an empty gallery automatically uses the
main item's entire image set. Its stored image fields remain empty; future edits
to the main item images take effect immediately. Any custom images replace the
entire inherited set; a partial custom set never inherits individual missing
images. Removing all custom images restores inheritance. A published variant
must have a primary image in its effective set, including when the product is
saved inactive. The main item cannot inherit from another variant.

The editor shows "Using main item images", read-only inherited thumbnails and
an "Add variant images" action. "Use main item images" clears the custom set.
Readiness, preview, public details/options, product cards, homepage, cart and
wishlist use the same effective image rule. Admin detail responses retain raw
image fields so editing does not turn inheritance into a fixed copy. Description,
prices, inventory and shipping remain independent.

A draft/archived main SKU can supply images to a published inheriting SKU without
exposing the source SKU or its other content. Database media is public only while
an eligible published SKU uses it directly or through inheritance. Once the last
eligible reference disappears, draft-only media becomes private again. This
change requires a backend-first rollout but adds no database migration beyond
the existing V51 variant-content migration.

## Additive contracts and rollout

Flyway V51 adds variant content/media/list-price/status columns and a product
`variant_content_enabled` flag. Existing SKU IDs, price overrides, inventory,
reservations, shipping and order/payment snapshots are unchanged. Shared
description, primary image, gallery and list price are copied to existing
variants, without inventing differences. Existing variants retain PUBLISHED
status; the parent continues to govern overall visibility. Their actual images,
descriptions, prices and measurements must be reviewed in Admin.

`details.variantContentVersion: 1` advertises backend support. The frontend uses
the new workspace for supported responses and retains the existing editor for
older backend responses. Modern writes first verify the Admin-only `/api/v1/catalog/admin/capabilities`
response, preserving the draft without a write if support cannot be confirmed.
They then send `variantContentEnabled: true` and
`variants[].content` containing `description`, `image`, `images`, `mrp`, `status`.
`variants[].priceOverride` remains the wire/storage name for each explicit
selling price. It is presented as Selling price in Admin. The legacy top-level
SKU/price/image envelope mirrors the primary variant for compatibility and is
not the source of another variant's selling price. Empty draft prices use a
positive compatibility envelope value; draft variants are never purchasable.

Legacy clients continue to edit products that have not adopted the new model.
Once adopted, writes omitting the enabled flag are rejected with a reload
conflict to prevent an older client from discarding variant ownership. Every
save, including a variant-only change, advances the product edit version.

Deploy the matching backend (applying V51) before the frontend, and retire old
backend instances before enabling the model on products. Older backend binaries
do not understand individual variant status; this is an additive schema rollout,
not authorization to route modern products through older backend binaries.

## Public and commercial behavior

Public detail/options, search results and prices, homepage eligibility and collections use
only PUBLISHED variants. An archived primary SKU does not prevent another
published SKU from representing the family. Multi-variant products still require
an explicit customer choice. Selection changes gallery, description, both prices,
discount, SKU and stock together. The product overview is shown before a variant
is selected (and for legacy products). Once selected, only that variant's own
description appears in the summary and description tab; the product overview
is never appended. Admin variant preview follows the same rule. Image fallback
does not inherit or append descriptions. Reviews remain shared.

Cart additions, checkout and wishlist saves reject draft/archived variants. Exact
SKU wishlist and cart projections use the variant image and price. Homepage
discount eligibility and percentage calculations use each variant's own list
price. Database media becomes public only through eligible references; a media
reference solely belonging to a draft/archived variant does not grant public
access. Existing order financial and shipping snapshots remain immutable.

## Verification

Focused integration coverage exercises independent content/prices, draft addition
to a live family, unavailable-SKU purchase guards, media visibility, archived
primary fallback, validation rollback and edit-version/legacy-writer conflicts.
Frontend coverage exercises independent edits, image promotion, duplication,
draft saving, required-field navigation, publication/GST retry, variant switching
and exact chosen-variant discounts. A delayed-upload check verifies that manual
image edits made while an upload is in flight are retained. Execution results and remaining visual
acceptance are recorded in IMPLEMENTATION-TRACKER.md.
