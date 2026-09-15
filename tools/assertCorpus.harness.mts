/**
 * The corpus assertions.
 *
 * The repo has no test runner — no vitest, no jest, no tsx — it has a
 * convention: bundle a throwaway harness with esbuild, run it with node. This
 * file formalises it once instead of reinventing it per block.
 *
 * The `.mts` extension is load-bearing. `tsconfig.json` carries
 * `"include": ["**\/*.ts"]`, so `tsc -noEmit` sweeps the whole repo, `tools/`
 * included; `eslint.config.mjs` carries `files: ["**\/*.ts"]` and ignores only
 * node_modules, dist and demo. A `.ts` here would break the build exactly the
 * way one in `src/` does. A `.mts` escapes both.
 *
 * Run it with `pnpm assert:corpus`, never with node directly: it needs the
 * esbuild bundle that `tools/assert-corpus.mjs` produces.
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { BRUMES_BLOCKS } from "../src/features/blocks/registry";
import { TOML_EXPORTS } from "../src/features/blocks/tomlExports";
import type { BrumesBlock } from "../src/features/blocks/types";
import { log } from "../src/utils/logger";
import {
	loadMistContractCases,
	MIST_BLOCK_IDS,
	MIST_TARGET_TO_BLOCK,
	MIST_TARGETS,
} from "./mistContractCorpus.mts";
import { ADRENALINE_DOCUMENT_CODECS } from "schema-adrenaline";
import { loadAdrenalineContractCases } from "./adrenalineContractCorpus.mts";
import { loadPbtaRenderCases, PBTA_TARGET_TO_BLOCK } from "./pbtaContractCorpus.mts";

/**
 * The blocks that do not yet honour the guideline.
 *
 * It is empty, and staying empty is the point: a new block added without a
 * schema document and a copy command breaks here, instead of being discovered
 * by an assert six months later the way these four were. Naming a block here
 * is how a debt is taken on deliberately — never how one is hidden.
 */
const BLOCKS_IN_DEBT: string[] = [];

// pnpm runs its scripts from the repo root, so the corpus is right there.
const CORPUS = join(process.cwd(), "corpus");
const failures: string[] = [];
const mistCases = loadMistContractCases();
const adrenalineCases = loadAdrenalineContractCases();
const ADRENALINE_BLOCK_IDS = ["adrenaline-pj", "adrenaline-pnj", "adrenaline-monstre"];
const pbtaCases = loadPbtaRenderCases();
const PBTA_BLOCK_IDS = Object.values(PBTA_TARGET_TO_BLOCK);

function fail(file: string, reason: string): void {
	failures.push(`${file}: ${reason}`);
}

/* ------------------------------------------------------------------ *
 * A document stub. The renderers touch createElement, appendChild,
 * classList.add, dataset and textContent, and nothing else.
 * ------------------------------------------------------------------ */

class El {
	tagName: string;
	textContent = "";
	children: El[] = [];
	dataset: Record<string, string> = {};
	classList = {
		add: (...names: string[]) => {
			for (const name of names) {
				this.classes.push(name);
			}
		},
	};
	classes: string[] = [];

	constructor(tagName: string) {
		this.tagName = tagName;
	}

	appendChild(child: El): El {
		this.children.push(child);
		return child;
	}
}

const doc = {
	createElement: (tagName: string) => new El(tagName),
};

/** Every text the rendered tree carries, so an empty render is visible. */
function renderedText(element: El): string {
	let text = element.textContent;

	for (const child of element.children) {
		text += renderedText(child);
	}

	return text;
}

/* ------------------------------------------------------------------ *
 * The corpus
 * ------------------------------------------------------------------ */

/** A corpus file is named after the block it feeds, before the first dot. */
function blockIdOf(file: string): string {
	const dot = file.indexOf(".");

	return dot === -1 ? file : file.slice(0, dot);
}

function findBlock(id: string): BrumesBlock<unknown> | null {
	for (const block of BRUMES_BLOCKS) {
		if (block.id === id) {
			return block;
		}
	}

	return null;
}

/** The `# attend:` directive a refusal opens on. */
function readExpectation(source: string): string {
	for (const raw of source.split("\n")) {
		const line = raw.trim();

		if (line.length === 0) {
			continue;
		}

		if (line.charAt(0) !== "#") {
			return "";
		}

		const marker = line.indexOf("attend:");

		if (marker !== -1) {
			return line.slice(marker + "attend:".length).trim();
		}
	}

	return "";
}

