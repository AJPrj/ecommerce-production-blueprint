# Authentication throttling

Implementation batch 2, 2026-11-10. This is local implementation; deployment and production acceptance remain pending. See [finding status](SECURITY-AUDIT-IMPLEMENTATION.md) and [verification evidence](../output/security-hardening-batch2-20261110/README.md).

## Scope and behavior

`AuthService` checks a durable PostgreSQL budget before password verification or account creation. Customer `/api/v1/auth/login` and staff `/api/v1/auth/admin/login` share the same account, address and global login budgets. `/api/v1/auth/register` has separate address and global budgets. Authenticated `/api/v1/checkout/quote` and `/api/v1/checkout` requests use separate account and trusted-client-address budgets. Administrator image upload start (S3 presign and database upload) and S3 confirmation also have separate actor and trusted-address budgets. These limits run before quote calculation, order/payment/inventory work, signing a presigned request, loading multipart bytes into application memory, or fetching an S3 object. Existing CSRF, authorization and DTO validation run before controller-level upload throttles. Successful and unsuccessful requests consume budgets. Registration's internal automatic sign-in does not consume another login attempt.

Limits use fixed windows based on the database clock. When a budget is exceeded, the service returns generic HTTP 429, `Cache-Control: no-store` and a `Retry-After` value in seconds until that window ends. It does not disclose which budget was exhausted or whether an account exists. There is no persistent account lock or operator unlock requirement. A known account can still be temporarily denied by repeated attempts; short windows and operational monitoring remain necessary. Fixed windows can permit a burst across a window boundary.

Counter updates commit in a separate transaction before authentication/registration. Failed passwords, duplicate registration, subsequent validation failures and registration rollback cannot erase attempts. Public registration starts its business transaction after this check, avoiding an extra held database connection while the independent counter transaction starts. User/profile, saved address and automatic sign-in retain their existing transaction boundary.

If the counter database or transaction cannot be checked, login and registration fail closed with generic HTTP 503, `Retry-After: 1` and `Cache-Control: no-store`. Counter statements have a two-second PostgreSQL statement timeout and a five-second Spring transaction timeout. Connection acquisition also depends on the datasource's configured pool timeout; these values are not a guarantee of total request latency. Existing authenticated sessions and unrelated browsing do not call this limiter.

## Configuration

| Environment variable | Default | Meaning |
| --- | ---: | --- |
| `AUTH_LOGIN_ACCOUNT_ATTEMPTS` | 10 | Shared customer/staff attempts per normalized email slot |
| `AUTH_LOGIN_IP_ATTEMPTS` | 60 | Login attempts per client-address slot |
| `AUTH_LOGIN_GLOBAL_ATTEMPTS` | 600 | Login attempts across this application database |
| `AUTH_LOGIN_WINDOW_SECONDS` | 60 | Login fixed window |
| `AUTH_REGISTRATION_IP_ATTEMPTS` | 20 | Registration attempts per client-address slot |
| `AUTH_REGISTRATION_GLOBAL_ATTEMPTS` | 300 | Registration attempts across this application database |
| `AUTH_REGISTRATION_WINDOW_SECONDS` | 900 | Registration fixed window |
| `AUTH_CHECKOUT_QUOTE_ACCOUNT_ATTEMPTS` | 60 | Checkout quote attempts per normalized customer account |
| `AUTH_CHECKOUT_QUOTE_IP_ATTEMPTS` | 300 | Checkout quote attempts per resolved client address |
| `AUTH_CHECKOUT_QUOTE_WINDOW_SECONDS` | 60 | Checkout quote fixed window |
| `AUTH_CHECKOUT_ORDER_ACCOUNT_ATTEMPTS` | 20 | Order submission attempts per normalized customer account |
| `AUTH_CHECKOUT_ORDER_IP_ATTEMPTS` | 120 | Order submission attempts per resolved client address |
| `AUTH_CHECKOUT_ORDER_WINDOW_SECONDS` | 900 | Checkout order fixed window |
| `AUTH_CATALOG_UPLOAD_START_ACCOUNT_ATTEMPTS` | 30 | Upload start attempts per normalized administrator account |
| `AUTH_CATALOG_UPLOAD_START_IP_ATTEMPTS` | 120 | Upload start attempts per resolved client address |
| `AUTH_CATALOG_UPLOAD_CONFIRM_ACCOUNT_ATTEMPTS` | 60 | S3 confirmation attempts per normalized administrator account |
| `AUTH_CATALOG_UPLOAD_CONFIRM_IP_ATTEMPTS` | 240 | S3 confirmation attempts per resolved client address |
| `AUTH_CATALOG_UPLOAD_WINDOW_SECONDS` | 3600 | Catalog upload fixed window |
| `AUTH_TRUSTED_PROXY_CIDRS` | empty | Comma-separated trusted numeric proxy IP addresses/CIDRs |

Attempt limits must be 1–1,000,000; windows must be 1–86,400 seconds. Invalid values fail startup. These defaults are starting values, not production traffic measurements. Tune with expected staff/customer volume and shared NAT traffic before rollout. Global budgets also mean deliberate saturation can deny new account access for the remaining window.

## Proxy and session rollout gate

