# Recovery and database incident runbook

## Boundaries

Never reset, truncate or restore over the live database as a rehearsal. Stop writes before a real recovery decision, preserve audit/request IDs and identify the last known good migration/data state. Protect database URLs and backups as secrets. Record recovery owner, acceptable RPO/RTO and the deployment/branch mapping before launch.

## What is verified

The Phase 3 disposable harness creates a second database, copies all 20 application/bookkeeping tables in dependency order, restores deferred relational constraints and compares per-table content checksums. Timestamp values remain PostgreSQL JSON strings to preserve microseconds. Deadline triggers are installed after historical responses are imported, equivalent to restoring data before post-data triggers. Only the explicitly named disposable target is removed. This validates the local logical data model; it is not a production backup service or Neon recovery rehearsal.

Run `npm run test:phase3` with ports 3000/55432 free and no other harness running. The script uses a new loopback cluster and overrides live environment settings. Its fixtures are not a production seed command.

## Neon project checks still required

Use the project console to record the actual plan, history/restore window, branch permissions, region and recovery entitlement. SQL credentials alone do not reveal these control-plane settings. Verify the available feature rather than assuming a retention period from a plan name.

Official references: [Neon history window](https://github.com/neondatabase/website/blob/main/content/docs/postgres/backup-restore/history-window.md), [Neon branch restore](https://github.com/neondatabase/website/blob/main/content/docs/postgres/backup-restore/branch-restore.md). Restore availability depends on the configured history window and project capabilities; these references do not establish this project's entitlements.

## Isolated recovery rehearsal

1. Create a separate authorized Neon test branch/database and verify that its identifiers differ from production.
2. Record source timestamp/LSN and migration checksums. Use the project's available branch/history restore capability, or a secured `pg_dump` custom-format backup with a matching PostgreSQL client. Pass credentials through protected environment/service files, not shell command arguments.
3. Restore into a new empty target, never with `--clean` against an existing live database. Include schema, data, functions, indexes, constraints and bookkeeping; restore trigger ordering correctly.
4. Verify per-table counts/content checksums, foreign keys, snapshot keys, result ownership, sessions policy and all eight lifecycle flows. Verify unpublished results remain private.
5. Record observed recovery duration/data loss, compare with agreed RPO/RTO, and obtain owner approval before any production cutover.
6. For an actual incident, promote or repoint only after verifying target identity and data consistency. Preserve the original branch for investigation. Rotate credentials and revoke sessions if compromise is suspected.

## Migration failure/reversal

Migrations are transaction-wrapped and checksum tracked. A failed migration rolls back; inspect schema/history before retrying. Never modify an already-applied migration or delete valid rows to make a constraint pass. Investigate violations and create a reviewed forward correction. Indexes/guards introduced in Phase 3 can be removed by a deliberate forward migration only after assessing the resulting integrity gap; do not drop the application schema as a rollback. A data-changing rollback requires a verified isolated restore/cutover plan and approval.

## Outage and observability

Check authenticated `/api/health`, provider status, connection limits, statement/lock timeouts and deployment logs. Correlate sanitized X-Request-Id values with server events and audit timestamps. Never paste database URLs, auth cookies, password reset links or answer keys into incident reports. Temporarily pause admissions/starts if persistence is unavailable. Do not promise that browser retries survive tab closure; the server deadline continues during outages.
