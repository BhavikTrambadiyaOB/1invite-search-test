/**
 * Imports test-case sheets as report versions, and captures live and current search results for
 * /search/report. Every capture names a version and a phase, and runs a small batch (19 by default)
 * so the live server is never hit with a whole sheet at once.
 *
 * Usage:
 *   npm run search:report:snapshot -- --versions
 *   npm run search:report:snapshot -- --csv "new sheet.csv" --version=2
 *   npm run search:report:snapshot -- --version=2 --phase=1
 *   npm run search:report:snapshot -- --version=2 --phase=1 --limit=10
 *   npm run search:report:snapshot -- --version=2 --phase=1 "query one" "query two"
 *   npm run search:report:snapshot -- --version=2 --phase=1 --file queries.txt
 *   npm run search:report:snapshot -- --version=2 --phase=1 --retry-live
 *
 * `--csv` imports a sheet into a version (created on first import) and does not run anything. Test-case
 * sheets in any column layout are read: a "Search Query" column plus "Case Type" or "Search Category";
 * "What It Tests", "Expected Result" and any other named columns are kept. The occasion-wise export is
 * also read. Each sheet row is one test case; rows that are the same search are captured once.
 * `--version V --phase P` captures the version's searches not yet captured in that phase, at most
 * `--limit` (default 19) per run, three at a time. Run it again to continue. Runs larger than 50 pause for
 * 5 minutes after every 50 searches, so the live server never gets a long burst.
 * `--retry-live` re-runs only the live search for reports in that version and phase whose live capture
 * failed, with the same limit and pauses. The current side and any feedback are kept.
 * `--file` accepts a JSON array of query strings, {"queries": [...]} or one query per line.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { flushTracesAndClose } from "./lib/close";
import {
  csvHeader,
  isTestCaseCsv,
  parseOccasionCsv,
  parseTestCaseCsv,
  testCaseQuery,
} from "@/lib/search/report-csv";
import { normalizeQuery } from "@/lib/search/parse-query";
import {
  importSearchReportQueries,
  listReportVersions,
  markImportedQueryRun,
  pendingQueriesForPhase,
} from "@/lib/search/report-import";
import {
  captureCurrentReport,
  captureLiveReport,
  listLiveErrorReports,
  saveLiveCapture,
  saveSearchReport,
} from "@/lib/search/report";

/** Searches per run unless --limit says otherwise: small batches keep load on the live server low. */
const DEFAULT_LIMIT = 19;
/** Big runs go in chunks of this many searches, with a pause between chunks to rest the live server. */
const CHUNK_SIZE = 50;
const CHUNK_PAUSE_MS = 5 * 60 * 1000;

type Options = {
  queries: string[];
  file?: string;
  csv?: string;
  limit: number;
  phase?: number;
  version?: number;
  versions: boolean;
  retryLive: boolean;
  help: boolean;
};

function usage() {
  console.log(`Usage:
  npm run search:report:snapshot -- --versions
  npm run search:report:snapshot -- --csv "new sheet.csv" --version=2
  npm run search:report:snapshot -- --version=2 --phase=1 [--limit=${DEFAULT_LIMIT}]
  npm run search:report:snapshot -- --version=2 --phase=1 "query one" "query two"
  npm run search:report:snapshot -- --version=2 --phase=1 --file path/to/queries.txt
  npm run search:report:snapshot -- --version=2 --phase=1 --retry-live [--limit=${DEFAULT_LIMIT}]

--csv imports a sheet into a version and runs nothing.
--retry-live re-runs only the live side of reports whose live capture failed.
Capturing always needs --version and --phase, and runs at most --limit searches (default ${DEFAULT_LIMIT}).
Run the same command again to continue the phase.`);
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    queries: [],
    limit: DEFAULT_LIMIT,
    versions: false,
    retryLive: false,
    help: false,
  };
  const positive = (name: string, raw: string) => {
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new Error(`${name} must be a positive number`);
    return value;
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      options.queries.push(arg);
      continue;
    }
    const equals = arg.indexOf("=");
    const name = equals >= 0 ? arg.slice(0, equals) : arg;
    const inline = equals >= 0 ? arg.slice(equals + 1) : undefined;
    const value = () => {
      const next = inline ?? args[++i];
      if (next === undefined) throw new Error(`${name} needs a value`);
      return next;
    };

    switch (name) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--retry-live":
        options.retryLive = true;
        break;
      case "--versions":
        options.versions = true;
        break;
      case "--file":
        options.file = value();
        break;
      case "--csv":
        options.csv = value();
        break;
      case "--limit":
        options.limit = positive("--limit", value());
        break;
      case "--phase":
        options.phase = positive("--phase", value());
        break;
      case "--version":
        options.version = positive("--version", value());
        break;
      default:
        throw new Error(`Unknown option ${name}`);
    }
  }
  return options;
}

