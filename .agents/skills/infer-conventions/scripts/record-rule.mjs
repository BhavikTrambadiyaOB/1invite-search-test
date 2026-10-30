#!/usr/bin/env node
/**
 * Record a durable project convention in .ai/rules.
 *
 * Rules are grouped by area. Repeated calls for the same area append (or
 * update) sections in one markdown file and regenerate .ai/rules/index.md.
 *
 * Usage:
 *   node record-rule.mjs --glob 'src/mastra/**' --title '...' --note '...'
 *   node record-rule.mjs --glob 'src/app/**' --glob 'src/lib/**' \
 *     --title '...' --note '...' --root /path/to/project
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const RULES_DIRNAME = ".ai/rules";
const INDEX_FILENAME = "index.md";

function fail(message) {
  console.error(`record-rule: ${message}`);
  process.exit(1);
}

function usage() {
  console.log(`Usage: node record-rule.mjs --glob <pattern> [--glob <pattern> ...] --title <title> --note <note> [--root <dir>]

  --glob   Path glob the rule applies to. Repeat for multiple globs.
  --title  Short rule heading. Written as a level-2 section.
  --note   Rule body. A few imperative lines.
  --root   Project root. Defaults to the current working directory.
  --help   Show this message.`);
}

function parseArgs(argv) {
  const options = {
    globs: [],
    title: "",
    note: "",
    root: process.cwd(),
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    const equals = raw.indexOf("=");
    const flag = equals === -1 ? raw : raw.slice(0, equals);
    const inlineValue = equals === -1 ? null : raw.slice(equals + 1);

    const value = () => {
      if (inlineValue !== null) return inlineValue;
      index += 1;
      if (index >= argv.length) fail(`missing value for ${flag}`);
      return argv[index];
    };

    switch (flag) {
      case "--glob":
        options.globs.push(value());
        break;
      case "--title":
        options.title = value();
        break;
      case "--note":
        options.note = value();
        break;
      case "--root":
        options.root = value();
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        fail(`unknown option ${flag}`);
    }
  }

  return options;
}

function normalizeGlob(value) {
  let glob = String(value).trim().replace(/\\/g, "/");
  glob = glob.replace(/^\.\//, "").replace(/\/{2,}/g, "/");
  glob = glob.replace(/\/+$/, "");

  if (!glob) fail("glob must not be empty");
  if (glob.startsWith("/")) fail(`glob must be relative: ${glob}`);
  if (glob.split("/").includes("..")) fail(`glob must stay inside the project: ${glob}`);

  return glob;
}

function cleanTitle(value) {
  return String(value).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function cleanNote(value) {
  return String(value)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function kebab(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/**
 * Mirrors Laravel Boost: group by the meaningful directory segments. A glob
 * such as src/mastra/** and src/mastra/index.ts share the src/mastra area.
 */
function areaKey(glob) {
  const segments = glob.split("/").filter(Boolean);
  const directories = segments.filter(
    (segment) => !segment.includes("*") && !segment.includes("."),
  );
  const meaningful = directories.length > 0 ? directories : segments;

  return meaningful.join("/") || "root";
}

function slugForArea(area) {
  const words = area
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      /[*.]/.test(segment) ? segment.replaceAll(".", " ").toLowerCase() : segment,
    );

  return kebab(words.join(" ")) || "root";
}

function headingForSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseRule(source) {
  const text = source.replace(/\r\n/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);

  if (!match) return { paths: [], body: text };

  const paths = [];
  let inPaths = false;

  for (const line of match[1].split("\n")) {
    if (!line.trim() || /^\s*#/.test(line)) continue;

    if (/^paths\s*:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }

    if (!inPaths) continue;

    const item = line.match(/^\s*-\s*(.+?)\s*$/);
    if (item) {
      paths.push(unquote(item[1]));
      continue;
    }

    if (/^\S/.test(line)) inPaths = false;
  }

  return {
    paths: [...new Set(paths.filter(Boolean))],
    body: text.slice(match[0].length).replace(/^\n+/, ""),
  };
}

function renderFrontmatter(paths) {
  const entries = paths.map((glob) => `  - ${glob}`).join("\n");
  return `---\npaths:\n${entries}\n---\n\n`;
}

function upsertSection(body, title, note) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const heading = `## ${title}`;
  const start = lines.findIndex((line) => line.trimEnd() === heading);

  if (start !== -1) {
    let end = start + 1;
    while (end < lines.length && !lines[end].startsWith("## ")) end += 1;
    lines.splice(start, end - start, heading, note, "");
    return `${lines.join("\n").trimEnd()}\n`;
  }

  return `${body.trimEnd()}\n\n${heading}\n${note}\n`;
}

