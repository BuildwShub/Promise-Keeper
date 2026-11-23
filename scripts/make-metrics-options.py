"""Metrics page mock-ups with the real numbers (design review only). Run: python scripts/make-metrics-options.py"""
import sys, math
sys.path.insert(0, "scripts")
from PIL import Image, ImageDraw
import importlib; U = importlib.import_module("make-ui-options")
from importlib import import_module
Cv, F, B, R, Y, G, INK, MUT, LINE, SOFT, K, tint = U.Cv, U.F, U.B, U.R, U.Y, U.G, U.INK, U.MUT, U.LINE, U.SOFT, U.K, U.tint
GREY = (154,160,166)

def ring(c, cx, cy, r, pct, col, th=14):
    bb = [(cx-r)*K, (cy-r)*K, (cx+r)*K, (cy+r)*K]
    c.d.arc(bb, -90, 270, fill=(232,234,237), width=th*K)
    if pct: c.d.arc(bb, -90, -90 + 360*pct, fill=col, width=th*K)
def info(c, x, y): c.glyph("info", x, y, GREY, .8)
def bar(c, x, y, w, pct, col, h=8):
    c.rr(x, y, w, h, h/2, SOFT)
    if pct: c.rr(x, y, max(h, w*pct), h, h/2, col)
def head(c, name, sub):
    c.d.rectangle([0, 0, 800*K, 4*K], fill=B); c.t(40, 24, name, F(15, "s"), MUT); c.t(40, 50, "Metrics", F(30, "b")); info(c, 150, 70); c.t(40, 94, sub, F(14), MUT)

# ---- A: scorecard with rings
def opt_a():
    c = Cv(800, 760); head(c, "Option A: Scorecard", "How well Promise Keeper is working for you, from your own items and decisions.")
    cards = [("Accept rate", .571, B, "57%", "4 of 7 suggestions accepted"), ("On-time rate", .667, G, "67%", "2 of 3 finished by their date"), ("Extraction precision", 1.0, Y, "100%", "Latest check · prompt v2 · gate PASS")]
    for i, (t, p, col, big, sub) in enumerate(cards):
        x = 40 + i*244; c.rr(x, 130, 228, 230, 20, (255,255,255), None, True)
        c.t(x+20, 148, t, F(14, "s"), MUT); info(c, x+206, 156)
        ring(c, x+114, 236, 52, p, col); c.t(x+114, 236, big, F(26, "b"), INK, "mm")
        c.t(x+114, 316, sub, F(12), MUT, "mm")
    c.t(40, 386, "Your items", F(16, "b"))
    items = [("Found", "14", B), ("Suggested", "7", B), ("Accepted", "4", G), ("Dismissed", "3", GREY), ("Done", "3", G)]
    for i, (t, v, col) in enumerate(items):
        x = 40 + i*146; c.rr(x, 416, 134, 80, 16, (255,255,255), None, True); c.t(x+16, 430, v, F(28, "b"), col); c.t(x+16, 468, t, F(13), MUT)
    c.t(40, 530, "Morning digest", F(16, "b"))
    c.rr(40, 560, 354, 86, 16, (255,255,255), None, True); c.t(58, 574, "6", F(28, "b"), B); c.t(58, 612, "Digests sent · first on 21 Nov", F(13), MUT)
    c.rr(406, 560, 354, 86, 16, (255,255,255), None, True); c.t(424, 574, "3", F(28, "b"), G); c.t(424, 612, "Days you opened or clicked the digest", F(13), MUT)
    for i, t in enumerate(("Day 7 retention", "Day 30 retention")):
        x = 40 + i*366; c.rr(x, 662, 354, 70, 16, None, (218,220,224)); c.t(x+18, 676, t, F(14, "s"), MUT); c.t(x+18, 702, "Not enough data yet. Shows after a week of use.", F(12), GREY)
    c.save("docs/design/metrics-option-a-scorecard.png")

