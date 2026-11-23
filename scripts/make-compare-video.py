"""Builds docs/promo/promise-keeper-evolution.mp4: the first version of Promise Keeper versus today's, with the reasoning behind each UI/UX change.
    python scripts/make-compare-video.py            full build (voice, render, mux)
    python scripts/make-compare-video.py --preview  one still per scene in docs/promo/preview-evolution/
Reuses the drawing helpers of make-promo-video.py. 'Before' images are the real first-version screenshots in docs/images/.
"""
import importlib.util
import math
import subprocess
import sys
import wave
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("promo", ROOT / "scripts" / "make-promo-video.py")
M = importlib.util.module_from_spec(spec)
sys.modules["promo"] = M
spec.loader.exec_module(M)
W, H, S, OW, OH, FPS = M.W, M.H, M.S, M.OW, M.OH, M.FPS
T, tw, col, prog, ease, card, chip, person, bubble, wordmark, check, cross = M.T, M.tw, M.col, M.prog, M.ease, M.card, M.chip, M.person, M.bubble, M.wordmark, M.check, M.cross
BLUE, RED, YELLOW, GREEN, INK, MUTED, LINE, SOFT, WHITE, AMBER = M.BLUE, M.RED, M.YELLOW, M.GREEN, M.INK, M.MUTED, M.LINE, M.SOFT, M.WHITE, M.AMBER
OUT = ROOT / "docs" / "promo"
TMP = OUT / "_tmp_evo"
VOICE = M.VOICE
LEAD, TAIL = 0.4, 0.5

SCENES = [
    ("title", "How Promise Keeper evolved. Version one worked, but it asked people to read. The new version lets people see. Here is what changed, and why."),
    ("principles", "Three ideas guided every change. Show, don't tell. Make the next step obvious. And keep the details one tap away."),
    ("sidebar", "In the Gmail sidebar, version one showed small text. The new card puts the date first, uses colour and an icon for the type, shows the person, and quotes the exact sentence. One clear button: Accept."),
    ("dashboard", "The dashboard was a flat list where every item looked the same. Now items are grouped by when they are due, with a calendar tile for the date. The summary tiles double as filters: one click, and only those items show."),
    ("digest", "The morning email was a plain bulleted list. Now it opens with four numbers, so the whole day is clear before the first scroll. Late items are flagged, and every row has one button."),
    ("metrics", "Metrics was a table of decimals, like zero point five seven one. Now percentages sit in rings, coloured green, amber or red. The formulas moved behind the i, so beginners are not overwhelmed, and experts can still check the maths."),
    ("trends", "There was also no way to see change over time. Now interactive graphs show what was found, what kind, what is due next, the digest habit, and accuracy across versions, with a date range you control."),
    ("brand", "Across every screen, one calm Google-style look: white space, rounded cards, and four brand colours. Colour always comes with a word or an icon, so it works for everyone."),
    ("global", "Why this helps a global audience. Plain words, not jargon. Universal icons. Dates you can read at a glance. Colour backed by text. Layouts that adapt to small screens. And one primary action on every card."),
    ("close", "Promise Keeper. Never lose a promise in your inbox."),
]

# ------------------------------------------------------------------ images
IMG = ROOT / "docs" / "images"
DES = ROOT / "docs" / "design"


def load(p, crop=None):
    im = Image.open(p).convert("RGB")
    return im.crop(crop) if crop else im


