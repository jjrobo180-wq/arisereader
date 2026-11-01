"""Live updates (no App Store build): sets up the updater in an iPhone app's capacitor.config.json.

Each app (Arise To Duo, Pod+, A.R.I.S.E. Reader, Reader Educator, Arise Fit) asks
https://arisetodo.com/api/ota/<app> each time it opens whether a newer copy of its web code exists
(server/ota.ts). A new copy downloads in the background and is used the next time the app opens; if
it fails to start (no "ready" within 15 seconds, see client/src/lib/nativeApp.ts markAppReady), the
app goes back to the copy that worked. A new App Store build always starts from its own copy.

The version is "<native level>.<minutes since 1970 at build>.0": the major is the native level
(.github/ota/native-level, raised whenever the native shell changes: plugins, Info.plist, icons), so
an app only gets web code built for its own shell; the minor is when it was built, so it never gets
web code older than what it shipped with.

Usage (from the app's ios-app folder): python3 ../../.github/scripts/ota_setup.py todo
"""
import json
import os
import sys
import time

APP = sys.argv[1]
assert APP in ("todo", "podplus", "reader", "educator", "fit", "eyegaze"), APP
here = os.path.dirname(os.path.abspath(__file__))
level = int(open(os.path.join(here, "..", "ota", "native-level")).read().strip())
version = f"{level}.{int(time.time() // 60)}.0"
path = "capacitor.config.json"
cfg = json.load(open(path))
url = f"https://arisetodo.com/api/ota/{APP}"
cfg.setdefault("plugins", {})["CapacitorUpdater"] = {
    "autoUpdate": True,
    "updateUrl": url,
    "channelUrl": url,
    "statsUrl": "",
    "version": version,
    "appReadyTimeout": 15000,
    "responseTimeout": 20000,
    "autoDeleteFailed": True,
    "autoDeletePrevious": True,
    "resetWhenUpdate": True,
}
json.dump(cfg, open(path, "w"), indent=2)
print(f"Live updates: {APP} {version} from {url}")
