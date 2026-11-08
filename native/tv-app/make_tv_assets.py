"""Makes an Apple TV app's icon and Top Shelf images from the app's 1024px icon. tvOS icons are layered
(the parallax tilt): an opaque back in the icon's own background colour and the app's mark in front.
    python3 native/tv-app/make_tv_assets.py                      (Pod+: native/tv-app/Assets.xcassets)
    python3 native/tv-app/make_tv_assets.py <icon.png> <out.xcassets>"""
import json, pathlib, sys
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "native/tv-app/Assets.xcassets"
ICON = Image.open(sys.argv[1] if len(sys.argv) > 1 else ROOT / "client/public/app-icons/podplus-1024.png").convert("RGB")
CREAM = ICON.getpixel((512, 40))
INFO = {"author": "xcode", "version": 1}

def mark(h):
    """The Pod+ mark, h pixels tall, with rounded corners."""
    m = ICON.resize((h, h), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (h, h), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, h - 1, h - 1), radius=int(h * 0.22), fill=255)
    m.putalpha(mask)
    return m

def back(w, h):
    return Image.new("RGB", (w, h), CREAM)

def front(w, h, scale):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    m = mark(int(h * scale))
    im.paste(m, ((w - m.width) // 2, (h - m.height) // 2), m)
    return im

def flat(w, h, scale):
    im = back(w, h).convert("RGBA")
    m = mark(int(h * scale))
    im.alpha_composite(m, ((w - m.width) // 2, (h - m.height) // 2))
    return im.convert("RGB")

def write(path, data):
    path.mkdir(parents=True, exist_ok=True)
    (path / "Contents.json").write_text(json.dumps(data, indent=1))

def imageset(path, sizes, make):
    images = []
    for scale, (w, h) in sizes.items():
        name = f"{scale}.png"
        path.mkdir(parents=True, exist_ok=True)
        make(w, h).save(path / name, optimize=True)
        images.append({"idiom": "tv", "scale": scale, "filename": name})
    write(path, {"images": images, "info": INFO})

def stack(path, sizes):
    for layer, make in (("Front", lambda w, h: front(w, h, 0.8)), ("Back", back)):
        lp = path / f"{layer}.imagestacklayer"
        write(lp, {"info": INFO})
        imageset(lp / "Content.imageset", sizes, make)
    write(path, {"info": INFO, "layers": [{"filename": "Front.imagestacklayer"}, {"filename": "Back.imagestacklayer"}]})

brand = OUT / "App Icon & Top Shelf Image.brandassets"
write(OUT, {"info": INFO})
stack(brand / "App Icon - App Store.imagestack", {"1x": (1280, 768)})
stack(brand / "App Icon.imagestack", {"1x": (400, 240), "2x": (800, 480)})
imageset(brand / "Top Shelf Image.imageset", {"1x": (1920, 720), "2x": (3840, 1440)}, lambda w, h: flat(w, h, 0.6))
imageset(brand / "Top Shelf Image Wide.imageset", {"1x": (2320, 720), "2x": (4640, 1440)}, lambda w, h: flat(w, h, 0.6))
write(brand, {"assets": [
    {"filename": "App Icon - App Store.imagestack", "idiom": "tv", "role": "primary-app-icon", "size": "1280x768"},
    {"filename": "App Icon.imagestack", "idiom": "tv", "role": "primary-app-icon", "size": "400x240"},
    {"filename": "Top Shelf Image Wide.imageset", "idiom": "tv", "role": "top-shelf-image-wide", "size": "2320x720"},
    {"filename": "Top Shelf Image.imageset", "idiom": "tv", "role": "top-shelf-image", "size": "1920x720"},
], "info": INFO})
print("wrote", OUT)
