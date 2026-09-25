"""Generate src/_includes/diagrams/dfm-overview.njk -- the DFM overview figure.

The figure is the paper's Figure 1 (three stages of intelligence scaling,
current foundation models against DFMs, the recursive discovery loop), redrawn
in the grammar of the other diagrams on /tech/ (README, "各项工作的示意图"):
hairlines with no fills, one blue in three strengths for everything that is
drawn, and exactly one amber element -- here, as in dfm.njk, the step where an
explanation is tested against external evidence. Motion is the shared
.dg__draw / .dg__fade / .dg__mv / .dg__ring set. It replaces the raster
dfm-diagram-{zh,en}.webp, which stays on as the share image.

Coordinates, curve samples and arrow angles are computed here rather than typed
into the template, so the drawing can be moved without re-deriving them by hand.
Run from the project root after any change, and commit both files:

    python3 scripts/gen-dfm-overview.py

Chinese and English are laid out separately (their own line breaks), then
emitted as {% if lang == 'zh' %} ... {% else %} ... {% endif %} pairs.
The viewBox height H must match `aspect-ratio:1200/<H>` in site.css section 10.
"""
import html
import math
from pathlib import Path

W, H = 1200, 706
out = []


def emit(s):
    out.append(s)


def esc(s):
    return html.escape(s, quote=False)