async function queriesFromFile(file: string): Promise<string[]> {
  const text = await readFile(file, "utf8");
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed))
      return parsed.filter((q): q is string => typeof q === "string");
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      Array.isArray((parsed as { queries?: unknown }).queries)
    ) {
      return (parsed as { queries: unknown[] }).queries.filter(
        (q): q is string => typeof q === "string",
      );
    }
    throw new Error(
      'JSON file must be an array of strings or {"queries": [...]}',
    );
  }
  return trimmed.split(/\r?\n/);
}

async function printVersions() {
  const versions = await listReportVersions();
  if (versions.length === 0) {
    console.log(
      'No versions yet. Import a sheet with --csv "file.csv" --version=1.',
    );
    return;
  }
  for (const v of versions) {
    const phases = v.phases.length
      ? v.phases.map((p) => `Phase ${p.phase}: ${p.reports}`).join(", ")
      : "nothing captured";
    console.log(`v${v.version}  ${v.sourceFile}`);
    console.log(
      `     ${v.testCases} test cases, ${v.queries} searches · ${phases}`,
    );
    console.log(`     columns: ${v.columns.join(", ") || "—"}`);
  }
}

async function importCsv(file: string, version: number) {
  const text = await readFile(file, "utf8");
  const testCases = isTestCaseCsv(text);
  const header = csvHeader(text);
  if (!testCases && header.some((name) => /query/i.test(name))) {
    throw new Error(
      `Could not find a case type column in ${path.basename(file)}. Columns: ${header.join(", ")}. ` +
        'Expected "Case Type" or "Search Category" next to "Search Query".',
    );
  }
  const parsed = testCases ? parseTestCaseCsv(text) : parseOccasionCsv(text);
  const existing = (await listReportVersions()).find(
    (v) => v.version === version,
  );
  if (existing && existing.sourceFile !== path.basename(file)) {
    console.log(
      `Note: v${version} was imported from "${existing.sourceFile}". Adding these rows to it.`,
    );
  }
  const result = await importSearchReportQueries(parsed, {
    sourceFile: path.basename(file),
    version,
    columns: header.filter(Boolean),
  });
  console.log(
    `${result.created ? "Created" : "Updated"} v${version}: ${result.rows.toLocaleString()} ${testCases ? "test cases" : "occasion queries"} from ${path.basename(file)} (${result.saved.toLocaleString()} saved).`,
  );
  console.log(
    `Capture with: npm run search:report:snapshot -- --version=${version} --phase=1`,
  );
}

type Target = { query: string; importIds: string[] };

function addTarget(map: Map<string, Target>, query: string, importId?: string) {
  const text = testCaseQuery(query);
  if (!text.trim()) return;
  const key = normalizeQuery(text) || text.trim().toLowerCase();
  const existing = map.get(key);
  if (existing) {
    if (importId && !existing.importIds.includes(importId))
      existing.importIds.push(importId);
    return;
  }
  map.set(key, { query: text, importIds: importId ? [importId] : [] });
}

