---
paths:
  - scripts/**
---

# Scripts

## Database scripts run through npm with tsx
Run scripts through npm scripts that call tsx --env-file=.env, import the shared pool from @/lib/db, and end the pool in a finally block.
