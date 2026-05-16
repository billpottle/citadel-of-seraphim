from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "public" / "assets" / "characters"
OUTPUT_DIR = ROOT / "public" / "assets" / "sprites" / "special-angels"
FRAME_SIZE = 288

POSES = {
    "idle": {"frames": 6, "loop": True},
    "walk": {"frames": 8, "loop": True},
    "attack": {"frames": 6, "loop": False},
    "cast": {"frames": 6, "loop": False},
    "special": {"frames": 8, "loop": False},
    "hit": {"frames": 4, "loop": False},
    "die": {"frames": 8, "loop": False},
}

ANGELS = {
    "raphael": {
        "accent": (124, 255, 186),
        "secondary": (255, 236, 156),
        "motif": "healing",
    },
    "zadkiel": {
        "accent": (195, 154, 255),
        "secondary": (137, 234, 255),
        "motif": "cleanse",
    },
    "gagiel": {
        "accent": (95, 212, 255),
        "secondary": (184, 245, 255),
        "motif": "water",
    },
    "jophiel": {
        "accent": (255, 218, 108),
        "secondary": (255, 255, 238),
        "motif": "blade",
    },
    "michael": {
        "accent": (255, 195, 83),
        "secondary": (255, 255, 226),
        "motif": "archangel",
    },
}


