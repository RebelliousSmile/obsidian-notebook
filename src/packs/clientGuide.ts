import { StylePack, EMPTY_LAYER } from "./types";
import { accent, tokens } from "./tokens";

export const clientGuidePack: StylePack = {
	id: "client-guide",
	label: "Guide client",
	polarities: ["light"],
	style: {
		base: { note: tokens(accent("#2f9e6e")), workspace: {} },
		light: EMPTY_LAYER,
		dark: EMPTY_LAYER,
	},
};
