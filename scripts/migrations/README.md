# MK-V46 Migrations

Rules:
1. Every migration must be idempotent.
2. Never run destructive updates without a precise filter.
3. Log modified counts.
4. Keep migrations in Git.

Run manually only after Mongo backup.
