"""Sets an app's name on the App Store (the title under the icon in the store, up to 30 characters).
Apple only takes a new name while the app info is editable: before the app's first release, or with an
update being prepared. The name on the home screen is set in the app itself (CFBundleDisplayName).
Run by app-store-name.yml. Env: BUNDLE (the app's bundle id), NAME.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from app_store_fill_api import api, q  # noqa: E402

BUNDLE = os.environ.get("BUNDLE", "")
NAME = " ".join(os.environ.get("NAME", "").split())
if not NAME or len(NAME) > 30:
    sys.exit(f"The App Store name must be 1 to 30 characters (got {len(NAME)}).")
app = q("apps", **{"filter[bundleId]": BUNDLE})["data"]
if not app:
    sys.exit(f"No app with bundle id {BUNDLE}.")
APP = app[0]["id"]
print(f"     app {app[0]['attributes']['name']} ({BUNDLE})")
infos = q(f"apps/{APP}/appInfos")["data"]
# The app info that can still change (the live one is locked until an update is being prepared).
editable = [i for i in infos if i["attributes"].get("appStoreState") != "READY_FOR_SALE"] or infos
failed = done = 0
for info in editable:
    for loc in q(f"appInfos/{info['id']}/appInfoLocalizations")["data"]:
        try:
            api(f"appInfoLocalizations/{loc['id']}", {"data": {"type": "appInfoLocalizations", "id": loc["id"], "attributes": {"name": NAME}}}, method="PATCH")
            done += 1
            print(f"ok   {loc['attributes']['locale']}: {NAME}")
        except Exception as e:
            failed += 1
            print(f"FAIL {loc['attributes']['locale']}: {e}")
sys.exit(0 if done else 1)
