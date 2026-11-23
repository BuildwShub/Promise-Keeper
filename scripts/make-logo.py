"""Draws the Promise Keeper logo (an envelope with a green check badge) with Pillow.
    python scripts/make-logo.py
Writes web/public/logo.png (512), web/app/icon.png (64, used as the site favicon) and docs/images/logo.png (256).
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
S = 1024  # draw large, then downsample for smooth edges


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    # background: rounded square with a blue -> violet diagonal gradient
    top, bottom = (26, 115, 232), (98, 62, 232)
    grad = Image.new("RGB", (S, S))
    gd = ImageDraw.Draw(grad)
    for i in range(2 * S):
        gd.line([(i, 0), (0, i)], fill=lerp(top, bottom, i / (2 * S - 1)), width=2)
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=230, fill=255)
    img.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(img)
    # envelope
    left, right, tp, bt = 170, 854, 290, 700
    d.rounded_rectangle([left, tp, right, bt], radius=46, fill=(255, 255, 255, 255))
    flap = (196, 211, 245, 255)
    mid = ((left + right) // 2, 520)
    d.line([(left + 34, tp + 30), mid, (right - 34, tp + 30)], fill=flap, width=26, joint="curve")
    for p in [(left + 34, tp + 30), (right - 34, tp + 30), mid]:
        d.ellipse([p[0] - 13, p[1] - 13, p[0] + 13, p[1] + 13], fill=flap)
    # green "kept" badge with a check, bottom right
    cx, cy, r = 772, 722, 200
    d.ellipse([cx - r - 30, cy - r - 30, cx + r + 30, cy + r + 30], fill=(255, 255, 255, 255))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(24, 128, 56, 255))
    pts = [(cx - 100, cy + 6), (cx - 28, cy + 84), (cx + 104, cy - 74)]
    d.line(pts, fill=(255, 255, 255, 255), width=54, joint="curve")
    for p in (pts[0], pts[2]):
        d.ellipse([p[0] - 27, p[1] - 27, p[0] + 27, p[1] + 27], fill=(255, 255, 255, 255))
    return img


def main():
    big = draw()
    outs = {ROOT / "web" / "public" / "logo.png": 512, ROOT / "web" / "app" / "icon.png": 64, ROOT / "docs" / "images" / "logo.png": 256}
    for path, size in outs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        big.resize((size, size), Image.LANCZOS).save(path)
        print("wrote", path.relative_to(ROOT), f"{size}x{size}")


if __name__ == "__main__":
    main()
