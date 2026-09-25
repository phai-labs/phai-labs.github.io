# phai-labs.com

PhAI Labs 官网。静态站点，由 [Eleventy](https://www.11ty.dev/) 从 `src/` 生成，部署在 GitHub Pages。

中文是默认语言，位于 `/`；英文镜像在 `/en/`。两种语言从同一份数据生成，不需要维护两套页面。

## 本地开发

```bash
pnpm install          # 首次
pnpm dev              # http://localhost:8081  实时刷新
pnpm build            # 生成 _site/
```

需要 Node 22 与 pnpm。

## 目录

```
src/
  _data/
    site.json         域名、邮箱、外部链接（飞书表单、ScienceBuddy、GitHub 等）集中在这里
    i18n.json         导航、按钮、页脚等界面文字，zh / en
    team.json         团队成员
    jobs.json         开放职位
    collab.json       DFM 科学家合作计划页的全部文案
    copy/             各页面文案：home / tech / about / careers / investors / products
    diagrams.json     各示意图的一句话主张与三项属性（含 DFM 总览图 overview）
    news/             新闻，一篇一个 JSON 文件
    papers/           论文，一篇一个 JSON 文件（字段见 papers/_README.md）
  _includes/
    layouts/base.njk  页面外壳：头部、导航、语言切换、页脚、SEO / OG
    components/       可复用片段
  pages/              每个页面一个模板，自动生成 zh 与 en 两份
  assets/             css / js / img / fonts / video
scripts/
  gen-dfm-overview.py 生成 DFM 总览图 _includes/diagrams/dfm-overview.njk
  subset-cjk.py       生成中文标题字体子集（pnpm fonts）
```

论文归档在「技术与论文」页（`/tech/`）的末尾 `#papers`；`/papers/` 只是一个跳到那里的跳转页。每篇论文的详情页仍在 `/papers/<slug>/`——Google Scholar 要求 PDF 与摘要页同目录，这些地址不能动。

## 日常维护

### 新增一条新闻

在 `src/_data/news/` 新建 `YYYY-MM-DD-slug.json`：

```json
{
  "slug": "dfm-launch",
  "date": "2026-09-15",
  "draft": false,
  "category": "release",
  "cover": "/assets/img/news/dfm-launch.webp",
  "links": [{ "label": "DFM 技术报告", "href": "https://..." }],
  "related": ["scientist-collaboration"],
  "zh": { "title": "…", "summary": "…", "body": ["段落一", "段落二"] },
  "en": { "title": "…", "summary": "…", "body": ["Paragraph one", "Paragraph two"] }
}
```

- `category`：`release`（技术发布）/ `program`（合作计划）/ `update`（项目进展）
- `draft: true` 的条目本地预览可见，正式部署时隐藏（部署脚本设置了 `HIDE_DRAFTS=1`）。发布日把它改为 `false` 即可。
- 下线一篇：删除文件，或改为 `draft: true`。
- 列表按日期倒序自动排列；首页自动显示最新三条。

### 新增或关闭一个职位

编辑 `src/_data/jobs.json` 的 `positions` 数组。复制一条修改即可；`status` 改为 `closed` 可隐藏而不删除；`placeholder: true` 会在页面上标出「待确认」。

### 更新团队成员

编辑 `src/_data/team.json`。`photo` 留空时页面显示预留的圆形头像位；拿到正式照片后放入 `src/assets/img/team/`，填入路径即可。链接留空的不显示。

### 新增一个产品

「产品」页（`/products/`）按 `src/_data/copy/products.json` 的 `items` 逐条渲染，一个产品一个区块，顺序即编号。复制 ScienceBuddy 那一条，`zh` 与 `en` 各加一份：

```json
{
  "key": "sciencebuddy",              // 区块锚点：/products/#sciencebuddy
  "name": "ScienceBuddy",
  "release": "sciencebuddy",          // site.json releases 里的键；未 live 时按钮显示发布日期，链接与视频不出现
  "links": { "home": "sciencebuddy", "github": "sciencebuddy_github", "post": "sciencebuddy_video" },  // site.json links 里的键
  "paper": "sciencebuddy",            // 论文 slug，用于「技术报告」链接
  "news": "sciencebuddy",             // 新闻 slug，用于「发布公告」链接
  "kind": "…", "tagline": "…", "lede": "…", "cta": "…",
  "video": { "src": "/assets/video/….mp4", "poster": "/assets/img/…/….jpg", "duration": "0:33", "label": "…", "play": "…", "source": "…" },
  "features": [{ "title": "…", "body": "…" }],
  "proof": "…", "domains": ["…"], "labels": { "report": "…", "github": "…", "news": "…" }, "credit": "…"
}
```

任何一项留空或缺失就不显示；没有 `video` 的产品排成单栏。视频放在站内自己播放：`src/assets/video/`，H.264 + AAC 的 MP4，720p 足够，索引放在文件头（`moov` 在 `mdat` 之前）以便边下边播；封面取视频里有内容的一帧，不要用开头的黑帧。播放器是 `assets/js/player.js`，页面 front matter 写 `player: true` 才加载；关掉 JS 时退回浏览器自带的播放控件。

### 修改文案

- 页面文案在 `src/_data/copy/*.json`，`zh` 与 `en` 是两个独立字段，分别用各自语言写，不要互译。
- 合作计划页在 `src/_data/collab.json`。
- 导航、按钮等界面文字在 `src/_data/i18n.json`。
- 外部链接（飞书表单、ScienceBuddy、GitHub、技术报告）只在 `src/_data/site.json` 里改一处。

### 主视觉

主视觉是现场绘制的，不是图片也不是视频，见下面「首页主视觉」。`src/_data/site.json` 的 `kv` 字段只剩静态图，用作关掉 JS 时的兜底。

## 动效

三层，都不依赖任何库。

**计算场**（`src/assets/js/field.js`）。所有页面底下两层固定 canvas：低分辨率的蓝 / 紫蓝密度云缓慢漂移，加少量呼吸的光点。章节到达视口中线时，场按 `data-field` 换档：`calm`（默认）、`flow`（DFM 章节，定向流动）、`grid`（模块、岗位等列表，光点向 96px 网格收拢）、`still`（团队）、`hero`、`off`（文章页，`<main data-field="off">`）。

- 整体关掉：CSS 里把 `--field-max` 设为 0，或 `<html data-field="off">`。
- 调试：URL 加 `?field=off` 看无场对比，`?field=static` 冻结成一帧，`?field=bench` 在控制台打印每帧耗时。
- 自动降级：`prefers-reduced-motion` 只画一帧不动；Save-Data、标签页隐藏时不运行；桌面 30 fps、手机 24 fps 上限；标题下方的云会自动变淡以保证可读。

**点击反馈**。任一处点击：一圈 1px 蓝色细环从点击处扩散后消失，附近的光点被轻轻推开、再回到原来的流动；文章页也有，reduced-motion 下没有。

**章节编排**（CSS 与 `site.js`）。章节顶部细线进入视口时从左向右画出；节点线画完后一颗光点沿线跑到琥珀节点（位置由 `--amber-x` 指定）；主 CTA 进入视野时琥珀环扩散两次后静止；关于页的章节序号随滚动上浮；新闻时间轴随阅读进度填充、节点依次点亮；logo 在整页加载时描线；页面切换用 View Transitions 交叉淡入，不支持的浏览器直接跳转。

**显现**。标题、段落、图表进入视口时上浮显现，中文标题整块上浮，英文按词错开。

## 各项工作的示意图

`src/_includes/diagrams/` 下每个工作一张内联 SVG，按 VoiceMem 项目页的思路：一张图就是这项工作在做什么，画面用不需要专业背景就能读懂的东西（循环、对话、工作台、分岔的预测、两边交换），不是流程图。

| 图 | 画面 | 画的是什么 |
|---|---|---|
| `dfm.njk` | 一圈圈变大的循环 | 六个步骤（找到值得研究的未知 → 变成可研究的问题 → 提出并修正假设 → 调用工具、数据和实验 → 用外部证据检验判断 → 沉淀成可复用的方法）；每一圈都走一遍，每一圈都比上一圈大；琥珀点在"用外部证据检验判断" |
| `sciencebuddy.njk` | 一段对话 | 科学家和 AI 搭档之间的对话气泡（提问 → 调用工具回应 → 追问/修改/否定 → 再次回应 → 采纳/重新运行），右侧的研究轨迹每一次交互记一笔，底部的工作环境条随反馈变长 |
| `scienceide.njk` | 代码库变成一排工作台 | 左边一个真实的科研代码库，"变成"一排可以运行、可以打分、可以重复的工作台（加速/发现/修复/复现/集成），AI 在里面做任务，做对亮勾，结果用来训练 AI |
| `jepa.njk` | 先预测，再行动 | 左边是已经看过的数据（图像、生物、临床、分子、控制、物理），汇成"现在的世界状态"，右边分出三条候选做法的预测结果：可行（琥珀）、没有效果、代价太高 |
| `dfm-overview.njk` | 论文图 1 | 智能扩展的三个阶段、当前基座模型与发现基座模型的对比、递归发现闭环；由 `scripts/gen-dfm-overview.py` 生成（坐标、曲线采样、箭头角度都在脚本里算，改图改脚本再运行，两个文件一起提交），`components/ovfig.njk` 在技术页与合作页以全宽放置；三个阶段用同一种蓝的三档深浅区分，琥珀点在"用外部证据检验解释" |
| `program.njk` | 两边各带什么来 | 科学家带来真实问题、数据与研究环境、实验与专家反馈，PhAI 带来假设、模型工具与分析、下一个实验，在中间"在真实实验里一起验证"（琥珀），结果回到科学家手里 |

图内标签是 PR Brief 对应段落的白话改写，措辞守 Brief 的审核原则（DFM 不是框架或成品、三个工作彼此独立、JEPA 标注探索中）。每张图只有一个琥珀元素。动效全部是 CSS（进入视口时描线，`offset-path` 上的光点，脉冲），鼠标悬停高亮对应分组，`prefers-reduced-motion` 下显示画完的静图。

图的一句话主张与三项属性在 `src/_data/diagrams.json`，由 `components/dgfig.njk` 渲染成"图 + 三属性 + 主张"的版式，用于技术页各项目段与合作页；新闻列表头条和文章头图只放裸图。文章用哪张图由新闻 JSON 里的 `art` 字段指定。

## 首页主视觉

一个 canvas 引擎实时画出来的：暗色球体外面一圈发光的环，环的远侧从球后穿过、近侧从球前穿过——纵深就来自这一层遮挡关系。代码在 `src/assets/js/orb.js`（约 20 KB，未压缩），三个页面共用：

| 页面 | 初始化 | 画布 |
|---|---|---|
| 首页 / 合作页 | `src/assets/js/hero-orb.js` | `.hero__kv canvas[data-orb]`，参数写在标签的 `data-cfg` 上 |
| `/landing/` | `src/assets/js/landing-orb.js` | `.stage__kv canvas[data-orb]` |

`orb.js` 只在有主视觉的页面加载，由页面 front matter 的 `heroKv: true` 在 `layouts/base.njk` 里门控。

**可调参数**（`PhAIOrb(canvas, {...})`，均有默认值）：

| 参数 | 含义 |
|---|---|
| `cx` `cy` `r` | 球心位置（画布宽高的比例）与半径（`min(宽,高)` 的比例） |
| `cxSm` `cySm` `rSm` | 画布窄于 760px 时的同上三项 |
| `tilt` `roll` | 环的俯仰（椭圆压扁量）与滚转（弧度，正值向右下倾） |
| `inner` `reach` | 环的内径与径向宽度，单位是球半径 |
| `motes` | 环上粒子数（首页 2300，landing 3000） |
| `stars` | 是否画星场。首页关掉，因为底下的计算场已经有光点 |
| `glow` `alpha` `spin` | 光晕强度、整体不透明度、转速的倍率 |
| `interactive` | 鼠标交互开关 |

**实现要点**，改之前值得先看一眼：

- 每颗粒子是一次 `drawImage`，画的是预渲染好的精灵图（13 张，按色相从琥珀渐变到蓝，最后一张是被"点亮"时的近白色），不是每帧现建渐变——所以几千颗也不贵。
- 环不是一片糊光：`dens(u)` 函数在两处挖出暗缝，把环切成三段；粒子按开普勒差速旋转（内圈快），内缘有一条被照亮的亮边，还有一道持续绕环巡游的光带。球体上有左上方来的轮廓光、大气边缘辉光，以及**环投在球上的阴影**。
- 每帧的滚转、俯仰、球心只算一次（`resolve()`），粒子循环里直接读缓存值。这一步把 landing 页从 57 fps 提到 65 fps（软件渲染下），别在循环里重新调 `rollNow()` 这些。
- **鼠标监听挂在 `window` 上，不是画布的父元素**。`.hero__kv` / `.stage__kv` 是 `pointer-events:none`（为了让上面的文字可选），挂在那里的监听器永远不会触发——这个坑踩过一次。坐标从画布的 `getBoundingClientRect()` 反算。
- 交互：靠近环时附近粒子被点亮并被吸向光标，整圈提亮；点击时一道脉冲沿环跑一圈并甩出火星；整体随鼠标做视差。`prefers-reduced-motion` 或粗指针（触屏）下交互整个关掉。
- `prefers-reduced-motion` 下只画一帧静态图就停，所以不需要额外准备兜底图；关掉 JS 才回退到 `<noscript>` 里的 `kv-static.webp`。

遮罩在 CSS 里（`.hero__kv::after` / `.stage__kv::after`），是压在文案下方的径向渐变，不是横贯整屏的色带——横贯的那种会把环的近侧一半整个吃掉，而那一半正是撑起纵深的部分。

## 四日发布与链接门控

发布节奏来自 PR Brief：9 月 15 日 DFM 与科学家合作计划，16 日 ScienceBuddy，17 日 ScienceIDE，18 日 JEPA Anything。站点按这个节奏门控链接，数据都在 `src/_data/site.json`：

```json
"releases": {
  "sciencebuddy": { "date": "2026-09-16", "live": false, "url": "http://115.191.37.16:8099/" },
  ...
}
```

- **每个发布日把对应项目的 `live` 改成 `true` 再构建**。`live` 为 false 时，该项目的产品入口 / 项目主页在所有页面都显示为"9 月 16 日发布"的待发布行，不出现链接，即使 `url` 已经填了。
- 技术报告、GitHub、论文这类链接放在 `links` 里（`sciencebuddy_report`、`scienceide_page`、`jepa_paper` 等），填上 href 并且项目已 `live` 才会变成可点的链接。
- 新闻文章里的链接用 `key` 引用同一套数据（见 `src/_data/news/*.json`），不用改文章。
- 首页模块列表、技术页项目段、合作页模块卡、文章链接区都由 `src/_includes/components/rlink.njk` 统一渲染。

## 部署

`pnpm run deploy`（不能写成 `pnpm deploy`，那是 pnpm 自带的命令）：以 `HIDE_DRAFTS=1` 构建，把产物推送到 `main` 分支。GitHub Pages 按仓库设置（Source: Deploy from a branch，main / root）直接发布 `main` 上的静态文件，自定义域名由 `src/CNAME` 提供，`.nojekyll` 让 GitHub 不再做 Jekyll 处理。

源码在 `rebuild` 分支，`main` 只放构建产物。改完源码：先在 `rebuild` 上 commit 并 push，再 `pnpm run deploy`。发布日当天把对应项目的 `live` 改为 `true`（新闻则把 `draft` 改为 `false`），再 `pnpm run deploy` 一次。

## 字体

IBM Plex（Sans / Serif / Mono）子集化后自托管于 `src/assets/fonts/`，OFL 许可。中文正文使用系统字体：苹方 / Noto Sans SC / 微软雅黑。

中文标题用衬线。macOS 有宋体，但 Windows 只有 SimSun（大字号下很难看），所以站点自带一份 Noto Serif SC 子集 `NotoSerifSC-Display.woff2`（约 100 KB），只包含标题、名字、标签等短文本里实际出现的汉字；正文不用它。**改过标题类文案后要重新生成**。需要 `python3 -m pip install --user fonttools brotli`，以及 Noto Serif SC **2.002** 变量字体——即 Google Fonts 仓库 `google/fonts` 在提交 `c124e801978b` 的 `ofl/notoserifsc/NotoSerifSC[wght].ttf`（之后的 2.003 改了几个字形，会让已有标题的字悄悄变样）：

```bash
NOTO_SERIF_SC=/path/to/NotoSerifSC[wght].ttf pnpm fonts   # 覆盖 src/assets/fonts/NotoSerifSC-Display.woff2
```

收录规则在脚本的 `HEAD_KEYS` 与 `SHORT`：键名是标题类（title、name、tagline、proof、claim 等）或长度不超过 28 字的字符串；`{"zh": …, "en": …}` 这一层沿用上一层的键名。

没生成也不会坏：子集里缺的字会回退到系统宋体，只是那几个字的字形不一致。
