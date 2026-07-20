import { build } from "esbuild";
import { rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/index.tsx"],
  outdir: "dist",
  bundle: true,
  format: "esm",
  target: ["es2019"],
  external: ["react", "react/jsx-runtime", "consentloop"],
  banner: { js: "/*! @consentloop/react v0.1.0 | MIT */" },
  legalComments: "none",
});
console.log("@consentloop/react built");
