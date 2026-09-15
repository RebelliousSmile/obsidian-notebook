import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const output = "tools/.assert-game-variants.mjs";

try {
	await build({
		entryPoints: ["tools/assertGameVariants.harness.mts"],
		bundle: true,
		platform: "node",
		format: "esm",
		outfile: output,
		logLevel: "silent",
		external: ["obsidian", "postcss", "postcss-selector-parser"],
	});
	await import(pathToFileURL(output).href);
} finally {
	await rm(output, { force: true });
}
