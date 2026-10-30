---
paths:
  - .env*
  - src/app/api/**
  - src/mastra/**
---

# Env

## Secrets stay server-side
Read secrets only from server-side environment variables. Never prefix a secret with NEXT_PUBLIC_, never log credentials, and keep SensitiveDataFilter on Mastra observability exporters. Configure PostgreSQL through DATABASE_URL and optional DATABASE_SSL; commit only variable names in .env.example.
