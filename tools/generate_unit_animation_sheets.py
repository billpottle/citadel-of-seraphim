from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SPRITE_DIR = ROOT / "public" / "assets" / "sprites"
HOST_SOURCE_DIR = SPRITE_DIR
HOST_OUTPUT_DIR = SPRITE_DIR / "animated-hosts"
ENEMY_SOURCE_DIR = SPRITE_DIR / "enemies"
ENEMY_OUTPUT_DIR = ENEMY_SOURCE_DIR / "animated"

HOST_POSES = {
    "idle": 6,
    "walk": 8,
    "attack": 6,
    "cast": 6,
    "hit": 4,
    "die": 8,
}

HOSTS = {
    "angel-host": {"flying": False, "accent": (176, 231, 255)},
    "healer-choir": {"flying": False, "accent": (154, 255, 194)},
    "thrones": {"flying": True, "accent": (255, 222, 150)},
    "archers": {"flying": False, "accent": (183, 214, 255)},
    "cavalry": {"flying": True, "accent": (190, 239, 255)},
}

ENEMIES = {
    "corrupted-scout": {"style": "runner", "accent": (203, 91, 255)},
    "fallen-swordsman": {"style": "walker", "accent": (219, 95, 98)},
    "siege-brute": {"style": "brute", "accent": (255, 138, 88)},
    "shadow-caster": {"style": "hover", "accent": (165, 88, 255)},
    "flying-harrier": {"style": "flying", "accent": (171, 79, 255)},
    "dark-archangel": {"style": "winged", "accent": (255, 79, 111)},
}


def rgba(color: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return (*color, alpha)


def paste_center(frame: Image.Image, sprite: Image.Image, x: float, y: float) -> None:
    frame.alpha_composite(sprite, (round(x - sprite.width / 2), round(y - sprite.height / 2)))


def transform_sprite(source: Image.Image, scale_x: float, scale_y: float, angle: float, alpha: float) -> Image.Image:
    width = max(1, round(source.width * scale_x))
    height = max(1, round(source.height * scale_y))
    sprite = source.resize((width, height), Image.Resampling.LANCZOS)
    if angle:
        sprite = sprite.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    if alpha < 1:
        channel = sprite.getchannel("A").point(lambda value: round(value * alpha))
        sprite.putalpha(channel)
    return sprite


def draw_shadow(frame: Image.Image, y: float, width: float, alpha: int) -> None:
    shadow = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    cx = frame.width / 2
    draw.ellipse((cx - width / 2, y - 11, cx + width / 2, y + 11), fill=(0, 0, 0, alpha))
    frame.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(8)))


def draw_wings(frame: Image.Image, t: float, color: tuple[int, int, int], strength: float, high: bool) -> None:
    wing = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(wing)
    cx = frame.width / 2
    cy = frame.height * (0.43 if high else 0.5)
    flap = math.sin(t * math.tau)
    lift = -22 * flap
    spread = 0.92 + 0.22 * math.cos(t * math.tau)
    alpha = round(72 * strength)
    inner_alpha = round(42 * strength)

    for side in (-1, 1):
        root = (cx + side * 18, cy + 34)
        outer = (cx + side * (frame.width * 0.28 * spread + 44), cy - 82 + lift)
        tip = (cx + side * (frame.width * 0.12), cy - 10 + lift * 0.3)
        lower = (cx + side * (frame.width * 0.22 * spread + 16), cy + 58 - lift * 0.15)
        draw.polygon((root, outer, tip), fill=rgba(color, alpha))
        draw.polygon((root, tip, lower), fill=rgba(color, inner_alpha))
        draw.line((root, outer), fill=rgba((255, 255, 255), round(54 * strength)), width=3)
        draw.line((root, lower), fill=rgba(color, round(68 * strength)), width=3)

    frame.alpha_composite(wing.filter(ImageFilter.GaussianBlur(1.1)))


def host_motion(pose: str, index: int, frames: int, flying: bool) -> tuple[float, float, float, float, float, float]:
    t = index / frames
    eased = index / max(1, frames - 1)
    step = math.sin(t * math.tau)
    double_step = math.sin(t * math.tau * 2)
    bob = math.sin(t * math.tau) * -3
    sway = step * 2.5
    angle = step * 1.6
    scale_x = 1.0
    scale_y = 1.0
    alpha = 1.0

    if pose == "walk":
        if flying:
            bob = -10 + math.sin(t * math.tau * 2) * 3
            sway = step * 5
            angle = step * 2.6
            scale_y = 1 - abs(step) * 0.012
        else:
            bob = -abs(double_step) * 4
            sway = step * 6
            angle = step * 2.5
            scale_x = 1 + abs(step) * 0.014
            scale_y = 1 - abs(step) * 0.014
    elif pose == "attack":
        strike = math.sin(eased * math.pi)
        bob = -11 * strike
        sway = -16 + 32 * eased
        angle = -7 + 14 * eased
        scale_x = 1 + strike * 0.045
        scale_y = 1 - strike * 0.018
    elif pose == "cast":
        pulse = math.sin(eased * math.pi)
        bob = -13 * pulse
        angle = step * 2.4
        scale_x = 1 + pulse * 0.035
        scale_y = 1 + pulse * 0.035
    elif pose == "hit":
        bob = 2 if index % 2 else -5
        sway = 11 if index % 2 else -11
        angle = 8 if index % 2 else -8
    elif pose == "die":
        bob = 48 * eased
        sway = 22 * eased
        angle = 22 * eased
        scale_y = 1 - eased * 0.16
        alpha = max(0.18, 1 - eased * 0.82)
    return bob, sway, angle, scale_x, scale_y, alpha


