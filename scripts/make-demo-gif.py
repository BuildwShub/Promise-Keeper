"""Builds docs/images/demo.gif: a captioned walkthrough made from the real screenshots in docs/images and the real eval numbers.
    python scripts/make-demo-gif.py
Not a screen recording: see docs/demo-script.md for recording the real thing.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "docs" / "images"
W, H = 960, 540
BG, INK, MUTED, BLUE, GREEN, ORANGE, CARD = (15, 23, 42), (241, 245, 249), (148, 163, 184), (26, 115, 232), (52, 168, 83), (251, 146, 60), (30, 41, 59)


def font(size, bold=False):
    for name in (["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def wrap(d, text, f, width):
    lines, cur = [], ""
    for word in text.split():
        t = (cur + " " + word).strip()
        if d.textlength(t, font=f) <= width:
            cur = t
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def base(caption=None, step=None):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    if caption:
        d.rectangle([0, 0, W, 66], fill=CARD)
        x = 28
        if step:
            d.ellipse([22, 17, 54, 49], fill=BLUE)
            d.text((38, 33), str(step), font=font(18, True), fill=(255, 255, 255), anchor="mm")
            x = 68
        d.text((x, 33), caption, font=font(22, True), fill=INK, anchor="lm")
    return im, d


def fit(path, box_w, box_h):
    p = Image.open(path).convert("RGB")
    s = min(box_w / p.width, box_h / p.height)
    return p.resize((int(p.width * s), int(p.height * s)), Image.LANCZOS)


def shot(path, caption, step, note=None, max_w=880, max_h=None):
    im, d = base(caption, step)
    top = 84
    bottom_pad = 60 if note else 20
    p = fit(path, max_w, max_h or (H - top - bottom_pad))
    x, y = (W - p.width) // 2, top + ((H - top - bottom_pad) - p.height) // 2
    d.rounded_rectangle([x - 4, y - 4, x + p.width + 4, y + p.height + 4], radius=8, outline=(51, 65, 85), width=2)
    im.paste(p, (x, y))
    if note:
        d.text((W // 2, H - 30), note, font=font(18), fill=MUTED, anchor="mm")
    return im


def title():
    im, d = base()
    logo = Image.open(IMG / "logo.png").convert("RGBA").resize((150, 150), Image.LANCZOS)
    im.paste(logo, (W // 2 - 75, 90), logo)
    d.text((W // 2, 280), "Promise Keeper for Gmail", font=font(48, True), fill=INK, anchor="mm")
    d.text((W // 2, 335), "Finds the promises you make, the ones made to you,", font=font(24), fill=MUTED, anchor="mm")
    d.text((W // 2, 368), "and the deadlines hiding in your email.", font=font(24), fill=MUTED, anchor="mm")
    d.text((W // 2, 450), "Walkthrough built from real screenshots", font=font(16), fill=(100, 116, 139), anchor="mm")
    return im


def problem():
    im, d = base("The problem", 1)
    rows = [("Sent folder", '"I\'ll send the deck by Friday."', "Written, sent, forgotten. Nothing tracks it."),
            ("Inbox", '"Can you review this by EOD?"', "One of 40 messages that morning."),
            ("Waiting on others", '"Report is on the way."', "Then silence, and nothing tells you to chase.")]
    y = 100
    for tag, quote, why in rows:
        d.rounded_rectangle([60, y, W - 60, y + 112], radius=14, fill=CARD)
        d.text((88, y + 22), tag.upper(), font=font(14, True), fill=BLUE)
        d.text((88, y + 46), quote, font=font(28, True), fill=INK)
        d.text((88, y + 84), why, font=font(18), fill=MUTED)
        y += 132
    return im


def numbers():
    r = json.loads((ROOT / "eval" / "synthetic-results.json").read_text())
    im, d = base("It is measured, not guessed", 5)
    d.text((60, 96), "106 real emails, labelled by hand  (97 contain nothing to extract)", font=font(20), fill=MUTED)
    stats = [("0", "false alarms across\n97 emails with nothing", GREEN), ("100%", "precision\n(7 of 7 shown correct)", BLUE), ("77.8%", "recall\n(7 of 9 found)", ORANGE), ("100%", "date accuracy", GREEN)]
    x = 60
    for big, small, col in stats:
        d.rounded_rectangle([x, 136, x + 200, 296], radius=14, fill=CARD)
        d.text((x + 100, 190), big, font=font(46, True), fill=col, anchor="mm")
        for i, line in enumerate(small.split("\n")):
            d.text((x + 100, 244 + i * 22), line, font=font(16), fill=MUTED, anchor="mm")
        x += 215
    d.text((60, 332), "Prompt v1 failed the quality gate (precision 83%, recall 56%). Fixing it from the misses gave v2.", font=font(18), fill=INK)
    d.rounded_rectangle([60, 372, W - 60, 494], radius=14, fill=CARD)
    d.text((84, 392), f"Second test: {r['emails']} synthetic emails, {r['expectedItems']} expected items", font=font(18, True), fill=INK)
    d.text((84, 424), f"precision {r['shown']['precision']*100:.1f}%   recall {r['shown']['recall']*100:.1f}%   date accuracy {r['dateAccuracy']*100:.0f}%   (Hinglish included)", font=font(18), fill=MUTED)
    d.text((84, 450), "Same results on the Apps Script add-on and on the Vercel web app.", font=font(16), fill=(100, 116, 139))
    return im


def closing():
    im, d = base()
    d.text((W // 2, 130), "Built to be trusted", font=font(40, True), fill=INK, anchor="mm")
    pts = ["Every item quotes the sentence it came from", "Nothing is added until you press Accept", "Follow-ups are drafts, never sent for you", "Row-level security, encrypted tokens, delete-my-data"]
    y = 200
    for p in pts:
        d.ellipse([200, y - 2, 224, y + 22], fill=GREEN)
        d.text((212, y + 10), "✓", font=font(16, True), fill=(255, 255, 255), anchor="mm")
        d.text((240, y + 10), p, font=font(24), fill=INK, anchor="lm")
        y += 52
    d.text((W // 2, 460), "github.com/BuildwShub/Promise-Keeper", font=font(22, True), fill=BLUE, anchor="mm")
    return im


frames = [
    (title(), 2800),
    (problem(), 4200),
    (shot(IMG / "sidebar-in-gmail.png", "Open an email: the promise is already there", 2, "It quotes the exact sentence. Accept, edit, draft a follow-up, or dismiss.", max_w=900), 4200),
    (shot(IMG / "digest-email.png", "Every morning: what is due, and who owes you", 3, "One email: overdue, today, this week, waiting on others.", max_w=880), 3600),
    (shot(IMG / "items-dashboard.png", "The same items on the web dashboard", 4, "Accept creates a Google Task; deadlines also create a Calendar event.", max_h=400), 3600),
    (numbers(), 5200),
    (closing(), 3600),
]
frames[0][0].save(
    IMG / "demo.gif", save_all=True, append_images=[f for f, _ in frames[1:]], duration=[ms for _, ms in frames], loop=0, optimize=True,
    disposal=2,
)
size = (IMG / "demo.gif").stat().st_size / 1024
print(f"wrote docs/images/demo.gif  {len(frames)} frames  {size:.0f} KB")
