import type { Point } from "./types";
import { MAP_LAYOUT_OVERRIDES, type MapLayoutOverride } from "./mapLayoutOverrides";

export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

export type GateConfig = {
  x: number;
  y: number;
  width: number;
  height: number;
  maxHp: number;
};

export type MapDefinition = {
  name: string;
  background: string;
  width: number;
  height: number;
  path: Point[];
  paths?: Point[][];
  sidePaths?: Point[][];
  towerSlots: Point[];
  gate: GateConfig;
  startingUnit: Point;
};

export const MAP_ORDER = ["citadel", "skybridge", "moonGarden", "sunreach", "nightBridges"] as const;
export type MapId = (typeof MAP_ORDER)[number];
export const DEFAULT_MAP_ID: MapId = "citadel";
const TALL_MAP_HEIGHT = DESIGN_HEIGHT * 2;
const TALL_MAP_SCALE_Y = TALL_MAP_HEIGHT / DESIGN_HEIGHT;
const tallPoint = (point: Point): Point => ({ x: point.x, y: Math.round(point.y * TALL_MAP_SCALE_Y) });
const tallPath = (path: Point[]) => path.map(tallPoint);
const tallGate = (gate: GateConfig): GateConfig => ({
  ...gate,
  y: Math.round(gate.y * TALL_MAP_SCALE_Y),
  height: Math.round(gate.height * TALL_MAP_SCALE_Y),
});

const CITADEL_PATH: Point[] = [
  { x: 142, y: 120 },
  { x: 194, y: 164 },
  { x: 324, y: 276 },
  { x: 298, y: 416 },
  { x: 458, y: 492 },
  { x: 594, y: 430 },
  { x: 626, y: 330 },
  { x: 826, y: 314 },
  { x: 1018, y: 320 },
  { x: 1138, y: 162 },
];

const CITADEL_TOWER_SLOTS: Point[] = [
  { x: 640, y: 198 },
  { x: 890, y: 210 },
  { x: 548, y: 398 },
  { x: 348, y: 544 },
  { x: 948, y: 404 },
  { x: 648, y: 636 },
];

