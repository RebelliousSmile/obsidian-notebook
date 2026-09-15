import { StylePack } from "./types";
import { accent, tokens } from "./tokens";

export const gestionProjetPack: StylePack = {
	id: "gestion-projet",
	label: "Gestion de projet",
	polarities: ["light", "dark"],
	style: {
		base: { note: tokens(accent("#4c6ef5")), workspace: {} },
		light: { note: tokens({ "--background-secondary": "#f3f5f9" }), workspace: {} },
		dark: { note: tokens({ "--background-secondary": "#20242f" }), workspace: {} },
	},
};
