"""Fills an app's App Store listing from store/<app>/listing.json and its screenshots from store-shots/:
name, subtitle, category, age rating, privacy and support links, description, keywords, promotional text,
copyright, price (free), United States only, content rights, App Review sign-in and notes, screenshots.
It doesn't submit (app-store-submit.yml does). App privacy answers are left for the App Store Connect website.

Env: APP (cooked | cookedpt | notes | podster), DEMO_USER, DEMO_PASS, CONTACT_* (optional: taken from another
app when not given), the App Store Connect key (apple_signing). Run by store-listing.yml.
"""
import glob
import hashlib
import json
import os
import re
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from app_store_fill_api import api, q  # noqa: E402

SLUG = os.environ["APP"]
L = json.load(open(f"store/{SLUG}/listing.json"))
failed = []


def step(what, fn):
    try:
        fn()
        print(f"ok   {what}")
    except Exception as e:  # keep going: report each part
        failed.append(what)
        print(f"FAIL {what}: {e}")


app = q("apps", **{"filter[bundleId]": L["bundle"]})["data"][0]
APP = app["id"]
print(f"App: {app['attributes']['name']} ({L['bundle']})")

infos = q(f"apps/{APP}/appInfos")["data"]
info = next((i for i in infos if i["attributes"].get("appStoreState") != "READY_FOR_SALE"), infos[0])

primary, secondary = (L["category"] + [None])[:2]
step(f"category: {primary}" + (f", then {secondary}" if secondary else ""), lambda: api(f"appInfos/{info['id']}", {"data": {"type": "appInfos", "id": info["id"], "relationships": {
    "primaryCategory": {"data": {"type": "appCategories", "id": primary}},
    **({"secondaryCategory": {"data": {"type": "appCategories", "id": secondary}}} if secondary else {})}}}, method="PATCH"))

for loc in q(f"appInfos/{info['id']}/appInfoLocalizations")["data"]:
    step(f"subtitle and privacy link ({loc['attributes']['locale']})", lambda loc=loc: api(f"appInfoLocalizations/{loc['id']}", {"data": {"type": "appInfoLocalizations", "id": loc["id"], "attributes": {
        "subtitle": L["subtitle"], "privacyPolicyUrl": L["privacyUrl"]}}}, method="PATCH"))
    # On its own, so a name Apple won't take (already used by another app) doesn't hold up the rest.
    if loc["attributes"].get("name") != L["name"]:
        step(f"name: {L['name']} ({loc['attributes']['locale']})", lambda loc=loc: api(f"appInfoLocalizations/{loc['id']}", {"data": {"type": "appInfoLocalizations", "id": loc["id"], "attributes": {"name": L["name"]}}}, method="PATCH"))


# Age rating: every question "no" / "none", except the ones listing.json says yes to or gives a level for.
def age():
    decl = q(f"appInfos/{info['id']}/ageRatingDeclaration")["data"]
    yes, levels = set(L["age"]["yes"]), L["age"]["levels"]
    attrs = {}
    for k, v in decl["attributes"].items():
        low = k.lower()
        if k == "kidsAgeBand" or any(w in low for w in ("url", "uri", "override", "grac", "classification", "korea")):
            continue
        if isinstance(v, bool) or k in yes or k in ("advertising", "gambling", "healthOrWellnessTopics", "lootBox", "messagingAndChat", "parentalControls",
                                                    "ageAssurance", "unrestrictedWebAccess", "userGeneratedContent", "seventeenPlus"):
            attrs[k] = k in yes
        else:
            attrs[k] = levels.get(k, "NONE")
    for k in yes:
        attrs.setdefault(k, True)
    for k, v in levels.items():
        attrs.setdefault(k, v)
    for _ in range(12):
        try:
            api(f"ageRatingDeclarations/{decl['id']}", {"data": {"type": "ageRatingDeclarations", "id": decl["id"], "attributes": attrs}}, method="PATCH")
            print("     answers: " + ", ".join(f"{k}={v}" for k, v in sorted(attrs.items()) if v not in (False, "NONE")) or "all no")
            return
        except RuntimeError as e:
            m = re.search(r"attribute '(\w+)'. Expected a (\w+)", str(e))
            if m:
                attrs[m.group(1)] = (m.group(1) in yes) if m.group(2) == "BOOLEAN" else levels.get(m.group(1), "NONE")
                continue
            p = re.search(r'"pointer"\s*:\s*"/data/attributes/(\w+)"', str(e))
            if p and p.group(1) in attrs:
                print(f"     leaving out {p.group(1)}: {str(e)[:160]}")
                attrs.pop(p.group(1))
                continue
            raise
    raise RuntimeError("age rating: too many corrections")
