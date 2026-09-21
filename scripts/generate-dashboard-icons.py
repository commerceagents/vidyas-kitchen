"""
Generates the VK Dashboard PWA icon set from scripts/assets/dashboard-icon-raw.png.

Produces:
- public/dashboard-icon-192.png
- public/dashboard-icon-512.png
- public/dashboard-apple-touch.png (180x180)
- public/dashboard-icon-maskable-192.png
- public/dashboard-icon-maskable-512.png
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
SOURCE = ROOT / "scripts" / "assets" / "dashboard-icon-raw.png"

BG_COLOR = (10, 11, 15)  # #0a0b0f deep obsidian

PLAIN_SCALE = 0.94
MASKABLE_SCALE = 0.72


def compose(img: Image.Image, size: int, scale_factor: float) -> Image.Image:
    canvas = Image.new("RGB", (size, size), BG_COLOR)
    target_dim = round(size * scale_factor)
    scaled = img.resize((target_dim, target_dim), Image.LANCZOS)
    offset = (size - target_dim) // 2
    canvas.paste(scaled, (offset, offset))
    return canvas


def main() -> None:
    src = Image.open(SOURCE).convert("RGB")
    print(f"Loaded source image {src.size}")

    outputs = {
        "dashboard-icon-192.png": compose(src, 192, PLAIN_SCALE),
        "dashboard-icon-512.png": compose(src, 512, PLAIN_SCALE),
        "dashboard-apple-touch.png": compose(src, 180, PLAIN_SCALE),
        "dashboard-icon-maskable-192.png": compose(src, 192, MASKABLE_SCALE),
        "dashboard-icon-maskable-512.png": compose(src, 512, MASKABLE_SCALE),
    }

    for name, image in outputs.items():
        path = PUBLIC / name
        image.save(path, "PNG", optimize=True)
        print(f"  wrote {name} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
