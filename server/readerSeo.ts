// The 5-Minute Reads as real pages search engines can read, on arisereader.com only:
//   /5-minute-reads/          every read, grouped by category (shared/ariseNews.ts QUICK_CATEGORIES)
//   /5-minute-reads/<slug>/   one read: the whole article, its photo and credit, words to know, more reads like
//                             it, and a button to take its 5-question quiz in the app (/app#/news/<slug>)
// The quizzes themselves stay in the app (the answers aren't on these pages). Each page carries Article and
// BreadcrumbList structured data, and the Reader sitemap lists every read (readerSitemapXml).
import type { Express, Request } from "express";
import { NEWS_ARTICLES, NEWS_POINTS, QUICK_CATEGORIES, newsBySlug, newsPhotoPage, newsPhotoUrl, newsReadMinutes, quickCategoryId, quickCategoryOf, type NewsArticle, type NewsBlock } from "../shared/ariseNews";

export const READER_ORIGIN = "https://www.arisereader.com";
export const READS_PATH = "/5-minute-reads/";
export const READER_LOGO = `${READER_ORIGIN}/icon-512.png`;
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
const readUrl = (a: NewsArticle) => `${READER_ORIGIN}${READS_PATH}${a.slug}/`;
const newest = () => [...NEWS_ARTICLES].sort((a, b) => b.publishedOn.localeCompare(a.publishedOn) || a.title.localeCompare(b.title));

export const isReaderHost = (req: Request) => { const h = String(req.headers.host || "").split(":")[0].toLowerCase(); return h === "arisereader.com" || h === "www.arisereader.com" || h === "localhost" || h === "127.0.0.1"; };

const CSS = `:root{--ink:#141b32;--soft:#4a5370;--line:#e5e8f4;--purple:#5b53df;--lav:#efedff}*{box-sizing:border-box}body{margin:0;font:17px/1.7 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:#fff}a{color:var(--purple)}
header{border-bottom:1px solid var(--line);background:#fff}.wrap{max-width:1080px;margin:auto;padding:0 20px}header .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-top:14px;padding-bottom:14px}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;text-decoration:none;color:var(--ink)}.brand img{width:34px;height:34px;border-radius:9px}nav{display:flex;gap:16px;flex-wrap:wrap;font-weight:700;font-size:15px}nav a{text-decoration:none;color:var(--soft)}
.btn{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:12px 20px;font-weight:800;text-decoration:none;background:var(--purple);color:#fff}.btn.ghost{background:var(--lav);color:var(--purple)}
.crumbs{font-size:14px;color:var(--soft);margin:22px 0 0}.crumbs a{color:var(--soft)}h1{font-size:clamp(30px,5vw,46px);line-height:1.12;letter-spacing:-.02em;margin:12px 0}.dek{font-size:20px;color:var(--soft);margin:0 0 18px}
.meta{display:flex;gap:10px;flex-wrap:wrap;font-size:14px;font-weight:700;color:var(--soft)}.meta span{background:var(--lav);color:var(--purple);border-radius:999px;padding:4px 12px}
figure{margin:24px 0}figure img{width:100%;max-height:460px;object-fit:cover;border-radius:18px;background:#f3f3f8}figcaption{font-size:13px;color:var(--soft);margin-top:6px}
article{max-width:720px}article h2{font-size:24px;margin:30px 0 6px}.fact{background:#f7f6ff;border:1px solid #e3defd;border-radius:16px;padding:14px 18px;margin:20px 0}.fact b{display:block;color:var(--purple)}
blockquote{border-left:4px solid var(--purple);margin:20px 0;padding:4px 16px;font-style:italic}.words{background:#f8f9fe;border-radius:16px;padding:6px 20px 14px;margin:28px 0}
.quiz{border:2px solid var(--purple);border-radius:20px;padding:20px 22px;margin:30px 0;background:#fbfaff}.quiz h2{margin-top:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;margin:14px 0 34px}.card{display:block;border:1px solid var(--line);border-radius:16px;padding:14px 16px;text-decoration:none;color:var(--ink)}.card:hover{border-color:var(--purple)}.card b{display:block;line-height:1.3}.card small{color:var(--soft)}
.cats{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.cats a{background:var(--lav);border-radius:999px;padding:6px 14px;font-weight:700;font-size:14px;text-decoration:none}
footer{border-top:1px solid var(--line);margin-top:40px;padding:22px 0;font-size:14px;color:var(--soft)}`;

