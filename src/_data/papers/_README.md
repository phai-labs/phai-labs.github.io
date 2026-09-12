# Publications

One JSON per paper. The file name does not matter; `slug` is the URL, and it
is the single source of every generated reference to the page -- canonical,
hreflang, og:url, sitemap, citation_abstract_html_url and the BibTeX `url`
all derive from it, so renaming a paper means editing exactly one string.
Keep slugs short (`dfm`, not `discovery-foundation-models`): the URL gets
printed on slides and in PDFs.
`.eleventy.js` loads this directory into the `publications` global (newest first)
and builds `/papers/<slug>/` in both languages from it.

## Adding a paper

1. Drop `<slug>.json` here.
2. Drop the PDF next to the page, at `src/papers/<slug>/<file>.pdf`, and put
   that bare file name in `pdf`. It must sit in the same directory as the landing
   page: Google Scholar requires `citation_pdf_url` to point at a file in the same
   subdirectory as the HTML abstract, so `/assets/` is the wrong place.
3. Never overwrite a published PDF. A new version is a new file at a new path
   (`...-v2-2026-11.pdf`) so anything already linked or cited stays honest.

## Fields

| field | notes |
| --- | --- |
| `status` | `published` shows it; `draft` shows it only in a local preview (hidden by `HIDE_DRAFTS=1`); `hidden` emits nothing at all — no page, no row, no sitemap entry. |
| `date` | Full `YYYY-MM-DD`, the report's own date. A partial date renders as "2026年9月undefined日" without erroring. |
| `title` / `abstract` | English, on both language trees. Scholarship is not translated — the same rule ByteDance Seed follows on its Chinese pages. Only `zh.summary` / `en.summary` are written per language, and those two are written natively, never inter-translated. |
| `authors` | Array of `{name, sort, equal, corresponding}`. `sort` is "Surname, Given" for `citation_author`. `equal: true` prints the `*` and the equal-contribution note. Never a flat string — three co-first authors do not survive one. |
| `venue` | The venue row, and the only thing that row prints. Leave it empty unless the paper has a real one ("NeurIPS 2026", "Nature") -- an empty value renders **arXiv**, which is where an unaccepted paper actually lives. |
| `type` / `number` / `version` | Not printed on the page; they feed the BibTeX entry and `citation_technical_report_number`. Scholar states technical-report citations normally carry a number. |
| `version_doi` | The DOI printed in the citation. Zenodo mints **two** DOIs on first publish — this is the one for this specific version, and it is the one to cite. |
| `concept_doi` | Zenodo's "all versions" DOI. Shown on its own labelled line, never as the citation. It silently retargets when a new version is published, so it must not be the primary identifier. |
| `arxiv` | Bare id, e.g. `2609.01234`. When present it leads the citation and the DOI drops to the archive line. |
| `vanity` | Optional short link. `"dfm"` also answers at `/dfm/` and `/en/dfm/`, which redirect to the canonical page — that is the URL to print on a slide or inside the PDF. The stub is a 0-second meta refresh plus `rel=canonical` (GitHub Pages is static; there is no real 301), is kept out of `sitemap.xml`, and works with JavaScript disabled. A vanity that collides with a real page fails the build rather than overwriting it. |
| `release_key` | Key into `site.releases`. While that release is `live: false`, the PDF / DOI / code buttons render as dated "pending" rows instead of dead links. Keep it set — a bare empty field means no gate. |

Every link goes through the release gate. An entry with no `pdf`, `arxiv` or
`version_doi` still renders a complete bibliographic record; only the buttons wait.
