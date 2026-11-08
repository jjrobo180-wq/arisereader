"""Fills in A.R.I.S.E. Reader's App Store listing through the App Store Connect API: category, privacy and
support links, the App Store text, the age rating answers, free in every country, the App Review sign-in
(the sample account) and the screenshots in store-shots/. Run by app-store-fill.yml. Leaves alone anything
that only the App Store Connect website can set (app privacy answers, agreements).
Env: DEMO_USER, DEMO_PASS, CONTACT_FIRST, CONTACT_LAST, CONTACT_PHONE, CONTACT_EMAIL (contact is optional).
"""
import glob
import hashlib
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from apple_signing import token  # noqa: E402

AUTH = token()
BUNDLE = "com.arisereader.reader"


def api(path, body=None, method=None):
    url = path if path.startswith("https://") else "https://api.appstoreconnect.apple.com/v1/" + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method or ("POST" if body is not None else "GET"),
                                 headers={"Authorization": "Bearer " + AUTH, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        text = e.read().decode(errors="replace")
        raise RuntimeError(f"{e.code} {method or 'GET'} {path.split('?')[0]}: {text[:600]}")


def q(path, **params):
    return api(path + ("?" + urllib.parse.urlencode(params) if params else ""))


def step(what, fn):
    try:
        fn(); print(f"ok   {what}")
    except Exception as e:  # keep going: report each part
        print(f"FAIL {what}: {e}")


DESCRIPTION = """A.R.I.S.E. Reader makes reading the best part of a child's day. Read a book, take a short quiz about it, and earn points, badges and streaks for every book finished.

READ AND QUIZ
- Quizzes for the books kids are already reading, at their level
- Read-aloud help, a dictionary and notes right inside the book
- A reading journey that grows with every book

REWARDS THAT MATTER
- Points, badges and daily streaks
- Prizes set by the teachers and parents who know them, not just points
- Certificates to celebrate milestones

GAMES AND WORLDS
- A whole arcade of learning games and worlds to explore with points earned from reading
- Build an avatar and a world of their own

FOR CLASSROOMS
- Teachers see who read, what they read and how they did
- Live class games, messages from the teacher and class goals

FOR EVERY KIND OF READER
- Eye Gazer for readers who talk with their eyes
- Big, clear buttons, read-aloud and calm colors

PLANS
- Families: $7 a month for a parent and up to 3 children
- Teachers: $20 a month for up to 99 students
- Schools: $100 a month for every teacher and student
Every plan includes A.R.I.S.E. Math, History and Connect. Plans are bought on arisereader.com.

Built by a teacher. Notifications let students know when their teacher sends a message, and a daily reminder keeps the reading streak going."""
KEYWORDS = "reading,books,quiz,kids,students,teacher,classroom,literacy,AR,rewards,library,read aloud"
PROMO = "Read, quiz, earn rewards. Reading quizzes, badges and games for kids, families and classrooms."
SUBTITLE = "Reading quizzes and rewards"

demo_user, demo_pass = os.environ.get("DEMO_USER", ""), os.environ.get("DEMO_PASS", "")
app = q("apps", **{"filter[bundleId]": BUNDLE})["data"][0]
APP = app["id"]
infos = q(f"apps/{APP}/appInfos")["data"]
info = next((i for i in infos if i["attributes"].get("appStoreState") != "READY_FOR_SALE"), infos[0])

# Category: Education (and Books second).
step("category: Education, then Books", lambda: api(f"appInfos/{info['id']}", {"data": {"type": "appInfos", "id": info["id"], "relationships": {
    "primaryCategory": {"data": {"type": "appCategories", "id": "EDUCATION"}}, "secondaryCategory": {"data": {"type": "appCategories", "id": "BOOKS"}}}}}, method="PATCH"))

# Name, subtitle, privacy policy.
for loc in q(f"appInfos/{info['id']}/appInfoLocalizations")["data"]:
    step(f"subtitle and privacy link ({loc['attributes']['locale']})", lambda loc=loc: api(f"appInfoLocalizations/{loc['id']}", {"data": {"type": "appInfoLocalizations", "id": loc["id"], "attributes": {
        "subtitle": SUBTITLE, "privacyPolicyUrl": "https://arisetodo.com/privacy/"}}}, method="PATCH"))

# Age rating: a reading app for all ages. Students and their teachers can message each other in a class.
def age():
    decl = q(f"appInfos/{info['id']}/ageRatingDeclaration")["data"]
    attrs = {}
    BOOLS = {"advertising", "gambling", "healthOrWellnessTopics", "lootBox", "messagingAndChat", "parentalControls", "ageAssurance",
             "unrestrictedWebAccess", "userGeneratedContent", "seventeenPlus"}
    for k, v in decl["attributes"].items():
        low = k.lower()
        if k in ("kidsAgeBand",) or any(w in low for w in ("url", "uri", "override", "grac", "classification", "korea")):
            continue  # links, rating overrides and Korea's rating number are left as they are (none)
        if k in BOOLS or isinstance(v, bool):
            attrs[k] = k == "messagingAndChat"
        else:
            attrs[k] = "NONE"
    # Apple adds questions over time: one sent with the wrong type is corrected from its answer and sent again.
    for _ in range(12):
        try:
            api(f"ageRatingDeclarations/{decl['id']}", {"data": {"type": "ageRatingDeclarations", "id": decl["id"], "attributes": attrs}}, method="PATCH")
            print("     answers: " + ", ".join(f"{k}={v}" for k, v in sorted(attrs.items())))
            return
        except RuntimeError as e:
            import re
            m = re.search(r"attribute '(\w+)'. Expected a (\w+)", str(e))
            if m:
                attrs[m.group(1)] = False if m.group(2) == "BOOLEAN" else "NONE"
                continue
            # A value Apple won't take at all (a link field, say): that question is left out.
            p = re.search(r'"pointer"\s*:\s*"/data/attributes/(\w+)"', str(e))
            if p and p.group(1) in attrs:
                print(f"    leaving out {p.group(1)}: {str(e)[:160]}")
                attrs.pop(p.group(1))
                continue
            raise
    raise RuntimeError("age rating: too many corrections")
step("age rating answers (4+: no mature content; teacher and student messages)", age)

# The version's App Store text.
version = next((v for v in q(f"apps/{APP}/appStoreVersions", **{"filter[platform]": "IOS"})["data"] if v["attributes"]["appStoreState"] == "PREPARE_FOR_SUBMISSION"), None)
if not version:
    sys.exit("No version waiting to be submitted.")
VID = version["id"]
step("copyright", lambda: api(f"appStoreVersions/{VID}", {"data": {"type": "appStoreVersions", "id": VID, "attributes": {"copyright": "2026 A.R.I.S.E. Reader"}}}, method="PATCH"))
vlocs = q(f"appStoreVersions/{VID}/appStoreVersionLocalizations")["data"]
for loc in vlocs:
    step(f"description, keywords, support link ({loc['attributes']['locale']})", lambda loc=loc: api(f"appStoreVersionLocalizations/{loc['id']}", {"data": {"type": "appStoreVersionLocalizations", "id": loc["id"], "attributes": {
        "description": DESCRIPTION, "keywords": KEYWORDS, "promotionalText": PROMO, "supportUrl": "https://arisetodo.com/support/", "marketingUrl": "https://arisereader.com/"}}}, method="PATCH"))

# Free, in every country.
def price():
    points = q(f"apps/{APP}/appPricePoints", **{"filter[territory]": "USA", "limit": 200})["data"]
    free = next((p["id"] for p in points if float(p["attributes"].get("customerPrice") or 0) == 0), None)
    if not free:
        raise RuntimeError("no free price point found")
    api("appPriceSchedules", {"data": {"type": "appPriceSchedules", "relationships": {
        "app": {"data": {"type": "apps", "id": APP}}, "baseTerritory": {"data": {"type": "territories", "id": "USA"}},
        "manualPrices": {"data": [{"type": "appPrices", "id": "${price1}"}]}}},
        "included": [{"type": "appPrices", "id": "${price1}", "attributes": {"startDate": None}, "relationships": {"appPricePoint": {"data": {"type": "appPricePoints", "id": free}}}}]})
step("price: free", price)
def availability():
    terr = []
    url = "territories?limit=200"
    while url:
        r = q(url) if not url.startswith("https://") else api(url)
        terr += [t["id"] for t in r["data"]]
        url = r.get("links", {}).get("next")
    refs = [f"${{t{i}}}" for i in range(len(terr))]
    # United States only: the app links to the website to buy a plan, which the US App Store allows.
    try:
        av = q(f"apps/{APP}/appAvailabilityV2")["data"]
    except RuntimeError:
        av = None
    if av:
        url = f"https://api.appstoreconnect.apple.com/v2/appAvailabilities/{av['id']}/territoryAvailabilities?limit=200&include=territory"
        changed = 0
        while url:
            r = api(url)
            for ta in r["data"]:
                t = ta["relationships"]["territory"]["data"]["id"]
                want = t == "USA"
                if ta["attributes"].get("available") != want:
                    api(f"territoryAvailabilities/{ta['id']}", {"data": {"type": "territoryAvailabilities", "id": ta["id"], "attributes": {"available": want}}}, method="PATCH")
                    changed += 1
            url = r.get("links", {}).get("next")
        print(f"     United States only ({changed} countries changed)")
        return
    terr = ["USA"]
    refs = ["${t0}"]
    api("https://api.appstoreconnect.apple.com/v2/appAvailabilities", {"data": {"type": "appAvailabilities", "attributes": {"availableInNewTerritories": False}, "relationships": {
        "app": {"data": {"type": "apps", "id": APP}}, "territoryAvailabilities": {"data": [{"type": "territoryAvailabilities", "id": r} for r in refs]}}},
        "included": [{"type": "territoryAvailabilities", "id": r, "attributes": {"available": True}, "relationships": {"territory": {"data": {"type": "territories", "id": t}}}} for r, t in zip(refs, terr)]})
step("available in the United States only", availability)

# Third-party content: public-domain books (Project Gutenberg, Standard Ebooks), openly licensed lessons
# (CC BY) and Open Library covers, all with the rights to use them.
step("content rights: third-party content, with the rights to it", lambda: api(f"apps/{APP}", {"data": {"type": "apps", "id": APP, "attributes": {"contentRightsDeclaration": "USES_THIRD_PARTY_CONTENT"}}}, method="PATCH"))

# The App Review contact: as given, or the one already saved on another of these apps.
def borrowed_contact():
    for other in q("apps", limit=50)["data"]:
        if other["id"] == APP:
            continue
        for v in q(f"apps/{other['id']}/appStoreVersions", limit=5)["data"]:
            try:
                rd = q(f"appStoreVersions/{v['id']}/appStoreReviewDetail")["data"]
            except RuntimeError:
                continue
            a = (rd or {}).get("attributes") or {}
            if a.get("contactPhone") and a.get("contactFirstName"):
                print(f"     contact found on {other['attributes']['name']}")
                return a
    return {}
# The contact's name: the App Store Connect team member with that email, when it isn't given.
if os.environ.get("CONTACT_EMAIL") and not os.environ.get("CONTACT_FIRST"):
    try:
        for u in q("users", limit=200)["data"]:
            a = u["attributes"]
            if (a.get("username") or "").lower() == os.environ["CONTACT_EMAIL"].lower() or (a.get("email") or "").lower() == os.environ["CONTACT_EMAIL"].lower():
                os.environ["CONTACT_FIRST"], os.environ["CONTACT_LAST"] = a.get("firstName") or "", a.get("lastName") or ""
                print(f"     contact name from the App Store Connect team: {a.get('firstName')} {a.get('lastName')}")
                break
        else:
            print("     no App Store Connect team member with that email")
    except RuntimeError as e:
        print(f"     team members can't be read: {str(e)[:200]}")
if not os.environ.get("CONTACT_PHONE"):
    found = borrowed_contact()
    for k, env in (("contactFirstName", "CONTACT_FIRST"), ("contactLastName", "CONTACT_LAST"), ("contactPhone", "CONTACT_PHONE"), ("contactEmail", "CONTACT_EMAIL")):
        if found.get(k) and not os.environ.get(env):
            os.environ[env] = found[k]
    if not found:
        print("     no App Review contact saved on any other app: a name and phone are still needed")

# App Review: the sample account, and the contact when given.
def review():
    attrs = {"demoAccountRequired": True, "demoAccountName": demo_user, "demoAccountPassword": demo_pass,
             "notes": "Sign in with the student account above (on the sign-in screen, choose Student). It's a sample account with full access, and it never appears on leaderboards. Notifications appear when a teacher sends the student a message; the daily reading reminder can be set on first sign-in. Plans (families $7/month, teachers $20/month, schools $100/month) are not sold in the app: an account without a plan sees a screen with a button that opens arisereader.com in Safari, which is why the app is offered on the United States App Store only."}
    for k, env in (("contactFirstName", "CONTACT_FIRST"), ("contactLastName", "CONTACT_LAST"), ("contactPhone", "CONTACT_PHONE"), ("contactEmail", "CONTACT_EMAIL")):
        if os.environ.get(env):
            attrs[k] = os.environ[env]
    try:
        rd = q(f"appStoreVersions/{VID}/appStoreReviewDetail")["data"]
    except RuntimeError:
        rd = None
    if rd:
        api(f"appStoreReviewDetails/{rd['id']}", {"data": {"type": "appStoreReviewDetails", "id": rd["id"], "attributes": attrs}}, method="PATCH")
    else:
        api("appStoreReviewDetails", {"data": {"type": "appStoreReviewDetails", "attributes": attrs, "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": VID}}}}})
