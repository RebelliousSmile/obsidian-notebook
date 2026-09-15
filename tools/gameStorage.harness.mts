import {
	gameStoragePaths,
	overridesReadPath,
	packsReadPath,
	prepareGameStorage,
} from "../src/games/storage";

const failures: string[] = [];
function check(claim: string, held: boolean): void {
	if (!held) failures.push(claim);
}

function fakePlugin(initialFiles: Record<string, string>, failCopy = "") {
	const files = new Map(Object.entries(initialFiles));
	const directories = new Set<string>([".config-obsidian", "plugins", "plugins/obsidian-handbook"]);
	let failing = failCopy;

	function parents(path: string): void {
		const parts = path.split("/");
		for (let index = 1; index < parts.length; index++) {
			directories.add(parts.slice(0, index).join("/"));
		}
	}
	for (const path of files.keys()) parents(path);

	const adapter = {
		exists: async (path: string) => files.has(path) || directories.has(path),
		mkdir: async (path: string) => {
			parents(path);
			directories.add(path);
		},
		list: async (path: string) => {
			const prefix = `${path}/`;
			return {
				files: [...files.keys()].filter((entry) =>
					entry.startsWith(prefix) && !entry.slice(prefix.length).includes("/"),
				),
				folders: [...directories].filter((entry) =>
					entry.startsWith(prefix) && !entry.slice(prefix.length).includes("/"),
				),
			};
		},
		copy: async (source: string, destination: string) => {
			if (source === failing) throw new Error("planned copy failure");
			const value = files.get(source);
			if (value === undefined || files.has(destination)) throw new Error("copy refused");
			parents(destination);
			files.set(destination, value);
		},
		rename: async (source: string, destination: string) => {
			if (files.has(source)) {
				const value = files.get(source) as string;
				files.delete(source);
				files.set(destination, value);
				return;
			}
			if (!directories.has(source)) throw new Error("rename source absent");
			parents(destination);
			for (const path of [...directories]) {
				if (path === source || path.startsWith(`${source}/`)) {
					directories.delete(path);
					directories.add(`${destination}${path.slice(source.length)}`);
				}
			}
			for (const [path, value] of [...files]) {
				if (path.startsWith(`${source}/`)) {
					files.delete(path);
					files.set(`${destination}${path.slice(source.length)}`, value);
				}
			}
		},
		rmdir: async (path: string) => {
			for (const entry of [...directories]) {
				if (entry === path || entry.startsWith(`${path}/`)) directories.delete(entry);
			}
			for (const entry of [...files.keys()]) {
				if (entry.startsWith(`${path}/`)) files.delete(entry);
			}
		},
		remove: async (path: string) => {
			files.delete(path);
		},
	};

	return {
		plugin: {
			manifest: { dir: "plugins/obsidian-handbook", version: "2.7.0" },
			app: { vault: { configDir: ".config-obsidian", adapter } },
		} as unknown as import("obsidian").Plugin,
		files,
		directories,
		allowCopies: () => { failing = ""; },
	};
}

async function run(): Promise<void> {
	{
		const state = fakePlugin({
			"plugins/obsidian-handbook/packs/adrenaline/pack.json": "pack",
			"plugins/obsidian-handbook/packs/adrenaline/assets/paper.webp": "image",
			"plugins/obsidian-handbook/overrides.json": "override",
		});
		const paths = gameStoragePaths(state.plugin);
		check("configDir determines the root", paths.root === ".config-obsidian/handbook");
		await prepareGameStorage(state.plugin);
		check("the pack manifest migrates", state.files.has(`${paths.packs}/adrenaline/pack.json`));
		check("nested assets migrate", state.files.has(`${paths.packs}/adrenaline/assets/paper.webp`));
		check("the override migrates", state.files.get(paths.overrides) === "override");
		state.directories.delete("plugins/obsidian-handbook/packs");
		check("persistent packs survive plugin replacement", await packsReadPath(state.plugin) === paths.packs);
		check("persistent overrides survive plugin replacement", await overridesReadPath(state.plugin) === paths.overrides);
	}

	{
		const state = fakePlugin({
			".config-obsidian/handbook/packs/current/pack.json": "current",
			"plugins/obsidian-handbook/overrides.json": "legacy override",
		});
		await prepareGameStorage(state.plugin);
		const paths = gameStoragePaths(state.plugin);
		check("existing packs are preserved", state.files.get(`${paths.packs}/current/pack.json`) === "current");
		check("a missing override migrates independently", state.files.get(paths.overrides) === "legacy override");
	}

	{
		const source = "plugins/obsidian-handbook/packs/adrenaline/pack.json";
		const state = fakePlugin({ [source]: "pack" }, source);
		const paths = gameStoragePaths(state.plugin);
		await prepareGameStorage(state.plugin);
		check("failed migration publishes no packs folder", !state.directories.has(paths.packs));
		check("failed migration removes its temporary folder", !state.directories.has(`${paths.root}/.packs-migration`));
		check("failed migration preserves the source", state.files.get(source) === "pack");
		state.allowCopies();
		await prepareGameStorage(state.plugin);
		check("a failed migration is retryable", state.files.get(`${paths.packs}/adrenaline/pack.json`) === "pack");
	}
}

run().then(() => {
	if (failures.length > 0) {
		for (const failure of failures) console.error(`not held: ${failure}`);
		process.exit(1);
	}
	console.log("game storage: green");
}).catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
