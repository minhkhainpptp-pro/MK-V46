# MK-V46 API Rules

## Response contract
Every API should return:

```json
{
  "ok": true,
  "data": {},
  "message": "",
  "perf": {}
}
```

Errors:

```json
{
  "ok": false,
  "message": "Human readable error"
}
```

## Controller rule
Controllers only:
- read request
- call service
- return response

Business logic belongs in `src/services` or `src/core`.
