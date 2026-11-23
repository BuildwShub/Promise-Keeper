"""Builds docs/promo/promise-keeper-promo.mp4: a narrated, animated, Google-style product video. Every visual is generated here.
    python scripts/make-promo-video.py            full build (voice, music, render, mux)
    python scripts/make-promo-video.py --preview  write one still per scene to docs/promo/preview/ (no video)
Voice: Microsoft neural en-US-GuyNeural (male) via the edge-tts package (pip install edge-tts). Needs Pillow and ffmpeg.
The people and company are fictional. The Outlook scene is a vision, not a shipped feature.
"""
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
W, H, FPS = 1280, 720, 24

BLUE, RED, YELLOW, GREEN = (66, 133, 244), (234, 67, 53), (251, 188, 5), (52, 168, 83)
INK, MUTED, LINE, SOFT, WHITE = (32, 33, 36), (95, 99, 104), (218, 220, 224), (241, 243, 244), (255, 255, 255)
TYPES = {
    "my_promise": ("I promised", (103, 58, 183), (237, 231, 246)),
    "request_to_me": ("Asked of me", (230, 126, 0), (255, 243, 224)),
    "deadline": ("Deadline", (217, 48, 37), (252, 232, 230)),
    "waiting_on": ("Waiting on them", (26, 115, 232), (232, 240, 254)),
}

# ------------------------------------------------------------------ narration
SCENES = [
    ("hook", 'Last Tuesday, you wrote five words: "I\'ll send it by Friday." It\'s Friday now. And that sentence is buried under two hundred emails.'),
    ("problem", "Your to-do list only knows what you type into it. But your real commitments live in your inbox: the ones you make, the ones people ask of you, and the ones others owe you. And nothing reads your Sent folder. Until now."),
    ("intro", "Meet Promise Keeper. It lives inside Gmail, reads both sides of your conversations, and quietly finds every commitment."),
    ("spot", 'Meet Maya, a product manager. She replies to her finance lead: "I\'ll send the revised budget by Friday." Promise Keeper spots the promise, works out the date, and shows the exact sentence it came from.'),
    ("accept", "One tap on Accept, and it lands in Google Tasks. Deadlines go on her calendar too."),
    ("requests", "Then her manager asks her to review a deck by end of day. And a supplier says they'll ship an order on Monday. Both appear instantly, labelled: what she owes, and what she's waiting on."),
    ("digest", "Every morning, one digest shows what's overdue, what's due today, and who owes her."),
    ("nudge", "When the supplier goes quiet, one tap writes a polite follow-up draft. She reviews it. Promise Keeper never sends anything for her."),
    ("trust", "And it has to be trustworthy. Every item quotes the sentence it came from. Nothing is added until you accept it. We tested it on one hundred and six real emails. Ninety-seven had nothing to find, and it raised zero false alarms."),
    ("audience", "For employees, nothing slips between meetings. For managers, a clear picture of what is owed. For freelancers, every client promise tracked and every invoice chased. For creators, every sponsor deliverable and deadline, handled."),
    ("outlook", 'Today, it works in Gmail. The same idea can come to Outlook, so every inbox, at work or at home, becomes a commitment tracker. Fewer follow-ups. Less searching. No more "sorry, I forgot."'),
    ("close", "Promise Keeper. Never lose a promise in your inbox."),
]
LEAD, TAIL = 0.4, 0.45  # seconds of silence before and after each line


