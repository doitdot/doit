# Database Rollback Strategy

This document outlines the strategy for managing database migrations, ensuring safe deployments, and handling failures in the `doit` project.

## 1. Core Philosophy: Fix Forward

We use [Prisma](https://www.prisma.io/) for database management. Prisma follows a **"Fix Forward"** philosophy rather than providing automatic "down" migrations.

**Why?**
- "Down" migrations are rarely tested and often fail when needed most.
- Reverting a schema change often involves data loss (e.g., dropping a table), which should not be automated blindly.
- If a migration fails in production, the database might be in an inconsistent state that a simple logical revert functionality cannot solve.

## 2. Standard Workflow

### Development
1.  Modify `schema.prisma`.
2.  Run `pnpm db:migrate` (runs `prisma migrate dev`).
3.  This generates a SQL migration file in `prisma/migrations` and applies it.

### Production (Deployment)
1.  The CI/CD pipeline or deployment script runs `prisma migrate deploy`.
2.  This applies all pending migrations from the `migration.sql` files.

## 3. Handling Deployment Failures

If a migration fails during deployment (e.g., due to a data conflict or connection issue), the strict process is:

### Scenario A: Migration failed but was NOT partial
*   **Status**: The command exited with an error. The database schema has rarely changed if it was transactional (Postgres DDL is transactional).
*   **Action**:
    1.  Fix the cause (e.g., simple connectivity or locking issue).
    2.  Retry deployment.

### Scenario B: Migration failed and left DB in "Failed" state
Prisma tracks migration status in the `_prisma_migrations` table.
*   **Action**:
    1.  Investigate the error logs (e.g., `constraint violation` on existing data).
    2.  **Fix the Data** manually via SQL if it's a data consistency issue.
    3.  **Mark as Resolved**: Run `prisma migrate resolve --applied <migration_name>` (if you manually matched the schema) or `--rolled-back <migration_name>` (if you rolled back the changes manually).
    4.  **Do NOT** just delete the migration row unless you know exactly what you are doing.

## 4. How to "Rollback" a Feature

If we deployed a feature with a migration (e.g., added `User.phoneNumber`) and we want to remove it:

1.  **Do NOT** try to "undo" the migration file in the database directly.
2.  **Process**:
    *   Revert the changes in `schema.prisma` (remove `phoneNumber`).
    *   Run `pnpm db:migrate`.
    *   Prisma will generate a **NEW** migration that drops the column (`ALTER TABLE "User" DROP COLUMN "phoneNumber"`).
    *   Deploy this new migration.

This ensures the history is linear and the state is predictable (Version 3 -> Version 4 which looks like Version 2).

## 5. Emergency Recovery

For critical failures (e.g., accidental `DROP TABLE` or massive corruption):

*   **Reliance**: Point-in-time Recovery (PITR) / Backups.
*   **Strategy**: Restore the database to the state immediately before the deployment started.

## Summary Checklist
- [ ] Always review `migration.sql` before committing.
- [ ] Never edit existing `migration.sql` files after they are merged/deployed.
- [ ] In case of logical revert -> Create a new inverse migration.
- [ ] In case of catastrophic failure -> Restore backup.
