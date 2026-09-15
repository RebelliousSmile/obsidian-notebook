import { installStarterKitSources, readStarterKitCatalog, STARTER_KITS } from "../src/games/starterKits";

if (STARTER_KITS.length !== 2) throw new Error("shipped catalogue should expose exactly two starter kits");
if (STARTER_KITS[0]?.sources[0]?.repository !== "RebelliousSmile/schema-in-the-mist") throw new Error("Mist Engine starter kit source is incorrect");
if (STARTER_KITS[1]?.sources.map((source) => source.repository).join(",") !== "RebelliousSmile/schema-adrenaline,RebelliousSmile/schema-pbta") throw new Error("shipped multi-source starter kit is incorrect");

const catalogue = readStarterKitCatalog({
	manifestVersion: 1,
	kits: [
		{ id: "city", label: "City", description: "A", initialMode: "city-of-mist", sources: [{ repository: "owner/repo", reference: { kind: "latest" } }] },
		{ id: "multi", label: "Multi", description: "B", initialMode: "adrenaline", sources: [
			{ repository: "owner/adrenaline", reference: { kind: "branch", value: "main" } },
			{ repository: "owner/pbta", reference: { kind: "branch", value: "main" } },
		] },
	],
});
if (catalogue.length !== 2 || catalogue[0]?.sources[0]?.id !== "owner--repo") throw new Error("starter kit catalogue was not read");
if (catalogue[1]?.sources.length !== 2 || catalogue[1]?.sources[1]?.id !== "owner--pbta") throw new Error("multi-source starter kit was not preserved");
const installed: string[] = [];
await installStarterKitSources(catalogue[1], async (source) => { installed.push(source.id); });
if (installed.join(",") !== "owner--adrenaline,owner--pbta") throw new Error("multi-source starter kit did not install every source in order");
if (readStarterKitCatalog({ manifestVersion: 1, kits: [{ id: "bad", label: "Bad", description: "", initialMode: "bad", sources: [] }] }).length !== 0) throw new Error("invalid starter kit was accepted");
console.log("starter kits: green");
