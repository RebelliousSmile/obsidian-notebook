# Obsidian E2E journeys

## requestUrl source installation

`request-url-journey.sh` preserves the regression journey from issue #23. It launches a real Obsidian instance, installs the Mist Engine starter kit, changes `schema-in-the-mist` to tag `v1.0.0`, and compares the installed manifest, pack, and first declared image with their exact GitHub revisions.

The journey temporarily replaces the Handbook plugin and storage directories in the selected vault. It atomically isolates their original contents outside the vault, restores them on every exit through a shell trap, verifies the restored trees, and preserves the backup if verification fails. It refuses to start while Obsidian is already running.

Prerequisites:

- Linux with an Obsidian AppImage;
- `bash`, `curl`, `jq`, and Python 3;
- the Python package `websocket-client`;
- built plugin assets in `dist/` (run `pnpm build` first);
- a disposable or backed-up vault where the `obsidian-handbook` community plugin is enabled.

Run:

```bash
HANDBOOK_E2E_ALLOW_MUTATION=1 \
HANDBOOK_E2E_VAULT=/absolute/path/to/test-vault \
HANDBOOK_E2E_OBSIDIAN=/absolute/path/to/Obsidian.AppImage \
pnpm e2e:request-url
```

Optional variables:

- `HANDBOOK_E2E_PLUGIN_DIR`: directory containing `main.js`, `manifest.json`, and `styles.css`; defaults to `dist/`.
- `HANDBOOK_E2E_OUTPUT_DIR`: empty directory for the persistent report and screenshots; defaults to a new directory under `/tmp` and must remain outside the vault.
- `HANDBOOK_E2E_CDP_PORT`: Electron debugging port; defaults to `9223`.
- `HANDBOOK_E2E_OBSIDIAN_LOG`: Obsidian log file; defaults to `$HOME/.config/obsidian/obsidian.log`.

The command writes `REPORT.md`, one screenshot per journey step, downloaded comparison fixtures, and the appended Obsidian log to the output directory.
