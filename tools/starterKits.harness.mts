import { installStarterKitSources, readStarterKitCatalog, STARTER_KITS } from "../src/packs/starterKits";

if (STARTER_KITS.length !== 0) throw new Error("shipped catalogue should expose no starter kits");

const catalogue = readStarterKitCatalog({
	manifestVersion: 1,
	kits: [
		{ id: "single", label: "Single", description: "A", initialMode: "sample-pack", sources: [{ repository: "owner/repo", reference: { kind: "latest" } }] },
		{ id: "multi", label: "Multi", description: "B", initialMode: "other-pack", sources: [
			{ repository: "owner/pack-a", reference: { kind: "branch", value: "main" } },
			{ repository: "owner/pack-b", reference: { kind: "branch", value: "main" } },
		] },
	],
});
if (catalogue.length !== 2 || catalogue[0]?.sources[0]?.id !== "owner--repo") throw new Error("starter kit catalogue was not read");
if (catalogue[1]?.sources.length !== 2 || catalogue[1]?.sources[1]?.id !== "owner--pack-b") throw new Error("multi-source starter kit was not preserved");
const installed: string[] = [];
await installStarterKitSources(catalogue[1], async (source) => { installed.push(source.id); });
if (installed.join(",") !== "owner--pack-a,owner--pack-b") throw new Error("multi-source starter kit did not install every source in order");
if (readStarterKitCatalog({ manifestVersion: 1, kits: [{ id: "bad", label: "Bad", description: "", initialMode: "bad", sources: [] }] }).length !== 0) throw new Error("invalid starter kit was accepted");
console.log("starter kits: green");
