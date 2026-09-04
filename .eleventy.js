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
  eleventyConfig.addFilter("stagger", (text, lang) => {
    const t = esc(text);
    // Chinese headlines rise as one block: per-character stagger reads as a
    // gimmick in hanzi and fights the line-breaking rules. English staggers by word.
    if (lang === "zh") return t;
    const tokens = t.split(/(\s+)/);
    let i = 0;
    return tokens.map((tok) => {
      if (!tok || /^\s+$/.test(tok)) return tok;
      return `<span class="w" style="--i:${Math.min(i++, 16)}">${tok}</span>`;
    }).join("");
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
