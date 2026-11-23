"""Wordmark and Gmail-header colour options for review. Run: python scripts/make-brand-options.py"""
from PIL import Image, ImageDraw, ImageFont
B, R, Y, G = (66,133,244), (234,67,53), (251,188,4), (52,168,83)
INK, MUT, W = (32,33,36), (95,99,104), (255,255,255)
def f(sz, w="b"): return ImageFont.truetype(f"C:/Windows/Fonts/{ {'b':'segoeuib','s':'seguisb','r':'segoeui'}[w] }.ttf", sz)
logo = Image.open("web/public/logo.png").convert("RGBA")

def runs(d, x, y, parts, font):
    for txt, col in parts:
        d.text((x, y), txt, font=font, fill=col); x += d.textlength(txt, font=font)
    return x

WM = [
 ("A  Product-name style (like 'Google Drive')", "Plain Google grey. Quiet and professional; the logo carries the colour.", [("Promise Keeper", MUT)], "r", None),
 ("B  Two-tone", "'Promise' in Google blue, 'Keeper' in dark. Simple and recognisable.", [("Promise ", B), ("Keeper", INK)], "b", None),
 ("C  Dark text + four-colour underline", "Clean dark text; the brand colours sit in a thin bar underneath.", [("Promise Keeper", INK)], "b", "bar"),
 ("D  Coloured initials", "Only the P and the K are coloured. Subtle Google nod.", [("P", B), ("romise ", INK), ("K", R), ("eeper", INK)], "b", None),
 ("E  Blue + green (promise made, promise kept)", "Blue for the promise, green for kept. Ties to the product meaning.", [("Promise ", B), ("Keeper", G)], "b", None),
]
page = Image.new("RGB", (1200, 100 + 170*len(WM)), (248,249,250)); d = ImageDraw.Draw(page)
d.text((40, 26), "Promise Keeper: wordmark options", font=f(34), fill=INK)
d.text((40, 70), "Today it is each letter in a different colour (not shown). Pick one.", font=f(18, "r"), fill=MUT)
for i, (name, note, parts, w, deco) in enumerate(WM):
    y = 110 + i*170
    d.rounded_rectangle([30, y, 1170, y+154], 22, fill=W, outline=(232,234,237))
    d.text((60, y+16), name, font=f(24), fill=INK); d.text((60, y+52), note, font=f(17, "r"), fill=MUT)
    # app bar mock
    d.rounded_rectangle([60, y+88, 700, y+142], 10, fill=W, outline=(232,234,237))
    lg = logo.resize((34, 34), Image.LANCZOS); page.paste(lg, (74, y+98), lg)
    x = runs(d, 118, y+99, parts, f(26, w))
    if deco: 
        for k, c in enumerate((B, R, Y, G)): d.rectangle([118+k*((x-118)/4), y+132, 118+(k+1)*((x-118)/4), y+135], fill=c)
    for j, t in enumerate(("Items", "Metrics", "Settings")): d.text((x+40+j*90, y+103), t, font=f(18, "r"), fill=MUT)
    # large
    d.rounded_rectangle([730, y+88, 1150, y+142], 10, fill=(248,249,250))
    lg = logo.resize((40, 40), Image.LANCZOS); page.paste(lg, (746, y+95), lg); runs(d, 800, y+97, parts, f(30, w))
page.save("docs/design/wordmark-options.png")

# ---- Gmail sidebar header colour options
opts = [("Today", (68,68,68), W, "Gmail's default dark grey"),
        ("1  White", W, INK, "Clean, matches the Google look"),
        ("2  Google blue", B, W, "Strong brand colour"),
        ("3  Soft blue", (232,240,254), (25,103,210), "Light and calm")]
