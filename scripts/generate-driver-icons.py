"""
Regenerates the VK's Driver icon set from scripts/assets/driver-character.png.

The first driver icon was the logo disc with "VK's Driver" curved around it, and
launchers cropped the wording off. Two things fix that here:

1. No text. The launcher already prints the app name under the tile, so the icon
   only carries the rider.

2. The maskable variants keep the whole rider inside the centred square that
   survives every launcher shape. Android only guarantees a circle of 80% of the
   tile, and the largest square inside that circle is ~57% of the tile — so
   that, not the full canvas, is what the artwork is fitted to.

Run: python3 scripts/generate-driver-icons.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
SOURCE = Path(__file__).resolve().parent / "assets" / "driver-character.png"

BRAND_RED = (189, 35, 32)  # #BD2320

# Fraction of the tile the artwork's bounding box is allowed to fill.
MASKABLE_ART = 0.60  # always visible, whatever shape the launcher masks to
PLAIN_ART = 0.88  # iOS and the notification tray only round the corners


def isolate_rider(img: Image.Image) -> Image.Image:
    """Drop the generated backdrop so the rider can be re-centred on flat red.

    Keying purely on colour also ate the red delivery bag and left it speckled,
    because the bag and the backdrop are close to the same red. So the match is
    flood-filled inward from the border instead: only backdrop that is actually
    connected to an edge is removed, and the bag — walled in by its own black
    outline — is untouched.
    """
    arr = np.array(img.convert("RGBA"))
    rgb = arr[..., :3].astype(int)
    is_backdrop = np.abs(rgb - np.array(BRAND_RED)).sum(axis=-1) < 90

    height, width = is_backdrop.shape
    outside = np.zeros_like(is_backdrop)
    stack = [
        (y, x)
        for y in range(height)
        for x in (0, width - 1)
        if is_backdrop[y, x]
    ] + [
        (y, x)
        for x in range(width)
        for y in (0, height - 1)
        if is_backdrop[y, x]
    ]

    # Row-wise scanline fill: cheap enough at 1024px and avoids a SciPy import.
    while stack:
        y, x = stack.pop()
        if outside[y, x] or not is_backdrop[y, x]:
            continue
        left = x
        while left > 0 and is_backdrop[y, left - 1] and not outside[y, left - 1]:
            left -= 1
        right = x
        while right < width - 1 and is_backdrop[y, right + 1] and not outside[y, right + 1]:
            right += 1
        outside[y, left : right + 1] = True
        for ny in (y - 1, y + 1):
            if 0 <= ny < height:
                for nx in range(left, right + 1):
                    if is_backdrop[ny, nx] and not outside[ny, nx]:
                        stack.append((ny, nx))

    arr[..., 3] = np.where(outside, 0, arr[..., 3])
    return Image.fromarray(arr, "RGBA")


def crop_to_art(img: Image.Image) -> Image.Image:
    box = img.getbbox()
    return img.crop(box) if box else img


def compose(art: Image.Image, size: int, art_fraction: float) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (*BRAND_RED, 255))
    budget = size * art_fraction
    scale = min(budget / art.width, budget / art.height)
    scaled = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.LANCZOS)
    canvas.paste(
        scaled,
        ((size - scaled.width) // 2, (size - scaled.height) // 2),
        scaled,
    )
    return canvas.convert("RGB")


def main() -> None:
    art = crop_to_art(isolate_rider(Image.open(SOURCE)))
    print(f"rider {art.width}x{art.height}")

    outputs = {
        "driver-icon-192.png": compose(art, 192, PLAIN_ART),
        "driver-icon-512.png": compose(art, 512, PLAIN_ART),
        "driver-apple-touch.png": compose(art, 180, PLAIN_ART),
        "driver-icon-maskable-192.png": compose(art, 192, MASKABLE_ART),
        "driver-icon-maskable-512.png": compose(art, 512, MASKABLE_ART),
    }

    for name, image in outputs.items():
        path = PUBLIC / name
        image.save(path, "PNG", optimize=True)
        print(f"  wrote {name} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
