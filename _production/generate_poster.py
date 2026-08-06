#!/usr/bin/env python3
import json
import subprocess
import time
from pathlib import Path

API = "https://chat.aiwaves.tech/aigram/api/gen-image"
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "poster.png"
PROVENANCE = ROOT / "doc" / "poster-provenance.md"
REF_URL = "https://cdn.aiwaves.tech/prod/telegram/avatar/0/1786023427774516.webp"
PROMPT = """
Edit this square CITY OF TIDES key art while preserving the rainy flooded city, lighthouse, raised railway causeway, warm lamps, teal and oxidized-copper palette, cinematic depth and exact title CITY OF TIDES. Remove the entire black rounded phone/device frame and reconstruct the image naturally to all four square edges. Remove the small text "at 160x160" completely. Remove the circular emblem at upper right completely. Remove every handwritten mark from the paper and make it a plain weathered folded note with no symbols. The exact title CITY OF TIDES must be the only visible text anywhere, in the top 20 percent, large and perfectly legible. English text only, absolutely no Chinese characters and no pseudo-Asian glyphs. Do not add any letters, numbers, microtype, logo, watermark, seal, badge, icon, border, interface, HUD or phone frame. Keep the lower 20 percent visually quiet; move the foreground lamp and blank paper slightly upward if needed. Preserve strong recognition at 160x160 without writing the dimensions on the image.
""".strip()

def main():
    payload = json.dumps({"prompt": PROMPT, "ref_url": REF_URL})
    result = subprocess.run([
        "curl", "--silent", "--show-error", "--fail-with-body", "--max-time", "420",
        "-H", "Content-Type: application/json", "-H", "Origin: https://aigram.app",
        "-H", "Referer: https://aigram.app/", "--data-binary", payload, API,
    ], check=True, capture_output=True, text=True)
    response = json.loads(result.stdout)
    url = response["url"]
    source = OUTPUT.with_suffix(".source.webp")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["curl", "--silent", "--show-error", "--fail", "--location", url, "--output", str(source)], check=True)
    subprocess.run(["sips", "-z", "1024", "1024", "-s", "format", "png", str(source), "--out", str(OUTPUT)], check=True, capture_output=True)
    source.unlink(missing_ok=True)
    PROVENANCE.write_text(
        f"# 海报制作来源\n\n- 制作方式：Aigram 平台 transit 生图接口。\n- 请求时间：{time.strftime('%Y-%m-%d %H:%M:%S %z')}\n- Endpoint：`{API}`\n- 请求头：`Origin: https://aigram.app`。\n- 编辑参考 URL：{REF_URL}\n- 返回 URL：{url}\n- 输出：`public/poster.png`，1024×1024 raster PNG。\n- 未使用 ComfyUI、本地 workflow、SVG/Canvas 或游戏截图。\n\n## Prompt\n\n```text\n{PROMPT}\n```\n",
        encoding="utf-8",
    )
    print(json.dumps({"url": url, "output": str(OUTPUT)}, ensure_ascii=False))

if __name__ == "__main__":
    main()