img = Image.new("RGB", (1300, 790), (248,249,250)); d = ImageDraw.Draw(img)
d.text((40, 26), "Gmail sidebar: top bar colour options", font=f(34), fill=INK)
d.text((40, 70), "The dark bar is the add-on frame. Its colour comes from the add-on settings; Gmail picks readable text.", font=f(18, "r"), fill=MUT)
for i, (name, bg, fg, note) in enumerate(opts):
    x = 40 + i*310
    d.rounded_rectangle([x, 120, x+290, 730], 16, fill=W, outline=(218,220,224))
    d.rounded_rectangle([x, 120, x+290, 184], 16, fill=bg); d.rectangle([x, 150, x+290, 184], fill=bg)
    d.text((x+22, 152), "Promise Keeper", font=f(21, "s"), fill=fg, anchor="lm"); d.text((x+264, 152), "✕", font=f(18, "r"), fill=fg, anchor="mm") if False else None
    d.line([(x+256, 144), (x+272, 160)], fill=fg, width=3); d.line([(x+256, 160), (x+272, 144)], fill=fg, width=3)
    for k in range(3): d.ellipse([x+236, 143+k*7, x+240, 147+k*7], fill=fg)
    tiles = [("0", R, "Overdue"), ("3", Y, "Due today"), ("7", B, "To review"), ("7", G, "Waiting")]
    for k, (n, c, l) in enumerate(tiles):
        tx = x+16+k*68; d.rounded_rectangle([tx, 204, tx+62, 268], 12, fill=(241,243,244)); d.text((tx+31, 228), n, font=f(26), fill=c, anchor="mm"); d.text((tx+31, 255), l, font=f(10, "r"), fill=MUT, anchor="mm")
    for r in range(4):
        yy = 296 + r*104; lg = Image.open("web/public/icons/waiting.png").convert("RGBA").resize((30, 30)); img.paste(lg, (x+16, yy+8), lg)
        d.text((x+58, yy), "MON 23 NOV · Due today", font=f(11, "b"), fill=(176,96,0)); d.text((x+58, yy+18), "Send the budget sheet", font=f(15, "b"), fill=INK); d.text((x+58, yy+42), "Shubham Kanauji", font=f(12, "r"), fill=MUT)
    d.text((x+145, 742), name + ": " + note, font=f(14, "r"), fill=MUT, anchor="mm") if False else None
    d.text((x, 736), name, font=f(18), fill=INK); 
img.save("docs/design/sidebar-header-options.png"); print("ok")

# ---- more soft header options
MORE = [("4  Soft blue (as before)", (232,240,254), (25,103,210)), ("5  Sky blue", (210,227,252), (23,78,166)), ("6  Pale blue", (240,246,255), (26,115,232)),
        ("7  Soft green", (230,244,234), (19,115,51)), ("8  Soft yellow", (254,247,224), (176,96,0)), ("9  Soft red", (252,232,230), (165,14,14)),
        ("10  Lavender", (243,232,253), (104,26,176)), ("11  Soft grey", (241,243,244), (60,64,67)), ("12  Mint-teal", (224,247,250), (0,105,120)), ("13  Peach", (255,239,230), (179,58,0)),
        ("14  Blue-to-white fade", None, (25,103,210)), ("15  Blue, bold text", (232,240,254), (13,71,161))]
