import { Menu, MenuItem } from "obsidian";

type MenuItemWithSubmenu = MenuItem & {
	setSubmenu(): Menu;
};

function hasSubmenu(item: MenuItem): item is MenuItemWithSubmenu {
	return typeof (item as Partial<MenuItemWithSubmenu>).setSubmenu === "function";
}

function createSubmenu(item: MenuItem): Menu {
	if (!hasSubmenu(item)) {
		throw new Error("Notebook submenu API is not available in this Obsidian build.");
	}

	return item.setSubmenu();
}

export function getOrCreateNotebookSubmenu(menu: Menu): Menu {
	let notebookSubmenu: Menu | null = null;

	menu.addItem((item: MenuItem) => {
		item.setTitle("Notebook").setIcon("dices").setSection("selection");
		notebookSubmenu = createSubmenu(item);
	});

	if (!notebookSubmenu) {
		throw new Error("Failed to create the Notebook submenu.");
	}

	return notebookSubmenu;
}
