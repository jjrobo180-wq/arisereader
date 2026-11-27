"""Arise To Do's App Store Connect page, for the App Review 5.6 resubmission (run by todo-review-fix.yml).

  PARTS=status   reads and prints everything below. Changes nothing.
  PARTS=age      answers the age rating questions as the app really is (user posts and messages, health and
                 fitness topics; no web browser since the Browser plugin was taken out).
  PARTS=china    takes the app off sale in China mainland (it would need generative-AI filings there).
  PARTS=iap      renames the subscription "Arise To Do Unlimited" and rewrites its description and review note
                 (only while it isn't waiting for or in review: App Store Connect locks it then).
  PARTS=desc     adds what the description must say (Apple Health, Terms of Use, Privacy Policy) if it's missing.
  PARTS=notes    sets the App Review notes and the review sign-in (DEMO_USER, DEMO_PASS).
  PARTS=build    puts the newest processed build (or BUILD) on version 1.0.
Several parts: "age china iap desc". Nothing here submits the app: Update Review stays the owner's tap.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from apple_signing import token  # noqa: E402

AUTH = token()
BUNDLE = "com.arisereader.arisetodo"
PARTS = set((os.environ.get("PARTS") or "status").split())

IAP_NAME = "Arise To Do Unlimited"
IAP_DESCRIPTION = "Every plugin, unlimited AI, Notes and Fitness extras."  # 55 characters at most
IAP_REVIEW_NOTE = ("Arise To Do Unlimited is the app's one monthly subscription. Inside Arise To Do it unlocks every plugin in the "
                   "Plugin Gallery, unlimited AI, 1,500 Arise Notes recording minutes a month and the premium Arise Health & Fitness features. To buy it, sign in "
                   "with the free review account, then add a fourth plugin in the Plugin Gallery, or open ... > Customize > Plan & more, "
                   "and tap Subscribe.")

# What the app does with Apple Health, as configure-ios.py's NSHealthUpdateUsageDescription says (it does write).
HEALTH_LINE = ("Arise Health & Fitness reads your steps, active calories, weight, heart rate, sleep and mindful minutes from "
               "Apple Health, with your permission, to fill in your food and fitness diary. If you allow it, it saves your "
               "weigh-ins, active calories, workout distance and mindful minutes to Apple Health.")
# Lines in the description that were wrong, and what they say now (App Review 2.3.1: the listing matches the app).
DESC_FIXES = [
    ("Health & Fitness reads your steps, active calories and weight from Apple Health, with your permission, to fill in your food and fitness diary. It never writes to Apple Health.", HEALTH_LINE),
    ("Cooked reads your steps, active calories and weight from Apple Health, with your permission, to fill in your food and fitness diary. It never writes to Apple Health.", HEALTH_LINE),
    ("Bills, budget, calendar, meals, habits, health, notes, journal and Rise Score.", "Bills, budget, calendar, meals, habits, health, notes, journal and Life Score."),
    ("Daily brief and StandBy support keep your day in front of you.", "A daily brief and a bedside clock display keep your day in front of you."),
    ("Arise is free with 3 plugins. Arise Unlimited (monthly subscription) unlocks every plugin and the AI features.",
     "Arise To Do is free with 3 plugins. Arise To Do Unlimited, an auto-renewing monthly subscription, unlocks every plugin and the AI features."),
    ("- Health & Fitness: food, workouts, water and sleep", "- Arise Health & Fitness: food, workouts, water and sleep"),
    ("- Podcasts: podcasts and audiobooks.", "- Arise Podcasts: podcasts and public-domain audiobooks."),
]
# (What the description must mention, the line added when it doesn't.)
DESC_LINES = [
    ("Apple Health", "APPLE HEALTH\n" + HEALTH_LINE),
    ("arisetodo.com/terms", "Terms of Use: https://arisetodo.com/terms/"),
    ("arisetodo.com/privacy", "Privacy Policy: https://arisetodo.com/privacy/"),
]

NOTES = """Arise To Do contains no live-update code: everything it does is in this binary, and changes ship only as App Store updates.

