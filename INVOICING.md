# Customer invoices and reviewed credit notes

The B2C implementation uses the existing Eye on Bay logo, saved order amounts,
PostgreSQL document storage and the existing SMTP transport. It supports a
single regular-GST seller and one final invoice for the remaining supply of an
order. It does not activate itself or issue documents for historical orders.

## Operator setup

1. Apply backend migration V49 and deploy the matching frontend.
2. In Admin settings, enter the actual seller legal name, registered address,
   GSTIN, dispatch state and an invoice prefix of one to four letters/digits.
   The legal seller identity is distinct from the Eye on Bay brand. The GSTIN
   must pass its checksum and match the seller state. Approve the effective
   seller/price/delivery policy through the existing tax workflow.
3. Review sample PDFs against real product HSN/rates, inclusive pricing,
   discount/delivery allocation and paise rounding. Confirm the tax regime is
   regular GST, the numbering series is unused, and the business accepts the
   sample, signature treatment and any applicable regulatory integrations.
4. Set these values in the Java backend environment, then restart:

   ```text
   INVOICE_ENABLED=true
   INVOICE_TAX_SCHEME=REGULAR
   INVOICE_SUPPORT_EMAIL=support@your-store.example
   INVOICE_SUPPORT_PHONE=+919876543210
   INVOICE_EMAIL_ENABLED=true
   INVOICE_EMAIL_FROM=orders@your-store.example
   ```

   Email uses the existing `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`,
   `SMTP_PASSWORD` and STARTTLS settings. The sender must be verified by the
   provider. The sender defaults to `ADMIN_ORDER_EMAIL_FROM` if not supplied.
   On Render Free, use the provider-supported alternate SMTP port described in
   [password recovery troubleshooting](PASSWORD-RECOVERY.md), rather than a
   blocked port. Email configuration validates without sending a live message.

Issuance defaults to disabled and the tax scheme to `UNCONFIRMED`. Email defaults
to disabled independently. Existing checkout/fulfillment remains compatible
while issuance is disabled. These switches do not replace tax/business approval.

## Packing and dispatch

Open the Admin order's **Customer invoice** panel. A sample preview is available
without allocating an invoice number, including when seller setup is incomplete;
it is explicitly marked **SAMPLE NOT A TAX INVOICE**. Confirm packing is final,
provide a reason, and issue the invoice before physical courier handover.

The backend locks the order/payment in the established order. It checks payment
eligibility, saved delivery/contact/place-of-supply data, seller settings,
remaining quantities and unresolved provider cancellation work. Already shipped
orders cannot be newly invoiced through this command. Repeat issuance returns
the existing invoice without consuming another number or queuing another email.

When enabled, application dispatch requires an issued invoice whose net
cancellation-adjusted quantities match the saved order remainder. Carrier scans
do not create or backdate invoices. Missing documentation prevents automatic
dispatch projection and leaves the existing tracking review/reconciliation path.
Operations must still check the document before handing a parcel to a courier;
the app cannot prevent a physical handover performed entirely in Shiprocket.

The app is the invoice source. Confirm the actual Shiprocket account's document
behavior before go-live; do not independently issue a second legal invoice or
edit the saved financial supply in the carrier dashboard. Split supply across
multiple invoices/parcels is outside this first release.

## Document and accounting behavior

- Numbers are assigned atomically per document kind and Indian financial year,
  using Asia/Kolkata at issuance. Example: `EOB/2627/000001`. The complete number
  is at most 16 characters. The prefix cannot change within an existing annual
  series; an exhausted series fails explicitly.
- Snapshot the seller, purchaser address/email, original item descriptions,
  quantities, variant/SKU/HSN, price, discount, GST and delivery unit allocations.
  Billing equals the saved delivery address in this version. Separate billing
  addresses, business GSTIN input, exports and composition/exempt document flows
  need separate contracts before use.
- Monetary values come from the existing backend's saved paise allocations, not
  current catalog prices or browser totals. No new whole-rupee rounding is added.
- Store immutable snapshot JSON, exact PDF bytes, SHA-256, actor, reason and issue
  time. PostgreSQL rejects updates/deletes of issued documents. Small-store
  deployment intentionally archives bounded PDFs in PostgreSQL, keeping document
  and business transaction atomic; include their capacity in backup/restore
  planning. Downloads/resends do not regenerate the file with a newer template.
- PDFBox and the packaged OFL Noto Sans font generate A4 documents with the
  existing logo, wrapped descriptions, repeated table headers and page numbers.
  Unsupported glyphs fail before issuance instead of silently corrupting a name.
- COD payment wording does not establish collection. Payment/refund state remains
  a separate ledger; the invoice records status at issuance.

## Customer email and downloads

Issue and email intent commit together when invoice email is enabled. The worker
claims short database leases, sends SMTP outside the transaction, retries
transient failures with bounded exponential backoff/jitter, and records terminal
failures as `DEAD_LETTER`. Claims fence stale completion updates. Workers select
only invoice events, leaving admin order notices untouched.

SMTP acknowledgement records `PUBLISHED`: this means the provider accepted the
message, not that inbox delivery was proven. SMTP is at-least-once; a crash after
provider acceptance can produce a duplicate. A stable Message-ID is reused for
retries. An intentional staff resend creates a new audited event and Message-ID,
preserves failed history, deduplicates pending work and enforces a recent-send
cooldown. It always uses the invoice's saved recipient and exact attachment.

Customers can download their own invoice/credit notes from confirmation and
tracking/order details. Backend ownership checks apply to metadata and PDFs;
nonowners receive 404. Responses are private/no-store. Staff read access follows
the order support roles; issuing invoices requires Admin/Fulfillment, resending
requires Admin/Fulfillment/Support, and credit-note issuance requires Admin.
Mutation endpoints require the existing session/CSRF protection.

## Cancellations, returns and credit notes

Confirmed cancellations before issuance are excluded from the invoice. A later
cancellation preserves the original invoice and requires a reviewed linked credit
note before the changed remainder can dispatch. The source adjustment must exist
first; cancellation is not blocked waiting for a credit note referencing itself.

Admin selects a confirmed cancellation or accepted inspected return, explicitly
chooses whether original delivery shares are credited, supplies a reason and
reviews the full-unit adjustment. Original saved unit ordinals and GST shares
bound the credit; duplicate sources and overlapping credited units are rejected.
Legacy adjustments without saved unit ordinals require manual review. The credit
note has its own financial-year sequence, references the original invoice and is
archived immutably. Customers can download it from the same document area.

Credit notes do not execute or prove refunds. Partial goodwill amounts,
arbitrary tax adjustments and tax-return eligibility/deadlines are not inferred
from a payment refund. Finance must review those cases separately. Credit-note
email delivery is not automatic in this version; document downloads are provided.

## Release acceptance

Before enabling real issuance, the business must approve seller registration,
HSN/rates, sample documents, shipping/rounding treatment, series opening,
signature/QR/e-invoice applicability, retention and the packing/printing process.
There is no fabricated registration, government IRN/QR, automatic historical
backfill, retention deletion, or live provider acceptance in this change.

Technical verification and remaining operational gates are recorded in
[the implementation tracker](IMPLEMENTATION-TRACKER.md).
