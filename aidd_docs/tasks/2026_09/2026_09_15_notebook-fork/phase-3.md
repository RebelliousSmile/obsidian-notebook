---
status: pending
---

# Instruction: Packs natifs gestion-projet et client-guide

## Architecture projection

> Tree de l'état final de cette phase. ✅ create · ✏️ modify · ❌ delete
> Utilise le vocabulaire post-renommage de [`phase-2.md`](./phase-2.md) (`StylePack`, `DECLARED_PACKS`, `NotebookBlock`, `NOTEBOOK_BLOCKS`, `src/packs/...`) puisque cette phase s'exécute après elle.

```txt
notebook/
├── src/
│   ├── features/
│   │   ├── callouts/
│   │   │   └── nativeCallouts.ts              ✏️ (catalogue réécrit : 8 CalloutDefinition, native:false)
│   │   └── blocks/
│   │       ├── registry.ts                    ✏️ (NOTEBOOK_BLOCKS = [statusBlock])
│   │       └── status/
│   │           └── status.ts                  ✅ (nouveau block "status")
│   └── packs/
│       ├── registry.ts                        ✏️ (DECLARED_PACKS = [gestion-projet, client-guide], dans cet ordre)
│       └── native/
│           ├── gestionProjet.ts                ✅ (StylePack gestion-projet, light+dark)
│           └── clientGuide.ts                  ✅ (StylePack client-guide, light seul)
└── tools/
    └── assertCallouts.harness.mts             ✏️ (test 1 : native:false, test 2 : supprimé)
```

## User Journey

```mermaid
flowchart TD
  A[DECLARED_PACKS vide, NOTEBOOK_BLOCKS vide, nativeCallouts.ts encore TTRPG] --> B[reecrire nativeCallouts.ts : 8 CalloutDefinition natif=false, 4 gestion-projet + 4 client-guide]
  B --> C[creer les StylePack gestion-projet light+dark et client-guide light dans src/packs/native/]
  C --> D[creer le block status, mode gestion-projet, zone unique items, l'enregistrer dans NOTEBOOK_BLOCKS]
  D --> E[declarer DECLARED_PACKS = [gestion-projet, client-guide] dans cet ordre exact]
  E --> F[corriger assertCallouts.harness.mts : native:false, retrait du test pbta]
  F --> G[pnpm build + assert:callouts passent, un vault neuf s'ouvre en gestion-projet]
```

## Tasks to do

### `1)` Réécrire le catalogue de callouts natifs

> `src/features/callouts/nativeCallouts.ts` contient aujourd'hui `PBTA_CALLOUTS` (4 entrées, `capability:"style:pbta"`) + `NATIVE_CALLOUTS` (7 entrées City of Mist/Legend in the Mist) — 11 entrées au total, toutes `native:true`. Cette tâche remplace l'ensemble par 8 entrées propres à Notebook.
> Contrat exact : `CalloutDefinition` (`src/features/callouts/types.ts`) et `isCalloutAvailable(entry, activePackId, requiredCapabilities)` qui renvoie `entry.scope === "all" || entry.scope === activePackId` (pas de `capability` nécessaire pour un callout propre à un seul pack).
> `styleWriter.ts` (`buildCalloutStyleCss`) ignore les entrées `native:true` et génère automatiquement le CSS (`background-color`, `font-family`) pour les entrées `native:false` avec `color:{kind:"fixed", hex}` — donc aucune retouche SCSS manuelle n'est nécessaire pour ces 8 entrées.
> Les alias courts (`note`, `warning`, `astuce`…) peuvent être réutilisés d'un pack à l'autre sans collision : la résolution d'alias ne regarde que les entrées dont `scope` correspond au pack actif, et les deux packs ne sont jamais actifs simultanément.

