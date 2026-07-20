// Gzip size budgets — fails the build when the bundle bloats.
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "../packages/core/dist");

const BUDGETS = [
  ["consentloop.loader.min.js", 1.6, "critical-path smart loader"],
  ["consentloop.iife.min.js", 12.5, "full widget (single file)"],
  ["index.js", 7.0, "ESM entry (UI in lazy chunk)"],
];

let failed = false;
for (const [file, budgetKb, label] of BUDGETS) {
  const gz = gzipSync(readFileSync(join(dist, file)), { level: 9 }).length / 1024;
  const ok = gz <= budgetKb;
  if (!ok) failed = true;
  console.log(`${ok ? "✓" : "✗"} ${file} — ${gz.toFixed(2)} KB gz (budget ${budgetKb} KB) · ${label}`);
}
if (failed) {
  console.error("\nSize budget exceeded. Trim before shipping — performance is the product.");
  process.exit(1);
}
