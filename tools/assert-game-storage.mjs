import { buildSync } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";

const work = mkdtempSync(join(tmpdir(), "handbook-game-storage-"));
const stub = join(work, "obsidian-stub.mjs");
const bundle = join(work, "harness.cjs");

writeFileSync(stub, "export class Plugin {}\n");

try {
	buildSync({
		entryPoints: ["tools/gameStorage.harness.mts"],
		outfile: bundle,
		bundle: true,
		platform: "node",
		format: "cjs",
		target: "node16",
		alias: { obsidian: stub },
		logLevel: "warning",
	});
	const run = spawnSync(process.execPath, [bundle], { stdio: "inherit" });
	process.exit(run.status ?? 1);
} finally {
	rmSync(work, { recursive: true, force: true });
}
