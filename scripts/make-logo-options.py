"""Five logo options for review (design only). Run: python scripts/make-logo-options.py -> docs/design/logo-options.png"""
from PIL import Image, ImageDraw, ImageFont
import math
B, R, Y, G = (66,133,244), (234,67,53), (251,188,4), (52,168,83)
W = (255,255,255); INK = (32,33,36)
S = 4
def font(sz, w="b"): return ImageFont.truetype(f"C:/Windows/Fonts/{'segoeuib' if w=='b' else 'segoeui'}.ttf", sz)

def check(d, cx, cy, r, col=W, w=None):
    w = w or int(r*0.28)
    d.line([(cx-r*.5, cy+r*.02), (cx-r*.12, cy+r*.4), (cx+r*.55, cy-r*.38)], fill=col, width=w, joint="curve")
    for p in ((cx-r*.5, cy+r*.02), (cx+r*.55, cy-r*.38)): d.ellipse([p[0]-w/2, p[1]-w/2, p[0]+w/2, p[1]+w/2], fill=col)

def o1(n):  # envelope with four-colour flap and check badge
    im = Image.new("RGBA", (n*S, n*S), (0,0,0,0)); d = ImageDraw.Draw(im); u = n*S/100
    L, T, Rr, Bt, cx, cy = 6, 20, 94, 80, 50, 52
    d.polygon([(L*u,T*u),(Rr*u,T*u),(cx*u,cy*u)], fill=R)
    d.polygon([(L*u,T*u),(cx*u,cy*u),(L*u,Bt*u)], fill=B)
    d.polygon([(Rr*u,T*u),(Rr*u,Bt*u),(cx*u,cy*u)], fill=Y)
    d.polygon([(L*u,Bt*u),(Rr*u,Bt*u),(cx*u,cy*u)], fill=G)
    d.polygon([(22*u,28*u),(78*u,28*u),(50*u,50*u)], fill=W)
    d.ellipse([60*u, 52*u, 96*u, 88*u], fill=G, outline=W, width=int(3*u)); check(d, 78*u, 70*u, 15*u)
    return im
def o2(n):  # speech bubble with check
    im = Image.new("RGBA", (n*S, n*S), (0,0,0,0)); d = ImageDraw.Draw(im); u = n*S/100
    d.rounded_rectangle([8*u, 10*u, 92*u, 72*u], 22*u, fill=B); d.polygon([(26*u,66*u),(26*u,92*u),(52*u,68*u)], fill=B)
    check(d, 50*u, 41*u, 22*u)
    for i, c in enumerate((R, Y, G)): d.ellipse([(62+i*10)*u, 80*u, (70+i*10)*u, 88*u], fill=c)
    return im
def o3(n):  # P monogram tile with check
    im = Image.new("RGBA", (n*S, n*S), (0,0,0,0)); d = ImageDraw.Draw(im); u = n*S/100
    d.rounded_rectangle([4*u, 4*u, 96*u, 96*u], 24*u, fill=B)
    f = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", int(74*u)); d.text((46*u, 50*u), "P", font=f, fill=W, anchor="mm")
    d.ellipse([58*u, 56*u, 94*u, 92*u], fill=G, outline=W, width=int(3*u)); check(d, 76*u, 74*u, 14*u)
    return im
def o4(n):  # bookmark ribbon with four colour stripe + check
    im = Image.new("RGBA", (n*S, n*S), (0,0,0,0)); d = ImageDraw.Draw(im); u = n*S/100
    d.rounded_rectangle([4*u, 4*u, 96*u, 96*u], 24*u, fill=(255,255,255), outline=(218,220,224), width=int(2*u))
    d.polygon([(28*u,16*u),(72*u,16*u),(72*u,84*u),(50*u,66*u),(28*u,84*u)], fill=B)
    for i, c in enumerate((B, R, Y, G)): d.rectangle([(28+i*11)*u, 16*u, (39+i*11)*u, 26*u], fill=c)
    check(d, 50*u, 46*u, 14*u)
    return im
def o5(n):  # four-colour ring with check (Google "G" feel)
    im = Image.new("RGBA", (n*S, n*S), (0,0,0,0)); d = ImageDraw.Draw(im); u = n*S/100
    bb = [10*u, 10*u, 90*u, 90*u]
    for a0, c in ((-45, R), (45, Y), (135, G), (225, B)): d.arc(bb, a0+2, a0+88, fill=c, width=int(15*u))
    check(d, 50*u, 52*u, 22*u, G, int(9*u))
    return im

OPTS = [("1  Envelope, Google-colour flap + check badge", o1, "Closest to today's mark, cleaner and more colourful."),
        ("2  Speech bubble with check", o2, "Reads as 'a message that was promised'. Friendly, simple."),
        ("3  P monogram with check badge", o3, "Strong app-icon shape. Works smallest."),
        ("4  Bookmark ribbon", o4, "A saved promise. Four-colour top edge ties to the theme."),
        ("5  Four-colour ring with check", o5, "Most Google-like. Abstract, no email cue.")]
H = 250
page = Image.new("RGB", (1300, 90 + H*len(OPTS)), (248,249,250)); d = ImageDraw.Draw(page)
d.text((40, 24), "Promise Keeper: logo options", font=font(34), fill=INK)
for i, (name, fn, note) in enumerate(OPTS):
    y = 90 + i*H
    d.rounded_rectangle([30, y, 1270, y+H-16], 24, fill=W, outline=(232,234,237))
    big = fn(200).resize((200, 200), Image.LANCZOS); page.paste(big, (60, y+18), big)
    d.text((300, y+22), name, font=font(28), fill=INK); d.text((300, y+64), note, font=font(20, "r"), fill=(95,99,104))
    # app bar preview
    d.rounded_rectangle([300, y+110, 760, y+176], 12, fill=W, outline=(232,234,237))
    small = fn(40).resize((40, 40), Image.LANCZOS); page.paste(small, (316, y+123), small)
    x = 366
    for j, ch in enumerate("Promise Keeper"):
        d.text((x, y+127), ch, font=font(26), fill=[B, R, Y, B, G, R][j % 6]); x += d.textlength(ch, font=font(26))
    for j, t in enumerate(("Items", "Metrics")): d.text((x+30+j*90, y+131), t, font=font(20, "r"), fill=(95,99,104))
    fav = fn(16).resize((16, 16), Image.LANCZOS); page.paste(fav, (800, y+134), fav); d.text((826, y+132), "browser tab size", font=font(18, "r"), fill=(95,99,104))
    big2 = fn(64).resize((64, 64), Image.LANCZOS); page.paste(big2, (1000, y+110), big2); d.text((1080, y+130), "Gmail panel", font=font(18, "r"), fill=(95,99,104))
page.save("docs/design/logo-options.png"); print("ok")
