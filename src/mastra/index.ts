import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { ObservabilityStoragePostgresVNext, PostgresStore } from '@mastra/pg';
import { MastraCompositeStore } from '@mastra/core/storage';
import { Observability, MastraStorageExporter, MastraPlatformExporter, SamplingStrategyType, SensitiveDataFilter } from '@mastra/observability';
import { templateEnricherAgent } from './agents/template-enricher-agent';
import { queryParserAgent } from './agents/query-parser-agent';
import { termMatcherAgent } from './agents/term-matcher-agent';
import { templateEnrichmentWorkflow } from './workflows/template-enrichment-workflow';
import { db } from '../lib/db';

/**
 * Tracing for every AI call (R&D setting): nothing is sampled out.
 * Exported so code that calls a model directly (embeddings) can add its own spans,
 * and so scripts can flush traces before they exit.
 */
export const observability = new Observability({
  configs: {
    default: {
      serviceName: '1invite-template-search',
      sampling: { type: SamplingStrategyType.ALWAYS },
      exporters: [
        new MastraStorageExporter(), // Persists traces to Mastra storage (Postgres, below)
        new MastraPlatformExporter(), // Also sends to Mastra Platform when MASTRA_PLATFORM_ACCESS_TOKEN is set
      ],
      spanOutputProcessors: [
        new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
      ],
    },
  },
});

export const mastra = new Mastra({
  workflows: { templateEnrichmentWorkflow },
  agents: { templateEnricherAgent, queryParserAgent, termMatcherAgent },
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    // Share the app's PostgreSQL pool. Workflow state, memory and eval data live in Postgres.
    default: new PostgresStore({
      id: 'mastra-storage',
      pool: db,
    }),
    domains: {
      // Traces also live in Postgres, so `next dev`, `next start`, scripts and Studio all
      // write to and read from one place (a DuckDB file can only be opened by one process).
      observability: new ObservabilityStoragePostgresVNext({ pool: db }),
    },
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability,
});