def make_host_sheet(folder: str, options: dict[str, object], pose: str, frames: int) -> None:
    source_path = HOST_SOURCE_DIR / folder / f"{pose}.png"
    source = Image.open(source_path).convert("RGBA")
    output = Image.new("RGBA", (source.width * frames, source.height), (0, 0, 0, 0))
    flying = bool(options["flying"])
    accent = options["accent"]

    for index in range(frames):
        t = index / frames
        frame = Image.new("RGBA", source.size, (0, 0, 0, 0))
        bob, sway, angle, scale_x, scale_y, alpha = host_motion(pose, index, frames, flying)
        shadow_width = source.width * (0.29 if flying else 0.34) * (1 - min(0.18, abs(bob) / 170))
        draw_shadow(frame, source.height * 0.88, shadow_width, 46 if flying else 64)
        if pose == "walk" and not flying:
            draw = ImageDraw.Draw(frame)
            contact = abs(math.sin(t * math.tau * 2))
            step = math.sin(t * math.tau)
            planted_x = source.width / 2 + (26 if step > 0 else -18)
            trailing_x = source.width / 2 + (-18 if step > 0 else 26)
            y = source.height * 0.82
            draw.ellipse((planted_x - 22, y - 5, planted_x + 24, y + 7), fill=(0, 0, 0, round(48 + contact * 32)))
            draw.ellipse((trailing_x - 13, y - 4, trailing_x + 15, y + 5), fill=(0, 0, 0, round(24 + (1 - contact) * 18)))
        if flying and pose in {"idle", "walk", "cast"}:
            draw_wings(frame, t, accent, 0.78, False)
        sprite = transform_sprite(source, scale_x, scale_y, angle, alpha)
        paste_center(frame, sprite, source.width / 2 + sway, source.height / 2 + bob)
        output.alpha_composite(frame, (source.width * index, 0))

    target = HOST_OUTPUT_DIR / folder / f"{pose}.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    output.save(target, optimize=True)


def enemy_motion(style: str, index: int, frames: int) -> tuple[float, float, float, float, float]:
    t = index / frames
    step = math.sin(t * math.tau)
    double_step = math.sin(t * math.tau * 2)
    bob = -abs(double_step) * 8
    sway = step * 8
    angle = step * 4
    scale_x = 1 + abs(step) * 0.035
    scale_y = 1 - abs(step) * 0.035

    if style == "runner":
        bob = -abs(double_step) * 5
        sway = step * 10
        angle = step * 4.5
    elif style == "brute":
        bob = -max(0, double_step) * 2.5
        sway = step * 2.5
        angle = step * 1.2
        scale_x = 1 + abs(step) * 0.01
        scale_y = 1 - abs(step) * 0.012
    elif style == "hover":
        bob = math.sin(t * math.tau) * -5
        sway = step * 5
        angle = step * 1.4
        scale_x = 1 + abs(step) * 0.012
        scale_y = 1 + abs(step) * 0.012
    elif style in {"flying", "winged"}:
        bob = -16 + math.sin(t * math.tau * 2) * 5
        sway = step * 7
        angle = step * (3.5 if style == "flying" else 1.8)
        scale_x = 1 + abs(step) * 0.012
        scale_y = 1 - abs(step) * 0.01
    return bob, sway, angle, scale_x, scale_y


def make_enemy_sheet(name: str, options: dict[str, object]) -> None:
    source = Image.open(ENEMY_SOURCE_DIR / f"{name}.png").convert("RGBA")
    frames = 8
    output = Image.new("RGBA", (source.width * frames, source.height), (0, 0, 0, 0))
    style = str(options["style"])
    accent = options["accent"]

    for index in range(frames):
        t = index / frames
        frame = Image.new("RGBA", source.size, (0, 0, 0, 0))
        bob, sway, angle, scale_x, scale_y = enemy_motion(style, index, frames)
        shadow_alpha = 42 if style in {"flying", "winged", "hover"} else 66
        shadow_width = source.width * (0.3 if style in {"flying", "winged", "hover"} else 0.36)
        draw_shadow(frame, source.height * 0.87, shadow_width, shadow_alpha)
        if style in {"flying", "winged"}:
            draw_wings(frame, t, accent, 1.0 if style == "winged" else 0.82, True)
        elif style == "hover":
            draw = ImageDraw.Draw(frame)
            pulse = math.sin(t * math.tau) * 8
            draw.ellipse(
                (
                    source.width / 2 - 74 - pulse,
                    source.height * 0.72 - 18,
                    source.width / 2 + 74 + pulse,
                    source.height * 0.72 + 18,
                ),
                outline=rgba(accent, 88),
                width=5,
            )
        sprite = transform_sprite(source, scale_x, scale_y, angle, 1)
        paste_center(frame, sprite, source.width / 2 + sway, source.height / 2 + bob)
        output.alpha_composite(frame, (source.width * index, 0))

    target = ENEMY_OUTPUT_DIR / name / "walk.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    output.save(target, optimize=True)


def main() -> None:
    for folder, options in HOSTS.items():
        for pose, frames in HOST_POSES.items():
            make_host_sheet(folder, options, pose, frames)
    for name, options in ENEMIES.items():
        make_enemy_sheet(name, options)


if __name__ == "__main__":
    main()
