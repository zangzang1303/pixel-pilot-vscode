import argparse
import asyncio
import base64
import json
import pathlib
import urllib.request

import websockets


ROOT = pathlib.Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "evidence" / "user-acceptance-2026-10-28"


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
        return path

    async def command_palette(self, command: str):
        await self.key("p", "KeyP", modifiers=10)
        await asyncio.sleep(0.4)
        await self.call("Input.insertText", {"text": command})
        await asyncio.sleep(0.4)
        await self.key("Enter", "Enter")
        await asyncio.sleep(0.8)


def page_target():
    with urllib.request.urlopen("http://127.0.0.1:9333/json", timeout=3) as response:
        targets = json.load(response)
    return next(target for target in targets if target.get("type") == "page")


async def inspect():
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    async with CDP(page_target()["webSocketDebuggerUrl"]) as cdp:
        await cdp.call("Runtime.enable")
        await cdp.call("Page.enable")
        await cdp.screenshot("00-vscode-extension-host-started.png")
        summary = await cdp.evaluate("""({
          title: document.title,
          text: document.body.innerText.slice(0, 6000),
          iframes: [...document.querySelectorAll('iframe,webview')].map((el, i) => ({
            i, tag: el.tagName, src: el.src || '', title: el.title || '', cls: el.className || ''
          }))
        })""")
        print(json.dumps(summary, ensure_ascii=False, indent=2))


async def open_studio():
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    async with CDP(page_target()["webSocketDebuggerUrl"]) as cdp:
        await cdp.call("Runtime.enable")
        await cdp.call("Page.enable")
        # Ctrl+Shift+P opens VS Code's Command Palette (modifier bitmask: Alt=1, Ctrl=2, Meta=4, Shift=8).
        await cdp.key("p", "KeyP", modifiers=10)
        await asyncio.sleep(0.5)
        await cdp.call("Input.insertText", {"text": "Pixel Pilot: Open AI Studio (Canvas)"})
        await asyncio.sleep(0.5)
        await cdp.key("Enter", "Enter")
        await asyncio.sleep(4)
        await cdp.screenshot("01-open-ai-studio-command.png")
        summary = await cdp.evaluate("""({
          title: document.title,
          text: document.body.innerText.slice(0, 8000),
          iframes: [...document.querySelectorAll('iframe,webview')].map((el, i) => ({
            i, tag: el.tagName, src: el.src || '', title: el.title || '', cls: el.className || ''
          }))
        })""")
        print(json.dumps(summary, ensure_ascii=False, indent=2))


async def inspect_targets():
    async with CDP(page_target()["webSocketDebuggerUrl"]) as cdp:
        targets = await cdp.call("Target.getTargets")
        print(json.dumps(targets, ensure_ascii=False, indent=2))


async def webview_session(cdp):
    targets = await cdp.call("Target.getTargets")
    target = next(item for item in targets["targetInfos"] if item.get("type") == "iframe" and "pixel-pilot-team.pixel-pilot-vscode" in item.get("url", ""))
    attached = await cdp.call("Target.attachToTarget", {"targetId": target["targetId"], "flatten": True})
    return attached["sessionId"]


async def inspect_webview():
    async with CDP(page_target()["webSocketDebuggerUrl"]) as cdp:
        session_id = await webview_session(cdp)
        await cdp.call("Runtime.enable", session_id=session_id)
        summary = await cdp.evaluate("""(() => {
          const frame = document.getElementById('active-frame');
          const doc = frame?.contentDocument || document;
          return {
            href: location.href,
            frameHref: frame?.contentWindow?.location?.href || '',
            title: doc.title,
            html: doc.documentElement.outerHTML.slice(0, 4000),
            text: doc.body.innerText,
            frames: [...document.querySelectorAll('iframe')].map((f, i) => ({i, id:f.id, src:f.src, name:f.name})),
            buttons: [...doc.querySelectorAll('button')].map((b, i) => ({i, text: b.innerText.trim(), title: b.title, disabled: b.disabled})),
            inputs: [...doc.querySelectorAll('input,textarea,select')].map((e, i) => ({i, tag: e.tagName, type: e.type, value: e.value, placeholder: e.placeholder || ''}))
          };
        })()""", session_id=session_id)
        print(json.dumps(summary, ensure_ascii=False, indent=2))


def in_active_frame(script: str):
    return f"""(() => {{
      const doc = document.getElementById('active-frame')?.contentDocument;
      if (!doc) throw new Error('Pixel Pilot active frame is unavailable');
      {script}
    }})()"""