export const MAPS: Record<MapId, MapDefinition> = {
  citadel: {
    name: "Citadel Breach",
    background: "/assets/concepts/citadel-battlefield-concept.png",
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    path: CITADEL_PATH,
    towerSlots: CITADEL_TOWER_SLOTS,
    gate: {
      x: 1098,
      y: 96,
      width: 88,
      height: 132,
      maxHp: 720,
    },
    startingUnit: { x: 458, y: 492 },
  },
  skybridge: {
    name: "Seraphic Skybridge",
    background: "/assets/concepts/citadel-skybridge-map.png",
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    path: [
      { x: 142, y: 130 },
      { x: 222, y: 178 },
      { x: 344, y: 282 },
      { x: 320, y: 438 },
      { x: 480, y: 516 },
      { x: 640, y: 432 },
      { x: 690, y: 330 },
      { x: 890, y: 338 },
      { x: 1060, y: 352 },
      { x: 1150, y: 156 },
    ],
    towerSlots: [
      { x: 640, y: 206 },
      { x: 888, y: 220 },
      { x: 540, y: 412 },
      { x: 342, y: 594 },
      { x: 934, y: 498 },
      { x: 646, y: 640 },
    ],
    gate: {
      x: 1112,
      y: 96,
      width: 84,
      height: 132,
      maxHp: 720,
    },
    startingUnit: { x: 480, y: 516 },
  },
  moonGarden: {
    name: "Moon Garden",
    background: "/assets/concepts/citadel-moon-garden-map.png",
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    path: [
      { x: 142, y: 132 },
      { x: 224, y: 178 },
      { x: 330, y: 286 },
      { x: 314, y: 440 },
      { x: 486, y: 516 },
      { x: 626, y: 438 },
      { x: 674, y: 330 },
      { x: 886, y: 336 },
      { x: 1068, y: 370 },
      { x: 1164, y: 232 },
    ],
    towerSlots: [
      { x: 606, y: 218 },
      { x: 842, y: 228 },
      { x: 518, y: 404 },
      { x: 646, y: 636 },
      { x: 940, y: 482 },
      { x: 300, y: 590 },
    ],
    gate: {
      x: 1126,
      y: 168,
      width: 86,
      height: 134,
      maxHp: 720,
    },
    startingUnit: { x: 486, y: 516 },
  },
  sunreach: {
    name: "Sunreach Causeway",
    background: "/assets/concepts/citadel-sunreach-causeway-map.png",
    width: 2560,
    height: TALL_MAP_HEIGHT,
    path: tallPath([
      { x: 208, y: 236 },
      { x: 405, y: 292 },
      { x: 520, y: 148 },
      { x: 710, y: 100 },
      { x: 902, y: 224 },
      { x: 1110, y: 236 },
      { x: 1225, y: 92 },
      { x: 1450, y: 104 },
      { x: 1665, y: 150 },
      { x: 1900, y: 154 },
      { x: 2140, y: 168 },
      { x: 2380, y: 108 },
      { x: 2526, y: 52 },
    ]),
    paths: [
      tallPath([
        { x: 208, y: 236 },
        { x: 405, y: 292 },
        { x: 520, y: 148 },
        { x: 710, y: 100 },
        { x: 902, y: 224 },
        { x: 1110, y: 236 },
        { x: 1225, y: 92 },
        { x: 1450, y: 104 },
        { x: 1665, y: 150 },
        { x: 1900, y: 154 },
        { x: 2140, y: 168 },
        { x: 2380, y: 108 },
        { x: 2526, y: 52 },
      ]),
      tallPath([
        { x: 330, y: 708 },
        { x: 520, y: 548 },
        { x: 760, y: 532 },
        { x: 980, y: 448 },
        { x: 1200, y: 352 },
        { x: 1430, y: 338 },
        { x: 1660, y: 392 },
        { x: 1888, y: 424 },
        { x: 2148, y: 406 },
        { x: 2355, y: 278 },
        { x: 2526, y: 52 },
      ]),
      tallPath([
        { x: 208, y: 236 },
        { x: 430, y: 340 },
        { x: 610, y: 445 },
        { x: 808, y: 510 },
        { x: 1020, y: 488 },
        { x: 1200, y: 352 },
        { x: 1430, y: 338 },
        { x: 1660, y: 392 },
        { x: 1888, y: 424 },
        { x: 2148, y: 406 },
        { x: 2355, y: 278 },
        { x: 2526, y: 52 },
      ]),
    ],
    towerSlots: tallPath([
      { x: 650, y: 96 },
      { x: 962, y: 130 },
      { x: 926, y: 382 },
      { x: 1328, y: 294 },
      { x: 1190, y: 632 },
      { x: 1514, y: 42 },
      { x: 1510, y: 570 },
      { x: 1814, y: 408 },
      { x: 2130, y: 505 },
      { x: 2322, y: 410 },
    ]),
    gate: tallGate({
      x: 2488,
      y: 0,
      width: 72,
      height: 120,
      maxHp: 900,
    }),
    startingUnit: tallPoint({ x: 902, y: 224 }),
  },
  nightBridges: {
    name: "Night Bridges",
    background: "/assets/concepts/citadel-night-bridges-map.png",
    width: 2560,
    height: TALL_MAP_HEIGHT,
    path: tallPath([
      { x: 210, y: 282 },
      { x: 330, y: 346 },
      { x: 560, y: 356 },
      { x: 802, y: 342 },
      { x: 1032, y: 370 },
      { x: 1178, y: 448 },
      { x: 1395, y: 300 },
      { x: 1610, y: 330 },
      { x: 1830, y: 378 },
      { x: 2040, y: 372 },
      { x: 2240, y: 438 },
      { x: 2520, y: 560 },
    ]),
    paths: [
      tallPath([
        { x: 210, y: 282 },
        { x: 330, y: 346 },
        { x: 560, y: 356 },
        { x: 802, y: 342 },
        { x: 1032, y: 370 },
        { x: 1178, y: 448 },
        { x: 1395, y: 300 },
        { x: 1610, y: 330 },
        { x: 1830, y: 378 },
        { x: 2040, y: 372 },
        { x: 2240, y: 438 },
        { x: 2520, y: 560 },
      ]),
      tallPath([
        { x: 150, y: 704 },
        { x: 280, y: 610 },
        { x: 510, y: 535 },
        { x: 760, y: 565 },
        { x: 982, y: 610 },
        { x: 1178, y: 448 },
        { x: 1395, y: 300 },
        { x: 1610, y: 330 },
        { x: 1830, y: 378 },
        { x: 2040, y: 372 },
        { x: 2240, y: 438 },
        { x: 2520, y: 560 },
      ]),
      tallPath([
        { x: 88, y: 0 },
        { x: 320, y: 92 },
        { x: 520, y: 150 },
        { x: 780, y: 180 },
        { x: 1032, y: 370 },
        { x: 1178, y: 448 },
        { x: 1395, y: 300 },
        { x: 1610, y: 330 },
        { x: 1830, y: 378 },
        { x: 2040, y: 372 },
        { x: 2240, y: 438 },
        { x: 2520, y: 560 },
      ]),
    ],
    towerSlots: tallPath([
      { x: 322, y: 296 },
      { x: 600, y: 598 },
      { x: 650, y: 170 },
      { x: 866, y: 304 },
      { x: 975, y: 70 },
      { x: 1284, y: 608 },
      { x: 1320, y: 112 },
      { x: 1620, y: 526 },
      { x: 1980, y: 275 },
      { x: 2190, y: 530 },
    ]),
    gate: tallGate({
      x: 2482,
      y: 494,
      width: 78,
      height: 132,
      maxHp: 900,
    }),
    startingUnit: tallPoint({ x: 1178, y: 448 }),
  },
};

