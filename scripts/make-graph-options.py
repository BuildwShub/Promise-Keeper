"""Mock-up of graph cards for the Metrics page. Sample data except the eval numbers. Run: python scripts/make-graph-options.py"""
import sys; sys.path.insert(0, "scripts")
import importlib; U = importlib.import_module("make-ui-options"); M = importlib.import_module("make-metrics-options")
Cv, F, B, R, Y, G, INK, MUT, LINE, SOFT, K, tint = U.Cv, U.F, U.B, U.R, U.Y, U.G, U.INK, U.MUT, U.LINE, U.SOFT, U.K, U.tint
GREY = (154,160,166); LG = (129,201,149)
c = Cv(800, 1040); c.d.rectangle([0, 0, 800*K, 4*K], fill=B)
c.t(40, 24, "Metrics: graph options (design review)", F(15, "s"), MUT); c.t(40, 50, "Graphs", F(30, "b")); c.t(40, 94, "Sample data except card 5. Each graph answers one question, with the i for details.", F(14), MUT)
def card(x, y, w, h, title, q):
    c.rr(x, y, w, h, 20, (255,255,255), None, True); c.t(x+20, y+16, title, F(15, "b")); c.t(x+20, y+38, q, F(12), MUT); M.info(c, x+w-24, y+26)
# 1 stacked bars per day
card(40, 126, 720, 250, "1  Items found per day", "Am I getting a steady flow, and what happens to them?")
days = [(0,0,0,0),(1,0,0,0),(0,0,0,0),(2,1,0,0),(1,0,1,0),(0,0,0,0),(3,1,1,0),(2,0,0,1),(0,0,0,0),(1,1,0,0),(2,1,1,1),(0,0,0,0),(1,0,0,0),(2,1,0,1)]
x0, base, bw = 70, 316, 36
for i, (s, a, d, dn) in enumerate(days):
    x = x0 + i*47; yy = base
    for n, col in ((s, B), (a, G), (d, GREY), (dn, LG)):
        for _ in range(n): c.rr(x, yy-16, bw, 14, 3, col); yy -= 17
    c.t(x+bw/2, base+8, str(10+i), F(10), MUT, "ma")
c.d.line([60*K, (base+2)*K, 740*K, (base+2)*K], fill=LINE, width=K)
lx = 70
for lab, col in (("Suggested", B), ("Accepted", G), ("Dismissed", GREY), ("Done", LG)): c.rr(lx, 350, 10, 10, 3, col); c.t(lx+16, 346, lab, F(11), MUT); lx += 100
# 2 donut by type
card(40, 396, 350, 270, "2  What kind of items", "Promises, requests, deadlines, or things owed to me?")
cx, cy, r = 130, 540, 62; tot = 14; a0 = -90
for n, col in ((8, G), (3, B), (2, Y), (1, R)):
    a1 = a0 + 360*n/tot; c.d.arc([(cx-r)*K, (cy-r)*K, (cx+r)*K, (cy+r)*K], a0+1, a1-1, fill=col, width=22*K); a0 = a1
c.t(cx, cy-6, "14", F(26, "b"), INK, "mm"); c.t(cx, cy+16, "items", F(11), MUT, "mm")
for i, (lab, n, col) in enumerate((("Waiting on them", 8, G), ("I promised", 3, B), ("Asked of me", 2, Y), ("Deadline", 1, R))):
    c.rr(230, 506+i*28, 10, 10, 3, col); c.t(248, 504+i*28, f"{lab}  {n}", F(12), INK)
# 3 workload
card(410, 396, 350, 270, "3  Coming up: next 14 days", "What is due when, and is anything piling up?")
vals = [2,0,0,1,0,3,1,0,0,2,0,0,1,0]; ov = 1
c.rr(432, 586, 12, 52, 3, R); c.t(438, 646, "late", F(9), R, "ma")
for i, v in enumerate(vals):
    x = 452 + i*20; col = Y if i == 0 else B
    for k in range(v): c.rr(x, 630-k*17-14, 14, 14, 3, col)
    if i in (0, 6, 13): c.t(x+7, 646, ["today", "+6", "+13"][[0, 6, 13].index(i)], F(9), MUT, "ma")
c.d.line([430*K, 630*K, 744*K, 630*K], fill=LINE, width=K)
# 4 digest strip
card(40, 686, 350, 190, "4  Morning digest habit", "Do I read it? Last 30 days.")
for i in range(30):
    col = (232,234,237); 
    if i in (2,3,4,6,9,10,11,12,13,15,18,19,22,23,26,27,28): col = LG
    if i in (4,12,19,28): col = G
    c.rr(60 + (i%15)*21, 740 + (i//15)*26, 16, 20, 5, col)
lx = 60
for lab, col in (("Opened or clicked", G), ("Sent", LG), ("None", (232,234,237))): c.rr(lx, 808, 10, 10, 3, col); c.t(lx+16, 806, lab, F(11), MUT); lx += 112
c.t(60, 838, "3 days engaged so far", F(12, "s"), INK)
# 5 eval versions
card(410, 686, 350, 190, "5  Accuracy by prompt version", "Is the extraction getting better? (real eval numbers)")
for i, (lab, p, rc) in enumerate((("v1", .833, .556), ("v2", 1.0, .778))):
    x = 450 + i*140
    for j, (v, col, nm) in enumerate(((p, G, "Precision"), (rc, B, "Recall"))):
        h = 78*v; c.rr(x+j*42, 836-h, 34, h, 5, col); c.t(x+j*42+17, 836-h-14, f"{round(v*100)}%", F(11, "s"), INK, "mm")
    c.t(x+38, 842, lab, F(11, "s"), MUT, "ma")
c.rr(450, 868-6, 10, 10, 3, G); c.t(466, 862, "Precision", F(11), MUT); c.rr(540, 868-6, 10, 10, 3, B); c.t(556, 862, "Recall", F(11), MUT)
# honest note
c.rr(40, 896, 720, 120, 20, tint(Y, .14)); c.t(64, 914, "Honest limit", F(14, "b"), (176,96,0)); c.t(64, 940, "You have about a week of data, so graphs 1, 3 and 4 will look sparse at first and fill in with use.", F(13), (120,70,0))
c.t(64, 962, "Graph 5 uses your real evaluation runs (v1: precision 83%, recall 56%; v2: precision 100%, recall 78%).", F(13), (120,70,0))
c.save("docs/design/metrics-graphs-options.png"); print("ok")
