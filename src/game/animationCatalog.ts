export type AnimationKey = "idle" | "walk" | "attack" | "cast" | "special" | "hit" | "die";

export type SpriteAnimation = {
  row: number;
  frames: number;
  frameMs: number;
  loop: boolean;
};

export type CharacterAnimationSet = {
  scale: number;
  textures: Record<AnimationKey, string>;
  previews?: Partial<Record<AnimationKey, string>>;
  animations: Record<AnimationKey, SpriteAnimation>;
};

export type HostSpriteKey =
  | "host"
  | "healer"
  | "thrones"
  | "archers"
  | "cavalry"
  | "raphael"
  | "zadkiel"
  | "gagiel"
  | "jophiel"
  | "michael";

const singleFrameAnimations: Record<AnimationKey, SpriteAnimation> = {
  idle: { row: 0, frames: 1, frameMs: 180, loop: true },
  walk: { row: 0, frames: 1, frameMs: 120, loop: true },
  attack: { row: 0, frames: 1, frameMs: 90, loop: false },
  cast: { row: 0, frames: 1, frameMs: 110, loop: false },
  special: { row: 0, frames: 1, frameMs: 90, loop: false },
  hit: { row: 0, frames: 1, frameMs: 80, loop: false },
  die: { row: 0, frames: 1, frameMs: 150, loop: false },
};

const specialAngelAnimations: Record<AnimationKey, SpriteAnimation> = {
  idle: { row: 0, frames: 6, frameMs: 130, loop: true },
  walk: { row: 0, frames: 8, frameMs: 95, loop: true },
  attack: { row: 0, frames: 6, frameMs: 80, loop: false },
  cast: { row: 0, frames: 6, frameMs: 95, loop: false },
  special: { row: 0, frames: 8, frameMs: 80, loop: false },
  hit: { row: 0, frames: 4, frameMs: 70, loop: false },
  die: { row: 0, frames: 8, frameMs: 120, loop: false },
};

const hostUnitAnimations: Record<AnimationKey, SpriteAnimation> = {
  idle: { row: 0, frames: 6, frameMs: 145, loop: true },
  walk: { row: 0, frames: 8, frameMs: 82, loop: true },
  attack: { row: 0, frames: 6, frameMs: 74, loop: false },
  cast: { row: 0, frames: 6, frameMs: 92, loop: false },
  special: { row: 0, frames: 6, frameMs: 92, loop: false },
  hit: { row: 0, frames: 4, frameMs: 68, loop: false },
  die: { row: 0, frames: 8, frameMs: 118, loop: false },
};

const animatedHostTextures = (folder: string): Record<AnimationKey, string> => ({
  idle: `/assets/sprites/animated-hosts/${folder}/idle.png`,
  walk: `/assets/sprites/animated-hosts/${folder}/walk.png`,
  attack: `/assets/sprites/animated-hosts/${folder}/attack.png`,
  cast: `/assets/sprites/animated-hosts/${folder}/cast.png`,
  special: `/assets/sprites/animated-hosts/${folder}/cast.png`,
  hit: `/assets/sprites/animated-hosts/${folder}/hit.png`,
  die: `/assets/sprites/animated-hosts/${folder}/die.png`,
});

const specialAngelTextures = (name: string): Record<AnimationKey, string> => ({
  idle: `/assets/sprites/special-angels/${name}/idle.png`,
  walk: `/assets/sprites/special-angels/${name}/walk.png`,
  attack: `/assets/sprites/special-angels/${name}/attack.png`,
  cast: `/assets/sprites/special-angels/${name}/cast.png`,
  special: `/assets/sprites/special-angels/${name}/special.png`,
  hit: `/assets/sprites/special-angels/${name}/hit.png`,
  die: `/assets/sprites/special-angels/${name}/die.png`,
});

const specialAngelPreviews = (name: string): Partial<Record<AnimationKey, string>> => ({
  idle: `/assets/sprites/special-angels/${name}/preview-idle.png`,
  walk: `/assets/sprites/special-angels/${name}/preview-walk.png`,
  attack: `/assets/sprites/special-angels/${name}/preview-attack.png`,
  cast: `/assets/sprites/special-angels/${name}/preview-cast.png`,
  special: `/assets/sprites/special-angels/${name}/preview-special.png`,
  hit: `/assets/sprites/special-angels/${name}/preview-hit.png`,
  die: `/assets/sprites/special-angels/${name}/preview-die.png`,
});

export const hostAnimationCatalog: Record<HostSpriteKey, CharacterAnimationSet> = {
  host: {
    scale: 0.12,
    textures: animatedHostTextures("angel-host"),
    animations: hostUnitAnimations,
  },
  healer: {
    scale: 0.112,
    textures: animatedHostTextures("healer-choir"),
    animations: hostUnitAnimations,
  },
  thrones: {
    scale: 0.13,
    textures: animatedHostTextures("thrones"),
    animations: hostUnitAnimations,
  },
  archers: {
    scale: 0.113,
    textures: animatedHostTextures("archers"),
    animations: hostUnitAnimations,
  },
  cavalry: {
    scale: 0.118,
    textures: animatedHostTextures("cavalry"),
    animations: hostUnitAnimations,
  },
  raphael: {
    scale: 0.29,
    textures: specialAngelTextures("raphael"),
    previews: specialAngelPreviews("raphael"),
    animations: specialAngelAnimations,
  },
  zadkiel: {
    scale: 0.29,
    textures: specialAngelTextures("zadkiel"),
    previews: specialAngelPreviews("zadkiel"),
    animations: specialAngelAnimations,
  },
  gagiel: {
    scale: 0.29,
    textures: specialAngelTextures("gagiel"),
    previews: specialAngelPreviews("gagiel"),
    animations: specialAngelAnimations,
  },
  jophiel: {
    scale: 0.29,
    textures: specialAngelTextures("jophiel"),
    previews: specialAngelPreviews("jophiel"),
    animations: specialAngelAnimations,
  },
  michael: {
    scale: 0.305,
    textures: specialAngelTextures("michael"),
    previews: specialAngelPreviews("michael"),
    animations: specialAngelAnimations,
  },
};

export const animationCatalog: Record<string, CharacterAnimationSet> = {
  alizelsHost: {
    ...hostAnimationCatalog.host,
  },
  fallenEligos: {
    scale: 0.055,
    textures: {
      idle: "/assets/characters/eligos-fallen.webp",
      walk: "/assets/characters/eligos-fallen.webp",
      attack: "/assets/characters/eligos-fallen.webp",
      cast: "/assets/characters/eligos-fallen.webp",
      special: "/assets/characters/eligos-fallen.webp",
      hit: "/assets/characters/eligos-fallen.webp",
      die: "/assets/characters/eligos-fallen.webp",
    },
    animations: singleFrameAnimations,
  },
};
