#!/usr/bin/env python3
"""Builds the books readable on Arise ("Read on Arise") from public-domain sources.

Sources: Standard Ebooks source repos (CC0) and Project Gutenberg texts mirrored
by GITenberg on GitHub. Output (committed):
  client/public/reads/<bookId>/index.json   contents + word counts
  client/public/reads/<bookId>/<n>.html     one sanitized chapter per file
  client/public/reads/<bookId>/img/*.webp   pictures (picture books only)
  shared/readsCatalog.ts                    generated catalog for the app

Run:  python3 script/build_reads.py --src /path/to/cache
"""
import argparse, html, json, os, re, subprocess, sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "client/public/reads")

SE = "se"; HTMLSRC = "html"; TXT = "txt"
BOOKS = [
    (1, "The Tale of Peter Rabbit", "Beatrix Potter", HTMLSRC, "GITenberg/The-Tale-of-Peter-Rabbit_14838", {"file": "14838-h/14838-h.htm", "images": True}),
    (2, "The Great Big Treasury of Beatrix Potter", "Beatrix Potter", TXT, "GITenberg/The-Great-Big-Treasury-of-Beatrix-Potter_572", {"file": "572.txt", "titles": True}),
    (4, "The Story of the Three Little Pigs", "L. Leslie Brooke", HTMLSRC, "GITenberg/The-Story-of-the-Three-Little-Pigs_18155", {"file": "18155-h/18155-h.htm", "images": True}),
    (6, "The Wonderful Wizard of Oz", "L. Frank Baum", SE, "standardebooks/l-frank-baum_the-wonderful-wizard-of-oz", {}),
    (7, "Alice's Adventures in Wonderland", "Lewis Carroll", SE, "standardebooks/lewis-carroll_alices-adventures-in-wonderland", {}),
    (8, "The Wind in the Willows", "Kenneth Grahame", SE, "standardebooks/kenneth-grahame_the-wind-in-the-willows", {}),
    (9, "Winnie-the-Pooh", "A. A. Milne", SE, "standardebooks/a-a-milne_winnie-the-pooh", {}),
    (10, "The House at Pooh Corner", "A. A. Milne", SE, "standardebooks/a-a-milne_the-house-at-pooh-corner", {}),
    (11, "Black Beauty", "Anna Sewell", SE, "standardebooks/anna-sewell_black-beauty", {}),
    (12, "Five Children and It", "E. Nesbit", SE, "standardebooks/e-nesbit_five-children-and-it", {}),
    (13, "The Railway Children", "E. Nesbit", SE, "standardebooks/e-nesbit_the-railway-children", {}),
    (14, "The Enchanted Castle", "E. Nesbit", SE, "standardebooks/e-nesbit_the-enchanted-castle", {}),
    (15, "The Story of Doctor Dolittle", "Hugh Lofting", SE, "standardebooks/hugh-lofting_the-story-of-doctor-dolittle", {}),
    (16, "Heidi", "Johanna Spyri", TXT, "GITenberg/Heidi_1448", {"file": "1448.txt", "heading": r"^CHAPTER [IVXLC]+\.\s*(.+)$"}),
    (17, "The Water-Babies", "Charles Kingsley", SE, "standardebooks/charles-kingsley_the-water-babies", {}),
    (18, "The Princess and Curdie", "George MacDonald", SE, "standardebooks/george-macdonald_the-princess-and-curdie", {}),
    (19, "Understood Betsy", "Dorothy Canfield Fisher", SE, "standardebooks/dorothy-canfield-fisher_understood-betsy", {}),
    (20, "The Magic City", "E. Nesbit", SE, "standardebooks/e-nesbit_the-magic-city", {}),
    (21, "The Secret Garden", "Frances Hodgson Burnett", SE, "standardebooks/frances-hodgson-burnett_the-secret-garden", {}),
    (22, "A Little Princess", "Frances Hodgson Burnett", SE, "standardebooks/frances-hodgson-burnett_a-little-princess", {}),
    (23, "Anne of Green Gables", "L. M. Montgomery", SE, "standardebooks/l-m-montgomery_anne-of-green-gables", {}),
    (24, "Treasure Island", "Robert Louis Stevenson", SE, "standardebooks/robert-louis-stevenson_treasure-island", {}),
    (25, "Little Women", "Louisa May Alcott", SE, "standardebooks/louisa-may-alcott_little-women", {}),
    (26, "The Jungle Book", "Rudyard Kipling", SE, "standardebooks/rudyard-kipling_the-jungle-book", {}),
    (27, "Just So Stories", "Rudyard Kipling", SE, "standardebooks/rudyard-kipling_just-so-stories", {}),
    (28, "Peter Pan", "J. M. Barrie", SE, "standardebooks/j-m-barrie_peter-and-wendy", {}),
    (29, "The Prince and the Pauper", "Mark Twain", SE, "standardebooks/mark-twain_the-prince-and-the-pauper", {}),
    (30, "Pollyanna", "Eleanor H. Porter", SE, "standardebooks/eleanor-h-porter_pollyanna", {}),
    (31, "The Swiss Family Robinson", "Johann David Wyss", TXT, "GITenberg/Swiss-Family-Robinson_3836", {"file": "3836.txt", "heading": r"^Chapter (\d+)$"}),
    (32, "The Story of the Treasure Seekers", "E. Nesbit", SE, "standardebooks/e-nesbit_the-story-of-the-treasure-seekers", {}),
]