img = Image.new("RGB", (1300, 1250), (248,249,250)); d = ImageDraw.Draw(img)
d.text((40, 26), "Gmail sidebar: more top-bar colours", font=f(34), fill=INK)
d.text((40, 70), "All keep the white card body. Pick one number, or ask for a mix.", font=f(18, "r"), fill=MUT)
for i, (name, bg, fg) in enumerate(MORE):
    col, row = i % 4, i // 4
    x, y0 = 40 + col*310, 110 + row*380
    d.rounded_rectangle([x, y0, x+290, y0+350], 16, fill=W, outline=(218,220,224))
    if bg is None:
        for k in range(64):
            t = k/63; c = tuple(int(a*(1-t) + 255*t) for a in (210,227,252)); d.line([(x+1, y0+k), (x+289, y0+k)], fill=c)
        d.rounded_rectangle([x, y0, x+290, y0+30], 16, fill=(210,227,252)); d.rectangle([x, y0+16, x+290, y0+30], fill=(210,227,252))
        for k in range(34): 
            t = k/33; c = tuple(int(a*(1-t) + 255*t) for a in (210,227,252)); d.line([(x+1, y0+30+k), (x+289, y0+30+k)], fill=c)
    else:
        d.rounded_rectangle([x, y0, x+290, y0+64], 16, fill=bg); d.rectangle([x, y0+30, x+290, y0+64], fill=bg)
    d.text((x+22, y0+32), "Promise Keeper", font=f(21, "b" if name.startswith("15") else "s"), fill=fg, anchor="lm")
    d.line([(x+256, y0+24), (x+272, y0+40)], fill=fg, width=3); d.line([(x+256, y0+40), (x+272, y0+24)], fill=fg, width=3)
    for k in range(3): d.ellipse([x+236, y0+23+k*7, x+240, y0+27+k*7], fill=fg)
    for k, (n, c, l) in enumerate([("0", R, "Overdue"), ("3", Y, "Due today"), ("7", B, "To review"), ("7", G, "Waiting")]):
        tx = x+16+k*68; d.rounded_rectangle([tx, y0+84, tx+62, y0+148], 12, fill=(241,243,244)); d.text((tx+31, y0+108), n, font=f(26), fill=c, anchor="mm"); d.text((tx+31, y0+135), l, font=f(10, "r"), fill=MUT, anchor="mm")
    for r in range(2):
        yy = y0 + 172 + r*80; lg = Image.open("web/public/icons/waiting.png").convert("RGBA").resize((30, 30)); img.paste(lg, (x+16, yy+8), lg)
        d.text((x+58, yy), "MON 23 NOV · Due today", font=f(11, "b"), fill=(176,96,0)); d.text((x+58, yy+18), "Send the budget sheet", font=f(15, "b"), fill=INK); d.text((x+58, yy+42), "Shubham Kanauji", font=f(12, "r"), fill=MUT)
    d.text((x, y0+356), name, font=f(17), fill=INK)
img.save("docs/design/sidebar-header-more.png"); print("ok2")

# ---- more wordmarks
def lerp(a, b, t): return tuple(int(a[i]*(1-t) + b[i]*t) for i in range(3))
def grad(txt, c1, c2): return [(ch, lerp(c1, c2, i/max(1, len(txt)-1))) for i, ch in enumerate(txt)]
DK = (25,103,210)
def draw_wm(d, page, x, y, kind, sz):
    fb, fr, fs = f(sz, "b"), f(sz, "r"), f(sz, "s")
    if kind == "F": return runs(d, x, y, [("Promise Keeper", B)], fb)
    if kind == "G":
        x = runs(d, x, y, [("Promise ", INK)], fb); wd = d.textlength("Keeper", font=fb)
        d.rounded_rectangle([x-8, y-2, x+wd+8, y+sz+8], 10, fill=(232,240,254)); return runs(d, x, y, [("Keeper", DK)], fb) + 8
    if kind == "H":
        runs(d, x, y-6, [("Promise", B)], f(int(sz*.72), "b")); return runs(d, x, y+sz*.62, [("Keeper", G)], f(int(sz*.72), "b"))
    if kind == "I": return runs(d, x, y, [("promise keeper", DK)], fs)
    if kind == "J": return runs(d, x, y, [("Promise ", MUT), ("Keeper", B)], fb if False else fs) if False else runs(d, runs(d, x, y, [("Promise ", MUT)], fr), y, [("Keeper", B)], fb)
    if kind == "K":
        x = runs(d, x, y, [("Promise Keeper", INK)], fb); d.line([(x+8, y+sz*.62), (x+16, y+sz*.82), (x+30, y+sz*.42)], fill=G, width=4, joint="curve"); return x+36
    if kind == "L": return runs(d, x, y+2, [(c, DK) if c != " " else (" ", DK) for c in "PROMISE KEEPER"], f(int(sz*.78), "s"))
    if kind == "M": return runs(d, x, y, grad("Promise Keeper", B, G), fb)
    if kind == "N":
        x = runs(d, x, y, [("Promise ", INK)], fb); wd = d.textlength("Keeper", font=fb)
        d.rounded_rectangle([x-4, y-1, x+wd+14, y+sz+8], 10, fill=B); return runs(d, x+5, y, [("Keeper", W)], fb) + 10
    if kind == "O":
        x = runs(d, x, y, [("Promise Keeper", MUT)], fr)
        for k, c in enumerate((B, R, Y, G)): d.ellipse([x+8+k*12, y+sz*.62, x+16+k*12, y+sz*.62+8], fill=c)
        return x+60
