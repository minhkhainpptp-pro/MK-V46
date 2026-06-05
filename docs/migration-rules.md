# MK-V46 Migration Rules

Do not fix production MongoDB manually.

All data repairs must be scripts under:

```
scripts/migrations/
```

Every migration must:
1. Be idempotent.
2. Log what it changed.
3. Be safe to run twice.
4. Have a clear filename with date and purpose.
