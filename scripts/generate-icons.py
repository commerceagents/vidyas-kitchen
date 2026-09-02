"""
Regenerates the PWA icon set from public/vk-logo.png.

Two constraints shape this:

1. Android masks home screen icons to its own shape (circle, squircle, rounded
   square — the launcher decides). An icon without `purpose: "maskable"` is
   treated as legacy art and shrunk onto a white circle, so we ship maskable
   variants and keep the artwork inside the safe zone.

2. The source logo is a disc whose red background carries a diagonal gradient.
   Dropped onto a flat canvas that gradient reads as a visible square and a
   circle seam inside the tile. So the background red is flattened to the brand
   red first and the canvas is painted the same colour — the disc edge then
   disappears and the icon reads as one solid red tile with the artwork on it.

Run: python3 scripts/generate-icons.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
SOURCE = PUBLIC / "vk-logo.png"

BRAND_RED = (189, 35, 32)  # #BD2320

# Android guarantees only the middle ~66% of a maskable icon is visible. 0.80
# keeps the logo ring inside that on every launcher shape while still letting
# the red run to the edge.
MASKABLE_ART = 0.80
# Nothing crops the plain icons (iOS just rounds the corners), so the artwork
# can sit closer to the edge.
PLAIN_ART = 0.92


def flatten_background(img: Image.Image) -> Image.Image:
    """Repaint the logo's gradient backdrop as a single flat red.

    Selects strongly-red, low-green/blue pixels. The artwork that must survive
    is white (hat, text), skin, orange (saree) and blue/grey (phone, cloche) —
    all of which have far more green and blue than the backdrop does.
    """
    arr = np.array(img.convert("RGBA"))
    rgb = arr[..., :3].astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]

    backdrop = (r > 120) & (g < 80) & (b < 80) & ((r - g) > 70) & ((r - b) > 70)
    arr[..., :3][backdrop] = BRAND_RED
    return Image.fromarray(arr, "RGBA")


def compose(art: Image.Image, size: int, art_fraction: float) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (*BRAND_RED, 255))
    inner = max(1, int(size * art_fraction))
    scaled = art.resize((inner, inner), Image.LANCZOS)
    offset = (size - inner) // 2
    # Paste through the alpha channel so the disc's anti-aliased rim blends into
    # the identical red behind it rather than leaving a hard edge.
    canvas.paste(scaled, (offset, offset), scaled)
    return canvas.convert("RGB")


def trim_rim(img: Image.Image, pixels: int = 9) -> Image.Image:
    """Erode the disc's outer edge.

    The source disc is finished with a darker rim and a soft anti-aliased
    fringe. Neither is brand red, so both survive `flatten_background` and draw
    a faint ring on the finished tile. Shrinking the alpha slightly drops them
    and lets the flat red behind show through instead.
    """
    arr = np.array(img.convert("RGBA"))
    alpha = Image.fromarray(arr[..., 3], "L").filter(ImageFilter.MinFilter(pixels))
    arr[..., 3] = np.array(alpha)
    return Image.fromarray(arr, "RGBA")


def squared(img: Image.Image) -> Image.Image:
    """Pad to a square around the artwork so nothing is stretched."""
    if img.width == img.height:
        return img
    side = max(img.width, img.height)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
    return canvas


def main() -> None:
    art = squared(trim_rim(flatten_background(Image.open(SOURCE))))
    print(f"source {art.width}x{art.height}, brand red #{'%02X%02X%02X' % BRAND_RED}")

    outputs = {
        "icon-192.png": compose(art, 192, PLAIN_ART),
        "icon-512.png": compose(art, 512, PLAIN_ART),
        # iOS never masks; it only rounds the corners.
        "apple-touch-icon.png": compose(art, 180, PLAIN_ART),
        "icon-maskable-192.png": compose(art, 192, MASKABLE_ART),
        "icon-maskable-512.png": compose(art, 512, MASKABLE_ART),
    }

    for name, image in outputs.items():
        path = PUBLIC / name
        image.save(path, "PNG", optimize=True)
        print(f"  wrote {name} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
