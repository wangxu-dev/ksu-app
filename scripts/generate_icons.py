from PIL import Image
import os

# 源图片
SOURCE = "图片/1.png"
OUTPUT_DIR = "src-tauri/icons"

# Tauri 需要的所有尺寸
ICONS = {
    # PNG files
    "32x32.png": 32,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 512,
    # Windows Store logos
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

# ICO and ICNS (需要特殊处理)
ICO_SIZES = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
ICNS_SIZES = [(16, 16), (32, 32), (128, 128), (256, 256), (512, 512), (1024, 1024)]

def main():
    img = Image.open(SOURCE).convert("RGBA")

    # 确保输出目录存在
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 生成所有 PNG
    for filename, size in ICONS.items():
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(os.path.join(OUTPUT_DIR, filename), "PNG")
        print(f"Generated: {filename}")

    # 生成 ICO (Windows)
    ico_img = img.copy()
    ico_img.save(os.path.join(OUTPUT_DIR, "icon.ico"), "ICO", sizes=ICO_SIZES)
    print("Generated: icon.ico")

    # 生成 ICNS (macOS)
    # 注意: ICNS 需要额外工具 iconutil (macOS 自带) 或用 Pillow 简单保存
    # Pillow 保存的 ICNS 可能在某些情况下不完美，但基本可用
    icns_img = img.resize((1024, 1024), Image.Resampling.LANCZOS)
    icns_img.save(os.path.join(OUTPUT_DIR, "icon.icns"), "ICNS")
    print("Generated: icon.icns")

    print("\nDone! All icons generated.")

if __name__ == "__main__":
    main()
