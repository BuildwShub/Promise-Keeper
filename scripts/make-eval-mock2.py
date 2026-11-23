"""More Eval page options (design review only). Run: python scripts/make-eval-mock2.py"""
import sys; sys.path.insert(0, "scripts")
import importlib; U = importlib.import_module("make-ui-options"); M = importlib.import_module("make-metrics-options")
Cv, F, B, R, Y, G, INK, MUT, LINE, SOFT, K, tint = U.Cv, U.F, U.B, U.R, U.Y, U.G, U.INK, U.MUT, U.LINE, U.SOFT, U.K, U.tint
GREY = (154,160,166); DG = (30,110,50); DR = (197,34,31)
def top(c, tag):
    c.d.rectangle([0, 0, 800*K, 4*K], fill=B); c.t(40, 22, tag, F(14, "s"), MUT); c.t(40, 46, "Eval", F(30, "b")); M.info(c, 112, 66); c.t(40, 90, "Re-runs the model over your hand-labelled emails with the same scoring and gate as the add-on.", F(14), MUT)
def runbar(c, y):
    c.rr(40, y, 720, 70, 22, (255,255,255), None, True); c.t(64, y+14, "Prompt v2  ·  gemini-3.5-flash-lite  ·  106 emails, 106 labelled", F(14, "s"), INK); c.t(64, y+40, "Run it before changing the prompt. Takes a few minutes.", F(12), MUT); c.btn(610, y+16, "Run eval", "fill", 38, 15)

# ---------- Option B: v1 vs v2 compare
def opt_b():
    c = Cv(800, 1010); top(c, "Option B: Compare runs")
    runbar(c, 116)
    c.rr(40, 206, 720, 330, 22, (255,255,255), None, True); c.t(64, 224, "Did the new prompt help?", F(16, "b")); M.info(c, 736, 232)
    c.rr(64, 262, 130, 30, 15, SOFT); c.t(129, 277, "Before: v1", F(13, "s"), MUT, "mm"); c.t(300, 277, "→", F(16, "b"), GREY, "mm"); c.rr(406, 262, 150, 30, 15, tint(B, .15)); c.t(481, 277, "After: v2 (current)", F(13, "s"), (25,103,210), "mm")
    rows = (("Precision", "83%", "100%", "+17 points", .833, 1.0), ("Recall", "56%", "78%", "+22 points", .556, .778), ("Date accuracy", "100%", "100%", "no change", 1.0, 1.0))
    for i, (t, a, b, d, pa, pb) in enumerate(rows):
        y = 316 + i*72; c.t(64, y, t, F(15, "s"), INK); M.bar(c, 64, y+30, 190, pa, GREY, 10); M.bar(c, 406, y+30, 190, pb, M.tl(pb), 10)
        c.t(264, y+34, a, F(14, "b"), MUT, "lm"); c.t(606, y+34, b, F(14, "b"), M.tl_text(pb), "lm")
        up = d != "no change"; c.rr(650, y+18, 86, 28, 14, tint(G if up else GREY, .2)); c.t(693, y+32, ("▲ " if False else "") + d, F(11, "s"), DG if up else MUT, "mm")
    c.t(64, 514, "Gate: precision and date accuracy at 85% or more. v1 failed it, v2 passes.", F(12), GREY)
    c.rr(40, 556, 720, 190, 22, (255,255,255), None, True); c.t(64, 574, "Run history", F(16, "b"))
    for i, (w, v, p, r, d, ok) in enumerate((("20 Nov", "v2", "100%", "78%", "100%", True), ("18 Nov", "v1", "83%", "56%", "100%", False))):
        y = 612 + i*58; c.d.line([64*K, (y-8)*K, 736*K, (y-8)*K], fill=LINE, width=K)
        c.t(64, y+10, w, F(13), MUT); c.t(150, y+10, v, F(15, "b"), INK); c.t(240, y+10, f"Precision {p}   ·   Recall {r}   ·   Dates {d}", F(13), INK); c.pill(650, y+4, "PASS" if ok else "FAIL", tint(G if ok else R, .22), DG if ok else DR, 12, "b", 16, 26)
    c.rr(40, 766, 720, 200, 22, (255,255,255), None, True); c.t(64, 784, "Eval set", F(16, "b")); c.t(64, 810, "106 emails: 97 with nothing to extract, 9 with a real item.", F(13), MUT)
    c.rr(64, 846, 672*97/106, 22, 11, (218,220,224)); c.rr(64+672*97/106+4, 846, 672*9/106-4, 22, 11, B)
    c.t(64, 880, "97 nothing to extract", F(12), MUT); c.t(736, 880, "9 real items", F(12, "s"), (25,103,210), "ra"); c.t(64, 920, "Only 9 real items means recall can swing a lot with one email. Add more labelled positives to firm it up.", F(12), GREY)
    c.save("docs/design/eval-option-b-compare.png")

