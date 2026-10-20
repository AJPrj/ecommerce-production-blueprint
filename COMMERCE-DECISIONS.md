# Commerce decisions and provisional defaults

Recorded from the project owner's answers on 2026-10-10. The owner confirmed that synthetic HSN/SAC identifiers and sample GST rates may be used in the development database, and that the shipping-tax, rounding, invoice/credit-note, and cancellation/return defaults below should guide development for now and may be revised later. The business Admin is responsible for approving these settings. These defaults unblock development work; they are not tax advice or production approval.

## Approved project direction

- V1 dispatch state: Kerala (`32`); catalog prices are GST-inclusive.
- Payment methods: Razorpay for online payment and COD as a separate method.
- The business Admin is the named approver for tax categories, HSN/SAC assignments, GST rates, and commerce-policy configuration.
- The development database may use synthetic HSN/SAC identifiers and sample rates of 5%, 12%, and 18%. `V15__demo_only_tax_data.sql` and the `demo` profile remain isolated from the normal database migration path. These values must not be copied into production.

## Working defaults for development

### Shipping

- Keep the current customer charge: ₹79 below a ₹1,499 merchandise subtotal, otherwise free.
- Treat a seller-charged delivery fee as ancillary to the goods for the current single-seller checkout. Include it in the GST value and apply the associated product rate, consistent with the composite-supply treatment described by CGST Act sections 8 and 15 and CBIC's freight FAQ.
- For a cart containing different product rates, allocate the delivery charge across lines in proportion to each line's merchandise value. Allocate whole paise deterministically so the shares always sum to the charged delivery amount. This is an application allocation convention, not a rate-allocation formula prescribed by the cited law.
- The configured inclusive/exclusive price treatment also applies to the stated delivery fee. The current v1 configuration is inclusive, so the displayed ₹79 remains the amount payable and its GST is extracted from that amount.
- This model assumes the seller supplies the delivery as an ancillary part of the goods supply. Finance/tax must approve it for the actual contracts and carrier arrangement before production use; a separately contracted freight service can require different treatment.

### Rounding

- Keep monetary amounts to two decimal places. Round each line's GST to paise using `HALF_UP`; split local GST into CGST and SGST, assigning any paise remainder to SGST. IGST remains a single component. Sum rounded line components for the order and retain paise; do not round the customer invoice total to a whole rupee.
- This is the application's provisional calculation convention and still needs sample-case review by the Admin/tax approver.

### Invoice and credit note

- Generate a goods tax invoice at or before removal/dispatch, from the immutable order snapshot, with a unique serial number per financial year.
- Keep Rule 46 data in scope: supplier name/address/GSTIN; serial number/date; recipient details as applicable; HSN/SAC and description; quantity; total and taxable values; tax rates and amounts; and interstate place of supply/state code. Delivery address is recorded where it differs from place of supply.
- A credit note must reference the original invoice and supply, carry its own serial/date and reason/value/tax adjustments, and follow the currently effective section 34 time limits, tax-adjustment conditions, and registered-recipient ITC rules. Customer refund execution remains a separate payment operation.
- Seller legal name/address/GSTIN, invoice numbering policy, and finance-approved sample documents are not available yet. Do not present an order confirmation as a production tax invoice until those inputs and the dispatch workflow exist.

### Cancellation and returns

- Original development default: allow customer cancellation until dispatch; release an active reservation once and refund paid amounts through the original payment flow. Preserve this saved promise on historical orders. For the new dashboard-managed Shiprocket standard-order workflow approved on 2026-10-20, a new effective policy permits individual-item/quantity self-service cancellation only before confirmed AWB assignment. Later exceptions require Support/Admin handling; shipped items follow the applicable return policy. Backend eligibility must check current provider state and resolve booking races before confirming cancellation, releasing reservations or initiating refunds. The saved dashboard workflow and checkout quote hash enforce this prospective cutoff; see [HLD v1.3](Shiprocket-Integration-HLD.md).
- Keep a seven-calendar-day return window for eligible items as the current storefront promise, measured from delivery; Admin must maintain item/category exclusions and disclose the eligibility and return-shipping cost before purchase. The promise does not limit mandatory rights for defective, deficient, spurious, misdescribed, or (subject to the force-majeure exception in the applicable rule) late-delivered goods.
- India does not supply one universal statutory change-of-mind return window for every product. Consumer Protection (E-Commerce) Rules require clear return/refund/exchange and shipping-cost terms and require take-back/refund in the specified cases. The seven-day window is a configurable business promise, not a statutory default.
- Approved on 2026-10-20 for the new dashboard workflow: automatically accept eligible return requests using the order's saved policy and proven delivered quantities, then create linked reverse orders; staff arrange reverse transport in Shiprocket. Initiate prepaid cancellation refunds only after confirmed removal/cancellation, and prepaid return refunds after warehouse receipt and successful inspection. COD cancellation reduces uncollected payable amounts; COD return refunds retain verified collections and controlled payout approval/evidence. Refund initiation and completed refund are distinct states. Existing exclusions, return-shipping terms and mandatory-rights disclosures remain applicable.
- Automatic standard-order creation, confirmed pre-AWB cancellation/replacement and policy-based reverse creation now extend the existing inspection/refund controls. Local verification and controlled account acceptance are recorded separately in [implementation progress](SHIPROCKET-IMPLEMENTATION.md). Apply changed policy to future orders through effective snapshots rather than rewriting existing promises. On 2026-10-20 the owner clarified one standard Shiprocket order with all remaining items, one parcel estimate and one AWB; MPS/separately shipped boxes are outside this release. Checkout discloses the saved prospective cutoff before order acceptance.

## Approval and release gates

- Current `/api/v1/admin/tax` endpoints and the Admin GST setup panel immediately activate data entered by an authenticated `ADMIN`. For this single-Admin development setup, saving is the Admin's approval action; there is no separate maker-checker queue.
- The Admin may load the synthetic demo values only into the separate demo database. Real product classifications, rates, shipping treatment, invoice samples, credit-note behavior, and rounding cases require approval against actual products and seller records before production checkout is enabled.
- Hosting, production secret manager, notification provider, and named operational owner are undecided and remain Stage 0 launch blockers.
- Production seller registration details/GSTIN and the actual product HSN/SAC/rate table are still missing. Synthetic fixture data is not evidence for either.

## Regulatory references

- [CGST Act (CBIC)](https://cbic-gst.gov.in/hindi/CGST-bill-e.html): sections 8, 15, 31, and 34.
- [CGST Rules, Part A (CBIC PDF)](https://cbic-gst.gov.in/pdf/24092021-CGST-Rules-2017-Part-A-Rules.pdf) and [CBIC tax-invoice rules page](https://cbic-gst.gov.in/gst-invoice-rules.html): invoice and credit-note particulars; confirm later amendments with the tax approver before production.
- [CBIC GST FAQ](https://cbic-gst.gov.in/faq.html): freight/transport/packing inclusion in invoice value and its composite-supply example.
- [Consumer Protection (E-Commerce) Rules, 2020 and amendments (Department of Consumer Affairs)](https://consumeraffairs.nic.in/acts-and-rules/consumer-protection/consumer-protection): disclose return/refund/exchange terms and return-shipping costs; take-back/refund for specified defective, deficient, spurious, misdescribed, or late-delivery cases.
