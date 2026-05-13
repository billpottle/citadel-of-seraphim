import type { Container, Graphics, Sprite, Text } from "pixi.js";
import type { AnimationKey } from "./animationCatalog";

export type Point = {
  x: number;
  y: number;
};

export type HudRefs = {
  wave: HTMLElement | null;
  gate: HTMLElement | null;
  enemies: HTMLElement | null;
  energy: HTMLElement | null;
  units: HTMLElement | null;
  status: HTMLElement | null;
  unitName: HTMLElement | null;
  unitDetail: HTMLElement | null;
  unitHp: HTMLElement | null;
  unitMp: HTMLElement | null;
  difficultySelect: HTMLSelectElement | null;
  battleSpeedSelect: HTMLSelectElement | null;
  towersPanel: HTMLButtonElement | null;
  hostsPanel: HTMLButtonElement | null;
  abilityPanel: HTMLButtonElement | null;
  buildList: HTMLElement | null;
  buildDetail: HTMLElement | null;
  mapSelect: HTMLSelectElement | null;
  scrollLeftButton: HTMLButtonElement | null;
  scrollRightButton: HTMLButtonElement | null;
  mapEditButton: HTMLButtonElement | null;
  mapEditorPanel: HTMLElement | null;
  mapEditTool: HTMLSelectElement | null;
  addPathPointButton: HTMLButtonElement | null;
  removePathPointButton: HTMLButtonElement | null;
  copyMapButton: HTMLButtonElement | null;
  resetMapButton: HTMLButtonElement | null;
  audioButton: HTMLButtonElement | null;
  restartButton: HTMLButtonElement | null;
};

export type UnitMember = {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  hitTimerMs: number;
  deathTimerMs: number;
  offset: Point;
  animationPhaseMs: number;
  scaleJitter: number;
  bobJitter: number;
  targetPreference: number;
  sprite: Sprite;
  hpBar: Graphics;
};

export type Unit = {
  id: string;
  kind: string;
  team: "angel" | "demon";
  baseName: string;
  name: string;
  x: number;
  y: number;
  facingX: number;
  destination: Point | null;
  speed: number;
  attackRange: number;
  engagementRange: number;
  attackCooldownMs: number;
  attackTimerMs: number;
  damagePerMember: number;
  healPerMember: number;
  defense: number;
  tint: number;
  corruption: number;
  selected: boolean;
  pose: AnimationKey;
  poseTimerMs: number;
  animationTimeMs: number;
  container: Container;
  selectionRing: Graphics;
  destinationMarker: Graphics;
  members: UnitMember[];
  label: Text;
};

export type Enemy = {
  id: number;
  kind: string;
  energyReward: number;
  baseScale: number;
  walkTimeMs: number;
  projectileCooldownMs: number;
  x: number;
  y: number;
  facingX: number;
  hp: number;
  maxHp: number;
  speed: number;
  gateDamagePerSecond: number;
  pathId: number;
  pathIndex: number;
  attackingGate: boolean;
  container: Container;
  sprite: Sprite;
  aura: Graphics;
  hpBar: Graphics;
};

export type Tower = {
  name: string;
  kind: string;
  slotIndex: number;
  hp: number;
  maxHp: number;
  selected: boolean;
  hitTimerMs: number;
  behavior: string;
  x: number;
  y: number;
  range: number;
  damage: number;
  beamDurationMs?: number;
  beamWidth?: number;
  slowPercent?: number;
  cooldownMs: number;
  projectileSpeed: number;
  cooldownRemainingMs: number;
  color: number;
  baseScale: number;
  animationTimeMs: number;
  firePulseMs: number;
  container: Container;
  sprite: Sprite;
  selectionRing: Graphics;
  glow: Graphics;
  effectRing: Graphics;
  rangeRing: Graphics;
  hpBar: Graphics;
};

export type Projectile = {
  allegiance: "angel" | "demon";
  x: number;
  y: number;
  speed: number;
  damage: number;
  target?: Enemy;
  targetUnit?: Unit;
  targetTower?: Tower;
  targetOffset?: Point;
  graphic: Graphics;
};

export type Beam = {
  allegiance: "angel" | "demon";
  ageMs: number;
  durationMs: number;
  width: number;
  color: number;
  origin: Point;
  targetPoint: Point;
  target?: Enemy;
  targetUnit?: Unit;
  targetOffset?: Point;
  graphic: Graphics;
};

export type Shockwave = {
  x: number;
  y: number;
  radius: number;
  ageMs: number;
  durationMs: number;
  color: number;
  graphic: Graphics;
};
