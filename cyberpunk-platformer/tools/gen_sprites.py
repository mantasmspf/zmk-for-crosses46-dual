#!/usr/bin/env python3
"""Generates pixel-art sprite sheets and background art for the cyberpunk platformer.

Every sprite is authored as a character grid (one char = one pixel) and
rendered with nearest-neighbour upscaling, so output stays crisp pixel art.
"""
import json
import os
import random

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "www", "assets")
SCALE = 6
random.seed(1337)

# ---------------------------------------------------------------- palette --
PAL = {
    ".": (0, 0, 0, 0),          # transparent
    "K": (12, 10, 22, 255),     # near-black outline
    "S": (40, 34, 64, 255),     # dark suit
    "s": (58, 48, 92, 255),     # suit highlight
    "J": (26, 22, 46, 255),     # jacket shadow
    "C": (57, 255, 240, 255),   # cyan glow
    "c": (18, 140, 150, 255),   # cyan dim
    "M": (255, 46, 200, 255),   # magenta glow
    "m": (150, 20, 120, 255),   # magenta dim
    "Y": (255, 220, 60, 255),   # visor yellow-white
    "H": (235, 245, 255, 255),  # skin/visor highlight
    "R": (255, 60, 90, 255),    # red accent (enemy)
    "G": (60, 220, 130, 255),   # data-green
    "W": (210, 216, 235, 255),  # boots/metal
    "g": (110, 116, 140, 255),  # metal mid
    "d": (70, 74, 96, 255),     # metal dark
}


def render(grid, scale=SCALE):
    h = len(grid)
    w = len(grid[0])
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            px[x, y] = PAL[ch]
    return img.resize((w * scale, h * scale), Image.NEAREST)


def sheet(frames, path, meta_path, name):
    w, h = frames[0].size
    sh = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sh.paste(f, (i * w, 0))
    sh.save(path)
    meta = {"name": name, "frameWidth": w, "frameHeight": h, "frames": len(frames)}
    return meta


# ============================================================== PLAYER ====
# 16 wide x 24 tall grid. "V" style hood, cyan visor, magenta piping.
P_W, P_H = 16, 24


def blank():
    return [["." for _ in range(P_W)] for _ in range(P_H)]


def draw_player(pose):
    """pose: dict with leg/arm offsets to build run-cycle procedurally."""
    g = blank()

    def setp(x, y, ch):
        if 0 <= x < P_W and 0 <= y < P_H:
            g[y][x] = ch

    def rect(x0, y0, x1, y1, ch):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                setp(x, y, ch)

    # hood/head
    rect(5, 1, 10, 5, "K")
    rect(6, 2, 9, 4, "J")
    rect(6, 3, 9, 3, "C")  # visor slit
    setp(6, 3, "Y")
    setp(9, 3, "Y")

    # torso / jacket
    rect(4, 6, 11, 13, "K")
    rect(5, 7, 10, 12, "S")
    rect(5, 7, 5, 12, "s")
    rect(10, 7, 10, 12, "s")
    # chest glow stripe
    rect(7, 8, 8, 11, "M")
    setp(7, 8, "m")
    setp(8, 11, "m")

    # arms swing with pose
    aoff = pose["arm"]
    rect(2, 7 + aoff, 3, 11 + aoff, "K")
    rect(3, 7 + aoff, 3, 11 + aoff, "J")
    rect(12, 7 - aoff, 13, 11 - aoff, "K")
    rect(12, 7 - aoff, 12, 11 - aoff, "J")

    # hip
    rect(4, 14, 11, 16, "K")
    rect(5, 14, 10, 16, "S")

    # legs with pose offsets (front/back leg stride)
    lf, lb = pose["legF"], pose["legB"]
    # back leg
    rect(5, 17, 7, 19 + lb, "K")
    rect(5, 17, 7, 18 + lb, "J")
    rect(5, 19 + lb, 7, 20 + lb, "W")
    # front leg
    rect(8, 17, 10, 19 + lf, "K")
    rect(8, 17, 10, 18 + lf, "S")
    rect(8, 19 + lf, 10, 20 + lf, "W")

    return render(g)


def gen_player():
    idle_a = draw_player({"arm": 0, "legF": 0, "legB": 0})
    idle_b = draw_player({"arm": 0, "legF": 0, "legB": -1})
    run1 = draw_player({"arm": 2, "legF": 2, "legB": -2})
    run2 = draw_player({"arm": 0, "legF": 0, "legB": 0})
    run3 = draw_player({"arm": -2, "legF": -2, "legB": 2})
    run4 = draw_player({"arm": 0, "legF": 0, "legB": 0})
    jump = draw_player({"arm": -3, "legF": -2, "legB": 3})

    meta = {}
    meta["idle"] = sheet([idle_a, idle_b], f"{OUT}/sprites/player_idle.png", None, "idle")
    meta["run"] = sheet([run1, run2, run3, run4], f"{OUT}/sprites/player_run.png", None, "run")
    meta["jump"] = sheet([jump], f"{OUT}/sprites/player_jump.png", None, "jump")
    return meta


