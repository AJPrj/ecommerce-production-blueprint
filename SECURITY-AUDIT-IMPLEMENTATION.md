# Security audit and implementation plan

Assessment date: 2026-11-10 (Asia/Calcutta)  
Mode: source audit plus incremental local implementation. Batch 1 is implemented; deployment gates remain open.  
Skill: `ecommerce-security-hardener` and its controls/verification references.  
Related requirements: [Security blueprint](08-security.md), [production checklist](15-production-readiness-checklist.md), [password recovery](PASSWORD-RECOVERY.md).

## Implementation status — batch 1 (2026-11-10)

The original audit below is retained as assessment history. Current local implementation supersedes its original not-run/open results only for the controls explicitly listed here. Nothing has been deployed or applied to the application database.

| Finding | Current status |
| --- | --- |
| SEC-01 | Implemented: forward-only V54 retires the seed, revokes its authorization version and preserves history. Operator-only one-use JDBC bootstrap provisions a unique named ADMIN; reactivation through staff status is denied. Fresh/upgrade/concurrency/session checks pass. Operator rollout remains required. |
| SEC-02 | Implemented: validated exact origins through Spring configuration, empty allowlist means same-origin only, duplicated controller wildcard policies removed. Real-filter allowed/denied-origin and legitimate-login tests pass. Production origin values still require verification. |
| SEC-03 | Partial: workspace development Compose uses loopback-only published ports. Production private networking, Redis ACL/TLS and separate DB roles remain open. |
| SEC-05 | Implemented: Nginx upstream certificate verification, explicit CA bundle and chain depth. Local fixtures accept trusted certificates and reject untrusted/wrong-host/expired certificates. Actual deployed certificate chain remains a release gate. |
| SEC-10 | Implemented: management routes require ADMIN; detailed health is restricted. Real-filter anonymous/customer denial and administrator access pass, including real Prometheus enabled in the test context. Monitoring rollout remains required. |
| SEC-12 | Partial: Docker contexts exclude environment files and common private-key formats. Advisory/SBOM/image/secret CI gates, dependency verification and immutable references remain open. |
| SEC-04/06/07/08/09/11 | Open; not silently claimed as fixed by this batch. |

See [administrator bootstrap and rollout](ADMINISTRATOR-BOOTSTRAP.md) before applying V54. No applied migration was edited. Existing registration/address and storefront work was preserved. Test/QA administrators now use synthetic identities rather than the production migration seed; the QA runner explicitly configures its own loopback origin.

Local verification and exact run outcomes are recorded in [batch evidence](../output/security-hardening-20261110/README.md). The original audit's restricted Git/Docker/cache failures were overcome for implementation by authorized local test execution with the existing Gradle cache and owned disposable PostgreSQL/Redis services. They remain historical audit limitations, not current test failures.

Verification: the 68-case focused backend selection passed across the broad run and corrected management-test rerun; two additional migration-upgrade cases passed in the initial batch. Packaging, scoped formatting, 55 QA tooling tests, 4 TLS fixtures and 9 focused HTTP API checks pass. The full 171-case API diagnostic recorded 151 passes and 20 failures; the focused rerun resolved the two staff-fixture failures, while the remaining 18 address/commerce/catalog assertions remain unverified against a corrected baseline. Do not treat this batch as full API release sign-off.

## 1. Decision and scope

The first release gate is retiring the development administrator installed by the default migration chain. Next, verify production origins and data-service isolation, add authentication abuse controls, and correct proxy/session configuration. Existing CSRF, ownership, payment verification and commerce transaction controls should be preserved and regression-tested during this work.

This is an assessment of the files currently present, including uncommitted work. It is not a deployed penetration test, a complete dependency audit, or a compliance certification. Severity describes realistic impact **when the stated prerequisites hold**; it does not assert that the production environment has those prerequisites.

Assessed:

- `java-ecommerce-app`: Java/Spring build, security filter chain, identity/session/password recovery, controller role boundaries, customer ownership paths, cart/checkout pricing, Razorpay confirmation/webhooks, cancellation/refund entry points, shipment callbacks/documents, image uploads, Flyway migrations, logging, Dockerfile and publishing workflow.
- `react-ui-ecommerce-app`: manifest/lockfile, authentication store, credentialed Axios/CSRF handling, production Nginx files, payment script origin, dangerous HTML/JavaScript sink search, Dockerfile and publishing workflow.
- Workspace `docker-compose.yml`; blueprint security requirements; environment **variable names only** from `.env` and `java-ecommerce-app_latest.env`. No credential values are reproduced here. Environment file presence is not proof of a committed or deployed secret.
- Existing test source for security failures, Redis sessions, registration, password recovery, admin identity, checkout/payment races, invoices, and uploads. Test existence is distinguished from tests executed below.

Unavailable or incomplete evidence:

- No deployed ingress/firewall rules, actual production origins, backend reachability, TLS/cookie captures, DB grants, Redis ACLs/eviction policy, secret-manager policy, image digests, backup restore evidence, or operational alert configuration were verified.
- Git status was attempted for backend, frontend and blueprint repositories, but Git rejected ownership checks even with command-local safe-directory configuration. No global Git configuration was changed; application source was left untouched.
- Docker inspection failed because the local Docker configuration was inaccessible; a second CLI attempt also failed. PostgreSQL/Redis integration tests were not started.
- Offline Gradle dependency inspection completed with unresolved artifacts, including PDFBox and the WebP plugin. Its successful task exit is **not** evidence of a fully resolvable or buildable application.
- No full history secret scan, npm advisory scan, complete JVM advisory matching, container scan, production load test, live payment/refund, or customer notification was performed. Inaccessible generated tool directories under `tmp` were outside the application audit scope.

