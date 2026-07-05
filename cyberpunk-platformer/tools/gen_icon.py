#!/usr/bin/env python3
"""Generates the app launcher icon at standard mipmap densities."""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "android", "res")
DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144}

BG = (10, 8, 20, 255)
DARK = (18, 14, 34, 255)
CYAN = (57, 255, 240, 255)
MAGENTA = (255, 46, 200, 255)


def build(size):
    s = 24  # base grid, scaled up
    scale = size / s
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=5, fill=BG)
    # circuit corner ticks
    d.line([2, 2, 6, 2], fill=CYAN, width=1)
    d.line([2, 2, 2, 6], fill=CYAN, width=1)
    d.line([s - 3, s - 3, s - 7, s - 3], fill=MAGENTA, width=1)
    d.line([s - 3, s - 3, s - 3, s - 7], fill=MAGENTA, width=1)
    # stylised "N" (runner glyph) in cyan/magenta
    d.rectangle([6, 5, 8, 18], fill=CYAN)
    d.rectangle([15, 5, 17, 18], fill=MAGENTA)
    for i in range(6):
        d.point((9 + i, 6 + i), fill=CYAN)
        d.point((10 + i, 6 + i), fill=MAGENTA)
    return img.resize((size, size), Image.NEAREST)


def main():
    for density, size in DENSITIES.items():
        d = os.path.join(OUT, f"mipmap-{density}")
        os.makedirs(d, exist_ok=True)
        build(size).save(os.path.join(d, "ic_launcher.png"))
    print("icon generated for:", ", ".join(DENSITIES))


if __name__ == "__main__":
    main()
