# MK-V46 Performance Rules

## Hard rules
- No unbounded `find({})` on transaction collections.
- No DB query inside loops.
- No heavy data in list APIs.
- List APIs must have filters and `limit`.

## Targets
- Delivery list: < 300ms
- Delivery detail: < 500ms
- Confirm delivery/accounting: < 700ms
- Dashboard: < 1000ms