const clonePoint = (point: Point): Point => ({ x: point.x, y: point.y });
const clonePathPoints = (path: Point[]) => path.map(clonePoint);

function applyMapLayoutOverrides(maps: Record<MapId, MapDefinition>, overrides: Partial<Record<MapId, MapLayoutOverride>>) {
  for (const [id, override] of Object.entries(overrides) as [MapId, MapLayoutOverride][]) {
    const map = maps[id];
    if (!map || !override) {
      continue;
    }

    if (override.sidePaths) {
      map.sidePaths = override.sidePaths.map(clonePathPoints);
    }

    if (override.paths) {
      map.paths = override.paths.map(clonePathPoints);
      map.path = map.paths[0] ?? map.path;
    } else if (override.path) {
      map.path = clonePathPoints(override.path);
      if (map.paths) {
        map.paths = [map.path, ...map.paths.slice(1).map(clonePathPoints)];
      }
    }

    if (override.towerSlots) {
      map.towerSlots = override.towerSlots.map(clonePoint);
    }
    if (override.gate) {
      map.gate = { ...map.gate, ...override.gate };
    }
    if (override.startingUnit) {
      map.startingUnit = clonePoint(override.startingUnit);
    }
  }
}

applyMapLayoutOverrides(MAPS, MAP_LAYOUT_OVERRIDES);

export const PATH: Point[] = MAPS.citadel.path;
export const PATH_DEPLOY_TOLERANCE = 64;

export const GATE = MAPS.citadel.gate;

export const INITIAL_ENERGY = 120;
export const PURIFY_COST = 260;

export const DIFFICULTY_MODES = {
  easy: {
    name: "Easy",
    description: "More energy, softer waves, stronger angel damage.",
    startingEnergy: 170,
    enemyHpMultiplier: 0.72,
    enemySpeedMultiplier: 0.84,
    enemyDamageMultiplier: 0.72,
    enemySpawnIntervalMultiplier: 1.18,
    angelDamageMultiplier: 1.22,
    towerDamageMultiplier: 1.16,
    energyRewardMultiplier: 1.25,
  },
  normal: {
    name: "Normal",
    description: "Baseline Citadel defense balance.",
    startingEnergy: INITIAL_ENERGY,
    enemyHpMultiplier: 1,
    enemySpeedMultiplier: 1,
    enemyDamageMultiplier: 1,
    enemySpawnIntervalMultiplier: 1,
    angelDamageMultiplier: 1,
    towerDamageMultiplier: 1,
    energyRewardMultiplier: 1,
  },
  hard: {
    name: "Hard",
    description: "Tougher demons, faster waves, tighter energy.",
    startingEnergy: 95,
    enemyHpMultiplier: 1.35,
    enemySpeedMultiplier: 1.16,
    enemyDamageMultiplier: 1.28,
    enemySpawnIntervalMultiplier: 0.84,
    angelDamageMultiplier: 0.88,
    towerDamageMultiplier: 0.9,
    energyRewardMultiplier: 0.84,
  },
} as const;

export type DifficultyMode = keyof typeof DIFFICULTY_MODES;

