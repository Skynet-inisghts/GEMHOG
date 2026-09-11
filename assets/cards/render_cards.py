"""Gemhog share cards.

Three cards by score band:
    1–35   red     pig has eaten something bad. lump of coal.
    36–70  yellow  pig is unimpressed. dull pebble.
    71–100 green   pig is thrilled. big diamond, sparkles.

Layout (1080x1080, black):
    top-left    token logo (circle) + $TICKER, big
    top-right   score, big, with /100 and the grade below
    under       score bar 0–100 with the three zones and a marker
    then        2–3 lines of description, mono
    bottom      the pig, large, with a coloured glow
    footer      GEMHOG Terminal signature + site

Usage:
    python render_cards.py                       # three template cards + three pig sprites
    from render_cards import card; card(score=48, ticker="DRN", grade="SI2", lines=[...], logo=Image)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
FONTS = ROOT / "fonts"
OUT = ROOT / "cards"
OUT.mkdir(exist_ok=True)

WHITE = (255, 255, 255)
DIA = (236, 250, 255)
DIA2 = (120, 200, 240)

PALETTES = {
    "red":    dict(L1=(255, 178, 170), L2=(255, 96, 92),  L3=(206, 48, 60),  L4=(112, 18, 36),  K=(24, 4, 8),   TEXT=(255, 96, 92),  GLOW=(255, 60, 60)),
    "yellow": dict(L1=(255, 240, 176), L2=(255, 214, 64), L3=(214, 158, 28), L4=(118, 80, 8),   K=(24, 16, 2),  TEXT=(255, 214, 64), GLOW=(255, 200, 40)),
    "green":  dict(L1=(206, 255, 196), L2=(96, 240, 128), L3=(40, 178, 92),  L4=(14, 88, 46),   K=(4, 22, 10),  TEXT=(96, 240, 128), GLOW=(60, 230, 110)),
}
BANDS = [(1, 35, "red"), (36, 70, "yellow"), (71, 100, "green")]


def band(score: int) -> str:
    for lo, hi, name in BANDS:
        if lo <= score <= hi:
            return name
    return "red" if score < 1 else "green"


def font(name, size, var=None):
    f = ImageFont.truetype(str(FONTS / name), size)
    if var:
        f.set_variation_by_name(var)
    return f


# ------------------------------------------------------------------ the pig, three moods
def draw_pig(mood: str) -> Image.Image:
    p = PALETTES[mood]
    L1, L2, L3, L4, K = p["L1"], p["L2"], p["L3"], p["L4"], p["K"]
    S = 72
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # ground
    d.ellipse([2, 58, 70, 72], fill=L4)
    d.ellipse([6, 60, 66, 70], fill=L3)
    if mood == "green":
        for (x, y) in [(6, 58), (57, 61)]:
            d.polygon([(x + 1, y), (x + 4, y), (x + 5, y + 2), (x + 2, y + 5), (x, y + 2)], fill=DIA)
            d.point((x + 2, y + 1), fill=WHITE)
    if mood == "red":
        for (x, y) in [(8, 60), (60, 62), (30, 66)]:           # lumps of coal on the ground
            d.ellipse([x, y, x + 4, y + 3], fill=K)

    # haunches
    d.ellipse([8, 42, 30, 62], fill=L4)
    d.ellipse([9, 41, 29, 60], fill=L2)
    d.ellipse([44, 44, 66, 62], fill=L4)
    d.ellipse([44, 43, 64, 60], fill=L2)

    # body + belly
    d.ellipse([12, 26, 62, 64], fill=L4)
    d.ellipse([11, 24, 59, 61], fill=L2)
    d.ellipse([20, 36, 48, 60], fill=L1)

    # tail
    for (x, y) in [(60, 40), (61, 39), (62, 39), (63, 40), (63, 41), (62, 42), (61, 42)]:
        d.point((x, y), fill=L2)

    # left hoof on the ground
    d.rectangle([18, 54, 26, 64], fill=L4)
    d.rectangle([18, 53, 25, 62], fill=L2)
    d.rectangle([18, 61, 25, 62], fill=L4)
    d.line([(21, 63), (22, 63)], fill=K)

    # ears: up when happy, level when meh, drooping when disgusted
    if mood == "red":
        d.polygon([(8, 18), (2, 12), (20, 12)], fill=L4)
        d.polygon([(9, 17), (4, 13), (19, 13)], fill=L2)
        d.polygon([(10, 15), (7, 14), (15, 14)], fill=L3)
        d.polygon([(26, 11), (42, 8), (38, 17)], fill=L4)
        d.polygon([(27, 12), (40, 9), (37, 16)], fill=L2)
    elif mood == "yellow":
        d.polygon([(8, 16), (4, 6), (20, 11)], fill=L4)
        d.polygon([(9, 15), (6, 8), (19, 12)], fill=L2)
        d.polygon([(10, 13), (8, 10), (15, 12)], fill=L3)
        d.polygon([(26, 10), (38, 4), (38, 15)], fill=L4)
        d.polygon([(27, 11), (36, 6), (37, 14)], fill=L2)
    else:
        d.polygon([(8, 16), (5, 0), (20, 10)], fill=L4)
        d.polygon([(9, 15), (7, 2), (19, 11)], fill=L2)
        d.polygon([(10, 13), (9, 5), (15, 11)], fill=L3)
        d.polygon([(26, 9), (37, -2), (38, 15)], fill=L4)
        d.polygon([(27, 10), (36, 0), (37, 14)], fill=L2)
        d.polygon([(29, 10), (34, 3), (34, 12)], fill=L3)

    # head
    d.ellipse([4, 6, 42, 42], fill=L4)
    d.ellipse([3, 5, 40, 40], fill=L2)
    d.ellipse([8, 8, 30, 26], fill=L1)
    for (x, y, r) in [(34, 30, 3), (37, 22, 2), (30, 36, 2), (50, 30, 3), (54, 38, 2), (46, 26, 2), (56, 52, 2), (14, 46, 2)]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=L3)
        d.point((x - r + 1, y - r + 1), fill=L4)

    # face by mood
    if mood == "green":
        # wide open eyes with two highlights, brows up, big smile, blush
        d.ellipse([11, 16, 19, 25], fill=K)
        d.rectangle([12, 17, 14, 19], fill=WHITE)
        d.point((17, 22), fill=WHITE)
        d.ellipse([26, 16, 34, 25], fill=K)
        d.rectangle([27, 17, 29, 19], fill=WHITE)
        d.point((32, 22), fill=WHITE)
        d.arc([10, 11, 20, 17], 200, 340, fill=L4, width=1)
        d.arc([25, 11, 35, 17], 200, 340, fill=L4, width=1)
        d.ellipse([9, 30, 12, 32], fill=L3)          # blush
        d.ellipse([31, 30, 34, 32], fill=L3)
    elif mood == "yellow":
        # half-lidded eyes, one brow raised, flat mouth
        d.ellipse([12, 18, 18, 25], fill=K)
        d.rectangle([12, 18, 18, 20], fill=L2)       # lid
        d.rectangle([12, 20, 18, 20], fill=L4)
        d.rectangle([13, 21, 14, 22], fill=WHITE)
        d.ellipse([27, 18, 33, 25], fill=K)
        d.rectangle([27, 18, 33, 20], fill=L2)
        d.rectangle([27, 20, 33, 20], fill=L4)
        d.rectangle([28, 21, 29, 22], fill=WHITE)
        d.line([(12, 16), (18, 16)], fill=L4)        # flat brow
        d.line([(26, 14), (33, 16)], fill=L4)        # raised brow
    else:
        # eyes squeezed shut, brows knotted, wavy mouth, tongue out, sweat
        d.line([(11, 22), (18, 20)], fill=K, width=2)
        d.line([(11, 22), (18, 24)], fill=K, width=2)
        d.line([(34, 22), (27, 20)], fill=K, width=2)
        d.line([(34, 22), (27, 24)], fill=K, width=2)
        d.line([(10, 16), (18, 18)], fill=L4, width=2)
        d.line([(35, 16), (27, 18)], fill=L4, width=2)
        d.polygon([(38, 12), (40, 18), (36, 18)], fill=DIA)   # sweat drop
        d.point((38, 15), fill=WHITE)

    # snout
    d.ellipse([6, 24, 28, 38], fill=L4)
    d.ellipse([7, 24, 27, 37], fill=L3)
    d.ellipse([9, 25, 22, 32], fill=L2)
    d.rectangle([11, 29, 13, 32], fill=K)
    d.rectangle([19, 29, 21, 32], fill=K)
    if mood == "green":
        d.arc([10, 32, 26, 42], 15, 165, fill=K, width=2)     # big smile
        d.rectangle([14, 38, 22, 39], fill=WHITE)             # teeth glint
    elif mood == "yellow":
        d.line([(13, 37), (23, 37)], fill=K, width=1)         # flat
    else:
        d.line([(11, 36), (14, 38), (17, 36), (20, 38), (23, 36), (26, 38)], fill=K, width=1)   # wavy
        d.rectangle([16, 39, 20, 42], fill=(230, 90, 120))    # tongue
        d.point((18, 40), fill=(250, 150, 170))
    d.point([(8, 35), (24, 36), (26, 33), (10, 37)], fill=K)

    # raised hoof + item
    d.rectangle([48, 30, 56, 44], fill=L4)
    d.rectangle([48, 29, 55, 42], fill=L2)
    d.line([(52, 29), (52, 42)], fill=L3)
    d.rectangle([48, 41, 55, 42], fill=L4)
    dx, dy = 57, 22
    if mood == "green":
        d.polygon([(dx - 6, dy - 5), (dx + 6, dy - 5), (dx + 9, dy - 1), (dx, dy + 9), (dx - 9, dy - 1)], fill=DIA)
        d.line([(dx - 9, dy - 1), (dx + 9, dy - 1)], fill=DIA2)
        d.line([(dx - 6, dy - 5), (dx - 3, dy - 1)], fill=DIA2)
        d.line([(dx + 6, dy - 5), (dx + 3, dy - 1)], fill=DIA2)
        d.line([(dx - 3, dy - 1), (dx, dy + 9)], fill=DIA2)
        d.line([(dx + 3, dy - 1), (dx, dy + 9)], fill=DIA2)
        d.rectangle([dx - 5, dy - 4, dx - 3, dy - 4], fill=WHITE)
        d.line([(68, 8), (68, 14)], fill=WHITE)
        d.line([(65, 11), (71, 11)], fill=WHITE)
        d.point([(46, 12), (48, 12), (47, 11), (47, 13)], fill=WHITE)
        d.point([(64, 28), (66, 28), (65, 27), (65, 29)], fill=WHITE)
    elif mood == "yellow":
        d.ellipse([dx - 6, dy - 3, dx + 6, dy + 6], fill=(150, 150, 150))   # dull grey pebble
        d.ellipse([dx - 4, dy - 2, dx + 1, dy + 1], fill=(190, 190, 190))
        d.point((dx + 3, dy + 4), fill=(110, 110, 110))
    else:
        d.polygon([(dx - 6, dy - 2), (dx - 2, dy - 6), (dx + 5, dy - 5), (dx + 8, dy + 1), (dx + 4, dy + 7), (dx - 5, dy + 6)], fill=K)   # lump of coal
        d.point([(dx - 2, dy - 1), (dx + 2, dy + 2)], fill=(70, 60, 60))
        for (x, y) in [(52, 14), (58, 10), (63, 14)]:          # stink lines
            d.line([(x, y), (x + 1, y - 3), (x, y - 6)], fill=L4)

    return outline(im, K)


def outline(im, K):
    a = im.split()[3]
    grown = a.filter(ImageFilter.MaxFilter(3))
    edge = Image.eval(grown, lambda v: 255 if v > 0 else 0)
    ring = Image.new("RGBA", im.size, K + (255,))
    ring.putalpha(edge)
    return Image.alpha_composite(ring, im)


def up(im, px):
    return im.resize((im.width * px, im.height * px), Image.NEAREST)


def glow(sp, radius, alpha, color):
    pad = radius * 3
    a = Image.new("L", (sp.width + 2 * pad, sp.height + 2 * pad), 0)
    a.paste(sp.split()[3], (pad, pad))
    a = a.filter(ImageFilter.GaussianBlur(radius))
    layer = Image.new("RGBA", a.size, color + (0,))
    layer.putalpha(a.point(lambda v: int(v * alpha)))
    return layer, pad


# ------------------------------------------------------------------ the card
def card(score: int, ticker: str, grade: str, lines: list[str], logo: Image.Image | None = None,
         observed: str = "", size: int = 1080) -> Image.Image:
    mood = band(score)
    p = PALETTES[mood]
    ACC = p["TEXT"]
    W = H = size
    im = Image.new("RGBA", (W, H), (0, 0, 0, 255))

    # faint coloured pool behind the pig
    pool = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(pool).ellipse([W * 0.1, H * 0.55, W * 0.9, H * 1.25], fill=p["GLOW"] + (46,))
    im.alpha_composite(pool.filter(ImageFilter.GaussianBlur(120)))

    d = ImageDraw.Draw(im)
    M = 72                                            # margin

    # ---- header: logo + ticker (left), score (right)
    LOGO = 128
    if logo is not None:
        lg = logo.convert("RGBA").resize((LOGO, LOGO))
        mask = Image.new("L", (LOGO, LOGO), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, LOGO - 1, LOGO - 1], fill=255)
        im.paste(lg, (M, M), mask)
    else:
        d.ellipse([M, M, M + LOGO, M + LOGO], fill=(28, 28, 28), outline=(70, 70, 70), width=3)
        d.text((M + LOGO // 2, M + LOGO // 2), ticker[:1].upper(), font=font("Tiny5-Regular.ttf", 72), fill=(120, 120, 120), anchor="mm")
    d.ellipse([M - 4, M - 4, M + LOGO + 4, M + LOGO + 4], outline=ACC, width=4)

    score_font = font("Unbounded[wght].ttf", 150, "Black")
    sw = d.textlength(str(score), font=score_font)
    slash_font = font("JetBrainsMono[wght].ttf", 34, "Regular")
    right_edge = W - M - sw - 16 - d.textlength("/100", font=slash_font) - 40   # ticker may not cross this

    dollar = font("JetBrainsMono[wght].ttf", 84, "Bold")
    tx = M + LOGO + 36
    d.text((tx, M + LOGO // 2), "$", font=dollar, fill=ACC, anchor="lm")
    tx += d.textlength("$", font=dollar) + 6
    size = 112                                        # shrink long tickers in whole Tiny5 cells
    while size > 48 and tx + d.textlength(ticker.upper(), font=font("Tiny5-Regular.ttf", size)) > right_edge:
        size -= 8
    d.text((tx, M + LOGO // 2), ticker.upper(), font=font("Tiny5-Regular.ttf", size), fill=WHITE, anchor="lm")
    d.text((W - M, M + LOGO // 2), str(score), font=score_font, fill=ACC, anchor="rm")
    d.text((W - M - sw - 16, M + LOGO // 2 + 36), "/100", font=slash_font, fill=(120, 120, 120), anchor="rm")
    d.text((W - M, M + LOGO + 40), grade, font=font("Tiny5-Regular.ttf", 56), fill=ACC, anchor="rm")

    # ---- score bar with three zones
    by = M + LOGO + 118
    bx0, bx1 = M, W - M
    bw = bx1 - bx0
    zones = [(0, 35, PALETTES["red"]["L4"]), (35, 70, PALETTES["yellow"]["L4"]), (70, 100, PALETTES["green"]["L4"])]
    for lo, hi, col in zones:
        d.rectangle([bx0 + bw * lo / 100, by, bx0 + bw * hi / 100 - 4, by + 14], fill=col)
    mx = bx0 + bw * max(0, min(100, score)) / 100
    d.rectangle([mx - 6, by - 10, mx + 6, by + 24], fill=ACC)
    d.rectangle([mx - 2, by - 10, mx + 2, by + 24], fill=WHITE)
    lab = font("JetBrainsMono[wght].ttf", 22, "Regular")
    d.text((bx0, by + 32), "1", font=lab, fill=(90, 90, 90), anchor="la")
    d.text((bx0 + bw * 0.35, by + 32), "35", font=lab, fill=(90, 90, 90), anchor="ma")
    d.text((bx0 + bw * 0.70, by + 32), "70", font=lab, fill=(90, 90, 90), anchor="ma")
    d.text((bx1, by + 32), "100", font=lab, fill=(90, 90, 90), anchor="ra")

    # ---- description
    body = font("JetBrainsMono[wght].ttf", 30, "Regular")
    ty = by + 96
    for line in lines[:3]:
        d.text((M, ty), line, font=body, fill=(200, 200, 200))
        ty += 44

    # ---- the pig
    sp = up(draw_pig(mood), 6)                        # 432 px
    px_ = W - sp.width - 56
    py_ = H - sp.height - 44
    g, pad = glow(sp, 60, 0.4, p["GLOW"])
    im.alpha_composite(g, (px_ - pad, py_ - pad))
    im.alpha_composite(sp, (px_, py_))

    # ---- signature, bottom-left
    d = ImageDraw.Draw(im)
    d.text((M, H - M - 50), "GEMHOG", font=font("Tiny5-Regular.ttf", 56), fill=ACC, anchor="lm")
    tw = d.textlength("GEMHOG", font=font("Tiny5-Regular.ttf", 56))
    d.text((M + tw + 18, H - M - 46), "Terminal", font=font("JetBrainsMono[wght].ttf", 30, "Regular"), fill=(140, 140, 140), anchor="lm")
    d.text((M, H - M - 6), observed or "gemhog.xyz  ·  read-only  ·  not financial advice", font=font("JetBrainsMono[wght].ttf", 22, "Regular"), fill=(90, 90, 90), anchor="lm")

    return im.convert("RGB")


if __name__ == "__main__":
    samples = {
        "red":    dict(score=18, ticker="RUG", grade="I2",
                       lines=["early cohort 61 wallets · 31% still holding at 15m", "dev sold 3 times in the first hour", "top 10 hold 58% · bundle holds 22%"]),
        "yellow": dict(score=48, ticker="DRN", grade="SI2",
                       lines=["early cohort 42 wallets · 74% still holding at 15m", "dev bought 30% and sold twice", "top 10 hold 44.9% · no bundle"]),
        "green":  dict(score=87, ticker="PEANUT", grade="VVS1",
                       lines=["early cohort 142 wallets · 84% still holding at 6h", "dev has not sold · 0 fee claims", "top 10 hold 14.2% · 611 holders"]),
    }
    for mood, kw in samples.items():
        card(**kw, observed=f"graded 2026-09-11 21:22 UTC  ·  gemhog.xyz").save(OUT / f"card-{mood}.png")
        up(draw_pig(mood), 10).save(OUT / f"pig-{mood}.png")
    print("ok")
