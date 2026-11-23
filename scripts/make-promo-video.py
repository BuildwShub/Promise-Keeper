"""Builds docs/promo/promise-keeper-promo.mp4: a narrated, animated, Google-style product video. Every visual is generated here.
    python scripts/make-promo-video.py            full build (voice, music, render, mux)
    python scripts/make-promo-video.py --preview  write one still per scene to docs/promo/preview/ (no video)
Voice: Microsoft neural voice (see VOICE) via the edge-tts package (pip install edge-tts). Needs Pillow and ffmpeg.
The people and company are fictional. The Outlook scene is a vision, not a shipped feature.
"""
import importlib.util
import math
import subprocess
import sys
import wave
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "promo"
TMP = OUT / "_tmp"
W, H = 1280, 720          # logical layout space the scenes are written in
S = 1.5                     # output is 1920x1080: every coordinate, width and font is scaled by S
OW, OH, FPS = int(W * S), int(H * S), 30

BLUE, RED, YELLOW, GREEN = (66, 133, 244), (234, 67, 53), (251, 188, 5), (52, 168, 83)
INK, MUTED, LINE, SOFT, WHITE = (32, 33, 36), (95, 99, 104), (218, 220, 224), (241, 243, 244), (255, 255, 255)
TYPES = {
    "my_promise": ("I promised", (25, 103, 210), (232, 240, 254)),
    "request_to_me": ("Asked of me", (176, 96, 0), (254, 243, 199)),
    "deadline": ("Deadline", (197, 34, 31), (252, 232, 230)),
    "waiting_on": ("Waiting on them", (30, 110, 50), (230, 244, 234)),
}
TYPE_ICON = {"my_promise": "promised", "request_to_me": "asked", "deadline": "deadline", "waiting_on": "waiting"}
AMBER = (249, 171, 0)
BAR = (232, 240, 254)  # soft-blue Gmail side-panel bar

# ------------------------------------------------------------------ narration
SCENES = [
    ("hook", 'Last Tuesday, you wrote five words: "I\'ll send it by Friday." It\'s Friday now. And that sentence is buried under two hundred emails.'),
    ("problem", "Your to-do list only knows what you type into it. But your real commitments live in your inbox: the ones you make, the ones people ask of you, and the ones others owe you. And nothing reads your Sent folder. Until now."),
    ("intro", "Meet Promise Keeper. It lives inside Gmail, reads both sides of your conversations, and quietly finds every commitment."),
    ("howto1", "Getting started takes about a minute. Sign in once with your Google account. Then open any email in Gmail, and click the Promise Keeper icon in the side panel."),
    ("spot", 'Here is Shubham, a product manager, replying to the finance lead: "I\'ll send the revised budget by Friday." Promise Keeper spots the promise, works out the date, and shows the exact sentence it came from.'),
    ("accept", "One tap on Accept, and it lands in Google Tasks. Deadlines go on the calendar too."),
    ("howto2", "For every suggestion, you decide. Accept it to add it to Tasks and Calendar. Edit it if something is off. Or dismiss it. Nothing happens until you choose."),
    ("requests", "Then the manager asks Shubham to review a deck by end of day. And a supplier says they'll ship an order on Monday. Both appear instantly, labelled: what is owed, and what is being waited on."),
    ("digest", "Every morning, one digest shows what's overdue, what's due today, and who owes you."),
    ("dashboard", "On the dashboard, everything is grouped by when it is due. Click a tile to filter. And every number comes with its formula, one tap away."),
    ("nudge", "When the supplier goes quiet, one tap writes a polite follow-up draft. You review it. Promise Keeper never sends anything for you."),
    ("trust", "And it has to be trustworthy. Every item quotes the sentence it came from. Nothing is added until you accept it. We tested it on one hundred and six real emails. Ninety-seven had nothing to find, and it raised zero false alarms."),
    ("audience", "For employees, nothing slips between meetings. For managers, a clear picture of what is owed. For freelancers, every client promise tracked and every invoice chased. For creators, every sponsor deliverable and deadline, handled."),
    ("outlook", 'Today, it works in Gmail. The same idea can come to Outlook, so every inbox, at work or at home, becomes a commitment tracker. Fewer follow-ups. Less searching. No more "sorry, I forgot."'),
    ("recap", "That is all it takes. Sign in once. Open an email. Accept what is right. Promise Keeper does the rest."),
    ("close", "Promise Keeper. Never lose a promise in your inbox."),
]
LEAD, TAIL = 0.4, 0.45  # seconds of silence before and after each line


