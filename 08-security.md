# PART VIII — Security

## 1. Security model

Assume:

- The browser is hostile.
- Requests can be replayed.
- Clients can modify payloads.
- Tokens can expire.
- External integrations can fail or lie.
- Admin accounts are high-value targets.
- Database credentials must never reach the browser.

## 2. Authentication

Use Spring Security.

Support:

- Email/password where required
- Email verification
- Password reset
- Session management
- Logout
- Session revocation
- Optional MFA for staff
- Login throttling

Customer password recovery uses expiring, single-use hashed tokens, generic
request responses, asynchronous SMTP delivery, public-endpoint throttling,
trusted reset URLs and authorization-version session revocation. Its configured
sender can reuse the existing Brevo SMTP setup. See
[Customer password recovery](PASSWORD-RECOVERY.md) for the implemented contract
and the explicitly non-durable recovery-email delivery limitation.

Password storage:

- Use a modern adaptive password hashing algorithm such as Argon2id or bcrypt with an appropriate cost.
- Never encrypt passwords.

## 3. Browser credentials

For cookie-based authentication:

- Secure
- HttpOnly
- Appropriate SameSite policy
- CSRF protection
- Session rotation
- Logout invalidation

For cross-site OAuth/payment flows, use carefully scoped state/nonce protections.

## 4. Authorization

Use deny-by-default.

Check:

1. Authentication
2. Role/permission
3. Resource ownership
4. Business state
5. Action-specific authorization

Example:

A support user may read an order but must not issue a refund.

## 5. Input validation

Validate:

- Length
- Format
- Numeric ranges
- Enum values
- File size
- Content type
- IDs
- Pagination
- Sort fields

Never concatenate user input into SQL.

## 6. XSS

- React escaping by default
- Sanitize trusted rich-text fields
- Strict HTML allowlist
- Content Security Policy
- Avoid `dangerouslySetInnerHTML`

The existing hardening requirements correctly identify product-description HTML as an XSS boundary. fileciteturn3file1L1576-L1587

## 7. SQL injection

Use parameterized JPA/SQL.

Do not build SQL strings from raw request input.

Dynamic sort/filter fields must come from allowlists.

## 8. CORS

Allow only known origins.

Do not use `*` for authenticated production APIs.

## 9. CSRF

Required when browser authentication uses cookies and the deployment model makes CSRF applicable.

Use:

- SameSite cookies
- CSRF token strategy
- Origin/Referer validation where appropriate

## 10. Rate limiting

Apply to:

- Login
- Registration
- Password reset
- OTP
- Search
- Coupon validation
- Checkout
- Payment initiation
- Webhooks where appropriate

Use Redis or an edge/WAF rate limiter.

## 11. Brute-force protection

Progressively throttle repeated failures.

Do not permanently lock accounts in a way that enables denial-of-service against customers.

## 12. Payment security

Never store:

- Raw PAN
- CVV
- Card security codes

Use payment-provider hosted/tokenized components.

Store only:

- Provider customer ID
- Payment method token/reference
- Provider transaction ID
- Last4/brand if permitted and useful
- Status
- Amount/currency

## 13. Sensitive data

Encrypt sensitive fields only when there is a justified requirement.

Use managed key material and authenticated encryption.

Do not blanket-encrypt fields that must be searched/indexed unless an explicit searchable-encryption strategy exists.

## 14. Secrets

Use:

- Kubernetes Secrets backed by a secret manager
- AWS Secrets Manager / GCP Secret Manager / Vault or equivalent
- Environment injection without committing secrets

Never commit:

- DB passwords
- API keys
- JWT secrets
- Payment keys
- SMTP passwords

## 15. File upload security

For product/review/return images:

- Size limit
- MIME validation
- Extension validation
- Malware scanning where required
- Random storage key
- No executable content
- Object storage private by default
- Signed URLs for access

## 16. Audit

Audit:

- Admin mutations
- Role/permission changes
- Refunds
- Inventory adjustments
- Product publishing
- Settings changes
- Authentication security events

Audit logs must be append-only to application users.

## 17. Security headers

Use appropriate:

- Content-Security-Policy
- HSTS
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- Frame-ancestors / clickjacking protection

## 18. Dependency security

CI should perform:

- SCA
- Secret scanning
- SAST
- Container image scanning
- SBOM generation

## 19. Privacy

Define:

- Data retention
- Data export
- Account deletion/anonymization
- Cookie/consent behavior
- Access controls
- PII classification

Do not promise a specific legal regime unless the business actually operates under it; implement the applicable privacy/legal requirements.

## 20. Security testing

Include:

- Authentication tests
- Authorization tests
- IDOR tests
- CSRF tests
- XSS tests
- SQL injection tests
- Rate-limit tests
- File upload tests
- Webhook signature tests
- Session fixation/rotation tests
- Dependency scanning
- DAST
