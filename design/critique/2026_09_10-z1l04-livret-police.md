# Visual critique — Z1L04 Livret Police → Adrenaline

- **Date**: 2026-09-10
- **Reference**: `Z1L04_Livret Police.pdf` (20 pages)
- **Scope**: current external Adrenaline pack and Handbook's structural CSS
- **Mode**: critique only; no design contract or source code changed
- **Distinction score**: **46/100**

## Verdict

The current palette establishes an Adrenaline identity, but it still reads as a flat Obsidian theme rather than the Police booklet. The reference is built from two deliberately different editorial compositions: warm paper pages and near-black operational pages. Those should become explicit `light` and `dark` presentations, not merely color inversions of one layout.

The existing technical boundary is compatible with that direction: game-owned visual values and files belong in `schema-adrenaline`; Handbook should consume them through stable, scoped structural rules. The fixed callout palette is the main exception and should be brought back under that contract.

## Reference read

### Light presentation

- Warm ivory, visibly fibrous paper rather than a flat white surface.
- Dark serif body copy with compact, distressed condensed headings in deep red.
- Thin red rules, black/red cartouches, and dense editorial rhythm.
- Occasional dark chapter bands, but the reading surface remains light.

### Dark presentation

- Near-black charcoal field with a restrained red organic/vein texture.
- White distressed display type, deep red secondary emphasis.
- Rare yellow police/warning accents used as a sharp signal, not as a general UI color.
- A few mixed compositions combine dark imagery with a light text panel; for Handbook, polarity should follow the page's dominant reading surface.

## Measured state

- External pack: 40 distinct hexadecimal colors, 3 font families, 0 declared assets.
- Workspace layer: 3 overridden variables per polarity.
- Structural Adrenaline SCSS: 1 responsive breakpoint at 520 px.
- Missing distinctive primitives: paper texture, dark texture, warning tape, editorial page grid, distressed display face, and polarity-specific composition.
- Callouts: 14 background declarations and 10 unique hard-coded hexadecimal colors outside the pack's polarity values.

## Contrast evidence

Contrast was measured with the official design adapter against a temporary DTCG projection of the current pack. This is audit evidence, not a frozen project contract.

| Pair | Ratio | Result |
| --- | ---: | --- |
| Light body / paper | 15.07:1 | Pass |
| Light muted / paper | 5.87:1 | Pass |
| Light heading / paper | 10.09:1 | Pass |
| Light accent / paper | 6.85:1 | Pass |
| Light yellow / paper | 3.87:1 | Fail for normal text |
| Dark body / charcoal | 16.02:1 | Pass |
| Dark muted / charcoal | 9.98:1 | Pass |
| Dark accent / charcoal | 5.67:1 | Pass |
| Dark yellow / charcoal | 8.36:1 | Pass |

Texture overlays can change effective contrast. The final implementation needs a rendered contrast check at the busiest texture locations, with opaque or translucent text backplates where necessary.

## Critique lenses

### Identity and hierarchy

The squared geometry, red/brown palette, and condensed headings provide a useful base. They do not yet capture the reference's strongest hierarchy devices: tactile surfaces, stamped/cartouche titles, hairline dividers, and rare warning signals. Without those, the result remains generic.

### Light/dark relationship

The pack correctly distinguishes two polarities, but their composition is currently shared. The reference treats them as different environments. Light should feel like an archival field dossier; dark should feel like a command-room or contaminated-zone insert. Callouts currently undermine this distinction by retaining pastel light surfaces in both modes.

### Accessibility and legibility

Principal text combinations have comfortable contrast. The light yellow accent is unsafe for normal text on the paper background and should be darkened, enlarged/bolded, or reserved for non-text decoration. Distressed faces belong to short headings only; long-form copy should retain a highly readable serif.

### Durability

Literal full-page scans or heavy texture would age poorly and harm readability. A small repeatable texture, restrained opacity, CSS-built rules/cartouches, and explicit fallbacks will preserve the editorial voice while remaining maintainable.

## Actionable directions

### 1. Papier opérationnel

Use a subtle warm-paper asset, readable serif body, deep red condensed headings, fine rules, and dark cartouches. This is the default light presentation. The asset and values belong in `schema-adrenaline`; spacing, title anatomy, and scoped background application belong in Handbook.

### 2. Salle d'opérations

Use charcoal plus a faint red organic texture, white display headings, deep-red panels, and a very rare yellow warning device. Give dark mode its own structural selectors where composition differs rather than relying only on variable substitution.

### 3. Two-voice typography

Pair a licensed/readable serif for prose with a licensed distressed condensed face for titles. Package font files with the schema when redistribution permits it, declare fallbacks, and avoid distressed text below heading scale.

### 4. Restrained workspace

Coordinate Obsidian chrome with each page polarity through primary and secondary surfaces, text, border, accent, and interaction tokens. Keep the workspace quieter than the note: textures and warning motifs should remain primarily on the reading surface.

## Recommended design contract

- **External game package**: semantic colors by polarity, workspace tokens, texture/font/motif assets, asset metadata, and fallbacks.
- **Handbook**: `.brumes--adrenaline` selectors, light/dark structural variants, content-width and responsive rules, cartouches, callout anatomy, and safe asset consumption.
- **Acceptance gates**: no hard-coded game palette in Handbook SCSS; rendered light/dark snapshots; contrast checks over textured surfaces; pack compatibility validation during both repositories' CI.