function page(o: { title: string; description: string; url: string; image?: string; body: string; ld: unknown[] }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title><meta name="description" content="${esc(o.description)}"><meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${o.url}"><link rel="icon" href="/favicon.ico?v=reader2"><link rel="icon" type="image/svg+xml" href="/favicon.svg?v=reader2"><link rel="apple-touch-icon" href="/apple-touch-icon.png?v=reader2">
<meta property="og:type" content="article"><meta property="og:site_name" content="Arise Reader"><meta property="og:url" content="${o.url}"><meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.description)}"><meta property="og:image" content="${esc(o.image || `${READER_ORIGIN}/og-image.png`)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(o.title)}"><meta name="twitter:description" content="${esc(o.description)}"><meta name="twitter:image" content="${esc(o.image || `${READER_ORIGIN}/og-image.png`)}">
<script type="application/ld+json">${json({ "@context": "https://schema.org", "@graph": o.ld })}</script><style>${CSS}</style></head>
<body><header><div class="wrap"><a class="brand" href="/"><img src="/icon-192.png" alt="" width="34" height="34">Arise Reader</a><nav><a href="${READS_PATH}">5-Minute Reads</a><a href="/reading-quizzes/">Reading quizzes</a><a href="/for-parents/">For parents</a><a href="/for-teachers/">For teachers</a><a href="/app#/signin">Sign in</a></nav></div></header>
<main class="wrap">${o.body}</main>
<footer><div class="wrap">Arise Reader · Book quizzes, 5-Minute Reads and reading rewards for kids. <a href="/">Home</a> · <a href="${READS_PATH}">All 5-Minute Reads</a> · <a href="/app#/pricing">Plans</a></div></footer></body></html>`;
}

const crumbsLd = (items: [string, string][]) => ({ "@type": "BreadcrumbList", itemListElement: items.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })) });
const ORG = { "@type": "Organization", "@id": `${READER_ORIGIN}/#org`, name: "Arise Reader", url: `${READER_ORIGIN}/`, logo: { "@type": "ImageObject", url: READER_LOGO, width: 512, height: 512 } };

function blockHtml(b: NewsBlock): string {
  if (b.kind === "p") return `<p>${esc(b.text)}</p>`;
  if (b.kind === "h") return `<h2>${esc(b.text)}</h2>`;
  if (b.kind === "fact") return `<div class="fact"><b>${esc(b.title)}</b>${esc(b.text)}</div>`;
  if (b.kind === "quote") return `<blockquote>${esc(b.text)}${b.by ? `<br><small>— ${esc(b.by)}</small>` : ""}</blockquote>`;
  return `<h2>${esc(b.title)}</h2><ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

/** One read as its own page. */
export function readPageHtml(a: NewsArticle): string {
  const cat = quickCategoryOf(a);
  const url = readUrl(a);
  const img = newsPhotoUrl(a, 1200);
  const credit = newsPhotoPage(a);
  const more = newest().filter((x) => x.slug !== a.slug && quickCategoryOf(x).label === cat.label).slice(0, 6);
  const others = more.length < 6 ? newest().filter((x) => x.slug !== a.slug && !more.includes(x)).slice(0, 6 - more.length) : [];
  const catUrl = `${READER_ORIGIN}${READS_PATH}#${quickCategoryId(cat.label)}`;
  const title = `${a.title} | 5-Minute Read for Kids`;
  const body = `<p class="crumbs"><a href="/">Home</a> › <a href="${READS_PATH}">5-Minute Reads</a> › <a href="${READS_PATH}#${quickCategoryId(cat.label)}">${esc(cat.label)}</a></p>
<article><h1>${esc(a.title)}</h1><p class="dek">${esc(a.dek)}</p>
<div class="meta"><span>${cat.emoji} ${esc(cat.label)}</span><span>⏱ ${newsReadMinutes(a)} min read</span><span>${esc(a.grades)}</span><span>🏆 ${NEWS_POINTS}-point quiz</span></div>
${img ? `<figure><img src="${esc(img)}" alt="${esc(a.photo?.alt || a.title)}" loading="eager" width="1200" height="675">${credit ? `<figcaption>Photo: <a href="${esc(credit)}" rel="nofollow noopener">Wikimedia Commons</a> (free license)</figcaption>` : ""}</figure>` : ""}
${a.body.map(blockHtml).join("\n")}
${a.words.length ? `<section class="words"><h2>Words to know</h2><ul>${a.words.map((w) => `<li><b>${esc(w.word)}</b>: ${esc(w.meaning)}</li>`).join("")}</ul></section>` : ""}
<section class="quiz"><h2>Take the 5-question quiz</h2><p>Finished reading? Check what you remember with a ${a.questions.length}-question quiz in Arise Reader and earn ${NEWS_POINTS} points toward reading rewards.</p><a class="btn" href="/app#/news/${esc(a.slug)}">Take the quiz →</a> <a class="btn ghost" href="${READS_PATH}">More 5-Minute Reads</a></section>
${a.sources?.length ? `<p class="crumbs">Sources: ${a.sources.map((s) => `<a href="${esc(s.url)}" rel="nofollow noopener">${esc(s.name)}</a>`).join(" · ")}</p>` : ""}
</article>
<h2>More ${esc(cat.label)} reads</h2><div class="grid">${[...more, ...others].map(cardHtml).join("")}</div>`;
  return page({
    title, description: a.dek, url, image: img || undefined, body,
    ld: [
      { "@type": "Article", "@id": `${url}#article`, headline: a.title.slice(0, 110), description: a.dek, url, mainEntityOfPage: url, ...(img ? { image: [img] } : {}), datePublished: a.publishedOn, dateModified: a.publishedOn, inLanguage: "en", articleSection: cat.label, educationalLevel: a.grades, timeRequired: `PT${newsReadMinutes(a)}M`, author: { "@id": `${READER_ORIGIN}/#org` }, publisher: { "@id": `${READER_ORIGIN}/#org` }, isAccessibleForFree: true },
      ORG,
      crumbsLd([["Home", `${READER_ORIGIN}/`], ["5-Minute Reads", `${READER_ORIGIN}${READS_PATH}`], [cat.label, catUrl], [a.title, url]]),
    ],
  });
}