### Observed stack

| Component | Evidence / version |
| --- | --- |
| Backend | Java 21; Spring Boot plugin `4.1.1`; Gradle wrapper `9.7.1` in `build.gradle` / wrapper properties |
| Partial offline resolution | Spring Framework `7.0.9`, Spring Session/Data Redis `4.1.1`, PostgreSQL JDBC `42.7.13`; incomplete graph |
| Frontend lockfile | React/React DOM `19.3.0`, Vite `8.3.2`, Axios `1.20.0`, React Router DOM `7.18.4`, Vitest `4.1.11` |
| Data services | Compose tags `postgres:16-alpine`, `redis:7-alpine`; deployed patch versions unknown |
| Runtime images | Backend Temurin 21; frontend Node 22 builder and floating `nginx:alpine` runtime |
| Credentials | Spring Session Redis cookie authentication, not JWT; browser uses `withCredentials` and a CSRF header |
| Payments / shipping | Custom HTTP Razorpay client, Shiprocket client, isolated sandbox adapters; no payment SDK dependency assumed |

The blueprint README still describes Spring Boot 3.x. Implementation must follow the actual Boot 4.1.1 code and resolved dependency versions, with the architecture baseline updated in a separate maintenance change.

## 2. Prioritized findings

The table and finding narratives record the original assessment. Consult the implementation-status table above for current fixes and remaining work. **V** = confirmed source/configuration vulnerability; **H** = hardening improvement; **D** = deployment concern awaiting verification. Confidence applies to the evidence, not to an assumed production exploit.

| ID | Severity / confidence | Type | Evidence | Impact and prerequisite | Priority |
| --- | --- | --- | --- | --- | --- |
| SEC-01 | Critical / high | V | Default Flyway V7 and V14 | Admin takeover if the seeded identity retains its documented development credential | P0 |
| SEC-02 | High / high | V, conditional | `SecurityConfig.java:149`; `AuthController.java:21` | Untrusted hosted origins accepted when production CORS allowlist is missing; authenticated abuse additionally requires browser credential delivery | P1 |
| SEC-03 | High / high | V in supplied Compose; D for production | Workspace `docker-compose.yml:7,20`; `application.yml:4` | Published data-service ports, no Redis authentication configured, fallback DB credentials if this configuration is used on a reachable host | P1 |
| SEC-04 | High / high | H; source control gap confirmed | `AuthService.java:68,79,130`; `PasswordResetThrottle.java:16` | Login/admin-login/registration have no application throttle; guessing and password-hash resource abuse if no upstream limiter | P1 |
| SEC-05 | Medium / high | V, conditional | `nginx.conf.template:17`; `nginx.conf:17` | HTTPS upstream certificate is not verified; requires an attacker able to interfere with that network path | P1 |
| SEC-06 | Medium / high | V, conditional | `SecurityConfig.java:114`; `RedisSessionConfiguration.java:10` | Two-session policy is per JVM and can be exceeded across replicas or after a restart | P2 |
| SEC-07 | Medium / high | H | `RegisterRequest.java:9`; `LoginRequest.java:9`; `CustomerAccountController.java:50` | Weak/inconsistent password enrollment and missing field bounds; registration also reveals existing email addresses | P2 |
| SEC-08 | Medium / medium | D | `RedisSessionConfiguration.java:10`; `nginx.conf.template:22` | Cookie security and reliable client-IP attribution depend on an unverified proxy/TLS chain | P1 verification |
| SEC-09 | Medium / high | H | Frontend `nginx.conf.template`; backend `SecurityConfig.java` | No explicit document CSP/referrer/permissions policy in inspected serving configuration | P2 |
| SEC-10 | Low / high | V; deployment reachability unverified | `application.yml:126,129`; authenticated fallback in `SecurityConfig.java` | Any signed-in customer can reach exposed management endpoints if the backend route is reachable | P2 |
| SEC-11 | Low / high | H | `S3CatalogObjectStorage.java:56,167` | S3 upload confirmation checks magic bytes rather than decoded image validity/dimensions; admin-only path | P2 before S3 enablement |
| SEC-12 | Medium / high | H; advisory exposure unverified | Both `.github/workflows/docker-publish.yml`, Dockerfiles, dependency configuration | Release pipeline lacks explicit advisory/secret/image gates; no specific exploitable CVE established | P2 |

### SEC-01 — Retire the seeded administrator safely

