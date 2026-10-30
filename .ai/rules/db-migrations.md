---
paths:
  - db/migrations/**
---

# Db Migrations

## Numbered SQL migrations
Add schema changes as new numbered SQL files applied by npm run db:migrate. Never modify the legacy images table; search data lives in new tables.
