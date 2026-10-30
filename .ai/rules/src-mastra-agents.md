---
paths:
  - src/mastra/agents/**
---

# Src Mastra Agents

## Agent IDs match file names
Use kebab-case agent ids that match the file name, such as weather-agent.ts exporting weatherAgent. Register the same export in src/mastra/index.ts.

## Agents keep configuration in the constructor
Define agents with new Agent({...}) and keep instructions, model, tools, and memory in that object. Use provider/model model strings and never hardcode API keys.
