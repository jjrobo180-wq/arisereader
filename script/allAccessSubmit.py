"""One-off: gives the Arise All Access subscription (To Duo) its App Review screenshot, submits the
subscription with the app, and (STAGE=2) resubmits the app's rejected version. Prints every step."""
import hashlib, json, os, sys, urllib.error, urllib.request
sys.path.insert(0, ".github/scripts")
from apple_signing import token
AUTH = token()
APP, SUB = "6828284417", "6832381876"
STAGE = os.environ.get("STAGE", "1")

def api(path, body=None, method=None):
    url = path if path.startswith("https://") else "https://api.appstoreconnect.apple.com/" + (path if path.startswith("v") else "v1/" + path)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method or ("POST" if body is not None else "GET"), headers={"Authorization": "Bearer " + AUTH, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read(); return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{e.code} {path.split('?')[0]}: {e.read().decode(errors='replace')[:900]}")

def sub_state():
    a = api(f"subscriptions/{SUB}")["data"]["attributes"]
    print("  subscription state:", a.get("state"), "| name:", a.get("name"))
    return a.get("state")

print("Before:"); sub_state()
if STAGE == "1":
    # 1. Review screenshot (replace any old one).
    try:
        for s in (api(f"subscriptions/{SUB}/appStoreReviewScreenshot").get("data") or []) if isinstance(api(f"subscriptions/{SUB}/appStoreReviewScreenshot").get("data"), list) else [api(f"subscriptions/{SUB}/appStoreReviewScreenshot")["data"]]:
            if s: api(f"subscriptionAppStoreReviewScreenshots/{s['id']}", method="DELETE"); print("Removed an old review screenshot.")
    except Exception as e:
        print("  (no old screenshot)", str(e)[:120])
    blob = open("script/fixtures/all-access-subscribe.png", "rb").read()
    shot = api("subscriptionAppStoreReviewScreenshots", {"data": {"type": "subscriptionAppStoreReviewScreenshots", "attributes": {"fileName": "all-access-subscribe.png", "fileSize": len(blob)}, "relationships": {"subscription": {"data": {"type": "subscriptions", "id": SUB}}}}})["data"]
    for op in shot["attributes"]["uploadOperations"]:
        req = urllib.request.Request(op["url"], data=blob[op["offset"]:op["offset"] + op["length"]], method=op["method"], headers={h["name"]: h["value"] for h in op.get("requestHeaders", [])})
        urllib.request.urlopen(req, timeout=300).read()
    api(f"subscriptionAppStoreReviewScreenshots/{shot['id']}", {"data": {"type": "subscriptionAppStoreReviewScreenshots", "id": shot["id"], "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(blob).hexdigest()}}}, method="PATCH")
    print("Uploaded the review screenshot.")
    import time; time.sleep(8); print("After screenshot:"); sub_state()
    # 2. Submit the subscription (with the next app review).
    try:
        r = api("subscriptionSubmissions", {"data": {"type": "subscriptionSubmissions", "relationships": {"subscription": {"data": {"type": "subscriptions", "id": SUB}}}}})
        print("Subscription submitted:", json.dumps(r)[:300])
    except RuntimeError as e:
        print("Subscription submit said:", e)
    print("After submit:"); sub_state()
elif STAGE == "3":
    subs = api("reviewSubmissions?filter[app]=%s&filter[platform]=IOS" % APP)["data"]
    for x in subs: print("  submission", x["id"], x["attributes"].get("state"))
    cand = [x for x in subs if x["attributes"].get("state") in ("READY_FOR_REVIEW", "UNRESOLVED_ISSUES")]
    sid = cand[0]["id"] if cand else None
    print("  using", sid)
    if sid:
        try: print("  items:", json.dumps(api(f"reviewSubmissions/{sid}/items")["data"])[:600])
        except RuntimeError as e: print("  items err", e)
        for kind, rel in (("subscriptions", "subscription"),):
            try:
                r = api("reviewSubmissionItems", {"data": {"type": "reviewSubmissionItems", "relationships": {"reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sid}}, rel: {"data": {"type": kind, "id": SUB}}}}})
                print("  ADDED subscription to the submission:", json.dumps(r)[:300])
            except RuntimeError as e: print("  add said:", e)
    sub_state()
else:
    subs = api("reviewSubmissions?filter[app]=%s&filter[platform]=IOS" % APP)["data"]
    for x in subs: print("  review submission", x["id"], x["attributes"].get("state"))
    open_subs = [x for x in subs if x["attributes"].get("state") in ("UNRESOLVED_ISSUES", "READY_FOR_REVIEW")]
    if open_subs:
        sid = open_subs[0]["id"]
    else:
        v = api(f"apps/{APP}/appStoreVersions?filter[platform]=IOS&limit=3")["data"][0]
        sid = api("reviewSubmissions", {"data": {"type": "reviewSubmissions", "attributes": {"platform": "IOS"}, "relationships": {"app": {"data": {"type": "apps", "id": APP}}}}})["data"]["id"]
        api("reviewSubmissionItems", {"data": {"type": "reviewSubmissionItems", "relationships": {"reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sid}}, "appStoreVersion": {"data": {"type": "appStoreVersions", "id": v["id"]}}}}})
    api(f"reviewSubmissions/{sid}", {"data": {"type": "reviewSubmissions", "id": sid, "attributes": {"submitted": True}}}, method="PATCH")
    print("Resubmitted to App Review:", sid)
    vs = api(f"apps/{APP}/appStoreVersions?filter[platform]=IOS&limit=3")["data"]
    print("Version state:", [(v["attributes"]["versionString"], v["attributes"]["appStoreState"]) for v in vs])
    sub_state()
