#!/usr/bin/env python3
"""Small Chrome DevTools Protocol driver for the requestUrl Obsidian journey."""

import base64
import json
import os
import sys
import time
import urllib.request

import websocket


PORT = int(os.environ.get("HANDBOOK_E2E_CDP_PORT", "9223"))
OUTPUT_DIR = os.environ["HANDBOOK_E2E_OUTPUT_DIR"]


def targets():
    with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json", timeout=1) as response:
        return [target for target in json.load(response) if target.get("type") == "page"]


def wait_for_target(exclude_id=None):
    deadline = time.time() + 30
    while time.time() < deadline:
        try:
            pages = [target for target in targets() if target.get("id") != exclude_id]
            if pages:
                return pages[-1]
        except Exception:
            pass
        time.sleep(0.2)
    raise RuntimeError("CDP page target did not appear")


def connect(target):
    return websocket.create_connection(
        target["webSocketDebuggerUrl"],
        timeout=10,
        origin=f"http://127.0.0.1:{PORT}",
    )


target = wait_for_target()
ws = connect(target)
request_id = 0


def call(method, params=None):
    global request_id
    request_id += 1
    current_id = request_id
    ws.send(json.dumps({"id": current_id, "method": method, "params": params or {}}))
    while True:
        payload = json.loads(ws.recv())
        if payload.get("id") == current_id:
            if "error" in payload:
                raise RuntimeError(payload["error"])
            return payload.get("result", {})


def evaluate(expression):
    result = call(
        "Runtime.evaluate",
        {"expression": expression, "returnByValue": True, "awaitPromise": True},
    )
    if "exceptionDetails" in result:
        raise RuntimeError(result["exceptionDetails"].get("text", "evaluation failed"))
    return result.get("result", {}).get("value")


def wait_for(expression, timeout=30):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if evaluate(expression):
            return
        time.sleep(0.15)
    body = evaluate("document.body.innerText")
    raise RuntimeError(f"timeout waiting for DOM condition; body was:\n{body}")


def screenshot(filename):
    image = call("Page.captureScreenshot", {"format": "png"})
    with open(os.path.join(OUTPUT_DIR, filename), "wb") as output:
        output.write(base64.b64decode(image["data"]))


action = sys.argv[1]

if action == "close":
    call("Browser.close")
    sys.exit(0)
elif action == "ready":
    wait_for(
        "document.body.innerText.includes('Choose a starter kit') && "
        "document.body.innerText.includes('Mist Engine')"
    )
    screenshot("01-starter-kit.png")
    print("starter_kit=ready")
elif action == "install":
    transient_errors = ("ERR_NETWORK_CHANGED", "ERR_TIMED_OUT", "ERR_CONNECTION_RESET")
    for attempt in range(1, 4):
        clicked = evaluate(
            """
            (() => {
              const modal = [...document.querySelectorAll('.modal')]
                .find(node => node.innerText.includes('Choose a starter kit'));
              const button = modal && [...modal.querySelectorAll('button')]
                .find(node => node.innerText.trim() === 'Install');
              if (!button) return false;
              button.click();
              return true;
            })()
            """
        )
        if not clicked:
            raise RuntimeError("Mist Engine Install button was not found")
        deadline = time.time() + 30
        retry = False
        while time.time() < deadline:
            notices = evaluate(
                "[...document.querySelectorAll('.notice')].map(node => node.innerText).join('\\n')"
            )
            if "Mist Engine is ready" in notices:
                screenshot("02-mist-engine-ready.png")
                print("notice=Mist Engine is ready")
                break
            if "Could not install Mist Engine" in notices:
                if attempt < 3 and any(error in notices for error in transient_errors):
                    print(f"Transient install failure; retrying ({attempt}/3): {notices}", file=sys.stderr)
                    retry = True
                    while time.time() < deadline and evaluate(
                        "Boolean(document.querySelector('.notice'))"
                    ):
                        time.sleep(0.1)
                    break
                screenshot("02-mist-engine-failed.png")
                raise RuntimeError(notices)
            time.sleep(0.1)
        else:
            body = evaluate("document.body.innerText")
            raise RuntimeError(f"installer produced no result; body was:\n{body}")
        if not retry:
            break
    else:
        raise RuntimeError("transient network failures exhausted three install attempts")
