import type { Container, Graphics, Sprite, Text } from "pixi.js";
import type { AnimationKey } from "./animationCatalog";

export type Point = {
  x: number;
  y: number;
};

export type AutoMoveMode =
  | "manual"
  | "gate"
  | "nearestEnemy"
  | "strongestEnemy"
  | "weakestEnemy"
  | "nearestHealer"
  | "woundedAlly"
  | "portal";

export type HudRefs = {
  wave: HTMLElement | null;
  gate: HTMLElement | null;
  gateHpFill: HTMLElement | null;
  enemies: HTMLElement | null;
  energy: HTMLElement | null;
  units: HTMLElement | null;
  status: HTMLElement | null;
  unitName: HTMLElement | null;
  unitDetail: HTMLElement | null;
  unitHp: HTMLElement | null;
  unitMp: HTMLElement | null;
  autoMoveSelect: HTMLSelectElement | null;
  difficultySelect: HTMLSelectElement | null;
  battleSpeedSelect: HTMLSelectElement | null;
  pauseButton: HTMLButtonElement | null;
  waveDirectorSelect: HTMLSelectElement | null;
  waveLimitSelect: HTMLSelectElement | null;
  towersPanel: HTMLButtonElement | null;
  hostsPanel: HTMLButtonElement | null;
  abilityPanel: HTMLButtonElement | null;
  buildOverlay: HTMLElement | null;
  buildOverlayTitle: HTMLElement | null;
  buildOverlayCloseButton: HTMLButtonElement | null;
  buildList: HTMLElement | null;
  buildDetail: HTMLElement | null;
  selectedOverlay: HTMLElement | null;
  selectedOverlayCloseButton: HTMLButtonElement | null;
  selectedQuick: HTMLElement | null;
  selectedCurrentButton: HTMLButtonElement | null;
  selectedCurrentIcon: HTMLElement | null;
  selectedCurrentLabel: HTMLElement | null;
  sellSelectedButton: HTMLButtonElement | null;
  selectedMoveField: HTMLElement | null;
  tensionBurstButton: HTMLButtonElement | null;
  towerRangeButton: HTMLButtonElement | null;
  mapSelect: HTMLSelectElement | null;
  scrollLeftButton: HTMLButtonElement | null;
  scrollRightButton: HTMLButtonElement | null;
  scrollUpButton: HTMLButtonElement | null;
  scrollDownButton: HTMLButtonElement | null;
  mapEditButton: HTMLButtonElement | null;
  mapOverviewButton: HTMLButtonElement | null;
  mapOverviewPanel: HTMLElement | null;
  mapEditorPanel: HTMLElement | null;
  mapEditTool: HTMLSelectElement | null;
  mapEditTowerKind: HTMLSelectElement | null;
  addPathPointButton: HTMLButtonElement | null;
  addSidePathButton: HTMLButtonElement | null;
  addEditorTowerButton: HTMLButtonElement | null;
  removePathPointButton: HTMLButtonElement | null;
  copyMapButton: HTMLButtonElement | null;
  resetMapButton: HTMLButtonElement | null;
  guideButton: HTMLButtonElement | null;
  audioButton: HTMLButtonElement | null;
  abandonBattleButton: HTMLButtonElement | null;
  restartButton: HTMLButtonElement | null;
  settingsToggleButton: HTMLButtonElement | null;
  settingsMenu: HTMLElement | null;
  menuOverlay: HTMLElement | null;
  storyIntroOverlay: HTMLElement | null;
  storyIntroTrack: HTMLElement | null;
  storyIntroProgress: HTMLElement | null;
  storyIntroSkipButton: HTMLButtonElement | null;
  storyIntroStartButton: HTMLButtonElement | null;
  victoryOverlay: HTMLElement | null;
  victoryNextButton: HTMLButtonElement | null;
  victoryArmoryButton: HTMLButtonElement | null;
  armoryOverlay: HTMLElement | null;
  armoryTitle: HTMLElement | null;
  armoryBody: HTMLElement | null;
  armoryStartButton: HTMLButtonElement | null;
  armoryLoadButton: HTMLButtonElement | null;
  armoryGuideButton: HTMLButtonElement | null;
  victorySummary: HTMLElement | null;
  menuStoryImage: HTMLImageElement | null;
  menuTitle: HTMLElement | null;
  menuBody: HTMLElement | null;
  menuUnlocks: HTMLElement | null;
  campaignMap: HTMLElement | null;
  menuLobby: HTMLElement | null;
  menuTutorial: HTMLElement | null;
  menuMapSelect: HTMLSelectElement | null;
  menuDifficultySelect: HTMLSelectElement | null;
  newCampaignButton: HTMLButtonElement | null;
  loadCampaignButton: HTMLButtonElement | null;
  skipMenuButton: HTMLButtonElement | null;
  menuGuideButton: HTMLButtonElement | null;
  resumeBattleButton: HTMLButtonElement | null;
  guideOverlay: HTMLElement | null;
  guideCloseButton: HTMLButtonElement | null;
  guideTabs: HTMLElement | null;
  guideContent: HTMLElement | null;
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
  special: boolean;
  specialAbility?: "healer" | "cleanse" | "washback" | "boardSlash" | "archangel";
  team: "angel" | "demon";
  baseName: string;
  name: string;
  x: number;
  y: number;
  facingX: number;
  destination: Point | null;
  destinationPath: { path: Point[]; targetProgress: number } | null;
  pathPosition: { path: Point[]; progress: number } | null;
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
  tension: number;
  maxTension: number;
  tensionSlowMs?: number;
  autoMoveMode: AutoMoveMode;
  autoMoveRetargetMs: number;
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
  tensionSlowMs?: number;
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
  level: number;
  hp: number;
  maxHp: number;
  selected: boolean;
  hitTimerMs: number;
  behavior: string;
  x: number;
  y: number;
  innerRange: number;
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
  tension: number;
  maxTension: number;
  showRange: boolean;
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
  sourceTower?: Tower;
  corrupts?: boolean;
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
  style?: "ring" | "slash";
  facingX?: number;
  graphic: Graphics;
};
