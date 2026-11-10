# Administrator bootstrap and security rollout

Updated: 2026-11-10. Implements the first batch of [the security plan](SECURITY-AUDIT-IMPLEMENTATION.md). These instructions describe operator actions; no live provisioning or deployment was performed during implementation.

## Administrator retirement (V54)

V54 disables the historical development administrator by its stable UUID, replaces its password hash with a disabled marker, advances `auth_version` and records a retirement audit. Its record, roles and historical references remain. The staff status API refuses to reactivate that identity. V7/V14 and their applied checksums are unchanged.

**Before upgrading an existing installation**, verify a separately provisioned named ADMIN account can sign in through the current application. If one already exists, use it; bootstrap intentionally refuses to create another administrator when an active named administrator exists.

If the development identity is the only active administrator, run the new operator command against the current migrated database, verify the new account, and then deploy/apply V54. Compiling/running the command below does not start Spring Boot or execute Flyway, so it can provision the replacement before the upgrade. It requires the existing identity/audit schema (tested at V53) and must be run only by the operator with explicit target access.

For a fresh installation, let normal Flyway startup apply migrations through V54, then explicitly bootstrap the first named administrator. There is no usable migration-created administrator after V54. No password is generated, stored in source or supplied through a public endpoint.

## Operator-only command

Set these process environment variables through your existing secret injection or a private interactive session. Do not put credentials in command arguments, shell history, issue comments or committed files.

| Variable | Meaning |
| --- | --- |
| `ADMIN_BOOTSTRAP_JDBC_URL` | Explicit PostgreSQL JDBC URL, including the intended database/schema/TLS options; no default or implicit use of the application's environment file |
| `ADMIN_BOOTSTRAP_DB_USER` | Operator provisioning DB role with the required user, role-membership and audit-table permissions |
| `ADMIN_BOOTSTRAP_DB_PASSWORD` | That DB role's secret |
| `ADMIN_BOOTSTRAP_EMAIL` | New, valid named identity; existing accounts cannot be claimed or reset |
| `ADMIN_BOOTSTRAP_PASSWORD` | Unique secret of 12–72 characters and at most 72 UTF-8 bytes for BCrypt |
| `ADMIN_BOOTSTRAP_FIRST_NAME` / `ADMIN_BOOTSTRAP_LAST_NAME` | Operator's names, each 1–100 characters |

For a packaged backend JAR (shown as `app.jar`, matching the container artifact), run the isolated entry point directly:

```powershell
java -Dloader.main=com.company.ecommerce.identity.bootstrap.AdminBootstrapCommand -cp app.jar org.springframework.boot.loader.launch.PropertiesLauncher
```

Alternatively, from the source checkout's `java-ecommerce-app`:

```powershell
.\gradlew.bat --no-daemon bootstrapAdmin
```

Use the approved Gradle cache/network configuration for your environment. Do not use debug logging or a build scan for secret-bearing provisioning. The task launches a plain JDBC command, not the web application. It does not start Redis, schedulers, payment/shipping clients or email delivery, and it does not execute migrations.

The command uses the staff-administration transaction lock, BCrypt and the existing ADMIN role. A durable `ADMIN_BOOTSTRAPPED` audit and active named-admin check prevent reuse; concurrent commands cannot create two bootstrap administrators. It rejects existing-email collisions and leaves failed transactions unchanged. Outcomes contain no submitted identity, password, connection URL or driver exception. Normal staff administration remains available after bootstrap; this command is not a password-reset tool.

Afterward:

1. Remove the bootstrap variables from the operator process/session and withdraw temporary DB access.
2. Verify the named administrator can log in and perform an intended authorized operation.
3. Upgrade the application and let V54 retire the development account.
4. Verify legacy sign-in and any old legacy session fail, while named staff and customer flows work.
5. Retain audit evidence without credentials. If the development account was exposed, review its security events and rotate any affected credentials separately.

Do not re-enable the retired account, roll back to an old application artifact that lacks these controls, edit applied migrations or run Flyway repair to restore access. Resolve access through a verified named administrator/operator recovery procedure. No live credential rotation is included in this code change.

## CORS, monitoring and proxy prerequisites

`CORS_ALLOWED_ORIGINS` is now an exact comma-separated allowlist. Empty/unset means same-origin requests only. Wildcards, paths, userinfo, query strings, fragments, `null`, invalid ports and non-loopback HTTP origins are rejected at startup. Use the browser's actual HTTPS origin, without a trailing slash; scheme/host/port determine the origin. Controller wildcard policies have been removed.

For explicit local development, a permitted example is `http://localhost:5173`; use the actual local port. Production credentials must never be shared with development origins. The QA runner configures only its generated loopback web origin. The Nginx same-origin proxy continues to work without a cross-origin allowlist. Keep CSRF enabled: an allowed origin still needs a valid token for mutations.

All `/actuator/**` routes now require ADMIN, and health details use `when_authorized` with ADMIN. Arrange authenticated operations access or a separately reviewed private probe interface before upgrading monitoring. No anonymous health bypass was added. A dedicated monitoring identity/network policy remains follow-up work.

The frontend Nginx configurations enable upstream certificate and hostname verification using the CA bundle, installed explicitly in the runtime image. An HTTPS backend must have a valid trusted certificate with the expected hostname/chain. Private HTTP development networking remains possible; do not use a public HTTP backend. Do not disable verification to work around certificate failures.

Workspace Compose is development-only and now publishes PostgreSQL/Redis on `127.0.0.1`. Existing running containers are unaffected until recreated. This does not establish production isolation or add production Redis ACLs, DB grants or TLS; those controls still require deployment-specific configuration and verification. Build contexts now exclude environment files and common private-key formats; existing exposed credentials still require rotation.

## Remaining implementation

This batch implements SEC-01, SEC-02, SEC-05 and SEC-10 locally, and part of SEC-03/SEC-12. Deployed account state, origins, certificates, monitoring access and data-service policy are operator release gates. Login/registration throttling (SEC-04), global session concurrency (SEC-06), enrollment/identity policy (SEC-07), trusted-proxy/cookie verification (SEC-08), document browser policies (SEC-09), S3 decoded-image validation (SEC-11), and the rest of the release-scanning controls (SEC-12) remain open. See the implementation status and evidence in the security plan.
