// Advanced Canvas node styles.
//
// The Style Settings presets that used to live here are gone: the plugin
// writes its own variables now, from the game pack in `src/games/`.
// What remains are the two snippets a vault must install for Advanced Canvas
// to know the iceberg and mountain node styles at all — a genuine external
// dependency, not a styling channel.

export const ADVANCED_CANVAS_ICEBERG_SNIPPET = `/* @advanced-canvas-node-style
key: iceberg-card
label: Iceberg Card
options:
  -
    label: Location
    value: location
    icon: building-2

  -
    label: Character
    value: character
    icon: user

  -
    label: Group
    value: group
    icon: users

  -
    label: Sticky Note
    value: sticky-note
    icon: sticky-note

  -
    label: Unset
    value: null
    icon: eye-off
*/`;

export const ADVANCED_CANVAS_MOUNTAIN_SNIPPET = `/* @advanced-canvas-node-style
key: mountain-card
label: Mountain Card
options:
  -
    label: Greatness
    value: greatness
    icon: crown

  -
    label: Adventure
    value: adventure
    icon: swords

  -
    label: Origin
    value: origin
    icon: leaf

  -
    label: Standard
    value: standard
    icon: scroll

  -
    label: Unset
    value: null
    icon: eye-off
*/`;