# ============================================================= ENEMY ======
E_W, E_H = 16, 16


def draw_drone(bob, spin):
    g = [["." for _ in range(E_W)] for _ in range(E_H)]

    def setp(x, y, ch):
        if 0 <= x < E_W and 0 <= y < E_H:
            g[y][x] = ch

    def rect(x0, y0, x1, y1, ch):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                setp(x, y, ch)

    cy = 6 + bob
    rect(4, cy, 11, cy + 4, "K")
    rect(5, cy + 1, 10, cy + 3, "d")
    rect(6, cy + 1, 9, cy + 3, "g")
    # red eye
    rect(6, cy + 2, 9, cy + 2, "R")
    setp(7, cy + 2, "H")
    # rotor blur alternating
    if spin:
        rect(1, cy - 1, 3, cy - 1, "c")
        rect(12, cy - 1, 14, cy - 1, "c")
    else:
        rect(1, cy, 3, cy, "c")
        rect(12, cy, 14, cy, "c")
    # under-thrusters
    rect(6, cy + 5, 9, cy + 6, "m")
    return render(g)


def gen_enemy():
    f1 = draw_drone(0, False)
    f2 = draw_drone(-1, True)
    return sheet([f1, f2], f"{OUT}/sprites/enemy_drone.png", None, "drone")


# ========================================================== COLLECTIBLE ===
C_W, C_H = 10, 10


def draw_shard(glow):
    g = [["." for _ in range(C_W)] for _ in range(C_H)]

    def setp(x, y, ch):
        if 0 <= x < C_W and 0 <= y < C_H:
            g[y][x] = ch

    pts = [(5, 0), (7, 2), (8, 5), (7, 8), (5, 9), (3, 8), (2, 5), (3, 2)]
    for i in range(len(pts)):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % len(pts)]
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for s in range(steps + 1):
            xx = round(x0 + (x1 - x0) * s / steps)
            yy = round(y0 + (y1 - y0) * s / steps)
            setp(xx, yy, "K")
    inner = "G" if glow else "C"
    for y in range(3, 7):
        for x in range(3, 7):
            setp(x, y, inner)
    setp(5, 4, "H")
    return render(g)


def gen_collectible():
    return sheet([draw_shard(False), draw_shard(True)], f"{OUT}/sprites/shard.png", None, "shard")


# ============================================================== TILES =====
T = 16


def gen_tiles():
    g1 = [["." for _ in range(T)] for _ in range(T)]
    for y in range(T):
        for x in range(T):
            if y == 0:
                g1[y][x] = "C" if (x % 4 == 0) else "K"
            elif y == 1:
                g1[y][x] = "d"
            else:
                g1[y][x] = "g" if (x + y) % 5 else "d"
    tile_top = render(g1)

    g2 = [["." for _ in range(T)] for _ in range(T)]
    for y in range(T):
        for x in range(T):
            if y == 0:
                g2[y][x] = "M" if (x % 4 == 2) else "K"
            elif y == 1:
                g2[y][x] = "d"
            else:
                g2[y][x] = "d" if (x + y) % 6 else "S"
    tile_alt = render(g2)

    sheet([tile_top, tile_alt], f"{OUT}/sprites/tiles.png", None, "tiles")


# ========================================================= BACKGROUNDS ====
def gen_background(name, w, h, near_color, win_color, count_buildings):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = 0
    while x < w:
        bw = random.randint(30, 70)
        bh = random.randint(int(h * 0.35), int(h * 0.9))
        top = h - bh
        d.rectangle([x, top, x + bw, h], fill=near_color)
        # windows
        for wy in range(top + 6, h - 6, 10):
            for wx in range(x + 4, x + bw - 4, 8):
                if random.random() < 0.55:
                    d.rectangle([wx, wy, wx + 3, wy + 5], fill=win_color)
        # occasional antenna / neon sign
        if random.random() < 0.4:
            d.line([x + bw // 2, top, x + bw // 2, top - 10], fill=near_color, width=2)
        x += bw + random.randint(2, 10)
    img.save(f"{OUT}/sprites/{name}.png")


def gen_rain(w, h):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for _ in range(140):
        x = random.randint(0, w)
        y = random.randint(0, h)
        ln = random.randint(6, 14)
        d.line([x, y, x - 3, y + ln], fill=(150, 220, 255, 90), width=1)
    img.save(f"{OUT}/sprites/rain.png")


def main():
    os.makedirs(f"{OUT}/sprites", exist_ok=True)
    meta = {}
    meta["player"] = gen_player()
    meta["enemy_drone"] = gen_enemy()
    meta["shard"] = gen_collectible()
    gen_tiles()
    gen_background("bg_far", 480, 200, (18, 14, 36, 255), (90, 60, 160, 200), 8)
    gen_background("bg_mid", 480, 220, (30, 22, 58, 255), (255, 210, 90, 230), 10)
    gen_rain(480, 270)
    with open(f"{OUT}/sprites/manifest.json", "w") as f:
        json.dump(meta, f, indent=2)
    print("Sprite generation complete ->", OUT + "/sprites")


if __name__ == "__main__":
    main()
