"""Sets an app's App Store promotional text: the short paragraph above the description. Apple shows a
change right away, with no review and no new version. Run by app-store-promo.yml.
Env: BUNDLE (the app's bundle id), PROMO (up to 170 characters).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from app_store_fill_api import api, q  # noqa: E402

BUNDLE = os.environ.get("BUNDLE", "com.arisereader.reader")
PROMO = " ".join(os.environ.get("PROMO", "").split())
if not PROMO or len(PROMO) > 170:
    sys.exit(f"Promotional text must be 1 to 170 characters (got {len(PROMO)}).")
app = q("apps", **{"filter[bundleId]": BUNDLE})["data"]
if not app:
    sys.exit(f"No app with bundle id {BUNDLE}.")
APP = app[0]["id"]
# The live version, plus any version being prepared, so the next update keeps the same text.
states = {"READY_FOR_SALE", "PREPARE_FOR_SUBMISSION", "WAITING_FOR_REVIEW", "IN_REVIEW", "PENDING_DEVELOPER_RELEASE", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED"}
versions = [v for v in q(f"apps/{APP}/appStoreVersions", **{"filter[platform]": "IOS", "limit": "10"})["data"] if v["attributes"]["appStoreState"] in states]
if not versions:
    sys.exit("No live or editable version found.")
failed = 0
for v in versions:
    vs, state = v["attributes"]["versionString"], v["attributes"]["appStoreState"]
    for loc in q(f"appStoreVersions/{v['id']}/appStoreVersionLocalizations")["data"]:
        try:
            api(f"appStoreVersionLocalizations/{loc['id']}", {"data": {"type": "appStoreVersionLocalizations", "id": loc["id"], "attributes": {"promotionalText": PROMO}}}, method="PATCH")
            print(f"ok   {vs} ({state}, {loc['attributes']['locale']}): {PROMO}")
        except Exception as e:
            failed += 1
            print(f"FAIL {vs} ({state}, {loc['attributes']['locale']}): {e}")
sys.exit(1 if failed and failed >= len(versions) else 0)
