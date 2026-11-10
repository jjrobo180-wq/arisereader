"""The App Store Connect API calls the App Store scripts share."""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from apple_signing import token  # noqa: E402

AUTH = token()


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
        text = e.read().decode(errors="replace")
        raise RuntimeError(f"{e.code} {method or 'GET'} {path.split('?')[0]}: {text[:600]}")


def q(path, **params):
    return api(path + ("?" + urllib.parse.urlencode(params) if params else ""))
