"""README images: video posters with a play button, current-UI renders, and Version 1 vs Now pairs. Run after both videos exist."""
import importlib.util, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("evo", ROOT / "scripts" / "make-compare-video.py")
E = importlib.util.module_from_spec(spec); sys.modules["evo"] = E; spec.loader.exec_module(E)
IMG, PROMO = ROOT / "docs" / "images", ROOT / "docs" / "promo"
F = lambda sz, b=True: ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf" if b else "C:/Windows/Fonts/segoeui.ttf", sz)

def frame(video, t, out):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(t), "-i", str(video), "-frames:v", "1", str(out)], check=True)
    return Image.open(out).convert("RGB").resize((1280, 720), Image.LANCZOS)

def poster(video, t, label, out):
    im = frame(video, t, PROMO / "_tmp" / "frame.png")
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle((0, 0, 1280, 720), fill=(255, 255, 255, 70))
    cx, cy = 640, 330
    d.ellipse((cx - 70, cy - 70, cx + 70, cy + 70), fill=(66, 133, 244, 235))
    d.polygon([(cx - 22, cy - 38), (cx - 22, cy + 38), (cx + 42, cy)], fill=(255, 255, 255, 255))
    w = d.textlength(label, font=F(30)) + 60
    d.rounded_rectangle((640 - w / 2, 590, 640 + w / 2, 650), radius=30, fill=(32, 33, 36, 225))
    d.text((640, 620), label, font=F(30), fill=(255, 255, 255), anchor="mm")
    im.save(out, optimize=True)

def pair(before, after, out, title):
    W, H = 1600, 760
    im = Image.new("RGB", (W, H), (255, 255, 255)); d = ImageDraw.Draw(im)
    d.text((W // 2, 40), title, font=F(40), fill=(32, 33, 36), anchor="mm")
    for i, (img, tag, col, bg) in enumerate(((before, "Version 1", (95, 99, 104), (232, 234, 237)), (after, "Now", (25, 103, 210), (232, 240, 254)))):
        x0 = 60 + i * 780
        d.rounded_rectangle((x0, 100, x0 + 160, 148), radius=24, fill=bg); d.text((x0 + 80, 124), tag, font=F(26), fill=col, anchor="mm")
        d.rounded_rectangle((x0, 164, x0 + 720, 724), radius=24, fill=(244, 245, 246), outline=(218, 220, 224))
        sc = min(690 / img.width, 530 / img.height)
        pic = img.resize((int(img.width * sc), int(img.height * sc)), Image.LANCZOS)
        im.paste(pic, (x0 + 360 - pic.width // 2, 164 + 280 - pic.height // 2))
    d.text((W // 2, 444), "→", font=F(60), fill=(66, 133, 244), anchor="mm")
    im.save(out, optimize=True)

if __name__ == "__main__":
    A = E.assets()
    names = [n for n, _ in E.M.SCENES]
    dg = E.M.render_frame(names.index('dashboard'), 9.3, 10, 0.5)
    A['a_dashboard'] = dg.crop((int(100 * E.S), int(70 * E.S), int(1180 * E.S), int(610 * E.S)))
    poster(PROMO / "promise-keeper-promo.mp4", 46, "Watch the product walkthrough  ·  2:25", PROMO / "poster.png")
    poster(PROMO / "promise-keeper-evolution.mp4", 38.5, "Watch how the design evolved  ·  1:40", PROMO / "poster-evolution.png")
    for key, name in (("sidebar", "ui-sidebar"), ("dashboard", "ui-dashboard"), ("digest", "ui-digest"), ("metrics", "ui-metrics"), ("trends", "ui-trends")):
        A["a_" + key].save(IMG / f"{name}.png", optimize=True)
    for key, title in (("sidebar", "The Gmail sidebar"), ("dashboard", "The dashboard"), ("digest", "The morning digest"), ("metrics", "The Metrics page")):
        pair(A["b_" + key], A["a_" + key], IMG / f"pair-{key}.png", title)
    print("ok")
