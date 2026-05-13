export type AnimationKey = "idle" | "walk" | "attack" | "cast" | "hit" | "die";

export type SpriteAnimation = {
  row: number;
  frames: number;
  frameMs: number;
  loop: boolean;
};

export type CharacterAnimationSet = {
  scale: number;
  textures: Record<AnimationKey, string>;
  animations: Record<AnimationKey, SpriteAnimation>;
};

export const animationCatalog: Record<string, CharacterAnimationSet> = {
  alizelsHost: {
    scale: 0.12,
    textures: {
      idle: "/assets/sprites/angel-defender/idle.png",
      walk: "/assets/sprites/angel-defender/walk.png",
      attack: "/assets/sprites/angel-defender/attack.png",
      cast: "/assets/sprites/angel-defender/cast.png",
      hit: "/assets/sprites/angel-defender/hit.png",
      die: "/assets/sprites/angel-defender/die.png",
    },
    animations: {
      idle: { row: 0, frames: 1, frameMs: 180, loop: true },
      walk: { row: 0, frames: 1, frameMs: 120, loop: true },
      attack: { row: 0, frames: 1, frameMs: 90, loop: false },
      cast: { row: 0, frames: 1, frameMs: 110, loop: false },
      hit: { row: 0, frames: 1, frameMs: 80, loop: false },
      die: { row: 0, frames: 1, frameMs: 150, loop: false },
    },
  },
  fallenEligos: {
    scale: 0.055,
    textures: {
      idle: "/assets/characters/eligos-fallen.webp",
      walk: "/assets/characters/eligos-fallen.webp",
      attack: "/assets/characters/eligos-fallen.webp",
      cast: "/assets/characters/eligos-fallen.webp",
      hit: "/assets/characters/eligos-fallen.webp",
      die: "/assets/characters/eligos-fallen.webp",
    },
    animations: {
      idle: { row: 0, frames: 1, frameMs: 180, loop: true },
      walk: { row: 0, frames: 1, frameMs: 120, loop: true },
      attack: { row: 0, frames: 1, frameMs: 90, loop: false },
      cast: { row: 0, frames: 1, frameMs: 110, loop: false },
      hit: { row: 0, frames: 1, frameMs: 80, loop: false },
      die: { row: 0, frames: 1, frameMs: 150, loop: false },
    },
  },
};