1. Supprimer `PBTA_CALLOUTS` et l'ancien `NATIVE_CALLOUTS` (7 entrées City of Mist/Legend in the Mist) en totalité.
2. Déclarer 4 entrées pour `gestion-projet` (`scope: "gestion-projet"`, `template: "title-body"`, `font: "header"`, `native: false`, `styleKey` = `id`, pas de `capability`) :
   - `{ id: "gestion-projet-note", name: "Note", aliases: ["note"], icon: "pencil", color: { kind: "fixed", hex: "#5B7A99" } }`
   - `{ id: "gestion-projet-warning", name: "Avertissement", aliases: ["warning", "avertissement"], icon: "triangle-alert", color: { kind: "fixed", hex: "#C98A3B" } }`
   - `{ id: "gestion-projet-tip", name: "Astuce", aliases: ["tip", "astuce"], icon: "lightbulb", color: { kind: "fixed", hex: "#4E8B63" } }`
   - `{ id: "gestion-projet-question", name: "Question", aliases: ["question"], icon: "help-circle", color: { kind: "fixed", hex: "#7A6BA6" } }`
3. Déclarer 4 entrées pour `client-guide` (`scope: "client-guide"`, mêmes conventions) :
   - `{ id: "client-guide-important", name: "Important", aliases: ["important"], icon: "alert-octagon", color: { kind: "fixed", hex: "#A6432F" } }`
   - `{ id: "client-guide-astuce", name: "Astuce", aliases: ["astuce"], icon: "lightbulb", color: { kind: "fixed", hex: "#2E7D6B" } }`
   - `{ id: "client-guide-attention", name: "Attention", aliases: ["attention"], icon: "triangle-alert", color: { kind: "fixed", hex: "#C77A2E" } }`
   - `{ id: "client-guide-a-faire-client", name: "À faire (client)", aliases: ["a-faire-client", "à-faire-client"], icon: "list-todo", color: { kind: "fixed", hex: "#4A5C8C" } }`
4. Chaque entrée porte des `aliases` non vides et un `id`/`styleKey` préfixé par le pack propriétaire — garantit l'unicité globale dans `settings.callouts` même si les deux packs partagent un alias court (ex. `astuce`).
5. Exporter `NATIVE_CALLOUTS: CalloutDefinition[]` (8 entrées, ordre : les 4 `gestion-projet` puis les 4 `client-guide`) — même nom d'export qu'avant, pour ne pas casser les imports listés dans `phase-2.md`.

### `2)` Créer les StylePack `gestion-projet` et `client-guide`

