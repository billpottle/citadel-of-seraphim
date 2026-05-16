import {
  Application,
  Assets,
  Container,
  FederatedPointerEvent,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
} from "pixi.js";
import { AudioDirector } from "./AudioDirector";
import { hostAnimationCatalog, type AnimationKey, type HostSpriteKey } from "./animationCatalog";
import {
  CAMPAIGN_MAP_LAYOUT_OVERRIDES,
  type CampaignMapLayoutOverride,
  type CampaignMapLinkOverride,
  type CampaignMapLevelOverride,
} from "./campaignMapLayoutOverrides";
import {
  CAMPAIGN_CHAPTERS,
  DEFAULT_MAP_ID,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  DIFFICULTY_MODES,
  ENEMY_TYPES,
  HOST_TYPES,
  MAP_WAVES,
  PATH_DEPLOY_TOLERANCE,
  PEDESTAL_RADIUS,
  MAP_ORDER,
  MAPS,
  PURIFY_COST,
  TOWER_TYPES,
  type DifficultyMode,
  type EnemyKind,
  type GateConfig,
  type HostKind,
  type MapId,
  type TowerKind,
  type WaveDefinition,
} from "./config";
import type {
  AutoMoveMode,
  Beam,
  Enemy,
  HudRefs,
  Point,
  Projectile,
  Shockwave,
  Tower,
  Unit,
  UnitMember,
} from "./types";

const TAU = Math.PI * 2;
const GAME_SETTINGS_STORAGE_KEY = "citadel.settings.v1";
const CAMPAIGN_STORAGE_KEY = "citadel.campaign.v1";
const TUTORIAL_STORAGE_KEY = "citadel.tutorialSeen.v1";
const MAP_AUTHORING_STORAGE_KEY = "citadel.mapAuthoringLayouts.v1";
const CAMPAIGN_MAP_AUTHORING_STORAGE_KEY = "citadel.campaignMapAuthoring.v1";
const DEV_MODE_STORAGE_KEY = "citadel.devMode.v1";
const BATTLE_SPEED_OPTIONS = [0, 0.5, 1, 1.5, 2, 3] as const;
const AUTO_MOVE_OPTIONS: { mode: AutoMoveMode; label: string }[] = [
  { mode: "manual", label: "Manual" },
  { mode: "gate", label: "Towards Gate" },
  { mode: "nearestEnemy", label: "Nearest Enemy" },
  { mode: "strongestEnemy", label: "Strongest Enemy" },
  { mode: "weakestEnemy", label: "Weakest Enemy" },
  { mode: "nearestHealer", label: "Nearest Healer" },
  { mode: "woundedAlly", label: "Wounded Ally" },
  { mode: "portal", label: "Towards Portal" },
];
const WAVE_LIMIT_OPTIONS = [
  { value: "all", label: "Story default" },
  { value: "1", label: "1 wave" },
  { value: "2", label: "2 waves" },
  { value: "3", label: "3 waves" },
  { value: "5", label: "5 waves" },
  { value: "10", label: "10 waves" },
] as const;
const WAVE_DIRECTOR_MODES = {
  ordered: {
    name: "Ordered",
    description: "Uses the scripted wave order for the selected map.",
  },
  adaptive: {
    name: "AI Director",
    description: "Chooses wave templates and demon gates based on the board state.",
  },
} as const;
type CampaignMountainLevel = {
  id: string;
  index: number;
  title: string;
  mapId: MapId;
  x: number;
  y: number;
  story: string;
  sideQuest?: boolean;
};
const CAMPAIGN_MOUNTAIN_LEVELS = [
  {
    id: "breach-road",
    index: 0,
    title: "Breach Road",
    mapId: "citadel",
    x: 9,
    y: 84,
    story: "The first road out of the corrupted citadel is still burning.",
  },
  {
    id: "ash-switchback",
    index: 1,
    title: "Ash Switchback",
    mapId: "citadel",
    x: 20,
    y: 77,
    story: "A lower switchback gives the hosts room to learn the climb.",
  },
  {
    id: "broken-causeway",
    index: 2,
    title: "Broken Causeway",
    mapId: "skybridge",
    x: 32,
    y: 69,
    story: "Old bridges force the first split in the demon roads.",
  },
  {
    id: "choir-landing",
    index: 3,
    title: "Choir Landing",
    mapId: "skybridge",
    x: 43,
    y: 74,
    story: "A side landing hides a sanctuary route above the smoke.",
    sideQuest: true,
  },
  {
    id: "moonwell-path",
    index: 4,
    title: "Moonwell Path",
    mapId: "moonGarden",
    x: 54,
    y: 66,
    story: "Moonlit stones reveal where corruption can be washed clean.",
  },
  {
    id: "garden-stairs",
    index: 5,
    title: "Garden Stairs",
    mapId: "moonGarden",
    x: 65,
    y: 58,
    story: "The garden stairs climb through narrow ambush points.",
  },
  {
    id: "lower-sunreach",
    index: 6,
    title: "Lower Sunreach",
    mapId: "sunreach",
    x: 76,
    y: 63,
    story: "Sunreach begins below the high towers, where light can still break through.",
  },
  {
    id: "crystal-cut",
    index: 7,
    title: "Crystal Cut",
    mapId: "sunreach",
    x: 85,
    y: 52,
    story: "Crystalline road cuts give ranged towers long, clean lanes.",
    sideQuest: true,
  },
  {
    id: "bridge-of-vows",
    index: 8,
    title: "Bridge of Vows",
    mapId: "skybridge",
    x: 71,
    y: 44,
    story: "The road bends back across old vows carved into the bridgework.",
  },
  {
    id: "quiet-terrace",
    index: 9,
    title: "Quiet Terrace",
    mapId: "moonGarden",
    x: 59,
    y: 39,
    story: "A quiet terrace becomes a lure point for demon patrols.",
  },
  {
    id: "watcher-steps",
    index: 10,
    title: "Watcher Steps",
    mapId: "sunreach",
    x: 46,
    y: 45,
    story: "Watcher statues mark a steeper, more exposed road.",
  },
  {
    id: "night-approach",
    index: 11,
    title: "Night Approach",
    mapId: "nightBridges",
    x: 36,
    y: 34,
    story: "Night bridges gather below the summit fog.",
  },
  {
    id: "black-viaduct",
    index: 12,
    title: "Black Viaduct",
    mapId: "nightBridges",
    x: 48,
    y: 28,
    story: "The black viaduct is the first true test of the upper climb.",
  },
  {
    id: "prism-shelf",
    index: 13,
    title: "Prism Shelf",
    mapId: "sunreach",
    x: 61,
    y: 25,
    story: "A prism shelf catches light from below and throws it back at the dark.",
    sideQuest: true,
  },
  {
    id: "sealed-choir",
    index: 14,
    title: "Sealed Choir",
    mapId: "nightBridges",
    x: 73,
    y: 20,
    story: "The sealed choir waits beneath cloud and stone.",
  },
  {
    id: "mist-gate",
    index: 15,
    title: "Mist Gate",
    mapId: "nightBridges",
    x: 85,
    y: 15,
    story: "The mist gate is not the summit, but it is where the lower mountain ends.",
  },
] as const satisfies readonly CampaignMountainLevel[];
const GATE_GAUGE_ASPECT = 3;
const GATE_GAUGE_RIGHT_CLEARANCE = 0;
const GATE_GAUGE_MIN_WIDTH = 230;
const GATE_GAUGE_MAX_WIDTH = 360;
const GATE_HUD_MARGIN = 6;
const TOP_HUD_RESERVED_HEIGHT = 78;
const DEMON_PROJECTILE_CORRUPTION_FACTOR = 0.55;
const DEMON_MELEE_CORRUPTION_PER_SECOND = 1.1;
const TOWER_TENSION_MAX = 100;
const TOWER_TENSION_GAIN_PER_HIT = 11;
const TOWER_TENSION_GAIN_PER_SHOCKWAVE_TARGET = 7;
const TOWER_TENSION_GAIN_PER_SLOWED_TARGET = 5;
const TOWER_TENSION_BASE_RANGE_BONUS = 70;
const TOWER_TENSION_RANGE_PER_LEVEL = 22;
const TOWER_TENSION_DAMAGE_MULTIPLIER = 2.75;
const TOWER_TENSION_HEAL_MULTIPLIER = 2.4;
const TOWER_TENSION_SLOW_DURATION_MS = 2400;
const SPECIAL_ANGEL_TENSION_MAX = 100;
const SPECIAL_ANGEL_TENSION_GAIN_PER_ACTION = 13;
const SPECIAL_ANGEL_BURST_RANGE = 320;
const TUTORIAL_WAVES: WaveDefinition[] = [
  {
    name: "Training Advance",
    intervalMs: 1650,
    enemies: [
      "corruptedScout",
      "corruptedScout",
      "fallenSwordsman",
      "corruptedScout",
      "fallenSwordsman",
      "corruptedScout",
      "fallenSwordsman",
      "corruptedScout",
    ],
  },
];
const TOWER_MAX_LEVEL = 5;
const BASE_RADIANCE_REWARD = 80;
const BUILD_MODE_LABELS: Record<BuildMode, string> = {
  towers: "Towers",
  hosts: "Hosts",
  ability: "Purify",
};
const MOUNTAIN_SIDEQUESTS: Array<{
  id: string;
  title: string;
  fromMap: MapId;
  tower: TowerKind;
  description: string;
  x: number;
  y: number;
}> = [
  {
    id: "sanctuary-spring",
    title: "Sanctuary Spring",
    fromMap: "skybridge",
    tower: "sanctuaryWell",
    description: "A healing detour that reveals the Sanctuary Well support tower.",
    x: 36,
    y: 74,
  },
  {
    id: "ember-choir",
    title: "Ember Choir",
    fromMap: "moonGarden",
    tower: "flameChoir",
    description: "A dangerous side path that unlocks short-range burning shockwaves.",
    x: 57,
    y: 57,
  },
  {
    id: "prism-ridge",
    title: "Prism Ridge",
    fromMap: "sunreach",
    tower: "prismChain",
    description: "A bright ridge path that unlocks long-range sustained crystal fire.",
    x: 76,
    y: 43,
  },
  {
    id: "temporal-font",
    title: "Temporal Font",
    fromMap: "nightBridges",
    tower: "temporalFont",
    description: "A summit-side shrine that unlocks a slowing field tower.",
    x: 45,
    y: 31,
  },
];
const isFinitePoint = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const colorToCss = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
const FACE_THRESHOLD = 5;
const facingToward = (from: Point, to: Point | null | undefined, fallback: number) => {
  if (!to || Math.abs(to.x - from.x) < FACE_THRESHOLD) {
    return fallback < 0 ? -1 : 1;
  }

  return to.x < from.x ? -1 : 1;
};

type BuildMode = "towers" | "hosts" | "ability";
type GuideSection = "towers" | "hosts" | "demons" | "systems";
type MapEditTool = "towerSlots" | "path" | "gate";
type PathGroup = "lane" | "side";
type CombatTutorialStep = "premise" | "buildTower" | "redeployHost" | "surviveWave";
type WaveDirectorMode = keyof typeof WAVE_DIRECTOR_MODES;
type WaveLimitMode = (typeof WAVE_LIMIT_OPTIONS)[number]["value"];
type UnitTeam = Unit["team"];
type DemonTarget = { enemy: Enemy; unit?: never } | { enemy?: never; unit: Unit };
type AngelTarget = { unit: Unit; tower?: never } | { unit?: never; tower: Tower };
type EditorDragTarget =
  | { type: "slot"; index: number }
  | { type: "path"; group: PathGroup; pathId: number; index: number }
  | { type: "gate" };
type CampaignMapDragTarget = {
  type: "level" | "sideQuest";
  id: string;
  pointerId: number;
  moved: boolean;
};
type CampaignMapLinkEditMode = "connect" | "break";
type EditableCampaignMountainLevel = CampaignMountainLevel | (CampaignMapLevelOverride & { mapId: MapId });
type EditableMapState = {
  id: MapId;
  name: string;
  background: string;
  width: number;
  height: number;
  path: Point[];
  paths: Point[][];
  sidePaths: Point[][];
  towerSlots: Point[];
  gate: GateConfig;
  startingUnit: Point;
};
type StoredMapLayoutOverride = Partial<Pick<EditableMapState, "path" | "paths" | "sidePaths" | "towerSlots" | "gate" | "startingUnit">>;
type CampaignProgress = {
  highestUnlockedIndex: number;
  highestUnlockedLevelIndex: number;
  completedMaps: Partial<Record<MapId, boolean>>;
  completedLevels: Record<string, boolean>;
  radiance: number;
  sanctumCores: number;
  purchasedTowers: Partial<Record<TowerKind, boolean>>;
  towerLevels: Partial<Record<TowerKind, number>>;
  claimedCoreObjectives: Record<string, boolean>;
};
type RewardCurrency = "radiance" | "core";
type VictoryRewardLine = {
  label: string;
  metric: string;
  reward: string;
  amount: number;
  currency: RewardCurrency;
  progress: number;
  achieved: boolean;
  earnedNow?: boolean;
  alreadyClaimed?: boolean;
};
type CampaignVictorySummary = {
  completedMapId: MapId;
  completedLevelTitle: string;
  nextMapId: MapId | null;
  nextLevelTitle: string | null;
  nextLevelStory: string | null;
  newlyUnlocked: boolean;
  radianceEarned: number;
  sanctumCoresEarned: number;
  coreReasons: string[];
  radianceRewards: VictoryRewardLine[];
  coreObjectives: VictoryRewardLine[];
};
type UnlockCard = {
  title: string;
  subtitle: string;
  description: string;
  imageSrc?: string;
  accentColor: number;
};
type WaveSpawnPlanItem = {
  kind: EnemyKind;
  pathId: number;
};
type LaneProfile = {
  pathId: number;
  towerCoverage: number;
  hostCoverage: number;
  supportCoverage: number;
  pressure: number;
  vulnerability: number;
};
type AiBoardProfile = {
  lanes: LaneProfile[];
  gateRatio: number;
  towerCounts: Record<TowerKind, number>;
  hostCounts: Record<HostKind, number>;
  towerCount: number;
  angelMembers: number;
  woundedAngelRatio: number;
  rangedCounterScore: number;
  armorCounterScore: number;
  areaControlScore: number;
  supportScore: number;
  slowControlScore: number;
};

type MinimapMetrics = {
  mapX: number;
  mapY: number;
  mapWidth: number;
  mapHeight: number;
  scale: number;
  panelX: number;
  panelY: number;
  panelWidth: number;
  panelHeight: number;
};

const combatTargetPoint = (target: DemonTarget | AngelTarget): Point => {
  if ("enemy" in target && target.enemy) {
    return target.enemy;
  }

  if ("tower" in target && target.tower) {
    return target.tower;
  }

  return target.unit!;
};

function closestPointOnSegment(point: Point, start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return { ...start };
  }

  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return {
    x: start.x + dx * t,
    y: start.y + dy * t,
  };
}

function projectedPointOnPath(point: Point, path: Point[]) {
  let closest = {
    point: path[0],
    distance: Number.POSITIVE_INFINITY,
    segmentIndex: 0,
    progress: 0,
  };
  let segmentStartProgress = 0;

  for (let i = 0; i < path.length - 1; i += 1) {
    const start = path[i];
    const end = path[i + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
    const candidate = {
      x: start.x + dx * t,
      y: start.y + dy * t,
    };
    const candidateDistance = distance(point, candidate);
    if (candidateDistance < closest.distance) {
      closest = {
        point: candidate,
        distance: candidateDistance,
        segmentIndex: i,
        progress: segmentStartProgress + length * t,
      };
    }
    segmentStartProgress += length;
  }

  return closest;
}

function projectedPointOnPaths(point: Point, paths: Point[][]) {
  let closest = {
    ...projectedPointOnPath(point, paths[0]),
    path: paths[0],
    pathId: 0,
  };

  for (const [pathId, path] of paths.entries()) {
    const candidate = projectedPointOnPath(point, path);
    if (candidate.distance < closest.distance) {
      closest = { ...candidate, path, pathId };
    }
  }

  return closest;
}

function pointAtPathProgress(path: Point[], progress: number): Point {
  let remaining = Math.max(0, progress);

  for (let i = 0; i < path.length - 1; i += 1) {
    const start = path[i];
    const end = path[i + 1];
    const segmentLength = distance(start, end);
    if (remaining <= segmentLength) {
      const t = segmentLength === 0 ? 0 : remaining / segmentLength;
      return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      };
    }
    remaining -= segmentLength;
  }

  return path[path.length - 1] ?? path[0];
}

function pathTotalLength(path: Point[]) {
  let total = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    total += distance(path[i], path[i + 1]);
  }
  return total;
}

function closestPathSegmentIndex(point: Point, path: Point[]) {
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < path.length - 1; i += 1) {
    const candidate = closestPointOnSegment(point, path[i], path[i + 1]);
    const candidateDistance = distance(point, candidate);
    if (candidateDistance < closestDistance) {
      closestIndex = i;
      closestDistance = candidateDistance;
    }
  }

  return closestIndex;
}

export class CitadelGame {
  private app = new Application();
  private readonly root: HTMLDivElement;
  private readonly hud: HudRefs;
  private readonly world = new Container();
  private readonly mapLayer = new Container();
  private readonly towerLayer = new Container();
  private readonly enemyLayer = new Container();
  private readonly unitLayer = new Container();
  private readonly projectileLayer = new Container();
  private readonly overlayLayer = new Container();
  private readonly editorLayer = new Container();
  private readonly gateHudLayer = new Container();
  private readonly minimapLayer = new Container();
  private readonly minimapGraphic = new Graphics();
  private pedestalLabels: Text[] = [];
  private readonly audio = new AudioDirector();
  private readonly devMapAuthoring =
    location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "::1";
  private devMode = this.loadDevMode();
  private textures!: {
    maps: Record<MapId, Texture>;
    angel: Record<HostSpriteKey, Record<AnimationKey, Texture[]>>;
    enemy: Record<EnemyKind, Texture>;
    tower: Record<TowerKind, Texture>;
    ui: {
      gateHpGauge: Texture;
    };
  };
  private activeMapId: MapId = DEFAULT_MAP_ID;
  private activeCampaignLevelIndex = 0;
  private campaignProgress: CampaignProgress = this.loadCampaignProgress();
  private map = this.loadMapLayout(DEFAULT_MAP_ID);
  private units: Unit[] = [];
  private selectedUnit: Unit | null = null;
  private selectedTower: Tower | null = null;
  private lastUnitClick: { id: string; timeMs: number } | null = null;
  private towers: Tower[] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private beams: Beam[] = [];
  private shockwaves: Shockwave[] = [];
  private difficultyMode: DifficultyMode = "normal";
  private battleSpeed = 1;
  private waveDirectorMode: WaveDirectorMode = "ordered";
  private waveLimitMode: WaveLimitMode = "all";
  private unitId = 1;
  private enemyId = 1;
  private currentWaveIndex = 0;
  private waveSpawned = 0;
  private activeWaveName = "";
  private activeWavePlan: WaveSpawnPlanItem[] = [];
  private spawnTimerMs = 0;
  private betweenWaveTimerMs = 1200;
  private energy: number = DIFFICULTY_MODES.normal.startingEnergy;
  private buildMode: BuildMode = "towers";
  private selectedTowerKind: TowerKind | null = "lightspire";
  private selectedHostKind: HostKind | null = "host";
  private deployedSpecialAngels = new Set<HostKind>();
  private purifyMode = false;
  private guideOpen = false;
  private guideSection: GuideSection = "towers";
  private mapEditMode = false;
  private isPaused = false;
  private mapEditTool: MapEditTool = "towerSlots";
  private selectedPathGroup: PathGroup = "lane";
  private editorDragTarget: EditorDragTarget | null = null;
  private cameraX = 0;
  private cameraY = 0;
  private selectedPathRouteIndex = 0;
  private selectedPathIndex = 0;
  private selectedSlotIndex = 0;
  private buildPanelStateKey = "";
  private statusOverrideMs = 0;
  private campaignMapEditMode = false;
  private campaignMapDraftLayout: CampaignMapLayoutOverride | null = null;
  private campaignMapDragTarget: CampaignMapDragTarget | null = null;
  private campaignMapLinkEditMode: CampaignMapLinkEditMode | null = null;
  private campaignMapSelectedLinkNodeId: string | null = null;
  private gateHp = this.map.gate.maxHp;
  private menuOpen = true;
  private battleState: "playing" | "victory" | "defeat" = "playing";
  private battleElapsedMs = 0;
  private towersDestroyedThisBattle = 0;
  private pendingContinueMapId: MapId | null = null;
  private pendingContinueLevelIndex: number | null = null;
  private pendingStoryStart: (() => void) | null = null;
  private storyIntroTimer: number | null = null;
  private combatTutorialStep: CombatTutorialStep | null = null;
  private combatTutorialPanel: HTMLElement | null = null;
  private combatTutorialHighlight: Container | null = null;
  private combatTutorialPulseRings: Graphics[] = [];
  private combatTutorialHighlightMs = 0;
  private forceCombatTutorial = false;
  private tutorialBattleActive = false;
  private gateGraphic = new Graphics();
  private gateHpGraphic = new Graphics();
  private gateHpFrameSprite: Sprite | null = null;
  private minimapMetrics: MinimapMetrics | null = null;

  constructor(root: HTMLDivElement) {
    this.root = root;
    this.hud = {
      wave: document.querySelector("#wave-readout"),
      gate: document.querySelector("#gate-readout"),
      gateHpFill: document.querySelector("#gate-hp-fill"),
      enemies: document.querySelector("#enemy-readout"),
      energy: document.querySelector("#energy-readout"),
      units: document.querySelector("#unit-count-readout"),
      status: document.querySelector("#status-readout"),
      unitName: document.querySelector("#selected-unit-name"),
      unitDetail: document.querySelector("#selected-unit-detail"),
      unitHp: document.querySelector("#unit-hp-meter"),
      unitMp: document.querySelector("#unit-mp-meter"),
      autoMoveSelect: document.querySelector("#auto-move-select"),
      difficultySelect: document.querySelector("#difficulty-select"),
      battleSpeedSelect: document.querySelector("#battle-speed-select"),
      pauseButton: document.querySelector("#pause-button"),
      waveDirectorSelect: document.querySelector("#wave-director-select"),
      waveLimitSelect: document.querySelector("#wave-limit-select"),
      towersPanel: document.querySelector("#towers-panel-button"),
      hostsPanel: document.querySelector("#hosts-panel-button"),
      abilityPanel: document.querySelector("#ability-panel-button"),
      buildOverlay: document.querySelector("#build-overlay"),
      buildOverlayTitle: document.querySelector("#build-overlay-title"),
      buildOverlayCloseButton: document.querySelector("#build-overlay-close-button"),
      buildList: document.querySelector("#build-list"),
      buildDetail: document.querySelector("#build-detail"),
      selectedOverlay: document.querySelector("#selected-overlay"),
      selectedOverlayCloseButton: document.querySelector("#selected-overlay-close-button"),
      selectedQuick: document.querySelector("#selected-quick"),
      selectedCurrentButton: document.querySelector("#selected-current-button"),
      selectedCurrentIcon: document.querySelector("#selected-current-icon"),
      selectedCurrentLabel: document.querySelector("#selected-current-label"),
      selectedMoveField: document.querySelector("#selected-move-field"),
      tensionBurstButton: document.querySelector("#tension-burst-button"),
      towerRangeButton: document.querySelector("#tower-range-button"),
      mapSelect: document.querySelector("#map-select"),
      scrollLeftButton: document.querySelector("#scroll-left-button"),
      scrollRightButton: document.querySelector("#scroll-right-button"),
      scrollUpButton: document.querySelector("#scroll-up-button"),
      scrollDownButton: document.querySelector("#scroll-down-button"),
      mapEditButton: document.querySelector("#map-edit-button"),
      mapEditorPanel: document.querySelector("#map-editor-panel"),
      mapEditTool: document.querySelector("#map-edit-tool"),
      mapEditTowerKind: document.querySelector("#map-edit-tower-kind"),
      addPathPointButton: document.querySelector("#add-path-point-button"),
      addSidePathButton: document.querySelector("#add-side-path-button"),
      addEditorTowerButton: document.querySelector("#add-editor-tower-button"),
      removePathPointButton: document.querySelector("#remove-path-point-button"),
      copyMapButton: document.querySelector("#copy-map-button"),
      resetMapButton: document.querySelector("#reset-map-button"),
      guideButton: document.querySelector("#guide-button"),
      audioButton: document.querySelector("#audio-button"),
      restartButton: document.querySelector("#restart-button"),
      settingsToggleButton: document.querySelector("#settings-toggle-button"),
      settingsMenu: document.querySelector("#settings-menu"),
      menuOverlay: document.querySelector("#game-menu"),
      storyIntroOverlay: document.querySelector("#story-intro-overlay"),
      storyIntroTrack: document.querySelector("#story-intro-track"),
      storyIntroProgress: document.querySelector("#story-intro-progress"),
      storyIntroSkipButton: document.querySelector("#story-intro-skip-button"),
      storyIntroStartButton: document.querySelector("#story-intro-start-button"),
      victoryOverlay: document.querySelector("#victory-overlay"),
      victoryNextButton: document.querySelector("#victory-next-button"),
      victoryArmoryButton: document.querySelector("#victory-armory-button"),
      armoryOverlay: document.querySelector("#armory-overlay"),
      armoryTitle: document.querySelector("#armory-title"),
      armoryBody: document.querySelector("#armory-body"),
      armoryStartButton: document.querySelector("#armory-start-button"),
      armoryLoadButton: document.querySelector("#armory-load-button"),
      armoryGuideButton: document.querySelector("#armory-guide-button"),
      victorySummary: document.querySelector("#victory-summary"),
      menuStoryImage: document.querySelector("#menu-story-image"),
      menuTitle: document.querySelector("#menu-title"),
      menuBody: document.querySelector("#menu-body"),
      menuUnlocks: document.querySelector("#menu-unlocks"),
      campaignMap: document.querySelector("#campaign-map"),
      menuLobby: document.querySelector("#menu-lobby"),
      menuTutorial: document.querySelector("#menu-tutorial"),
      menuMapSelect: document.querySelector("#menu-map-select"),
      menuDifficultySelect: document.querySelector("#menu-difficulty-select"),
      newCampaignButton: document.querySelector("#new-campaign-button"),
      loadCampaignButton: document.querySelector("#load-campaign-button"),
      skipMenuButton: document.querySelector("#skip-menu-button"),
      menuGuideButton: document.querySelector("#menu-guide-button"),
      resumeBattleButton: document.querySelector("#resume-battle-button"),
      guideOverlay: document.querySelector("#guide-overlay"),
      guideCloseButton: document.querySelector("#guide-close-button"),
      guideTabs: document.querySelector("#guide-tabs"),
      guideContent: document.querySelector("#guide-content"),
    };
  }

  async start() {
    await this.app.init({
      antialias: true,
      autoDensity: true,
      background: "#090b10",
      resizeTo: this.root,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });

    this.root.appendChild(this.app.canvas);

    const angelTextures = await Promise.all(
      Object.entries(hostAnimationCatalog).map(async ([hostKey, animation]) => {
        const textures = await Promise.all(
          Object.entries(animation.textures).map(async ([poseKey, path]) => {
            const pose = poseKey as AnimationKey;
            const texture = await Assets.load<Texture>(path);
            return [pose, this.sliceAnimationTexture(texture, animation.animations[pose])] as const;
          }),
        );
        return [hostKey, Object.fromEntries(textures) as Record<AnimationKey, Texture[]>] as const;
      }),
    );
    const enemyTextures = await Promise.all(
      Object.entries(ENEMY_TYPES).map(async ([key, enemy]) => {
        return [key, await Assets.load<Texture>(enemy.texture)] as const;
      }),
    );
    const towerTextures = await Promise.all(
      Object.entries(TOWER_TYPES).map(async ([key, tower]) => {
        return [key, await Assets.load<Texture>(tower.texture)] as const;
      }),
    );
    const mapTextures = await Promise.all(
      MAP_ORDER.map(async (id) => {
        return [id, await Assets.load<Texture>(MAPS[id].background)] as const;
      }),
    );
    const gateHpGauge = await Assets.load<Texture>("/assets/ui/gate-hp-gauge-alpha.png");

    this.textures = {
      maps: Object.fromEntries(mapTextures) as Record<MapId, Texture>,
      angel: Object.fromEntries(angelTextures) as Record<HostSpriteKey, Record<AnimationKey, Texture[]>>,
      enemy: Object.fromEntries(enemyTextures) as Record<EnemyKind, Texture>,
      tower: Object.fromEntries(towerTextures) as Record<TowerKind, Texture>,
      ui: {
        gateHpGauge,
      },
    };

    this.app.stage.addChild(this.world);
    this.world.addChild(
      this.mapLayer,
      this.towerLayer,
      this.enemyLayer,
      this.unitLayer,
      this.projectileLayer,
      this.overlayLayer,
      this.editorLayer,
    );
    this.app.stage.addChild(this.gateHudLayer);
    this.minimapLayer.addChild(this.minimapGraphic);
    this.minimapLayer.eventMode = "static";
    this.minimapLayer.cursor = "pointer";
    this.minimapLayer.on("pointerdown", this.handleMinimapPointerDown, this);
    this.app.stage.addChild(this.minimapLayer);

    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = new Rectangle(0, 0, this.app.screen.width, this.app.screen.height);
    this.app.stage.on("pointerdown", this.handlePointerDown, this);
    this.app.stage.on("pointermove", this.handlePointerMove, this);
    this.app.stage.on("pointerup", this.handlePointerUp, this);
    this.app.stage.on("pointerupoutside", this.handlePointerUp, this);
    this.app.stage.on("pointercancel", this.handlePointerUp, this);
    this.app.canvas.addEventListener("wheel", (event) => this.handleWheel(event), { passive: false });
    this.app.renderer.on("resize", this.layout, this);
    this.app.ticker.add((ticker) => this.update(ticker.deltaMS));
    this.loadGameSettings();
    this.campaignProgress = this.loadCampaignProgress();
    this.ensureActiveMapUnlocked();
    this.normalizeSelectionsForUnlocks();
    this.populateMapSelect();
    this.populateBattleSettings();
    this.populateAutoMoveSelect();
    this.populateEditorTowerSelect();
    this.hud.settingsToggleButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.toggleSettingsMenu();
    });
    const handleBuildOverlayClose = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      this.closeBuildOverlay();
    };
    this.hud.buildOverlayCloseButton?.addEventListener("pointerdown", handleBuildOverlayClose);
    this.hud.buildOverlayCloseButton?.addEventListener("click", handleBuildOverlayClose);
    const handleSelectedOverlayClose = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      this.closeSelectedOverlay();
    };
    this.hud.selectedOverlayCloseButton?.addEventListener("pointerdown", handleSelectedOverlayClose);
    this.hud.selectedOverlayCloseButton?.addEventListener("click", handleSelectedOverlayClose);
    this.hud.selectedCurrentButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.openSelectedOverlay();
    });
    this.hud.tensionBurstButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.releaseSelectedTensionBurst();
    });
    this.hud.towerRangeButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggleSelectedTowerRange();
    });
    this.hud.audioButton?.addEventListener("click", (event) => {
      event.preventDefault();
      void this.audio.toggle().then(() => this.updateAudioButton());
    });
    this.hud.autoMoveSelect?.addEventListener("change", () => this.setSelectedUnitAutoMove());
    this.hud.guideButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.closeSettingsMenu();
      this.openGuide();
    });
    this.hud.restartButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.closeSettingsMenu();
      this.hideMenu();
      this.closeGuide();
      this.restart();
      this.setStatus("Battle restarted", 1100);
    });
    this.hud.difficultySelect?.addEventListener("change", () => {
      const selected = this.hud.difficultySelect?.value as DifficultyMode;
      if (!(selected in DIFFICULTY_MODES) || selected === this.difficultyMode) {
        return;
      }
      this.difficultyMode = selected;
      this.mapEditMode = false;
      this.saveGameSettings();
      this.restart();
      this.setStatus(`${DIFFICULTY_MODES[selected].name} mode`, 1400);
    });
    this.hud.battleSpeedSelect?.addEventListener("change", () => {
      const selected = Number(this.hud.battleSpeedSelect?.value);
      if (!BATTLE_SPEED_OPTIONS.some((speed) => speed === selected)) {
        return;
      }
      this.isPaused = selected === 0;
      if (selected > 0) {
        this.battleSpeed = selected;
      }
      this.saveGameSettings();
      this.updateBattleSettingsControls();
      this.setStatus(this.isPaused ? "Paused" : `Battle speed ${this.formatBattleSpeed(selected)}`, 1000);
    });
    this.hud.waveDirectorSelect?.addEventListener("change", () => {
      const selected = this.hud.waveDirectorSelect?.value as WaveDirectorMode;
      if (!(selected in WAVE_DIRECTOR_MODES) || selected === this.waveDirectorMode) {
        return;
      }
      this.waveDirectorMode = selected;
      this.saveGameSettings();
      this.restart();
      this.setStatus(`${WAVE_DIRECTOR_MODES[selected].name} waves`, 1400);
    });
    this.hud.waveLimitSelect?.addEventListener("change", () => {
      const selected = this.hud.waveLimitSelect?.value;
      if (!selected || !this.isWaveLimitMode(selected) || selected === this.waveLimitMode) {
        return;
      }
      this.waveLimitMode = selected;
      this.saveGameSettings();
      this.restart();
      this.setStatus(`${this.waveLimitLabel()} enabled`, 1400);
    });
    this.hud.towersPanel?.addEventListener("click", (event) => {
      event.preventDefault();
      this.startAudio();
      this.toggleBuildMode("towers");
    });
    this.hud.hostsPanel?.addEventListener("click", (event) => {
      event.preventDefault();
      this.startAudio();
      this.toggleBuildMode("hosts");
    });
    this.hud.abilityPanel?.addEventListener("click", (event) => {
      event.preventDefault();
      this.startAudio();
      this.toggleBuildMode("ability");
    });
    this.hud.mapSelect?.addEventListener("change", () => {
      const selected = this.hud.mapSelect?.value as MapId;
      if (!MAP_ORDER.includes(selected)) {
        return;
      }
      if (!this.isMapUnlocked(selected)) {
        this.updateBattleSettingsControls();
        this.setStatus(`${MAPS[selected].name} is still locked`, 1400);
        return;
      }
      this.activeMapId = selected;
      this.activeCampaignLevelIndex = this.findCampaignLevelIndexForMap(selected);
      this.map = this.loadMapLayout(selected);
      this.cameraX = 0;
      this.cameraY = 0;
      this.selectedPathGroup = "lane";
      this.selectedPathRouteIndex = 0;
      this.selectedPathIndex = 0;
      this.selectedSlotIndex = 0;
      this.saveGameSettings();
      this.restart();
      this.setStatus(`${this.map.name} loaded`, 1200);
    });
    this.hud.mapEditButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.toggleMapEditMode();
    });
    this.hud.scrollLeftButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.panCamera(-DESIGN_WIDTH * 0.72, 0);
    });
    this.hud.scrollRightButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.panCamera(DESIGN_WIDTH * 0.72, 0);
    });
    this.hud.scrollUpButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.panCamera(0, -DESIGN_HEIGHT * 0.72);
    });
    this.hud.scrollDownButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.panCamera(0, DESIGN_HEIGHT * 0.72);
    });
    const handleMapEditToolChange = () => {
      if (this.syncMapEditToolFromControl()) {
        this.renderEditorOverlay();
        this.updateHud();
      }
    };
    this.hud.mapEditTool?.addEventListener("input", handleMapEditToolChange);
    this.hud.mapEditTool?.addEventListener("change", handleMapEditToolChange);
    this.hud.mapEditTowerKind?.addEventListener("change", () => {
      const selected = this.hud.mapEditTowerKind?.value as TowerKind;
      if (selected in TOWER_TYPES) {
        this.selectedTowerKind = selected;
        this.updateMapEditorControls();
      }
    });
    this.hud.addPathPointButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.addPathPoint();
    });
    this.hud.addSidePathButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.addSidePath();
    });
    this.hud.addEditorTowerButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.addEditorTowerToSelectedBase();
    });
    this.hud.removePathPointButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.removePathPoint();
    });
    this.hud.copyMapButton?.addEventListener("click", (event) => {
      event.preventDefault();
      void this.copyCurrentMapLayout();
    });
    this.hud.resetMapButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.resetCurrentMapLayout();
    });
    window.addEventListener("keydown", (event) => {
      if (this.guideOpen) {
        if (event.key === "Escape") {
          this.closeGuide();
          event.preventDefault();
        }
        return;
      }
      if (this.menuOpen) {
        return;
      }
      if (event.key === "ArrowLeft") {
        this.panCamera(-220, 0);
        event.preventDefault();
      }
      if (event.key === "ArrowRight") {
        this.panCamera(220, 0);
        event.preventDefault();
      }
      if (event.key === "ArrowUp") {
        this.panCamera(0, -180);
        event.preventDefault();
      }
      if (event.key === "ArrowDown") {
        this.panCamera(0, 180);
        event.preventDefault();
      }
      if (event.key.toLowerCase() === "s") {
        this.startAudio();
        this.setBuildMode("hosts", true);
      }
      if (event.key.toLowerCase() === "t") {
        this.startAudio();
        this.setBuildMode("towers", true);
      }
      if (event.key.toLowerCase() === "p") {
        this.startAudio();
        this.setBuildMode("ability", true);
        this.beginPurify();
      }
    });
    this.hud.menuMapSelect?.addEventListener("change", () => this.syncMenuSelectionToSettings(false));
    this.hud.menuDifficultySelect?.addEventListener("change", () => this.syncMenuSelectionToSettings(false));
    this.hud.newCampaignButton?.addEventListener("click", (event) => {
      event.preventDefault();
      const state = this.hud.menuOverlay?.dataset.state;
      const resetProgress = state === "start" || (state === "victory" && !this.pendingContinueMapId);
      const startTutorial = state === "start" && !this.hasSeenTutorial();
      const start = () => {
        if (state === "start" && !startTutorial) {
          if (resetProgress) {
            this.resetCampaignProgress();
            this.populateMapSelect();
          }
          this.showCampaignHub("New campaign started. Click an unlocked mountain level to begin.");
          return;
        }
        this.startCampaignFromMenu(false, resetProgress, startTutorial);
      };
      if (state === "start" && resetProgress) {
        if (this.hud.storyIntroStartButton) {
          this.hud.storyIntroStartButton.textContent = startTutorial ? "Begin Training" : "Open Campaign Map";
        }
        this.showStoryIntro(start);
      } else {
        start();
      }
    });
    this.hud.loadCampaignButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.loadCampaignToHub();
    });
    this.hud.skipMenuButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.skipMenuPanel();
    });
    this.hud.menuGuideButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.openGuide();
    });
    this.hud.armoryStartButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.startCampaignFromMenu(false, false, false);
    });
    this.hud.victoryNextButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.startCampaignFromMenu(false, false, false);
    });
    this.hud.victoryArmoryButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.showArmoryFromVictory();
    });
    this.hud.armoryLoadButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.loadCampaignToHub();
    });
    this.hud.armoryGuideButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.openGuide();
    });
    this.hud.storyIntroSkipButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.finishStoryIntro();
    });
    this.hud.storyIntroStartButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.finishStoryIntro();
    });
    this.hud.resumeBattleButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.hideMenu();
      this.setStatus("Battle resumed", 900);
    });
    this.hud.guideCloseButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.closeGuide();
    });

    this.restart();
    this.showStartMenu();
  }

  private startAudio() {
    if (this.audio.isEnabled) {
      return;
    }

    void this.audio.start().then(() => this.updateAudioButton());
  }

  private readMenuSelections() {
    const mapId = this.hud.menuMapSelect?.value as MapId;
    const difficultyMode = this.hud.menuDifficultySelect?.value as DifficultyMode;
    const unlockedMapId = MAP_ORDER.includes(mapId) && this.isMapUnlocked(mapId) ? mapId : this.firstUnlockedMap();

    return {
      mapId: unlockedMapId,
      difficultyMode: difficultyMode in DIFFICULTY_MODES ? difficultyMode : this.difficultyMode,
    };
  }

  private updateMenuPreview() {
    const state = this.hud.menuOverlay?.dataset.state;
    if (state !== "start" || !this.hud.menuBody) {
      return;
    }

    const selections = this.readMenuSelections();
    const difficulty = DIFFICULTY_MODES[selections.difficultyMode];
    const chapter = CAMPAIGN_CHAPTERS[selections.mapId];
    if (!this.hasSeenTutorial()) {
      this.hud.menuBody.textContent = `${chapter.title}. Start with a guided one-wave training battle on ${MAPS[DEFAULT_MAP_ID].name}. After training, use the mountain map to choose battles.`;
      return;
    }
    this.hud.menuBody.textContent = `Open the campaign map to choose an unlocked level. Battles use ${difficulty.name} mode unless changed in settings.`;
  }

  private towerUnlockEffect(kind: TowerKind) {
    const tower: (typeof TOWER_TYPES)[TowerKind] = TOWER_TYPES[kind];
    if ("beamDurationMs" in tower) {
      return `Beam ${(tower.beamDurationMs / 1000).toFixed(1)}s, width ${tower.beamWidth}.`;
    }
    if ("slowPercent" in tower) {
      return `Slows enemies by ${Math.round((tower.slowPercent ?? 0) * 100)}%.`;
    }
    if (tower.behavior === "shockwave") {
      return "Hits clusters around the pedestal.";
    }
    if (tower.damage === 0) {
      return "Sustains or controls nearby combat.";
    }
    return "Fires at enemies in range.";
  }

  private projectileCorrupts(projectile: object | undefined) {
    return Boolean(projectile && "corrupts" in projectile && (projectile as { corrupts?: boolean }).corrupts);
  }

  private chapterUnlockCards(mapId: MapId): UnlockCard[] {
    const chapter = CAMPAIGN_CHAPTERS[mapId];
    const cards: UnlockCard[] = [];

    for (const kind of chapter.unlocks.towers) {
      const tower = TOWER_TYPES[kind];
      cards.push({
        title: tower.name,
        subtitle: "New tower",
        description: `${tower.description} Cost ${tower.cost}. Range ${this.towerRangeLabel(tower.innerRange, tower.range)}. ${this.towerUnlockEffect(kind)}`,
        imageSrc: tower.texture,
        accentColor: tower.color,
      });
    }

    for (const kind of chapter.unlocks.hosts) {
      const host = HOST_TYPES[kind];
      cards.push({
        title: host.name,
        subtitle: "New host",
        description: `${host.description} ${host.memberCount} angels, ${host.memberHp} HP each, ${host.attackRange > 0 ? `${host.attackRange} range` : "support range"}.`,
        imageSrc: this.hostSpriteImage(kind, "idle"),
        accentColor: host.tint,
      });
    }

    if (chapter.unlocks.ability) {
      cards.push({
        title: "Purify Corruption",
        subtitle: "New ability",
        description: `Spend ${PURIFY_COST} energy to reclaim corrupted hosts or turn demons back before they break the gate.`,
        imageSrc: this.hostSpriteImage("healer", "cast"),
        accentColor: 0xf5d77e,
      });
    }

    for (const kind of chapter.unlocks.enemies) {
      const enemy = ENEMY_TYPES[kind];
      const projectile = "projectile" in enemy ? enemy.projectile : undefined;
      cards.push({
        title: enemy.name,
        subtitle: this.projectileCorrupts(projectile) ? "Corruption threat" : "New threat",
        description: projectile
          ? `${this.projectileCorrupts(projectile) ? "Corruption caster" : "Ranged attacker"}. ${projectile.damage} projectile damage, ${projectile.range} range.`
          : `Gate pressure demon. ${enemy.hp} HP, ${enemy.gateDamagePerSecond} gate DPS.`,
        imageSrc: enemy.texture,
        accentColor: projectile?.color ?? 0xff604d,
      });
    }

    return cards;
  }

  private renderMenuUnlocks(mapId: MapId | null) {
    if (!this.hud.menuUnlocks) {
      return;
    }

    this.hud.menuUnlocks.replaceChildren();
    if (!mapId) {
      this.hud.menuUnlocks.hidden = true;
      return;
    }

    const cards = this.chapterUnlockCards(mapId);
    if (cards.length === 0) {
      this.hud.menuUnlocks.hidden = true;
      return;
    }

    this.hud.menuUnlocks.hidden = false;
    const heading = document.createElement("strong");
    heading.className = "menu-unlocks-heading";
    heading.textContent = "New on this map";
    this.hud.menuUnlocks.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "menu-unlock-grid";
    for (const card of cards) {
      grid.appendChild(this.createMenuUnlockCard(card));
    }
    this.hud.menuUnlocks.appendChild(grid);
  }

  private createMenuUnlockCard(card: UnlockCard) {
    const element = document.createElement("article");
    element.className = "menu-unlock-card";
    element.style.setProperty("--unlock-accent", colorToCss(card.accentColor));

    const media = document.createElement("div");
    media.className = "menu-unlock-media";
    if (card.imageSrc) {
      const image = document.createElement("img");
      image.src = card.imageSrc;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      media.appendChild(image);
    }

    const body = document.createElement("div");
    body.className = "menu-unlock-body";
    const title = document.createElement("h3");
    title.textContent = card.title;
    const subtitle = document.createElement("p");
    subtitle.className = "menu-unlock-subtitle";
    subtitle.textContent = card.subtitle;
    const description = document.createElement("p");
    description.textContent = card.description;
    body.append(title, subtitle, description);
    element.append(media, body);
    return element;
  }

  private emptyCampaignProgress(): CampaignProgress {
    return {
      highestUnlockedIndex: 0,
      highestUnlockedLevelIndex: 0,
      completedMaps: {},
      completedLevels: {},
      radiance: 0,
      sanctumCores: 0,
      purchasedTowers: {},
      towerLevels: {},
      claimedCoreObjectives: {},
    };
  }

  private towerUnlockCost(kind: TowerKind) {
    return Math.round(TOWER_TYPES[kind].cost * 1.45);
  }

  private towerUpgradeCost(kind: TowerKind) {
    const nextLevel = Math.min(TOWER_MAX_LEVEL, this.towerLevel(kind) + 1);
    const costs: Record<number, { radiance: number; sanctumCores: number }> = {
      2: { radiance: 45, sanctumCores: 0 },
      3: { radiance: 75, sanctumCores: 0 },
      4: { radiance: 120, sanctumCores: 1 },
      5: { radiance: 180, sanctumCores: 2 },
    };
    return costs[nextLevel] ?? { radiance: 25, sanctumCores: 0 };
  }

  private formatUpgradeCost(cost: { radiance: number; sanctumCores: number }) {
    return cost.sanctumCores > 0
      ? `${cost.radiance} Radiance + ${cost.sanctumCores} Sanctum ${cost.sanctumCores === 1 ? "Core" : "Cores"}`
      : `${cost.radiance} Radiance`;
  }

  private setTowerActionCostContent(
    button: HTMLButtonElement,
    label: string,
    cost: { radiance: number; sanctumCores?: number },
  ) {
    button.replaceChildren();

    const labelNode = document.createElement("span");
    labelNode.className = "tower-action-label";
    labelNode.textContent = label;

    const costWrap = document.createElement("span");
    costWrap.className = "tower-action-cost";

    costWrap.appendChild(this.createButtonCurrency("radiance", cost.radiance));
    if ((cost.sanctumCores ?? 0) > 0) {
      costWrap.appendChild(this.createButtonCurrency("core", cost.sanctumCores ?? 0));
    }

    button.append(labelNode, costWrap);
  }

  private createButtonCurrency(kind: "radiance" | "core", amount: number) {
    const item = document.createElement("span");
    item.className = `button-currency ${kind}`;
    item.setAttribute("aria-hidden", "true");

    const icon = document.createElement("span");
    icon.className = "currency-icon";
    const value = document.createElement("strong");
    value.textContent = String(amount);

    item.append(icon, value);
    return item;
  }

  private towerStatsAtLevel(kind: TowerKind, level: number) {
    const tower = TOWER_TYPES[kind];
    const normalizedLevel = clamp(level, 1, TOWER_MAX_LEVEL);
    const damage = Math.round(tower.damage * (1 + Math.max(0, normalizedLevel - 1) * 0.18));
    const range = this.towerOuterRange(kind, normalizedLevel);
    const cooldown = (tower.cooldownMs * Math.max(0.75, 1 - Math.max(0, normalizedLevel - 1) * 0.06)) / 1000;
    const hp = this.towerMaxHp(kind, normalizedLevel);
    return {
      level: normalizedLevel,
      damage: tower.damage > 0 ? String(damage) : "Support",
      range: this.towerRangeLabel(tower.innerRange, range),
      cooldown: `${cooldown.toFixed(2)}s`,
      hp: String(hp),
    };
  }

  private towerUpgradePreviewRows(kind: TowerKind, level: number): [string, string, string][] {
    const current = this.towerStatsAtLevel(kind, level);
    const next = this.towerStatsAtLevel(kind, level + 1);
    return [
      ["Level", String(current.level), String(next.level)],
      ["HP", current.hp, next.hp],
      ["Damage", current.damage, next.damage],
      ["Range", current.range, next.range],
      ["Cooldown", current.cooldown, next.cooldown],
    ];
  }

  private upgradePreviewTone(label: string, current: string, next: string) {
    if (current === next) {
      return "same";
    }
    return label === "Cooldown" ? "lower-better" : "higher-better";
  }

  private towerLevel(kind: TowerKind) {
    if (this.devMode) {
      return TOWER_MAX_LEVEL;
    }

    return clamp(Math.floor(this.campaignProgress.towerLevels[kind] ?? 1), 1, TOWER_MAX_LEVEL);
  }

  private cloneCampaignMapLayout(layout: CampaignMapLayoutOverride = {}) {
    return {
      levels: layout.levels ? { ...layout.levels } : {},
      sideQuests: layout.sideQuests ? { ...layout.sideQuests } : {},
      extraLevels: layout.extraLevels ? layout.extraLevels.map((level) => ({ ...level })) : undefined,
      links: layout.links ? layout.links.map((link) => ({ ...link })) : undefined,
    } satisfies CampaignMapLayoutOverride;
  }

  private mergeCampaignMapLayouts(...layouts: CampaignMapLayoutOverride[]) {
    const merged: CampaignMapLayoutOverride = { levels: {}, sideQuests: {} };
    for (const layout of layouts) {
      if (layout.levels) {
        merged.levels = { ...merged.levels, ...layout.levels };
      }
      if (layout.sideQuests) {
        merged.sideQuests = { ...merged.sideQuests, ...layout.sideQuests };
      }
      if (layout.extraLevels) {
        merged.extraLevels = layout.extraLevels.map((level) => ({ ...level }));
      }
      if (layout.links) {
        merged.links = layout.links.map((link) => ({ ...link }));
      }
    }
    return merged;
  }

  private loadStoredCampaignMapLayout() {
    if (!this.devMapAuthoring) {
      return {};
    }
    try {
      const raw = localStorage.getItem(CAMPAIGN_MAP_AUTHORING_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CampaignMapLayoutOverride) : {};
    } catch {
      return {};
    }
  }

  private saveStoredCampaignMapLayout(layout: CampaignMapLayoutOverride) {
    if (!this.devMapAuthoring) {
      return;
    }
    localStorage.setItem(CAMPAIGN_MAP_AUTHORING_STORAGE_KEY, JSON.stringify(layout));
  }

  private clearStoredCampaignMapLayout() {
    localStorage.removeItem(CAMPAIGN_MAP_AUTHORING_STORAGE_KEY);
  }

  private currentCampaignMapLayout(options: { includeDraft?: boolean } = {}) {
    const includeDraft = options.includeDraft ?? true;
    return this.mergeCampaignMapLayouts(
      this.cloneCampaignMapLayout(CAMPAIGN_MAP_LAYOUT_OVERRIDES),
      this.loadStoredCampaignMapLayout(),
      includeDraft && this.campaignMapDraftLayout ? this.campaignMapDraftLayout : {},
    );
  }

  private currentCampaignMountainLevels() {
    const layout = this.currentCampaignMapLayout();
    const baseLevels: EditableCampaignMountainLevel[] = CAMPAIGN_MOUNTAIN_LEVELS.map((level) => {
      const override = layout.levels?.[level.id];
      return {
        ...level,
        x: override ? clamp(override.x, 0, 100) : level.x,
        y: override ? clamp(override.y, 0, 100) : level.y,
      };
    });
    const extraLevels = (layout.extraLevels ?? [])
      .map((level) => {
        const mapId = MAP_ORDER.includes(level.mapId as MapId) ? (level.mapId as MapId) : DEFAULT_MAP_ID;
        return {
          ...level,
          mapId,
          index: Math.max(0, Math.floor(level.index)),
          x: clamp(level.x, 0, 100),
          y: clamp(level.y, 0, 100),
          title: level.title.trim() || "New Level",
          story: level.story.trim() || "A newly marked mountain route waits to be tested.",
        } satisfies EditableCampaignMountainLevel;
      })
      .filter((level) => level.id.trim().length > 0);
    return [...baseLevels, ...extraLevels].sort((a, b) => a.index - b.index || a.id.localeCompare(b.id));
  }

  private defaultCampaignMapLinks(levels = this.currentCampaignMountainLevels()) {
    return levels.slice(1).map((level, index) => ({
      from: levels[index].id,
      to: level.id,
    }));
  }

  private campaignMapLinkKey(from: string, to: string) {
    return [from, to].sort().join("::");
  }

  private currentCampaignMapLinks(levels = this.currentCampaignMountainLevels()) {
    const layout = this.currentCampaignMapLayout();
    const validIds = new Set(levels.map((level) => level.id));
    const sourceLinks = layout.links ?? this.defaultCampaignMapLinks(levels);
    const seen = new Set<string>();
    const links: CampaignMapLinkOverride[] = [];
    for (const link of sourceLinks) {
      if (!validIds.has(link.from) || !validIds.has(link.to) || link.from === link.to) {
        continue;
      }
      const key = this.campaignMapLinkKey(link.from, link.to);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      links.push({ from: link.from, to: link.to });
    }
    return links;
  }

  private currentCampaignSideQuests() {
    const layout = this.currentCampaignMapLayout();
    return MOUNTAIN_SIDEQUESTS.map((quest) => {
      const override = layout.sideQuests?.[quest.id];
      return {
        ...quest,
        x: override ? clamp(override.x, 0, 100) : quest.x,
        y: override ? clamp(override.y, 0, 100) : quest.y,
      };
    });
  }

  private activeCampaignLevel() {
    const levels = this.currentCampaignMountainLevels();
    return levels[this.activeCampaignLevelIndex] ?? levels[0];
  }

  private findCampaignLevelIndexForMap(mapId: MapId) {
    const levels = this.currentCampaignMountainLevels();
    const exactUnlocked = levels.find(
      (level) => level.mapId === mapId && level.index <= this.campaignProgress.highestUnlockedLevelIndex,
    );
    return exactUnlocked?.index ?? levels.find((level) => level.mapId === mapId)?.index ?? 0;
  }

  private setActiveCampaignLevel(index: number) {
    const levels = this.currentCampaignMountainLevels();
    const level = levels[clamp(Math.floor(index), 0, levels.length - 1)];
    this.activeCampaignLevelIndex = level.index;
    this.activeMapId = level.mapId;
    this.map = this.loadMapLayout(level.mapId);
    return level;
  }

  private isCampaignLevelUnlocked(index: number) {
    if (this.devMode) {
      return true;
    }

    return index <= this.campaignProgress.highestUnlockedLevelIndex;
  }

  private selectCampaignLevelNode(index: number) {
    if (!this.isCampaignLevelUnlocked(index)) {
      return;
    }

    const level = this.setActiveCampaignLevel(index);
    this.pendingContinueMapId = level.mapId;
    this.pendingContinueLevelIndex = level.index;
    this.cameraX = 0;
    this.cameraY = 0;
    this.updateBattleSettingsControls();
    this.renderCampaignMapPanel();
    this.setStatus(`${level.title} selected`, 1100);
  }

  private startCampaignLevelFromMap(index: number) {
    if (!this.isCampaignLevelUnlocked(index)) {
      return;
    }
    this.selectCampaignLevelNode(index);
    this.startCampaignFromMenu(false, false, false);
  }

  private renderCampaignMapPanel() {
    const panel = this.hud.campaignMap;
    if (!panel) {
      return;
    }

    panel.replaceChildren();

    const header = document.createElement("header");
    const titleBlock = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "Mountain Path";
    const title = document.createElement("h3");
    title.textContent = "Climb to the Summit";
    const detail = document.createElement("p");
    detail.textContent =
      "Main battles climb the mountain. Side paths spend Radiance to recover optional tower patterns before the final gate.";
    titleBlock.append(eyebrow, title, detail);

    const progress = document.createElement("div");
    progress.className = "campaign-map-progress";
    progress.append(
      this.createCurrencyChip("radiance", Math.floor(this.campaignProgress.radiance), "Radiance"),
      this.createCurrencyChip("core", this.campaignProgress.sanctumCores, "Sanctum Cores"),
    );
    header.append(titleBlock, progress);
    if (this.devMapAuthoring) {
      header.appendChild(this.createCampaignMapEditorControls());
    }

    const mapBody = document.createElement("div");
    mapBody.className = "campaign-mountain";
    mapBody.classList.toggle("editing", this.campaignMapEditMode);
    mapBody.appendChild(this.createCampaignRouteOverlay());

    const trail = document.createElement("div");
    trail.className = "campaign-main-trail";
    for (const level of this.currentCampaignMountainLevels()) {
      trail.appendChild(this.createCampaignLevelNode(level));
    }

    const sidePaths = document.createElement("div");
    sidePaths.className = "campaign-side-trails";
    for (const quest of this.currentCampaignSideQuests()) {
      sidePaths.appendChild(this.createCampaignSideQuestNode(quest));
    }

    mapBody.append(trail, sidePaths);
    panel.append(header, mapBody);
  }

  private createCampaignMapEditorControls() {
    const controls = document.createElement("div");
    controls.className = "campaign-map-editor-controls";
    controls.classList.toggle("editing", this.campaignMapEditMode);

    const hint = document.createElement("span");
    hint.textContent = this.campaignMapEditMode
      ? this.campaignMapLinkEditMode === "connect"
        ? "Select two levels to link"
        : this.campaignMapLinkEditMode === "break"
          ? "Select linked levels to break"
          : "Drag pins, add levels, or edit links"
      : "Dev map editor";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "primary";
    editButton.textContent = this.campaignMapEditMode ? "Done Editing" : "Edit Mountain";
    editButton.addEventListener("click", () => this.toggleCampaignMapEditMode());

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "Save Source";
    saveButton.disabled = !this.campaignMapEditMode;
    saveButton.addEventListener("click", () => void this.saveCampaignMapLayoutToSource());

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.textContent = "Reset Local";
    resetButton.disabled = !this.campaignMapEditMode;
    resetButton.addEventListener("click", () => this.resetCampaignMapLayoutEditor());

    const addLevelButton = document.createElement("button");
    addLevelButton.type = "button";
    addLevelButton.textContent = "Add Level";
    addLevelButton.disabled = !this.campaignMapEditMode;
    addLevelButton.addEventListener("click", () => this.addCampaignMapLevel());

    const linkButton = document.createElement("button");
    linkButton.type = "button";
    linkButton.textContent = "Link Levels";
    linkButton.disabled = !this.campaignMapEditMode;
    linkButton.classList.toggle("active", this.campaignMapLinkEditMode === "connect");
    linkButton.addEventListener("click", () => this.setCampaignMapLinkEditMode("connect"));

    const breakLinkButton = document.createElement("button");
    breakLinkButton.type = "button";
    breakLinkButton.textContent = "Break Link";
    breakLinkButton.disabled = !this.campaignMapEditMode;
    breakLinkButton.classList.toggle("active", this.campaignMapLinkEditMode === "break");
    breakLinkButton.addEventListener("click", () => this.setCampaignMapLinkEditMode("break"));

    const devModeButton = document.createElement("button");
    devModeButton.type = "button";
    devModeButton.textContent = this.devMode ? "Dev Mode: On" : "Dev Mode: Off";
    devModeButton.classList.toggle("active", this.devMode);
    devModeButton.addEventListener("click", () => this.toggleDevMode());

    controls.append(hint, devModeButton, editButton, addLevelButton, linkButton, breakLinkButton, saveButton, resetButton);
    return controls;
  }

  private createCampaignRouteOverlay() {
    const levels = this.currentCampaignMountainLevels();
    const sideQuests = this.currentCampaignSideQuests();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("campaign-route-overlay");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");

    const levelById = new Map(levels.map((level) => [level.id, level]));
    const routeLinks = this.currentCampaignMapLinks(levels);
    const appendRoute = (className: string, fromId: string, toId: string) => {
      const from = levelById.get(fromId);
      const to = levelById.get(toId);
      if (!from || !to) {
        return;
      }
      const route = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      route.classList.add(className);
      route.setAttribute("points", `${from.x},${from.y} ${to.x},${to.y}`);
      svg.appendChild(route);
    };

    for (const link of routeLinks) {
      appendRoute("campaign-route-full", link.from, link.to);
    }

    const routeEnd = Math.max(
      0,
      Math.min(this.campaignProgress.highestUnlockedLevelIndex, levels.length - 1),
    );
    if (routeEnd > 0) {
      for (const link of routeLinks) {
        const from = levelById.get(link.from);
        const to = levelById.get(link.to);
        if (from && to && from.index <= routeEnd && to.index <= routeEnd) {
          appendRoute("campaign-route-available", link.from, link.to);
        }
      }
    }

    const selectedIndex = clamp(
      Math.floor(this.pendingContinueLevelIndex ?? this.activeCampaignLevelIndex),
      0,
      levels.length - 1,
    );
    if (selectedIndex > 0) {
      for (const link of routeLinks) {
        const from = levelById.get(link.from);
        const to = levelById.get(link.to);
        if (from && to && from.index <= selectedIndex && to.index <= selectedIndex) {
          appendRoute("campaign-route-selected", link.from, link.to);
        }
      }
    }

    for (const quest of sideQuests) {
      const tower = TOWER_TYPES[quest.tower];
      const reachable = this.isMapUnlocked(quest.fromMap);
      const anchor =
        [...levels]
          .reverse()
          .find((level) => level.mapId === quest.fromMap && level.index <= this.campaignProgress.highestUnlockedLevelIndex) ??
        levels.find((level) => level.mapId === quest.fromMap) ??
        levels[0];
      const branch = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      branch.classList.add("campaign-route-branch");
      branch.classList.toggle("available", reachable);
      branch.style.setProperty("--branch-color", colorToCss(tower.color));
      branch.setAttribute("points", `${anchor.x},${anchor.y} ${quest.x},${quest.y}`);
      svg.appendChild(branch);
    }

    return svg;
  }

  private createCampaignLevelNode(level: CampaignMountainLevel) {
    const chapter = CAMPAIGN_CHAPTERS[level.mapId];
    const unlocked = this.isCampaignLevelUnlocked(level.index);
    const completed = Boolean(this.campaignProgress.completedLevels[level.id]);
    const selected = (this.pendingContinueLevelIndex ?? this.activeCampaignLevelIndex) === level.index;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "campaign-level-node";
    button.style.setProperty("--node-x", `${level.x}%`);
    button.style.setProperty("--node-y", `${level.y}%`);
    button.classList.toggle("completed", completed);
    button.classList.toggle("available", unlocked && !completed);
    button.classList.toggle("sidequest", Boolean(level.sideQuest));
    button.classList.toggle("selected", selected);
    button.classList.toggle("link-source", this.campaignMapSelectedLinkNodeId === level.id);
    button.classList.toggle("locked", !unlocked);
    button.classList.toggle("editable", this.campaignMapEditMode);
    button.disabled = !unlocked && !this.campaignMapEditMode;
    button.addEventListener("pointerdown", (event) =>
      this.beginCampaignMapPinDrag(event, "level", level.id, button),
    );
    button.addEventListener("click", (event) => {
      if (this.campaignMapEditMode) {
        event.preventDefault();
        this.handleCampaignMapLevelEditorClick(level.id);
        return;
      }
      if (this.campaignMapDragTarget?.moved) {
        event.preventDefault();
        return;
      }
      this.startCampaignLevelFromMap(level.index);
    });
    button.setAttribute(
      "aria-label",
      unlocked
        ? `${level.title}. ${completed ? "Replay battle" : "Start battle"}`
        : `${level.title}. Locked trail`,
    );

    const marker = document.createElement("span");
    marker.className = "campaign-node-marker";
    marker.textContent = completed ? "C" : unlocked ? String(level.index + 1) : "?";

    const body = document.createElement("span");
    body.className = "campaign-node-body";
    const title = document.createElement("strong");
    title.textContent = level.title;
    const subtitle = document.createElement("span");
    subtitle.textContent = completed ? "Replay battle" : unlocked ? "Click to start" : "Locked trail";
    body.append(title, subtitle);

    const unlocks = [
      ...chapter.unlocks.towers.map((kind) => TOWER_TYPES[kind].name),
      ...chapter.unlocks.hosts.map((kind) => HOST_TYPES[kind].name),
      chapter.unlocks.ability ? "Purify" : null,
    ].filter(Boolean);
    if (unlocks.length > 0) {
      const reward = document.createElement("small");
      reward.textContent = unlocked ? `${chapter.title.replace(/^Chapter [IVX]+: /, "")}: ${unlocks.join(", ")}` : "Locked";
      body.appendChild(reward);
    } else if (level.sideQuest) {
      const reward = document.createElement("small");
      reward.textContent = "Side route";
      body.appendChild(reward);
    }

    button.append(marker, body);
    return button;
  }

  private createCampaignSideQuestNode(quest: (typeof MOUNTAIN_SIDEQUESTS)[number]) {
    const tower = TOWER_TYPES[quest.tower];
    const reachable = this.isMapUnlocked(quest.fromMap);
    const unlocked = this.isTowerUnlocked(quest.tower);
    const cost = this.towerUnlockCost(quest.tower);

    const card = document.createElement("button");
    card.type = "button";
    card.className = "campaign-side-node";
    card.classList.toggle("completed", unlocked);
    card.classList.toggle("available", reachable && !unlocked);
    card.classList.toggle("locked", !reachable);
    card.classList.toggle("editable", this.campaignMapEditMode);
    card.style.setProperty("--unlock-accent", colorToCss(tower.color));
    card.style.setProperty("--node-x", `${quest.x}%`);
    card.style.setProperty("--node-y", `${quest.y}%`);
    card.disabled = (!reachable || unlocked) && !this.campaignMapEditMode;
    card.setAttribute(
      "aria-label",
      reachable
        ? unlocked
          ? `${quest.title}. ${tower.name} unlocked`
          : `${quest.title}. Unlock ${tower.name} for ${cost} Radiance`
        : `Hidden side path. Reach ${MAPS[quest.fromMap].name} to reveal this branch.`,
    );

    const marker = document.createElement("div");
    marker.className = "campaign-side-marker";
    if (reachable) {
      const image = document.createElement("img");
      image.src = tower.texture;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      marker.appendChild(image);
    } else {
      const unknown = document.createElement("span");
      unknown.textContent = "?";
      marker.appendChild(unknown);
    }

    const body = document.createElement("div");
    body.className = "campaign-side-body";
    const eyebrow = document.createElement("span");
    eyebrow.textContent = unlocked ? "Sidequest cleared" : reachable ? "Optional side path" : "Hidden side path";
    const title = document.createElement("strong");
    title.textContent = reachable ? quest.title : "Unknown Detour";
    const description = document.createElement("p");
    description.textContent = reachable
      ? quest.description
      : `Reach ${MAPS[quest.fromMap].name} to reveal this branch.`;
    body.append(eyebrow, title, description);

    const action = document.createElement("span");
    action.className = "campaign-side-action";
    if (unlocked) {
      action.textContent = `${tower.name} unlocked`;
    } else if (!reachable) {
      action.textContent = "Locked";
    } else {
      action.textContent = `Unlock ${cost} Radiance`;
      card.addEventListener("click", (event) => {
        if (this.campaignMapEditMode || this.campaignMapDragTarget?.moved) {
          event.preventDefault();
          return;
        }
        this.buyTowerUnlock(quest.tower);
      });
    }
    card.addEventListener("pointerdown", (event) =>
      this.beginCampaignMapPinDrag(event, "sideQuest", quest.id, card),
    );
    body.appendChild(action);

    card.append(marker, body);
    return card;
  }

  private toggleCampaignMapEditMode() {
    if (!this.devMapAuthoring) {
      this.setStatus("Campaign map editing is available only in local dev builds", 1400);
      return;
    }

    this.campaignMapEditMode = !this.campaignMapEditMode;
    this.campaignMapDragTarget = null;
    this.campaignMapLinkEditMode = null;
    this.campaignMapSelectedLinkNodeId = null;
    this.campaignMapDraftLayout = this.campaignMapEditMode
      ? this.cloneCampaignMapLayout(this.currentCampaignMapLayout({ includeDraft: false }))
      : null;
    this.renderCampaignMapPanel();
    this.setStatus(
      this.campaignMapEditMode ? "Drag mountain pins, add levels, or edit route links" : "Campaign map editing closed",
      1400,
    );
  }

  private campaignMapDraft() {
    const draft = this.campaignMapDraftLayout ?? this.cloneCampaignMapLayout(this.currentCampaignMapLayout());
    this.campaignMapDraftLayout = draft;
    return draft;
  }

  private setCampaignMapLinkEditMode(mode: CampaignMapLinkEditMode) {
    if (!this.campaignMapEditMode) {
      return;
    }
    this.campaignMapLinkEditMode = this.campaignMapLinkEditMode === mode ? null : mode;
    this.campaignMapSelectedLinkNodeId = null;
    this.renderCampaignMapPanel();
    this.setStatus(
      this.campaignMapLinkEditMode === "connect"
        ? "Select two levels to add a route link"
        : this.campaignMapLinkEditMode === "break"
          ? "Select two linked levels to remove that route link"
          : "Route link editing closed",
      1200,
    );
  }

  private addCampaignMapLevel() {
    if (!this.campaignMapEditMode || !this.devMapAuthoring) {
      return;
    }

    const levels = this.currentCampaignMountainLevels();
    const draft = this.campaignMapDraft();
    const existingIds = new Set(levels.map((level) => level.id));
    const nextIndex = Math.max(...levels.map((level) => level.index), -1) + 1;
    let suffix = nextIndex + 1;
    let id = `custom-level-${suffix}`;
    while (existingIds.has(id)) {
      suffix += 1;
      id = `custom-level-${suffix}`;
    }

    const previousLevel = levels[levels.length - 1];
    const level: CampaignMapLevelOverride = {
      id,
      index: nextIndex,
      title: `New Level ${suffix}`,
      mapId: this.activeMapId,
      x: previousLevel ? clamp(previousLevel.x + 6, 8, 92) : 50,
      y: previousLevel ? clamp(previousLevel.y - 6, 8, 92) : 50,
      story: "A newly marked mountain route waits to be tested.",
    };

    draft.extraLevels = [...(draft.extraLevels ?? []), level];
    const links = this.currentCampaignMapLinks(levels);
    draft.links = previousLevel ? [...links, { from: previousLevel.id, to: id }] : links;
    this.campaignMapSelectedLinkNodeId = null;
    this.saveStoredCampaignMapLayout(this.currentCampaignMapLayout());
    this.renderCampaignMapPanel();
    this.setStatus(`${level.title} added to the mountain map`, 1400);
  }

  private handleCampaignMapLevelEditorClick(levelId: string) {
    if (!this.campaignMapEditMode || !this.campaignMapLinkEditMode) {
      return;
    }

    if (!this.campaignMapSelectedLinkNodeId) {
      this.campaignMapSelectedLinkNodeId = levelId;
      this.renderCampaignMapPanel();
      this.setStatus("Select the second level", 900);
      return;
    }

    const from = this.campaignMapSelectedLinkNodeId;
    const to = levelId;
    this.campaignMapSelectedLinkNodeId = null;
    if (from === to) {
      this.renderCampaignMapPanel();
      this.setStatus("Choose two different levels", 900);
      return;
    }

    if (this.campaignMapLinkEditMode === "connect") {
      this.addCampaignMapLink(from, to);
    } else {
      this.removeCampaignMapLink(from, to);
    }
  }

  private addCampaignMapLink(from: string, to: string) {
    const levels = this.currentCampaignMountainLevels();
    const links = this.currentCampaignMapLinks(levels);
    const key = this.campaignMapLinkKey(from, to);
    if (links.some((link) => this.campaignMapLinkKey(link.from, link.to) === key)) {
      this.renderCampaignMapPanel();
      this.setStatus("Those levels are already linked", 1000);
      return;
    }

    const draft = this.campaignMapDraft();
    draft.links = [...links, { from, to }];
    this.saveStoredCampaignMapLayout(this.currentCampaignMapLayout());
    this.renderCampaignMapPanel();
    this.setStatus("Route link added", 1000);
  }

  private removeCampaignMapLink(from: string, to: string) {
    const levels = this.currentCampaignMountainLevels();
    const links = this.currentCampaignMapLinks(levels);
    const key = this.campaignMapLinkKey(from, to);
    const nextLinks = links.filter((link) => this.campaignMapLinkKey(link.from, link.to) !== key);
    if (nextLinks.length === links.length) {
      this.renderCampaignMapPanel();
      this.setStatus("No route link exists between those levels", 1200);
      return;
    }

    const draft = this.campaignMapDraft();
    draft.links = nextLinks;
    this.saveStoredCampaignMapLayout(this.currentCampaignMapLayout());
    this.renderCampaignMapPanel();
    this.setStatus("Route link removed", 1000);
  }

  private beginCampaignMapPinDrag(
    event: PointerEvent,
    type: CampaignMapDragTarget["type"],
    id: string,
    element: HTMLElement,
  ) {
    if (!this.campaignMapEditMode || !this.devMapAuthoring || this.campaignMapLinkEditMode) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Window-level listeners below keep drag cleanup reliable even when capture is unavailable.
    }
    this.campaignMapDragTarget = { type, id, pointerId: event.pointerId, moved: false };
    element.classList.add("dragging");

    const move = (moveEvent: PointerEvent) => {
      if (!this.campaignMapDragTarget || this.campaignMapDragTarget.pointerId !== moveEvent.pointerId) {
        return;
      }
      moveEvent.preventDefault();
      const map = this.hud.campaignMap?.querySelector<HTMLElement>(".campaign-mountain");
      if (!map) {
        return;
      }
      const rect = map.getBoundingClientRect();
      const x = clamp(((moveEvent.clientX - rect.left) / rect.width) * 100, 0, 100);
      const y = clamp(((moveEvent.clientY - rect.top) / rect.height) * 100, 0, 100);
      this.campaignMapDragTarget.moved = true;
      this.updateCampaignMapDraftPoint(type, id, x, y);
      element.style.setProperty("--node-x", `${x}%`);
      element.style.setProperty("--node-y", `${y}%`);
      this.redrawCampaignRouteOverlay(map);
    };

    const end = (endEvent: PointerEvent) => {
      if (this.campaignMapDragTarget?.pointerId === endEvent.pointerId) {
        endEvent.preventDefault();
      }
      element.classList.remove("dragging");
      try {
        element.releasePointerCapture(event.pointerId);
      } catch {
        // The pointer may have ended outside the element.
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      this.saveStoredCampaignMapLayout(this.currentCampaignMapLayout());
      this.campaignMapDragTarget = null;
      this.renderCampaignMapPanel();
      this.setStatus("Campaign map position saved locally", 900);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  private updateCampaignMapDraftPoint(type: CampaignMapDragTarget["type"], id: string, x: number, y: number) {
    const draft = this.campaignMapDraft();
    const target = type === "level" ? "levels" : "sideQuests";
    draft[target] = {
      ...draft[target],
      [id]: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 },
    };
    if (type === "level" && draft.extraLevels) {
      draft.extraLevels = draft.extraLevels.map((level) =>
        level.id === id
          ? {
              ...level,
              x: Math.round(x * 10) / 10,
              y: Math.round(y * 10) / 10,
            }
          : level,
      );
    }
  }

  private redrawCampaignRouteOverlay(map: HTMLElement) {
    map.querySelector(".campaign-route-overlay")?.remove();
    map.prepend(this.createCampaignRouteOverlay());
  }

  private currentCampaignMapLayoutSource() {
    const point = (item: { x: number; y: number }) => ({
      x: Math.round(item.x * 10) / 10,
      y: Math.round(item.y * 10) / 10,
    });
    return {
      levels: Object.fromEntries(this.currentCampaignMountainLevels().map((level) => [level.id, point(level)])),
      sideQuests: Object.fromEntries(this.currentCampaignSideQuests().map((quest) => [quest.id, point(quest)])),
      extraLevels: this.currentCampaignMountainLevels()
        .filter((level) => !CAMPAIGN_MOUNTAIN_LEVELS.some((baseLevel) => baseLevel.id === level.id))
        .map((level) => ({
          id: level.id,
          index: level.index,
          title: level.title,
          mapId: level.mapId,
          x: Math.round(level.x * 10) / 10,
          y: Math.round(level.y * 10) / 10,
          story: level.story,
          ...(level.sideQuest ? { sideQuest: true } : {}),
        })),
      links: this.currentCampaignMapLinks(),
    } satisfies CampaignMapLayoutOverride;
  }

  private async saveCampaignMapLayoutToSource() {
    const source = this.currentCampaignMapLayoutSource();
    if (this.devMapAuthoring) {
      try {
        const response = await fetch("/__dev/campaign-map-layout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ layout: source }),
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        this.saveStoredCampaignMapLayout(source);
        this.campaignMapDraftLayout = this.cloneCampaignMapLayout(source);
        this.renderCampaignMapPanel();
        this.setStatus("Campaign map layout saved to source", 1600);
        return;
      } catch (error) {
        console.warn("Campaign map source save failed", error);
      }
    }

    this.saveStoredCampaignMapLayout(source);
    try {
      await navigator.clipboard.writeText(`export const CAMPAIGN_MAP_LAYOUT_OVERRIDES = ${JSON.stringify(source, null, 2)};`);
      this.setStatus("Source save failed; layout saved locally and copied", 2200);
    } catch {
      this.setStatus("Source save failed; layout saved locally", 2200);
    }
  }

  private resetCampaignMapLayoutEditor() {
    this.clearStoredCampaignMapLayout();
    this.campaignMapDraftLayout = this.cloneCampaignMapLayout(CAMPAIGN_MAP_LAYOUT_OVERRIDES);
    this.campaignMapDragTarget = null;
    this.campaignMapLinkEditMode = null;
    this.campaignMapSelectedLinkNodeId = null;
    this.renderCampaignMapPanel();
    this.setStatus("Campaign map reset to source positions", 1400);
  }

  private towerCampaignUnlockIndex(kind: TowerKind) {
    for (const id of MAP_ORDER) {
      if ((CAMPAIGN_CHAPTERS[id].unlocks.towers as readonly TowerKind[]).includes(kind)) {
        return CAMPAIGN_CHAPTERS[id].index;
      }
    }
    return null;
  }

  private towerSideQuestUnlockIndex(kind: TowerKind) {
    const quest = MOUNTAIN_SIDEQUESTS.find((item) => item.tower === kind);
    return quest ? CAMPAIGN_CHAPTERS[quest.fromMap].index : null;
  }

  private canPurchaseTowerUnlock(kind: TowerKind) {
    if (this.isTowerUnlocked(kind)) {
      return false;
    }
    const campaignUnlockIndex = this.towerCampaignUnlockIndex(kind);
    if (campaignUnlockIndex !== null) {
      return campaignUnlockIndex <= this.campaignProgress.highestUnlockedIndex + 1;
    }
    const sideQuestUnlockIndex = this.towerSideQuestUnlockIndex(kind);
    return sideQuestUnlockIndex === null || sideQuestUnlockIndex <= this.campaignProgress.highestUnlockedIndex;
  }

  private renderLobbyPanel() {
    if (!this.hud.menuLobby) {
      return;
    }

    this.renderCampaignMapPanel();
    this.hud.menuLobby.replaceChildren();

    const header = document.createElement("div");
    header.className = "lobby-header";
    const title = document.createElement("strong");
    title.textContent = "Armory";
    const currency = document.createElement("div");
    currency.className = "armory-currency";
    currency.append(
      this.createCurrencyChip("radiance", Math.floor(this.campaignProgress.radiance), "Radiance"),
      this.createCurrencyChip("core", this.campaignProgress.sanctumCores, "Sanctum Cores"),
    );
    header.append(title, currency);
    this.hud.menuLobby.appendChild(header);

    const towerKinds = Object.keys(TOWER_TYPES) as TowerKind[];
    const ownedTowers = towerKinds.filter((kind) => this.isTowerUnlocked(kind));
    const lockedTowers = towerKinds.filter((kind) => !this.isTowerUnlocked(kind));
    const unlockableTowers = lockedTowers.filter((kind) => this.canPurchaseTowerUnlock(kind));
    const hiddenTowers = lockedTowers.filter((kind) => !this.canPurchaseTowerUnlock(kind));

    const columns = document.createElement("div");
    columns.className = "armory-tower-columns";
    columns.append(
      this.createArmoryTowerSection(
        "Current Towers",
        "Owned defenses. Spend Radiance and Sanctum Cores here to upgrade their stats.",
        ownedTowers,
        "owned",
      ),
      this.createArmoryTowerSection(
        "Unlock New Towers",
        "New defenses become available here. Unknown patterns stay sealed until the campaign reveals them.",
        [...unlockableTowers, ...hiddenTowers],
        "unlock",
      ),
    );
    this.hud.menuLobby.appendChild(columns);
  }

  private createArmoryTowerSection(
    title: string,
    description: string,
    towers: TowerKind[],
    tone: "owned" | "unlock",
  ) {
    const section = document.createElement("section");
    section.className = `armory-tower-section ${tone}`;

    const header = document.createElement("header");
    const heading = document.createElement("h3");
    heading.textContent = title;
    const detail = document.createElement("p");
    detail.textContent = description;
    header.append(heading, detail);

    const grid = document.createElement("div");
    grid.className = "lobby-tower-grid";
    if (towers.length === 0) {
      const empty = document.createElement("p");
      empty.className = "armory-empty-note";
      empty.textContent = tone === "owned" ? "No towers owned yet." : "No new tower patterns available.";
      grid.appendChild(empty);
    } else {
      for (const kind of towers) {
        grid.appendChild(this.createLobbyTowerCard(kind, { unavailable: !this.isTowerUnlocked(kind) && !this.canPurchaseTowerUnlock(kind) }));
      }
    }

    section.append(header, grid);
    return section;
  }

  private createCurrencyChip(kind: "radiance" | "core", amount: number, label: string) {
    const chip = document.createElement("span");
    chip.className = `currency-chip ${kind}`;
    chip.title = label;
    chip.setAttribute("aria-label", `${amount} ${label}`);

    const icon = document.createElement("span");
    icon.className = "currency-icon";
    icon.setAttribute("aria-hidden", "true");

    const value = document.createElement("strong");
    value.textContent = String(amount);

    const text = document.createElement("span");
    text.textContent = label;

    chip.append(icon, value, text);
    return chip;
  }

  private createRewardPill(kind: RewardCurrency, text: string) {
    const pill = document.createElement("span");
    pill.className = `reward-pill ${kind}`;
    const icon = document.createElement("span");
    icon.className = "currency-icon";
    icon.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = text;
    pill.append(icon, label);
    return pill;
  }

  private renderVictorySummaryPanel(summary: CampaignVictorySummary | null, wasTutorialBattle: boolean) {
    const panel = this.hud.victorySummary;
    if (!panel) {
      return;
    }

    panel.replaceChildren();
    panel.hidden = false;

    const header = document.createElement("header");
    header.className = "victory-summary-header";
    const titleBlock = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "Battle Complete";
    const title = document.createElement("h3");
    title.textContent = wasTutorialBattle ? "Training Complete" : "Congrats, you won";
    const detail = document.createElement("p");
    detail.textContent = summary
      ? `${MAPS[summary.completedMapId].name} rewards`
      : "The training battle does not award campaign currency.";
    titleBlock.append(eyebrow, title, detail);

    const totals = document.createElement("div");
    totals.className = "victory-summary-totals";
    totals.append(
      this.createRewardPill("radiance", `+${summary?.radianceEarned ?? 0} Radiance`),
      this.createRewardPill("core", `+${summary?.sanctumCoresEarned ?? 0} Sanctum Cores`),
    );
    header.append(titleBlock, totals);
    panel.appendChild(header);

    if (!summary) {
      if (wasTutorialBattle) {
        panel.appendChild(this.createTutorialCompletePanel());
      }
      return;
    }

    const sections = document.createElement("div");
    sections.className = "victory-summary-sections";
    sections.append(
      this.createVictoryRewardSection("Radiance earned", summary.radianceRewards),
      this.createVictoryRewardSection("Sanctum Core objectives", summary.coreObjectives),
    );
    panel.appendChild(sections);
  }

  private createTutorialCompletePanel() {
    const wrap = document.createElement("div");
    wrap.className = "tutorial-complete-panel";

    const intro = document.createElement("p");
    intro.textContent =
      "You learned the core loop: place towers on pedestals, move hosts onto the road, and keep enemies away from the gate.";

    const grid = document.createElement("div");
    grid.className = "tutorial-complete-grid";
    [
      { label: "Towers", detail: "Fixed defenses. They build Tension and release charged effects." },
      { label: "Hosts", detail: "Mobile squads. They intercept enemies and reposition along paths." },
      { label: "Gate HP", detail: "The cleaner the defense, the better your post-battle Radiance." },
      { label: "Armory", detail: "Between battles, spend Radiance and Sanctum Cores on upgrades." },
    ].forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "tutorial-complete-card";
      const marker = document.createElement("span");
      marker.textContent = String(index + 1);
      const title = document.createElement("strong");
      title.textContent = item.label;
      const detail = document.createElement("p");
      detail.textContent = item.detail;
      card.append(marker, title, detail);
      grid.appendChild(card);
    });

    wrap.append(intro, grid);
    return wrap;
  }

  private createVictoryRewardSection(title: string, lines: VictoryRewardLine[]) {
    const section = document.createElement("section");
    section.className = "victory-reward-section";
    const heading = document.createElement("h4");
    heading.textContent = title;
    const list = document.createElement("div");
    list.className = "victory-reward-list";
    lines.forEach((line, index) => {
      list.appendChild(this.createVictoryRewardLine(line, index));
    });
    section.append(heading, list);
    return section;
  }

  private createVictoryRewardLine(line: VictoryRewardLine, index = 0) {
    const row = document.createElement("article");
    row.className = "victory-reward-line";
    row.classList.toggle("missed", !line.achieved && line.amount <= 0);
    row.classList.toggle("claimed", Boolean(line.alreadyClaimed && !line.earnedNow));
    row.classList.toggle("earned-core", Boolean(line.earnedNow));

    const label = document.createElement("strong");
    label.textContent = line.label;
    const metric = document.createElement("span");
    metric.className = "victory-reward-metric";
    const metricText = document.createElement("span");
    metricText.textContent = line.metric;
    const arrow = document.createElement("span");
    arrow.className = "victory-reward-arrow";
    arrow.textContent = "->";
    metric.append(metricText, arrow, this.createVictoryInlineReward(line));

    const bar = document.createElement("div");
    bar.className = "victory-progress";
    bar.setAttribute("aria-hidden", "true");
    bar.style.setProperty("--reward-progress", `${clamp(line.progress, 0, 1) * 100}%`);
    bar.style.setProperty("--reward-delay", `${index * 140}ms`);
    const fill = document.createElement("span");
    bar.appendChild(fill);

    row.append(label, metric, bar);
    return row;
  }

  private createVictoryInlineReward(line: VictoryRewardLine) {
    if (line.amount <= 0) {
      const text = document.createElement("span");
      text.className = "victory-reward-text";
      text.textContent = line.reward;
      return text;
    }

    const reward = document.createElement("span");
    reward.className = `victory-inline-reward ${line.currency}`;
    const icon = document.createElement("span");
    icon.className = "currency-icon";
    icon.setAttribute("aria-hidden", "true");
    const amount = document.createElement("span");
    amount.textContent = `+${line.amount}`;
    const label = document.createElement("span");
    label.textContent = line.currency === "radiance" ? "Radiance" : `Sanctum ${line.amount === 1 ? "Core" : "Cores"}`;
    reward.append(icon, amount, label);
    return reward;
  }

  private createLobbyTowerCard(kind: TowerKind, options: { unavailable?: boolean } = {}) {
    const tower = TOWER_TYPES[kind];
    const unlocked = this.isTowerUnlocked(kind);
    const unavailable = Boolean(options.unavailable);
    const level = this.towerLevel(kind);
    const element = document.createElement("article");
    element.className = "lobby-tower-card";
    element.classList.toggle("locked", !unlocked);
    element.classList.toggle("unavailable", unavailable);
    element.style.setProperty("--unlock-accent", colorToCss(tower.color));

    const media = document.createElement("div");
    media.className = "menu-unlock-media";
    if (unavailable) {
      const unknown = document.createElement("span");
      unknown.className = "unknown-tower-icon";
      unknown.textContent = "?";
      unknown.setAttribute("aria-hidden", "true");
      media.appendChild(unknown);
    } else {
      const image = document.createElement("img");
      image.src = tower.texture;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      media.appendChild(image);
    }

    const body = document.createElement("div");
    body.className = "lobby-tower-body";

    const badge = document.createElement("span");
    badge.className = "lobby-tower-badge";
    badge.textContent = unlocked ? "Owned - upgrade" : unavailable ? "Sealed" : "Unlockable";

    const title = document.createElement("h3");
    title.textContent = unavailable ? "Unknown Tower" : tower.name;
    const description = document.createElement("p");
    description.textContent = unavailable
      ? "A sealed armory pattern. Clear more battles to reveal what this tower does."
      : tower.description;

    const stats = document.createElement("dl");
    stats.className = "lobby-tower-stats";
    const towerStats = this.towerStatsAtLevel(kind, level);
    const statRows: [string, string][] = unavailable
      ? [
          ["Level", "?"],
          ["HP", "?"],
          ["Damage", "?"],
          ["Range", "?"],
          ["Cooldown", "?"],
        ]
      : [
          ["Level", unlocked ? `${level} / ${TOWER_MAX_LEVEL}` : "Locked"],
          ["HP", towerStats.hp],
          ["Damage", towerStats.damage],
          ["Range", towerStats.range],
          ["Cooldown", towerStats.cooldown],
        ];
    for (const [label, value] of statRows) {
      const wrapper = document.createElement("div");
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = label;
      detail.textContent = value;
      wrapper.append(term, detail);
      stats.appendChild(wrapper);
    }

    const action = document.createElement("button");
    action.type = "button";
    let actionNode: HTMLElement = action;
    if (unavailable) {
      action.textContent = "Locked";
      action.disabled = true;
    } else if (!unlocked) {
      const cost = this.towerUnlockCost(kind);
      this.setTowerActionCostContent(action, "Unlock", { radiance: cost });
      action.setAttribute("aria-label", `Unlock ${tower.name} for ${cost} Radiance`);
      action.disabled = this.campaignProgress.radiance < cost;
      action.addEventListener("click", () => this.buyTowerUnlock(kind));
    } else if (level >= TOWER_MAX_LEVEL) {
      action.textContent = "Max Level";
      action.disabled = true;
    } else {
      const cost = this.towerUpgradeCost(kind);
      this.setTowerActionCostContent(action, "Upgrade", cost);
      action.setAttribute("aria-label", `Upgrade ${tower.name} for ${this.formatUpgradeCost(cost)}`);
      action.disabled =
        this.campaignProgress.radiance < cost.radiance || this.campaignProgress.sanctumCores < cost.sanctumCores;
      action.addEventListener("click", () => this.buyTowerUpgrade(kind));
      actionNode = this.createUpgradePreviewAction(action, kind, level);
    }

    body.append(badge, title, description, stats, actionNode);
    element.append(media, body);
    return element;
  }

  private createUpgradePreviewAction(button: HTMLButtonElement, kind: TowerKind, level: number) {
    const wrapper = document.createElement("div");
    wrapper.className = "upgrade-action-wrap";

    const tooltip = document.createElement("div");
    tooltip.className = "upgrade-preview-tooltip";
    tooltip.setAttribute("role", "tooltip");

    const heading = document.createElement("strong");
    heading.textContent = "Upgrade Preview";
    tooltip.appendChild(heading);

    const list = document.createElement("dl");
    for (const [label, current, next] of this.towerUpgradePreviewRows(kind, level)) {
      const row = document.createElement("div");
      row.className = this.upgradePreviewTone(label, current, next);
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = label;
      const oldValue = document.createElement("span");
      oldValue.className = "old-value";
      oldValue.textContent = current;
      const arrow = document.createElement("span");
      arrow.className = "upgrade-arrow";
      arrow.textContent = "->";
      const newValue = document.createElement("span");
      newValue.className = "new-value";
      newValue.textContent = next;
      detail.append(oldValue, arrow, newValue);
      row.append(term, detail);
      list.appendChild(row);
    }
    tooltip.appendChild(list);

    button.setAttribute(
      "aria-label",
      `${button.getAttribute("aria-label") ?? button.textContent ?? "Upgrade"}. ${this.towerUpgradePreviewRows(kind, level)
        .map(([label, current, next]) => `${label} ${current} to ${next}`)
        .join(". ")}`,
    );
    wrapper.append(button, tooltip);
    return wrapper;
  }

  private buyTowerUnlock(kind: TowerKind) {
    if (this.isTowerUnlocked(kind)) {
      return;
    }
    const cost = this.towerUnlockCost(kind);
    if (this.campaignProgress.radiance < cost) {
      this.setStatus("Need more Radiance", 1200);
      return;
    }

    this.campaignProgress.radiance -= cost;
    this.campaignProgress.purchasedTowers[kind] = true;
    this.campaignProgress.towerLevels[kind] = this.towerLevel(kind);
    this.saveCampaignProgress();
    this.normalizeSelectionsForUnlocks();
    this.renderCampaignMapPanel();
    this.renderLobbyPanel();
    this.renderBuildPanel();
    this.setStatus(`${TOWER_TYPES[kind].name} unlocked`, 1400);
  }

  private buyTowerUpgrade(kind: TowerKind) {
    if (!this.isTowerUnlocked(kind)) {
      return;
    }
    const level = this.towerLevel(kind);
    if (level >= TOWER_MAX_LEVEL) {
      return;
    }
    const cost = this.towerUpgradeCost(kind);
    if (this.campaignProgress.radiance < cost.radiance) {
      this.setStatus("Need more Radiance", 1200);
      return;
    }
    if (this.campaignProgress.sanctumCores < cost.sanctumCores) {
      this.setStatus("Need more Sanctum Cores", 1200);
      return;
    }

    this.campaignProgress.radiance -= cost.radiance;
    this.campaignProgress.sanctumCores -= cost.sanctumCores;
    this.campaignProgress.towerLevels[kind] = level + 1;
    this.saveCampaignProgress();
    this.renderLobbyPanel();
    this.renderBuildPanel();
    this.setStatus(`${TOWER_TYPES[kind].name} upgraded to level ${level + 1}`, 1400);
  }

  private syncMenuSelectionToSettings(applyNow: boolean) {
    if (!applyNow) {
      this.updateMenuPreview();
      return;
    }

    const selections = this.readMenuSelections();
    this.activeMapId = selections.mapId;
    this.activeCampaignLevelIndex = this.findCampaignLevelIndexForMap(selections.mapId);
    this.map = this.loadMapLayout(selections.mapId);
    this.difficultyMode = selections.difficultyMode;
    this.updateBattleSettingsControls();
    this.saveGameSettings();
  }

  private startCampaignFromMenu(loadSavedCampaign: boolean, resetProgress = false, startTutorial = false) {
    if (loadSavedCampaign) {
      this.campaignProgress = this.loadCampaignProgress();
      this.loadGameSettings();
      this.setActiveCampaignLevel(this.campaignProgress.highestUnlockedLevelIndex);
      this.ensureActiveMapUnlocked();
      this.forceCombatTutorial = false;
    } else {
      if (resetProgress) {
        this.resetCampaignProgress();
        this.populateMapSelect();
      }
      if (this.pendingContinueLevelIndex !== null) {
        this.setActiveCampaignLevel(this.pendingContinueLevelIndex);
      } else if (this.pendingContinueMapId) {
        this.activeCampaignLevelIndex = this.findCampaignLevelIndexForMap(this.pendingContinueMapId);
        this.activeMapId = this.pendingContinueMapId;
      } else {
        this.syncMenuSelectionToSettings(true);
        this.activeCampaignLevelIndex = this.findCampaignLevelIndexForMap(this.activeMapId);
      }
      if (startTutorial) {
        this.setActiveCampaignLevel(0);
        this.forceCombatTutorial = true;
      } else {
        this.forceCombatTutorial = false;
      }
    }

    this.ensureActiveMapUnlocked();
    this.normalizeSelectionsForUnlocks();
    this.map = this.loadMapLayout(this.activeMapId);
    this.cameraX = 0;
    this.cameraY = 0;
    this.selectedPathGroup = "lane";
    this.selectedPathRouteIndex = 0;
    this.selectedPathIndex = 0;
    this.selectedSlotIndex = 0;
    this.mapEditMode = false;
    this.menuOpen = false;
    this.pendingContinueMapId = null;
    this.pendingContinueLevelIndex = null;
    if (this.hud.menuOverlay) {
      this.hud.menuOverlay.hidden = true;
    }
    if (this.hud.victoryOverlay) {
      this.hud.victoryOverlay.hidden = true;
    }
    if (this.hud.armoryOverlay) {
      this.hud.armoryOverlay.hidden = true;
    }
    this.saveGameSettings();
    this.restart();
    this.setStatus(loadSavedCampaign ? "Campaign loaded" : "Campaign started", 1200);
  }

  private loadCampaignToHub() {
    this.campaignProgress = this.loadCampaignProgress();
    this.loadGameSettings();
    this.setActiveCampaignLevel(this.campaignProgress.highestUnlockedLevelIndex);
    this.ensureActiveMapUnlocked();
    this.normalizeSelectionsForUnlocks();
    this.map = this.loadMapLayout(this.activeMapId);
    this.forceCombatTutorial = false;
    this.pendingContinueMapId = this.activeMapId;
    this.pendingContinueLevelIndex = this.activeCampaignLevelIndex;
    this.showCampaignHub("Campaign loaded. Click an unlocked mountain level to begin.");
  }

  private showCampaignHub(message?: string) {
    this.endCombatTutorial(false);
    this.forceCombatTutorial = false;
    this.tutorialBattleActive = false;
    this.menuOpen = true;
    if (this.hud.menuOverlay) {
      this.hud.menuOverlay.hidden = true;
    }
    if (this.hud.victoryOverlay) {
      this.hud.victoryOverlay.hidden = true;
    }
    if (this.hud.armoryOverlay) {
      this.hud.armoryOverlay.hidden = false;
    }
    if (this.hud.armoryTitle) {
      this.hud.armoryTitle.textContent = "Campaign Map";
    }
    if (this.hud.armoryBody) {
      this.hud.armoryBody.textContent =
        message ?? "Click an unlocked mountain level to begin a battle, or use the Armory below to upgrade before you climb.";
    }
    if (this.hud.armoryStartButton) {
      this.hud.armoryStartButton.textContent = "Start Selected";
    }
    if (this.hud.armoryLoadButton) {
      this.hud.armoryLoadButton.textContent = "Load Campaign";
    }
    if (this.hud.armoryGuideButton) {
      this.hud.armoryGuideButton.textContent = "Guide";
    }
    this.updateBattleSettingsControls();
    this.renderLobbyPanel();
    this.renderBuildPanel();
    this.updateHud();
  }

  private showStartMenu() {
    this.endCombatTutorial(false);
    this.forceCombatTutorial = false;
    this.tutorialBattleActive = false;
    if (this.storyIntroTimer !== null) {
      window.clearTimeout(this.storyIntroTimer);
      this.storyIntroTimer = null;
    }
    this.pendingStoryStart = null;
    if (this.hud.storyIntroOverlay) {
      this.hud.storyIntroOverlay.hidden = true;
      this.hud.storyIntroOverlay.classList.remove("playing");
    }
    this.hud.storyIntroProgress?.classList.remove("playing");
    this.menuOpen = true;
    this.pendingContinueMapId = null;
    this.pendingContinueLevelIndex = null;
    const showTutorial = !this.hasSeenTutorial();
    if (this.hud.menuOverlay) {
      this.hud.menuOverlay.hidden = false;
      this.hud.menuOverlay.dataset.state = "start";
    }
    if (this.hud.victoryOverlay) {
      this.hud.victoryOverlay.hidden = true;
    }
    if (this.hud.armoryOverlay) {
      this.hud.armoryOverlay.hidden = true;
    }
    if (this.hud.menuStoryImage) {
      if (showTutorial) {
        this.hud.menuStoryImage.hidden = false;
        this.hud.menuStoryImage.src = "/assets/story/campaign-awakening.png";
        this.hud.menuStoryImage.alt = "Angelic defenders at the citadel gate while demons advance from the corrupted side.";
      } else {
        this.hud.menuStoryImage.hidden = true;
        this.hud.menuStoryImage.removeAttribute("src");
        this.hud.menuStoryImage.alt = "";
      }
    }
    this.renderMenuUnlocks(null);
    if (this.hud.menuTutorial) {
      this.hud.menuTutorial.hidden = !showTutorial;
    }
    if (this.hud.menuTitle) {
      this.hud.menuTitle.textContent = "Citadel of the Seraphim";
    }
    if (this.hud.newCampaignButton) {
      this.hud.newCampaignButton.textContent = showTutorial ? "Start Tutorial" : "New Campaign";
    }
    if (this.hud.loadCampaignButton) {
      this.hud.loadCampaignButton.textContent = "Load Campaign";
    }
    if (this.hud.skipMenuButton) {
      this.hud.skipMenuButton.hidden = false;
      this.hud.skipMenuButton.textContent = showTutorial ? "Skip Tutorial" : "Replay Tutorial";
    }
    if (this.hud.menuGuideButton) {
      this.hud.menuGuideButton.textContent = "Guide";
    }
    if (this.hud.resumeBattleButton) {
      this.hud.resumeBattleButton.hidden = true;
    }
    if (this.hud.victorySummary) {
      this.hud.victorySummary.hidden = true;
      this.hud.victorySummary.replaceChildren();
    }
    if (this.guideOpen) {
      this.closeGuide();
    }
    this.updateBattleSettingsControls();
    this.updateMenuPreview();
    this.renderBuildPanel();
    this.updateHud();
  }

  private showArmoryFromVictory() {
    this.showCampaignHub();
  }

  private showResultMenu(result: "victory" | "defeat") {
    const wasTutorialBattle = this.tutorialBattleActive;
    this.endCombatTutorial(result === "victory");
    const victorySummary = result === "victory" && !wasTutorialBattle ? this.completeCurrentChapter() : null;
    const nextChapter = victorySummary?.nextMapId ? CAMPAIGN_CHAPTERS[victorySummary.nextMapId] : null;
    this.menuOpen = true;
    if (this.hud.menuOverlay) {
      this.hud.menuOverlay.hidden = result === "victory";
      this.hud.menuOverlay.dataset.state = result;
    }
    if (this.hud.victoryOverlay) {
      this.hud.victoryOverlay.hidden = result !== "victory";
    }
    if (this.hud.armoryOverlay) {
      this.hud.armoryOverlay.hidden = true;
    }
    if (this.hud.menuStoryImage) {
      const storyImage = nextChapter?.storyImage;
      this.hud.menuStoryImage.hidden = !storyImage;
      if (storyImage) {
        this.hud.menuStoryImage.src = storyImage;
      } else {
        this.hud.menuStoryImage.removeAttribute("src");
      }
    }
    if (this.hud.menuTutorial) {
      this.hud.menuTutorial.hidden = true;
    }
    this.renderMenuUnlocks(result === "victory" && victorySummary?.nextMapId ? victorySummary.nextMapId : null);
    if (this.hud.menuTitle) {
      this.hud.menuTitle.textContent =
        result === "victory"
          ? wasTutorialBattle
            ? "Training Complete"
            : victorySummary?.nextLevelTitle
              ? `${victorySummary.nextLevelTitle} Unlocked`
              : "You won"
          : "Sorry, you lost";
    }
    if (this.hud.armoryTitle) {
      this.hud.armoryTitle.textContent = wasTutorialBattle
        ? "Armory"
        : victorySummary?.nextLevelTitle
          ? `${victorySummary.nextLevelTitle} Armory`
          : "Final Armory";
    }
    if (this.hud.menuBody) {
      if (result === "victory") {
        const completedName = victorySummary?.completedLevelTitle ?? this.map.name;
        if (wasTutorialBattle) {
          this.hud.menuBody.textContent =
            "The training wave is clear. Use the armory between battles to review towers, unlock new ones, or upgrade the towers you rely on.";
        } else if (nextChapter && victorySummary?.nextMapId) {
          const unlockText = this.formatChapterUnlocks(victorySummary.nextMapId);
          const coreText =
            victorySummary.sanctumCoresEarned > 0
              ? ` Sanctum Core earned: ${victorySummary.coreReasons.join(", ")}.`
              : "";
          this.hud.menuBody.textContent = `${completedName} is secure. +${victorySummary.radianceEarned} Radiance.${coreText} ${victorySummary.nextLevelStory ?? nextChapter.story} ${unlockText}`;
        } else {
          const rewardText = victorySummary
            ? ` +${victorySummary.radianceEarned} Radiance${victorySummary.sanctumCoresEarned > 0 ? ` and ${victorySummary.sanctumCoresEarned} Sanctum ${victorySummary.sanctumCoresEarned === 1 ? "Core" : "Cores"}` : ""}.`
            : "";
          this.hud.menuBody.textContent =
            `The final gate stands. The seraphim have driven the darkness back from every bridge of the citadel.${rewardText}`;
        }
      } else {
        this.hud.menuBody.textContent = "The demons have breached the gate and overrun the citadel defenses.";
      }
    }
    if (this.hud.armoryBody) {
      if (wasTutorialBattle) {
        this.hud.armoryBody.textContent =
          "Training is complete. Review your towers here before starting the first full battle.";
      } else if (victorySummary) {
        const coreText =
          victorySummary.sanctumCoresEarned > 0
            ? ` Sanctum Core earned: ${victorySummary.coreReasons.join(", ")}.`
            : "";
        const nextText = victorySummary.nextLevelStory
          ? ` ${victorySummary.nextLevelStory}`
          : nextChapter
            ? ` ${nextChapter.story}`
            : " The final gate stands.";
        this.hud.armoryBody.textContent = `+${victorySummary.radianceEarned} Radiance.${coreText}${nextText}`;
      } else {
        this.hud.armoryBody.textContent = "Review towers, unlock new tools, and upgrade your defenses before the next assault.";
      }
    }
    if (this.hud.newCampaignButton) {
      this.hud.newCampaignButton.textContent =
        result === "victory" ? (victorySummary?.nextMapId ? "Continue" : "Start Battle") : "Try Again";
    }
    if (this.hud.loadCampaignButton) {
      this.hud.loadCampaignButton.textContent = "Load Campaign";
    }
    if (this.hud.skipMenuButton) {
      this.hud.skipMenuButton.hidden = result !== "victory" || !victorySummary?.nextMapId;
      this.hud.skipMenuButton.textContent = "Skip";
    }
    if (this.hud.menuGuideButton) {
      this.hud.menuGuideButton.textContent = "Guide";
    }
    if (this.hud.resumeBattleButton) {
      this.hud.resumeBattleButton.hidden = true;
    }
    if (this.hud.victoryNextButton) {
      this.hud.victoryNextButton.textContent = wasTutorialBattle || victorySummary?.nextMapId ? "Next Battle" : "Replay Battle";
    }
    if (this.hud.victoryArmoryButton) {
      this.hud.victoryArmoryButton.textContent = "Go to Armory";
    }
    if (this.hud.armoryStartButton) {
      this.hud.armoryStartButton.textContent = victorySummary?.nextMapId ? "Continue" : "Start Battle";
    }
    if (this.hud.armoryLoadButton) {
      this.hud.armoryLoadButton.textContent = "Load Campaign";
    }
    if (this.hud.armoryGuideButton) {
      this.hud.armoryGuideButton.textContent = "Guide";
    }
    if (victorySummary?.nextMapId && this.hud.menuMapSelect) {
      this.hud.menuMapSelect.value = victorySummary.nextMapId;
    }
    if (result === "victory") {
      this.renderVictorySummaryPanel(victorySummary, wasTutorialBattle);
    } else if (this.hud.victorySummary) {
      this.hud.victorySummary.hidden = true;
      this.hud.victorySummary.replaceChildren();
    }
    this.renderLobbyPanel();
    this.renderBuildPanel();
    this.updateHud();
  }

  private hasSeenTutorial() {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === "true";
  }

  private markTutorialSeen() {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
  }

  private shouldStartCombatTutorial() {
    return !this.menuOpen && this.activeMapId === "citadel" && (this.forceCombatTutorial || !this.hasSeenTutorial());
  }

  private tutorialTowerSlotIndex() {
    return clamp(2, 0, Math.max(0, this.map.towerSlots.length - 1));
  }

  private tutorialRallyPoint() {
    const path = this.map.paths[0] ?? this.map.path;
    return path[Math.min(2, path.length - 1)] ?? this.map.startingUnit;
  }

  private isCombatTutorialBlockingWaves() {
    return (
      this.combatTutorialStep === "premise" ||
      this.combatTutorialStep === "buildTower" ||
      this.combatTutorialStep === "redeployHost"
    );
  }

  private ensureCombatTutorialPanel() {
    if (!this.combatTutorialPanel) {
      const panel = document.createElement("section");
      panel.className = "combat-tutorial";
      panel.setAttribute("aria-label", "Battle tutorial");
      (this.root.parentElement ?? document.body).appendChild(panel);
      this.combatTutorialPanel = panel;
    }

    return this.combatTutorialPanel;
  }

  private beginCombatTutorial() {
    this.combatTutorialStep = "premise";
    this.tutorialBattleActive = true;
    this.selectedTowerKind = "lightspire";
    this.closeBuildOverlay();
    this.renderCombatTutorial();
  }

  private endCombatTutorial(markSeen: boolean) {
    this.combatTutorialStep = null;
    this.forceCombatTutorial = false;
    if (markSeen) {
      this.markTutorialSeen();
      this.tutorialBattleActive = false;
    }
    if (this.combatTutorialPanel) {
      this.combatTutorialPanel.hidden = true;
    }
    this.clearCombatTutorialHighlight();
    this.updateHud();
  }

  private skipCombatTutorial() {
    this.tutorialBattleActive = false;
    this.endCombatTutorial(true);
    this.setStatus("Tutorial skipped", 1000);
  }

  private advanceCombatTutorialAfterTower(slotIndex: number) {
    if (this.combatTutorialStep !== "buildTower" || slotIndex !== this.tutorialTowerSlotIndex()) {
      return;
    }

    this.combatTutorialStep = "redeployHost";
    const firstHost = this.units.find((unit) => unit.team === "angel" && this.aliveMembers(unit).length > 0);
    if (firstHost) {
      this.selectUnit(firstHost);
    }
    this.closeSelectedOverlay();
    this.closeBuildOverlay();
    this.renderCombatTutorial();
    this.setStatus("Tower ready. Move Alizel's Host to the highlighted road point.", 2200);
  }

  private advanceCombatTutorialAfterRedeploy() {
    if (this.combatTutorialStep !== "redeployHost") {
      return;
    }

    this.combatTutorialStep = "surviveWave";
    this.closeBuildOverlay();
    this.renderCombatTutorial();
    this.setStatus("First wave incoming", 1600);
  }

  private advanceCombatTutorialFromPremise() {
    if (this.combatTutorialStep !== "premise") {
      return;
    }

    this.combatTutorialStep = "buildTower";
    this.selectedTowerKind = "lightspire";
    this.setBuildMode("towers", false);
    this.closeBuildOverlay();
    this.renderCombatTutorial();
    this.setStatus("Click the pulsing Towers icon", 1600);
  }

  private createCombatTutorialVisuals(items: Array<{ label: string; detail: string }>) {
    const visuals = document.createElement("div");
    visuals.className = "combat-tutorial-visuals";
    items.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "combat-tutorial-card";

      const marker = document.createElement("span");
      marker.className = "combat-tutorial-marker";
      marker.textContent = String(index + 1);

      const text = document.createElement("span");
      text.textContent = item.label;

      const detail = document.createElement("small");
      detail.textContent = item.detail;

      card.append(marker, text, detail);
      visuals.appendChild(card);
    });
    return visuals;
  }

  private renderCombatTutorial() {
    if (!this.combatTutorialStep) {
      this.endCombatTutorial(false);
      return;
    }

    const panel = this.ensureCombatTutorialPanel();
    panel.hidden = false;
    panel.dataset.step = this.combatTutorialStep;
    panel.replaceChildren();

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "Training";

    const title = document.createElement("h2");
    const body = document.createElement("p");
    const progress = document.createElement("span");
    progress.className = "combat-tutorial-progress";
    let visuals: HTMLElement;

    if (this.combatTutorialStep === "premise") {
      title.textContent = "Defend the Gate";
      body.textContent =
        "Demons cross the road from the corrupted citadel. Your job is to keep them away from the gate by combining fixed towers with mobile angel hosts.";
      progress.textContent = "Overview";
      visuals = this.createCombatTutorialVisuals([
        { label: "Enemies follow roads", detail: "Stop them before the gate" },
        { label: "Towers hold ground", detail: "They build Tension" },
        { label: "Hosts can move", detail: "Send them to danger points" },
      ]);
    } else if (this.combatTutorialStep === "buildTower") {
      title.textContent = "Build Your First Tower";
      body.textContent =
        "Click the pulsing Towers icon, then place a Lightspire on the highlighted pedestal. Towers do not move, but they build Tension while fighting and can release a larger burst when charged.";
      progress.textContent = "Step 1 of 3";
      visuals = this.createCombatTutorialVisuals([
        { label: "Spend Energy", detail: "Build once on a pedestal" },
        { label: "Auto Attack", detail: "Fires at enemies in range" },
        { label: "Build Tension", detail: "Release when charged" },
      ]);
    } else if (this.combatTutorialStep === "redeployHost") {
      title.textContent = "Place Alizel's Host";
      body.textContent =
        "Click the highlighted forward road point. It is away from the tower on purpose: regular hosts can move, hold lanes, and slow enemies before they reach your fixed defenses.";
      progress.textContent = "Step 2 of 3";
      visuals = this.createCombatTutorialVisuals([
        { label: "Move", detail: "Click road points" },
        { label: "Block", detail: "Hold enemies in place" },
        { label: "No Tension", detail: "Regular units stay simple" },
      ]);
    } else {
      title.textContent = "Survive One Wave";
      body.textContent =
        "A longer training wave is coming from the left. Watch the host hold the forward road while the Lightspire covers the middle of the lane with steady ranged damage.";
      progress.textContent = "Step 3 of 3";
      visuals = this.createCombatTutorialVisuals([
        { label: "Watch the lane", detail: "Enemies enter from the left" },
        { label: "Protect the gate", detail: "Gate HP matters" },
        { label: "Battle review", detail: "Rewards appear after victory" },
      ]);
    }

    const button = document.createElement("button");
    button.type = "button";
    button.textContent =
      this.combatTutorialStep === "premise"
        ? "Start Training"
        : this.combatTutorialStep === "surviveWave"
          ? "Hide Tip"
          : "Skip Tutorial";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (this.combatTutorialStep === "premise") {
        this.advanceCombatTutorialFromPremise();
      } else if (this.combatTutorialStep === "surviveWave") {
        panel.hidden = true;
      } else {
        this.skipCombatTutorial();
      }
    });

    panel.append(eyebrow, title, body, visuals, progress, button);
    this.renderCombatTutorialHighlight();
  }

  private clearCombatTutorialHighlight() {
    if (!this.combatTutorialHighlight) {
      return;
    }

    if (this.combatTutorialHighlight.parent) {
      this.combatTutorialHighlight.parent.removeChild(this.combatTutorialHighlight);
    }
    this.combatTutorialHighlight.destroy();
    this.combatTutorialHighlight = null;
    this.combatTutorialPulseRings = [];
    this.combatTutorialHighlightMs = 0;
  }

  private renderCombatTutorialHighlight() {
    this.clearCombatTutorialHighlight();
    if (!this.combatTutorialStep || this.combatTutorialStep === "premise" || this.combatTutorialStep === "surviveWave") {
      return;
    }

    const target =
      this.combatTutorialStep === "buildTower"
        ? this.map.towerSlots[this.tutorialTowerSlotIndex()]
        : this.tutorialRallyPoint();
    if (!target) {
      return;
    }

    const highlight = new Container();
    const pulseA = new Graphics();
    const pulseB = new Graphics();
    pulseA.position.set(target.x, target.y);
    pulseB.position.set(target.x, target.y);
    const ring = new Graphics();
    if (this.combatTutorialStep === "buildTower") {
      pulseA
        .ellipse(0, 0, PEDESTAL_RADIUS + 22, 64)
        .stroke({ color: 0xfff1ad, width: 5, alpha: 0.92 });
      pulseB
        .ellipse(0, 0, PEDESTAL_RADIUS + 36, 78)
        .stroke({ color: 0x8ed8ff, width: 3, alpha: 0.72 });
      ring
        .ellipse(target.x, target.y, PEDESTAL_RADIUS + 10, 52)
        .stroke({ color: 0xf5d77e, width: 5, alpha: 0.92 })
        .ellipse(target.x, target.y, PEDESTAL_RADIUS + 25, 66)
        .stroke({ color: 0x8ed8ff, width: 2, alpha: 0.55 })
        .moveTo(target.x, target.y - 104)
        .lineTo(target.x, target.y - 68)
        .stroke({ color: 0xf5d77e, width: 4, alpha: 0.9 });
    } else {
      pulseA.circle(0, 0, 46).stroke({ color: 0xfff1ad, width: 5, alpha: 0.92 });
      pulseB.circle(0, 0, 62).stroke({ color: 0x8ed8ff, width: 3, alpha: 0.72 });
      ring
        .circle(target.x, target.y, 38)
        .fill({ color: 0x8ed8ff, alpha: 0.14 })
        .circle(target.x, target.y, 38)
        .stroke({ color: 0x8ed8ff, width: 5, alpha: 0.92 })
        .circle(target.x, target.y, 58)
        .stroke({ color: 0xf5d77e, width: 2, alpha: 0.58 });
      const host = this.units.find((unit) => unit.team === "angel" && this.aliveMembers(unit).length > 0);
      if (host) {
        const hp = Math.round(this.totalUnitHp(host));
        const maxHp = Math.round(this.totalUnitMaxHp(host));
        const infoText = new Text({
          text: `${host.name}\nHP ${hp}/${maxHp}\nDamage ${Math.round(this.unitDamage(host, host.damagePerMember))}/angel`,
          style: {
            align: "left",
            fill: 0xfff7de,
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 14,
            fontWeight: "800",
            lineHeight: 18,
            stroke: { color: 0x06080d, width: 4 },
          },
        });
        const infoX = clamp(host.x + 78, 80, this.map.width - 230);
        const infoY = clamp(host.y - 88, 60, this.map.height - 130);
        const infoBg = new Graphics()
          .roundRect(infoX - 10, infoY - 8, 205, 76, 8)
          .fill({ color: 0x090c11, alpha: 0.78 })
          .roundRect(infoX - 10, infoY - 8, 205, 76, 8)
          .stroke({ color: 0x8ed8ff, width: 2, alpha: 0.62 });
        infoText.position.set(infoX, infoY);
        highlight.addChild(infoBg, infoText);
      }
    }

    const label = new Text({
      text: this.combatTutorialStep === "buildTower" ? "Place Lightspire here" : "Place Alizel's Host here",
      style: {
        align: "center",
        fill: 0xfff7de,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 18,
        fontWeight: "900",
        stroke: { color: 0x06080d, width: 5 },
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(target.x, target.y - (this.combatTutorialStep === "buildTower" ? 108 : 62));
    highlight.addChild(pulseA, pulseB, ring, label);

    this.overlayLayer.addChild(highlight);
    this.combatTutorialHighlight = highlight;
    this.combatTutorialPulseRings = [pulseA, pulseB];
  }

  private skipMenuPanel() {
    const state = this.hud.menuOverlay?.dataset.state;
    if (state === "start") {
      if (this.hasSeenTutorial()) {
        this.startCampaignFromMenu(false, false, true);
      } else {
        this.markTutorialSeen();
        this.resetCampaignProgress();
        this.populateMapSelect();
        this.showCampaignHub("Tutorial skipped. Click an unlocked mountain level to begin.");
      }
      return;
    }

    if (state === "victory" && this.pendingContinueMapId) {
      this.startCampaignFromMenu(false);
    }
  }

  private showStoryIntro(onDone: () => void) {
    if (!this.hud.storyIntroOverlay) {
      onDone();
      return;
    }

    this.pendingStoryStart = onDone;
    this.menuOpen = true;
    this.hud.storyIntroOverlay.hidden = false;
    this.hud.storyIntroOverlay.classList.remove("playing");
    this.hud.storyIntroProgress?.classList.remove("playing");
    window.requestAnimationFrame(() => {
      this.hud.storyIntroOverlay?.classList.add("playing");
      this.hud.storyIntroProgress?.classList.add("playing");
    });
    if (this.storyIntroTimer !== null) {
      window.clearTimeout(this.storyIntroTimer);
    }
    this.storyIntroTimer = window.setTimeout(() => this.finishStoryIntro(), 26000);
  }

  private finishStoryIntro() {
    if (this.storyIntroTimer !== null) {
      window.clearTimeout(this.storyIntroTimer);
      this.storyIntroTimer = null;
    }
    if (this.hud.storyIntroOverlay) {
      this.hud.storyIntroOverlay.hidden = true;
      this.hud.storyIntroOverlay.classList.remove("playing");
    }
    this.hud.storyIntroProgress?.classList.remove("playing");
    const start = this.pendingStoryStart;
    this.pendingStoryStart = null;
    start?.();
  }

  private hideMenu() {
    this.menuOpen = false;
    this.finishStoryIntro();
    if (this.hud.menuOverlay) {
      this.hud.menuOverlay.hidden = true;
    }
    if (this.hud.victoryOverlay) {
      this.hud.victoryOverlay.hidden = true;
    }
    if (this.hud.armoryOverlay) {
      this.hud.armoryOverlay.hidden = true;
    }
    this.renderBuildPanel();
    this.updateHud();
  }

  private openGuide(section: GuideSection = this.guideSection) {
    this.guideOpen = true;
    this.guideSection = section;
    if (this.hud.guideOverlay) {
      this.hud.guideOverlay.hidden = false;
    }
    this.renderGuide();
    this.renderBuildPanel();
    this.updateHud();
  }

  private closeGuide() {
    this.guideOpen = false;
    if (this.hud.guideOverlay) {
      this.hud.guideOverlay.hidden = true;
    }
    this.renderBuildPanel();
    this.updateHud();
  }

  private hostSpriteKey(kind: string): HostSpriteKey {
    return kind in hostAnimationCatalog ? (kind as HostSpriteKey) : "host";
  }

  private hostAnimation(kind: string) {
    return hostAnimationCatalog[this.hostSpriteKey(kind)];
  }

  private sliceAnimationTexture(texture: Texture, animation: { frames: number }) {
    const frameCount = Math.max(1, animation.frames);
    if (frameCount === 1) {
      return [texture];
    }

    const frameWidth = texture.width / frameCount;
    const frameHeight = texture.height;
    return Array.from({ length: frameCount }, (_, frameIndex) => {
      return new Texture({
        source: texture.source,
        frame: new Rectangle(frameIndex * frameWidth, 0, frameWidth, frameHeight),
      });
    });
  }

  private hostSpriteImage(kind: string, pose: AnimationKey) {
    const animation = this.hostAnimation(kind);
    return animation.previews?.[pose] ?? animation.textures[pose];
  }

  private hostGuideAnimation(kind: HostKind) {
    const spriteKey = this.hostSpriteKey(kind);
    return {
      src: `/assets/sprites/guide-hosts/${spriteKey}.png`,
      frames: 6,
      frameMs: 130,
      className: kind === "cavalry" ? "flying" : "walking",
    };
  }

  private hostTexture(kind: string, pose: AnimationKey, animationTimeMs = 0, phaseOffsetMs = 0) {
    const animation = this.hostAnimation(kind).animations[pose];
    const frames = this.textures.angel[this.hostSpriteKey(kind)][pose];
    if (!frames || frames.length === 0) {
      return Texture.EMPTY;
    }
    const frameIndex = Math.floor((animationTimeMs + phaseOffsetMs) / animation.frameMs);
    const clampedIndex = animation.loop ? frameIndex % frames.length : Math.min(frames.length - 1, frameIndex);
    return frames[clampedIndex] ?? frames[0];
  }

  private isSpecialHostKind(kind: HostKind) {
    return "special" in HOST_TYPES[kind] && HOST_TYPES[kind].special === true;
  }

  private deploymentPaths() {
    return [...this.map.paths, ...this.map.sidePaths].filter((path) => path.length > 0);
  }

  private editablePath(group: PathGroup, pathId: number) {
    return group === "lane" ? this.map.paths[pathId] : this.map.sidePaths[pathId];
  }

  private selectedEditablePath() {
    return this.editablePath(this.selectedPathGroup, this.selectedPathRouteIndex) ?? this.map.paths[0];
  }

  private editablePathEntries() {
    const entries: { group: PathGroup; pathId: number; path: Point[]; label: string }[] = [];
    for (const [pathId, path] of this.map.paths.entries()) {
      entries.push({ group: "lane", pathId, path, label: String.fromCharCode(65 + pathId) });
    }
    for (const [pathId, path] of this.map.sidePaths.entries()) {
      entries.push({ group: "side", pathId, path, label: `S${pathId + 1}` });
    }
    return entries;
  }

  private specialAngelDeployed(kind: HostKind) {
    return this.isSpecialHostKind(kind) && this.deployedSpecialAngels.has(kind);
  }

  private renderGuide() {
    this.renderGuideTabs();
    this.renderGuideContent();
  }

  private renderGuideTabs() {
    if (!this.hud.guideTabs) {
      return;
    }

    this.hud.guideTabs.replaceChildren();
    const sections: { id: GuideSection; label: string }[] = [
      { id: "towers", label: "Towers" },
      { id: "hosts", label: "Hosts" },
      { id: "demons", label: "Demons" },
      { id: "systems", label: "Systems" },
    ];
    for (const section of sections) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = section.label;
      button.classList.toggle("active", this.guideSection === section.id);
      button.addEventListener("click", () => {
        this.guideSection = section.id;
        this.renderGuide();
      });
      this.hud.guideTabs.appendChild(button);
    }
  }

  private renderGuideContent() {
    if (!this.hud.guideContent) {
      return;
    }

    this.hud.guideContent.replaceChildren();
    if (this.guideSection === "towers") {
      this.renderTowerGuide();
      return;
    }
    if (this.guideSection === "hosts") {
      this.renderHostGuide();
      return;
    }
    if (this.guideSection === "demons") {
      this.renderEnemyGuide();
      return;
    }
    this.renderSystemsGuide();
  }

  private renderTowerGuide() {
    if (!this.hud.guideContent) {
      return;
    }

    for (const [kind, tower] of Object.entries(TOWER_TYPES) as [TowerKind, (typeof TOWER_TYPES)[TowerKind]][]) {
      const extra =
        tower.behavior === "support"
          ? "Restores nearby host HP and MP."
          : tower.behavior === "slow"
            ? `Slows enemies by ${Math.round((tower.slowPercent ?? 0) * 100)}%.`
            : tower.behavior === "beam"
              ? `Beam ${(tower.beamDurationMs / 1000).toFixed(1)}s, width ${tower.beamWidth}.`
              : tower.behavior === "shockwave"
                ? "Area shockwave."
                : "Projectile fire.";
      this.hud.guideContent.appendChild(
        this.createGuideCard({
          title: tower.name,
          subtitle: `${tower.behavior} tower`,
          description: tower.description,
          imageSrc: tower.texture,
          accentColor: tower.color,
          assetClass: "guide-tower-asset",
          stats: [
            ["Cost", `${tower.cost} energy`],
            ["Range", this.towerRangeLabel(tower.innerRange, tower.range)],
            ["Damage", tower.damage > 0 ? String(tower.damage) : "None"],
            ["Cooldown", `${(tower.cooldownMs / 1000).toFixed(2)}s`],
            ["Effect", extra],
          ],
          chips: [kind, tower.behavior],
        }),
      );
    }
  }

  private renderHostGuide() {
    if (!this.hud.guideContent) {
      return;
    }

    for (const [kind, host] of Object.entries(HOST_TYPES) as [HostKind, (typeof HOST_TYPES)[HostKind]][]) {
      const special = this.isSpecialHostKind(kind);
      const stats: [string, string][] = [
        ["Cost", `${host.cost} energy`],
        ["HP / MP", `${host.memberHp} / ${host.memberMp}`],
        ["Speed", String(host.speed)],
        ["Range", host.attackRange > 0 ? String(host.attackRange) : "Support"],
        ["Output", host.healPerMember > 0 ? `${host.healPerMember} heal/member` : `${host.damagePerMember} damage/member`],
        ["Defense", `${Math.round((1 / host.defense) * 100)}% durability`],
        ["Tension", special ? "Builds by acting; once per battle deploy" : "None"],
      ];
      if (!special) {
        stats.splice(1, 0, ["Members", String(host.memberCount)]);
      }
      const chips = special
        ? [kind, "special angel", "tension"]
        : kind === "cavalry"
          ? [kind, host.role, "flying"]
          : [kind, host.role];
      const profileImage = special ? `/assets/characters/${kind}.webp` : undefined;
      this.hud.guideContent.appendChild(
        this.createGuideCard({
          title: host.name,
          subtitle: host.role,
          description: host.description,
          imageSrc: profileImage,
          animation: special ? undefined : this.hostGuideAnimation(kind),
          accentColor: host.tint,
          assetClass: special ? "guide-profile-asset" : "guide-host-asset",
          stats,
          chips,
        }),
      );
    }
  }

  private renderEnemyGuide() {
    if (!this.hud.guideContent) {
      return;
    }

    for (const [kind, enemy] of Object.entries(ENEMY_TYPES) as [EnemyKind, (typeof ENEMY_TYPES)[EnemyKind]][]) {
      const projectile = "projectile" in enemy ? enemy.projectile : undefined;
      this.hud.guideContent.appendChild(
        this.createGuideCard({
          title: enemy.name,
          subtitle: this.projectileCorrupts(projectile) ? "Corruption caster" : projectile ? "Ranged demon" : "Assault demon",
          description: projectile
            ? this.projectileCorrupts(projectile)
              ? "The dedicated corruption unit. Hit it with ranged weapons before it can convert angel hosts."
              : "Fires damaging projectiles while advancing on the gate, but does not corrupt hosts."
            : "Advances on the gate and pressures defenders in its path.",
          imageSrc: enemy.texture,
          accentColor: projectile?.color ?? 0xff604d,
          assetClass: "guide-enemy-asset",
          stats: [
            ["HP", String(enemy.hp)],
            ["Speed", String(enemy.speed)],
            ["Gate DPS", String(enemy.gateDamagePerSecond)],
            ["Energy reward", String(enemy.energyReward)],
            ["Projectile", projectile ? `${projectile.damage} damage, ${projectile.range} range` : "None"],
            ["Corrupts", this.projectileCorrupts(projectile) ? "Yes" : "No"],
          ],
          chips: [kind, this.projectileCorrupts(projectile) ? "corruption" : projectile ? "ranged" : "melee"],
        }),
      );
    }
  }

  private renderSystemsGuide() {
    if (!this.hud.guideContent) {
      return;
    }

    const systems: {
      title: string;
      subtitle: string;
      description: string;
      accentColor: number;
      stats: [string, string][];
      chips: string[];
    }[] = [
      {
        title: "Energy",
        subtitle: "Build economy",
        description: "Spend energy on towers, hosts, and Purify. Defeated demons return energy, so high-value kills can fund emergency redeployments.",
        accentColor: 0x8ed8ff,
        stats: [
          ["Easy", `${DIFFICULTY_MODES.easy.startingEnergy} start`],
          ["Normal", `${DIFFICULTY_MODES.normal.startingEnergy} start`],
          ["Hard", `${DIFFICULTY_MODES.hard.startingEnergy} start`],
        ],
        chips: ["economy", "waves"],
      },
      {
        title: "Wave Director",
        subtitle: "Enemy AI mode",
        description:
          "Ordered waves follow the map script. AI Director studies tower coverage, host positions, support, existing pressure, and gate health before selecting the next wave and demon gates.",
        accentColor: 0xbc8cff,
        stats: [
          ["Ordered", WAVE_DIRECTOR_MODES.ordered.description],
          ["AI Director", WAVE_DIRECTOR_MODES.adaptive.description],
          ["Gates", "Each path start acts as a demon gate."],
        ],
        chips: ["adaptive", "enemy strategy"],
      },
      {
        title: "Purify Corruption",
        subtitle: "Capture ability",
        description: `Spend ${PURIFY_COST} energy to turn a demon or corrupted host back to the angel side. It is expensive, so it should feel like a clutch reversal rather than a routine attack.`,
        accentColor: 0xf5d77e,
        stats: [
          ["Cost", `${PURIFY_COST} energy`],
          ["Target", "Demons or corrupted hosts"],
          ["Result", "Switches team"],
        ],
        chips: ["ability", "control"],
      },
      {
        title: "Recommended Damage Types",
        subtitle: "Design direction",
        description: "Yes, damage types are worth adding once the core loop settles. Start with a small readable set so towers feel distinct without making every wave a spreadsheet.",
        accentColor: 0x91d18b,
        stats: [
          ["Radiant", "Baseline holy damage; strong versus corrupted enemies."],
          ["Piercing", "Arrows, lances, and beams; reliable single-target pressure."],
          ["Flame", "Burning area damage; strong against dense and armored waves."],
          ["Resonance", "Shockwaves and bells; area pressure and possible armor break."],
          ["Temporal", "Slow and tempo control; low raw damage, high utility."],
          ["Corruption", "Demon damage that can convert hosts unless purified."],
        ],
        chips: ["future balance", "elemental"],
      },
    ];

    for (const system of systems) {
      this.hud.guideContent.appendChild(this.createGuideCard(system));
    }
  }

  private createGuideCard(options: {
    title: string;
    subtitle: string;
    description: string;
    imageSrc?: string;
    animation?: {
      src: string;
      frames: number;
      frameMs: number;
      className?: string;
    };
    accentColor: number;
    assetClass?: string;
    stats: [string, string][];
    chips?: string[];
    frames?: [string, string][];
  }) {
    const card = document.createElement("article");
    card.className = "guide-card";
    card.style.setProperty("--guide-accent", colorToCss(options.accentColor));

    const media = document.createElement("div");
    media.className = "guide-media";
    if (options.animation) {
      const shell = document.createElement("div");
      shell.className = `guide-animation-shell ${options.assetClass ?? ""} ${options.animation.className ?? ""}`.trim();
      const sprite = document.createElement("div");
      sprite.className = "guide-animation-sprite";
      sprite.style.backgroundImage = `url("${options.animation.src}")`;
      sprite.style.setProperty("--guide-frame-count", String(options.animation.frames));
      sprite.style.animation = `guide-sprite-play ${options.animation.frames * options.animation.frameMs}ms steps(${options.animation.frames}) infinite`;
      sprite.setAttribute("aria-hidden", "true");
      shell.appendChild(sprite);
      media.appendChild(shell);
    } else if (options.imageSrc) {
      const image = document.createElement("img");
      image.className = `guide-asset ${options.assetClass ?? ""}`.trim();
      image.src = options.imageSrc;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      media.appendChild(image);
    } else {
      const glyph = document.createElement("span");
      glyph.className = "guide-glyph";
      glyph.textContent = "*";
      media.appendChild(glyph);
    }
    card.appendChild(media);

    const body = document.createElement("div");
    body.className = "guide-card-body";
    const title = document.createElement("h3");
    title.textContent = options.title;
    body.appendChild(title);
    const subtitle = document.createElement("p");
    subtitle.className = "guide-subtitle";
    subtitle.textContent = options.subtitle;
    body.appendChild(subtitle);
    const description = document.createElement("p");
    description.className = "guide-description";
    description.textContent = options.description;
    body.appendChild(description);

    const stats = document.createElement("dl");
    stats.className = "guide-stats";
    for (const [label, value] of options.stats) {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      row.append(dt, dd);
      stats.appendChild(row);
    }
    body.appendChild(stats);

    if (options.chips && options.chips.length > 0) {
      const chips = document.createElement("div");
      chips.className = "guide-chips";
      for (const chipText of options.chips) {
        const chip = document.createElement("span");
        chip.textContent = chipText;
        chips.appendChild(chip);
      }
      body.appendChild(chips);
    }

    if (options.frames && options.frames.length > 0) {
      const frames = document.createElement("div");
      frames.className = "guide-frames";
      for (const [label, src] of options.frames) {
        const frame = document.createElement("figure");
        const image = document.createElement("img");
        image.src = src;
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        const caption = document.createElement("figcaption");
        caption.textContent = label;
        frame.append(image, caption);
        frames.appendChild(frame);
      }
      body.appendChild(frames);
    }

    card.appendChild(body);
    return card;
  }

  private cloneMapLayout(id: MapId): EditableMapState {
    const source = MAPS[id];
    const paths = (source.paths ?? [source.path]).map((path) => path.map((point) => ({ ...point })));
    const sidePaths = (source.sidePaths ?? []).map((path) => path.map((point) => ({ ...point })));
    return {
      id,
      name: source.name,
      background: source.background,
      width: source.width,
      height: source.height,
      path: paths[0],
      paths,
      sidePaths,
      towerSlots: source.towerSlots.map((point) => ({ ...point })),
      gate: { ...source.gate },
      startingUnit: { ...source.startingUnit },
    };
  }

  private loadMapLayout(id: MapId): EditableMapState {
    const layout = this.cloneMapLayout(id);
    const storedOverride = this.loadStoredMapLayoutOverride(id);
    if (!storedOverride) {
      return layout;
    }
    return this.applyStoredMapLayoutOverride(layout, storedOverride);
  }

  private clonePoints(points: Point[]) {
    return points.map((point) => ({ ...point }));
  }

  private loadStoredMapLayoutOverrides() {
    if (!this.devMapAuthoring) {
      return {};
    }
    try {
      const raw = localStorage.getItem(MAP_AUTHORING_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Partial<Record<MapId, StoredMapLayoutOverride>>) : {};
    } catch {
      return {};
    }
  }

  private loadStoredMapLayoutOverride(id: MapId) {
    return this.loadStoredMapLayoutOverrides()[id] ?? null;
  }

  private saveStoredMapLayoutOverride(id: MapId, layout: StoredMapLayoutOverride) {
    if (!this.devMapAuthoring) {
      return;
    }
    const overrides = this.loadStoredMapLayoutOverrides();
    overrides[id] = layout;
    localStorage.setItem(MAP_AUTHORING_STORAGE_KEY, JSON.stringify(overrides));
  }

  private clearStoredMapLayoutOverride(id: MapId) {
    const overrides = this.loadStoredMapLayoutOverrides();
    if (!(id in overrides)) {
      return;
    }
    delete overrides[id];
    localStorage.setItem(MAP_AUTHORING_STORAGE_KEY, JSON.stringify(overrides));
  }

  private applyStoredMapLayoutOverride(layout: EditableMapState, override: StoredMapLayoutOverride): EditableMapState {
    if (override.paths) {
      layout.paths = override.paths.map((path) => this.clonePoints(path));
      layout.path = layout.paths[0] ?? layout.path;
    } else if (override.path) {
      layout.path = this.clonePoints(override.path);
      layout.paths = [layout.path, ...layout.paths.slice(1).map((path) => this.clonePoints(path))];
    }
    if (override.sidePaths) {
      layout.sidePaths = override.sidePaths.map((path) => this.clonePoints(path));
    }
    if (override.towerSlots) {
      layout.towerSlots = this.clonePoints(override.towerSlots);
    }
    if (override.gate) {
      layout.gate = { ...layout.gate, ...override.gate };
    }
    if (override.startingUnit) {
      layout.startingUnit = { ...override.startingUnit };
    }
    return layout;
  }

  private loadGameSettings() {
    try {
      const raw = localStorage.getItem(GAME_SETTINGS_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const settings = JSON.parse(raw) as {
        activeMapId?: string;
        difficultyMode?: string;
        battleSpeed?: number;
        waveDirectorMode?: string;
        waveLimitMode?: string;
      };
      if (settings.activeMapId && MAP_ORDER.includes(settings.activeMapId as MapId)) {
        this.activeMapId = settings.activeMapId as MapId;
        this.map = this.loadMapLayout(this.activeMapId);
      }
      if (settings.difficultyMode && settings.difficultyMode in DIFFICULTY_MODES) {
        this.difficultyMode = settings.difficultyMode as DifficultyMode;
      }
      if (
        typeof settings.battleSpeed === "number" &&
        settings.battleSpeed > 0 &&
        BATTLE_SPEED_OPTIONS.some((speed) => speed === settings.battleSpeed)
      ) {
        this.battleSpeed = settings.battleSpeed;
      }
      if (settings.waveDirectorMode && settings.waveDirectorMode in WAVE_DIRECTOR_MODES) {
        this.waveDirectorMode = settings.waveDirectorMode as WaveDirectorMode;
      }
      if (settings.waveLimitMode && this.isWaveLimitMode(settings.waveLimitMode)) {
        this.waveLimitMode = settings.waveLimitMode;
      }
      this.ensureActiveMapUnlocked();
    } catch {
      // Ignore malformed saved settings and keep defaults.
    }
  }

  private saveGameSettings() {
    localStorage.setItem(
      GAME_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        activeMapId: this.activeMapId,
        difficultyMode: this.difficultyMode,
        battleSpeed: this.battleSpeed,
        waveDirectorMode: this.waveDirectorMode,
        waveLimitMode: this.waveLimitMode,
      }),
    );
  }

  private populateMapSelect() {
    for (const select of [this.hud.mapSelect, this.hud.menuMapSelect]) {
      if (!select) {
        continue;
      }

      select.replaceChildren();
      for (const id of MAP_ORDER) {
        const option = document.createElement("option");
        const chapter = CAMPAIGN_CHAPTERS[id];
        const unlocked = this.isMapUnlocked(id);
        option.value = id;
        option.textContent = unlocked ? `${chapter.index + 1}. ${MAPS[id].name}` : `Locked - ${MAPS[id].name}`;
        option.disabled = !unlocked;
        select.appendChild(option);
      }
      select.value = this.isMapUnlocked(this.activeMapId) ? this.activeMapId : this.firstUnlockedMap();
    }
  }

  private populateBattleSettings() {
    for (const select of [this.hud.difficultySelect, this.hud.menuDifficultySelect]) {
      if (!select) {
        continue;
      }

      select.replaceChildren();
      for (const [id, difficulty] of Object.entries(DIFFICULTY_MODES) as [
        DifficultyMode,
        (typeof DIFFICULTY_MODES)[DifficultyMode],
      ][]) {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = difficulty.name;
        select.appendChild(option);
      }
    }

    if (this.hud.battleSpeedSelect) {
      this.hud.battleSpeedSelect.replaceChildren();
      for (const speed of BATTLE_SPEED_OPTIONS) {
        const option = document.createElement("option");
        option.value = String(speed);
        option.textContent = this.formatBattleSpeed(speed);
        this.hud.battleSpeedSelect.appendChild(option);
      }
    }

    if (this.hud.waveDirectorSelect) {
      this.hud.waveDirectorSelect.replaceChildren();
      for (const [id, mode] of Object.entries(WAVE_DIRECTOR_MODES) as [
        WaveDirectorMode,
        (typeof WAVE_DIRECTOR_MODES)[WaveDirectorMode],
      ][]) {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = mode.name;
        this.hud.waveDirectorSelect.appendChild(option);
      }
    }

    if (this.hud.waveLimitSelect) {
      this.hud.waveLimitSelect.replaceChildren();
      for (const limit of WAVE_LIMIT_OPTIONS) {
        const option = document.createElement("option");
        option.value = limit.value;
        option.textContent = limit.label;
        this.hud.waveLimitSelect.appendChild(option);
      }
    }

    this.updateBattleSettingsControls();
  }

  private populateAutoMoveSelect() {
    if (!this.hud.autoMoveSelect) {
      return;
    }

    this.hud.autoMoveSelect.replaceChildren();
    for (const optionDefinition of AUTO_MOVE_OPTIONS) {
      const option = document.createElement("option");
      option.value = optionDefinition.mode;
      option.textContent = optionDefinition.label;
      this.hud.autoMoveSelect.appendChild(option);
    }
  }

  private populateEditorTowerSelect() {
    if (!this.hud.mapEditTowerKind) {
      return;
    }

    this.hud.mapEditTowerKind.replaceChildren();
    for (const [kind, tower] of Object.entries(TOWER_TYPES) as [TowerKind, (typeof TOWER_TYPES)[TowerKind]][]) {
      const option = document.createElement("option");
      option.value = kind;
      option.textContent = tower.name;
      this.hud.mapEditTowerKind.appendChild(option);
    }
    this.hud.mapEditTowerKind.value = this.selectedTowerKind ?? "lightspire";
  }

  private updateBattleSettingsControls() {
    if (this.hud.difficultySelect) {
      this.hud.difficultySelect.value = this.difficultyMode;
    }
    if (this.hud.menuDifficultySelect) {
      this.hud.menuDifficultySelect.value = this.difficultyMode;
    }
    if (this.hud.battleSpeedSelect) {
      this.hud.battleSpeedSelect.value = String(this.battleSpeed);
    }
    this.updatePauseButton();
    if (this.hud.waveDirectorSelect) {
      this.hud.waveDirectorSelect.value = this.waveDirectorMode;
      this.hud.waveDirectorSelect.title = WAVE_DIRECTOR_MODES[this.waveDirectorMode].description;
    }
    if (this.hud.waveLimitSelect) {
      this.hud.waveLimitSelect.value = this.waveLimitMode;
      this.hud.waveLimitSelect.title = "Developer story-progress override. Story default uses all configured waves.";
    }
    if (this.hud.mapSelect) {
      this.hud.mapSelect.value = this.isMapUnlocked(this.activeMapId) ? this.activeMapId : this.firstUnlockedMap();
    }
    if (this.hud.menuMapSelect) {
      this.hud.menuMapSelect.value = this.pendingContinueMapId ?? (this.isMapUnlocked(this.activeMapId) ? this.activeMapId : this.firstUnlockedMap());
    }
  }

  private isAutoMoveMode(value: string): value is AutoMoveMode {
    return AUTO_MOVE_OPTIONS.some((option) => option.mode === value);
  }

  private isWaveLimitMode(value: string): value is WaveLimitMode {
    return WAVE_LIMIT_OPTIONS.some((option) => option.value === value);
  }

  private waveLimitLabel() {
    return WAVE_LIMIT_OPTIONS.find((option) => option.value === this.waveLimitMode)?.label ?? "Story default";
  }

  private loadDevMode() {
    if (!this.devMapAuthoring) {
      return false;
    }

    try {
      return localStorage.getItem(DEV_MODE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }

  private saveDevMode() {
    if (!this.devMapAuthoring) {
      return;
    }

    localStorage.setItem(DEV_MODE_STORAGE_KEY, this.devMode ? "true" : "false");
  }

  private toggleDevMode() {
    if (!this.devMapAuthoring) {
      return;
    }

    this.devMode = !this.devMode;
    this.saveDevMode();
    this.normalizeSelectionsForUnlocks();
    this.populateMapSelect();
    this.updateBattleSettingsControls();
    this.renderCampaignMapPanel();
    this.renderLobbyPanel();
    this.renderBuildPanel();
    this.setStatus(
      this.devMode ? "Dev mode enabled: all levels and max tower power" : "Dev mode disabled",
      1600,
    );
  }

  private setSelectedUnitAutoMove() {
    const selected = this.hud.autoMoveSelect?.value;
    if (!selected || !this.isAutoMoveMode(selected) || !this.selectedUnit || this.selectedUnit.team !== "angel") {
      return;
    }

    this.selectedUnit.autoMoveMode = selected;
    this.selectedUnit.autoMoveRetargetMs = 0;
    if (selected === "manual") {
      this.clearUnitDestination(this.selectedUnit);
      this.setStatus("Manual movement", 900);
    } else {
      this.assignAutoMoveDestination(this.selectedUnit, true);
      this.setStatus(`${AUTO_MOVE_OPTIONS.find((option) => option.mode === selected)?.label ?? "Auto Move"} enabled`, 1000);
    }
    this.updateHud();
  }

  private formatBattleSpeed(speed: number) {
    if (speed === 0) {
      return "Pause";
    }

    return `${Number.isInteger(speed) ? speed.toFixed(0) : speed.toFixed(1)}x`;
  }

  private currentDifficulty() {
    return DIFFICULTY_MODES[this.difficultyMode];
  }

  private currentWaves() {
    const waves = MAP_WAVES[this.activeMapId];
    if (this.tutorialBattleActive) {
      return TUTORIAL_WAVES;
    }
    if (this.waveLimitMode === "all") {
      return waves;
    }

    return waves.slice(0, clamp(Number(this.waveLimitMode), 1, waves.length));
  }

  private loadCampaignProgress(): CampaignProgress {
    try {
      const raw = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
      if (!raw) {
        return this.emptyCampaignProgress();
      }

      const parsed = JSON.parse(raw) as Partial<CampaignProgress> & { favor?: number };
      const completedMaps: Partial<Record<MapId, boolean>> = {};
      for (const id of MAP_ORDER) {
        if (parsed.completedMaps?.[id]) {
          completedMaps[id] = true;
        }
      }
      const completedLevels: Record<string, boolean> = {};
      if (parsed.completedLevels && typeof parsed.completedLevels === "object") {
        for (const level of this.currentCampaignMountainLevels()) {
          if (parsed.completedLevels[level.id]) {
            completedLevels[level.id] = true;
          }
        }
      }
      const purchasedTowers: Partial<Record<TowerKind, boolean>> = {};
      const towerLevels: Partial<Record<TowerKind, number>> = {};
      for (const kind of Object.keys(TOWER_TYPES) as TowerKind[]) {
        if (parsed.purchasedTowers?.[kind]) {
          purchasedTowers[kind] = true;
        }
        const level = parsed.towerLevels?.[kind];
        if (typeof level === "number" && Number.isFinite(level)) {
          towerLevels[kind] = clamp(Math.floor(level), 1, TOWER_MAX_LEVEL);
        }
      }
      const claimedCoreObjectives: Record<string, boolean> = {};
      if (parsed.claimedCoreObjectives && typeof parsed.claimedCoreObjectives === "object") {
        for (const [key, value] of Object.entries(parsed.claimedCoreObjectives)) {
          if (value) {
            claimedCoreObjectives[key] = true;
          }
        }
      }
      return {
        highestUnlockedIndex: clamp(Math.floor(parsed.highestUnlockedIndex ?? 0), 0, MAP_ORDER.length - 1),
        highestUnlockedLevelIndex: clamp(
          Math.floor(parsed.highestUnlockedLevelIndex ?? parsed.highestUnlockedIndex ?? 0),
          0,
          this.currentCampaignMountainLevels().length - 1,
        ),
        completedMaps,
        completedLevels,
        radiance: Math.max(0, Math.floor(parsed.radiance ?? parsed.favor ?? 0)),
        sanctumCores: Math.max(0, Math.floor(parsed.sanctumCores ?? 0)),
        purchasedTowers,
        towerLevels,
        claimedCoreObjectives,
      };
    } catch {
      return this.emptyCampaignProgress();
    }
  }

  private saveCampaignProgress() {
    localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(this.campaignProgress));
  }

  private resetCampaignProgress() {
    this.campaignProgress = this.emptyCampaignProgress();
    this.activeCampaignLevelIndex = 0;
    this.activeMapId = DEFAULT_MAP_ID;
    this.map = this.loadMapLayout(this.activeMapId);
    this.pendingContinueMapId = null;
    this.pendingContinueLevelIndex = null;
    this.saveCampaignProgress();
  }

  private isMapUnlocked(id: MapId) {
    if (this.devMode) {
      return true;
    }

    return CAMPAIGN_CHAPTERS[id].index <= this.campaignProgress.highestUnlockedIndex;
  }

  private firstUnlockedMap() {
    return MAP_ORDER.find((id) => this.isMapUnlocked(id)) ?? DEFAULT_MAP_ID;
  }

  private ensureActiveMapUnlocked() {
    if (this.isMapUnlocked(this.activeMapId)) {
      return;
    }

    this.activeMapId = this.firstUnlockedMap();
    this.map = this.loadMapLayout(this.activeMapId);
  }

  private unlockedTowerKinds() {
    if (this.devMode) {
      return Object.keys(TOWER_TYPES) as TowerKind[];
    }

    const unlocked = new Set<TowerKind>();
    for (const kind of Object.keys(TOWER_TYPES) as TowerKind[]) {
      if (this.campaignProgress.purchasedTowers[kind]) {
        unlocked.add(kind);
      }
    }
    for (const id of MAP_ORDER) {
      const chapter = CAMPAIGN_CHAPTERS[id];
      if (chapter.index <= this.campaignProgress.highestUnlockedIndex) {
        for (const kind of chapter.unlocks.towers) {
          unlocked.add(kind);
        }
      }
    }
    return (Object.keys(TOWER_TYPES) as TowerKind[]).filter((kind) => unlocked.has(kind));
  }

  private unlockedHostKinds() {
    if (this.devMode) {
      return Object.keys(HOST_TYPES) as HostKind[];
    }

    const unlocked = new Set<HostKind>();
    for (const id of MAP_ORDER) {
      const chapter = CAMPAIGN_CHAPTERS[id];
      if (chapter.index <= this.campaignProgress.highestUnlockedIndex) {
        for (const kind of chapter.unlocks.hosts) {
          unlocked.add(kind);
        }
      }
    }
    return (Object.keys(HOST_TYPES) as HostKind[]).filter((kind) => unlocked.has(kind));
  }

  private isTowerUnlocked(kind: TowerKind) {
    return this.unlockedTowerKinds().includes(kind);
  }

  private isHostUnlocked(kind: HostKind) {
    return this.unlockedHostKinds().includes(kind);
  }

  private isPurifyUnlocked() {
    if (this.devMode) {
      return true;
    }

    return MAP_ORDER.some((id) => {
      const chapter = CAMPAIGN_CHAPTERS[id];
      return chapter.index <= this.campaignProgress.highestUnlockedIndex && chapter.unlocks.ability;
    });
  }

  private normalizeSelectionsForUnlocks() {
    const towers = this.unlockedTowerKinds();
    const hosts = this.unlockedHostKinds();
    if (!this.selectedTowerKind || !towers.includes(this.selectedTowerKind)) {
      this.selectedTowerKind = towers[0] ?? null;
    }
    if (!this.selectedHostKind || !hosts.includes(this.selectedHostKind)) {
      this.selectedHostKind = hosts[0] ?? null;
    }
    if (!this.isPurifyUnlocked()) {
      this.purifyMode = false;
    }
  }

  private unlockChapterName(kind: TowerKind | HostKind, category: "tower" | "host") {
    const mapId = MAP_ORDER.find((id) => {
      const unlocks = CAMPAIGN_CHAPTERS[id].unlocks;
      const towers = unlocks.towers as readonly TowerKind[];
      const hosts = unlocks.hosts as readonly HostKind[];
      return category === "tower"
        ? towers.includes(kind as TowerKind)
        : hosts.includes(kind as HostKind);
    });
    return mapId ? MAPS[mapId].name : "the campaign";
  }

  private formatChapterUnlocks(id: MapId) {
    const chapter = CAMPAIGN_CHAPTERS[id];
    const tools = [
      ...chapter.unlocks.towers.map((kind) => TOWER_TYPES[kind].name),
      ...chapter.unlocks.hosts.map((kind) => HOST_TYPES[kind].name),
      chapter.unlocks.ability ? "Purify Corruption" : null,
    ].filter(Boolean);
    const threats = chapter.unlocks.enemies.map((kind) => ENEMY_TYPES[kind].name);
    const toolText = tools.length > 0 ? `Unlocked: ${tools[0]}.` : "";
    const threatText = threats.length > 0 ? `Next threat: ${threats[0]}.` : "";
    return [toolText, threatText].filter(Boolean).join(" ");
  }

  private completeCurrentChapter(): CampaignVictorySummary {
    const completedLevel = this.activeCampaignLevel();
    const completedMapId = completedLevel.mapId;
    const nextLevel = this.currentCampaignMountainLevels()[completedLevel.index + 1] ?? null;
    const nextMapId = nextLevel?.mapId ?? null;
    const firstClear = !this.campaignProgress.completedLevels[completedLevel.id];
    const newlyUnlocked = Boolean(
      nextLevel && this.campaignProgress.highestUnlockedLevelIndex <= completedLevel.index,
    );
    const reward = this.calculateVictoryRewards(completedLevel.id, firstClear, completedLevel.index);
    this.campaignProgress = {
      highestUnlockedIndex: nextMapId
        ? Math.max(this.campaignProgress.highestUnlockedIndex, CAMPAIGN_CHAPTERS[nextMapId].index)
        : this.campaignProgress.highestUnlockedIndex,
      highestUnlockedLevelIndex: nextLevel
        ? Math.max(this.campaignProgress.highestUnlockedLevelIndex, nextLevel.index)
        : this.campaignProgress.highestUnlockedLevelIndex,
      completedMaps: {
        ...this.campaignProgress.completedMaps,
        [completedMapId]: true,
      },
      completedLevels: {
        ...this.campaignProgress.completedLevels,
        [completedLevel.id]: true,
      },
      radiance: this.campaignProgress.radiance + reward.radianceEarned,
      sanctumCores: this.campaignProgress.sanctumCores + reward.sanctumCoresEarned,
      purchasedTowers: { ...this.campaignProgress.purchasedTowers },
      towerLevels: { ...this.campaignProgress.towerLevels },
      claimedCoreObjectives: reward.claimedCoreObjectives,
    };
    this.saveCampaignProgress();
    this.populateMapSelect();
    this.normalizeSelectionsForUnlocks();
    this.pendingContinueMapId = nextMapId;
    this.pendingContinueLevelIndex = nextLevel?.index ?? null;
    if (nextLevel) {
      this.activeCampaignLevelIndex = nextLevel.index;
    }
    return {
      completedMapId,
      completedLevelTitle: completedLevel.title,
      nextMapId,
      nextLevelTitle: nextLevel?.title ?? null,
      nextLevelStory: nextLevel?.story ?? null,
      newlyUnlocked,
      ...reward,
    };
  }

  private calculateVictoryRewards(completedLevelId: string, firstClear: boolean, mountainLevelIndex: number) {
    const gatePercent = clamp(this.gateHp / this.map.gate.maxHp, 0, 1);
    const gatePercentLabel = `${Math.round(gatePercent * 100)}%`;
    const battleTimeLabel = this.formatBattleTime(this.battleElapsedMs);
    const speedBonus = this.battleElapsedMs <= 180000 ? 25 : this.battleElapsedMs <= 240000 ? 12 : 0;
    const gateBonus = Math.round(gatePercent * 60);
    const noTowerLossBonus = this.towersDestroyedThisBattle === 0 ? 20 : 0;
    const chapterBonus = mountainLevelIndex * 12;
    const radianceRewards: VictoryRewardLine[] = [
      {
        label: "Victory",
        metric: "Battle cleared",
        reward: `+${BASE_RADIANCE_REWARD} Radiance`,
        amount: BASE_RADIANCE_REWARD,
        currency: "radiance",
        progress: 1,
        achieved: true,
      },
      {
        label: "Chapter depth",
        metric: `Mountain level ${mountainLevelIndex + 1}`,
        reward: `+${chapterBonus} Radiance`,
        amount: chapterBonus,
        currency: "radiance",
        progress: mountainLevelIndex / Math.max(1, this.currentCampaignMountainLevels().length - 1),
        achieved: chapterBonus > 0,
      },
      {
        label: "Gate health",
        metric: `${gatePercentLabel} gate HP`,
        reward: `+${gateBonus} Radiance`,
        amount: gateBonus,
        currency: "radiance",
        progress: gatePercent,
        achieved: gateBonus > 0,
      },
      {
        label: "Clear speed",
        metric: `${battleTimeLabel} / 3:00 par`,
        reward: `+${speedBonus} Radiance`,
        amount: speedBonus,
        currency: "radiance",
        progress: clamp(1 - this.battleElapsedMs / 240000, 0, 1),
        achieved: speedBonus > 0,
      },
      {
        label: "Towers intact",
        metric: this.towersDestroyedThisBattle === 0 ? "No towers destroyed" : `${this.towersDestroyedThisBattle} destroyed`,
        reward: `+${noTowerLossBonus} Radiance`,
        amount: noTowerLossBonus,
        currency: "radiance",
        progress: this.towersDestroyedThisBattle === 0 ? 1 : 0,
        achieved: noTowerLossBonus > 0,
      },
    ];
    const radianceEarned = radianceRewards.reduce((sum, line) => sum + line.amount, 0);
    const claimedCoreObjectives = { ...this.campaignProgress.claimedCoreObjectives };
    const coreReasons: string[] = [];
    const coreObjectives: VictoryRewardLine[] = [];

    const evaluateCore = (key: string, label: string, reason: string, metric: string, progress: number, achieved: boolean) => {
      const alreadyClaimed = Boolean(claimedCoreObjectives[key]);
      const earnedNow = achieved && !alreadyClaimed;
      if (earnedNow) {
        claimedCoreObjectives[key] = true;
        coreReasons.push(reason);
      }
      coreObjectives.push({
        label,
        metric,
        reward: earnedNow ? "+1 Sanctum Core" : alreadyClaimed ? "Already claimed" : "Incomplete",
        amount: earnedNow ? 1 : 0,
        currency: "core",
        progress: clamp(progress, 0, 1),
        achieved,
        earnedNow,
        alreadyClaimed,
      });
    };

    evaluateCore(
      `${completedLevelId}:first-clear`,
      "First clear",
      "first clear",
      firstClear ? "First victory" : "Cleared before",
      1,
      firstClear,
    );
    evaluateCore(
      `${completedLevelId}:gate-90`,
      "Gate guardian",
      "gate above 90%",
      `${gatePercentLabel} / 90% gate HP`,
      gatePercent / 0.9,
      gatePercent >= 0.9,
    );
    if (mountainLevelIndex >= 4 || claimedCoreObjectives[`${completedLevelId}:no-tower-loss`]) {
      evaluateCore(
        `${completedLevelId}:no-tower-loss`,
        "No tower loss",
        "no towers destroyed",
        this.towersDestroyedThisBattle === 0 ? "No towers destroyed" : `${this.towersDestroyedThisBattle} destroyed`,
        this.towersDestroyedThisBattle === 0 ? 1 : 0,
        this.towersDestroyedThisBattle === 0,
      );
    }

    return {
      radianceEarned,
      sanctumCoresEarned: coreReasons.length,
      coreReasons,
      radianceRewards,
      coreObjectives,
      claimedCoreObjectives,
    };
  }

  private formatBattleTime(ms: number) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  private unitDamage(unit: Unit, damage: number) {
    return damage * (unit.team === "angel" ? this.currentDifficulty().angelDamageMultiplier : this.currentDifficulty().enemyDamageMultiplier);
  }

  private towerDamage(damage: number) {
    return damage * this.currentDifficulty().towerDamageMultiplier;
  }

  private enemyDamage(damage: number) {
    return damage * this.currentDifficulty().enemyDamageMultiplier;
  }

  private updateAudioButton() {
    if (!this.hud.audioButton) {
      return;
    }

    this.hud.audioButton.classList.toggle("active", this.audio.isEnabled);
    this.hud.audioButton.setAttribute("aria-checked", this.audio.isEnabled ? "true" : "false");
    const label = this.hud.audioButton.querySelector(".switch-label");
    if (label) {
      label.textContent = this.audio.isEnabled ? "Audio On" : "Audio Off";
    } else {
      this.hud.audioButton.textContent = this.audio.isEnabled ? "Audio On" : "Audio Off";
    }
  }

  private updatePauseButton() {
    if (!this.hud.pauseButton) {
      if (this.hud.battleSpeedSelect) {
        this.hud.battleSpeedSelect.value = this.isPaused ? "0" : String(this.battleSpeed);
      }
      return;
    }

    this.hud.pauseButton.classList.toggle("active", this.isPaused);
    this.hud.pauseButton.setAttribute("aria-pressed", this.isPaused ? "true" : "false");
    this.hud.pauseButton.setAttribute("aria-label", this.isPaused ? "Resume" : "Pause");
    this.hud.pauseButton.title = this.isPaused ? "Resume" : "Pause";
    const label = this.hud.pauseButton.querySelector("span");
    if (label) {
      label.textContent = this.isPaused ? "Resume" : "Pause";
    }
  }

  private toggleSettingsMenu() {
    const menu = this.hud.settingsMenu;
    const toggle = this.hud.settingsToggleButton;
    if (!menu || !toggle) {
      return;
    }

    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    toggle.classList.toggle("active", willOpen);
    toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
    if (willOpen) {
      this.closeBuildOverlay();
    }
  }

  private closeSettingsMenu() {
    if (this.hud.settingsMenu) {
      this.hud.settingsMenu.hidden = true;
    }
    if (this.hud.settingsToggleButton) {
      this.hud.settingsToggleButton.classList.remove("active");
      this.hud.settingsToggleButton.setAttribute("aria-expanded", "false");
    }
  }

  private openBuildOverlay() {
    if (this.hud.buildOverlay) {
      this.hud.buildOverlay.hidden = false;
    }
    this.closeSettingsMenu();
    this.updateBuildOverlayControls();
    this.updatePedestalLabelVisibility();
  }

  private closeBuildOverlay() {
    if (this.hud.buildOverlay) {
      this.hud.buildOverlay.hidden = true;
    }
    this.updateBuildOverlayControls();
    this.updatePedestalLabelVisibility();
    this.setCanvasCursor("default");
  }

  private closeSelectedOverlay() {
    if (this.hud.selectedOverlay) {
      this.hud.selectedOverlay.hidden = true;
    }
  }

  private openSelectedOverlay() {
    if (this.menuOpen || this.guideOpen || (!this.selectedUnit && !this.selectedTower)) {
      return;
    }
    if (this.hud.selectedOverlay) {
      this.hud.selectedOverlay.hidden = false;
    }
    this.closeBuildOverlay();
    this.closeSettingsMenu();
    this.updateHud();
  }

  private updateBuildOverlayControls() {
    if (this.hud.buildOverlayTitle) {
      this.hud.buildOverlayTitle.textContent = BUILD_MODE_LABELS[this.buildMode];
    }
    const isOpen = !this.hud.buildOverlay?.hidden;
    this.hud.towersPanel?.classList.toggle("tutorial-pulse", this.combatTutorialStep === "buildTower" && !isOpen);
    this.hud.towersPanel?.setAttribute("aria-expanded", isOpen && this.buildMode === "towers" ? "true" : "false");
    this.hud.hostsPanel?.setAttribute("aria-expanded", isOpen && this.buildMode === "hosts" ? "true" : "false");
    this.hud.abilityPanel?.setAttribute("aria-expanded", isOpen && this.buildMode === "ability" ? "true" : "false");
  }

  private setBuildMode(mode: BuildMode, showOverlay = false) {
    this.buildMode = mode;
    this.purifyMode = false;
    this.statusOverrideMs = 0;
    if (showOverlay) {
      this.openBuildOverlay();
    }
    this.renderBuildPanel();
    this.updateBuildOverlayControls();
    this.updateHud();
  }

  private toggleBuildMode(mode: BuildMode) {
    const overlayOpen = !this.hud.buildOverlay?.hidden;
    if (overlayOpen && this.buildMode === mode) {
      this.closeBuildOverlay();
      return;
    }
    this.setBuildMode(mode, true);
  }

  private toggleMapEditMode() {
    if (!this.devMapAuthoring) {
      this.mapEditMode = false;
      this.setStatus("Map editing is available only in local dev builds", 1400);
      this.updateMapEditorControls();
      return;
    }

    this.mapEditMode = !this.mapEditMode;
    this.editorDragTarget = null;
    this.syncMapEditToolFromControl();
    this.purifyMode = false;
    this.statusOverrideMs = 0;
    this.renderEditorOverlay();
    this.renderBuildPanel();
    this.updateMapEditorControls();
    this.updateHud();
  }

  private updateMapEditorControls() {
    if (!this.devMapAuthoring) {
      if (this.hud.mapEditButton) {
        this.hud.mapEditButton.hidden = true;
      }
      if (this.hud.mapEditorPanel) {
        this.hud.mapEditorPanel.hidden = true;
      }
      this.mapEditMode = false;
      return;
    }

    if (this.hud.mapEditButton) {
      this.hud.mapEditButton.hidden = false;
    }
    this.hud.mapEditButton?.classList.toggle("active", this.mapEditMode);
    if (this.hud.mapEditButton) {
      this.hud.mapEditButton.textContent = this.mapEditMode ? "Exit Edit" : "Map Edit";
    }
    if (this.hud.mapEditorPanel) {
      this.hud.mapEditorPanel.hidden = !this.mapEditMode;
    }
    if (this.hud.mapEditTool) {
      this.hud.mapEditTool.value = this.mapEditTool;
    }
    this.selectedSlotIndex = clamp(this.selectedSlotIndex, 0, Math.max(0, this.map.towerSlots.length - 1));
    const editingPath = this.mapEditMode && this.mapEditTool === "path";
    const editingSlots = this.mapEditMode && this.mapEditTool === "towerSlots";
    const selectedSlotHasTower = this.towers.some((tower) => tower.slotIndex === this.selectedSlotIndex);
    if (this.hud.addPathPointButton) {
      this.hud.addPathPointButton.textContent = editingSlots ? "Add Base" : "Insert Point";
      this.hud.addPathPointButton.disabled = !editingPath && !editingSlots;
    }
    if (this.hud.addSidePathButton) {
      this.hud.addSidePathButton.hidden = !editingPath;
      this.hud.addSidePathButton.disabled = !editingPath;
    }
    if (this.hud.removePathPointButton) {
      const selectedPath = this.selectedEditablePath();
      const selectedCanRemove = Boolean(
        editingPath &&
          selectedPath &&
          (this.selectedPathGroup === "side" ||
            (this.selectedPathIndex > 0 && this.selectedPathIndex < selectedPath.length - 1 && selectedPath.length > 2)),
      );
      this.hud.removePathPointButton.textContent = editingSlots ? "Remove Base" : "Remove Point";
      this.hud.removePathPointButton.disabled = editingSlots ? this.map.towerSlots.length === 0 : !selectedCanRemove;
    }
    if (this.hud.mapEditTowerKind) {
      this.hud.mapEditTowerKind.value = this.selectedTowerKind ?? "lightspire";
      this.hud.mapEditTowerKind.disabled = !editingSlots;
    }
    if (this.hud.addEditorTowerButton) {
      this.hud.addEditorTowerButton.textContent = selectedSlotHasTower ? "Replace Tower" : "Add Tower";
      this.hud.addEditorTowerButton.disabled = !editingSlots || this.map.towerSlots.length === 0 || !this.selectedTowerKind;
    }
    if (this.hud.copyMapButton) {
      this.hud.copyMapButton.textContent = "Save Source";
      this.hud.copyMapButton.title = "Write this map layout to src/game/mapLayoutOverrides.ts";
    }
    this.updateMapScrollControls();
  }

  private syncMapEditToolFromControl() {
    const tool = this.hud.mapEditTool?.selectedOptions[0]?.value ?? this.hud.mapEditTool?.value;
    if ((tool === "towerSlots" || tool === "path" || tool === "gate") && tool !== this.mapEditTool) {
      this.mapEditTool = tool;
      return true;
    }
    return false;
  }

  private updateMapScrollControls() {
    const maxCameraX = this.maxCameraX();
    const maxCameraY = this.maxCameraY();
    if (this.hud.scrollLeftButton) {
      this.hud.scrollLeftButton.disabled = maxCameraX <= 0 || this.cameraX <= 0;
    }
    if (this.hud.scrollRightButton) {
      this.hud.scrollRightButton.disabled = maxCameraX <= 0 || this.cameraX >= maxCameraX;
    }
    if (this.hud.scrollUpButton) {
      this.hud.scrollUpButton.disabled = maxCameraY <= 0 || this.cameraY <= 0;
    }
    if (this.hud.scrollDownButton) {
      this.hud.scrollDownButton.disabled = maxCameraY <= 0 || this.cameraY >= maxCameraY;
    }
  }

  private applyMapEditChange() {
    this.map.path = this.map.paths[0];
    if (this.selectedPathGroup === "side" && !this.map.sidePaths[this.selectedPathRouteIndex]) {
      this.selectedPathGroup = "lane";
      this.selectedPathRouteIndex = 0;
      this.selectedPathIndex = 0;
    }
    this.redrawMapLayer();
    this.syncTowersToSlots();
    this.renderEditorOverlay();
    this.layout();
    this.updateMapEditorControls();
    this.updateMinimap();
    this.updateHud();
  }

  private beginPurify() {
    if (!this.isPurifyUnlocked()) {
      this.purifyMode = false;
      this.setStatus("Purify is still locked", 1400);
      this.renderBuildPanel();
      return;
    }
    if (this.energy < PURIFY_COST) {
      this.setStatus(`Need ${PURIFY_COST} energy`, 1400);
      return;
    }

    this.purifyMode = !this.purifyMode;
    this.statusOverrideMs = 0;
    this.renderBuildPanel();
    this.updateHud();
  }

  private getBuildPanelStateKey() {
    return [
      this.buildMode,
      this.selectedTowerKind ?? "none",
      this.selectedHostKind ?? "none",
      [...this.deployedSpecialAngels].sort().join(",") || "no-specials",
      this.difficultyMode,
      this.purifyMode ? "purify" : "ready",
      this.mapEditMode ? "editing" : "playing",
      this.menuOpen ? "menu" : "battle",
      this.guideOpen ? "guide" : "field",
      this.battleState,
      this.devMode ? "dev-mode" : "campaign-mode",
      `chapter-${this.campaignProgress.highestUnlockedIndex}`,
      Math.floor(this.energy),
    ].join(":");
  }

  private renderBuildPanel() {
    this.normalizeSelectionsForUnlocks();
    this.buildPanelStateKey = this.getBuildPanelStateKey();
    this.hud.towersPanel?.classList.toggle("active", this.buildMode === "towers");
    this.hud.hostsPanel?.classList.toggle("active", this.buildMode === "hosts");
    this.hud.abilityPanel?.classList.toggle("active", this.buildMode === "ability");
    this.updatePauseButton();
    this.updateBuildOverlayControls();
    this.updateMapEditorControls();

    if (!this.hud.buildList || !this.hud.buildDetail) {
      return;
    }

    this.hud.buildList.replaceChildren();

    if (this.buildMode === "towers") {
      for (const [kind, tower] of Object.entries(TOWER_TYPES) as [TowerKind, (typeof TOWER_TYPES)[TowerKind]][]) {
        const locked = !this.isTowerUnlocked(kind);
        const button = this.createBuildButton({
          name: tower.name,
          cost: tower.cost,
          imageSrc: tower.texture,
          accentColor: tower.color,
          active: this.selectedTowerKind === kind,
          affordable: !locked && this.energy >= tower.cost,
          locked,
          onClick: () => {
            this.selectedTowerKind = kind;
            this.purifyMode = false;
            this.renderBuildPanel();
            this.updateHud();
          },
        });
        if (locked) {
          button.title = `Unlocks at ${this.unlockChapterName(kind, "tower")}`;
        }
        this.hud.buildList.appendChild(button);
      }

      const selected = this.selectedTowerKind ? TOWER_TYPES[this.selectedTowerKind] : null;
      const beamStats =
        selected && "beamDurationMs" in selected
          ? ` Beam ${(selected.beamDurationMs / 1000).toFixed(1)}s. Width ${selected.beamWidth}.`
          : "";
      const damageStats = selected && selected.damage > 0 ? ` Damage ${Math.round(this.towerDamage(selected.damage))}.` : "";
      this.renderBuildDetail(
        selected
          ? {
              imageSrc: selected.texture,
              accentColor: selected.color,
              text: `${selected.name}: ${selected.description} Cost ${selected.cost} energy. Range ${this.towerRangeLabel(selected.innerRange, selected.range)}.${damageStats}${beamStats} Builds Tension by acting; release a charged Tension Burst from the selected tower. Build on an empty pedestal.`,
            }
          : { text: "Choose a tower, then click an empty pedestal." },
      );
      return;
    }

    if (this.buildMode === "hosts") {
      for (const [kind, host] of Object.entries(HOST_TYPES) as [HostKind, (typeof HOST_TYPES)[HostKind]][]) {
        const locked = !this.isHostUnlocked(kind);
        const deployed = this.specialAngelDeployed(kind);
        const button = this.createBuildButton({
          name: host.name,
          cost: host.cost,
          costLabel: deployed ? "Deployed" : undefined,
          imageSrc: this.hostSpriteImage(kind, "idle"),
          accentColor: host.tint,
          active: this.selectedHostKind === kind,
          affordable: !locked && !deployed && this.energy >= host.cost,
          locked,
          disabled: deployed,
          onClick: () => {
            this.selectedHostKind = kind;
            this.purifyMode = false;
            this.renderBuildPanel();
            this.updateHud();
          },
        });
        if (locked) {
          button.title = `Unlocks at ${this.unlockChapterName(kind, "host")}`;
        } else if (deployed) {
          button.title = `${host.name} has already deployed this battle.`;
        }
        this.hud.buildList.appendChild(button);
      }

      const selected = this.selectedHostKind ? HOST_TYPES[this.selectedHostKind] : null;
      const selectedIsSpecial = this.selectedHostKind ? this.isSpecialHostKind(this.selectedHostKind) : false;
      const selectedDeployed = this.selectedHostKind ? this.specialAngelDeployed(this.selectedHostKind) : false;
      const tensionText = selectedIsSpecial
        ? selectedDeployed
          ? " This named angel has already deployed this battle."
          : " Special angel: deploys once per battle, moves, and builds Tension by acting."
        : " Regular unit: moves and does not build Tension.";
      this.renderBuildDetail(
        selected
          ? {
              imageSrc: this.hostSpriteImage(this.selectedHostKind ?? "host", "idle"),
              accentColor: selected.tint,
              text: `${selected.name}: ${selected.description} Cost ${selected.cost} energy. ${selected.role}. Deploy to any point on the path.${tensionText}`,
            }
          : { text: "Choose a host, then click any valid path point." },
      );
      return;
    }

    const purifyLocked = !this.isPurifyUnlocked();
    const button = this.createBuildButton({
      name: "Purify Corruption",
      cost: PURIFY_COST,
      imageSrc: this.hostSpriteImage("healer", "cast"),
      accentColor: 0xf5d77e,
      active: this.purifyMode && !purifyLocked,
      affordable: !purifyLocked && this.energy >= PURIFY_COST,
      locked: purifyLocked,
      onClick: () => this.beginPurify(),
    });
    this.hud.buildList.appendChild(button);
    this.renderBuildDetail({
      imageSrc: this.hostSpriteImage("healer", "cast"),
      accentColor: 0xf5d77e,
      text: purifyLocked
        ? "Purify unlocks after the first breach, when corruption casters begin targeting hosts."
        : this.purifyMode
          ? `Click an enemy or corrupted host to spend ${PURIFY_COST} energy and return it to the angel side.`
          : `Spend ${PURIFY_COST} energy to capture demons or reclaim corrupted hosts. Demon casters can corrupt hosts with projectiles.`,
    });
  }

  private createBuildButton(options: {
    name: string;
    cost: number;
    costLabel?: string;
    imageSrc?: string;
    accentColor?: number;
    active: boolean;
    affordable: boolean;
    locked?: boolean;
    disabled?: boolean;
    onClick: () => void;
  }) {
    const button = document.createElement("button");
    const buildUnavailable = this.battleState !== "playing" || this.mapEditMode || this.menuOpen || this.guideOpen;
    button.type = "button";
    button.classList.toggle("active", options.active);
    button.classList.toggle("locked", Boolean(options.locked));
    button.classList.toggle(
      "unavailable",
      !options.affordable || buildUnavailable || Boolean(options.locked) || Boolean(options.disabled),
    );
    button.disabled = buildUnavailable || Boolean(options.locked) || Boolean(options.disabled);

    if (options.accentColor !== undefined) {
      button.style.setProperty("--build-accent", colorToCss(options.accentColor));
    }

    if (options.imageSrc) {
      const thumb = document.createElement("span");
      thumb.className = "build-thumb";
      const image = document.createElement("img");
      image.src = options.imageSrc;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      thumb.appendChild(image);
      button.appendChild(thumb);
    }

    const name = document.createElement("span");
    name.className = "build-name";
    name.textContent = options.name;
    button.appendChild(name);

    const cost = document.createElement("span");
    cost.className = "build-cost";
    cost.textContent = options.costLabel ?? (options.locked ? "Locked" : String(options.cost));
    button.appendChild(cost);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (buildUnavailable || options.locked || options.disabled) {
        return;
      }
      this.startAudio();
      options.onClick();
    });
    return button;
  }

  private renderBuildDetail(options: { imageSrc?: string; accentColor?: number; text: string }) {
    if (!this.hud.buildDetail) {
      return;
    }

    this.hud.buildDetail.replaceChildren();
    if (options.accentColor !== undefined) {
      this.hud.buildDetail.style.setProperty("--build-accent", colorToCss(options.accentColor));
    }

    if (options.imageSrc) {
      const image = document.createElement("img");
      image.className = "build-detail-image";
      image.src = options.imageSrc;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      this.hud.buildDetail.appendChild(image);
    }

    const text = document.createElement("span");
    text.textContent = options.text;
    this.hud.buildDetail.appendChild(text);
  }

  private clearLayer(container: Container) {
    for (const child of container.removeChildren()) {
      child.destroy({ children: true });
    }
  }

  restart() {
    this.clearCombatTutorialHighlight();
    this.clearLayer(this.mapLayer);
    this.clearLayer(this.towerLayer);
    this.clearLayer(this.unitLayer);
    this.clearLayer(this.enemyLayer);
    this.clearLayer(this.projectileLayer);
    this.clearLayer(this.overlayLayer);
    this.clearLayer(this.editorLayer);
    this.clearLayer(this.gateHudLayer);

    this.units = [];
    this.selectedUnit = null;
    this.selectedTower = null;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.beams = [];
    this.shockwaves = [];
    this.unitId = 1;
    this.enemyId = 1;
    this.currentWaveIndex = 0;
    this.waveSpawned = 0;
    this.activeWaveName = "";
    this.activeWavePlan = [];
    this.spawnTimerMs = 0;
    this.betweenWaveTimerMs = 900;
    this.energy = this.currentDifficulty().startingEnergy;
    this.buildMode = "towers";
    this.selectedTowerKind = this.unlockedTowerKinds()[0] ?? null;
    this.selectedHostKind = this.unlockedHostKinds()[0] ?? null;
    this.deployedSpecialAngels = new Set();
    this.purifyMode = false;
    this.isPaused = false;
    this.normalizeSelectionsForUnlocks();
    this.buildPanelStateKey = "";
    this.statusOverrideMs = 0;
    this.gateHp = this.map.gate.maxHp;
    this.battleState = "playing";
    this.battleElapsedMs = 0;
    this.towersDestroyedThisBattle = 0;
    this.cameraX = clamp(this.cameraX, 0, this.maxCameraX());
    this.cameraY = clamp(this.cameraY, 0, this.maxCameraY());

    this.redrawMapLayer();
    const startingUnit = this.createUnit("host", this.map.startingUnit, false);
    this.units.push(startingUnit);
    this.unitLayer.addChild(startingUnit.container);
    this.selectUnit(startingUnit);
    if (this.hud.mapSelect) {
      this.hud.mapSelect.value = this.activeMapId;
    }
    this.renderEditorOverlay();
    this.renderBuildPanel();
    this.updateBattleSettingsControls();
    this.updateAudioButton();
    this.updatePauseButton();
    this.layout();
    this.updateHud();
    this.tutorialBattleActive = false;
    if (this.shouldStartCombatTutorial()) {
      this.beginCombatTutorial();
    } else {
      this.endCombatTutorial(false);
    }
  }

  private redrawMapLayer() {
    this.clearLayer(this.mapLayer);
    this.clearLayer(this.gateHudLayer);
    this.drawMap();
    this.createGate();
    this.drawPedestals();
  }

  private drawMap() {
    const bg = new Sprite(this.textures.maps[this.activeMapId]);
    bg.width = this.map.width;
    bg.height = this.map.height;
    this.mapLayer.addChild(bg);

    const mapTint = new Graphics()
      .rect(0, 0, this.map.width, this.map.height)
      .fill({ color: 0x05070b, alpha: 0.08 })
      .rect(24, 24, this.map.width - 48, this.map.height - 48)
      .stroke({ color: 0xffdf91, width: 2, alpha: 0.32 });
    this.mapLayer.addChild(mapTint);

    const pathShadow = new Graphics();
    for (const pathPoints of this.map.paths) {
      pathShadow.moveTo(pathPoints[0].x, pathPoints[0].y);
      for (const point of pathPoints.slice(1)) {
        pathShadow.lineTo(point.x, point.y);
      }
    }
    pathShadow.stroke({ color: 0x1b1620, width: 92, alpha: 0.18 });
    this.mapLayer.addChild(pathShadow);

    const path = new Graphics();
    for (const pathPoints of this.map.paths) {
      path.moveTo(pathPoints[0].x, pathPoints[0].y);
      for (const point of pathPoints.slice(1)) {
        path.lineTo(point.x, point.y);
      }
    }
    path.stroke({ color: 0x8ed8ff, width: 58, alpha: 0.1 });
    path.stroke({ color: 0xb28755, width: 5, alpha: 0.64 });
    this.mapLayer.addChild(path);

    const sidePath = new Graphics();
    for (const pathPoints of this.map.sidePaths) {
      if (pathPoints.length === 0) {
        continue;
      }
      sidePath.moveTo(pathPoints[0].x, pathPoints[0].y);
      for (const point of pathPoints.slice(1)) {
        sidePath.lineTo(point.x, point.y);
      }
    }
    sidePath.stroke({ color: 0x75e8ff, width: 42, alpha: 0.08 });
    sidePath.stroke({ color: 0x75e8ff, width: 3, alpha: 0.48 });
    this.mapLayer.addChild(sidePath);
  }

  private createGate() {
    this.gateGraphic = new Graphics();
    this.gateHpGraphic = new Graphics();
    this.gateHpFrameSprite = new Sprite(this.textures.ui.gateHpGauge);
    this.gateHpFrameSprite.anchor.set(0.5);
    this.mapLayer.addChild(this.gateGraphic);
    this.drawGate();
  }

  private gateGaugeWidth() {
    const screenWidth = Math.max(1, this.app.screen.width);
    const rightClearance = screenWidth >= 720 ? GATE_GAUGE_RIGHT_CLEARANCE : 24;
    const responsiveMaxWidth = screenWidth < 1100 ? 300 : GATE_GAUGE_MAX_WIDTH;
    const maxWidth = Math.max(220, Math.min(responsiveMaxWidth, screenWidth - rightClearance - 36));
    return clamp(screenWidth * 0.42, Math.min(GATE_GAUGE_MIN_WIDTH, maxWidth), maxWidth);
  }

  private gateHudSafeHeight() {
    return TOP_HUD_RESERVED_HEIGHT + GATE_HUD_MARGIN;
  }

  private layoutMetrics() {
    const screenWidth = Math.max(1, this.app.screen.width);
    const screenHeight = Math.max(1, this.app.screen.height);
    const baseScale = Math.min(screenWidth / DESIGN_WIDTH, screenHeight / DESIGN_HEIGHT);
    const baseTop = (screenHeight - DESIGN_HEIGHT * baseScale) / 2;
    const safeHeight = this.gateHudSafeHeight();

    if (baseTop >= safeHeight) {
      return {
        scale: baseScale,
        left: (screenWidth - DESIGN_WIDTH * baseScale) / 2,
        top: baseTop,
      };
    }

    const availableHeight = Math.max(280, screenHeight - safeHeight);
    const scale = Math.min(screenWidth / DESIGN_WIDTH, availableHeight / DESIGN_HEIGHT);
    return {
      scale,
      left: (screenWidth - DESIGN_WIDTH * scale) / 2,
      top: safeHeight,
    };
  }

  private worldTopForLayout() {
    return this.layoutMetrics().top;
  }

  private gateGaugeLayout() {
    const screenWidth = Math.max(1, this.app.screen.width);
    const screenHeight = Math.max(1, this.app.screen.height);
    const rightClearance = screenWidth >= 720 ? GATE_GAUGE_RIGHT_CLEARANCE : 24;
    const width = this.gateGaugeWidth();
    const height = width / GATE_GAUGE_ASPECT;
    const worldTop = this.worldTopForLayout();
    const preferredY = TOP_HUD_RESERVED_HEIGHT + GATE_HUD_MARGIN + height / 2;
    const availableTop = Math.max(TOP_HUD_RESERVED_HEIGHT + height + GATE_HUD_MARGIN * 2, worldTop);
    const y = clamp(preferredY, height / 2 + GATE_HUD_MARGIN, Math.min(availableTop, screenHeight - height / 2 - GATE_HUD_MARGIN));
    const x = screenWidth >= 720 ? (screenWidth - rightClearance) / 2 : screenWidth / 2;

    return { x, y, width, height };
  }

  private drawGate() {
    const gate = this.map.gate;
    const hpPercent = clamp(this.gateHp / gate.maxHp, 0, 1);
    const gauge = this.gateGaugeLayout();
    const fillWidth = gauge.width * 0.62;
    const fillHeight = gauge.height * 0.2;
    const fillX = gauge.x - fillWidth / 2;
    const fillY = gauge.y - fillHeight / 2 + gauge.height * 0.02;
    const gateCenterX = gate.x + gate.width / 2;
    const gateCenterY = gate.y + gate.height / 2;
    this.gateGraphic
      .clear()
      .circle(gateCenterX, gateCenterY, Math.max(18, gate.width * 0.45))
      .stroke({ color: 0xf3d685, width: 2, alpha: 0.32 })
      .moveTo(gateCenterX, gateCenterY - 20)
      .lineTo(gateCenterX + 14, gateCenterY)
      .lineTo(gateCenterX, gateCenterY + 20)
      .lineTo(gateCenterX - 14, gateCenterY)
      .lineTo(gateCenterX, gateCenterY - 20)
      .fill({ color: hpPercent > 0.36 ? 0x8ed8ff : 0xe5685f, alpha: 0.34 })
      .stroke({ color: 0xffffff, width: 1, alpha: 0.38 });

    this.gateHpGraphic
      .clear()
      .roundRect(fillX, fillY, fillWidth, fillHeight, fillHeight / 2)
      .fill({ color: 0x152314, alpha: 0.84 })
      .roundRect(fillX, fillY, fillWidth * hpPercent, fillHeight, fillHeight / 2)
      .fill(hpPercent > 0.36 ? 0x55d96e : 0xdf6b61)
      .roundRect(fillX + 3, fillY + 3, Math.max(0, fillWidth * hpPercent - 6), fillHeight * 0.28, fillHeight / 2)
      .fill({ color: 0xc6ffd2, alpha: hpPercent > 0 ? 0.5 : 0 });

    if (this.gateHpFrameSprite) {
      this.gateHpFrameSprite.position.set(gauge.x, gauge.y);
      this.gateHpFrameSprite.width = gauge.width;
      this.gateHpFrameSprite.height = gauge.height;
    }
  }

  private drawPedestals() {
    this.pedestalLabels = [];
    for (const [index, slot] of this.map.towerSlots.entries()) {
      const pedestal = new Graphics()
        .ellipse(slot.x, slot.y, PEDESTAL_RADIUS, 44)
        .fill({ color: 0x132333, alpha: 0.34 })
        .ellipse(slot.x, slot.y, 42, 31)
        .stroke({ color: 0xf1d37a, width: 3, alpha: 0.52 })
        .ellipse(slot.x, slot.y, 55, 40)
        .stroke({ color: 0x8ed8ff, width: 1, alpha: 0.28 });
      this.mapLayer.addChild(pedestal);

      const label = new Text({
        text: `Pedestal ${index + 1}`,
        style: {
          fill: 0xd8eaff,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 12,
          fontWeight: "800",
          stroke: { color: 0x111111, width: 3 },
        },
      });
      label.anchor.set(0.5, 0);
      label.position.set(slot.x, slot.y + 38);
      label.visible = this.shouldShowPedestalLabels();
      this.mapLayer.addChild(label);
      this.pedestalLabels.push(label);
    }
  }

  private shouldShowPedestalLabels() {
    const activelyPlacingTower =
      !this.hud.buildOverlay?.hidden && this.buildMode === "towers" && Boolean(this.selectedTowerKind);
    const tutorialTowerPlacement = this.combatTutorialStep === "buildTower";
    return (
      this.battleState === "playing" &&
      !this.menuOpen &&
      !this.guideOpen &&
      !this.mapEditMode &&
      (activelyPlacingTower || tutorialTowerPlacement)
    );
  }

  private updatePedestalLabelVisibility() {
    const visible = this.shouldShowPedestalLabels();
    for (const label of this.pedestalLabels) {
      label.visible = visible;
    }
  }

  private renderEditorOverlay() {
    this.clearLayer(this.editorLayer);
    if (!this.mapEditMode) {
      return;
    }

    const pathGuide = new Graphics();
    for (const pathPoints of this.deploymentPaths()) {
      pathGuide.moveTo(pathPoints[0].x, pathPoints[0].y);
      for (const point of pathPoints.slice(1)) {
        pathGuide.lineTo(point.x, point.y);
      }
    }
    pathGuide.stroke({ color: 0xffffff, width: 7, alpha: 0.42 });
    pathGuide.stroke({ color: 0x75e8ff, width: 3, alpha: 0.78 });
    this.editorLayer.addChild(pathGuide);

    for (const [index, slot] of this.map.towerSlots.entries()) {
      const selected = this.mapEditTool === "towerSlots" && index === this.selectedSlotIndex;
      this.editorLayer.addChild(
        this.createEditorHandle({
          point: slot,
          color: 0xf1d37a,
          label: `${index + 1}`,
          selected,
          target: { type: "slot", index },
          enabled: this.mapEditTool === "towerSlots",
        }),
      );
    }

    for (const { group, pathId, path: pathPoints, label: routeLabel } of this.editablePathEntries()) {
      if (this.mapEditTool === "path") {
        for (let index = 0; index < pathPoints.length - 1; index += 1) {
          const start = pathPoints[index];
          const end = pathPoints[index + 1];
          this.editorLayer.addChild(
            this.createSegmentInsertHandle({
              point: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
              group,
              pathId,
              index,
            }),
          );
        }
      }
      for (const [index, point] of pathPoints.entries()) {
        const isStart = index === 0;
        const isEnd = group === "lane" && index === pathPoints.length - 1;
        const color = group === "side" ? 0x75e8ff : isStart ? 0xff4b65 : isEnd ? 0x91d18b : 0x8ed8ff;
        const selected =
          this.mapEditTool === "path" &&
          group === this.selectedPathGroup &&
          pathId === this.selectedPathRouteIndex &&
          index === this.selectedPathIndex;
        this.editorLayer.addChild(
          this.createEditorHandle({
            point,
            color,
            label: group === "side" ? `${routeLabel}.${index + 1}` : isStart ? `${routeLabel}S` : isEnd ? `${routeLabel}G` : `${routeLabel}${index + 1}`,
            selected,
            target: { type: "path", group, pathId, index },
            enabled: this.mapEditTool === "path",
          }),
        );
      }
    }

    const gate = this.map.gate;
    const gateBox = new Graphics()
      .roundRect(gate.x, gate.y, gate.width, gate.height, 8)
      .stroke({ color: 0x91d18b, width: 3, alpha: this.mapEditTool === "gate" ? 0.85 : 0.34 });
    this.editorLayer.addChild(gateBox);
    this.editorLayer.addChild(
      this.createEditorHandle({
        point: { x: gate.x + gate.width / 2, y: gate.y + gate.height / 2 },
        color: 0x91d18b,
        label: "Gate",
        selected: this.mapEditTool === "gate",
        target: { type: "gate" },
        enabled: this.mapEditTool === "gate",
      }),
    );
  }

  private createEditorHandle(options: {
    point: Point;
    color: number;
    label: string;
    selected: boolean;
    target: EditorDragTarget;
    enabled: boolean;
  }) {
    const container = new Container();
    container.position.set(options.point.x, options.point.y);
    container.eventMode = options.enabled ? "static" : "none";
    container.cursor = options.enabled ? "grab" : "default";

    const ring = new Graphics()
      .circle(0, 0, options.selected ? 19 : 15)
      .fill({ color: options.color, alpha: options.selected ? 0.36 : 0.2 })
      .circle(0, 0, options.selected ? 19 : 15)
      .stroke({ color: options.color, width: options.selected ? 4 : 2, alpha: options.enabled ? 0.92 : 0.42 })
      .circle(0, 0, 4)
      .fill({ color: 0xffffff, alpha: options.enabled ? 0.92 : 0.42 });
    const label = new Text({
      text: options.label,
      style: {
        fill: 0xffffff,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 11,
        fontWeight: "900",
        stroke: { color: 0x07080b, width: 3 },
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(0, -18);
    container.addChild(ring, label);

    container.on("pointerdown", (event) => {
      if (!options.enabled) {
        return;
      }
      event.stopPropagation();
      this.editorDragTarget = options.target;
      this.selectEditorTarget(options.target);
      this.updateMapEditorControls();
    });

    return container;
  }

  private createSegmentInsertHandle(options: { point: Point; group: PathGroup; pathId: number; index: number }) {
    const container = new Container();
    container.position.set(options.point.x, options.point.y);
    container.eventMode = "static";
    container.cursor = "copy";

    const marker = new Graphics()
      .circle(0, 0, 11)
      .fill({ color: 0x080b10, alpha: 0.72 })
      .circle(0, 0, 11)
      .stroke({ color: 0xffefd1, width: 2, alpha: 0.78 })
      .moveTo(-5, 0)
      .lineTo(5, 0)
      .moveTo(0, -5)
      .lineTo(0, 5)
      .stroke({ color: 0xffefd1, width: 2, alpha: 0.9 });

    container.addChild(marker);
    container.on("pointerdown", (event) => {
      event.stopPropagation();
      this.insertPathPointAtSegment(options, options.point, true);
    });
    return container;
  }

  private addPathPoint() {
    if (!this.mapEditMode) {
      return;
    }

    if (this.mapEditTool === "towerSlots") {
      this.addTowerSlot({
        x: this.cameraX + DESIGN_WIDTH / 2,
        y: this.cameraY + DESIGN_HEIGHT / 2,
      });
      this.setStatus("Tower base added", 1200);
      return;
    }

    if (this.mapEditTool !== "path") {
      return;
    }

    const path = this.selectedEditablePath();
    if (!path || path.length < 2) {
      return;
    }
    const startIndex = clamp(this.selectedPathIndex, 0, path.length - 2);
    const start = path[startIndex];
    const end = path[startIndex + 1];
    const point = {
      x: Math.round((start.x + end.x) / 2),
      y: Math.round((start.y + end.y) / 2),
    };
    path.splice(startIndex + 1, 0, point);
    this.selectedPathIndex = startIndex + 1;
    this.applyMapEditChange();
  }

  private insertPathPointAtSegment(
    segment: { group: PathGroup; pathId: number; index: number },
    point: Point,
    beginDrag = false,
  ) {
    const path = this.editablePath(segment.group, segment.pathId);
    if (!path || path.length < 2) {
      return;
    }

    const insertIndex = clamp(segment.index + 1, 1, path.length);
    const nextPoint = this.clampMapPoint({ x: Math.round(point.x), y: Math.round(point.y) });
    path.splice(insertIndex, 0, nextPoint);
    this.selectedPathGroup = segment.group;
    this.selectedPathRouteIndex = segment.pathId;
    this.selectedPathIndex = insertIndex;
    if (beginDrag) {
      this.editorDragTarget = {
        type: "path",
        group: segment.group,
        pathId: segment.pathId,
        index: insertIndex,
      };
    }
    this.applyMapEditChange();
    this.setStatus("Path point inserted", 1000);
  }

  private addSidePath() {
    if (!this.mapEditMode || this.mapEditTool !== "path") {
      return;
    }

    const center = this.clampMapPoint({
      x: this.cameraX + DESIGN_WIDTH / 2,
      y: this.cameraY + DESIGN_HEIGHT / 2,
    });
    const path = [
      this.clampMapPoint({ x: center.x - 130, y: center.y }),
      this.clampMapPoint({ x: center.x + 130, y: center.y }),
    ];
    this.map.sidePaths.push(path);
    this.selectedPathGroup = "side";
    this.selectedPathRouteIndex = this.map.sidePaths.length - 1;
    this.selectedPathIndex = 0;
    this.applyMapEditChange();
    this.setStatus("Side path added", 1200);
  }

  private removePathPoint() {
    if (!this.mapEditMode) {
      return;
    }

    if (this.mapEditTool === "towerSlots") {
      this.removeSelectedTowerSlot();
      return;
    }

    if (this.mapEditTool !== "path" || !this.selectedEditablePath()) {
      return;
    }

    const path = this.selectedEditablePath();
    if (
      this.selectedPathGroup === "lane" &&
      (this.selectedPathIndex <= 0 || this.selectedPathIndex >= path.length - 1 || path.length <= 2)
    ) {
      return;
    }

    if (this.selectedPathGroup === "side" && path.length <= 2) {
      this.map.sidePaths.splice(this.selectedPathRouteIndex, 1);
      this.selectedPathRouteIndex = clamp(this.selectedPathRouteIndex - 1, 0, Math.max(0, this.map.sidePaths.length - 1));
      this.selectedPathIndex = 0;
      this.applyMapEditChange();
      return;
    }

    path.splice(this.selectedPathIndex, 1);
    this.selectedPathIndex = clamp(this.selectedPathIndex - 1, 0, path.length - 1);
    this.applyMapEditChange();
  }

  private addTowerSlot(point: Point) {
    const slot = this.clampMapPoint(point);
    this.map.towerSlots.push(slot);
    this.selectedSlotIndex = this.map.towerSlots.length - 1;
    this.applyMapEditChange();
  }

  private removeSelectedTowerSlot() {
    if (this.map.towerSlots.length === 0) {
      return;
    }

    const index = clamp(this.selectedSlotIndex, 0, this.map.towerSlots.length - 1);
    const removedTowers = this.towers.filter((tower) => tower.slotIndex === index);
    for (const tower of removedTowers) {
      this.removeTowerInstance(tower);
    }
    this.towers = this.towers
      .filter((tower) => tower.slotIndex !== index)
      .map((tower) => {
        if (tower.slotIndex > index) {
          tower.slotIndex -= 1;
        }
        return tower;
      });

    this.map.towerSlots.splice(index, 1);
    this.selectedSlotIndex = clamp(index - 1, 0, Math.max(0, this.map.towerSlots.length - 1));
    this.applyMapEditChange();
    this.setStatus(removedTowers.length > 0 ? "Tower base and tower removed" : "Tower base removed", 1200);
  }

  private removeTowerInstance(tower: Tower) {
    this.towerLayer.removeChild(tower.container);
    tower.container.destroy({ children: true });
    if (this.selectedTower === tower) {
      this.selectedTower = null;
    }
  }

  private addEditorTowerToSelectedBase() {
    if (!this.mapEditMode || this.mapEditTool !== "towerSlots") {
      this.setStatus("Switch to Tower Bases to add towers", 1200);
      return;
    }
    if (!this.selectedTowerKind || this.map.towerSlots.length === 0) {
      return;
    }

    const slotIndex = clamp(this.selectedSlotIndex, 0, this.map.towerSlots.length - 1);
    const existingTower = this.towers.find((tower) => tower.slotIndex === slotIndex);
    if (existingTower) {
      this.removeTowerInstance(existingTower);
      this.towers = this.towers.filter((tower) => tower !== existingTower);
    }

    this.placeTower(this.selectedTowerKind, slotIndex);
    this.renderEditorOverlay();
    this.updateMapEditorControls();
    this.updateHud();
    this.setStatus(`${TOWER_TYPES[this.selectedTowerKind].name} added to base ${slotIndex + 1}`, 1200);
  }

  private async copyCurrentMapLayout() {
    const sourceMap = this.currentMapLayoutSource();
    const payload = {
      [this.activeMapId]: sourceMap,
    };
    const snippet = `${this.activeMapId}: ${JSON.stringify(sourceMap, null, 2)},`;
    if (this.devMapAuthoring) {
      try {
        const response = await fetch("/__dev/map-layout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mapId: this.activeMapId,
            layout: sourceMap,
          }),
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        this.saveStoredMapLayoutOverride(this.activeMapId, sourceMap);
        this.setStatus(`${this.map.name} layout saved to source`, 1600);
        return;
      } catch (error) {
        console.warn("Map source save failed", error);
        this.saveStoredMapLayoutOverride(this.activeMapId, sourceMap);
        this.setStatus("Source save failed; layout saved locally for refresh", 2200);
        return;
      }
    }

    this.saveStoredMapLayoutOverride(this.activeMapId, sourceMap);
    try {
      await navigator.clipboard.writeText(snippet);
      this.setStatus("Map config copied and saved locally", 1400);
    } catch {
      console.info("Map config", payload);
      this.setStatus("Saved locally; clipboard unavailable", 1400);
    }
  }

  private currentMapLayoutSource() {
    const sourcePoint = (point: Point) => ({ x: Math.round(point.x), y: Math.round(point.y) });
    return {
      path: this.map.paths[0].map(sourcePoint),
      paths: this.map.paths.map((path) => path.map(sourcePoint)),
      sidePaths: this.map.sidePaths.map((path) => path.map(sourcePoint)),
      towerSlots: this.map.towerSlots.map(sourcePoint),
      gate: {
        x: Math.round(this.map.gate.x),
        y: Math.round(this.map.gate.y),
        width: Math.round(this.map.gate.width),
        height: Math.round(this.map.gate.height),
        maxHp: Math.round(this.map.gate.maxHp),
      },
      startingUnit: sourcePoint(this.map.startingUnit),
    };
  }

  private resetCurrentMapLayout() {
    this.clearStoredMapLayoutOverride(this.activeMapId);
    this.map = this.cloneMapLayout(this.activeMapId);
    this.selectedPathGroup = "lane";
    this.selectedPathRouteIndex = 0;
    this.selectedPathIndex = 0;
    this.selectedSlotIndex = 0;
    this.cameraX = clamp(this.cameraX, 0, this.maxCameraX());
    this.cameraY = clamp(this.cameraY, 0, this.maxCameraY());
    this.restart();
    this.mapEditMode = true;
    this.renderEditorOverlay();
    this.updateMapEditorControls();
    this.setStatus("Source map restored", 1200);
  }

  private syncTowersToSlots() {
    for (const tower of this.towers) {
      const slot = this.map.towerSlots[tower.slotIndex];
      if (!slot) {
        continue;
      }
      tower.x = slot.x;
      tower.y = slot.y;
      tower.container.position.set(slot.x, slot.y);
    }
  }

  private towerMaxHp(kind: TowerKind, level = this.towerLevel(kind)) {
    const type = TOWER_TYPES[kind];
    const behaviorBonus = type.behavior === "shockwave" ? 90 : type.behavior === "beam" ? 65 : type.behavior === "support" ? 45 : 0;
    return Math.round((240 + type.cost * 1.45 + behaviorBonus) * (1 + Math.max(0, level - 1) * 0.16));
  }

  private towerOuterRange(kind: TowerKind, level = this.towerLevel(kind)) {
    return TOWER_TYPES[kind].range + Math.max(0, level - 1) * 8;
  }

  private towerRangeLabel(innerRange: number, outerRange: number) {
    return innerRange > 0 ? `${Math.round(innerRange)}-${Math.round(outerRange)}` : String(Math.round(outerRange));
  }

  private pointInTowerRange(tower: Pick<Tower, "x" | "y" | "innerRange" | "range">, point: Point) {
    const targetDistance = distance(tower, point);
    return targetDistance <= tower.range && targetDistance >= tower.innerRange;
  }

  private placeTower(kind: TowerKind, slotIndex: number) {
    const slot = this.map.towerSlots[slotIndex];
    const type = TOWER_TYPES[kind];
    const container = new Container();
    container.position.set(slot.x, slot.y);
    container.eventMode = "static";
    container.cursor = "pointer";

    const rangeRing = new Graphics();
    const selectionRing = new Graphics();

    const glow = new Graphics()
      .ellipse(0, 7, 42, 16)
      .fill({ color: type.color, alpha: 0.18 });

    const sprite = new Sprite(this.textures.tower[kind]);
    sprite.anchor.set(0.5, 0.88);
    const baseScale = kind === "lightspire" ? 0.17 : 0.15;
    sprite.scale.set(baseScale);
    const effectRing = new Graphics();
    const hpBar = new Graphics();
    hpBar.position.set(-30, 19);

    const label = new Text({
      text: type.name,
      style: {
        fill: 0xf8ecd0,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 13,
        fontWeight: "800",
        stroke: { color: 0x111111, width: 4 },
      },
    });
    label.anchor.set(0.5, 0);
    label.position.set(0, 30);

    container.addChild(rangeRing, selectionRing, glow, effectRing, sprite, hpBar, label);
    this.towerLayer.addChild(container);

    const level = this.towerLevel(kind);
    const damageMultiplier = 1 + Math.max(0, level - 1) * 0.18;
    const rangeBonus = Math.max(0, level - 1) * 8;
    const cooldownMultiplier = Math.max(0.75, 1 - Math.max(0, level - 1) * 0.06);
    const maxHp = this.towerMaxHp(kind, level);
    const tower: Tower = {
      ...type,
      kind,
      slotIndex,
      level,
      hp: maxHp,
      maxHp,
      selected: false,
      hitTimerMs: 0,
      x: slot.x,
      y: slot.y,
      innerRange: type.innerRange,
      range: type.range + rangeBonus,
      damage: type.damage * damageMultiplier,
      cooldownMs: type.cooldownMs * cooldownMultiplier,
      cooldownRemainingMs: 250 + Math.random() * 400,
      baseScale,
      animationTimeMs: Math.random() * type.animation.cycleMs,
      firePulseMs: 0,
      tension: 0,
      maxTension: TOWER_TENSION_MAX,
      showRange: false,
      container,
      sprite,
      selectionRing,
      glow,
      effectRing,
      rangeRing,
      hpBar,
    };

    container.on("pointerdown", (event) => {
      if (this.mapEditMode) {
        return;
      }
      event.stopPropagation();
      this.selectTower(tower);
    });

    this.towers.push(tower);
    this.redrawTower(tower);
    this.selectTower(tower);
    this.audio.playTowerBuild();
  }

  private createUnit(kind: HostKind, position: Point, spendEnergy: boolean): Unit {
    const type = HOST_TYPES[kind];
    const animation = this.hostAnimation(kind);
    const special = this.isSpecialHostKind(kind);
    if (spendEnergy) {
      this.energy -= type.cost;
    }

    const id = this.unitId;
    this.unitId += 1;

    const container = new Container();
    container.position.set(position.x, position.y);
    container.eventMode = "static";
    container.cursor = "pointer";

    const selectionRing = new Graphics();
    const destinationMarker = new Graphics();
    this.overlayLayer.addChild(destinationMarker);

    const members: UnitMember[] = [];
    const offsets: Point[] =
      type.memberCount === 1
        ? [{ x: 0, y: 0 }]
        : [
            { x: 0, y: -32 },
            { x: -44, y: -4 },
            { x: 44, y: -4 },
            { x: -26, y: 34 },
            { x: 26, y: 34 },
          ];

    for (let i = 0; i < type.memberCount; i += 1) {
      const sprite = new Sprite(this.hostTexture(kind, "idle"));
      sprite.anchor.set(0.5, 0.86);
      sprite.scale.set(animation.scale);
      sprite.tint = type.tint;
      sprite.position.set(offsets[i].x, offsets[i].y);

      const hpBar = new Graphics();
      hpBar.position.set(offsets[i].x - 22, offsets[i].y + 38);

      members.push({
        hp: type.memberHp,
        maxHp: type.memberHp,
        mp: type.memberMp,
        maxMp: type.memberMp,
        hitTimerMs: 0,
        deathTimerMs: 0,
        offset: offsets[i],
        animationPhaseMs: Math.random() * 1200,
        scaleJitter: 0.94 + Math.random() * 0.12,
        bobJitter: 0.75 + Math.random() * 0.65,
        targetPreference: Math.floor(Math.random() * 9),
        sprite,
        hpBar,
      });

      container.addChild(sprite, hpBar);
    }

    const baseName = special ? type.name : id === 1 ? "Alizel's Host" : `${type.name} ${id}`;
    const initialProjection = projectedPointOnPaths(position, this.deploymentPaths());
    const initialPathPosition =
      initialProjection.distance <= PATH_DEPLOY_TOLERANCE
        ? { path: initialProjection.path, progress: initialProjection.progress }
        : null;
    const label = new Text({
      text: baseName,
      style: {
        fill: 0xfff5dc,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 14,
        fontWeight: "900",
        stroke: { color: 0x111111, width: 4 },
      },
    });
    label.anchor.set(0.5, 0);
    label.position.set(0, 74);
    container.addChild(selectionRing, label);

    const unit: Unit = {
      id: `host-${id}`,
      kind,
      special,
      specialAbility: "specialAbility" in type ? type.specialAbility : undefined,
      team: "angel",
      baseName,
      name: baseName,
      x: position.x,
      y: position.y,
      facingX: -1,
      destination: null,
      destinationPath: null,
      pathPosition: initialPathPosition,
      speed: type.speed,
      attackRange: type.attackRange,
      engagementRange: type.engagementRange,
      attackCooldownMs: type.attackCooldownMs,
      attackTimerMs: 0,
      damagePerMember: type.damagePerMember,
      healPerMember: type.healPerMember,
      defense: type.defense,
      tint: type.tint,
      corruption: 0,
      tension: 0,
      maxTension: special ? SPECIAL_ANGEL_TENSION_MAX : 0,
      autoMoveMode: "manual",
      autoMoveRetargetMs: 0,
      selected: false,
      pose: "idle",
      poseTimerMs: 0,
      animationTimeMs: Math.random() * 1200,
      container,
      selectionRing,
      destinationMarker,
      members,
      label,
    };

    this.redrawUnit(unit);
    container.on("pointerdown", (event) => {
      event.stopPropagation();
      if (unit.team === "demon" && this.buildMode === "ability" && this.purifyMode) {
        this.purifyUnit(unit);
        return;
      }

      this.purifyMode = false;
      this.selectUnit(unit);
      this.openSelectedOverlayOnDoubleClick(unit);
    });

    return unit;
  }

  private pointerScreenPoint(event: FederatedPointerEvent): Point {
    const rect = this.app.canvas.getBoundingClientRect();
    const clientPoint = { x: event.clientX, y: event.clientY };
    if (rect.width <= 0 || rect.height <= 0 || !isFinitePoint(clientPoint)) {
      return event.global;
    }

    return {
      x: ((clientPoint.x - rect.left) / rect.width) * this.app.screen.width,
      y: ((clientPoint.y - rect.top) / rect.height) * this.app.screen.height,
    };
  }

  private pointerMapPoint(event: FederatedPointerEvent) {
    return this.world.toLocal(this.pointerScreenPoint(event));
  }

  private handlePointerDown(event: FederatedPointerEvent) {
    if (this.menuOpen || this.guideOpen || this.battleState !== "playing") {
      return;
    }

    this.startAudio();
    const point = this.pointerMapPoint(event);
    if (point.x < 32 || point.x > this.map.width - 32 || point.y < 32 || point.y > this.map.height - 32) {
      return;
    }

    if (this.mapEditMode) {
      this.syncMapEditToolFromControl();
      this.handleEditorCanvasClick(point);
      return;
    }

    if (this.buildMode === "ability" && this.purifyMode) {
      const demonUnit = this.findClosestAliveUnit(point, 125, "demon");
      if (demonUnit) {
        this.purifyUnit(demonUnit);
        return;
      }

      const target = this.findClosestEnemy(point, 125);
      if (!target) {
        this.setStatus("Choose a corrupted enemy", 1200);
        return;
      }
      if (this.energy < PURIFY_COST) {
        this.purifyMode = false;
        this.setStatus(`Need ${PURIFY_COST} energy`, 1400);
        return;
      }

      this.energy -= PURIFY_COST;
      const purifiedKind = this.hostKindFromEnemy(target.kind as EnemyKind);
      const unit = this.createUnit(purifiedKind, { x: target.x, y: target.y }, false);
      unit.baseName = `Purified ${ENEMY_TYPES[target.kind as EnemyKind].name}`;
      unit.name = unit.baseName;
      unit.label.text = unit.name;
      this.units.push(unit);
      this.unitLayer.addChild(unit.container);
      this.selectUnit(unit);
      target.hp = 0;
      this.cleanupDeadEnemies(false);
      this.purifyMode = false;
      this.audio.playPurify();
      this.setStatus("Enemy purified into a host", 1400);
      return;
    }

    const pedestal = this.findClosestPedestal(point);
    if (this.buildMode === "towers" && this.selectedTowerKind && pedestal) {
      if (this.combatTutorialStep === "buildTower" && this.hud.buildOverlay?.hidden) {
        this.setStatus("Click the pulsing Towers icon first", 1300);
        return;
      }
      if (this.combatTutorialStep === "buildTower" && pedestal.index !== this.tutorialTowerSlotIndex()) {
        this.setStatus("Use the highlighted pedestal for the first tower", 1300);
        return;
      }
      if (this.combatTutorialStep === "buildTower" && this.selectedTowerKind !== "lightspire") {
        this.selectedTowerKind = "lightspire";
        this.renderBuildPanel();
        this.setStatus("Start with a Lightspire on the highlighted pedestal", 1300);
        return;
      }
      if (!this.isTowerUnlocked(this.selectedTowerKind)) {
        this.setStatus(`${TOWER_TYPES[this.selectedTowerKind].name} is still locked`, 1400);
        return;
      }
      const towerType = TOWER_TYPES[this.selectedTowerKind];
      if (this.towers.some((tower) => tower.slotIndex === pedestal.index)) {
        this.setStatus("Pedestal already occupied", 1200);
        return;
      }
      if (this.energy < towerType.cost) {
        this.setStatus(`Need ${towerType.cost} energy`, 1400);
        return;
      }
      this.energy -= towerType.cost;
      this.placeTower(this.selectedTowerKind, pedestal.index);
      this.setCanvasCursor("default");
      this.setStatus(`${towerType.name} built`, 1200);
      this.advanceCombatTutorialAfterTower(pedestal.index);
      this.updateHud();
      return;
    }

    if (this.combatTutorialStep === "buildTower") {
      this.setStatus("Build the Lightspire on the highlighted pedestal first", 1300);
      return;
    }

    const deployment = projectedPointOnPaths(point, this.deploymentPaths());
    if (deployment.distance > PATH_DEPLOY_TOLERANCE) {
      this.setStatus(this.buildMode === "towers" ? "Choose an empty pedestal" : "Choose a point on the path", 1100);
      return;
    }

    if (this.combatTutorialStep === "redeployHost" && distance(deployment.point, this.tutorialRallyPoint()) > 72) {
      this.setStatus("Move Alizel's Host to the highlighted road point", 1300);
      return;
    }

    if (this.buildMode === "hosts" && this.selectedHostKind) {
      if (!this.isHostUnlocked(this.selectedHostKind)) {
        this.setStatus(`${HOST_TYPES[this.selectedHostKind].name} is still locked`, 1400);
        return;
      }
      if (this.specialAngelDeployed(this.selectedHostKind)) {
        this.setStatus(`${HOST_TYPES[this.selectedHostKind].name} already deployed this battle`, 1400);
        return;
      }
      const hostType = HOST_TYPES[this.selectedHostKind];
      if (this.energy < hostType.cost) {
        this.setStatus(`Need ${hostType.cost} energy`, 1400);
        return;
      }
      const unit = this.createUnit(this.selectedHostKind, deployment.point, true);
      this.units.push(unit);
      this.unitLayer.addChild(unit.container);
      if (unit.special) {
        this.deployedSpecialAngels.add(this.selectedHostKind);
      }
      this.selectUnit(unit);
      this.audio.playHostDeploy();
      this.setStatus(`${hostType.name} deployed`, 1100);
      this.renderBuildPanel();
      return;
    }

    if (this.selectedUnit && this.selectedUnit.team === "angel" && this.aliveMembers(this.selectedUnit).length > 0) {
      this.selectedUnit.autoMoveMode = "manual";
      this.setUnitPathDestination(this.selectedUnit, deployment, true, true);
      this.advanceCombatTutorialAfterRedeploy();
      this.updateHud();
    }
  }

  private handlePointerMove(event: FederatedPointerEvent) {
    if (!this.mapEditMode || !this.editorDragTarget) {
      this.updateTowerPlacementCursor(event);
      return;
    }

    this.setCanvasCursor("grabbing");
    const point = this.clampMapPoint(this.pointerMapPoint(event));
    if (this.editorDragTarget.type === "slot") {
      this.selectedSlotIndex = this.editorDragTarget.index;
      this.map.towerSlots[this.editorDragTarget.index] = point;
    } else if (this.editorDragTarget.type === "path") {
      this.selectedPathGroup = this.editorDragTarget.group;
      this.selectedPathRouteIndex = this.editorDragTarget.pathId;
      this.selectedPathIndex = this.editorDragTarget.index;
      const path = this.editablePath(this.editorDragTarget.group, this.editorDragTarget.pathId) ?? this.map.paths[0];
      path[this.editorDragTarget.index] = point;
      this.map.path = this.map.paths[0];
      if (
        this.editorDragTarget.group === "lane" &&
        this.editorDragTarget.pathId === 0 &&
        this.editorDragTarget.index === Math.floor(path.length / 2)
      ) {
        this.map.startingUnit = point;
      }
    } else {
      this.map.gate.x = clamp(point.x - this.map.gate.width / 2, 0, this.map.width - this.map.gate.width);
      this.map.gate.y = clamp(point.y - this.map.gate.height / 2, 0, this.map.height - this.map.gate.height);
    }

    this.applyMapEditChange();
  }

  private handlePointerUp() {
    const hadDragTarget = Boolean(this.editorDragTarget);
    this.editorDragTarget = null;
    if (hadDragTarget && this.mapEditMode) {
      this.renderEditorOverlay();
      this.updateMapEditorControls();
      this.setCanvasCursor("default");
    }
  }

  private setCanvasCursor(cursor: string) {
    if (this.app.canvas.style.cursor !== cursor) {
      this.app.canvas.style.cursor = cursor;
    }
  }

  private isTowerPlacementPointerActive() {
    const buildOverlayOpen = !this.hud.buildOverlay?.hidden;
    return (
      this.battleState === "playing" &&
      !this.menuOpen &&
      !this.guideOpen &&
      !this.mapEditMode &&
      this.buildMode === "towers" &&
      Boolean(this.selectedTowerKind) &&
      (buildOverlayOpen || this.combatTutorialStep === "buildTower")
    );
  }

  private canPlaceSelectedTowerAtPedestal(index: number) {
    if (!this.selectedTowerKind) {
      return false;
    }
    if (this.combatTutorialStep === "buildTower" && index !== this.tutorialTowerSlotIndex()) {
      return false;
    }
    if (this.combatTutorialStep === "buildTower" && this.selectedTowerKind !== "lightspire") {
      return false;
    }
    if (!this.isTowerUnlocked(this.selectedTowerKind)) {
      return false;
    }
    if (this.towers.some((tower) => tower.slotIndex === index)) {
      return false;
    }
    return this.energy >= TOWER_TYPES[this.selectedTowerKind].cost;
  }

  private updateTowerPlacementCursor(event: FederatedPointerEvent) {
    if (!this.isTowerPlacementPointerActive()) {
      this.setCanvasCursor("default");
      return;
    }

    const pedestal = this.findClosestPedestal(this.pointerMapPoint(event));
    if (!pedestal) {
      this.setCanvasCursor("default");
      return;
    }

    this.setCanvasCursor(this.canPlaceSelectedTowerAtPedestal(pedestal.index) ? "copy" : "not-allowed");
  }

  private handleEditorCanvasClick(point: Point) {
    const closestPathPoint = this.findClosestPathPoint(point, 24);
    const existingPedestal = this.findClosestPedestal(point);

    if (closestPathPoint && (this.mapEditTool === "path" || !existingPedestal)) {
      this.beginPathPointDrag(closestPathPoint);
      return;
    }

    if (this.mapEditTool === "towerSlots") {
      if (existingPedestal) {
        this.selectedSlotIndex = existingPedestal.index;
        this.renderEditorOverlay();
        this.updateMapEditorControls();
        return;
      }

      this.addTowerSlot(point);
      this.setStatus("Tower base added", 1200);
      return;
    }

    if (this.mapEditTool !== "path") {
      return;
    }

    if (closestPathPoint) {
      this.beginPathPointDrag(closestPathPoint);
      return;
    }

    const closestSegment = this.findClosestPathSegment(point, 32);
    if (closestSegment) {
      this.insertPathPointAtSegment(closestSegment, closestSegment.point, true);
    }
  }

  private beginPathPointDrag(pathPoint: { group: PathGroup; pathId: number; index: number }) {
    this.editorDragTarget = {
      type: "path",
      group: pathPoint.group,
      pathId: pathPoint.pathId,
      index: pathPoint.index,
    };
    this.mapEditTool = "path";
    this.selectEditorTarget(this.editorDragTarget);
    this.renderEditorOverlay();
    this.updateMapEditorControls();
  }

  private selectEditorTarget(target: EditorDragTarget) {
    if (target.type === "slot") {
      this.selectedSlotIndex = target.index;
      return;
    }
    if (target.type === "path") {
      this.selectedPathGroup = target.group;
      this.selectedPathRouteIndex = target.pathId;
      this.selectedPathIndex = target.index;
    }
  }

  private clampMapPoint(point: Point): Point {
    return {
      x: clamp(point.x, 24, this.map.width - 24),
      y: clamp(point.y, 24, this.map.height - 24),
    };
  }

  private findClosestPathPoint(point: Point, maxDistance: number) {
    let closest: { group: PathGroup; pathId: number; index: number } | null = null;
    let closestDistance = maxDistance;
    for (const { group, pathId, path } of this.editablePathEntries()) {
      for (const [index, pathPoint] of path.entries()) {
        const pointDistance = distance(point, pathPoint);
        if (pointDistance <= closestDistance) {
          closestDistance = pointDistance;
          closest = { group, pathId, index };
        }
      }
    }
    return closest;
  }

  private findClosestPathSegment(point: Point, maxDistance: number) {
    let closest: { group: PathGroup; pathId: number; index: number; point: Point } | null = null;
    let closestDistance = maxDistance;
    for (const { group, pathId, path } of this.editablePathEntries()) {
      for (let index = 0; index < path.length - 1; index += 1) {
        const candidate = closestPointOnSegment(point, path[index], path[index + 1]);
        const candidateDistance = distance(point, candidate);
        if (candidateDistance <= closestDistance) {
          closestDistance = candidateDistance;
          closest = { group, pathId, index, point: candidate };
        }
      }
    }
    return closest;
  }

  private findClosestPedestal(point: Point) {
    let closest: { index: number; distance: number } | null = null;
    for (const [index, slot] of this.map.towerSlots.entries()) {
      const slotDistance = distance(point, slot);
      if (slotDistance <= PEDESTAL_RADIUS && (!closest || slotDistance < closest.distance)) {
        closest = { index, distance: slotDistance };
      }
    }
    return closest;
  }

  private selectUnit(unit: Unit) {
    this.selectedTower = null;
    for (const tower of this.towers) {
      tower.selected = false;
      this.redrawTower(tower);
    }
    for (const candidate of this.units) {
      candidate.selected = candidate === unit;
      this.redrawUnit(candidate);
    }
    this.selectedUnit = unit;
    this.updateHud();
  }

  private selectTower(tower: Tower) {
    this.selectedUnit = null;
    for (const unit of this.units) {
      unit.selected = false;
      this.redrawUnit(unit);
    }
    for (const candidate of this.towers) {
      candidate.selected = candidate === tower;
      this.redrawTower(candidate);
    }
    this.selectedTower = tower;
    this.updateHud();
  }

  private openSelectedOverlayOnDoubleClick(unit: Unit) {
    const now = performance.now();
    const wasDoubleClick = this.lastUnitClick?.id === unit.id && now - this.lastUnitClick.timeMs <= 360;
    this.lastUnitClick = { id: unit.id, timeMs: now };
    if (wasDoubleClick) {
      this.openSelectedOverlay();
    }
  }

  private toggleSelectedTowerRange() {
    if (!this.selectedTower) {
      return;
    }
    this.selectedTower.showRange = !this.selectedTower.showRange;
    this.animateTower(this.selectedTower, 0);
    this.updateHud();
  }

  private drawDestination(unit: Unit) {
    unit.destinationMarker.clear();
    if (!unit.destination) {
      return;
    }

    unit.destinationMarker
      .circle(unit.destination.x, unit.destination.y, 22)
      .stroke({ color: 0xf1d37a, width: 3, alpha: 0.86 })
      .moveTo(unit.destination.x - 30, unit.destination.y)
      .lineTo(unit.destination.x + 30, unit.destination.y)
      .moveTo(unit.destination.x, unit.destination.y - 30)
      .lineTo(unit.destination.x, unit.destination.y + 30)
      .stroke({ color: 0xf1d37a, width: 2, alpha: 0.54 });
  }

  private update(deltaMs: number) {
    this.animateCombatTutorialHighlight(deltaMs);
    if (!this.textures || this.menuOpen || this.guideOpen || this.battleState !== "playing") {
      return;
    }

    if (this.mapEditMode) {
      if (this.syncMapEditToolFromControl()) {
        this.renderEditorOverlay();
        this.updateMapEditorControls();
      }
      this.statusOverrideMs = Math.max(0, this.statusOverrideMs - deltaMs);
      this.updateMinimap();
      this.updateHud();
      return;
    }

    if (this.isPaused) {
      this.updateMinimap();
      this.updateHud();
      return;
    }

    const battleDeltaMs = deltaMs * this.battleSpeed;
    this.battleElapsedMs += battleDeltaMs;
    this.statusOverrideMs = Math.max(0, this.statusOverrideMs - deltaMs);
    this.updateWaveSpawner(battleDeltaMs);
    for (const unit of this.units) {
      this.updateUnit(unit, battleDeltaMs);
    }
    this.updateTowers(battleDeltaMs);
    this.updateEnemies(battleDeltaMs);
    this.updateProjectiles(battleDeltaMs);
    this.updateBeams(battleDeltaMs);
    this.updateShockwaves(battleDeltaMs);
    this.cleanupDeadEnemies();
    this.cleanupDeadTowers();
    this.drawGate();
    this.checkBattleEnd();
    this.updateMinimap();
    this.updateHud();
  }

  private animateCombatTutorialHighlight(deltaMs: number) {
    if (!this.combatTutorialHighlight || this.combatTutorialPulseRings.length === 0) {
      return;
    }

    this.combatTutorialHighlightMs = (this.combatTutorialHighlightMs + deltaMs) % 1600;
    this.combatTutorialPulseRings.forEach((ring, index) => {
      const phase = ((this.combatTutorialHighlightMs + index * 800) % 1600) / 1600;
      const scale = 0.78 + phase * 0.72;
      ring.scale.set(scale);
      ring.alpha = 0.95 - phase * 0.78;
    });
  }

  private updateWaveSpawner(deltaMs: number) {
    const waves = this.currentWaves();
    if (this.currentWaveIndex >= waves.length) {
      return;
    }

    if (this.isCombatTutorialBlockingWaves()) {
      return;
    }

    if (this.betweenWaveTimerMs > 0) {
      this.betweenWaveTimerMs -= deltaMs;
      return;
    }

    if (this.activeWavePlan.length === 0) {
      this.prepareWavePlan(waves);
    }

    if (this.waveSpawned >= this.activeWavePlan.length) {
      if (this.enemies.length === 0 && !this.hasAliveDemonUnits()) {
        this.currentWaveIndex += 1;
        this.waveSpawned = 0;
        this.activeWaveName = "";
        this.activeWavePlan = [];
        this.spawnTimerMs = 0;
        this.betweenWaveTimerMs = 1700;
      }
      return;
    }

    this.spawnTimerMs -= deltaMs;
    if (this.spawnTimerMs <= 0) {
      const spawn = this.activeWavePlan[this.waveSpawned];
      this.spawnEnemy(spawn.kind, spawn.pathId);
      this.waveSpawned += 1;
      const interval = this.getActiveWaveInterval(waves) * this.currentDifficulty().enemySpawnIntervalMultiplier;
      this.spawnTimerMs = interval;
    }
  }

  private prepareWavePlan(waves: WaveDefinition[]) {
    const wave = this.waveDirectorMode === "adaptive" ? this.chooseAdaptiveWave(waves) : waves[this.currentWaveIndex];
    if (this.waveDirectorMode === "adaptive") {
      const profile = this.analyzeBoardForDirector();
      this.activeWavePlan = this.createAdaptiveWavePlan(wave, profile);
      const gateSummary = this.summarizeWaveGates(this.activeWavePlan);
      this.activeWaveName = `AI: ${wave.name} via ${gateSummary}`;
      this.setStatus(`AI Director sends ${wave.name} through ${gateSummary}`, 1800);
      return;
    }

    this.activeWaveName = wave.name;
    this.activeWavePlan = wave.enemies.map((kind, index) => ({
      kind,
      pathId: index % Math.max(1, this.map.paths.length),
    }));
  }

  private getActiveWaveInterval(waves: WaveDefinition[]) {
    const name = this.activeWaveName.replace(/^AI: /, "").replace(/ via .+$/, "");
    const wave = waves.find((candidate) => name === candidate.name) ?? waves[this.currentWaveIndex];
    return wave.intervalMs;
  }

  private chooseAdaptiveWave(waves: WaveDefinition[]) {
    const profile = this.analyzeBoardForDirector();
    const candidateCount = clamp(this.currentWaveIndex + 2, 1, waves.length);
    const candidates = waves.slice(0, candidateCount);
    const scored = candidates.map((wave, index) => ({
      wave,
      score:
        index * 9 -
        Math.abs(index - this.currentWaveIndex) * 4 +
        wave.enemies.reduce((sum, kind) => sum + this.scoreEnemyForBoard(kind, profile), 0) / wave.enemies.length +
        Math.random() * 5,
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0].wave;
  }

  private createAdaptiveWavePlan(wave: WaveDefinition, profile: AiBoardProfile) {
    const laneUse = new Map<number, number>();
    return wave.enemies.map((kind, index) => {
      const pathId = this.chooseAdaptivePath(kind, profile, laneUse, index);
      laneUse.set(pathId, (laneUse.get(pathId) ?? 0) + 1);
      return { kind, pathId };
    });
  }

  private chooseAdaptivePath(kind: EnemyKind, profile: AiBoardProfile, laneUse: Map<number, number>, index: number) {
    const enemy = ENEMY_TYPES[kind];
    const scored = profile.lanes.map((lane) => {
      const laneLoad = laneUse.get(lane.pathId) ?? 0;
      let score = lane.vulnerability - laneLoad * 13 + Math.random() * 4 - index * 0.15;
      if (enemy.speed >= 74) {
        score += Math.max(0, 38 - lane.hostCoverage * 0.025);
      }
      if (enemy.hp >= 140) {
        score += Math.max(0, 30 - lane.towerCoverage * 0.018);
      }
      if ("projectile" in enemy) {
        score += Math.min(28, (lane.hostCoverage + lane.towerCoverage) * 0.018);
      }
      if (profile.gateRatio < 0.42) {
        score += enemy.gateDamagePerSecond * 0.22;
      }
      return { pathId: lane.pathId, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.pathId ?? 0;
  }

  private scoreEnemyForBoard(kind: EnemyKind, profile: AiBoardProfile) {
    const enemy = ENEMY_TYPES[kind];
    let score = 0;
    if (enemy.speed >= 74) {
      score += Math.max(0, 10 - profile.rangedCounterScore * 2.2);
      score -= profile.slowControlScore * 1.8;
    }
    if (enemy.hp >= 140) {
      score += Math.max(0, 12 - profile.armorCounterScore * 2);
      score -= profile.areaControlScore * 0.8;
    }
    if ("projectile" in enemy) {
      score += Math.max(0, 9 - profile.supportScore * 2.4);
      score += Math.min(5, profile.angelMembers / 4);
      score += Math.min(4, profile.towerCount);
    }
    if (profile.woundedAngelRatio > 0.28) {
      score += "projectile" in enemy ? 4 : 1.5;
    }
    if (profile.gateRatio < 0.38) {
      score += enemy.speed / 28 + enemy.gateDamagePerSecond / 18;
    }
    return score + enemy.energyReward / 38;
  }

  private analyzeBoardForDirector(): AiBoardProfile {
    const towerCounts = Object.fromEntries((Object.keys(TOWER_TYPES) as TowerKind[]).map((kind) => [kind, 0])) as Record<
      TowerKind,
      number
    >;
    const hostCounts = Object.fromEntries((Object.keys(HOST_TYPES) as HostKind[]).map((kind) => [kind, 0])) as Record<
      HostKind,
      number
    >;
    for (const tower of this.towers) {
      if (tower.hp > 0 && tower.kind in TOWER_TYPES) {
        towerCounts[tower.kind as TowerKind] += 1;
      }
    }

    let angelMembers = 0;
    let woundedMembers = 0;
    for (const unit of this.units) {
      if (unit.team !== "angel") {
        continue;
      }
      if (unit.kind in HOST_TYPES) {
        hostCounts[unit.kind as HostKind] += 1;
      }
      for (const member of unit.members) {
        if (member.hp <= 0) {
          continue;
        }
        angelMembers += 1;
        if (member.hp < member.maxHp * 0.72) {
          woundedMembers += 1;
        }
      }
    }

    const towerCount = Object.values(towerCounts).reduce((sum, count) => sum + count, 0);
    const supportScore = towerCounts.sanctuaryWell + hostCounts.healer * 1.2;
    const profile: AiBoardProfile = {
      lanes: [],
      gateRatio: clamp(this.gateHp / this.map.gate.maxHp, 0, 1),
      towerCounts,
      hostCounts,
      towerCount,
      angelMembers,
      woundedAngelRatio: angelMembers > 0 ? woundedMembers / angelMembers : 0,
      rangedCounterScore:
        towerCounts.lightspire * 0.8 + towerCounts.prismChain * 1.3 + towerCounts.judgmentLens * 1.2 + hostCounts.archers * 1.6,
      armorCounterScore:
        towerCounts.judgmentLens * 1.8 + towerCounts.flameChoir * 1.4 + towerCounts.prismChain * 0.7 + hostCounts.thrones * 1.4,
      areaControlScore: towerCounts.harmonicBell * 1.2 + towerCounts.flameChoir * 1.5,
      supportScore,
      slowControlScore: towerCounts.temporalFont * 1.5,
    };
    profile.lanes = this.map.paths.map((path, pathId) => this.analyzeLaneForDirector(path, pathId, profile.gateRatio));
    return profile;
  }

  private analyzeLaneForDirector(path: Point[], pathId: number, gateRatio: number): LaneProfile {
    const samples = this.samplePathForDirector(path);
    let towerCoverage = 0;
    let hostCoverage = 0;
    let supportCoverage = 0;
    for (const sample of samples) {
      for (const tower of this.towers) {
        if (tower.hp <= 0) {
          continue;
        }
        const towerDistance = distance(tower, sample);
        if (towerDistance <= tower.range && towerDistance >= tower.innerRange) {
          const influence = 1 - towerDistance / tower.range;
          const output = tower.damage > 0 ? this.towerDamage(tower.damage) : tower.behavior === "slow" ? 34 : 22;
          towerCoverage += output * influence;
          if (tower.behavior === "support" || tower.behavior === "slow") {
            supportCoverage += influence;
          }
        }
      }
      for (const unit of this.units) {
        if (unit.team !== "angel") {
          continue;
        }
        const alive = this.aliveMembers(unit).length;
        if (alive === 0) {
          continue;
        }
        const unitRange = Math.max(unit.attackRange, unit.engagementRange);
        const unitDistance = distance(unit, sample);
        if (unitDistance <= unitRange) {
          const influence = 1 - unitDistance / unitRange;
          hostCoverage += alive * (unit.damagePerMember > 0 ? this.unitDamage(unit, unit.damagePerMember) : unit.healPerMember * 0.8) * influence;
          if (unit.healPerMember > 0) {
            supportCoverage += influence;
          }
        }
      }
    }

    const pressure =
      this.enemies.filter((enemy) => enemy.pathId === pathId).length +
      this.units.filter((unit) => unit.team === "demon" && this.aliveMembers(unit).length > 0).length * 0.6;
    const vulnerability = clamp(
      120 - towerCoverage * 0.035 - hostCoverage * 0.055 - supportCoverage * 7 - pressure * 8 + (1 - gateRatio) * 26,
      4,
      180,
    );
    return { pathId, towerCoverage, hostCoverage, supportCoverage, pressure, vulnerability };
  }

  private samplePathForDirector(path: Point[]) {
    const samples: Point[] = [];
    for (let i = 0; i < path.length - 1; i += 1) {
      const start = path[i];
      const end = path[i + 1];
      samples.push(start, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 });
    }
    samples.push(path[path.length - 1]);
    if (samples.length <= 10) {
      return samples;
    }
    const stride = samples.length / 10;
    return Array.from({ length: 10 }, (_, index) => samples[Math.min(samples.length - 1, Math.floor(index * stride))]);
  }

  private summarizeWaveGates(plan: WaveSpawnPlanItem[]) {
    const gates = [...new Set(plan.map((item) => item.pathId))]
      .sort((a, b) => a - b)
      .map((pathId) => this.pathLabel(pathId));
    if (gates.length === 0) {
      return this.pathLabel(0);
    }
    if (gates.length <= 2) {
      return gates.join(" and ");
    }
    return `${gates.slice(0, -1).join(", ")}, and ${gates[gates.length - 1]}`;
  }

  private pathLabel(pathId: number) {
    return `Gate ${String.fromCharCode(65 + pathId)}`;
  }

  private spawnEnemy(kind: EnemyKind, pathId = 0, position?: Point) {
    const path = this.map.paths[pathId] ?? this.map.paths[0];
    const spawnPosition = position ?? path[0];
    const type = ENEMY_TYPES[kind];
    const sprite = new Sprite(this.textures.enemy[kind]);
    sprite.anchor.set(0.5, 0.86);
    sprite.scale.set(type.scale);

    const container = new Container();
    container.position.set(spawnPosition.x, spawnPosition.y);
    const aura = new Graphics()
      .ellipse(0, 10, kind === "darkArchangel" ? 48 : 34, 11)
      .fill({ color: 0x16090c, alpha: 0.6 });
    const hpBar = new Graphics();
    hpBar.position.set(-26, -Math.max(54, sprite.height * 0.68));
    container.addChild(aura, sprite, hpBar);
    this.enemyLayer.addChild(container);
    const difficulty = this.currentDifficulty();
    const maxHp = Math.round(type.hp * difficulty.enemyHpMultiplier);

    const enemy: Enemy = {
      id: this.enemyId,
      kind,
      energyReward: Math.round(type.energyReward * difficulty.energyRewardMultiplier),
      baseScale: type.scale,
      walkTimeMs: Math.random() * type.walkAnimation.cycleMs,
      projectileCooldownMs: "projectile" in type ? type.projectile.cooldownMs * 0.5 : 0,
      x: spawnPosition.x,
      y: spawnPosition.y,
      facingX: facingToward(spawnPosition, path[1], 1),
      hp: maxHp,
      maxHp,
      speed: type.speed * difficulty.enemySpeedMultiplier,
      gateDamagePerSecond: type.gateDamagePerSecond * difficulty.enemyDamageMultiplier,
      pathId,
      pathIndex: closestPathSegmentIndex(spawnPosition, path),
      attackingGate: false,
      container,
      sprite,
      aura,
      hpBar,
    };

    this.enemyId += 1;
    this.enemies.push(enemy);
    this.redrawEnemy(enemy);
  }

  private updateUnitAutoMove(unit: Unit, deltaMs: number) {
    if (unit.team === "demon") {
      unit.autoMoveMode = "gate";
      unit.autoMoveRetargetMs -= deltaMs;
      if (unit.autoMoveRetargetMs <= 0 || !unit.destination) {
        this.assignCorruptedUnitDestination(unit);
      }
      return;
    }

    if (unit.autoMoveMode === "manual") {
      return;
    }

    unit.autoMoveRetargetMs -= deltaMs;
    if (unit.autoMoveRetargetMs > 0 && unit.destination) {
      return;
    }

    this.assignAutoMoveDestination(unit);
  }

  private assignAutoMoveDestination(unit: Unit, force = false) {
    const target = this.resolveAutoMoveTarget(unit);
    unit.autoMoveRetargetMs = 900;
    if (!target) {
      return false;
    }

    const destination = this.pathRespectingAutoMoveDestination(unit, target);
    this.setUnitPathDestination(unit, destination, true, force);
    return true;
  }

  private assignCorruptedUnitDestination(unit: Unit) {
    unit.autoMoveRetargetMs = 700;
    this.setUnitPathDestination(unit, this.pathRespectingAutoMoveDestination(unit, this.gateRallyPoint()), false, true);
  }

  private pathRespectingAutoMoveDestination(unit: Unit, target: Point) {
    const paths = this.deploymentPaths();
    const targetProjection = projectedPointOnPaths(target, paths);
    const currentProjection = projectedPointOnPath(unit, targetProjection.path);

    if (currentProjection.distance > 34) {
      return { ...targetProjection, point: currentProjection.point, progress: currentProjection.progress };
    }

    const currentProgress = this.unitProgressOnPath(unit, targetProjection.path);
    const delta = targetProjection.progress - currentProgress;
    if (Math.abs(delta) <= 24) {
      return targetProjection;
    }

    const direction = delta < 0 ? -1 : 1;
    const step = Math.min(Math.abs(delta), 115);
    const progress = currentProgress + direction * step;
    return {
      ...targetProjection,
      point: pointAtPathProgress(targetProjection.path, progress),
      progress,
    };
  }

  private unitProgressOnPath(unit: Unit, path: Point[]) {
    if (unit.pathPosition?.path === path) {
      const rememberedPoint = pointAtPathProgress(path, unit.pathPosition.progress);
      if (distance(unit, rememberedPoint) < 96) {
        return clamp(unit.pathPosition.progress, 0, pathTotalLength(path));
      }
    }
    return projectedPointOnPath(unit, path).progress;
  }

  private clearUnitDestination(unit: Unit) {
    unit.destination = null;
    unit.destinationPath = null;
    unit.destinationMarker.clear();
  }

  private setUnitPathDestination(
    unit: Unit,
    destination: ReturnType<typeof projectedPointOnPaths>,
    showMarker: boolean,
    force = false,
  ) {
    const currentProjection = projectedPointOnPath(unit, destination.path);
    if (currentProjection.distance > 38) {
      this.setUnitDestination(unit, currentProjection.point, showMarker, force);
      unit.pathPosition = null;
      unit.destinationPath = null;
      return;
    }

    const currentProgress = this.unitProgressOnPath(unit, destination.path);
    if (Math.abs(destination.progress - currentProgress) < 8 && distance(unit, destination.point) < 14) {
      unit.pathPosition = { path: destination.path, progress: destination.progress };
      this.clearUnitDestination(unit);
      return;
    }

    if (
      !force &&
      unit.destinationPath?.path === destination.path &&
      Math.abs(unit.destinationPath.targetProgress - destination.progress) < 18
    ) {
      return;
    }

    unit.pathPosition = { path: destination.path, progress: currentProgress };
    unit.destinationPath = { path: destination.path, targetProgress: destination.progress };
    this.setUnitDestination(unit, destination.point, showMarker, true, true);
  }

  private setUnitDestination(unit: Unit, destination: Point, showMarker: boolean, force = false, preservePath = false) {
    if (distance(unit, destination) < 10) {
      this.clearUnitDestination(unit);
      return;
    }

    if (!force && unit.destination && distance(unit.destination, destination) < 18) {
      return;
    }

    unit.destination = destination;
    if (!preservePath) {
      unit.destinationPath = null;
    }
    if (showMarker) {
      this.drawDestination(unit);
    } else {
      unit.destinationMarker.clear();
    }
  }

  private resolveAutoMoveTarget(unit: Unit): Point | null {
    switch (unit.autoMoveMode) {
      case "gate":
        return this.gateRallyPoint();
      case "nearestEnemy":
        return this.findAutoMoveEnemyTarget(unit, "nearest");
      case "strongestEnemy":
        return this.findAutoMoveEnemyTarget(unit, "strongest");
      case "weakestEnemy":
        return this.findAutoMoveEnemyTarget(unit, "weakest");
      case "nearestHealer":
        return this.findNearestHealer(unit);
      case "woundedAlly":
        return this.findWoundedAlly(unit);
      case "portal":
        return this.nearestPortalPoint(unit);
      case "manual":
        return null;
    }
  }

  private findAutoMoveEnemyTarget(origin: Unit, mode: "nearest" | "strongest" | "weakest") {
    const candidates: { point: Point; hp: number; maxHp: number; distance: number }[] = [];

    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) {
        continue;
      }
      candidates.push({
        point: enemy,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        distance: distance(origin, enemy),
      });
    }

    for (const unit of this.units) {
      if (unit.team !== "demon" || this.aliveMembers(unit).length === 0) {
        continue;
      }
      const hp = this.totalUnitHp(unit);
      candidates.push({
        point: unit,
        hp,
        maxHp: this.totalUnitMaxHp(unit),
        distance: distance(origin, unit),
      });
    }

    if (candidates.length === 0) {
      return null;
    }

    if (mode === "nearest") {
      candidates.sort((a, b) => a.distance - b.distance);
    } else if (mode === "strongest") {
      candidates.sort((a, b) => b.hp - a.hp || b.maxHp - a.maxHp || a.distance - b.distance);
    } else {
      candidates.sort((a, b) => a.hp - b.hp || a.distance - b.distance);
    }

    return candidates[0].point;
  }

  private findNearestHealer(origin: Unit) {
    const healer = this.units
      .filter(
        (unit) =>
          unit !== origin &&
          unit.team === origin.team &&
          unit.kind === "healer" &&
          this.aliveMembers(unit).length > 0,
      )
      .sort((a, b) => distance(origin, a) - distance(origin, b))[0];

    return healer ?? null;
  }

  private findWoundedAlly(origin: Unit) {
    const ally = this.units
      .filter(
        (unit) =>
          unit !== origin &&
          unit.team === origin.team &&
          this.aliveMembers(unit).length > 0 &&
          this.unitHpPercent(unit) < 0.98,
      )
      .sort((a, b) => this.unitHpPercent(a) - this.unitHpPercent(b) || distance(origin, a) - distance(origin, b))[0];

    return ally ?? null;
  }

  private nearestPortalPoint(origin: Point) {
    const portals = this.map.paths.map((path) => path[0]).filter(Boolean);
    portals.sort((a, b) => distance(origin, a) - distance(origin, b));
    return portals[0] ?? null;
  }

  private gateCenter(): Point {
    return {
      x: this.map.gate.x + this.map.gate.width / 2,
      y: this.map.gate.y + this.map.gate.height / 2,
    };
  }

  private gateRallyPoint(): Point {
    const center = this.gateCenter();
    const exits = this.map.paths.map((path) => path[path.length - 1]).filter(Boolean);
    exits.sort((a, b) => distance(center, a) - distance(center, b));
    return exits[0] ?? center;
  }

  private totalUnitHp(unit: Unit) {
    return unit.members.reduce((sum, member) => sum + member.hp, 0);
  }

  private totalUnitMaxHp(unit: Unit) {
    return unit.members.reduce((sum, member) => sum + member.maxHp, 0);
  }

  private corruptedUnitGateDamagePerSecond(unit: Unit, aliveCount: number) {
    const basePressure = Math.max(unit.damagePerMember, unit.healPerMember * 0.75, 6);
    return this.unitDamage(unit, basePressure) * aliveCount * 0.42;
  }

  private advanceUnitAlongDestinationPath(unit: Unit, travel: number) {
    if (!unit.destinationPath || !unit.destination) {
      return false;
    }

    const path = unit.destinationPath.path;
    const targetProgress = clamp(unit.destinationPath.targetProgress, 0, pathTotalLength(path));
    const currentProgress = this.unitProgressOnPath(unit, path);
    const delta = targetProgress - currentProgress;
    const direction = delta < 0 ? -1 : 1;

    if (Math.abs(delta) <= travel) {
      const targetPoint = pointAtPathProgress(path, targetProgress);
      unit.x = targetPoint.x;
      unit.y = targetPoint.y;
      unit.pathPosition = { path, progress: targetProgress };
      this.clearUnitDestination(unit);
      return true;
    }

    const nextProgress = currentProgress + direction * travel;
    const nextPoint = pointAtPathProgress(path, nextProgress);
    unit.facingX = facingToward(unit, nextPoint, unit.facingX);
    unit.x = nextPoint.x;
    unit.y = nextPoint.y;
    unit.pathPosition = { path, progress: nextProgress };
    return true;
  }

  private updateUnit(unit: Unit, deltaMs: number) {
    unit.animationTimeMs += deltaMs;
    if (this.aliveMembers(unit).length > 0) {
      this.updateUnitAutoMove(unit, deltaMs);
    }
    unit.tensionSlowMs = Math.max(0, (unit.tensionSlowMs ?? 0) - deltaMs);

    if (unit.destination) {
      const targetDistance = distance(unit, unit.destination);
      const slowMultiplier = unit.team === "demon" ? this.getEnemySlowMultiplier(unit) : 1;
      const travel = (unit.speed * slowMultiplier * deltaMs) / 1000;

      if (!this.advanceUnitAlongDestinationPath(unit, travel)) {
        unit.facingX = facingToward(unit, unit.destination, unit.facingX);
        if (targetDistance <= travel) {
          unit.x = unit.destination.x;
          unit.y = unit.destination.y;
          const projection = projectedPointOnPaths(unit, this.deploymentPaths());
          if (projection.distance < 42) {
            unit.pathPosition = { path: projection.path, progress: projection.progress };
          }
          this.clearUnitDestination(unit);
        } else {
          const dx = (unit.destination.x - unit.x) / targetDistance;
          const dy = (unit.destination.y - unit.y) / targetDistance;
          unit.x += dx * travel;
          unit.y += dy * travel;
        }
      }

      unit.container.position.set(unit.x, unit.y);
    }

    for (const member of unit.members) {
      member.hitTimerMs = Math.max(0, member.hitTimerMs - deltaMs);
      if (member.hp > 0) {
        member.mp = clamp(member.mp + (deltaMs / 1000) * 2.2, 0, member.maxMp);
      } else {
        member.deathTimerMs += deltaMs;
      }
    }

    const tempoMultiplier = unit.team === "demon" ? this.getEnemySlowMultiplier(unit) : 1;
    unit.attackTimerMs -= deltaMs * tempoMultiplier;
    const moving = Boolean(unit.destination);
    const aliveMembers = this.aliveMembers(unit);
    if (unit.specialAbility === "cleanse" && unit.attackTimerMs <= 0 && aliveMembers.length > 0) {
      const cleansed = this.cleanseNearbyCorruption(unit);
      if (cleansed) {
        unit.pose = "cast";
        unit.poseTimerMs = 260;
        unit.attackTimerMs = unit.attackCooldownMs;
        this.spendUnitMp(unit, 10);
        this.addUnitTension(unit, SPECIAL_ANGEL_TENSION_GAIN_PER_ACTION);
      }
    }

    if (unit.healPerMember > 0 && unit.attackTimerMs <= 0 && aliveMembers.length > 0) {
      const healed = this.healNearbyUnit(unit);
      if (healed) {
        unit.pose = "cast";
        unit.poseTimerMs = 260;
        unit.attackTimerMs = unit.attackCooldownMs;
        this.addUnitTension(unit, SPECIAL_ANGEL_TENSION_GAIN_PER_ACTION);
      }
    }

    const attackRange = moving ? unit.engagementRange * 0.65 : unit.attackRange;
    const target =
      unit.damagePerMember > 0
        ? unit.team === "angel"
          ? this.findClosestDemonTarget(unit, attackRange)
          : this.findClosestAngelTarget(unit, attackRange, unit)
        : null;
    if (target) {
      unit.facingX = facingToward(unit, combatTargetPoint(target), unit.facingX);
    }

    if (target && unit.attackTimerMs <= 0 && aliveMembers.length > 0) {
      unit.pose = "attack";
      unit.poseTimerMs = 240;
      this.fireUnitVolley(unit, aliveMembers, attackRange);
      unit.attackTimerMs = moving ? unit.attackCooldownMs * 1.45 : unit.attackCooldownMs;
      this.spendUnitMp(unit, moving ? 3 : 5);
      this.addUnitTension(unit, SPECIAL_ANGEL_TENSION_GAIN_PER_ACTION);
    }

    if (unit.team === "demon" && aliveMembers.length > 0) {
      const gateTarget = this.gateRallyPoint();
      const gateAttackRange = Math.max(72, unit.engagementRange * 0.42);
      if (distance(unit, gateTarget) <= gateAttackRange) {
        unit.facingX = facingToward(unit, gateTarget, unit.facingX);
        this.gateHp = clamp(
          this.gateHp - (this.corruptedUnitGateDamagePerSecond(unit, aliveMembers.length) * tempoMultiplier * deltaMs) / 1000,
          0,
          this.map.gate.maxHp,
        );
        if (!target && unit.poseTimerMs <= 0) {
          unit.pose = "attack";
          unit.poseTimerMs = 160;
        }
      }
    }

    unit.poseTimerMs = Math.max(0, unit.poseTimerMs - deltaMs);
    if (this.aliveMembers(unit).length === 0) {
      unit.pose = "die";
    } else if (unit.poseTimerMs <= 0) {
      unit.pose = moving ? "walk" : "idle";
    }

    this.redrawUnit(unit);
  }

  private fireUnitVolley(unit: Unit, members: UnitMember[], attackRange: number) {
    members.forEach((member, index) => {
      const origin = this.memberShotOrigin(unit, member);
      const targetOffset = this.projectileTargetOffset(member.targetPreference + index);

      if (unit.team === "angel") {
        const target = this.findDemonTargetForMember(origin, attackRange + 42, member.targetPreference + index);
        if (!target) {
          return;
        }

        if (target.enemy) {
          this.createProjectile(
            origin,
            target.enemy,
            490 + member.targetPreference * 9,
            this.unitDamage(unit, unit.damagePerMember),
            0xbbe8ff,
            targetOffset,
          );
        } else {
          this.createUnitProjectile(
            origin,
            target.unit,
            "angel",
            490 + member.targetPreference * 9,
            this.unitDamage(unit, unit.damagePerMember),
            0xbbe8ff,
            targetOffset,
          );
        }
        return;
      }

      const target = this.findAngelTargetForMember(origin, attackRange + 42, unit, member.targetPreference + index);
      if (!target) {
        return;
      }

      this.createDemonProjectile(
        origin,
        target.unit ?? target.tower,
        410 + member.targetPreference * 8,
        this.unitDamage(unit, unit.damagePerMember),
        0xbc4cff,
        targetOffset,
      );
    });
  }

  private memberShotOrigin(unit: Unit, member: UnitMember): Point {
    return {
      x: unit.x + member.offset.x * 0.86,
      y: unit.y + member.offset.y - 22,
    };
  }

  private projectileTargetOffset(seed: number): Point {
    return {
      x: ((seed % 3) - 1) * 12 + (Math.random() - 0.5) * 10,
      y: -18 - (seed % 2) * 8 + (Math.random() - 0.5) * 8,
    };
  }

  private healNearbyUnit(source: Unit) {
    const healers = this.aliveMembers(source).filter((member) => member.mp >= 12);
    if (healers.length === 0) {
      return false;
    }

    const target = this.units
      .filter(
        (unit) =>
          unit !== source &&
          unit.team === source.team &&
          this.aliveMembers(unit).length > 0 &&
          distance(source, unit) <= source.engagementRange,
      )
      .sort((a, b) => this.unitHpPercent(a) - this.unitHpPercent(b))[0];

    if (!target || this.unitHpPercent(target) >= 0.99) {
      return false;
    }

    source.facingX = facingToward(source, target, source.facingX);
    const heal = healers.length * source.healPerMember;
    const member = target.members
      .filter((candidate) => candidate.hp > 0 && candidate.hp < candidate.maxHp)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!member) {
      return false;
    }

    member.hp = clamp(member.hp + heal, 0, member.maxHp);
    for (const healer of healers) {
      healer.mp = clamp(healer.mp - 12, 0, healer.maxMp);
    }
    this.createShockwave({ x: source.x, y: source.y, range: source.engagementRange * 0.35, color: 0x9dffd7 });
    return true;
  }

  private cleanseNearbyCorruption(source: Unit) {
    const cleansers = this.aliveMembers(source).filter((member) => member.mp >= 10);
    if (cleansers.length === 0) {
      return false;
    }

    const target = this.units
      .filter(
        (unit) =>
          unit !== source &&
          this.aliveMembers(unit).length > 0 &&
          unit.corruption > 0 &&
          distance(source, unit) <= source.engagementRange,
      )
      .sort((a, b) => Number(b.team === "demon") - Number(a.team === "demon") || b.corruption - a.corruption)[0];

    if (!target) {
      return false;
    }

    source.facingX = facingToward(source, target, source.facingX);
    target.corruption = clamp(target.corruption - cleansers.length * 22, 0, 100);
    for (const cleanser of cleansers) {
      cleanser.mp = clamp(cleanser.mp - 10, 0, cleanser.maxMp);
    }

    if (target.team === "demon" && target.corruption <= 0) {
      this.convertUnitTeam(target, "angel");
    } else {
      this.redrawUnit(target);
    }
    this.createShockwave({ x: source.x, y: source.y, range: source.engagementRange * 0.38, color: 0xd9c4ff });
    return true;
  }

  private spendUnitMp(unit: Unit, amount: number) {
    for (const member of this.aliveMembers(unit)) {
      member.mp = clamp(member.mp - amount, 0, member.maxMp);
    }
  }

  private unitBuildsTension(unit: Unit) {
    return unit.special && unit.team === "angel" && unit.maxTension > 0;
  }

  private addUnitTension(unit: Unit, amount: number) {
    if (!this.unitBuildsTension(unit) || amount <= 0 || unit.tension >= unit.maxTension) {
      return;
    }

    unit.tension = clamp(unit.tension + amount, 0, unit.maxTension);
    this.redrawUnit(unit);
    if (unit === this.selectedUnit) {
      this.updateHud();
    }
  }

  private releaseSelectedTensionBurst() {
    if (this.selectedTower) {
      this.releaseSelectedTowerTensionBurst();
      return;
    }

    this.releaseSelectedUnitTensionBurst();
  }

  private releaseSelectedUnitTensionBurst() {
    const unit = this.selectedUnit;
    if (!unit || !this.unitBuildsTension(unit) || this.aliveMembers(unit).length === 0) {
      return;
    }

    if (unit.tension < unit.maxTension) {
      this.setStatus(`${unit.name} is still building tension`, 1100);
      return;
    }

    const affected = this.releaseSpecialAngelBurst(unit);
    if (affected === 0) {
      this.setStatus("No targets in burst range", 1000);
      return;
    }

    unit.tension = 0;
    unit.pose = "special";
    unit.poseTimerMs = 720;
    this.createTensionBurstAnimation({ x: unit.x, y: unit.y, range: SPECIAL_ANGEL_BURST_RANGE * 1.35, color: unit.tint });
    this.redrawUnit(unit);
    this.updateHud();
    this.setStatus(`${unit.name} released Tension Burst`, 1400);
  }

  private releaseSpecialAngelBurst(unit: Unit) {
    switch (unit.specialAbility) {
      case "healer":
        this.createShockwave({ x: unit.x, y: unit.y, range: SPECIAL_ANGEL_BURST_RANGE, color: unit.tint });
        return this.healAngelUnitsInRange(unit, SPECIAL_ANGEL_BURST_RANGE, 96, 44);
      case "cleanse":
        this.createShockwave({ x: unit.x, y: unit.y, range: SPECIAL_ANGEL_BURST_RANGE * 1.15, color: unit.tint });
        return (
          this.cleanseUnitsInRange(unit, SPECIAL_ANGEL_BURST_RANGE * 1.15, 100) +
          this.healAngelUnitsInRange(unit, SPECIAL_ANGEL_BURST_RANGE * 0.85, 34, 24)
        );
      case "washback":
        return this.releaseWashbackBurst(unit);
      case "boardSlash":
        return this.releaseBoardDamageBurst(unit, 116, 0xffe1ad);
      case "archangel":
        return (
          this.releaseBoardDamageBurst(unit, 168, 0xfff2bd) +
          this.healAngelUnitsInRange(unit, Math.max(this.map.width, this.map.height), 62, 28) +
          this.cleanseUnitsInRange(unit, Math.max(this.map.width, this.map.height), 45)
        );
      default:
        return 0;
    }
  }

  private healAngelUnitsInRange(origin: Point, range: number, hpAmount: number, mpAmount: number) {
    let affected = 0;
    for (const unit of this.units) {
      if (unit.team !== "angel" || this.aliveMembers(unit).length === 0 || distance(origin, unit) > range) {
        continue;
      }

      let restored = false;
      for (const member of unit.members) {
        if (member.hp <= 0) {
          continue;
        }
        const oldHp = member.hp;
        const oldMp = member.mp;
        member.hp = clamp(member.hp + hpAmount, 0, member.maxHp);
        member.mp = clamp(member.mp + mpAmount, 0, member.maxMp);
        restored = restored || member.hp > oldHp || member.mp > oldMp;
      }

      if (restored) {
        this.redrawUnit(unit);
        affected += 1;
      }
    }
    return affected;
  }

  private cleanseUnitsInRange(origin: Point, range: number, amount: number) {
    let affected = 0;
    for (const unit of this.units) {
      if (unit.corruption <= 0 || this.aliveMembers(unit).length === 0 || distance(origin, unit) > range) {
        continue;
      }

      unit.corruption = clamp(unit.corruption - amount, 0, 100);
      affected += 1;
      if (unit.team === "demon" && unit.corruption <= 0) {
        this.convertUnitTeam(unit, "angel");
      } else {
        this.redrawUnit(unit);
      }
    }
    return affected;
  }

  private releaseWashbackBurst(unit: Unit) {
    let affected = 0;
    const range = SPECIAL_ANGEL_BURST_RANGE * 1.08;
    this.createShockwave({ x: unit.x, y: unit.y, range, color: 0x8ed8ff });

    for (const enemy of this.enemies) {
      if (enemy.hp <= 0 || distance(unit, enemy) > range) {
        continue;
      }
      enemy.hp = clamp(enemy.hp - this.unitDamage(unit, 42), 0, enemy.maxHp);
      this.pushEnemyBack(enemy, 260);
      this.redrawEnemy(enemy);
      affected += 1;
    }

    for (const target of this.units) {
      if (target.team !== "demon" || this.aliveMembers(target).length === 0 || distance(unit, target) > range) {
        continue;
      }
      this.damageUnit(target, this.unitDamage(unit, 42));
      this.setUnitPathDestination(target, this.pathRespectingAutoMoveDestination(target, this.nearestPortalPoint(target) ?? target), false, true);
      target.tensionSlowMs = Math.max(target.tensionSlowMs ?? 0, TOWER_TENSION_SLOW_DURATION_MS);
      this.redrawUnit(target);
      affected += 1;
    }

    if (affected > 0) {
      this.cleanupDeadEnemies();
    }
    return affected;
  }

  private releaseBoardDamageBurst(unit: Unit, damage: number, color: number) {
    let affected = 0;
    const burstDamage = this.unitDamage(unit, damage);
    this.createShockwave({ x: unit.x, y: unit.y, range: Math.max(this.map.width, this.map.height), color });

    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) {
        continue;
      }
      enemy.hp = clamp(enemy.hp - burstDamage, 0, enemy.maxHp);
      this.redrawEnemy(enemy);
      affected += 1;
    }

    for (const target of this.units) {
      if (target.team !== "demon" || this.aliveMembers(target).length === 0) {
        continue;
      }
      this.damageUnit(target, burstDamage);
      this.redrawUnit(target);
      affected += 1;
    }

    if (affected > 0) {
      this.cleanupDeadEnemies();
    }
    return affected;
  }

  private pushEnemyBack(enemy: Enemy, travel: number) {
    const path = this.map.paths[enemy.pathId] ?? this.map.paths[0];
    let remaining = travel;
    enemy.attackingGate = false;

    while (remaining > 0 && enemy.pathIndex > 0) {
      const previous = path[enemy.pathIndex];
      const current = { x: enemy.x, y: enemy.y };
      const segmentDistance = distance(current, previous);
      if (segmentDistance <= remaining) {
        enemy.x = previous.x;
        enemy.y = previous.y;
        enemy.pathIndex -= 1;
        remaining -= segmentDistance;
      } else {
        enemy.x += ((previous.x - current.x) / segmentDistance) * remaining;
        enemy.y += ((previous.y - current.y) / segmentDistance) * remaining;
        remaining = 0;
      }
    }

    enemy.container.position.set(enemy.x, enemy.y);
    enemy.facingX = facingToward(enemy, path[Math.min(path.length - 1, enemy.pathIndex + 1)], enemy.facingX);
  }

  private towerTensionGainMultiplier(tower: Tower) {
    return 1 + Math.max(0, tower.level - 1) * 0.2;
  }

  private towerTensionBurstRange(tower: Tower) {
    return tower.range + TOWER_TENSION_BASE_RANGE_BONUS + tower.level * TOWER_TENSION_RANGE_PER_LEVEL;
  }

  private towerTargets(tower: Tower) {
    const enemies = this.enemies.filter((enemy) => enemy.hp > 0 && this.pointInTowerRange(tower, enemy));
    const units = this.units.filter(
      (unit) => unit.team === "demon" && this.aliveMembers(unit).length > 0 && this.pointInTowerRange(tower, unit),
    );
    return { enemies, units };
  }

  private findClosestDemonTargetForTower(tower: Tower): DemonTarget | null {
    const { enemies, units } = this.towerTargets(tower);
    const enemy = enemies.sort((a, b) => distance(tower, a) - distance(tower, b))[0] ?? null;
    const unit = units.sort((a, b) => distance(tower, a) - distance(tower, b))[0] ?? null;
    if (enemy && unit) {
      return distance(tower, enemy) <= distance(tower, unit) ? { enemy } : { unit };
    }
    return enemy ? { enemy } : unit ? { unit } : null;
  }

  private addTowerTension(tower: Tower | undefined, amount: number) {
    if (!tower || tower.hp <= 0 || amount <= 0 || tower.tension >= tower.maxTension) {
      return;
    }

    tower.tension = clamp(tower.tension + amount * this.towerTensionGainMultiplier(tower), 0, tower.maxTension);
    this.redrawTower(tower);
    if (tower === this.selectedTower) {
      this.updateHud();
    }
  }

  private releaseSelectedTowerTensionBurst() {
    const tower = this.selectedTower;
    if (!tower || tower.hp <= 0) {
      return;
    }

    if (tower.tension < tower.maxTension) {
      this.setStatus(`${tower.name} is still building tension`, 1100);
      return;
    }

    const burstRange = this.towerTensionBurstRange(tower);
    let affected = 0;

    if (tower.behavior === "support") {
      affected = this.releaseSupportTensionBurst(tower, burstRange);
    } else if (tower.behavior === "slow") {
      affected = this.releaseSlowTensionBurst(tower, burstRange);
    } else {
      affected = this.releaseDamageTensionBurst(tower, burstRange);
    }

    if (affected === 0) {
      this.setStatus("No targets in burst range", 1000);
      return;
    }

    tower.tension = 0;
    tower.firePulseMs = Math.max(tower.firePulseMs, 720);
    this.createTensionBurstAnimation({ x: tower.x, y: tower.y, range: burstRange, color: tower.color });
    this.redrawTower(tower);
    this.updateHud();
    this.setStatus(`${tower.name} released Tension Burst`, 1400);
  }

  private releaseDamageTensionBurst(tower: Tower, burstRange: number) {
    const burstDamage = this.towerDamage(Math.max(tower.damage, 28 + tower.level * 8) * TOWER_TENSION_DAMAGE_MULTIPLIER);
    let affected = 0;

    for (const enemy of this.enemies) {
      if (enemy.hp <= 0 || distance(tower, enemy) > burstRange) {
        continue;
      }
      enemy.hp = clamp(enemy.hp - burstDamage, 0, enemy.maxHp);
      this.redrawEnemy(enemy);
      affected += 1;
    }

    for (const unit of this.units) {
      if (unit.team !== "demon" || this.aliveMembers(unit).length === 0 || distance(tower, unit) > burstRange) {
        continue;
      }
      this.damageUnit(unit, burstDamage);
      this.redrawUnit(unit);
      affected += 1;
    }

    if (affected > 0) {
      this.cleanupDeadEnemies();
    }
    return affected;
  }

  private releaseSupportTensionBurst(tower: Tower, burstRange: number) {
    let affected = 0;
    const healAmount = Math.round((34 + tower.level * 8) * TOWER_TENSION_HEAL_MULTIPLIER);
    const mpAmount = Math.round(24 + tower.level * 6);

    for (const unit of this.units) {
      if (unit.team !== "angel" || this.aliveMembers(unit).length === 0 || distance(tower, unit) > burstRange) {
        continue;
      }

      let restored = false;
      for (const member of unit.members) {
        if (member.hp <= 0) {
          continue;
        }
        const oldHp = member.hp;
        const oldMp = member.mp;
        member.hp = clamp(member.hp + healAmount, 0, member.maxHp);
        member.mp = clamp(member.mp + mpAmount, 0, member.maxMp);
        restored = restored || member.hp > oldHp || member.mp > oldMp;
      }

      if (restored) {
        this.redrawUnit(unit);
        affected += 1;
      }
    }

    return affected;
  }

  private releaseSlowTensionBurst(tower: Tower, burstRange: number) {
    let affected = 0;
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0 || distance(tower, enemy) > burstRange) {
        continue;
      }
      enemy.tensionSlowMs = Math.max(enemy.tensionSlowMs ?? 0, TOWER_TENSION_SLOW_DURATION_MS);
      enemy.projectileCooldownMs += 650;
      affected += 1;
    }

    for (const unit of this.units) {
      if (unit.team !== "demon" || this.aliveMembers(unit).length === 0 || distance(tower, unit) > burstRange) {
        continue;
      }
      unit.tensionSlowMs = Math.max(unit.tensionSlowMs ?? 0, TOWER_TENSION_SLOW_DURATION_MS);
      unit.attackTimerMs += 650;
      affected += 1;
    }

    return affected;
  }

  private updateTowers(deltaMs: number) {
    for (const tower of this.towers) {
      tower.hitTimerMs = Math.max(0, tower.hitTimerMs - deltaMs);
      this.animateTower(tower, deltaMs);
      this.redrawTower(tower);
      if (tower.hp <= 0) {
        continue;
      }

      tower.cooldownRemainingMs -= deltaMs;
      if (tower.cooldownRemainingMs > 0) {
        continue;
      }

      if (tower.behavior === "support") {
        const restored = this.supportNearbyUnits(tower);
        this.addTowerTension(tower, restored / 16);
        tower.firePulseMs = 420;
        tower.cooldownRemainingMs = tower.cooldownMs;
        continue;
      }

      if (tower.behavior === "slow") {
        const affectedTargets = this.towerTargets(tower);
        const hasTargets = affectedTargets.enemies.length > 0 || affectedTargets.units.length > 0;
        if (!hasTargets) {
          continue;
        }
        this.createShockwave(tower);
        const affectedCount = affectedTargets.enemies.length + affectedTargets.units.length;
        this.addTowerTension(tower, affectedCount * TOWER_TENSION_GAIN_PER_SLOWED_TARGET);
        tower.firePulseMs = 520;
        tower.cooldownRemainingMs = tower.cooldownMs;
        continue;
      }

      if (tower.behavior === "shockwave") {
        const { enemies: targets, units: unitTargets } = this.towerTargets(tower);
        if (targets.length === 0 && unitTargets.length === 0) {
          continue;
        }
        for (const enemy of targets) {
          enemy.hp = clamp(enemy.hp - this.towerDamage(tower.damage), 0, enemy.maxHp);
          this.redrawEnemy(enemy);
        }
        for (const unit of unitTargets) {
          this.damageUnit(unit, this.towerDamage(tower.damage));
          this.redrawUnit(unit);
        }
        this.createShockwave(tower);
        this.addTowerTension(tower, (targets.length + unitTargets.length) * TOWER_TENSION_GAIN_PER_SHOCKWAVE_TARGET);
        tower.firePulseMs = 460;
        tower.cooldownRemainingMs = tower.cooldownMs;
        continue;
      }

      if (tower.behavior === "beam") {
        const target = this.findClosestDemonTargetForTower(tower);
        if (!target) {
          continue;
        }

        this.createTowerBeam(tower, target);
        this.addTowerTension(tower, TOWER_TENSION_GAIN_PER_HIT);
        tower.firePulseMs = Math.max(tower.beamDurationMs ?? 420, 420);
        tower.cooldownRemainingMs = tower.cooldownMs;
        continue;
      }

      const target = this.findClosestDemonTargetForTower(tower);
      if (!target) {
        continue;
      }

      if (target.enemy) {
        this.createProjectile(
          { x: tower.x, y: tower.y - 38 },
          target.enemy,
          tower.projectileSpeed,
          this.towerDamage(tower.damage),
          tower.color,
          undefined,
          tower,
        );
      } else {
        this.createUnitProjectile(
          { x: tower.x, y: tower.y - 38 },
          target.unit,
          "angel",
          tower.projectileSpeed,
          this.towerDamage(tower.damage),
          tower.color,
          undefined,
          tower,
        );
      }
      tower.firePulseMs = 280;
      tower.cooldownRemainingMs = tower.cooldownMs;
    }
  }

  private animateTower(tower: Tower, deltaMs: number) {
    const type = TOWER_TYPES[tower.kind as TowerKind];
    tower.animationTimeMs += deltaMs;
    tower.firePulseMs = Math.max(0, tower.firePulseMs - deltaMs);

    const phase = (tower.animationTimeMs % type.animation.cycleMs) / type.animation.cycleMs;
    const wave = Math.sin(phase * TAU);
    const fire = tower.firePulseMs > 0 ? tower.firePulseMs / 460 : 0;
    const scale = tower.baseScale * (1 + wave * type.animation.pulse + fire * 0.12);
    const rangePhase = (tower.animationTimeMs % 1250) / 1250;

    tower.rangeRing.clear();
    if (tower.showRange) {
      tower.rangeRing
        .circle(0, 0, tower.range)
        .stroke({ color: tower.color, width: 2, alpha: 0.22 });
      if (tower.innerRange > 0) {
        tower.rangeRing
          .circle(0, 0, tower.innerRange)
          .stroke({ color: 0xff7f6f, width: 2, alpha: 0.44 });
      }
      tower.rangeRing
        .circle(0, 0, tower.innerRange + (tower.range - tower.innerRange) * (0.18 + rangePhase * 0.82))
        .stroke({ color: tower.color, width: 4 * (1 - rangePhase), alpha: 0.52 * (1 - rangePhase) });
    }

    tower.sprite.scale.set(scale);
    tower.sprite.position.y = -fire * 4;

    if (tower.kind === "judgmentLens") {
      tower.sprite.rotation = wave * 0.018 + fire * 0.045;
    } else if (tower.kind === "harmonicBell") {
      tower.sprite.rotation = wave * 0.012;
    } else if (tower.kind === "flameChoir") {
      tower.sprite.rotation = wave * 0.008;
    } else {
      tower.sprite.rotation = 0;
    }

    const glowAlpha = type.animation.glow + Math.abs(wave) * 0.12 + fire * 0.34;
    tower.glow
      .clear()
      .ellipse(0, 7, 42 + fire * 16, 16 + fire * 5)
      .fill({ color: tower.color, alpha: glowAlpha });

    tower.effectRing.clear();
    if (tower.kind === "harmonicBell") {
      const r1 = 28 + ((phase * 70) % 70);
      const r2 = 28 + (((phase + 0.45) * 70) % 70);
      tower.effectRing
        .circle(0, 0, r1)
        .stroke({ color: tower.color, width: 2, alpha: 0.28 * (1 - r1 / 105) + fire * 0.12 })
        .circle(0, 0, r2)
        .stroke({ color: tower.color, width: 2, alpha: 0.22 * (1 - r2 / 105) + fire * 0.1 });
    } else if (tower.kind === "sanctuaryWell") {
      const height = 34 + Math.abs(wave) * 16 + fire * 20;
      tower.effectRing
        .roundRect(-9, -height, 18, height, 8)
        .fill({ color: tower.color, alpha: 0.18 + fire * 0.25 })
        .circle(0, -height, 18 + Math.abs(wave) * 4)
        .stroke({ color: tower.color, width: 2, alpha: 0.32 + fire * 0.2 });
    } else if (tower.kind === "flameChoir") {
      tower.effectRing
        .circle(Math.sin(phase * TAU * 3) * 8, -48 - Math.abs(wave) * 8, 10 + Math.abs(wave) * 6)
        .fill({ color: tower.color, alpha: 0.22 + fire * 0.28 });
    } else if (tower.kind === "prismChain") {
      tower.effectRing
        .moveTo(-34, -34)
        .lineTo(0, -54 - Math.abs(wave) * 8)
        .lineTo(34, -34)
        .stroke({ color: tower.color, width: 2 + fire * 2, alpha: 0.22 + fire * 0.38 });
    } else if (tower.kind === "temporalFont") {
      const field = 58 + Math.abs(wave) * 18 + fire * 40;
      tower.effectRing
        .ellipse(0, -12, field, field * 0.48)
        .stroke({ color: tower.color, width: 2 + fire * 2, alpha: 0.22 + fire * 0.3 })
        .ellipse(0, -12, field * 0.62, field * 0.3)
        .stroke({ color: 0xffffff, width: 1, alpha: 0.16 + fire * 0.22 });
    } else if (fire > 0) {
      tower.effectRing
        .circle(0, -38, 28 + fire * 34)
        .stroke({ color: tower.color, width: 3, alpha: 0.42 * fire });
    }
  }

  private redrawTower(tower: Tower) {
    const hpPercent = clamp(tower.hp / tower.maxHp, 0, 1);
    const tensionPercent = clamp(tower.tension / tower.maxTension, 0, 1);
    tower.selectionRing.clear();
    if (tensionPercent >= 1) {
      tower.selectionRing
        .circle(0, -4, 64)
        .stroke({ color: 0xffb16f, width: 3, alpha: 0.72 })
        .circle(0, -4, 70)
        .stroke({ color: 0xffefd1, width: 1, alpha: 0.42 });
    }
    if (tower.selected) {
      tower.selectionRing
        .ellipse(0, 8, 52, 20)
        .stroke({ color: tower.color, width: 3, alpha: 0.86 })
        .circle(0, 0, 58)
        .stroke({ color: tower.color, width: 2, alpha: 0.16 });
    }

    tower.sprite.tint = tower.hitTimerMs > 0 ? 0xffb3ba : 0xffffff;
    tower.hpBar.visible = tower.selected || tower.hp < tower.maxHp;
    tower.hpBar
      .clear()
      .roundRect(0, 0, 60, 5, 3)
      .fill({ color: 0x130c0e, alpha: 0.78 })
      .roundRect(0, 0, 60 * hpPercent, 5, 3)
      .fill(hpPercent > 0.38 ? 0x91d18b : 0xdf6b61);
  }

  private supportNearbyUnits(tower: Tower) {
    let supported = false;
    let restored = 0;
    for (const unit of this.units) {
      if (unit.team !== "angel" || !this.pointInTowerRange(tower, unit)) {
        continue;
      }

      for (const member of unit.members) {
        if (member.hp <= 0) {
          continue;
        }
        const oldHp = member.hp;
        const oldMp = member.mp;
        member.hp = clamp(member.hp + 6, 0, member.maxHp);
        member.mp = clamp(member.mp + 9, 0, member.maxMp);
        restored += member.hp - oldHp + (member.mp - oldMp) * 0.55;
        supported = true;
      }
    }

    if (supported) {
      this.createShockwave({ x: tower.x, y: tower.y, range: tower.range * 0.42, color: 0x8ed8ff });
    }
    return restored;
  }

  private getEnemySlowMultiplier(origin: Point) {
    const tensionSlowMs = "tensionSlowMs" in origin ? Number(origin.tensionSlowMs) : 0;
    let strongestSlow = tensionSlowMs > 0 ? 0.72 : 0;
    for (const tower of this.towers) {
      if (tower.hp <= 0 || tower.behavior !== "slow" || !this.pointInTowerRange(tower, origin)) {
        continue;
      }

      strongestSlow = Math.max(strongestSlow, tower.slowPercent ?? 0.4);
    }

    return 1 - clamp(strongestSlow, 0, 0.75);
  }

  private updateEnemies(deltaMs: number) {
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) {
        continue;
      }
      enemy.tensionSlowMs = Math.max(0, (enemy.tensionSlowMs ?? 0) - deltaMs);

      this.updateEnemyProjectile(enemy, deltaMs);

      const blockingUnit = this.findClosestAliveUnit(enemy, 78, "angel");
      if (blockingUnit) {
        enemy.facingX = facingToward(enemy, blockingUnit, enemy.facingX);
        const corruption = this.enemyCanCorrupt(enemy.kind as EnemyKind)
          ? this.enemyDamage((deltaMs / 1000) * DEMON_MELEE_CORRUPTION_PER_SECOND)
          : 0;
        this.damageUnit(
          blockingUnit,
          this.enemyDamage((deltaMs / 1000) * 2.6),
          corruption,
        );
        enemy.container.position.set(enemy.x, enemy.y);
        this.animateEnemy(enemy, deltaMs, true);
        this.redrawEnemy(enemy);
        continue;
      }

      const blockingTower = this.findClosestTower(enemy, 86);
      if (blockingTower) {
        enemy.facingX = facingToward(enemy, blockingTower, enemy.facingX);
        this.damageTower(blockingTower, (enemy.gateDamagePerSecond * deltaMs) / 1300);
        enemy.container.position.set(enemy.x, enemy.y);
        this.animateEnemy(enemy, deltaMs, true);
        this.redrawEnemy(enemy);
        continue;
      }

      if (enemy.attackingGate) {
        enemy.facingX = facingToward(enemy, this.map.gate, enemy.facingX);
        const slowMultiplier = this.getEnemySlowMultiplier(enemy);
        this.gateHp = clamp(
          this.gateHp - (enemy.gateDamagePerSecond * slowMultiplier * deltaMs) / 1000,
          0,
          this.map.gate.maxHp,
        );
        continue;
      }

      this.advanceEnemyAlongPath(enemy, (enemy.speed * this.getEnemySlowMultiplier(enemy) * deltaMs) / 1000);
      enemy.container.position.set(enemy.x, enemy.y);
      this.animateEnemy(enemy, deltaMs, false);
      this.redrawEnemy(enemy);
    }
  }

  private updateEnemyProjectile(enemy: Enemy, deltaMs: number) {
    const type = ENEMY_TYPES[enemy.kind as EnemyKind];
    if (!("projectile" in type)) {
      return;
    }

    enemy.projectileCooldownMs -= deltaMs;
    if (enemy.projectileCooldownMs > 0) {
      return;
    }

    const target = this.findClosestAngelTarget(enemy, type.projectile.range);
    if (!target) {
      return;
    }

    enemy.facingX = facingToward(enemy, combatTargetPoint(target), enemy.facingX);
    this.createDemonProjectile(
      { x: enemy.x, y: enemy.y - 42 },
      target.unit ?? target.tower,
      type.projectile.speed,
      this.enemyDamage(type.projectile.damage),
      type.projectile.color,
      undefined,
      this.projectileCorrupts(type.projectile),
    );
    enemy.projectileCooldownMs = type.projectile.cooldownMs;
  }

  private enemyCanCorrupt(kind: EnemyKind) {
    const type = ENEMY_TYPES[kind];
    return "projectile" in type && this.projectileCorrupts(type.projectile);
  }

  private animateEnemy(enemy: Enemy, deltaMs: number, blocked: boolean) {
    const type = ENEMY_TYPES[enemy.kind as EnemyKind];
    const animation = type.walkAnimation;
    enemy.walkTimeMs += deltaMs * (blocked ? 0.35 : 1);

    const phase = (enemy.walkTimeMs % animation.cycleMs) / animation.cycleMs;
    const step = Math.sin(phase * TAU);
    const doubleStep = Math.sin(phase * TAU * 2);
    const stride = blocked ? 0.35 : 1;
    const bob = Math.abs(doubleStep) * animation.bobPx * stride;
    const drift = step * animation.driftPx * stride;
    const scaleX = enemy.baseScale * (1 + Math.abs(step) * animation.scaleX * stride);
    const scaleY = enemy.baseScale * (1 - Math.abs(step) * animation.scaleY * stride + (blocked ? 0.018 : 0));

    enemy.sprite.scale.set(-enemy.facingX * scaleX, scaleY);
    enemy.sprite.position.set(drift * enemy.facingX, -bob);
    enemy.sprite.rotation = ((step * animation.swayDeg * Math.PI) / 180) * enemy.facingX;

    if (enemy.kind === "shadowCaster") {
      enemy.sprite.position.y -= 8 + Math.sin(phase * TAU) * 5;
      enemy.sprite.rotation *= 0.35;
    } else if (enemy.kind === "flyingHarrier") {
      enemy.sprite.position.y -= 18 + Math.abs(step) * 12;
      enemy.sprite.rotation += Math.sin(phase * TAU * 1.5) * 0.035;
    } else if (enemy.kind === "darkArchangel") {
      enemy.sprite.position.y -= 5 + Math.sin(phase * TAU) * 2;
      enemy.sprite.rotation *= 0.45;
    } else if (enemy.kind === "siegeBrute") {
      enemy.sprite.position.y += Math.max(0, -doubleStep) * 2;
      enemy.sprite.rotation *= 0.35;
    }

    enemy.aura
      .clear()
      .ellipse(0, 10, enemy.kind === "darkArchangel" ? 48 : 34, 11)
      .fill({ color: 0x16090c, alpha: 0.42 + Math.abs(step) * 0.16 });
  }

  private damageUnit(unit: Unit, damage: number, corruption = 0) {
    const member = this.pickDamageReceiver(unit);
    if (!member) {
      return;
    }

    const previousHp = member.hp;
    member.hitTimerMs = 170;
    member.hp = clamp(member.hp - damage * unit.defense, 0, member.maxHp);
    if (previousHp > 0 && member.hp <= 0) {
      member.mp = 0;
      member.deathTimerMs = 0;
    }

    if (corruption > 0 && unit.team === "angel") {
      unit.corruption = clamp(unit.corruption + corruption, 0, 100);
      if (unit.corruption >= 100) {
        this.convertUnitTeam(unit, "demon");
      }
    }
  }

  private damageTower(tower: Tower, damage: number) {
    if (tower.hp <= 0) {
      return;
    }

    tower.hitTimerMs = 170;
    tower.hp = clamp(tower.hp - damage, 0, tower.maxHp);
    tower.firePulseMs = Math.max(tower.firePulseMs, 120);
    this.redrawTower(tower);
    if (tower.hp <= 0) {
      this.setStatus(`${tower.name} destroyed`, 1400);
    }
  }

  private advanceEnemyAlongPath(enemy: Enemy, travel: number) {
    const path = this.map.paths[enemy.pathId] ?? this.map.paths[0];
    while (travel > 0 && enemy.pathIndex < path.length - 1) {
      const current = { x: enemy.x, y: enemy.y };
      const next = path[enemy.pathIndex + 1];
      const segmentDistance = distance(current, next);
      enemy.facingX = facingToward(current, next, enemy.facingX);

      if (segmentDistance <= travel) {
        enemy.x = next.x;
        enemy.y = next.y;
        enemy.pathIndex += 1;
        travel -= segmentDistance;
      } else {
        enemy.x += ((next.x - current.x) / segmentDistance) * travel;
        enemy.y += ((next.y - current.y) / segmentDistance) * travel;
        travel = 0;
      }
    }

    if (enemy.pathIndex >= path.length - 1) {
      enemy.attackingGate = true;
      enemy.x = path[path.length - 1].x;
      enemy.y = path[path.length - 1].y;
    }
  }

  private updateProjectiles(deltaMs: number) {
    const deadProjectiles: Projectile[] = [];

    for (const projectile of this.projectiles) {
      const targetEnemy = projectile.target;
      const targetUnit = projectile.targetUnit;
      const targetTower = projectile.targetTower;

      if (targetEnemy && targetEnemy.hp <= 0) {
        deadProjectiles.push(projectile);
        continue;
      }

      if (targetUnit && (!this.units.includes(targetUnit) || this.aliveMembers(targetUnit).length === 0)) {
        deadProjectiles.push(projectile);
        continue;
      }

      if (targetUnit && targetUnit.team === projectile.allegiance) {
        deadProjectiles.push(projectile);
        continue;
      }

      if (targetTower && (!this.towers.includes(targetTower) || targetTower.hp <= 0)) {
        deadProjectiles.push(projectile);
        continue;
      }

      if (!targetEnemy && !targetUnit && !targetTower) {
        deadProjectiles.push(projectile);
        continue;
      }

      const targetPoint = targetEnemy
        ? {
            x: targetEnemy.x + (projectile.targetOffset?.x ?? 0),
            y: targetEnemy.y - 14 + (projectile.targetOffset?.y ?? 0),
          }
        : targetUnit
          ? {
              x: targetUnit.x + (projectile.targetOffset?.x ?? 0),
              y: targetUnit.y - 24 + (projectile.targetOffset?.y ?? 0),
            }
          : {
              x: targetTower!.x + (projectile.targetOffset?.x ?? 0),
              y: targetTower!.y - 42 + (projectile.targetOffset?.y ?? 0),
            };
      const projectilePoint = { x: projectile.x, y: projectile.y };
      const targetDistance = distance(projectilePoint, targetPoint);
      const travel = (projectile.speed * deltaMs) / 1000;

      if (targetDistance <= travel) {
        if (targetEnemy) {
          targetEnemy.hp = clamp(targetEnemy.hp - projectile.damage, 0, targetEnemy.maxHp);
          this.redrawEnemy(targetEnemy);
          this.addTowerTension(projectile.sourceTower, TOWER_TENSION_GAIN_PER_HIT);
        } else if (targetUnit) {
          const corruption = projectile.corrupts ? projectile.damage * DEMON_PROJECTILE_CORRUPTION_FACTOR : 0;
          this.damageUnit(targetUnit, projectile.damage, corruption);
          if (this.units.includes(targetUnit)) {
            this.redrawUnit(targetUnit);
          }
          if (projectile.allegiance === "angel") {
            this.addTowerTension(projectile.sourceTower, TOWER_TENSION_GAIN_PER_HIT);
          }
        } else if (targetTower) {
          this.damageTower(targetTower, projectile.damage);
        }
        deadProjectiles.push(projectile);
      } else {
        projectile.x += ((targetPoint.x - projectile.x) / targetDistance) * travel;
        projectile.y += ((targetPoint.y - projectile.y) / targetDistance) * travel;
        projectile.graphic.position.set(projectile.x, projectile.y);
      }
    }

    for (const projectile of deadProjectiles) {
      this.projectileLayer.removeChild(projectile.graphic);
      projectile.graphic.destroy();
    }
    this.projectiles = this.projectiles.filter((projectile) => !deadProjectiles.includes(projectile));
  }

  private updateBeams(deltaMs: number) {
    const deadBeams: Beam[] = [];

    for (const beam of this.beams) {
      beam.ageMs += deltaMs;
      if (beam.ageMs >= beam.durationMs) {
        deadBeams.push(beam);
        continue;
      }

      this.drawBeam(beam);
    }

    for (const beam of deadBeams) {
      this.projectileLayer.removeChild(beam.graphic);
      beam.graphic.destroy();
    }
    this.beams = this.beams.filter((beam) => !deadBeams.includes(beam));
  }

  private drawBeam(beam: Beam) {
    if (beam.target && beam.target.hp > 0) {
      beam.targetPoint = {
        x: beam.target.x + (beam.targetOffset?.x ?? 0),
        y: beam.target.y - 14 + (beam.targetOffset?.y ?? 0),
      };
    } else if (
      beam.targetUnit &&
      this.units.includes(beam.targetUnit) &&
      this.aliveMembers(beam.targetUnit).length > 0 &&
      beam.targetUnit.team !== beam.allegiance
    ) {
      beam.targetPoint = {
        x: beam.targetUnit.x + (beam.targetOffset?.x ?? 0),
        y: beam.targetUnit.y - 24 + (beam.targetOffset?.y ?? 0),
      };
    }

    const remaining = 1 - beam.ageMs / beam.durationMs;
    const alpha = clamp(Math.min(1, remaining * 1.8), 0, 1);
    const pulse = 0.85 + Math.sin((beam.ageMs / beam.durationMs) * TAU * 2.2) * 0.15;
    const width = beam.width * pulse;

    beam.graphic
      .clear()
      .moveTo(beam.origin.x, beam.origin.y)
      .lineTo(beam.targetPoint.x, beam.targetPoint.y)
      .stroke({ color: beam.color, width: width * 3.8, alpha: 0.12 * alpha })
      .moveTo(beam.origin.x, beam.origin.y)
      .lineTo(beam.targetPoint.x, beam.targetPoint.y)
      .stroke({ color: beam.color, width: width * 1.9, alpha: 0.38 * alpha })
      .moveTo(beam.origin.x, beam.origin.y)
      .lineTo(beam.targetPoint.x, beam.targetPoint.y)
      .stroke({ color: 0xffffff, width: Math.max(2, width * 0.45), alpha: 0.92 * alpha })
      .circle(beam.targetPoint.x, beam.targetPoint.y, width * 1.35)
      .fill({ color: beam.color, alpha: 0.18 * alpha })
      .circle(beam.targetPoint.x, beam.targetPoint.y, Math.max(2, width * 0.5))
      .fill({ color: 0xffffff, alpha: 0.72 * alpha });
  }

  private createTowerBeam(tower: Tower, target: DemonTarget) {
    const targetPoint = target.enemy
      ? { x: target.enemy.x, y: target.enemy.y - 14 }
      : { x: target.unit.x, y: target.unit.y - 24 };
    const beam: Beam = {
      allegiance: "angel",
      ageMs: 0,
      durationMs: tower.beamDurationMs ?? 420,
      width: tower.beamWidth ?? 12,
      color: tower.color,
      origin: { x: tower.x, y: tower.y - 46 },
      targetPoint,
      target: target.enemy,
      targetUnit: target.unit,
      graphic: new Graphics(),
    };

    this.projectileLayer.addChild(beam.graphic);
    this.beams.push(beam);
    this.drawBeam(beam);
    const damage = this.towerDamage(tower.damage);

    if (target.enemy) {
      target.enemy.hp = clamp(target.enemy.hp - damage, 0, target.enemy.maxHp);
      this.redrawEnemy(target.enemy);
    } else {
      this.damageUnit(target.unit, damage);
      this.redrawUnit(target.unit);
    }
    this.audio.playProjectile();
  }

  private createProjectile(
    origin: Point,
    target: Enemy,
    speed: number,
    damage: number,
    color: number,
    targetOffset?: Point,
    sourceTower?: Tower,
  ) {
    const graphic = new Graphics()
      .circle(0, 0, 6)
      .fill(color)
      .circle(0, 0, 13)
      .stroke({ color, width: 2, alpha: 0.28 });
    graphic.position.set(origin.x, origin.y);
    this.projectileLayer.addChild(graphic);

    this.projectiles.push({
      allegiance: "angel",
      x: origin.x,
      y: origin.y,
      speed,
      damage,
      target,
      sourceTower,
      targetOffset,
      graphic,
    });
    this.audio.playProjectile();
  }

  private createUnitProjectile(
    origin: Point,
    targetUnit: Unit,
    allegiance: UnitTeam,
    speed: number,
    damage: number,
    color: number,
    targetOffset?: Point,
    sourceTower?: Tower,
  ) {
    const graphic = new Graphics()
      .circle(0, 0, 6)
      .fill(color)
      .circle(0, 0, 13)
      .stroke({ color, width: 2, alpha: 0.3 });
    graphic.position.set(origin.x, origin.y);
    this.projectileLayer.addChild(graphic);

    this.projectiles.push({
      allegiance,
      x: origin.x,
      y: origin.y,
      speed,
      damage,
      targetUnit,
      sourceTower,
      targetOffset,
      graphic,
    });

    if (allegiance === "demon") {
      this.audio.playDemonProjectile();
    } else {
      this.audio.playProjectile();
    }
  }

  private createDemonProjectile(
    origin: Point,
    target: Unit | Tower,
    speed: number,
    damage: number,
    color: number,
    targetOffset?: Point,
    corrupts = false,
  ) {
    const targetUnit = "members" in target ? target : undefined;
    const targetTower = "slotIndex" in target ? target : undefined;
    const graphic = new Graphics()
      .circle(0, 0, 7)
      .fill(color)
      .circle(0, 0, 15)
      .stroke({ color, width: 2, alpha: 0.34 })
      .moveTo(-13, 0)
      .lineTo(13, 0)
      .stroke({ color: 0x16071f, width: 2, alpha: 0.7 });
    graphic.position.set(origin.x, origin.y);
    this.projectileLayer.addChild(graphic);

    this.projectiles.push({
      allegiance: "demon",
      x: origin.x,
      y: origin.y,
      speed,
      damage,
      targetUnit,
      targetTower,
      corrupts,
      targetOffset,
      graphic,
    });
    this.audio.playDemonProjectile();
  }

  private createShockwave(tower: Pick<Tower, "x" | "y" | "range" | "color">, playSound = true) {
    const graphic = new Graphics();
    this.projectileLayer.addChild(graphic);
    this.shockwaves.push({
      x: tower.x,
      y: tower.y,
      radius: tower.range,
      ageMs: 0,
      durationMs: 520,
      color: tower.color,
      graphic,
    });
    if (playSound) {
      this.audio.playShockwave();
    }
  }

  private createTensionBurstAnimation(origin: Pick<Tower, "x" | "y" | "range" | "color">) {
    this.audio.playTensionBurst();
    this.createShockwave({ ...origin, range: origin.range * 0.62 }, false);
    this.createShockwave(origin, false);
    this.createShockwave({ ...origin, range: origin.range * 1.22, color: 0xffefd1 }, false);

    const graphic = new Graphics()
      .circle(origin.x, origin.y, 24)
      .fill({ color: 0xffffff, alpha: 0.34 })
      .circle(origin.x, origin.y, Math.max(70, origin.range * 0.18))
      .stroke({ color: origin.color, width: 10, alpha: 0.4 })
      .moveTo(origin.x - origin.range * 0.22, origin.y)
      .lineTo(origin.x + origin.range * 0.22, origin.y)
      .moveTo(origin.x, origin.y - origin.range * 0.22)
      .lineTo(origin.x, origin.y + origin.range * 0.22)
      .stroke({ color: 0xffefd1, width: 5, alpha: 0.64 });
    this.projectileLayer.addChild(graphic);
    this.shockwaves.push({
      x: origin.x,
      y: origin.y,
      radius: origin.range * 0.55,
      ageMs: 0,
      durationMs: 760,
      color: origin.color,
      graphic,
    });
  }

  private updateShockwaves(deltaMs: number) {
    const done: Shockwave[] = [];
    for (const shockwave of this.shockwaves) {
      shockwave.ageMs += deltaMs;
      const t = clamp(shockwave.ageMs / shockwave.durationMs, 0, 1);
      shockwave.graphic
        .clear()
        .circle(shockwave.x, shockwave.y, shockwave.radius * t)
        .stroke({ color: shockwave.color, width: 5 * (1 - t), alpha: 0.55 * (1 - t) });

      if (t >= 1) {
        done.push(shockwave);
      }
    }

    for (const shockwave of done) {
      this.projectileLayer.removeChild(shockwave.graphic);
      shockwave.graphic.destroy();
    }
    this.shockwaves = this.shockwaves.filter((shockwave) => !done.includes(shockwave));
  }

  private cleanupDeadEnemies(grantEnergy = true) {
    const dead = this.enemies.filter((enemy) => enemy.hp <= 0);
    for (const enemy of dead) {
      if (grantEnergy) {
        this.energy += enemy.energyReward;
      }
      this.enemyLayer.removeChild(enemy.container);
      enemy.container.destroy({ children: true });
    }
    if (dead.length > 0 && grantEnergy) {
      this.audio.playEnemyDefeated(dead.length);
    }
    this.enemies = this.enemies.filter((enemy) => enemy.hp > 0);
  }

  private cleanupDeadTowers() {
    const destroyed = this.towers.filter((tower) => tower.hp <= 0);
    this.towersDestroyedThisBattle += destroyed.length;
    for (const tower of destroyed) {
      this.removeTowerInstance(tower);
    }
    this.towers = this.towers.filter((tower) => tower.hp > 0);
  }

  private findClosestEnemy(origin: Point, range: number) {
    let closest: Enemy | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) {
        continue;
      }

      const enemyDistance = distance(origin, enemy);
      if (enemyDistance <= range && enemyDistance < closestDistance) {
        closest = enemy;
        closestDistance = enemyDistance;
      }
    }

    return closest;
  }

  private findClosestDemonTarget(origin: Point, range: number): DemonTarget | null {
    const enemy = this.findClosestEnemy(origin, range);
    const unit = this.findClosestAliveUnit(origin, range, "demon");
    const enemyDistance = enemy ? distance(origin, enemy) : Number.POSITIVE_INFINITY;
    const unitDistance = unit ? distance(origin, unit) : Number.POSITIVE_INFINITY;

    if (!enemy && !unit) {
      return null;
    }

    return unitDistance < enemyDistance ? { unit: unit! } : { enemy: enemy! };
  }

  private findDemonTargetForMember(origin: Point, range: number, preference: number): DemonTarget | null {
    const candidates: { target: DemonTarget; distance: number }[] = [];

    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) {
        continue;
      }

      const targetDistance = distance(origin, enemy);
      if (targetDistance <= range) {
        candidates.push({ target: { enemy }, distance: targetDistance });
      }
    }

    for (const unit of this.units) {
      if (unit.team !== "demon" || this.aliveMembers(unit).length === 0) {
        continue;
      }

      const targetDistance = distance(origin, unit);
      if (targetDistance <= range) {
        candidates.push({ target: { unit }, distance: targetDistance });
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[preference % Math.min(candidates.length, 3)].target;
  }

  private findAngelTargetForMember(origin: Point, range: number, exclude: Unit, preference: number): AngelTarget | null {
    const candidates: { target: AngelTarget; distance: number }[] = [];

    for (const unit of this.units) {
      if (unit === exclude || unit.team !== "angel" || this.aliveMembers(unit).length === 0) {
        continue;
      }

      const targetDistance = distance(origin, unit);
      if (targetDistance <= range) {
        candidates.push({ target: { unit }, distance: targetDistance });
      }
    }

    for (const tower of this.towers) {
      if (tower.hp <= 0) {
        continue;
      }

      const targetDistance = distance(origin, tower);
      if (targetDistance <= range) {
        candidates.push({ target: { tower }, distance: targetDistance });
      }
    }

    candidates.sort((a, b) => a.distance - b.distance);

    if (candidates.length === 0) {
      return null;
    }

    return candidates[preference % Math.min(candidates.length, 3)].target;
  }

  private findClosestAliveUnit(origin: Point, range: number, team?: UnitTeam, exclude?: Unit) {
    let closest: Unit | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const unit of this.units) {
      if (unit === exclude || (team && unit.team !== team)) {
        continue;
      }

      if (this.aliveMembers(unit).length === 0) {
        continue;
      }

      const unitDistance = distance(origin, unit);
      if (unitDistance <= range && unitDistance < closestDistance) {
        closest = unit;
        closestDistance = unitDistance;
      }
    }

    return closest;
  }

  private findClosestTower(origin: Point, range: number) {
    let closest: Tower | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const tower of this.towers) {
      if (tower.hp <= 0) {
        continue;
      }

      const towerDistance = distance(origin, tower);
      if (towerDistance <= range && towerDistance < closestDistance) {
        closest = tower;
        closestDistance = towerDistance;
      }
    }

    return closest;
  }

  private findClosestAngelTarget(origin: Point, range: number, exclude?: Unit): AngelTarget | null {
    const unit = this.findClosestAliveUnit(origin, range, "angel", exclude);
    const tower = this.findClosestTower(origin, range);
    const unitDistance = unit ? distance(origin, unit) : Number.POSITIVE_INFINITY;
    const towerDistance = tower ? distance(origin, tower) : Number.POSITIVE_INFINITY;

    if (!unit && !tower) {
      return null;
    }

    return towerDistance < unitDistance ? { tower: tower! } : { unit: unit! };
  }

  private aliveMembers(unit: Unit) {
    return unit.members.filter((member) => member.hp > 0);
  }

  private pickDamageReceiver(unit: Unit) {
    const living = this.aliveMembers(unit);
    if (living.length === 0) {
      return null;
    }

    const wounded = living
      .filter((member) => member.hp < member.maxHp)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    if (wounded.length > 0 && Math.random() < 0.78) {
      return wounded[0];
    }

    const formationBias = living
      .map((member) => ({
        member,
        weight: 1 + Math.max(0, 38 - member.offset.y) / 38 + Math.random() * 0.8,
      }))
      .sort((a, b) => b.weight - a.weight);
    return formationBias[0].member;
  }

  private hasAliveDemonUnits() {
    return this.units.some((unit) => unit.team === "demon" && this.aliveMembers(unit).length > 0);
  }

  private unitHpPercent(unit: Unit) {
    const hp = unit.members.reduce((sum, member) => sum + member.hp, 0);
    const maxHp = unit.members.reduce((sum, member) => sum + member.maxHp, 0);
    return maxHp > 0 ? hp / maxHp : 0;
  }

  private hostKindFromEnemy(kind: EnemyKind): HostKind {
    if (kind === "siegeBrute") {
      return "thrones";
    }
    if (kind === "flyingHarrier") {
      return "cavalry";
    }
    if (kind === "shadowCaster" || kind === "darkArchangel") {
      return "archers";
    }
    return "host";
  }

  private purifyUnit(unit: Unit) {
    if (unit.team !== "demon") {
      return;
    }

    if (this.energy < PURIFY_COST) {
      this.purifyMode = false;
      this.setStatus(`Need ${PURIFY_COST} energy`, 1400);
      return;
    }

    this.energy -= PURIFY_COST;
    this.convertUnitTeam(unit, "angel");
    this.selectUnit(unit);
    this.purifyMode = false;
    this.audio.playPurify();
    this.setStatus(`${unit.baseName} purified`, 1400);
    this.updateHud();
  }

  private convertUnitTeam(unit: Unit, team: UnitTeam) {
    if (unit.team === team) {
      return;
    }

    unit.team = team;
    this.clearUnitDestination(unit);
    unit.autoMoveMode = team === "demon" ? "gate" : "manual";
    unit.autoMoveRetargetMs = 0;
    unit.attackTimerMs = 0;
    unit.pose = "cast";
    unit.poseTimerMs = 320;
    const newTarget =
      team === "demon"
        ? this.findClosestAngelTarget(unit, unit.attackRange, unit)
        : this.findClosestDemonTarget(unit, unit.attackRange);
    unit.facingX = newTarget ? facingToward(unit, combatTargetPoint(newTarget), unit.facingX) : team === "demon" ? 1 : -1;

    if (team === "demon") {
      unit.corruption = 100;
      unit.selected = false;
      unit.name = `Corrupted ${unit.baseName}`;
      if (this.selectedUnit === unit) {
        this.selectedUnit = this.units.find((candidate) => candidate.team === "angel" && this.aliveMembers(candidate).length > 0) ?? null;
      }
      this.audio.playCorruption();
      this.setStatus(`${unit.baseName} was corrupted`, 1600);
    } else {
      unit.corruption = 0;
      unit.name = unit.baseName;
      this.setStatus(`${unit.baseName} purified`, 1400);
    }

    unit.label.text = unit.name;
    for (const candidate of this.units) {
      candidate.selected = candidate === this.selectedUnit;
      this.redrawUnit(candidate);
    }
    this.createShockwave({ x: unit.x, y: unit.y, range: 120, color: team === "demon" ? 0xbc4cff : 0xf5d77e });
  }

  private redrawUnit(unit: Unit) {
    const hostAnimation = this.hostAnimation(unit.kind);
    const tensionPercent = unit.maxTension > 0 ? clamp(unit.tension / unit.maxTension, 0, 1) : 0;
    unit.selectionRing.clear();
    if (unit.special && tensionPercent >= 1 && unit.team === "angel") {
      unit.selectionRing
        .circle(0, 12, 72)
        .stroke({ color: 0xffb16f, width: 3, alpha: 0.72 })
        .circle(0, 12, 80)
        .stroke({ color: 0xffefd1, width: 1, alpha: 0.42 });
    }
    if (unit.selected) {
      const selectionColor = unit.team === "demon" ? 0xbc4cff : 0xf5d77e;
      unit.selectionRing
        .circle(0, 12, 78)
        .stroke({ color: selectionColor, width: 3, alpha: 0.86 })
        .circle(0, 12, unit.attackRange)
        .stroke({ color: selectionColor, width: 2, alpha: 0.14 });
    }
    if (unit.corruption > 0) {
      unit.selectionRing
        .circle(0, 12, 48 + unit.corruption * 0.28)
        .stroke({ color: 0xbc4cff, width: 2, alpha: 0.2 + unit.corruption / 180 });
    }

    let visibleMemberCount = 0;
    for (const member of unit.members) {
      const memberAlive = member.hp > 0;
      const memberPose = memberAlive ? (member.hitTimerMs > 0 ? "hit" : unit.pose) : "die";
      const phase = ((unit.animationTimeMs + member.animationPhaseMs) % 1100) / 1100;
      const step = Math.sin(phase * TAU);
      const doubleStep = Math.sin(phase * TAU * 2);
      const walking = memberAlive && unit.pose === "walk";
      const casting = memberAlive && (unit.pose === "cast" || unit.pose === "attack" || unit.pose === "special");
      const memberHit = memberAlive && member.hitTimerMs > 0;
      let bob = 0;
      if (walking) {
        bob = Math.abs(doubleStep) * 7 * member.bobJitter;
      } else if (memberAlive && unit.pose === "idle") {
        bob = step * 1.4 * member.bobJitter;
      } else if (casting) {
        bob = Math.sin(phase * TAU) * 2;
      }

      const sway = memberAlive ? (walking ? step * 3.2 * member.bobJitter : step * 0.8) : 0;
      const recoil = casting ? 3 + member.targetPreference * 0.35 : 0;
      const baseScale = hostAnimation.scale * member.scaleJitter * (memberHit ? 0.98 : 1);
      const xScale = baseScale * unit.facingX;
      let yScale = baseScale;
      if (walking) {
        yScale *= 1 - Math.abs(step) * 0.025;
      } else if (!memberAlive) {
        yScale *= 0.86;
      }

      const deathFade = memberAlive ? 1 : clamp(1 - member.deathTimerMs / 900, 0, 0.72);
      const deathDrop = memberAlive ? 0 : Math.min(12, member.deathTimerMs / 85);

      member.sprite.texture = this.hostTexture(unit.kind, memberPose, unit.animationTimeMs, member.animationPhaseMs);
      member.sprite.visible = memberAlive || deathFade > 0.04;
      member.sprite.alpha = deathFade;
      member.sprite.position.set(member.offset.x + (sway - recoil) * unit.facingX, member.offset.y - bob + deathDrop);
      member.sprite.rotation =
        memberAlive
          ? (walking ? step * 0.055 : step * 0.016) * unit.facingX
          : 0.18 * unit.facingX;
      member.sprite.scale.set(xScale, yScale);
      member.sprite.tint = unit.team === "demon" ? 0xf2a0ff : unit.tint;
      if (member.sprite.visible) {
        visibleMemberCount += 1;
      }

      member.hpBar.visible = memberAlive;
      member.hpBar.clear();

      if (memberAlive) {
        member.hpBar
          .roundRect(0, 0, 44, 4, 2)
          .fill({ color: 0x130c0e, alpha: 0.78 })
          .roundRect(0, 0, 44 * (member.hp / member.maxHp), 4, 2)
          .fill(unit.team === "demon" ? 0xbc4cff : member.hp / member.maxHp > 0.35 ? 0x8ccf80 : 0xe5685f);
      }
    }
    unit.label.visible = visibleMemberCount > 0;
    unit.label.text = unit.name;
    unit.label.tint = unit.team === "demon" ? 0xffa8f7 : 0xffffff;
  }

  private redrawEnemy(enemy: Enemy) {
    const hpPercent = clamp(enemy.hp / enemy.maxHp, 0, 1);
    enemy.hpBar
      .clear()
      .roundRect(0, 0, 52, 5, 3)
      .fill({ color: 0x130c0e, alpha: 0.82 })
      .roundRect(0, 0, 52 * hpPercent, 5, 3)
      .fill(hpPercent > 0.38 ? 0xdc8660 : 0xd14f58);
  }

  private checkBattleEnd() {
    if (this.gateHp <= 0) {
      this.battleState = "defeat";
      this.purifyMode = false;
      this.renderBuildPanel();
      this.audio.playDefeat();
      this.setStatus("Gate breached");
      this.showResultMenu("defeat");
      return;
    }

    const aliveDemonUnits = this.units.filter((unit) => unit.team === "demon" && this.aliveMembers(unit).length > 0);

    const waves = this.currentWaves();
    if (this.currentWaveIndex >= waves.length && this.enemies.length === 0 && aliveDemonUnits.length === 0) {
      this.battleState = "victory";
      this.purifyMode = false;
      this.renderBuildPanel();
      this.audio.playVictory();
      this.setStatus("Citadel held");
      this.showResultMenu("victory");
    }
  }

  private renderSelectedDetail(summary: string, stats: Array<[string, string]>) {
    const detail = this.hud.unitDetail;
    if (!detail) return;
    detail.replaceChildren();

    const summaryEl = document.createElement("p");
    summaryEl.className = "selected-summary";
    summaryEl.textContent = summary;
    detail.appendChild(summaryEl);

    if (stats.length === 0) return;

    const statGrid = document.createElement("dl");
    statGrid.className = "selected-stat-grid";
    stats.forEach(([label, value]) => {
      const item = document.createElement("div");
      item.className = "selected-stat";

      const term = document.createElement("dt");
      term.textContent = label;

      const description = document.createElement("dd");
      description.textContent = value;

      item.append(term, description);
      statGrid.appendChild(item);
    });
    detail.appendChild(statGrid);
  }

  private updateHud() {
    this.updatePedestalLabelVisibility();
    const waves = this.currentWaves();
    const waveNumber = clamp(this.currentWaveIndex + 1, 1, waves.length);
    const gateRatio = clamp(this.gateHp / this.map.gate.maxHp, 0, 1);
    const gatePercent = Math.round(gateRatio * 100);
    const selectedUnit = this.selectedUnit;
    const selectedTower = this.selectedTower;
    const members = selectedUnit ? selectedUnit.members : [];
    const livingMemberCount = selectedUnit ? this.aliveMembers(selectedUnit).length : 0;
    const hpTotal = members.reduce((sum, member) => sum + member.hp, 0);
    const hpMax = members.reduce((sum, member) => sum + member.maxHp, 0);
    const mpTotal = members.reduce((sum, member) => sum + member.mp, 0);
    const mpMax = members.reduce((sum, member) => sum + member.maxMp, 0);
    const selectedSpecialUnit = selectedUnit && this.unitBuildsTension(selectedUnit) ? selectedUnit : null;
    const selectedHp = selectedTower ? selectedTower.hp : hpTotal;
    const selectedMaxHp = selectedTower ? selectedTower.maxHp : hpMax;
    const selectedMeter = selectedTower
      ? clamp(selectedTower.tension / selectedTower.maxTension, 0, 1)
      : selectedSpecialUnit
        ? clamp(selectedSpecialUnit.tension / selectedSpecialUnit.maxTension, 0, 1)
        : mpMax > 0
          ? mpTotal / mpMax
          : 0;
    const selectedTowerCharged = Boolean(selectedTower && selectedTower.tension >= selectedTower.maxTension);
    const selectedSpecialCharged = Boolean(
      selectedSpecialUnit && selectedSpecialUnit.tension >= selectedSpecialUnit.maxTension,
    );
    const aliveAngelCount = this.units.filter((unit) => unit.team === "angel" && this.aliveMembers(unit).length > 0).length;
    const angelUnitCount = this.units.filter((unit) => unit.team === "angel").length;
    const aliveDemonUnitCount = this.units.filter(
      (unit) => unit.team === "demon" && this.aliveMembers(unit).length > 0,
    ).length;

    if (this.hud.wave) {
      this.hud.wave.textContent =
        this.currentWaveIndex >= waves.length
          ? `${waves.length} / ${waves.length}`
          : `${waveNumber} / ${waves.length}`;
    }
    if (this.hud.gate) {
      this.hud.gate.textContent = `${gatePercent}%`;
    }
    if (this.hud.gateHpFill) {
      this.hud.gateHpFill.style.width = `${gateRatio * 62}%`;
      this.hud.gateHpFill.classList.toggle("critical", gateRatio <= 0.35);
    }
    if (this.hud.enemies) {
      this.hud.enemies.textContent = String(this.enemies.length + aliveDemonUnitCount);
    }
    if (this.hud.energy) {
      this.hud.energy.textContent = String(Math.floor(this.energy));
    }
    if (this.hud.units) {
      this.hud.units.textContent = `${aliveAngelCount} / ${angelUnitCount}`;
    }
    this.updatePauseButton();
    if (this.hud.unitName) {
      this.hud.unitName.textContent = selectedTower?.name ?? selectedUnit?.name ?? "No unit selected";
    }
    if (this.hud.selectedQuick) {
      const hasSelection = Boolean(selectedUnit || selectedTower);
      this.hud.selectedQuick.hidden = !hasSelection || this.menuOpen || this.guideOpen;
      this.hud.selectedQuick.classList.toggle("tower-selected", Boolean(selectedTower));
      this.hud.selectedQuick.classList.toggle("unit-selected", Boolean(selectedUnit));
    }
    if (this.hud.selectedCurrentButton) {
      const label = selectedTower?.name ?? selectedUnit?.name ?? "Selected";
      this.hud.selectedCurrentButton.disabled = !selectedTower && !selectedUnit;
      this.hud.selectedCurrentButton.title = `${label} details`;
      this.hud.selectedCurrentButton.setAttribute("aria-label", `Open ${label} details`);
    }
    if (this.hud.selectedCurrentLabel) {
      this.hud.selectedCurrentLabel.textContent = selectedTower?.name ?? selectedUnit?.name ?? "None";
    }
    if (this.hud.selectedCurrentIcon) {
      this.hud.selectedCurrentIcon.style.backgroundImage = selectedTower
        ? `url("${TOWER_TYPES[selectedTower.kind as TowerKind].texture}")`
        : selectedUnit
          ? `url("${hostAnimationCatalog[selectedUnit.kind as HostSpriteKey].previews?.idle ?? hostAnimationCatalog[selectedUnit.kind as HostSpriteKey].textures.idle}")`
          : "";
      this.hud.selectedCurrentIcon.textContent = selectedTower || selectedUnit ? "" : "?";
    }
    if (this.hud.unitDetail) {
      if (selectedTower) {
        const type = TOWER_TYPES[selectedTower.kind as TowerKind];
        const effect =
          selectedTower.behavior === "support"
            ? "Restores nearby host HP and MP."
            : selectedTower.behavior === "slow"
              ? `Slows enemies by ${Math.round((selectedTower.slowPercent ?? 0) * 100)}%.`
              : selectedTower.behavior === "shockwave"
                ? "Damages enemies in an area."
                : selectedTower.behavior === "beam"
                  ? `Channels a beam for ${((selectedTower.beamDurationMs ?? 0) / 1000).toFixed(1)}s at width ${selectedTower.beamWidth ?? 0}.`
                  : "Fires holy projectiles.";
        this.renderSelectedDetail(type.description, [
          ["HP", `${Math.round(selectedTower.hp)} / ${selectedTower.maxHp}`],
          ["Range", this.towerRangeLabel(selectedTower.innerRange, selectedTower.range)],
          ["Damage", String(Math.round(this.towerDamage(selectedTower.damage)))],
          ["Cooldown", `${(selectedTower.cooldownMs / 1000).toFixed(1)}s`],
          ["Tension", `${Math.floor(selectedTower.tension)} / ${selectedTower.maxTension}`],
          ["Burst", String(Math.round(this.towerTensionBurstRange(selectedTower)))],
          ["Effect", effect],
        ]);
      } else if (!selectedUnit) {
        this.renderSelectedDetail("Choose Hosts to deploy a new squad on the path.", []);
      } else {
        const hostType = HOST_TYPES[selectedUnit.kind as HostKind];
        const stats: Array<[string, string]> = [
          ["Members", `${livingMemberCount} / ${members.length}`],
          ["HP", `${Math.round(hpTotal)} / ${hpMax}`],
          ["MP", `${Math.round(mpTotal)} / ${mpMax}`],
          ["Tension", selectedUnit.special ? `${Math.floor(selectedUnit.tension)} / ${selectedUnit.maxTension}` : "None"],
        ];
        if (selectedUnit.damagePerMember > 0) {
          stats.splice(3, 0, ["Damage", `${Math.round(this.unitDamage(selectedUnit, selectedUnit.damagePerMember))}/member`]);
        } else if (selectedUnit.healPerMember > 0) {
          stats.splice(3, 0, ["Healing", `${Math.round(selectedUnit.healPerMember)}/member`]);
        }
        if (selectedUnit.corruption > 0) {
          stats.push(["Corruption", `${Math.round(selectedUnit.corruption)}%`]);
        }
        const summary =
          selectedUnit.team === "demon" ? `Demon-controlled. ${hostType.role}. Purify to regain control.` : hostType.role;
        this.renderSelectedDetail(summary, stats);
      }
    }
    if (this.hud.status && this.battleState === "playing" && this.statusOverrideMs <= 0) {
      if (this.menuOpen) {
        this.hud.status.textContent = "Choose campaign setup";
      } else if (this.combatTutorialStep === "premise") {
        this.hud.status.textContent = "Training overview";
      } else if (this.combatTutorialStep === "buildTower") {
        this.hud.status.textContent = "Build on the highlighted pedestal";
      } else if (this.combatTutorialStep === "redeployHost") {
        this.hud.status.textContent = "Move Alizel's Host to the highlighted road";
      } else if (this.combatTutorialStep === "surviveWave") {
        this.hud.status.textContent = "Hold the gate";
      } else if (this.isPaused) {
        this.hud.status.textContent = "Paused";
      } else if (this.buildMode === "ability" && this.purifyMode) {
        this.hud.status.textContent = "Choose an enemy to purify";
      } else if (this.mapEditMode) {
        this.hud.status.textContent =
          this.mapEditTool === "towerSlots"
            ? "Click empty map to add a base; Add Tower fills selected base"
            : this.mapEditTool === "path"
              ? "Click a path line or + to insert a point; drag points to reshape"
              : "Editing gate";
      } else if (this.buildMode === "hosts") {
        const hostName = this.selectedHostKind ? HOST_TYPES[this.selectedHostKind].name : "host";
        this.hud.status.textContent = `Choose path point for ${hostName}`;
      } else if (this.buildMode === "towers") {
        this.hud.status.textContent = "Choose an empty pedestal";
      } else if (selectedUnit?.team === "demon") {
        this.hud.status.textContent = "Corrupted host advancing on the gate";
      } else if (selectedUnit?.destination) {
        this.hud.status.textContent = "Redeploying host";
      } else if (selectedTower) {
        this.hud.status.textContent = selectedTowerCharged ? `${selectedTower.name} Tension Burst ready` : `${selectedTower.name} selected`;
      } else if (selectedSpecialUnit) {
        this.hud.status.textContent = selectedSpecialCharged
          ? `${selectedSpecialUnit.name} Tension Burst ready`
          : `${selectedSpecialUnit.name} building tension`;
      } else {
        this.hud.status.textContent = "Hold the lane";
      }
    }
    if (this.hud.unitHp) {
      this.hud.unitHp.style.width = `${selectedMaxHp > 0 ? (selectedHp / selectedMaxHp) * 100 : 0}%`;
    }
    if (this.hud.unitMp) {
      this.hud.unitMp.style.width = `${selectedMeter * 100}%`;
      this.hud.unitMp.parentElement?.classList.toggle("tension", Boolean(selectedTower || selectedSpecialUnit));
    }
    if (this.hud.tensionBurstButton) {
      const hasTensionSource = Boolean(selectedTower || selectedSpecialUnit);
      const charged = selectedTowerCharged || selectedSpecialCharged;
      const tensionProgress = hasTensionSource ? selectedMeter : 0;
      this.hud.tensionBurstButton.hidden = !hasTensionSource;
      this.hud.tensionBurstButton.disabled = !charged || this.battleState !== "playing" || this.menuOpen || this.guideOpen;
      this.hud.tensionBurstButton.classList.toggle("charged", charged);
      this.hud.tensionBurstButton.style.setProperty("--tension-progress", `${tensionProgress * 100}%`);
      if (hasTensionSource) {
        const label = this.hud.tensionBurstButton.querySelector("span");
        if (label) {
          label.textContent = charged ? "Burst" : "Tension";
        }
        this.hud.tensionBurstButton.title = charged ? "Release Tension Burst" : "Tension building";
        this.hud.tensionBurstButton.setAttribute("aria-label", charged ? "Release Tension Burst" : "Tension building");
      } else {
        this.hud.tensionBurstButton.style.removeProperty("--tension-progress");
      }
    }
    if (this.hud.towerRangeButton) {
      this.hud.towerRangeButton.hidden = !selectedTower;
      this.hud.towerRangeButton.disabled = !selectedTower || this.battleState !== "playing" || this.menuOpen || this.guideOpen;
      this.hud.towerRangeButton.classList.toggle("active", Boolean(selectedTower?.showRange));
      if (selectedTower) {
        this.hud.towerRangeButton.textContent = selectedTower.showRange ? "Hide Range" : "Show Range";
      }
    }
    if (this.hud.autoMoveSelect) {
      const canAutoMove = Boolean(
        selectedUnit &&
          selectedUnit.team === "angel" &&
          livingMemberCount > 0 &&
          this.battleState === "playing" &&
          !this.menuOpen &&
          !this.guideOpen,
      );
      this.hud.autoMoveSelect.disabled = !canAutoMove;
      this.hud.autoMoveSelect.value = selectedUnit?.autoMoveMode ?? "manual";
      this.hud.autoMoveSelect.title = selectedUnit?.team === "demon" ? "Corrupted hosts automatically advance on the gate." : "";
    }
    if (this.hud.selectedMoveField) {
      const showMovement = Boolean(selectedUnit);
      this.hud.selectedMoveField.hidden = !showMovement;
      this.hud.selectedMoveField.classList.toggle("disabled", !selectedUnit || selectedUnit.team !== "angel");
    }
    if (this.hud.selectedOverlay) {
      if (this.menuOpen || this.guideOpen || (!selectedUnit && !selectedTower)) {
        this.hud.selectedOverlay.hidden = true;
      }
    }

    if (this.buildPanelStateKey !== this.getBuildPanelStateKey()) {
      this.renderBuildPanel();
    }
  }

  private setStatus(text: string, durationMs = 0) {
    if (this.hud.status) {
      this.hud.status.textContent = text;
    }
    this.statusOverrideMs = durationMs;
  }

  private updateMinimap() {
    if (!this.textures || this.app.screen.width <= 0 || this.app.screen.height <= 0) {
      return;
    }

    const margin = 18;
    const padding = 10;
    const availableWidth = Math.max(130, this.app.screen.width - margin * 2);
    const availableHeight = Math.max(90, this.app.screen.height - margin * 2);
    const maxPanelWidth = Math.min(270, availableWidth, Math.max(170, this.app.screen.width * 0.28));
    const maxPanelHeight = Math.min(150, availableHeight, Math.max(96, this.app.screen.height * 0.2));
    const mapScale = Math.min(
      (maxPanelWidth - padding * 2) / this.map.width,
      (maxPanelHeight - padding * 2) / this.map.height,
    );
    const mapWidth = this.map.width * mapScale;
    const mapHeight = this.map.height * mapScale;
    const panelWidth = mapWidth + padding * 2;
    const panelHeight = mapHeight + padding * 2;
    const panelX = this.app.screen.width - panelWidth - margin;
    const panelY = this.app.screen.height - panelHeight - margin;
    const mapX = panelX + padding;
    const mapY = panelY + padding;
    const tx = (x: number) => mapX + x * mapScale;
    const ty = (y: number) => mapY + y * mapScale;
    const graphic = this.minimapGraphic;

    this.minimapMetrics = {
      mapX,
      mapY,
      mapWidth,
      mapHeight,
      scale: mapScale,
      panelX,
      panelY,
      panelWidth,
      panelHeight,
    };
    this.minimapLayer.hitArea = new Rectangle(panelX, panelY, panelWidth, panelHeight);

    graphic
      .clear()
      .roundRect(panelX, panelY, panelWidth, panelHeight, 8)
      .fill({ color: 0x07090f, alpha: 0.76 })
      .roundRect(panelX, panelY, panelWidth, panelHeight, 8)
      .stroke({ color: 0xf5d77e, width: 1, alpha: 0.48 })
      .rect(mapX, mapY, mapWidth, mapHeight)
      .fill({ color: 0x111823, alpha: 0.84 })
      .rect(mapX, mapY, mapWidth, mapHeight)
      .stroke({ color: 0x8ed8ff, width: 1, alpha: 0.24 });

    for (const pathPoints of this.deploymentPaths()) {
      if (pathPoints.length === 0) {
        continue;
      }
      graphic.moveTo(tx(pathPoints[0].x), ty(pathPoints[0].y));
      for (const point of pathPoints.slice(1)) {
        graphic.lineTo(tx(point.x), ty(point.y));
      }
    }
    graphic.stroke({ color: 0x1b1620, width: 5, alpha: 0.82 });

    for (const pathPoints of this.map.paths) {
      if (pathPoints.length === 0) {
        continue;
      }
      graphic.moveTo(tx(pathPoints[0].x), ty(pathPoints[0].y));
      for (const point of pathPoints.slice(1)) {
        graphic.lineTo(tx(point.x), ty(point.y));
      }
    }
    graphic.stroke({ color: 0xe6c272, width: 2, alpha: 0.72 });

    for (const pathPoints of this.map.sidePaths) {
      if (pathPoints.length === 0) {
        continue;
      }
      graphic.moveTo(tx(pathPoints[0].x), ty(pathPoints[0].y));
      for (const point of pathPoints.slice(1)) {
        graphic.lineTo(tx(point.x), ty(point.y));
      }
    }
    graphic.stroke({ color: 0x75e8ff, width: 1.5, alpha: 0.5 });

    for (const pathPoints of this.map.paths) {
      const spawn = pathPoints[0];
      if (spawn) {
        graphic.circle(tx(spawn.x), ty(spawn.y), 3.2).fill({ color: 0xd45154, alpha: 0.92 });
      }
    }

    for (const slot of this.map.towerSlots) {
      graphic.circle(tx(slot.x), ty(slot.y), 2.4).stroke({ color: 0xf5d77e, width: 1, alpha: 0.48 });
    }

    for (const tower of this.towers) {
      if (tower.hp <= 0) {
        continue;
      }
      graphic
        .circle(tx(tower.x), ty(tower.y), 3.2)
        .fill({ color: tower.color, alpha: 0.95 })
        .circle(tx(tower.x), ty(tower.y), Math.max(6, tower.range * mapScale))
        .stroke({ color: tower.color, width: 1, alpha: tower.selected ? 0.34 : 0.1 });
    }

    for (const beam of this.beams) {
      graphic
        .moveTo(tx(beam.origin.x), ty(beam.origin.y))
        .lineTo(tx(beam.targetPoint.x), ty(beam.targetPoint.y))
        .stroke({ color: beam.color, width: 1.6, alpha: 0.68 });
    }

    for (const projectile of this.projectiles) {
      graphic
        .circle(tx(projectile.x), ty(projectile.y), 1.6)
        .fill({ color: projectile.allegiance === "angel" ? 0xbbecff : 0xbc4cff, alpha: 0.9 });
    }

    for (const unit of this.units) {
      const living = this.aliveMembers(unit).length;
      if (living === 0) {
        continue;
      }
      const color = unit.team === "demon" ? 0xbc4cff : 0x8ed8ff;
      const radius = 2.6 + Math.min(4, living) * 0.35;
      graphic.circle(tx(unit.x), ty(unit.y), radius).fill({ color, alpha: 0.95 });
      if (unit.selected) {
        graphic.circle(tx(unit.x), ty(unit.y), radius + 2.3).stroke({ color: 0xffffff, width: 1, alpha: 0.82 });
      }
    }

    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) {
        continue;
      }
      graphic
        .circle(tx(enemy.x), ty(enemy.y), enemy.kind === "darkArchangel" ? 3.8 : 2.8)
        .fill({ color: 0xff604d, alpha: 0.95 });
    }

    const gateHpPercent = clamp(this.gateHp / this.map.gate.maxHp, 0, 1);
    graphic
      .roundRect(tx(this.map.gate.x), ty(this.map.gate.y), this.map.gate.width * mapScale, this.map.gate.height * mapScale, 2)
      .fill({ color: gateHpPercent > 0.35 ? 0x8ed8ff : 0xe5685f, alpha: 0.72 })
      .roundRect(tx(this.map.gate.x), ty(this.map.gate.y), this.map.gate.width * mapScale, this.map.gate.height * mapScale, 2)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.58 });

    graphic
      .rect(
        tx(this.cameraX),
        ty(this.cameraY),
        Math.min(DESIGN_WIDTH, this.map.width) * mapScale,
        Math.min(DESIGN_HEIGHT, this.map.height) * mapScale,
      )
      .stroke({ color: 0xffffff, width: 2, alpha: 0.82 })
      .rect(
        tx(this.cameraX),
        ty(this.cameraY),
        Math.min(DESIGN_WIDTH, this.map.width) * mapScale,
        Math.min(DESIGN_HEIGHT, this.map.height) * mapScale,
      )
      .fill({ color: 0xffffff, alpha: 0.045 });
  }

  private maxCameraX() {
    return Math.max(0, this.map.width - DESIGN_WIDTH);
  }

  private maxCameraY() {
    return Math.max(0, this.map.height - DESIGN_HEIGHT);
  }

  private panCamera(deltaX: number, deltaY: number) {
    const nextX = clamp(this.cameraX + deltaX, 0, this.maxCameraX());
    const nextY = clamp(this.cameraY + deltaY, 0, this.maxCameraY());
    if (nextX === this.cameraX && nextY === this.cameraY) {
      return;
    }
    this.cameraX = nextX;
    this.cameraY = nextY;
    this.layout();
    this.updateMapScrollControls();
  }

  private handleWheel(event: WheelEvent) {
    const maxCameraX = this.maxCameraX();
    const maxCameraY = this.maxCameraY();
    if (maxCameraX <= 0 && maxCameraY <= 0) {
      return;
    }

    event.preventDefault();
    const deltaX = maxCameraX > 0 ? (Math.abs(event.deltaX) > 1 ? event.deltaX : maxCameraY <= 0 ? event.deltaY : 0) : 0;
    const deltaY = maxCameraY > 0 ? event.deltaY : 0;
    this.panCamera(deltaX * 1.35, deltaY * 1.35);
  }

  private handleMinimapPointerDown(event: FederatedPointerEvent) {
    const metrics = this.minimapMetrics;
    if (!metrics) {
      return;
    }

    event.stopPropagation();
    const pointer = this.pointerScreenPoint(event);
    const mapX = clamp((pointer.x - metrics.mapX) / metrics.scale, 0, this.map.width);
    const mapY = clamp((pointer.y - metrics.mapY) / metrics.scale, 0, this.map.height);
    this.cameraX = clamp(mapX - DESIGN_WIDTH / 2, 0, this.maxCameraX());
    this.cameraY = clamp(mapY - DESIGN_HEIGHT / 2, 0, this.maxCameraY());
    this.layout();
    this.updateMapScrollControls();
    this.updateMinimap();
  }

  private layout() {
    const metrics = this.layoutMetrics();
    const scale = metrics.scale;
    this.cameraX = clamp(this.cameraX, 0, this.maxCameraX());
    this.cameraY = clamp(this.cameraY, 0, this.maxCameraY());
    this.world.scale.set(scale);
    this.world.position.set(metrics.left - this.cameraX * scale, metrics.top - this.cameraY * scale);
    this.app.stage.hitArea = new Rectangle(0, 0, this.app.screen.width, this.app.screen.height);
    if (this.textures) {
      this.drawGate();
    }
    this.updateMinimap();
  }
}
