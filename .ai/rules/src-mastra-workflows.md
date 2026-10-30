---
paths:
  - src/mastra/workflows/**
---

# Src Mastra Workflows

## Workflows compose typed steps
Compose workflows with createWorkflow and createStep. Every step declares Zod inputSchema and outputSchema and returns the declared shape. Resolve registered agents with mastra.getAgent inside a step instead of importing agent instances directly.
