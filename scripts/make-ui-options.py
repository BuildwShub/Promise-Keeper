"""Static mock-ups of three item-card designs (design review only; touches nothing deployed). Run: python scripts/make-ui-options.py"""
from PIL import Image, ImageDraw, ImageFont
K = 2
B, R, Y, G = (66,133,244), (234,67,53), (251,188,4), (52,168,83)
INK, MUT, LINE, SOFT = (32,33,36), (95,99,104), (232,234,237), (241,243,244)
def F(sz, w="r"):
    n = {"r": "segoeui", "b": "segoeuib", "s": "seguisb", "i": "segoeuii"}[w]
    return ImageFont.truetype(f"C:/Windows/Fonts/{n}.ttf", sz * K)
def ic(name, sz): return Image.open(f"web/public/icons/{name}.png").convert("RGBA").resize((sz*K, sz*K), Image.LANCZOS)
def tint(c, a): return tuple(int(255 - (255 - v) * a) for v in c)

class Cv:
    def __init__(s, w, h, bg=(248,249,250)):
        s.im = Image.new("RGB", (w*K, h*K), bg); s.d = ImageDraw.Draw(s.im, "RGBA")
    def rr(s, x, y, w, h, r, fill=None, line=None, shadow=False):
        if shadow:
            for i, a in ((6, 10), (3, 16), (1, 26)): s.d.rounded_rectangle([(x-i/2)*K, (y+i)*K, (x+w+i/2)*K, (y+h+i)*K], r*K+i, fill=(60,64,67,a))
        s.d.rounded_rectangle([x*K, y*K, (x+w)*K, (y+h)*K], r*K, fill=fill, outline=line, width=K if line else 0)
    def t(s, x, y, txt, f, fill=INK, anchor="la"): s.d.text((x*K, y*K), txt, font=f, fill=fill, anchor=anchor)
    def tw(s, txt, f): return s.d.textlength(txt, font=f) / K
    def pill(s, x, y, txt, bg, fg, sz=12, w="s", pad=12, h=24):
        f = F(sz, w); wd = s.tw(txt, f) + pad*2; s.rr(x, y, wd, h, h/2, bg); s.t(x+pad, y+h/2, txt, f, fg, "lm"); return wd
    def btn(s, x, y, txt, kind="fill", h=34, sz=14):
        f = F(sz, "s"); wd = s.tw(txt, f) + 28
        if kind == "fill": s.rr(x, y, wd, h, h/2, B); s.t(x+wd/2, y+h/2, txt, f, (255,255,255), "mm")
        elif kind == "line": s.rr(x, y, wd, h, h/2, None, (218,220,224)); s.t(x+wd/2, y+h/2, txt, f, B, "mm")
        else: s.t(x+wd/2, y+h/2, txt, f, MUT if kind == "grey" else B, "mm")
        return wd
    def paste(s, im, x, y): s.im.paste(im, (int(x*K), int(y*K)), im)
    def circ(s, cx, cy, r, fill): s.d.ellipse([(cx-r)*K, (cy-r)*K, (cx+r)*K, (cy+r)*K], fill=fill)

    def glyph(s, kind, cx, cy, col, z=1.0):
        w = max(2, int(2.2*K*z)); d = s.d; u = K*z
        P = lambda dx, dy: ((cx+dx*z)*K, (cy+dy*z)*K)
        if kind == "check": d.line([P(-6,0), P(-2,5), P(7,-5)], fill=col, width=w, joint="curve")
        elif kind == "cross": d.line([P(-5,-5), P(5,5)], fill=col, width=w); d.line([P(-5,5), P(5,-5)], fill=col, width=w)
        elif kind == "pencil": d.line([P(-5,5), P(4,-4)], fill=col, width=w+K); d.polygon([P(-7,7), P(-6,3), P(-3,6)], fill=col)
        elif kind == "arrow": d.line([P(-4,4), P(4,-4)], fill=col, width=w); d.line([P(-1,-4), P(4,-4), P(4,1)], fill=col, width=w)
        elif kind == "info":
            d.ellipse([P(-7,-7), P(7,7)], outline=col, width=K); d.line([P(0,-1), P(0,4)], fill=col, width=w); d.ellipse([P(-1,-5), P(1,-3)], fill=col)
    def save(s, p): s.im.save(p)

def header(c, title, sub):
    c.t(40, 28, title, F(22, "b")); c.t(40, 60, sub, F(14), MUT)
    c.d.rectangle([0, 0, 800*K, 4*K], fill=B)