if demo_user and not os.environ.get("CONTACT_FIRST"):
    print("SKIP App Review sign-in and contact: Apple needs the contact's name and phone with it")
elif demo_user:
    step("App Review sign-in (sample account)" + (" and contact" if os.environ.get("CONTACT_PHONE") else ""), review)

# Screenshots.
def upload(loc_id, display, files):
    sets = q(f"appStoreVersionLocalizations/{loc_id}/appScreenshotSets")["data"]
    s = next((x for x in sets if x["attributes"]["screenshotDisplayType"] == display), None)
    if s:
        for old in q(f"appScreenshotSets/{s['id']}/appScreenshots")["data"]:
            api(f"appScreenshots/{old['id']}", method="DELETE")
    else:
        s = api("appScreenshotSets", {"data": {"type": "appScreenshotSets", "attributes": {"screenshotDisplayType": display},
                                               "relationships": {"appStoreVersionLocalization": {"data": {"type": "appStoreVersionLocalizations", "id": loc_id}}}}})["data"]
    for path in files:
        data = open(path, "rb").read()
        shot = api("appScreenshots", {"data": {"type": "appScreenshots", "attributes": {"fileName": os.path.basename(path), "fileSize": len(data)},
                                               "relationships": {"appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": s["id"]}}}}})["data"]
        for op in shot["attributes"]["uploadOperations"]:
            part = data[op["offset"]:op["offset"] + op["length"]]
            req = urllib.request.Request(op["url"], data=part, method=op["method"], headers={h["name"]: h["value"] for h in op["requestHeaders"]})
            urllib.request.urlopen(req, timeout=120).read()
        api(f"appScreenshots/{shot['id']}", {"data": {"type": "appScreenshots", "id": shot["id"], "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(data).hexdigest()}}}, method="PATCH")
for loc in vlocs:
    phone = sorted(glob.glob("store-shots/iphone-*.png"))[:10]
    pad = sorted(glob.glob("store-shots/ipad-*.png"))[:10]
    if phone:
        step(f"{len(phone)} iPhone screenshots", lambda: upload(loc["id"], "APP_IPHONE_67", phone))
    if pad:
        step(f"{len(pad)} iPad screenshots", lambda: upload(loc["id"], "APP_IPAD_PRO_3GEN_129", pad))