def f(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def one(x, y, lines, cls, anchor="start", lh=18):
    """One language's text element (for blocks laid out per language)."""
    if isinstance(lines, str):
        lines = [lines]
    if len(lines) == 1:
        return f"<text class='{cls}' x='{f(x)}' y='{f(y)}' text-anchor='{anchor}'>{esc(lines[0])}</text>"
    spans = "".join(f"<tspan x='{f(x)}' dy='{0 if i == 0 else lh}'>{esc(l)}</tspan>" for i, l in enumerate(lines))
    return f"<text class='{cls}' x='{f(x)}' y='{f(y)}' text-anchor='{anchor}'>{spans}</text>"


def text(x, y, zh, en, cls, anchor="start", lh=18, d=None, extra=""):
    """A text block in both languages. zh / en: str or list of lines."""
    style = f" style='--d:{d}s'" if d is not None else ""

    def block(lines):
        if isinstance(lines, str):
            lines = [lines]
        if len(lines) == 1:
            return (f"<text class='{cls}' x='{f(x)}' y='{f(y)}' text-anchor='{anchor}'{style}{extra}>"
                    f"{esc(lines[0])}</text>")
        spans = "".join(
            f"<tspan x='{f(x)}' dy='{0 if i == 0 else lh}'>{esc(l)}</tspan>" for i, l in enumerate(lines)
        )
        return f"<text class='{cls}' x='{f(x)}' y='{f(y)}' text-anchor='{anchor}'{style}{extra}>{spans}</text>"

    emit("{% if lang == 'zh' %}" + block(zh) + "{% else %}" + block(en) + "{% endif %}")


def arrow(x, y, angle_deg, cls="dg__p", size=7, d=None):
    style = f" style='--d:{d}s'" if d is not None else ""
    emit(f"<path class='{cls}'{style} transform='translate({f(x)},{f(y)}) rotate({f(angle_deg)})' "
         f"d='M -{size},-{size * .58:.1f} L 0,0 L -{size},{size * .58:.1f}'/>")


def panel(x, y, w, h, cls, d):
    emit(f"<rect class='{cls} dg__draw' style='--d:{d}s' pathLength='1' x='{f(x)}' y='{f(y)}' "
         f"width='{f(w)}' height='{f(h)}' rx='10'/>")


def badge(x, y, r, n, strong=False):
    """A numbered stage/step marker. The numeral is a tspan, as in the other
    diagrams, so the shared hover rule for text leaves its colour alone."""
    return (f"<circle class='ov__badge{' ov__badge--strong' if strong else ''}' cx='{f(x)}' cy='{f(y)}' r='{r}'/>"
            f"<text x='{f(x)}' y='{f(y + 4)}' text-anchor='middle'><tspan class='dg__num'>{n}</tspan></text>")


emit('<svg class="dg dg--ov" viewBox="0 0 %d %d" preserveAspectRatio="xMidYMid meet" '
     'aria-hidden="true" focusable="false">' % (W, H))

# ------------------------------------------------------------------ frames
TOP, TOP_H = 0.5, 467
AX, AW = 0.5, 372
BX, BW = 388, 280
CX, CW = 796, 403.5
BAND_Y, BAND_H = 488, 216
panel(AX, TOP, AW, TOP_H, "ov__panel", 0)
panel(BX, TOP, BW, TOP_H, "ov__panel", .15)
panel(CX, TOP, CW, TOP_H, "ov__panel ov__panel--focus", .3)
panel(0.5, BAND_Y, 1199, BAND_H, "ov__panel", .45)

# ------------------------------------------------------------------ A. three stages
# One blue in three strengths: what humans wrote, what actions returned, what
# discovery creates. The source figure used blue / teal / amber; the site's
# grammar keeps amber for one element, so the ramp carries the stages.
text(24, 38, "智能扩展的三个阶段", "Three stages of intelligence scaling", "ov__h dg__fade", d=.2)

OX, OY, TOPY, RX = 52, 262, 62, 356
emit(f"<g class='dg__fade' style='--d:.3s'>"
     f"<path class='dg__p dg__faint' d='M {OX},{OY} L {OX},{TOPY + 6}'/>"
     f"<path class='dg__p dg__faint' d='M {OX},{OY} L {RX - 4},{OY}'/>"
     f"<path class='dg__p dg__faint' d='M {OX - 4},{TOPY + 12} L {OX},{TOPY + 4} L {OX + 4},{TOPY + 12}'/>"
     f"<path class='dg__p dg__faint' d='M {RX - 10},{OY - 4} L {RX - 2},{OY} L {RX - 10},{OY + 4}'/></g>")
text(32, (OY + TOPY) / 2 + 4, "能力边界", "Capability frontier", "ov__ax dg__fade", anchor="middle", d=.4,
     extra=f" transform='rotate(-90 32 {f((OY + TOPY) / 2)})'")
text((OX + RX) / 2 + 6, OY + 22, "可扩展学习信号的演进", "Evolution of scalable learning signals",
     "ov__ax dg__fade", anchor="middle", d=.4)

X0, X1, Y0, Y1, K = 66, 344, OY - 12, TOPY + 20, 3.0


def curve(u):
    fu = (math.exp(K * u) - 1) / (math.exp(K) - 1)
    return X0 + (X1 - X0) * u, Y0 - (Y0 - Y1) * fu


def seg(u0, u1, n=28):
    pts = [curve(u0 + (u1 - u0) * i / n) for i in range(n + 1)]
    return "M " + " L ".join(f"{f(x)},{f(y)}" for x, y in pts)


SEGS = [(0, .34, "ov__t1", .5), (.34, .64, "ov__t2", 1.0), (.64, 1, "ov__t3", 1.5)]
for u0, u1, cls, d in SEGS:
    emit(f"<path class='ov__c {cls} dg__draw' style='--d:{d}s' pathLength='1' d='{seg(u0, u1)}'/>")
xe, ye = curve(1)
xp, yp = curve(.985)
arrow(xe, ye, math.degrees(math.atan2(ye - yp, xe - xp)), cls="ov__c ov__t3 dg__fade", size=9, d=2.6)

STAGES = [  # u on the curve, name zh/en, label offset, anchor, label tone
    (.17, "对话", "Chat", (0, -16), "middle", "ov__lt1"),
    (.49, "智能体 / 编程", "Agent / Coding", (14, 20), "start", "ov__lt2"),
    (.83, "发现", "Discovery", (-16, 4), "end", "ov__lt3"),
]
for i, (u, zh, en, (dx, dy), anc, tone) in enumerate(STAGES):
    x, y = curve(u)
    d = [.9, 1.5, 2.2][i]
    emit(f"<g class='dg__hov dg__fade' style='--d:{d}s'>" + badge(x, y, 9, i + 1, strong=(i == 2)) + "</g>")
    text(x + dx, y + dy, zh, en, f"ov__stage {tone} dg__fade", anchor=anc, d=d)
x3, y3 = curve(.83)
emit(f"<circle class='dg__ring dg__ring--slow' style='animation-delay:2.8s' cx='{f(x3)}' cy='{f(y3)}' r='12'/>")

# key under the chart: what each stage learns from, and its signal
KEY = [
    ("学习已有知识", "Learn existing knowledge", "公共数据 + 预训练", "public data + pre-training"),
    ("从行动结果中学习", "Learn from action outcomes",
     "可执行经验 + 测试反馈 + 迭代修正", ["executable experience + test feedback", "+ iterative correction"]),
    ("创造并验证新知识", "Create and validate new knowledge",
     "可验证证据 + 发现策略 + 真实世界验证", ["verifiable evidence + discovery policy", "+ real-world validation"]),
]


def key_block(lang):
    parts, ky = [], 310
    for i, row in enumerate(KEY):
        d = [1.0, 1.6, 2.3][i]
        tone = ["ov__t1", "ov__t2", "ov__t3"][i]
        head, sig = (row[0], row[2]) if lang == "zh" else (row[1], row[3])
        sig_lines = [sig] if isinstance(sig, str) else sig
        parts.append(f"<g class='dg__hov dg__fade' style='--d:{d}s'>"
                     f"<line class='ov__sw {tone}' x1='24' y1='{ky - 5}' x2='40' y2='{ky - 5}'/>"
                     + one(52, ky, head, "ov__lab ov__lab--s")
                     + one(52, ky + 18, sig_lines, "ov__small", lh=16) + "</g>")
        ky += 18 + 16 * len(sig_lines) + (18 if lang == "zh" else 8)  # zh rows are one line shorter
    return "".join(parts)


emit("{% if lang == 'zh' %}" + key_block("zh") + "{% else %}" + key_block("en") + "{% endif %}")

# ------------------------------------------------------------------ B. current foundation models
text(BX + 20, 38, "当前基座模型 / 大语言模型", "Current foundation models", "ov__h dg__fade", d=.3)
text(BX + 20, 60, "作用于预定义任务", "LLMs, operating on predefined tasks", "ov__sub dg__fade", d=.35)
ROWS_Y = [86, 158, 230, 302]
ROW_H = 60
B_ROWS = [
    ("知识", "预训练语料", "Knowledge", "pre-training corpora"),
    ("推理", "多步推理", "Reasoning", "multi-step reasoning"),
    ("工具使用", "搜索、代码、数据库", "Tool use", "search, code, databases"),
    ("智能体执行", "长程工作流", "Agentic execution", "long-horizon workflows"),
]
spx = BX + 16
emit(f"<line class='dg__p dg__faint dg__fade' style='--d:.5s' x1='{spx}' y1='{ROWS_Y[0] + ROW_H / 2}' "
     f"x2='{spx}' y2='{ROWS_Y[-1] + ROW_H / 2}'/>")
for i, (zh1, zh2, en1, en2) in enumerate(B_ROWS):
    y, d = ROWS_Y[i], .6 + .15 * i
    emit(f"<g class='dg__hov dg__fade' style='--d:{d:.2f}s'>"
         f"<rect class='ov__tile' x='{spx + 14}' y='{y}' width='{BX + BW - 16 - (spx + 14)}' height='{ROW_H}' rx='8'/>"
         f"<circle class='dg__n ov__n--dim' cx='{spx}' cy='{y + ROW_H / 2}' r='3.5'/>")
    text(spx + 30, y + 26, zh1, en1, "ov__lab")
    text(spx + 30, y + 45, zh2, en2, "ov__small")
    emit("</g>")
# footer: the research structure is fixed
fy = 432
emit(f"<g class='dg__fade' style='--d:1.3s'>"
     f"<rect class='ov__glyph' x='{BX + 20}' y='{fy - 9}' width='10' height='8' rx='1.5'/>"
     f"<path class='ov__glyph' d='M {BX + 22},{fy - 9} v -3 a 3,3 0 0 1 6,0 v 3'/></g>")
text(BX + 38, fy, "研究结构：由人类固定", "Research structure: fixed by humans", "ov__small dg__fade", d=1.3)

# ------------------------------------------------------------------ flow: the frontier moves
FX = (BX + BW + CX) / 2  # centre of the gap
text(FX, 118, ["发现拓展", "能力边界"], ["Discovery", "expands the", "operating frontier"],
     "ov__flow dg__fade", anchor="middle", lh=17, d=1.3)
CY0, CY1 = 188, 284
for i, (cls, x) in enumerate([("ov__t1", FX - 30), ("ov__t2", FX - 8), ("ov__t3", FX + 14)]):
    emit(f"<path class='ov__chev {cls} dg__draw' style='--d:{1.4 + .2 * i:.1f}s' pathLength='1' "
         f"d='M {f(x)},{CY0} L {f(x + 26)},{(CY0 + CY1) / 2} L {f(x)},{CY1}'/>")
fline = f"M {BX + BW - 14},{(CY0 + CY1) / 2} L {CX + 14},{(CY0 + CY1) / 2}"
emit(f"<circle class='dg__mv dg__mv--fade' r='2.8' style=\"offset-path:path('{fline}');--dur:3.2s;--delay:2.2s\"/>")
emit(f"<circle class='dg__mv dg__mv--fade' r='2.4' style=\"offset-path:path('{fline}');--dur:3.2s;--delay:3.8s\"/>")
text(FX, 326, ["从解决任务", "到构建研究"], ["from solving tasks", "to constructing", "research"],
     "ov__flow ov__flow--it dg__fade", anchor="middle", lh=17, d=2.0)

# ------------------------------------------------------------------ C. discovery foundation models
text(CX + 20, 38, "发现基座模型", "Discovery Foundation Models", "ov__h dg__fade", d=.5)
text(CX + 20, 60, "作用于知识生产过程", "operating on the knowledge-production process", "ov__sub dg__fade", d=.55)
C_ROWS = [
    ("识别有价值的未知", "问题发现与形式化", "Identify valuable unknowns", "problem discovery and formulation"),
    ("构建并修正研究结构", "表征与假设", "Construct and revise research structure", "representations and hypotheses"),
    ("用外部证据检验解释", "干预与基于证据的修正", "Test explanations against external evidence",
     "intervention and evidence-grounded revision"),
    ("跨任务提升发现能力", "持续提升发现能力", "Improve discovery capability across tasks",
     "continual discovery improvement"),
]
cpx = CX + 16
emit(f"<line class='dg__p dg__draw' style='--d:2.0s' pathLength='1' x1='{cpx}' y1='{ROWS_Y[0] + ROW_H / 2}' "
     f"x2='{cpx}' y2='{ROWS_Y[-1] + ROW_H / 2}'/>")
TICK_ROW = 2  # the one amber element: tested against the world, as in dfm.njk
for i, (zh1, zh2, en1, en2) in enumerate(C_ROWS):
    y, d = ROWS_Y[i], 2.0 + .15 * i
    emit(f"<g class='dg__hov dg__fade' style='--d:{d:.2f}s'>"
         f"<rect class='ov__tile' x='{cpx + 14}' y='{y}' width='{CX + CW - 16 - (cpx + 14)}' "
         f"height='{ROW_H}' rx='8'/>"
         f"<circle class='dg__n' cx='{cpx}' cy='{y + ROW_H / 2}' r='3.5'/>")
    text(cpx + 30, y + 26, zh1, en1, "ov__lab")
    text(cpx + 30, y + 45, zh2, en2, "ov__small")
    if i == TICK_ROW:
        tx, ty = CX + CW - 34, y + ROW_H / 2
        emit(f"<circle class='dg__n--amber' cx='{f(tx)}' cy='{f(ty)}' r='8'/>"
             f"<path class='dg__tick' d='M {f(tx - 4)},{f(ty)} l 3,3 l 5.5,-6'/>")
    emit("</g>")
tx, ty = CX + CW - 34, ROWS_Y[TICK_ROW] + ROW_H / 2
emit(f"<circle class='dg__ring' style='animation-delay:2.9s' cx='{f(tx)}' cy='{f(ty)}' r='8'/>")
spine = f"M {cpx},{ROWS_Y[0] + ROW_H / 2} L {cpx},{ROWS_Y[-1] + ROW_H / 2}"
emit(f"<circle class='dg__mv dg__mv--fade' r='3' style=\"offset-path:path('{spine}');--dur:4.4s;--delay:3s\"/>")
# footer: the research structure is what the model acts on
gx, gy = CX + 25, fy - 4
emit(f"<g class='dg__fade' style='--d:2.8s'>"
     f"<path class='ov__glyph' d='M {gx + 5},{gy - 3} A 5.5,5.5 0 1 0 {gx + 5.5},{gy + 2}'/>"
     f"<path class='ov__glyph' d='M {gx + 2.5},{gy - 5} L {gx + 5.5},{gy - 2.6} L {gx + 2},{gy - .5}'/></g>")
text(CX + 38, fy, "研究结构：模型行动与修正的对象", "Research structure: what the model acts on and revises",
     "ov__small dg__fade", d=2.8)

# ------------------------------------------------------------------ band: the recursive loop
NY = BAND_Y + 50
COLS = [148, 374, 600, 826, 1052]
STEPS = [
    ("部分理解的世界", "Partially understood world"),
    ("有价值的未知", "Valuable unknowns"),
    ("可研究的问题", "Researchable problem"),
    ("解释与干预", "Explanation and intervention"),
    ("经验证的新知识", "Validated new knowledge"),
]
ACTS = [
    ("更新对世界的理解", "update world understanding"),
    ("构建问题", "frame the problem"),
    ("生成假设", "generate hypotheses"),
    ("设计干预", "design interventions"),
    ("收集新证据", "collect new evidence"),
]
LX, RXB, BOT = 24, 1176, BAND_Y + 168
R = 16
# forward: dashed connectors between the five states
for i in range(4):
    x1, x2 = COLS[i] + R + 8, COLS[i + 1] - R - 8
    d = 3.1 + .15 * i
    emit(f"<g class='dg__fade' style='--d:{d:.2f}s'><path class='dg__p dg__dash' d='M {x1},{NY} L {x2},{NY}'/></g>")
    arrow(x2, NY, 0, cls="dg__p dg__fade", size=6, d=round(d + .1, 2))
# return: validated knowledge updates the world, round the outside
ret = (f"M {COLS[-1] + R + 8},{NY} L {RXB - 16},{NY} Q {RXB},{NY} {RXB},{NY + 16} L {RXB},{BOT - 16} "
       f"Q {RXB},{BOT} {RXB - 16},{BOT} L {LX + 16},{BOT} Q {LX},{BOT} {LX},{BOT - 16} L {LX},{NY + 16} "
       f"Q {LX},{NY} {LX + 16},{NY} L {COLS[0] - R - 8},{NY}")
emit(f"<g class='dg__fade' style='--d:3.8s'><path class='dg__p dg__dash' d='{ret}'/></g>")
arrow(COLS[0] - R - 8, NY, 0, cls="dg__p dg__fade", size=6, d=3.9)
for i, (x, (zh, en)) in enumerate(zip(COLS, STEPS)):
    d = 3.0 + .15 * i
    emit(f"<g class='dg__hov dg__fade' style='--d:{d:.2f}s'>" + badge(x, NY, R, i + 1, strong=(i == 4)))
    text(x, NY + 38, zh, en, "ov__lab ov__lab--step", anchor="middle")
    emit("</g>")
emit(f"<circle class='dg__ring dg__ring--slow' style='animation-delay:4.2s' cx='{COLS[-1]}' cy='{NY}' r='{R}'/>")
for i, (x, (zh, en)) in enumerate(zip(COLS, ACTS)):
    d = 3.9 + .1 * i
    emit(f"<g class='dg__hov dg__fade' style='--d:{d:.2f}s'><circle class='dg__n ov__n--dim' cx='{x}' cy='{BOT}' r='3.5'/>")
    text(x, BOT + 24, zh, en, "ov__act", anchor="middle")
    emit("</g>")
# title, centred between the two rows
text(600, BAND_Y + 124, "递归发现闭环", "Recursive discovery loop", "ov__h ov__h--band dg__fade", anchor="middle", d=2.9)
loop = (f"M {COLS[0]},{NY} L {RXB - 16},{NY} Q {RXB},{NY} {RXB},{NY + 16} L {RXB},{BOT - 16} "
        f"Q {RXB},{BOT} {RXB - 16},{BOT} L {LX + 16},{BOT} Q {LX},{BOT} {LX},{BOT - 16} L {LX},{NY + 16} "
        f"Q {LX},{NY} {LX + 16},{NY} L {COLS[0]},{NY}")
emit(f"<circle class='dg__mv dg__mv--fade' r='3.2' style=\"offset-path:path('{loop}');--dur:14s;--delay:4.2s\"/>")
emit(f"<circle class='dg__mv dg__mv--fade' r='2.4' style=\"offset-path:path('{loop}');--dur:14s;--delay:11.2s\"/>")

emit("</svg>")

dst = Path("src/_includes/diagrams/dfm-overview.njk")
dst.write_text("\n".join(out) + "\n", encoding="utf-8")
print(f"wrote {dst} ({dst.stat().st_size} bytes, {len(out)} lines)")
