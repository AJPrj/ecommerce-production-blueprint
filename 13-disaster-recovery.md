# PART XIII — Disaster Recovery

## 1. Recovery philosophy

A production ecommerce system must survive:

- Application failure
- Database failure
- Region/zone failure
- Accidental deletion
- Corrupt deployment
- Security incident
- External dependency outage

## 2. Initial recovery objectives

Starting target:

- RPO: 15 minutes
- RTO: 1 hour

These are targets, not guarantees. Validate them against infrastructure and business requirements.

The existing hardening specification explicitly proposes RPO 15 minutes, RTO 1 hour and weekly restore testing. fileciteturn3file1L1613-L1617

## 3. PostgreSQL backups

Use:

- Continuous WAL archiving
- Base backups
- Point-in-time recovery
- Encrypted backup storage
- Separate backup credentials

Do not keep the only backup in the same failure domain as production.

## 4. Backup policy

Example:

- Continuous WAL
- Daily backup
- Weekly retention
- Monthly longer-term retention

Retention must follow business/legal requirements.

## 5. Restore testing

At least weekly or according to risk:

1. Restore into isolated environment
2. Apply WAL
3. Verify schema
4. Run integrity checks
5. Run smoke tests
6. Measure restore duration
7. Record results

A backup that has never been restored is not considered verified.

## 6. Object storage

Enable:

- Versioning
- Lifecycle policy
- Replication where required
- Encryption
- Restricted write access

## 7. Redis

Redis is not the source of truth.

If Redis is lost:

- Application should recover
- Cache repopulates
- Sessions/workflow data should have an appropriate recovery strategy

## 8. Application recovery

Infrastructure should be reproducible from code:

- Container image
- Kubernetes manifests/Helm
- Terraform/IaC where applicable
- Secret references
- Database migration history

## 9. Disaster scenarios

Run tabletop and technical drills for:

### Database loss

Recover latest consistent point.

### Region loss

Provision infrastructure and restore/replicate data.

### Bad release

Rollback application and safely handle compatible DB state.

### Data corruption

Identify time of corruption and perform PITR.

### Credential compromise

Rotate secrets and signing keys, revoke sessions, investigate audit logs.

## 10. Ransomware/security recovery

Maintain:

- Immutable/offline-capable backups
- Separate backup IAM
- Restricted delete permissions
- Audit trails

## 11. Recovery validation

Recovery is complete only when:

- API is healthy
- DB is consistent
- Catalog works
- Cart works
- Orders are readable
- Payment reconciliation is possible
- Notifications can resume
- Monitoring is active

## 12. DR documentation

Keep a runbook with:

- Contacts
- Escalation
- Recovery commands/procedures
- Infrastructure dependencies
- DB restore process
- DNS/CDN process
- Secret rotation
- Validation checklist

Do not store actual secrets in the runbook.
