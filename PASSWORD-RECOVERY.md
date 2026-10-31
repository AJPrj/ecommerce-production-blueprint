# Customer password recovery

The customer sign-in dialog offers **Forgot password?**. The standalone
`/forgot-password` page accepts the customer's account email; the email opens
`/reset-password`, where the customer enters and confirms a new password.
Successful recovery returns to sign-in and revokes existing sessions.

## Brevo and application configuration

Recovery reuses the backend's existing `SMTP_*` connection, including Brevo SMTP
credentials. It does not require a separate Brevo API integration or a hosted
email template. The recipient is the eligible customer's registered email,
independent of the configured Admin order-notification recipient.

Set these in the environment used to start the backend:

```dotenv
PASSWORD_RESET_ENABLED=true
PASSWORD_RESET_URL=http://localhost:5173/reset-password
```

For a hosted storefront, replace the URL with its HTTPS reset page, for example
`https://shop.example.com/reset-password`. Use the storefront origin the customer
can actually open. Recovery is disabled by default. The sender defaults to the
existing `ADMIN_ORDER_EMAIL_FROM`; optionally set `PASSWORD_RESET_EMAIL_FROM` to
another provider-verified sender. The existing SMTP username and password stay
server-side.

The workspace's `backened-start.bat` invokes `backend-start.ps1`, which loads
`java-ecommerce-app_latest.env`; set the options in that environment file when
using this launcher. A different launch command must receive the same variables
in its own process environment. Rebuild/restart the backend to apply Flyway
`V48__customer_password_recovery.sql` and configuration, and refresh the frontend.

No provider account settings or existing credentials need to change. Live Brevo
delivery must be verified separately using a mailbox controlled by the tester.

## API contract

Both endpoints are public and retain the existing session-bound CSRF protection.
Use `GET /api/v1/auth/csrf` and the returned `X-CSRF-TOKEN` for mutations, as the
shared frontend client already does. Responses must not be cached.

`POST /api/v1/auth/forgot-password` accepts:

```json
{"email":"customer@example.com"}
```

Accepted requests return `202` and the same message for eligible, unknown,
inactive and non-customer accounts:

```json
{"message":"If an account exists for this email, you will receive a password reset link."}
```

Only an active account with the `CUSTOMER` role is eligible for customer recovery.
Malformed input is rejected. Request throttling protects the public endpoints
and limits repeated delivery to a mailbox without revealing account existence.
Forgot requests allow ten per source IP and 500 globally per 15 minutes;
mailbox requests allow three per 30 minutes and silently suppress further
delivery while returning the same `202`. Reset submissions allow twenty per
source IP and 1,000 globally per 15 minutes. IP/global limits return `429` and
`Retry-After: 900`. Limits use the socket remote address rather than trusting
arbitrary forwarded headers. Deployments must configure their trusted proxy
boundary correctly to avoid grouping all traffic under one source address.
Disabled recovery and a saturated delivery queue return `503` for all accounts.

`POST /api/v1/auth/reset-password` accepts:

```json
{"token":"<token from email>","newPassword":"<new password>"}
```

Successful recovery returns `204`, without signing the customer in. Invalid,
expired, already used or superseded links fail without changing credentials.
The customer must request another link. Password validation follows the existing
six-character minimum and bcrypt's maximum of 72 UTF-8 bytes. The UI also requires
password confirmation.

## Tokens, concurrency and delivery

Reset links contain cryptographically random, URL-safe tokens and expire after
30 minutes. Only token hashes and the issuing authorization version are stored
in PostgreSQL. `V48` adds `customer_password_resets` (at most one token per user)
and fixed, bounded `password_reset_throttles` slots. Throttle keys are hashed;
slot collisions conservatively share limits rather than growing storage with
arbitrary email addresses or source IPs. User-row locking and version checks
prevent simultaneous use from changing the password twice. A successful reset increments `auth_version`,
invalidating older sessions and outstanding recovery links. An ordinary
authenticated password change also makes older recovery links unusable.