/** Runs `work` for each item, three at a time, pausing 5 minutes after every CHUNK_SIZE items. */
async function runInChunks<T>(
  items: T[],
  work: (item: T, index: number) => Promise<void>,
) {
  let next = 0;
  let chunkEnd = 0;
  async function worker() {
    while (next < chunkEnd) {
      const index = next++;
      await work(items[index], index);
    }
  }
  for (let start = 0; start < items.length; start += CHUNK_SIZE) {
    if (start > 0) {
      const resume = new Date(Date.now() + CHUNK_PAUSE_MS).toLocaleTimeString();
      console.log(
        `\nPausing 5 minutes after ${start} searches to rest the live server (resumes at ${resume}; ${items.length - start} to go).\n`,
      );
      await sleep(CHUNK_PAUSE_MS);
    }
    chunkEnd = Math.min(start + CHUNK_SIZE, items.length);
    await Promise.all(
      Array.from({ length: Math.min(3, chunkEnd - start) }, () => worker()),
    );
  }
}

async function retryLive(version: number, phase: number, limit: number) {
  const all = await listLiveErrorReports(version, phase);
  const targets = all.slice(0, limit);
  if (targets.length === 0) {
    console.log(`v${version} Phase ${phase} has no live errors.`);
    return;
  }
  console.log(
    `Retrying live for ${targets.length} of ${all.length} ${all.length === 1 ? "report" : "reports"} with a live error in v${version} Phase ${phase} (current side kept; up to 3 at a time${targets.length > CHUNK_SIZE ? `; 5-minute pause after every ${CHUNK_SIZE}` : ""})\n`,
  );
  let failed = 0;
  await runInChunks(targets, async (target, index) => {
    const prefix = `[${index + 1}/${targets.length}]`;
    try {
      const live = await captureLiveReport(target.query);
      await saveLiveCapture(target.id, live);
      if (live.error || !live.snapshot) failed++;
      console.log(
        `${prefix} #${target.id} "${target.query}" live: ${live.error ?? `${live.snapshot?.results.length ?? 0} shown${live.snapshot?.total != null ? ` of ${live.snapshot.total}` : ""}`}`,
      );
    } catch (error) {
      failed++;
      console.error(
        `${prefix} Failed #${target.id} "${target.query}": ${error instanceof Error ? error.message : error}`,
      );
    }
  });
  const left = all.length - targets.length + failed;
  console.log(
    `\nRetried ${targets.length}; ${targets.length - failed} fixed${failed ? `, ${failed} still failing` : ""}. ${left} live ${left === 1 ? "error" : "errors"} left in v${version} Phase ${phase}.`,
  );
  if (left > 0)
    console.log("Run the same command again to retry the next batch.");
  console.log(
    `Review at /search/report?v=${version}&phase=${phase}&error=live`,
  );
  if (failed) process.exitCode = 1;
}

