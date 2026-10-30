---
paths:
  - src/app/api/chat/**
---

# Src App Api Chat

## Chat endpoint streams through the Mastra adapter
Call handleChatStream with agentId and version v7, then wrap the stream with createUIMessageStreamResponse. Keep the memory thread and resource IDs server-side and do not accept them from the client.