# ---- B: plain-language insights with bars
def opt_b():
    c = Cv(800, 820); head(c, "Option B: Plain-language insights", "Every number says what it means, with a bar to read it at a glance.")
    c.rr(40, 126, 720, 84, 20, tint(B, .12)); c.t(64, 142, "You accepted 4 of 7 suggestions.", F(20, "b"), (25,103,210)); c.t(64, 176, "2 of 3 dated items were finished on time. Nothing was a false alarm in the latest check.", F(13), (25,103,210))
    def section(y, title, rows):
        h = 56 + len(rows)*62
        c.rr(40, y, 720, h, 20, (255,255,255), None, True); c.t(64, y+18, title, F(16, "b"))
        for i, (lbl, val, pct, col, note) in enumerate(rows):
            yy = y + 58 + i*62
            c.t(64, yy, lbl, F(14, "s")); info(c, 64 + c.tw(lbl, F(14, "s")) + 16, yy+10); c.t(736, yy, val, F(16, "b"), col if pct is not None else GREY, "ra")
            if pct is not None: bar(c, 64, yy+28, 672, pct, col)
            else: c.t(64, yy+26, note, F(12), GREY)
        return y + h + 16
    y = section(226, "Quality", [("Accept rate", "57%", .571, B, ""), ("Edit rate", "43%", .429, Y, ""), ("Extraction precision", "100%", 1.0, G, "")])
    y = section(y, "Getting things done", [("On-time rate", "67%", .667, G, ""), ("On-time rate, week 1", "67%", .667, G, ""), ("On-time rate, week 4", "Not enough data yet", None, GREY, "Appears once week 4 has judged items.")])
    c.save("docs/design/metrics-option-b-insights.png")

# ---- C: hero + gauges + status pills
def opt_c():
    c = Cv(800, 780); head(c, "Option C: Hero + status", "One big number, then grouped cards with a clear status on each.")
    c.rr(40, 126, 720, 150, 22, B)
    c.t(70, 146, "Items found", F(15, "s"), (255,255,255)); c.t(70, 170, "14", F(64, "b"), (255,255,255))
    segs = [("Suggested", 7, (255,255,255)), ("Accepted", 4, (174,203,250)), ("Dismissed", 3, (130,170,245)), ("Done", 3, (100,150,240))]
    x = 280
    for t, n, col in segs:
        c.rr(x, 150, 108, 100, 16, (255,255,255, 36) if False else (90,145,246)); c.t(x+54, 188, str(n), F(30, "b"), (255,255,255), "mm"); c.t(x+54, 226, t, F(12, "s"), (255,255,255), "mm"); x += 118
    def card(x, y, w, h, title, big, sub, status, scol, pct=None, col=B):
        c.rr(x, y, w, h, 20, (255,255,255), None, True); c.t(x+20, y+16, title, F(14, "s"), MUT); info(c, x+w-24, y+24)
        c.t(x+20, y+42, big, F(34, "b"), col if status != "Building data" else GREY); c.t(x+20, y+88, sub, F(12), MUT)
        wd = c.pill(x+20, y+h-38, status, tint(scol, .22), {G: (30,110,50), Y: (176,96,0), GREY: (95,99,104), B: (25,103,210)}[scol] if scol in (G, Y, GREY, B) else MUT, 12)
        if pct is not None: bar(c, x+w-76, y+h-30, 56, pct, col, 8)
    card(40, 296, 228, 150, "Accept rate", "57%", "4 of 7 suggestions accepted", "Good start", G, .571, B)
    card(286, 296, 228, 150, "Edit rate", "43%", "3 of 7 decided items edited", "Healthy", B, .429, Y)
    card(532, 296, 228, 150, "Extraction precision", "100%", "Latest check · prompt v2", "Gate passed", G, 1.0, G)
    card(40, 464, 228, 150, "On-time rate", "67%", "2 of 3 done by their date", "Good start", G, .667, G)
    card(286, 464, 228, 150, "Week 1 / week 4", "67% · n/a", "Week 4 needs more history", "Building data", GREY)
    card(532, 464, 228, 150, "Digests sent", "6", "First on 21 Nov · 3 days engaged", "Active", B, None)
    c.rr(40, 636, 720, 100, 20, None, (218,220,224)); c.t(64, 654, "Digest retention", F(15, "b")); c.t(64, 682, "Day 7 and day 30 appear once you have a week and a month of use. Not enough data yet.", F(13), GREY)
    c.save("docs/design/metrics-option-c-hero.png")

