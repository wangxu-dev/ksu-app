#!/usr/bin/env python3
"""
Generate Electron icons from public/ksu.png.

Outputs:
  - build/icons/icon.ico   (Windows)
  - build/icons/icon.icns  (macOS)
  - build/icons/icon.png   (512x512)
  - build/icons/png/*.png  (multi-size)
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Missing dependency: Pillow")
    print("Install with: pip install pillow")
    sys.exit(1)


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "ksu.png"
OUT_DIR = ROOT / "build" / "icons"
OUT_PNG_DIR = OUT_DIR / "png"

BASE_CANVAS = 1024
CONTENT_SCALE = 0.8046875  # 824 / 1024
CORNER_RADIUS = 0.12  # 12%
BACKGROUND = (255, 255, 255, 255)

PNG_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
ICO_SIZES = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]


def rounded_rect_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = Image.new("L", (size, size), 0)
    from PIL import ImageDraw

    d = ImageDraw.Draw(draw)
    d.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, fill=255)
    mask.paste(draw)
    return mask


def build_master_icon(source: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (BASE_CANVAS, BASE_CANVAS), (0, 0, 0, 0))

    bg = Image.new("RGBA", (BASE_CANVAS, BASE_CANVAS), BACKGROUND)
    radius = int(BASE_CANVAS * CORNER_RADIUS)
    bg_mask = rounded_rect_mask(BASE_CANVAS, radius)
    canvas.paste(bg, (0, 0), bg_mask)

    target = int(BASE_CANVAS * CONTENT_SCALE)
    content = source.resize((target, target), Image.Resampling.LANCZOS)
    offset = ((BASE_CANVAS - target) // 2, (BASE_CANVAS - target) // 2)
    canvas.paste(content, offset, content)
    return canvas


def main() -> None:
    if not SOURCE.exists():
        print(f"Source icon not found: {SOURCE}")
        sys.exit(1)

    OUT_PNG_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")
    master = build_master_icon(source)

    for size in PNG_SIZES:
        out = master.resize((size, size), Image.Resampling.LANCZOS)
        out.save(OUT_PNG_DIR / f"icon-{size}.png", "PNG")
        print(f"Generated PNG: build/icons/png/icon-{size}.png")

    master.resize((512, 512), Image.Resampling.LANCZOS).save(OUT_DIR / "icon.png", "PNG")
    print("Generated PNG: build/icons/icon.png")

    master.save(OUT_DIR / "icon.ico", "ICO", sizes=ICO_SIZES)
    print("Generated ICO: build/icons/icon.ico")

    master.save(OUT_DIR / "icon.icns", "ICNS")
    print("Generated ICNS: build/icons/icon.icns")

    print("Done.")


if __name__ == "__main__":
    main()
