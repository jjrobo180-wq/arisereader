"""Arise To Duo's App Store Connect page, for the App Review 5.6 resubmission (run by todo-review-fix.yml).

  PARTS=status   reads and prints everything below. Changes nothing.
  PARTS=age      answers the age rating questions as the app really is (web browser, user posts and messages,
                 health and fitness topics), so the rating isn't 4+ for an app with a web browser.
  PARTS=china    takes the app off sale in China mainland (it would need generative-AI filings there).
  PARTS=iap      renames the subscription "Arise To Duo Unlimited" and rewrites its description and review note
                 (only while it isn't waiting for or in review: App Store Connect locks it then).
  PARTS=desc     adds what the description must say (Apple Health, Terms of Use, Privacy Policy) if it's missing.
  PARTS=notes    sets the App Review notes and the review sign-in (DEMO_USER, DEMO_PASS).
  PARTS=build    puts the newest processed build (or BUILD) on version 1.0.
Several parts: "age china iap desc". Nothing here submits the app: Update Review stays the owner's tap.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from apple_signing import token  # noqa: E402

AUTH = token()
BUNDLE = "com.arisereader.arisetodo"
PARTS = set((os.environ.get("PARTS") or "status").split())

IAP_NAME = "Arise To Duo Unlimited"
IAP_DESCRIPTION = "Every plugin, unlimited AI, Notes Plus and Cooked Premium."  # 55 characters at most
IAP_REVIEW_NOTE = ("Arise To Duo Unlimited is the app's one monthly subscription. Inside Arise To Duo it unlocks every plugin in the "
                   "Plugin Gallery, unlimited AI, Notes Plus (1,500 recording minutes a month) and Cooked Premium. To buy it, sign in "
                   "with the free review account, then add a fourth plugin in the Plugin Gallery, or open ... > Customize > Plan & more, "
                   "and tap Subscribe.")

DESC_LINES = [
    ("Apple Health", "Cooked reads your steps, active calories and weight from Apple Health, with your permission, to fill in your food and fitness diary."),
    ("Terms of Use", "Terms of Use: https://arisetodo.com/terms/"),
    ("Privacy Policy", "Privacy Policy: https://arisetodo.com/privacy/"),
]

NOTES = """Arise To Duo contains no live-update code: everything it does is in this binary, and changes ship only as App Store updates.

Demo accounts
- Free account (no subscription): the sign-in above. It shows the free app and the purchase: add a fourth plugin in the Plugin Gallery (... menu), or ... > Customize > Plan & more, then Subscribe (sandbox).
{subscribed}
What is in the app
- LifeHub (your own tasks, calendar, notes), FamilyHub (shared with family members you invite by code) and WorkHub (work tasks), switched at the top.
- Plugins from the Plugin Gallery: Notes (record, transcribe, and an "Ask AI" chat), Cooked (fitness diary; reads steps, active calories and weight from Apple Health), Cooked PT (coaching), Podster (podcasts, public-domain audiobooks and music, radio), Browser (opens web pages in the app), Rise Score and more.
- WorkHub's teacher tools (classes, students, Arise Reader for a class) need a teacher account.
- Arise To Duo Unlimited: auto-renewing monthly subscription through Apple in-app purchase. It unlocks every plugin and unlimited AI. On the US storefront only, the app also shows a link to buy on our website, as 3.1.1(a) allows.

Privacy and safety
- AI features ask permission, naming OpenAI, Groq and Perplexity, before the first request.
- Posts can be reported and users blocked from each post's menu.
- Account deletion: ... > Account & privacy > Delete my account."""

# The age rating questions, as the app is. Booleans not listed are "no"; levels not listed are "none".
AGE_YES = {"unrestrictedWebAccess", "userGeneratedContent", "messagingAndChat", "healthOrWellnessTopics"}
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
    builds = q("builds", **{"filter[app]": APP, "sort": "-uploadedDate", "limit": 3})["data"]
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
        attrs[k] = (k in AGE_YES) if isinstance(v, bool) else AGE_LEVELS.get(k, "NONE")
    for k in AGE_YES:
        attrs.setdefault(k, True)
    api(f"ageRatingDeclarations/{decl['id']}", {"data": {"type": "ageRatingDeclarations", "id": decl["id"], "attributes": attrs}}, method="PATCH")
    print("     answers: " + ", ".join(f"{k}={v}" for k, v in sorted(attrs.items()) if v not in (False, "NONE")))


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
        text = loc["attributes"].get("description") or ""
        add = [line for key, line in DESC_LINES if key.lower() not in text.lower()]
        if not add:
            print(f"     [{loc['attributes']['locale']}] already says it all")
            continue
        new = text.rstrip() + "\n\n" + "\n".join(add)
        if len(new) > 4000:
            raise RuntimeError("the description would be over 4,000 characters")
        api(f"appStoreVersionLocalizations/{loc['id']}", {"data": {"type": "appStoreVersionLocalizations", "id": loc["id"], "attributes": {"description": new}}}, method="PATCH")
        print(f"     [{loc['attributes']['locale']}] added: " + " | ".join(add))


def notes():
    user, pw = os.environ.get("DEMO_USER", ""), os.environ.get("DEMO_PASS", "")
    if not (user and pw):
        raise RuntimeError("DEMO_USER and DEMO_PASS are needed")
    sub_user, sub_pass = os.environ.get("SUB_USER", ""), os.environ.get("SUB_PASS", "")
    subscribed = f"- Subscribed account (Arise To Duo Unlimited active): {sub_user} / {sub_pass}\n" if sub_user and sub_pass else ""
    attrs = {"demoAccountRequired": True, "demoAccountName": user, "demoAccountPassword": pw, "notes": NOTES.format(subscribed=subscribed)}
    rd = q(f"appStoreVersions/{VID}/appStoreReviewDetail")["data"]
    api(f"appStoreReviewDetails/{rd['id']}", {"data": {"type": "appStoreReviewDetails", "id": rd["id"], "attributes": attrs}}, method="PATCH")


def build():
    want = os.environ.get("BUILD", "").strip()
    builds = q("builds", **{"filter[app]": APP, "sort": "-uploadedDate", "limit": 10})["data"]
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