opt_a(); opt_b(); opt_c(); print("ok")

# ---- D: journey bar + mini rings
def opt_d():
    c = Cv(800, 800); head(c, "Option D: Journey", "Where your 14 items stand, then how well each stage is going.")
    c.rr(40, 126, 720, 150, 22, (255,255,255), None, True); c.t(64, 144, "Items found", F(14, "s"), MUT); c.t(64, 166, "14", F(40, "b"), INK)
    segs = [("Suggested", 7, B), ("Accepted", 4, G), ("Dismissed", 3, GREY)]; x = 64; tot = 14; W_ = 672
    for t, n, col in segs:
        w = W_ * n / tot; c.rr(x, 224, w-4, 14, 7, col); c.t(x, 246, f"{n}", F(14, "b"), col); c.t(x+22, 247, t, F(12), MUT); x += w
    c.t(736, 170, "plus 3 marked done", F(13, "s"), G, "ra")
    for i, (t, p, col, big, sub) in enumerate([("Accept rate", .571, B, "57%", "4 of 7 accepted"), ("Edit rate", .429, Y, "43%", "3 of 7 edited"), ("Precision", 1.0, G, "100%", "latest check")]):
        x = 40 + i*244; c.rr(x, 296, 228, 150, 20, (255,255,255), None, True); c.t(x+18, 312, t, F(13, "s"), MUT); info(c, x+206, 320)
        ring(c, x+66, 388, 30, p, col, 9); c.t(x+66, 388, big, F(15, "b"), INK, "mm"); c.t(x+112, 380, sub, F(12), MUT, "lm")
    c.rr(40, 466, 354, 140, 20, (255,255,255), None, True); c.t(58, 482, "On time", F(14, "b")); c.t(58, 508, "67%", F(30, "b"), G); c.t(150, 520, "2 of 3 by their date", F(12), MUT)
    bar(c, 58, 556, 318, .667, G); c.t(58, 568, "Week 1: 67%     Week 4: not enough data yet", F(11), GREY)
    c.rr(406, 466, 354, 140, 20, (255,255,255), None, True); c.t(424, 482, "Morning digest", F(14, "b")); c.t(424, 508, "6", F(30, "b"), B); c.t(458, 520, "sent since 21 Nov", F(12), MUT); c.t(424, 556, "3 days opened or clicked", F(13, "s"), G); c.t(424, 574, "Day 7 / day 30: not enough data yet", F(11), GREY)
    c.save("docs/design/metrics-option-d-journey.png")