async def run_stage1():
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    async with CDP(page_target()["webSocketDebuggerUrl"]) as cdp:
        await cdp.call("Runtime.enable")
        await cdp.call("Page.enable")
        # Maximize the editor area for legible evidence.
        await cdp.key("b", "KeyB", modifiers=2)
        await cdp.command_palette("View: Toggle Secondary Side Bar Visibility")
        await cdp.screenshot("02-generate-settings-and-provider-status.png")
        session_id = await webview_session(cdp)
        await cdp.call("Runtime.enable", session_id=session_id)
        await cdp.evaluate(in_active_frame("""
          const textarea = doc.querySelector('textarea');
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
          setter.call(textarea, 'A friendly pixel art robot pilot flying above a neon Vietnamese city at night');
          textarea.dispatchEvent(new Event('input', {bubbles:true}));
          const style = [...doc.querySelectorAll('button')].find(b => b.innerText.trim() === 'Pixel Art');
          style.click();
          const generate = [...doc.querySelectorAll('button')].find(b => b.innerText.includes('Sinh ảnh mới'));
          generate.click();
          return true;
        """), session_id=session_id)
        await asyncio.sleep(1)
        await cdp.screenshot("03-generate-processing-state.png")
        await asyncio.sleep(8)
        await cdp.screenshot("04-generate-success-and-canvas.png")
        status = await cdp.evaluate(in_active_frame("""
          return {text: doc.body.innerText, images: [...doc.images].map(i => ({src:i.src.slice(0,120), width:i.naturalWidth, height:i.naturalHeight}))};
        """), session_id=session_id)
        print(json.dumps(status, ensure_ascii=False, indent=2))


async def reload_window():
    async with CDP(page_target()["webSocketDebuggerUrl"]) as cdp:
        await cdp.call("Runtime.enable")
        await cdp.key("Escape", "Escape")
        await cdp.command_palette("Developer: Reload Window")


async def run_stage2():
    async with CDP(page_target()["webSocketDebuggerUrl"]) as cdp:
        await cdp.call("Runtime.enable")
        await cdp.call("Page.enable")
        # Ctrl+Alt+B is VS Code's Toggle Secondary Side Bar shortcut.
        await cdp.key("b", "KeyB", modifiers=3)
        await asyncio.sleep(0.5)
        session_id = await webview_session(cdp)
        await cdp.call("Runtime.enable", session_id=session_id)
        await cdp.evaluate(in_active_frame("""
          [...doc.querySelectorAll('button')].find(b => b.innerText.trim() === 'Chỉnh sửa').click();
          return true;
        """), session_id=session_id)
        await asyncio.sleep(0.8)
        await cdp.screenshot("05-edit-tools-overview.png")
        inventory = await cdp.evaluate(in_active_frame("""
          return [...doc.querySelectorAll('button')].map((b, i) => ({i, text:b.innerText.trim(), title:b.title, disabled:b.disabled}));
        """), session_id=session_id)
        print(json.dumps(inventory, ensure_ascii=False, indent=2))


async def run_stage3():
    tools = [
        ("Dò biên Canny", "06-canny-edge-detection-result.png", 3),
        ("Nét vẽ Lineart", "07-lineart-extraction-result.png", 3),
        ("Độ sâu 3D", "08-depth-map-result.png", 3),
        ("Mặt nạ AI", "09-ai-mask-result.png", 3),
        ("Mở rộng ngang", "10-horizontal-outpaint-result.png", 3),
        ("Áp dụng phong cách", "11-style-transfer-result.png", 3),
        ("Vector hóa", "12-vectorize-svg-result.png", 3),
        ("Tạo mô tả ảnh AI", "13-ai-caption-result.png", 2),
    ]
    async with CDP(page_target()["webSocketDebuggerUrl"]) as cdp:
        await cdp.call("Runtime.enable")
        await cdp.call("Page.enable")
        session_id = await webview_session(cdp)
        await cdp.call("Runtime.enable", session_id=session_id)
        results = []
        for label, filename, wait_seconds in tools:
            result = await cdp.evaluate(in_active_frame(f"""
              const button = [...doc.querySelectorAll('button')].find(b => b.innerText.trim().startsWith({json.dumps(label)}));
              if (!button) return {{label:{json.dumps(label)}, clicked:false}};
              button.click();
              return {{label:{json.dumps(label)}, clicked:true, disabled:button.disabled}};
            """), session_id=session_id)
            await asyncio.sleep(wait_seconds)
            await cdp.screenshot(filename)
            status = await cdp.evaluate(in_active_frame("""
              return {text:doc.body.innerText.slice(-1200), canvasCount:doc.querySelectorAll('canvas').length};
            """), session_id=session_id)
            results.append({"action": result, "status": status, "evidence": filename})
        print(json.dumps(results, ensure_ascii=False, indent=2))


