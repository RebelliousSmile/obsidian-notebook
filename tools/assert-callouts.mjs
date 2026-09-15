import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const temporaryDirectory = await mkdtemp(join(tmpdir(), "handbook-callouts-"));
const output = join(temporaryDirectory, "assert-callouts.mjs");

try {
	await build({
		entryPoints: ["tools/assertCallouts.harness.mts"],
		bundle: true,
		platform: "node",
		format: "esm",
		outfile: output,
		logLevel: "silent",
		external: ["obsidian"],
	});
	await import(pathToFileURL(output).href);
} finally {
	await rm(temporaryDirectory, { recursive: true, force: true });
}
