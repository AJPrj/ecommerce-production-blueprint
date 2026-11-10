# Storefront delivery location

The header uses the existing primary blue theme. Guests enter a six-digit Indian
PIN without signing in or supplying an address. No location is hardcoded. Manual
PINs have no inferred city; address choices use their saved city and optional
Home/Work label. There is no automatic IP/GPS lookup or geolocation prompt.

Guests see a location icon and “Update location” in the header; a selected guest
PIN is shown above it. Clicking opens a centered “Choose your location” dialog
with a prominent primary-blue sign-in button, an Indian PIN divider and inline
PIN/Apply controls. Customers see their saved address cards with the current
selection and default-address indication, an address-management link and the
same manual PIN controls. The dialog supports close, Escape, backdrop dismissal,
focus containment and focus restoration; longer address lists scroll within it.

## Resolution and persistence

After authenticated session restoration, the browser resolves:

1. An explicit selection in the current tab session.
2. The signed-in customer's saved delivery preference.
3. Their explicitly designated default shipping address.
4. A valid guest PIN previously saved in this browser.
5. Otherwise no selected location: “Update location” for guests and “Enter PIN
   code” for authenticated customers.

Address-list ordering is not a default-address rule. Existing addresses are not
assigned a label or default automatically. Customers can explicitly set optional
labels and the default shipping flag in their existing address editor.

New registrations with country `India` (`IN`/`IND` also accepted) save the supplied
delivery details into `customer_addresses` in the same transaction as the account.
Canonical Indian state names are matched without case sensitivity and converted
to the existing two-digit codes; codes are accepted directly. Both street lines
are retained in the saved street field. The address is validated against the
address-book contract before session creation; invalid Indian details roll back
the registration. Registration does not assign a label, default shipping flag or
delivery preference. International registration remains profile-only because the
current address book supports Indian shipping addresses.

Earlier registrations wrote only the legacy `users` profile fields. This fix does
not automatically backfill those fields or restore addresses that a customer may
have deleted. Affected customers can add their address through Saved addresses.
No schema migration is required; deploy the updated backend for new registrations.

Guest localStorage contains only `{postalCode}`; old free-text city values are
discarded. sessionStorage keeps only the minimal PIN/address reference and its
account scope for current-session precedence across refreshes. Full saved
addresses remain in server storage and authenticated in-memory state. Blocked
browser storage does not prevent selection during the visit.

A guest's explicit PIN survives login and takes precedence over account defaults.
It does not silently overwrite the existing server preference; subsequent
authenticated selections save that preference. Customer selections never write
guest storage. Logout/account switches immediately clear customer address state,
abort pending reads/writes, and discard late responses. A failed preference save
keeps the selection for this visit and offers retry. Address/preference load
failures are presented with retry while manual PIN entry remains available.

## Backend contracts and migration

V52 extends `customer_addresses` with nullable `label` (40 characters) and
`default_shipping` (false initially). A partial unique index permits one default
per customer. Existing address create/update APIs accept optional `label` and
`defaultShipping`. Omitting these fields preserves existing settings on updates;
an empty label explicitly clears it. Setting a new default is serialized on the
customer row and clears the previous flag. Merely selecting an address never
changes the default.

V52 retains its originally applied checksum, `829407228`. Redundant address-owner
index cleanup is a separate forward-only V53 migration; the V52 composite unique
constraint retains ownership enforcement and indexed reads. Do not edit an
already applied V52 or repair its checksum to accommodate this cleanup.

`GET /api/v1/customers/me/delivery-location` returns `{addressId, postalCode}`,
with both null if no preference exists. `PUT` accepts exactly one nonnull value:
an owned address UUID or a PIN matching `[1-9][0-9]{5}`. Reads and writes require
the CUSTOMER role; writes use existing CSRF protection. The authenticated actor
determines ownership. Foreign address references return 404. Preference responses
and address reads use `Cache-Control: no-store`.

`customer_delivery_preferences` stores one row per customer containing a reference
or a manual PIN, never a copied address. Its composite foreign key also enforces
address ownership in PostgreSQL. Deleting the selected address removes its
preference; subsequent resolution uses the remaining default/guest fallback.
Manual PIN changes do not create/update customer address records. Historical
orders and their delivery snapshots are unaffected.

## Product delivery and checkout

The shared PIN seeds the existing product/SKU/quantity serviceability checker.
Changes cancel and discard stale delivery results. Header PIN-format validation
is not a delivery promise. Existing Shiprocket estimates and error handling remain
authoritative for item availability, and no header action books a shipment.

Checkout prefills a selected saved address, including its state for server quote
calculation. A manual PIN fills only the PIN; city, state, street and recipient
details must still be confirmed. Untouched forms accept late address resolution.
Once checkout is edited, a later header change keeps the draft and offers an
explicit “Use selected delivery location” action. Existing quote review,
idempotency, payment recovery and immutable order snapshots remain in place.
Selection does not change shipping fees or add checkout serviceability gates.

Deploy/restart the matching backend first to apply V52/V53 and expose the additive
contracts, then deploy/refresh the frontend. No provider settings or credentials
change, and the migration does not invent defaults for existing customers.
