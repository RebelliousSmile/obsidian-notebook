# Handbook

Handbook is an Obsidian plugin host for versioned tabletop game packs. Its first-run catalogue currently offers **City of Mist**, **Legend in the Mist** and **:Otherscape**; additional public schema repositories can be registered from the settings. It provides game-specific styling, custom inline syntax, themed callouts, character sheets, challenge and danger profiles, and optional canvas helpers.

It started as a fork of [Brumes](https://github.com/4rtamis/obsidian-brumes) by [4rtamis](https://github.com/4rtamis), and now follows its own road. Everything Brumes did, Handbook still does; the settings key names are unchanged, so a vault moving over keeps its configuration.

**:Otherscape** fournit trois univers visuels globaux — Metro, Cairo et Tokyo —
chacun dans les registres clair et sombre attestés par ses maquettes. Les notes
restent portables : l'univers est un réglage du coffre, jamais une donnée ajoutée
à leur TOML.

Handbook épingle l’asset immuable `schema-in-the-mist` v1.0.0. Son contrat
publie 14 cibles canoniques ; Handbook en rend 12 : `com-danger`,
`com-theme-card`, `litm-challenge`, `litm-journey`, `theme-card`,
`litm-theme-kit`, `os-theme`, `os-theme-kit`, `os-challenge`, `os-power-set`,
`os-character-trope` et `os-loadout-item`. Les cibles canoniques
`city-of-mist/custom-move` et `city-of-mist/theme-kit` restent volontairement
sans renderer Handbook. Exemple minimal :

````markdown
```os-theme
title_tag = "The Debt I Never Paid"
theme_type = "self"
power_tags = [ "they still take my call" ]
weakness_tags = [ "cannot refuse when they ask" ]
quest = "Settle the debt on my own terms."
upgrade = 2
decay = 1
```
````

Le vocabulaire de cartes Metro s'inspire de
[Mist HUD](https://github.com/mordachai/mist-hud), distribué sous licence MIT.
Handbook ne redistribue aucun de ses assets ni aucune image extraite des livres.

## Installation

> [!IMPORTANT]
> **Before the first update to Handbook 2.7.0**, copy any personal game packs
> and overrides out of the replaceable plugin directory. With the default
> Obsidian configuration directory, copy
> `.obsidian/plugins/obsidian-handbook/packs` to `.obsidian/handbook/packs` and
> `.obsidian/plugins/obsidian-handbook/overrides.json` to
> `.obsidian/handbook/overrides.json`. Replace `.obsidian` with your actual
> configuration directory when it is customized. If BRAT or another updater
> has already deleted the old files, Handbook cannot detect or restore them.

Handbook itself ships without game design. On the first launch of any install
(Community plugins, BRAT or a manual install), a modal appears when no game is
available. Choose City of Mist, Legend in the Mist or :Otherscape; Handbook
installs the declared `schema-in-the-mist` source and activates the selected
game. All three packs then remain available because that repository publishes
them together.

The same sources are managed under **Settings → Handbook → Schema sources**.
Each source can follow its latest release, an explicit tag or a branch. Network
checks happen only after **Install** or **Check** is clicked. Handbook reads the
repository's root `handbook.json`, validates every listed `pack.json`, downloads
only their declared images and fonts, and atomically replaces the prior source.
It never downloads or executes JavaScript, TypeScript or external CSS.

### 1. Prepare a vault

Handbook is easiest to test in a dedicated vault.

| Install                                                                       | Why                                                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [BRAT](https://github.com/TfTHacker/obsidian42-brat)                          | Required to install Handbook from GitHub                     |
| [Advanced Canvas](https://github.com/Developer-Mike/obsidian-advanced-canvas) | Optional, only needed for Iceberg and Mountain card snippets |

Handbook writes its own colors and fonts into a style element it owns, scoped
by game mode, in light and in dark. No theme and no other plugin is required
for the visual base. Earlier versions shipped a `Style Settings` preset for the
`Border` theme; that channel is gone. If you imported one of those presets,
open `Style Settings` and reset the sections it created — the leftover keys
still override what Handbook writes.

The fine-grained knobs that preset offered come back as a file you write. Put
an `overrides.json` in the durable Handbook data folder
(`<configDir>/handbook/overrides.json`, normally
`.obsidian/handbook/overrides.json`) and it wins over the active game for the
custom properties it declares, and for nothing else:

```json
{
	"base": { "note": { "--h1-size": "2.4em" } },
	"dark": { "note": { "--background-primary": "#1B1B1F" } }
}
```

`base` applies whichever theme is on, `light` and `dark` only under theirs; the
`workspace` slot next to `note` holds what the workspace theme toggle writes.
A value the file leaves out keeps the game's; removing the file restores the
game whole. The file is read at startup and on the *Reload personal overrides*
command, or on the *Reload* button in the settings tab. A malformed value is
dropped and reported in the console, and the rest of the file still applies.

Suggested vault setup:

1. Create a fresh Obsidian vault for testing or play.
2. Enable Community plugins.
3. Install `BRAT`, and optionally `Advanced Canvas`.

### 2. Install Handbook with BRAT

1. Open `Settings -> BRAT`.
2. Choose `Add Beta plugin`.
3. Enter `RebelliousSmile/obsidian-handbook`.
4. Install the plugin, then enable `Handbook`.

### 3. Install another schema source

A **Handbook game plugin** is a declarative directory discovered when Handbook
starts. Adrenaline's canonical directory lives in the shared
[`schema-adrenaline`](https://github.com/RebelliousSmile/schema-adrenaline)
repository at `handbook/adrenaline`; that same repository serves both Handbook
and Lantern, so no second Adrenaline integration repository is needed.

Open **Schema sources**, choose **Add source**, enter the public GitHub
`owner/repository`, then select latest release, tag or branch. **Save and check**
installs every pack listed in its `handbook.json`. Legacy copies under
`<configDir>/handbook/packs/` remain readable for migration and offline use.

On its first 2.7.0 startup, Handbook migrates the legacy pack directory and
legacy override independently, but only when the corresponding durable target
does not already exist. The durable target always wins. This migration cannot
recover a legacy source that an updater removed before Handbook started, which
is why the pre-update copy above is required. Reinstalling a game later means
copying its complete directory back under `<configDir>/handbook/packs/`.

The modern layout is `packs/<id>/pack.json`. Its images and fonts are resolved
inside that plugin directory, from `assets/` by default or from the relative
root declared by its manifest. Existing personal packs stored as
`packs/*.json` remain supported.

Game plugins are data only: Handbook does not execute JavaScript, TypeScript or
external CSS from these directories.

### 4. Configure Handbook

1. Open `Settings -> Handbook`.
2. Pick your `Game mode`. The rendering follows immediately, with no reload
   and no preset to import.
   Avec :Otherscape, choisissez ensuite l'`Univers` Metro, Cairo ou Tokyo ; ce
   choix repeint toutes les notes ouvertes.
3. Leave `Colour scheme` on `Follow Obsidian`, or force Handbook's light or
   dark scheme independently of the vault theme.

The selected game mode styles every open Markdown source, live-preview and
reading view in that window. It does not repaint the Obsidian chrome unless
`Theme the workspace` is enabled. That toggle is independent of the game and
colour-scheme selectors: page textures, title cartouches and warning motifs
remain confined to notes even when the workspace colours follow the game.

Adrenaline reading view uses two columns on wide notes. To keep one particular
note in a single column, add this frontmatter; editing and narrow views already
remain single-column:

```yaml
---
cssclasses:
  - adrenaline-one-column
---
```

Urban Shadows and Monsterhearts packs use the same responsive reading pattern,
with a lower breakpoint suited to their denser book layouts. Opt one note out
with `pbta-one-column` in `cssclasses`.

Handbook and Lantern deliberately consume the same `schema-adrenaline`
repository. The package declares the minimum Handbook release it supports;
Handbook does not pin a game-specific schema commit. Schema sources records the
generic release, tag or branch selected for each repository and installs its
catalogue atomically.

Handbook's `pnpm check` and release workflow deliberately remain independent
from optional game repositories. `pnpm assert:adrenaline-contract` validates the
immutable `schema-adrenaline` v1.0.0 package, including its strict codecs and
canonical JSON/TOML corpus; Handbook keeps a tolerant projection and renderer.
To validate a concrete Adrenaline pack checkout, set `SCHEMA_ADRENALINE_ROOT`
and run the optional `assert:adrenaline-theme` and
`assert:adrenaline-zombiology-style` scripts. Conversely, schema-adrenaline CI
derives an immutable Handbook tag from `minimumHandbookVersion`, runs those host
assertions against its checkout, then verifies catalogue installation through
that release. For a coordinated compatibility change, publish a
fallback-capable Handbook host first, raise `minimumHandbookVersion` and publish
schema-adrenaline second. No reciprocal schema SHA is required.

### 5. Illustrations and fonts

Handbook no longer carries game art. A schema repository publishes each pack's
declared illustrations and fonts beside its `pack.json`; installing or updating
the source installs the matching asset version into the vault's durable
Handbook data directory.

The `Illustrations` setting names the folder of the active game, counts the
files it reads, and lists the ones it did not find; `Check files` looks again
after a drop, with no reload.

**Until the files are there, the game renders degraded, never broken.** A card
without its frame keeps its text on a flat ground and a border, a badge without
its icon goes away instead of leaving an empty box, a drawn checkbox mark
becomes a typed one, and a missing typeface falls through to the next family in
its stack. Nothing errors and nothing renders as a broken image.

Repositories are responsible for publishing only assets they may redistribute
and for carrying the corresponding licence information.

### 6. Note-local backgrounds

A note can use an image already stored in the vault as its page background.
This works in Live Preview and reading view, with every game mode, and does not
copy the image into Handbook or a schema package.

```yaml
background-image: "[[Assets/paper.webp]]"
background-position: center top
background-size: cover
background-repeat: no-repeat
background-opacity: 0.2
```

`background-position` accepts combinations of `left`, `center`, `right`,
`top`, and `bottom`. `background-size` accepts `cover`, `contain`, or `auto`;
`background-repeat` accepts `no-repeat`, `repeat`, `repeat-x`, or `repeat-y`;
and `background-opacity` accepts a number from `0` to `1`. Omitted or invalid
options use `center center`, `cover`, `no-repeat`, and full opacity.

When `background-image` resolves to a supported image, it replaces the game's
page texture for that note. Removing the property, or linking to a missing or
unsupported file, restores the game's normal background.

### 7. Optional canvas setup

If you use `Advanced Canvas`, Handbook can generate mode-specific node-style snippets:

- `City of Mist` mode: copy the `Iceberg canvas snippet`
- `Legend in the Mist` mode: copy the `Mountain canvas snippet`

Then:

1. Go to `Settings -> Appearance -> CSS snippets`.
2. Create `iceberg.css` or `mountain.css` inside `.obsidian/snippets/`.
3. Paste the copied snippet content into the matching file.
4. Enable the snippet in Obsidian.

## Core Concepts

### 1. Custom inline syntax

Handbook parses brace-based syntax in the editor and in reading view:

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

The plugin also adds a Handbook editor context-menu entry so you can insert starter tags, callouts, and Story Theme templates without memorizing the syntax.

### 2. Callouts

Handbook builds on standard Obsidian callouts, but gives them mode-specific styling and aliases.

City of Mist examples:

```md
> [!MOVE] Hit the Streets
> Describe the move here.

> [!DESCRIPTION]
> Text to read aloud.

> [!CLUE]
> The matchbook is still warm.
```

Default City of Mist aliases include:

- `note`, `aside`
- `move`
- `description`, `read-aloud`
- `clue`
- `red-clue`

Legend in the Mist examples:

```md
> [!NOTE] Village Rumor
> The ferryman never crosses after dusk.

> [!READ-ALOUD]
> The mist swallows the road behind you.
```

Default Legend in the Mist aliases include:

- `note`
- `read-aloud`

Aliases are editable in Handbook settings, and the first alias in each list is what the context menu inserts.

### 3. Theme cards for Legend in the Mist

In `Legend in the Mist` mode, Handbook renders a `theme-card` code block into a styled card. A hero theme names its might level and its themebook:

````md
```theme-card
origin
circumstance
{Born in the marsh}
{Track by moonlight}
{Know every hidden trail}
{!Trust strangers too easily}
```
````

A story theme has neither, so it drops the level badge and the themebook line and keeps the plain frame:

````md
```theme-card
{Magic Lantern}
{Reveals the dead}
{Dispel illusion}
{!Difficult to light}
```
````

How it works:

- First line can be `origin`, `adventure`, or `greatness`
- Second line can be a category or themebook label
- First normal tag becomes the title tag
- Later normal tags become power tags
- `{!weakness}` lines become weakness tags

If you omit the level, Handbook falls back to a standard card style, without a level badge and without a category line.

The former `story-theme` id still renders the same card, so older notes keep working, but it is deprecated: prefer `theme-card` in new notes.

### 4. Challenges for Legend in the Mist

In `Legend in the Mist` mode, Handbook can render a `litm-challenge` code block into a challenge profile card:

````md
```litm-challenge
Crafty Rumormonger
roles: Watcher, Sapper, Countdown
: A gossip who turns whispers into weapons.
LIMITS
Convince 2
Scare 2
Undermine Community 4 > Everyone in the community becomes distrustful-2 of one another.
MIGHT
Numbers (caught in a lie)
TAGS
{latest juiciest scandal} chatty confident-2
FEATURES
Petty Grudge > When slighted, the rumormonger gains vengeful-2.
THREATS
Listen : They lean in a little too close.
> Your words spread further than intended (Exposure)
Whisper : A name of yours is passed along in the dark.
> A friend starts avoiding you (shunned-2)
Twist : The story comes back wearing a new shape.
> What you said becomes what you meant (Blocked)
SECRETS
Origin: A curse cast by a Thaumaturge.
```
````

How it works:

- First line is the challenge name, and an optional `roles:` line lists its roles
- Lines starting with `:` are the description
- `LIMITS`, `MIGHT`, `TAGS`, `FEATURES`, `THREATS` and `SECRETS` open a section, and every one but `LIMITS` is optional
- A limit is a name followed by its rating; a progress limit adds its consequence after ` > `
- A threat names its trigger after ` : `, then owns every `>` line below it
- Tags are written `{multi word tag}` or as single words, and statuses keep their tier
- Write `{name-2}` anywhere in a description, a consequence, a trigger or an effect to render that status as a tag, the same braces used to group a multi-word tag

### 5. Journeys for Legend in the Mist

In `Legend in the Mist` mode, Handbook can render a `litm-journey` code block into a journey sheet:

````md
```litm-journey
Journey - Occasion
Blood & Water Feud
: Two families have feuded for as long as anyone can remember. It is all too easy to get drawn into their rivalry, and aggressions often escalate.
: This-side and that-side are polar statuses representing the hero's perceived faction allegiances.
tags: hot tempers, map of claimed territories, list of grievances
CONSEQUENCES
> Someone thinks you are working with the rivals (that-side-2, watched-2, or suspected-2).
> One of the feuding family members blames you for something you did not do (that-side-2).
> You draw the wrong kind of attention (New Challenge: Crafty Rumormonger).
> Someone begins to follow you around (New Challenge: Lone Tracker).
VIGNETTE Tavern Slur Slinging : A tense night at the tavern grows sour, as drunken-2 members of the two families begin slinging insults at each other.
> Some choice words are thrown at you (insulted-2 or angry-2).
> Someone starts a fight and wants you to pick a side (New Challenge: Commoner Rabble-Rouser).
> The tavern owner throws you out along with the other rabble-rousers (Blocked).
VIGNETTE Mysterious Fire : A building you are near suddenly roars in a blazing inferno, and members of one of the rival families might be inside.
> You get scorched by the fire (burned-3).
> Someone inside comes to harm from the fire or a collapsing wall (Ill Tidings).
> You can find no clear signs of how the fire started or by whom (Blocked).
VIGNETTE Sabotaged Cart : A farmer's cart throws a wheel (broken-3) and she suspects foul play.
> Catching the culprit earns you a reputation of supporting this-side-2, letting them go earns you the opposite (that-side-2).
> Helping her allows supplies to reach her side of the feud (they gain well-supplied-2).
> This endeavor costs you time (time-passes-2) and resources (short-on-supplies-2).
VIGNETTE Star-Crossed Lovers : You stumble upon a secret tryst of two lovers from opposing sides of the feud, who offer you coin to hide their secret.
> You are marked by both sides (reset this-side or that-side and gain marked-3).
> An angry-2 mob forms to search for the couple (New Challenge: Commoner Militia).
> One of them curses you for your part in this (loveless-3).
VIGNETTE Road Brawl : Two groups of angry-2 Dalesfolk argue out on the road, accusing each other of old transgressions.
> A violent scuffle ensues in the mud and you get hurt (bruised-2 and filthy-2).
> Someone is gravely wounded (Ill Tidings, and that side gets vengeful-2).
> Someone draws a hidden weapon or calls a few armed friends (New Challenge: Commoner Militia).
VIGNETTE Blood Curse : A person wronged by the feud stands in a bloody ritual circle, about to sacrifice someone from the other side.
> A calamity is unleashed on the village (New Challenge: Local Disaster).
> The community is forever torn (Ill Tidings and hateful-6).
> You take the brunt of the curse (cursed-6).
```
````

How it works:

- First line is the journey type, `Landscape`, `Occasion` or `Undertaking`, written on its own or prefixed by `Journey - `
- Second line is the journey name
- Lines starting with `:` are the description, and `tags:` lists the journey tags — written as single words, or `{multi word tag}` braced the same way `litm-challenge` does
- `benefits:` describes what a successful step earns, and only `Undertaking` journeys use it
- `CONSEQUENCES` (or `GENERAL CONSEQUENCES`, the wording most official profiles print) opens the shared consequence list, where every `>` line before the first vignette lands
- `VIGNETTE ` starts a vignette, its trigger following ` : `, and it owns every `>` line below it
- Write `{name-2}` anywhere in a description, a consequence or a trigger to render that status as a tag
- A line the parser cannot make sense of, a `benefits:` on a Landscape or an Occasion, a vignette missing its ` : ` trigger, or a consequence written before any `CONSEQUENCES` heading, is never dropped silently: it is still rendered where possible, and listed in a muted footer under the card

### 6. Theme kits for Legend in the Mist

In `Legend in the Mist` mode, Handbook can render a `litm-theme-kit` code block into a ready-made theme card:

````md
```litm-theme-kit
Devotion
Trial of the Vulture
{scavenging} {desperation motivates me} {vulture skull necklace}
{find a safe spot} {fleeing danger} {hardy}
{side with the winner} {make do with scraps} {mask my scent}
{!unsympathetic} {!always in survival mode}
{!disheveled appearance} {!barren landscapes}
quest: Prove that there is a vulture inside of me.
improvement: Vulture's Endurance > Once per scene, when you roll to resist hunger or the elements, you first gain desperate-2, which helps the roll.
```
````

How it works:

- First line is the themebook the kit belongs to, matched against the Legend in the Mist themebooks, and it can be left out
- The first plain line after it is the kit name
- `{tag}` entries are power tags and `{!tag}` entries are weakness tags, several per line
- `quest:` holds the kit quest, and `improvement:` names a special improvement, its effect following ` > `

### 7. Iceberg and Mountain card snippets

Handbook includes copyable snippet templates for `Advanced Canvas`.

- `Iceberg Card` is the City of Mist helper
- `Mountain Card` is the Legend in the Mist helper

Available Iceberg variants:

- `location`
- `character`
- `group`
- `sticky-note`

Available Mountain variants:

- `origin`
- `adventure`
- `greatness`
- `standard`

### 8. Adrenaline System sheets

Install the optional Handbook game plugin as described above, choose
`Adrenaline System` as the game mode, then keep `Colour scheme` on
`Follow Obsidian` or force the sourced light or dark scheme. The Adrenaline
section in the settings enables the three TOML parsers independently.

The document shapes come from the published
[`schema-adrenaline`](https://github.com/RebelliousSmile/schema-adrenaline)
schemas. Zombiology's core book was used as the visual reference because it
currently publishes the system and its first setting together; Handbook's
pack and block IDs remain generic Adrenaline ones.

A minimal player character requires a name, eight characteristics, both health
tracks and both solidities:

````md
```adrenaline-pj
nom = "Claire"
[caracteristiques]
for = 30
con = 40
dex = 40
rap = 30
log = 40
vol = 40
per = 50
cha = 30
[sante.physique.superficiel]
base = 6
[sante.physique.leger]
base = 13
[sante.physique.grave]
base = 18
[sante.physique.profond]
base = 23
[sante.mental.superficiel]
base = 5
[sante.mental.leger]
base = 12
[sante.mental.grave]
base = 17
[sante.mental.profond]
base = 22
[protections.physiques]
solidite = 6
[protections.mentales]
solidite = 5
```
````

A non-player character may be as short as one named role:

````md
```adrenaline-pnj
nom = "Le gardien"
[narratif]
role = "Contrôle l'accès au refuge"
```
````

A monster requires its name and four physical characteristics; mental
characteristics, health, equipment, alternate state and contagion are optional:

````md
```adrenaline-monstre
nom = "Rôdeur"
[caracteristiques]
for = 45
con = 60
dex = 25
rap = 30
```
````

Use the command palette actions `Copy Adrenaline player character as TOML`,
`Copy Adrenaline non-player character as TOML`, or `Copy Adrenaline monster as
TOML` while the cursor is inside the matching fence. Optional `[meta]`
provenance accepts `typeDePublication`, `source`, `auteurs`, `page` and
`licence`. Handbook preserves those Lantern metadata when copying TOML but
does not print them inside the rendered sheet.

### 9. Mode switching

The selected game mode changes more than colors. It also switches which callouts, block formats, context-menu actions, and special renderers are active in the vault. Switching rewrites the whole style block, so nothing of the previous game survives the change.

### 10. Lantern in the Mist integration

Handbook can add a ribbon button that opens an embedded `Lantern in the Mist` view inside Obsidian. The target URL is configurable from plugin settings.

## License

- Plugin code: [MIT](LICENSE), originally (c) 4rtamis as Brumes, modifications (c) François-Xavier Guillois
- Font files: each bundled font keeps its own upstream license, and every one of them is redistributable; a face that is not is asked for from the vault instead
- Illustrations: read from the vault, not carried in the stylesheet
- Assets: status is still under discussion with Son of Oak

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

### Asset Status

Use of bundled Son of Oak-derived assets under discussion.
