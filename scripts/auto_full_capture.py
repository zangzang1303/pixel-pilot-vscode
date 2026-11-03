import argparse
import asyncio
import base64
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.request
import websockets

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = pathlib.Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "evidence" / "user-acceptance-2026-10-28"
EVIDENCE.mkdir(parents=True, exist_ok=True)

class CDP:
    def __init__(self, url: str):
        self.url = url
        self.ws = None
        self.next_id = 0

    async def __aenter__(self):
        self.ws = await websockets.connect(self.url, max_size=32 * 1024 * 1024)
        return self

    async def __aexit__(self, *_):
        await self.ws.close()

    async def call(self, method: str, params=None, session_id=None):
        self.next_id += 1
        request_id = self.next_id
        payload = {"id": request_id, "method": method, "params": params or {}}
        if session_id:
            payload["sessionId"] = session_id
        await self.ws.send(json.dumps(payload))
        while True:
            message = json.loads(await self.ws.recv())
            if message.get("id") != request_id:
                continue
            if "error" in message:
                raise RuntimeError(f"{method}: {message['error']}")
            return message.get("result", {})

    async def evaluate(self, expression: str, session_id=None):
        result = await self.call("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": True,
        }, session_id=session_id)
        if "exceptionDetails" in result:
            raise RuntimeError(json.dumps(result["exceptionDetails"], ensure_ascii=False))
        return result.get("result", {}).get("value")

    async def key(self, key: str, code: str, modifiers=0):
        virtual_keys = {"Enter": 13, "Escape": 27, "Tab": 9, "Backspace": 8, "Delete": 46}
        virtual_key = ord(key.upper()) if len(key) == 1 else virtual_keys.get(key, 0)
        for event_type in ("keyDown", "keyUp"):
            await self.call("Input.dispatchKeyEvent", {
                "type": event_type,
                "key": key,
                "code": code,
                "windowsVirtualKeyCode": virtual_key,
                "nativeVirtualKeyCode": virtual_key,
                "modifiers": modifiers,
            })

    async def screenshot(self, name: str):
        result = await self.call("Page.captureScreenshot", {"format": "png", "fromSurface": True})
        path = EVIDENCE / name
        path.write_bytes(base64.b64decode(result["data"]))
        print(f"Captured: {name} ({path.stat().st_size} bytes)")
        return path

    async def command_palette(self, command: str):
        await self.key("p", "KeyP", modifiers=10)
        await asyncio.sleep(0.5)
        await self.call("Input.insertText", {"text": command})
        await asyncio.sleep(0.5)
        await self.key("Enter", "Enter")
        await asyncio.sleep(1.0)


def start_vscode():
    try:
        with urllib.request.urlopen("http://127.0.0.1:9333/json", timeout=1) as r:
            return None
    except Exception:
        pass

    env = os.environ.copy()
    env.pop("ELECTRON_RUN_AS_NODE", None)
    code_exe = r"C:\Users\letua\AppData\Local\Programs\Microsoft VS Code\Code.exe"
    profile = ROOT / ".pixelpilot_runtime" / "cdp-profile"
    user_data = profile / "user-data"
    extensions = profile / "extensions"
    user_data.mkdir(parents=True, exist_ok=True)
    extensions.mkdir(parents=True, exist_ok=True)
    args = [
        code_exe,
        "--remote-debugging-port=9333",
        f"--user-data-dir={user_data}",
        f"--extensions-dir={extensions}",
        f"--extensionDevelopmentPath={ROOT}",
        "--disable-workspace-trust",
        "--disable-extensions",
        "--skip-welcome",
        "--skip-release-notes",
        str(ROOT)
    ]
    proc = subprocess.Popen(args, env=env)
    print("Launched VS Code PID:", proc.pid)
    for _ in range(25):
        time.sleep(1)
        try:
            with urllib.request.urlopen("http://127.0.0.1:9333/json", timeout=1) as r:
                print("Connected to CDP on 9333!")
                return proc
        except Exception:
            pass
    raise RuntimeError("VS Code failed to start on port 9333")


def page_target():
    with urllib.request.urlopen("http://127.0.0.1:9333/json", timeout=3) as response:
        targets = json.load(response)
    return next(target for target in targets if target.get("type") == "page")


async def get_webview_session(cdp):
    targets = await cdp.call("Target.getTargets")
    for t in targets["targetInfos"]:
        if t.get("type") == "iframe" and "pixel-pilot" in t.get("url", ""):
            attached = await cdp.call("Target.attachToTarget", {"targetId": t["targetId"], "flatten": True})
            return attached["sessionId"]
    return None


def in_active_frame(script: str):
    return f"""(() => {{
      const doc = document.getElementById('active-frame')?.contentDocument || document;
      {script}
    }})()"""


async def main():
    proc = start_vscode()
    time.sleep(3)

    target = page_target()
    async with CDP(target["webSocketDebuggerUrl"]) as cdp:
        await cdp.call("Runtime.enable")
        await cdp.call("Page.enable")

        print("Capturing 00-vscode-extension-host-started.png...")
        await cdp.screenshot("00-vscode-extension-host-started.png")

        # Open Studio command
        print("Opening Studio...")
        await cdp.command_palette("Pixel Pilot: Open AI Studio (Canvas)")
        await asyncio.sleep(4)
        await cdp.screenshot("01-open-ai-studio-command.png")

        # Find webview
        session_id = None
        for attempt in range(10):
            session_id = await get_webview_session(cdp)
            if session_id:
                break
            await asyncio.sleep(1)

        if not session_id:
            print("Webview session not found yet.")
            return

        await cdp.call("Runtime.enable", session_id=session_id)

        # Inspect DOM
        info = await cdp.evaluate(in_active_frame("""
          return {
            title: doc.title,
            buttons: [...doc.querySelectorAll('button')].map(b => b.innerText.trim()).filter(Boolean),
            tabs: [...doc.querySelectorAll('[role=tab], nav button')].map(t => t.innerText.trim())
          };
        """), session_id=session_id)
        print("Webview Info:", json.dumps(info, ensure_ascii=False, indent=2))

    if proc:
        proc.terminate()

if __name__ == "__main__":
    asyncio.run(main())