# ---------------- Option A: clean row card
def option_a():
    c = Cv(800, 560); header(c, "Option A: Clean card", "One line of meaning. The proof is one tap away. Few, clear actions.")
    rows = [("Send the budget sheet", "Shubham Kanauji", "waiting", "Mon 23 Nov", "Due today", Y, "“I will send you the budget sheet by Monday”"),
            ("Send report", "Shubham Kanauji", "waiting", "Mon 23 Nov", "Due today", Y, "“Report is on the way”")]
    y = 92
    for ttl, who, icon, date, tag, col, q in rows:
        c.rr(40, y, 720, 190, 20, (255,255,255), None, True)
        c.paste(ic(icon, 44), 64, y+22)
        c.t(122, y+22, ttl, F(20, "b")); c.t(122, y+52, f"Waiting on {who}", F(14), MUT)
        wd = c.pill(0, 0, tag, (0,0,0,0), (0,0,0,0)) if False else 0
        f = F(12, "s"); tw = c.tw(tag, f) + 24
        c.rr(736-tw, y+22, tw, 26, 13, tint(col, .22)); c.t(736-tw/2, y+35, tag, f, (176,96,0), "mm")
        c.t(736, y+58, date, F(13), MUT, "ra")
        c.rr(64, y+88, 672, 36, 10, SOFT); c.t(78, y+106, q, F(13, "i"), MUT, "lm"); c.t(700, y+106, "Open email", F(13, "s"), B, "rm"); c.glyph("arrow", 720, y+106, B, .8)
        c.d.line([64*K, (y+138)*K, 736*K, (y+138)*K], fill=LINE, width=K)
        x = 64; x += c.btn(x, y+144, "Accept", "fill") + 6; x += c.btn(x, y+144, "Edit", "text") ; x += c.btn(x, y+144, "Draft follow-up", "text"); c.btn(640, y+144, "Dismiss", "grey")
        y += 210
    c.save("docs/design/option-a-clean-card.png")

# ---------------- Option B: date tile + chips
def option_b():
    c = Cv(800, 560); header(c, "Option B: Date tile", "The date is the first thing you see, like a Calendar tile. Person and status as chips.")
    rows = [("Send the budget sheet", "Shubham Kanauji", "MON", "23", "Due today", R, "“I will send you the budget sheet by Monday”"),
            ("Review the Q4 deck", "Sofia Marin", "TUE", "24", "Tomorrow", Y, "“Can you review this by end of day?”")]
    y = 92
    for ttl, who, dow, day, tag, col, q in rows:
        c.rr(40, y, 720, 190, 20, (255,255,255), None, True)
        c.rr(64, y+24, 72, 86, 16, (255,255,255), (218,220,224)); c.rr(64, y+24, 72, 26, 16, B); c.d.rectangle([64*K, (y+38)*K, 136*K, (y+50)*K], fill=B)
        c.t(100, y+38, dow, F(12, "b"), (255,255,255), "mm"); c.t(100, y+80, day, F(34, "b"), INK, "mm")
        c.t(160, y+22, ttl, F(21, "b"))
        x = 160; c.circ(x+13, y+68, 13, B); c.t(x+13, y+68, who[0], F(13, "b"), (255,255,255), "mm"); c.t(x+34, y+68, who, F(14, "s"), INK, "lm")
        x2 = x + 44 + c.tw(who, F(14, "s")); x2 += (c.pill(x2, y+56, "Waiting on them", tint(G, .18), (30,110,50)) if "budget" in ttl else c.pill(x2, y+56, "Asked of me", tint(Y, .25), (176,96,0))) + 8; c.pill(x2, y+56, tag, tint(col, .18), (176,40,30) if col == R else (176,96,0))
        c.glyph("info", 168, y+108, B, .8); c.t(182, y+100, "Why am I seeing this?", F(13, "s"), B); c.t(350, y+100, q, F(13, "i"), MUT)
        c.d.line([64*K, (y+138)*K, 736*K, (y+138)*K], fill=LINE, width=K)
        c.btn(64, y+144, "Accept", "fill"); c.rr(150, y+144, 34, 34, 17, None, (218,220,224)); c.glyph("pencil", 167, y+161, MUT); c.rr(192, y+144, 34, 34, 17, None, (218,220,224)); c.glyph("cross", 209, y+161, MUT)
        c.btn(560, y+144, "Draft follow-up", "line")
        y += 210
    c.save("docs/design/option-b-date-tile.png")

