"""Subset Noto Serif SC to the hanzi actually used in headlines.

The Chinese headlines are set in a serif. macOS has Songti, but Windows only has
SimSun, which is bitmap-hinted and ugly at display sizes, so we ship a subset of
Noto Serif SC covering every character that appears in a headline-ish string
(titles, names, labels, short strings) across src/_data. Body text stays in the
system sans and is never subset.

Run after editing headline copy:  pnpm fonts   (needs python + fontTools + brotli)
"""
import io, json, os, re, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "_data")
OUT = os.path.join(ROOT, "src", "assets", "fonts", "NotoSerifSC-Display.woff2")
SRC = next((p for p in [
    os.path.join(os.environ.get("WINDIR", "C:/Windows"), "Fonts", "NotoSerifSC-VF.ttf"),
    os.path.expanduser("~/Library/Fonts/NotoSerifSC-VF.ttf"),
    "/usr/share/fonts/truetype/noto/NotoSerifSC-VF.ttf",
] if os.path.exists(p)), None)
if not SRC:
    sys.exit("Noto Serif SC variable font not found; install it or edit SRC in scripts/subset-cjk.py")

HEAD_KEYS = re.compile(r"^(title|subtitle|name|name_latin|label|eyebrow|question|kv_alt|.*Title|.*_title|.*_label|nodes|prompts|line|tagline|status)$")
SHORT = 28  # strings this short are headings, labels, names; paragraphs are longer
chars = set()

def walk(node, key=""):
    if isinstance(node, dict):
        for k, v in node.items():
            walk(v, k)
    elif isinstance(node, list):
        # collab.json keeps [title, body] pairs: the title is the first element
        if len(node) == 2 and all(isinstance(x, str) for x in node):
            chars.update(node[0])
        for v in node:
            walk(v, key)
    elif isinstance(node, str):
        if HEAD_KEYS.match(key) or len(node) <= SHORT:
            chars.update(node)

for dirpath, _, files in os.walk(DATA):
    for f in files:
        if f.endswith(".json"):
            walk(json.load(io.open(os.path.join(dirpath, f), encoding="utf-8")))

# digits, ASCII and the CJK punctuation that can appear in any headline
for cp in range(0x20, 0x7F):
    chars.add(chr(cp))
for cp in [0x3000, 0x3001, 0x3002, 0x300A, 0x300B, 0x300C, 0x300D, 0x300E, 0x300F, 0x3010, 0x3011,
           0xFF08, 0xFF09, 0xFF0C, 0xFF1A, 0xFF1B, 0xFF1F, 0xFF01, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D,
           0x2026, 0x00B7, 0x2192, 0x2197, 0x00D7, 0x2022]:
    chars.add(chr(cp))
cjk = sorted(c for c in chars if ord(c) > 0x2FFF)
text = "".join(sorted(chars))

font = TTFont(SRC)
static = instancer.instantiateVariableFont(font, {"wght": 400}, inplace=False)
opts = subset.Options()
opts.flavor = "woff2"
opts.layout_features = ["kern", "liga", "vert"]
opts.name_IDs = [1, 2, 3, 4, 6]
opts.notdef_outline = True
sub = subset.Subsetter(opts)
sub.populate(text=text)
sub.subset(static)
static.flavor = "woff2"
static.save(OUT)
print("headline hanzi: %d unique  ->  %s  %.0f KB" % (len(cjk), os.path.relpath(OUT, ROOT), os.path.getsize(OUT) / 1024))