function listCorpus(camp: string): string[] {
	const directory = join(CORPUS, camp);
	if (!existsSync(directory)) return [];
	return readdirSync(directory).filter(
		(file) => file.slice(-5) === ".toml",
	);
}

function assertNoMistDuplicates(): void {
	for (const camp of ["temoins", "refus"]) {
		for (const file of listCorpus(camp)) {
			if (MIST_BLOCK_IDS.includes(blockIdOf(file))) {
				fail(file, "Mist corpus cases belong in schema-in-the-mist v1");
			}
		}
	}
}

function assertNoAdrenalineDuplicates(): void {
	for (const camp of ["temoins", "refus"]) {
		for (const file of listCorpus(camp)) {
			if (ADRENALINE_BLOCK_IDS.includes(blockIdOf(file))) {
				fail(file, "Adrenaline corpus cases belong in schema-adrenaline v1");
			}
		}
	}
}

function assertNoPbtaDuplicates(): void {
	for (const camp of ["temoins", "refus"]) {
		for (const file of listCorpus(camp)) {
			if (PBTA_BLOCK_IDS.includes(blockIdOf(file))) {
				fail(file, "PbtA corpus cases belong in schema-pbta v1");
			}
		}
	}
}

function assertTemoins(): void {
	for (const file of listCorpus("temoins")) {
		const id = blockIdOf(file);
		const block = findBlock(id);

		if (!block) {
			fail(file, `no block is registered under "${id}"`);
			continue;
		}

		const source = readFileSync(join(CORPUS, "temoins", file), "utf8");
		let data: unknown;

		try {
			data = block.parse(source);
		} catch (error) {
			fail(file, `parse threw: ${String(error)}`);
			continue;
		}

		if (data === null) {
			fail(file, "a witness must parse, and this one returned null");
			continue;
		}

		let element: El;

		try {
			element = block.render(data, doc as unknown as Document) as unknown as El;
		} catch (error) {
			fail(file, `render threw: ${String(error)}`);
			continue;
		}

		if (renderedText(element).trim().length === 0) {
			fail(file, "the witness rendered an element with no text in it");
		}
	}
}

function assertRefus(): void {
	for (const file of listCorpus("refus")) {
		const id = blockIdOf(file);
		const block = findBlock(id);

		if (!block) {
			fail(file, `no block is registered under "${id}"`);
			continue;
		}

		const source = readFileSync(join(CORPUS, "refus", file), "utf8");
		const expected = readExpectation(source);

		if (expected !== "null" && expected !== "dégradé") {
			fail(
				file,
				'it must open on "# attend: null" or "# attend: dégradé"',
			);
			continue;
		}

		let data: unknown;

		try {
			data = block.parse(source);
		} catch (error) {
			fail(file, `parse threw instead of degrading: ${String(error)}`);
			continue;
		}

		if (expected === "null") {
			if (data !== null) {
				fail(file, "the fault should have left nothing to render");
			}
			continue;
		}

		if (data === null) {
			fail(file, "the fault cost the whole block instead of its own field");
			continue;
		}

		try {
			const element = block.render(
				data,
				doc as unknown as Document,
			) as unknown as El;

			if (renderedText(element).trim().length === 0) {
				fail(file, "the degraded block rendered nothing at all");
			}
		} catch (error) {
			fail(file, `render threw on a degraded block: ${String(error)}`);
		}
	}
}

/* ------------------------------------------------------------------ *
 * The rule itself
 * ------------------------------------------------------------------ */

function hasCopyCommand(id: string): boolean {
	for (const spec of TOML_EXPORTS) {
		if (spec.block.id === id) {
			return true;
		}
	}

	return false;
}

function hasWitness(id: string): boolean {
	return listCorpus("temoins").indexOf(`${id}.toml`) !== -1;
}

function hasCorpus(id: string): boolean {
	return hasWitness(id) || MIST_BLOCK_IDS.includes(id) || ADRENALINE_BLOCK_IDS.includes(id) || PBTA_BLOCK_IDS.includes(id);
}

/**
 * What `aidd_docs/guidelines/schema-design.md` demands of every format, checked
 * rather than merely written down: a TOML document it can read — proved by a
 * witness that parses — and a copy command that can send it out.
 */
