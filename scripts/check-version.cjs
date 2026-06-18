#!/usr/bin/env node
/**
 * Release-gate: assert the app version is identical across every file that
 * encodes it. A mismatch here is the root cause of the historical
 * "installed 2.2.4 but the About page says 2.2.1" class of bugs, so this
 * runs in CI (pr-check.yml) and should be run locally before any build.
 *
 * Sources of truth checked (all must match):
 *   - package.json                     "version"
 *   - src-tauri/tauri.conf.json        "version"   (→ embedded in the binary)
 *   - src-tauri/Cargo.toml             [package] version
 *   - src-tauri/Cargo.lock             [[package]] name = "app" version
 *
 * The binary's `app.package_info().version` (what the Settings page shows)
 * comes from tauri.conf.json / Cargo.toml, so keeping all four aligned
 * guarantees: code version == packaged version == installed-display version.
 *
 * Exit 0 = all aligned. Exit 1 = mismatch or a version could not be read.
 * Usage: `node scripts/check-version.cjs`  (or `npm run check-version`)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

/** Read + parse, returning { version, label } or throwing a clear error. */
function readJsonVersion(relPath) {
  const abs = path.join(ROOT, relPath);
  const json = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (typeof json.version !== "string") {
    throw new Error(`${relPath}: missing string "version"`);
  }
  return json.version.trim();
}

/** Pull `version = "x.y.z"` from the [package] table of a Cargo.toml. */
function readCargoTomlVersion(relPath) {
  const abs = path.join(ROOT, relPath);
  const text = fs.readFileSync(abs, "utf8");
  // Scope to the [package] section so a dependency's version can't match.
  const pkgSection = text.split(/^\[/m).find((s) => s.startsWith("package]"));
  if (!pkgSection) throw new Error(`${relPath}: no [package] section`);
  const m = pkgSection.match(/^\s*version\s*=\s*"([^"]+)"/m);
  if (!m) throw new Error(`${relPath}: no version in [package]`);
  return m[1].trim();
}

/** Pull the version of the `app` crate entry from Cargo.lock. */
function readCargoLockAppVersion(relPath) {
  const abs = path.join(ROOT, relPath);
  const text = fs.readFileSync(abs, "utf8");
  // Each entry is `[[package]]\nname = "..."\nversion = "..."`.
  const entries = text.split(/\[\[package\]\]/);
  for (const e of entries) {
    if (/name\s*=\s*"app"/.test(e)) {
      const m = e.match(/version\s*=\s*"([^"]+)"/);
      if (m) return m[1].trim();
    }
  }
  throw new Error(`${relPath}: no [[package]] entry for name = "app"`);
}

const checks = [
  { label: "package.json", read: () => readJsonVersion("package.json") },
  {
    label: "src-tauri/tauri.conf.json",
    read: () => readJsonVersion("src-tauri/tauri.conf.json"),
  },
  {
    label: "src-tauri/Cargo.toml",
    read: () => readCargoTomlVersion("src-tauri/Cargo.toml"),
  },
  {
    label: "src-tauri/Cargo.lock (app)",
    read: () => readCargoLockAppVersion("src-tauri/Cargo.lock"),
  },
];

const results = [];
let hadError = false;
for (const c of checks) {
  try {
    results.push({ label: c.label, version: c.read() });
  } catch (e) {
    hadError = true;
    results.push({ label: c.label, version: null, error: e.message });
  }
}

const versions = results.filter((r) => r.version).map((r) => r.version);
const allEqual = versions.length > 0 && versions.every((v) => v === versions[0]);

console.log("Version consistency check:");
for (const r of results) {
  const status = r.error ? "ERR" : r.version === versions[0] ? "ok " : "MISMATCH";
  console.log(`  [${status}] ${r.label.padEnd(30)} ${r.version ?? `(${r.error})`}`);
}

if (hadError || !allEqual) {
  console.error(
    `\n✗ Version mismatch — fix all files to the same version (e.g. \`node scripts/bump-version.cjs ${
      versions[0] ?? "X.Y.Z"
    }\`) before building/releasing.`,
  );
  process.exit(1);
}

console.log(`\n✓ All versions aligned at ${versions[0]}`);