elif action == "open-source":
    original_target_id = target["id"]
    opened = evaluate(
        "Boolean(globalThis.app?.setting && (app.setting.open(), true))"
    )
    if not opened:
        raise RuntimeError("Obsidian settings API was unavailable")
    ws.close()
    target = wait_for_target(exclude_id=original_target_id)
    ws = connect(target)
    switched = evaluate(
        """
        (() => {
          const items = [...document.querySelectorAll('.vertical-tab-nav-item')]
            .filter(node => node.innerText.trim() === 'Handbook');
          const item = items.at(-1);
          if (!item) return false;
          item.click();
          return true;
        })()
        """
    )
    if not switched:
        raise RuntimeError("Handbook settings tab was not found")
    wait_for("document.body.innerText.includes('Schema sources')")
    clicked = evaluate(
        """
        (() => {
          const item = [...document.querySelectorAll('.setting-item')]
            .find(node => node.innerText.includes('RebelliousSmile/schema-in-the-mist'));
          const button = item && [...item.querySelectorAll('button')]
            .find(node => node.innerText.trim() === 'Check');
          if (!button) return false;
          button.click();
          return true;
        })()
        """
    )
    if not clicked:
        raise RuntimeError("schema-in-the-mist Check button was not found")
    wait_for("document.body.innerText.includes('Edit schema source')")
    screenshot("03-source-editor.png")
    print("source_editor=open")
elif action == "set-tag":
    ws.close()
    deadline = time.time() + 30
    while time.time() < deadline:
        for candidate in targets():
            candidate_ws = connect(candidate)
            ws = candidate_ws
            try:
                if evaluate("document.body.innerText.includes('Edit schema source')"):
                    target = candidate
                    break
            finally:
                if target.get("id") != candidate.get("id"):
                    candidate_ws.close()
        else:
            time.sleep(0.2)
            continue
        break
    else:
        raise RuntimeError("source editor renderer was not found")

    selected = evaluate(
        """
        (() => {
          const modal = [...document.querySelectorAll('.modal')]
            .find(node => node.innerText.includes('Edit schema source'));
          const select = modal?.querySelector('select');
          const option = select && [...select.options]
            .find(node => node.textContent.trim() === 'Tag');
          if (!option) return false;
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        })()
        """
    )
    if not selected:
        raise RuntimeError("Tag option was not found")
    wait_for(
        """
        (() => {
          const modal = [...document.querySelectorAll('.modal')]
            .find(node => node.innerText.includes('Edit schema source'));
          return modal && [...modal.querySelectorAll('label, .setting-item-name')]
            .some(node => node.innerText.trim() === 'Tag');
        })()
        """
    )
    saved = evaluate(
        """
        (() => {
          const modal = [...document.querySelectorAll('.modal')]
            .find(node => node.innerText.includes('Edit schema source'));
          const inputs = [...(modal?.querySelectorAll('input[type="text"]') || [])];
          const input = inputs.at(-1);
          const button = modal && [...modal.querySelectorAll('button')]
            .find(node => node.innerText.trim() === 'Save and check');
          if (!input || !button) return false;
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
            .set.call(input, 'v1.0.0');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          button.click();
          return true;
        })()
        """
    )
    if not saved:
        raise RuntimeError("tag input or Save and check button was not found")
    wait_for(
        "![...document.querySelectorAll('.modal')]"
        ".some(node => node.innerText.includes('Edit schema source'))"
    )
    screenshot("04-tag-updated.png")
    print("tag=v1.0.0")
else:
    raise RuntimeError(f"unknown action: {action}")

ws.close()
