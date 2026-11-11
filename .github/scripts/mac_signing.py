"""Signing for the Arise To Duo Mac app (mac/), with only the App Store Connect API key the iPhone
workflows already use. No certificate has to be made by hand.

  mac_signing.py prepare <bundle id> <signing.p12> <p12 password> <out dir>
      - adds macOS to the app's App Store listing (like "Add Platform") if it isn't there yet
      - the app is signed with the team's existing Apple Distribution certificate (the .p12) when it
        can sign Mac apps; otherwise a Mac App Distribution certificate is made just for this build
      - makes a Mac Installer Distribution certificate just for this build (it only signs the .pkg
        that is uploaded) and imports both into the keychain the workflow made (KEYCHAIN)
      - gets a Mac App Store provisioning profile for <bundle id> with that app certificate
      Writes <out>/mac.provisionprofile and <out>/made-certs.txt (the ids to revoke afterwards).
  mac_signing.py revoke <out dir>
      - revokes the certificates "prepare" made. Apps already uploaded or on the store are unaffected.
"""
import base64
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from apple_signing import token  # noqa: E402

AUTH = None


def api(p, payload=None, method=None):
    global AUTH
    AUTH = AUTH or token()
    url = p if p.startswith("https://") else "https://api.appstoreconnect.apple.com/v1/" + p
    req = urllib.request.Request(url, method=method, headers={"Authorization": "Bearer " + AUTH, "Content-Type": "application/json"},
                                 data=json.dumps(payload).encode() if payload is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            body = res.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Apple API {e.code} on {p.split('?')[0]}: {' '.join(e.read().decode(errors='replace').split())[:600]}") from None


def run(*cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, **kw).stdout


def p12_cert_der(p12, password):
    for extra in ([], ["-legacy"]):
        try:
            pem = run("openssl", "pkcs12", *extra, "-in", p12, "-nokeys", "-clcerts", "-passin", f"pass:{password}")
            return run("openssl", "x509", "-outform", "DER", input=pem)
        except subprocess.CalledProcessError:
            continue
    raise RuntimeError("couldn't read the certificate in the .p12")


def make_cert(kind, out, keychain):
    """A new certificate of <kind> with a fresh private key, imported into the keychain. Returns its id."""
    key, csr = out / f"{kind}.key", out / f"{kind}.csr"
    run("openssl", "req", "-new", "-newkey", "rsa:2048", "-nodes", "-keyout", str(key), "-out", str(csr),
        "-subj", "/emailAddress=support@arisetodo.com/CN=Arise To Duo Mac build/C=US")
    csr_body = "".join(l for l in csr.read_text().splitlines() if "-----" not in l)
    made = api("certificates", {"data": {"type": "certificates", "attributes": {"certificateType": kind, "csrContent": csr_body}}})
    cid = made["data"]["id"]
    der = base64.b64decode(made["data"]["attributes"]["certificateContent"])
    cer = out / f"{kind}.cer"
    cer.write_bytes(der)
    pem_cert = run("openssl", "x509", "-inform", "DER", "-in", str(cer))
    (out / f"{kind}.pem").write_bytes(pem_cert)
    p12 = out / f"{kind}.p12"
    for extra in (["-legacy"], []):
        try:
            run("openssl", "pkcs12", "-export", *extra, "-inkey", str(key), "-in", str(out / f"{kind}.pem"), "-out", str(p12), "-passout", "pass:build")
            break
        except subprocess.CalledProcessError:
            continue
    run("security", "import", str(p12), "-k", keychain, "-P", "build", "-T", "/usr/bin/codesign", "-T", "/usr/bin/productbuild", "-T", "/usr/bin/pkgbuild")
    with open(out / "made-certs.txt", "a") as f:
        f.write(cid + "\n")
    print(f"::notice title=Mac signing::Made a {kind} certificate for this build ({cid}); it is revoked when the build ends")
    return cid, der


def prepare(bundle, p12, password, out_dir):
    out = pathlib.Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    keychain = os.environ["KEYCHAIN"]

    # macOS on the same listing as the iPhone app (one purchase on every device).
    apps = api("apps?" + urllib.parse.urlencode({"filter[bundleId]": bundle}))["data"]
    if not apps:
        raise RuntimeError(f"no App Store Connect app for {bundle}")
    app_id = apps[0]["id"]
    have = api(f"apps/{app_id}/appStoreVersions?" + urllib.parse.urlencode({"filter[platform]": "MAC_OS", "limit": 1}))["data"]
    if not have:
        api("appStoreVersions", {"data": {"type": "appStoreVersions", "attributes": {"platform": "MAC_OS", "versionString": "1.0"},
                                          "relationships": {"app": {"data": {"type": "apps", "id": app_id}}}}})
        print(f"::notice title=Mac::Added macOS to the {bundle} listing (1.0)")

    ids = [x for x in api("bundleIds?" + urllib.parse.urlencode({"filter[identifier]": bundle, "limit": 5}))["data"] if x["attributes"]["identifier"] == bundle]
    if len(ids) != 1:
        raise RuntimeError(f"no single App ID for {bundle}")
    bid = ids[0]["id"]

    # The app certificate: the team's Apple Distribution certificate signs Mac apps too.
    fp = hashlib.sha256(p12_cert_der(p12, password)).digest()
    certs = api("certificates?limit=200")["data"]
    mine = [c for c in certs if hashlib.sha256(base64.b64decode(c["attributes"]["certificateContent"])).digest() == fp]
    if mine and mine[0]["attributes"]["certificateType"] == "DISTRIBUTION":
        app_cert = mine[0]["id"]
        run("security", "import", p12, "-k", keychain, "-P", password, "-T", "/usr/bin/codesign")
        print("::notice title=Mac signing::Signing the app with the existing Apple Distribution certificate")
    else:
        app_cert, _ = make_cert("MAC_APP_DISTRIBUTION", out, keychain)
    make_cert("MAC_INSTALLER_DISTRIBUTION", out, keychain)
    run("security", "set-key-partition-list", "-S", "apple-tool:,apple:,codesign:,productbuild:", "-s", "-k", "", keychain)

    # A Mac App Store profile for that certificate.
    prof = api("profiles", {"data": {"type": "profiles", "attributes": {"name": f"{bundle} Mac App Store {int(time.time())}", "profileType": "MAC_APP_STORE"},
                                     "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": bid}},
                                                       "certificates": {"data": [{"type": "certificates", "id": app_cert}]}}}})
    (out / "mac.provisionprofile").write_bytes(base64.b64decode(prof["data"]["attributes"]["profileContent"]))
    with open(out / "made-profiles.txt", "a") as f:
        f.write(prof["data"]["id"] + "\n")
    print(f"::notice title=Mac signing::Made a Mac App Store profile for {bundle}")


def revoke(out_dir):
    out = pathlib.Path(out_dir)
    for name, path in (("profiles", out / "made-profiles.txt"), ("certificates", out / "made-certs.txt")):
        if not path.exists():
            continue
        for x in path.read_text().split():
            try:
                api(f"{name}/{x}", method="DELETE")
                print(f"Removed {name[:-1]} {x}")
            except Exception as error:
                print(f"::warning title=Mac signing::Couldn't remove {name[:-1]} {x}: {error}")


if __name__ == "__main__":
    if sys.argv[1] == "prepare":
        prepare(*sys.argv[2:6])
    else:
        revoke(sys.argv[2])