async function listRuleFiles(rulesDir) {
  let entries;
  try {
    entries = await readdir(rulesDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        entry.name !== INDEX_FILENAME,
    )
    .map((entry) => path.join(rulesDir, entry.name))
    .sort();
}

async function loadRules(rulesDir) {
  const rules = [];

  for (const file of await listRuleFiles(rulesDir)) {
    try {
      const text = await readFile(file, "utf8");
      rules.push({ file, text, ...parseRule(text) });
    } catch {
      // Skip unreadable files. The index only lists valid rules.
    }
  }

  return rules;
}

function resolveTarget(rules, glob, rulesDir) {
  const area = areaKey(glob);
  const existing =
    rules.find((rule) => rule.paths[0] === glob) ??
    rules.find((rule) => rule.paths.length > 0 && areaKey(rule.paths[0]) === area);

  if (existing) return { file: existing.file, rule: existing };

  const baseSlug = slugForArea(area);
  let slug = baseSlug;
  let suffix = 2;
  const taken = new Set(rules.map((rule) => path.basename(rule.file)));

  while (taken.has(`${slug}.md`)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return {
    file: path.join(rulesDir, `${slug}.md`),
    rule: null,
  };
}

function relativePath(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

async function writeIndex(root, rulesDir, rules) {
  const rows = rules
    .filter((rule) => rule.paths.length > 0)
    .sort((a, b) =>
      relativePath(root, a.file).localeCompare(relativePath(root, b.file)),
    )
    .map(
      (rule) =>
        `| ${rule.paths.join(", ")} | ${relativePath(root, rule.file)} |`,
    );

  const table =
    rows.length === 0
      ? "No rules recorded yet."
      : `| Applies to | Rule file |\n| --- | --- |\n${rows.join("\n")}`;

  const body =
    "# Project Rules Index\n\n" +
    "Before planning or editing, find the row whose globs match the file's path and read that rule file.\n\n" +
    `${table}\n`;

  const indexPath = path.join(rulesDir, INDEX_FILENAME);
  await writeFile(indexPath, body, "utf8");

  return indexPath;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    usage();
    return;
  }

  if (options.globs.length === 0) fail("at least one --glob is required");

  const title = cleanTitle(options.title);
  const note = cleanNote(options.note);

  if (!title) fail("--title is required");
  if (title.startsWith("#")) fail("--title must not include markdown heading markers");
  if (!note) fail("--note is required");

  const globs = [...new Set(options.globs.map(normalizeGlob))];
  const root = path.resolve(options.root);
  const rulesDir = path.join(root, RULES_DIRNAME);

  await mkdir(rulesDir, { recursive: true });

  const rules = await loadRules(rulesDir);
  const target = resolveTarget(rules, globs[0], rulesDir);

  if (target.rule && /^(<{7}|>{7})(\s|$)/m.test(target.rule.text)) {
    fail(`refusing to edit a rule file with merge conflict markers: ${relativePath(root, target.file)}`);
  }

  let body;
  let paths;

  if (target.rule) {
    body = target.rule.body;
    paths = [...target.rule.paths];
    for (const glob of globs) {
      if (!paths.includes(glob)) paths.push(glob);
    }
    body = upsertSection(body, title, note);
  } else {
    paths = globs;
    const heading = headingForSlug(path.basename(target.file, ".md"));
    body = `# ${heading}\n\n## ${title}\n${note}\n`;
  }

  const output = `${renderFrontmatter(paths)}${body}`;
  await writeFile(target.file, output, "utf8");

  const updatedRules = await loadRules(rulesDir);
  const indexPath = await writeIndex(root, rulesDir, updatedRules);

  console.log(`Recorded rule in ${relativePath(root, target.file)}`);
  console.log(`Updated index ${relativePath(root, indexPath)}`);
}

main().catch((error) => {
  console.error(`record-rule: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
