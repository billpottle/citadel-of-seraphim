import type { MapDefinition, MapId } from "./config";

export type MapLayoutOverride = Partial<Pick<MapDefinition, "path" | "paths" | "sidePaths" | "towerSlots" | "gate" | "startingUnit">>;

export const MAP_LAYOUT_OVERRIDES = {} satisfies Partial<Record<MapId, MapLayoutOverride>>;
