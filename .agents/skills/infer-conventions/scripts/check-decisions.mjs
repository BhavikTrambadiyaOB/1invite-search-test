#!/usr/bin/env node
/**
 * Stop hook: when code changed after the last recorded decision, ask the agent once to record it.
 *
 * Compares the newest modified code file (git status) with the newest file in .ai/decisions
 * (including the "nothing to record" marker) and .ai/rules. If code is newer, it blocks the stop
 * with a reminder to use the infer-conventions skill. It never blocks twice in a row
 * (stop_hook_active), so it cannot loop, and it stays silent on any error.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

/** Paths whose changes can carry a decision. Generated, tooling and record folders are left out. */
const CODE = /^(src|scripts|db)\/|^(package\.json|next\.config\.ts|tsconfig\.json|components\.json|\.env\.example)$/;
const SKIP = /(^|\/)(node_modules|\.next|search-snapshots)\//;
const MAX_LISTED = 8;

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

function newestIn(dir) {
  let newest = 0;
  try {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".md") && name !== ".last-review") continue;
      newest = Math.max(newest, statSync(path.join(dir, name)).mtimeMs);
    }
  } catch {
    // Folder not there yet: nothing recorded.
  }
  return newest;
}

function main() {
  const input = readStdin();
  if (input.stop_hook_active) return;

  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  let status;
  try {
    status = execFileSync("git", ["status", "--porcelain", "-z", "--untracked-files=all"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString();
  } catch {
    return;
  }

  const changed = [];
  const parts = status.split("\0").filter(Boolean);
  for (let i = 0; i < parts.length; i += 1) {
    const code = parts[i].slice(0, 2);
    const file = parts[i].slice(3);
    if (code.startsWith("R") || code.startsWith("C")) i += 1; // the next part is the old name
    if (code.includes("D") || !CODE.test(file) || SKIP.test(file)) continue;
    try {
      changed.push({ file, mtime: statSync(path.join(root, file)).mtimeMs });
    } catch {
      // Removed since: skip.
    }
  }
  if (changed.length === 0) return;

  const recorded = Math.max(newestIn(path.join(root, ".ai/decisions")), newestIn(path.join(root, ".ai/rules")));
  const pending = changed.filter((c) => c.mtime > recorded + 1000).sort((a, b) => b.mtime - a.mtime);
  if (pending.length === 0) return;

  const list = pending.slice(0, MAX_LISTED).map((c) => `- ${c.file}`).join("\n");
  const more = pending.length > MAX_LISTED ? `\n- …and ${pending.length - MAX_LISTED} more` : "";
  const reason =
    `Code changed after the last recorded decision:\n${list}${more}\n\n` +
    "Use the infer-conventions skill (After a change mode): if these changes alter behavior, a convention, a setting or a " +
    "ranking/parsing rule, record why and when with scripts/record-decision.mjs, and update the matching rule with " +
    "scripts/record-rule.mjs when how the code works now changed. If nothing is worth recording (typo, formatting, " +
    "temporary test), run: node .agents/skills/infer-conventions/scripts/record-decision.mjs --none \"<reason>\". " +
    "Then finish your reply as before; do not repeat it.";
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
}

try {
  main();
} catch {
  // A reminder must never break the session.
}
