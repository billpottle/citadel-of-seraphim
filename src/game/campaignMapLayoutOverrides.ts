export type CampaignMapLevelOverride = {
  id: string;
  index: number;
  title: string;
  mapId: string;
  x: number;
  y: number;
  story: string;
  sideQuest?: boolean;
};

export type CampaignMapLinkOverride = {
  from: string;
  to: string;
};

export type CampaignMapLayoutOverride = {
  levels?: Record<string, { x: number; y: number }>;
  sideQuests?: Record<string, { x: number; y: number }>;
  extraLevels?: CampaignMapLevelOverride[];
  links?: CampaignMapLinkOverride[];
};

export const CAMPAIGN_MAP_LAYOUT_OVERRIDES = {} satisfies CampaignMapLayoutOverride;
