#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VAULT="${HANDBOOK_E2E_VAULT:-}"
APP="${HANDBOOK_E2E_OBSIDIAN:-}"
PLUGIN_ASSETS="${HANDBOOK_E2E_PLUGIN_DIR:-$REPO_ROOT/dist}"
CDP_PORT="${HANDBOOK_E2E_CDP_PORT:-9223}"
ALLOW_MUTATION="${HANDBOOK_E2E_ALLOW_MUTATION:-0}"
OUTPUT_DIR="${HANDBOOK_E2E_OUTPUT_DIR:-}"
APP_PID=""
BACKUP=""
CURRENT_STEP="setup"
LAST_COMPLETED=0

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
require_command() { command -v "$1" >/dev/null || fail "missing command: $1"; }

[[ "$ALLOW_MUTATION" == "1" ]] || fail "set HANDBOOK_E2E_ALLOW_MUTATION=1 to authorize temporary vault changes"
[[ -n "$VAULT" ]] || fail "HANDBOOK_E2E_VAULT is required"
[[ -n "$APP" ]] || fail "HANDBOOK_E2E_OBSIDIAN is required"
[[ -d "$VAULT/.obsidian" ]] || fail "not an Obsidian vault: $VAULT"
[[ -x "$APP" ]] || fail "Obsidian executable is not executable: $APP"
for command_name in curl jq python3 sha256sum cmp find sort setsid pgrep realpath rg seq stat tail xargs; do
  require_command "$command_name"
done
VAULT="$(realpath "$VAULT")"
PLUGIN_ASSETS="$(realpath "$PLUGIN_ASSETS")"
[[ "$VAULT" != "/" && "$VAULT" != "$HOME" ]] || fail "unsafe vault path"
COMMUNITY_PLUGINS="$VAULT/.obsidian/community-plugins.json"
[[ -f "$COMMUNITY_PLUGINS" ]] || fail "missing community-plugins.json in the selected vault"
jq -e 'index("obsidian-handbook") != null' "$COMMUNITY_PLUGINS" >/dev/null ||
  fail "obsidian-handbook is not enabled in the selected vault"
for asset in main.js manifest.json styles.css; do
  [[ -f "$PLUGIN_ASSETS/$asset" ]] || fail "missing plugin asset: $PLUGIN_ASSETS/$asset"
done
python3 -c 'import websocket' >/dev/null 2>&1 || fail "Python package websocket-client is required"
if pgrep -x obsidian >/dev/null || pgrep -x Obsidian-1.13.7 >/dev/null; then
  fail "Obsidian is already running; close it before starting this isolated journey"
fi
if curl -fsS "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null 2>&1; then
  fail "CDP port $CDP_PORT is already in use"
fi

PLUGIN="$VAULT/.obsidian/plugins/obsidian-handbook"
STORAGE="$VAULT/.obsidian/handbook"
DATA_JSON="$PLUGIN/data.json"
SOURCE="$STORAGE/sources/rebellioussmile--schema-in-the-mist"
SOURCE_JSON="$SOURCE/source.json"
OBSIDIAN_LOG="${HANDBOOK_E2E_OBSIDIAN_LOG:-$HOME/.config/obsidian/obsidian.log}"
VAULT_PARENT="$(dirname "$VAULT")"
if [[ -z "$OUTPUT_DIR" ]]; then
  OUTPUT_DIR="$(mktemp -d /tmp/handbook-request-url-e2e.XXXXXX)"
else
  mkdir -p "$OUTPUT_DIR"
  OUTPUT_DIR="$(realpath "$OUTPUT_DIR")"
  [[ -z "$(find "$OUTPUT_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]] ||
    fail "HANDBOOK_E2E_OUTPUT_DIR must be empty"
fi
case "$OUTPUT_DIR/" in
  "$VAULT/"*) fail "HANDBOOK_E2E_OUTPUT_DIR must be outside the vault" ;;
esac
export HANDBOOK_E2E_CDP_PORT="$CDP_PORT"
export HANDBOOK_E2E_OUTPUT_DIR="$OUTPUT_DIR"
REPORT="$OUTPUT_DIR/REPORT.md"

cat >"$REPORT" <<'EOF'
# requestUrl Obsidian E2E journey

| Step | Action | Expected | Actual | Result | Screenshot |
| --- | --- | --- | --- | --- | --- |
EOF

record() {
  printf '| %s | %s | %s | %s | %s | %s |\n' "$1" "$2" "$3" "$4" "$5" "$6" >>"$REPORT"
}