# ------------------------------------------------------------------ drawing helpers
@lru_cache(None)
def F(size, bold=False):
    for name in (["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]):
        try:
            return ImageFont.truetype(name, size * S)
        except OSError:
            continue
    return ImageFont.load_default()


class Pen:
    """Draws in logical (1280x720) units onto the 1920x1080 canvas."""

    def __init__(self, raw):
        self.raw = raw

    @staticmethod
    def sc(v):
        if isinstance(v, (int, float)):
            return v * S
        out = []
        for it in v:
            out.extend(Pen.sc(it) if isinstance(it, (tuple, list)) else [it * S])
        return out

    @staticmethod
    def wd(w):
        return max(1, int(round(w * S)))

    def _kw(self, kw):
        if "width" in kw:
            kw["width"] = self.wd(kw["width"])
        if "radius" in kw:
            kw["radius"] = kw["radius"] * S
        return kw

    def rounded_rectangle(self, box, **kw):
        self.raw.rounded_rectangle(self.sc(box), **self._kw(kw))

    def rectangle(self, box, **kw):
        self.raw.rectangle(self.sc(box), **self._kw(kw))

    def ellipse(self, box, **kw):
        self.raw.ellipse(self.sc(box), **self._kw(kw))

    def pieslice(self, box, start, end, **kw):
        self.raw.pieslice(self.sc(box), start, end, **self._kw(kw))

    def arc(self, box, start, end, **kw):
        self.raw.arc(self.sc(box), start, end, **self._kw(kw))

    def line(self, xy, **kw):
        self.raw.line(self.sc(xy), **self._kw(kw))

    def polygon(self, xy, **kw):
        self.raw.polygon(self.sc(xy), **self._kw(kw))


def col(c, a=1.0):
    return (c[0], c[1], c[2], int(255 * max(0.0, min(1.0, a))))


def prog(t, a, b):
    return 0.0 if b <= a else max(0.0, min(1.0, (t - a) / (b - a)))


def ease(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def back(x):  # overshoot
    x = max(0.0, min(1.0, x))
    c1 = 1.70158
    return 1 + (c1 + 1) * (x - 1) ** 3 + c1 * (x - 1) ** 2


CUR = None  # the frame being drawn (set in render_frame) so faded text can be composited


def T(d, x, y, s, size, c=INK, bold=False, anchor="la", a=1.0):
    # Pillow ignores alpha on text, so faded text is drawn into a mask and pasted with that opacity
    a = max(0.0, min(1.0, a))
    if a <= 0.01 or not s:
        return
    f = F(size, bold)
    X, Y = x * S, y * S
    raw = d.raw
    if a >= 0.995:
        raw.text((X, Y), s, font=f, fill=(c[0], c[1], c[2], 255), anchor=anchor)
        return
    l, t_, r, b = raw.textbbox((X, Y), s, font=f, anchor=anchor)
    pad = 3
    mask = Image.new("L", (int(r - l) + 2 * pad, int(b - t_) + 2 * pad), 0)
    ImageDraw.Draw(mask).text((X - l + pad, Y - t_ + pad), s, font=f, fill=int(255 * a), anchor=anchor)
    CUR.paste((c[0], c[1], c[2]), (int(l) - pad, int(t_) - pad), mask)


def tw(d, s, size, bold=False):
    return d.raw.textlength(s, font=F(size, bold)) / S


def wrap(d, s, size, width, bold=False):
    lines, cur = [], ""
    for w in s.split():
        t = (cur + " " + w).strip()
        if tw(d, t, size, bold) <= width:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def shadow(d, box, r, a=1.0):
    x0, y0, x1, y1 = box
    for i, (dy, al) in enumerate([(2, 16), (5, 11), (10, 6)]):
        d.rounded_rectangle((x0 - i, y0 + dy, x1 + i, y1 + dy + i), radius=r + i, fill=(32, 33, 36, int(al * a)))


def card(d, box, r=16, fill=WHITE, a=1.0, outline=LINE, sh=True):
    if sh:
        shadow(d, box, r, a)
    d.rounded_rectangle(box, radius=r, fill=col(fill, a), outline=col(outline, a), width=1)


def chip(d, x, y, s, fg, bg, size=13, a=1.0, bold=True):
    w = int(tw(d, s, size, bold)) + 22
    h = size + 15
    d.rounded_rectangle((x, y, x + w, y + h), radius=h // 2, fill=col(bg, a))
    T(d, x + 11, y + h // 2, s, size, fg, bold, "lm", a)
    return w


def button(d, x, y, s, filled, a=1.0, w=None, pressed=False):
    w = w or int(tw(d, s, 14, True)) + 30
    h = 34
    if filled:
        d.rounded_rectangle((x, y, x + w, y + h), radius=17, fill=col((50, 110, 220) if pressed else BLUE, a))
        T(d, x + w / 2, y + h / 2, s, 14, WHITE, True, "mm", a)
    else:
        d.rounded_rectangle((x, y, x + w, y + h), radius=17, outline=col(BLUE, a), width=2, fill=col(WHITE, a))
        T(d, x + w / 2, y + h / 2, s, 14, BLUE, True, "mm", a)
    return (x, y, x + w, y + h)


def avatar(d, x, y, r, letter, color, a=1.0):
    d.ellipse((x - r, y - r, x + r, y + r), fill=col(color, a))
    T(d, x, y, letter, int(r * 1.0), WHITE, True, "mm", a)


def cursor(d, x, y, a=1.0):
    pts = [(x, y), (x, y + 23), (x + 6, y + 18), (x + 11, y + 28), (x + 15, y + 26), (x + 10, y + 17), (x + 18, y + 17)]
    d.polygon(pts, fill=col(INK, a), outline=col(WHITE, a))


def ripple(d, x, y, p):
    if 0 < p < 1:
        r = int(8 + 34 * p)
        d.ellipse((x - r, y - r, x + r, y + r), outline=col(BLUE, 1 - p), width=3)


def check(d, cx, cy, s, c, a=1.0, w=5):
    d.line([(cx - s * 0.5, cy), (cx - s * 0.15, cy + s * 0.4), (cx + s * 0.55, cy - s * 0.4)], fill=col(c, a), width=w, joint="curve")


def cross(d, cx, cy, s, c, a=1.0, w=4):
    d.line([(cx - s / 2, cy - s / 2), (cx + s / 2, cy + s / 2)], fill=col(c, a), width=w)
    d.line([(cx - s / 2, cy + s / 2), (cx + s / 2, cy - s / 2)], fill=col(c, a), width=w)


def window(d, box, title, a=1.0):
    x0, y0, x1, y1 = box
    card(d, box, 18, a=a)
    d.rounded_rectangle((x0 + 1, y0 + 1, x1 - 1, y0 + 44), radius=17, fill=col(SOFT, a))
    d.rectangle((x0 + 1, y0 + 30, x1 - 1, y0 + 44), fill=col(SOFT, a))
    for i, c in enumerate([RED, YELLOW, GREEN]):
        d.ellipse((x0 + 18 + i * 20, y0 + 17, x0 + 28 + i * 20, y0 + 27), fill=col(c, a))
    T(d, x0 + 100, y0 + 22, title, 14, MUTED, False, "lm", a)


@lru_cache(None)
def logo_img(size):
    im = Image.open(ROOT / "docs" / "images" / "logo.png").convert("RGBA")
    return im.resize((size, size), Image.LANCZOS)


def paste_logo(im, cx, cy, size, a=1.0):
    lg = logo_img(max(8, int(size * S)))
    if a < 1:
        lg = lg.copy()
        lg.putalpha(lg.getchannel("A").point(lambda v: int(v * a)))
    im.paste(lg, (int(cx * S - lg.width / 2), int(cy * S - lg.height / 2)), lg)


@lru_cache(None)
def icon_png(name, size):
    im = Image.open(ROOT / "web" / "public" / "icons" / f"{name}.png").convert("RGBA")
    return im.resize((size, size), Image.LANCZOS)


def paste_icon(im, name, x, y, size, a=1.0):
    ic = icon_png(name, int(size * S))
    if a < 1:
        ic = ic.copy()
        ic.putalpha(ic.getchannel("A").point(lambda v: int(v * a)))
    im.paste(ic, (int(x * S), int(y * S)), ic)


WM_SEQ = [BLUE, RED, YELLOW, BLUE, GREEN, RED, GREEN]


def wordmark(d, cx, cy, size, a=1.0):
    """Promise (Google-logo colour order, bold) + Keeper (grey)."""
    parts = [(ch, WM_SEQ[i], True) for i, ch in enumerate("Promise")] + [(" Keeper", MUTED, False)]
    total = sum(tw(d, p_[0], size, p_[2]) for p_ in parts)
    x = cx - total / 2
    for txt, c, bold in parts:
        T(d, x, cy, txt, size, c, bold, "lm", a)
        x += tw(d, txt, size, bold)


def sidebar(im, d, box, a=1.0):
    """Gmail side panel with the soft-blue bar."""
    x0, y0, x1, y1 = box
    card(d, box, 18, a=a)
    d.rounded_rectangle((x0 + 1, y0 + 1, x1 - 1, y0 + 52), radius=17, fill=col(BAR, a))
    d.rectangle((x0 + 1, y0 + 34, x1 - 1, y0 + 52), fill=col(BAR, a))
    T(d, x0 + 22, y0 + 27, "Promise Keeper", 17, INK, True, "lm", a)
    for k in range(3):
        d.ellipse((x1 - 62, y0 + 20 + k * 6, x1 - 58, y0 + 24 + k * 6), fill=col(INK, a))
    cross(d, x1 - 28, y0 + 27, 12, INK, a, 3)


def item_card(d, x, y, w, typ, what, due, quote, status="Suggested", a=1.0, buttons=None, late=False, press=None, who="", dcol=BLUE):
    h = 184 if buttons else 142
    card(d, (x, y, x + w, y + h), 14, a=a)
    label, fg, bg = TYPES[typ]
    T(d, x + 16, y + 20, due, 12, dcol, True, "lm", a)
    sw = int(tw(d, status, 12, True)) + 22
    chip(d, x + w - sw - 14, y + 8, status, (30, 110, 50) if status == "Accepted" else (60, 64, 67), bg if status == "Accepted" else SOFT, 12, a)
    if CUR is not None:
        paste_icon(CUR, TYPE_ICON[typ], x + 16, y + 38, 36, a)
    T(d, x + 64, y + 46, label + ("  ·  LATE" if late else ""), 12, RED if late else fg, True, "lm", a)
    T(d, x + 64, y + 68, what, 18, INK, True, "lm", a)
    if who:
        T(d, x + 64, y + 90, who, 13, MUTED, False, "lm", a)
    ql = wrap(d, '"' + quote + '"', 13, w - 44)
    d.rounded_rectangle((x + 14, y + 104, x + w - 14, y + 132), radius=9, fill=col(SOFT, a))
    T(d, x + 26, y + 118, ql[0], 12, (95, 99, 104), False, "lm", a)
    rects = {}
    if buttons:
        bx = x + 16
        for name, filled in buttons:
            r = button(d, bx, y + h - 46, name, filled, a, pressed=(press == name))
            rects[name] = r
            bx = r[2] + 10
    return rects, h


SKIN, HAIR, BLAZER, TURTLE, BEARD = (214, 160, 122), (26, 24, 28), (30, 41, 66), (24, 24, 28), (38, 28, 28)


def person(d, cx, by, k=1.0, mood="happy", pose="none", a=1.0, t=0.0, target=None):
    """Flat cartoon of Shubham (dark hair, beard, dark blazer). by = y of the torso bottom. pose: none, wave, point, up."""
    f = lambda v: v * k
    sh = (cx - f(70), by - f(120)), (cx + f(70), by - f(120))  # shoulders
    # arms behind torso
    if pose in ("wave", "up", "point"):
        for side, (sx, sy) in zip((-1, 1), sh):
            if pose == "wave" and side == -1:
                continue
            if pose == "point" and side == -1:
                continue
            if pose == "up":
                hx, hy = sx + side * f(40), sy - f(120) + 8 * math.sin(t * 9 + side) * k
            elif pose == "wave":
                hx, hy = sx + f(70), sy - f(110) + 10 * math.sin(t * 9) * k
            else:
                hx, hy = (target if target else (sx + f(160), sy - f(30)))
            d.line((sx, sy, hx, hy), fill=col(BLAZER, a), width=int(f(26)))
            d.ellipse((hx - f(15), hy - f(15), hx + f(15), hy + f(15)), fill=col(SKIN, a))
    d.rounded_rectangle((cx - f(95), by - f(135), cx + f(95), by + f(30)), radius=f(46), fill=col(BLAZER, a))
    d.polygon([(cx - f(28), by - f(136)), (cx + f(28), by - f(136)), (cx + f(18), by - f(62)), (cx - f(18), by - f(62))], fill=col(TURTLE, a))
    d.rectangle((cx - f(18), by - f(172), cx + f(18), by - f(130)), fill=col(SKIN, a))
    hy = by - f(215)
    d.ellipse((cx - f(60), hy - f(8), cx - f(48), hy + f(24)), fill=col(SKIN, a))
    d.ellipse((cx + f(48), hy - f(8), cx + f(60), hy + f(24)), fill=col(SKIN, a))
    d.ellipse((cx - f(54), hy - f(66), cx + f(54), hy + f(64)), fill=col(HAIR, a))
    d.polygon([(cx - f(44), hy - f(56)), (cx - f(10), hy - f(92)), (cx + f(40), hy - f(74)), (cx + f(52), hy - f(40)), (cx - f(50), hy - f(40))], fill=col(HAIR, a))
    d.ellipse((cx - f(45), hy - f(42), cx + f(45), hy + f(64)), fill=col(SKIN, a))
    d.pieslice((cx - f(53), hy - f(14), cx + f(53), hy + f(62)), 0, 180, fill=col(BEARD, a))
    ey = hy - f(2)
    for sx_ in (-1, 1):
        d.ellipse((cx + sx_ * f(20) - f(7), ey - f(7), cx + sx_ * f(20) + f(7), ey + f(7)), fill=col((255, 255, 255), a))
        d.ellipse((cx + sx_ * f(20) - f(4), ey - f(4), cx + sx_ * f(20) + f(4), ey + f(4)), fill=col((30, 30, 30), a))
        by_ = ey - f(17)
        if mood == "worried":
            d.line((cx + sx_ * f(30), by_ + f(4), cx + sx_ * f(10), by_ - f(3)), fill=col(HAIR, a), width=max(2, int(f(4))))
        else:
            d.line((cx + sx_ * f(30), by_ - f(1), cx + sx_ * f(10), by_ - f(1)), fill=col(HAIR, a), width=max(2, int(f(4))))
    my = hy + f(30)
    lip = (226, 140, 130)
    if mood == "happy":
        d.arc((cx - f(20), my - f(16), cx + f(20), my + f(14)), 20, 160, fill=col(lip, a), width=max(3, int(f(5))))
    elif mood == "worried":
        d.arc((cx - f(14), my - f(2), cx + f(14), my + f(18)), 200, 340, fill=col(lip, a), width=max(3, int(f(5))))
        d.polygon([(cx + f(60), hy - f(30)), (cx + f(54), hy - f(14)), (cx + f(66), hy - f(14))], fill=col((120, 190, 245), a))
    else:
        d.ellipse((cx - f(8), my - f(6), cx + f(8), my + f(10)), fill=col(lip, a))


def bubble(d, x, y, w, h, text, size=20, tail="left", a=1.0, fill=WHITE, fg=INK):
    d.rounded_rectangle((x, y, x + w, y + h), radius=18, fill=col(fill, a), outline=col(LINE, a), width=2)
    ty = y + h
    if tail == "left":
        d.polygon([(x + 28, ty - 2), (x + 8, ty + 24), (x + 58, ty - 2)], fill=col(fill, a))
    elif tail == "right":
        d.polygon([(x + w - 28, ty - 2), (x + w - 8, ty + 24), (x + w - 58, ty - 2)], fill=col(fill, a))
    lines = wrap_text_lines(text, size, w - 36)
    off = y + h / 2 - (len(lines) - 1) * size * 0.65
    for i, ln in enumerate(lines):
        T(d, x + w / 2, off + i * size * 1.3, ln, size, fg, True, "mm", a)


def wrap_text_lines(text, size, width):
    probe = ImageDraw.Draw(Image.new("RGB", (4, 4)))
    lines, cur = [], ""
    for w_ in text.split():
        t_ = (cur + " " + w_).strip()
        if probe.textlength(t_, font=F(size, True)) / S <= width:
            cur = t_
        else:
            lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    return lines


def envelope(d, x, y, w, c=BLUE, a=1.0):
    h = w * 0.68
    d.rounded_rectangle((x, y, x + w, y + h), radius=8, fill=col(WHITE, a), outline=col(c, a), width=3)
    d.line((x + 4, y + 6, x + w / 2, y + h * 0.58, x + w - 4, y + 6), fill=col(c, a), width=3)


def confetti(d, t, x0, x1, y0, n=26, a=1.0):
    for i in range(n):
        seed = (i * 7919) % 1000 / 1000.0
        x = x0 + (x1 - x0) * ((i * 37) % 100) / 100.0
        y = y0 + ((t * 140 + seed * 240) % 240)
        c = [BLUE, RED, YELLOW, GREEN][i % 4]
        d.rounded_rectangle((x, y, x + 8, y + 14), radius=2, fill=col(c, a))


@lru_cache(None)
def photo_square(size_px):
    im = Image.open(ROOT / "docs" / "promo" / "_tmp" / "assets" / "shubham.jpg").convert("RGB")
    w, h = im.size
    side = w
    left = 0
    top = int(h * 0.03)
    im = im.crop((left, top, left + side, top + side)).resize((size_px, size_px), Image.LANCZOS)
    mask = Image.new("L", (size_px * 4, size_px * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size_px * 4 - 1, size_px * 4 - 1), fill=255)
    return im, mask.resize((size_px, size_px), Image.LANCZOS)


def photo_avatar(d, cx, cy, r, a=1.0):
    px = int(2 * r * S)
    ph, mk = photo_square(px)
    if a < 1:
        mk = mk.point(lambda v: int(v * a))
    CUR.paste(ph, (int(cx * S - px / 2), int(cy * S - px / 2)), mk)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=col(LINE, a), width=2)


def persona(d, a=1.0):
    photo_avatar(d, 90, 54, 32, a)
    T(d, 136, 44, "Shubham Kanauji", 20, INK, True, "lm", a)
    T(d, 136, 68, "Product Manager", 15, MUTED, False, "lm", a)


def footer_note(d, a=1.0):
    T(d, W - 40, H - 24, "Colleagues and emails are examples", 12, (154, 160, 166), False, "rm", a)


def caption(d, s, a=1.0, y=H - 52):
    w = tw(d, s, 24, True) + 56
    d.rounded_rectangle((W / 2 - w / 2, y - 24, W / 2 + w / 2, y + 24), radius=24, fill=col(INK, 0.88 * a))
    T(d, W / 2, y, s, 24, WHITE, True, "mm", a)


def type_text(s, p):
    return s[: int(len(s) * max(0.0, min(1.0, p)))]


def draw_lines(d, x, y, text, size, color, lh, a=1.0, bold=False):
    for i, ln in enumerate(text.split("\n")):
        T(d, x, y + i * lh, ln, size, color, bold, "la", a)


# ------------------------------------------------------------------ scenes (t = seconds into the scene, D = scene length)
def s_hook(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    T(d, W / 2, 96, "Last Tuesday, you wrote five words.", 44, INK, True, "mm", ex(0.02, 0.1) * (1 - ex(0.62, 0.7)))
    cw, ch, cx, cy = 720, 160, W // 2 - 360, 290
    a = ex(0.05, 0.13)
    card(d, (cx, cy, cx + cw, cy + ch), 18, a=a)
    T(d, cx + 30, cy + 34, "You  ·  Sent  ·  Tuesday 10:42", 16, MUTED, False, "lm", a)
    hl = int(470 * ex(0.13, 0.24))
    d.rounded_rectangle((cx + 28, cy + 66, cx + 28 + hl, cy + 122), radius=8, fill=col(YELLOW, 0.6 * a))
    T(d, cx + 38, cy + 94, "I'll send it by Friday.", 40, INK, True, "lm", a)
    subs = [("Priya N.", "Re: Q3 numbers"), ("Newsletter", "Your weekly digest"), ("Dan O.", "Quick question"), ("Sofia R.", "Deck feedback"), ("HR Team", "Benefits update"),
            ("Lumen", "Order confirmation"), ("Calendar", "Invitation: sync"), ("Omar K.", "Re: shipment"), ("Finance", "Budget review"), ("Legal", "NDA attached"),
            ("Marketing", "Campaign recap"), ("IT Desk", "Password expiry"), ("Ravi M.", "Lunch?"), ("Client", "Re: proposal")]
    t0 = 0.34 * D
    for i, (who, sub) in enumerate(subs):
        st = t0 + i * 0.035 * D
        p = ease(prog(t, st, st + 0.11 * D))
        if p <= 0:
            continue
        ty = 150 + (i % 8) * 60
        x = 250 + ((i * 53) % 90) - 40
        y = -80 + (ty + 80) * p
        card(d, (x, y, x + 780, y + 52), 12)
        T(d, x + 20, y + 26, who, 16, INK, True, "lm")
        T(d, x + 170, y + 26, sub, 16, MUTED, False, "lm")
    n = int(3 + 211 * ease(prog(t, 0.34 * D, 0.78 * D)))
    b = ex(0.32, 0.38)
    d.rounded_rectangle((W - 220, 40, W - 40, 100), radius=30, fill=col(RED, b))
    T(d, W - 130, 70, f"{n} unread", 24, WHITE, True, "mm", b)
    f = ex(0.78, 0.86)
    if f > 0:
        card(d, (W // 2 - 300, 270, W // 2 + 300, 450), 22, a=f)
        T(d, W // 2, 330, "It's Friday.", 56, RED, True, "mm", f)
        T(d, W // 2, 395, "The promise is buried.", 30, MUTED, False, "mm", f)


def s_problem(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    a1 = ex(0.02, 0.08) * (1 - ex(0.28, 0.34))
    T(d, W / 2, 84, "Your to-do list only knows what you type.", 42, INK, True, "mm", a1)
    a2 = ex(0.33, 0.4)
    T(d, W / 2, 84, "Your real commitments live in your inbox.", 42, INK, True, "mm", a2)
    cards = [("my_promise", "I'll send the deck\nby Friday.", "From your Sent folder", 0.40),
             ("request_to_me", "Can you review this\nby end of day?", "From your Inbox", 0.50),
             ("waiting_on", "The report is\non the way.", "Someone owes you", 0.60)]
    for i, (typ, q, src, st) in enumerate(cards):
        p = ex(st, st + 0.07)
        x = 70 + i * 390
        y = 200 + (1 - p) * 40
        card(d, (x, y, x + 360, y + 240), 20, a=p)
        label, fg, bg = TYPES[typ]
        chip(d, x + 22, y + 22, label, fg, bg, 15, p)
        draw_lines(d, x + 24, y + 80, q, 30, INK, 42, p, True)
        T(d, x + 24, y + 206, src, 15, MUTED, False, "lm", p)
    r = ex(0.76, 0.82)
    if r > 0:
        d.rounded_rectangle((60, 190, 440, 450), radius=24, outline=col(RED, r), width=4)
        T(d, 250, 484, "Nothing reads your Sent folder.", 26, RED, True, "mm", r)
    u = ex(0.9, 0.96)
    T(d, W / 2, 600, "Until now.", 56, BLUE, True, "mm", u)


def s_intro(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    p = prog(t, 0.04 * D, 0.26 * D)
    s = 0.55 + 0.45 * back(p)
    for k in range(3):
        rp = prog(t, (0.12 + k * 0.1) * D, (0.55 + k * 0.1) * D)
        if 0 < rp < 1:
            r = 120 + 260 * rp
            d.ellipse((W / 2 - r, 250 - r, W / 2 + r, 250 + r), outline=col(BLUE, 0.35 * (1 - rp)), width=3)
    paste_logo(im, W / 2, 250, 220 * s, ex(0.04, 0.12))
    wordmark(d, W / 2, 440, 68, ex(0.28, 0.42))
    lines = [("Lives inside Gmail.", 0.5, BLUE), ("Reads both sides of your conversations.", 0.64, GREEN), ("Finds every commitment.", 0.8, RED)]
    y = 505
    for s_, st, c in lines:
        a = ex(st, st + 0.08)
        T(d, W / 2, y + (1 - a) * 12, s_, 28, c, True, "mm", a)
        y += 44


def mail_pane(im, d, title="Reply  ·  Daniel Okafor (Finance)"):
    window(d, (60, 110, 760, 650), title)
    T(d, 90, 176, "To:", 15, MUTED, False, "lm")
    T(d, 124, 176, "Daniel Okafor", 15, INK, True, "lm")
    d.line((90, 198, 730, 198), fill=col(LINE))
    T(d, 90, 224, "Subject:", 15, MUTED, False, "lm")
    T(d, 160, 224, "Re: Q4 budget", 15, INK, True, "lm")
    d.line((90, 246, 730, 246), fill=col(LINE))


BODY = "Hi Daniel,\n\nSure. I'll send the revised budget by Friday.\n\nThanks,\nShubham"


def panel(im, d, a=1.0, x_off=0):
    box = (800 + x_off, 110, 1220 + x_off, 650)
    sidebar(im, d, box, a)
    return box


def key_icon(d, cx, cy, c, a=1.0):
    d.ellipse((cx - 30, cy - 18, cx + 2, cy + 14), outline=col(c, a), width=7)
    d.line((cx + 2, cy - 2, cx + 40, cy - 2), fill=col(c, a), width=7)
    d.line((cx + 30, cy - 2, cx + 30, cy + 12), fill=col(c, a), width=7)
    d.line((cx + 40, cy - 2, cx + 40, cy + 8), fill=col(c, a), width=7)


def step_card(d, x, y, w, n, title, sub, a=1.0, c=BLUE):
    card(d, (x, y, x + w, y + 112), 18, a=a)
    d.ellipse((x + 20, y + 28, x + 76, y + 84), fill=col(c, a))
    T(d, x + 48, y + 56, str(n), 30, WHITE, True, "mm", a)
    T(d, x + 96, y + 40, title, 25, INK, True, "lm", a)
    T(d, x + 96, y + 76, sub, 16, MUTED, False, "lm", a)


def s_howto1(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    T(d, W / 2, 60, "Getting started", 44, INK, True, "mm", ex(0.02, 0.08))
    steps = [("Sign in once with Google", "Connect your Gmail. About a minute.", 0.12, BLUE), ("Open any email in Gmail", "Inbox or Sent. Any conversation.", 0.32, RED), ("Click the Promise Keeper icon", "It is in the side panel on the right.", 0.52, GREEN)]
    for i, (ttl, sub, st, c) in enumerate(steps):
        a = ex(st, st + 0.07)
        step_card(d, 120, 130 + i * 134 + (1 - a) * 20, 660, i + 1, ttl, sub, a, c)
    # Gmail mock with the side rail
    m = ex(0.5, 0.58)
    if m > 0:
        card(d, (860, 130, 1240, 560), 22, a=m)
        d.rounded_rectangle((861, 131, 1239, 176), radius=21, fill=col(SOFT, m))
        d.rectangle((861, 160, 1239, 176), fill=col(SOFT, m))
        T(d, 884, 154, "Gmail", 17, INK, True, "lm", m)
        for i in range(5):
            d.rounded_rectangle((884, 200 + i * 52, 1120, 226 + i * 52), radius=8, fill=col(SOFT, m))
        d.line((1160, 190, 1160, 540), fill=col(LINE, m), width=2)
        for i, c in enumerate([BLUE, YELLOW, BLUE, (96, 125, 139)]):
            d.rounded_rectangle((1184, 200 + i * 52, 1214, 230 + i * 52), radius=8, fill=col(c, 0.85 * m))
        glow = 0.5 + 0.5 * math.sin(t * 6)
        if t > 0.66 * D:
            d.ellipse((1178, 392, 1220, 434), outline=col(BLUE, glow * m), width=4)
        paste_logo(im, 1199, 413, 34, m)
        cx_, cy_ = 1000 + (1199 - 1000) * ease(prog(t, 0.6 * D, 0.76 * D)), 300 + (413 - 300) * ease(prog(t, 0.6 * D, 0.76 * D))
        cursor(d, cx_, cy_, m)
        ripple(d, 1199, 413, prog(t, 0.76 * D, 0.88 * D))
        pn = ex(0.8, 0.9)
        if pn > 0:
            card(d, (1000 - (1 - pn) * 20, 190, 1150, 370), 14, a=pn)
            d.rounded_rectangle((1001, 191, 1149, 222), radius=13, fill=col(BAR, pn))
            d.rectangle((1001, 205, 1149, 222), fill=col(BAR, pn))
            T(d, 1012, 207, "Promise Keeper", 11, INK, True, "lm", pn)
            for i in range(2):
                d.rounded_rectangle((1012, 236 + i * 60, 1138, 280 + i * 60), radius=8, fill=col(SOFT, pn))
    caption(d, "Sign in. Open an email. Click the icon.", ex(0.84, 0.94))
    footer_note(d)


def s_howto2(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    T(d, W / 2, 60, "You stay in control", 44, INK, True, "mm", ex(0.02, 0.08))
    opts = [("Accept", "Adds it to Google Tasks\nand your Calendar", BLUE, "check", 0.12), ("Edit", "Fix the wording,\nthe type or the date", AMBER, "pencil", 0.3), ("Dismiss", "Not a real commitment?\nRemove it.", (154, 160, 166), "cross", 0.48)]
    for i, (name, line, c, ic, st) in enumerate(opts):
        a = ex(st, st + 0.08)
        x = 70 + i * 390
        y = 130 + (1 - a) * 30
        card(d, (x, y, x + 360, y + 300), 24, a=a)
        d.ellipse((x + 130, y + 28, x + 230, y + 128), fill=col(c, 0.14 * a))
        if ic == "check":
            check(d, x + 180, y + 78, 44, c, a, 9)
        elif ic == "cross":
            cross(d, x + 180, y + 78, 34, c, a, 9)
        else:
            d.line((x + 158, y + 100, x + 196, y + 62), fill=col(c, a), width=11)
            d.polygon([(x + 152, y + 108), (x + 154, y + 94), (x + 166, y + 106)], fill=col(c, a))
        T(d, x + 180, y + 166, name, 34, INK, True, "mm", a)
        draw_lines_center(d, x + 180, y + 206, line, 18, MUTED, 28, a)
    pa = ex(0.6, 0.7)
    if pa > 0:
        card(d, (W / 2 - 330, 480, W / 2 + 330, 570), 22, a=pa)
        T(d, W / 2, 525, "Nothing is added until you decide.", 30, INK, True, "mm", pa)
        for i, (lab, c) in enumerate([("Google Tasks", BLUE), ("Google Calendar", RED)]):
            chip(d, W / 2 - 170 + i * 190, 592, lab, WHITE, c, 16, pa)
    caption(d, "Accept. Edit. Dismiss. Your call.", ex(0.84, 0.94))
    footer_note(d)


def s_recap(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    T(d, W / 2, 64, "That is all it takes", 48, INK, True, "mm", ex(0.02, 0.1))
    steps = [("Sign in once", "Connect your Google account", BLUE, 0.1), ("Open an email", "The panel shows what it found", RED, 0.28), ("Accept what is right", "Tasks and Calendar update", GREEN, 0.46)]
    for i, (ttl, sub, c, st) in enumerate(steps):
        a = ex(st, st + 0.08)
        x = 70 + i * 390
        y = 130 + (1 - a) * 30
        card(d, (x, y, x + 360, y + 190), 24, a=a)
        d.ellipse((x + 28, y + 30, x + 92, y + 94), fill=col(c, a))
        T(d, x + 60, y + 62, str(i + 1), 34, WHITE, True, "mm", a)
        T(d, x + 28, y + 130, ttl, 28, INK, True, "lm", a)
        T(d, x + 28, y + 164, sub, 16, MUTED, False, "lm", a)
    pa = ex(0.6, 0.72)
    if pa > 0:
        confetti(d, t, 150, 1130, 430, 30, pa)
        d.ellipse((W / 2 - 90, 470, W / 2 + 90, 650), fill=col(GREEN, pa))
        check(d, W / 2, 565, 90, WHITE, pa, 18)
    T(d, W / 2, 360, "Promise Keeper does the rest.", 34, BLUE, True, "mm", ex(0.58, 0.7))


def s_spot(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    persona(d, ex(0.0, 0.06))
    mail_pane(im, d)
    pt = prog(t, 0.14 * D, 0.5 * D)
    hl = ex(0.5, 0.58)
    if hl > 0:
        sx = 90 + tw(d, "Sure. ", 19)
        w_ = tw(d, "I'll send the revised budget by Friday.", 19)
        d.rounded_rectangle((sx - 4, 346, sx + w_ + 4, 380), radius=6, fill=col(YELLOW, 0.5 * hl))
    draw_lines(d, 90, 286, type_text(BODY, pt), 19, INK, 30)
    sl = ex(0.6, 0.72)
    box = panel(im, d, 1.0, int((1 - sl) * 440))
    if sl > 0:
        sc = ex(0.62, 0.7)
        T(d, box[0] + 24, box[1] + 76, "Scanning…", 15, MUTED, False, "lm", (1 - ex(0.66, 0.7)) * sc)
        c = ex(0.7, 0.78)
        if c > 0:
            item_card(d, box[0] + 20, box[1] + 68 + (1 - c) * 20, 380, "my_promise", "Send revised budget", "FRI 20 NOV  ·  This week", "I'll send the revised budget by Friday.", a=c, buttons=[("Accept", True), ("Edit", False), ("Dismiss", False)], who="Daniel Okafor (Finance)")
        ln = ex(0.76, 0.86)
        if ln > 0:
            d.line((690, 363, 690 + 110 * ln, 363), fill=col(YELLOW, 1), width=3)
    caption(d, "Finds the promise. Picks the date. Quotes the sentence.", ex(0.8, 0.9))
    footer_note(d)


def s_accept(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    persona(d)
    mail_pane(im, d)
    sx, w_ = 90 + tw(d, "Sure. ", 19), tw(d, "I'll send the revised budget by Friday.", 19)
    d.rounded_rectangle((sx - 4, 346, sx + w_ + 4, 380), radius=6, fill=col(YELLOW, 0.5))
    draw_lines(d, 90, 286, BODY, 19, INK, 30)
    box = panel(im, d)
    click = ex(0.34, 0.4)
    status = "Accepted" if t > 0.4 * D else "Suggested"
    rects, h = item_card(d, box[0] + 20, box[1] + 68, 380, "my_promise", "Send revised budget", "FRI 20 NOV  ·  This week", "I'll send the revised budget by Friday.", who="Daniel Okafor (Finance)",
                         status=status, buttons=[("Done", True), ("Edit", False), ("Dismiss", False)] if t > 0.4 * D else [("Accept", True), ("Edit", False), ("Dismiss", False)],
                         press="Accept" if 0.34 * D < t < 0.4 * D else None)
    # cursor travels to Accept
    tx, ty = box[0] + 20 + 16 + 38, box[1] + 68 + 184 - 46 + 17
    cp = ex(0.05, 0.32)
    cx, cy = 1180 - (1180 - tx) * cp, 520 - (520 - ty) * cp
    if t < 0.62 * D:
        cursor(d, cx, cy)
    ripple(d, tx, ty, prog(t, 0.34 * D, 0.46 * D))
    a1 = ex(0.46, 0.56)
    if a1 > 0:
        y = box[1] + 266 + (1 - a1) * 24
        card(d, (box[0] + 20, y, box[0] + 400, y + 84), 14, a=a1)
        d.rounded_rectangle((box[0] + 36, y + 22, box[0] + 76, y + 62), radius=10, fill=col(BLUE, a1))
        check(d, box[0] + 56, y + 42, 22, WHITE, a1)
        T(d, box[0] + 92, y + 30, "Google Tasks", 14, MUTED, True, "lm", a1)
        T(d, box[0] + 92, y + 56, "Send revised budget", 18, INK, True, "lm", a1)
    a2 = ex(0.62, 0.72)
    if a2 > 0:
        y = box[1] + 362 + (1 - a2) * 24
        card(d, (box[0] + 20, y, box[0] + 400, y + 84), 14, a=a2)
        d.rounded_rectangle((box[0] + 36, y + 14, box[0] + 80, y + 70), radius=10, fill=col(WHITE, a2), outline=col(RED, a2), width=2)
        T(d, box[0] + 58, y + 29, "FRI", 11, RED, True, "mm", a2)
        T(d, box[0] + 58, y + 52, "20", 22, INK, True, "mm", a2)
        T(d, box[0] + 96, y + 30, "Google Calendar", 14, MUTED, True, "lm", a2)
        T(d, box[0] + 96, y + 56, "Deadline: revised budget", 18, INK, True, "lm", a2)
    caption(d, "One tap. Task and calendar entry, done.", ex(0.8, 0.9))
    footer_note(d)


def s_requests(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    persona(d)
    window(d, (60, 110, 760, 650), "Inbox")
    rows = [("Sofia Reyes", "Manager", "Deck for Thursday", "Can you review the deck by end of day?", 0.12),
            ("Omar Khan", "Lumen Supplies", "Your order", "We'll ship your order on Monday.", 0.46)]
    for i, (who, role, subj, snip, st) in enumerate(rows):
        a = ex(st, st + 0.08)
        y = 170 + i * 120 + (1 - a) * 20
        card(d, (84, y, 736, y + 100), 14, a=a)
        avatar(d, 124, y + 50, 22, who[0], [(251, 140, 0), (0, 150, 136)][i], a)
        T(d, 164, y + 30, who, 17, INK, True, "lm", a)
        T(d, 164 + tw(d, who, 17, True) + 12, y + 30, role, 13, MUTED, False, "lm", a)
        T(d, 164, y + 56, subj, 16, INK, True, "lm", a)
        T(d, 164, y + 80, snip, 15, MUTED, False, "lm", a)
    box = panel(im, d)
    c1 = ex(0.22, 0.32)
    if c1 > 0:
        item_card(d, box[0] + 20, box[1] + 68 + (1 - c1) * 20, 380, "request_to_me", "Review the deck", "MON 23 NOV  ·  Due today", "Can you review the deck by end of day?", a=c1, who="Sofia Reyes (Manager)", dcol=(176, 96, 0))
    c2 = ex(0.56, 0.66)
    if c2 > 0:
        item_card(d, box[0] + 20, box[1] + 226 + (1 - c2) * 20, 380, "waiting_on", "Ship the order", "MON 23 NOV  ·  Due today", "We'll ship your order on Monday.", a=c2, who="Omar Khan (Lumen Supplies)", dcol=(176, 96, 0))
    caption(d, "What she owes. What she's waiting on.", ex(0.8, 0.9))
    footer_note(d)


def s_digest(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    persona(d)
    window(d, (170, 110, 1110, 650), "Your morning digest")
    d.rounded_rectangle((171, 156, 1109, 649), radius=0, fill=col((241, 243, 244)))
    d.rounded_rectangle((200, 170, 1080, 636), radius=18, fill=col(WHITE))
    T(d, 230, 196, "PROMISE", 13, BLUE, True, "lm")
    T(d, 230 + tw(d, "PROMISE ", 13, True), 196, "KEEPER", 13, RED, True, "lm")
    T(d, 230, 232, "Good morning", 30, INK, True, "lm")
    T(d, 230, 266, "Here is what needs you today.", 15, MUTED, False, "lm")
    stats = [("Overdue", 1, RED, 0.12), ("Due today", 2, AMBER, 0.22), ("This week", 3, BLUE, 0.32), ("Waiting on others", 2, GREEN, 0.42)]
    for i, (lab, n, c, st) in enumerate(stats):
        a = ex(st, st + 0.08)
        x = 230 + i * 212
        d.rounded_rectangle((x, 292, x + 196, 372), radius=14, fill=col((248, 249, 250), a))
        T(d, x + 98, 326 + (1 - a) * 8, str(int(n * ex(st, st + 0.14) + 0.0001) if a > 0.5 else 0), 38, c, True, "mm", a)
        T(d, x + 98, 357, lab, 13, MUTED, False, "mm", a)
    items = [("Send signed NDA to Legal", RED, "Legal  ·  due 21 Nov", False), ("Review the deck", AMBER, "Sofia Reyes  ·  due today", False),
             ("Ship the order", GREEN, "Omar Khan  ·  due 23 Nov", True)]
    for i, (what, c, meta, late) in enumerate(items):
        a = ex(0.56 + i * 0.1, 0.64 + i * 0.1)
        y = 394 + i * 76 + (1 - a) * 12
        d.rounded_rectangle((230, y, 1050, y + 64), radius=12, outline=col(LINE, a), width=1, fill=col(WHITE, a))
        d.rounded_rectangle((230, y, 236, y + 64), radius=3, fill=col(c, a))
        T(d, 256, y + 24, what, 18, INK, True, "lm", a)
        if late:
            chip(d, 256 + tw(d, what, 18, True) + 12, y + 11, "LATE", (197, 34, 31), (252, 232, 230), 11, a)
        T(d, 256, y + 46, meta, 13, MUTED, False, "lm", a)
        bw = int(tw(d, "Open thread", 13, True)) + 28
        d.rounded_rectangle((1030 - bw, y + 16, 1030, y + 48), radius=16, fill=col((232, 240, 254), a))
        T(d, 1030 - bw / 2, y + 32, "Open thread", 13, BLUE, True, "mm", a)
    caption(d, "One email. Everything that matters.", ex(0.82, 0.92))
    footer_note(d)


def s_dashboard(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    d.rectangle((0, 0, W, 64), fill=col(WHITE))
    paste_logo(im, 60, 32, 36, 1.0)
    wordmark(d, 200, 32, 22)
    for k, (lab, on) in enumerate([("Items", True), ("Metrics", False), ("Eval", False), ("Settings", False)]):
        x = 380 + k * 100
        if on:
            d.rounded_rectangle((x - 40, 18, x + 40, 48), radius=15, fill=col((232, 240, 254)))
        T(d, x, 33, lab, 15, (25, 103, 210) if on else MUTED, True, "mm")
    seg = W // 4
    for k, c in enumerate([BLUE, RED, YELLOW, GREEN]):
        d.rectangle((k * seg, 62, (k + 1) * seg, 65), fill=col(c))
    d.rectangle((0, 65, W, H), fill=col((248, 249, 250)))
    T(d, 120, 104, "Your promises", 34, INK, True, "lm", ex(0.02, 0.08))
    click = 0.42
    sel = t > click * D
    tiles = [("Overdue", 0, RED), ("Due today", 2, AMBER), ("To review", 3, BLUE), ("Waiting on others", 2, GREEN)]
    for i, (lab, n, c) in enumerate(tiles):
        a = ex(0.06 + i * 0.04, 0.14 + i * 0.04)
        x = 120 + i * 262
        d.rounded_rectangle((x, 140, x + 246, 226), radius=16, fill=col(WHITE, a), outline=col(c, a) if (sel and lab == "Due today") else col(LINE, a), width=3 if (sel and lab == "Due today") else 1)
        T(d, x + 123, 176, str(n), 36, c, True, "mm", a)
        T(d, x + 123, 208, lab, 13, MUTED, False, "mm", a)
    tx, ty = 120 + 262 + 123, 190
    cp = ex(0.22, 0.4)
    cx_, cy_ = 1050 - (1050 - tx) * cp, 520 - (520 - ty) * cp
    if t < 0.75 * D:
        cursor(d, cx_, cy_)
    ripple(d, tx, ty, prog(t, click * D, (click + 0.1) * D))
    y = 252
    if sel:
        d.rounded_rectangle((120, y, 1160, y + 40), radius=12, fill=col((232, 240, 254)))
        T(d, 140, y + 20, "Showing:  Due today (2)", 15, (25, 103, 210), True, "lm")
        T(d, 1140, y + 20, "Clear filter", 14, BLUE, True, "rm")
        y += 56
    groups = [("Due today", (176, 96, 0), [("Review the deck", "Sofia Reyes", "Asked of me", (176, 96, 0), (254, 243, 199), "MON", "23", RED), ("Ship the order", "Omar Khan", "Waiting on them", (30, 110, 50), (230, 244, 234), "MON", "23", RED)]),
              ("This week", (25, 103, 210), [("Send the logo files", "Design team", "Waiting on them", (30, 110, 50), (230, 244, 234), "WED", "25", BLUE)])]
    gi = 0
    for gname, gc, rows in groups:
        if sel and gname != "Due today":
            continue
        a = ex(0.3, 0.38) if not sel else 1.0
        T(d, 120, y + 12, gname, 16, gc, True, "lm", a)
        y += 34
        for (what, who, kind, kfg, kbg, dow, day, dc) in rows:
            d.rounded_rectangle((120, y, 1160, y + 112), radius=18, fill=col(WHITE, a), outline=col(LINE, a), width=1)
            d.rounded_rectangle((142, y + 16, 206, y + 92), radius=12, fill=col(WHITE, a), outline=col(LINE, a), width=1)
            d.rounded_rectangle((143, y + 17, 205, y + 40), radius=11, fill=col(dc, a))
            d.rectangle((143, y + 30, 205, y + 40), fill=col(dc, a))
            T(d, 174, y + 29, dow, 11, WHITE, True, "mm", a)
            T(d, 174, y + 66, day, 28, INK, True, "mm", a)
            T(d, 232, y + 30, what, 21, INK, True, "lm", a)
            avatar(d, 244, y + 62, 12, who[0], BLUE, a)
            T(d, 264, y + 62, who, 14, INK, True, "lm", a)
            chip(d, 264 + tw(d, who, 14, True) + 12, y + 50, kind, kfg, kbg, 11, a)
            d.rounded_rectangle((232, y + 78, 1100, y + 102), radius=8, fill=col(SOFT, a))
            T(d, 246, y + 90, "“" + {"Review the deck": "Can you review the deck by end of day?", "Ship the order": "We'll ship your order on Monday.", "Send the logo files": "I'll ship the logo files by Wednesday."}[what] + "”", 12, MUTED, False, "lm", a)
            T(d, 1084, y + 90, "Open email", 12, BLUE, True, "rm", a)
            y += 124
    caption(d, "Grouped by date. One click to filter. Formulas one tap away.", ex(0.82, 0.92))
    footer_note(d)


DRAFT = "Hi Omar,\n\nJust a gentle follow-up on the order that was due Monday.\nCould you let me know where it stands?\n\nThanks,\nShubham"


def s_nudge(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    persona(d)
    window(d, (60, 110, 760, 650), "Draft  ·  To: Omar Khan  ·  Re: Your order")
    box = panel(im, d)
    rects, h = item_card(d, box[0] + 20, box[1] + 68, 380, "waiting_on", "Ship the order", "MON 23 NOV  ·  Overdue", "We'll ship your order on Monday.", status="Accepted", late=True, who="Omar Khan (Lumen Supplies)", dcol=RED,
                         buttons=[("Draft follow-up", True), ("Dismiss", False)], press="Draft follow-up" if 0.2 * D < t < 0.28 * D else None)
    r = rects["Draft follow-up"]
    tx, ty = (r[0] + r[2]) / 2, (r[1] + r[3]) / 2
    cp = ex(0.04, 0.2)
    if t < 0.7 * D:
        cursor(d, 1190 - (1190 - tx) * cp, 560 - (560 - ty) * cp)
    ripple(d, tx, ty, prog(t, 0.2 * D, 0.32 * D))
    pt = prog(t, 0.3 * D, 0.68 * D)
    if pt > 0:
        draw_lines(d, 90, 190, type_text(DRAFT, pt), 19, INK, 30)
    b = ex(0.72, 0.8)
    if b > 0:
        d.rounded_rectangle((90, 560, 730, 620), radius=14, fill=col((230, 244, 234), b), outline=col(GREEN, b), width=2)
        T(d, 410, 590, "Saved as a draft. You review it and press send.", 19, (24, 128, 56), True, "mm", b)
    caption(d, "A polite nudge, written for her. Never sent for her.", ex(0.84, 0.94))
    footer_note(d)


def s_trust(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    T(d, W / 2, 70, "Built to be trusted", 46, INK, True, "mm", ex(0.02, 0.08))
    pill = [("“ ”", "Every item quotes\nthe sentence it came from", 0.12, BLUE), ("✓", "Nothing is added\nuntil you accept", 0.24, GREEN), ("%", "Measured on 106\nreal emails", 0.36, (230, 126, 0))]
    for i, (ic, txt, st, c) in enumerate(pill):
        a = ex(st, st + 0.07)
        x = 70 + i * 390
        y = 130 + (1 - a) * 30
        card(d, (x, y, x + 360, y + 160), 20, a=a)
        d.ellipse((x + 24, y + 28, x + 84, y + 88), fill=col(c, 0.14 * a))
        if ic == "✓":
            check(d, x + 54, y + 58, 30, c, a, 6)
        else:
            T(d, x + 54, y + 58, ic, 30, c, True, "mm", a)
        draw_lines(d, x + 100, y + 38, txt, 22, INK, 32, a, True)
    # 106 dots: 97 nothing to find, 9 real commitments
    n_show = int(106 * ex(0.46, 0.72))
    for i in range(106):
        if i >= n_show:
            break
        r_, c_ = divmod(i, 27)
        cx, cy = 150 + c_ * 36, 340 + r_ * 36
        real = i in (6, 19, 33, 47, 58, 71, 84, 93, 101)
        d.ellipse((cx - 10, cy - 10, cx + 10, cy + 10), fill=col(BLUE if real else (189, 193, 198), 1.0))
    a = ex(0.62, 0.7)
    T(d, 150, 500, "97 emails with nothing to find", 18, MUTED, True, "lm", a)
    T(d, 760, 500, "9 real commitments", 18, BLUE, True, "lm", a)
    stats = [("0", "false alarms", GREEN), ("100%", "precision", BLUE), ("100%", "dates right", GREEN), ("7 of 9", "found", (230, 126, 0))]
    for i, (big, small, c) in enumerate(stats):
        a = ex(0.74 + i * 0.05, 0.82 + i * 0.05)
        x = 70 + i * 300
        card(d, (x, 540, x + 270, 680), 18, a=a)
        T(d, x + 135, 590, big, 52, c, True, "mm", a)
        T(d, x + 135, 647, small, 18, MUTED, True, "mm", a)


def icon_briefcase(d, cx, cy, c, a):
    d.rounded_rectangle((cx - 44, cy - 24, cx + 44, cy + 34), radius=10, fill=col(c, a))
    d.rounded_rectangle((cx - 16, cy - 40, cx + 16, cy - 18), radius=8, outline=col(c, a), width=6)
    d.rectangle((cx - 44, cy + 2, cx + 44, cy + 8), fill=col(WHITE, 0.6 * a))


def icon_people(d, cx, cy, c, a):
    for dx, r in ((-22, 20), (24, 17)):
        d.ellipse((cx + dx - r, cy - 34, cx + dx + r, cy - 34 + 2 * r), fill=col(c, a))
        d.pieslice((cx + dx - r - 12, cy + 4, cx + dx + r + 12, cy + 4 + 2 * (r + 20)), 180, 360, fill=col(c, a))


def icon_laptop(d, cx, cy, c, a):
    d.rounded_rectangle((cx - 40, cy - 34, cx + 40, cy + 16), radius=8, fill=col(c, a))
    d.rounded_rectangle((cx - 54, cy + 20, cx + 54, cy + 32), radius=6, fill=col(c, a))
    d.rectangle((cx - 32, cy - 26, cx + 32, cy + 8), fill=col(WHITE, 0.75 * a))


def icon_camera(d, cx, cy, c, a):
    d.rounded_rectangle((cx - 46, cy - 24, cx + 46, cy + 32), radius=12, fill=col(c, a))
    d.rectangle((cx - 20, cy - 36, cx + 14, cy - 22), fill=col(c, a))
    d.ellipse((cx - 22, cy - 14, cx + 22, cy + 28), fill=col(WHITE, 0.85 * a))
    d.ellipse((cx - 12, cy - 4, cx + 12, cy + 18), fill=col(c, a))


def s_audience(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    T(d, W / 2, 80, "Made for how you actually work", 44, INK, True, "mm", ex(0.02, 0.08))
    tiles = [("Employees", "Nothing slips\nbetween meetings", BLUE, icon_briefcase, 0.10),
             ("Managers", "A clear picture of\nwhat is owed, and by whom", GREEN, icon_people, 0.32),
             ("Freelancers", "Every client promise tracked,\nevery invoice chased", (230, 126, 0), icon_laptop, 0.54),
             ("Creators", "Sponsor deliverables and\ndeadlines, handled", RED, icon_camera, 0.76)]
    for i, (name, line, c, icon, st) in enumerate(tiles):
        a = ex(st, st + 0.08)
        x = 50 + i * 305
        y = 150 + (1 - a) * 40
        card(d, (x, y, x + 280, y + 470), 24, a=a)
        d.rounded_rectangle((x + 20, y + 20, x + 260, y + 230), radius=18, fill=col(c, 0.12 * a))
        icon(d, x + 140, y + 125, c, a)
        T(d, x + 140, y + 270, name, 32, INK, True, "mm", a)
        draw_lines_center(d, x + 140, y + 320, line, 18, MUTED, 28, a)


def draw_lines_center(d, cx, y, text, size, color, lh, a=1.0, bold=False):
    for i, ln in enumerate(text.split("\n")):
        T(d, cx, y + i * lh, ln, size, color, bold, "ma", a)


def s_outlook(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    T(d, W / 2, 70, "A different way to work with email", 42, INK, True, "mm", ex(0.02, 0.08))
    # without
    a = ex(0.08, 0.16)
    card(d, (60, 120, 620, 420), 20, a=a)
    chip(d, 84, 142, "Without", RED, (252, 232, 230), 15, a)
    for i, s in enumerate(["Search “budget”…", "Scroll through Sent…", "Hope you remember"]):
        aa = ex(0.14 + i * 0.05, 0.2 + i * 0.05)
        cross(d, 100, 214 + i * 56, 16, RED, aa)
        T(d, 128, 214 + i * 56, s, 24, INK, False, "lm", aa)
    # with
    b = ex(0.3, 0.38)
    card(d, (660, 120, 1220, 420), 20, a=b)
    chip(d, 684, 142, "With Promise Keeper", GREEN, (230, 244, 234), 15, b)
    for i, s in enumerate(["Open the panel", "Everything due, in one place", "Follow-ups drafted for you"]):
        bb = ex(0.36 + i * 0.05, 0.42 + i * 0.05)
        check(d, 700, 214 + i * 56, 20, GREEN, bb, 4)
        T(d, 728, 214 + i * 56, s, 24, INK, False, "lm", bb)
    # gmail -> outlook
    c = ex(0.58, 0.66)
    card(d, (60, 450, 1220, 600), 20, a=c)
    chip(d, 90, 478, "Gmail  ·  today", BLUE, (232, 240, 254), 18, c)
    ar = ex(0.64, 0.72)
    d.line((330, 520, 330 + 130 * ar, 520), fill=col(MUTED, c), width=4)
    if ar > 0.95:
        d.polygon([(470, 508), (490, 520), (470, 532)], fill=col(MUTED, c))
    o = ex(0.7, 0.78)
    chip(d, 500, 478, "Outlook  ·  the same idea", (0, 114, 198), (225, 240, 252), 18, o)
    chip(d, 880, 478, "A vision, not shipped yet", MUTED, SOFT, 14, o)
    T(d, 90, 560, "Every inbox, at work or at home, becomes a commitment tracker.", 22, INK, True, "lm", ex(0.78, 0.86))
    e = ex(0.86, 0.94)
    T(d, W / 2, 650, "Fewer follow-ups.  Less searching.  No more “sorry, I forgot.”", 28, BLUE, True, "mm", e)


def s_close(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    p = prog(t, 0.0, 0.3 * D)
    paste_logo(im, W / 2, 200, 190 * (0.6 + 0.4 * back(p)), ex(0, 0.2))
    wordmark(d, W / 2, 360, 70, ex(0.15, 0.4))
    T(d, W / 2, 440, "Never lose a promise in your inbox.", 34, BLUE, True, "mm", ex(0.35, 0.6))
    T(d, W / 2, 540, "github.com/BuildwShub/Promise-Keeper", 24, MUTED, True, "mm", ex(0.55, 0.8))
    for i, c in enumerate([BLUE, RED, YELLOW, GREEN]):
        a = ex(0.6 + i * 0.05, 0.75 + i * 0.05)
        d.ellipse((W / 2 - 54 + i * 36, 596, W / 2 - 38 + i * 36, 612), fill=col(c, a))


SCENE_FUNCS = [s_hook, s_problem, s_intro, s_howto1, s_spot, s_accept, s_howto2, s_requests, s_digest, s_dashboard, s_nudge, s_trust, s_audience, s_outlook, s_recap, s_close]


def render_frame(i, t, D, g):
    global CUR
    im = Image.new("RGB", (OW, OH), WHITE)
    CUR = im
    d = Pen(ImageDraw.Draw(im, "RGBA"))
    SCENE_FUNCS[i](im, d, t, D)
    # brand progress bar
    seg = W // 4
    for k, c in enumerate([BLUE, RED, YELLOW, GREEN]):
        d.rectangle((k * seg, H - 6, k * seg + max(0, min(seg, int(W * g) - k * seg)), H), fill=col(c, 1))
    return im


# ------------------------------------------------------------------ audio
def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)


VOICE = "en-US-EmmaNeural"  # female, natural and upbeat (Microsoft neural, via edge-tts)
RATE, PITCH = "+20%", "+0Hz"


def make_voice():
    TMP.mkdir(parents=True, exist_ok=True)
    durs = []
    for idx, (name, text) in enumerate(SCENES):
        raw, wav = TMP / f"{idx:02d}_{name}_raw.wav", TMP / f"{idx:02d}_{name}.wav"
        if not wav.exists():
            mp3 = TMP / f"{idx:02d}_{name}.mp3"
            run([sys.executable, "-m", "edge_tts", "--voice", VOICE, f"--rate={RATE}", f"--pitch={PITCH}", "--text", text, "--write-media", str(mp3)])
            raw = mp3
            run(["ffmpeg", "-y", "-i", str(raw), "-ar", "44100", "-ac", "2", "-af", "highpass=f=90,acompressor=threshold=-20dB:ratio=3:makeup=3,loudnorm=I=-16:TP=-1.5:LRA=7", str(wav)])
        with wave.open(str(wav)) as w:
            durs.append(w.getnframes() / w.getframerate())
    return durs


def make_music(total, path):
    """Original, royalty-free "corporate inspire" background track (108 bpm, G Em Bm C feel) made by scripts/make-music-samples.py.
    To use your own track instead, put an audio file at docs/promo/_tmp/assets/music.mp3 (or .wav)."""
    spec = importlib.util.spec_from_file_location("music_samples", ROOT / "scripts" / "make-music-samples.py")
    ms = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ms)
    ms.make("3-corporate-inspire", ms.STYLES["3-corporate-inspire"], seconds=total, path=path)


def mix_voice_music(voice, total, out_path):
    """Music sits under the voice and ducks while someone is speaking."""
    assets = TMP.parent / "_tmp" / "assets"
    user = next((p for p in (assets / "music.mp3", assets / "music.wav") if p.exists()), None)
    music = TMP / "music.wav"
    if user:
        run(["ffmpeg", "-y", "-stream_loop", "-1", "-i", str(user), "-t", f"{total + 2:.2f}", "-ar", "44100", "-ac", "2", str(music)])
    else:
        make_music(total, music)
    run(["ffmpeg", "-y", "-i", str(voice), "-i", str(music), "-filter_complex",
         "[1:a]volume=0.55[m];[0:a]asplit=2[v][sc];[m][sc]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=500:makeup=1[md];[v][md]amix=inputs=2:weights='1 1':normalize=0,acompressor=threshold=-18dB:ratio=2.5:makeup=2,loudnorm=I=-16:TP=-1.5:LRA=9",
         "-ar", "48000", str(out_path)])


def make_audio(durs, total):
    parts = []
    for idx, ((name, _), du) in enumerate(zip(SCENES, durs)):
        D = du + LEAD + TAIL
        out = TMP / f"{idx:02d}_pad.wav"
        run(["ffmpeg", "-y", "-i", str(TMP / f"{idx:02d}_{name}.wav"), "-af", f"adelay={int(LEAD*1000)}|{int(LEAD*1000)},apad=whole_dur={D:.3f}", "-t", f"{D:.3f}", "-ar", "44100", "-ac", "2", str(out)])
        parts.append(out)
    lst = TMP / "list.txt"
    lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts))
    voice = TMP / "voice.wav"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(voice)])
    mix = TMP / "mix.wav"
    mix_voice_music(voice, total, mix)
    return mix


# ------------------------------------------------------------------ main
def main():
    OUT.mkdir(parents=True, exist_ok=True)
    preview = "--preview" in sys.argv
    durs = make_voice()
    scene_d = [du + LEAD + TAIL for du in durs]
    total = sum(scene_d)
    starts = [sum(scene_d[:i]) for i in range(len(scene_d))]
    print("scene lengths (s):", [round(x, 1) for x in scene_d], "total", round(total, 1))
    if preview:
        pv = OUT / "preview"
        pv.mkdir(exist_ok=True)
        for i, (name, _) in enumerate(SCENES):
            for frac, tag in ((0.55, "a"), (0.93, "b")):
                render_frame(i, scene_d[i] * frac, scene_d[i], (starts[i] + scene_d[i] * frac) / total).save(pv / f"{i:02d}_{name}_{tag}.png")
        print("previews written to", pv)
        return
    mix = make_audio(durs, total)
    video = OUT / "promise-keeper-promo.mp4"
    ff = subprocess.Popen(["ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-", "-i", str(mix),
                           "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-tune", "animation", "-profile:v", "high", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", str(video)],
                          stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
    n = int(total * FPS)
    si = 0
    for f in range(n):
        T_ = f / FPS
        while si + 1 < len(starts) and T_ >= starts[si + 1]:
            si += 1
        ff.stdin.write(render_frame(si, T_ - starts[si], scene_d[si], T_ / total).tobytes())
        if f % 240 == 0:
            print(f"  frame {f}/{n}", flush=True)
    ff.stdin.close()
    ff.wait()
    render_frame(2, scene_d[2] * 0.85, scene_d[2], 0.2).save(OUT / "poster.png")
    print("wrote", video.relative_to(ROOT), f"{video.stat().st_size/1e6:.1f} MB, {total:.0f}s")


if __name__ == "__main__":
    main()
