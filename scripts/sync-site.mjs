// Copies built bundles + schema into site/vendor so the static site is self-contained.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "packages/core/dist");
const vendor = join(root, "site/vendor");
mkdirSync(vendor, { recursive: true });

for (const f of ["consentloop.iife.min.js", "consentloop.loader.min.js", "index.min.js", "size-report.json"]) {
  copyFileSync(join(dist, f), join(vendor, f));
}
copyFileSync(join(root, "schema/consentloop.schema.json"), join(root, "site/consentloop.schema.json"));

// keep the version badge in site pages honest
const size = JSON.parse(readFileSync(join(dist, "size-report.json"), "utf8"));
writeFileSync(
  join(vendor, "meta.js"),
  `window.CL_META=${JSON.stringify({
    version: "0.1.0",
    gzip: {
      loader: +(size["consentloop.loader.min.js"].gzip / 1024).toFixed(2),
      full: +(size["consentloop.iife.min.js"].gzip / 1024).toFixed(2),
    },
  })};`
);
console.log("site vendor synced");
