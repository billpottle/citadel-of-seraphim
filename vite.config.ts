import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const overridePath = path.resolve(configDir, "src/game/mapLayoutOverrides.ts");
const campaignMapOverridePath = path.resolve(configDir, "src/game/campaignMapLayoutOverrides.ts");

type MapLayoutPayload = {
  mapId?: unknown;
  layout?: unknown;
};

type CampaignMapLayoutPayload = {
  layout?: unknown;
};

const serializeOverrides = (overrides: Record<string, unknown>) => `import type { MapDefinition, MapId } from "./config";

export type MapLayoutOverride = Partial<Pick<MapDefinition, "path" | "paths" | "sidePaths" | "towerSlots" | "gate" | "startingUnit">>;

export const MAP_LAYOUT_OVERRIDES = ${JSON.stringify(overrides, null, 2)} satisfies Partial<Record<MapId, MapLayoutOverride>>;
`;

const serializeCampaignMapOverrides = (layout: unknown) => `export type CampaignMapLayoutOverride = {
  extraLevels?: Array<{
    id: string;
    index: number;
    title: string;
    mapId: string;
    x: number;
    y: number;
    story: string;
    sideQuest?: boolean;
  }>;
  links?: Array<{ from: string; to: string }>;
  levels?: Record<string, { x: number; y: number }>;
  sideQuests?: Record<string, { x: number; y: number }>;
};

export const CAMPAIGN_MAP_LAYOUT_OVERRIDES = ${JSON.stringify(layout, null, 2)} satisfies CampaignMapLayoutOverride;
`;

const extractOverrides = async () => {
  try {
    const source = await readFile(overridePath, "utf8");
    const match = source.match(/MAP_LAYOUT_OVERRIDES = ([\s\S]*?) satisfies/);
    if (!match) {
      return {};
    }
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return {};
  }
};

function mapLayoutWriter(): Plugin {
  return {
    name: "citadel-map-layout-writer",
    configureServer(server) {
      server.middlewares.use("/__dev/map-layout", (request, response) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.end("Method not allowed");
          return;
        }

        let raw = "";
        request.setEncoding("utf8");
        request.on("data", (chunk) => {
          raw += chunk;
        });
        request.on("end", () => {
          void (async () => {
            const payload = JSON.parse(raw) as MapLayoutPayload;
            if (typeof payload.mapId !== "string" || !payload.layout || typeof payload.layout !== "object") {
              response.statusCode = 400;
              response.end("Invalid map layout payload");
              return;
            }

            const overrides = await extractOverrides();
            overrides[payload.mapId] = payload.layout;
            await writeFile(overridePath, serializeOverrides(overrides), "utf8");
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ ok: true }));
          })().catch((error: unknown) => {
            response.statusCode = 500;
            response.end(error instanceof Error ? error.message : "Failed to save map layout");
          });
        });
      });
      server.middlewares.use("/__dev/campaign-map-layout", (request, response) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.end("Method not allowed");
          return;
        }

        let raw = "";
        request.setEncoding("utf8");
        request.on("data", (chunk) => {
          raw += chunk;
        });
        request.on("end", () => {
          void (async () => {
            const payload = JSON.parse(raw) as CampaignMapLayoutPayload;
            if (!payload.layout || typeof payload.layout !== "object") {
              response.statusCode = 400;
              response.end("Invalid campaign map layout payload");
              return;
            }

            await writeFile(campaignMapOverridePath, serializeCampaignMapOverrides(payload.layout), "utf8");
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ ok: true }));
          })().catch((error: unknown) => {
            response.statusCode = 500;
            response.end(error instanceof Error ? error.message : "Failed to save campaign map layout");
          });
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [mapLayoutWriter()],
});