export const HOST_TYPES = {
  host: {
    name: "Angel Host",
    role: "Balanced squad",
    cost: 75,
    description: "Balanced defenders with steady holy ranged fire.",
    speed: 118,
    attackRange: 176,
    engagementRange: 232,
    attackCooldownMs: 760,
    memberCount: 5,
    memberHp: 185,
    memberMp: 70,
    damagePerMember: 13,
    healPerMember: 0,
    defense: 1,
    tint: 0xffffff,
  },
  healer: {
    name: "Healer Choir",
    role: "Support",
    cost: 95,
    description: "Deals no damage. Spends MP to heal nearby allied hosts.",
    speed: 104,
    attackRange: 0,
    engagementRange: 210,
    attackCooldownMs: 900,
    memberCount: 4,
    memberHp: 145,
    memberMp: 115,
    damagePerMember: 0,
    healPerMember: 10,
    defense: 1,
    tint: 0xb7ffe6,
  },
  thrones: {
    name: "Thrones",
    role: "Armored blockers",
    cost: 130,
    description: "Slow armored angels with high HP and reduced incoming damage.",
    speed: 72,
    attackRange: 118,
    engagementRange: 178,
    attackCooldownMs: 1020,
    memberCount: 4,
    memberHp: 330,
    memberMp: 55,
    damagePerMember: 11,
    healPerMember: 0,
    defense: 0.54,
    tint: 0xd5d8e8,
  },
  archers: {
    name: "Archers",
    role: "Long range",
    cost: 105,
    description: "Fragile long-range squads that fire quickly from safer positions.",
    speed: 112,
    attackRange: 285,
    engagementRange: 315,
    attackCooldownMs: 580,
    memberCount: 5,
    memberHp: 125,
    memberMp: 82,
    damagePerMember: 10,
    healPerMember: 0,
    defense: 1.12,
    tint: 0xc8ecff,
  },
  cavalry: {
    name: "Cavalry",
    role: "Fast interceptors",
    cost: 120,
    description: "Fast redeploying strike units with shorter range and strong burst.",
    speed: 178,
    attackRange: 136,
    engagementRange: 205,
    attackCooldownMs: 640,
    memberCount: 4,
    memberHp: 170,
    memberMp: 76,
    damagePerMember: 17,
    healPerMember: 0,
    defense: 0.9,
    tint: 0xffe1ad,
  },
  raphael: {
    name: "Raphael",
    role: "Special Angel - healer",
    cost: 150,
    description: "A named healer angel. One-person unit that builds tension while restoring allied hosts.",
    speed: 120,
    attackRange: 0,
    engagementRange: 240,
    attackCooldownMs: 760,
    memberCount: 1,
    memberHp: 420,
    memberMp: 160,
    damagePerMember: 0,
    healPerMember: 30,
    defense: 0.62,
    tint: 0xb7ffe6,
    special: true,
    specialAbility: "healer",
    maxPerBattle: 1,
  },
  zadkiel: {
    name: "Zadkiel",
    role: "Special Angel - corruption healer",
    cost: 145,
    description: "A named angel who heals corruption from nearby hosts and weakens demon control.",
    speed: 122,
    attackRange: 0,
    engagementRange: 245,
    attackCooldownMs: 820,
    memberCount: 1,
    memberHp: 390,
    memberMp: 175,
    damagePerMember: 0,
    healPerMember: 14,
    defense: 0.66,
    tint: 0xd9c4ff,
    special: true,
    specialAbility: "cleanse",
    maxPerBattle: 1,
  },
  gagiel: {
    name: "Gagiel",
    role: "Special Angel - waters",
    cost: 170,
    description: "Summons cleansing waters that wash enemies back along the path.",
    speed: 116,
    attackRange: 205,
    engagementRange: 250,
    attackCooldownMs: 920,
    memberCount: 1,
    memberHp: 430,
    memberMp: 145,
    damagePerMember: 20,
    healPerMember: 0,
    defense: 0.68,
    tint: 0x8ed8ff,
    special: true,
    specialAbility: "washback",
    maxPerBattle: 1,
  },
  jophiel: {
    name: "Jophiel",
    role: "Special Angel - sword",
    cost: 205,
    description: "Wields a sword that can release judgment across the entire board.",
    speed: 126,
    attackRange: 190,
    engagementRange: 235,
    attackCooldownMs: 720,
    memberCount: 1,
    memberHp: 460,
    memberMp: 135,
    damagePerMember: 27,
    healPerMember: 0,
    defense: 0.58,
    tint: 0xffe1ad,
    special: true,
    specialAbility: "boardSlash",
    maxPerBattle: 1,
  },
  michael: {
    name: "Michael",
    role: "Special Angel - archangel",
    cost: 275,
    description: "The most powerful angel. A one-person unit with devastating radiant pressure.",
    speed: 132,
    attackRange: 245,
    engagementRange: 285,
    attackCooldownMs: 560,
    memberCount: 1,
    memberHp: 620,
    memberMp: 180,
    damagePerMember: 42,
    healPerMember: 0,
    defense: 0.44,
    tint: 0xfff2bd,
    special: true,
    specialAbility: "archangel",
    maxPerBattle: 1,
  },
} as const;

