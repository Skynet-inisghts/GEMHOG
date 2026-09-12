"""Gemhog hero loop: sniff → dig → find the stone → it sinks back → sniff again.

24 frames, 90 ms each (~2.2 s loop). Native frame 72x80 px, pig drawn with the
same geometry as the site's sniffer sprite, so it can replace the static image.

Outputs (in ./anim):
    gemhog-dig-sheet.png   horizontal spritesheet, 24 x (72x80), native pixels — use with the CSS below
    gemhog-dig.css         keyframes + class, image-rendering: pixelated
    gemhog-dig.apng        24-bit + alpha, x6 (432x480), for a plain <img>
    gemhog-dig.gif         fallback
    frames/frame-NN.png    individual frames, x6
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "anim"
(OUT / "frames").mkdir(parents=True, exist_ok=True)

# pink palette, same as the site
L1 = (255, 214, 236)
L2 = (255, 122, 196)
L3 = (214, 72, 150)
L4 = (122, 30, 84)
K = (24, 6, 18)
DIA = (236, 250, 255)
DIA2 = (120, 200, 240)
WHITE = (255, 255, 255)
# dirt: brown, not pink
D0 = (52, 34, 22)      # deep
D1 = (88, 58, 36)      # body
D2 = (124, 86, 52)     # lit lumps
D3 = (158, 114, 72)    # highlights

FW, FH = 104, 96         # frame size
OX, OY = 16, 14          # pig origin inside the frame
N = 32
MS = 90


# ------------------------------------------------------------------ per-frame parameters
# 0-2 sniff · 3-8 dive: snout goes under the dirt · 9-12 rooting · 13-17 pull up with the
# stone in the mouth · 18-21 hold, sparkle · 22-26 toss it over the shoulder · 27 idle
def params(i: int) -> dict:
    p = dict(dy=0, dx=0, snout_dx=0, ear_twitch=False, hoof_l=0, hoof_r=0,
             dug=0.0, gem_mouth=False, gem_fly=None, sparkle=0, eyes="normal",
             dirt=[], crumbs=False, puff=0.0)
    # clods fly while the head is going in and while it roots (launched 5,7,9,11,13)
    for launch in (5, 7, 9, 11, 13):
        age = i - launch
        if 0 <= age < 7:
            h = [4, 10, 15, 18, 16, 11, 5][age]
            spread = 6 + age * 5
            r = 3 if age < 4 else 2
            p["dirt"] += [(10 - spread, 52 - h, r), (54 + spread, 52 - h, r),
                          (2 - age * 3, 46 - h // 2, 2), (62 + age * 3, 46 - h // 2, 2),
                          (24 - age * 2, 40 - h, 1), (40 + age * 2, 40 - h, 1)]
    if i <= 2:                                          # 0-2 sniff
        p["snout_dx"] = [0, 1, -1][i]
        p["ear_twitch"] = i == 1
        return p
    if 3 <= i <= 8:                                     # 3-8 dive: head goes under
        k = i - 3
        p["dy"] = [6, 12, 20, 28, 34, 34][k]
        p["eyes"] = "squint" if k >= 1 else "normal"
        p["hoof_l"] = -3 if k % 2 == 0 else 0
        p["hoof_r"] = -3 if k % 2 == 1 else 0
        p["dug"] = min(1.0, k / 4)
        p["puff"] = 1.0 if 1 <= k <= 4 else 0.5
        return p
    if 9 <= i <= 13:                                    # 9-13 rooting, ears out of the dirt
        k = i - 9
        p["dy"] = 34
        p["dx"] = [-2, 2, -2, 2, 0][k]
        p["eyes"] = "squint"
        p["hoof_l"] = -3 if k % 2 == 0 else 0
        p["hoof_r"] = -3 if k % 2 == 1 else 0
        p["dug"] = 1.0
        p["puff"] = 0.6
        return p
    if 14 <= i <= 19:                                   # 14-19 pull up with the stone
        k = i - 14
        p["dy"] = [28, 20, 12, 6, 0, -4][k]
        p["gem_mouth"] = True
        p["eyes"] = "squint" if k < 2 else "happy"
        p["dug"] = max(0.0, 1.0 - k / 4)
        p["crumbs"] = k < 4
        p["puff"] = 0.4 if k < 2 else 0.0
        return p
    if 20 <= i <= 23:                                   # 20-23 hold, sparkle
        k = i - 20
        p["dy"] = -4
        p["gem_mouth"] = True
        p["eyes"] = "happy"
        p["sparkle"] = k + 1
        return p
    if 24 <= i <= 28:                                   # 24-28 toss over the shoulder
        k = i - 24
        p["dy"] = [-7, -5, -4, -3, -2][k]
        p["eyes"] = "happy"
        p["gem_fly"] = [(0, -6), (10, -16), (22, -22), (36, -20), (50, -10)][k]
        p["sparkle"] = 1 if k % 2 == 0 else 0
        return p
    p["dy"] = [-1, 0, 0][i - 29]                        # 29-31 settle
    return p


# ------------------------------------------------------------------ drawing
def draw_frame(p: dict) -> Image.Image:
    im = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    dy = p["dy"]
    hx = p["dx"]                                      # head wobble while rooting

    def X(x): return x + OX
    def Y(y): return y + OY

    # --- dirt in the air (behind the pig)
    for (x, y, r) in p["dirt"]:
        d.ellipse([X(x) - r, Y(y) - r, X(x) + r, Y(y) + r], fill=D1)
        d.point((X(x) - r + 1, Y(y) - r + 1), fill=D3)
        d.point((X(x) + r - 1, Y(y) + r - 1), fill=D0)

    # --- speed lines while diving down
    if 3 <= dy <= 30 and not p["gem_mouth"]:
        for x in (14, 32, 50):
            d.line([(X(x), Y(dy - 12)), (X(x), Y(dy - 4))], fill=L3)
            d.point((X(x), Y(dy - 2)), fill=L1)

    # --- tail curl over the back
    d.line([(X(46), Y(10 + dy)), (X(50), Y(6 + dy))], fill=L2, width=3)
    d.ellipse([X(48), Y(0 + dy), X(58), Y(10 + dy)], fill=L2)
    d.ellipse([X(51), Y(3 + dy), X(55), Y(7 + dy)], fill=L3)
    d.point((X(52), Y(4 + dy)), fill=L4)

    # --- body (the back), rises behind the head
    d.ellipse([X(12), Y(4 + dy), X(52), Y(44 + dy)], fill=L4)
    d.ellipse([X(13), Y(4 + dy), X(51), Y(42 + dy)], fill=L2)
    d.ellipse([X(18), Y(8 + dy), X(46), Y(22 + dy)], fill=L1)
    for (x, y, r) in [(20, 16, 2), (44, 14, 2), (32, 10, 1)]:
        d.ellipse([X(x) - r, Y(y + dy) - r, X(x) + r, Y(y + dy) + r], fill=L3)

    # --- ears
    et = 2 if p["ear_twitch"] else 0
    d.polygon([(X(10), Y(26 + dy)), (X(5 - et), Y(5 + dy)), (X(26), Y(16 + dy))], fill=L4)
    d.polygon([(X(11), Y(25 + dy)), (X(7 - et), Y(7 + dy)), (X(24), Y(16 + dy))], fill=L2)
    d.polygon([(X(13), Y(22 + dy)), (X(10 - et), Y(11 + dy)), (X(20), Y(17 + dy))], fill=L3)
    d.polygon([(X(54), Y(26 + dy)), (X(59 + et), Y(5 + dy)), (X(38), Y(16 + dy))], fill=L4)
    d.polygon([(X(53), Y(25 + dy)), (X(57 + et), Y(7 + dy)), (X(40), Y(16 + dy))], fill=L2)
    d.polygon([(X(51), Y(22 + dy)), (X(54 + et), Y(11 + dy)), (X(44), Y(17 + dy))], fill=L3)

    # --- head (wobbles by hx while rooting)
    OXh = OX + hx
    def X(x): return x + OXh
    d.ellipse([X(6), Y(16 + dy), X(58), Y(62 + dy)], fill=L4)
    d.ellipse([X(7), Y(16 + dy), X(57), Y(60 + dy)], fill=L2)
    d.chord([X(7), Y(16 + dy), X(57), Y(60 + dy)], 20, 160, fill=L3)
    d.ellipse([X(9), Y(18 + dy), X(55), Y(54 + dy)], fill=L2)
    d.ellipse([X(14), Y(20 + dy), X(44), Y(36 + dy)], fill=L1)

    # --- eyes
    if p["eyes"] == "squint":
        d.line([(X(17), Y(33 + dy)), (X(25), Y(34 + dy))], fill=K, width=3)
        d.line([(X(47), Y(33 + dy)), (X(39), Y(34 + dy))], fill=K, width=3)
    else:
        d.ellipse([X(17), Y(29 + dy), X(25), Y(38 + dy)], fill=K)
        d.ellipse([X(39), Y(29 + dy), X(47), Y(38 + dy)], fill=K)
        d.rectangle([X(19), Y(31 + dy), X(20), Y(32 + dy)], fill=WHITE)
        d.rectangle([X(41), Y(31 + dy), X(42), Y(32 + dy)], fill=WHITE)
        if p["eyes"] == "happy":
            d.point((X(23), Y(36 + dy)), fill=WHITE)
            d.point((X(45), Y(36 + dy)), fill=WHITE)
    if p["eyes"] == "happy":
        d.arc([X(15), Y(24 + dy), X(27), Y(30 + dy)], 200, 340, fill=L4, width=1)
        d.arc([X(37), Y(24 + dy), X(49), Y(30 + dy)], 200, 340, fill=L4, width=1)
    else:
        d.line([(X(16), Y(27 + dy)), (X(24), Y(29 + dy))], fill=L4, width=2)
        d.line([(X(48), Y(27 + dy)), (X(40), Y(29 + dy))], fill=L4, width=2)

    # --- snout (the sniff is a 1-px wiggle)
    sx = p["snout_dx"]
    d.ellipse([X(16 + sx), Y(38 + dy), X(48 + sx), Y(60 + dy)], fill=L4)
    d.ellipse([X(17 + sx), Y(38 + dy), X(47 + sx), Y(59 + dy)], fill=L3)
    d.ellipse([X(20 + sx), Y(40 + dy), X(44 + sx), Y(48 + dy)], fill=L2)
    d.rectangle([X(24 + sx), Y(47 + dy), X(28 + sx), Y(53 + dy)], fill=K)
    d.rectangle([X(36 + sx), Y(47 + dy), X(40 + sx), Y(53 + dy)], fill=K)
    d.point([(X(25 + sx), Y(48 + dy)), (X(37 + sx), Y(48 + dy))], fill=L4)
    d.point([(X(18 + sx), Y(56 + dy)), (X(45 + sx), Y(57 + dy)), (X(22 + sx), Y(58 + dy)), (X(42 + sx), Y(58 + dy))], fill=K)
    d.line([(X(20 + sx), Y(56 + dy)), (X(44 + sx), Y(56 + dy))], fill=L4)
    if p["eyes"] == "happy" and not p["gem_mouth"]:
        d.arc([X(24), Y(52 + dy), X(40), Y(62 + dy)], 20, 160, fill=K, width=1)

    # --- the stone, clamped in the mouth: drawn over the bottom of the snout
    if p["gem_mouth"]:
        gx, gy = 32, 57 + dy
        d.polygon([(X(gx - 5), Y(gy - 4)), (X(gx + 5), Y(gy - 4)), (X(gx + 8), Y(gy)), (X(gx), Y(gy + 8)), (X(gx - 8), Y(gy))], fill=DIA)
        d.line([(X(gx - 8), Y(gy)), (X(gx + 8), Y(gy))], fill=DIA2)
        d.line([(X(gx - 2), Y(gy)), (X(gx), Y(gy + 8))], fill=DIA2)
        d.line([(X(gx + 2), Y(gy)), (X(gx), Y(gy + 8))], fill=DIA2)
        d.line([(X(gx - 5), Y(gy - 4)), (X(gx - 3), Y(gy))], fill=DIA2)
        d.line([(X(gx + 5), Y(gy - 4)), (X(gx + 3), Y(gy))], fill=DIA2)
        d.rectangle([X(gx - 4), Y(gy - 3), X(gx - 3), Y(gy - 3)], fill=WHITE)
        # lips over the top edge of the stone
        d.line([(X(gx - 6), Y(gy - 4)), (X(gx + 6), Y(gy - 4))], fill=L4)
    if p["crumbs"]:                                    # dirt still on the head, falling off
        d.point([(X(20), Y(44 + dy)), (X(43), Y(46 + dy)), (X(30), Y(41 + dy)), (X(26), Y(64 + dy)), (X(40), Y(66 + dy)), (X(12), Y(20 + dy)), (X(52), Y(18 + dy))], fill=D1)
        d.rectangle([X(36), Y(42 + dy), X(38), Y(43 + dy)], fill=D1)
        d.rectangle([X(22), Y(24 + dy), X(24), Y(25 + dy)], fill=D0)
        d.rectangle([X(46), Y(30 + dy), X(47), Y(31 + dy)], fill=D0)

    def X(x): return x + OX
    # --- hooves, scraping
    for x0, lift in ((3, p["hoof_l"]), (49, p["hoof_r"])):
        yy = 48 + lift
        d.ellipse([X(x0), Y(yy), X(x0 + 11), Y(yy + 10)], fill=L4)
        d.rectangle([X(x0), Y(yy + 5), X(x0 + 11), Y(62)], fill=L4)
        d.ellipse([X(x0 + 1), Y(yy), X(x0 + 10), Y(yy + 9)], fill=L2)
        d.rectangle([X(x0 + 1), Y(yy + 4), X(x0 + 10), Y(60)], fill=L2)
        d.rectangle([X(x0 + 1), Y(58), X(x0 + 10), Y(60)], fill=L4)
        d.line([(X(x0 + 6), Y(58)), (X(x0 + 6), Y(60))], fill=K)
        d.rectangle([X(x0 + 2), Y(yy + 2), X(x0 + 4), Y(yy + 6)], fill=L1)

    # --- ground: a lumpy brown mound in front of the head, running off the bottom edge
    dug = p["dug"]
    cx = 32 + hx
    bw, bh = int(30 * dug), int(10 * dug)
    bumps = [0, 1, -1, 0, 2, 1, -1, 0, 1, 3, 1, 0, -1, 1, 2, 0, -1, 0, 1, 2, 0]      # fixed, so it doesn't flicker
    prof = []
    for k, x in enumerate(range(-8, 76, 2)):
        y = 60 - bumps[(k // 2) % len(bumps)]
        # the side slopes fall away toward the frame edges
        if x < 2:
            y += (2 - x) // 2
        if x > 62:
            y += (x - 62) // 2
        if dug > 0 and abs(x - cx) < bw:                # the heave around the buried head
            t = (x - cx) / bw
            y -= int(bh * (1 - t * t))
        prof.append((X(x), Y(y)))
    poly = prof + [(X(76), FH + 4), (X(-8), FH + 4)]
    d.polygon(poly, fill=D1)
    d.polygon([(px_, py_ + 14) for (px_, py_) in prof] + [(X(76), FH + 4), (X(-8), FH + 4)], fill=D0)   # deeper, darker
    d.line(prof, fill=D2, width=2)                                                    # lit rim
    d.line([(px_, py_ - 1) for (px_, py_) in prof], fill=D3)
    # lumps of soil sitting on the surface
    lumps = [(-2, 63, 3), (8, 61, 2), (16, 62, 3), (26, 60, 2), (38, 61, 3), (48, 62, 2), (58, 61, 3), (66, 64, 2),
             (4, 70, 2), (20, 72, 3), (34, 69, 2), (46, 73, 3), (60, 71, 2), (12, 80, 2), (30, 82, 3), (52, 80, 2)]
    for (x, y, r) in lumps:
        yy = y
        if dug > 0 and abs(x - cx) < bw:
            t = (x - cx) / bw
            yy -= int(bh * (1 - t * t))
        d.ellipse([X(x) - r, Y(yy) - r, X(x) + r, Y(yy) + r], fill=D2)
        d.point((X(x) - r + 1, Y(yy) - r + 1), fill=D3)
        d.point((X(x) + r - 1, Y(yy) + r - 1), fill=D0)
    # grit
    d.point([(X(2), Y(76)), (X(24), Y(77)), (X(40), Y(86)), (X(56), Y(78)), (X(10), Y(88)), (X(64), Y(88)), (X(36), Y(66)), (X(-4), Y(72)), (X(70), Y(74))], fill=D0)
    d.point([(X(6), Y(66)), (X(44), Y(66)), (X(18), Y(86)), (X(62), Y(84))], fill=D3)
    if dug > 0:                                                                        # cracks where it broke the surface
        d.line([(X(cx - bw - 5), Y(59)), (X(cx - bw), Y(60 - bh // 2)), (X(cx - bw + 3), Y(58 - bh // 3))], fill=D0)
        d.line([(X(cx + bw + 5), Y(59)), (X(cx + bw), Y(60 - bh // 2)), (X(cx + bw - 3), Y(58 - bh // 3))], fill=D0)
        for (x, y) in [(cx - bw + 6, 61 - bh), (cx + bw - 7, 60 - bh), (cx - 3, 58 - bh), (cx + 8, 62 - bh)]:
            d.rectangle([X(x), Y(y), X(x + 2), Y(y + 1)], fill=D0)
    if p["puff"] > 0:                                                                  # dust at the surface
        for (x, y, r) in [(4, 56, 3), (60, 57, 3), (-2, 52, 2), (66, 53, 2)]:
            rr = max(1, int(r * p["puff"]))
            d.ellipse([X(x) - rr, Y(y) - rr, X(x) + rr, Y(y) + rr], fill=D2)
            d.point((X(x) - rr + 1, Y(y) - rr + 1), fill=D3)

    # --- the stone in the air, tossed over the shoulder
    if p["gem_fly"]:
        fx, fy = p["gem_fly"]
        gx, gy = 32 + fx, 53 + dy + fy
        d.polygon([(X(gx - 4), Y(gy - 3)), (X(gx + 4), Y(gy - 3)), (X(gx + 6), Y(gy)), (X(gx), Y(gy + 6)), (X(gx - 6), Y(gy))], fill=DIA)
        d.line([(X(gx - 6), Y(gy)), (X(gx + 6), Y(gy))], fill=DIA2)
        d.line([(X(gx - 2), Y(gy)), (X(gx), Y(gy + 6))], fill=DIA2)
        d.rectangle([X(gx - 3), Y(gy - 2), X(gx - 2), Y(gy - 2)], fill=WHITE)

    # --- sparkle next to the stone
    s_ = p["sparkle"]
    if s_:
        sx_, sy_ = (44, 50 + dy) if p["gem_mouth"] else (32 + (p["gem_fly"] or (0, 0))[0] + 9, 48 + dy + (p["gem_fly"] or (0, 0))[1])
        if s_ % 2 == 1:
            d.line([(X(sx_), Y(sy_ - 3)), (X(sx_), Y(sy_ + 3))], fill=WHITE)
            d.line([(X(sx_ - 3), Y(sy_)), (X(sx_ + 3), Y(sy_))], fill=WHITE)
        else:
            d.point([(X(sx_), Y(sy_)), (X(sx_ - 2), Y(sy_ - 2)), (X(sx_ + 2), Y(sy_ + 2))], fill=WHITE)

    return outline(im)


def outline(im):
    a = im.split()[3]
    grown = a.filter(ImageFilter.MaxFilter(3))
    edge = Image.eval(grown, lambda v: 255 if v > 0 else 0)
    ring = Image.new("RGBA", im.size, K + (255,))
    ring.putalpha(edge)
    return Image.alpha_composite(ring, im)


def up(im, px):
    return im.resize((im.width * px, im.height * px), Image.NEAREST)


if __name__ == "__main__":
    frames = [draw_frame(params(i)) for i in range(N)]

    # spritesheet, native
    sheet = Image.new("RGBA", (FW * N, FH), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * FW, 0))
    sheet.save(OUT / "gemhog-dig-sheet.png")

    # individual frames + APNG + GIF, x6
    big = [up(f, 6) for f in frames]
    for i, f in enumerate(big):
        f.save(OUT / "frames" / f"frame-{i:02d}.png")
    big[0].save(OUT / "gemhog-dig.apng", format="PNG", save_all=True, append_images=big[1:], duration=MS, loop=0, disposal=1)
    # GIF: composite on black (GIF alpha is 1-bit), pixel palette survives quantisation
    gif = [Image.alpha_composite(Image.new("RGBA", f.size, (0, 0, 0, 255)), f).convert("P", palette=Image.ADAPTIVE, colors=32) for f in big]
    gif[0].save(OUT / "gemhog-dig.gif", save_all=True, append_images=gif[1:], duration=MS, loop=0, optimize=False)

    css = f"""/* Gemhog hero loop: {N} frames, {FW}x{FH} native, {MS} ms per frame.
   Scale with --px (integer), stays crisp thanks to image-rendering: pixelated. */
.gemhog-dig {{
  --px: 8;
  width: calc({FW}px * var(--px));
  height: calc({FH}px * var(--px));
  background: url("gemhog-dig-sheet.png") 0 0 / calc({FW * N}px * var(--px)) calc({FH}px * var(--px)) no-repeat;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  animation: gemhog-dig {N * MS}ms steps({N}) infinite;
}}
@keyframes gemhog-dig {{
  to {{ background-position: calc(-{FW * N}px * var(--px)) 0; }}
}}
@media (prefers-reduced-motion: reduce) {{
  .gemhog-dig {{ animation: none; background-position: calc(-{FW * 21}px * var(--px)) 0; }}  /* frame 21: stone in the mouth */
}}
"""
    (OUT / "gemhog-dig.css").write_text(css)
    (OUT / "example.html").write_text(f"""<!doctype html><meta charset=utf-8>
<link rel=stylesheet href=gemhog-dig.css>
<body style="background:#000;margin:0;display:grid;place-items:center;height:100vh">
<div class=gemhog-dig style="--px:8"></div>
""")
    print("ok", len(frames), "frames")
