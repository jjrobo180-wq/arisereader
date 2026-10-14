#!/usr/bin/env python3
"""Builds the Book Store's adult classics from Standard Ebooks (public domain, CC0 source).

Uses the same cleaning as the kids' "Read on Arise" shelf (script/build_reads.py). Output (committed):
  client/public/classics/<slug>/index.json   contents + word counts
  client/public/classics/<slug>/<n>.html     one sanitized chapter per file
  shared/classicsCatalog.ts                  generated catalog for the app

Every text is screened for racial slurs; books built on them are left out of the list below
(Huckleberry Finn, Heart of Darkness, Lovecraft), and the screen fails the build if one slips in.

Run:  python3 script/build_classics.py --src /path/to/cache [--only slug]
"""
import argparse, importlib.util, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("build_reads", os.path.join(HERE, "build_reads.py"))
br = importlib.util.module_from_spec(spec); spec.loader.exec_module(br)  # type: ignore

ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "client/public/classics")

# slug, title, author, year, genre, repo, blurb
BOOKS = [
    # Romance & society
    ("pride-and-prejudice", "Pride and Prejudice", "Jane Austen", 1813, "Romance", "jane-austen_pride-and-prejudice", "Elizabeth Bennet and the proud Mr. Darcy misjudge each other at every turn in the wittiest courtship in English fiction."),
    ("sense-and-sensibility", "Sense and Sensibility", "Jane Austen", 1811, "Romance", "jane-austen_sense-and-sensibility", "Two sisters, one ruled by her head and one by her heart, face love, money and heartbreak after their family loses its home."),
    ("emma", "Emma", "Jane Austen", 1815, "Romance", "jane-austen_emma", "Clever, rich and sure she knows best, Emma Woodhouse plays matchmaker for everyone but herself."),
    ("persuasion", "Persuasion", "Jane Austen", 1817, "Romance", "jane-austen_persuasion", "Eight years after she was talked out of marrying him, Anne Elliot meets Captain Wentworth again. A quiet, aching second chance."),
    ("northanger-abbey", "Northanger Abbey", "Jane Austen", 1817, "Romance", "jane-austen_northanger-abbey", "A young reader of gothic novels visits a real abbey and lets her imagination run away with her. Austen at her most playful."),
    ("jane-eyre", "Jane Eyre", "Charlotte Brontë", 1847, "Romance", "charlotte-bronte_jane-eyre", "An orphaned governess with a fierce sense of her own worth falls for her brooding employer at Thornfield Hall, a house with a secret."),
    ("wuthering-heights", "Wuthering Heights", "Emily Brontë", 1847, "Romance", "emily-bronte_wuthering-heights", "On the wild Yorkshire moors, the love between Catherine and Heathcliff turns to obsession and revenge across two generations."),
    ("north-and-south", "North and South", "Elizabeth Gaskell", 1855, "Romance", "elizabeth-gaskell_north-and-south", "A minister's daughter from the gentle south clashes with a hard-driving mill owner in an industrial northern town."),
    ("a-room-with-a-view", "A Room with a View", "E. M. Forster", 1908, "Romance", "e-m-forster_a-room-with-a-view", "On holiday in Florence, a sheltered young Englishwoman must choose between a proper fiancé and the man who makes her feel alive."),
    ("the-age-of-innocence", "The Age of Innocence", "Edith Wharton", 1920, "Romance", "edith-wharton_the-age-of-innocence", "In gilded 1870s New York, an engaged young lawyer falls for his fiancée's unconventional cousin. Winner of the Pulitzer Prize."),
    ("the-house-of-mirth", "The House of Mirth", "Edith Wharton", 1905, "Romance", "edith-wharton_the-house-of-mirth", "Beautiful, charming and running out of money, Lily Bart searches for a husband in a high society that punishes every misstep."),
    ("the-blue-castle", "The Blue Castle", "L. M. Montgomery", 1926, "Romance", "l-m-montgomery_the-blue-castle", "Told she has a year to live, timid Valancy Stirling stops pleasing her family and starts living. Montgomery's funniest book for grown-ups."),
    ("the-awakening", "The Awakening", "Kate Chopin", 1899, "Romance", "kate-chopin_the-awakening", "On a summer holiday on the Gulf Coast, a young wife and mother awakens to her own desires and refuses to go back to sleep."),
    ("madame-bovary", "Madame Bovary", "Gustave Flaubert", 1856, "Romance", "gustave-flaubert_madame-bovary_eleanor-marx-aveling", "A country doctor's wife, raised on romantic novels, chases the life she has read about, whatever it costs."),
    ("anna-karenina", "Anna Karenina", "Leo Tolstoy", 1878, "Romance", "leo-tolstoy_anna-karenina_constance-garnett", "A married woman's love affair sets her against all of Russian society, while a landowner searches for meaning in work and family."),
    ("tess-of-the-durbervilles", "Tess of the d'Urbervilles", "Thomas Hardy", 1891, "Romance", "thomas-hardy_tess-of-the-durbervilles", "A poor country girl's life is upended when her family learns it descends from nobility. Hardy's most heartbreaking novel."),
    # Literary classics
    ("great-expectations", "Great Expectations", "Charles Dickens", 1861, "Classics", "charles-dickens_great-expectations", "Orphan Pip is lifted from the marshes by a mysterious fortune, and learns who his true friends are the hard way."),
    ("a-tale-of-two-cities", "A Tale of Two Cities", "Charles Dickens", 1859, "Classics", "charles-dickens_a-tale-of-two-cities", "London and Paris during the French Revolution: a story of love, sacrifice and resurrection that begins with the best of times."),
    ("oliver-twist", "Oliver Twist", "Charles Dickens", 1838, "Classics", "charles-dickens_oliver-twist", "A workhouse orphan who dares to ask for more falls in with the Artful Dodger and Fagin's gang of London pickpockets."),
    ("moby-dick", "Moby-Dick", "Herman Melville", 1851, "Classics", "herman-melville_moby-dick", "Call him Ishmael. He signs on to a whaling ship whose captain will chase the white whale that took his leg to the ends of the earth."),
    ("the-great-gatsby", "The Great Gatsby", "F. Scott Fitzgerald", 1925, "Classics", "f-scott-fitzgerald_the-great-gatsby", "Jay Gatsby throws dazzling parties on Long Island for one guest who never comes: Daisy, the love he lost. The great American novel."),
    ("this-side-of-paradise", "This Side of Paradise", "F. Scott Fitzgerald", 1920, "Classics", "f-scott-fitzgerald_this-side-of-paradise", "Fitzgerald's first novel follows a vain, gifted young man from Princeton to the end of the First World War."),
    ("the-sun-also-rises", "The Sun Also Rises", "Ernest Hemingway", 1926, "Classics", "ernest-hemingway_the-sun-also-rises", "American and British expatriates drift from the cafés of Paris to the bullfights of Pamplona in Hemingway's first great novel."),
    ("mrs-dalloway", "Mrs. Dalloway", "Virginia Woolf", 1925, "Classics", "virginia-woolf_mrs-dalloway", "One June day in London as Clarissa Dalloway prepares for a party, told from inside the minds of the people she passes."),
    ("main-street", "Main Street", "Sinclair Lewis", 1920, "Classics", "sinclair-lewis_main-street", "A bright young woman marries a small-town doctor and sets out to reform Gopher Prairie, Minnesota. It does not want reforming."),
    ("my-antonia", "My Ántonia", "Willa Cather", 1918, "Classics", "willa-cather_my-antonia", "A man remembers growing up on the Nebraska prairie and the immigrant girl who embodied the spirit of the land."),
    ("ethan-frome", "Ethan Frome", "Edith Wharton", 1911, "Classics", "edith-wharton_ethan-frome", "In a frozen New England village, a lonely farmer, his sickly wife and her young cousin are bound together in a short, haunting tragedy."),
    ("the-scarlet-letter", "The Scarlet Letter", "Nathaniel Hawthorne", 1850, "Classics", "nathaniel-hawthorne_the-scarlet-letter", "In Puritan Boston, Hester Prynne wears a scarlet A for adultery and refuses to name the father of her child."),
    ("crime-and-punishment", "Crime and Punishment", "Fyodor Dostoevsky", 1866, "Classics", "fyodor-dostoevsky_crime-and-punishment_constance-garnett", "A poor student in St. Petersburg commits a murder to prove a theory, then is hunted by his own conscience and a patient detective."),
    ("the-red-badge-of-courage", "The Red Badge of Courage", "Stephen Crane", 1895, "Classics", "stephen-crane_the-red-badge-of-courage", "A young Union soldier dreams of glory, then flees his first battle, and must learn what courage really is."),
    ("the-jungle", "The Jungle", "Upton Sinclair", 1906, "Classics", "upton-sinclair_the-jungle", "A Lithuanian immigrant family is crushed by Chicago's meatpacking plants. The novel that changed America's food laws."),
    ("lord-jim", "Lord Jim", "Joseph Conrad", 1900, "Classics", "joseph-conrad_lord-jim", "A young officer who abandoned a sinking ship spends his life trying to make up for one moment of cowardice."),
    ("the-warden", "The Warden", "Anthony Trollope", 1855, "Classics", "anthony-trollope_the-warden", "A gentle clergyman's comfortable post becomes a newspaper scandal in this short, warm first novel of Barsetshire."),
    # Mystery & suspense
    ("the-mysterious-affair-at-styles", "The Mysterious Affair at Styles", "Agatha Christie", 1920, "Mystery", "agatha-christie_the-mysterious-affair-at-styles", "Hercule Poirot's first case: a wealthy woman is poisoned at a country house, and everyone in it has a reason."),
    ("a-study-in-scarlet", "A Study in Scarlet", "Arthur Conan Doyle", 1887, "Mystery", "arthur-conan-doyle_a-study-in-scarlet", "Dr. Watson meets Sherlock Holmes, and the two take their first case: a body in an empty house and a word written in blood."),
    ("the-sign-of-the-four", "The Sign of the Four", "Arthur Conan Doyle", 1890, "Mystery", "arthur-conan-doyle_the-sign-of-the-four", "A young woman receives a pearl every year from an unknown sender, and Holmes follows the trail to a stolen treasure."),
    ("the-moonstone", "The Moonstone", "Wilkie Collins", 1868, "Mystery", "wilkie-collins_the-moonstone", "A cursed diamond vanishes from a Yorkshire country house on the night of a birthday party. Often called the first English detective novel."),
    ("the-woman-in-white", "The Woman in White", "Wilkie Collins", 1859, "Mystery", "wilkie-collins_the-woman-in-white", "A drawing teacher meets a mysterious woman in white on a moonlit road and is drawn into a conspiracy of stolen identity."),
    ("the-thirty-nine-steps", "The Thirty-Nine Steps", "John Buchan", 1915, "Mystery", "john-buchan_the-thirty-nine-steps", "Richard Hannay finds a murdered spy in his London flat and races across Scotland with the police and enemy agents on his heels."),
    ("greenmantle", "Greenmantle", "John Buchan", 1916, "Mystery", "john-buchan_greenmantle", "Richard Hannay goes undercover across wartime Europe to Constantinople to stop a plot that could change the war."),
    ("the-innocence-of-father-brown", "The Innocence of Father Brown", "G. K. Chesterton", 1911, "Mystery", "g-k-chesterton_the-innocence-of-father-brown", "A mild little priest solves impossible crimes by understanding the human heart. Twelve clever stories."),
    # Adventure
    ("the-count-of-monte-cristo", "The Count of Monte Cristo", "Alexandre Dumas", 1844, "Adventure", "alexandre-dumas_the-count-of-monte-cristo_chapman-and-hall", "Wrongly imprisoned for fourteen years, Edmond Dantès escapes, finds a buried fortune and returns as a mysterious count bent on revenge."),
    ("the-three-musketeers", "The Three Musketeers", "Alexandre Dumas", 1844, "Adventure", "alexandre-dumas_the-three-musketeers_william-robson", "Young d'Artagnan joins Athos, Porthos and Aramis in duels, intrigue and royal scandal. All for one, one for all."),
    ("the-scarlet-pimpernel", "The Scarlet Pimpernel", "Baroness Orczy", 1905, "Adventure", "baroness-orczy_the-scarlet-pimpernel", "A daring Englishman rescues French aristocrats from the guillotine, hiding behind the mask of a foolish dandy."),
    ("captain-blood", "Captain Blood", "Rafael Sabatini", 1922, "Adventure", "rafael-sabatini_captain-blood", "A doctor wrongly sold into slavery in the Caribbean escapes to become the most daring pirate captain on the Spanish Main."),
    ("around-the-world-in-eighty-days", "Around the World in Eighty Days", "Jules Verne", 1873, "Adventure", "jules-verne_around-the-world-in-eighty-days_george-makepeace-towle", "Phileas Fogg bets his fortune he can circle the globe in eighty days, with his valet Passepartout and a detective on his trail."),
    ("the-call-of-the-wild", "The Call of the Wild", "Jack London", 1903, "Adventure", "jack-london_the-call-of-the-wild", "Buck, a pampered California dog, is stolen and sold as a sled dog in the Klondike gold rush, where the wild calls him home."),
    ("the-sea-wolf", "The Sea Wolf", "Jack London", 1904, "Adventure", "jack-london_the-sea-wolf", "A shipwrecked writer is pulled aboard a sealing schooner ruled by the brutal, brilliant Captain Wolf Larsen."),
    ("a-princess-of-mars", "A Princess of Mars", "Edgar Rice Burroughs", 1912, "Adventure", "edgar-rice-burroughs_a-princess-of-mars", "Civil War veteran John Carter wakes up on Mars, where he fights giant green warriors and falls for a Martian princess."),
    # Horror & gothic
    ("dracula", "Dracula", "Bram Stoker", 1897, "Horror", "bram-stoker_dracula", "A young lawyer travels to Transylvania to help a count buy a house in England. Told in letters and diaries, the original vampire novel."),
    ("the-picture-of-dorian-gray", "The Picture of Dorian Gray", "Oscar Wilde", 1890, "Horror", "oscar-wilde_the-picture-of-dorian-gray", "A beautiful young man wishes his portrait would age instead of him. His wish comes true, and the painting records every sin."),
    ("the-turn-of-the-screw", "The Turn of the Screw", "Henry James", 1898, "Horror", "henry-james_the-turn-of-the-screw", "A governess at a lonely country house becomes convinced that ghosts are after the two children in her care."),
    ("the-king-in-yellow", "The King in Yellow", "Robert W. Chambers", 1895, "Horror", "robert-w-chambers_the-king-in-yellow", "Strange stories linked by a forbidden play that drives its readers mad. A cult classic of weird fiction."),
    ("poe-short-fiction", "Tales of Mystery and Terror", "Edgar Allan Poe", 1845, "Horror", "edgar-allan-poe_short-fiction", "The Tell-Tale Heart, The Fall of the House of Usher, The Murders in the Rue Morgue and the rest of Poe's stories."),
    # Science fiction
    ("the-time-machine", "The Time Machine", "H. G. Wells", 1895, "Sci-Fi", "h-g-wells_the-time-machine", "A Victorian inventor travels to the year 802,701 and finds humanity split into two very different races."),
    ("the-invisible-man", "The Invisible Man", "H. G. Wells", 1897, "Sci-Fi", "h-g-wells_the-invisible-man", "A bandaged stranger arrives at a country inn in winter. He is a scientist who has made himself invisible and cannot undo it."),
    ("the-island-of-doctor-moreau", "The Island of Doctor Moreau", "H. G. Wells", 1896, "Sci-Fi", "h-g-wells_the-island-of-doctor-moreau", "A shipwreck survivor lands on a remote island where an exiled scientist is turning animals into people."),
    ("herland", "Herland", "Charlotte Perkins Gilman", 1915, "Sci-Fi", "charlotte-perkins-gilman_herland", "Three American explorers find a hidden country of women who have lived without men for two thousand years."),
    # Short stories
    ("o-henry-short-fiction", "The Best of O. Henry", "O. Henry", 1910, "Short Stories", "o-henry_short-fiction", "The Gift of the Magi, The Ransom of Red Chief and hundreds more stories famous for their twist endings."),
    ("chekhov-short-fiction", "Stories by Anton Chekhov", "Anton Chekhov", 1900, "Short Stories", "anton-chekhov_short-fiction_constance-garnett", "The Lady with the Dog and other quietly perfect stories of ordinary Russian lives from the master of the short story."),
    # Plays
    ("hamlet", "Hamlet", "William Shakespeare", 1603, "Plays", "william-shakespeare_hamlet", "The prince of Denmark learns from his father's ghost that his uncle murdered the king. To be, or not to be."),
    ("macbeth", "Macbeth", "William Shakespeare", 1623, "Plays", "william-shakespeare_macbeth", "Three witches tell a Scottish general he will be king, and he and his wife will do anything to make it true."),
    ("romeo-and-juliet", "Romeo and Juliet", "William Shakespeare", 1597, "Plays", "william-shakespeare_romeo-and-juliet", "Two young lovers from feuding families in Verona marry in secret, with tragic results."),
    ("a-midsummer-nights-dream", "A Midsummer Night's Dream", "William Shakespeare", 1600, "Plays", "william-shakespeare_a-midsummer-nights-dream", "Lovers, fairies and a troupe of amateur actors get tangled up one magical night in an Athenian wood."),
    ("the-importance-of-being-earnest", "The Importance of Being Earnest", "Oscar Wilde", 1895, "Plays", "oscar-wilde_the-importance-of-being-earnest", "Two young gentlemen invent fake identities to escape their obligations. Wilde's sparkling comedy of manners."),
    # Humor
    ("right-ho-jeeves", "Right Ho, Jeeves", "P. G. Wodehouse", 1934, "Humor", "p-g-wodehouse_right-ho-jeeves", "Bertie Wooster tries to fix his friends' romances without his brilliant valet Jeeves. It goes very, very wrong."),
    # Ideas & lives
    ("walden", "Walden", "Henry David Thoreau", 1854, "Nonfiction", "henry-david-thoreau_walden", "Thoreau's account of two years living simply in a cabin he built by Walden Pond, and what he learned there."),
    ("meditations", "Meditations", "Marcus Aurelius", 180, "Nonfiction", "marcus-aurelius_meditations_george-long", "The private notes of a Roman emperor on how to live well, stay calm and do one's duty. Still read every day."),
    ("the-art-of-war", "The Art of War", "Sun Tzu", -500, "Nonfiction", "sun-tzu_the-art-of-war_lionel-giles", "The ancient Chinese classic on strategy, used by generals, coaches and business leaders for 2,500 years."),
    ("the-prince", "The Prince", "Niccolò Machiavelli", 1532, "Nonfiction", "niccolo-machiavelli_the-prince_w-k-marriott", "A frank Renaissance guide to gaining and holding power, and one of the most argued-over books ever written."),
    ("emerson-essays", "Essays", "Ralph Waldo Emerson", 1841, "Nonfiction", "ralph-waldo-emerson_essays", "Self-Reliance, The Over-Soul, Friendship and Emerson's other great essays on trusting yourself."),
    ("autobiography-of-benjamin-franklin", "The Autobiography of Benjamin Franklin", "Benjamin Franklin", 1791, "Nonfiction", "benjamin-franklin_the-autobiography-of-benjamin-franklin", "Printer, inventor, diplomat: Franklin tells how a runaway apprentice became one of the most famous men in the world."),
    ("narrative-of-frederick-douglass", "Narrative of the Life of Frederick Douglass", "Frederick Douglass", 1845, "Nonfiction", "frederick-douglass_narrative-of-the-life-of-frederick-douglass", "Douglass's own account of his life in slavery, learning to read, and his escape to freedom. A landmark of American history."),
    ("up-from-slavery", "Up from Slavery", "Booker T. Washington", 1901, "Nonfiction", "booker-t-washington_up-from-slavery", "Born into slavery, Booker T. Washington tells how he worked his way to an education and founded the Tuskegee Institute."),
    ("the-souls-of-black-folk", "The Souls of Black Folk", "W. E. B. Du Bois", 1903, "Nonfiction", "w-e-b-du-bois_the-souls-of-black-folk", "Du Bois's essays on Black life in America after emancipation, and the idea of double consciousness."),
]

