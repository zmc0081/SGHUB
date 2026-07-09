#!/usr/bin/env node
/**
 * Set the app version everywhere in one command, so the four files can
 * never drift (the failure mode `check-version.cjs` guards against).
 *
 * Usage:
 *   node scripts/bump-version.cjs 2.3.0     (or `npm run bump-version 2.3.0`)
 *
 * Updates (targeted text replace — minimal diff, no reformatting):
 *   - package.json                 "version"
 *   - src-tauri/tauri.conf.json    "version"
 *   - src-tauri/Cargo.toml         [package] version
 *   - src-tauri/Cargo.lock         [[package]] name = "app" version
 *   - CLAUDE.md                    "当前版本: VX.Y.Z"
 *
 * Then prints the next steps (run check-version, build). Does NOT commit.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const next = process.argv[2];

if (!next || !/^\d+\.\d+\.\d+$/.test(next)) {
  console.error("Usage: node scripts/bump-version.cjs <X.Y.Z>  (semver, e.g. 2.3.0)");
  process.exit(1);
}

/** Replace text in a file via a regex, asserting exactly one substitution. */
function patch(relPath, regex, replacement, expectMatch = true) {
  const abs = path.join(ROOT, relPath);
  const before = fs.readFileSync(abs, "utf8");
  let count = 0;
  const after = before.replace(regex, (...args) => {
    count++;
    return typeof replacement === "function" ? replacement(...args) : replacement;
  });
  if (expectMatch && count === 0) {
    throw new Error(`${relPath}: pattern not found (${regex})`);
  }
  if (after !== before) fs.writeFileSync(abs, after);
  return count;
}

// package.json — first top-level "version"
patch("package.json", /("version"\s*:\s*")[^"]+(")/, (_m, a, b) => `${a}${next}${b}`);

// tauri.conf.json — top-level "version"
patch(
  "src-tauri/tauri.conf.json",
  /("version"\s*:\s*")[^"]+(")/,
  (_m, a, b) => `${a}${next}${b}`,
);

// Cargo.toml — version inside [package]. Replace only the first
// `version = "..."` (the [package] table is first in the file).
patch(
  "src-tauri/Cargo.toml",
  /(^version\s*=\s*")[^"]+(")/m,
  (_m, a, b) => `${a}${next}${b}`,
);

// Cargo.lock — the `app` crate's version. Match the block with name = "app".
// `\r?\n` tolerates CRLF line endings on Windows checkouts.
patch(
  "src-tauri/Cargo.lock",
  /(name = "app"\r?\nversion = ")[^"]+(")/,
  (_m, a, b) => `${a}${next}${b}`,
);

// CLAUDE.md — the "当前版本: VX.Y.Z" line. Local-only doc (gitignored);
// skip entirely when the file isn't in this checkout (e.g. CI).
if (fs.existsSync(path.join(ROOT, "CLAUDE.md"))) {
  patch(
    "CLAUDE.md",
    /(当前版本:\s*V)\d+\.\d+\.\d+/,
    (_m, a) => `${a}${next}`,
    false,
  );
}

// Privacy policy headers (zh + en) — the policy version MUST equal the app
// version (CLAUDE.md release gate). Also refresh the effective date to today.
const today = new Date().toISOString().slice(0, 10);
patch(
  "src/assets/privacy/zh-CN.md",
  /(\*\*协议版本\*\*[：:]\s*v?)\d+\.\d+\.\d+/i,
  (_m, a) => `${a}${next}`,
);
patch(
  "src/assets/privacy/zh-CN.md",
  /(\*\*生效日期\*\*[：:]\s*)\d{4}-\d{2}-\d{2}/i,
  (_m, a) => `${a}${today}`,
);
patch(
  "src/assets/privacy/en-US.md",
  /(\*\*Version\*\*:\s*v?)\d+\.\d+\.\d+/i,
  (_m, a) => `${a}${next}`,
);
patch(
  "src/assets/privacy/en-US.md",
  /(\*\*Effective\*\*:\s*)\d{4}-\d{2}-\d{2}/i,
  (_m, a) => `${a}${today}`,
);

console.log(`✓ Bumped all version fields to ${next}`);
console.log("Next:");
console.log("  1. node scripts/check-version.cjs  # confirm alignment");
console.log("  2. review the diff, then commit");
console.log("  3. cargo build / npm run tauri build");
