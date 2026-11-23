"""Sidebar icons (96x96 PNG, transparent) for the Gmail add-on cards. Run: python scripts/make-icons.py"""
from PIL import Image, ImageDraw
S = 4  # supersample
N = 96 * S
def base(color):
    im = Image.new("RGBA", (N, N), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse([4*S, 4*S, N-4*S, N-4*S], fill=color); return im, d
def save(im, name): im.resize((96, 96), Image.LANCZOS).save(f"web/public/icons/{name}.png")
W = (255, 255, 255, 255)
def line(d, pts, w=8): d.line([(x*S, y*S) for x, y in pts], fill=W, width=w*S, joint="curve")
# promised (purple): upward arrow-out / hand-off = paper plane
im, d = base((66, 133, 244, 255)); d.polygon([(26*S,48*S),(72*S,26*S),(58*S,72*S),(48*S,54*S)], fill=W); line(d, [(48,54),(72,26)], 4); save(im, "promised")
# asked (orange): inbox arrow down
im, d = base((251, 188, 4, 255)); line(d, [(48,24),(48,58)]); line(d, [(32,44),(48,60),(64,44)]); line(d, [(28,70),(68,70)]); save(im, "asked")
# deadline (red): clock
im, d = base((234, 67, 53, 255)); d.ellipse([22*S,22*S,74*S,74*S], outline=W, width=6*S); line(d, [(48,34),(48,48),(59,54)], 6); save(im, "deadline")
# waiting (blue): hourglass
im, d = base((52, 168, 83, 255)); d.polygon([(30*S,24*S),(66*S,24*S),(48*S,48*S)], fill=W); d.polygon([(48*S,48*S),(30*S,72*S),(66*S,72*S)], fill=W); save(im, "waiting")
# tasks (blue square check)
im = Image.new("RGBA", (N, N), (0,0,0,0)); d = ImageDraw.Draw(im); d.rounded_rectangle([8*S,8*S,N-8*S,N-8*S], radius=18*S, fill=(66,133,244,255)); line(d, [(28,50),(42,64),(70,34)], 9); save(im, "tasks")
# calendar
im = Image.new("RGBA", (N, N), (0,0,0,0)); d = ImageDraw.Draw(im); d.rounded_rectangle([10*S,14*S,N-10*S,N-8*S], radius=12*S, fill=(255,255,255,255), outline=(26,115,232,255), width=5*S); d.rectangle([10*S,14*S,N-10*S,36*S], fill=(26,115,232,255)); d.rounded_rectangle([10*S,14*S,N-10*S,40*S], radius=12*S, fill=(26,115,232,255)); d.rectangle([10*S,30*S,N-10*S,40*S], fill=(26,115,232,255)); d.rectangle([28*S,50*S,40*S,60*S], fill=(66,133,244,255)); d.rectangle([54*S,50*S,66*S,60*S], fill=(251,188,4,255)); d.rectangle([28*S,66*S,40*S,76*S], fill=(52,168,83,255)); save(im, "calendar")
# done (green check circle)
im, d = base((52, 168, 83, 255)); line(d, [(28,50),(42,64),(70,34)], 9); save(im, "done")
# alert (red !)
im, d = base((234, 67, 53, 255)); line(d, [(48,26),(48,52)], 9); d.ellipse([43*S,62*S,53*S,72*S], fill=W); save(im, "alert")
# suggestion (grey-blue spark)
im, d = base((95, 99, 104, 255)); d.polygon([(48*S,22*S),(55*S,41*S),(74*S,48*S),(55*S,55*S),(48*S,74*S),(41*S,55*S),(22*S,48*S),(41*S,41*S)], fill=W); save(im, "suggested")
