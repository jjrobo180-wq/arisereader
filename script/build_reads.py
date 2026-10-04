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
    (116, "The Princess and the Goblin", "George MacDonald", SE, "standardebooks/george-macdonald_the-princess-and-the-goblin", {}),
    (291, "Pinocchio", "Carlo Collodi", SE, "standardebooks/carlo-collodi_the-adventures-of-pinocchio", {}),
    (293, "At the Back of the North Wind", "George MacDonald", SE, "standardebooks/george-macdonald_at-the-back-of-the-north-wind", {}),
    (284, "My Father's Dragon", "Ruth Stiles Gannett", HTMLSRC, "GITenberg/My-Father-s-Dragon_30017", {"file": "30017-h/30017-h.htm", "images": True,
        "split": r"<h2><i>(Chapter [A-Za-z]+)</i></h2>\s*<h2>([^<]+)</h2>", "drop_after": r"<h3>THE END</h3>"}),
    # Books with a string key get their library quiz from server/readsSync.ts (the key maps to a book id at runtime).
    ("sleepy-hollow", "The Legend of Sleepy Hollow", "Washington Irving", HTMLSRC, "GITenberg/The-Legend-of-Sleepy-Hollow_41", {"file": "41-h/41-h.htm",
        "drop_before": r"(?s)^.*?OF THE LATE DIEDRICH KNICKERBOCKER\.\s*</h2>", "parts": 4}),
    ("canterville-ghost", "The Canterville Ghost", "Oscar Wilde", HTMLSRC, "GITenberg/The-Canterville-Ghost_14522", {"file": "14522-h/14522-h.htm", "images": True,
        "drop_before": r"(?s)^.*?(?=<h2>I</h2>)", "split": r"<h2>([IVX]+)</h2>()"}),
    ("velveteen-rabbit", "The Velveteen Rabbit", "Margery Williams", HTMLSRC, "GITenberg/The-Velveteen-Rabbit_11757", {"file": "11757-h/11757-h.htm",
        "drop_before": r"(?s)^.*?List of Illustrations</i></h3>\s*<p>.*?</p>\s*<hr/>"}),
    ("hound-baskervilles", "The Hound of the Baskervilles", "Arthur Conan Doyle", SE, "standardebooks/arthur-conan-doyle_the-hound-of-the-baskervilles", {}),
    # October 2026: the big shelf. Every text was screened for slurs and racial caricature; books that
    # rely on them were left out (Tom Sawyer, White Fang, three early Nancy Drews, ...). A few otherwise
    # gentle books keep one dated word swapped for a plain one ("replace") or one passage left out ("strip").
    ("tower-treasure", "The Tower Treasure", "Franklin W. Dixon", SE, "standardebooks/franklin-w-dixon_the-tower-treasure", {}),
    ("secret-of-the-old-mill", "The Secret of the Old Mill", "Franklin W. Dixon", SE, "standardebooks/franklin-w-dixon_the-secret-of-the-old-mill", {}),
    ("missing-chums", "The Missing Chums", "Franklin W. Dixon", SE, "standardebooks/franklin-w-dixon_the-missing-chums", {}),
    ("shore-road-mystery", "The Shore Road Mystery", "Franklin W. Dixon", SE, "standardebooks/franklin-w-dixon_the-shore-road-mystery", {}),
    ("secret-of-the-caves", "The Secret of the Caves", "Franklin W. Dixon", SE, "standardebooks/franklin-w-dixon_the-secret-of-the-caves", {"replace": [("a Chinaman’s chance", "a ghost of a chance")]}),
    ("mystery-of-cabin-island", "The Mystery of Cabin Island", "Franklin W. Dixon", SE, "standardebooks/franklin-w-dixon_the-mystery-of-cabin-island", {}),
    ("great-airport-mystery", "The Great Airport Mystery", "Franklin W. Dixon", SE, "standardebooks/franklin-w-dixon_the-great-airport-mystery", {}),
    ("bungalow-mystery", "The Bungalow Mystery", "Carolyn Keene", SE, "standardebooks/carolyn-keene_the-bungalow-mystery", {}),
    ("macdonald-fairy-tales", "The Light Princess and Other Fairy Tales", "George MacDonald", SE, "standardebooks/george-macdonald_short-fiction",
        {"split_big": True, "files": ["the-light-princess.xhtml", "the-giants-heart.xhtml", "the-golden-key.xhtml", "cross-purposes.xhtml", "the-shadows.xhtml", "the-carasoyn.xhtml",
                   "the-history-of-photogen-and-nycteris.xhtml", "a-double-story.xhtml", "the-castle.xhtml"]}),
    ("windfairies", "The Windfairies", "Mary De Morgan", SE, "standardebooks/mary-de-morgan_the-windfairies", {}),
    ("princess-fiorimonde", "The Necklace of Princess Fiorimonde", "Mary De Morgan", SE, "standardebooks/mary-de-morgan_the-necklace-of-princess-fiorimonde", {}),
    ("on-a-pincushion", "On a Pincushion", "Mary De Morgan", SE, "standardebooks/mary-de-morgan_on-a-pincushion", {}),
    ("swallows-and-amazons", "Swallows and Amazons", "Arthur Ransome", SE, "standardebooks/arthur-ransome_swallows-and-amazons", {"replace": [("Honest Injun", "Honest and true")]}),
    ("marvelous-land-of-oz", "The Marvelous Land of Oz", "L. Frank Baum", SE, "standardebooks/l-frank-baum_the-marvelous-land-of-oz", {}),
    ("ozma-of-oz", "Ozma of Oz", "L. Frank Baum", SE, "standardebooks/l-frank-baum_ozma-of-oz", {}),
    ("dorothy-and-the-wizard", "Dorothy and the Wizard in Oz", "L. Frank Baum", SE, "standardebooks/l-frank-baum_dorothy-and-the-wizard-in-oz", {}),
    ("road-to-oz", "The Road to Oz", "L. Frank Baum", SE, "standardebooks/l-frank-baum_the-road-to-oz", {}),
    ("patchwork-girl-of-oz", "The Patchwork Girl of Oz", "L. Frank Baum", TXT, "GITenberg/The-Patchwork-Girl-of-Oz_955", {"file": "955.txt", "subtitle": True, "drop_after": r"^\s*(THE END\s*$|The Wonderful Oz Books)", "heading": r"^(Chapter [A-Za-z-]+)\s*$"}),
    ("scarecrow-of-oz", "The Scarecrow of Oz", "L. Frank Baum", TXT, "GITenberg/The-Scarecrow-of-Oz_957", {"file": "957.txt", "subtitle": True, "drop_after": r"^\s*(THE END\s*$|The Wonderful Oz Books)", "heading": r"^(Chapter [A-Za-z-]+)\s*$"}),
    ("emerald-city-of-oz", "The Emerald City of Oz", "L. Frank Baum", TXT, "GITenberg/The-Emerald-City-of-Oz_517", {"file": "517.txt", "drop_after": r"^\s*(THE END\s*$|The Wonderful Oz Books)", "heading": r"^(\d+)\.\s+(\S.*?)\s*$"}),
    ("magic-of-oz", "The Magic of Oz", "L. Frank Baum", TXT, "GITenberg/The-Magic-of-Oz_419", {"file": "419.txt", "drop_after": r"^\s*(THE END\s*$|The Wonderful Oz Books)", "heading": r"^(\d+)\.\s+(\S.*?)\s*$"}),
    ("lost-princess-of-oz", "The Lost Princess of Oz", "L. Frank Baum", TXT, "GITenberg/The-Lost-Princess-of-Oz_959", {"file": "959.txt", "subtitle": True, "drop_after": r"^\s*(THE END\s*$|The Wonderful Oz Books)", "heading": r"^CHAPTER (\d+)\s*$"}),
    ("cornelli", "Cornelli", "Johanna Spyri", SE, "standardebooks/johanna-spyri_cornelli_elisabeth-p-stork", {}),
    ("emily-of-new-moon", "Emily of New Moon", "L. M. Montgomery", SE, "standardebooks/l-m-montgomery_emily-of-new-moon", {}),
    ("bambi", "Bambi", "Felix Salten", SE, "standardebooks/felix-salten_bambi_whittaker-chambers", {}),
    ("the-blue-bird", "The Blue Bird", "Maurice Maeterlinck", SE, "standardebooks/maurice-maeterlinck_georgette-leblanc_the-blue-bird_alexander-teixeira-de-mattos", {}),
    ("old-indian-legends", "Old Indian Legends", "Zitkala-Ša", SE, "standardebooks/zitkala-sa_old-indian-legends", {}),
    ("smoky-the-cowhorse", "Smoky the Cowhorse", "Will James", SE, "standardebooks/will-james_smoky-the-cowhorse", {"replace": [("injun fighting cowboy", "old-time cowboy")]}),
    ("grimms-household-tales", "Grimms' Household Tales", "Jacob and Wilhelm Grimm", SE, "standardebooks/jacob-grimm_wilhelm-grimm_household-tales_margaret-hunt",
        {"skip_files": ["the-jew-among-thorns.xhtml", "the-good-bargain.xhtml", "the-bright-sun-brings-it-to-light.xhtml"]}),
    ("wet-magic", "Wet Magic", "E. Nesbit", SE, "standardebooks/e-nesbit_wet-magic", {}),
    ("story-of-the-amulet", "The Story of the Amulet", "E. Nesbit", SE, "standardebooks/e-nesbit_the-story-of-the-amulet", {}),
    ("house-of-arden", "The House of Arden", "E. Nesbit", SE, "standardebooks/e-nesbit_the-house-of-arden", {}),
    ("indian-fairy-tales", "Indian Fairy Tales", "Joseph Jacobs", SE, "standardebooks/joseph-jacobs_indian-fairy-tales", {}),
    ("wilde-childrens-stories", "The Happy Prince and Other Stories", "Oscar Wilde", SE, "standardebooks/oscar-wilde_childrens-stories", {"skip_files": ["the-fisherman-and-his-soul.xhtml"]}),
    ("green-forest-stories", "Green Forest Stories", "Thornton W. Burgess", SE, "standardebooks/thornton-w-burgess_green-forest-stories", {"split_big": True}),
    ("green-meadow-stories", "Green Meadow Stories", "Thornton W. Burgess", SE, "standardebooks/thornton-w-burgess_green-meadow-stories", {"split_big": True}),
    ("little-lord-fauntleroy", "Little Lord Fauntleroy", "Frances Hodgson Burnett", SE, "standardebooks/frances-hodgson-burnett_little-lord-fauntleroy", {}),
    ("kidnapped", "Kidnapped", "Robert Louis Stevenson", SE, "standardebooks/robert-louis-stevenson_kidnapped", {}),
    ("through-the-looking-glass", "Through the Looking-Glass", "Lewis Carroll", SE, "standardebooks/lewis-carroll_through-the-looking-glass_john-tenniel", {}),
    ("adventures-of-nils", "The Wonderful Adventures of Nils", "Selma Lagerlöf", SE, "standardebooks/selma-lagerlof_the-wonderful-adventures-of-nils_velma-swanston-howard", {}),
    ("freckles", "Freckles", "Gene Stratton-Porter", SE, "standardebooks/gene-stratton-porter_freckles", {"replace": [("dialect and coon songs", "dialect songs"), ("Honest Injun", "Honest and true")]}),
    ("christmas-carol", "A Christmas Carol", "Charles Dickens", SE, "standardebooks/charles-dickens_a-christmas-carol", {}),
    ("jekyll-and-hyde", "The Strange Case of Dr. Jekyll and Mr. Hyde", "Robert Louis Stevenson", SE, "standardebooks/robert-louis-stevenson_the-strange-case-of-dr-jekyll-and-mr-hyde", {}),
    ("frankenstein", "Frankenstein", "Mary Shelley", SE, "standardebooks/mary-shelley_frankenstein", {}),
    ("war-of-the-worlds", "The War of the Worlds", "H. G. Wells", SE, "standardebooks/h-g-wells_the-war-of-the-worlds", {}),
    ("first-men-in-the-moon", "The First Men in the Moon", "H. G. Wells", SE, "standardebooks/h-g-wells_the-first-men-in-the-moon", {}),
    ("adventures-of-sherlock-holmes", "The Adventures of Sherlock Holmes", "Arthur Conan Doyle", SE, "standardebooks/arthur-conan-doyle_the-adventures-of-sherlock-holmes", {}),
    ("memoirs-of-sherlock-holmes", "The Memoirs of Sherlock Holmes", "Arthur Conan Doyle", SE, "standardebooks/arthur-conan-doyle_the-memoirs-of-sherlock-holmes", {"replace": [("at a Jew broker’s", "at a broker’s"), ("The Negro.", "The Raven.")]}),
    ("return-of-sherlock-holmes", "The Return of Sherlock Holmes", "Arthur Conan Doyle", SE, "standardebooks/arthur-conan-doyle_the-return-of-sherlock-holmes", {}),
    ("valley-of-fear", "The Valley of Fear", "Arthur Conan Doyle", SE, "standardebooks/arthur-conan-doyle_the-valley-of-fear", {}),
    ("prisoner-of-zenda", "The Prisoner of Zenda", "Anthony Hope", SE, "standardebooks/anthony-hope_the-prisoner-of-zenda", {}),
    ("black-arrow", "The Black Arrow", "Robert Louis Stevenson", SE, "standardebooks/robert-louis-stevenson_the-black-arrow", {}),
    ("aesops-fables", "Aesop's Fables", "Aesop", SE, "standardebooks/aesop_fables_v-s-vernon-jones",
        {"split_big": True, "strip": [r"<h2 class=\"title\">The Blackamoor</h2>.*?(?=<h2)"]}),  # a fable built on a racist joke
    ("phantom-of-the-opera", "The Phantom of the Opera", "Gaston Leroux", SE, "standardebooks/gaston-leroux_the-phantom-of-the-opera_alexander-teixeira-de-mattos", {}),
    ("ragged-dick", "Ragged Dick", "Horatio Alger Jr.", SE, "standardebooks/horatio-alger-jr_ragged-dick", {}),
    ("anne-of-avonlea", "Anne of Avonlea", "L. M. Montgomery", SE, "standardebooks/l-m-montgomery_anne-of-avonlea", {"replace": [("Everybody would want my squaw.", "Everybody would want my wife."), ("Injun headdress", "Indian headdress")]}),
    ("anne-of-the-island", "Anne of the Island", "L. M. Montgomery", SE, "standardebooks/l-m-montgomery_anne-of-the-island", {}),
    ("secret-adversary", "The Secret Adversary", "Agatha Christie", SE, "standardebooks/agatha-christie_the-secret-adversary", {}),
    ("murder-on-the-links", "The Murder on the Links", "Agatha Christie", SE, "standardebooks/agatha-christie_the-murder-on-the-links", {}),
    ("red-house-mystery", "The Red House Mystery", "A. A. Milne", SE, "standardebooks/a-a-milne_the-red-house-mystery", {}),
    ("king-of-elflands-daughter", "The King of Elfland's Daughter", "Lord Dunsany", SE, "standardebooks/lord-dunsany_the-king-of-elflands-daughter", {}),
    ("the-gold-bat", "The Gold Bat", "P. G. Wodehouse", SE, "standardebooks/p-g-wodehouse_the-gold-bat", {}),
    ("hindu-tales", "Hindu Tales from the Sanskrit", "S. M. Mitra", SE, "standardebooks/s-m-mitra_hindu-tales-from-the-sanskrit", {}),
    ("sylvie-and-bruno", "Sylvie and Bruno", "Lewis Carroll", SE, "standardebooks/lewis-carroll_sylvie-and-bruno", {}),
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
    if opts.get("files"):  # an explicit list (and order) of text files to include
        spine = [items["text/" + f] for f in opts["files"]]
    toc = open(os.path.join(epub, "toc.xhtml"), encoding="utf-8").read()
    titles = {}
    for href, label in re.findall(r'<a href="([^"#]+)(?:#[^"]*)?">(.*?)</a>', toc, re.S):
        t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", label))).strip()
        titles.setdefault(os.path.basename(href), t)
    chapters = []
    for ref in spine:
        href = ids.get(ref)
        if not href or not href.endswith(".xhtml"): continue
        if os.path.basename(href) in opts.get("skip_files", ()): continue
        root = parse(open(os.path.join(epub, href), encoding="utf-8").read())
        body = find(root, lambda n: n.tag == "body")
        sec = find(body, lambda n: n.tag in ("section", "article"))
        types = set((sec.attrs.get("epub:type", "") if sec else "").split()) | set(body.attrs.get("epub:type", "").split())
        if types & SKIP_TYPES: continue
        content = render(body, {"id": bid})
        title = titles.get(os.path.basename(href)) or (sec.attrs.get("id", "").replace("-", " ").title() if sec else "Section")
        chapters.append([title, content])
    chapters = merge_small(chapters)
    return split_big(chapters) if opts.get("split_big") else chapters