snapshot_tree() {
  local path="$1" output="$2"
  if [[ ! -e "$path" ]]; then
    printf '__ABSENT__\n' >"$output"
    return
  fi
  (
    cd "$path"
    find . -printf '%y\t%P\t%s\t%l\n' | LC_ALL=C sort
    find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum
  ) >"$output"
}

stop_app() {
  python3 "$REPO_ROOT/tools/e2e/request-url-cdp.py" close >/dev/null 2>&1 || true
  if [[ -n "$APP_PID" ]]; then
    kill -TERM -- "-$APP_PID" 2>/dev/null || true
    for _ in $(seq 1 30); do
      kill -0 "$APP_PID" 2>/dev/null || break
      sleep 0.2
    done
    kill -KILL -- "-$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
    APP_PID=""
  fi
}

restore() {
  local status=$?
  local action expected step
  trap - EXIT INT TERM
  set +e
  if [[ "$status" -ne 0 && "$CURRENT_STEP" =~ ^[1-4]$ ]]; then
    for step in $(seq "$((LAST_COMPLETED + 1))" 4); do
      case "$step" in
        1) action="Open a clean plugin install"; expected="Starter-kit modal offers Mist Engine" ;;
        2) action="Install Mist Engine"; expected="Success notice, City of Mist, and exact text/binary files" ;;
        3) action="Check schema-in-the-mist"; expected="Source editor opens" ;;
        4) action="Save and check tag v1.0.0"; expected="Modal closes, tag revision and files match, no requestUrl errors" ;;
      esac
      if [[ "$step" -eq "$CURRENT_STEP" ]]; then
        record "$step" "$action" "$expected" "Step failed; see command output" "FAIL" "n/a"
      else
        record "$step" "$action" "$expected" "Not run because step $CURRENT_STEP failed" "SKIP" "n/a"
      fi
    done
  fi
  stop_app
  if [[ -n "$BACKUP" && -d "$BACKUP" ]]; then
    rm -rf "$PLUGIN" "$STORAGE"
    [[ -d "$BACKUP/plugin" ]] && cp -a "$BACKUP/plugin" "$PLUGIN"
    [[ -d "$BACKUP/storage" ]] && cp -a "$BACKUP/storage" "$STORAGE"
    snapshot_tree "$PLUGIN" "$OUTPUT_DIR/plugin.after"
    snapshot_tree "$STORAGE" "$OUTPUT_DIR/storage.after"
    if cmp -s "$OUTPUT_DIR/plugin.before" "$OUTPUT_DIR/plugin.after" &&
       cmp -s "$OUTPUT_DIR/storage.before" "$OUTPUT_DIR/storage.after"; then
      rm -rf "$BACKUP"
      printf '\nVault restoration: PASS\n' >>"$REPORT"
    else
      printf '\nVault restoration: FAIL. Backup preserved at %s\n' "$BACKUP" >>"$REPORT"
      printf 'RESTORE FAILED: backup preserved at %s\n' "$BACKUP" >&2
      status=90
    fi
  fi
  printf 'Journey report: %s\n' "$REPORT"
  exit "$status"
}
trap restore EXIT INT TERM

compare_revision() {
  local revision="$1" label="$2"
  local base="https://raw.githubusercontent.com/RebelliousSmile/schema-in-the-mist/$revision"
  curl -fsSLo "$OUTPUT_DIR/$label-handbook.json" "$base/handbook.json"
  curl -fsSLo "$OUTPUT_DIR/$label-pack.json" "$base/handbook/legend-in-the-mist/pack.json"
  local first_image assets_root
  first_image="$(jq -r '.pack.assets.images | to_entries[0].value' "$OUTPUT_DIR/$label-pack.json")"
  assets_root="$(jq -r '.pack.assets.root // "assets"' "$OUTPUT_DIR/$label-pack.json")"
  curl -fsSLo "$OUTPUT_DIR/$label-first-image" "$base/handbook/legend-in-the-mist/$assets_root/$first_image"
  cmp "$OUTPUT_DIR/$label-handbook.json" "$SOURCE/handbook.json"
  cmp "$OUTPUT_DIR/$label-pack.json" "$SOURCE/packs/legend-in-the-mist/pack.json"
  cmp "$OUTPUT_DIR/$label-first-image" "$SOURCE/packs/legend-in-the-mist/$assets_root/$first_image"
}

