import { StylePack } from "./types";
import { accent, tokens } from "./tokens";

export const gestionProjetPack: StylePack = {
	id: "gestion-projet",
	label: "Gestion de projet",
	polarities: ["light", "dark"],
	style: {
		base: {
			note: tokens(accent("#4c6ef5")),
			workspace: tokens(accent("#4c6ef5")),
		},
		light: {
			note: tokens({ "--background-secondary": "#f3f5f9" }),
			workspace: tokens({ "--background-secondary": "#f3f5f9" }),
		},
		dark: {
			note: tokens({ "--background-secondary": "#20242f" }),
			workspace: tokens({ "--background-secondary": "#20242f" }),
		},
	},
};
