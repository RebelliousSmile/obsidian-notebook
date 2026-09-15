import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const directory = await mkdtemp(join(tmpdir(), "handbook-github-sources-"));
const stub = join(directory, "obsidian.mjs");
const output = join(directory, "harness.mjs");
try {
	await writeFile(stub, `
export async function requestUrl(options) {
  if (options.url.includes("/git/ref/heads/main")) {
    return { status: 200, json: { object: { sha: "${"a".repeat(40)}", type: "commit" } }, text: "", arrayBuffer: new ArrayBuffer(0) };
  }
  return { status: 200, json: null, text: "manifest text", arrayBuffer: new Uint8Array([1, 2, 3]).buffer };
}
`);
	await build({ entryPoints: ["tools/githubSources.harness.mts"], bundle: true, platform: "node", format: "esm", outfile: output, alias: { obsidian: stub }, logLevel: "silent" });
	await import(pathToFileURL(output).href);
} finally {
	await rm(directory, { recursive: true, force: true });
}
