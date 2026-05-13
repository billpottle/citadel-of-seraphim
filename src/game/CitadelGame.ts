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
import { animationCatalog, type AnimationKey } from "./animationCatalog";
import {
  DEFAULT_MAP_ID,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  DIFFICULTY_MODES,
  ENEMY_TYPES,
  HOST_TYPES,
  PATH_DEPLOY_TOLERANCE,
  PEDESTAL_RADIUS,
  MAP_ORDER,
  MAPS,
  PURIFY_COST,
  TOWER_TYPES,
  WAVES,
  type DifficultyMode,
  type EnemyKind,
  type GateConfig,
  type HostKind,
  type MapId,
  type TowerKind,
} from "./config";
import type {
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
const MAP_LAYOUT_STORAGE_KEY = "citadel.mapLayouts.v1";
const GAME_SETTINGS_STORAGE_KEY = "citadel.settings.v1";
const BATTLE_SPEED_OPTIONS = [0.5, 1, 1.5, 2, 3] as const;
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
type MapEditTool = "towerSlots" | "path" | "gate";
type UnitTeam = Unit["team"];
type DemonTarget = { enemy: Enemy; unit?: never } | { enemy?: never; unit: Unit };
type AngelTarget = { unit: Unit; tower?: never } | { unit?: never; tower: Tower };
type EditorDragTarget =
  | { type: "slot"; index: number }
  | { type: "path"; pathId: number; index: number }
  | { type: "gate" };
type EditableMapState = {
  id: MapId;
  name: string;
  background: string;
  width: number;
  path: Point[];
  paths: Point[][];
  towerSlots: Point[];
  gate: GateConfig;
  startingUnit: Point;
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

function closestPointOnPath(point: Point, path: Point[]): { point: Point; distance: number } {
  let closest = path[0];
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < path.length - 1; i += 1) {
    const candidate = closestPointOnSegment(point, path[i], path[i + 1]);
    const candidateDistance = distance(point, candidate);
    if (candidateDistance < closestDistance) {
      closest = candidate;
      closestDistance = candidateDistance;
    }
  }

  return { point: closest, distance: closestDistance };
}

function closestPointOnPaths(point: Point, paths: Point[][]): { point: Point; distance: number; pathId: number } {
  let closest = paths[0][0];
  let closestDistance = Number.POSITIVE_INFINITY;
  let pathId = 0;

  for (const [index, path] of paths.entries()) {
    const candidate = closestPointOnPath(point, path);
    if (candidate.distance < closestDistance) {
      closest = candidate.point;
      closestDistance = candidate.distance;
      pathId = index;
    }
  }

  return { point: closest, distance: closestDistance, pathId };
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
  private readonly minimapLayer = new Container();
  private readonly minimapGraphic = new Graphics();
  private readonly audio = new AudioDirector();
  private textures!: {
    maps: Record<MapId, Texture>;
    angel: Record<AnimationKey, Texture>;
    enemy: Record<EnemyKind, Texture>;
    tower: Record<TowerKind, Texture>;
  };
  private activeMapId: MapId = DEFAULT_MAP_ID;
  private map = this.loadMapLayout(DEFAULT_MAP_ID);
  private units: Unit[] = [];
  private selectedUnit: Unit | null = null;
  private selectedTower: Tower | null = null;
  private towers: Tower[] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private beams: Beam[] = [];
  private shockwaves: Shockwave[] = [];
  private difficultyMode: DifficultyMode = "normal";
  private battleSpeed = 1;
  private unitId = 1;
  private enemyId = 1;
  private currentWaveIndex = 0;
  private waveSpawned = 0;
  private spawnTimerMs = 0;
  private betweenWaveTimerMs = 1200;
  private energy: number = DIFFICULTY_MODES.normal.startingEnergy;
  private buildMode: BuildMode = "towers";
  private selectedTowerKind: TowerKind | null = "lightspire";
  private selectedHostKind: HostKind | null = "host";
  private purifyMode = false;
  private mapEditMode = false;
  private mapEditTool: MapEditTool = "towerSlots";
  private editorDragTarget: EditorDragTarget | null = null;
  private cameraX = 0;
  private selectedPathRouteIndex = 0;
  private selectedPathIndex = 0;
  private selectedSlotIndex = 0;
  private buildPanelStateKey = "";
  private statusOverrideMs = 0;
  private gateHp = this.map.gate.maxHp;
  private battleState: "playing" | "victory" | "defeat" = "playing";
  private gateGraphic = new Graphics();
  private gateHpGraphic = new Graphics();
  private minimapMetrics: MinimapMetrics | null = null;

  constructor(root: HTMLDivElement) {
    this.root = root;
    this.hud = {
      wave: document.querySelector("#wave-readout"),
      gate: document.querySelector("#gate-readout"),
      enemies: document.querySelector("#enemy-readout"),
      energy: document.querySelector("#energy-readout"),
      units: document.querySelector("#unit-count-readout"),
      status: document.querySelector("#status-readout"),
      unitName: document.querySelector("#selected-unit-name"),
      unitDetail: document.querySelector("#selected-unit-detail"),
      unitHp: document.querySelector("#unit-hp-meter"),
      unitMp: document.querySelector("#unit-mp-meter"),
      difficultySelect: document.querySelector("#difficulty-select"),
      battleSpeedSelect: document.querySelector("#battle-speed-select"),
      towersPanel: document.querySelector("#towers-panel-button"),
      hostsPanel: document.querySelector("#hosts-panel-button"),
      abilityPanel: document.querySelector("#ability-panel-button"),
      buildList: document.querySelector("#build-list"),
      buildDetail: document.querySelector("#build-detail"),
      mapSelect: document.querySelector("#map-select"),
      scrollLeftButton: document.querySelector("#scroll-left-button"),
      scrollRightButton: document.querySelector("#scroll-right-button"),
      mapEditButton: document.querySelector("#map-edit-button"),
      mapEditorPanel: document.querySelector("#map-editor-panel"),
      mapEditTool: document.querySelector("#map-edit-tool"),
      addPathPointButton: document.querySelector("#add-path-point-button"),
      removePathPointButton: document.querySelector("#remove-path-point-button"),
      copyMapButton: document.querySelector("#copy-map-button"),
      resetMapButton: document.querySelector("#reset-map-button"),
      audioButton: document.querySelector("#audio-button"),
      restartButton: document.querySelector("#restart-button"),
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
      Object.entries(animationCatalog.alizelsHost.textures).map(async ([key, path]) => {
        return [key, await Assets.load<Texture>(path)] as const;
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

    this.textures = {
      maps: Object.fromEntries(mapTextures) as Record<MapId, Texture>,
      angel: Object.fromEntries(angelTextures) as Record<AnimationKey, Texture>,
      enemy: Object.fromEntries(enemyTextures) as Record<EnemyKind, Texture>,
      tower: Object.fromEntries(towerTextures) as Record<TowerKind, Texture>,
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
    this.app.canvas.addEventListener("wheel", (event) => this.handleWheel(event), { passive: false });
    this.app.renderer.on("resize", this.layout, this);
    this.app.ticker.add((ticker) => this.update(ticker.deltaMS));
    this.loadGameSettings();
    this.populateMapSelect();
    this.populateBattleSettings();
    this.hud.audioButton?.addEventListener("click", (event) => {
      event.preventDefault();
      void this.audio.toggle().then(() => this.updateAudioButton());
    });
    this.hud.restartButton?.addEventListener("click", (event) => {
      event.preventDefault();
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
      this.battleSpeed = selected;
      this.saveGameSettings();
      this.updateBattleSettingsControls();
      this.setStatus(`Battle speed ${this.formatBattleSpeed(selected)}`, 1000);
    });
    this.hud.towersPanel?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.startAudio();
      this.setBuildMode("towers");
    });
    this.hud.towersPanel?.addEventListener("click", (event) => {
      event.preventDefault();
      this.startAudio();
      this.setBuildMode("towers");
    });
    this.hud.hostsPanel?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.startAudio();
      this.setBuildMode("hosts");
    });
    this.hud.hostsPanel?.addEventListener("click", (event) => {
      event.preventDefault();
      this.startAudio();
      this.setBuildMode("hosts");
    });
    this.hud.abilityPanel?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.startAudio();
      this.setBuildMode("ability");
    });
    this.hud.abilityPanel?.addEventListener("click", (event) => {
      event.preventDefault();
      this.startAudio();
      this.setBuildMode("ability");
    });
    this.hud.mapSelect?.addEventListener("change", () => {
      const selected = this.hud.mapSelect?.value as MapId;
      if (!MAP_ORDER.includes(selected)) {
        return;
      }
      this.saveMapLayout();
      this.activeMapId = selected;
      this.map = this.loadMapLayout(selected);
      this.cameraX = 0;
      this.selectedPathRouteIndex = 0;
      this.selectedPathIndex = 0;
      this.selectedSlotIndex = 0;
      this.restart();
      this.setStatus(`${this.map.name} loaded`, 1200);
    });
    this.hud.mapEditButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.toggleMapEditMode();
    });
    this.hud.scrollLeftButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.panCamera(-DESIGN_WIDTH * 0.72);
    });
    this.hud.scrollRightButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.panCamera(DESIGN_WIDTH * 0.72);
    });
    this.hud.mapEditTool?.addEventListener("change", () => {
      const tool = this.hud.mapEditTool?.value;
      if (tool === "towerSlots" || tool === "path" || tool === "gate") {
        this.mapEditTool = tool;
        this.renderEditorOverlay();
        this.updateHud();
      }
    });
    this.hud.addPathPointButton?.addEventListener("click", (event) => {
      event.preventDefault();
      this.addPathPoint();
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
      if (event.key === "ArrowLeft") {
        this.panCamera(-220);
        event.preventDefault();
      }
      if (event.key === "ArrowRight") {
        this.panCamera(220);
        event.preventDefault();
      }
      if (event.key.toLowerCase() === "s") {
        this.startAudio();
        this.setBuildMode("hosts");
      }
      if (event.key.toLowerCase() === "t") {
        this.startAudio();
        this.setBuildMode("towers");
      }
      if (event.key.toLowerCase() === "p") {
        this.startAudio();
        this.setBuildMode("ability");
        this.beginPurify();
      }
    });

    this.restart();
  }

  private startAudio() {
    if (this.audio.isEnabled) {
      return;
    }

    void this.audio.start().then(() => this.updateAudioButton());
  }

  private cloneMapLayout(id: MapId): EditableMapState {
    const source = MAPS[id];
    const paths = (source.paths ?? [source.path]).map((path) => path.map((point) => ({ ...point })));
    return {
      id,
      name: source.name,
      background: source.background,
      width: source.width,
      path: paths[0],
      paths,
      towerSlots: source.towerSlots.map((point) => ({ ...point })),
      gate: { ...source.gate },
      startingUnit: { ...source.startingUnit },
    };
  }

  private loadStoredLayouts() {
    try {
      return JSON.parse(localStorage.getItem(MAP_LAYOUT_STORAGE_KEY) ?? "{}") as Partial<
        Record<MapId, Partial<EditableMapState>>
      >;
    } catch {
      return {};
    }
  }

  private loadMapLayout(id: MapId): EditableMapState {
    const layout = this.cloneMapLayout(id);
    const stored = this.loadStoredLayouts()[id];
    if (!stored) {
      return layout;
    }

    if (
      Array.isArray(stored.paths) &&
      stored.paths.length > 0 &&
      stored.paths.every((path) => Array.isArray(path) && path.length >= 2)
    ) {
      layout.paths = stored.paths.map((path) => path.map((point) => ({ x: point.x, y: point.y })));
      layout.path = layout.paths[0];
    } else if (Array.isArray(stored.path) && stored.path.length >= 2) {
      layout.path = stored.path.map((point) => ({ x: point.x, y: point.y }));
      layout.paths = [layout.path];
    }
    if (typeof stored.width === "number") {
      layout.width = Math.max(DESIGN_WIDTH, stored.width);
    }
    if (Array.isArray(stored.towerSlots) && stored.towerSlots.length > 0) {
      layout.towerSlots = stored.towerSlots.map((point) => ({ x: point.x, y: point.y }));
    }
    if (stored.gate) {
      layout.gate = { ...layout.gate, ...stored.gate };
    }
    if (stored.startingUnit) {
      layout.startingUnit = { ...layout.startingUnit, ...stored.startingUnit };
    }
    return layout;
  }

  private saveMapLayout() {
    const stored = this.loadStoredLayouts();
    stored[this.activeMapId] = {
      width: this.map.width,
      path: this.map.paths[0].map((point) => ({ ...point })),
      paths: this.map.paths.map((path) => path.map((point) => ({ ...point }))),
      towerSlots: this.map.towerSlots.map((point) => ({ ...point })),
      gate: { ...this.map.gate },
      startingUnit: { ...this.map.startingUnit },
    };
    localStorage.setItem(MAP_LAYOUT_STORAGE_KEY, JSON.stringify(stored));
  }

  private loadGameSettings() {
    try {
      const raw = localStorage.getItem(GAME_SETTINGS_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const settings = JSON.parse(raw) as { difficultyMode?: string; battleSpeed?: number };
      if (settings.difficultyMode && settings.difficultyMode in DIFFICULTY_MODES) {
        this.difficultyMode = settings.difficultyMode as DifficultyMode;
      }
      if (typeof settings.battleSpeed === "number" && BATTLE_SPEED_OPTIONS.some((speed) => speed === settings.battleSpeed)) {
        this.battleSpeed = settings.battleSpeed;
      }
    } catch {
      // Ignore malformed saved settings and keep defaults.
    }
  }

  private saveGameSettings() {
    localStorage.setItem(
      GAME_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        difficultyMode: this.difficultyMode,
        battleSpeed: this.battleSpeed,
      }),
    );
  }

  private populateMapSelect() {
    if (!this.hud.mapSelect) {
      return;
    }

    this.hud.mapSelect.replaceChildren();
    for (const id of MAP_ORDER) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = MAPS[id].name;
      this.hud.mapSelect.appendChild(option);
    }
    this.hud.mapSelect.value = this.activeMapId;
  }

  private populateBattleSettings() {
    if (this.hud.difficultySelect) {
      this.hud.difficultySelect.replaceChildren();
      for (const [id, difficulty] of Object.entries(DIFFICULTY_MODES) as [
        DifficultyMode,
        (typeof DIFFICULTY_MODES)[DifficultyMode],
      ][]) {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = difficulty.name;
        this.hud.difficultySelect.appendChild(option);
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

    this.updateBattleSettingsControls();
  }

  private updateBattleSettingsControls() {
    if (this.hud.difficultySelect) {
      this.hud.difficultySelect.value = this.difficultyMode;
    }
    if (this.hud.battleSpeedSelect) {
      this.hud.battleSpeedSelect.value = String(this.battleSpeed);
    }
  }

  private formatBattleSpeed(speed: number) {
    return `${Number.isInteger(speed) ? speed.toFixed(0) : speed.toFixed(1)}x`;
  }

  private currentDifficulty() {
    return DIFFICULTY_MODES[this.difficultyMode];
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
    this.hud.audioButton.textContent = this.audio.isEnabled ? "Audio On" : "Audio Off";
  }

  private setBuildMode(mode: BuildMode) {
    this.buildMode = mode;
    this.purifyMode = false;
    this.statusOverrideMs = 0;
    this.renderBuildPanel();
    this.updateHud();
  }

  private toggleMapEditMode() {
    this.mapEditMode = !this.mapEditMode;
    this.editorDragTarget = null;
    this.purifyMode = false;
    this.statusOverrideMs = 0;
    this.renderEditorOverlay();
    this.renderBuildPanel();
    this.updateMapEditorControls();
    this.updateHud();
  }

  private updateMapEditorControls() {
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
    const editingPath = this.mapEditMode && this.mapEditTool === "path";
    if (this.hud.addPathPointButton) {
      this.hud.addPathPointButton.disabled = !editingPath;
    }
    if (this.hud.removePathPointButton) {
      const selectedPath = this.map.paths[this.selectedPathRouteIndex] ?? this.map.paths[0];
      const selectedCanRemove =
        editingPath &&
        this.selectedPathIndex > 0 &&
        this.selectedPathIndex < selectedPath.length - 1 &&
        selectedPath.length > 2;
      this.hud.removePathPointButton.disabled = !selectedCanRemove;
    }
    this.updateMapScrollControls();
  }

  private updateMapScrollControls() {
    const maxCameraX = this.maxCameraX();
    if (this.hud.scrollLeftButton) {
      this.hud.scrollLeftButton.disabled = maxCameraX <= 0 || this.cameraX <= 0;
    }
    if (this.hud.scrollRightButton) {
      this.hud.scrollRightButton.disabled = maxCameraX <= 0 || this.cameraX >= maxCameraX;
    }
  }

  private applyMapEditChange() {
    this.map.path = this.map.paths[0];
    this.saveMapLayout();
    this.redrawMapLayer();
    this.syncTowersToSlots();
    this.renderEditorOverlay();
    this.updateMapEditorControls();
    this.updateMinimap();
    this.updateHud();
  }

  private beginPurify() {
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
      this.difficultyMode,
      this.purifyMode ? "purify" : "ready",
      this.mapEditMode ? "editing" : "playing",
      this.battleState,
      Math.floor(this.energy),
    ].join(":");
  }

  private renderBuildPanel() {
    this.buildPanelStateKey = this.getBuildPanelStateKey();
    this.hud.towersPanel?.classList.toggle("active", this.buildMode === "towers");
    this.hud.hostsPanel?.classList.toggle("active", this.buildMode === "hosts");
    this.hud.abilityPanel?.classList.toggle("active", this.buildMode === "ability");
    this.updateMapEditorControls();

    if (!this.hud.buildList || !this.hud.buildDetail) {
      return;
    }

    this.hud.buildList.replaceChildren();

    if (this.buildMode === "towers") {
      for (const [kind, tower] of Object.entries(TOWER_TYPES) as [TowerKind, (typeof TOWER_TYPES)[TowerKind]][]) {
        const button = this.createBuildButton({
          name: tower.name,
          cost: tower.cost,
          imageSrc: tower.texture,
          accentColor: tower.color,
          active: this.selectedTowerKind === kind,
          affordable: this.energy >= tower.cost,
          onClick: () => {
            this.selectedTowerKind = kind;
            this.purifyMode = false;
            this.renderBuildPanel();
            this.updateHud();
          },
        });
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
              text: `${selected.name}: ${selected.description} Cost ${selected.cost} energy. Range ${selected.range}.${damageStats}${beamStats} Build on an empty pedestal.`,
            }
          : { text: "Choose a tower, then click an empty pedestal." },
      );
      return;
    }

    if (this.buildMode === "hosts") {
      for (const [kind, host] of Object.entries(HOST_TYPES) as [HostKind, (typeof HOST_TYPES)[HostKind]][]) {
        const button = this.createBuildButton({
          name: host.name,
          cost: host.cost,
          imageSrc: animationCatalog.alizelsHost.textures.idle,
          accentColor: host.tint,
          active: this.selectedHostKind === kind,
          affordable: this.energy >= host.cost,
          onClick: () => {
            this.selectedHostKind = kind;
            this.purifyMode = false;
            this.renderBuildPanel();
            this.updateHud();
          },
        });
        this.hud.buildList.appendChild(button);
      }

      const selected = this.selectedHostKind ? HOST_TYPES[this.selectedHostKind] : null;
      this.renderBuildDetail(
        selected
          ? {
              imageSrc: animationCatalog.alizelsHost.textures.idle,
              accentColor: selected.tint,
              text: `${selected.name}: ${selected.description} Cost ${selected.cost} energy. ${selected.role}. Deploy to any point on the path.`,
            }
          : { text: "Choose a host, then click any valid path point." },
      );
      return;
    }

    const button = this.createBuildButton({
      name: "Purify Corruption",
      cost: PURIFY_COST,
      imageSrc: animationCatalog.alizelsHost.textures.cast,
      accentColor: 0xf5d77e,
      active: this.purifyMode,
      affordable: this.energy >= PURIFY_COST,
      onClick: () => this.beginPurify(),
    });
    this.hud.buildList.appendChild(button);
    this.renderBuildDetail({
      imageSrc: animationCatalog.alizelsHost.textures.cast,
      accentColor: 0xf5d77e,
      text: this.purifyMode
        ? `Click an enemy or corrupted host to spend ${PURIFY_COST} energy and return it to the angel side.`
        : `Spend ${PURIFY_COST} energy to capture demons or reclaim corrupted hosts. Demon casters can corrupt hosts with projectiles.`,
    });
  }

  private createBuildButton(options: {
    name: string;
    cost: number;
    imageSrc?: string;
    accentColor?: number;
    active: boolean;
    affordable: boolean;
    onClick: () => void;
  }) {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.toggle("active", options.active);
    button.classList.toggle("unavailable", !options.affordable || this.battleState !== "playing");
    button.disabled = this.battleState !== "playing" || this.mapEditMode;

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
    cost.textContent = String(options.cost);
    button.appendChild(cost);

    button.addEventListener("click", (event) => {
      event.preventDefault();
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
    this.clearLayer(this.mapLayer);
    this.clearLayer(this.towerLayer);
    this.clearLayer(this.unitLayer);
    this.clearLayer(this.enemyLayer);
    this.clearLayer(this.projectileLayer);
    this.clearLayer(this.overlayLayer);
    this.clearLayer(this.editorLayer);

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
    this.spawnTimerMs = 0;
    this.betweenWaveTimerMs = 900;
    this.energy = this.currentDifficulty().startingEnergy;
    this.buildMode = "towers";
    this.selectedTowerKind = "lightspire";
    this.selectedHostKind = "host";
    this.purifyMode = false;
    this.buildPanelStateKey = "";
    this.statusOverrideMs = 0;
    this.gateHp = this.map.gate.maxHp;
    this.battleState = "playing";
    this.cameraX = clamp(this.cameraX, 0, this.maxCameraX());

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
    this.layout();
    this.updateHud();
  }

  private redrawMapLayer() {
    this.clearLayer(this.mapLayer);
    this.drawMap();
    this.createGate();
    this.drawPedestals();
  }

  private drawMap() {
    const bg = new Sprite(this.textures.maps[this.activeMapId]);
    bg.width = this.map.width;
    bg.height = DESIGN_HEIGHT;
    this.mapLayer.addChild(bg);

    const mapTint = new Graphics()
      .rect(0, 0, this.map.width, DESIGN_HEIGHT)
      .fill({ color: 0x05070b, alpha: 0.08 })
      .rect(24, 24, this.map.width - 48, DESIGN_HEIGHT - 48)
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
  }

  private createGate() {
    this.gateGraphic = new Graphics();
    this.gateHpGraphic = new Graphics();
    this.mapLayer.addChild(this.gateGraphic, this.gateHpGraphic);
    this.drawGate();
  }

  private drawGate() {
    const gate = this.map.gate;
    const hpPercent = clamp(this.gateHp / gate.maxHp, 0, 1);
    this.gateGraphic
      .clear()
      .roundRect(gate.x, gate.y, gate.width, gate.height, 8)
      .fill(0x605445)
      .stroke({ color: 0xf3d685, width: 3 })
      .moveTo(gate.x + gate.width / 2, gate.y + 12)
      .lineTo(gate.x + gate.width / 2, gate.y + gate.height - 12)
      .stroke({ color: 0x231a14, width: 3, alpha: 0.55 });

    this.gateHpGraphic
      .clear()
      .roundRect(gate.x - 10, gate.y - 18, gate.width + 20, 8, 4)
      .fill(0x1d1511)
      .roundRect(gate.x - 10, gate.y - 18, (gate.width + 20) * hpPercent, 8, 4)
      .fill(hpPercent > 0.36 ? 0x91d18b : 0xdf6b61);
  }

  private drawPedestals() {
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
      this.mapLayer.addChild(label);
    }
  }

  private renderEditorOverlay() {
    this.clearLayer(this.editorLayer);
    if (!this.mapEditMode) {
      return;
    }

    const pathGuide = new Graphics();
    for (const pathPoints of this.map.paths) {
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

    for (const [pathId, pathPoints] of this.map.paths.entries()) {
      const routeLabel = String.fromCharCode(65 + pathId);
      for (const [index, point] of pathPoints.entries()) {
        const isStart = index === 0;
        const isEnd = index === pathPoints.length - 1;
        const color = isStart ? 0xff4b65 : isEnd ? 0x91d18b : 0x8ed8ff;
        const selected =
          this.mapEditTool === "path" && pathId === this.selectedPathRouteIndex && index === this.selectedPathIndex;
        this.editorLayer.addChild(
          this.createEditorHandle({
            point,
            color,
            label: isStart ? `${routeLabel}S` : isEnd ? `${routeLabel}G` : `${routeLabel}${index + 1}`,
            selected,
            target: { type: "path", pathId, index },
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
      if (options.target.type === "slot") {
        this.selectedSlotIndex = options.target.index;
      } else if (options.target.type === "path") {
        this.selectedPathRouteIndex = options.target.pathId;
        this.selectedPathIndex = options.target.index;
      }
      this.renderEditorOverlay();
      this.updateMapEditorControls();
    });

    return container;
  }

  private addPathPoint() {
    if (!this.mapEditMode || this.mapEditTool !== "path") {
      return;
    }

    const path = this.map.paths[this.selectedPathRouteIndex] ?? this.map.paths[0];
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

  private removePathPoint() {
    if (
      !this.mapEditMode ||
      this.mapEditTool !== "path" ||
      this.selectedPathIndex <= 0 ||
      this.selectedPathIndex >= (this.map.paths[this.selectedPathRouteIndex] ?? this.map.paths[0]).length - 1 ||
      (this.map.paths[this.selectedPathRouteIndex] ?? this.map.paths[0]).length <= 2
    ) {
      return;
    }

    const path = this.map.paths[this.selectedPathRouteIndex] ?? this.map.paths[0];
    path.splice(this.selectedPathIndex, 1);
    this.selectedPathIndex = clamp(this.selectedPathIndex - 1, 0, path.length - 1);
    this.applyMapEditChange();
  }

  private async copyCurrentMapLayout() {
    const payload = {
      [this.activeMapId]: {
        path: this.map.paths[0],
        paths: this.map.paths,
        towerSlots: this.map.towerSlots,
        gate: this.map.gate,
        startingUnit: this.map.startingUnit,
      },
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      this.setStatus("Map JSON copied", 1200);
    } catch {
      this.setStatus("Clipboard unavailable", 1400);
    }
  }

  private resetCurrentMapLayout() {
    this.map = this.cloneMapLayout(this.activeMapId);
    this.selectedPathRouteIndex = 0;
    this.selectedPathIndex = 0;
    this.selectedSlotIndex = 0;
    const stored = this.loadStoredLayouts();
    delete stored[this.activeMapId];
    localStorage.setItem(MAP_LAYOUT_STORAGE_KEY, JSON.stringify(stored));
    this.restart();
    this.mapEditMode = true;
    this.renderEditorOverlay();
    this.updateMapEditorControls();
    this.setStatus("Map layout reset", 1200);
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

  private towerMaxHp(kind: TowerKind) {
    const type = TOWER_TYPES[kind];
    const behaviorBonus = type.behavior === "shockwave" ? 90 : type.behavior === "beam" ? 65 : type.behavior === "support" ? 45 : 0;
    return Math.round(240 + type.cost * 1.45 + behaviorBonus);
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

    const maxHp = this.towerMaxHp(kind);
    const tower: Tower = {
      ...type,
      kind,
      slotIndex,
      hp: maxHp,
      maxHp,
      selected: false,
      hitTimerMs: 0,
      x: slot.x,
      y: slot.y,
      cooldownRemainingMs: 250 + Math.random() * 400,
      baseScale,
      animationTimeMs: Math.random() * type.animation.cycleMs,
      firePulseMs: 0,
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
    const offsets: Point[] = [
      { x: 0, y: -32 },
      { x: -44, y: -4 },
      { x: 44, y: -4 },
      { x: -26, y: 34 },
      { x: 26, y: 34 },
    ];

    for (let i = 0; i < type.memberCount; i += 1) {
      const sprite = new Sprite(this.textures.angel.idle);
      sprite.anchor.set(0.5, 0.86);
      sprite.scale.set(animationCatalog.alizelsHost.scale);
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

    const baseName = id === 1 ? "Alizel's Host" : `${type.name} ${id}`;
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
      team: "angel",
      baseName,
      name: baseName,
      x: position.x,
      y: position.y,
      facingX: -1,
      destination: null,
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
    });

    return unit;
  }

  private handlePointerDown(event: FederatedPointerEvent) {
    if (this.battleState !== "playing") {
      return;
    }

    this.startAudio();
    const point = this.world.toLocal(event.global);
    if (point.x < 32 || point.x > this.map.width - 32 || point.y < 32 || point.y > DESIGN_HEIGHT - 32) {
      return;
    }

    if (this.mapEditMode) {
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
      this.setStatus(`${towerType.name} built`, 1200);
      this.updateHud();
      return;
    }

    const deployment = closestPointOnPaths(point, this.map.paths);
    if (deployment.distance > PATH_DEPLOY_TOLERANCE) {
      this.setStatus(this.buildMode === "towers" ? "Choose an empty pedestal" : "Choose a point on the path", 1100);
      return;
    }

    if (this.buildMode === "hosts" && this.selectedHostKind) {
      const hostType = HOST_TYPES[this.selectedHostKind];
      if (this.energy < hostType.cost) {
        this.setStatus(`Need ${hostType.cost} energy`, 1400);
        return;
      }
      const unit = this.createUnit(this.selectedHostKind, deployment.point, true);
      this.units.push(unit);
      this.unitLayer.addChild(unit.container);
      this.selectUnit(unit);
      this.audio.playHostDeploy();
      this.setStatus(`${hostType.name} deployed`, 1100);
      return;
    }

    if (this.selectedUnit && this.selectedUnit.team === "angel" && this.aliveMembers(this.selectedUnit).length > 0) {
      this.selectedUnit.destination = deployment.point;
      this.drawDestination(this.selectedUnit);
    }
  }

  private handlePointerMove(event: FederatedPointerEvent) {
    if (!this.mapEditMode || !this.editorDragTarget) {
      return;
    }

    const point = this.clampMapPoint(this.world.toLocal(event.global));
    if (this.editorDragTarget.type === "slot") {
      this.selectedSlotIndex = this.editorDragTarget.index;
      this.map.towerSlots[this.editorDragTarget.index] = point;
    } else if (this.editorDragTarget.type === "path") {
      this.selectedPathRouteIndex = this.editorDragTarget.pathId;
      this.selectedPathIndex = this.editorDragTarget.index;
      const path = this.map.paths[this.editorDragTarget.pathId] ?? this.map.paths[0];
      path[this.editorDragTarget.index] = point;
      this.map.path = this.map.paths[0];
      if (this.editorDragTarget.pathId === 0 && this.editorDragTarget.index === Math.floor(path.length / 2)) {
        this.map.startingUnit = point;
      }
    } else {
      this.map.gate.x = clamp(point.x - this.map.gate.width / 2, 0, this.map.width - this.map.gate.width);
      this.map.gate.y = clamp(point.y - this.map.gate.height / 2, 0, DESIGN_HEIGHT - this.map.gate.height);
    }

    this.applyMapEditChange();
  }

  private handlePointerUp() {
    this.editorDragTarget = null;
  }

  private handleEditorCanvasClick(point: Point) {
    if (this.mapEditTool !== "path") {
      return;
    }

    const closestPathPoint = this.findClosestPathPoint(point, 24);
    if (closestPathPoint) {
      this.selectedPathRouteIndex = closestPathPoint.pathId;
      this.selectedPathIndex = closestPathPoint.index;
      this.renderEditorOverlay();
      this.updateMapEditorControls();
    }
  }

  private clampMapPoint(point: Point): Point {
    return {
      x: clamp(point.x, 24, this.map.width - 24),
      y: clamp(point.y, 24, DESIGN_HEIGHT - 24),
    };
  }

  private findClosestPathPoint(point: Point, maxDistance: number) {
    let closest: { pathId: number; index: number } | null = null;
    let closestDistance = maxDistance;
    for (const [pathId, path] of this.map.paths.entries()) {
      for (const [index, pathPoint] of path.entries()) {
        const pointDistance = distance(point, pathPoint);
        if (pointDistance <= closestDistance) {
          closestDistance = pointDistance;
          closest = { pathId, index };
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
    if (!this.textures || this.battleState !== "playing") {
      return;
    }

    if (this.mapEditMode) {
      this.statusOverrideMs = Math.max(0, this.statusOverrideMs - deltaMs);
      this.updateMinimap();
      this.updateHud();
      return;
    }

    const battleDeltaMs = deltaMs * this.battleSpeed;
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

  private updateWaveSpawner(deltaMs: number) {
    if (this.currentWaveIndex >= WAVES.length) {
      return;
    }

    if (this.betweenWaveTimerMs > 0) {
      this.betweenWaveTimerMs -= deltaMs;
      return;
    }

    const wave = WAVES[this.currentWaveIndex];
    if (this.waveSpawned >= wave.enemies.length) {
      if (this.enemies.length === 0 && !this.hasAliveDemonUnits()) {
        this.currentWaveIndex += 1;
        this.waveSpawned = 0;
        this.spawnTimerMs = 0;
        this.betweenWaveTimerMs = 1700;
      }
      return;
    }

    this.spawnTimerMs -= deltaMs;
    if (this.spawnTimerMs <= 0) {
      this.spawnEnemy(wave.enemies[this.waveSpawned], this.waveSpawned % this.map.paths.length);
      this.waveSpawned += 1;
      this.spawnTimerMs = wave.intervalMs * this.currentDifficulty().enemySpawnIntervalMultiplier;
    }
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

  private updateUnit(unit: Unit, deltaMs: number) {
    unit.animationTimeMs += deltaMs;

    if (unit.destination) {
      unit.facingX = facingToward(unit, unit.destination, unit.facingX);
      const targetDistance = distance(unit, unit.destination);
      const travel = (unit.speed * deltaMs) / 1000;

      if (targetDistance <= travel) {
        unit.x = unit.destination.x;
        unit.y = unit.destination.y;
        unit.destination = null;
        unit.destinationMarker.clear();
      } else {
        const dx = (unit.destination.x - unit.x) / targetDistance;
        const dy = (unit.destination.y - unit.y) / targetDistance;
        unit.x += dx * travel;
        unit.y += dy * travel;
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
    if (unit.healPerMember > 0 && unit.attackTimerMs <= 0 && aliveMembers.length > 0) {
      const healed = this.healNearbyUnit(unit);
      if (healed) {
        unit.pose = "cast";
        unit.poseTimerMs = 260;
        unit.attackTimerMs = unit.attackCooldownMs;
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
      unit.pose = "cast";
      unit.poseTimerMs = 240;
      this.fireUnitVolley(unit, aliveMembers, attackRange);
      unit.attackTimerMs = moving ? unit.attackCooldownMs * 1.45 : unit.attackCooldownMs;
      this.spendUnitMp(unit, moving ? 3 : 5);
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

  private spendUnitMp(unit: Unit, amount: number) {
    for (const member of this.aliveMembers(unit)) {
      member.mp = clamp(member.mp - amount, 0, member.maxMp);
    }
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
        this.supportNearbyUnits(tower);
        tower.firePulseMs = 420;
        tower.cooldownRemainingMs = tower.cooldownMs;
        continue;
      }

      if (tower.behavior === "slow") {
        const hasTargets =
          this.enemies.some((enemy) => enemy.hp > 0 && distance(tower, enemy) <= tower.range) ||
          this.units.some(
            (unit) => unit.team === "demon" && this.aliveMembers(unit).length > 0 && distance(tower, unit) <= tower.range,
          );
        if (!hasTargets) {
          continue;
        }
        this.createShockwave(tower);
        tower.firePulseMs = 520;
        tower.cooldownRemainingMs = tower.cooldownMs;
        continue;
      }

      if (tower.behavior === "shockwave") {
        const targets = this.enemies.filter((enemy) => enemy.hp > 0 && distance(tower, enemy) <= tower.range);
        const unitTargets = this.units.filter(
          (unit) => unit.team === "demon" && this.aliveMembers(unit).length > 0 && distance(tower, unit) <= tower.range,
        );
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
        tower.firePulseMs = 460;
        tower.cooldownRemainingMs = tower.cooldownMs;
        continue;
      }

      if (tower.behavior === "beam") {
        const target = this.findClosestDemonTarget(tower, tower.range);
        if (!target) {
          continue;
        }

        this.createTowerBeam(tower, target);
        tower.firePulseMs = Math.max(tower.beamDurationMs ?? 420, 420);
        tower.cooldownRemainingMs = tower.cooldownMs;
        continue;
      }

      const target = this.findClosestDemonTarget(tower, tower.range);
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
        );
      } else {
        this.createUnitProjectile(
          { x: tower.x, y: tower.y - 38 },
          target.unit,
          "angel",
          tower.projectileSpeed,
          this.towerDamage(tower.damage),
          tower.color,
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
    const lift = Math.abs(Math.sin(phase * TAU * 2)) * type.animation.bobPx;
    const fire = tower.firePulseMs > 0 ? tower.firePulseMs / 460 : 0;
    const scale = tower.baseScale * (1 + wave * type.animation.pulse + fire * 0.12);
    const rangePhase = (tower.animationTimeMs % 1250) / 1250;

    tower.rangeRing.clear();
    if (tower.selected) {
      tower.rangeRing
        .circle(0, 0, tower.range)
        .stroke({ color: tower.color, width: 2, alpha: 0.18 })
        .circle(0, 0, tower.range * (0.32 + rangePhase * 0.68))
        .stroke({ color: tower.color, width: 4 * (1 - rangePhase), alpha: 0.52 * (1 - rangePhase) });
    }

    tower.sprite.scale.set(scale);
    tower.sprite.position.y = -lift - fire * 4;

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
    tower.selectionRing.clear();
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
    for (const unit of this.units) {
      if (unit.team !== "angel" || distance(tower, unit) > tower.range) {
        continue;
      }

      for (const member of unit.members) {
        if (member.hp <= 0) {
          continue;
        }
        member.hp = clamp(member.hp + 6, 0, member.maxHp);
        member.mp = clamp(member.mp + 9, 0, member.maxMp);
        supported = true;
      }
    }

    if (supported) {
      this.createShockwave({ x: tower.x, y: tower.y, range: tower.range * 0.42, color: 0x8ed8ff });
    }
  }

  private getEnemySlowMultiplier(origin: Point) {
    let strongestSlow = 0;
    for (const tower of this.towers) {
      if (tower.hp <= 0 || tower.behavior !== "slow" || distance(tower, origin) > tower.range) {
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

      this.updateEnemyProjectile(enemy, deltaMs);

      const blockingUnit = this.findClosestAliveUnit(enemy, 78, "angel");
      if (blockingUnit) {
        enemy.facingX = facingToward(enemy, blockingUnit, enemy.facingX);
        this.damageUnit(blockingUnit, this.enemyDamage((deltaMs / 1000) * 2.6), this.enemyDamage((deltaMs / 1000) * 2));
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
    );
    enemy.projectileCooldownMs = type.projectile.cooldownMs;
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
        } else if (targetUnit) {
          const corruption = projectile.allegiance === "demon" ? projectile.damage * 1.1 : 0;
          this.damageUnit(targetUnit, projectile.damage, corruption);
          if (this.units.includes(targetUnit)) {
            this.redrawUnit(targetUnit);
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
      targetOffset,
      graphic,
    });
    this.audio.playDemonProjectile();
  }

  private createShockwave(tower: Pick<Tower, "x" | "y" | "range" | "color">) {
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
    this.audio.playShockwave();
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
    for (const tower of destroyed) {
      this.towerLayer.removeChild(tower.container);
      tower.container.destroy({ children: true });
      if (this.selectedTower === tower) {
        this.selectedTower = null;
      }
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
    unit.destination = null;
    unit.destinationMarker.clear();
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
    unit.selectionRing.clear();
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
      const casting = memberAlive && unit.pose === "cast";
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
      const baseScale = animationCatalog.alizelsHost.scale * member.scaleJitter * (memberHit ? 0.98 : 1);
      const xScale = baseScale * unit.facingX;
      let yScale = baseScale;
      if (walking) {
        yScale *= 1 - Math.abs(step) * 0.025;
      } else if (!memberAlive) {
        yScale *= 0.86;
      }

      const deathFade = memberAlive ? 1 : clamp(1 - member.deathTimerMs / 900, 0, 0.72);
      const deathDrop = memberAlive ? 0 : Math.min(12, member.deathTimerMs / 85);

      member.sprite.texture = this.textures.angel[memberPose];
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
      return;
    }

    const aliveDemonUnits = this.units.filter((unit) => unit.team === "demon" && this.aliveMembers(unit).length > 0);

    if (this.currentWaveIndex >= WAVES.length && this.enemies.length === 0 && aliveDemonUnits.length === 0) {
      this.battleState = "victory";
      this.purifyMode = false;
      this.renderBuildPanel();
      this.audio.playVictory();
      this.setStatus("Citadel held");
    }
  }

  private updateHud() {
    const waveNumber = clamp(this.currentWaveIndex + 1, 1, WAVES.length);
    const wave = WAVES[Math.min(this.currentWaveIndex, WAVES.length - 1)];
    const gatePercent = Math.round((this.gateHp / this.map.gate.maxHp) * 100);
    const selectedUnit = this.selectedUnit;
    const selectedTower = this.selectedTower;
    const members = selectedUnit ? selectedUnit.members : [];
    const livingMemberCount = selectedUnit ? this.aliveMembers(selectedUnit).length : 0;
    const hpTotal = members.reduce((sum, member) => sum + member.hp, 0);
    const hpMax = members.reduce((sum, member) => sum + member.maxHp, 0);
    const mpTotal = members.reduce((sum, member) => sum + member.mp, 0);
    const mpMax = members.reduce((sum, member) => sum + member.maxMp, 0);
    const selectedHp = selectedTower ? selectedTower.hp : hpTotal;
    const selectedMaxHp = selectedTower ? selectedTower.maxHp : hpMax;
    const selectedMeter = selectedTower ? clamp(selectedTower.range / 320, 0, 1) : mpMax > 0 ? mpTotal / mpMax : 0;
    const aliveAngelCount = this.units.filter((unit) => unit.team === "angel" && this.aliveMembers(unit).length > 0).length;
    const angelUnitCount = this.units.filter((unit) => unit.team === "angel").length;
    const aliveDemonUnitCount = this.units.filter(
      (unit) => unit.team === "demon" && this.aliveMembers(unit).length > 0,
    ).length;

    if (this.hud.wave) {
      this.hud.wave.textContent =
        this.currentWaveIndex >= WAVES.length
          ? `${WAVES.length} / ${WAVES.length}`
          : `${waveNumber} / ${WAVES.length} - ${wave.name}`;
    }
    if (this.hud.gate) {
      this.hud.gate.textContent = `${gatePercent}%`;
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
    if (this.hud.unitName) {
      this.hud.unitName.textContent = selectedTower?.name ?? selectedUnit?.name ?? "No unit selected";
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
        this.hud.unitDetail.textContent = `${type.description} HP ${Math.round(selectedTower.hp)} / ${selectedTower.maxHp}. Range ${selectedTower.range}. Damage ${Math.round(this.towerDamage(selectedTower.damage))}. Cooldown ${(selectedTower.cooldownMs / 1000).toFixed(1)}s. ${effect}`;
      } else if (!selectedUnit) {
        this.hud.unitDetail.textContent = "Choose Hosts to deploy a new squad on the path.";
      } else {
        const hostType = HOST_TYPES[selectedUnit.kind as HostKind];
        const corruption = selectedUnit.corruption > 0 ? ` Corruption ${Math.round(selectedUnit.corruption)}%.` : "";
        const teamText = selectedUnit.team === "demon" ? "Demon-controlled. Purify to regain control. " : "";
        const damageText =
          selectedUnit.damagePerMember > 0 ? ` Damage ${Math.round(this.unitDamage(selectedUnit, selectedUnit.damagePerMember))}/member.` : "";
        this.hud.unitDetail.textContent = `${teamText}${hostType.role}. Members ${livingMemberCount} / ${members.length}. HP ${Math.round(hpTotal)} / ${hpMax}. MP ${Math.round(mpTotal)} / ${mpMax}.${damageText}${corruption}`;
      }
    }
    if (this.hud.status && this.battleState === "playing" && this.statusOverrideMs <= 0) {
      if (this.buildMode === "ability" && this.purifyMode) {
        this.hud.status.textContent = "Choose an enemy to purify";
      } else if (this.mapEditMode) {
        this.hud.status.textContent =
          this.mapEditTool === "towerSlots"
            ? "Editing tower bases"
            : this.mapEditTool === "path"
              ? "Editing path"
              : "Editing gate";
      } else if (this.buildMode === "hosts") {
        const hostName = this.selectedHostKind ? HOST_TYPES[this.selectedHostKind].name : "host";
        this.hud.status.textContent = `Choose path point for ${hostName}`;
      } else if (this.buildMode === "towers") {
        this.hud.status.textContent = "Choose an empty pedestal";
      } else if (selectedUnit?.team === "demon") {
        this.hud.status.textContent = "Corrupted host attacking angels";
      } else if (selectedUnit?.destination) {
        this.hud.status.textContent = "Redeploying host";
      } else if (selectedTower) {
        this.hud.status.textContent = `${selectedTower.name} selected`;
      } else {
        this.hud.status.textContent = "Hold the lane";
      }
    }
    if (this.hud.unitHp) {
      this.hud.unitHp.style.width = `${selectedMaxHp > 0 ? (selectedHp / selectedMaxHp) * 100 : 0}%`;
    }
    if (this.hud.unitMp) {
      this.hud.unitMp.style.width = `${selectedMeter * 100}%`;
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
      (maxPanelHeight - padding * 2) / DESIGN_HEIGHT,
    );
    const mapWidth = this.map.width * mapScale;
    const mapHeight = DESIGN_HEIGHT * mapScale;
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

    for (const pathPoints of this.map.paths) {
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
        .circle(projectile.x * mapScale + mapX, projectile.y * mapScale + mapY, 1.6)
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
      .rect(tx(this.cameraX), mapY, Math.min(DESIGN_WIDTH, this.map.width) * mapScale, mapHeight)
      .stroke({ color: 0xffffff, width: 2, alpha: 0.82 })
      .rect(tx(this.cameraX), mapY, Math.min(DESIGN_WIDTH, this.map.width) * mapScale, mapHeight)
      .fill({ color: 0xffffff, alpha: 0.045 });
  }

  private maxCameraX() {
    return Math.max(0, this.map.width - DESIGN_WIDTH);
  }

  private panCamera(delta: number) {
    const next = clamp(this.cameraX + delta, 0, this.maxCameraX());
    if (next === this.cameraX) {
      return;
    }
    this.cameraX = next;
    this.layout();
    this.updateMapScrollControls();
  }

  private handleWheel(event: WheelEvent) {
    if (this.maxCameraX() <= 0) {
      return;
    }

    event.preventDefault();
    const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    this.panCamera(dominantDelta * 1.35);
  }

  private handleMinimapPointerDown(event: FederatedPointerEvent) {
    const metrics = this.minimapMetrics;
    if (!metrics) {
      return;
    }

    event.stopPropagation();
    const mapX = clamp((event.global.x - metrics.mapX) / metrics.scale, 0, this.map.width);
    this.cameraX = clamp(mapX - DESIGN_WIDTH / 2, 0, this.maxCameraX());
    this.layout();
    this.updateMapScrollControls();
    this.updateMinimap();
  }

  private layout() {
    const scale = Math.min(this.app.screen.width / DESIGN_WIDTH, this.app.screen.height / DESIGN_HEIGHT);
    this.cameraX = clamp(this.cameraX, 0, this.maxCameraX());
    this.world.scale.set(scale);
    this.world.position.set(
      (this.app.screen.width - DESIGN_WIDTH * scale) / 2 - this.cameraX * scale,
      (this.app.screen.height - DESIGN_HEIGHT * scale) / 2,
    );
    this.app.stage.hitArea = new Rectangle(0, 0, this.app.screen.width, this.app.screen.height);
    this.updateMinimap();
  }
}
