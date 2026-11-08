"""Adds Apple TV (tvOS) to an app's App Store listing, if it isn't there yet, by starting a tvOS
version (the same as "Add Platform" in App Store Connect). One listing, one purchase on every device.
Usage: add_tvos_platform.py <bundle id> [version]. Uses the App Store Connect API key."""
import json, sys, urllib.error, urllib.parse, urllib.request
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from apple_signing import token

bundle, version = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "1.0")
auth = token()

def api(p, payload=None):
    req = urllib.request.Request("https://api.appstoreconnect.apple.com/v1/" + p, headers={"Authorization": "Bearer " + auth, "Content-Type": "application/json"},
                                 data=json.dumps(payload).encode() if payload is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.load(res)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Apple API {e.code}: {' '.join(e.read().decode(errors='replace').split())[:500]}") from None

try:
    apps = api("apps?" + urllib.parse.urlencode({"filter[bundleId]": bundle}))["data"]
    if not apps:
        raise RuntimeError(f"no app record for {bundle}")
    app = apps[0]["id"]
    have = api(f"apps/{app}/appStoreVersions?" + urllib.parse.urlencode({"filter[platform]": "TV_OS", "limit": 1}))["data"]
    if have:
        print(f"::notice title=Apple TV::{bundle} already has Apple TV on its listing")
    else:
        api("appStoreVersions", {"data": {"type": "appStoreVersions", "attributes": {"platform": "TV_OS", "versionString": version},
                                          "relationships": {"app": {"data": {"type": "apps", "id": app}}}}})
        print(f"::notice title=Apple TV::Added Apple TV to the {bundle} listing (tvOS {version})")
except Exception as error:
    print(f"::warning title=Apple TV::{error}")
