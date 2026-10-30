---
paths:
  - src/mastra/tools/**
---

# Src Mastra Tools

## Tools declare Zod schemas
Define tools with createTool, give each a kebab-case id and description, and declare both inputSchema and outputSchema with Zod. Return the declared output shape from execute and throw Error for expected failures.