# Slurs screen. Old books use "chink" for a crack and "coon" for a raccoon, so only unambiguous slurs are
# counted. A book that leans on them is left out; a book with a rare one keeps the passage with the word
# masked ("n——"), the way the kids' shelf swaps a dated word. Historical accounts of slavery by Black
# authors (Douglass, Washington, Du Bois) quote enslavers and are kept, masked the same way.
SLURS = re.compile(r"\b(nigger|niggers|nigga|darkey|darkeys|darkies|darky|pickaninn\w*|kike|kikes|injun|injuns)\b", re.I)
MAX_SLURS = 6
QUOTED_HISTORY = {"narrative-of-frederick-douglass", "up-from-slavery", "the-souls-of-black-folk"}
mask = lambda m: m.group(0)[0] + "——"


def drama(text):
    """Standard Ebooks sets plays as tables: a persona cell and a lines cell per row. Keep the speaker."""
    if "z3998:persona" not in text and "<table" not in text:
        return text
    text = re.sub(r'<td[^>]*epub:type="z3998:persona"[^>]*>(.*?)</td>', r"<b>\1.</b> ", text, flags=re.S)
    text = re.sub(r"<tr[^>]*>", "<p>", text)
    text = text.replace("</tr>", "</p>")
    text = re.sub(r"</?(table|tbody|thead|td|colgroup|col)[^>]*>", "", text)
    return text