VOID = {"br", "img", "hr", "meta", "link", "input", "col", "area", "base", "wbr", "source"}
DROP = {"script", "style", "head", "title", "meta", "link", "nav", "svg", "iframe", "object", "embed", "form", "input", "button", "noscript", "math"}
KEEP = {"p", "h2", "h3", "h4", "h5", "h6", "em", "i", "strong", "b", "br", "hr", "blockquote", "ul", "ol", "li", "figure", "figcaption", "sup", "sub", "small", "header", "cite", "dl", "dt", "dd", "div", "img"}
CLASSES = {"i1", "i2", "i3", "i4", "i5", "i6", "center", "poem", "verse", "song", "letter", "signature", "epigraph", "dedication"}
EPUB_CLASS = {"z3998:poem": "poem", "z3998:verse": "verse", "z3998:song": "song", "z3998:letter": "letter", "z3998:signature": "signature", "epigraph": "epigraph", "dedication": "dedication", "title": "title"}


class Node:
    def __init__(self, tag, attrs):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def text(self):
        return "".join(c if isinstance(c, str) else c.text() for c in self.children)


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root", {}); self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs); self.stack[-1].children.append(n)
        if tag not in VOID: self.stack.append(n)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].children.append(Node(tag, attrs))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]; return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def parse(s):
    t = Tree(); t.feed(s); t.close(); return t.root


def find(node, pred):
    if not isinstance(node, Node): return None
    if pred(node): return node
    for c in node.children:
        r = find(c, pred)
        if r: return r
    return None


def render(node, ctx):
    if isinstance(node, str):
        return html.escape(node, quote=False)
    tag = node.tag
    cls = (node.attrs.get("class") or "").split()
    et = (node.attrs.get("epub:type") or "").split()
    if tag in DROP or "pagenum" in cls or "pageno" in cls or "pagebreak" in et:
        return ""
    inner = "".join(render(c, ctx) for c in node.children)
    if tag == "img":
        src = node.attrs.get("src", "")
        if not ctx.get("images"): return ""
        name = ctx["image"](src)
        if not name: return ""
        alt = html.escape(node.attrs.get("alt", ""), quote=True)
        return f'<img src="/reads/{ctx["id"]}/img/{name}" alt="{alt}" loading="lazy"/>'
    if tag == "a" and "noteref" in et:
        return f"<sup>{inner}</sup>"
    if tag == "h1": tag = "h2"
    if tag in ("hgroup",): tag = "header"
    if tag == "span" and ("i1" in cls or "i2" in cls or "i3" in cls):
        return f'<span class="{cls[0]}">{inner}</span>'
    if tag not in KEEP:
        return inner
    keep = [c for c in cls if c in CLASSES] + [EPUB_CLASS[e] for e in et if e in EPUB_CLASS]
    if tag == "div" and not keep and not inner.strip():
        return ""
    attr = f' class="{" ".join(sorted(set(keep)))}"' if keep else ""
    if tag in VOID:
        return f"<{tag}{attr}/>"
    if tag in ("p", "h2", "h3", "h4", "li", "figcaption") and not re.sub(r"<[^>]+>", "", inner).strip() and "<img" not in inner:
        return ""
    return f"<{tag}{attr}>{inner}</{tag}>"


def words_of(htmltext):
    return len(re.sub(r"<[^>]+>", " ", htmltext).split())


