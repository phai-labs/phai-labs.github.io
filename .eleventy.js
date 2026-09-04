// PhAI Labs site -- Eleventy configuration
//
// Static output for GitHub Pages. Chinese is the default tree at "/", English
// mirrors it under "/en/". Every page template paginates over `langs` and emits
// both trees from the same data, so zh and en are never edited in two places.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LANGS = ["zh", "en"];
const NEWS_DIR = join(process.cwd(), "src", "_data", "news");

function loadArticles() {
  return readdirSync(NEWS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(NEWS_DIR, f), "utf8")))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export default function (eleventyConfig) {
  // -- static passthrough --------------------------------------------------
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });
  eleventyConfig.addPassthroughCopy({ "src/assets/img/favicon.svg": "favicon.svg" });

  // -- global data ---------------------------------------------------------
  eleventyConfig.addGlobalData("langs", LANGS);
  eleventyConfig.addGlobalData("buildTime", () => new Date().toISOString());
  // Drafts (the 15-Sept items) are shown while previewing so they can be
  // reviewed; set HIDE_DRAFTS=1 for the production build before launch day.
  eleventyConfig.addGlobalData("showDrafts", process.env.HIDE_DRAFTS !== "1");

  // all articles, newest first; and the article x language cross product
  const articles = loadArticles();
  eleventyConfig.addGlobalData("articles", articles);
  eleventyConfig.addGlobalData("articlePages", () =>
    LANGS.flatMap((lang) => articles.map((article) => ({ lang, article })))
  );

  // -- filters -------------------------------------------------------------
  // "/tech/" -> "/tech/" for zh, "/en/tech/" for en
  eleventyConfig.addFilter("localeUrl", (url, lang) =>
    lang === "en" ? `/en${url === "/" ? "/" : url}` : url
  );
  // the sibling URL in the other language, for the zh | EN switch
  eleventyConfig.addFilter("switchUrl", (url, lang) =>
    lang === "en" ? url.replace(/^\/en/, "") || "/" : `/en${url}`
  );
  // pick a language field from an object with zh/en keys
  eleventyConfig.addFilter("t", (obj, lang) =>
    obj && typeof obj === "object" && lang in obj ? obj[lang] : obj
  );
  eleventyConfig.addFilter("published", (list) => list.filter((a) => !a.draft));
  eleventyConfig.addFilter("take", (list, n) => list.slice(0, n));
  eleventyConfig.addFilter("fmtDate", (iso, lang) => {
    const [y, m, d] = iso.split("-").map(Number);
    if (lang === "en") {
      const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${d} ${M[m - 1]} ${y}`;
    }
    return `${y}年${m}月${d}日`;
  });
  eleventyConfig.addFilter("pad2", (n) => String(n).padStart(2, "0"));

  // Headline stagger, done at build time so the page needs no split library.
  // English staggers by word; Chinese by character, keeping trailing CJK
  // punctuation attached to its character so line-start punctuation cannot
  // occur. Delay index is capped so the whole headline lands within ~0.8s.
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // *word* inside a headline is the blue keyword: <em class="hl">word</em>
  const hl = (s) => s.replace(/\*([^*]+)\*/g, '<em class="hl">$1</em>');
  eleventyConfig.addFilter("stagger", (text, lang) => {
    let t = esc(text);
    // Chinese headlines rise as one block: per-character stagger reads as a
    // gimmick in hanzi and fights the line-breaking rules. English staggers by word.
    if (lang === "zh") return hl(t);
    // keep a multi-word highlight inside one token while splitting on spaces
    t = t.replace(/\*([^*]+)\*/g, (m, p) => "*" + p.replace(/\s+/g, "\u2060") + "*");
    const tokens = t.split(/(\s+)/);
    let i = 0;
    return tokens.map((tok) => {
      if (!tok || /^\s+$/.test(tok)) return tok;
      return `<span class="w" style="--i:${Math.min(i++, 16)}">${hl(tok).replace(/\u2060/g, " ")}</span>`;
    }).join("");
  });

  // A small deterministic "constellation": nodes and edges seeded by a slug,
  // used as the default cover art for news. Same slug, same drawing, every
  // build; one amber node marks the best-connected point. Draws itself in
  // via CSS when its container gets .in (see .cst in site.css).
  const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const prng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  eleventyConfig.addFilter("constellation", (seed, w = 800, h = 450, n = 26) => {
    const r = prng(hash(seed));
    const cx = [w * (0.28 + r() * 0.16), w * (0.6 + r() * 0.2)], cy = [h * (0.35 + r() * 0.3), h * (0.4 + r() * 0.3)];
    const pts = [];
    for (let i = 0; i < n; i++) {
      const k = i % 2, a = r() * Math.PI * 2, d = Math.pow(r(), 0.6) * Math.min(w, h) * 0.42;
      pts.push([Math.min(w - 14, Math.max(14, cx[k] + Math.cos(a) * d * 1.35)), Math.min(h - 14, Math.max(14, cy[k] + Math.sin(a) * d))]);
    }
    const edges = [], deg = new Array(n).fill(0);
    pts.forEach((p, i) => {
      pts.map((q, j) => [Math.hypot(p[0] - q[0], p[1] - q[1]), j]).filter((x) => x[1] !== i).sort((a, b) => a[0] - b[0]).slice(0, 2)
        .forEach(([, j]) => { if (!edges.some((e) => (e[0] === i && e[1] === j) || (e[0] === j && e[1] === i))) { edges.push([i, j]); deg[i]++; deg[j]++; } });
    });
    const amber = deg.indexOf(Math.max(...deg));
    const f = (v) => v.toFixed(1);
    const lines = edges.map(([i, j], k) => `<line class="cst__e" style="--i:${k}" x1="${f(pts[i][0])}" y1="${f(pts[i][1])}" x2="${f(pts[j][0])}" y2="${f(pts[j][1])}" pathLength="1"/>`).join("");
    const dots = pts.map((p, i) => `<circle class="cst__n${i === amber ? " cst__n--amber" : ""}" style="--i:${i}" cx="${f(p[0])}" cy="${f(p[1])}" r="${i === amber ? 4.5 : deg[i] > 2 ? 3 : 2.2}"/>`).join("");
    return `<svg class="cst" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${lines}${dots}</svg>`;
  });

  // -- dev server ----------------------------------------------------------
  eleventyConfig.setServerOptions({ showAllHosts: false, port: 8081 });

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"],
  };
}
