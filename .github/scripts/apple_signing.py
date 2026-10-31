"""Turn on an app's capabilities (Sign in with Apple, HealthKit) on its App ID and get an App Store
provisioning profile that includes them, signed for the SAME distribution certificate as before.

Usage: apple_signing.py <bundle id> <profile.mobileprovision> CAPABILITY [CAPABILITY ...]
  CAPABILITY: APPLE_ID_AUTH (Sign in with Apple), HEALTHKIT or PUSH_NOTIFICATIONS.

Uses the App Store Connect API key the release workflows already have. Never creates, revokes or
replaces a certificate. If anything fails it leaves the profile file as it was and prints a warning,
so a release still builds (just without the missing capability).
"""
import base64
import hashlib
import json
import os
import pathlib
import plistlib
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ENTITLEMENT = {"APPLE_ID_AUTH": "com.apple.developer.applesignin", "HEALTHKIT": "com.apple.developer.healthkit", "PUSH_NOTIFICATIONS": "aps-environment"}
SETTINGS = {"APPLE_ID_AUTH": [{"key": "APPLE_ID_AUTH_APP_CONSENT", "options": [{"key": "PRIMARY_APP_CONSENT"}]}]}


def b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def der_int(data, offset):
    length = data[offset + 1]
    value = data[offset + 2:offset + 2 + length]
    return value.lstrip(b"\0").rjust(32, b"\0"), offset + 2 + length


def token():
    key_text = os.environ["APP_STORE_CONNECT_API_KEY"]
    if "BEGIN PRIVATE KEY" not in key_text:
        key_text = base64.b64decode(key_text).decode()
    key_path = pathlib.Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "signing-api-key.p8"
    key_path.write_text(key_text)
    key_path.chmod(0o600)
    try:
        now = int(time.time())
        head = b64(json.dumps({"alg": "ES256", "kid": os.environ["APP_STORE_CONNECT_KEY_ID"], "typ": "JWT"}).encode())
        body = b64(json.dumps({"iss": os.environ["APP_STORE_CONNECT_ISSUER_ID"], "iat": now, "exp": now + 900, "aud": "appstoreconnect-v1"}).encode())
        sig = subprocess.run(["openssl", "dgst", "-sha256", "-sign", str(key_path)], input=(head + "." + body).encode(), check=True, capture_output=True).stdout
        offset = 2 if sig[1] < 128 else 2 + (sig[1] & 127)
        r, offset = der_int(sig, offset)
        s, _ = der_int(sig, offset)
        return head + "." + body + "." + b64(r + s)
    finally:
        key_path.unlink(missing_ok=True)


def decode_profile(raw):
    return plistlib.loads(subprocess.run(["security", "cms", "-D"], input=raw, capture_output=True, check=True).stdout)


def main():
    bundle, path, caps = sys.argv[1], pathlib.Path(sys.argv[2]), sys.argv[3:]
    current = decode_profile(path.read_bytes())
    want = [ENTITLEMENT[c] for c in caps]
    if all(k in current.get("Entitlements", {}) for k in want):
        print(f"::notice title=Signing::{bundle}: the profile already has {', '.join(caps)}")
        return
    fingerprints = {hashlib.sha256(c).digest() for c in current["DeveloperCertificates"]}
    auth = token()

    def api(p, payload=None, method=None):
        url = p if p.startswith("https://") else "https://api.appstoreconnect.apple.com/v1/" + p
        req = urllib.request.Request(url, method=method, headers={"Authorization": "Bearer " + auth, "Content-Type": "application/json"},
                                     data=json.dumps(payload).encode() if payload is not None else None)
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                return json.load(res)
        except urllib.error.HTTPError as e:
            detail = " ".join(e.read().decode(errors="replace").split())[:600]
            raise RuntimeError(f"Apple API {e.code} on {p.split('?')[0]}: {detail}") from None

    ids = api("bundleIds?" + urllib.parse.urlencode({"filter[identifier]": bundle, "limit": 5}))["data"]
    ids = [x for x in ids if x["attributes"]["identifier"] == bundle]
    if len(ids) != 1:
        raise RuntimeError(f"No single App ID for {bundle}")
    bid = ids[0]["id"]
    have = {x["attributes"]["capabilityType"] for x in api(f"bundleIds/{bid}/bundleIdCapabilities")["data"]}
    for cap in caps:
        if cap in have:
            continue
        attrs = {"capabilityType": cap}
        if cap in SETTINGS:
            attrs["settings"] = SETTINGS[cap]
        rel = {"bundleId": {"data": {"type": "bundleIds", "id": bid}}}
        try:
            api("bundleIdCapabilities", {"data": {"type": "bundleIdCapabilities", "attributes": attrs, "relationships": rel}})
        except RuntimeError as error:
            if "settings" not in attrs:
                raise
            # Apple sometimes refuses the consent setting; the capability alone is enough for an app.
            print(f"::warning title=Signing::{error}. Trying {cap} without settings.")
            api("bundleIdCapabilities", {"data": {"type": "bundleIdCapabilities", "attributes": {"capabilityType": cap}, "relationships": rel}})
        print(f"::notice title=Signing::Turned on {cap} for {bundle}")

    # A profile made after the capabilities changed, for the same certificate.
    url = f"bundleIds/{bid}/profiles"
    chosen = None
    while url and not chosen:
        page = api(url)
        for prof in page["data"]:
            a = prof["attributes"]
            if a.get("profileType") != "IOS_APP_STORE" or a.get("profileState") != "ACTIVE":
                continue
            raw = base64.b64decode(a["profileContent"])
            d = decode_profile(raw)
            if fingerprints & {hashlib.sha256(c).digest() for c in d["DeveloperCertificates"]} and all(k in d.get("Entitlements", {}) for k in want):
                chosen = raw
                break
        url = page.get("links", {}).get("next")
    if not chosen:
        certs = api("certificates?limit=200")["data"]
        match = [c for c in certs if c["attributes"]["certificateType"] in ("DISTRIBUTION", "IOS_DISTRIBUTION")
                 and hashlib.sha256(base64.b64decode(c["attributes"]["certificateContent"])).digest() in fingerprints]
        if not match:
            raise RuntimeError("The current distribution certificate isn't in the Apple account; nothing changed")
        made = api("profiles", {"data": {"type": "profiles", "attributes": {"name": f"{bundle} App Store {int(time.time())}", "profileType": "IOS_APP_STORE"},
                                         "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": bid}},
                                                           "certificates": {"data": [{"type": "certificates", "id": match[0]["id"]}]}}}})
        chosen = base64.b64decode(made["data"]["attributes"]["profileContent"])
        print(f"::notice title=Signing::Made a new App Store profile for {bundle} with {', '.join(caps)}")
    d = decode_profile(chosen)
    missing = [k for k in want if k not in d.get("Entitlements", {})]
    if missing:
        raise RuntimeError(f"The new profile still lacks {', '.join(missing)}")
    path.write_bytes(chosen)
    print(f"::notice title=Signing::{bundle}: using a profile with {', '.join(caps)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # never stop the release over this
        print(f"::warning title=Signing::{error}. Building with the existing profile instead.")