> `src/packs/tokens.ts` : `palette(colors)` génère `--color-<name>`/`--color-<name>-rgb` par entrée ; `accent(hex)` génère `--color-accent`/`--interactive-accent` + variantes HSL hover/active ; `tokens(...parts)` fusionne des `Record<string,string>`, le dernier gagne.
> `StyleValues = { base, light, dark }`, chaque niveau un `StyleLayer = { note, workspace }` (post-renommage `GameStyleValues`/`GameStyleLayer` de `phase-2.md` tâche 1). `EMPTY_LAYER` couvre les niveaux `light`/`dark` quand un pack n'a pas de surcharge par polarité — les deux packs de cette phase n'en ont pas, toute la palette est posée dans `base`.
> Ces tokens sont indépendants des couleurs de callouts posées à la tâche 1 (`buildCalloutStyleCss` n'y touche jamais) : ils habillent la note (fond, accent interactif) tandis que les callouts gardent leur hex fixe dédié — cohérence visuelle assurée en réutilisant les mêmes teintes, pas par un lien de code.

1. Créer `src/packs/native/gestionProjet.ts`, exporter `gestionProjetPack: StylePack` :
   `id: "gestion-projet"`, `label: "Gestion de projet"`, `polarities: ["light", "dark"]`, pas de `variants`/`defaultVariantId`, pas d'`assets`/`shapes`.
   `style.base.note = tokens(accent("#5B7A99"), palette({ note: "#5B7A99", warning: "#C98A3B", tip: "#4E8B63", question: "#7A6BA6" }))`, `style.base.workspace = accent("#5B7A99")`, `style.light = EMPTY_LAYER`, `style.dark = EMPTY_LAYER`.
2. Créer `src/packs/native/clientGuide.ts`, exporter `clientGuidePack: StylePack` :
   `id: "client-guide"`, `label: "Guide client"`, `polarities: ["light"]` (rendu qui finira maquetté, le mode sombre n'a pas d'intérêt).
   `style.base.note = tokens(accent("#2C4A6E"), palette({ important: "#A6432F", astuce: "#2E7D6B", attention: "#C77A2E", "a-faire-client": "#4A5C8C" }))`, `style.base.workspace = accent("#2C4A6E")`, `style.light = EMPTY_LAYER`, `style.dark = EMPTY_LAYER`.
3. Aucun `GameFontFace`/`StyleFontFace` ni `assets.fonts` déclaré pour les deux packs : `--font-header-theme`/`--font-text-theme` (consommés par `styleWriter.ts`) n'ont aucun fallback SCSS dans le projet, hors scope du brainstorm — la déclaration `font` des callouts reste inerte si l'utilisateur n'a pas de thème qui les définit, ce qui est acceptable.

### `3)` Créer le block `status`

> Aucune implémentation de block ne survit à la purge TTRPG (les 13 dossiers de `src/features/blocks/*` sont supprimés par `phase-1.md` tâche 3) : ce block est écrit de zéro contre le contrat `NotebookBlock<T>`/`BlockShape` de `src/features/blocks/types.ts` et `shape.ts` (post-renommage `phase-2.md` tâche 4).
> `NotebookBlock<T> = { id, aliases?, mode?, capability?, handout?, flag?, label, icon, shape, parse(source): T|null, render(data, doc): HTMLElement, template(): string }`. `isBlockEnabled` active ce block quand `settings.mode === "gestion-projet"` — utiliser `mode`, pas `capability` (le block est exclusif à un seul pack, pas partagé entre packs).
> Périmètre volontairement minimal : « un seul block léger de suivi de statut, pas de kanban » — une seule zone, un seul fichier, pas de sous-dossier à la manière des anciens blocks TTRPG (qui avaient plusieurs fichiers pour des shapes bien plus riches).

1. Créer `src/features/blocks/status/status.ts` avec :
   - Type `StatusState = "a-faire" | "en-cours" | "bloque" | "fait"` et `StatusItem = { state: StatusState; label: string }`, `StatusBlockData = { items: StatusItem[] }`.
   - Table de libellés `STATE_LABELS: Record<StatusState, string>` (« À faire », « En cours », « Bloqué », « Fait ») et une table d'alias normalisés (minuscule, accents retirés, espaces/tirets retirés) faisant correspondre `afaire`/`encours`/`bloque`/`fait` à leur `StatusState`.
   - `shape: BlockShape` avec `block: "status"` (doit être identique à `id`, `registry.ts` le vérifie via `checkShapeIds()` au chargement et avertit sinon), `root: "notebook-status"` et une seule zone `{ name: "items", holds: "les lignes de statut, chacune un marqueur coloré et son libellé, dans l'ordre écrit" }`.
2. `parse(source)` : découper `source` en lignes non vides, pour chaque ligne couper sur le premier `:` (avant = état brut, après = libellé) ; normaliser l'état brut et le résoudre via la table d'alias ; ignorer silencieusement les lignes dont l'état ne résout à rien ou dont le libellé est vide ; renvoyer `{ items }` si au moins un item est résolu, sinon `null`.
3. `render(data, doc)` : créer l'élément racine (classe `notebook-status`), pour chaque item ajouter une ligne portant la classe `notebook-status--items` (via `zoneClass`/`renderZones` de `shape.ts`) avec un marqueur de couleur par état (via une classe `notebook-status__state-<state>`, stylée en CSS neutre indépendamment de la palette du pack) et le libellé en texte.
4. `template()` : renvoie un squelette de bloc préremplissant les 4 états dans l'ordre `à faire / en cours / bloqué / fait`, libellé vide à compléter par l'utilisateur.
5. `id: "status"`, `aliases: ["statut"]`, `mode: "gestion-projet"`, `label: "Suivi de statut"`, `icon: "list-checks"`.
6. Dans `src/features/blocks/registry.ts` : importer `statusBlock` et poser `NOTEBOOK_BLOCKS: NotebookBlock<unknown>[] = [statusBlock]` (le tableau vidé par `phase-1.md` tâche 3 reçoit sa première entrée).

### `4)` Déclarer les deux packs dans `DECLARED_PACKS`

> `src/settings/types.ts` (`normalizeMode`) : sur un `mode` absent ou inconnu (installation neuve), retombe sur `PACK_REGISTRATIONS[0]?.pack.id ?? DEFAULT_SETTINGS.mode` (post-renommage `phase-2.md` tâche 1, `GAME_REGISTRATIONS[0]` devient `PACK_REGISTRATIONS[0]`). C'est le seul mécanisme qui décide du pack actif par défaut — l'ordre de déclaration est donc significatif et doit être posé explicitement ici, pas laissé implicite.

1. Dans `src/packs/registry.ts`, importer `gestionProjetPack` et `clientGuidePack` depuis `./native/gestionProjet` et `./native/clientGuide`.
2. Poser `DECLARED_PACKS: PackRegistration[] = [{ pack: gestionProjetPack }, { pack: clientGuidePack }]` — `gestion-projet` déclaré **en premier**, ce qui en fait le pack actif par défaut sur un vault neuf via `PACK_REGISTRATIONS[0]` (aucune autre ligne de code n'est nécessaire pour ce comportement).
3. Ni `variants` ni `defaultVariantId` sur ces deux `PackRegistration` : le mécanisme de variantes (`src/packs/variants.ts`) reste disponible mais hors périmètre du brainstorm pour ces deux packs.

### `5)` Adapter `tools/assertCallouts.harness.mts`

> Fichier relu en entier : 7 blocs de test. Les tests 3 (migration `calloutAliases` legacy) et 4-7 (fixtures génériques `"adrenaline"`/`"otherscape"`/`"all"`, indépendantes du contenu réel de `NATIVE_CALLOUTS`) ne changent pas — le test 3 est déjà supprimé par `phase-1.md` tâche 6 étape 9.

1. Test 1 (lignes 11-24) : l'assertion `assert.equal(migrated.native, true)` (posée pour chaque entrée) devient `assert.equal(migrated.native, false)` — les 8 nouvelles entrées sont `native: false`. Le reste du test (longueur du catalogue, correspondance des ids) reste valide tel quel contre le nouveau `NATIVE_CALLOUTS`.
2. Test 2 (lignes 27-32) : supprimer ce bloc en totalité — il assertait `NATIVE_CALLOUTS.filter((c) => c.capability === "style:pbta").length === 4`, or plus aucune entrée du catalogue ne porte de `capability`.

### `6)` Vérification

1. `pnpm build` passe avec les deux packs et le block `status` inclus.
2. `pnpm assert:callouts` passe avec le catalogue à 8 entrées.
3. Un vault neuf (aucun `mode` sauvegardé) s'ouvre avec la classe body `notebook--gestion-projet` et les callouts `note`/`warning`/`tip`/`question` stylés.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                          |
| ---- | ---------------------------------------------------------------------------------------------------------------- |
| 1    | `NATIVE_CALLOUTS` contient exactement 8 entrées, toutes `native: false`, ids/styleKeys préfixés par leur pack, aucune n'a de `capability` |
| 2    | `gestionProjetPack`/`clientGuidePack` exportés avec les bonnes `polarities` (`["light","dark"]`/`["light"]`) et les tokens `accent`/`palette` attendus dans `style.base.note` |
| 3    | `NOTEBOOK_BLOCKS` contient `statusBlock` (`id: "status"`, `mode: "gestion-projet"`), `parse()` renvoie `null` sur un bloc vide et un `StatusBlockData.items` non vide sur un bloc valide |
| 4    | `DECLARED_PACKS[0].pack.id === "gestion-projet"`, `DECLARED_PACKS[1].pack.id === "client-guide"` |
| 5    | `tools/assertCallouts.harness.mts` teste `native === false` (test 1) et ne référence plus `style:pbta` (test 2 supprimé) |
| 6    | `pnpm build` et `pnpm assert:callouts` passent ; un vault neuf s'ouvre en `notebook--gestion-projet` |