export type HostKind = keyof typeof HOST_TYPES;

export const ENEMY_TYPES = {
  corruptedScout: {
    name: "Corrupted Scout",
    texture: "/assets/sprites/enemies/corrupted-scout.png",
    hp: 44,
    speed: 92,
    gateDamagePerSecond: 13,
    energyReward: 16,
    scale: 0.14,
    walkAnimation: {
      cycleMs: 520,
      bobPx: 10,
      swayDeg: 7,
      scaleX: 0.07,
      scaleY: 0.04,
      driftPx: 5,
    },
  },
  fallenSwordsman: {
    name: "Fallen Swordsman",
    texture: "/assets/sprites/enemies/fallen-swordsman.png",
    hp: 74,
    speed: 58,
    gateDamagePerSecond: 22,
    energyReward: 24,
    scale: 0.14,
    walkAnimation: {
      cycleMs: 760,
      bobPx: 6,
      swayDeg: 4,
      scaleX: 0.035,
      scaleY: 0.03,
      driftPx: 2,
    },
  },
  siegeBrute: {
    name: "Siege Brute",
    texture: "/assets/sprites/enemies/siege-brute.png",
    hp: 145,
    speed: 36,
    gateDamagePerSecond: 38,
    energyReward: 42,
    scale: 0.16,
    walkAnimation: {
      cycleMs: 980,
      bobPx: 4,
      swayDeg: 2,
      scaleX: 0.025,
      scaleY: 0.045,
      driftPx: 1,
    },
  },
  shadowCaster: {
    name: "Shadow Caster",
    texture: "/assets/sprites/enemies/shadow-caster.png",
    hp: 82,
    speed: 48,
    gateDamagePerSecond: 18,
    energyReward: 30,
    scale: 0.14,
    projectile: {
      range: 250,
      cooldownMs: 1850,
      damage: 18,
      speed: 430,
      color: 0xa05cff,
      corrupts: true,
    },
    walkAnimation: {
      cycleMs: 1200,
      bobPx: 12,
      swayDeg: 2,
      scaleX: 0.018,
      scaleY: 0.018,
      driftPx: 4,
    },
  },
  flyingHarrier: {
    name: "Flying Harrier",
    texture: "/assets/sprites/enemies/flying-harrier.png",
    hp: 58,
    speed: 78,
    gateDamagePerSecond: 18,
    energyReward: 22,
    scale: 0.15,
    walkAnimation: {
      cycleMs: 440,
      bobPx: 18,
      swayDeg: 9,
      scaleX: 0.06,
      scaleY: 0.035,
      driftPx: 9,
    },
  },
  darkArchangel: {
    name: "Dark Archangel",
    texture: "/assets/sprites/enemies/dark-archangel.png",
    hp: 260,
    speed: 34,
    gateDamagePerSecond: 52,
    energyReward: 110,
    scale: 0.19,
    projectile: {
      range: 280,
      cooldownMs: 1450,
      damage: 28,
      speed: 480,
      color: 0xff4b65,
    },
    walkAnimation: {
      cycleMs: 1400,
      bobPx: 5,
      swayDeg: 1.7,
      scaleX: 0.018,
      scaleY: 0.025,
      driftPx: 2,
    },
  },
  obsidianBulwark: {
    name: "Obsidian Bulwark",
    texture: "/assets/sprites/enemies/siege-brute.png",
    hp: 255,
    speed: 27,
    gateDamagePerSecond: 62,
    energyReward: 64,
    scale: 0.19,
    walkAnimation: {
      cycleMs: 1240,
      bobPx: 3,
      swayDeg: 1.4,
      scaleX: 0.016,
      scaleY: 0.035,
      driftPx: 1,
    },
  },
  voidSeraph: {
    name: "Void Seraph",
    texture: "/assets/sprites/enemies/flying-harrier.png",
    hp: 142,
    speed: 91,
    gateDamagePerSecond: 31,
    energyReward: 48,
    scale: 0.18,
    projectile: {
      range: 265,
      cooldownMs: 1120,
      damage: 22,
      speed: 560,
      color: 0x6f77ff,
    },
    walkAnimation: {
      cycleMs: 390,
      bobPx: 22,
      swayDeg: 10,
      scaleX: 0.07,
      scaleY: 0.04,
      driftPx: 10,
    },
  },
  abyssalHierophant: {
    name: "Abyssal Hierophant",
    texture: "/assets/sprites/enemies/dark-archangel.png",
    hp: 420,
    speed: 25,
    gateDamagePerSecond: 78,
    energyReward: 155,
    scale: 0.22,
    projectile: {
      range: 320,
      cooldownMs: 1280,
      damage: 36,
      speed: 500,
      color: 0xd94cff,
    },
    walkAnimation: {
      cycleMs: 1620,
      bobPx: 4,
      swayDeg: 1.2,
      scaleX: 0.012,
      scaleY: 0.02,
      driftPx: 2,
    },
  },
} as const;