def old_metrics():
    im = Image.new("RGB", (800, 640), (23, 24, 26))
    d = ImageDraw.Draw(im)
    f = lambda sz, b=False: ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf" if b else "C:/Windows/Fonts/segoeui.ttf", sz)
    d.text((24, 22), "Metrics", font=f(40, True), fill=(232, 234, 237))
    d.text((24, 82), "Computed live from your items, decisions and events. Rates show n/a until there is enough data to judge.", font=f(15), fill=(154, 160, 166))
    d.text((24, 130), "Metric", font=f(16, True), fill=(232, 234, 237)); d.text((300, 130), "Value", font=f(16, True), fill=(232, 234, 237)); d.text((400, 130), "How it is computed", font=f(16, True), fill=(232, 234, 237))
    rows = [("Items found", "14", "suggested 7, accepted 4, dismissed 3, done 3"), ("Accept rate", "0.571", "accepted / (accepted + dismissed) = 4/7"), ("Edit rate", "0.429", "edited items / decided items = 3/7"),
            ("On-time rate", "0.667", "completed by due date / items with a due date = 2/3"), ("On-time rate, week 1", "0.667", "2/3 (first item 2026-11-21)"), ("On-time rate, week 4", "n/a", "0/0"),
            ("Digests sent", "6", "first digest 2026-11-21"), ("Days engaged with the digest", "3", "days with a digest open or click"), ("Digest retention, day 7", "n/a", "engaged in days 7 to 13"),
            ("Digest retention, day 30", "n/a", "engaged in days 30 to 36"), ("Extraction precision (latest eval)", "1", "EvalRuns latest: prompt v2, gate PASS")]
    for i, (a, b, c) in enumerate(rows):
        y = 166 + i * 40
        d.line((24, y - 6, 776, y - 6), fill=(60, 64, 67))
        d.text((24, y + 4), a, font=f(15), fill=(232, 234, 237)); d.text((300, y + 4), b, font=f(15, True), fill=(232, 234, 237)); d.text((400, y + 4), c, font=f(13), fill=(154, 160, 166))
    return im


def after_frames():
    names = [n for n, _ in M.SCENES]
    def fr(name, frac=0.93):
        i = names.index(name)
        return M.render_frame(i, 10 * frac, 10, 0.5)
    sp, dg, dj = fr("spot"), fr("dashboard"), fr("digest")
    s = S
    return {
        "sidebar": sp.crop((int(800 * s), int(110 * s), int(1220 * s), int(340 * s))),
        "dashboard": dg.crop((int(100 * s), int(70 * s), int(1180 * s), int(470 * s))),
        "digest": dj.crop((int(200 * s), int(170 * s), int(1080 * s), int(632 * s))),
    }


ASSETS = {}


def assets():
    if ASSETS:
        return ASSETS
    a = after_frames()
    ASSETS.update({
        "b_sidebar": load(IMG / "sidebar-in-gmail.png", (1290, 0, 1615, 330)), "a_sidebar": a["sidebar"],
        "b_dashboard": load(IMG / "items-dashboard.png"), "a_dashboard": a["dashboard"],
        "b_digest": load(IMG / "digest-email.png", (70, 66, 860, 300)), "a_digest": a["digest"],
        "b_metrics": old_metrics(), "a_metrics": load(DES / "metrics-option-a-plus-v3.png", (0, 110, 1600, 1860)),
        "a_trends": load(DES / "built-graphs.png", (60, 120, 940, 1240)),
    })
    return ASSETS


# ------------------------------------------------------------------ drawing
def shot(im, d, img, box, a=1.0, bg=SOFT):
    x0, y0, x1, y1 = box
    card(d, box, 18, fill=bg, a=a)
    pw, ph = (x1 - x0 - 24), (y1 - y0 - 24)
    sc = min(pw / img.width, ph / img.height)
    w, h = int(img.width * sc * S), int(img.height * sc * S)
    pic = img.resize((max(2, w), max(2, h)), Image.LANCZOS)
    mask = Image.new("L", pic.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, pic.size[0] - 1, pic.size[1] - 1), radius=int(10 * S), fill=int(255 * a))
    px, py = int((x0 + (x1 - x0) / 2) * S - w / 2), int((y0 + (y1 - y0) / 2) * S - h / 2)
    im.paste(pic, (px, py), mask)


def tag(d, x, y, text, kind, a=1.0):
    if kind == "before":
        chip(d, x, y, text, (95, 99, 104), (232, 234, 237), 14, a)
    else:
        chip(d, x, y, text, (25, 103, 210), (232, 240, 254), 14, a)


