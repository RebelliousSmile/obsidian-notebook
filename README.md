# Notebook

Notebook is an Obsidian plugin with two built-in, swappable **style packs**: **Gestion de projet** (`gestion-projet`) and **Guide client** (`client-guide`). Gestion de projet is selected on first launch.

It started as a fork of [Brumes](https://github.com/4rtamis/obsidian-brumes) by [4rtamis](https://github.com/4rtamis), continued as [Handbook](https://github.com/RebelliousSmile/obsidian-handbook) by François-Xavier Guillois, and now follows its own road as Notebook, with its tabletop-roleplaying content removed in favour of general-purpose note-taking packs. The settings key names carried over from Handbook are unchanged, so a vault moving over keeps its configuration.

## Installation

Notebook activates `gestion-projet` on a vault with no prior configuration, with no install step or network call. The built-in packs are part of Notebook.

### 1. Prepare a vault

Notebook is easiest to test in a dedicated vault.

| Install                                               | Why                                    |
| ------------------------------------------------------ | --------------------------------------- |
| [BRAT](https://github.com/TfTHacker/obsidian42-brat)   | Required to install Notebook from GitHub |

Notebook writes its own colors and fonts into a style element it owns, scoped by the active style pack, in light and in dark. No theme and no other plugin is required for the visual base.

Fine-grained knobs come as a file you write. Put an `overrides.json` in the durable Notebook data folder (`<configDir>/notebook/overrides.json`, normally `.obsidian/notebook/overrides.json`) and it wins over the active pack for the custom properties it declares, and for nothing else:

```json
{
	"base": { "note": { "--h1-size": "2.4em" } },
	"dark": { "note": { "--background-primary": "#1B1B1F" } }
}
```

`base` applies whichever theme is on, `light` and `dark` only under theirs; the `workspace` slot next to `note` holds what the workspace theme toggle writes. A value the file leaves out keeps the pack's; removing the file restores the pack whole. The file is read at startup and on the *Reload personal overrides* command, or on the *Reload* button in the settings tab. A malformed value is dropped and reported in the console, and the rest of the file still applies.

Suggested vault setup:

1. Create a fresh Obsidian vault for testing.
2. Enable Community plugins.
3. Install `BRAT`.

### 2. Install Notebook with BRAT

1. Open `Settings -> BRAT`.
2. Choose `Add Beta plugin`.
3. Enter `RebelliousSmile/obsidian-notebook`.
4. Install the plugin, then enable `Notebook`.

### 3. Configure Notebook

1. Open `Settings -> Notebook`.
2. Pick your `Pack mode`. The rendering follows immediately, with no reload and no preset to import.
3. Leave `Colour scheme` on `Follow Obsidian`, or force Notebook's light or dark scheme independently of the vault theme.

The selected style pack styles every open Markdown source, live-preview and reading view in that window. It does not repaint the Obsidian chrome unless `Theme the workspace` is enabled. That toggle is independent of the pack and colour-scheme selectors: page textures, title cartouches and warning motifs remain confined to notes even when the workspace colours follow the pack.

### 4. Illustrations and fonts

The built-in packs use Notebook's colours and fonts. A local pack can also declare illustrations and fonts in the vault's Notebook data directory.

**Until the files are there, the pack renders degraded, never broken.** A card without its frame keeps its text on a flat ground and a border, a badge without its icon goes away instead of leaving an empty box, a drawn checkbox mark becomes a typed one, and a missing typeface falls through to the next family in its stack. Nothing errors and nothing renders as a broken image.

Local pack authors are responsible for using assets they may redistribute and carrying the corresponding licence information.

### 5. Note-local backgrounds

A note can use an image already stored in the vault as its page background. This works in Live Preview and reading view, with every style pack, and does not copy the image into Notebook or a schema package.

```yaml
background-image: "[[Assets/paper.webp]]"
background-position: center top
background-size: cover
background-repeat: no-repeat
background-opacity: 0.2
```

`background-position` accepts combinations of `left`, `center`, `right`, `top`, and `bottom`. `background-size` accepts `cover`, `contain`, or `auto`; `background-repeat` accepts `no-repeat`, `repeat`, `repeat-x`, or `repeat-y`; and `background-opacity` accepts a number from `0` to `1`. Omitted or invalid options use `center center`, `cover`, `no-repeat`, and full opacity.

When `background-image` resolves to a supported image, it replaces the pack's page texture for that note. Removing the property, or linking to a missing or unsupported file, restores the pack's normal background.

## Core Concepts

### 1. Custom inline syntax

Notebook parses brace-based syntax in the editor and in reading view:

```md
{power-tag}
{!weakness-tag}
{status-3}
{attention:5}
{countdown:~}
```

- `{power-tag}` creates a normal tag
- `{!weakness-tag}` creates a weakness tag
- `{status-3}` creates a status with a rating
- `{limit:5}` creates a limit

The plugin also adds a Notebook editor context-menu entry so you can insert starter tags and callouts without memorizing the syntax.

### 2. Callouts

Notebook builds on standard Obsidian callouts, but gives them pack-specific styling and aliases. Aliases are editable in Notebook settings, and the first alias in each list is what the context menu inserts.

### 3. Mode switching

The selected style pack changes more than colors. It also switches which callouts, block formats and context-menu actions are active in the vault. Switching rewrites the whole style block, so nothing of the previous pack survives the change.

## License

- Plugin code: [MIT](LICENSE), originally (c) 4rtamis as Brumes, modifications (c) François-Xavier Guillois as Handbook and as Notebook
- Font files: each bundled font keeps its own upstream license, and every one of them is redistributable; a face that is not is asked for from the vault instead
- Illustrations: read from the vault, not carried in the stylesheet

### Font License Files

- [Averia](licenses/fonts/Averia.LICENSE.txt)
- [Bebas Neue](licenses/fonts/BebasNeue.LICENSE.txt)
- [Caveat](licenses/fonts/Caveat.LICENSE.txt)
- [Courier Prime](licenses/fonts/CourierPrime.LICENSE.txt)
- [Fira Sans Extra Condensed](licenses/fonts/Fira.LICENSE.txt)
- [IM Fell English](licenses/fonts/IMFellEnglish.LICENSE.txt)
- [IM Fell Great Primer](licenses/fonts/IMFellGreatPrimer.LICENSE.txt)
- [Labrada](licenses/fonts/Labrada.LICENSE.txt)
- [PT Serif / ParaType](licenses/fonts/ParaType.LICENSE.txt)
- [PragRoman](licenses/fonts/PragRoman.LICENSE.txt) (not bundled, supplied by the user)
- [Roboto](licenses/fonts/Roboto.LICENSE.txt)
