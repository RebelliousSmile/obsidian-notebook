import { installResolvedSchemaSource } from "../src/games/sourceInstaller";
import type { ResolvedGithubSource } from "../src/games/githubSources";
import type { SchemaSource } from "../src/games/sources";
import { removeSchemaSourceStorage } from "../src/games/storage";

const files = new Map<string, string | ArrayBuffer>();
const folders = new Set<string>([".obsidian/handbook/sources"]);
const adapter = {
	exists: async (path: string) => files.has(path) || folders.has(path),
	mkdir: async (path: string) => { folders.add(path); },
	rmdir: async (path: string) => { for (const key of [...files.keys()]) if (key.startsWith(`${path}/`)) files.delete(key); for (const key of [...folders]) if (key === path || key.startsWith(`${path}/`)) folders.delete(key); },
	rename: async (from: string, to: string) => { for (const [key, value] of [...files]) if (key === from || key.startsWith(`${from}/`)) { files.delete(key); files.set(`${to}${key.slice(from.length)}`, value); } for (const key of [...folders]) if (key === from || key.startsWith(`${from}/`)) { folders.delete(key); folders.add(`${to}${key.slice(from.length)}`); } },
	write: async (path: string, value: string) => { files.set(path, value); },
	writeBinary: async (path: string, value: ArrayBuffer) => { files.set(path, value); },
};
const plugin = { manifest: { version: "2.7.0" }, app: { vault: { configDir: ".obsidian", adapter } } } as unknown as import("obsidian").Plugin;
const source: SchemaSource = { id: "owner--repo", repository: "owner/repo", reference: { kind: "branch", value: "main" } };
const content: Record<string, string> = {
	"handbook.json": JSON.stringify({ manifestVersion: 1, repository: "owner/repo", packs: [{ id: "test", version: "1.0.0", path: "handbook/test/pack.json" }] }),
	"handbook/test/pack.json": JSON.stringify({ manifestVersion: 1, version: "1.0.0", minimumHandbookVersion: "2.7.0", requires: [], pack: { id: "test", label: "Test", style: {}, assets: { images: { paper: "paper.png" }, stylesheets: ["styles/base.css", "styles/print.css"] } } }),
};
const resolved: ResolvedGithubSource = { revision: "a".repeat(40), readText: async (path) => { if (!(path in content)) throw new Error(path); return content[path]; }, readBinary: async () => new Uint8Array([1, 2]).buffer };
await installResolvedSchemaSource(plugin, source, resolved);
const root = ".obsidian/handbook/sources/owner--repo";
if (!files.has(`${root}/packs/test/pack.json`) || !files.has(`${root}/packs/test/assets/paper.png`) || !files.has(`${root}/packs/test/assets/styles/base.css`) || !files.has(`${root}/packs/test/assets/styles/print.css`) || !files.has(`${root}/source.json`)) throw new Error("source promotion failed");
const before = files.get(`${root}/packs/test/pack.json`);
await installResolvedSchemaSource(plugin, source, { ...resolved, revision: "b".repeat(40), readBinary: async () => { throw new Error("network failed"); } }).catch(() => undefined);
if (files.get(`${root}/packs/test/pack.json`) !== before) throw new Error("failed installation replaced the previous source");
const unsafeContent: Record<string, string> = {
	"handbook.json": JSON.stringify({ manifestVersion: 1, repository: "owner/repo", packs: [{ id: "unsafe", version: "1.0.0", path: "handbook/unsafe/pack.json" }] }),
	"handbook/unsafe/pack.json": JSON.stringify({ manifestVersion: 1, version: "1.0.0", minimumHandbookVersion: "2.7.0", requires: [], pack: { id: "unsafe", label: "Unsafe", style: {}, assets: { stylesheets: ["../outside.css"] } } }),
};
await installResolvedSchemaSource(plugin, source, { ...resolved, revision: "u".repeat(40), readText: async (path) => unsafeContent[path] ?? Promise.reject(new Error(path)) }).catch(() => undefined);
if (files.get(`${root}/packs/test/pack.json`) !== before) throw new Error("unsafe stylesheet replaced the previous source");
const rootedContent: Record<string, string> = {
	"handbook.json": JSON.stringify({ manifestVersion: 1, repository: "owner/repo", packs: [{ id: "rooted", version: "1.0.0", path: "handbook/rooted/pack.json" }] }),
	"handbook/rooted/pack.json": JSON.stringify({ manifestVersion: 1, version: "1.0.0", minimumHandbookVersion: "2.7.0", requires: [], pack: { id: "rooted", label: "Rooted", style: {}, assets: { root: "media", images: { paper: "paper.png" } } } }),
};
await installResolvedSchemaSource(plugin, source, { revision: "c".repeat(40), readText: async (path) => rootedContent[path] ?? Promise.reject(new Error(path)), readBinary: async () => new Uint8Array([3]).buffer });
if (!files.has(`${root}/packs/rooted/media/paper.png`)) throw new Error("custom asset root was not preserved");
await removeSchemaSourceStorage(plugin, source.id);
if ([...files.keys()].some((path) => path.startsWith(`${root}/`))) throw new Error("removed source left installed files behind");
if ([...folders].some((path) => path === root || path.startsWith(`${root}/`))) throw new Error("removed source left installed folders behind");
console.log("source installer: green");