step("age rating answers", age)

version = next((v for v in q(f"apps/{APP}/appStoreVersions", **{"filter[platform]": "IOS"})["data"] if v["attributes"]["appStoreState"] in ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED")), None)
if not version:
    sys.exit("No version open for changes (one may already be waiting for review).")
VID = version["id"]
step("copyright", lambda: api(f"appStoreVersions/{VID}", {"data": {"type": "appStoreVersions", "id": VID, "attributes": {"copyright": L["copyright"]}}}, method="PATCH"))
vlocs = q(f"appStoreVersions/{VID}/appStoreVersionLocalizations")["data"]
for loc in vlocs:
    step(f"description, keywords, links ({loc['attributes']['locale']})", lambda loc=loc: api(f"appStoreVersionLocalizations/{loc['id']}", {"data": {"type": "appStoreVersionLocalizations", "id": loc["id"], "attributes": {
        "description": L["description"], "keywords": L["keywords"], "promotionalText": L["promo"], "supportUrl": L["supportUrl"], "marketingUrl": L["marketingUrl"]}}}, method="PATCH"))


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


# United States only, like Arise Reader: the apps point to the website for plans, which the US App Store allows.
def availability():
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
                want = ta["relationships"]["territory"]["data"]["id"] == "USA"
                if ta["attributes"].get("available") != want:
                    api(f"territoryAvailabilities/{ta['id']}", {"data": {"type": "territoryAvailabilities", "id": ta["id"], "attributes": {"available": want}}}, method="PATCH")
                    changed += 1
            url = r.get("links", {}).get("next")
        print(f"     United States only ({changed} countries changed)")
        return
    # A new availability has to name every territory, each on or off.
    ids, url = [], "https://api.appstoreconnect.apple.com/v1/territories?limit=200"
    while url:
        r = api(url)
        ids += [t["id"] for t in r["data"]]
        url = r.get("links", {}).get("next")
    api("https://api.appstoreconnect.apple.com/v2/appAvailabilities", {"data": {"type": "appAvailabilities", "attributes": {"availableInNewTerritories": False}, "relationships": {
        "app": {"data": {"type": "apps", "id": APP}}, "territoryAvailabilities": {"data": [{"type": "territoryAvailabilities", "id": f"${{t{i}}}"} for i in range(len(ids))]}}},
        "included": [{"type": "territoryAvailabilities", "id": f"${{t{i}}}", "attributes": {"available": t == "USA"}, "relationships": {"territory": {"data": {"type": "territories", "id": t}}}} for i, t in enumerate(ids)]})
    print(f"     United States only (of {len(ids)} countries)")


step("available in the United States only", availability)
step("content rights: third-party content, with the rights to it", lambda: api(f"apps/{APP}", {"data": {"type": "apps", "id": APP, "attributes": {"contentRightsDeclaration": "USES_THIRD_PARTY_CONTENT"}}}, method="PATCH"))


# The App Review contact: as given, or the one saved on another of these apps.
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
                print(f"     contact taken from {other['attributes']['name']}")
                return a
    return {}
if not os.environ.get("CONTACT_PHONE"):
    found = borrowed_contact()
    for k, env in (("contactFirstName", "CONTACT_FIRST"), ("contactLastName", "CONTACT_LAST"), ("contactPhone", "CONTACT_PHONE"), ("contactEmail", "CONTACT_EMAIL")):
        if found.get(k) and not os.environ.get(env):
            os.environ[env] = found[k]


def review():
    user = os.environ.get("DEMO_USER") or L.get("demoUser", "")
    pw = os.environ.get("DEMO_PASS", "")
    attrs = {"demoAccountRequired": bool(user and pw), "notes": L["reviewNotes"]}
    if user and pw:
        attrs.update({"demoAccountName": user, "demoAccountPassword": pw})
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
step("App Review sign-in, notes and contact", review)


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
phone = sorted(glob.glob("store-shots/iphone-*.png"))[:10]
pad = sorted(glob.glob("store-shots/ipad-*.png"))[:10]
for loc in vlocs:
    if phone:
        step(f"{len(phone)} iPhone screenshots", lambda loc=loc: upload(loc["id"], "APP_IPHONE_67", phone))
    if pad:
        step(f"{len(pad)} iPad screenshots", lambda loc=loc: upload(loc["id"], "APP_IPAD_PRO_3GEN_129", pad))
if not phone:
    print("     no screenshots in store-shots/")

if failed:
    sys.exit(f"{len(failed)} part(s) failed: " + "; ".join(failed))