def git(repo, src):
    d = os.path.join(src, repo.split("/")[1])
    if not os.path.isdir(d):
        subprocess.run(["git", "clone", "-q", "--depth", "1", f"https://github.com/{repo}.git", d], check=True)
    return d


SKIP_TYPES = {"titlepage", "imprint", "colophon", "copyright-page", "halftitlepage", "loi", "toc", "endnotes"}


def build_se(bid, d, opts):
    epub = os.path.join(d, "src/epub")
    opf = open(os.path.join(epub, "content.opf"), encoding="utf-8").read()
    items = dict(re.findall(r'<item href="([^"]+)" id="([^"]+)"', opf))
    ids = {v: k for k, v in items.items()}
    spine = re.findall(r'<itemref idref="([^"]+)"', opf)
    toc = open(os.path.join(epub, "toc.xhtml"), encoding="utf-8").read()
    titles = {}
    for href, label in re.findall(r'<a href="([^"#]+)(?:#[^"]*)?">(.*?)</a>', toc, re.S):
        t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", label))).strip()
        titles.setdefault(os.path.basename(href), t)
    chapters = []
    for ref in spine:
        href = ids.get(ref)
        if not href or not href.endswith(".xhtml"): continue
        root = parse(open(os.path.join(epub, href), encoding="utf-8").read())
        body = find(root, lambda n: n.tag == "body")
        sec = find(body, lambda n: n.tag in ("section", "article"))
        types = set((sec.attrs.get("epub:type", "") if sec else "").split()) | set(body.attrs.get("epub:type", "").split())
        if types & SKIP_TYPES: continue
        content = render(body, {"id": bid})
        title = titles.get(os.path.basename(href)) or (sec.attrs.get("id", "").replace("-", " ").title() if sec else "Section")
        chapters.append([title, content])
    return merge_small(chapters)


def merge_small(chapters):
    out = []
    pending = ""
    for title, content in chapters:
        if words_of(content) < 60 and "<img" not in content:
            pending += content; continue
        out.append([title, pending + content]); pending = ""
    if pending and out: out[-1][1] += pending
    return out


def strip_gutenberg_text(s):
    m = re.search(r"\*\*\*\s*START OF.*?\*\*\*|\*END[^\n]*SMALL PRINT[^\n]*\n", s)
    if m: s = s[m.end():]
    e = re.search(r"\*\*\*\s*END OF|End of (the )?Project Gutenberg|End Project Gutenberg|End of this Project Gutenberg", s, re.I)
    if e: s = s[:e.start()]
    return s


def txt_to_html(block):
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", block)]
    out = []
    for p in paras:
        if not p: continue
        p = html.escape(p, quote=False).replace("--", "—")
        p = re.sub(r"_([^_]+)_", r"<em>\1</em>", p)
        out.append(f"<p>{p}</p>")
    return "".join(out)


def build_txt(bid, d, opts):
    s = open(os.path.join(d, opts["file"]), encoding="utf-8", errors="replace").read().replace("\r\n", "\n")
    s = strip_gutenberg_text(s)
    chapters = []
    if opts.get("titles"):
        m = re.search(r"\nCONTENTS\s*\n((?:.+\n)+)", s)
        names = [n.strip() for n in m.group(1).strip().split("\n") if n.strip()]
        body = s[m.end():]
        pos = []
        for n in names:
            pat = r"\n\s*" + r"\s+".join(re.escape(w) for w in n.split()) + r"\s*\n"
            mm = re.search(pat, body[pos[-1][1] if pos else 0:])
            if not mm: continue
            off = pos[-1][1] if pos else 0
            pos.append((n, off + mm.end(), off + mm.start()))
        for i, (n, start, _) in enumerate(pos):
            end = pos[i + 1][2] if i + 1 < len(pos) else len(body)
            chapters.append([n.title().replace("'S", "'s"), txt_to_html(body[start:end])])
    else:
        rx = re.compile(opts["heading"], re.M)
        ms = list(rx.finditer(s))
        for i, m in enumerate(ms):
            end = ms[i + 1].start() if i + 1 < len(ms) else len(s)
            label = m.group(1).strip()
            title = f"Chapter {label}" if label.isdigit() else label.title()
            chapters.append([title, f"<h2>{html.escape(title)}</h2>" + txt_to_html(s[m.end():end])])
    return chapters


