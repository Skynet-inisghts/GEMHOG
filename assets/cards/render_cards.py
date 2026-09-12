"""Gemhog share cards, v2.

Same pig as the site (front view, big snout), three moods by score band:
    1–35   red     eyes squeezed, wavy mouth, tongue, lump of coal in the mouth, stink, sweat
    36–70  yellow  half-lidded eyes, one brow up, flat mouth, grey pebble in the mouth
    71–100 green   bright eyes, brows up, blush, diamond in the mouth, sparkles

Layout (1080x1080):
    top-left      token logo (circle) + $TICKER
    top-right     score, /100, grade
    bar           0–100 with three zones and a marker
    three lines   description, mono
    bottom        the pig, centred, on a dirt mound that runs off the bottom edge
    corners       GEMHOG Terminal (left) · gemhog.xyz + date (right)

Usage:
    python render_cards.py
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


# ------------------------------------------------------------------ the pig
# The site mascot's exact form: head-on, back rising behind the head, hooves either side,
# dirt mound in front. Proportions untouched. What changes: the face, what the hooves do,
# what is in the hole, and the air around it.
FW, FH = 104, 92
OX, OY = 20, 8


def draw_pig(mood: str) -> Image.Image:
    p = PALETTES[mood]
    L1, L2, L3, L4, K = p["L1"], p["L2"], p["L3"], p["L4"], p["K"]
    im = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    def X(x): return x + OX
    def Y(y): return y + OY

    # --- air: sparkles (green), a fly + falling dirt (red)
    if mood == "green":
        for (x, y) in [(2, 20), (62, 16), (-2, 40), (66, 38)]:
            d.line([(X(x), Y(y - 3)), (X(x), Y(y + 3))], fill=WHITE)
            d.line([(X(x - 3), Y(y)), (X(x + 3), Y(y))], fill=WHITE)
        d.point([(X(6), Y(30)), (X(58), Y(28)), (X(2), Y(52)), (X(62), Y(50))], fill=DIA)
    if mood == "red":
        for (x, y, r) in [(4, 26, 2), (60, 22, 2), (0, 36, 1), (64, 34, 1)]:
            d.ellipse([X(x) - r, Y(y) - r, X(x) + r, Y(y) + r], fill=L4)
            d.point((X(x) - r + 1, Y(y) - r + 1), fill=L3)
        d.rectangle([X(60), Y(6), X(61), Y(7)], fill=K)                                 # the fly
        d.point([(X(59), Y(5)), (X(62), Y(5))], fill=(140, 140, 140))
        d.arc([X(54), Y(2), X(68), Y(12)], 200, 340, fill=L4, width=1)

    # --- tail curl over the back
    d.line([(X(46), Y(10)), (X(50), Y(6))], fill=L2, width=3)
    d.ellipse([X(48), Y(0), X(58), Y(10)], fill=L2)
    d.ellipse([X(51), Y(3), X(55), Y(7)], fill=L3)
    d.point((X(52), Y(4)), fill=L4)

    # --- body: the back, rising behind the head
    d.ellipse([X(12), Y(4), X(52), Y(44)], fill=L4)
    d.ellipse([X(13), Y(4), X(51), Y(42)], fill=L2)
    d.ellipse([X(18), Y(8), X(46), Y(22)], fill=L1)
    for (x, y, r) in [(20, 16, 2), (44, 14, 2), (32, 10, 1)]:
        d.ellipse([X(x) - r, Y(y) - r, X(x) + r, Y(y) + r], fill=L3)

    # --- ears: up, or down for red
    if mood == "red":
        L, R = [(11, 27), (4, 12), (26, 17)], [(53, 27), (60, 12), (38, 17)]
    else:
        L, R = [(10, 26), (5, 5), (26, 16)], [(54, 26), (59, 5), (38, 16)]
    for pts in (L, R):
        sgn = 1 if pts is L else -1
        d.polygon([(X(x), Y(y)) for x, y in pts], fill=L4)
        inner = [(pts[0][0] + sgn, pts[0][1] - 1), (pts[1][0] + 2 * sgn, pts[1][1] + 2), (pts[2][0] - 2 * sgn, pts[2][1])]
        d.polygon([(X(x), Y(y)) for x, y in inner], fill=L2)
        mid = [(pts[0][0] + 3 * sgn, pts[0][1] - 4), (pts[1][0] + 5 * sgn, pts[1][1] + 6), (pts[2][0] - 6 * sgn, pts[2][1] + 1)]
        d.polygon([(X(x), Y(y)) for x, y in mid], fill=L3)

    # --- head
    d.ellipse([X(6), Y(16), X(58), Y(62)], fill=L4)
    d.ellipse([X(7), Y(16), X(57), Y(60)], fill=L2)
    d.chord([X(7), Y(16), X(57), Y(60)], 20, 160, fill=L3)
    d.ellipse([X(9), Y(18), X(55), Y(54)], fill=L2)
    d.ellipse([X(14), Y(20), X(44), Y(36)], fill=L1)

    # --- eyes and brows
    if mood == "green":
        d.ellipse([X(16), Y(28), X(26), Y(39)], fill=K)
        d.ellipse([X(38), Y(28), X(48), Y(39)], fill=K)
        d.rectangle([X(18), Y(30), X(20), Y(32)], fill=WHITE)
        d.rectangle([X(40), Y(30), X(42), Y(32)], fill=WHITE)
        d.point([(X(24), Y(36)), (X(46), Y(36))], fill=WHITE)
        d.arc([X(14), Y(22), X(28), Y(29)], 200, 340, fill=L4, width=1)
        d.arc([X(36), Y(22), X(50), Y(29)], 200, 340, fill=L4, width=1)
        d.ellipse([X(11), Y(40), X(15), Y(43)], fill=L3)
        d.ellipse([X(49), Y(40), X(53), Y(43)], fill=L3)
    elif mood == "yellow":
        d.ellipse([X(17), Y(29), X(25), Y(38)], fill=K)
        d.ellipse([X(39), Y(29), X(47), Y(38)], fill=K)
        d.rectangle([X(19), Y(31), X(20), Y(32)], fill=WHITE)
        d.rectangle([X(41), Y(31), X(42), Y(32)], fill=WHITE)
        d.line([(X(16), Y(27)), (X(24), Y(28))], fill=L4, width=2)
        d.line([(X(48), Y(24)), (X(40), Y(28))], fill=L4, width=2)                     # one brow up
    else:
        d.ellipse([X(17), Y(29), X(25), Y(38)], fill=K)
        d.ellipse([X(39), Y(29), X(47), Y(38)], fill=K)
        d.chord([X(17), Y(28), X(25), Y(38)], 180, 360, fill=L2)                       # heavy lids
        d.chord([X(39), Y(28), X(47), Y(38)], 180, 360, fill=L2)
        d.line([(X(17), Y(33)), (X(25), Y(33))], fill=L4)
        d.line([(X(39), Y(33)), (X(47), Y(33))], fill=L4)
        d.rectangle([X(19), Y(34), X(20), Y(35)], fill=WHITE)
        d.rectangle([X(41), Y(34), X(42), Y(35)], fill=WHITE)
        d.line([(X(15), Y(26)), (X(25), Y(29))], fill=L4, width=2)
        d.line([(X(49), Y(26)), (X(39), Y(29))], fill=L4, width=2)
        d.polygon([(X(52), Y(18)), (X(55), Y(26)), (X(49), Y(26))], fill=DIA)         # sweat
        d.point((X(52), Y(22)), fill=WHITE)
        d.point([(X(12), Y(44)), (X(52), Y(46)), (X(10), Y(50))], fill=L4)             # mud on the cheeks

    # --- snout
    d.ellipse([X(16), Y(38), X(48), Y(60)], fill=L4)
    d.ellipse([X(17), Y(38), X(47), Y(59)], fill=L3)
    d.ellipse([X(20), Y(40), X(44), Y(48)], fill=L2)
    d.rectangle([X(24), Y(47), X(28), Y(53)], fill=K)
    d.rectangle([X(36), Y(47), X(40), Y(53)], fill=K)
    d.point([(X(25), Y(48)), (X(37), Y(48))], fill=L4)
    d.line([(X(20), Y(56)), (X(44), Y(56))], fill=L4)
    if mood == "green":
        d.arc([X(23), Y(54), X(41), Y(64)], 15, 165, fill=K, width=2)                 # smile
        d.rectangle([X(28), Y(60), X(36), Y(61)], fill=WHITE)
    elif mood == "yellow":
        d.line([(X(27), Y(61)), (X(37), Y(61))], fill=K)
    else:
        d.arc([X(24), Y(60), X(40), Y(68)], 200, 340, fill=K, width=1)                # frown
        d.point([(X(18), Y(56)), (X(45), Y(57)), (X(22), Y(58))], fill=K)             # mud on the snout

    def ground():
        # --- ground: mound off the bottom edge, the hole, what is in it
        d.chord([X(-4), Y(64), X(68), Y(120)], 180, 360, fill=L4)
        d.chord([X(-1), Y(66), X(65), Y(118)], 180, 360, fill=L3)
        d.rectangle([X(2), Y(78), X(62), FH], fill=L3)
        if mood == "green":
            d.ellipse([X(18), Y(72), X(46), Y(80)], fill=K)                                # the empty hole it came from
            d.ellipse([X(20), Y(73), X(44), Y(78)], fill=L4)
            for (x, y) in [(6, 76), (56, 78)]:                                             # a couple more stones showing
                d.polygon([(X(x + 1), Y(y)), (X(x + 4), Y(y)), (X(x + 5), Y(y + 2)), (X(x + 2), Y(y + 5)), (X(x), Y(y + 2))], fill=DIA)
                d.point((X(x + 2), Y(y + 1)), fill=WHITE)
        elif mood == "yellow":
            d.ellipse([X(18), Y(72), X(46), Y(80)], fill=K)
            d.ellipse([X(20), Y(73), X(44), Y(78)], fill=L4)
            d.ellipse([X(8), Y(80), X(14), Y(83)], fill=(150, 150, 150))
        else:
            d.ellipse([X(18), Y(72), X(46), Y(82)], fill=K)
            gx, gy = 32, 76
            d.polygon([(X(gx - 7), Y(gy - 1)), (X(gx - 3), Y(gy - 5)), (X(gx + 5), Y(gy - 4)), (X(gx + 8), Y(gy + 2)), (X(gx + 4), Y(gy + 6)), (X(gx - 6), Y(gy + 5))], fill=(30, 24, 26))   # a lump of coal
            d.line([(X(gx - 4), Y(gy - 3)), (X(gx), Y(gy - 4))], fill=(92, 78, 82))
            for (x, y) in [(28, 62), (32, 58), (36, 62)]:                                  # its stink
                d.line([(X(x), Y(y + 8)), (X(x + 1), Y(y + 5)), (X(x), Y(y + 2))], fill=L4)
            for (x, y) in [(6, 82), (56, 84)]:
                d.ellipse([X(x), Y(y), X(x + 4), Y(y + 3)], fill=(30, 24, 26))

    # --- hooves
    def hoof_at(x0, y0, raised=False):
        d.ellipse([X(x0), Y(y0), X(x0 + 11), Y(y0 + 10)], fill=L4)
        d.rectangle([X(x0), Y(y0 + 5), X(x0 + 11), Y(y0 + 14)], fill=L4)
        d.ellipse([X(x0 + 1), Y(y0), X(x0 + 10), Y(y0 + 9)], fill=L2)
        d.rectangle([X(x0 + 1), Y(y0 + 4), X(x0 + 10), Y(y0 + 12)], fill=L2)
        d.rectangle([X(x0 + 2), Y(y0 + 2), X(x0 + 4), Y(y0 + 6)], fill=L1)
        d.line([(X(x0 + 6), Y(y0 + 10)), (X(x0 + 6), Y(y0 + 12))], fill=K)

    if mood == "green":
        ground()
        # both hooves up, presenting the stone right under the snout
        hoof_at(14, 56)
        hoof_at(39, 56)
        gx, gy = 32, 64
        d.polygon([(X(gx - 7), Y(gy - 5)), (X(gx + 7), Y(gy - 5)), (X(gx + 11), Y(gy)), (X(gx), Y(gy + 11)), (X(gx - 11), Y(gy))], fill=DIA)
        d.line([(X(gx - 11), Y(gy)), (X(gx + 11), Y(gy))], fill=DIA2)
        d.line([(X(gx - 4), Y(gy)), (X(gx), Y(gy + 11))], fill=DIA2)
        d.line([(X(gx + 4), Y(gy)), (X(gx), Y(gy + 11))], fill=DIA2)
        d.line([(X(gx - 7), Y(gy - 5)), (X(gx - 4), Y(gy))], fill=DIA2)
        d.line([(X(gx + 7), Y(gy - 5)), (X(gx + 4), Y(gy))], fill=DIA2)
        d.rectangle([X(gx - 6), Y(gy - 4), X(gx - 4), Y(gy - 4)], fill=WHITE)
        d.point((X(gx - 2), Y(gy + 3)), fill=WHITE)
    elif mood == "yellow":
        hoof_at(3, 48)
        hoof_at(44, 52)                                                                # right one lifted a little, with the pebble
        d.ellipse([X(46), Y(45), X(56), Y(52)], fill=(150, 150, 150))
        d.ellipse([X(48), Y(46), X(52), Y(49)], fill=(190, 190, 190))
    else:
        hoof_at(3, 50)
        hoof_at(49, 50)

    if mood != "green":
        ground()
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

    # coloured pool behind the pig
    pool = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(pool).ellipse([W * 0.15, H * 0.5, W * 0.85, H * 1.3], fill=p["GLOW"] + (52,))
    im.alpha_composite(pool.filter(ImageFilter.GaussianBlur(130)))

    d = ImageDraw.Draw(im)
    M = 72
    LOGO = 128

    # ---- header
    if logo is not None:
        lg = logo.convert("RGBA").resize((LOGO, LOGO))
        mask = Image.new("L", (LOGO, LOGO), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, LOGO - 1, LOGO - 1], fill=255)
        im.paste(lg, (M, M), mask)
    else:
        d.ellipse([M, M, M + LOGO, M + LOGO], fill=(26, 26, 26))
        d.text((M + LOGO // 2, M + LOGO // 2), ticker[:1].upper(), font=font("Tiny5-Regular.ttf", 72), fill=(120, 120, 120), anchor="mm")
    d.ellipse([M - 4, M - 4, M + LOGO + 4, M + LOGO + 4], outline=ACC, width=4)

    score_font = font("Unbounded[wght].ttf", 150, "Black")
    sw = d.textlength(str(score), font=score_font)
    slash_font = font("JetBrainsMono[wght].ttf", 34, "Regular")
    right_edge = W - M - sw - 16 - d.textlength("/100", font=slash_font) - 40

    dollar = font("JetBrainsMono[wght].ttf", 84, "Bold")
    tx = M + LOGO + 36
    d.text((tx, M + LOGO // 2), "$", font=dollar, fill=ACC, anchor="lm")
    tx += d.textlength("$", font=dollar) + 6
    size_ = 112
    while size_ > 48 and tx + d.textlength(ticker.upper(), font=font("Tiny5-Regular.ttf", size_)) > right_edge:
        size_ -= 8
    d.text((tx, M + LOGO // 2), ticker.upper(), font=font("Tiny5-Regular.ttf", size_), fill=WHITE, anchor="lm")

    d.text((W - M, M + LOGO // 2), str(score), font=score_font, fill=ACC, anchor="rm")
    d.text((W - M - sw - 16, M + LOGO // 2 + 36), "/100", font=slash_font, fill=(120, 120, 120), anchor="rm")
    d.text((W - M, M + LOGO + 40), grade, font=font("Tiny5-Regular.ttf", 56), fill=ACC, anchor="rm")

    # ---- score bar
    by = M + LOGO + 118
    bx0, bx1 = M, W - M
    bw = bx1 - bx0
    for lo, hi, col in [(0, 35, PALETTES["red"]["L4"]), (35, 70, PALETTES["yellow"]["L4"]), (70, 100, PALETTES["green"]["L4"])]:
        d.rectangle([bx0 + bw * lo / 100, by, bx0 + bw * hi / 100 - 4, by + 14], fill=col)
    mx = bx0 + bw * max(0, min(100, score)) / 100
    d.rectangle([mx - 6, by - 10, mx + 6, by + 24], fill=ACC)
    d.rectangle([mx - 2, by - 10, mx + 2, by + 24], fill=WHITE)
    lab = font("JetBrainsMono[wght].ttf", 22, "Regular")
    for v, anc in ((0, "la"), (35, "ma"), (70, "ma"), (100, "ra")):
        d.text((bx0 + bw * v / 100, by + 32), str(v if v else 1), font=lab, fill=(90, 90, 90), anchor=anc)

    # ---- description
    body = font("JetBrainsMono[wght].ttf", 30, "Regular")
    ty = by + 96
    for line in lines[:3]:
        d.text((M, ty), line, font=body, fill=(200, 200, 200))
        ty += 44

    # ---- the pig, centred, mound flush with the bottom edge
    sp = up(draw_pig(mood), 6)                        # 624 x 552, mound flush with the bottom edge
    px_ = W - M - sp.width + 40
    py_ = H - sp.height + 24
    g, pad = glow(sp, 60, 0.42, p["GLOW"])
    im.alpha_composite(g, (px_ - pad, py_ - pad))
    im.alpha_composite(sp, (px_, py_))

    # ---- corners
    d = ImageDraw.Draw(im)
    d.text((M, H - M - 74), "GEMHOG", font=font("Tiny5-Regular.ttf", 56), fill=ACC, anchor="lm")
    d.text((M, H - M - 34), "Terminal", font=font("JetBrainsMono[wght].ttf", 30, "Regular"), fill=(140, 140, 140), anchor="lm")
    small = font("JetBrainsMono[wght].ttf", 22, "Regular")
    d.text((M, H - M - 2), "gemhog.xyz", font=small, fill=(140, 140, 140), anchor="lm")
    if observed:
        d.text((M, H - M + 26), observed, font=small, fill=(90, 90, 90), anchor="lm")

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
        card(**kw, observed="2026-09-11 21:22 UTC").save(OUT / f"card-{mood}.png")
        up(draw_pig(mood), 8).save(OUT / f"pig-{mood}.png")
    print("ok")
