---
paths:
  - src/mastra/index.ts
  - src/mastra/**
  - src/lib/search/**
---

# Src Mastra

## Mastra registry and storage
Export the root mastra instance and its observability from src/mastra/index.ts. Register agents and workflows by key. Use MastraCompositeStore with PostgresStore as default storage and ObservabilityStoragePostgresVNext for traces, both sharing the pool from src/lib/db.ts, with sampling always on. Let them create their own mastra_* tables.

## Relative imports in Mastra-loaded code
Use relative imports, not the @/ alias, in code that Mastra loads (src/mastra and the search library it imports).