MWM = [("F  All blue", "One calm brand colour. Very clean.", "F"),
       ("G  'Keeper' on a soft-blue highlight", "Matches the soft-blue sidebar bar.", "G"),
       ("H  Stacked, blue over green", "Two short lines. Compact for the header.", "H"),
       ("I  Lowercase, friendly", "'promise keeper' in deep blue, semi-bold.", "I"),
       ("J  Weight contrast", "'Promise' light grey, 'Keeper' bold blue.", "J"),
       ("K  With a green check after it", "Dark text, a drawn check mark: the promise kept.", "K"),
       ("L  Spaced capitals", "PROMISE KEEPER, small, deep blue. Quiet, premium.", "L"),
       ("M  Blue to green blend", "Colour shifts across the letters: promise to kept.", "M"),
       ("N  'Keeper' as a blue badge", "Dark 'Promise', white text on a blue pill.", "N"),
       ("O  Grey with four colour dots", "Like a Google product name, with the brand dots.", "O")]
page = Image.new("RGB", (1200, 100 + 170*len(MWM)), (248,249,250)); d = ImageDraw.Draw(page)
d.text((40, 26), "Promise Keeper: more wordmark options (F to O)", font=f(34), fill=INK)
d.text((40, 70), "A to E are on the earlier sheet. Pick any letter.", font=f(18, "r"), fill=MUT)
for i, (name, note, kind) in enumerate(MWM):
    y = 110 + i*170
    d.rounded_rectangle([30, y, 1170, y+154], 22, fill=W, outline=(232,234,237))
    d.text((60, y+16), name, font=f(24), fill=INK); d.text((60, y+52), note, font=f(17, "r"), fill=MUT)
    d.rounded_rectangle([60, y+88, 700, y+142], 10, fill=(232,240,254)); 
    lg = logo.resize((34, 34), Image.LANCZOS); page.paste(lg, (74, y+98), lg)
    x = draw_wm(d, page, 118, y+99, kind, 26)
    for j, t in enumerate(("Items", "Metrics", "Settings")): d.text((x+40+j*90, y+103), t, font=f(18, "r"), fill=MUT)
    d.rounded_rectangle([730, y+88, 1150, y+142], 10, fill=W, outline=(232,234,237))
    lg = logo.resize((40, 40), Image.LANCZOS); page.paste(lg, (746, y+95), lg); draw_wm(d, page, 800, y+97, kind, 30)
page.save("docs/design/wordmark-options-2.png"); print("ok3")