# ------------------------------------------------------------------ drawing helpers
@lru_cache(None)
def F(size, bold=False):
    for name in (["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


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
    if a >= 0.995:
        d.text((x, y), s, font=f, fill=(c[0], c[1], c[2], 255), anchor=anchor)
        return
    l, t_, r, b = d.textbbox((x, y), s, font=f, anchor=anchor)
    pad = 2
    mask = Image.new("L", (int(r - l) + 2 * pad, int(b - t_) + 2 * pad), 0)
    ImageDraw.Draw(mask).text((x - l + pad, y - t_ + pad), s, font=f, fill=int(255 * a), anchor=anchor)
    CUR.paste((c[0], c[1], c[2]), (int(l) - pad, int(t_) - pad), mask)


def tw(d, s, size, bold=False):
    return d.textlength(s, font=F(size, bold))


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
    lg = logo_img(max(8, int(size)))
    if a < 1:
        lg = lg.copy()
        lg.putalpha(lg.getchannel("A").point(lambda v: int(v * a)))
    im.paste(lg, (int(cx - lg.width / 2), int(cy - lg.height / 2)), lg)


def item_card(d, x, y, w, typ, what, due, quote, status="Suggested", a=1.0, buttons=None, late=False, press=None):
    h = 168 if buttons else 128
    card(d, (x, y, x + w, y + h), 14, a=a)
    label, fg, bg = TYPES[typ]
    cw = chip(d, x + 16, y + 14, label, fg, bg, 12, a)
    if late:
        chip(d, x + 24 + cw, y + 14, "LATE", RED, (252, 232, 230), 12, a)
    sw = int(tw(d, status, 12, True)) + 22
    chip(d, x + w - sw - 14, y + 14, status, (60, 64, 67), SOFT, 12, a)
    T(d, x + 16, y + 56, what, 20, INK, True, "lm", a)
    T(d, x + 16, y + 82, due, 14, MUTED, False, "lm", a)
    ql = wrap(d, '"' + quote + '"', 13, w - 32)
    T(d, x + 16, y + 106, ql[0], 13, (128, 134, 139), False, "lm", a)
    rects = {}
    if buttons:
        bx = x + 16
        for name, filled in buttons:
            r = button(d, bx, y + h - 46, name, filled, a, pressed=(press == name))
            rects[name] = r
            bx = r[2] + 10
    return rects, h


def persona(d, a=1.0):
    avatar(d, 86, 52, 20, "M", (171, 71, 188), a)
    T(d, 116, 44, "Maya", 18, INK, True, "lm", a)
    T(d, 116, 64, "Product manager, Brightside Co.", 13, MUTED, False, "lm", a)


def footer_note(d, a=1.0):
    T(d, W - 40, H - 24, "Fictional example", 12, (154, 160, 166), False, "rm", a)


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
    title = type_text("Promise Keeper", prog(t, 0.28 * D, 0.46 * D))
    T(d, W / 2, 440, title, 68, INK, True, "mm")
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


BODY = "Hi Daniel,\n\nSure. I'll send the revised budget by Friday.\n\nThanks,\nMaya"


def panel(im, d, a=1.0, x_off=0):
    box = (800 + x_off, 110, 1220 + x_off, 650)
    window(d, box, "Promise Keeper", a)
    paste_logo(im, 800 + x_off + 322, 110 + 22, 22, a)
    return box


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
            item_card(d, box[0] + 20, box[1] + 62 + (1 - c) * 20, 380, "my_promise", "Send revised budget", "Due Fri 20 Nov", "I'll send the revised budget by Friday.", a=c, buttons=[("Accept", True), ("Edit", False), ("Dismiss", False)])
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
    rects, h = item_card(d, box[0] + 20, box[1] + 62, 380, "my_promise", "Send revised budget", "Due Fri 20 Nov", "I'll send the revised budget by Friday.",
                         status=status, buttons=[("Done", True), ("Edit", False), ("Dismiss", False)] if t > 0.4 * D else [("Accept", True), ("Edit", False), ("Dismiss", False)],
                         press="Accept" if 0.34 * D < t < 0.4 * D else None)
    # cursor travels to Accept
    tx, ty = box[0] + 20 + 16 + 38, box[1] + 62 + 168 - 46 + 17
    cp = ex(0.05, 0.32)
    cx, cy = 1180 - (1180 - tx) * cp, 520 - (520 - ty) * cp
    if t < 0.62 * D:
        cursor(d, cx, cy)
    ripple(d, tx, ty, prog(t, 0.34 * D, 0.46 * D))
    a1 = ex(0.46, 0.56)
    if a1 > 0:
        y = box[1] + 250 + (1 - a1) * 24
        card(d, (box[0] + 20, y, box[0] + 400, y + 84), 14, a=a1)
        d.rounded_rectangle((box[0] + 36, y + 22, box[0] + 76, y + 62), radius=10, fill=col(BLUE, a1))
        check(d, box[0] + 56, y + 42, 22, WHITE, a1)
        T(d, box[0] + 92, y + 30, "Google Tasks", 14, MUTED, True, "lm", a1)
        T(d, box[0] + 92, y + 56, "Send revised budget", 18, INK, True, "lm", a1)
    a2 = ex(0.62, 0.72)
    if a2 > 0:
        y = box[1] + 350 + (1 - a2) * 24
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
        item_card(d, box[0] + 20, box[1] + 62 + (1 - c1) * 20, 380, "request_to_me", "Review the deck", "Due today", "Can you review the deck by end of day?", a=c1)
    c2 = ex(0.56, 0.66)
    if c2 > 0:
        item_card(d, box[0] + 20, box[1] + 206 + (1 - c2) * 20, 380, "waiting_on", "Ship the order", "Omar  ·  Due Mon 23 Nov", "We'll ship your order on Monday.", a=c2)
    caption(d, "What she owes. What she's waiting on.", ex(0.8, 0.9))
    footer_note(d)


def s_digest(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    persona(d)
    window(d, (170, 110, 1110, 650), "Promise Keeper  ·  Your morning digest")
    T(d, 210, 186, "Good morning, Maya", 30, INK, True, "lm")
    T(d, 210, 220, "Here is what needs you today.", 16, MUTED, False, "lm")
    stats = [("Overdue", 1, RED, 0.12), ("Due today", 2, (230, 126, 0), 0.22), ("This week", 3, BLUE, 0.32), ("Waiting on others", 2, GREEN, 0.42)]
    for i, (lab, n, c, st) in enumerate(stats):
        a = ex(st, st + 0.08)
        x = 210 + i * 220
        card(d, (x, 250, x + 200, 350), 14, a=a)
        T(d, x + 100, 292 + (1 - a) * 10, str(int(n * ex(st, st + 0.14) + 0.0001) if a > 0.5 else 0), 44, c, True, "mm", a)
        T(d, x + 100, 328, lab, 15, MUTED, True, "mm", a)
    items = [("Overdue", RED, "Send signed NDA to Legal", "2 days late"), ("Due today", (230, 126, 0), "Review the deck", "Sofia"),
             ("Waiting on others", GREEN, "Ship the order", "Omar  ·  LATE")]
    for i, (lab, c, what, meta) in enumerate(items):
        a = ex(0.56 + i * 0.1, 0.64 + i * 0.1)
        y = 380 + i * 76 + (1 - a) * 14
        card(d, (210, y, 1070, y + 60), 12, a=a)
        d.rounded_rectangle((226, y + 14, 232, y + 46), radius=3, fill=col(c, a))
        T(d, 250, y + 30, what, 19, INK, True, "lm", a)
        T(d, 1050, y + 30, meta, 15, MUTED, False, "rm", a)
        chip(d, 250 + tw(d, what, 19, True) + 16, y + 14, lab, c, SOFT, 12, a)
    caption(d, "One email. Everything that matters.", ex(0.82, 0.92))
    footer_note(d)


DRAFT = "Hi Omar,\n\nJust a gentle follow-up on the order that was due Monday.\nCould you let me know where it stands?\n\nThanks,\nMaya"


def s_nudge(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    persona(d)
    window(d, (60, 110, 760, 650), "Draft  ·  To: Omar Khan  ·  Re: Your order")
    box = panel(im, d)
    rects, h = item_card(d, box[0] + 20, box[1] + 62, 380, "waiting_on", "Ship the order", "Omar  ·  was due Mon 23 Nov", "We'll ship your order on Monday.", status="Accepted", late=True,
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
    T(d, W / 2, 360, "Promise Keeper", 70, INK, True, "mm", ex(0.15, 0.4))
    T(d, W / 2, 440, "Never lose a promise in your inbox.", 34, BLUE, True, "mm", ex(0.35, 0.6))
    T(d, W / 2, 540, "github.com/BuildwShub/Promise-Keeper", 24, MUTED, True, "mm", ex(0.55, 0.8))
    for i, c in enumerate([BLUE, RED, YELLOW, GREEN]):
        a = ex(0.6 + i * 0.05, 0.75 + i * 0.05)
        d.ellipse((W / 2 - 54 + i * 36, 596, W / 2 - 38 + i * 36, 612), fill=col(c, a))


SCENE_FUNCS = [s_hook, s_problem, s_intro, s_spot, s_accept, s_requests, s_digest, s_nudge, s_trust, s_audience, s_outlook, s_close]


def render_frame(i, t, D, g):
    global CUR
    im = Image.new("RGB", (W, H), WHITE)
    CUR = im
    d = ImageDraw.Draw(im, "RGBA")
    SCENE_FUNCS[i](im, d, t, D)
    # brand progress bar
    seg = W // 4
    for k, c in enumerate([BLUE, RED, YELLOW, GREEN]):
        d.rectangle((k * seg, H - 6, k * seg + max(0, min(seg, int(W * g) - k * seg)), H), fill=col(c, 1))
    return im


# ------------------------------------------------------------------ audio
def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)


VOICE = "en-US-GuyNeural"  # male, energetic (Microsoft neural, via edge-tts)


def make_voice():
    TMP.mkdir(parents=True, exist_ok=True)
    durs = []
    for idx, (name, text) in enumerate(SCENES):
        raw, wav = TMP / f"{idx:02d}_{name}_raw.wav", TMP / f"{idx:02d}_{name}.wav"
        if not wav.exists():
            mp3 = TMP / f"{idx:02d}_{name}.mp3"
            run([sys.executable, "-m", "edge_tts", "--voice", VOICE, "--rate=+10%", "--pitch=+4Hz", "--text", text, "--write-media", str(mp3)])
            raw = mp3
            run(["ffmpeg", "-y", "-i", str(raw), "-ar", "44100", "-ac", "2", "-af", "highpass=f=90,acompressor=threshold=-20dB:ratio=3:makeup=3,loudnorm=I=-16:TP=-1.5:LRA=7", str(wav)])
        with wave.open(str(wav)) as w:
            durs.append(w.getnframes() / w.getframerate())
    return durs


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
    # soft ambient pad under the voice (generated, very quiet)
    chords = [(261.6, 329.6, 392.0, 493.9), (220.0, 261.6, 329.6, 392.0), (174.6, 220.0, 261.6, 329.6), (196.0, 246.9, 293.7, 329.6)]
    def notes(k):
        return "+".join(f"sin(2*PI*{c[k]}*t)" for c in chords[:1])
    sel = lambda k: f"if(lt(mod(t,24),6),{chords[0][k]},if(lt(mod(t,24),12),{chords[1][k]},if(lt(mod(t,24),18),{chords[2][k]},{chords[3][k]})))"
    expr = "0.5*(1-cos(2*PI*mod(t,6)/6))*(" + "+".join(f"sin(2*PI*({sel(k)})*t)" for k in range(4)) + ")*0.22"
    music = TMP / "music.wav"
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"aevalsrc='{expr}':s=44100:d={total:.2f}", "-af", f"lowpass=f=1400,afade=t=in:d=2,afade=t=out:st={total-3:.2f}:d=3", "-ac", "2", str(music)])
    mix = TMP / "mix.wav"
    run(["ffmpeg", "-y", "-i", str(voice), "-i", str(music), "-filter_complex", "[0:a][1:a]amix=inputs=2:weights='1 0.22':normalize=0,alimiter=limit=0.95", str(mix)])
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
    ff = subprocess.Popen(["ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", str(mix),
                           "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", str(video)],
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