const cardHtml = (a: NewsArticle) => `<a class="card" href="${READS_PATH}${a.slug}/"><b>${esc(a.title)}</b><small>${quickCategoryOf(a).emoji} ${esc(quickCategoryOf(a).label)} · ${newsReadMinutes(a)} min</small></a>`;

/** Every read, by category. */
export function readsIndexHtml(): string {
  const all = newest();
  const sections = QUICK_CATEGORIES.map((c) => ({ c, list: all.filter((a) => quickCategoryOf(a).label === c.label) })).filter((s) => s.list.length);
  const url = `${READER_ORIGIN}${READS_PATH}`;
  const body = `<p class="crumbs"><a href="/">Home</a> › 5-Minute Reads</p>
<h1>5-Minute Reads for Kids</h1><p class="dek">${all.length} short, true stories about sports, famous people, history, science, space, animals, inventions and more. Each one takes about five minutes to read and has a 5-question quiz in Arise Reader.</p>
<p><a class="btn" href="/app#/signin">Read and take the quizzes free →</a></p>
<div class="cats">${sections.map(({ c, list }) => `<a href="#${quickCategoryId(c.label)}">${c.emoji} ${esc(c.label)} (${list.length})</a>`).join("")}</div>
${sections.map(({ c, list }) => `<section id="${quickCategoryId(c.label)}"><h2>${c.emoji} ${esc(c.label)}</h2><div class="grid">${list.map(cardHtml).join("")}</div></section>`).join("\n")}`;
  return page({
    title: "5-Minute Reads for Kids: Short Stories with Quizzes | Arise Reader",
    description: `${all.length} kid-friendly 5-minute reads on sports, history, science, space, animals, inventions and famous people, each with a reading quiz.`,
    url, body,
    ld: [
      { "@type": "CollectionPage", "@id": `${url}#page`, url, name: "5-Minute Reads for Kids", isPartOf: { "@id": `${READER_ORIGIN}/#site` }, publisher: { "@id": `${READER_ORIGIN}/#org` },
        mainEntity: { "@type": "ItemList", numberOfItems: all.length, itemListElement: all.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: readUrl(a), name: a.title })) } },
      ORG,
      crumbsLd([["Home", `${READER_ORIGIN}/`], ["5-Minute Reads", url]]),
    ],
  });
}

/** The Reader sitemap: the pages in client/public/sitemap.xml, then the reads' index and every read. */
export function readerSitemapXml(staticXml: string): string {
  const own = [...staticXml.matchAll(/<url>[\s\S]*?<\/url>/g)].map((m) => `  ${m[0].trim()}`);
  const latest = newest()[0]?.publishedOn || "";
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...own,
    `  <url><loc>${READER_ORIGIN}${READS_PATH}</loc>${latest ? `<lastmod>${latest}</lastmod>` : ""}</url>`,
    ...newest().map((a) => `  <url><loc>${readUrl(a)}</loc><lastmod>${a.publishedOn}</lastmod></url>`),
    "</urlset>",
    "",
  ].join("\n");
}

export function registerReaderSeo(app: Express, readStaticSitemap: () => Promise<string>) {
  app.get("/sitemap.xml", async (req, res, next) => {
    if (!isReaderHost(req)) return next();
    res.type("application/xml; charset=utf-8").send(readerSitemapXml(await readStaticSitemap().catch(() => "")));
  });
  app.get(["/5-minute-reads", "/5-minute-reads/"], (req, res, next) => {
    if (!isReaderHost(req)) return next();
    if (!req.path.endsWith("/")) return res.redirect(301, READS_PATH);
    res.setHeader("Cache-Control", "public, max-age=600");
    res.type("html").send(readsIndexHtml());
  });
  app.get("/5-minute-reads/:slug", (req, res, next) => {
    if (!isReaderHost(req)) return next();
    const a = /^[a-z0-9-]{3,120}$/.test(req.params.slug) ? newsBySlug(req.params.slug) : null;
    if (!a) return res.status(404).type("html").send(page({ title: "Read not found | Arise Reader", description: "That 5-Minute Read isn't here.", url: `${READER_ORIGIN}${READS_PATH}`, body: `<h1>That read isn't here</h1><p><a class="btn" href="${READS_PATH}">See every 5-Minute Read</a></p>`, ld: [] }));
    if (!req.path.endsWith("/")) return res.redirect(301, `${READS_PATH}${a.slug}/`);
    res.setHeader("Cache-Control", "public, max-age=600");
    res.type("html").send(readPageHtml(a));
  });
}