def split_big(chapters, limit=9000, target=5000):
    """Collections can arrive as one huge chapter (all of Aesop on one page). Split those at their
    own headings into pages of about `target` words, named after the headings they hold."""
    out = []
    for title, content in chapters:
        if words_of(content) <= limit:
            out.append([title, content]); continue
        tag = "h3" if content.count("<h3") >= 3 else "h2"
        parts = re.split(rf"(?=<{tag}[ >])", content)
        lead, pieces = (parts[0], parts[1:]) if parts and not parts[0].startswith(f"<{tag}") else ("", parts)
        if len(pieces) < 3:
            out.append([title, content]); continue
        heads = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", re.match(rf"<{tag}[^>]*>(.*?)</{tag}>", p, re.S).group(1)))).strip() if re.match(rf"<{tag}[^>]*>(.*?)</{tag}>", p, re.S) else "" for p in pieces]
        groups, cur, acc = [], [], words_of(lead)
        for i, p in enumerate(pieces):
            cur.append(i); acc += words_of(p)
            if acc >= target: groups.append(cur); cur, acc = [], 0
        if cur:
            if groups and acc < target / 3: groups[-1] += cur
            else: groups.append(cur)
        roman = all(re.fullmatch(r"[IVXLC]+\.?", heads[i] or "") for g in groups for i in g)
        for n, g in enumerate(groups):
            first, last = heads[g[0]], heads[g[-1]]
            if roman: name = f"{title}: chapters {first}–{last}" if first != last else f"{title}: chapter {first}"
            else: name = first if len(g) == 1 else f"{first} and more"
            body = (lead if n == 0 else "") + "".join(pieces[i] for i in g)
            if n > 0 and tag == "h3": body = f"<h2>{html.escape(title)}</h2>" + body
            out.append([name, body])
    return out


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
        if opts.get("drop_after"):
            m = re.search(opts["drop_after"], s, re.M)
            if m: s = s[:m.start()]
        rx = re.compile(opts["heading"], re.M)
        ms = list(rx.finditer(s))
        for i, m in enumerate(ms):
            end = ms[i + 1].start() if i + 1 < len(ms) else len(s)
            label = m.group(1).strip()
            title = f"Chapter {label}" if label.isdigit() else label.title()
            if m.lastindex and m.lastindex >= 2: title = f"Chapter {label}: {m.group(2).strip()}"
            body = s[m.end():end]
            if opts.get("subtitle"):  # the short line under "Chapter One" is the chapter's name
                mm = re.match(r"\s*\n([^\n]{2,70})\n\s*\n", body)
                if mm:
                    sub = re.sub(r"\s+", " ", mm.group(1)).strip()
                    if sub.isupper(): sub = sub.title().replace("'S", "'s")
                    sub = re.sub(r"(?<=\s)(The|A|An|Of|And|To|In|On|For|With)(?=\s)", lambda w: w.group(1).lower(), sub)
                    title = f"{title}: {sub}"; body = body[mm.end():]
            chapters.append([title, f"<h2>{html.escape(title)}</h2>" + txt_to_html(body)])
    return chapters