export type EnemyKind = keyof typeof ENEMY_TYPES;

export type WaveDefinition = {
  name: string;
  intervalMs: number;
  enemies: EnemyKind[];
};

export const MAP_WAVES = {
  citadel: [
    {
      name: "First Footfalls",
      intervalMs: 1450,
      enemies: ["corruptedScout", "corruptedScout", "corruptedScout"],
    },
    {
      name: "Fallen Drill",
      intervalMs: 1220,
      enemies: ["corruptedScout", "fallenSwordsman", "corruptedScout", "fallenSwordsman"],
    },
    {
      name: "Gatebreakers",
      intervalMs: 1040,
      enemies: [
        "fallenSwordsman",
        "corruptedScout",
        "fallenSwordsman",
        "corruptedScout",
        "fallenSwordsman",
        "siegeBrute",
      ],
    },
  ],
  skybridge: [
    {
      name: "Bridge Stalkers",
      intervalMs: 1030,
      enemies: [
        "corruptedScout",
        "flyingHarrier",
        "fallenSwordsman",
        "corruptedScout",
        "flyingHarrier",
        "fallenSwordsman",
      ],
    },
    {
      name: "Broken Choir",
      intervalMs: 900,
      enemies: [
        "fallenSwordsman",
        "shadowCaster",
        "corruptedScout",
        "fallenSwordsman",
        "shadowCaster",
        "flyingHarrier",
        "fallenSwordsman",
      ],
    },
    {
      name: "Caster Screen",
      intervalMs: 820,
      enemies: [
        "shadowCaster",
        "fallenSwordsman",
        "flyingHarrier",
        "shadowCaster",
        "fallenSwordsman",
        "siegeBrute",
        "shadowCaster",
      ],
    },
  ],
  moonGarden: [
    {
      name: "Moonlit Harriers",
      intervalMs: 900,
      enemies: [
        "flyingHarrier",
        "corruptedScout",
        "flyingHarrier",
        "fallenSwordsman",
        "flyingHarrier",
        "shadowCaster",
        "flyingHarrier",
      ],
    },
    {
      name: "Winged Lances",
      intervalMs: 790,
      enemies: [
        "fallenSwordsman",
        "flyingHarrier",
        "shadowCaster",
        "flyingHarrier",
        "siegeBrute",
        "flyingHarrier",
        "shadowCaster",
        "fallenSwordsman",
      ],
    },
    {
      name: "Dark Archangel",
      intervalMs: 740,
      enemies: [
        "siegeBrute",
        "shadowCaster",
        "flyingHarrier",
        "fallenSwordsman",
        "shadowCaster",
        "flyingHarrier",
        "darkArchangel",
      ],
    },
  ],
  sunreach: [
    {
      name: "Siege of Thorns",
      intervalMs: 820,
      enemies: [
        "siegeBrute",
        "fallenSwordsman",
        "shadowCaster",
        "flyingHarrier",
        "siegeBrute",
        "fallenSwordsman",
        "shadowCaster",
        "obsidianBulwark",
      ],
    },
    {
      name: "Obsidian Push",
      intervalMs: 700,
      enemies: [
        "fallenSwordsman",
        "obsidianBulwark",
        "shadowCaster",
        "siegeBrute",
        "flyingHarrier",
        "obsidianBulwark",
        "darkArchangel",
      ],
    },
    {
      name: "Burning Rampart",
      intervalMs: 620,
      enemies: [
        "siegeBrute",
        "obsidianBulwark",
        "shadowCaster",
        "fallenSwordsman",
        "obsidianBulwark",
        "darkArchangel",
        "obsidianBulwark",
      ],
    },
  ],
  nightBridges: [
    {
      name: "Void Wing",
      intervalMs: 700,
      enemies: [
        "voidSeraph",
        "flyingHarrier",
        "shadowCaster",
        "voidSeraph",
        "siegeBrute",
        "voidSeraph",
        "darkArchangel",
      ],
    },
    {
      name: "Abyssal Procession",
      intervalMs: 620,
      enemies: [
        "obsidianBulwark",
        "shadowCaster",
        "voidSeraph",
        "darkArchangel",
        "obsidianBulwark",
        "abyssalHierophant",
      ],
    },
    {
      name: "The Last Gate",
      intervalMs: 540,
      enemies: [
        "voidSeraph",
        "obsidianBulwark",
        "shadowCaster",
        "darkArchangel",
        "voidSeraph",
        "abyssalHierophant",
        "obsidianBulwark",
        "abyssalHierophant",
      ],
    },
  ],
} satisfies Record<MapId, WaveDefinition[]>;

