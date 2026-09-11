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

FW, FH = 104, 84         # frame size
OX, OY = 16, 10          # pig origin inside the frame
N = 28
MS = 90


# ------------------------------------------------------------------ per-frame parameters
# 0-2 sniff · 3-8 dive: snout goes under the dirt · 9-12 rooting · 13-17 pull up with the
# stone in the mouth · 18-21 hold, sparkle · 22-26 toss it over the shoulder · 27 idle
def params(i: int) -> dict:
    p = dict(dy=0, dx=0, snout_dx=0, ear_twitch=False, hoof_l=0, hoof_r=0,
             dug=0.0, gem_mouth=False, gem_fly=None, sparkle=0, eyes="normal",
             dirt=[], crumbs=False)
    for launch in (6, 8, 10, 12):                     # clods fly once the snout is in the dirt
        age = i - launch
        if 0 <= age < 6:
            h = [3, 8, 12, 12, 8, 3][age]
            spread = 4 + age * 4
            r = 3 if age < 4 else 2
            p["dirt"] += [(14 - spread, 50 - h, r), (50 + spread, 50 - h, r),
                          (6 - age * 2, 44 - h // 2, 1), (58 + age * 2, 44 - h // 2, 1)]
    if i <= 2:
        p["snout_dx"] = [0, 1, -1][i]
        p["ear_twitch"] = i == 1
        return p
    if 3 <= i <= 8:
        k = i - 3
        p["dy"] = [3, 6, 9, 12, 14, 14][k]
        p["eyes"] = "squint" if k >= 1 else "normal"
        p["hoof_l"] = -3 if k % 2 == 0 else 0
        p["hoof_r"] = -3 if k % 2 == 1 else 0
        p["dug"] = min(1.0, k / 4)
        return p
    if 9 <= i <= 12:
        k = i - 9
        p["dy"] = 14
        p["dx"] = [-1, 1, -1, 1][k]
        p["eyes"] = "squint"
        p["hoof_l"] = -3 if k % 2 == 0 else 0
        p["hoof_r"] = -3 if k % 2 == 1 else 0
        p["dug"] = 1.0
        return p
    if 13 <= i <= 17:
        k = i - 13
        p["dy"] = [11, 7, 3, -1, -4][k]
        p["gem_mouth"] = True
        p["eyes"] = "squint" if k < 2 else "happy"
        p["dug"] = max(0.0, 1.0 - k / 4)
        p["crumbs"] = k < 3
        return p
    if 18 <= i <= 21:
        k = i - 18
        p["dy"] = -4
        p["gem_mouth"] = True
        p["eyes"] = "happy"
        p["sparkle"] = k + 1
        return p
    if 22 <= i <= 26:
        k = i - 22
        p["dy"] = [-7, -5, -4, -3, -2][k]
        p["eyes"] = "happy"
        p["gem_fly"] = [(0, -6), (10, -16), (22, -22), (36, -20), (50, -10)][k]   # arc over the right shoulder
        p["sparkle"] = 1 if k % 2 == 0 else 0
        return p
    p["dy"] = -1                                       # 27: settling back to idle
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
        d.ellipse([X(x) - r, Y(y) - r, X(x) + r, Y(y) + r], fill=L3)
        d.point((X(x) - r + 1, Y(y) - r + 1), fill=L1)

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
    if p["crumbs"]:                                    # dirt still on the snout, falling off
        d.point([(X(20), Y(44 + dy)), (X(43), Y(46 + dy)), (X(30), Y(41 + dy)), (X(26), Y(64 + dy)), (X(40), Y(66 + dy))], fill=L4)
        d.rectangle([X(36), Y(42 + dy), X(38), Y(43 + dy)], fill=L4)

    def X(x): return x + OX
    # --- hooves, scraping
    for x0, lift in ((3, p["hoof_l"]), (49, p["hoof_r"])):
        yy = 48 + dy + lift
        d.ellipse([X(x0), Y(yy), X(x0 + 11), Y(yy + 10)], fill=L4)
        d.rectangle([X(x0), Y(yy + 5), X(x0 + 11), Y(62 + dy)], fill=L4)
        d.ellipse([X(x0 + 1), Y(yy), X(x0 + 10), Y(yy + 9)], fill=L2)
        d.rectangle([X(x0 + 1), Y(yy + 4), X(x0 + 10), Y(60 + dy)], fill=L2)
        d.rectangle([X(x0 + 1), Y(58 + dy), X(x0 + 10), Y(60 + dy)], fill=L4)
        d.line([(X(x0 + 6), Y(58 + dy)), (X(x0 + 6), Y(60 + dy))], fill=K)
        d.rectangle([X(x0 + 2), Y(yy + 2), X(x0 + 4), Y(yy + 6)], fill=L1)

    # --- ground, in front of the head so the snout disappears into it
    # the mound runs off the bottom edge of the frame: no hooves, no black under it
    d.chord([X(-8), Y(56), X(72), Y(112)], 180, 360, fill=L4)
    d.chord([X(-5), Y(58), X(69), Y(110)], 180, 360, fill=L3)
    d.rectangle([X(-2), Y(70), X(66), FH], fill=L3)
    dug = p["dug"]
    if dug > 0:                                        # the mound bulges where the snout is rooting
        bw, bh = int(20 * dug), int(6 * dug)
        d.ellipse([X(32 - bw), Y(58 - bh), X(32 + bw), Y(58 + bh + 2)], fill=L4)
        d.ellipse([X(32 - bw + 2), Y(58 - bh + 1), X(32 + bw - 2), Y(58 + bh)], fill=L3)
        d.point([(X(32 - bw + 4), Y(57)), (X(32 + bw - 5), Y(56)), (X(32), Y(55 - bh))], fill=L4)

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
  .gemhog-dig {{ animation: none; background-position: calc(-{FW * 19}px * var(--px)) 0; }}  /* frame 19: stone in the mouth */
}}
"""
    (OUT / "gemhog-dig.css").write_text(css)
    (OUT / "example.html").write_text(f"""<!doctype html><meta charset=utf-8>
<link rel=stylesheet href=gemhog-dig.css>
<body style="background:#000;margin:0;display:grid;place-items:center;height:100vh">
<div class=gemhog-dig style="--px:8"></div>
""")
    print("ok", len(frames), "frames")