# ---------------- Option C: compact list grouped by urgency
def option_c():
    c = Cv(800, 640); header(c, "Option C: Compact list", "Scan everything at a glance. Actions appear on hover. Best for many items.")
    c.rr(40, 92, 720, 520, 20, (255,255,255), None, True)
    c.t(64, 112, "Due today", F(15, "b"), (176,96,0)); c.pill(150, 110, "3", tint(Y, .3), (176,96,0), 12, "b", 9, 20)
    items = [("Send the budget sheet", "Shubham Kanauji", "waiting", "Today"), ("Send report", "Shubham Kanauji", "waiting", "Today"), ("Review the Q4 deck", "Sofia Marin", "asked", "Today")]
    y = 146
    for i, (ttl, who, icon, when) in enumerate(items):
        if i == 0: c.rr(52, y-8, 696, 64, 14, tint(B, .07))
        c.paste(ic(icon, 34), 66, y+2)
        c.t(116, y+4, ttl, F(16, "s")); c.t(116, y+28, who, F(13), MUT)
        if i == 0:
            for j, g in enumerate(("✓", "✎", "✕")):
                c.circ(612+j*44, y+22, 17, (255,255,255)); c.d.ellipse([(595+j*44)*K, (y+5)*K, (629+j*44)*K, (y+39)*K], outline=(218,220,224), width=K)
                c.glyph(("check","pencil","cross")[j], 612+j*44, y+22, (B, MUT, R)[j])
        else: c.t(730, y+20, when, F(13, "s"), (176,96,0), "rm")
        y += 70
    # tooltip for first row
    c.rr(300, 222, 330, 40, 10, (60,64,67)); c.t(315, 242, "“I will send you the budget sheet by Monday”", F(12, "i"), (255,255,255), "lm")
    c.t(64, 372, "This week", F(15, "b"), B); c.pill(150, 370, "2", tint(B, .18), (25,103,210), 12, "b", 9, 20)
    y = 406
    for ttl, who, icon, when in (("Ship the logo files", "Design team", "waiting", "Tue 24"), ("Share the logo files", "Design team", "waiting", "Wed 25")):
        c.paste(ic(icon, 34), 66, y+2); c.t(116, y+4, ttl, F(16, "s")); c.t(116, y+28, who, F(13), MUT); c.t(730, y+20, when, F(13, "s"), MUT, "rm"); y += 70
    c.d.line([64*K, 560*K, 736*K, 560*K], fill=LINE, width=K)
    c.circ(78, 584, 8, B); c.glyph("check", 78, 584, (255,255,255), .6); c.t(96, 584, "8 suggestions to review", F(14, "s"), INK, "lm"); c.btn(600, 566, "Review all", "fill", 32, 13)
    c.save("docs/design/option-c-compact-list.png")


# ---------------- Final: B + A's quote strip + C's grouping
def option_final():
    c = Cv(800, 1060); c.d.rectangle([0, 0, 800*K, 4*K], fill=B)
    c.t(40, 26, "Your promises", F(24, "b")); c.t(40, 62, "8 suggestions to review", F(14), MUT)
    groups = [("Due today", (176,96,0), Y, [
        ("Send the budget sheet", "Shubham Kanauji", "MON", "23", "Waiting on them", "“I will send you the budget sheet by Monday”"),
        ("Send report", "Shubham Kanauji", "MON", "23", "Waiting on them", "“Report is on the way”")]),
      ("This week", (25,103,210), B, [
        ("Review the Q4 deck", "Sofia Marin", "TUE", "24", "Asked of me", "“Can you review this by end of day?”"),
        ("Ship the logo files", "Design team", "WED", "25", "Waiting on them", "“I will ship the logo files by Wednesday”")])]
    y = 100
    for name, tc, pc, cards in groups:
        c.t(40, y+2, name, F(16, "b"), tc); c.pill(40 + c.tw(name, F(16, "b")) + 12, y, str(len(cards)), tint(pc, .28), tc, 12, "b", 9, 22)
        y += 38
        for ttl, who, dow, day, kind, q in cards:
            c.rr(40, y, 720, 196, 20, (255,255,255), None, True)
            tilec = R if name == "Due today" else B
            c.rr(64, y+22, 72, 84, 16, (255,255,255), (218,220,224)); c.rr(64, y+22, 72, 26, 16, tilec); c.d.rectangle([64*K, (y+36)*K, 136*K, (y+48)*K], fill=tilec)
            c.t(100, y+36, dow, F(12, "b"), (255,255,255), "mm"); c.t(100, y+78, day, F(34, "b"), INK, "mm")
            c.t(160, y+20, ttl, F(21, "b"))
            c.circ(173, y+66, 13, B); c.t(173, y+66, who[0], F(13, "b"), (255,255,255), "mm"); c.t(194, y+66, who, F(14, "s"), INK, "lm")
            x2 = 194 + c.tw(who, F(14, "s")) + 12
            if kind == "Asked of me": c.pill(x2, y+54, kind, tint(Y, .25), (176,96,0))
            else: c.pill(x2, y+54, kind, tint(G, .18), (30,110,50))
            c.rr(160, y+94, 576, 36, 10, SOFT); c.t(174, y+112, q, F(13, "i"), MUT, "lm"); c.t(716, y+112, "Open email", F(13, "s"), B, "rm"); c.glyph("arrow", 724, y+112, B, .7)
            c.d.line([64*K, (y+144)*K, 736*K, (y+144)*K], fill=LINE, width=K)
            c.btn(64, y+150, "Accept", "fill"); c.rr(150, y+150, 34, 34, 17, None, (218,220,224)); c.glyph("pencil", 167, y+167, MUT); c.rr(192, y+150, 34, 34, 17, None, (218,220,224)); c.glyph("cross", 209, y+167, MUT)
            if kind != "Asked of me": c.btn(580, y+150, "Draft follow-up", "line")
            y += 212
        y += 8
    c.save("docs/design/option-final.png")

if __name__ == "__main__":
    option_a(); option_b(); option_c(); option_final(); print("ok")