Demo accounts
- Free account (no subscription): the sign-in above. It shows the free app and the purchase: add a fourth plugin in the Plugin Gallery (... menu), or ... > Customize > Plan & more, then Subscribe (sandbox).
{subscribed}
What is in the app
- LifeHub (your own tasks, calendar, notes), FamilyHub (shared with family members you invite by code) and WorkHub (work tasks), switched at the top.
- Plugins from the Plugin Gallery: Arise Notes (record, transcribe, and an "Ask AI" chat), Arise Health & Fitness (food and fitness diary; reads from Apple Health and, if allowed, saves weigh-ins, active calories, distance and mindful minutes to it), Cooked PT (coaching), Arise Podcasts (podcasts, public-domain audiobooks and music, radio), Life Score and more. There is no web browser in the app.
- Permissions: the app never shows its own screen before an iOS permission prompt. Calendar and Reminders are asked for only when you tap to connect them (... > iPhone connections); notifications, Apple Health, location, camera and microphone only when you tap a feature that needs them.
- WorkHub's extra teacher tools (classes and students) are for teachers whose school has an Arise license, sold to schools outside the app (3.1.3(c)); nothing in the app sells them. Both accounts above show everything else.
- Arise To Do Unlimited: auto-renewing monthly subscription through Apple in-app purchase. It unlocks every plugin and unlimited AI. On the US storefront only, the app also shows a link to buy on our website, as 3.1.1(a) allows.