def compare(im, d, t, D, title, before, after, problem, gains, b_box=None, a_box=None):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    T(d, W / 2, 50, title, 38, INK, True, "mm", ex(0.0, 0.07))
    lb = ex(0.05, 0.14)
    bb = b_box or (50, 132, 620, 566)
    ab = a_box or (660, 132, 1230, 566)
    off = int((1 - lb) * -60)
    shot(im, d, before, (bb[0] + off, bb[1], bb[2] + off, bb[3]), lb)
    tag(d, bb[0] + off, bb[1] - 38, "Version 1", "before", lb)
    rb = ex(0.34, 0.44)
    off2 = int((1 - rb) * 60)
    shot(im, d, after, (ab[0] + off2, ab[1], ab[2] + off2, ab[3]), rb, WHITE)
    tag(d, ab[0] + off2, ab[1] - 38, "Now", "after", rb)
    ar = ex(0.3, 0.4)
    if ar > 0:
        M.T(d, 640, 330, "→", 56, BLUE, True, "mm", ar)
    pl = ex(0.16, 0.26)
    T(d, 62, 590, "The problem", 15, RED, True, "lm", pl)
    for i, ln in enumerate(M.wrap(d, problem, 17, 520)):
        T(d, 62, 616 + i * 24, ln, 17, MUTED, False, "lm", pl)
    T(d, 732, 590, "What changed", 15, GREEN, True, "lm", ex(0.46, 0.54))
    for i, g_ in enumerate(gains):
        a_ = ex(0.5 + i * 0.1, 0.58 + i * 0.1)
        y = 618 + i * 28
        d.ellipse((732, y - 9, 750, y + 9), fill=col(GREEN, a_))
        check(d, 741, y, 9, WHITE, a_, 2)
        T(d, 762, y, g_, 17, INK, True, "lm", a_)
    M.footer_note(d)


