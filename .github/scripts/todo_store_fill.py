"""Arise To Duo's App Store Connect details that can be set by API: the age rating answers (17+: the Browser plugin
opens the whole web; social posts and messages are user content) and the App Review notes with the sign-in for the
review account. Run by todo-store-fill.yml. It leaves alone what only the App Store Connect website can set:
the App Privacy answers, attaching the All Access subscription to the version, and the 13-inch iPad screenshots.
Env: DEMO_USER, DEMO_PASS, CONTACT_FIRST, CONTACT_LAST, CONTACT_PHONE, CONTACT_EMAIL (the contact is optional when
another Arise app already has one saved).
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
        raise RuntimeError(f"{e.code} {method or 'GET'} {path.split('?')[0]}: {e.read().decode(errors='replace')[:600]}")


def q(path, **params):
    return api(path + ("?" + urllib.parse.urlencode(params) if params else ""))


failed = []


def step(what, fn):
    try:
        fn(); print(f"ok   {what}")
    except Exception as e:  # keep going: report each part
        failed.append(what); print(f"FAIL {what}: {e}")


app = q("apps", **{"filter[bundleId]": BUNDLE})["data"][0]
APP = app["id"]
infos = q(f"apps/{APP}/appInfos")["data"]
info = next((i for i in infos if i["attributes"].get("appStoreState") != "READY_FOR_SALE"), infos[0])

# Questions answered yes. Everything else is "no" or "none".
YES = {"unrestrictedWebAccess", "userGeneratedContent", "messagingAndChat"}


def age():
    decl = q(f"appInfos/{info['id']}/ageRatingDeclaration")["data"]
    attrs = {}
    for k, v in decl["attributes"].items():
        low = k.lower()
        if k == "kidsAgeBand" or any(w in low for w in ("url", "uri", "override", "grac", "classification", "korea")):
            continue  # links, rating overrides and Korea's rating number stay as they are
        attrs[k] = (k in YES) if isinstance(v, bool) else "NONE"
    for _ in range(12):
        try:
            api(f"ageRatingDeclarations/{decl['id']}", {"data": {"type": "ageRatingDeclarations", "id": decl["id"], "attributes": attrs}}, method="PATCH")
            print("     answers: " + ", ".join(f"{k}={v}" for k, v in sorted(attrs.items())))
            return
        except RuntimeError as e:
            m = re.search(r"attribute '(\w+)'. Expected a (\w+)", str(e))
            if m:
                attrs[m.group(1)] = (m.group(1) in YES) if m.group(2) == "BOOLEAN" else "NONE"
                continue
            p = re.search(r'"pointer"\s*:\s*"/data/attributes/(\w+)"', str(e))
            if p and p.group(1) in attrs:
                print(f"    leaving out {p.group(1)}")
                attrs.pop(p.group(1))
                continue
            raise
    raise RuntimeError("age rating: too many corrections")


step("age rating answers (unrestricted web access, user content, messaging)", age)

NOTES = ("Sign in with the account above. It has Arise All Access switched on so every paid feature can be seen. "
         "Arise All Access is a monthly subscription sold with Apple in-app purchase: More menu, then Arise All Access, then Subscribe. "
         "The US store may also show a link to buy on the website, as the US App Store allows. "
         "AI features ask for permission before the first request. The Browser plugin opens web pages inside the app. "
         "Posts and messages can be reported and blocked from the post's menu. Account deletion is under More, Account and privacy, Delete my account.")


def review():
    user, pw = os.environ.get("DEMO_USER", ""), os.environ.get("DEMO_PASS", "")
    if not (user and pw):
        raise RuntimeError("DEMO_USER and DEMO_PASS are needed")
    version = next((v for v in q(f"apps/{APP}/appStoreVersions", **{"filter[platform]": "IOS"})["data"] if v["attributes"]["appStoreState"] == "PREPARE_FOR_SUBMISSION"), None)
    if not version:
        raise RuntimeError("no version is waiting to be submitted; open one in App Store Connect first")
    vid = version["id"]
    attrs = {"demoAccountRequired": True, "demoAccountName": user, "demoAccountPassword": pw, "notes": NOTES}
    for k, env in (("contactFirstName", "CONTACT_FIRST"), ("contactLastName", "CONTACT_LAST"), ("contactPhone", "CONTACT_PHONE"), ("contactEmail", "CONTACT_EMAIL")):
        if os.environ.get(env):
            attrs[k] = os.environ[env]
    try:
        rd = q(f"appStoreVersions/{vid}/appStoreReviewDetail")["data"]
    except RuntimeError:
        rd = None
    if rd:
        api(f"appStoreReviewDetails/{rd['id']}", {"data": {"type": "appStoreReviewDetails", "id": rd["id"], "attributes": attrs}}, method="PATCH")
    else:
        api("appStoreReviewDetails", {"data": {"type": "appStoreReviewDetails", "attributes": attrs,
                                               "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}})


step("App Review notes and sign-in", review)
print("\nStill yours on the App Store Connect website: App Privacy answers, attach the All Access subscription to the version, 13-inch iPad screenshots.")
sys.exit(1 if failed else 0)
