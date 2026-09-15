import { CalloutDefinition } from "./types";

/**
 * Les 8 callouts natifs de gestion-projet et client-guide sont `native:
 * false` bien qu'ils soient du catalogue : c'est ce champ qui déclenche le
 * CSS auto-généré de `styleWriter.ts` (`native: true` suppose un partial
 * SCSS statique qui n'existe pas ici).
 */
export const NATIVE_CALLOUTS: CalloutDefinition[] = [
	{
		id: "note", name: "Note", aliases: ["note"], scope: "gestion-projet",
		template: "title-body", icon: "sticky-note", font: "header",
		color: { kind: "fixed", hex: "#4c6ef5" }, native: false, styleKey: "note",
	},
	{
		id: "warning", name: "Attention", aliases: ["warning"], scope: "gestion-projet",
		template: "title-body", icon: "alert-triangle", font: "header",
		color: { kind: "fixed", hex: "#d9822b" }, native: false, styleKey: "warning",
	},
	{
		id: "tip", name: "Astuce", aliases: ["tip"], scope: "gestion-projet",
		template: "title-body", icon: "lightbulb", font: "header",
		color: { kind: "fixed", hex: "#3f9d6b" }, native: false, styleKey: "tip",
	},
	{
		id: "question", name: "Question", aliases: ["question"], scope: "gestion-projet",
		template: "title-body", icon: "help-circle", font: "header",
		color: { kind: "fixed", hex: "#8b6fc9" }, native: false, styleKey: "question",
	},
	{
		id: "important", name: "Important", aliases: ["important"], scope: "client-guide",
		template: "title-body", icon: "alert-circle", font: "header",
		color: { kind: "fixed", hex: "#c0392b" }, native: false, styleKey: "important",
	},
	{
		id: "astuce", name: "Astuce", aliases: ["astuce"], scope: "client-guide",
		template: "title-body", icon: "lightbulb", font: "header",
		color: { kind: "fixed", hex: "#27965e" }, native: false, styleKey: "astuce",
	},
	{
		id: "attention", name: "Attention", aliases: ["attention"], scope: "client-guide",
		template: "title-body", icon: "alert-triangle", font: "header",
		color: { kind: "fixed", hex: "#d68910" }, native: false, styleKey: "attention",
	},
	{
		id: "a-faire-client", name: "À faire (client)", aliases: ["a-faire-client", "à-faire-client"], scope: "client-guide",
		template: "title-body", icon: "list-todo", font: "header",
		color: { kind: "fixed", hex: "#2f6fb0" }, native: false, styleKey: "a-faire-client",
	},
];
