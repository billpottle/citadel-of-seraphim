from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "public" / "assets" / "sprites"
OUTPUT_DIR = SOURCE_DIR / "guide-hosts"
FRAME_SIZE = 160

HOSTS = {
    "host": "angel-host",
    "healer": "healer-choir",
    "thrones": "thrones",
    "archers": "archers",
    "cavalry": "cavalry",
}

POSE_SEQUENCE = ["idle", "walk", "attack", "cast", "walk", "idle"]


def fit_pose(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    contained = ImageOps.contain(image, (132, 144), Image.Resampling.LANCZOS)
    return contained


def make_sheet(key: str, folder: str) -> None:
    sheet = Image.new("RGBA", (FRAME_SIZE * len(POSE_SEQUENCE), FRAME_SIZE), (0, 0, 0, 0))
    for index, pose in enumerate(POSE_SEQUENCE):
        frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        sprite = fit_pose(SOURCE_DIR / folder / f"{pose}.png")
        x = (FRAME_SIZE - sprite.width) // 2
        y = FRAME_SIZE - sprite.height - 7
        if key == "cavalry":
            y -= 16
        frame.alpha_composite(sprite, (x, y))
        sheet.alpha_composite(frame, (FRAME_SIZE * index, 0))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sheet.save(OUTPUT_DIR / f"{key}.png", optimize=True)


def main() -> None:
    for key, folder in HOSTS.items():
        make_sheet(key, folder)


if __name__ == "__main__":
    main()
