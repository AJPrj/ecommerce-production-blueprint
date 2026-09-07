# PART XII — CI/CD & Deployment

## 1. Repository

Recommended monorepo:

```text
/
  frontend/
  backend/
  infrastructure/
  docs/
  scripts/
```

Keep application and infrastructure versioned together where practical.

## 2. Branch strategy

Use a simple trunk-based or short-lived branch workflow.

Every merge requires:

- Build
- Unit tests
- Static analysis
- Security scanning
- Integration tests as appropriate

## 3. Frontend pipeline

```text
Install
 -> Lint
 -> Typecheck
 -> Unit tests
 -> Build
 -> Bundle analysis
 -> Security scan
 -> E2E tests
 -> Publish artifact
```

## 4. Backend pipeline

```text
Compile
 -> Unit tests
 -> Static analysis
 -> Dependency scan
 -> Integration tests
 -> Testcontainers
 -> Build JAR
 -> Build image
 -> Scan image
 -> SBOM
```

## 5. Database pipeline

Flyway migrations must be tested against a real PostgreSQL version matching production.

Test:

- Clean database migration
- Upgrade from previous production-like version
- Roll-forward
- Backward-compatible application behavior

## 6. Docker

Use multi-stage builds.

Backend:

- Build with JDK image
- Run with minimal JRE/runtime image

Frontend:

- Build static assets
- Serve through a minimal production web server/CDN

Do not run as root where practical.

## 7. Environment model

Separate:

- local
- development
- test
- staging
- production

Never use production credentials in lower environments.

## 8. Kubernetes

If Kubernetes is used:

- Deployment
- Service
- Ingress
- ConfigMap
- Secret reference
- HPA
- PodDisruptionBudget
- NetworkPolicy
- ServiceAccount
- Resource requests/limits
- Liveness/readiness probes

## 9. Deployment strategy

Preferred:

- Rolling deployment for ordinary releases
- Blue/green or canary for high-risk changes

The earlier hardening specification proposes blue-green deployment; retain it where the platform/business requires stronger rollback guarantees. fileciteturn3file1L1619-L1624

## 10. Zero-downtime migrations

Application compatibility sequence:

```text
Release A
  -> expand DB
  -> release B reads old + new
  -> migrate data
  -> release C stops old field
  -> later remove old field
```

Never deploy a schema change that instantly breaks currently running application pods.

## 11. Secrets

Use a managed secret store.

CI must never print secrets.

Rotate:

- DB credentials
- API credentials
- signing keys
- payment secrets

## 12. Security gates

Include:

- SAST
- SCA
- Secret scan
- Container scan
- SBOM
- Dependency/license checks
- DAST in staging

The source specification already proposes security scanning and multi-stage container builds; this blueprint expands the pipeline into a complete supply-chain control. fileciteturn3file1L1619-L1624

## 13. Release approvals

Production deployment should require:

- Passing pipeline
- Migration validation
- Change record where required
- Automated smoke test
- Rollback plan

## 14. Post-deployment verification

Automatically verify:

- Health
- Login
- Product listing
- Product detail
- Cart
- Test payment sandbox where appropriate
- Order retrieval
- Database connectivity
- Metrics ingestion

## 15. Rollback

Every release must answer:

- Can application rollback?
- Can database changes coexist?
- Can data changes be reversed?
- What happens to in-flight jobs?

Do not assume database rollback is always possible. Prefer forward-compatible migrations.
