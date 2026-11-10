# Product-page delivery availability

The product PIN-code checker uses the existing backend Shiprocket adapter rather
than displaying a fixed success message. The browser never receives a provider
token, login credentials, pickup address or courier purchase rate.

## Public API

`GET /api/v1/public/shipping/serviceability?productId=<uuid>&variantId=<uuid>&quantity=2&postalCode=560001`

All four parameters are required. The route permits anonymous read-only checks.
The product must be active, published and not deleted; the selected variant must
belong to that product. Quantity must be 1–50 and not exceed available SKU stock.
PIN codes must match `[1-9][0-9]{5}`.

Example response:

```json
{
  "postalCode": "560001",
  "deliveryAvailable": true,
  "prepaidAvailable": true,
  "codAvailable": false,
  "earliestEstimatedDelivery": "2099-11-12"
}
```

The date above is illustrative. Each payment availability value can be `null`
when that provider lookup failed. Positive availability for either mode is enough
to report delivery available. Successful empty results for both modes mean
delivery unavailable. An empty result for one mode and failure for the other is
inconclusive and returns 503. Provider errors are never presented as proof that a
destination cannot be served. A usable future/today provider `etd` is normalized
to an ISO date; missing, malformed and past dates are omitted. The displayed
earliest date is an estimate among returned couriers, not an express promise or
a booking commitment.

400 indicates invalid PIN, quantity or variant selection; 404 indicates a
nonpublic/missing product; 429 indicates the local lookup budget/concurrency
limit; 503 indicates unavailable configuration, incomplete package data or an
inconclusive provider result. Public failures use safe application messages.
Responses use `Cache-Control: no-store`.

## Server calculation and provider calls

Catalog price, stock and measurements come from the backend. Multi-SKU products
must supply complete measurements on the selected variant. Single-SKU products
retain the existing product-measurement fallback when no variant measurement set
exists; partial variant sets cannot borrow product fields. The existing packet
and outer-carton planners apply quantity, clearance, protection allowance, box
presets or material-based carton estimates. Missing configuration or unsupported
parcel limits produce an unavailable lookup, without guessed weights.

Two read-only calls to Shiprocket's Courier Serviceability API use the configured
pickup PIN and calculated parcel: one for prepaid (`cod=0`) and one for COD
(`cod=1`). No provider order, shipment or AWB is created. Existing customer
delivery-charge rules stay authoritative; provider courier costs are not exposed
or substituted for the checkout charge.

Each instance bounds traffic to four concurrent checks and 60 uncached checks
per minute. A bounded 256-entry cache retains successful conclusions for up to
60 seconds, keyed by provider request inputs including pickup, parcel and declared
value. Failures that prevent a conclusion are not cached. These are instance
limits, not a distributed perimeter rate limiter.

## Configuration and UI behavior

Use the existing backend `SHIPPING_PROVIDER_MODE=LIVE`, `SHIPROCKET_EMAIL`,
`SHIPROCKET_PASSWORD`, `SHIPROCKET_PICKUP_LOCATION` and
`SHIPROCKET_PICKUP_POSTCODE` settings. Disabled/unconfigured and development MOCK
modes never advertise public delivery success. Existing packaging settings and
published SKU measurements are required. No schema migration or new secret is
introduced. Deploy the matching frontend and backend together.

The storefront header accepts a guest PIN or an authenticated saved-address
choice, following [delivery preference priority](DELIVERY-LOCATION.md). It makes
no coverage claim or geographic inference. The product checker starts with the
resolved PIN when present. Changing the header PIN cancels/discards any previous
item lookup and updates the field; editing the product field alone remains local
to that item. Checkout prefills the selection and protects edited delivery drafts.

The UI supports Enter to submit, loading, retryable failure, no service, missing
date and unknown COD states. Editing the PIN clears the old result. Changing SKU
or quantity cancels/discards the previous lookup while retaining the typed PIN;
product navigation restores the header preference (or clears it if none is saved).
Results describe the selected product quantity,
not the whole cart. The lookup is advisory and adds no checkout serviceability
enforcement. Courier coverage and estimates can change before dispatch.

Official contract: [Shiprocket Courier Serviceability API](https://apidocs.shiprocket.in/).
