"""
Regenerates the PWA icon set from public/vk_logo_full.png.

Android applies an adaptive-icon mask to home screen icons. An icon that does
not declare `purpose: "maskable"` is treated as legacy art: Chrome shrinks it
and drops it on a white circle, which is why the installed icon looked like a
small logo floating on white instead of a full-bleed tile.

A maskable icon must therefore keep everything meaningful inside the central
"safe zone", because the launcher is free to crop to a circle, squircle or
rounded square depending on the device. The source logo's ring reaches ~92% of
its width, so it is scaled down onto a solid brand-red canvas rather than used
edge-to-edge.

Run: python3 scripts/generate-icons.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
SOURCE = PUBLIC / "vk_logo_full.png"

# Fraction of the canvas the artwork may occupy on a maskable icon. Android's
# guidance is a 108dp layer with only the middle 72dp guaranteed visible (~66%);
# 78% keeps the logo ring comfortably inside that while still filling the tile.
SAFE_ZONE = 0.78


def brand_red(img: Image.Image) -> tuple[int, int, int]:
    """Sample the logo's own background so the padding is seamless."""
    return img.convert("RGB").getpixel((6, 6))


def square(img: Image.Image, fill: tuple[int, int, int]) -> Image.Image:
    """Pad to a square so non-square sources don't get stretched."""
    if img.width == img.height:
        return img
    side = max(img.width, img.height)
    canvas = Image.new("RGB", (side, side), fill)
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
    return canvas


def plain(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), Image.LANCZOS)


def maskable(img: Image.Image, size: int, fill: tuple[int, int, int]) -> Image.Image:
    canvas = Image.new("RGB", (size, size), fill)
    inner = max(1, int(size * SAFE_ZONE))
    art = img.resize((inner, inner), Image.LANCZOS)
    offset = (size - inner) // 2
    canvas.paste(art, (offset, offset))
    return canvas


def main() -> None:
    src = Image.open(SOURCE).convert("RGB")
    red = brand_red(src)
    src = square(src, red)
    print(f"source {src.width}x{src.height}, brand red #{red[0]:02X}{red[1]:02X}{red[2]:02X}")

    outputs = {
        "icon-192.png": plain(src, 192),
        "icon-512.png": plain(src, 512),
        # iOS never masks; it just rounds the corners, so the full-bleed art is
        # already correct there.
        "apple-touch-icon.png": plain(src, 180),
        "icon-maskable-192.png": maskable(src, 192, red),
        "icon-maskable-512.png": maskable(src, 512, red),
    }

    for name, image in outputs.items():
        path = PUBLIC / name
        image.save(path, "PNG", optimize=True)
        print(f"  wrote {name} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
