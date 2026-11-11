"""Sets up Arise All Access as an in-app subscription in App Store Connect, for each app that sells it:
a subscription group "Arise All Access", the monthly subscription <bundle>.allaccess.monthly at $9.99
in the US (Apple's matching price everywhere else), its English name and description, and availability
in every country. Safe to run again: it only adds what's missing.

Left for the App Store Connect website (the API can't): accepting the Paid Applications agreement,
the review screenshot for the first submission, and the App Store Server Notifications URL.
Run by all-access-iap.yml.
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
APPS = [b for b in os.environ.get("APPS", "com.arisereader.arisetodo com.arisereader.fit com.arisereader.notes").split() if b]
US_PRICE = os.environ.get("US_PRICE", "9.99")
NAME = "Arise All Access"
DESCRIPTION = "To Duo Unlimited, Notes Plus, Fit+ and ad-free Pod+."  # 55 characters max
REVIEW_NOTE = ("Arise All Access is one monthly subscription that unlocks the paid tier of every Arise app on the same "
               "account: To Duo Unlimited, Arise Notes Plus, Cooked+ and ad-free listening in Pod+. Sign in with the "
               "review account, open the plan screen and tap Subscribe.")


def api(path, body=None, method=None):
    url = path if path.startswith("https://") else "https://api.appstoreconnect.apple.com/" + (path if path.startswith("v") else "v1/" + path)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method or ("POST" if body is not None else "GET"),
                                 headers={"Authorization": "Bearer " + AUTH, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        text = e.read().decode(errors="replace")
        raise RuntimeError(f"{e.code} {method or ('POST' if body is not None else 'GET')} {path.split('?')[0]}: {text[:700]}")


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


def rel(kind, id_):
    return {"data": {"type": kind, "id": id_}}


def setup(bundle):
    apps = q("apps", **{"filter[bundleId]": bundle}).get("data", [])
    if not apps:
        print(f"FAIL {bundle}: no app with this bundle id in App Store Connect"); return False
    app_id = apps[0]["id"]
    product_id = f"{bundle}.allaccess.monthly"

    groups = every(f"apps/{app_id}/subscriptionGroups")
    group = next((g for g in groups if g["attributes"].get("referenceName") == NAME), None)
    if not group:
        group = api("subscriptionGroups", {"data": {"type": "subscriptionGroups", "attributes": {"referenceName": NAME}, "relationships": {"app": rel("apps", app_id)}}})["data"]
        print(f"ok   {bundle}: made the subscription group")
    gid = group["id"]
    if not every(f"subscriptionGroups/{gid}/subscriptionGroupLocalizations"):
        api("subscriptionGroupLocalizations", {"data": {"type": "subscriptionGroupLocalizations", "attributes": {"locale": "en-US", "name": NAME}, "relationships": {"subscriptionGroup": rel("subscriptionGroups", gid)}}})
        print(f"ok   {bundle}: group name")

    subs = every(f"subscriptionGroups/{gid}/subscriptions")
    sub = next((s for s in subs if s["attributes"].get("productId") == product_id), None)
    if not sub:
        sub = api("subscriptions", {"data": {"type": "subscriptions", "attributes": {
            "name": NAME, "productId": product_id, "subscriptionPeriod": "ONE_MONTH", "groupLevel": 1, "familySharable": False, "reviewNote": REVIEW_NOTE,
        }, "relationships": {"group": rel("subscriptionGroups", gid)}}})["data"]
        print(f"ok   {bundle}: made {product_id}")
    sid = sub["id"]

    if not every(f"subscriptions/{sid}/subscriptionLocalizations"):
        api("subscriptionLocalizations", {"data": {"type": "subscriptionLocalizations", "attributes": {"locale": "en-US", "name": NAME, "description": DESCRIPTION}, "relationships": {"subscription": rel("subscriptions", sid)}}})
        print(f"ok   {bundle}: name and description")

    try:
        q(f"subscriptions/{sid}/subscriptionAvailability")
        have_avail = True
    except RuntimeError:
        have_avail = False
    if not have_avail:
        territories = [t["id"] for t in every("territories", limit=200)]
        api("subscriptionAvailabilities", {"data": {"type": "subscriptionAvailabilities", "attributes": {"availableInNewTerritories": True}, "relationships": {
            "subscription": rel("subscriptions", sid), "availableTerritories": {"data": [{"type": "territories", "id": t} for t in territories]}}}})
        print(f"ok   {bundle}: available in {len(territories)} countries")

    if not every(f"subscriptions/{sid}/prices", limit=200):
        points = every(f"subscriptions/{sid}/pricePoints", **{"filter[territory]": "USA", "limit": 200})
        us = next((p for p in points if p["attributes"].get("customerPrice") == US_PRICE), None)
        if not us:
            print(f"FAIL {bundle}: no US price point of ${US_PRICE}"); return False
        price_ids = [us["id"]] + [p["id"] for p in every(f"subscriptionPricePoints/{us['id']}/equalizations", limit=200)]
        made = 0
        for pid in price_ids:
            try:
                api("subscriptionPrices", {"data": {"type": "subscriptionPrices", "attributes": {"preserveCurrentPrice": False}, "relationships": {
                    "subscription": rel("subscriptions", sid), "subscriptionPricePoint": rel("subscriptionPricePoints", pid)}}})
                made += 1
            except RuntimeError as e:
                print(f"warn {bundle}: a price: {e}")
        print(f"ok   {bundle}: ${US_PRICE} in the US, matching prices in {made - 1} other countries")

    state = q(f"subscriptions/{sid}")["data"]["attributes"].get("state")
    print(f"ok   {bundle}: {product_id} is {state}")
    return True


ok = True
for b in APPS:
    try:
        ok = setup(b) and ok
    except Exception as e:  # report each app
        print(f"FAIL {b}: {e}"); ok = False
sys.exit(0 if ok else 1)
