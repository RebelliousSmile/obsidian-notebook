import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const temporaryDirectory = await mkdtemp(
	join(tmpdir(), "handbook-note-background-"),
);
const output = join(temporaryDirectory, "assert-note-background.mjs");

try {
	await build({
		entryPoints: ["tools/assertNoteBackground.harness.mts"],
		bundle: true,
		platform: "node",
		format: "esm",
		outfile: output,
		logLevel: "silent",
	});
	await import(pathToFileURL(output).href);
} finally {
	await rm(temporaryDirectory, { recursive: true, force: true });
}