async def run_stage4():
    tools = [
        ("Tách nền (BiRefNet)", "14-remove-background", 14),
        ("Phóng to 2x", "15-upscale-2x", 14),
        ("Phóng to 4x", "16-upscale-4x", 16),
        ("Khử mờ & Làm nét HDR", "17-enhance-hdr", 5),
        ("Thực hiện đổi màu", "18-selective-recolor", 8),
        ("4 Hướng đều", "19-extend-all-directions", 4),
        ("Mở rộng dọc", "20-vertical-outpaint", 4),
    ]
    async with CDP(page_target()["webSocketDebuggerUrl"]) as cdp:
        await cdp.call("Runtime.enable")
        await cdp.call("Page.enable")
        session_id = await webview_session(cdp)
        await cdp.call("Runtime.enable", session_id=session_id)
        results = []
        for label, stem, wait_seconds in tools:
            clicked = await cdp.evaluate(in_active_frame(f"""
              const button = [...doc.querySelectorAll('button')].find(b => b.innerText.trim().startsWith({json.dumps(label)}));
              if (!button) return false;
              button.click(); return true;
            """), session_id=session_id)
            await asyncio.sleep(1)
            await cdp.screenshot(f"{stem}-processing.png")
            await asyncio.sleep(wait_seconds)
            await cdp.screenshot(f"{stem}-result.png")
            status = await cdp.evaluate(in_active_frame("""
              return {tail:doc.body.innerText.slice(-1600), dialogs:[...doc.querySelectorAll('[role=dialog]')].map(d=>d.innerText)};
            """), session_id=session_id)
            # Never approve a cloud consent dialog during acceptance automation; preserve it as evidence and cancel.
            if status.get("dialogs"):
                await cdp.evaluate(in_active_frame("""
                  const cancel = [...doc.querySelectorAll('button')].find(b => /Hủy|Cancel|Từ chối/.test(b.innerText));
                  if (cancel) cancel.click(); return !!cancel;
                """), session_id=session_id)
            results.append({"label": label, "clicked": clicked, "status": status, "evidence": f"{stem}-result.png"})
        print(json.dumps(results, ensure_ascii=False, indent=2))


async def run_stage4b():
    async with CDP(page_target()["webSocketDebuggerUrl"]) as cdp:
        await cdp.call("Runtime.enable")
        await cdp.call("Page.enable")
        session_id = await webview_session(cdp)
        await cdp.call("Runtime.enable", session_id=session_id)
        clicked = await cdp.evaluate(in_active_frame("""
          const button = [...doc.querySelectorAll('button')].find(b => b.innerText.trim().startsWith('Phóng to 4x'));
          button?.click(); return !!button;
        """), session_id=session_id)
        await asyncio.sleep(1)
        await cdp.screenshot("16-upscale-4x-processing.png")
        await asyncio.sleep(70)
        await cdp.screenshot("16-upscale-4x-result.png")
        status = await cdp.evaluate(in_active_frame("return doc.body.innerText.slice(-1200);"), session_id=session_id)
        print(json.dumps({"clicked": clicked, "status": status}, ensure_ascii=False, indent=2))


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("inspect", "open-studio", "inspect-targets", "inspect-webview", "stage1", "stage2", "stage3", "stage4", "stage4b", "reload"))
    args = parser.parse_args()
    if args.action == "inspect":
        await inspect()
    elif args.action == "open-studio":
        await open_studio()
    elif args.action == "inspect-targets":
        await inspect_targets()
    elif args.action == "inspect-webview":
        await inspect_webview()
    elif args.action == "stage1":
        await run_stage1()
    elif args.action == "reload":
        await reload_window()
    elif args.action == "stage2":
        await run_stage2()
    elif args.action == "stage3":
        await run_stage3()
    elif args.action == "stage4":
        await run_stage4()
    else:
        await run_stage4b()


if __name__ == "__main__":
    asyncio.run(main())
