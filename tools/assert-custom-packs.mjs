/**
 * Bundle the custom packs harness, then run it.
 *
 * Same motif as `assert-override.mjs`: esbuild turns the `.mts` harness into
 * something node can execute in one synchronous call, with `obsidian`
 * aliased to a stub since it is not resolvable outside Obsidian.
 */
import { buildSync } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";

const work = mkdtempSync(join(tmpdir(), "handbook-custom-packs-"));
const stub = join(work, "obsidian-stub.mjs");
const bundle = join(work, "harness.cjs");

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
		entryPoints: ["tools/customPacks.harness.mts"],
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