The backend explicitly uses `server.forward-headers-strategy: NONE`. The resolver rejects startup if this is overridden to `NATIVE` or `FRAMEWORK`: it needs the actual socket peer, before framework/container rewriting, to decide whether forwarding metadata is trustworthy.

By default, forwarding headers have no effect and the socket address is used. Only a socket peer within `AUTH_TRUSTED_PROXY_CIDRS` permits evaluation of `X-Forwarded-For`. The resolver walks from the rightmost hop toward the client, stopping at the first untrusted hop; an attacker-controlled prefix before that hop cannot rotate the budget. Invalid, missing or oversized trusted suffixes fall back to the peer. `Forwarded` and `X-Real-IP` do not establish identity. Numeric IPv4/IPv6 addresses are canonicalized without hostname lookup. Trust-all `/0`, hostnames and invalid CIDRs fail startup.

Before deployment:

1. Establish the actual backend TCP peer addresses and every forwarding proxy hop. Configure only the required proxy IPs/CIDRs; a private address range alone does not prove that every host in it is a trusted proxy.
2. Confirm ingress strips or safely appends forwarding headers, and restrict direct access to the backend. Test a real request and a forged `X-Forwarded-For` through that chain. With no trusted proxy configured, customers behind the same proxy share its address budget.
3. Coordinate this change with the TLS/session configuration. Automatic forwarded scheme/host rewriting is disabled. If production previously relied on `NATIVE`/`FRAMEWORK` for HTTPS recognition, secure cookies, redirects or generated URLs, review those behaviors before rollout. This batch does not establish a complete trusted scheme/host policy or prove production cookie flags. Configure production session cookies appropriately and capture the real `Set-Cookie` attributes over HTTPS.
4. Verify legitimate customer/staff sign-in, registration with a saved Indian address, password recovery, sign-out, session rotation and checkout in the deployed topology. Do not use production load tests to exhaust shared limits.

Password recovery now uses this same trusted-address resolver; its existing recovery-specific counters, generic responses and token behavior remain in place. Inspect its rate behavior behind the real proxy as well.

## Persistence and monitoring

Forward-only Flyway V55 creates `authentication_request_throttles`; V56 adds four bounded checkout scopes. V57 introduced catalog-upload scopes, but its account-scope names exceeded the existing `VARCHAR(24)` width. V58 adds shorter catalog-upload scopes that fit the column; the application uses these names. Existing migration history and counter rows remain forward-only. The table stores scope, a numeric slot, window start and a capped counter, without raw email or client address. Email is trimmed and lowercased with `Locale.ROOT` for budget identity only; account authentication and registration normalization contracts are unchanged.

SHA-256 selects one of 65,536 slots per non-global scope. Eleven hashed scopes and two global rows bound the table at 720,898 rows; expired slots are reused. Hash collisions deliberately share a budget, so unrelated accounts/addresses can occasionally affect each other. Slots are not reversible anonymization or an audit log. PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` provides atomic cross-instance counters. The two existing authentication global rows serialize quota updates; checkout and upload budgets have no global hot row. Measure lock/connection pressure before changing traffic limits substantially.

Micrometer counter `commerce.auth.throttle` has only `operation=login|registration|checkout_quote|checkout_order|catalog_upload_start|catalog_upload_confirm` and `result=allowed|limited|unavailable` tags. No emails, addresses, passwords or database exception details are added to responses or these metrics. Alert on sustained unavailable results and unexpected limit rates; application-wide request/access logging must still be reviewed separately.

## Verification and rollback

Dedicated PostgreSQL integration tests use low explicit budgets to exercise shared endpoints, normalized identities, spoofed headers, concurrent instances, registration rollback, expiry and fail-closed database behavior through the real Spring security chain. Other business regression runs retain the real limiter but set generous **test-only** budgets of 100,000 attempts to avoid exhausting the shared loopback address while testing commerce. Those overrides are confined to `gradle/test-services.gradle` and the QA runner, not production application defaults.

See the evidence report for executed versus pending checks. Before release, run the focused backend selection against disposable PostgreSQL/Redis and confirm successful packaging and formatting. The frontend already displays server ProblemDetail messages; regressions cover 429/503 display without authentication or automatic retry.

Deploy the backend with V55 and coordinated proxy/session settings; no frontend API contract change is required. For an application rollback, keep V55 and its data in place rather than editing Flyway history. The older application will ignore the table but lose these protections. Do not erase counters or disable checks as routine incident recovery; investigate availability/traffic and make an explicit operational decision.

Open scope: public catalog-read and webhook abuse budgets, administrator MFA, complete trusted scheme/host handling and production secure-session verification. Checkout and upload budgets are implemented but require integration and production traffic verification; idempotent checkout retries count toward their budgets. Multipart bytes are parsed by the servlet container before controller throttling, so edge/proxy body limits remain necessary to constrain unauthenticated transport and temporary-file use. SEC-04 and SEC-08 remain partial.

References consulted 2026-11-10: [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [Spring forwarded-header guidance](https://docs.spring.io/spring-framework/reference/web/webmvc/filters.html#filters-forwarded-headers), [PostgreSQL INSERT concurrency semantics](https://www.postgresql.org/docs/16/sql-insert.html).
