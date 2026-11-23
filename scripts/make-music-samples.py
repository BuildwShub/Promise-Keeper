"""Original background-music samples for the promo videos (no copyrighted material). Run: python scripts/make-music-samples.py"""
import wave
from pathlib import Path
import numpy as np

SR = 44100
OUT = Path(__file__).resolve().parent.parent / "docs" / "promo" / "_tmp" / "music"
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)

def tone(kind, f, L):
    t = np.arange(L) / SR
    if kind == "pluck": return (np.sin(2*np.pi*f*t) + .3*np.sin(2*np.pi*f*3*t)) * np.exp(-t*7)
    if kind == "piano": return (np.sin(2*np.pi*f*t) + .5*np.sin(2*np.pi*f*2*t)*np.exp(-t*3) + .25*np.sin(2*np.pi*f*3*t)*np.exp(-t*5)) * np.exp(-t*2.6) * np.minimum(1, t/0.004)
    if kind == "rhodes": return np.sin(2*np.pi*f*t + 1.1*np.sin(2*np.pi*f*t)*np.exp(-t*4)) * np.exp(-t*2.2) * (1 + .12*np.sin(2*np.pi*4.5*t))
    if kind == "bell": return (np.sin(2*np.pi*f*t) + .4*np.sin(2*np.pi*f*2.76*t)*np.exp(-t*4)) * np.exp(-t*3.2)
    if kind == "bright": return (np.sin(2*np.pi*f*t) + .35*np.sin(2*np.pi*f*2*t) + .2*np.sin(2*np.pi*f*4*t)) * np.exp(-t*9)
    raise ValueError(kind)

STYLES = {
    "1-upbeat-pop": dict(bpm=96, chords=[(60,64,67),(57,60,64),(53,57,60),(55,59,62)], arp="pluck", steps=8, pat=[0,1,2,1,2,1,0,1], oct=12, pad=.05, bass=.22, kick=(0,2), clap=(), hat=True, hatlvl=.025, noise=0),
    "2-lofi-chill": dict(bpm=78, chords=[(60,64,67,71),(57,60,64,67),(62,65,69,72),(55,59,62,65)], arp="rhodes", steps=4, pat=[0,2,1,3], oct=0, pad=.05, bass=.20, kick=(0,2.5), clap=(1,3), hat=True, hatlvl=.02, noise=.006),
    "3-corporate-inspire": dict(bpm=108, chords=[(55,59,62),(62,66,69),(64,67,71),(60,64,67)], arp="bright", steps=8, pat=[0,1,2,1,0,1,2,1], oct=12, pad=.07, bass=.20, kick=(0,2), clap=(1,3), hat=True, hatlvl=.02, noise=0),
    "4-soft-piano": dict(bpm=70, chords=[(60,64,67),(55,59,62),(57,60,64),(53,57,60)], arp="piano", steps=4, pat=[0,1,2,1], oct=0, pad=.06, bass=.16, kick=(), clap=(), hat=False, hatlvl=0, noise=0),
    "5-energetic-tech": dict(bpm=122, chords=[(57,60,64),(53,57,60),(60,64,67),(55,59,62)], arp="bell", steps=8, pat=[0,2,1,2,0,2,1,2], oct=12, pad=.04, bass=.26, kick=(0,1,2,3), clap=(1,3), hat=True, hatlvl=.03, noise=0),
}

def make(name, cfg, seconds=28, path=None):
    n = int((seconds + 2) * SR)
    out = np.zeros(n)
    beat = 60.0 / cfg["bpm"]; bar = beat * 4
    def add(sig, start):
        i0 = int(start * SR)
        if 0 <= i0 < n:
            seg = sig[: n - i0]; out[i0:i0+len(seg)] += seg
    rng = np.random.default_rng(1)
    for b in range(int((seconds + 2) / bar) + 1):
        ch = cfg["chords"][b % len(cfg["chords"])]; t0 = b * bar
        L = int((bar + .6) * SR); tt = np.arange(L) / SR
        env = np.minimum(1, tt/.5) * np.minimum(1, (bar + .6 - tt)/.6)
        add(sum(np.sin(2*np.pi*hz(m)*tt) + .4*np.sin(2*np.pi*hz(m)*2*tt) for m in ch) * env * cfg["pad"], t0)
        step = bar / cfg["steps"]
        for k in range(cfg["steps"]):
            idx = cfg["pat"][k % len(cfg["pat"])]
            m = ch[idx % len(ch)] + cfg["oct"]
            add(tone(cfg["arp"], hz(m), int(.9 * SR)) * .11, t0 + k * step)
        for k in (0, 2):
            L = int(beat * 1.9 * SR); tt = np.arange(L) / SR
            add(np.sin(2*np.pi*hz(ch[0]-12)*tt) * np.exp(-tt*2.2) * cfg["bass"], t0 + k * beat)
        for k in cfg["kick"]:
            L = int(.25 * SR); tt = np.arange(L) / SR
            add(np.sin(2*np.pi*(50 + 90*np.exp(-tt*28))*tt) * np.exp(-tt*14) * .30, t0 + k * beat)
        for k in cfg["clap"]:
            L = int(.12 * SR); tt = np.arange(L) / SR
            add(rng.standard_normal(L) * np.exp(-tt*35) * .06, t0 + k * beat)
        if cfg["hat"]:
            for k in range(8):
                if k % 2 == 1:
                    L = int(.05 * SR); tt = np.arange(L) / SR
                    add(rng.standard_normal(L) * np.exp(-tt*90) * cfg["hatlvl"], t0 + k * beat / 2)
    if cfg["noise"]:
        out += rng.standard_normal(n) * cfg["noise"] * (np.random.default_rng(3).random(n) > .98)
    out *= .9 / max(1e-6, np.abs(out).max())
    f = SR * 2
    out[:f] *= np.linspace(0, 1, f); out[-f:] *= np.linspace(1, 0, f)
    p = Path(path) if path else OUT / f"{name}.wav"
    with wave.open(str(p), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.stack([out, out], 1) * 32767).astype(np.int16).tobytes())
    return p

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, cfg in STYLES.items():
        print(make(name, cfg))