# ---- Google-theme wordmarks (P to Y)
FOUR = [B, R, Y, G]
def draw_g(d, page, x, y, kind, sz):
    fb, fr = f(sz, "b"), f(sz, "r")
    if kind == "P": return runs(d, x, y, [("Promise ", B), ("Keeper", R)], fb)
    if kind == "Q":
        seq = [B, R, Y, B, G, R, G]; x = runs(d, x, y, [(c, seq[i]) for i, c in enumerate("Promise")], fb); return runs(d, x, y, [(" Keeper", MUT)], fr)
    if kind == "R":
        x2 = runs(d, x, y, [("Promise Keeper", INK)], fb); w = x2 - x
        for k, c in enumerate(FOUR): d.rounded_rectangle([x + k*(w/4)+2, y+sz+8, x + (k+1)*(w/4)-2, y+sz+12], 2, fill=c)
        return x2
    if kind == "S":
        for k, c in enumerate(FOUR): d.rounded_rectangle([x + (k%2)*12, y+4 + (k//2)*12, x + (k%2)*12 + 10, y+14 + (k//2)*12], 3, fill=c)
        return runs(d, x+32, y, [("Promise Keeper", INK)], fb)
    if kind == "T":
        return runs(d, x, y, [("Prom", B), ("ise ", R), ("Kee", Y if False else (240,170,0)), ("per", G)], fb)
    if kind == "U":
        txt = "Promise Keeper"; n = len(txt); stops = [B, R, (240,170,0), G]; out = []
        for i, ch in enumerate(txt):
            t = i/(n-1)*3; k = min(2, int(t)); out.append((ch, lerp(stops[k], stops[k+1], t-k)))
        return runs(d, x, y, out, fb)
    if kind == "V":
        wd = d.textlength("Promise Keeper", font=fb) + 32; top, bot = y-2, y+int(sz*1.45)+4
        d.rounded_rectangle([x, top, x+wd, bot], (bot-top)//2, outline=(190,196,204), width=2)
        for k, c in enumerate(FOUR): d.line([(x+16+k*(wd-32)/4, bot-1), (x+16+(k+1)*(wd-32)/4, bot-1)], fill=c, width=4)
        return runs(d, x+16, y, [("Promise Keeper", INK)], fb) + 16
    if kind == "W":
        x = runs(d, x, y, [("Promise Keeper", INK)], fb); x = runs(d, x+6, y+sz*.28, [("for Gmail", MUT)], f(int(sz*.62), "r"))
        for k, c in enumerate(FOUR): d.ellipse([x+8+k*11, y+sz*.5, x+15+k*11, y+sz*.5+7], fill=c)
        return x+56
    if kind == "X":
        d.rectangle([x, y+2, x+5, y+sz+4], fill=B); d.rectangle([x+5, y+2, x+10, y+sz+4], fill=R); d.rectangle([x+10, y+2, x+15, y+sz+4], fill=Y); d.rectangle([x+15, y+2, x+20, y+sz+4], fill=G)
        return runs(d, x+32, y, [("Promise Keeper", INK)], fb)
    if kind == "Y":
        x = runs(d, x, y, [("Promise", B), (" ", INK), ("Keeper", G)], fb)
        d.ellipse([x+6, y+sz*.62, x+14, y+sz*.62+8], fill=R); d.ellipse([x+18, y+sz*.62, x+26, y+sz*.62+8], fill=(240,170,0)); return x+36
GWM = [("P  Two words, two colours", "'Promise' blue, 'Keeper' red.", "P"),
       ("Q  Google-logo colour order on 'Promise'", "Blue, red, yellow, blue, green, red. 'Keeper' in grey.", "Q"),
       ("R  Dark text, four-colour rounded underline", "Wider, bolder cousin of option C.", "R"),
       ("S  Four-colour tile before the name", "Like the Google Workspace app marks.", "S"),
       ("T  Four colour chunks", "Prom / ise / Kee / per, one colour each.", "T"),
       ("U  Google colour gradient", "Blue to red to yellow to green across the name.", "U"),
       ("V  Outline pill, colour base line", "Name inside a pill with a four-colour bottom edge.", "V"),
       ("W  'for Gmail' style + dots", "Reads like 'Google Calendar'-style naming, with four dots.", "W"),
       ("X  Four-colour flag stripe", "Vertical blue, red, yellow, green bars before dark text.", "X"),
       ("Y  Blue + green with red and yellow dots", "Promise (blue) kept (green), dots add the other two colours.", "Y")]
page = Image.new("RGB", (1200, 100 + 170*len(GWM)), (248,249,250)); d = ImageDraw.Draw(page)
d.text((40, 26), "Promise Keeper: Google-theme wordmark options (P to Y)", font=f(34), fill=INK)
d.text((40, 70), "Every option uses the four Google colours. Soft-blue bar shown, as chosen for Gmail.", font=f(18, "r"), fill=MUT)
for i, (name, note, kind) in enumerate(GWM):
    y = 110 + i*170
    d.rounded_rectangle([30, y, 1170, y+154], 22, fill=W, outline=(232,234,237))
    d.text((60, y+16), name, font=f(24), fill=INK); d.text((60, y+52), note, font=f(17, "r"), fill=MUT)
    d.rounded_rectangle([60, y+88, 700, y+142], 10, fill=(232,240,254))
    lg = logo.resize((34, 34), Image.LANCZOS); page.paste(lg, (74, y+98), lg)
    x = draw_g(d, page, 118, y+97, kind, 26)
    for j, t in enumerate(("Items", "Metrics", "Settings")): d.text((x+40+j*90, y+103), t, font=f(18, "r"), fill=MUT)
    d.rounded_rectangle([730, y+88, 1150, y+142], 10, fill=W, outline=(232,234,237))
    lg = logo.resize((40, 40), Image.LANCZOS); page.paste(lg, (746, y+95), lg); draw_g(d, page, 800, y+95, kind, 30)
page.save("docs/design/wordmark-options-google.png"); print("ok4")
