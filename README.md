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
    copy/             各页面文案：home / tech / about / careers / investors
    news/             新闻，一篇一个 JSON 文件
  _includes/
    layouts/base.njk  页面外壳：头部、导航、语言切换、页脚、SEO / OG
    components/       可复用片段
  pages/              每个页面一个模板，自动生成 zh 与 en 两份
  assets/             css / js / img / fonts
```

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

### 修改文案

- 页面文案在 `src/_data/copy/*.json`，`zh` 与 `en` 是两个独立字段，分别用各自语言写，不要互译。
- 合作计划页在 `src/_data/collab.json`。
- 导航、按钮等界面文字在 `src/_data/i18n.json`。
- 外部链接（飞书表单、ScienceBuddy、GitHub、技术报告）只在 `src/_data/site.json` 里改一处。

### 主视觉

`src/_data/site.json` 的 `kv` 字段指定静态图与动态图。页面先加载静态 WebP，进入视口后再换成 GIF；用户开启「减少动态效果」时保持静态。

## 动效

三层，都不依赖任何库。

**计算场**（`src/assets/js/field.js`）。所有页面底下两层固定 canvas：低分辨率的蓝 / 紫蓝密度云缓慢漂移，加少量呼吸的光点；首页与合作页的 hero 区另有一层流入汇聚点的光线、环绕的尘埃，以及每 7 秒一次的琥珀色涟漪。章节到达视口中线时，场按 `data-field` 换档：`calm`（默认）、`flow`（DFM 章节，定向流动）、`grid`（模块、岗位等列表，光点向 96px 网格收拢）、`still`（团队）、`hero`、`off`（文章页，`<main data-field="off">`）。

- 整体关掉：CSS 里把 `--field-max` 设为 0，或 `<html data-field="off">`。
- 调试：URL 加 `?field=off` 看无场对比，`?field=static` 冻结成一帧，`?field=bench` 在控制台打印每帧耗时。
- 自动降级：`prefers-reduced-motion` 只画一帧不动；Save-Data、标签页隐藏时不运行；桌面 30 fps、手机 24 fps 上限；标题下方的云会自动变淡以保证可读。

**章节编排**（CSS 与 `site.js`）。章节顶部细线进入视口时从左向右画出；节点线画完后一颗光点沿线跑到琥珀节点（位置由 `--amber-x` 指定）；主 CTA 进入视野时琥珀环扩散两次后静止；关于页的章节序号随滚动上浮；新闻时间轴随阅读进度填充、节点依次点亮；logo 在整页加载时描线；页面切换用 View Transitions 交叉淡入，不支持的浏览器直接跳转。

**显现**。标题、段落、图表进入视口时上浮显现，中文标题整块上浮，英文按词错开。

## 部署

推送到 `main` 后，`.github/workflows/pages.yml` 自动构建并发布。仓库设置里需要一次性把 Pages 的 Source 设为 **GitHub Actions**。自定义域名由 `src/CNAME` 提供。

## 字体

IBM Plex（Sans / Serif / Mono）子集化后自托管于 `src/assets/fonts/`，OFL 许可。中文正文使用系统字体：苹方 / Noto Sans SC / 微软雅黑。

中文标题用衬线。macOS 有宋体，但 Windows 只有 SimSun（大字号下很难看），所以站点自带一份 Noto Serif SC 子集 `NotoSerifSC-Display.woff2`（约 100 KB），只包含标题、名字、标签等短文本里实际出现的汉字；正文不用它。**改过标题类文案后要重新生成**（需要本机 Python 与 `fontTools`、`brotli`，以及安装了 Noto Serif SC 变量字体）：

```bash
pnpm fonts        # 运行 scripts/subset-cjk.py，覆盖 src/assets/fonts/NotoSerifSC-Display.woff2
```

没生成也不会坏：子集里缺的字会回退到系统宋体，只是那几个字的字形不一致。
