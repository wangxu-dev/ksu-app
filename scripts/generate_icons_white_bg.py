from PIL import Image
import os

# Source and output
SOURCE = "public/ksu.png"
OUTPUT_DIR = "src-tauri/icons"

# Visual tuning
CANVAS_SIZE = 1024
CONTENT_SCALE = 0.84  # 0.84 means the icon body occupies 84% of the canvas
BACKGROUND_COLOR = (255, 255, 255, 255)  # White

# Tauri icon targets
ICONS = {
    "32x32.png": 32,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 512,
    "Square30x30Logo.png": 30,
    "Square44x44Logo.png": 44,
    "Square71x71Logo.png": 71,
    "Square89x89Logo.png": 89,
    "Square107x107Logo.png": 107,
    "Square142x142Logo.png": 142,
    "Square150x150Logo.png": 150,
    "Square284x284Logo.png": 284,
    "Square310x310Logo.png": 310,
    "StoreLogo.png": 50,
}

ICO_SIZES = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]


def make_master_icon(source_img: Image.Image) -> Image.Image:
    """
    Create a 1024x1024 white-background icon with centered, scaled content.
    """
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), BACKGROUND_COLOR)

    target_size = int(CANVAS_SIZE * CONTENT_SCALE)
    resized = source_img.resize((target_size, target_size), Image.Resampling.LANCZOS)

    offset = ((CANVAS_SIZE - target_size) // 2, (CANVAS_SIZE - target_size) // 2)
    canvas.paste(resized, offset, resized)
    return canvas


def main() -> None:
    source_img = Image.open(SOURCE).convert("RGBA")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    master = make_master_icon(source_img)

    for filename, size in ICONS.items():
        out = master.resize((size, size), Image.Resampling.LANCZOS)
        out.save(os.path.join(OUTPUT_DIR, filename), "PNG")
        print(f"Generated: {filename}")

    master.save(os.path.join(OUTPUT_DIR, "icon.ico"), "ICO", sizes=ICO_SIZES)
    print("Generated: icon.ico")

    master.save(os.path.join(OUTPUT_DIR, "icon.icns"), "ICNS")
    print("Generated: icon.icns")

    print("\nDone! Icons generated with white background and smaller centered content.")


if __name__ == "__main__":
    main()
