"""Checks an app's App Store listing and (MODE=submit) sends its newest processed build to App Review.

Env: BUNDLE (com.arisereader.reader), MODE (check | submit), VERSION (optional). Uses the App Store Connect
API key the other workflows use (apple_signing.token). Prints a plain list of what's ready and what's missing.
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
BUNDLE = os.environ.get("BUNDLE", "com.arisereader.reader")
MODE = os.environ.get("MODE", "check")
WANT_VERSION = os.environ.get("VERSION", "").strip()
problems, notes = [], []


def api(path, body=None, method=None):
    url = path if path.startswith("https://") else "https://api.appstoreconnect.apple.com/v1/" + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method or ("POST" if body is not None else "GET"),
                                 headers={"Authorization": "Bearer " + AUTH, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        text = e.read().decode(errors="replace")
        try:
            errs = json.loads(text).get("errors", [])
            msg = "; ".join(f"{x.get('title')}: {x.get('detail')}" for x in errs) or text[:400]
        except Exception:
            msg = text[:400]
        raise RuntimeError(f"{e.code} {path.split('?')[0]}: {msg}")


def q(path, **params):
    return api(path + ("?" + urllib.parse.urlencode(params) if params else ""))


apps = q("apps", **{"filter[bundleId]": BUNDLE})["data"]
if not apps:
    sys.exit(f"No app with bundle id {BUNDLE} in App Store Connect.")
app = apps[0]
print(f"App: {app['attributes']['name']} ({BUNDLE}), id {app['id']}")

# The newest processed build.
builds = q("builds", **{"filter[app]": app["id"], "sort": "-uploadedDate", "limit": 10, "filter[processingState]": "VALID",
                        "include": "preReleaseVersion", "filter[preReleaseVersion.platform]": "IOS"})
build = builds["data"][0] if builds["data"] else None
pre = {x["id"]: x["attributes"] for x in builds.get("included", []) if x["type"] == "preReleaseVersions"}
if not build:
    problems.append("No processed iPhone build in TestFlight.")
else:
    bv = pre.get(build["relationships"]["preReleaseVersion"]["data"]["id"], {}).get("version", "?")
    print(f"Newest build: {bv} ({build['attributes']['version']}), uploaded {build['attributes']['uploadedDate']}")
    if build["attributes"].get("usesNonExemptEncryption") is None:
        notes.append("Export compliance (encryption) isn't answered on the build; it's set to 'no non-exempt encryption' when submitting.")

# App info: category, age rating, privacy policy.
infos = q(f"apps/{app['id']}/appInfos")["data"]
info = next((i for i in infos if i["attributes"].get("appStoreState") not in ("READY_FOR_SALE",)), infos[0] if infos else None)
if info:
    a = info["attributes"]
    print(f"App info state: {a.get('appStoreState') or a.get('state')}, age rating: {a.get('appStoreAgeRating')}")
    rel = q(f"appInfos/{info['id']}", include="primaryCategory")
    if not rel["data"]["relationships"].get("primaryCategory", {}).get("data"):
        problems.append("No primary category (App Information).")
    locs = q(f"appInfos/{info['id']}/appInfoLocalizations")["data"]
    for l in locs:
        la = l["attributes"]
        print(f"  [{la['locale']}] name={la.get('name')!r} subtitle={la.get('subtitle')!r} privacyPolicyUrl={la.get('privacyPolicyUrl')!r}")
        if not la.get("privacyPolicyUrl"):
            problems.append(f"No privacy policy URL ({la['locale']}).")
    try:
        age = q(f"appInfos/{info['id']}/ageRatingDeclaration")["data"]
        unanswered = [k for k, v in age["attributes"].items() if v is None]
        if unanswered:
            problems.append(f"Age rating questions not answered: {', '.join(unanswered[:8])}{'...' if len(unanswered) > 8 else ''}")
    except RuntimeError as e:
        notes.append(f"Age rating: {e}")

# The App Store version (made if missing, when submitting).
versions = q(f"apps/{app['id']}/appStoreVersions", **{"filter[platform]": "IOS", "limit": 5})["data"]
editable = [v for v in versions if v["attributes"]["appStoreState"] in ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED", "INVALID_BINARY")]
live = [v for v in versions if v["attributes"]["appStoreState"] in ("WAITING_FOR_REVIEW", "IN_REVIEW", "PENDING_DEVELOPER_RELEASE", "READY_FOR_SALE", "PROCESSING_FOR_APP_STORE")]
for v in versions:
    print(f"Version {v['attributes']['versionString']}: {v['attributes']['appStoreState']}")
version = editable[0] if editable else None
if any(v["attributes"]["appStoreState"] in ("WAITING_FOR_REVIEW", "IN_REVIEW") for v in live):
    print("A version is already waiting for or in review. Nothing to do.")
    sys.exit(0)

want = WANT_VERSION or (pre.get(build["relationships"]["preReleaseVersion"]["data"]["id"], {}).get("version") if build else "1.0") or "1.0"
if not version and MODE == "submit":
    version = api("appStoreVersions", {"data": {"type": "appStoreVersions", "attributes": {"platform": "IOS", "versionString": want},
                                                 "relationships": {"app": {"data": {"type": "apps", "id": app["id"]}}}}})["data"]
    print(f"Made version {want} for the App Store.")
if not version:
    problems.append(f"No App Store version to submit yet (submit makes version {want}).")
else:
    vid = version["id"]
    vlocs = q(f"appStoreVersions/{vid}/appStoreVersionLocalizations")["data"]
    if not vlocs:
        problems.append("No App Store text (description, keywords, support URL) for this version.")
    for l in vlocs:
        la = l["attributes"]
        print(f"  [{la['locale']}] description={len(la.get('description') or '')} chars, keywords={la.get('keywords')!r}, supportUrl={la.get('supportUrl')!r}, marketingUrl={la.get('marketingUrl')!r}")
        for f, what in (("description", "description"), ("keywords", "keywords"), ("supportUrl", "support URL")):
            if not la.get(f):
                problems.append(f"No {what} ({la['locale']}).")
        sets = q(f"appStoreVersionLocalizations/{l['id']}/appScreenshotSets")["data"]
        kinds = {s["attributes"]["screenshotDisplayType"]: s["id"] for s in sets}
        counts = {}
        for k, sid in kinds.items():
            counts[k] = len(q(f"appScreenshotSets/{sid}/appScreenshots")["data"])
        print(f"  screenshots: {counts or 'none'}")
        phone = sum(n for k, n in counts.items() if k.startswith("APP_IPHONE_67") or k.startswith("APP_IPHONE_69") or k.startswith("APP_IPHONE_65"))
        pad = sum(n for k, n in counts.items() if k.startswith("APP_IPAD_PRO_3GEN_129") or k.startswith("APP_IPAD_PRO_129") or k.startswith("APP_IPAD_13"))
        if not phone:
            problems.append(f"No 6.5\"/6.7\"/6.9\" iPhone screenshots ({la['locale']}).")
        if not pad:
            notes.append(f"No 13\" iPad screenshots ({la['locale']}): needed if the app runs on iPad.")
    try:
        rd = q(f"appStoreVersions/{vid}/appStoreReviewDetail")["data"]
        ra = rd["attributes"] if rd else {}
        print(f"  review contact: {ra.get('contactFirstName')} {ra.get('contactLastName')} {ra.get('contactEmail')} {ra.get('contactPhone')}, sign-in needed: {ra.get('demoAccountRequired')}")
        if not (ra.get("contactEmail") and ra.get("contactPhone")):
            problems.append("No App Review contact (name, phone, email).")
    except RuntimeError:
        problems.append("No App Review contact (name, phone, email), and no demo account for the reviewer.")
    cur = q(f"appStoreVersions/{vid}/build")["data"]
    print(f"  build on the version: {cur['attributes']['version'] if cur else 'none'}")

print()
print("Needs fixing before review:" if problems else "Nothing missing that the API can see.")
for p in problems:
    print(f"  - {p}")
for n in notes:
    print(f"  · {n}")
print("  · App privacy answers and price can only be checked on the App Store Connect website.")

if MODE != "submit":
    sys.exit(0)
if problems:
    sys.exit("Not submitted: fix the items above first.")

# Attach the build, answer export compliance, and submit.
if build["attributes"].get("usesNonExemptEncryption") is None:
    api(f"builds/{build['id']}", {"data": {"type": "builds", "id": build["id"], "attributes": {"usesNonExemptEncryption": False}}}, method="PATCH")
api(f"appStoreVersions/{version['id']}/relationships/build", {"data": {"type": "builds", "id": build["id"]}}, method="PATCH")
sub = api("reviewSubmissions", {"data": {"type": "reviewSubmissions", "attributes": {"platform": "IOS"},
                                         "relationships": {"app": {"data": {"type": "apps", "id": app["id"]}}}}})["data"]
api("reviewSubmissionItems", {"data": {"type": "reviewSubmissionItems",
                                       "relationships": {"reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sub["id"]}},
                                                         "appStoreVersion": {"data": {"type": "appStoreVersions", "id": version["id"]}}}}})
api(f"reviewSubmissions/{sub['id']}", {"data": {"type": "reviewSubmissions", "id": sub["id"], "attributes": {"submitted": True}}}, method="PATCH")
print(f"Submitted {app['attributes']['name']} {version['attributes']['versionString']} (build {build['attributes']['version']}) for App Review.")