function assertRule(): void {
	for (const block of BRUMES_BLOCKS) {
		if (BLOCKS_IN_DEBT.indexOf(block.id) !== -1) {
			continue;
		}

		if (!hasCorpus(block.id)) {
			fail(
				block.id,
				"no local or installed contract case proves it reads a schema document",
			);
		}

		if (!hasCopyCommand(block.id)) {
			fail(block.id, "no copy-as-TOML command is declared for it");
		}
	}
}

/**
 * A witness copied as TOML and read back must draw the same thing.
 *
 * This is the round trip the guideline sells: a block leaves the note, lands
 * in Lantern or in another vault, and is still the block it was. Reading and
 * writing can each be right on their own and still disagree — a field written
 * under one name and read under another passes both halves and loses itself
 * in between.
 */
function assertAllerRetour(): void {
	for (const spec of TOML_EXPORTS) {
		const target = MIST_TARGETS.find(
			(candidate) => MIST_TARGET_TO_BLOCK[candidate] === spec.block.id,
		);
		const sources = target
			? mistCases
					.filter(
						(entry) =>
							entry.target === target && entry.handbook === "render",
					)
					.map((entry) => ({ file: entry.id, source: entry.source }))
			: ADRENALINE_BLOCK_IDS.includes(spec.block.id)
				? adrenalineCases
					.filter((entry) => entry.expect === "accept" && `adrenaline-${entry.target}` === spec.block.id)
					.map((entry) => ({
						file: `adrenaline/${entry.path}`,
						source: entry.format === "toml"
							? entry.source
							: ADRENALINE_DOCUMENT_CODECS[entry.target].stringifyToml(
								ADRENALINE_DOCUMENT_CODECS[entry.target].parseJson(entry.source),
							),
					}))
			: PBTA_BLOCK_IDS.includes(spec.block.id)
				? pbtaCases
					.filter((entry) => PBTA_TARGET_TO_BLOCK[entry.target] === spec.block.id)
					.map((entry) => ({ file: `pbta/${entry.path}`, source: entry.source }))
			: hasWitness(spec.block.id)
				? [
						{
							file: `${spec.block.id}.toml`,
							source: readFileSync(
								join(CORPUS, "temoins", `${spec.block.id}.toml`),
								"utf8",
							),
						},
					]
				: [];

		for (const { file, source } of sources) {
			assertRoundTrip(spec, file, source);
		}
	}
}

function assertRoundTrip(
	spec: (typeof TOML_EXPORTS)[number],
	file: string,
	source: string,
): void {
	const first = spec.block.parse(source);

	if (first === null) {
		fail(file, "the round-trip source did not parse");
		return;
	}

	let second: unknown;

	try {
		second = spec.block.parse(spec.toToml(first));
	} catch (error) {
		fail(file, `the round trip threw: ${String(error)}`);
		return;
	}

	if (second === null) {
		fail(file, "what the copy command wrote no longer parses");
		return;
	}

	const before = renderedText(
		spec.block.render(first, doc as unknown as Document) as unknown as El,
	);
	const after = renderedText(
		spec.block.render(second, doc as unknown as Document) as unknown as El,
	);

	if (before !== after) {
		fail(file, "the copy and the original do not draw the same thing");
	}
}

function reportDebt(): void {
	const named: string[] = [];

	for (const block of BRUMES_BLOCKS) {
		if (BLOCKS_IN_DEBT.indexOf(block.id) !== -1) {
			named.push(block.id);
		}
	}

	if (named.length === 0) {
		console.log("debt: none — every block honours the guideline");
		return;
	}

	console.log(`debt: ${named.join(", ")}`);
}

/* ------------------------------------------------------------------ */

// `currentLogLevel` starts at "error" and `shouldLog` compares
// LEVEL_ORDER[currentLogLevel] <= LEVEL_ORDER[level]: a harness that skips this
// measures silence and takes it for a failure.
log.setLevel("warn");

assertNoMistDuplicates();
assertNoAdrenalineDuplicates();
assertNoPbtaDuplicates();
assertTemoins();
assertRefus();
assertRule();
assertAllerRetour();

if (failures.length > 0) {
	for (const failure of failures) {
		console.error(`FAIL ${failure}`);
	}

	console.error(`\n${failures.length} corpus assertion(s) failed.`);
	process.exit(1);
}

reportDebt();
console.log("corpus: green");
