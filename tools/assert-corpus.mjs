/**
 * Bundle the corpus harness, then run it.
 *
 * The repo has no test runner and no `tsx`, and it is not getting one for
 * this: esbuild is already a devDependency, and it turns the `.mts` harness
 * into something node can execute in one synchronous call.
 *
 * `obsidian` is not resolvable outside Obsidian, so it is aliased to a stub
 * rather than marked external: the block registry imports Menu and Notice as
 * values, and an external import would fail at require time.
 */
import { buildSync } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";

const work = mkdtempSync(join(tmpdir(), "handbook-corpus-"));
const stub = join(work, "obsidian-stub.mjs");
const bundle = join(work, "harness.cjs");

// Enough of Obsidian for the modules the harness pulls in. Nothing here is
// exercised: the harness calls parse and render, never a command or a notice.
writeFileSync(
	stub,
	`export class Notice { constructor() {} }
export class Menu {}
export class MenuItem {}
export class Editor {}
export class Plugin {}
export class PluginSettingTab {}
export class Setting {}
export class Modal {}
export class ItemView {}
export function setIcon() {}
`,
);

try {
	buildSync({
		entryPoints: ["tools/assertCorpus.harness.mts"],
		outfile: bundle,
		bundle: true,
		platform: "node",
		format: "cjs",
		target: "node16",
		alias: { obsidian: stub },
		external: ["fs", "path"],
		logLevel: "warning",
	});

	const run = spawnSync(process.execPath, [bundle], { stdio: "inherit" });

	process.exit(run.status ?? 1);
} finally {
	rmSync(work, { recursive: true, force: true });
}
