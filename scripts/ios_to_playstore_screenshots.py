#!/usr/bin/env python3
"""Convert Fastlane iOS Snapshot screenshots to Google Play phone format.

Play Store phone slot expects ~1080×1920 (9:16), 24-bit PNG without alpha.
iPhone 14 Pro Max captures (1284×2778) are taller than 9:16, so we crop
from the top (keep tab bar), then resize.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = ROOT / "ios/fastlane/screenshots/fr-FR/asc-1284x2778"
DEFAULT_OUT = (
    ROOT
    / "android/fastlane/metadata/android/fr-FR/images/phoneScreenshots"
)

TARGET_W, TARGET_H = 1080, 1920
TARGET_RATIO = TARGET_W / TARGET_H
# Trim iOS home-indicator strip after keeping the tab bar.
BOTTOM_PAD = 34

MAPPING = [
    ("iPhone 14 Pro Max-00_Splash.png", "00_splash.png"),
    ("iPhone 14 Pro Max-01_Accueil.png", "01_accueil.png"),
    ("iPhone 14 Pro Max-02_Trajets.png", "02_trajets.png"),
    ("iPhone 14 Pro Max-03_Messages.png", "03_messages.png"),
    ("iPhone 14 Pro Max-04_Profil.png", "04_profil.png"),
]


def to_playstore(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    ratio = w / h

    if ratio < TARGET_RATIO:
        new_h = int(round(w / TARGET_RATIO))
        top = max(0, h - new_h - BOTTOM_PAD)
        if top + new_h > h:
            top = h - new_h
        img = img.crop((0, top, w, top + new_h))
    elif ratio > TARGET_RATIO:
        new_w = int(round(h * TARGET_RATIO))
        left = (w - new_w) // 2
        img = img.crop((left, 0, left + new_w, h))

    img = img.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)
    rgb = Image.new("RGB", img.size, (255, 255, 255))
    rgb.paste(img, mask=img.split()[3])
    return rgb


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--src", type=Path, default=DEFAULT_SRC)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    if not args.src.is_dir():
        raise SystemExit(f"Source directory not found: {args.src}")

    args.out.mkdir(parents=True, exist_ok=True)

    for src_name, out_name in MAPPING:
        src = args.src / src_name
        if not src.exists():
            raise SystemExit(f"Missing screenshot: {src}")
        out = to_playstore(Image.open(src))
        dest = args.out / out_name
        out.save(dest, format="PNG", optimize=True)
        print(f"{out_name}: {out.size[0]}x{out.size[1]} ({dest.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
