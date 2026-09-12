// PhAI Labs site -- Eleventy configuration
//
// Static output for GitHub Pages. Chinese is the default tree at "/", English
// mirrors it under "/en/". Every page template paginates over `langs` and emits
// both trees from the same data, so zh and en are never edited in two places.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LANGS = ["zh", "en"];
const NEWS_DIR = join(process.cwd(), "src", "_data", "news");
const PAPERS_DIR = join(process.cwd(), "src", "_data", "papers");

const loadDir = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

function loadArticles() {
  return loadDir(NEWS_DIR);
}
// "hidden" drops the entry from the build entirely -- no page, no row, no
// sitemap line. That is the setting for work that is recorded but must not be
// rendered yet; hiding it in CSS or filtering it in the browser would not.
function loadPapers() {
  return loadDir(PAPERS_DIR).filter((p) => p.status !== "hidden");
}

export default function (eleventyConfig) {
  // -- static passthrough --------------------------------------------------
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });
  // Paper PDFs live beside their landing page, not under /assets/: Google
  // Scholar requires citation_pdf_url to name a file in the same subdirectory
  // as the HTML abstract.
  eleventyConfig.addPassthroughCopy({ "src/papers": "papers" });
  eleventyConfig.addPassthroughCopy({ "src/assets/img/favicon.png": "favicon.png" });

  // -- global data ---------------------------------------------------------
  eleventyConfig.addGlobalData("langs", LANGS);
  eleventyConfig.addGlobalData("buildTime", () => new Date().toISOString());
  // Drafts (the 15-Sept items) are shown while previewing so they can be
  // reviewed; set HIDE_DRAFTS=1 for the production build before launch day.
  const showDrafts = process.env.HIDE_DRAFTS !== "1";
  eleventyConfig.addGlobalData("showDrafts", showDrafts);

  // all articles, newest first; and the article x language cross product.
  // Hidden drafts are dropped here so their pages are never written either.
  const articles = loadArticles().filter((a) => showDrafts || !a.draft);
  eleventyConfig.addGlobalData("articles", articles);
  eleventyConfig.addGlobalData("articlePages", () =>
    LANGS.flatMap((lang) => articles.map((article) => ({ lang, article })))
  );

  // Publications. The global is `publications`, not `papers`: Eleventy already
  // loads src/_data/papers/ into a `papers` object keyed by file name, and two
  // things under one name is how a silent wrong answer happens.
  // prev/next are baked in here so the detail page can carry Seed's
  // "< Previous / Next >" pager without looking the neighbours up in Nunjucks.
  const publications = loadPapers().filter((p) => showDrafts || p.status !== "draft");
  eleventyConfig.addGlobalData("publications", publications);
  eleventyConfig.addGlobalData("publicationPages", () =>
    LANGS.flatMap((lang) =>
      publications.map((paper, i) => ({
        lang,
        paper,
        prev: publications[i - 1] || null,
        next: publications[i + 1] || null,
      }))
    )
  );

  // Short links. A paper with `vanity: "dfm"` also answers at /dfm/ and
  // /en/dfm/, which is what gets printed on a slide or inside the PDF. The
  // stub redirects; /papers/<slug>/ stays the canonical URL everywhere else.
  // A vanity that collides with a real page is caught at build time -- Eleventy
  // refuses two templates writing the same output path.
  eleventyConfig.addGlobalData("paperVanityPages", () =>
    LANGS.flatMap((lang) =>
      publications.filter((p) => p.vanity).map((paper) => ({ lang, paper }))
    )
  );

  // -- filters -------------------------------------------------------------
  // "/tech/" -> "/tech/" for zh, "/en/tech/" for en
  eleventyConfig.addFilter("localeUrl", (url, lang) =>
    lang === "en" ? `/en${url === "/" ? "/" : url}` : url
  );
  // A link to an article that may still be a draft. `articles` is already
  // filtered by draft state, so in a HIDE_DRAFTS build an unpublished slug is
  // simply absent -- and the row falls back to a page that does exist instead
  // of shipping a 404. The homepage's launch rows point at announcements dated
  // days ahead of the build, so without this they break on every production
  // deploy and work fine locally, which is the worst way for a link to fail.
  eleventyConfig.addFilter("articleHref", (slug, lang, fallback) => {
    const live = slug && articles.some((a) => a.slug === slug);
    const url = live ? `/news/${slug}/` : fallback;
    return lang === "en" ? `/en${url === "/" ? "/" : url}` : url;
  });

  // -- publications ---------------------------------------------------------
  // Nav labels by key. The nav array used to be read positionally
  // (s.nav[1], s.nav[3], s.nav[4]) in four templates, which meant inserting an
  // entry anywhere but the end silently relabelled News, Team and About.
  eleventyConfig.addFilter("navLabel", (nav, key) => {
    const item = (nav || []).find((n) => n.key === key);
    return item ? item.label : "";
  });

  // "Ling Yang*, Zhenfei Yin*, Yingcheng Wu*"
  const authorNames = (authors, star = true) =>
    (authors || []).map((a) => a.name + (star && a.equal ? "*" : "")).join(", ");
  eleventyConfig.addFilter("authorLine", (authors) => authorNames(authors));
  eleventyConfig.addFilter("equalNames", (authors) =>
    (authors || []).filter((a) => a.equal).map((a) => a.name).join(", ")
  );
  eleventyConfig.addFilter("hasEqual", (authors) => (authors || []).some((a) => a.equal));
  // Scholar wants the surname first and one tag per author.
  eleventyConfig.addFilter("authorSort", (a) => a.sort || a.name);
  eleventyConfig.addFilter("scholarDate", (iso) => iso.replace(/-/g, "/"));
  eleventyConfig.addFilter("year", (iso) => iso.slice(0, 4));
  eleventyConfig.addFilter("paperUrl", (slug, lang) =>
    lang === "en" ? `/en/papers/${slug}/` : `/papers/${slug}/`
  );

  // The venue row. A paper that has not been accepted anywhere still has a
  // home, and for this lab that home is arXiv -- so an empty `venue` reads
  // "arXiv" rather than leaving the row blank or inventing a status. Fill
  // `venue` only when there is a real one ("NeurIPS 2026", "Nature").
  eleventyConfig.addFilter("venueLabel", (p) =>
    p.venue && p.venue.trim() ? p.venue.trim() : "arXiv"
  );

  eleventyConfig.addFilter("bibtex", (p, baseUrl) => {
    const rows = [
      ["title", `{${p.title}}`],
      ["author", `{${(p.authors || []).map((a) => a.sort || a.name).join(" and ")}}`],
      ["institution", "{PhAI Labs}"],
      ["type", "{Technical Report}"],
      p.number ? ["number", `{${p.number}}`] : null,
      ["year", `{${p.date.slice(0, 4)}}`],
    ].filter(Boolean);
    if (p.version_doi) rows.push(["doi", `{${p.version_doi}}`]);
    if (p.arxiv) rows.push(["eprint", `{${p.arxiv}}`], ["archivePrefix", "{arXiv}"]);
    rows.push(["url", `{${baseUrl}/papers/${p.slug}/}`]);
    const notes = [];
    if (p.version) notes.push(`Version ${p.version}`);
    const eq = (p.authors || []).filter((a) => a.equal).map((a) => a.name);
    if (eq.length) notes.push(`Equal contribution: ${eq.join(", ")}`);
    if (notes.length) rows.push(["note", `{${notes.join(". ")}}`]);
    const w = Math.max(...rows.map((r) => r[0].length));
    const body = rows.map(([k, v]) => `  ${k.padEnd(w)} = ${v}`).join(",\n");
    return `@techreport{${p.bibkey || p.slug},\n${body}\n}`;
  });

  // the sibling URL in the other language, for the zh | EN switch
  eleventyConfig.addFilter("switchUrl", (url, lang) =>
    lang === "en" ? url.replace(/^\/en/, "") || "/" : `/en${url}`
  );
  // pick a language field from an object with zh/en keys
  eleventyConfig.addFilter("t", (obj, lang) =>
    obj && typeof obj === "object" && lang in obj ? obj[lang] : obj
  );
  // The brand is "PhAI Labs" - never "PHAI LABS". Eyebrows and other mono labels
  // are uppercased in CSS, so wrap the brand token and let .brand opt out.
  eleventyConfig.addFilter("brand", (text) => {
    const esc = String(text ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    return esc.replace(/PhAI(\s+Labs)?/g, (m) => `<span class="brand">${m}</span>`);
  });
  eleventyConfig.addFilter("published", (list) => list.filter((a) => !a.draft));
  // The hero strip should point at the release the reader can act on next: the
  // earliest item still ahead of today, or the newest published one if none is.
  eleventyConfig.addFilter("imminent", (list) => {
    if (!list || !list.length) return null;
    const today = new Date().toISOString().slice(0, 10);
    const rank = (a) => (a.category === "release" ? 0 : 1);
    const ahead = list
      .filter((a) => a.date >= today)
      .sort((a, b) => (a.date === b.date ? rank(a) - rank(b) : a.date < b.date ? -1 : 1));
    return ahead.length ? ahead[0] : list[0];
  });
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
  // release dates: "9 月 16 日" / "16 Sept", and the pending label
  const M3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
  eleventyConfig.addFilter("dateShort", (iso, lang) => {
    const [, m, d] = iso.split("-").map(Number);
    return lang === "en" ? `${d} ${M3[m - 1]}` : `${m} 月 ${d} 日`;
  });
  eleventyConfig.addFilter("releaseLabel", (iso, lang) => {
    const [, m, d] = iso.split("-").map(Number);
    return lang === "en" ? `Releasing ${d} ${M3[m - 1]}` : `${m} 月 ${d} 日发布`;
  });

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