# ---- E: side menu + focused panel
def opt_e():
    c = Cv(800, 700); head(c, "Option E: Side menu", "One topic at a time. Less on screen, easier to read.")
    c.rr(40, 126, 190, 270, 20, (255,255,255), None, True)
    for i, (t, on) in enumerate((("Overview", True), ("Quality", False), ("On time", False), ("Digest", False))):
        y = 144 + i*56
        if on: c.rr(52, y, 166, 44, 22, (232,240,254)); c.t(72, y+22, t, F(15, "s"), (25,103,210), "lm")
        else: c.t(72, y+22, t, F(15), MUT, "lm")
    c.rr(250, 126, 510, 540, 20, (255,255,255), None, True); c.t(274, 146, "Overview", F(20, "b"))
    for i, (v, t, col) in enumerate((("14", "Items found", B), ("57%", "Accept rate", G), ("67%", "On time", Y), ("6", "Digests sent", R))):
        x = 274 + (i%2)*236; y = 190 + (i//2)*112; c.rr(x, y, 222, 98, 16, SOFT); c.t(x+18, y+14, v, F(32, "b"), col); c.t(x+18, y+60, t, F(14), MUT); info(c, x+198, y+22)
    c.t(274, 430, "Where your items stand", F(14, "b")); x = 274; W_ = 462
    for t, n, col in (("Suggested", 7, B), ("Accepted", 4, G), ("Dismissed", 3, GREY)):
        w = W_*n/14; c.rr(x, 462, w-4, 14, 7, col); c.t(x, 484, f"{n} {t}", F(12), MUT); x += w
    c.t(274, 530, "Need more history", F(14, "b")); c.t(274, 556, "Week-4 on-time rate and day 7 / day 30 retention appear once there is enough use.", F(12), GREY)
    c.save("docs/design/metrics-option-e-sidemenu.png")

# ---- F: health checklist
def opt_f():
    c = Cv(800, 860); head(c, "Option F: Health checklist", "Each line says what is measured, the value, and whether it needs attention.")
    rows = [("Accept rate", "4 of 7 suggestions accepted", "57%", G), ("Edit rate", "3 of 7 decided items edited", "43%", Y), ("Extraction precision", "Latest check · prompt v2 · gate PASS", "100%", G),
            ("On-time rate", "2 of 3 done by their date", "67%", Y), ("On-time, week 1", "First item 21 Nov", "67%", Y), ("On-time, week 4", "Needs more history", "n/a", GREY),
            ("Digests sent", "First on 21 Nov", "6", G), ("Days engaged with digest", "Opened or clicked", "3", G), ("Digest retention, day 7 / 30", "Needs more history", "n/a", GREY)]
    c.rr(40, 126, 720, 40+len(rows)*62+24, 22, (255,255,255), None, True)
    c.t(64, 142, "Items found: 14", F(16, "b")); c.t(736, 144, "7 suggested · 4 accepted · 3 dismissed · 3 done", F(12), MUT, "ra")
    for i, (t, sub, v, col) in enumerate(rows):
        y = 186 + i*62; c.d.line([64*K, (y-4)*K, 736*K, (y-4)*K], fill=LINE, width=K)
        c.circ(76, y+26, 7, col); c.t(100, y+10, t, F(15, "s")); info(c, 100 + c.tw(t, F(15, "s")) + 16, y+20); c.t(100, y+34, sub, F(12), MUT); c.t(736, y+30, v, F(20, "b"), INK if col != GREY else GREY, "rm")
    c.t(64, 186+len(rows)*62+30, "Green: going well   Yellow: worth a look   Grey: not enough data yet", F(11), GREY)
    c.save("docs/design/metrics-option-f-checklist.png")

opt_d(); opt_e(); opt_f(); print("ok2")


# ---- A+: summary sentence + traffic-light rings
def tl(p): return G if p >= .9 else (Y if p >= .8 else R)
def tl_text(p): return (30,110,50) if p >= .9 else ((176,96,0) if p >= .8 else (197,34,31))
def opt_ap():
    c = Cv(800, 910); head(c, "Option A+: Summary + traffic-light rings", "Green at 90% or more, amber from 80% to 89%, red below 80%.")
    c.rr(40, 126, 720, 84, 20, tint(B, .12)); c.t(64, 142, "You accepted 4 of 7 suggestions.", F(20, "b"), (25,103,210)); c.t(64, 176, "2 of 3 dated items were finished on time. The latest accuracy check found no false alarms.", F(13), (25,103,210))
    cards = [("Accept rate", .571, "4 of 7 suggestions accepted"), ("On-time rate", .667, "2 of 3 finished by their date"), ("Extraction precision", 1.0, "Latest check · prompt v2 · gate PASS")]
    for i, (t, p, sub) in enumerate(cards):
        x = 40 + i*244; col = tl(p); c.rr(x, 230, 228, 250, 20, (255,255,255), None, True)
        c.t(x+20, 248, t, F(14, "s"), MUT); info(c, x+206, 256)
        ring(c, x+114, 336, 52, p, col); c.t(x+114, 336, f"{round(p*100)}%", F(26, "b"), tl_text(p), "mm")
        lab = "On target" if p >= .9 else ("Needs attention" if p >= .8 else "Below target")
        wd = c.pill(0, -100, lab, (0,0,0,0), (0,0,0,0)); f = F(12, "s"); tw = c.tw(lab, f) + 24
        c.rr(x+114-tw/2, 410, tw, 24, 12, tint(col, .22)); c.t(x+114, 422, lab, f, tl_text(p), "mm"); c.t(x+114, 456, sub, F(12), MUT, "mm")
    c.t(40, 512, "Your items", F(16, "b"))
    for i, (t, v) in enumerate((("Found", "14"), ("Suggested", "7"), ("Accepted", "4"), ("Dismissed", "3"), ("Done", "3"))):
        x = 40 + i*146; c.rr(x, 542, 134, 80, 16, (255,255,255), None, True); c.t(x+16, 556, v, F(28, "b"), B); c.t(x+16, 594, t, F(13), MUT)
    c.t(40, 656, "Morning digest", F(16, "b"))
    c.rr(40, 686, 354, 86, 16, (255,255,255), None, True); c.t(58, 700, "6", F(28, "b"), B); c.t(58, 738, "Digests sent · first on 21 Nov", F(13), MUT)
    c.rr(406, 686, 354, 86, 16, (255,255,255), None, True); c.t(424, 700, "3", F(28, "b"), B); c.t(424, 738, "Days you opened or clicked the digest", F(13), MUT)
    for i, t in enumerate(("Day 7 retention", "Day 30 retention")):
        x = 40 + i*366; c.rr(x, 788, 354, 70, 16, None, (218,220,224)); c.t(x+18, 802, t, F(14, "s"), MUT); c.t(x+18, 828, "Not enough data yet. Shows after enough use.", F(12), GREY)
    # legend
    c.t(40, 872, "Colour rule for rates:", F(12), GREY); x = 190
    for lab, col in (("Green 90%+", G), ("Amber 80 to 89%", Y), ("Red under 80%", R)):
        c.circ(x, 879, 5, col); c.t(x+12, 872, lab, F(12), GREY); x += 150
    c.save("docs/design/metrics-option-a-plus.png")
opt_ap(); print("ok3")

# ---- A+ v2: all 11 metrics, formulas visible
def opt_ap2():
    c = Cv(800, 1260); head(c, "Option A+ (v2): all 11 metrics with formulas", "Green 90%+, amber 80 to 89%, red under 80%. Each card shows how it is computed.")
    c.rr(40, 126, 720, 84, 20, tint(B, .12)); c.t(64, 142, "You accepted 4 of 7 suggestions.", F(20, "b"), (25,103,210)); c.t(64, 176, "2 of 3 dated items were finished on time. The latest accuracy check found no false alarms.", F(13), (25,103,210))
    def formula(x, y, w, txt, lines=1):
        c.d.line([(x+18)*K, y*K, (x+w-18)*K, y*K], fill=LINE, width=K); c.t(x+18, y+8, "How it is computed", F(10, "s"), GREY)
        for i, t in enumerate(txt if isinstance(txt, list) else [txt]): c.t(x+18, y+24+i*16, t, F(12), MUT)
    # row 1 rings
    rings = [("Accept rate", .571, "4 of 7 suggestions accepted", ["accepted / (accepted + dismissed)", "= 4/7 (real-world precision)"]),
             ("On-time rate", .667, "2 of 3 finished by their date", ["completed by due date / items with a", "due date that can be judged = 2/3"]),
             ("Extraction precision", 1.0, "Latest eval · prompt v2 · gate PASS", ["EvalRuns latest: prompt v2,", "date accuracy 1, gate PASS"])]
    for i, (t, p, sub, fm) in enumerate(rings):
        x = 40 + i*244; col = tl(p); c.rr(x, 230, 228, 330, 20, (255,255,255), None, True)
        c.t(x+20, 248, t, F(14, "s"), MUT); info(c, x+206, 256)
        ring(c, x+114, 330, 48, p, col); c.t(x+114, 330, f"{round(p*100)}%", F(24, "b"), tl_text(p), "mm")
        lab = "On target" if p >= .9 else ("Needs attention" if p >= .8 else "Below target")
        f = F(12, "s"); tw = c.tw(lab, f) + 24; c.rr(x+114-tw/2, 396, tw, 24, 12, tint(col, .22)); c.t(x+114, 408, lab, f, tl_text(p), "mm"); c.t(x+114, 440, sub, F(12), MUT, "mm")
        formula(x, 462, 228, fm, 2)
    # row 2 small
    small = [("Edit rate", "43%", INK, B, "edited items / decided items = 3/7", "Lower is better. Not colour-coded."),
             ("On-time rate, week 1", "67%", tl_text(.667), tl(.667), "2/3 (first item 2026-11-21)", "Items due in your first week"),
             ("On-time rate, week 4", "n/a", GREY, GREY, "0/0", "Needs more history")]
    for i, (t, v, tc, dot, fm, note) in enumerate(small):
        x = 40 + i*244; c.rr(x, 580, 228, 130, 20, (255,255,255), None, True); c.t(x+20, 596, t, F(14, "s"), MUT); info(c, x+206, 604)
        c.t(x+20, 618, v, F(30, "b"), tc); c.circ(x+206, 640, 6, dot) if v != "n/a" else None
        c.t(x+20, 660, "= " + fm if i else fm, F(11), MUT); c.t(x+20, 682, note, F(11), GREY)
    # items
    c.t(40, 732, "Your items", F(16, "b"))
    c.rr(40, 762, 720, 100, 20, (255,255,255), None, True); c.t(64, 776, "14", F(34, "b"), B); c.t(112, 790, "Items found", F(14, "s"), MUT); info(c, 210, 797)
    c.t(64, 826, "suggested 7, accepted 4, dismissed 3, done 3", F(13), MUT)
    # digest
    c.t(40, 888, "Morning digest", F(16, "b"))
    dig = [("Digests sent", "6", B, "first digest 2026-11-21"), ("Days engaged with the digest", "3", B, "days with a digest open or click"),
           ("Digest retention, day 7", "n/a", GREY, "engaged in days 7 to 13 after the first digest"), ("Digest retention, day 30", "n/a", GREY, "engaged in days 30 to 36 after the first digest")]
    for i, (t, v, col, fm) in enumerate(dig):
        x = 40 + (i%2)*366; y = 918 + (i//2)*140
        c.rr(x, y, 354, 124, 20, (255,255,255), None, True) if v != "n/a" else c.rr(x, y, 354, 124, 20, None, (218,220,224))
        c.t(x+20, y+14, t, F(14, "s"), MUT); info(c, x+332, y+22); c.t(x+20, y+38, v, F(30, "b"), col)
        c.d.line([(x+18)*K, (y+84)*K, (x+336)*K, (y+84)*K], fill=LINE, width=K); c.t(x+20, y+92, fm, F(12), MUT if v != "n/a" else GREY)
    y = 1200; c.t(40, y, "Colour rule for rates:", F(12), GREY); x = 190
    for lab, col in (("Green 90%+", G), ("Amber 80 to 89%", Y), ("Red under 80%", R)):
        c.circ(x, y+7, 5, col); c.t(x+12, y, lab, F(12), GREY); x += 150
    c.save("docs/design/metrics-option-a-plus-v2.png")
opt_ap2(); print("ok4")

# ---- A+ v3: formulas hidden behind the "i"
def tip(c, x, y, w, lines):
    h = 34 + len(lines)*17
    c.rr(x, y, w, h, 10, (60,64,67)); c.d.polygon([((x+w-24)*K, y*K), ((x+w-14)*K, (y-8)*K), ((x+w-4)*K, y*K)], fill=(60,64,67))
    c.t(x+12, y+10, "How it is computed", F(11, "b"), (255,255,255))
    for i, t in enumerate(lines): c.t(x+12, y+30+i*17, t, F(12), (232,234,237))
def opt_ap3():
    c = Cv(800, 1010); head(c, "Option A+ (v3): formulas behind the i", "Hover or click the i on any card to see how it is computed. Shown open on Accept rate.")
    c.rr(40, 126, 720, 84, 20, tint(B, .12)); c.t(64, 142, "You accepted 4 of 7 suggestions.", F(20, "b"), (25,103,210)); c.t(64, 176, "2 of 3 dated items were finished on time. The latest accuracy check found no false alarms.", F(13), (25,103,210))
    rings = [("Accept rate", .571, "4 of 7 suggestions accepted"), ("On-time rate", .667, "2 of 3 finished by their date"), ("Extraction precision", 1.0, "Latest check · prompt v2 · gate PASS")]
    for i, (t, p, sub) in enumerate(rings):
        x = 40 + i*244; col = tl(p); c.rr(x, 230, 228, 236, 20, (255,255,255), None, True)
        c.t(x+20, 248, t, F(14, "s"), MUT); info(c, x+206, 256)
        ring(c, x+114, 330, 48, p, col); c.t(x+114, 330, f"{round(p*100)}%", F(24, "b"), tl_text(p), "mm")
        c.t(x+114, 424, sub, F(12), MUT, "mm")
    small = [("Edit rate", "43%", INK, "3 of 7 decided items edited"), ("On-time, week 1", "67%", tl_text(.667), "2 of 3 in your first week"), ("On-time, week 4", "n/a", GREY, "Needs more history")]
    for i, (t, v, tc, note) in enumerate(small):
        x = 40 + i*244; c.rr(x, 486, 228, 110, 20, (255,255,255), None, True); c.t(x+20, 502, t, F(14, "s"), MUT); info(c, x+206, 510)
        c.t(x+20, 526, v, F(30, "b"), tc); c.t(x+20, 568, note, F(12), MUT if v != "n/a" else GREY)
    c.t(40, 626, "Your items", F(16, "b"))
    c.rr(40, 656, 720, 70, 20, (255,255,255), None, True); c.t(64, 668, "14", F(30, "b"), B); c.t(112, 680, "Items found", F(14, "s"), MUT); info(c, 210, 689); c.t(736, 682, "7 suggested · 4 accepted · 3 dismissed · 3 done", F(12), MUT, "ra")
    c.t(40, 748, "Morning digest", F(16, "b"))
    dig = [("Digests sent", "6", B, "Since 21 Nov"), ("Days engaged", "3", B, "Days you opened or clicked"), ("Retention, day 7", "n/a", GREY, "Needs more history"), ("Retention, day 30", "n/a", GREY, "Needs more history")]
    for i, (t, v, col, note) in enumerate(dig):
        x = 40 + (i%4)*182 if False else 40 + i*182; 
        if v != "n/a": c.rr(x, 778, 170, 110, 20, (255,255,255), None, True)
        else: c.rr(x, 778, 170, 110, 20, None, (218,220,224))
        c.t(x+16, 792, t, F(13, "s"), MUT); info(c, x+148, 800); c.t(x+16, 814, v, F(28, "b"), col); c.t(x+16, 856, note, F(11), MUT if v != "n/a" else GREY)
    y = 920; c.t(40, y, "Colour rule for rates:", F(12), GREY); x = 190
    for lab, col in (("Green 90%+", G), ("Amber 80 to 89%", Y), ("Red under 80%", R)):
        c.circ(x, y+7, 5, col); c.t(x+12, y, lab, F(12), GREY); x += 150
    tip(c, 52, 266, 224, ["accepted / (accepted + dismissed)", "= 4/7 (real-world precision)"])
    c.save("docs/design/metrics-option-a-plus-v3.png")
opt_ap3(); print("ok5")