BACKUP="$(mktemp -d "$VAULT_PARENT/.handbook-request-url-e2e.XXXXXX")"
snapshot_tree "$PLUGIN" "$OUTPUT_DIR/plugin.before"
snapshot_tree "$STORAGE" "$OUTPUT_DIR/storage.before"
[[ -d "$PLUGIN" ]] && mv "$PLUGIN" "$BACKUP/plugin"
[[ -d "$STORAGE" ]] && mv "$STORAGE" "$BACKUP/storage"
mkdir -p "$PLUGIN"
cp "$PLUGIN_ASSETS/main.js" "$PLUGIN_ASSETS/manifest.json" "$PLUGIN_ASSETS/styles.css" "$PLUGIN/"

LOG_OFFSET=0
[[ -f "$OBSIDIAN_LOG" ]] && LOG_OFFSET="$(stat -c %s "$OBSIDIAN_LOG")"
setsid "$APP" --no-sandbox --remote-debugging-port="$CDP_PORT" --remote-allow-origins='*' \
  "obsidian://open?vault=$(basename "$VAULT")" >"$OUTPUT_DIR/obsidian.log" 2>&1 &
APP_PID=$!

CURRENT_STEP="1"
python3 "$REPO_ROOT/tools/e2e/request-url-cdp.py" ready
record "1" "Open a clean plugin install" "Starter-kit modal offers Mist Engine" "Modal and action are present" "PASS" "$OUTPUT_DIR/01-starter-kit.png"
LAST_COMPLETED=1

CURRENT_STEP="2"
python3 "$REPO_ROOT/tools/e2e/request-url-cdp.py" install
for _ in $(seq 1 120); do [[ -f "$SOURCE_JSON" ]] && break; sleep 0.25; done
[[ -f "$SOURCE_JSON" ]] || fail "Mist Engine source metadata was not created"
[[ "$(jq -r '.reference.kind' "$SOURCE_JSON")" == "branch" ]]
[[ "$(jq -r '.reference.value' "$SOURCE_JSON")" == "main" ]]
[[ "$(jq -r '.mode' "$DATA_JSON")" == "city-of-mist" ]]
MAIN_REVISION="$(jq -r .revision "$SOURCE_JSON")"
[[ "$(curl -fsSL "https://api.github.com/repos/RebelliousSmile/schema-in-the-mist/commits/$MAIN_REVISION" | jq -r .sha)" == "$MAIN_REVISION" ]]
compare_revision "$MAIN_REVISION" main
record "2" "Install Mist Engine" "Success notice, City of Mist, and exact text/binary files" "Revision $MAIN_REVISION verified byte for byte" "PASS" "$OUTPUT_DIR/02-mist-engine-ready.png"
LAST_COMPLETED=2

CURRENT_STEP="3"
python3 "$REPO_ROOT/tools/e2e/request-url-cdp.py" open-source
record "3" "Check schema-in-the-mist" "Source editor opens" "Source editor opened" "PASS" "$OUTPUT_DIR/03-source-editor.png"
LAST_COMPLETED=3

CURRENT_STEP="4"
python3 "$REPO_ROOT/tools/e2e/request-url-cdp.py" set-tag
for _ in $(seq 1 120); do
  [[ "$(jq -r '.reference.kind // empty' "$SOURCE_JSON" 2>/dev/null)" == "tag" ]] && break
  sleep 0.25
done
[[ "$(jq -r '.reference.kind' "$SOURCE_JSON")" == "tag" ]]
[[ "$(jq -r '.reference.value' "$SOURCE_JSON")" == "v1.0.0" ]]
TAG_REVISION="$(jq -r .revision "$SOURCE_JSON")"
[[ "$(curl -fsSL https://api.github.com/repos/RebelliousSmile/schema-in-the-mist/commits/v1.0.0 | jq -r .sha)" == "$TAG_REVISION" ]]
compare_revision "$TAG_REVISION" tag
if [[ -f "$OBSIDIAN_LOG" ]]; then
  tail -c "+$((LOG_OFFSET + 1))" "$OBSIDIAN_LOG" >"$OUTPUT_DIR/obsidian-appended.log"
  ! rg -i 'text is not a function|arrayBuffer is not a function' "$OUTPUT_DIR/obsidian-appended.log"
fi
record "4" "Save and check tag v1.0.0" "Modal closes, tag revision and files match, no requestUrl errors" "Revision $TAG_REVISION verified; errors absent" "PASS" "$OUTPUT_DIR/04-tag-updated.png"
LAST_COMPLETED=4

printf '\nResult: PASS\n' >>"$REPORT"
printf 'E2E PASS\n'
