"""Eval page mock-up with the real eval numbers (design review only). Run: python scripts/make-eval-mock.py"""
import sys; sys.path.insert(0, "scripts")
import importlib; U = importlib.import_module("make-ui-options"); M = importlib.import_module("make-metrics-options")
Cv, F, B, R, Y, G, INK, MUT, LINE, SOFT, K, tint = U.Cv, U.F, U.B, U.R, U.Y, U.G, U.INK, U.MUT, U.LINE, U.SOFT, U.K, U.tint
GREY = (154,160,166)
c = Cv(800, 1500); c.d.rectangle([0, 0, 800*K, 4*K], fill=B)
c.t(40, 28, "Eval", F(30, "b")); M.info(c, 112, 48); c.t(40, 72, "Re-runs the model over your hand-labelled emails with the same scoring and pass/fail gate as the add-on.", F(14), MUT)

# gate card
c.rr(40, 108, 720, 270, 22, (255,255,255), None, True)
c.t(64, 126, "Latest run", F(14, "s"), MUT); M.info(c, 736, 134)
wd = c.pill(64, 150, "GATE: PASS", tint(G, .22), (30,110,50), 15, "b", 16, 32)
c.t(64+wd+14, 166, "Prompt v2 · 106 emails", F(14), MUT, "lm")
for i, (t, p) in enumerate((("Precision", 1.0), ("Recall", .778), ("Date accuracy", 1.0))):
    x = 64 + i*226; col = M.tl(p)
    M.ring(c, x+52, 258, 40, p, col, 11); c.t(x+52, 258, f"{round(p*100)}%", F(18, "b"), M.tl_text(p), "mm"); c.t(x+110, 244, t, F(15, "s"), INK, "lm")
    c.t(x+110, 268, {"Precision": "7 of 7 shown were right", "Recall": "7 of 9 real items found", "Date accuracy": "every date matched"}[t], F(12), MUT, "lm")
c.d.line([64*K, 318*K, 736*K, 318*K], fill=LINE, width=K)
c.t(64, 330, "Gate rule: shown precision 85% or more and date accuracy 85% or more. Recall is tracked but is not part of the gate.", F(12), GREY)

# run bar
c.rr(40, 398, 720, 84, 22, (255,255,255), None, True)
c.t(64, 414, "Current prompt", F(12), MUT); c.t(64, 434, "v2", F(18, "b"), INK); c.t(200, 414, "Model", F(12), MUT); c.t(200, 434, "gemini-3.5-flash-lite", F(14, "s"), INK); c.t(360, 414, "Eval set", F(12), MUT); c.t(360, 434, "106 emails · 106 labelled", F(14, "s"), INK)
c.btn(580, 424, "Run eval", "fill", 38, 15); c.t(736, 468, "Takes a few minutes", F(11), GREY, "ra")

# trend
c.rr(40, 502, 720, 270, 22, (255,255,255), None, True)
c.t(64, 520, "Progress across runs", F(15, "b")); c.t(64, 542, "Is the extraction getting better?", F(12), MUT); M.info(c, 736, 530)
c.chip = None
gx0, gx1, gy0, gy1 = 110, 700, 574, 702
for f_ in (0, .5, 1):
    y = gy1 - f_*(gy1-gy0); c.d.line([gx0*K, y*K, gx1*K, y*K], fill=(238,240,242), width=K); c.t(gx0-10, y, f"{int(f_*100)}%", F(10), GREY, "rm")
pts = {"Precision": (G, [.833, 1.0]), "Recall": (B, [.556, .778]), "Date accuracy": (Y, [1.0, 1.0])}
xs = [220, 560]
for name, (col, vals) in pts.items():
    ys = [gy1 - v*(gy1-gy0) for v in vals]
    c.d.line([(xs[0])*K, ys[0]*K, xs[1]*K, ys[1]*K], fill=col, width=3*K)
    for x, y, v in zip(xs, ys, vals): c.circ(x, y, 6, (255,255,255)); c.circ(x, y, 4.5, col)