async function main() {
  let options: Options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    usage();
    process.exitCode = 1;
    return;
  }
  if (options.help) return usage();
  if (options.versions) return printVersions();

  if (options.csv) {
    if (options.version === undefined) {
      console.error(
        "--csv needs --version: the version these test cases belong to (a new number for a new sheet).",
      );
      await printVersions();
      process.exitCode = 1;
      return;
    }
    if (options.phase !== undefined || options.queries.length || options.file) {
      console.error(
        "--csv only imports. Capture afterwards with --version and --phase.",
      );
      process.exitCode = 1;
      return;
    }
    await importCsv(options.csv, options.version);
    return;
  }

  if (options.version === undefined || options.phase === undefined) {
    console.error("Capturing needs both --version and --phase.");
    usage();
    await printVersions();
    process.exitCode = 1;
    return;
  }
  const { version, phase } = options;
  const info = (await listReportVersions()).find((v) => v.version === version);
  if (!info) {
    console.error(
      `v${version} does not exist. Import its sheet first with --csv "file.csv" --version=${version}.`,
    );
    process.exitCode = 1;
    return;
  }
  if (options.retryLive) {
    if (options.queries.length || options.file) {
      console.error(
        "--retry-live picks the failed reports itself; leave out queries and --file.",
      );
      process.exitCode = 1;
      return;
    }
    await retryLive(version, phase, options.limit);
    return;
  }
  const lastPhase = Math.max(0, ...info.phases.map((p) => p.phase));
  if (phase > lastPhase + 1) {
    console.error(
      `v${version} has phases up to ${lastPhase}. The next phase is ${lastPhase + 1}.`,
    );
    process.exitCode = 1;
    return;
  }

  const byQuery = new Map<string, Target>();
  if (options.queries.length || options.file) {
    for (const query of options.queries) addTarget(byQuery, query);
    if (options.file)
      for (const query of await queriesFromFile(options.file))
        addTarget(byQuery, query);
  } else {
    for (const row of await pendingQueriesForPhase(version, phase))
      addTarget(byQuery, row.query, row.id);
  }

  const allTargets = [...byQuery.values()];
  const targets = allTargets.slice(0, options.limit);
  if (targets.length === 0) {
    console.log(
      `v${version} Phase ${phase} is complete. Review it at /search/report?v=${version}&phase=${phase}.`,
    );
    return;
  }

  console.log(
    `Capturing ${targets.length} of ${allTargets.length} remaining ${allTargets.length === 1 ? "search" : "searches"} for v${version} Phase ${phase} (first 40 results each; up to 3 at a time${targets.length > CHUNK_SIZE ? `; 5-minute pause after every ${CHUNK_SIZE}` : ""})\n`,
  );

  let failed = 0;
  await runInChunks(targets, async (target, index) => {
    const prefix = `[${index + 1}/${targets.length}]`;
    console.log(
      `${prefix} Starting v${version} Phase ${phase}: ${target.query}`,
    );
    try {
      const [live, current] = await Promise.all([
        captureLiveReport(target.query),
        captureCurrentReport(target.query),
      ]);
      const hasError = !!(
        live.error ||
        current.error ||
        !live.snapshot ||
        !current.snapshot
      );
      const id = await saveSearchReport(target.query, live, current, {
        phase,
        version,
      });
      for (const importId of target.importIds)
        await markImportedQueryRun(importId, id);

      console.log(`${prefix} Saved report #${id} for "${target.query}"`);
      console.log(
        `${prefix} live: ${live.error ?? `${live.snapshot?.results.length ?? 0} shown${live.snapshot?.total != null ? ` of ${live.snapshot.total}` : ""}`}`,
      );
      console.log(
        `${prefix} live tags: ${live.snapshot?.suggestionsError ?? (live.snapshot ? `${live.snapshot.suggestedTags?.length ?? 0} tags` : "not captured")}`,
      );
      console.log(
        `${prefix} current: ${current.error ?? `${current.snapshot?.results.length ?? 0} shown${current.snapshot?.total != null ? ` of ${current.snapshot.total}` : ""}`}`,
      );
      console.log(
        `${prefix} current tags: ${current.snapshot ? `${current.snapshot.suggestedTags?.length ?? 0} tags` : "not captured"}`,
      );
      if (hasError) failed++;
    } catch (error) {
      failed++;
      console.error(
        `${prefix} Failed "${target.query}": ${error instanceof Error ? error.message : error}`,
      );
    }
  });

  const left = allTargets.length - targets.length;
  console.log(
    `Finished ${targets.length} for v${version} Phase ${phase}; ${targets.length - failed} without errors${failed ? `, ${failed} failed or need retrying` : ""}.`,
  );
  console.log(
    left > 0
      ? `${left} searches left. Run the same command again to capture the next ${Math.min(left, options.limit)}.`
      : `v${version} Phase ${phase} is complete.`,
  );
  console.log(`Review at /search/report?v=${version}&phase=${phase}`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => flushTracesAndClose());