def build(d):
    real_open = open
    def patched(path, *a, **k):
        f = real_open(path, *a, **k)
        if str(path).endswith(".xhtml") and "/text/" in str(path):
            data = drama(f.read()); f.close()
            import io
            return io.StringIO(data)
        return f
    br.open = patched  # build_se reads chapters with the module's open()
    try:
        return br.build_se("x", d, {})
    finally:
        br.open = real_open


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--src", required=True); ap.add_argument("--only")
    a = ap.parse_args()
    catalog = []
    for slug, title, author, year, genre, repo, blurb in BOOKS:
        outdir = os.path.join(OUT, slug)
        if a.only and a.only != slug:
            if os.path.exists(os.path.join(outdir, "index.json")):
                idx = json.load(open(os.path.join(outdir, "index.json"), encoding="utf-8"))
                catalog.append({"slug": slug, "title": title, "author": author, "year": year, "genre": genre, "blurb": blurb, "chapters": len(idx["chapters"]), "words": idx["words"]})
            continue
        d = br.git("standardebooks/" + repo, a.src)
        chapters = build(d)
        joined = " ".join(c for _, c in chapters)
        hits = SLURS.findall(joined)
        if len(hits) > MAX_SLURS and slug not in QUOTED_HISTORY:
            print(f"SKIPPED {slug}: {len(hits)} slurs {sorted(set(h.lower() for h in hits))}", flush=True)
            continue
        if hits: print(f"  masked {len(hits)} in {slug}", flush=True)
        chapters = [[SLURS.sub(mask, t), SLURS.sub(mask, c)] for t, c in chapters]
        if os.path.isdir(outdir):
            for f in os.listdir(outdir): os.remove(os.path.join(outdir, f))
        os.makedirs(outdir, exist_ok=True)
        toc = []
        for i, (t, c) in enumerate(chapters, 1):
            c = c.replace('src="/reads/x/', 'src="/classics/' + slug + '/')
            c = re.sub(r"[ \t]*\n\s*", "\n", c).strip()  # the source's indentation, not needed to read
            assert "<script" not in c.lower() and "gutenberg" not in c.lower(), (slug, t)
            open(os.path.join(outdir, f"{i}.html"), "w", encoding="utf-8").write(c)
            toc.append({"title": t, "words": br.words_of(c)})
        total = sum(c["words"] for c in toc)
        json.dump({"slug": slug, "title": title, "author": author, "chapters": toc, "words": total}, open(os.path.join(outdir, "index.json"), "w"), ensure_ascii=False)
        catalog.append({"slug": slug, "title": title, "author": author, "year": year, "genre": genre, "blurb": blurb, "chapters": len(toc), "words": total})
        print(f"{slug[:34]:34} {len(toc):>4} ch {total:>7} words", flush=True)
    ts = "// Generated by script/build_classics.py. Do not edit by hand.\n"
    ts += "// Public-domain books for adults in the Book Store (files in client/public/classics/<slug>/), from Standard Ebooks.\n\n"
    ts += "export type ClassicBook = { slug: string; title: string; author: string; year: number; genre: string; blurb: string; chapters: number; words: number };\n\n"
    ts += "export const CLASSIC_BOOKS: ClassicBook[] = " + json.dumps(catalog, ensure_ascii=False, indent=2) + ";\n"
    open(os.path.join(ROOT, "shared/classicsCatalog.ts"), "w", encoding="utf-8").write(ts)
    print(len(catalog), "books")


if __name__ == "__main__":
    main()
