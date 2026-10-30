---
paths:
  - src/app/api/**
  - src/app/api/[...mastra]/**
---

# Src App Api

## API handlers export named HTTP methods
Export named HTTP methods from route.ts files: async handlers for custom endpoints, or destructured exports from createNextRouteHandler for the Mastra adapter. Return Next.js response helpers such as NextResponse.json or createUIMessageStreamResponse instead of raw objects.

## Mastra HTTP API is a catch-all adapter
Mount the Mastra HTTP API at src/app/api/[...mastra]/route.ts and re-export every HTTP method from createNextRouteHandler({ mastra }). Do not hand-write Mastra REST endpoints.
