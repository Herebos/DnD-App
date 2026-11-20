import { isRecord } from "../../utils/isRecord";

export const campaignStatuses = [
  "En préparation",
  "En cours",
  "En pause",
  "Terminée",
] as const;

export const officialClasses = [
  "Artificier",
  "Barbare",
  "Barde",
  "Clerc",
  "Druide",
  "Ensorceleur",
  "Guerrier",
  "Magicien",
  "Moine",
  "Occultiste",
  "Paladin",
  "Rôdeur",
  "Roublard",
] as const;

export type CampaignStatus = (typeof campaignStatuses)[number];

export type CampaignNote = {
  id: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type CampaignLink = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
};

export type CampaignImage = {
  id: string;
  url: string;
  caption: string;
  createdAt: string;
};

export type CampaignPlayer = {
  id: string;
  name: string;
  characterName: string;
  className: string;
  level: number;
};

export type CampaignSummary = {
  id: string;
  content: string;
  publishedAt: string;
  updatedAt: string;
};

export type Campaign = {
  id: string;
  name: string;
  players: CampaignPlayer[];
  summaries: CampaignSummary[];
  notes: CampaignNote[];
  links: CampaignLink[];
  images: CampaignImage[];
  status: CampaignStatus;
  updatedAt: string;
};

export type CampaignForm = Omit<
  Campaign,
  "id" | "updatedAt" | "summaries" | "notes" | "links" | "images"
>;

export type CampaignSummaryForm = {
  content: string;
};

export type CampaignPlayerForm = Omit<CampaignPlayer, "id" | "level"> & {
  level: string;
};

export type StoredCampaigns = {
  campaigns: Campaign[];
  error: string | null;
};

export const STORAGE_KEY = "le-grimoire-campaigns";
export const MAX_CAMPAIGN_IMPORT_BYTES = 4 * 1024 * 1024;

const CAMPAIGN_EXPORT_FORMAT = "le-grimoire-campaigns";
const CAMPAIGN_EXPORT_VERSION = 1;

export function isCampaignStatus(value: unknown): value is CampaignStatus {
  return (
    typeof value === "string" &&
    campaignStatuses.some((status) => status === value)
  );
}

export function getStatusClass(status: CampaignStatus) {
  const normalized = status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll(" ", "-")
    .toLowerCase();
  return `status-${normalized}`;
}

export const emptyForm: CampaignForm = {
  name: "",
  players: [],
  status: "En préparation",
};

export const emptySummaryForm: CampaignSummaryForm = {
  content: "",
};

export const emptyPlayerForm: CampaignPlayerForm = {
  name: "",
  characterName: "",
  className: "",
  level: "1",
};

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

export function parseTags(value: string) {
  return Array.from(
    new Map(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => [tag.toLocaleLowerCase("fr"), tag]),
    ).values(),
  );
}