export const WAVES = MAP_WAVES.citadel;

export const TOWER_TYPES = {
  lightspire: {
    name: "Lightspire",
    texture: "/assets/sprites/towers/lightspire.png",
    cost: 90,
    description: "Fast, low-damage holy bolts. Best against scouts and harriers.",
    behavior: "projectile",
    innerRange: 0,
    range: 250,
    damage: 22,
    cooldownMs: 360,
    projectileSpeed: 560,
    color: 0xf5d06f,
    animation: {
      cycleMs: 900,
      bobPx: 2,
      pulse: 0.035,
      glow: 0.24,
    },
  },
  judgmentLens: {
    name: "Judgment Lens",
    texture: "/assets/sprites/towers/judgment-lens.png",
    cost: 145,
    description: "Channels a heavy judgment beam. Good against brutes and boss enemies.",
    behavior: "beam",
    innerRange: 70,
    range: 230,
    damage: 84,
    cooldownMs: 1350,
    projectileSpeed: 0,
    beamDurationMs: 420,
    beamWidth: 12,
    color: 0x9bd7ff,
    animation: {
      cycleMs: 1600,
      bobPx: 1,
      pulse: 0.018,
      glow: 0.28,
    },
  },
  harmonicBell: {
    name: "Harmonic Bell",
    texture: "/assets/sprites/towers/harmonic-bell.png",
    cost: 125,
    description: "Emits periodic shockwaves around itself, damaging clustered enemies.",
    behavior: "shockwave",
    innerRange: 0,
    range: 205,
    damage: 38,
    cooldownMs: 1800,
    projectileSpeed: 0,
    color: 0x9be6ff,
    animation: {
      cycleMs: 1050,
      bobPx: 3,
      pulse: 0.04,
      glow: 0.3,
    },
  },
  sanctuaryWell: {
    name: "Sanctuary Well",
    texture: "/assets/sprites/towers/sanctuary-well.png",
    cost: 110,
    description: "Support tower that restores HP and MP to nearby angel hosts.",
    behavior: "support",
    innerRange: 0,
    range: 210,
    damage: 0,
    cooldownMs: 700,
    projectileSpeed: 0,
    color: 0x86d7ff,
    animation: {
      cycleMs: 1250,
      bobPx: 3,
      pulse: 0.035,
      glow: 0.34,
    },
  },
  flameChoir: {
    name: "Flame Choir",
    texture: "/assets/sprites/towers/flame-choir.png",
    cost: 150,
    description: "Slow, powerful burning shockwaves in a shorter radius.",
    behavior: "shockwave",
    innerRange: 0,
    range: 190,
    damage: 52,
    cooldownMs: 2100,
    projectileSpeed: 0,
    color: 0xff9d43,
    animation: {
      cycleMs: 620,
      bobPx: 2,
      pulse: 0.055,
      glow: 0.38,
    },
  },
  prismChain: {
    name: "Prism Chain",
    texture: "/assets/sprites/towers/prism-chain.png",
    cost: 135,
    description: "Longer-range crystal shots with strong sustained pressure.",
    behavior: "projectile",
    innerRange: 85,
    range: 270,
    damage: 44,
    cooldownMs: 860,
    projectileSpeed: 700,
    color: 0x75e8ff,
    animation: {
      cycleMs: 740,
      bobPx: 2,
      pulse: 0.045,
      glow: 0.32,
    },
  },
  temporalFont: {
    name: "Temporal Font",
    texture: "/assets/sprites/towers/prism-chain.png",
    cost: 140,
    description: "Radiates a time-slowing field, reducing enemy movement and corrupted-host attack tempo nearby.",
    behavior: "slow",
    innerRange: 35,
    range: 225,
    damage: 0,
    cooldownMs: 1050,
    projectileSpeed: 0,
    slowPercent: 0.45,
    color: 0xb6f7ff,
    animation: {
      cycleMs: 1180,
      bobPx: 3,
      pulse: 0.05,
      glow: 0.36,
    },
  },
} as const;

