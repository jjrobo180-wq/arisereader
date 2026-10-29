"""Find an existing App Store profile for the installed signing certificate.
Read-only Apple API calls; never creates or replaces certificates or profiles.
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

def b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def integer(data, offset):
    if data[offset] != 2:
        raise ValueError("Invalid ECDSA signature")
    length = data[offset + 1]
    value = data[offset + 2:offset + 2 + length]
    return value.lstrip(b"\\0").rjust(32, b"\\0"), offset + 2 + length

def main():
    bundle, output = sys.argv[1:]
    names = ["APP_STORE_CONNECT_API_KEY", "APP_STORE_CONNECT_KEY_ID", "APP_STORE_CONNECT_ISSUER_ID"]
    for name in names:
        if not os.environ.get(name):
            raise RuntimeError(f"Existing credential {name} is unavailable to the release job")
    key_text = os.environ[names[0]]
    if "BEGIN PRIVATE KEY" not in key_text:
        key_text = base64.b64decode(key_text).decode()
    key_path = pathlib.Path(os.environ["RUNNER_TEMP"]) / "profile-api-key.p8"
    key_path.write_text(key_text)
    key_path.chmod(0o600)
    try:
        now = int(time.time())
        header = b64(json.dumps({"alg": "ES256", "kid": os.environ[names[1]], "typ": "JWT"}).encode())
        payload = b64(json.dumps({"iss": os.environ[names[2]], "iat": now, "exp": now + 600, "aud": "appstoreconnect-v1"}).encode())
        message = (header + "." + payload).encode()
        signature = subprocess.run(["openssl", "dgst", "-sha256", "-sign", str(key_path)],
                                   input=message, check=True, capture_output=True).stdout
        offset = 2 if signature[1] < 128 else 2 + (signature[1] & 127)
        r, offset = integer(signature, offset)
        s, offset = integer(signature, offset)
        token = header + "." + payload + "." + b64(r + s)
        original = plistlib.loads((pathlib.Path(os.environ["RUNNER_TEMP"]) / "profile.plist").read_bytes())
        fingerprints = {hashlib.sha256(c).digest() for c in original["DeveloperCertificates"]}
        url = "https://api.appstoreconnect.apple.com/v1/profiles?" + urllib.parse.urlencode({"include": "bundleId", "limit": 200})
        while url:
            if urllib.parse.urlsplit(url).netloc != "api.appstoreconnect.apple.com":
                raise RuntimeError("Unexpected Apple API pagination host")
            request = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    result = json.load(response)
            except urllib.error.HTTPError as error:
                raise RuntimeError(f"Apple profile lookup returned HTTP {error.code}; check existing API key access") from None
            bundles = {x["id"]: x["attributes"]["identifier"] for x in result.get("included", []) if x["type"] == "bundleIds"}
            for profile in result["data"]:
                attrs = profile["attributes"]
                relation = profile["relationships"]["bundleId"]["data"]["id"]
                if bundles.get(relation) != bundle or attrs["profileType"] != "IOS_APP_STORE" or attrs["profileState"] != "ACTIVE":
                    continue
                raw = base64.b64decode(attrs["profileContent"])
                decoded = subprocess.run(["security", "cms", "-D"], input=raw, capture_output=True, check=True).stdout
                details = plistlib.loads(decoded)
                candidate = {hashlib.sha256(c).digest() for c in details["DeveloperCertificates"]}
                if fingerprints & candidate:
                    pathlib.Path(output).write_bytes(raw)
                    print("Reusing existing App Store profile matching bundle ID and current distribution certificate")
                    return
            url = result.get("links", {}).get("next")
        raise RuntimeError("No existing active App Store profile for " + bundle + " includes the current distribution certificate")
    finally:
        key_path.unlink(missing_ok=True)

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("::error::" + str(error), file=sys.stderr)
        sys.exit(1)