c.t(xs[0], gy1+14, "v1", F(12, "s"), MUT, "ma"); c.t(xs[1], gy1+14, "v2", F(12, "s"), MUT, "ma")
# tooltip example
c.rr(588, 598, 128, 70, 10, (60,64,67)); c.t(600, 608, "v2", F(11, "b"), (255,255,255)); c.t(600, 626, "Precision 100%", F(11), (232,234,237)); c.t(600, 642, "Recall 78%", F(11), (232,234,237)); c.t(600, 658-2, "", F(1))
lx = 64
for lab, col in (("Precision", G), ("Recall", B), ("Date accuracy", Y)): c.rr(lx, 752, 10, 10, 3, col); c.t(lx+16, 748, lab, F(11), MUT); lx += 120

# eval set
c.rr(40, 792, 720, 322, 22, (255,255,255), None, True)
c.t(64, 810, "What is in the eval set", F(15, "b")); c.t(64, 832, "106 labelled emails. Only 9 contain a real item, so recall rests on few examples.", F(12), MUT); M.info(c, 736, 820)
cx, cy, r = 150, 940, 58
import math
c.d.arc([(cx-r)*K, (cy-r)*K, (cx+r)*K, (cy+r)*K], -90+3, -90+360*97/106-3, fill=(218,220,224), width=18*K)
c.d.arc([(cx-r)*K, (cy-r)*K, (cx+r)*K, (cy+r)*K], -90+360*97/106+3, 270-3, fill=B, width=18*K)
c.t(cx, cy-6, "106", F(24, "b"), INK, "mm"); c.t(cx, cy+16, "emails", F(11), MUT, "mm")
c.rr(250, 912, 10, 10, 3, (218,220,224)); c.t(268, 908, "97 with nothing to extract", F(13), INK); c.rr(250, 940, 10, 10, 3, B); c.t(268, 936, "9 with a real item", F(13), INK)
c.t(64, 1020, "Real items by type, latest run", F(12, "s"), MUT)
for i, (t, found, missed, col) in enumerate((("I promised", 2, 0, B), ("Deadline", 1, 0, R), ("Asked of me", 4, 1, Y), ("Waiting on them", 0, 1, G))):
    x = 64 + i*172; c.rr(x, 1038, 160, 58, 16, tint(col, .16)); c.t(x+14, 1054, t, F(12, "s"), INK, "lm")
    c.t(x+14, 1078, f"{found} found" + (f" · {missed} missed" if missed else " · 0 missed"), F(11), (197,34,31) if missed else (30,110,50), "lm")

# runs table
c.rr(40, 1134, 720, 250, 22, (255,255,255), None, True)
c.t(64, 1152, "Recent runs", F(15, "b"))
heads = (("When", 64), ("Prompt", 190), ("Rows", 270), ("Precision", 340), ("Recall", 450), ("Date acc.", 550), ("Gate", 660))
for h, x in heads: c.t(x, 1188, h, F(11, "s"), GREY)
runs = (("2026-11-20 09:12", "v2", "106", "100%", "78%", "100%", True), ("2026-11-18 16:40", "v1", "106", "83%", "56%", "100%", False))
for i, (w, v, rows, p, rc, da, ok) in enumerate(runs):
    y = 1222 + i*60; c.d.line([64*K, (y-14)*K, 736*K, (y-14)*K], fill=LINE, width=K)
    c.t(64, y, w, F(13), INK); c.t(190, y, v, F(14, "b"), INK); c.t(270, y, rows, F(13), INK)
    for val, x in ((p, 340), (rc, 450), (da, 550)): c.t(x, y, val, F(14, "b"), M.tl_text(int(val[:-1])/100))
    c.pill(660, y-4, "PASS" if ok else "FAIL", tint(G if ok else R, .22), (30,110,50) if ok else (197,34,31), 12, "b", 14, 24)
c.t(64, 1348, "Dates shown are placeholders in this mock-up.", F(11), GREY)
c.save("docs/design/eval-page-mock.png"); print("ok")