def s_title(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    T(d, W / 2, 80, "How Promise Keeper evolved", 52, INK, True, "mm", ex(0.02, 0.1))
    T(d, W / 2, 140, "and why the design changed", 28, MUTED, False, "mm", ex(0.06, 0.14))
    steps = [("Version 1", "Gmail add-on and a spreadsheet", "Worked. Dense text.", (154, 160, 166), 0.2), ("Version 2", "Web app and database", "Faster. Still plain.", AMBER, 0.38), ("Today", "Redesigned for everyone", "Clear at a glance.", BLUE, 0.56)]
    for i, (n, sub, res, c, st) in enumerate(steps):
        a = ex(st, st + 0.08)
        x = 70 + i * 390
        y = 230 + (1 - a) * 30
        card(d, (x, y, x + 360, y + 220), 24, a=a)
        d.rounded_rectangle((x + 24, y + 24, x + 24 + 140, y + 62), radius=19, fill=col(c, 0.18 * a))
        T(d, x + 94, y + 43, n, 18, c if c != (154, 160, 166) else MUTED, True, "mm", a)
        T(d, x + 24, y + 110, sub, 20, INK, True, "lm", a)
        T(d, x + 24, y + 150, res, 18, MUTED, False, "lm", a)
        if i < 2 and a > 0.8:
            T(d, x + 375, y + 110, "›", 44, BLUE, True, "mm", a)


def s_principles(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    T(d, W / 2, 70, "Three ideas behind every change", 44, INK, True, "mm", ex(0.02, 0.1))
    ps = [("See", "Show, don't tell", "Dates, colours and icons carry the meaning, so people do not have to read paragraphs.", BLUE, 0.14), ("Act", "Make the next step obvious", "One primary button per card. The thing to do next is never a puzzle.", GREEN, 0.34), ("Dig", "Details one tap away", "Formulas and explanations live behind the i. Beginners stay calm, experts can still check.", AMBER, 0.54)]
    for i, (k, ttl, body, c, st) in enumerate(ps):
        a = ex(st, st + 0.08)
        x = 70 + i * 390
        y = 160 + (1 - a) * 30
        card(d, (x, y, x + 360, y + 400), 26, a=a)
        d.ellipse((x + 130, y + 30, x + 230, y + 130), fill=col(c, 0.16 * a))
        T(d, x + 180, y + 80, k, 30, c if c != AMBER else (176, 96, 0), True, "mm", a)
        T(d, x + 180, y + 170, ttl, 26, INK, True, "mm", a)
        for j, ln in enumerate(M.wrap(d, body, 18, 300)):
            T(d, x + 180, y + 220 + j * 28, ln, 18, MUTED, False, "mm", a)
    M.footer_note(d)


def s_sidebar(im, d, t, D):
    A = assets()
    compare(im, d, t, D, "The Gmail sidebar", A["b_sidebar"], A["a_sidebar"], "Small grey text. No icon, no colour. The date is buried in a sentence.",
            ["Date first, in colour", "Icon and colour show the type", "One clear primary button"], (130, 132, 520, 566), (760, 132, 1150, 566))


def s_dashboard(im, d, t, D):
    A = assets()
    compare(im, d, t, D, "The dashboard", A["b_dashboard"], A["a_dashboard"], "A flat list. Every item looks the same. Dense, and no way to filter.",
            ["Grouped by when it is due", "A calendar tile shows the date", "Summary tiles filter in one click"], (230, 132, 540, 566), (640, 132, 1240, 566))


def s_digest(im, d, t, D):
    A = assets()
    compare(im, d, t, D, "The morning digest", A["b_digest"], A["a_digest"], "A plain bulleted list. Nothing says what matters first.",
            ["Four numbers up top", "Colour-coded rows, late items flagged", "One button on every row"])


def s_metrics(im, d, t, D):
    A = assets()
    compare(im, d, t, D, "The Metrics page", A["b_metrics"], A["a_metrics"], "A table of decimals like 0.571, with every formula shown to everyone.",
            ["Percent in rings: green, amber, red", "A plain-English summary sentence", "Formulas behind the i"], (50, 132, 640, 566), (700, 132, 1230, 566))


def s_trends(im, d, t, D):
    A = assets()
    blank = Image.new("RGB", (800, 600), (244, 245, 246))
    bd = ImageDraw.Draw(blank)
    bd.rounded_rectangle((80, 200, 720, 400), radius=24, outline=(190, 194, 200), width=3)
    bd.text((400, 300), "No view of change over time", font=ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 30), fill=(120, 126, 132), anchor="mm")
    compare(im, d, t, D, "Trends over time", blank, A["a_trends"], "There was no way to see how things change from week to week.",
            ["Five interactive graphs", "You choose the date range", "Hover for the exact numbers"], (50, 132, 560, 566), (680, 132, 1230, 566))


def s_brand(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    T(d, W / 2, 50, "One look, everywhere", 38, INK, True, "mm", ex(0.0, 0.07))
    lb = ex(0.05, 0.14)
    card(d, (50, 132, 620, 566), 18, fill=(23, 24, 26), a=lb)
    tag(d, 50, 94, "Version 1", "before", lb)
    T(d, 70, 218, "Promise Keeper   Items   Metrics   Eval   Settings   Privacy", 17, (138, 180, 248), False, "lm", lb)
    d.line((70, 234, 590, 234), fill=col((60, 64, 67), lb), width=1)
    T(d, 70, 292, "Items", 34, (232, 234, 237), True, "lm", lb)
    for i in range(3):
        d.rounded_rectangle((70, 326 + i * 62, 590, 380 + i * 62), radius=8, outline=col((60, 64, 67), lb), width=1)
        d.rounded_rectangle((84, 344 + i * 62, 140, 362 + i * 62), radius=4, fill=col((236, 236, 236), lb))
    rb = ex(0.34, 0.44)
    card(d, (660, 132, 1230, 566), 18, fill=WHITE, a=rb)
    tag(d, 660, 94, "Now", "after", rb)
    paste_ok = rb > 0.5
    if paste_ok:
        M.paste_logo(im, 696, 214, 32, rb)
    wordmark(d, 850, 214, 20, rb)
    for k, c in enumerate([BLUE, RED, YELLOW, GREEN]):
        d.rectangle((662 + k * 142, 238, 662 + (k + 1) * 142, 241), fill=col(c, rb))
    for i, (lab, n, c) in enumerate([("Overdue", 0, RED), ("Due today", 2, AMBER), ("To review", 3, BLUE), ("Waiting", 2, GREEN)]):
        x = 684 + i * 130
        d.rounded_rectangle((x, 262, x + 118, 330), radius=12, fill=col((248, 249, 250), rb), outline=col(LINE, rb), width=1)
        T(d, x + 59, 288, str(n), 26, c, True, "mm", rb)
        T(d, x + 59, 314, lab, 12, MUTED, False, "mm", rb)
    for i in range(2):
        d.rounded_rectangle((684, 348 + i * 100, 1206, 436 + i * 100), radius=14, fill=col(WHITE, rb), outline=col(LINE, rb), width=1)
        d.rounded_rectangle((700, 362 + i * 100, 752, 422 + i * 100), radius=8, outline=col(LINE, rb), width=1)
        d.rounded_rectangle((701, 363 + i * 100, 751, 380 + i * 100), radius=7, fill=col(RED, rb))
        T(d, 726, 404 + i * 100, "23", 20, INK, True, "mm", rb)
        T(d, 774, 380 + i * 100, ["Review the deck", "Ship the order"][i], 17, INK, True, "lm", rb)
        chip(d, 774, 398 + i * 100, ["Asked of me", "Waiting on them"][i], M.TYPES["request_to_me" if i == 0 else "waiting_on"][1], M.TYPES["request_to_me" if i == 0 else "waiting_on"][2], 11, rb)
    ar = ex(0.3, 0.4)
    if ar > 0:
        T(d, 640, 330, "→", 56, BLUE, True, "mm", ar)
    T(d, 62, 590, "The problem", 15, RED, True, "lm", ex(0.16, 0.26))
    for i, ln in enumerate(M.wrap(d, "The default browser look. No identity, no consistent colour or spacing.", 17, 520)):
        T(d, 62, 616 + i * 24, ln, 17, MUTED, False, "lm", ex(0.16, 0.26))
    T(d, 732, 590, "What changed", 15, GREEN, True, "lm", ex(0.46, 0.54))
    for i, g_ in enumerate(["White space and rounded cards", "Four brand colours, always with a word or icon", "One wordmark and logo everywhere"]):
        a_ = ex(0.5 + i * 0.1, 0.58 + i * 0.1)
        y = 618 + i * 28
        d.ellipse((732, y - 9, 750, y + 9), fill=col(GREEN, a_))
        check(d, 741, y, 9, WHITE, a_, 2)
        T(d, 762, y, g_, 17, INK, True, "lm", a_)
    M.footer_note(d)


def s_global(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    T(d, W / 2, 56, "Why this works for a global audience", 42, INK, True, "mm", ex(0.02, 0.1))
    items = [("Plain words", "No jargon. Short labels like Accept, Edit, Dismiss.", BLUE), ("Universal icons", "Check, clock, calendar, person. They read in any language.", RED),
             ("Dates at a glance", "Weekday and day number in a calendar tile.", AMBER), ("Colour plus text", "Green, amber and red always come with a word, so it works for colour-blind users.", GREEN),
             ("Adapts to screens", "Cards stack on small screens. Readable on a phone.", BLUE), ("One main action", "Each card has one primary button. No decision fatigue.", RED)]
    for i, (ttl, body, c) in enumerate(items):
        a = ex(0.1 + i * 0.1, 0.18 + i * 0.1)
        x = 60 + (i % 3) * 394
        y = 130 + (i // 3) * 226 + (1 - a) * 20
        card(d, (x, y, x + 370, y + 206), 22, a=a)
        d.ellipse((x + 24, y + 24, x + 76, y + 76), fill=col(c, 0.16 * a))
        T(d, x + 50, y + 50, str(i + 1), 24, c if c != AMBER else (176, 96, 0), True, "mm", a)
        T(d, x + 92, y + 50, ttl, 23, INK, True, "lm", a)
        for j, ln in enumerate(M.wrap(d, body, 17, 320)):
            T(d, x + 24, y + 108 + j * 26, ln, 17, MUTED, False, "lm", a)
    M.footer_note(d)


def s_close(im, d, t, D):
    ex = lambda a, b: ease(prog(t, a * D, b * D))
    M.paste_logo(im, W / 2, 180, 150 * (0.6 + 0.4 * M.back(prog(t, 0, 0.3 * D))), ex(0, 0.2))
    wordmark(d, W / 2, 320, 64, ex(0.15, 0.4))
    T(d, W / 2, 400, "Never lose a promise in your inbox.", 32, BLUE, True, "mm", ex(0.35, 0.6))


SCENE_FUNCS = [s_title, s_principles, s_sidebar, s_dashboard, s_digest, s_metrics, s_trends, s_brand, s_global, s_close]


def render_frame(i, t, D, g):
    im = Image.new("RGB", (OW, OH), WHITE)
    M.CUR = im
    d = M.Pen(ImageDraw.Draw(im, "RGBA"))
    SCENE_FUNCS[i](im, d, t, D)
    seg = W // 4
    for k, c in enumerate([BLUE, RED, YELLOW, GREEN]):
        d.rectangle((k * seg, H - 6, k * seg + max(0, min(seg, int(W * g) - k * seg)), H), fill=col(c, 1))
    return im


# ------------------------------------------------------------------ audio
def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def make_voice():
    TMP.mkdir(parents=True, exist_ok=True)
    durs = []
    for idx, (name, text) in enumerate(SCENES):
        mp3, wav = TMP / f"{idx:02d}_{name}.mp3", TMP / f"{idx:02d}_{name}.wav"
        if not wav.exists():
            run([sys.executable, "-m", "edge_tts", "--voice", VOICE, f"--rate={M.RATE}", f"--pitch={M.PITCH}", "--text", text, "--write-media", str(mp3)])
            run(["ffmpeg", "-y", "-i", str(mp3), "-ar", "44100", "-ac", "2", "-af", "highpass=f=90,acompressor=threshold=-20dB:ratio=3:makeup=3,loudnorm=I=-16:TP=-1.5:LRA=7", str(wav)])
        with wave.open(str(wav)) as w:
            durs.append(w.getnframes() / w.getframerate())
    return durs


def make_audio(durs):
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
    M.TMP = TMP
    M.mix_voice_music(voice, sum(durs) + len(durs) * (LEAD + TAIL), mix)
    return mix


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    durs = make_voice()
    scene_d = [du + LEAD + TAIL for du in durs]
    total = sum(scene_d)
    starts = [sum(scene_d[:i]) for i in range(len(scene_d))]
    print("scene lengths (s):", [round(x, 1) for x in scene_d], "total", round(total, 1), flush=True)
    assets()
    if "--preview" in sys.argv:
        pv = OUT / "preview-evolution"
        pv.mkdir(exist_ok=True)
        for i, (name, _) in enumerate(SCENES):
            render_frame(i, scene_d[i] * 0.93, scene_d[i], (starts[i] + scene_d[i] * 0.93) / total).save(pv / f"{i:02d}_{name}.png")
        print("previews written to", pv)
        return
    mix = make_audio(durs)
    video = OUT / "promise-keeper-evolution.mp4"
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
        if f % 300 == 0:
            print(f"  frame {f}/{n}", flush=True)
    ff.stdin.close()
    ff.wait()
    print("wrote", video.relative_to(ROOT), f"{video.stat().st_size/1e6:.1f} MB, {total:.0f}s", flush=True)


if __name__ == "__main__":
    main()