export function isValidWebUrl(value: unknown): value is string {
  if (!isText(value, 2048)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isCampaignLink(value: unknown): value is CampaignLink {
  if (typeof value !== "object" || value === null) return false;
  const link = value as Record<string, unknown>;
  return (
    typeof link.id === "string" &&
    isText(link.title, 100) &&
    isValidWebUrl(link.url) &&
    isValidDate(link.createdAt)
  );
}

function isCampaignImage(value: unknown): value is CampaignImage {
  if (typeof value !== "object" || value === null) return false;
  const image = value as Record<string, unknown>;
  return (
    typeof image.id === "string" &&
    isValidWebUrl(image.url) &&
    isText(image.caption, 120) &&
    isValidDate(image.createdAt)
  );
}

function isCampaignNote(value: unknown): value is CampaignNote {
  if (typeof value !== "object" || value === null) return false;
  const note = value as Record<string, unknown>;
  return (
    typeof note.id === "string" &&
    isText(note.content, 5000) &&
    Array.isArray(note.tags) &&
    note.tags.length <= 20 &&
    note.tags.every((tag) => isText(tag, 50)) &&
    isValidDate(note.createdAt) &&
    isValidDate(note.updatedAt)
  );
}

function isCampaignSummary(value: unknown): value is CampaignSummary {
  if (typeof value !== "object" || value === null) return false;
  const summary = value as Record<string, unknown>;
  return (
    typeof summary.id === "string" &&
    isText(summary.content, 5000) &&
    isValidDate(summary.publishedAt) &&
    isValidDate(summary.updatedAt)
  );
}

function migratePlayer(value: unknown, campaignId: string, index: number) {
  if (typeof value === "string") {
    if (!isText(value, 60)) return null;
    return {
      id: `${campaignId}-player-${index}`,
      name: value,
      characterName: "",
      className: "",
      level: 1,
    };
  }
  if (typeof value !== "object" || value === null) return null;

  const player = value as Record<string, unknown>;
  if (
    typeof player.id !== "string" ||
    !isText(player.name, 60) ||
    !isText(player.characterName, 60) ||
    !isText(player.className, 40) ||
    typeof player.level !== "number" ||
    !Number.isInteger(player.level) ||
    player.level < 1 ||
    player.level > 20
  ) {
    return null;
  }
  return {
    id: player.id,
    name: player.name,
    characterName: player.characterName,
    className: player.className,
    level: player.level,
  };
}

function migrateCampaign(value: unknown): Campaign | null {
  if (typeof value !== "object" || value === null) return null;
  const campaign = value as Record<string, unknown>;
  if (
    typeof campaign.id !== "string" ||
    !isText(campaign.name, 80) ||
    !campaign.name.trim() ||
    !Array.isArray(campaign.players) ||
    !isCampaignStatus(campaign.status) ||
    !isValidDate(campaign.updatedAt)
  ) {
    return null;
  }

  const campaignId = campaign.id;
  const players = campaign.players.map((player, index) =>
    migratePlayer(player, campaignId, index),
  );
  if (players.some((player) => player === null)) return null;

  let summaries: CampaignSummary[];
  if (isText(campaign.summary, 5000)) {
    summaries = campaign.summary.trim()
      ? [
          {
            id: `legacy-summary-${campaign.id}`,
            content: campaign.summary,
            publishedAt: campaign.updatedAt,
            updatedAt: campaign.updatedAt,
          },
        ]
      : [];
  } else if (
    Array.isArray(campaign.summaries) &&
    campaign.summaries.every(isCampaignSummary)
  ) {
    summaries = campaign.summaries;
  } else {
    return null;
  }

  let notes: CampaignNote[];
  if (isText(campaign.notes, 5000)) {
    notes = campaign.notes.trim()
      ? [
          {
            id: `legacy-${campaign.id}`,
            content: campaign.notes,
            tags: [],
            createdAt: campaign.updatedAt,
            updatedAt: campaign.updatedAt,
          },
        ]
      : [];
  } else if (
    Array.isArray(campaign.notes) &&
    campaign.notes.every(isCampaignNote)
  ) {
    notes = campaign.notes;
  } else {
    return null;
  }

  const links =
    campaign.links === undefined
      ? []
      : Array.isArray(campaign.links) && campaign.links.every(isCampaignLink)
        ? campaign.links
        : null;
  const images =
    campaign.images === undefined
      ? []
      : Array.isArray(campaign.images) && campaign.images.every(isCampaignImage)
        ? campaign.images
        : null;
  if (links === null || images === null) return null;

  return {
    id: campaign.id,
    name: campaign.name,
    players: players.filter(
      (player): player is CampaignPlayer => player !== null,
    ),
    summaries,
    notes,
    links,
    images,
    status: campaign.status,
    updatedAt: campaign.updatedAt,
  };
}

function hasUniqueIds(items: readonly { id: string }[]) {
  const ids = items.map((item) => item.id);
  return (
    ids.every((id) => id.trim().length > 0 && id.length <= 128) &&
    new Set(ids).size === ids.length
  );
}

export function serializeCampaigns(campaigns: Campaign[]) {
  return JSON.stringify(
    {
      format: CAMPAIGN_EXPORT_FORMAT,
      version: CAMPAIGN_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      campaigns,
    },
    null,
    2,
  );
}

export function parseCampaignImport(jsonText: string): Campaign[] {
  if (new TextEncoder().encode(jsonText).byteLength > MAX_CAMPAIGN_IMPORT_BYTES) {
    throw new Error("Le fichier dépasse la taille maximale autorisée de 4 Mo.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Le fichier sélectionné ne contient pas un JSON valide.");
  }

  if (
    !isRecord(parsed) ||
    parsed.format !== CAMPAIGN_EXPORT_FORMAT ||
    parsed.version !== CAMPAIGN_EXPORT_VERSION ||
    !isValidDate(parsed.exportedAt) ||
    !Array.isArray(parsed.campaigns)
  ) {
    throw new Error(
      "Le fichier ne correspond pas à une sauvegarde de campagnes reconnue.",
    );
  }
  if (parsed.campaigns.length === 0) {
    throw new Error("La sauvegarde ne contient aucune campagne à importer.");
  }

  const campaigns = parsed.campaigns.map(migrateCampaign);
  if (campaigns.some((campaign) => campaign === null)) {
    throw new Error(
      "La sauvegarde contient une campagne invalide ou incompatible. Aucune campagne n’a été importée.",
    );
  }

  const validatedCampaigns = campaigns.filter(
    (campaign): campaign is Campaign => campaign !== null,
  );
  if (!hasUniqueIds(validatedCampaigns)) {
    throw new Error("La sauvegarde contient des identifiants de campagne en double.");
  }
  for (const campaign of validatedCampaigns) {
    const collections = [
      campaign.players,
      campaign.summaries,
      campaign.notes,
      campaign.links,
      campaign.images,
    ];
    if (collections.some((items) => !hasUniqueIds(items))) {
      throw new Error(
        "Une campagne contient des identifiants vides, trop longs ou en double.",
      );
    }
  }

  return validatedCampaigns;
}

export function loadCampaigns(): StoredCampaigns {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { campaigns: [], error: null };

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return {
        campaigns: [],
        error:
          "Les campagnes enregistrées sont illisibles. Elles n’ont pas été supprimées.",
      };
    }

    const migrated = parsed.map(migrateCampaign);
    if (migrated.some((campaign) => campaign === null)) {
      return {
        campaigns: [],
        error:
          "Les campagnes enregistrées sont illisibles. Elles n’ont pas été supprimées.",
      };
    }

    return {
      campaigns: migrated.filter((campaign): campaign is Campaign => campaign !== null),
      error: null,
    };
  } catch {
    return {
      campaigns: [],
      error:
        "Impossible de lire les campagnes enregistrées dans ce navigateur.",
    };
  }
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