export type TowerKind = keyof typeof TOWER_TYPES;

export type CampaignChapter = {
  index: number;
  title: string;
  story: string;
  storyImage: string;
  unlocks: {
    towers: TowerKind[];
    hosts: HostKind[];
    ability: boolean;
    enemies: EnemyKind[];
    notes: string[];
  };
};

export const CAMPAIGN_CHAPTERS = {
  citadel: {
    index: 0,
    title: "Chapter I: The First Breach",
    story: "The first host reaches the outer gate with only basic light and resonance.",
    storyImage: "/assets/story/campaign-awakening.png",
    unlocks: {
      towers: ["lightspire", "harmonicBell"],
      hosts: ["host", "raphael", "zadkiel", "gagiel", "jophiel", "michael"],
      ability: false,
      enemies: ["corruptedScout", "fallenSwordsman", "siegeBrute"],
      notes: [
        "Lightspire handles scouts.",
        "Harmonic Bell punishes clustered swordsmen.",
        "Named special angels can each deploy once per battle and build tension while acting.",
      ],
    },
  },
  skybridge: {
    index: 1,
    title: "Chapter II: The Sanctuary Choir",
    story: "The skybridge sanctuaries answer with a new healing host.",
    storyImage: "/assets/story/campaign-sanctuary.png",
    unlocks: {
      towers: [],
      hosts: ["healer"],
      ability: false,
      enemies: ["shadowCaster"],
      notes: ["Healers keep damaged hosts alive while Shadow Casters test your support placement."],
    },
  },
  moonGarden: {
    index: 2,
    title: "Chapter III: Purification Rite",
    story: "The moon garden teaches the hosts how to reclaim corrupted souls.",
    storyImage: "/assets/story/campaign-sanctuary.png",
    unlocks: {
      towers: [],
      hosts: [],
      ability: true,
      enemies: ["flyingHarrier"],
      notes: ["Purify is expensive, but it can reverse a dangerous corruption swing."],
    },
  },
  sunreach: {
    index: 3,
    title: "Chapter IV: Watchers of Sunreach",
    story: "The causeway opens long sightlines for the archer hosts.",
    storyImage: "/assets/story/campaign-final-armory.png",
    unlocks: {
      towers: [],
      hosts: ["archers"],
      ability: false,
      enemies: ["darkArchangel"],
      notes: ["Archers answer flyers and dark archangels before they reach the gate."],
    },
  },
  nightBridges: {
    index: 4,
    title: "Chapter V: Judgment Lens",
    story: "The final bridges reveal a tower built for elite targets.",
    storyImage: "/assets/story/campaign-final-armory.png",
    unlocks: {
      towers: ["judgmentLens"],
      hosts: [],
      ability: false,
      enemies: ["obsidianBulwark"],
      notes: ["Judgment Lens beams are the clean answer to armored elites."],
    },
  },
} satisfies Record<MapId, CampaignChapter>;

export const PEDESTAL_RADIUS = 58;

export const TOWER_SLOTS = MAPS.citadel.towerSlots;

export const INITIAL_UNIT = {
  name: "Alizel's Host",
  x: 430,
  y: 476,
  speed: 118,
  attackRange: 176,
  engagementRange: 232,
  attackCooldownMs: 760,
  memberCount: 5,
  memberHp: 185,
  memberMp: 70,
  damagePerMember: 13,
};