The configured reset-page URL is trusted application configuration; request
Host or forwarded headers cannot select the email destination. Hosted URLs use
HTTPS. Loopback HTTP is allowed for development. Email links use
`/reset-password#token=...`; fragments do not enter HTTP request paths or access
logs. The page captures the token in component memory and removes the fragment
from the address bar. It never puts the token in browser storage.

Recovery email uses a bounded asynchronous queue so provider response time does
not disclose whether an account exists. This queue is deliberately non-durable:
a process restart, queue overload or SMTP failure can require a fresh recovery
request. Tokens and email bodies are not persisted in an outbox. This limited
trade-off applies to replaceable short-lived recovery messages; durable order
notifications retain their existing transactional outbox and retry semantics.
Failures must expose only safe diagnostic codes, without email addresses,
passwords, tokens or provider exception details. The
`commerce.password.reset.delivery` meter records sent messages, rejected queue
submissions, delivery failures and failed cleanup with fixed result values.

The implementation does not configure or exercise a live provider as part of
automated verification. Tests replace SMTP delivery and use an isolated local
database. Browser layout acceptance is recorded separately from component/API
test results in the implementation tracker.

The token, response and session controls follow the
[OWASP password recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Accepted request but no email

The green confirmation means the API accepted a request. SMTP delivery happens
asynchronously; it is not proof of mailbox delivery. Unknown, inactive,
staff-only or ambiguous accounts receive the same response without email.
The same response also applies after the three-request mailbox limit within a
fixed 30-minute window. Allow the window to pass before repeated testing.

For the hosted Render deployment, edit the **Java backend service's Environment**
settings, then save/redeploy. The workstation's environment file does not update
Render's process environment. The deployed frontend reset URL is:

```dotenv
PASSWORD_RESET_ENABLED=true
PASSWORD_RESET_URL=https://react-ui-ecommerce-app-latest.onrender.com/reset-password
```

[Render's Free service documentation](https://render.com/docs/free) lists blocked
outbound SMTP ports 25, 465 and 587. If the Java backend uses the Free tier and
port 587, this is a likely connection failure. Brevo documents port 2525 as an
alternative for restrictive hosting networks in its
[SMTP troubleshooting guide](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP).
Try the following settings on the backend and retain the existing SMTP login,
SMTP key and verified sender:

```dotenv
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=2525
SMTP_AUTH=true
SMTP_STARTTLS_ENABLED=true
SMTP_STARTTLS_REQUIRED=true
```

Reachability from this specific deployed service still needs verification; a
local connection test does not prove that Render can connect. If port 2525 is
also unavailable, an explicit Brevo HTTPS API adapter or a host with SMTP access
is a separate option. This application currently sends through SMTP.

In the backend's Render logs, search for `Password recovery operation failed`.
Failure entries include fixed `stage` and `reason` values, such as
`stage=email_delivery reason=connection_timeout` or
`stage=email_delivery reason=authentication_failed`. Reasons also distinguish
connection failures, invalid email, provider rejection, database failures,
generic send failure and queue capacity, with `other` for unrecognized failures.
No exception messages or stack traces enter these recovery log entries.
Existing `commerce.password.reset.delivery{result}` counters are preserved;
`commerce.password.reset.failure{result,stage,reason}` adds bounded diagnostics.
`commerce.password.reset.outcome{result}` separately counts suppressed mailbox
limits, absent/ambiguous account snapshots and ineligible accounts. These are
aggregate operator metrics; public responses do not reveal those distinctions.

In **Brevo > Transactional > Logs**, filter by the recipient and request time.
No Brevo event suggests the message was skipped or could not reach/authorize
with the relay; a delivered, blocked, deferred or bounced event distinguishes
provider/mailbox handling. Check the configured SMTP login and SMTP key,
provider-verified sender and remaining email credits when indicated by those
logs. Do not expose provider responses, credentials or reset links publicly.
