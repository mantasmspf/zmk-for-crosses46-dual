#!/usr/bin/env python3
"""Bundles www/ into a single self-contained playable HTML file (all CSS/JS
inline, all sprite PNGs embedded as base64 data URIs). Leaves www/ untouched
-- this is only for easy single-file distribution/preview.
"""
import base64
import os
import re

ROOT = os.path.join(os.path.dirname(__file__), "..")
WWW = os.path.join(ROOT, "www")
OUT = os.path.join(ROOT, "dist", "neon-runner-standalone.html")

JS_ORDER = ["audio.js", "lighting.js", "shader.js", "levels.js", "story.js", "entities.js", "main.js"]
SPRITES = [
    "player_idle", "player_run", "player_jump", "enemy_drone", "shard", "tiles", "bg_far", "bg_mid", "rain",
]


def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    html = read(os.path.join(WWW, "index.html"))
    css = read(os.path.join(WWW, "style.css"))

    # asset data-URI map
    asset_lines = ["const ASSET_DATA = {"]
    for name in SPRITES:
        with open(os.path.join(WWW, "assets", "sprites", f"{name}.png"), "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        asset_lines.append(f'  "{name}": "data:image/png;base64,{b64}",')
    asset_lines.append("};")
    asset_js = "\n".join(asset_lines)

    js_blocks = [asset_js]
    for fname in JS_ORDER:
        src = read(os.path.join(WWW, "js", fname))
        if fname == "main.js":
            src = src.replace(
                'img.src = `assets/sprites/${name}.png`;',
                "img.src = ASSET_DATA[name];",
            )
        js_blocks.append(f"// ---- {fname} ----\n" + src)
    all_js = "\n\n".join(js_blocks)

    # inline stylesheet
    html = html.replace('<link rel="stylesheet" href="style.css">', f"<style>\n{css}\n</style>")

    # replace the individual <script src="js/..."> tags with one inline block
    html = re.sub(r'\s*<script src="js/[^"]+"></script>', "", html)
    html = html.replace("</body>", f"<script>\n{all_js}\n</script>\n</body>")

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)

    size_kb = os.path.getsize(OUT) / 1024
    print(f"Wrote {OUT} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