# ---------- Option C: release checklist
def opt_c():
    c = Cv(800, 1030); top(c, "Option C: Release checklist")
    c.rr(40, 116, 720, 130, 22, tint(G, .14)); c.circ(96, 181, 28, G); c.glyph("check", 96, 181, (255,255,255), 1.6)
    c.t(144, 158, "Ready to ship prompt v2", F(24, "b"), DG); c.t(144, 194, "Both gate checks pass on the latest run (106 emails).", F(14), DG); c.btn(610, 160, "Run eval", "fill", 38, 15)
    c.rr(40, 266, 720, 300, 22, (255,255,255), None, True); c.t(64, 284, "Gate checks", F(16, "b")); M.info(c, 736, 292)
    items = (("Shown precision is 85% or more", "100%", True, "7 of 7 shown items were right"), ("Date accuracy is 85% or more", "100%", True, "Every date matched the label"), ("Recall (tracked, not gated)", "78%", None, "7 of 9 real items found"))
    for i, (t, v, ok, sub) in enumerate(items):
        y = 326 + i*76; c.d.line([64*K, (y-10)*K, 736*K, (y-10)*K], fill=LINE, width=K)
        col = G if ok else (GREY)
        c.circ(86, y+22, 14, col); 
        if ok: c.glyph("check", 86, y+22, (255,255,255), .9)
        else: c.t(86, y+22, "i", F(15, "b"), (255,255,255), "mm")
        c.t(118, y+8, t, F(15, "s"), INK); c.t(118, y+32, sub, F(12), MUT); c.t(736, y+22, v, F(24, "b"), M.tl_text(float(v[:-1])/100) if ok is not None else INK, "rm")
    c.rr(40, 586, 720, 214, 22, (255,255,255), None, True); c.t(64, 604, "What the model missed", F(16, "b")); M.info(c, 736, 612); c.t(64, 630, "2 of 9 real items were not found in the latest run.", F(13), MUT)
    for i, (t, col) in enumerate((("Asked of me", Y), ("Waiting on them", G))):
        y = 664 + i*54; c.rr(64, y, 672, 44, 14, SOFT); c.pill(76, y+9, t, tint(col, .25), INK, 11, "s", 12, 26); c.t(240, y+22, "Email subject and text appear here after the next run", F(12), GREY, "lm")
    c.t(64, 774, "Needs the per-email results to be stored. Layout shown; details are placeholders.", F(11), GREY)
    c.rr(40, 820, 720, 180, 22, (255,255,255), None, True); c.t(64, 838, "Recent runs", F(16, "b"))
    for i, (w, v, p, r, d, ok) in enumerate((("20 Nov", "v2", "100%", "78%", "100%", True), ("18 Nov", "v1", "83%", "56%", "100%", False))):
        y = 876 + i*50; c.t(64, y+8, w, F(13), MUT); c.t(150, y+8, v, F(15, "b"), INK); c.t(240, y+8, f"Precision {p} · Recall {r} · Dates {d}", F(13), INK); c.pill(650, y+2, "PASS" if ok else "FAIL", tint(G if ok else R, .22), DG if ok else DR, 12, "b", 16, 26)
    c.save("docs/design/eval-option-c-checklist.png")

# ---------- Option D: funnel
def opt_d():
    c = Cv(800, 900); top(c, "Option D: Funnel")
    runbar(c, 116)
    c.rr(40, 206, 720, 380, 22, (255,255,255), None, True); c.t(64, 224, "From 106 emails to what you see", F(16, "b")); c.t(64, 248, "Each step shows what happened to the emails in the latest run.", F(12), MUT); M.info(c, 736, 232)
    steps = (("106", "emails checked", 1.0, B, ""), ("97", "had nothing to extract. Correctly ignored: 0 false alarms", 97/106, GREY, "ignored"), ("9", "had a real item", 9/106, B, ""), ("7", "real items found (recall 78%)", 7/106, G, ""), ("7", "shown items correct (precision 100%)", 7/106, G, ""), ("7", "dates correct (date accuracy 100%)", 7/106, G, ""))
    for i, (n, lab, f, col, _) in enumerate(steps):
        y = 280 + i*48; w = max(44, 360*f)
        c.rr(64, y, w, 34, 17, col); c.t(64+w/2 if w > 60 else 64+w/2, y+17, n, F(15, "b"), (255,255,255), "mm"); c.t(64+max(w, 44)+14, y+17, lab, F(13), INK, "lm")
    c.rr(40, 606, 340, 130, 22, tint(Y, .14)); c.t(60, 622, "2 real items were missed", F(15, "b"), (120,70,0)); c.t(60, 648, "1 asked of me, 1 waiting on them.", F(13), (120,70,0)); c.t(60, 672, "Recall is the weak spot, so improve", F(12), (120,70,0)); c.t(60, 690, "the prompt for those two types.", F(12), (120,70,0))
    c.rr(400, 606, 360, 130, 22, tint(G, .14)); c.t(420, 622, "Gate: PASS", F(15, "b"), DG); c.t(420, 648, "Precision 100% and date accuracy 100%", F(13), DG); c.t(420, 672, "both clear the 85% rule.", F(13), DG)
    c.rr(40, 756, 720, 120, 22, (255,255,255), None, True); c.t(64, 774, "Run history", F(16, "b")); c.t(64, 810, "v2   20 Nov   Precision 100% · Recall 78% · Dates 100%     PASS", F(13), INK); c.t(64, 840, "v1   18 Nov   Precision 83% · Recall 56% · Dates 100%      FAIL", F(13), INK)
    c.save("docs/design/eval-option-d-funnel.png")

opt_b(); opt_c(); opt_d(); print("ok")