def build_html(bid, d, opts, images):
    path = os.path.join(d, opts["file"])
    raw = open(path, encoding="utf-8", errors="replace").read()
    m = re.search(r"\*\*\*\s*START OF[^*]*\*\*\*", raw)
    e = re.search(r"\*\*\*\s*END OF|End of (the )?Project Gutenberg|End of Project Gutenberg", raw)
    raw = raw[m.end(): e.start() if e else len(raw)]
    raw = re.sub(r"(?is)^.*?</p>", "", raw, count=1) if raw.lstrip().startswith("</p>") else raw
    raw = re.sub(r"(?is)<h3>\s*E-text prepared.*?</h3>", "", raw)
    raw = re.sub(r"(?s)^\s*Produced by.{0,400}?\)\.?", "", raw)
    imgdir = os.path.join(os.path.dirname(path))
    root = parse(raw)
    content = render(root, {"id": bid, "images": True, "image": lambda src: images(os.path.join(imgdir, src))})
    content = re.sub(r"(?s)<h6>.*?</h6>", "", content)
    content = re.sub(r"\n\s*\n+", "\n", content)
    content = re.sub(r"<h2>\s*BEATRIX POTTER\s*</h2>|<h3>[^<]*(FREDERICK WARNE|BY|With drawings by)[^<]*</h3>", "", content)
    if opts.get("drop_before"): content = re.sub(opts["drop_before"], "", content, count=1)
    if opts.get("drop_after"):
        m = re.search(opts["drop_after"], content)
        if m: content = content[:m.start()]
    content = re.sub(r"(?s)<h3>[^<]*(This eBook is courtesy|E-text prepared)[^<]*</h3>", "", content)
    if opts.get("split"):
        ms = list(re.finditer(opts["split"], content))
        out = []
        for i, m in enumerate(ms):
            end = ms[i + 1].start() if i + 1 < len(ms) else len(content)
            label = m.group(1).strip()
            sub = (m.group(2) or "").strip().title() if m.lastindex and m.lastindex >= 2 else ""
            sub = re.sub(r"(?<=\s)(The|A|An|Of|And|Some|To|In|On)(?=\s)", lambda w: w.group(1).lower(), sub)
            title = (f"Chapter {label}" if re.fullmatch(r"[IVX]+", label) else label.title()) + (f": {sub}" if sub else "")
            out.append([title, f"<h2>{html.escape(title)}</h2>" + content[m.end():end]])
        return out
    if opts.get("parts"):
        paras = re.split(r"(?=<p>)", content)
        n = opts["parts"]; total = sum(words_of(p) for p in paras); out = []; cur = ""; acc = 0
        for p in paras:
            cur += p; acc += words_of(p)
            if acc >= total * (len(out) + 1) / n and len(out) < n - 1:
                out.append(cur); cur = ""
        out.append(cur)
        return [[f"Part {i + 1}", c] for i, c in enumerate(out) if words_of(c) > 0]
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
    ap = argparse.ArgumentParser(); ap.add_argument("--src", required=True); ap.add_argument("--only")
    ap.add_argument("--new-only", action="store_true", help="keep books already built; only build ones with no output yet")
    a = ap.parse_args()
    catalog = []
    for bid, title, author, kind, repo, opts in BOOKS:
        if a.only and a.only != str(bid): continue
        outdir = os.path.join(OUT, str(bid))
        key = bid if isinstance(bid, str) else None
        if a.new_only and os.path.exists(os.path.join(outdir, "index.json")):
            idx = json.load(open(os.path.join(outdir, "index.json"), encoding="utf-8"))
            catalog.append({"bookId": 0 if key else bid, "key": key, "title": title, "author": author, "chapters": len(idx["chapters"]), "words": idx["words"], "pictures": idx.get("pictures", 0)})
            continue
        d = git(repo, a.src)
        if os.path.isdir(outdir):
            for f in os.listdir(outdir):
                p = os.path.join(outdir, f)
                if os.path.isfile(p): os.remove(p)
        os.makedirs(outdir, exist_ok=True)
        done = set()
        if kind == SE: chapters = build_se(bid, d, opts)
        elif kind == TXT: chapters = build_txt(bid, d, opts)
        else: chapters = build_html(bid, d, opts, lambda p: convert_image(p, os.path.join(outdir, "img"), done))
        for pat in opts.get("strip", ()):  # passages left out on purpose (see the comment on each book)
            hit = [bool(re.search(pat, c, re.S)) for _, c in chapters]
            assert any(hit), (bid, "strip pattern matched nothing", pat)
            chapters = [[t, re.sub(pat, "", c, flags=re.S)] for t, c in chapters]
        for old, new in opts.get("replace", ()):  # a dated slur swapped for a plain word (see the comment on each book)
            assert any(old in c for _, c in chapters), (bid, "replace text not found", old)
            chapters = [[t.replace(old, new), c.replace(old, new)] for t, c in chapters]
        toc = []
        for i, (t, c) in enumerate(chapters, 1):
            assert "<script" not in c.lower() and "gutenberg" not in c.lower(), (bid, t)
            open(os.path.join(outdir, f"{i}.html"), "w", encoding="utf-8").write(c)
            toc.append({"title": t, "words": words_of(c)})
        total = sum(c["words"] for c in toc)
        json.dump({"id": bid, "title": title, "author": author, "chapters": toc, "words": total, "pictures": len(done)}, open(os.path.join(outdir, "index.json"), "w"), ensure_ascii=False)
        catalog.append({"bookId": 0 if key else bid, "key": key, "title": title, "author": author, "chapters": len(toc), "words": total, "pictures": len(done)})
        print(f"{str(bid):>3} {title[:40]:40} {len(toc):>3} ch {total:>7} words {len(done)} pics", flush=True)
    if not a.only:
        ts = "// Generated by script/build_reads.py. Do not edit by hand.\n"
        ts += "// Public-domain books that can be read right on Arise (files in client/public/reads/<bookId or key>/).\n"
        ts += "// Books with a key get their library book id at runtime (server/readsSync.ts) through setReadsKeyIds().\n\n"
        ts += "export type ReadableBook = { bookId: number; key: string | null; title: string; author: string; chapters: number; words: number; pictures: number };\n\n"
        ts += "export const READABLE_BOOKS: ReadableBook[] = " + json.dumps(catalog, ensure_ascii=False, indent=2) + ";\n\n"
        ts += "let keyIds: Record<string, number> = {};\n"
        ts += "/** Fills in library book ids for keyed books (from /api/reads/books). */\n"
        ts += "export function setReadsKeyIds(map: Record<string, number>) { keyIds = { ...map }; for (const b of READABLE_BOOKS) if (b.key && map[b.key]) b.bookId = Number(map[b.key]); }\n"
        ts += "/** Where a book's files live: its key, or its book id. */\n"
        ts += "export const readsDir = (b: ReadableBook) => b.key ?? String(b.bookId);\n"
        ts += "export const readableBook = (bookId: number | string | null | undefined) => READABLE_BOOKS.find((b) => (b.bookId > 0 && b.bookId === Number(bookId)) || (b.key !== null && b.key === bookId) || (b.key !== null && keyIds[b.key] === Number(bookId))) ?? null;\n"
        ts += "/** Minutes to read at about 200 words a minute. */\nexport const readMinutes = (words: number) => Math.max(1, Math.round(words / 200));\n"
        open(os.path.join(ROOT, "shared/readsCatalog.ts"), "w").write(ts)


if __name__ == "__main__":
    main()
