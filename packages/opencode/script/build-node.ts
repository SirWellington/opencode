#!/usr/bin/env bun

import { $ } from "bun"
import { Script } from "@opencode-ai/script"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

const generated = await import("./generate.ts")

const createEmbeddedWebUIMap = async () => {
  console.log("Building Web UI for the node bundle")
  const appDir = path.join(__dirname, "../../app")
  const dist = path.join(appDir, "dist")
  await $`OPENCODE_CHANNEL=${Script.channel} bun run --cwd ${appDir} build`
  const files = (await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: dist })))
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => !file.endsWith(".map"))
    .sort()
  // The generated module ships in two places: the standalone node bundle
  // (packages/opencode/dist/node) and the desktop sidecar chunk
  // (packages/desktop/out/main/chunks), so resolve the app dist from both
  // candidate relative positions. Exporting null when neither exists lets the
  // server fall back to the upstream proxy (e.g. the published npm CLI).
  const entries = files.map((file) => `  ${JSON.stringify(file)}: path.join(base, ${JSON.stringify(file)}),`)
  return [
    `import { fileURLToPath } from "node:url"`,
    `import { existsSync } from "node:fs"`,
    `import path from "node:path"`,
    `const here = path.dirname(fileURLToPath(import.meta.url))`,
    `const base = [path.resolve(here, "../../../app/dist"), path.resolve(here, "../../../../app/dist")].find((candidate) => existsSync(path.join(candidate, "index.html")))`,
    `export default base ? {`,
    ...entries,
    `} : null`,
  ].join("\n")
}

const embeddedWebUi = await createEmbeddedWebUIMap()

await Bun.build({
  target: "node",
  entrypoints: ["./src/node.ts"],
  outdir: "./dist/node",
  format: "esm",
  sourcemap: "linked",
  external: ["jsonc-parser", "@lydell/node-pty"],
  define: {
    OPENCODE_MODELS_DEV: generated.modelsData,
    OPENCODE_VERSION: `'${Script.version}'`,
    OPENCODE_CHANNEL: `'${Script.channel}'`,
  },
  files: {
    "opencode-web-ui.gen.ts": embeddedWebUi,
  },
})

console.log("Build complete")
