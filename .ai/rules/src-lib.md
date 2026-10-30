---
paths:
  - src/lib/**
---

# Src Lib

## Shared PostgreSQL pool
Create the pg Pool once in src/lib/db.ts and import db for server-side queries; do not create per-module pools. Mastra shares this pool through PostgresStore.
