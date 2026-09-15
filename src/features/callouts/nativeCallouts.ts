import { CalloutDefinition } from "./types";

const PBTA_CALLOUTS: CalloutDefinition[] = [
	{
		id: "pbta-rule", name: "PbtA rule", aliases: ["pbta-rule"], scope: "all",
		template: "title-body", icon: "book-open-check", font: "header",
		color: { kind: "theme" }, native: true, styleKey: "pbta-rule", capability: "style:pbta",
	},
	{
		id: "pbta-trigger", name: "PbtA trigger", aliases: ["pbta-trigger"], scope: "all",
		template: "body-only", icon: "zap", font: "text",
		color: { kind: "theme" }, native: true, styleKey: "pbta-trigger", capability: "style:pbta",
	},
	{
		id: "pbta-choice", name: "PbtA choice", aliases: ["pbta-choice"], scope: "all",
		template: "title-body", icon: "list-checks", font: "text",
		color: { kind: "theme" }, native: true, styleKey: "pbta-choice", capability: "style:pbta",
	},
	{
		id: "pbta-result", name: "PbtA result", aliases: ["pbta-result"], scope: "all",
		template: "title-body", icon: "dice-6", font: "text",
		color: { kind: "theme" }, native: true, styleKey: "pbta-result", capability: "style:pbta",
	},
];

/**
 * The 7 historical styles, verrouillées : styleKey/scope/aliases par défaut
 * repris tels quels de `aliasSupport.ts` et des anciennes constantes
 * `DEFAULT_CITY_OF_MIST_CALLOUT_ALIASES`/`DEFAULT_LEGEND_IN_THE_MIST_CALLOUT_ALIASES`.
 * `color`/`font`/`template` sont renseignés pour la cohérence du type mais
 * ignorés par le futur écrivain de style : le rendu reste dans `_callouts.scss`.
 */
export const NATIVE_CALLOUTS: CalloutDefinition[] = [
	{
		id: "city-of-mist-clue",
		name: "Indice",
		aliases: ["clue"],
		scope: "city-of-mist",
		template: "body-only",
		icon: "search",
		font: "text",
		color: { kind: "theme" },
		native: true,
		styleKey: "clue",
	},
	{
		id: "city-of-mist-red-clue",
		name: "Indice rouge",
		aliases: ["red-clue"],
		scope: "city-of-mist",
		template: "body-only",
		icon: "badge-alert",
		font: "text",
		color: { kind: "theme" },
		native: true,
		styleKey: "red-clue",
	},
	{
		id: "city-of-mist-move",
		name: "Mouvement",
		aliases: ["move"],
		scope: "city-of-mist",
		template: "title-body",
		icon: "swords",
		font: "header",
		color: { kind: "theme" },
		native: true,
		styleKey: "move",
	},
	{
		id: "city-of-mist-description",
		name: "Description",
		aliases: ["description", "read-aloud"],
		scope: "city-of-mist",
		template: "body-only",
		icon: "scroll-text",
		font: "text",
		color: { kind: "theme" },
		native: true,
		styleKey: "description",
	},
	{
		id: "city-of-mist-note",
		name: "Note",
		aliases: ["note", "aside"],
		scope: "city-of-mist",
		template: "title-body",
		icon: "sticky-note",
		font: "header",
		color: { kind: "theme" },
		native: true,
		styleKey: "note",
	},
	{
		id: "legend-in-the-mist-note",
		name: "Note",
		aliases: ["note"],
		scope: "legend-in-the-mist",
		template: "title-body",
		icon: "sticky-note",
		font: "header",
		color: { kind: "theme" },
		native: true,
		styleKey: "note",
	},
	{
		id: "legend-in-the-mist-read-aloud",
		name: "Lecture à voix haute",
		aliases: ["read-aloud"],
		scope: "legend-in-the-mist",
		template: "body-only",
		icon: "mic",
		font: "text",
		color: { kind: "theme" },
		native: true,
		styleKey: "read-aloud",
	},
	...PBTA_CALLOUTS,
];