Privacy and safety
- AI features ask permission, naming OpenAI, Groq and Perplexity, before the first request.
- Posts can be reported and users blocked from each post's menu.
- Account deletion: ... > Account & privacy > Delete my account."""

# The age rating questions, as the app is. Booleans not listed are "no"; levels not listed are "none".
AGE_YES = {"userGeneratedContent", "messagingAndChat", "healthOrWellnessTopics"}
AGE_LEVELS = {"medicalOrTreatmentInformation": "INFREQUENT_OR_MILD"}


def api(path, body=None, method=None):
    url = path if path.startswith("https://") else "https://api.appstoreconnect.apple.com/" + (path if path.startswith("v2/") else "v1/" + path)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method or ("POST" if body is not None else "GET"),
                                 headers={"Authorization": "Bearer " + AUTH, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{e.code} {method or 'GET'} {path.split('?')[0]}: {e.read().decode(errors='replace')[:700]}")


def q(path, **params):
    return api(path + ("?" + urllib.parse.urlencode(params) if params else ""))


def every(path, **params):
    out, page = [], q(path, **params)
    while True:
        out += page.get("data", [])
        nxt = page.get("links", {}).get("next")
        if not nxt:
            return out
        page = api(nxt)


failed = []


def step(what, fn):
    try:
        fn()
        print(f"ok   {what}")
    except Exception as e:  # keep going: report each part
        failed.append(what)
        print(f"FAIL {what}: {e}")


app = q("apps", **{"filter[bundleId]": BUNDLE})["data"][0]
APP = app["id"]
infos = q(f"apps/{APP}/appInfos")["data"]
info = next((i for i in infos if i["attributes"].get("appStoreState") != "READY_FOR_SALE"), infos[0])
versions = q(f"apps/{APP}/appStoreVersions", **{"filter[platform]": "IOS"})["data"]
version = next((v for v in versions if v["attributes"]["versionString"] == "1.0"), versions[0])
VID = version["id"]


def subscriptions():
    out = []
    for g in every(f"apps/{APP}/subscriptionGroups"):
        for s in every(f"subscriptionGroups/{g['id']}/subscriptions"):
            out.append((g, s))
    return out


def status():
    print(f"App {app['attributes']['name']} ({APP}); version {version['attributes']['versionString']}: {version['attributes']['appStoreState']}")
    try:
        b = q(f"appStoreVersions/{VID}/build").get("data")
        print(f"  build on the version: {b['attributes']['version'] if b else 'none'}")
    except RuntimeError as e:
        print(f"  build: {e}")
    builds = q("builds", **{"filter[app]": APP, "filter[preReleaseVersion.platform]": "IOS", "sort": "-uploadedDate", "limit": 3})["data"]
    for b in builds:
        print(f"  build {b['attributes']['version']} uploaded {b['attributes']['uploadedDate']} {b['attributes'].get('processingState')}")
    decl = q(f"appInfos/{info['id']}/ageRatingDeclaration")["data"]["attributes"]
    print("  age rating answers: " + ", ".join(f"{k}={v}" for k, v in sorted(decl.items()) if v not in (None, False, "NONE")))
    print(f"  age rating: {info['attributes'].get('appStoreAgeRating')}")
    for loc in every(f"appStoreVersions/{VID}/appStoreVersionLocalizations"):
        a = loc["attributes"]
        print(f"  [{a['locale']}] description:\n" + "\n".join("    | " + line for line in (a.get("description") or "").split("\n")))
        print(f"  [{a['locale']}] keywords: {a.get('keywords')}; promo: {a.get('promotionalText')}")
    try:
        rd = q(f"appStoreVersions/{VID}/appStoreReviewDetail")["data"]["attributes"]
        print(f"  review sign-in: {rd.get('demoAccountName')} (required: {rd.get('demoAccountRequired')})")
        print("  review notes:\n" + "\n".join("    | " + line for line in (rd.get("notes") or "").split("\n")))
    except RuntimeError as e:
        print(f"  review details: {e}")
    try:
        avail = api(f"apps/{APP}/appAvailabilityV2")["data"]
        terr = every(f"v2/appAvailabilities/{avail['id']}/territoryAvailabilities", include="territory", limit=200)
        on = [t["relationships"]["territory"]["data"]["id"] for t in terr if t["attributes"].get("available")]
        print(f"  on sale in {len(on)} territories; China mainland: {'yes' if 'CHN' in on else 'no'}")
    except RuntimeError as e:
        print(f"  availability: {e}")
    for g, s in subscriptions():
        a = s["attributes"]
        print(f"  subscription {a.get('productId')} '{a.get('name')}' in group '{g['attributes'].get('referenceName')}': {a.get('state')}")
        print(f"    review note: {a.get('reviewNote')}")
        for loc in every(f"subscriptions/{s['id']}/subscriptionLocalizations"):
            la = loc["attributes"]
            print(f"    [{la.get('locale')}] {la.get('name')}: {la.get('description')} ({la.get('state')})")
    for r in q("reviewSubmissions", **{"filter[app]": APP, "filter[platform]": "IOS", "limit": 5})["data"]:
        print(f"  review submission {r['id']}: {r['attributes'].get('state')} submitted {r['attributes'].get('submittedDate')}")


def age():
    decl = q(f"appInfos/{info['id']}/ageRatingDeclaration")["data"]
    attrs = {}
    for k, v in decl["attributes"].items():
        low = k.lower()
        if k == "kidsAgeBand" or any(w in low for w in ("url", "uri", "override", "grac", "classification", "korea")):
            continue
        if isinstance(v, bool) or k in AGE_YES:
            attrs[k] = k in AGE_YES
        elif v is None and k not in AGE_LEVELS:
            attrs[k] = None  # a newer question: its type is learned from Apple's answer below
        else:
            attrs[k] = AGE_LEVELS.get(k, "NONE")
    for k in AGE_YES:
        attrs[k] = True
    for _ in range(20):
        body = {k: (False if v is None else v) for k, v in attrs.items()}
        try:
            api(f"ageRatingDeclarations/{decl['id']}", {"data": {"type": "ageRatingDeclarations", "id": decl["id"], "attributes": body}}, method="PATCH")
            print("     answers: " + ", ".join(f"{k}={v}" for k, v in sorted(body.items()) if v not in (False, "NONE")))
            return
        except RuntimeError as e:
            fixed = False
            for name, want in re.findall(r"attribute '(\w+)'\. Expected an? (\w+)", str(e)):
                if name in attrs:
                    attrs[name] = (name in AGE_YES) if want == "BOOLEAN" else AGE_LEVELS.get(name, "NONE")
                    fixed = True
            for name in re.findall(r'"pointer"\s*:\s*"/data/attributes/(\w+)"', str(e)):
                if not fixed and name in attrs:
                    attrs.pop(name)
                    fixed = True
            if not fixed:
                raise
    raise RuntimeError("age rating: too many corrections")


def china():
    avail = api(f"apps/{APP}/appAvailabilityV2")["data"]
    for t in every(f"v2/appAvailabilities/{avail['id']}/territoryAvailabilities", include="territory", limit=200):
        if t["relationships"]["territory"]["data"]["id"] == "CHN":
            if t["attributes"].get("available"):
                api(f"territoryAvailabilities/{t['id']}", {"data": {"type": "territoryAvailabilities", "id": t["id"], "attributes": {"available": False}}}, method="PATCH")
                print("     China mainland: taken off sale")
            else:
                print("     China mainland: already off sale")
            return
    print("     China mainland: not listed")


def iap():
    for _, s in subscriptions():
        a = s["attributes"]
        if not str(a.get("productId", "")).startswith(BUNDLE):
            continue
        if a.get("state") in ("WAITING_FOR_REVIEW", "IN_REVIEW"):
            raise RuntimeError(f"{a.get('productId')} is {a.get('state')}: remove it from the submission first")
        api(f"subscriptions/{s['id']}", {"data": {"type": "subscriptions", "id": s["id"], "attributes": {"name": IAP_NAME, "reviewNote": IAP_REVIEW_NOTE}}}, method="PATCH")
        for loc in every(f"subscriptions/{s['id']}/subscriptionLocalizations"):
            api(f"subscriptionLocalizations/{loc['id']}", {"data": {"type": "subscriptionLocalizations", "id": loc["id"], "attributes": {"name": IAP_NAME, "description": IAP_DESCRIPTION}}}, method="PATCH")
        print(f"     {a.get('productId')}: '{IAP_NAME}', '{IAP_DESCRIPTION}'")


def desc():
    for loc in every(f"appStoreVersions/{VID}/appStoreVersionLocalizations"):
        old = loc["attributes"].get("description") or ""
        text = old
        for was, now in DESC_FIXES:
            text = text.replace(was, now)
        add = [line for key, line in DESC_LINES if key.lower() not in text.lower()]
        if not add and text == old:
            print(f"     [{loc['attributes']['locale']}] already says it all")
            continue
        new = text.rstrip() + ("\n\n" + "\n".join(add) if add else "")
        if len(new) > 4000:
            raise RuntimeError("the description would be over 4,000 characters")
        api(f"appStoreVersionLocalizations/{loc['id']}", {"data": {"type": "appStoreVersionLocalizations", "id": loc["id"], "attributes": {"description": new}}}, method="PATCH")
        print(f"     [{loc['attributes']['locale']}] corrected and added: " + " | ".join(add))


def notes():
    user, pw = os.environ.get("DEMO_USER", ""), os.environ.get("DEMO_PASS", "")
    if not (user and pw):
        raise RuntimeError("DEMO_USER and DEMO_PASS are needed")
    sub_user, sub_pass = os.environ.get("SUB_USER", ""), os.environ.get("SUB_PASS", "")
    subscribed = f"- Subscribed account (Arise To Do Unlimited active): {sub_user} / {sub_pass}\n" if sub_user and sub_pass else ""
    attrs = {"demoAccountRequired": True, "demoAccountName": user, "demoAccountPassword": pw, "notes": NOTES.format(subscribed=subscribed)}
    rd = q(f"appStoreVersions/{VID}/appStoreReviewDetail")["data"]
    api(f"appStoreReviewDetails/{rd['id']}", {"data": {"type": "appStoreReviewDetails", "id": rd["id"], "attributes": attrs}}, method="PATCH")


def build():
    want = os.environ.get("BUILD", "").strip()
    # The Apple TV app's builds share the numbers: only the iPhone and iPad (IOS) ones.
    builds = q("builds", **{"filter[app]": APP, "filter[preReleaseVersion.platform]": "IOS", "sort": "-uploadedDate", "limit": 10})["data"]
    pick = next((b for b in builds if b["attributes"].get("processingState") == "VALID" and (not want or b["attributes"]["version"] == want)), None)
    if not pick:
        raise RuntimeError(f"no processed build {want or ''}".strip())
    api(f"appStoreVersions/{VID}/relationships/build", {"data": {"type": "builds", "id": pick["id"]}}, method="PATCH")
    print(f"     version 1.0 now has build {pick['attributes']['version']}")


for part, fn in (("age", age), ("china", china), ("iap", iap), ("desc", desc), ("notes", notes), ("build", build)):
    if part in PARTS:
        step(part, fn)
status()
sys.exit(1 if failed else 0)