def rgba(color: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return (*color, alpha)


def fit_source(image: Image.Image) -> Image.Image:
    source = image.convert("RGBA")
    source = source.crop((0, 0, source.width, int(source.height * 0.79)))
    if source.width > source.height:
        source = source.crop(((source.width - source.height) // 2, 0, (source.width + source.height) // 2, source.height))
    mask = Image.new("L", source.size, 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((0, 0, source.width, source.height), radius=44, fill=255)
    source.putalpha(mask)
    contained = ImageOps.contain(source, (252, 244), Image.Resampling.LANCZOS)
    return contained


def paste_center(frame: Image.Image, sprite: Image.Image, x: float, y: float) -> None:
    left = int(round(x - sprite.width / 2))
    top = int(round(y - sprite.height / 2))
    frame.alpha_composite(sprite, (left, top))


def draw_glow(draw: ImageDraw.ImageDraw, center: tuple[float, float], radius: float, color: tuple[int, int, int], alpha: int) -> None:
    x, y = center
    for ring in range(4):
        pad = ring * 7
        draw.ellipse(
            (x - radius - pad, y - radius - pad, x + radius + pad, y + radius + pad),
            outline=rgba(color, max(18, alpha - ring * 24)),
            width=max(1, 4 - ring),
        )


def draw_energy(draw: ImageDraw.ImageDraw, frame: Image.Image, motif: str, accent: tuple[int, int, int], secondary: tuple[int, int, int], pose: str, t: float) -> None:
    cx = FRAME_SIZE / 2
    cy = FRAME_SIZE / 2 + 18
    pulse = math.sin(t * math.tau)
    if pose in {"idle", "walk"}:
        draw_glow(draw, (cx, cy + 34), 46 + pulse * 3, accent, 58)
        return

    if pose == "hit":
        draw.line((cx - 74, cy - 88, cx + 64, cy + 48), fill=rgba((255, 255, 255), 142), width=5)
        draw.line((cx + 54, cy - 84, cx - 68, cy + 34), fill=rgba(accent, 126), width=4)
        return

    if pose == "die":
        for i in range(5):
            angle = t * math.tau + i * 1.26
            x = cx + math.cos(angle) * (20 + t * 66)
            y = cy + math.sin(angle) * (18 + t * 34) - t * 74
            draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=rgba(secondary, max(16, int(120 * (1 - t)))))
        return

    if motif == "water":
        for i in range(4):
            y = cy + 58 + i * 11 - t * 24
            draw.arc((cx - 104 + i * 7, y - 22, cx + 104 - i * 7, y + 24), 192, 348, fill=rgba(accent, 120), width=5)
        if pose == "special":
            for i in range(5):
                y = cy + 12 + i * 8 - t * 18
                draw.arc((cx - 124, y - 18, cx + 124, y + 20), 188, 352, fill=rgba(accent, 72), width=3)
        return

    if motif == "blade":
        start = -42 + t * 86
        for i in range(3 if pose == "special" else 1):
            y = cy - 18 + i * 28
            draw.arc((cx - 126, y - 76 + start, cx + 126, y + 78 + start), 208, 326, fill=rgba(secondary, 190), width=7)
            draw.arc((cx - 116, y - 66 + start, cx + 116, y + 68 + start), 210, 324, fill=rgba(accent, 132), width=4)
        return

    if motif == "cleanse":
        for i in range(6):
            angle = t * math.tau + i * math.tau / 6
            x = cx + math.cos(angle) * (62 + pulse * 5)
            y = cy + math.sin(angle) * (45 + pulse * 4)
            draw.line((cx, cy, x, y), fill=rgba(accent, 88), width=2)
            draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill=rgba(secondary, 120))
        if pose == "special":
            draw_glow(draw, (cx, cy), 84 + t * 14, secondary, 110)
        return

    if motif == "healing":
        for i in range(3):
            y = cy + 36 - i * 30 + pulse * 4
            draw.ellipse((cx - 76 + i * 8, y - 18, cx + 76 - i * 8, y + 18), outline=rgba(accent, 128), width=5)
        if pose == "special":
            draw.line((cx, cy - 92, cx, cy + 72), fill=rgba(secondary, 170), width=7)
            draw.line((cx - 58, cy - 12, cx + 58, cy - 12), fill=rgba(secondary, 170), width=7)
        return

    for i in range(10 if pose == "special" else 5):
        angle = t * math.tau + i * math.tau / 10
        length = 76 + (i % 3) * 18 + t * 20
        x1 = cx + math.cos(angle) * 34
        y1 = cy + math.sin(angle) * 28
        x2 = cx + math.cos(angle) * length
        y2 = cy + math.sin(angle) * length * 0.7
        draw.line((x1, y1, x2, y2), fill=rgba(secondary if i % 2 else accent, 138), width=4)


def frame_for_pose(base: Image.Image, angel: dict[str, object], pose: str, index: int, frames: int) -> Image.Image:
    t = index / max(1, frames - 1)
    loop_t = index / frames
    accent = angel["accent"]
    secondary = angel["secondary"]
    motif = str(angel["motif"])
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse((76, 244, 212, 266), fill=(0, 0, 0, 66))
    frame.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(5)))

    draw = ImageDraw.Draw(frame)
    draw_energy(draw, frame, motif, accent, secondary, pose, t if not POSES[pose]["loop"] else loop_t)

    bob = math.sin(loop_t * math.tau) * 5
    sway = math.sin(loop_t * math.tau) * 4
    angle = math.sin(loop_t * math.tau) * 2.4
    scale = 1.0
    alpha = 255
    sprite = base

    if pose == "walk":
        bob = abs(math.sin(loop_t * math.tau * 2)) * -9
        sway = math.sin(loop_t * math.tau) * 8
        angle = math.sin(loop_t * math.tau) * 4.8
    elif pose == "attack":
        bob = -8 * math.sin(t * math.pi)
        sway = -12 + t * 24
        angle = -5 + t * 10
        scale = 1.0 + math.sin(t * math.pi) * 0.045
    elif pose == "cast":
        bob = -10 * math.sin(t * math.pi)
        scale = 1.0 + math.sin(t * math.pi) * 0.035
    elif pose == "special":
        bob = -16 * math.sin(t * math.pi)
        angle = math.sin(t * math.tau) * 7
        scale = 1.0 + math.sin(t * math.pi) * 0.08
    elif pose == "hit":
        sway = -10 if index % 2 == 0 else 10
        angle = -7 if index % 2 == 0 else 7
    elif pose == "die":
        bob = 42 * t
        sway = 18 * t
        angle = 18 * t
        alpha = int(255 * max(0.18, 1 - t * 0.86))
        sprite = ImageOps.grayscale(base).convert("RGBA")

    if scale != 1:
        sprite = sprite.resize((int(sprite.width * scale), int(sprite.height * scale)), Image.Resampling.LANCZOS)
    if angle:
        sprite = sprite.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    if alpha < 255:
        a = sprite.getchannel("A").point(lambda p: int(p * alpha / 255))
        sprite.putalpha(a)

    paste_center(frame, sprite, FRAME_SIZE / 2 + sway, FRAME_SIZE / 2 + 18 + bob)
    if pose in {"attack", "cast", "special", "hit", "die"}:
        draw_energy(ImageDraw.Draw(frame), frame, motif, accent, secondary, pose, t if not POSES[pose]["loop"] else loop_t)
    return frame


def make_sheet(name: str, angel: dict[str, object]) -> None:
    source = Image.open(SOURCE_DIR / f"{name}.webp")
    base = fit_source(source)
    angel_dir = OUTPUT_DIR / name
    angel_dir.mkdir(parents=True, exist_ok=True)

    for pose, config in POSES.items():
        frames = int(config["frames"])
        sheet = Image.new("RGBA", (FRAME_SIZE * frames, FRAME_SIZE), (0, 0, 0, 0))
        preview = None
        for index in range(frames):
            frame = frame_for_pose(base, angel, pose, index, frames)
            sheet.alpha_composite(frame, (FRAME_SIZE * index, 0))
            if index == 0:
                preview = frame
        sheet.save(angel_dir / f"{pose}.png", optimize=True)
        assert preview is not None
        preview.save(angel_dir / f"preview-{pose}.png", optimize=True)


def main() -> None:
    for name, angel in ANGELS.items():
        make_sheet(name, angel)


if __name__ == "__main__":
    main()