**Evidence:** [V7](../java-ecommerce-app/src/main/resources/db/migration/V7__dummy_admin_user.sql#L1) inserts an active user and assigns ADMIN. [V14](../java-ecommerce-app/src/main/resources/db/migration/V14__repair_seed_admin_password.sql#L1) sets a fixed BCrypt hash for the development account. `CustomUserDetailsService.java:22` loads it through normal authentication. `RedisSessionConfigurationIntegrationTest.java:35` relies on that migration-created identity. No subsequent retirement migration was found. Values are deliberately omitted here.

**Prerequisite / impact:** A database migrated through this chain with the seeded credential unchanged permits a source-informed attacker to authenticate as an administrator. A production operator may already have rotated or disabled it; that was not checked.

**Implementation:** Add the next available forward-only migration or a controlled retirement command; do not edit applied V7/V14 or repair checksums. First establish and verify a separately provisioned named administrator. Retire the known seed by its stable identity after checking its current state, disable it and increment `auth_version` so old sessions fail. Preserve order/audit foreign-key references. Provision future administrators through an operator-only, one-use bootstrap mechanism with an externally supplied unique credential; do not add a public bootstrap route or another fixed password. Move test identity creation into test fixtures; reserve demo accounts for isolated demo databases.

**Safe reproduction / acceptance:** On a disposable migrated database only, prove the legacy migration-created login succeeds before remediation. After remediation, prove it fails, an already established seed session fails, and the named replacement administrator can perform an intended admin operation. Cover fresh install and upgrade from V53/current latest, Flyway validation, and last-admin protections. **Result: source-confirmed; runtime reproduction not run.**

**Compatibility / rollback:** Coordinate bootstrap before retirement to avoid losing administrative access. Keep retirement forward-only; never roll back by re-enabling the published development credential. Review relevant security events if the identity was used on a reachable installation. Any actual credential exposure requires rotation, not just removal from a file.

### SEC-02 — Make credentialed CORS fail closed

**Evidence:** [SecurityConfig.java:149](../java-ecommerce-app/src/main/java/com/company/ecommerce/identity/config/SecurityConfig.java#L149) uses `CORS_ALLOWED_ORIGINS` when nonblank; otherwise it trusts all `https://*.onrender.com` plus arbitrary localhost/loopback ports with credentials. Auth, catalog, cart, checkout and order controllers also declare those patterns. `/auth/csrf` returns a session CSRF token. The environment inventory includes the allowlist variable name; its deployed value was not verified.

**Prerequisite / impact:** An attacker controls an origin accepted by that fallback. It can make permitted cross-origin calls; reading a victim's token/data or submitting authenticated mutations additionally requires the browser to send the API session cookie. SameSite and third-party-cookie restrictions can prevent this and must be tested. CSRF remains enabled but does not compensate for intentionally trusting the attacker's credentialed origin. Spring documents this trust boundary in its [CORS reference](https://docs.spring.io/spring-framework/reference/web/webmvc-cors.html).

**Implementation:** Bind exact origins through validated Spring configuration. Require an explicit finite allowlist in production, or disable cross-origin access for a same-origin proxy deployment. Keep development origins in a development profile. Remove duplicated controller CORS annotations and maintain one policy. A restrictive global security CORS source can already reject a request before MVC; the annotations are **not** claimed to bypass a correctly configured filter allowlist.

**Safe reproduction / acceptance:** Use synthetic sessions against a local API; test preflight and actual requests from an owned production-like origin, an unrelated hosted origin, `null`, and wrong scheme/port origins. Fetch the real CSRF token and try a mutation only with a synthetic account. Denied origins must receive no usable credentialed CORS permission; allowed login/cart/checkout must work. Test both configured and missing configuration. **Result: source-confirmed fallback; exploit not executed.** Roll back only to another explicit valid origin list.

### SEC-03 — Isolate PostgreSQL and Redis; separate runtime privileges

**Evidence:** [Workspace Compose](../docker-compose.yml#L7) publishes PostgreSQL and Redis without loopback bindings. Its Redis service declares no password/ACL/TLS settings. DB credentials fall back to a common development account; [application.yml:4](../java-ecommerce-app/src/main/resources/application.yml#L4) does likewise. In contrast, `gradle/test-services.yml` deliberately binds disposable test services to loopback. Production environment variable names include Redis username/password/TLS and database settings, so production may already differ.

**Prerequisite / impact:** The supplied configuration is used on a host reachable by an untrusted client and host/Docker/network policy allows access. Redis stores authentication sessions and cart state; unauthorized access could compromise those controls. Database compromise affects customer and commercial records. Binding configuration alone does not prove Internet exposure or successful Redis access; image protected-mode behavior and firewall rules remain untested. [Redis security guidance](https://redis.io/docs/latest/operate/oss_and_stack/management/security/) supports network isolation plus authentication.

**Implementation:** Mark workspace Compose development-only and use `127.0.0.1` bindings where host access is necessary. Production should use private service networking and explicit non-default credentials without published host ports. Separate application and Flyway roles; remove runtime schema-owner/superuser privileges after checking actual grants. Configure purpose-scoped Redis ACLs, trusted TLS where applicable, session namespace/memory policy and outage alerts. Never flush shared Redis or revoke live grants as an audit action.

**Safe reproduction / acceptance:** In a disposable setup, inspect published bindings and attempt only benign `PING` / connection checks from an unauthorized test client. Unauthenticated Redis and unauthorized DB connections must fail; the app must retain required session/cart and migration behavior. Review deployed ingress, role memberships, Redis ACLs and TLS independently. **Result: unsafe configuration confirmed; deployed exposure not verified.** Roll out network and credential changes with a coordinated application connection update and a reviewed connectivity rollback.

### SEC-04 — Extend abuse protection beyond password recovery

**Evidence:** Normal login, admin login and registration call authentication/BCrypt/persistence directly in [AuthService.java:68](../java-ecommerce-app/src/main/java/com/company/ecommerce/identity/application/AuthService.java#L68). Only password recovery has the inspected durable atomic throttle. Public cart/CSRF requests can create session state. No application-wide limiter was found; an external edge limiter was not assessed.

**Implementation:** Add bounded, distributed limits to customer/admin login and registration, with account and trusted-client-IP dimensions plus a global budget. Use short cooldowns and generic errors rather than permanent victim-account lockouts. Reuse the existing PostgreSQL atomic-counter approach where appropriate, or use atomic bounded Redis operations; define outage behavior explicitly. Apply resource budgets to public session creation, checkout/payment initiation, coupon attempts and upload processing according to operation cost. Provider webhook limits must preserve legitimate retries. Add MFA/step-up for sensitive staff operations as a separately scoped enhancement.

**Safe reproduction / acceptance:** Issue a small controlled burst against local synthetic accounts at test thresholds. Verify HTTP 429 and `Retry-After`, bounded counter cardinality, cross-instance enforcement, expiry/reset, failure behavior and normal shopping. Test spoofed forwarded headers through the actual trusted-proxy configuration. **Result: application control gap confirmed; edge protection unknown.** Ship trusted-IP handling with the limiter; avoid an entire customer population sharing the proxy's IP quota. Roll back faulty thresholds without disabling all abuse controls.

### SEC-05 — Verify HTTPS upstream certificates

**Evidence:** [nginx.conf.template:17](../react-ui-ecommerce-app/nginx.conf.template#L17) proxies to configurable `BACKEND_URL` and enables SNI, but neither frontend Nginx file configures `proxy_ssl_verify` or a trust bundle. Nginx documents certificate verification as disabled by default; SNI alone does not enable it. See the [official proxy module reference](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_ssl_verify).

**Prerequisite / impact:** An HTTPS upstream is used through this configuration, without an unseen inherited verification setting, and an attacker can interfere with the upstream route. API credentials, submitted passwords and responses can be intercepted or altered. A private HTTP upstream is a different deployment case and must be assessed against its network boundary.

**Implementation / acceptance:** Require HTTPS for public upstream hops, enable certificate/hostname verification and configure the runtime CA bundle and upstream server name. In a local Nginx fixture, a valid trusted upstream must work; expired, wrong-host and untrusted certificates must fail with no forwarded credential-bearing request. Validate `nginx -t` and the complete certificate chain. **Result: configuration issue confirmed; no network interception tested.** Correct certificate/trust configuration if rollout fails; do not restore trust-all settings.

### SEC-06 — Enforce session concurrency across replicas

**Evidence:** [SecurityConfig.java:114](../java-ecommerce-app/src/main/java/com/company/ecommerce/identity/config/SecurityConfig.java#L114) returns the in-memory `SessionRegistryImpl`; both controller and filter session controls use it. [RedisSessionConfiguration.java:10](../java-ecommerce-app/src/main/java/com/company/ecommerce/identity/config/RedisSessionConfiguration.java#L10) shares session data, but not this registry. `ControllerSessionLimitTest` exercises only one registry. PostgreSQL `auth_version` revocation is separate and should remain intact.

**Implementation:** Use a supported shared session registry and indexed repository integration, with expiration/event handling supported by the deployed Redis service. Spring describes [clustered concurrent session control](https://docs.spring.io/spring-session/reference/spring-security.html) using `FindByIndexNameSessionRepository` and `SpringSessionBackedSessionRegistry`. Validate principal indexing and controller-login integration for Session 4.1.1; replacing one bean alone is insufficient. An accepted alternative is explicitly documenting a per-instance policy until shared enforcement ships.

**Safe reproduction / acceptance:** Start two local application contexts against disposable shared Redis/DB, alternate three logins between them, and prove the intended oldest session fails on either instance while two legitimate sessions remain. Repeat after one process restarts; verify logout and authorization-version revocation. **Result: architecture gap confirmed; two-instance reproduction not run.** If the session repository/namespace changes, plan a deliberate logout window and migration-compatible rollback.

### SEC-07 — Unify enrollment validation and reduce enumeration

**Evidence:** [RegisterRequest.java:9](../java-ecommerce-app/src/main/java/com/company/ecommerce/identity/dto/RegisterRequest.java#L9) and `LoginRequest.java:9` lack explicit email/password maximum lengths; registration's name/address fields also lack size bounds. Customer password change/reset accept six-character passwords and check BCrypt's UTF-8 byte limit in the service. Staff enrollment has a different policy. `AuthService.java:135` reports an existing email explicitly. No email verification flow was found.

**Implementation:** Centralize password-enrollment validation for registration/change/reset/staff creation, with an explicit strength policy and BCrypt byte bounds while retaining existing hash verification. Bound login inputs generously without applying a new enrollment minimum to existing credentials. Add schema-aligned email/name/address bounds before hashing or writes, and return deliberate 4xx errors for rejected inputs. Normalize identity consistently; audit case-insensitive email collisions before changing uniqueness constraints. Design a generic registration response and verified-email flow with the frontend; do not silently replace the existing auto-login registration contract. Use [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) for strength and enumeration decisions.

**Safe reproduction / acceptance:** Local synthetic registration tests must cover oversize fields, multi-byte passwords at 72/73 bytes, short/weak enrollment, duplicate/case variants, unchanged legacy login, and atomic Indian address creation. Unknown/known identity responses should meet the agreed generic contract. **Result: source-confirmed hardening gaps; no credential-guessing test run.** Prefer a staged enrollment policy; avoid forced global password resets or a destructive email migration.

### SEC-08 — Verify cookie flags, TLS termination and trusted client IP

**Evidence:** The repository activates Spring Session explicitly, but no explicit `CookieSerializer` or trusted forwarded-header handling was found. Nginx writes `X-Forwarded-Proto` from its local `$scheme`, appends forwarded IPs and clears `Origin`. A TLS-terminating platform may connect to Nginx over HTTP. The provided variable-name inventory does not establish the effective session-cookie policy.

Spring Session's [cookie documentation](https://docs.spring.io/spring-session/reference/guides/java-custom-cookie.html) says the default Secure decision follows `request.isSecure()` and the default SameSite is Lax. Therefore, missing explicit cookie code is **not** proof of missing HttpOnly/SameSite; actual proxy behavior decides part of the risk.

**Implementation / acceptance:** Document the edge → Nginx → backend chain and block untrusted direct backend access. Accept forwarding metadata only from trusted hops; overwrite attacker-supplied headers at ingress. Preserve validated original HTTPS information. Configure the actual Spring Session serializer where necessary instead of assuming servlet-container cookie properties control it. Capture redacted production-like `Set-Cookie` attributes: Secure, HttpOnly, host-only domain/path and deliberate SameSite. Test login/session rotation, checkout, reset, logout, proxy IP attribution and invalid forwarding headers. Keep CSRF for all browser-authenticated mutations. **Result: deployment check pending.** Coordinate any cookie-name/path/SameSite changes with the frontend; do not enable cross-site cookies unless the confirmed deployment requires them.

### SEC-09 — Add browser policies on the HTML document

**Evidence:** No explicit CSP, Referrer-Policy or Permissions-Policy was found in the inspected frontend serving files or security configuration. Spring Security API header defaults do not establish headers on HTML served by Nginx. The frontend loads Razorpay Checkout. The source sink search did not find `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `document.write` in non-test frontend code; no stored-XSS exploit is claimed.

**Implementation / acceptance:** Inventory actual script, frame, image and connection origins. Add CSP report-only to the frontend document response, including deliberate Razorpay requirements; then enforce after testing. Set suitable referrer/permissions/framing protections and stage HSTS at the real TLS edge after hostname coverage is known. Test storefront, admin editor, uploads, payment modal, navigation and error responses; inspect the HTML response and failed-resource console. **Result: repository hardening gap; deployed headers unknown.** Roll back CSP to report-only if required, without weakening authentication or broadening to arbitrary origins.

### SEC-10 — Restrict management endpoints separately from customer login

**Evidence:** [application.yml:126](../java-ecommerce-app/src/main/resources/application.yml#L126) exposes health/info/prometheus and line 129 sets health details to `always`. The custom security chain has no management-specific rule before `anyRequest().authenticated()`. Thus authentication, including a normal customer session, is the visible access requirement when these endpoints are reachable. They are **not** described here as anonymous/public. An upstream network restriction may already block them. Spring explains custom-chain responsibility in its [Actuator endpoint documentation](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html).

**Implementation / acceptance:** Put metrics/detailed health on a private management interface/network or dedicated operations authorization. Expose only a minimal liveness/readiness response to the required probe audience. Test anonymous, CUSTOMER, intended operations identity and direct/proxied paths through the real filter chain. Verify customer denial and continued monitoring. **Result: source access-policy gap; HTTP reproduction not run.** Configure monitoring access before enforcing the restriction; do not expose env/config/heap endpoints as a workaround.

### SEC-11 — Bring S3 image validation up to the database upload path

**Evidence:** [S3CatalogObjectStorage.java:56](../java-ecommerce-app/src/main/java/com/company/ecommerce/catalog/storage/S3CatalogObjectStorage.java#L56) already checks metadata, exact size/hash, immutable conditional fetch and basic signatures. However, its `imageSignature` accepts a PNG header without decoding the rest. In contrast, [CatalogImageOptimizer.java:21](../java-ecommerce-app/src/main/java/com/company/ecommerce/catalog/application/CatalogImageOptimizer.java#L21) decodes database uploads, bounds dimensions/pixels and re-encodes output. Both upload paths require ADMIN; this is not an anonymous upload or demonstrated script-execution vulnerability.

**Implementation / acceptance:** Before enabling S3 uploads, validate decoded dimensions/content with the existing image facilities and resource limits. Prefer a private temporary object and validated/re-encoded immutable publication object if content replacement is needed. Quarantine unconfirmed objects, define cleanup/quotas, and verify bucket/public-origin behavior. Test signature-only/truncated files, unsupported types, excessive dimensions, checksum changes, receipt ownership/replay and valid JPEG/PNG/WebP. **Result: validation gap source-confirmed; S3 runtime/bucket policy not tested.** Keep the existing database storage option available while the S3 publication contract changes.

### SEC-12 — Add release evidence for dependencies, images and secrets

**Evidence:** Existing workflows run tests (frontend also lint) and publish containers, which are useful controls. They do not explicitly run advisory scans, redacted secret detection, SBOM/image scanning or dependency verification. Actions use version tags and base images use mutable tags. The frontend has a lockfile and uses `npm ci`; no Gradle dependency locking/verification configuration was found. Neither Docker ignore file explicitly excludes `.env*`/private key material, although no frontend `.env*` file was found during this review.

**Implementation:** Preserve compatible versions and add advisory checks against the resolved frontend and JVM graphs, scanning of the built runtime images, secret detection with redacted output, and reviewable dependency verification/locking. Record image digests and SBOMs; pin actions to reviewed immutable references with an update process. Exclude environment/credential/private-key files from build contexts, particularly the frontend's `COPY . .` and exported build cache. Do not upload private source to a new scanner service incidentally or run blanket forced upgrades.

**Acceptance:** Obtain a fully resolved dependency graph; match each relevant vendor advisory's affected/fixed range and feature prerequisites, then prove the patch does not break login/payment/image handling. A harmless scanner fixture must fail the intended CI gate without exposing values. Rebuild and scan the actual released images. **Result: pipeline gap confirmed; dependency exposure remains unverified.** The [Spring advisories](https://spring.io/security/) and [Vite advisories](https://github.com/vitejs/vite/security/advisories) were consulted, but this review does not assign a CVE or claim these versions are clean. Roll back incompatible application changes only to a reviewed artifact with understood remaining exposure.

## 3. Endpoint and enforcement matrix

Paths below are relative to `/api/v1` unless `/actuator` is shown. This groups reviewed routes; it is not a generated inventory of every admin operation. All browser mutations retain CSRF. Request DTOs and service state checks remain necessary even where the table lists only the principal/role boundary.

| Method / route family | Intended audience and actual enforcement | Controlled inputs / side effects | Existing tests inspected; execution status |
| --- | --- | --- | --- |
| GET `/auth/csrf`; POST `/auth/login`, `/auth/admin/login`, `/auth/register`, `/auth/logout` | Public URL policy; CSRF on POST; admin login checks assigned staff role before session creation; `/auth/me` requires authentication | Credentials/profile; BCrypt, session rotation/invalidation, CUSTOMER assignment | `AuthServiceTest`, `ControllerSessionLimitTest`, `RegistrationAddressIntegrationTest`; not run |
| POST `/auth/forgot-password`, `/auth/reset-password` | Public plus CSRF; durable throttle, hashed expiring one-use token, active eligible account check | Email/token/new password; mail task, credential/auth-version update | `PasswordResetIntegrationTest`; not run |
| GET/PATCH `/customers/me`; POST `/customers/me/password`; address and delivery-location CRUD | CUSTOMER; principal-derived customer; owner predicate for address reads/writes | Allowlisted profile/address/password fields; account/address data | `CustomerAccountIntegrationTest`, `CustomerDeliveryLocationIntegrationTest`; not run |
| GET public catalog/homepage/collections/reviews/media; review `/mine` mutations | Public reads; CUSTOMER for own review, ADMIN for moderation/upload; media has publication check | Search/pagination/review text/image references; review persistence and public media responses | Publication/review/media/upload integration suites; not run |
| GET/POST/PATCH/DELETE `/cart/**` | Anonymous session cart allowed; coupon routes authenticated; quantities server-validated | Variant/quantity, session cart/coupon state | Cart validation/session tests; not run |
| POST `/checkout`, `/checkout/quote` | Authenticated principal; server pricing; idempotency bound to customer/request; inventory locks | Contact/delivery/payment method/coupon/quote hash; order and inventory reservation | `CheckoutIntegrationTest`; not run |
| GET `/orders/mine`, `/orders/{number}`; GET invoice/PDF/credit notes | Authenticated principal plus customer-specific repository/service ownership | Order number/document ID; private order/address/tax data | Checkout and invoice integration suites; not run |
| POST `/payments/razorpay/confirm` | Authenticated owner of payment/order; signature verification, provider fetch and amount/currency binding | Provider identifiers/signature; payment/order transition | Checkout payment integration scenarios; not run |
| POST `/payments/webhooks/razorpay` | Public/CSRF-exempt only for provider signature authentication | Exact body/signature/event ID; durable inbox and locked replay-safe payment transition | Checkout webhook/race scenarios; not run |
| GET/POST `/orders/{number}/cancellations`; returns request/read/cancel | Authenticated plus service ownership; allowed transitions/quantities; refund workflow | Order/item quantities/reason/key; cancellations/returns/refund request | Cancellation/operations tests; not run |
| POST `/admin/orders/{number}/refunds`; finance/COD/refund recovery routes | Direct refund is ADMIN; other operations use specific role combinations; state/amount checks | Refund amount/reason/key; provider/refund operations | Refund/operations tests; not run |
| `/admin/**`, `/catalog/admin/**` | URL plus method role/capability checks; staff creation/status/roles require ADMIN | Products/pricing/tax/settings/staff/inventory; sensitive administrative changes and audits | `AdminIdentityIntegrationTest` and admin suites; not run |
| POST `/catalog/admin/uploads/database`, `/presign`, `/confirm` | ADMIN; actor-bound receipts/idempotency, validation; public reads restricted by publication logic | File/metadata/checksum/receipt; DB media or signed object-storage operation | Catalog upload/database/S3 tests; not run |
| GET order tracking; admin shipment booking/documents | Customer tracking checks owner; staff routes check role; document proxy bounds hosts, redirects, time and size | Shipment/order IDs and courier operations; customer data and external requests | Shipping/operations/document tests; not run |
| POST `/shipping/webhooks/carrier`; `/logistics/events` | Public/CSRF-exempt; carrier verifier or configured constant-time shared-token check; blank logistics token rejects | Event body; bounded parsing, durable tracking/state changes | Shipping integration/unit scenarios; not run |
| GET `/actuator/health`, `/actuator/info`, `/actuator/prometheus` | Visible policy is any authenticated user; intended audience should be monitoring/operations | No customer mutation; infrastructure/operational data | Add explicit role/probe tests under SEC-10 |

No OAuth/OIDC, JWT access/refresh flow, OTP or guest order placement was found in the reviewed paths. Anonymous carts are intentional; checkout requires authentication. Raw card collection was not found in the reviewed payment path. JWT-specific checks are therefore not applicable to this implementation.

## 4. Controls already present and to preserve

- `SecurityConfig` enables method security and authenticated fallback; webhook CSRF exceptions are limited to integration route families. Login/logout/checkout remain CSRF-protected, consistent with [Spring Security guidance](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html).
- `AuthService` invokes the session-authentication strategy, rotates session IDs and saves the security context explicitly. `AuthorizationVersionFilter.java:32` checks active status and DB authorization version before authorization. Redis store failures have a dedicated 503/no-store response rather than a permissive authentication fallback.
- The frontend auth store keeps identity in memory and restores it from the server; it does not use browser storage as proof of login. Axios sends credentials, obtains a CSRF token and does not automatically replay failed mutations.
- Password recovery uses 32 random bytes, stored token hashes, expiry, locked redemption, durable counters, generic responses and authorization-version invalidation. Delivery is a bounded in-memory queue with a documented restart/failure limitation; that is a reliability tradeoff, not an unprotected token claim.
- `CheckoutOrderService` and pricing logic calculate commercial values from server records, lock inventory, validate quote hashes, and bind idempotency to customer/request. Order reads, addresses, invoices, returns and tracking paths reviewed have explicit owner checks.
- Razorpay verification uses HMAC-SHA256 and constant-time comparison; confirmation also fetches provider state. `PaymentPersistenceService.java:173` validates provider order, amount and currency. Webhooks verify the body before parsing and use a durable inbox/locking. Preserve raw-body behavior and test it against [Razorpay webhook guidance](https://razorpay.com/docs/webhooks/validate-test/) and [checkout guidance](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/).
- Logistics ingress rejects a blank secret and validates its shared token; carrier callbacks invoke a verifier. Sandbox adapters are profile-scoped. Ensure `demo`, `payment-sandbox` and `fulfillment-sandbox` are excluded from production deployment configuration; their presence in source is not itself an exposed bypass.
- Database image upload decodes, bounds and re-encodes images. S3 upload already binds size/hash/receipt/actor and uses short-lived signed operations. Shipping document download rejects redirects/private addresses and bounds response size/time. No direct injectable SQL path was established in the traced queries; interpolated document column names come from internal fixed callers.
- DB conflict responses/logs avoid full JDBC row messages; invoice/customer responses inspected use no-store. Backend runtime runs as a non-root user. Existing CI executes tests before publishing.

These are source observations, not claims that every route or runtime variant has passed an exploit test.

## 5. Implementation work packages

Suggested owners are roles, not assigned people. Sizing is relative engineering effort, not a delivery-date commitment.

| Package | Findings / owner | Concrete deliverables | Dependencies and done criteria |
| --- | --- | --- | --- |
| A — Administrator containment | SEC-01; backend + operator; small/medium | Operator-only bootstrap, seed retirement, auth-version invalidation, test fixtures, runbook | Replacement admin verified first; fresh/upgrade/auth tests pass; operator signs off deployed account state |
| B — Production boundary | SEC-02/03/05/08; platform + backend; medium | Validated exact origins, development-only Compose, private DB/Redis plan, verified upstream TLS, trusted proxy/cookie contract | Confirm real hosts/hops and data-service ACL/grants; test same-origin and intended cross-origin shopping; collect redacted runtime evidence |
| C — Authentication abuse and policy | SEC-04/07; backend + frontend; medium | Atomic bounded limiter, configurable thresholds/outage policy, unified enrollment limits, generic-registration contract proposal | Trusted IP from B; legacy login preserved; concurrency/UTF-8/normal registration tests pass; email-verification UX explicitly designed |
| D — Shared session policy | SEC-06; backend + platform; medium | Indexed session repository/registry integration or explicit temporary per-instance policy | Redis event/index support verified; two-instance and restart tests pass; session migration/logout plan reviewed |
| E — Browser and operations exposure | SEC-09/10; frontend + platform/backend; small/medium | Document CSP report-only then enforcement, response headers, restricted management route | Real payment/image origins known; payment modal and monitoring continue to work; customer denied management details |
| F — Upload and release assurance | SEC-11/12; backend + CI owner; medium | S3 decoded validation/publication strategy, cleanup/quota policy, advisory/secret/image gates, SBOM, reviewed locks/digests | S3 fixture tests and actual artifact scan pass; complete dependency graph available; exceptions record reachability/expiry/owner |

Do A immediately on any reachable deployment retaining the seed. Verify B before the next production release; implement C before opening unthrottled authentication to an untrusted audience. Do D before relying on a global session cap in multiple replicas. E/F close the remaining hardening work; S3-specific changes gate S3 enablement.

## 6. Verification evidence and commands

### Checks executed for this audit

| Check | Result and limit |
| --- | --- |
| Scoped frontend tests | **4 files, 45 tests passed**: Axios/session-CSRF behavior, catalog upload client, auth modal, password-recovery UI. These do not exercise the backend or prove browser CORS/cookie behavior. |
| Java/Gradle inspection | Java runtime `21.0.12`; wrapper reports Gradle `9.7.1`. Version check passed. |
| Offline runtime dependency task | Task exited successfully, but graph contained `FAILED` artifacts including `org.apache.pdfbox:pdfbox:3.0.8` and `com.twelvemonkeys.imageio:imageio-webp:3.14.0`. Dependency assessment incomplete. |
| Docker preflight | Failed due inaccessible Docker configuration; alternate invocation failed as well. No integration database/Redis service was started. |
| Backend security/integration tests | **Not run**: disposable service access and complete dependency resolution were unavailable. Existing test assertions were inspected only. |
| CORS, network, cookie, upstream TLS and two-instance attack reproductions | **Not run**. Proposed local regression scenarios appear in the findings above. |
| Dependency/container/history-secret scans; deployed tests | **Not run**; no clean scan or production-security claim. |

Frontend command executed from `react-ui-ecommerce-app`:

```powershell
npm.cmd test -- src/api/axios.test.ts src/api/catalogUpload.test.ts src/components/auth/AuthModal.test.tsx src/components/auth/PasswordRecovery.test.tsx
```

Backend inspection command executed from `java-ecommerce-app`:

```powershell
.\gradlew.bat --offline --gradle-user-home .gradle --no-daemon dependencies --configuration runtimeClasspath
```

When Docker and approved dependency access are available, run the relevant backend suites using the repository's disposable test-service lifecycle, not the application database:

```powershell
.\gradlew.bat test --tests '*AuthServiceTest' --tests '*RegistrationAddressIntegrationTest' --tests '*SecurityFailureIntegrationTest' --tests '*RedisSessionConfigurationIntegrationTest' --tests '*PasswordResetIntegrationTest' --tests '*AdminIdentityIntegrationTest' --tests '*CheckoutIntegrationTest' --tests '*CatalogImageUploadIntegrationTest' --tests '*InvoiceIntegrationTest'
```

That command is a future verification instruction, **not** an audit result. `gradle/test-services.gradle` owns isolated PostgreSQL/Redis containers and cleanup for ordinary runs. Review the current runner before using alternative initialization scripts or environment overrides.

Add tests for each new denial plus its legitimate counterpart. Use the real security filter chain and proxied services; do not mock away the boundary being tested. Payment/order replay and stock races require actual PostgreSQL semantics. Cookie/proxy/CORS checks require a production-like HTTP/browser fixture. New tests were not added in this documentation-only assessment.

## 7. Release and operational checklist

- [ ] Backend owner: SEC-01 retirement/bootstrap acceptance passes on fresh and upgraded disposable databases; operator verifies seed retirement on the intended environment without disclosing values.
- [ ] Platform owner: record actual production origins, public/private routes and trusted proxy hops; resolve SEC-02/03/05/08 with redacted evidence.
- [ ] Backend owner: authenticate/authorize/own-record positive and negative tests pass, including address registration and invoice isolation.
- [ ] Backend owner: invalid/tampered payment signatures, foreign-order IDs, wrong amount/currency, duplicate/concurrent events/refunds, stale transitions and last-item races cannot create an extra financial or stock effect.
- [ ] Backend/platform owner: measure abuse thresholds, forged-IP handling, Redis outage/eviction/restart behavior, and cross-replica session policy.
- [ ] Frontend owner: real-cookie login/logout/reset, catalog, upload and Razorpay test-mode checkout work after origins/headers/cookie changes.
- [ ] Operations owner: management endpoints restricted; security/admin/refund events recorded without credentials/PII; alerts cover auth bursts, session-store failures, failed webhook verification and reconciliation backlog.
- [ ] CI owner: complete resolved graphs and built image digests have dated advisory/secret/image evidence; any exception has prerequisites, owner and expiry.
- [ ] Platform/operator: verify runtime DB grants, Redis ACL/TLS/memory policy, encrypted backup access/retention and a tested restore. These remain deployment checks, not confirmed production defects.
- [ ] Release owner: exclude sandbox/demo profiles, keep provider test/live credentials isolated, verify rollback artifacts and re-run focused checks after material configuration changes.

Roll out additive configuration and compatible service changes first. Treat administrator retirement as irreversible credential containment. Use forward migrations and preserve customer/commercial history. Session repository/cookie changes may require a planned sign-in reset; origin and CSP changes need coordinated frontend/backend releases. Stage restrictive browser policies in report-only mode when appropriate. Do not deploy, change live grants, rotate credentials, issue refunds, or rewrite migration history as a side effect of following this audit document.

## 8. Reference verification

Official sources were retrieved on **2026-11-10**. Live documentation may advance beyond the repository; verify configuration and advisories against the fully resolved release graph before implementation. Sources support control behavior, not the application's deployed state.

- CORS and CSRF: Spring Framework and Spring Security documentation linked in SEC-02 and section 4.
- Session cookies and cluster concurrency: Spring Session references linked in SEC-06/08; retrieved Session documentation identified version 4.1.1.
- Upstream TLS verification: Nginx reference linked in SEC-05; default behavior was checked directly.
- Payment protocol: Razorpay checkout and webhook references linked in section 4.
- Data-service isolation: Redis guidance linked in SEC-03; actual PostgreSQL role/TLS policy still requires deployment evidence.
- Authentication and advisories: OWASP, Spring and Vite sources linked in SEC-07/12. No unverified CVE identifier or remediation version is prescribed.