def build_html(bid, d, opts, images):
    path = os.path.join(d, opts["file"])
    raw = open(path, encoding="utf-8", errors="replace").read()
    m = re.search(r"\*\*\*\s*START OF[^*]*\*\*\*", raw)
    e = re.search(r"\*\*\*\s*END OF|End of (the )?Project Gutenberg|End of Project Gutenberg", raw)
    raw = raw[m.end(): e.start() if e else len(raw)]
    raw = re.sub(r"(?is)^.*?</p>", "", raw, count=1) if raw.lstrip().startswith("</p>") else raw
    raw = re.sub(r"(?is)<h3>\s*E-text prepared.*?</h3>", "", raw)
    raw = re.sub(r"(?s)^\s*Produced by.*?\)\.?", "", raw)
    imgdir = os.path.join(os.path.dirname(path))
    root = parse(raw)
    content = render(root, {"id": bid, "images": True, "image": lambda src: images(os.path.join(imgdir, src))})
    content = re.sub(r"(?s)<h6>.*?</h6>", "", content)
    content = re.sub(r"\n\s*\n+", "\n", content)
    content = re.sub(r"<h2>\s*BEATRIX POTTER\s*</h2>|<h3>[^<]*(FREDERICK WARNE|BY|With drawings by)[^<]*</h3>", "", content)
    return [[TITLES[bid], content]]


TITLES = {b[0]: b[1] for b in BOOKS}


def convert_image(src, dest_dir, done):
    from PIL import Image
    if not os.path.exists(src): return None
    name = re.sub(r"\.[a-z]+$", "", os.path.basename(src)) + ".webp"
    if name not in done:
        im = Image.open(src)
        im = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
        if im.width > 900:
            im = im.resize((900, round(im.height * 900 / im.width)))
        os.makedirs(dest_dir, exist_ok=True)
        im.save(os.path.join(dest_dir, name), "WEBP", quality=70, method=6)
        done.add(name)
    return name


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--src", required=True); ap.add_argument("--only", type=int)
    a = ap.parse_args()
    catalog = []
    for bid, title, author, kind, repo, opts in BOOKS:
        if a.only and a.only != bid: continue
        d = git(repo, a.src)
        outdir = os.path.join(OUT, str(bid))
        if os.path.isdir(outdir):
            for f in os.listdir(outdir):
                p = os.path.join(outdir, f)
                if os.path.isfile(p): os.remove(p)
        os.makedirs(outdir, exist_ok=True)
        done = set()
        if kind == SE: chapters = build_se(bid, d, opts)
        elif kind == TXT: chapters = build_txt(bid, d, opts)
        else: chapters = build_html(bid, d, opts, lambda p: convert_image(p, os.path.join(outdir, "img"), done))
        toc = []
        for i, (t, c) in enumerate(chapters, 1):
            assert "<script" not in c.lower() and "gutenberg" not in c.lower(), (bid, t)
            open(os.path.join(outdir, f"{i}.html"), "w", encoding="utf-8").write(c)
            toc.append({"title": t, "words": words_of(c)})
        total = sum(c["words"] for c in toc)
        json.dump({"id": bid, "title": title, "author": author, "chapters": toc, "words": total, "pictures": len(done)}, open(os.path.join(outdir, "index.json"), "w"), ensure_ascii=False)
        catalog.append({"bookId": bid, "title": title, "author": author, "chapters": len(toc), "words": total, "pictures": len(done)})
        print(f"{bid:>3} {title[:40]:40} {len(toc):>3} ch {total:>7} words {len(done)} pics", flush=True)
    if not a.only:
        ts = "// Generated by script/build_reads.py. Do not edit by hand.\n"
        ts += "// Public-domain books that can be read right on Arise (files in client/public/reads/<bookId>/).\n\n"
        ts += "export type ReadableBook = { bookId: number; title: string; author: string; chapters: number; words: number; pictures: number };\n\n"
        ts += "export const READABLE_BOOKS: ReadableBook[] = " + json.dumps(catalog, ensure_ascii=False, indent=2) + ";\n\n"
        ts += "export const readableBook = (bookId: number | null | undefined) => READABLE_BOOKS.find((b) => b.bookId === Number(bookId)) ?? null;\n"
        ts += "/** Minutes to read at about 200 words a minute. */\nexport const readMinutes = (words: number) => Math.max(1, Math.round(words / 200));\n"
        open(os.path.join(ROOT, "shared/readsCatalog.ts"), "w").write(ts)


if __name__ == "__main__":
    main()
