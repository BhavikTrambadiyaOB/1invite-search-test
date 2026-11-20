#!/usr/bin/env node
/**
 * Record why and when a behavior or convention changed, next to the rules.
 *
 * Rules in .ai/rules say how the code works now (timeless). Decisions in
 * .ai/decisions say what changed, why, and when, newest first, so the history
 * of an area can be read without digging through git.
 *
 * Usage:
 *   node record-decision.mjs --glob 'src/lib/search/**' --title 'Main color ranks first' \
 *     --why 'Testers flagged cards with a little brown as "not brown".' \
 *     --what 'An asked color in the first two color tags ranks before a color detail.' \
 *     [--files src/lib/search/search-templates.ts --files src/lib/search/ranking.ts] [--date 2026-11-17]
 *
 *   node record-decision.mjs --none 'Typo fix only; no behavior changed.'
 *     Marks the current changes as reviewed with nothing to record, so the Stop hook stays quiet.
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DECISIONS_DIRNAME = ".ai/decisions";
const INDEX_FILENAME = "index.md";
const REVIEW_MARKER = ".last-review";

function fail(message) {
  console.error(`record-decision: ${message}`);
  process.exit(1);
}

function usage() {
  console.log(`Usage:
  node record-decision.mjs --glob <pattern> [--glob ...] --title <title> --why <why> --what <what>
                           [--files <path> ...] [--date YYYY-MM-DD] [--root <dir>]
  node record-decision.mjs --none <reason> [--root <dir>]

  --glob   Path glob the decision is about (same areas as .ai/rules). Repeat for several.
  --title  Short name of the change.
  --why    The reason: the problem, feedback or request that caused it.
  --what   What now happens (behavior, rule or setting), in plain words.
  --files  Main files changed. Optional, repeatable.
  --date   Day of the change. Defaults to today.
  --none   Nothing worth recording in the current changes; quiets the Stop hook.`);
}

function parseArgs(argv) {
  const options = { globs: [], files: [], title: "", why: "", what: "", date: "", none: null, root: process.cwd(), help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    const equals = raw.indexOf("=");
    const flag = equals === -1 ? raw : raw.slice(0, equals);
    const inline = equals === -1 ? null : raw.slice(equals + 1);
    const value = () => {
      if (inline !== null) return inline;
      index += 1;
      if (index >= argv.length) fail(`missing value for ${flag}`);
      return argv[index];
    };
    switch (flag) {
      case "--glob": options.globs.push(value()); break;
      case "--files": options.files.push(value()); break;
      case "--title": options.title = value(); break;
      case "--why": options.why = value(); break;
      case "--what": options.what = value(); break;
      case "--date": options.date = value(); break;
      case "--none": options.none = value(); break;
      case "--root": options.root = value(); break;
      case "--help": case "-h": options.help = true; break;
      default: fail(`unknown option ${flag}`);
    }
  }
  return options;
}

const oneLine = (value) => String(value).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();

function normalizeGlob(value) {
  const glob = String(value).trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  if (!glob) fail("glob must not be empty");
  if (glob.startsWith("/") || glob.split("/").includes("..")) fail(`glob must be relative and inside the project: ${glob}`);
  return glob;
}

// Same area grouping and file names as record-rule.mjs, so a decision log sits next to its rule file.
function areaKey(glob) {
  const segments = glob.split("/").filter(Boolean);
  const directories = segments.filter((s) => !s.includes("*") && !s.includes("."));
  return (directories.length > 0 ? directories : segments).join("/") || "root";
}
function slugForArea(area) {
  const words = area.split("/").filter(Boolean).map((s) => (/[*.]/.test(s) ? s.replaceAll(".", " ").toLowerCase() : s));
  return words.join(" ").replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "root";
}
const heading = (slug) => slug.split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseLog(text) {
  const match = text.replace(/\r\n/g, "\n").match(/^---\npaths:\n([\s\S]*?)\n---\n?/);
  const paths = match ? match[1].split("\n").map((l) => l.replace(/^\s*-\s*/, "").trim()).filter(Boolean) : [];
  return { paths, body: match ? text.slice(match[0].length) : text };
}

async function writeIndex(root, dir) {
  const rows = [];
  for (const name of (await readdir(dir)).filter((n) => n.endsWith(".md") && n !== INDEX_FILENAME).sort()) {
    const text = await readFile(path.join(dir, name), "utf8");
    const { paths } = parseLog(text);
    const dates = [...text.matchAll(/^## (\d{4}-\d{2}-\d{2})/gm)].map((m) => m[1]).sort();
    rows.push(`| ${paths.join(", ")} | ${DECISIONS_DIRNAME}/${name} | ${dates.length} | ${dates.at(-1) ?? ""} |`);
  }
  const body =
    "# Decision Log Index\n\n" +
    "Why and when behavior changed, per area, newest first. Rules in .ai/rules say how things work now; " +
    "read the matching log here before changing an area, so a past decision is not undone by accident.\n\n" +
    (rows.length ? `| Applies to | Log | Entries | Last |\n| --- | --- | --- | --- |\n${rows.join("\n")}\n` : "No decisions recorded yet.\n");
  await writeFile(path.join(dir, INDEX_FILENAME), body, "utf8");
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) return usage();
  const root = path.resolve(o.root);
  const dir = path.join(root, DECISIONS_DIRNAME);
  await mkdir(dir, { recursive: true });

  if (o.none !== null) {
    if (!oneLine(o.none)) fail("--none needs a reason");
    await writeFile(path.join(dir, REVIEW_MARKER), `${new Date().toISOString()} ${oneLine(o.none)}\n`, "utf8");
    console.log("Marked current changes as reviewed: nothing to record.");
    return;
  }

  if (o.globs.length === 0) fail("at least one --glob is required");
  const title = oneLine(o.title), why = oneLine(o.why), what = oneLine(o.what);
  if (!title || !why || !what) fail("--title, --why and --what are required");
  const date = o.date || today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`--date must be YYYY-MM-DD: ${date}`);

  const globs = [...new Set(o.globs.map(normalizeGlob))];
  const area = areaKey(globs[0]);
  let file = null, paths = globs, body = "";
  for (const name of (await readdir(dir)).filter((n) => n.endsWith(".md") && n !== INDEX_FILENAME)) {
    const parsed = parseLog(await readFile(path.join(dir, name), "utf8"));
    if (parsed.paths.length && areaKey(parsed.paths[0]) === area) {
      file = path.join(dir, name);
      paths = [...new Set([...parsed.paths, ...globs])];
      body = parsed.body;
      break;
    }
  }
  file ??= path.join(dir, `${slugForArea(area)}.md`);
  const title1 = `# ${heading(path.basename(file, ".md"))} decisions`;
  const entries = body.replace(/^\s*# .*\n+/, "").trim();

  const files = o.files.map((f) => `\`${f.trim()}\``).join(", ");
  const entry = [`## ${date} · ${title}`, `- **Why:** ${why}`, `- **What:** ${what}`, files ? `- **Files:** ${files}` : null]
    .filter(Boolean)
    .join("\n");

  // Newest first: the new entry goes at the top, under the heading.
  const output = `---\npaths:\n${paths.map((g) => `  - ${g}`).join("\n")}\n---\n\n${title1}\n\n${entry}\n${entries ? `\n${entries}\n` : ""}`;
  await writeFile(file, output, "utf8");
  await writeIndex(root, dir);
  console.log(`Recorded decision in ${DECISIONS_DIRNAME}/${path.basename(file)}`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
