import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";

const campaignStatuses = [
  "En préparation",
  "En cours",
  "En pause",
  "Terminée",
] as const;

const officialClasses = [
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

type CampaignStatus = (typeof campaignStatuses)[number];

type CampaignNote = {
  id: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type CampaignLink = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
};

type CampaignImage = {
  id: string;
  url: string;
  caption: string;
  createdAt: string;
};

type CampaignPlayer = {
  id: string;
  name: string;
  characterName: string;
  className: string;
  level: number;
};

type CampaignSummary = {
  id: string;
  content: string;
  publishedAt: string;
  updatedAt: string;
};

type Campaign = {
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

type CampaignForm = Omit<
  Campaign,
  "id" | "updatedAt" | "summaries" | "notes" | "links" | "images"
>;

type CampaignSummaryForm = {
  content: string;
};

type CampaignPlayerForm = Omit<CampaignPlayer, "id" | "level"> & {
  level: string;
};

type InitiativeParticipantType = "character" | "monster";

type InitiativeParticipant = {
  id: string;
  name: string;
  type: InitiativeParticipantType;
  initiative: number;
};

type InitiativeEncounter = {
  participants: InitiativeParticipant[];
  activeParticipantId: string | null;
  round: number;
};

const dieTypes = [4, 6, 8, 10, 12, 100, 20] as const;
type DieSides = (typeof dieTypes)[number];

type RolledDie = {
  id: string;
  sides: DieSides;
  result: number | null;
};

type StoredInitiativeEncounter = {
  encounter: InitiativeEncounter;
  error: string | null;
};

type StoredCampaigns = {
  campaigns: Campaign[];
  error: string | null;
};

const STORAGE_KEY = "le-grimoire-campaigns";
const INITIATIVE_STORAGE_KEY = "le-grimoire-initiative";

function isCampaignStatus(value: unknown): value is CampaignStatus {
  return (
    typeof value === "string" &&
    campaignStatuses.some((status) => status === value)
  );
}

function getStatusClass(status: CampaignStatus) {
  const normalized = status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll(" ", "-")
    .toLowerCase();
  return `status-${normalized}`;
}

const destinations = [
  {
    id: "campagnes",
    number: "01",
    title: "Campagnes",
    description: "Retrouvez vos aventures, vos séances et vos notes.",
    icon: "✧",
  },
  {
    id: "encyclopedie",
    number: "02",
    title: "Encyclopédie",
    description: "Créatures, objets, sorts et lieux à portée de main.",
    icon: "⌕",
  },
  {
    id: "personnages",
    number: "03",
    title: "Personnages",
    description: "Gardez vos héros et leurs fiches toujours avec vous.",
    icon: "♙",
  },
  {
    id: "outils",
    number: "04",
    title: "Outils de jeu",
    description: "Préparez vos rencontres et lancez les dés.",
    icon: "⚄",
  },
];

const encyclopediaCategories = [
  { id: "monsters", label: "Créatures" },
  { id: "spells", label: "Sorts" },
  { id: "equipment", label: "Équipement" },
  { id: "magic-items", label: "Objets magiques" },
  { id: "classes", label: "Classes" },
  { id: "races", label: "Races" },
  { id: "backgrounds", label: "Historiques" },
  { id: "ability-scores", label: "Caractéristiques" },
  { id: "conditions", label: "Conditions" },
  { id: "rules", label: "Règles" },
] as const;

type EncyclopediaCategoryId = (typeof encyclopediaCategories)[number]["id"];

type EncyclopediaEntry = {
  index: string;
  name: string;
  url: string;
  [key: string]: unknown;
};

type EncyclopediaResource = {
  id: "class_levels" | "spells" | "subrace" | "subclass";
  label: string;
  url: string;
  contextName?: string;
};

type ClassLevelEntry = Record<string, unknown> & {
  level: number;
};

type SubclassFeature = EncyclopediaEntry & {
  level: number;
  description: string[];
};

type SubclassLevelResource = Record<string, unknown> & {
  level: number;
  features: unknown[];
};

type RacialTraitDescription = {
  index: string;
  name: string;
  descriptions: string[];
};

const API_ORIGIN = "https://www.dnd5eapi.co";
const API_BASE_URL = `${API_ORIGIN}/api/2014`;

const emptyForm: CampaignForm = {
  name: "",
  players: [],
  status: "En préparation",
};

const emptySummaryForm: CampaignSummaryForm = {
  content: "",
};

const emptyPlayerForm: CampaignPlayerForm = {
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

function parseTags(value: string) {
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

function isValidWebUrl(value: unknown): value is string {
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

function loadCampaigns(): StoredCampaigns {
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

function emptyInitiativeEncounter(): InitiativeEncounter {
  return {
    participants: [],
    activeParticipantId: null,
    round: 1,
  };
}

function isInitiativeParticipant(
  value: unknown,
): value is InitiativeParticipant {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    (value.type === "character" || value.type === "monster") &&
    typeof value.initiative === "number" &&
    Number.isFinite(value.initiative)
  );
}

function loadInitiativeEncounter(): StoredInitiativeEncounter {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(INITIATIVE_STORAGE_KEY);
  } catch {
    return {
      encounter: emptyInitiativeEncounter(),
      error:
        "Impossible de lire la rencontre enregistrée dans ce navigateur.",
    };
  }
  if (!stored) {
    return { encounter: emptyInitiativeEncounter(), error: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return {
      encounter: emptyInitiativeEncounter(),
      error:
        "La rencontre enregistrée est illisible. Elle n’a pas été supprimée.",
    };
  }
  if (
    !isRecord(parsed) ||
    !Array.isArray(parsed.participants) ||
    !parsed.participants.every(isInitiativeParticipant) ||
    typeof parsed.round !== "number" ||
    !Number.isInteger(parsed.round) ||
    parsed.round < 1 ||
    !(
      parsed.activeParticipantId === null ||
      typeof parsed.activeParticipantId === "string"
    ) ||
    (typeof parsed.activeParticipantId === "string" &&
      !parsed.participants.some(
        (participant) =>
          isInitiativeParticipant(participant) &&
          participant.id === parsed.activeParticipantId,
      ))
  ) {
    return {
      encounter: emptyInitiativeEncounter(),
      error:
        "La rencontre enregistrée est illisible. Elle n’a pas été supprimée.",
    };
  }

  return {
    encounter: {
      participants: parsed.participants,
      activeParticipantId: parsed.activeParticipantId,
      round: parsed.round,
    },
    error: null,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

type MarkdownContentProps = {
  content: string;
  className?: string;
  compactLinks?: boolean;
};

const MarkdownRenderer = lazy(() => import("./MarkdownRenderer"));

function MarkdownContent(props: MarkdownContentProps) {
  const { content, className = "" } = props;
  return (
    <Suspense
      fallback={
        <div className={`markdown-content ${className}`.trim()}>{content}</div>
      }
    >
      <MarkdownRenderer {...props} />
    </Suspense>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

function summarizeApiValue(value: unknown): string | null {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return typeof value === "boolean" ? (value ? "Oui" : "Non") : String(value);
  }
  if (Array.isArray(value)) {
    const values = value
      .map(summarizeApiValue)
      .filter((item): item is string => item !== null);
    return values.length ? values.join(", ") : null;
  }
  if (!isRecord(value)) return null;
  if (
    typeof value.damage_dice === "string" &&
    isRecord(value.damage_type) &&
    typeof value.damage_type.name === "string"
  ) {
    return `${value.damage_dice} - ${value.damage_type.name}`;
  }
  if (typeof value.quantity === "number" && typeof value.unit === "string") {
    return `${value.quantity} ${value.unit}`;
  }
  if (typeof value.name === "string") return value.name;
  if (typeof value.value === "number" && typeof value.type === "string") {
    return `${value.value} (${value.type})`;
  }
  const values = Object.entries(value)
    .filter(([, item]) => typeof item === "string" || typeof item === "number")
    .map(([key, item]) => `${key} : ${item}`);
  return values.length ? values.join(" · ") : null;
}

function formatEncyclopediaDescription(value: string | string[]) {
  const lines = Array.isArray(value) ? value : [value];
  return lines.reduce((formatted, line, index) => {
    if (index === 0) return line;

    const previousLine = lines[index - 1];
    const isTableRow = (text: string) => /^\s*\|/.test(text);
    const isListItem = (text: string) =>
      /^\s*(?:[-*+]|\d+[.)])\s+/.test(text);
    const sameMarkdownBlock =
      (isTableRow(line) && isTableRow(previousLine)) ||
      (isListItem(line) && isListItem(previousLine));

    return `${formatted}${sameMarkdownBlock ? "\n" : "\n\n"}${line}`;
  }, "");
}

function formatSpecialAbilityDescription(value: string) {
  return value.replace(/\n([^\n.]+\.)\s/g, "\n**$1** ");
}

function getEncyclopediaEntryMeta(
  entry: EncyclopediaEntry,
  category: EncyclopediaCategoryId,
) {
  if (category === "monsters") {
    const parts = [entry.size, entry.type].filter(
      (value): value is string => typeof value === "string",
    );
    if (typeof entry.challenge_rating === "number") {
      parts.push(`FP ${entry.challenge_rating}`);
    }
    return parts.join(" · ");
  }
  if (category === "spells" && typeof entry.level === "number") {
    return entry.level === 0 ? "Tour de magie" : `${entry.level}e niveau`;
  }
  return "";
}

const encyclopediaFieldLabels: Record<string, string> = {
  ability_bonuses: "Bonus de caractéristiques",
  ability_score: "Caractéristique",
  age: "Âge",
  alignment: "Alignement",
  arcane_recovery_levels: "Niveaux récupérés par la Récupération arcanique",
  aura_range: "Portée de l’aura",
  bardic_inspiration_die: "Dé d’Inspiration bardique",
  brutal_critical_dice: "Dés de critique brutal",
  cantrips_known: "Tours de magie connus",
  choose: "Nombre de choix",
  class_levels: "Progression des niveaux",
  class_specific: "Capacités propres à la classe",
  cleansing_touch_uses: "Utilisations de Guérison des maladies",
  damage: "Dégâts",
  desc: "Description",
  destroy_undead_cr: "Facteur de puissance de Renvoi des morts-vivants",
  equipment: "Équipement",
  equipment_category: "Catégorie d’équipement",
  extra_attacks: "Attaques supplémentaires",
  features: "Capacités",
  favored_enemies: "Ennemis jurés",
  favored_terrain: "Terrains de prédilection",
  full_name: "Nom complet",
  feature: "Aptitude spéciale",
  personality_traits: "Traits de personnalité",
  ideals: "Idéaux",
  bonds: "Liens",
  flaws: "Défauts",
  children: "Sous-règles",
  subsections: "Sous-sections",
  from: "Choix disponibles",
  hit_die: "Dé de vie",
  indomitable_uses: "Utilisations d’Indomptable",
  info: "Informations sur l’incantation",
  item: "Élément",
  ki_points: "Points de Ki",
  language_desc: "Langues",
  languages: "Langues maîtrisées",
  level: "Niveau",
  martial_arts: "Arts martiaux",
  metamagic_known: "Options de Métamagie connues",
  minimum_score: "Score minimum",
  multi_classing: "Multiclassage",
  name: "Nom",
  option_set_type: "Type de choix",
  options: "Options",
  prerequisites: "Prérequis",
  prof_bonus: "Bonus de maîtrise",
  proficiencies: "Maîtrises",
  proficiency_choices: "Choix de maîtrises",
  quantity: "Quantité",
  race: "Race",
  racial_traits: "Traits raciaux",
  rage_count: "Nombre de rages",
  rage_damage: "Dégâts supplémentaires de rage",
  saving_throws: "Jets de sauvegarde",
  sneak_attack: "Attaque sournoise",
  size: "Taille",
  size_description: "Description de la taille",
  sorcery_points: "Points de sorcellerie",
  spell_slots: "Emplacements de sort",
  spells_known: "Sorts connus",
  speed: "Vitesse",
  spell_slots_level_1: "Emplacements de niveau 1",
  spell_slots_level_2: "Emplacements de niveau 2",
  spell_slots_level_3: "Emplacements de niveau 3",
  spell_slots_level_4: "Emplacements de niveau 4",
  spell_slots_level_5: "Emplacements de niveau 5",
  spell_slots_level_6: "Emplacements de niveau 6",
  spell_slots_level_7: "Emplacements de niveau 7",
  spell_slots_level_8: "Emplacements de niveau 8",
  spell_slots_level_9: "Emplacements de niveau 9",
  spellcasting: "Incantation",
  spellcasting_ability: "Caractéristique d’incantation",
  spells: "Sorts associés",
  starting_proficiencies: "Maîtrises de départ",
  language_options: "Choix de langues",
  subclass_flavor: "Tradition ou archétype",
  starting_equipment: "Équipement de départ",
  starting_equipment_options: "Choix d’équipement de départ",
  unarmored_movement: "Déplacement sans armure",
  wild_shape_fly: "Vol sous Forme sauvage",
  wild_shape_max_cr: "Facteur de puissance maximal de Forme sauvage",
  wild_shape_swim: "Nage sous Forme sauvage",
  subraces: "Sous-races",
  subclasses: "Sous-classes",
  traits: "Traits raciaux",
  type: "Type",
  usage: "Utilisation",
};

function getEncyclopediaFieldLabel(key: string) {
  return (
    encyclopediaFieldLabels[key] ??
    key
      .split("_")
      .map((part) => part.charAt(0).toLocaleUpperCase("fr") + part.slice(1))
      .join(" ")
  );
}

const optionMetadataValues = new Set([
  "option_array",
  "options_array",
  "reference",
  "counted_reference",
  "multiple",
  "choice",
]);

function EncyclopediaApiValue({
  value,
  hideOptionMetadata = false,
  hideBackgroundFieldLabels = false,
}: {
  value: unknown;
  hideOptionMetadata?: boolean;
  hideBackgroundFieldLabels?: boolean;
}) {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    if (
      hideOptionMetadata &&
      typeof value === "string" &&
      optionMetadataValues.has(value)
    ) {
      return null;
    }
    return (
      <span className="encyclopedia-api-text">
        {typeof value === "boolean" ? (value ? "Oui" : "Non") : value}
      </span>
    );
  }
  if (Array.isArray(value)) {
    const visibleItems = hideOptionMetadata
      ? value.filter(
          (item) =>
            typeof item !== "string" ||
            !optionMetadataValues.has(item),
        )
      : value;
    if (!visibleItems.length) {
      if (hideOptionMetadata) return null;
      return <span className="encyclopedia-api-muted">Aucun</span>;
    }
    return (
      <ul className="encyclopedia-api-list">
        {visibleItems.map((item, index) => (
          <li key={index}>
            <EncyclopediaApiValue
              value={item}
              hideOptionMetadata={hideOptionMetadata}
              hideBackgroundFieldLabels={hideBackgroundFieldLabels}
            />
          </li>
        ))}
      </ul>
    );
  }
  if (!isRecord(value)) return null;
  if (
    hideOptionMetadata &&
    typeof value.count === "number" &&
    isRecord(value.of) &&
    typeof value.of.name === "string"
  ) {
    return (
      <span className="encyclopedia-api-reference">
        {value.count} {value.of.name}
      </span>
    );
  }

  const fields = Object.entries(value).filter(
    ([key, item]) =>
      key !== "index" &&
      key !== "url" &&
      key !== "updated_at" &&
      (!hideOptionMetadata ||
        (key !== "option_set_type" &&
          key !== "option_type" &&
          key !== "count" &&
          key !== "of" &&
          key !== "resource_list_url" &&
          !(
            key === "type" &&
            typeof item === "string" &&
            optionMetadataValues.has(item)
          ))),
  );
  if (!fields.length) return null;
  if (
    typeof value.name === "string" &&
    fields.every(([key]) => key === "name")
  ) {
    return <span className="encyclopedia-api-reference">{value.name}</span>;
  }
  return (
    <dl className="encyclopedia-api-object">
      {fields.map(([key, item]) => {
        const hideFieldLabel =
          (hideOptionMetadata && key === "choice") ||
          (hideBackgroundFieldLabels &&
            ["options", "string", "desc", "alignments"].includes(key));

        return (
          <div
            className={hideFieldLabel ? "encyclopedia-api-object-unlabeled" : ""}
            key={key}
          >
            {hideFieldLabel ? (
              <EncyclopediaApiValue
                value={item}
                hideOptionMetadata={hideOptionMetadata}
                hideBackgroundFieldLabels={hideBackgroundFieldLabels}
              />
            ) : (
              <>
                <dt>{getEncyclopediaFieldLabel(key)}</dt>
                <dd>
                  <EncyclopediaApiValue
                    value={item}
                    hideOptionMetadata={hideOptionMetadata}
                    hideBackgroundFieldLabels={hideBackgroundFieldLabels}
                  />
                </dd>
              </>
            )}
          </div>
        );
      })}
    </dl>
  );
}

function getClassLevels(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is ClassLevelEntry =>
          isRecord(item) && typeof item.level === "number",
      )
    : [];
}

function getClassSpells(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.results)) return [];
  return value.results.filter(
    (item): item is EncyclopediaEntry & { level: number } =>
      isRecord(item) &&
      typeof item.index === "string" &&
      typeof item.name === "string" &&
      typeof item.url === "string" &&
      typeof item.level === "number",
  );
}

function getEncyclopediaReferences(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is EncyclopediaEntry =>
      isRecord(item) &&
      typeof item.index === "string" &&
      typeof item.name === "string" &&
      typeof item.url === "string",
  );
}

function getSubclassLevelResources(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is SubclassLevelResource =>
          isRecord(item) &&
          typeof item.level === "number" &&
          Array.isArray(item.features),
      )
    : [];
}

function SubclassFeaturesView({
  features,
  levelResources,
}: {
  features: SubclassFeature[];
  levelResources: SubclassLevelResource[];
}) {
  const featuresByIndex = new Map(
    features.map((feature) => [feature.index, feature]),
  );

  function renderFeature(reference: EncyclopediaEntry) {
    const feature = featuresByIndex.get(reference.index);
    return (
      <article
        className="encyclopedia-subclass-feature"
        key={reference.index}
      >
        <h4>{feature?.name ?? reference.name}</h4>
        {feature?.description.map((paragraph, index) => (
          <p key={`${reference.index}-${index}`}>{paragraph}</p>
        ))}
      </article>
    );
  }

  const renderedLevels = levelResources.map((resource) => ({
    level: resource.level,
    features: getEncyclopediaReferences(resource.features),
  }));
  const levelFeatureIndexes = new Set(
    renderedLevels.flatMap((resource) =>
      resource.features.map((feature) => feature.index),
    ),
  );
  const remainingFeatures = features.filter(
    (feature) =>
      !levelFeatureIndexes.has(feature.index),
  );

  if (!features.length && !renderedLevels.length) {
    return (
      <div className="encyclopedia-message">
        <strong>Aucune capacité répertoriée.</strong>
      </div>
    );
  }

  return (
    <div className="encyclopedia-subclass-features">
      {renderedLevels.map((resource) => (
        <section className="encyclopedia-subclass-level" key={resource.level}>
          <h3>Niveau {resource.level}</h3>
          {resource.features.length ? (
            resource.features.map(renderFeature)
          ) : (
            <p className="encyclopedia-api-muted">Aucune capacité à ce niveau.</p>
          )}
        </section>
      ))}
      {remainingFeatures.length > 0 && (
        <section className="encyclopedia-subclass-level">
          <h3>Autres capacités</h3>
          {remainingFeatures.map((feature) => renderFeature(feature))}
        </section>
      )}
    </div>
  );
}

function ClassProgressionTable({ data }: { data: unknown }) {
  const levels = getClassLevels(data);
  return (
    <div className="encyclopedia-level-table-wrap">
      <table className="encyclopedia-level-table">
        <thead>
          <tr>
            <th scope="col">Niveau</th>
            <th scope="col">Bonus de maîtrise</th>
            <th scope="col">Améliorations de caractéristiques</th>
            <th scope="col">Capacités</th>
            <th scope="col">Incantation</th>
          </tr>
        </thead>
        <tbody>
          {levels.map((level) => {
            const levelKey =
              typeof level.index === "string" ? level.index : String(level.level);
            const features = Array.isArray(level.features)
              ? level.features
                  .filter(
                    (feature): feature is Record<string, unknown> =>
                      isRecord(feature),
                  )
                  .map((feature) => feature.name)
                  .filter((name): name is string => typeof name === "string")
              : [];
            const casting = isRecord(level.spellcasting)
              ? level.spellcasting
              : null;
            const slots = casting
              ? Object.entries(casting)
                  .filter(
                    ([key, value]) =>
                      key.startsWith("spell_slots_level_") &&
                      typeof value === "number" &&
                      value > 0,
                  )
                  .map(([key, value]) => {
                    const slotLevel = key.replace("spell_slots_level_", "");
                    return `Niveau ${slotLevel} : ${value} emplacement(s)`;
                  })
              : [];

            return (
              <tr key={levelKey}>
                <th scope="row">{level.level}</th>
                <td>
                  {typeof level.prof_bonus === "number"
                    ? `+${level.prof_bonus}`
                    : "—"}
                </td>
                <td>
                  {typeof level.ability_score_bonuses === "number"
                    ? level.ability_score_bonuses
                    : "—"}
                </td>
                <td>
                  {features.length ? features.join(", ") : "—"}
                  {level.class_specific !== undefined && (
                    <EncyclopediaApiValue value={level.class_specific} />
                  )}
                </td>
                <td>
                  {casting && typeof casting.cantrips_known === "number" && (
                    <span className="encyclopedia-level-cantrips">
                      Tours de magie connus : {casting.cantrips_known}
                    </span>
                  )}
                  {slots.length ? slots.join(" · ") : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

async function fetchApiJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: "application/json",
      "Accept-Language": "fr-FR",
    },
  });
  if (!response.ok) {
    throw new Error(`L’API a répondu avec le statut ${response.status}.`);
  }
  return response.json() as Promise<unknown>;
}

function RacialTraitDescriptions({ value }: { value: unknown }) {
  const [traits, setTraits] = useState<RacialTraitDescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState(0);
  const references = getEncyclopediaReferences(value);

  useEffect(() => {
    const controller = new AbortController();
    setTraits([]);
    setError(null);
    setIsLoading(true);

    Promise.all(
      references.map(async (reference) => {
        const response = await fetchApiJson(
          new URL(reference.url, API_ORIGIN).toString(),
          controller.signal,
        );
        if (
          !isRecord(response) ||
          typeof response.index !== "string" ||
          typeof response.name !== "string" ||
          (!Array.isArray(response.desc) && typeof response.desc !== "string")
        ) {
          throw new Error(
            `Le format du trait « ${reference.name} » est inattendu.`,
          );
        }
        const descriptions =
          typeof response.desc === "string"
            ? [response.desc]
            : response.desc.filter(
                (description): description is string =>
                  typeof description === "string",
              );
        if (!descriptions.length) {
          throw new Error(
            `La description du trait « ${reference.name} » est indisponible.`,
          );
        }
        return {
          index: response.index,
          name: response.name,
          descriptions,
        };
      }),
    )
      .then((loadedTraits) => {
        if (!controller.signal.aborted) setTraits(loadedTraits);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Une erreur inconnue est survenue.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [value, request]);

  if (isLoading) {
    return (
      <p className="encyclopedia-api-muted" role="status">
        Chargement des descriptions des traits…
      </p>
    );
  }
  if (error) {
    return (
      <div className="encyclopedia-message" role="alert">
        <span>{error}</span>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => setRequest((current) => current + 1)}
        >
          Réessayer
        </button>
      </div>
    );
  }
  if (!traits.length) {
    return (
      <p className="encyclopedia-api-muted">
        Aucun trait racial.
      </p>
    );
  }

  return (
    <div className="encyclopedia-racial-trait-list">
      {traits.map((trait) => (
        <article className="encyclopedia-racial-trait" key={trait.index}>
          <h4>{trait.name}</h4>
          {trait.descriptions.map((description, index) => (
            <p key={`${trait.index}-${index}`}>{description}</p>
          ))}
        </article>
      ))}
    </div>
  );
}

function EncyclopediaPage() {
  const [categoryId, setCategoryId] =
    useState<EncyclopediaCategoryId>("monsters");
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<EncyclopediaEntry[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [listRequest, setListRequest] = useState(0);
  const [selectedEntry, setSelectedEntry] =
    useState<EncyclopediaEntry | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [classResource, setClassResource] =
    useState<EncyclopediaResource | null>(null);
  const [classResourceData, setClassResourceData] = useState<unknown>(null);
  const [isClassResourceLoading, setIsClassResourceLoading] = useState(false);
  const [classResourceError, setClassResourceError] = useState<string | null>(
    null,
  );
  const [classResourceRequest, setClassResourceRequest] = useState(0);
  const [classSpellSearch, setClassSpellSearch] = useState("");
  const [subclassFeatures, setSubclassFeatures] = useState<SubclassFeature[]>(
    [],
  );
  const [subclassLevelResources, setSubclassLevelResources] = useState<
    SubclassLevelResource[]
  >([]);
  const activeCategory =
    encyclopediaCategories.find((category) => category.id === categoryId) ??
    encyclopediaCategories[0];

  useEffect(() => {
    const controller = new AbortController();
    setEntries([]);
    setListError(null);
    setIsListLoading(true);
    setSelectedEntry(null);
    setDetail(null);

    fetchApiJson(`${API_BASE_URL}/${activeCategory.id}`, controller.signal)
      .then((response) => {
        if (
          !isRecord(response) ||
          !Array.isArray(response.results) ||
          !response.results.every(
            (entry) =>
              isRecord(entry) &&
              typeof entry.index === "string" &&
              typeof entry.name === "string" &&
              typeof entry.url === "string",
          )
        ) {
          throw new Error("Le format des résultats de l’API est inattendu.");
        }
        setEntries(response.results as EncyclopediaEntry[]);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setListError(
            error instanceof Error
              ? error.message
              : "Une erreur inconnue est survenue.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsListLoading(false);
      });

    return () => controller.abort();
  }, [activeCategory.id, listRequest]);

  useEffect(() => {
    if (!selectedEntry) return;
    const controller = new AbortController();
    setDetail(null);
    setDetailError(null);
    setIsDetailLoading(true);

    fetchApiJson(new URL(selectedEntry.url, API_ORIGIN).toString(), controller.signal)
      .then((response) => {
        if (!isRecord(response)) {
          throw new Error("Le format de cette fiche est inattendu.");
        }
        setDetail(response);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDetailError(
            error instanceof Error
              ? error.message
              : "Une erreur inconnue est survenue.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsDetailLoading(false);
      });

    return () => controller.abort();
  }, [selectedEntry]);

  useEffect(() => {
    if (!classResource) return;
    const controller = new AbortController();
    setClassResourceData(null);
    setClassResourceError(null);
    setIsClassResourceLoading(true);
    setSubclassFeatures([]);
    setSubclassLevelResources([]);

    fetchApiJson(classResource.url, controller.signal)
      .then(async (response) => {
        const validResponse =
          classResource.id === "class_levels"
            ? Array.isArray(response) &&
              response.every(
                (level) => isRecord(level) && typeof level.level === "number",
              )
            : classResource.id === "spells"
              ? isRecord(response) &&
                Array.isArray(response.results) &&
                response.results.every(
                  (spell) =>
                    isRecord(spell) &&
                    typeof spell.index === "string" &&
                    typeof spell.name === "string" &&
                    typeof spell.url === "string" &&
                    typeof spell.level === "number",
                )
              : isRecord(response) && typeof response.name === "string";
        if (!validResponse) {
          throw new Error("Le format de cette ressource est inattendu.");
        }
        if (classResource.id === "subclass") {
          const featureCollection = await fetchApiJson(
            `${classResource.url}/features`,
            controller.signal,
          );
          const levelResponse = await fetchApiJson(
            `${classResource.url}/levels`,
            controller.signal,
          );
          if (
            !isRecord(featureCollection) ||
            !Array.isArray(featureCollection.results) ||
            !featureCollection.results.every(
              (feature) =>
                isRecord(feature) &&
                typeof feature.index === "string" &&
                typeof feature.name === "string" &&
                typeof feature.url === "string",
            )
          ) {
            throw new Error("Le format des capacités de cette sous-classe est inattendu.");
          }
          if (
            !Array.isArray(levelResponse) ||
            !levelResponse.every(
              (level) =>
                isRecord(level) &&
                typeof level.level === "number" &&
                Array.isArray(level.features),
            )
          ) {
            throw new Error("Le format des niveaux de cette sous-classe est inattendu.");
          }

          const featureReferences = getEncyclopediaReferences(
            featureCollection.results,
          );
          const loadedFeatures = await Promise.all(
            featureReferences.map(async (reference) => {
              const feature = await fetchApiJson(
                new URL(reference.url, API_ORIGIN).toString(),
                controller.signal,
              );
              if (
                !isRecord(feature) ||
                typeof feature.index !== "string" ||
                typeof feature.name !== "string" ||
                typeof feature.level !== "number"
              ) {
                throw new Error(
                  `Le format de la capacité « ${reference.name} » est inattendu.`,
                );
              }
              const description =
                typeof feature.desc === "string"
                  ? [feature.desc]
                  : Array.isArray(feature.desc)
                    ? feature.desc.filter(
                        (paragraph): paragraph is string =>
                          typeof paragraph === "string",
                      )
                    : [];
              return {
                ...reference,
                index: feature.index,
                name: feature.name,
                level: feature.level,
                description,
              };
            }),
          );
          setSubclassFeatures(loadedFeatures);
          setSubclassLevelResources(getSubclassLevelResources(levelResponse));
        }
        setClassResourceData(response);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setClassResourceError(
            error instanceof Error
              ? error.message
              : "Une erreur inconnue est survenue.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsClassResourceLoading(false);
      });

    return () => controller.abort();
  }, [classResource, classResourceRequest]);

  useEffect(() => {
    if (!classResource) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setClassResource(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [classResource]);

  const normalizedSearch = normalizeSearchText(search.trim());
  const filteredEntries = entries.filter((entry) => {
    if (!normalizedSearch) return true;
    const searchableText = normalizeSearchText(
      [
        entry.name,
        entry.index,
        getEncyclopediaEntryMeta(entry, categoryId),
      ].join(" "),
    );
    return searchableText.includes(normalizedSearch);
  });
  const detailFacts = [
    ["Taille", "size"],
    ["Type", "type"],
    ["Alignement", "alignment"],
    ["Facteur de puissance", "challenge_rating"],
    ["Points de vie", "hit_points"],
    ["Classe d’armure", "armor_class"],
    ["Niveau", "level"],
    ["École", "school"],
    ["Portée", "range"],
    ["Temps d’incantation", "casting_time"],
    ["Durée", "duration"],
    ["Composantes", "components"],
    ["Dégâts", "damage"],
    ["Dé de vie", "hit_die"],
    ["Nom complet", "full_name"],
    ["Quantité", "quantity"],
    ["Vitesse", "speed"],
    ["Rareté", "rarity"],
    ["Coût", "cost"],
    ["Poids", "weight"],
    ["Catégorie", "equipment_category"],
  ] as const;
  const detailSections = [
    ["Description", "desc"],
    ["À niveau supérieur", "higher_level"],
    ["Capacités spéciales", "special_abilities"],
    ["Actions", "actions"],
    ["Actions légendaires", "legendary_actions"],
    ["Réactions", "reactions"],
  ] as const;
  const expandedDetailFields =
    categoryId === "classes"
      ? [
          ["Choix de maîtrises", "proficiency_choices"],
          ["Maîtrises", "proficiencies"],
          ["Jets de sauvegarde", "saving_throws"],
          ["Équipement de départ", "starting_equipment"],
          ["Choix d’équipement de départ", "starting_equipment_options"],
          ["Multiclassage", "multi_classing"],
          ["Sous-classes", "subclasses"],
          ["Incantation", "spellcasting"],
        ]
      : categoryId === "races"
        ? [
            ["Âge", "age"],
            ["Alignement", "alignment"],
            ["Bonus de caractéristiques", "ability_bonuses"],
            ["Description de la taille", "size_description"],
            ["Langues maîtrisées", "languages"],
            ["Langues", "language_desc"],
            ["Traits raciaux", "traits"],
            ["Sous-races", "subraces"],
          ]
        : categoryId === "backgrounds"
          ? [
              ["Maîtrises de départ", "starting_proficiencies"],
              ["Choix de langues", "language_options"],
              ["Équipement de départ", "starting_equipment"],
              ["Choix d’équipement de départ", "starting_equipment_options"],
              ["Aptitude spéciale", "feature"],
              ["Traits de personnalité", "personality_traits"],
              ["Idéaux", "ideals"],
              ["Liens", "bonds"],
              ["Défauts", "flaws"],
            ]
        : categoryId === "ability-scores"
          ? [["Compétences associées", "skills"]]
        : categoryId === "rules"
          ? [
              ["Sous-règles", "children"],
              ["Sous-sections", "subsections"],
            ]
        : categoryId === "magic-items"
          ? [["Variantes", "variants"]]
        : [];
  const classResources =
    categoryId === "classes" && detail
      ? (["class_levels", "spells"] as const).flatMap((key) => {
          const path = detail[key];
          return typeof path === "string" && path.startsWith("/api/2014/")
            ? [
                {
                  id: key,
                  label: key === "class_levels" ? "Progression des niveaux" : "Liste des sorts",
                  url: `${API_ORIGIN}${path}?lang=fr-FR`,
                },
              ]
            : [];
        })
      : [];
  const normalizedClassSpellSearch = normalizeSearchText(
    classSpellSearch.trim(),
  );
  const filteredClassSpells = getClassSpells(classResourceData).filter(
    (spell) =>
      !normalizedClassSpellSearch ||
      normalizeSearchText(spell.name).includes(normalizedClassSpellSearch),
  );
  const classSpellLevels = Array.from(
    new Set(filteredClassSpells.map((spell) => spell.level)),
  ).sort((first, second) => first - second);
  const image =
    detail && typeof detail.image === "string"
      ? new URL(detail.image, API_ORIGIN).toString()
      : null;

  return (
    <section className="encyclopedia-page" aria-labelledby="encyclopedia-title">
      <div className="campaigns-heading">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-line" />
            Le savoir du multivers
          </p>
          <h1 id="encyclopedia-title">
            L’<em>Encyclopédie.</em>
          </h1>
          <p className="campaigns-intro">
            Explorez les références de Donjons &amp; Dragons 5e, édition 2014.
          </p>
        </div>
        <a className="encyclopedia-source" href="https://docs.dnd5eapi.co/" target="_blank" rel="noreferrer">
          Données fournies par D&amp;D 5e API <span aria-hidden="true">↗</span>
        </a>
      </div>

      <div className="encyclopedia-categories" aria-label="Catégories">
        {encyclopediaCategories.map((category) => (
          <button
            className={`encyclopedia-category${categoryId === category.id ? " encyclopedia-category-active" : ""}`}
            type="button"
            key={category.id}
            aria-pressed={categoryId === category.id}
            onClick={() => {
              setCategoryId(category.id);
              setSearch("");
            }}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="encyclopedia-workspace">
        <section className="encyclopedia-results" aria-label={`Liste : ${activeCategory.label}`}>
          <label className="encyclopedia-search">
            <span className="encyclopedia-search-icon" aria-hidden="true">⌕</span>
            <span className="visually-hidden">Rechercher dans {activeCategory.label}</span>
            <input
              type="search"
              value={search}
              placeholder={`Rechercher parmi les ${activeCategory.label.toLocaleLowerCase("fr")}…`}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                type="button"
                aria-label="Effacer la recherche"
                onClick={() => setSearch("")}
              >
                ×
              </button>
            )}
          </label>

          <p className="encyclopedia-result-count" aria-live="polite">
            {isListLoading
              ? "Chargement des références…"
              : listError
                ? "Références indisponibles"
                : `${filteredEntries.length} référence${filteredEntries.length === 1 ? "" : "s"}`}
          </p>

          {listError ? (
            <div className="encyclopedia-message" role="alert">
              <strong>Impossible de charger cette catégorie.</strong>
              <span>{listError}</span>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setListRequest((current) => current + 1)}
              >
                Réessayer
              </button>
            </div>
          ) : isListLoading ? (
            <div className="encyclopedia-message" role="status">
              Consultation des grimoires…
            </div>
          ) : filteredEntries.length ? (
            <div className="encyclopedia-entry-list">
              {filteredEntries.map((entry) => (
                <button
                  type="button"
                  className={`encyclopedia-entry${selectedEntry?.index === entry.index ? " encyclopedia-entry-selected" : ""}`}
                  key={entry.index}
                  aria-pressed={selectedEntry?.index === entry.index}
                  onClick={() => setSelectedEntry(entry)}
                >
                  <span className="encyclopedia-entry-copy">
                    <strong>{entry.name}</strong>
                    {getEncyclopediaEntryMeta(entry, categoryId) && (
                      <span>{getEncyclopediaEntryMeta(entry, categoryId)}</span>
                    )}
                  </span>
                  <span className="encyclopedia-entry-arrow" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="encyclopedia-message">
              <strong>Aucune référence trouvée.</strong>
              <span>Essayez un autre terme ou choisissez une catégorie.</span>
            </div>
          )}
        </section>

        <article className="encyclopedia-detail" aria-live="polite">
          {!selectedEntry ? (
            <div className="encyclopedia-detail-empty">
              <span aria-hidden="true">✧</span>
              <p className="eyebrow section-eyebrow">Une page à découvrir</p>
              <h2>Choisissez une référence.</h2>
              <p>Les détails de votre sélection s’afficheront ici.</p>
            </div>
          ) : isDetailLoading ? (
            <div className="encyclopedia-message" role="status">
              Ouverture de la fiche…
            </div>
          ) : detailError ? (
            <div className="encyclopedia-message" role="alert">
              <strong>Impossible de charger cette fiche.</strong>
              <span>{detailError}</span>
            </div>
          ) : detail ? (
            <>
              <div className="encyclopedia-detail-heading">
                <div>
                  <p className="eyebrow section-eyebrow">{activeCategory.label}</p>
                  <h2>{typeof detail.name === "string" ? detail.name : selectedEntry.name}</h2>
                </div>
                <button
                  type="button"
                  className="encyclopedia-detail-close"
                  aria-label="Fermer la fiche"
                  onClick={() => setSelectedEntry(null)}
                >
                  ×
                </button>
              </div>
              {image && (
                <img
                  className="encyclopedia-monster-image"
                  src={image}
                  alt={typeof detail.name === "string" ? detail.name : ""}
                />
              )}
              <div className="encyclopedia-facts">
                {detailFacts.map(([label, key]) => {
                  const value = detail[key];
                  const summary = summarizeApiValue(value);
                  if (categoryId === "races" && key === "alignment") {
                    return null;
                  }
                  return summary ? (
                    <div className="encyclopedia-fact" key={key}>
                      <span>{label}</span>
                      <strong>{summary}</strong>
                    </div>
                  ) : null;
                })}
              </div>
              {expandedDetailFields.map(([label, key]) => {
                const value = detail[key];
                if (value === undefined || value === null) return null;
                if (
                  (categoryId === "races" && key === "subraces") ||
                  (categoryId === "classes" && key === "subclasses")
                ) {
                  const references = getEncyclopediaReferences(value);
                  const referenceType =
                    categoryId === "races" ? "subrace" : "subclass";
                  return (
                    <section className="encyclopedia-detail-section" key={key}>
                      <h3>{label}</h3>
                      {references.length ? (
                        <div className="encyclopedia-subrace-list">
                          {references.map((reference) => (
                            <button
                              className="encyclopedia-subrace-button"
                              type="button"
                              key={reference.index}
                              onClick={() =>
                                setClassResource({
                                  id: referenceType,
                                  label: reference.name,
                                  contextName:
                                    typeof detail.name === "string"
                                      ? detail.name
                                      : undefined,
                                  url: new URL(reference.url, API_ORIGIN).toString(),
                                })
                              }
                            >
                              {reference.name}
                              <span aria-hidden="true">→</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <EncyclopediaApiValue value={value} />
                      )}
                    </section>
                  );
                }
                if (categoryId === "races" && key === "traits") {
                  return (
                    <section className="encyclopedia-detail-section" key={key}>
                      <h3>{label}</h3>
                      <RacialTraitDescriptions value={value} />
                    </section>
                  );
                }
                return (
                  <section className="encyclopedia-detail-section" key={key}>
                    <h3>{label}</h3>
                    <EncyclopediaApiValue
                      value={value}
                      hideOptionMetadata={
                        categoryId === "classes" ||
                        categoryId === "backgrounds"
                      }
                      hideBackgroundFieldLabels={categoryId === "backgrounds"}
                    />
                  </section>
                );
              })}
              {classResources.length > 0 && (
                <section className="encyclopedia-detail-section">
                  <h3>Ressources complémentaires</h3>
                  <div className="encyclopedia-api-resource-links">
                    {classResources.map((resource) => (
                      <button
                        type="button"
                        className="encyclopedia-api-resource-button"
                        key={resource.label}
                        onClick={() => {
                          setClassResource(resource);
                          setClassSpellSearch("");
                        }}
                      >
                        {resource.label} <span aria-hidden="true">→</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {detailSections.map(([label, key]) => {
                const value = detail[key];
                if (
                  key === "desc" &&
                  (typeof value === "string" ||
                    (Array.isArray(value) &&
                      value.length > 0 &&
                      value.every(
                        (item): item is string => typeof item === "string",
                      )))
                ) {
                  return (
                    <section className="encyclopedia-detail-section" key={key}>
                      <h3>{label}</h3>
                      <MarkdownContent
                        className="encyclopedia-api-description"
                        content={formatEncyclopediaDescription(value)}
                      />
                    </section>
                  );
                }
                if (typeof value === "string") {
                  return (
                    <section className="encyclopedia-detail-section" key={key}>
                      <h3>{label}</h3>
                      <p>{value}</p>
                    </section>
                  );
                }
                if (!Array.isArray(value)) return null;
                const content = value
                  .map((item) => {
                    if (typeof item === "string") {
                      return { title: "", description: item };
                    }
                    if (!isRecord(item)) return null;
                    return {
                      title: typeof item.name === "string" ? item.name : "",
                      description: typeof item.desc === "string" ? item.desc : "",
                    };
                  })
                  .filter(
                    (item): item is { title: string; description: string } =>
                      item !== null && Boolean(item.title || item.description),
                  );
                if (!content.length) return null;
                return (
                  <section className="encyclopedia-detail-section" key={key}>
                    <h3>{label}</h3>
                    {content.map((item, index) => (
                      <div className="encyclopedia-detail-entry" key={`${key}-${index}`}>
                        {item.title && <h4>{item.title}</h4>}
                        {item.description &&
                          (key === "special_abilities" ? (
                            <MarkdownContent
                              className="encyclopedia-special-ability-description"
                              content={formatSpecialAbilityDescription(
                                item.description,
                              )}
                            />
                          ) : (
                            <p>{item.description}</p>
                          ))}
                      </div>
                    ))}
                  </section>
                );
              })}
            </>
          ) : null}
        </article>
      </div>
      {classResource && (
        <div
          className="campaign-modal-backdrop encyclopedia-resource-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setClassResource(null);
          }}
        >
          <section
            className={`campaign-modal encyclopedia-resource-modal${classResource.id === "subrace" || classResource.id === "subclass" ? " encyclopedia-subrace-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-resource-title"
          >
            <div className="campaign-modal-heading">
              <div>
                <p className="eyebrow section-eyebrow">
                  {classResource.id === "subrace"
                    ? `Sous-race · ${classResource.contextName ?? "Race"}`
                    : classResource.id === "subclass"
                      ? `Sous-classe · ${classResource.contextName ?? "Classe"}`
                    : typeof detail?.name === "string"
                      ? detail.name
                      : "Classe"}
                </p>
                <h2 id="class-resource-title">
                  {classResource.id === "subrace" &&
                  isRecord(classResourceData) &&
                  typeof classResourceData.name === "string"
                    ? classResourceData.name
                    : classResource.id === "subclass" &&
                      isRecord(classResourceData) &&
                      typeof classResourceData.name === "string"
                      ? classResourceData.name
                    : classResource.label}
                </h2>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Fermer"
                onClick={() => setClassResource(null)}
              >
                ×
              </button>
            </div>
            {isClassResourceLoading ? (
              <div className="encyclopedia-message" role="status">
                Chargement des données…
              </div>
            ) : classResourceError ? (
              <div className="encyclopedia-message" role="alert">
                <strong>Impossible de charger cette ressource.</strong>
                <span>{classResourceError}</span>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() =>
                    setClassResourceRequest((current) => current + 1)
                  }
                >
                  Réessayer
                </button>
              </div>
            ) : classResource.id === "class_levels" ? (
              <ClassProgressionTable data={classResourceData} />
            ) : classResource.id === "spells" ? (
              <div className="encyclopedia-class-spells">
                <label className="encyclopedia-class-spell-search">
                  <span className="visually-hidden">Rechercher un sort de cette classe</span>
                  <input
                    autoFocus
                    type="search"
                    placeholder="Rechercher un sort…"
                    value={classSpellSearch}
                    onChange={(event) => setClassSpellSearch(event.target.value)}
                  />
                </label>
                <p className="encyclopedia-result-count" aria-live="polite">
                  {filteredClassSpells.length} sort
                  {filteredClassSpells.length === 1 ? "" : "s"}
                </p>
                {classSpellLevels.length ? (
                  <div className="encyclopedia-class-spell-groups">
                    {classSpellLevels.map((level) => (
                      <section
                        className="encyclopedia-class-spell-level"
                        key={level}
                      >
                        <h3>
                          {level === 0
                            ? "Tours de magie"
                            : `Sorts de niveau ${level}`}
                          <span>
                            {
                              filteredClassSpells.filter(
                                (spell) => spell.level === level,
                              ).length
                            }
                          </span>
                        </h3>
                        <ul>
                          {filteredClassSpells
                            .filter((spell) => spell.level === level)
                            .map((spell) => (
                              <li key={spell.index}>{spell.name}</li>
                            ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="encyclopedia-message">
                    <strong>Aucun sort trouvé.</strong>
                    <span>Essayez un autre terme de recherche.</span>
                  </div>
                )}
              </div>
            ) : classResource.id === "subclass" &&
              isRecord(classResourceData) ? (
              <div className="encyclopedia-subclass-modal-content">
                {Object.entries(classResourceData)
                  .filter(
                    ([key, value]) =>
                      key !== "index" &&
                      key !== "name" &&
                      key !== "url" &&
                      key !== "updated_at" &&
                      key !== "subclass_levels" &&
                      !(Array.isArray(value) && value.length === 0),
                  )
                  .map(([key, value]) => (
                    <section
                      className="encyclopedia-detail-section"
                      key={key}
                    >
                      <h3>{getEncyclopediaFieldLabel(key)}</h3>
                      <EncyclopediaApiValue value={value} />
                    </section>
                  ))}
                <section className="encyclopedia-detail-section">
                  <h3>Capacités par niveau</h3>
                  <SubclassFeaturesView
                    features={subclassFeatures}
                    levelResources={subclassLevelResources}
                  />
                </section>
              </div>
            ) : classResource.id === "subrace" &&
              isRecord(classResourceData) ? (
              <div className="encyclopedia-subrace-details">
                {Object.entries(classResourceData)
                  .filter(
                    ([key, value]) =>
                      key !== "index" &&
                      key !== "name" &&
                      key !== "url" &&
                      key !== "updated_at" &&
                      key !== "subclass_levels" &&
                      !(Array.isArray(value) && value.length === 0),
                  )
                  .map(([key, value]) => (
                    <section
                      className="encyclopedia-detail-section"
                      key={key}
                    >
                      <h3>{getEncyclopediaFieldLabel(key)}</h3>
                      {key === "racial_traits" ? (
                        <RacialTraitDescriptions value={value} />
                      ) : (
                        <EncyclopediaApiValue value={value} />
                      )}
                    </section>
                  ))}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </section>
  );
}

function InitiativeTracker() {
  const [initialState] = useState(loadInitiativeEncounter);
  const [encounter, setEncounter] = useState(initialState.encounter);
  const [persistenceError, setPersistenceError] = useState(initialState.error);
  const [shouldPersist, setShouldPersist] = useState(
    initialState.error === null,
  );
  const [participantName, setParticipantName] = useState("");
  const [participantType, setParticipantType] =
    useState<InitiativeParticipantType>("character");
  const [initiativeInput, setInitiativeInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isFinishConfirmationOpen, setIsFinishConfirmationOpen] =
    useState(false);

  useEffect(() => {
    if (!shouldPersist) return;
    try {
      window.localStorage.setItem(
        INITIATIVE_STORAGE_KEY,
        JSON.stringify(encounter),
      );
      setPersistenceError(null);
    } catch {
      setPersistenceError(
        "La sauvegarde de la rencontre a échoué. Vos changements ne seront pas conservés après fermeture du navigateur.",
      );
    }
  }, [encounter, shouldPersist]);

  function updateEncounter(
    update: (current: InitiativeEncounter) => InitiativeEncounter,
  ) {
    setShouldPersist(true);
    setEncounter(update);
  }

  function clearForm() {
    setParticipantName("");
    setParticipantType("character");
    setInitiativeInput("");
    setEditingId(null);
    setFormError(null);
  }

  function saveParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = participantName.trim();
    const initiative = Number(initiativeInput);
    if (!name) {
      setFormError("Saisissez le nom du personnage ou du monstre.");
      return;
    }
    if (
      initiativeInput.trim() === "" ||
      !Number.isFinite(initiative) ||
      !Number.isInteger(initiative)
    ) {
      setFormError("Saisissez un score d’initiative entier.");
      return;
    }

    const participant: InitiativeParticipant = {
      id: editingId ?? crypto.randomUUID(),
      name,
      type: participantType,
      initiative,
    };
    updateEncounter((current) => {
      if (editingId) {
        return {
          ...current,
          participants: current.participants.map((currentParticipant) =>
            currentParticipant.id === editingId
              ? participant
              : currentParticipant,
          ),
        };
      }

      return {
        ...current,
        participants: [...current.participants, participant].sort(
          (first, second) => second.initiative - first.initiative,
        ),
      };
    });
    clearForm();
  }

  function editParticipant(participant: InitiativeParticipant) {
    setEditingId(participant.id);
    setParticipantName(participant.name);
    setParticipantType(participant.type);
    setInitiativeInput(String(participant.initiative));
    setFormError(null);
  }

  function removeParticipant(id: string) {
    updateEncounter((current) => {
      const participants = current.participants.filter(
        (participant) => participant.id !== id,
      );
      return {
        ...current,
        participants,
        activeParticipantId:
          current.activeParticipantId === id
            ? null
            : current.activeParticipantId,
        round: participants.length ? current.round : 1,
      };
    });
    if (editingId === id) clearForm();
  }

  function moveParticipant(id: string, direction: -1 | 1) {
    updateEncounter((current) => {
      const index = current.participants.findIndex(
        (participant) => participant.id === id,
      );
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= current.participants.length) {
        return current;
      }
      const participants = [...current.participants];
      [participants[index], participants[destination]] = [
        participants[destination],
        participants[index],
      ];
      return { ...current, participants };
    });
  }

  function advanceTurn() {
    updateEncounter((current) => {
      if (!current.participants.length) return current;

      const currentIndex = current.participants.findIndex(
        (participant) => participant.id === current.activeParticipantId,
      );
      if (currentIndex < 0) {
        return {
          ...current,
          activeParticipantId: current.participants[0].id,
        };
      }
      if (currentIndex === current.participants.length - 1) {
        return {
          ...current,
          activeParticipantId: current.participants[0].id,
          round: current.round + 1,
        };
      }
      return {
        ...current,
        activeParticipantId: current.participants[currentIndex + 1].id,
      };
    });
  }

  function finishInitiative() {
    clearForm();
    updateEncounter(() => emptyInitiativeEncounter());
    setIsFinishConfirmationOpen(false);
  }

  return (
    <section className="initiative-tracker" aria-labelledby="initiative-title">
      <div className="initiative-heading">
        <div>
          <p className="eyebrow section-eyebrow">Suivi du combat</p>
          <h2 id="initiative-title">Initiative</h2>
        </div>
        <div className="initiative-turn-controls">
          <span className="initiative-round" aria-live="polite">
            Tour {encounter.round}
          </span>
          <button
            className="button button-primary"
            type="button"
            disabled={!encounter.participants.length}
            onClick={advanceTurn}
          >
            Suivant <span aria-hidden="true">→</span>
          </button>
          <button
            className="button button-secondary"
            type="button"
            disabled={!encounter.participants.length}
            onClick={() => setIsFinishConfirmationOpen(true)}
          >
            Terminer
          </button>
        </div>
      </div>

      {persistenceError && (
        <p className="initiative-error" role="alert">
          {persistenceError}
        </p>
      )}

      <form className="initiative-form" onSubmit={saveParticipant}>
        <label className="form-field">
          <span>Nom du participant</span>
          <input
            autoComplete="off"
            maxLength={80}
            required
            value={participantName}
            onChange={(event) => {
              setParticipantName(event.target.value);
              setFormError(null);
            }}
            placeholder="Ex. Aelar ou gobelin"
          />
        </label>
        <label className="form-field">
          <span>Type</span>
          <select
            value={participantType}
            onChange={(event) =>
              setParticipantType(
                event.target.value === "monster" ? "monster" : "character",
              )
            }
          >
            <option value="character">Personnage</option>
            <option value="monster">Monstre</option>
          </select>
        </label>
        <label className="form-field">
          <span>Initiative</span>
          <input
            required
            step="1"
            type="number"
            value={initiativeInput}
            onChange={(event) => {
              setInitiativeInput(event.target.value);
              setFormError(null);
            }}
            placeholder="Ex. 15"
          />
        </label>
        <div className="initiative-form-actions">
          <button className="button button-primary" type="submit">
            {editingId ? "Enregistrer" : "Ajouter"}
          </button>
          {editingId && (
            <button
              className="button button-secondary"
              type="button"
              onClick={clearForm}
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      {formError && (
        <p className="initiative-error" role="alert">
          {formError}
        </p>
      )}

      {encounter.participants.length ? (
        <ol className="initiative-participant-list">
          {encounter.participants.map((participant, index) => {
            const isActive = participant.id === encounter.activeParticipantId;
            return (
              <li
                className={`initiative-participant${isActive ? " initiative-participant-active" : ""}`}
                key={participant.id}
                aria-current={isActive ? "true" : undefined}
              >
                <span className="initiative-score">
                  {participant.initiative}
                </span>
                <div className="initiative-participant-info">
                  <strong>{participant.name}</strong>
                  <span>
                    {participant.type === "character" ? "Personnage" : "Monstre"}
                  </span>
                </div>
                {isActive && (
                  <span className="initiative-active-label">À son tour</span>
                )}
                <div className="initiative-participant-actions">
                  <button
                    className="initiative-order-button"
                    type="button"
                    aria-label={`Monter ${participant.name}`}
                    title="Monter dans la liste"
                    disabled={index === 0}
                    onClick={() => moveParticipant(participant.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="initiative-order-button"
                    type="button"
                    aria-label={`Descendre ${participant.name}`}
                    title="Descendre dans la liste"
                    disabled={index === encounter.participants.length - 1}
                    onClick={() => moveParticipant(participant.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    className="initiative-text-button"
                    type="button"
                    onClick={() => editParticipant(participant)}
                  >
                    Modifier
                  </button>
                  <button
                    className="initiative-text-button initiative-remove-button"
                    type="button"
                    onClick={() => removeParticipant(participant.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="initiative-empty">
          <strong>Aucun participant pour le moment.</strong>
          <span>Ajoutez les personnages et les monstres du combat.</span>
        </div>
      )}

      {isFinishConfirmationOpen && (
        <div
          className="campaign-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsFinishConfirmationOpen(false);
            }
          }}
        >
          <section
            className="campaign-modal initiative-confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="initiative-finish-title"
            aria-describedby="initiative-finish-description"
          >
            <div className="campaign-modal-heading">
              <div>
                <p className="eyebrow section-eyebrow">Suivi du combat</p>
                <h2 id="initiative-finish-title">Terminer l’initiative ?</h2>
              </div>
            </div>
            <p id="initiative-finish-description">
              Cette action supprimera les participants et réinitialisera l'initiative. Voulez-vous continuer ?
            </p>
            <div className="campaign-form-actions">
              <button
                className="button button-secondary"
                type="button"
                autoFocus
                onClick={() => setIsFinishConfirmationOpen(false)}
              >
                Annuler
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={finishInitiative}
              >
                Terminer le combat
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function DiceRoller() {
  const [dice, setDice] = useState<RolledDie[]>([]);

  function addDie(sides: DieSides) {
    setDice((current) => [
      ...current,
      { id: crypto.randomUUID(), sides, result: null },
    ]);
  }

  function rollDie(sides: DieSides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  function rerollDie(id: string) {
    setDice((current) =>
      current.map((die) =>
        die.id === id ? { ...die, result: rollDie(die.sides) } : die,
      ),
    );
  }

  function rerollAll() {
    setDice((current) =>
      current.map((die) => ({ ...die, result: rollDie(die.sides) })),
    );
  }

  function removeDie(id: string) {
    setDice((current) => current.filter((die) => die.id !== id));
  }

  function shuffleDice() {
    setDice((current) => {
      const shuffled = [...current];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const destination = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[destination]] = [
          shuffled[destination],
          shuffled[index],
        ];
      }
      return shuffled;
    });
  }

  const total = dice.reduce((sum, die) => sum + (die.result ?? 0), 0);
  const allDiceRolled = dice.length > 0 && dice.every((die) => die.result !== null);
  const hasRolledDice = dice.some((die) => die.result !== null);

  return (
    <section className="dice-roller" aria-labelledby="dice-roller-title">
      <div className="dice-roller-heading">
        <div>
          <p className="eyebrow section-eyebrow">À vous de jouer</p>
          <h2 id="dice-roller-title">Lancer de dés</h2>
        </div>
        <div className="dice-roller-actions">
          <button
            className="button button-primary"
            type="button"
            disabled={!dice.length}
            onClick={rerollAll}
          >
            {hasRolledDice ? "Relancer tout" : "Lancer les dés"}
          </button>
          <button
            className="button button-secondary"
            type="button"
            disabled={dice.length < 2}
            onClick={shuffleDice}
          >
            Mélanger
          </button>
          <button
            className="button button-secondary"
            type="button"
            disabled={!dice.length}
            onClick={() => setDice([])}
          >
            Effacer
          </button>
        </div>
      </div>

      <div className="dice-picker" aria-label="Ajouter un dé">
        {dieTypes.map((sides) => (
          <button
            className="dice-picker-button"
            key={sides}
            type="button"
            aria-label={`Ajouter un dé à ${sides} faces`}
            onClick={() => addDie(sides)}
          >
            <span aria-hidden="true">+</span> d{sides}
          </button>
        ))}
      </div>

      {dice.length ? (
        <>
          <div className="dice-roll-summary" aria-live="polite">
            <span>
              {dice.length} {dice.length === 1 ? "dé" : "dés"}
            </span>
            {allDiceRolled && (
              <strong>
                Total <span>{total}</span>
              </strong>
            )}
          </div>
          <ol className="dice-list">
            {dice.map((die, index) => (
              <li className="dice-card" key={die.id}>
                <span className="dice-card-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="dice-card-result">
                  <span>d{die.sides}</span>
                  <strong>{die.result ?? "—"}</strong>
                </div>
                <div className="dice-card-actions">
                  <button
                    className="initiative-text-button"
                    type="button"
                    aria-label={`Relancer le d${die.sides}`}
                    onClick={() => rerollDie(die.id)}
                  >
                    Relancer
                  </button>
                  <button
                    className="initiative-text-button initiative-remove-button"
                    type="button"
                    aria-label={`Retirer le d${die.sides}`}
                    onClick={() => removeDie(die.id)}
                  >
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="dice-empty">
          <strong>Aucun dé pour le moment.</strong>
          <span>Choisissez un dé ci-dessus pour composer votre lancer.</span>
        </div>
      )}
    </section>
  );
}

function ToolsPage() {
  const [selectedTool, setSelectedTool] = useState<"initiative" | "dice">(
    "initiative",
  );

  return (
    <section className="campaigns-page tools-page" aria-labelledby="tools-title">
      <div className="campaigns-heading">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-line" />
            Votre table de jeu
          </p>
          <h1 id="tools-title">
            Outils de <em>jeu.</em>
          </h1>
          <p className="campaigns-intro">
            Deux outils pour accompagner vos parties.
          </p>
        </div>
      </div>
      <div className="tools-category-grid" role="tablist" aria-label="Outils">
        <button
          className={`tools-category-card${selectedTool === "initiative" ? " tools-category-card-active" : ""}`}
          id="initiative-tab"
          type="button"
          role="tab"
          aria-selected={selectedTool === "initiative"}
          aria-controls="tools-panel"
          onClick={() => setSelectedTool("initiative")}
        >
          <span className="tools-category-number">01</span>
          <h2>Initiative</h2>
          <p>Gérez l’ordre d’action des participants au combat.</p>
        </button>
        <button
          className={`tools-category-card${selectedTool === "dice" ? " tools-category-card-active" : ""}`}
          id="dice-tab"
          type="button"
          role="tab"
          aria-selected={selectedTool === "dice"}
          aria-controls="tools-panel"
          onClick={() => setSelectedTool("dice")}
        >
          <span className="tools-category-number">02</span>
          <h2>Lancer de dés</h2>
          <p>Composez votre lancer avec tous les dés du jeu.</p>
        </button>
      </div>
      <div
        className="tools-panel"
        id="tools-panel"
        role="tabpanel"
        aria-labelledby={selectedTool === "initiative" ? "initiative-tab" : "dice-tab"}
      >
        {selectedTool === "initiative" ? (
          <InitiativeTracker />
        ) : (
          <DiceRoller />
        )}
      </div>
    </section>
  );
}

function App() {
  const [page, setPage] = useState<
    "home" | "campaigns" | "encyclopedia" | "tools"
  >("home");
  const [storedCampaigns] = useState(loadCampaigns);
  const [campaigns, setCampaigns] = useState(storedCampaigns.campaigns);
  const [storageError, setStorageError] = useState(storedCampaigns.error);
  const [shouldPersist, setShouldPersist] = useState(!storedCampaigns.error);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [campaignFormError, setCampaignFormError] = useState<string | null>(
    null,
  );
  const [playersInput, setPlayersInput] = useState("");
  const [isPlayerFormOpen, setIsPlayerFormOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [playerForm, setPlayerForm] =
    useState<CampaignPlayerForm>(emptyPlayerForm);
  const [isCustomPlayerClass, setIsCustomPlayerClass] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isNoteFormOpen, setIsNoteFormOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [noteTagsInput, setNoteTagsInput] = useState("");
  const [noteFormError, setNoteFormError] = useState<string | null>(null);
  const [notesSort, setNotesSort] = useState<"date" | "tag">("date");
  const [notesTagSearch, setNotesTagSearch] = useState("");
  const [isSummaryFormOpen, setIsSummaryFormOpen] = useState(false);
  const [editingSummaryId, setEditingSummaryId] = useState<string | null>(null);
  const [summaryForm, setSummaryForm] =
    useState<CampaignSummaryForm>(emptySummaryForm);
  const [summaryFormError, setSummaryFormError] = useState<string | null>(null);
  const [viewingSummary, setViewingSummary] =
    useState<CampaignSummary | null>(null);
  const [isResourceFormOpen, setIsResourceFormOpen] = useState(false);
  const [resourceType, setResourceType] = useState<"link" | "image">("link");
  const [editingResourceId, setEditingResourceId] = useState<string | null>(
    null,
  );
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceCaption, setResourceCaption] = useState("");
  const [resourceFormError, setResourceFormError] = useState<string | null>(
    null,
  );
  const [lightboxImage, setLightboxImage] = useState<CampaignImage | null>(
    null,
  );

  useEffect(() => {
    if (!shouldPersist) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
      setStorageError(null);
    } catch {
      setStorageError(
        "La sauvegarde locale a échoué. Vos changements ne seront pas conservés après fermeture du navigateur.",
      );
    }
  }, [campaigns, shouldPersist]);

  useEffect(() => {
    if (
      !isFormOpen &&
      !isNoteFormOpen &&
      !isSummaryFormOpen &&
      !isResourceFormOpen &&
      !isPlayerFormOpen &&
      !lightboxImage &&
      !viewingSummary
    ) {
      return;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFormOpen(false);
        setIsNoteFormOpen(false);
        setIsSummaryFormOpen(false);
        setIsResourceFormOpen(false);
        setIsPlayerFormOpen(false);
        setLightboxImage(null);
        setViewingSummary(null);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [
    isFormOpen,
    isNoteFormOpen,
    isSummaryFormOpen,
    isResourceFormOpen,
    isPlayerFormOpen,
    lightboxImage,
    viewingSummary,
  ]);

  function openCampaigns() {
    setPage("campaigns");
    setSelectedId(null);
  }

  function openEncyclopedia() {
    setPage("encyclopedia");
  }

  function openTools() {
    setPage("tools");
  }

  function openNewCampaign() {
    setEditingId(null);
    setForm(emptyForm);
    setPlayersInput("");
    setCampaignFormError(null);
    setIsFormOpen(true);
  }

  function openEditCampaign(campaign: Campaign) {
    setEditingId(campaign.id);
    setCampaignFormError(null);
    setForm({
      name: campaign.name,
      players: campaign.players,
      status: campaign.status,
    });
    setPlayersInput(campaign.players.map((player) => player.name).join("\n"));
    setIsFormOpen(true);
  }

  function saveCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || form.name.length > 80) {
      setCampaignFormError("Le nom de la campagne doit contenir au maximum 80 caractères.");
      return;
    }
    const playerNames = playersInput
      .split(/\n|,/)
      .map((player) => player.trim())
      .filter(Boolean);
    if (playerNames.some((player) => player.length > 60)) {
      setCampaignFormError("Chaque nom de joueur doit contenir au maximum 60 caractères.");
      return;
    }
    const updatedAt = new Date().toISOString();
    const previousCampaign = campaigns.find(
      (campaign) => campaign.id === editingId,
    );
    const remainingPlayers = [...(previousCampaign?.players ?? [])];
    const players = playerNames.map((name) => {
        const existingIndex = remainingPlayers.findIndex(
          (player) =>
            player.name.toLocaleLowerCase("fr") === name.toLocaleLowerCase("fr"),
        );
        if (existingIndex >= 0) {
          const [existingPlayer] = remainingPlayers.splice(existingIndex, 1);
          return { ...existingPlayer, name };
        }
        return {
          id: crypto.randomUUID(),
          name,
          characterName: "",
          className: "",
          level: 1,
        };
      });
    const campaign: Campaign = {
      ...form,
      name: form.name.trim(),
      players,
      id: editingId ?? crypto.randomUUID(),
      summaries: previousCampaign?.summaries ?? [],
      notes: previousCampaign?.notes ?? [],
      links: previousCampaign?.links ?? [],
      images: previousCampaign?.images ?? [],
      updatedAt,
    };

    setCampaigns((current) =>
      editingId
        ? current.map((item) => (item.id === editingId ? campaign : item))
        : [campaign, ...current],
    );
    setShouldPersist(true);
    setCampaignFormError(null);
    setIsFormOpen(false);
    setSelectedId(campaign.id);
  }

  function deleteCampaign(campaign: Campaign) {
    if (
      !window.confirm(
        `Supprimer la campagne « ${campaign.name} » ? Cette action est définitive.`,
      )
    ) {
      return;
    }
    setCampaigns((current) =>
      current.filter((item) => item.id !== campaign.id),
    );
    setShouldPersist(true);
    setSelectedId(null);
  }

  const selectedCampaign = campaigns.find(
    (campaign) => campaign.id === selectedId,
  );
  const sortedSummaries = selectedCampaign
    ? [...selectedCampaign.summaries].sort(
        (first, second) =>
          Date.parse(first.publishedAt) - Date.parse(second.publishedAt),
      )
    : [];

  function updateSelectedCampaign(
    update: (campaign: Campaign) => Campaign,
  ) {
    if (!selectedId) return;
    setCampaigns((current) =>
      current.map((campaign) =>
        campaign.id === selectedId
          ? update({ ...campaign, updatedAt: new Date().toISOString() })
          : campaign,
      ),
    );
    setShouldPersist(true);
  }

  function openNewPlayer() {
    setEditingPlayerId(null);
    setPlayerForm(emptyPlayerForm);
    setIsCustomPlayerClass(false);
    setPlayerError(null);
    setIsPlayerFormOpen(true);
  }

  function openNewSummary() {
    setEditingSummaryId(null);
    setSummaryForm(emptySummaryForm);
    setSummaryFormError(null);
    setIsSummaryFormOpen(true);
  }

  function openEditSummary(summary: CampaignSummary) {
    setEditingSummaryId(summary.id);
    setSummaryForm({ content: summary.content });
    setSummaryFormError(null);
    setIsSummaryFormOpen(true);
  }

  function saveSummary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCampaign) return;
    if (!summaryForm.content.trim() || summaryForm.content.length > 5000) {
      setSummaryFormError("Le résumé doit contenir entre 1 et 5 000 caractères.");
      return;
    }

    const now = new Date().toISOString();
    const existingSummary = selectedCampaign.summaries.find(
      (summary) => summary.id === editingSummaryId,
    );
    const summary: CampaignSummary = {
      id: existingSummary?.id ?? crypto.randomUUID(),
      content: summaryForm.content.trim(),
      publishedAt: existingSummary?.publishedAt ?? now,
      updatedAt: now,
    };
    updateSelectedCampaign((campaign) => ({
      ...campaign,
      summaries: editingSummaryId
        ? campaign.summaries.map((item) =>
            item.id === editingSummaryId ? summary : item,
          )
        : [...campaign.summaries, summary],
    }));
    setIsSummaryFormOpen(false);
    setSummaryFormError(null);
  }

  function deleteSummary(summary: CampaignSummary) {
    if (
      !window.confirm("Supprimer ce résumé ? Cette action est définitive.")
    ) {
      return;
    }
    updateSelectedCampaign((campaign) => ({
      ...campaign,
      summaries: campaign.summaries.filter((item) => item.id !== summary.id),
    }));
  }

  function openEditPlayer(player: CampaignPlayer) {
    setEditingPlayerId(player.id);
    setPlayerForm({
      name: player.name,
      characterName: player.characterName,
      className: player.className,
      level: String(player.level),
    });
    setIsCustomPlayerClass(
      player.className !== "" &&
        !officialClasses.some((className) => className === player.className),
    );
    setPlayerError(null);
    setIsPlayerFormOpen(true);
  }

  function savePlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCampaign) return;
    if (!playerForm.name.trim()) {
      setPlayerError("Le nom du joueur est obligatoire.");
      return;
    }

    const level = Number(playerForm.level);
    if (
      playerForm.name.length > 60 ||
      playerForm.characterName.length > 60 ||
      playerForm.className.length > 40
    ) {
      setPlayerError("Un ou plusieurs champs dépassent la longueur autorisée.");
      return;
    }
    if (!Number.isInteger(level) || level < 1 || level > 20) {
      setPlayerError("Le niveau doit être compris entre 1 et 20.");
      return;
    }
    if (
      selectedCampaign.players.some(
        (player) =>
          player.id !== editingPlayerId &&
          player.name.toLocaleLowerCase("fr") ===
            playerForm.name.trim().toLocaleLowerCase("fr"),
      )
    ) {
      setPlayerError("Ce joueur figure déjà dans la liste.");
      return;
    }

    const player: CampaignPlayer = {
      id: editingPlayerId ?? crypto.randomUUID(),
      name: playerForm.name.trim(),
      characterName: playerForm.characterName.trim(),
      className: playerForm.className.trim(),
      level,
    };
    updateSelectedCampaign((campaign) => ({
      ...campaign,
      players: editingPlayerId
        ? campaign.players.map((item) =>
            item.id === editingPlayerId ? player : item,
          )
        : [...campaign.players, player],
    }));
    setIsPlayerFormOpen(false);
    setPlayerError(null);
  }

  function openNewNote() {
    setEditingNoteId(null);
    setNoteContent("");
    setNoteTagsInput("");
    setNoteFormError(null);
    setIsNoteFormOpen(true);
  }

  function openEditNote(note: CampaignNote) {
    setEditingNoteId(note.id);
    setNoteContent(note.content);
    setNoteTagsInput(note.tags.join(", "));
    setNoteFormError(null);
    setIsNoteFormOpen(true);
  }

  function openResourceForm(type: "link" | "image") {
    setResourceType(type);
    setEditingResourceId(null);
    setResourceTitle("");
    setResourceUrl("");
    setResourceCaption("");
    setResourceFormError(null);
    setIsResourceFormOpen(true);
  }

  function openEditLink(link: CampaignLink) {
    setResourceType("link");
    setEditingResourceId(link.id);
    setResourceTitle(link.title);
    setResourceUrl(link.url);
    setResourceCaption("");
    setResourceFormError(null);
    setIsResourceFormOpen(true);
  }

  function openEditImage(image: CampaignImage) {
    setResourceType("image");
    setEditingResourceId(image.id);
    setResourceTitle("");
    setResourceUrl(image.url);
    setResourceCaption(image.caption);
    setResourceFormError(null);
    setIsResourceFormOpen(true);
  }

  function saveResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCampaign) return;
    const normalizedUrl = resourceUrl.trim();
    if (!isValidWebUrl(normalizedUrl)) {
      setResourceFormError("Saisissez une adresse web commençant par http:// ou https://.");
      return;
    }
    if (resourceType === "link" && !resourceTitle.trim()) {
      setResourceFormError("Le titre du lien est obligatoire.");
      return;
    }
    if (resourceType === "link" && resourceTitle.length > 100) {
      setResourceFormError("Le titre du lien ne peut pas dépasser 100 caractères.");
      return;
    }
    if (resourceType === "image" && resourceCaption.length > 120) {
      setResourceFormError("La légende ne peut pas dépasser 120 caractères.");
      return;
    }

    const now = new Date().toISOString();
    if (resourceType === "link") {
      const existingLink = selectedCampaign.links.find(
        (link) => link.id === editingResourceId,
      );
      const link: CampaignLink = {
        id: existingLink?.id ?? crypto.randomUUID(),
        title: resourceTitle.trim(),
        url: new URL(normalizedUrl).href,
        createdAt: existingLink?.createdAt ?? now,
      };
      updateSelectedCampaign((campaign) => ({
        ...campaign,
        links: editingResourceId
          ? campaign.links.map((item) =>
              item.id === editingResourceId ? link : item,
            )
          : [link, ...campaign.links],
      }));
    } else {
      const existingImage = selectedCampaign.images.find(
        (image) => image.id === editingResourceId,
      );
      const image: CampaignImage = {
        id: existingImage?.id ?? crypto.randomUUID(),
        url: new URL(normalizedUrl).href,
        caption: resourceCaption.trim(),
        createdAt: existingImage?.createdAt ?? now,
      };
      updateSelectedCampaign((campaign) => ({
        ...campaign,
        images: editingResourceId
          ? campaign.images.map((item) =>
              item.id === editingResourceId ? image : item,
            )
          : [image, ...campaign.images],
      }));
    }
    setIsResourceFormOpen(false);
    setResourceFormError(null);
  }

  function deleteLink(link: CampaignLink) {
    if (!window.confirm(`Supprimer le lien « ${link.title} » ?`)) return;
    updateSelectedCampaign((campaign) => ({
      ...campaign,
      links: campaign.links.filter((item) => item.id !== link.id),
    }));
  }

  function deleteImage(image: CampaignImage) {
    if (!window.confirm("Supprimer cette image de la galerie ?")) return;
    updateSelectedCampaign((campaign) => ({
      ...campaign,
      images: campaign.images.filter((item) => item.id !== image.id),
    }));
    if (lightboxImage?.id === image.id) setLightboxImage(null);
  }

  function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCampaign) return;
    if (!noteContent.trim() || noteContent.length > 5000) {
      setNoteFormError("La note doit contenir entre 1 et 5 000 caractères.");
      return;
    }

    const now = new Date().toISOString();
    const tags = parseTags(noteTagsInput);
    if (tags.length > 20 || tags.some((tag) => tag.length > 50)) {
      setNoteFormError("Utilisez au maximum 20 tags de 50 caractères chacun.");
      return;
    }
    const existingNote = selectedCampaign.notes.find(
      (note) => note.id === editingNoteId,
    );
    const note: CampaignNote = {
      id: existingNote?.id ?? crypto.randomUUID(),
      content: noteContent.trim(),
      tags,
      createdAt: existingNote?.createdAt ?? now,
      updatedAt: now,
    };

    updateSelectedCampaign((campaign) => ({
      ...campaign,
      notes: editingNoteId
        ? campaign.notes.map((item) => (item.id === editingNoteId ? note : item))
        : [note, ...campaign.notes],
    }));
    setIsNoteFormOpen(false);
    setNoteFormError(null);
  }

  function deleteNote(note: CampaignNote) {
    if (!window.confirm("Supprimer cette note ? Cette action est définitive.")) {
      return;
    }
    updateSelectedCampaign((campaign) => ({
      ...campaign,
      notes: campaign.notes.filter((item) => item.id !== note.id),
    }));
  }

  function removePlayer(player: CampaignPlayer) {
    if (!window.confirm(`Retirer ${player.name} de cette campagne ?`)) return;
    updateSelectedCampaign((campaign) => ({
      ...campaign,
      players: campaign.players.filter((item) => item.id !== player.id),
    }));
    setPlayerError(null);
  }

  const sortedNotes = selectedCampaign
    ? [...selectedCampaign.notes].sort((first, second) => {
        if (notesSort === "date") {
          return Date.parse(second.createdAt) - Date.parse(first.createdAt);
        }
        const firstTag = [...first.tags]
          .sort((a, b) => a.localeCompare(b, "fr"))[0] ?? "";
        const secondTag = [...second.tags]
          .sort((a, b) => a.localeCompare(b, "fr"))[0] ?? "";
        return (
          firstTag.localeCompare(secondTag, "fr") ||
          Date.parse(second.createdAt) - Date.parse(first.createdAt)
        );
      })
    : [];
  const usedTags = selectedCampaign
    ? Array.from(
        new Map(
          selectedCampaign.notes
            .flatMap((note) => note.tags)
            .map((tag) => [tag.toLocaleLowerCase("fr"), tag]),
        ).values(),
      ).sort((first, second) => first.localeCompare(second, "fr"))
    : [];
  const selectedNoteTags = new Set(
    parseTags(noteTagsInput).map((tag) => tag.toLocaleLowerCase("fr")),
  );
  const searchTag = notesTagSearch.trim().toLocaleLowerCase("fr");
  const visibleNotes = sortedNotes.filter(
    (note) =>
      !searchTag ||
      note.tags.some((tag) =>
        tag.toLocaleLowerCase("fr").includes(searchTag),
      ),
  );

  function toggleNoteTag(tag: string) {
    const currentTags = parseTags(noteTagsInput);
    const tagIsSelected = currentTags.some(
      (currentTag) =>
        currentTag.toLocaleLowerCase("fr") === tag.toLocaleLowerCase("fr"),
    );
    setNoteTagsInput(
      (tagIsSelected
        ? currentTags.filter(
            (currentTag) =>
              currentTag.toLocaleLowerCase("fr") !== tag.toLocaleLowerCase("fr"),
          )
        : [...currentTags, tag]
      ).join(", "),
    );
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a
          className="brand"
          href="#accueil"
          aria-label="Le Grimoire, accueil"
          onClick={() => setPage("home")}
        >
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none">
              <path d="M20 3.5 35 12v16L20 36.5 5 28V12L20 3.5Z" />
              <path d="m20 9 9 5.2v10.6L20 30l-9-5.2V14.2L20 9Z" />
              <path d="m20 9 0 21m-9-15.8 18 10.6m0-10.6L11 24.8" />
            </svg>
          </span>
          <span className="brand-name">Le Grimoire</span>
        </a>

        <nav className="main-nav" aria-label="Navigation principale">
          <a
            className={`nav-link${page === "campaigns" ? " nav-link-active" : ""}`}
            href="#campagnes"
            aria-current={page === "campaigns" ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              openCampaigns();
            }}
          >
            Campagnes
          </a>
          <a
            className={`nav-link${page === "encyclopedia" ? " nav-link-active" : ""}`}
            href="#encyclopedie"
            aria-current={page === "encyclopedia" ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              openEncyclopedia();
            }}
          >
            Encyclopédie
          </a>
          <a className="nav-link" href="#personnages">
            Personnages
          </a>
          <a
            className={`nav-link${page === "tools" ? " nav-link-active" : ""}`}
            href="#outils"
            aria-current={page === "tools" ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              openTools();
            }}
          >
            Outils
          </a>
        </nav>

        <a className="account-link" href="#mon-compte">
          <span className="account-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="3.25" />
              <path d="M5.5 20c.45-3.1 2.95-5.25 6.5-5.25s6.05 2.15 6.5 5.25" />
            </svg>
          </span>
          <span>Mon compte</span>
        </a>
      </header>

      <main>
        {page === "encyclopedia" ? (
          <EncyclopediaPage />
        ) : page === "tools" ? (
          <ToolsPage />
        ) : page === "campaigns" ? (
          <section className="campaigns-page" aria-labelledby="campaigns-title">
            <div className="campaigns-heading">
              <div>
                <p className="eyebrow">
                  <span className="eyebrow-line" />
                  Votre table de jeu
                </p>
                <h1 id="campaigns-title">
                  {selectedCampaign ? (
                    <>
                      <span className="campaign-back-wrap">
                        <button
                          className="campaign-back"
                          type="button"
                          onClick={() => setSelectedId(null)}
                        >
                          ← Toutes mes campagnes
                        </button>
                      </span>
                      {selectedCampaign.name}
                    </>
                  ) : (
                    <>
                      Vos <em>campagnes.</em>
                    </>
                  )}
                </h1>
                <p className="campaigns-intro">
                  {selectedCampaign
                    ? "Le journal de bord de votre aventure."
                    : "Rassemblez vos aventures, vos joueurs et vos notes au même endroit."}
                </p>
              </div>
              {!selectedCampaign && (
                <button
                  className="button button-primary campaign-create"
                  type="button"
                  onClick={openNewCampaign}
                >
                  <span aria-hidden="true">＋</span>
                  Créer une campagne
                </button>
              )}
            </div>

            {storageError && (
              <p className="storage-message" role="status">
                {storageError}
              </p>
            )}

            {selectedCampaign ? (
              <article className="campaign-detail">
                <div className="campaign-detail-top">
                  <div>
                    <span
                      className={`status-pill ${getStatusClass(selectedCampaign.status)}`}
                    >
                      {selectedCampaign.status}
                    </span>
                    <p className="campaign-updated">
                      Modifiée le {formatDate(selectedCampaign.updatedAt)}
                    </p>
                  </div>
                  <div className="campaign-actions">
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => openEditCampaign(selectedCampaign)}
                    >
                      Modifier
                    </button>
                    <button
                      className="button button-danger"
                      type="button"
                      onClick={() => deleteCampaign(selectedCampaign)}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
                <div className="campaign-detail-grid">
                  <section className="campaign-panel campaign-summary-panel">
                    <div className="summary-section-heading">
                      <div>
                        <p className="eyebrow section-eyebrow">L’aventure</p>
                        <h2>Résumés</h2>
                      </div>
                      <button
                        className="button button-primary note-create"
                        type="button"
                        onClick={openNewSummary}
                      >
                        <span aria-hidden="true">＋</span>
                        Ajouter
                      </button>
                    </div>
                    {sortedSummaries.length ? (
                      <div className="campaign-summary-list">
                        {sortedSummaries.map((summary) => (
                          <article className="campaign-summary-entry" key={summary.id}>
                            <div className="summary-entry-heading">
                              <time dateTime={summary.publishedAt}>
                                Publié le {formatDate(summary.publishedAt)}
                              </time>
                              <div className="note-actions">
                                <button
                                  type="button"
                                  onClick={() => openEditSummary(summary)}
                                >
                                  Modifier
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteSummary(summary)}
                                >
                                  Supprimer
                                </button>
                              </div>
                            </div>
                            <div
                              className={`summary-preview${summary.content.length > 180 ? " summary-preview-truncated" : ""}`}
                              role="button"
                              tabIndex={0}
                              aria-label={`Lire le résumé publié le ${formatDate(summary.publishedAt)}`}
                              onClick={() => setViewingSummary(summary)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setViewingSummary(summary);
                                }
                              }}
                            >
                              <MarkdownContent
                                className="summary-preview-text"
                                compactLinks
                                content={summary.content}
                              />
                              {summary.content.length > 180 && (
                                <span className="summary-expand-hint">
                                  Cliquer pour lire
                                </span>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="summary-empty">
                        <p>Aucun résumé pour le moment.</p>
                        <span>
                          Ajoutez des résumés au fil de l’aventure. Ils
                          apparaîtront du plus ancien au plus récent.
                        </span>
                      </div>
                    )}
                  </section>
                  <section className="campaign-panel campaign-players-panel">
                    <div className="campaign-subheading">
                      <div>
                        <p className="eyebrow section-eyebrow">À votre table</p>
                        <h2>Joueurs</h2>
                      </div>
                      <div className="player-heading-actions">
                        <span className="panel-count">
                          {selectedCampaign.players.length}
                        </span>
                        <button
                          className="player-add-button"
                          type="button"
                          onClick={openNewPlayer}
                        >
                          + Ajouter
                        </button>
                      </div>
                    </div>
                    {selectedCampaign.players.length ? (
                      <ul className="player-list">
                        {selectedCampaign.players.map((player) => (
                          <li key={player.id}>
                            <div className="player-info">
                              <span className="player-name">
                                <span aria-hidden="true">♙</span>
                                {player.name}
                              </span>
                              <span className="player-character">
                                {player.characterName || "Personnage à définir"}
                                {" · "}
                                {player.className || "Classe à définir"}
                                {" · "}
                                Niv. {player.level}
                              </span>
                            </div>
                            <span className="player-actions">
                              <button
                                type="button"
                                aria-label={`Modifier ${player.name}`}
                                onClick={() => openEditPlayer(player)}
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                aria-label={`Supprimer ${player.name}`}
                                onClick={() => removePlayer(player)}
                              >
                                Retirer
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="campaign-prose player-empty">
                        Aucun joueur ajouté pour le moment.
                      </p>
                    )}
                  </section>
                  <section className="campaign-panel campaign-notes-panel">
                    <div className="notes-heading">
                      <div>
                        <p className="eyebrow section-eyebrow">Votre carnet</p>
                        <h2>Notes</h2>
                      </div>
                      <div className="notes-toolbar">
                        <label className="notes-sort">
                          <span>Trier par</span>
                          <select
                            aria-label="Trier les notes"
                            value={notesSort}
                            onChange={(event) =>
                              setNotesSort(
                                event.target.value === "tag" ? "tag" : "date",
                              )
                            }
                          >
                            <option value="date">Date (récentes d’abord)</option>
                            <option value="tag">Tag (A → Z)</option>
                          </select>
                        </label>
                        <label className="notes-tag-search">
                          <span className="visually-hidden">
                            Rechercher des notes par tag
                          </span>
                          <input
                            type="search"
                            list="campaign-note-tags"
                            maxLength={100}
                            aria-label="Rechercher des notes par tag"
                            placeholder="Rechercher un tag…"
                            value={notesTagSearch}
                            onChange={(event) =>
                              setNotesTagSearch(event.target.value)
                            }
                          />
                          <datalist id="campaign-note-tags">
                            {usedTags.map((tag) => (
                              <option key={tag} value={tag} />
                            ))}
                          </datalist>
                        </label>
                        {notesTagSearch && (
                          <button
                            className="clear-tag-search"
                            type="button"
                            onClick={() => setNotesTagSearch("")}
                          >
                            Effacer
                          </button>
                        )}
                        <button
                          className="button button-primary note-create"
                          type="button"
                          onClick={openNewNote}
                        >
                          <span aria-hidden="true">＋</span>
                          Ajouter une note
                        </button>
                      </div>
                    </div>
                    {visibleNotes.length ? (
                      <div className="notes-list">
                        {visibleNotes.map((note) => (
                          <article className="note-card" key={note.id}>
                            <div className="note-card-heading">
                              <time dateTime={note.createdAt}>
                                {formatDate(note.createdAt)}
                              </time>
                              <div className="note-actions">
                                <button
                                  type="button"
                                  onClick={() => openEditNote(note)}
                                >
                                  Modifier
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteNote(note)}
                                >
                                  Supprimer
                                </button>
                              </div>
                            </div>
                            <p className="campaign-prose note-content">
                              {note.content}
                            </p>
                            {note.tags.length > 0 && (
                              <ul className="note-tags" aria-label="Tags">
                                {note.tags.map((tag) => (
                                  <li key={tag}>#{tag}</li>
                                ))}
                              </ul>
                            )}
                          </article>
                        ))}
                      </div>
                    ) : selectedCampaign.notes.length > 0 && searchTag ? (
                      <div className="notes-empty">
                        <p>Aucune note trouvée</p>
                        <span>
                          Aucun tag ne correspond à « {notesTagSearch} ».
                        </span>
                      </div>
                    ) : (
                      <div className="notes-empty">
                        <p>Aucune note pour le moment.</p>
                        <span>
                          Créez des notes séparées avec des tags pour garder
                          trace des PNJ, lieux et idées de séance.
                        </span>
                      </div>
                    )}
                  </section>
                  <section className="campaign-panel campaign-links-panel">
                    <div className="resource-section-heading">
                      <div>
                        <p className="eyebrow section-eyebrow">À consulter</p>
                        <h2>Liens</h2>
                      </div>
                      <button
                        className="button button-secondary resource-add"
                        type="button"
                        onClick={() => openResourceForm("link")}
                      >
                        <span aria-hidden="true">＋</span>
                        Ajouter un lien
                      </button>
                    </div>
                    {selectedCampaign.links.length ? (
                      <ul className="campaign-link-list">
                        {selectedCampaign.links.map((link) => (
                          <li key={link.id}>
                            <a
                              className="campaign-link"
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <span className="resource-link-icon" aria-hidden="true">
                                ↗
                              </span>
                              <span className="campaign-link-copy">
                                <strong>{link.title}</strong>
                                <small>{new URL(link.url).hostname}</small>
                              </span>
                              <span className="external-link-indicator" aria-hidden="true">
                                ↗
                              </span>
                            </a>
                            <span className="resource-actions">
                              <button
                                type="button"
                                aria-label={`Modifier le lien ${link.title}`}
                                onClick={() => openEditLink(link)}
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                aria-label={`Supprimer le lien ${link.title}`}
                                onClick={() => deleteLink(link)}
                              >
                                Supprimer
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="resource-empty">
                        Ajoutez les sites et ressources utiles à cette campagne.
                      </div>
                    )}
                  </section>
                  <section className="campaign-panel campaign-images-panel">
                    <div className="resource-section-heading">
                      <div>
                        <p className="eyebrow section-eyebrow">Références visuelles</p>
                        <h2>Images</h2>
                      </div>
                      <button
                        className="button button-secondary resource-add"
                        type="button"
                        onClick={() => openResourceForm("image")}
                      >
                        <span aria-hidden="true">＋</span>
                        Ajouter une image
                      </button>
                    </div>
                    {selectedCampaign.images.length ? (
                      <div className="campaign-image-grid">
                        {selectedCampaign.images.map((image) => (
                          <figure className="campaign-image-card" key={image.id}>
                            <button
                              className="gallery-image-open"
                              type="button"
                              aria-label={`Agrandir l’image${image.caption ? ` : ${image.caption}` : ""}`}
                              onClick={() => setLightboxImage(image)}
                            >
                              <img
                                src={image.url}
                                alt={image.caption || "Image de la campagne"}
                                loading="lazy"
                                decoding="async"
                              />
                              <span className="gallery-zoom" aria-hidden="true">
                                ⤢
                              </span>
                            </button>
                            <figcaption>
                              <span>{image.caption || "Image de campagne"}</span>
                              <span className="resource-actions">
                                <button
                                  type="button"
                                  aria-label="Modifier l’image"
                                  onClick={() => openEditImage(image)}
                                >
                                  Modifier
                                </button>
                                <button
                                  type="button"
                                  aria-label="Supprimer l’image"
                                  onClick={() => deleteImage(image)}
                                >
                                  Supprimer
                                </button>
                              </span>
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    ) : (
                      <div className="resource-empty">
                        Ajoutez les liens vers les images que vous souhaitez
                        garder sous la main.
                      </div>
                    )}
                  </section>
                </div>
              </article>
            ) : campaigns.length ? (
              <>
                <div className="campaign-list-heading">
                  <h2>Mes aventures</h2>
                  <span>
                    {campaigns.length}{" "}
                    {campaigns.length === 1 ? "campagne" : "campagnes"}
                  </span>
                </div>
                <div className="campaign-grid">
                  {campaigns.map((campaign) => (
                    <article className="campaign-card" key={campaign.id}>
                      <div className="campaign-card-top">
                        <span
                          className={`status-pill ${getStatusClass(campaign.status)}`}
                        >
                          {campaign.status}
                        </span>
                        <button
                          className="campaign-edit-icon"
                          type="button"
                          aria-label={`Modifier ${campaign.name}`}
                          onClick={() => openEditCampaign(campaign)}
                        >
                          ✎
                        </button>
                      </div>
                      <div
                        className="campaign-card-content"
                        role="button"
                        tabIndex={0}
                        aria-label={`Ouvrir la campagne ${campaign.name}`}
                        onClick={() => setSelectedId(campaign.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedId(campaign.id);
                          }
                        }}
                      >
                        <h3>{campaign.name}</h3>
                        <MarkdownContent
                          className="campaign-card-summary"
                          compactLinks
                          content={
                            campaign.summaries[0]?.content ||
                            "Aucun résumé pour le moment. Ajoutez-en un pour retrouver le fil de l’aventure."
                          }
                        />
                      </div>
                      <div className="campaign-card-footer">
                        <span className="campaign-player-count">
                          <span aria-hidden="true">♙</span>
                          {campaign.players.length}{" "}
                          {campaign.players.length === 1
                            ? "joueur"
                            : "joueurs"}
                        </span>
                        <button
                          className="campaign-open-link"
                          type="button"
                          onClick={() => setSelectedId(campaign.id)}
                        >
                          Ouvrir <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="campaign-empty">
                <div className="empty-die" aria-hidden="true">
                  ✧
                </div>
                <p className="eyebrow section-eyebrow">La première page est vierge</p>
                <h2>Votre prochaine aventure commence ici.</h2>
                <p>
                  Créez une campagne pour réunir son résumé, vos joueurs et vos
                  notes de maître du jeu.
                </p>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={openNewCampaign}
                >
                  Créer ma première campagne <span aria-hidden="true">↗</span>
                </button>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-line" />
              Votre compagnon de campagne
            </p>
            <h1 id="hero-title">
              Les grandes aventures commencent <em>ici.</em>
            </h1>
            <p className="hero-description">
              Campagnes, personnages et savoirs oubliés : tout votre univers de
              jeu réuni dans un seul grimoire.
            </p>
            <div className="hero-actions">
              <a
                className="button button-primary"
                href="#campagnes"
                onClick={(event) => {
                  event.preventDefault();
                  openCampaigns();
                }}
              >
                Découvrir mes campagnes
                <span aria-hidden="true">↗</span>
              </a>
              <a
                className="text-link"
                href="#encyclopedie"
                onClick={(event) => {
                  event.preventDefault();
                  openEncyclopedia();
                }}
              >
                Parcourir l’encyclopédie
                <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="hero-note">
              <span className="note-star" aria-hidden="true">
                ✳
              </span>
              <span>Pensé pour les maîtres du jeu et leurs aventuriers</span>
            </div>
          </div>

          <div className="hero-art" aria-label="Illustration décorative d'un dé à vingt faces">
            <div className="art-glow" />
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-spark spark-one">✦</div>
            <div className="art-spark spark-two">✧</div>
            <div className="die">
              <svg viewBox="0 0 320 340" role="img" aria-label="Dé à vingt faces">
                <defs>
                  <linearGradient id="d20-shell" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#50664a" />
                    <stop offset="0.5" stopColor="#263f33" />
                    <stop offset="1" stopColor="#182e28" />
                  </linearGradient>
                  <linearGradient id="d20-center" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#70805b" />
                    <stop offset="1" stopColor="#364f3d" />
                  </linearGradient>
                  <linearGradient id="d20-bottom" x1="0" y1="0" x2="0.9" y2="1">
                    <stop offset="0" stopColor="#405b43" />
                    <stop offset="1" stopColor="#20382f" />
                  </linearGradient>
                </defs>
                <path
                  className="die-outline"
                  d="m160 14 81 46 45 79-17 87-55 63-54 37-54-37-55-63-17-87 45-79 81-46Z"
                />
                <path className="die-facet die-facet-left-top" d="m160 14-81 46-45 79 126 22Z" />
                <path className="die-facet die-facet-left-mid" d="m160 14-126 125 17 87 109-7Z" />
                <path className="die-facet die-facet-right-top" d="m160 14 81 46 45 79-126 22Z" />
                <path className="die-facet die-facet-right-mid" d="m160 14 126 125-17 87-109-7Z" />
                <path className="die-facet die-facet-left-low" d="m34 139 17 87 55 63 54-70Z" />
                <path className="die-facet die-facet-left-bottom" d="m51 226 55 63 54 37v-107Z" />
                <path className="die-facet die-facet-right-low" d="m286 139-17 87-55 63-54-70Z" />
                <path className="die-facet die-facet-right-bottom" d="m269 226-55 63-54 37v-107Z" />
                <path className="die-facet die-face-main" d="m160 14-109 212h218Z" />
                <path className="die-facet die-face-bottom" d="m51 226 109 100 109-100Z" />
                <text className="die-number die-number-main" x="160" y="167" textAnchor="middle">
                  ✦
                </text>
              </svg>
            </div>
            <div className="art-caption">
              <span className="caption-rule" />
              <span>À vous d’écrire la suite</span>
            </div>
          </div>
        </section>

            <section className="destinations" aria-labelledby="destinations-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow section-eyebrow">Votre table de jeu</p>
              <h2 id="destinations-title">Tout commence par un choix.</h2>
            </div>
            <p className="section-aside">
              Le nécessaire pour préparer, jouer et faire vivre vos aventures.
            </p>
          </div>

          <div className="destination-grid">
            {destinations.map((destination) => (
              <a
                className="destination-card"
                href={`#${destination.id}`}
                id={destination.id}
                key={destination.id}
                onClick={
                  destination.id === "campagnes"
                    ? (event) => {
                        event.preventDefault();
                        openCampaigns();
                      }
                    : destination.id === "encyclopedie"
                      ? (event) => {
                          event.preventDefault();
                          openEncyclopedia();
                        }
                    : destination.id === "outils"
                      ? (event) => {
                          event.preventDefault();
                          openTools();
                        }
                    : undefined
                }
              >
                <div className="card-topline">
                  <span className="card-number">{destination.number}</span>
                  <span className="card-icon" aria-hidden="true">
                    {destination.icon}
                  </span>
                </div>
                <h3>{destination.title}</h3>
                <p>{destination.description}</p>
                <span className="card-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            ))}
          </div>
        </section>

            <section className="account-callout" id="mon-compte">
          <div className="callout-seal" aria-hidden="true">
            ✦
          </div>
          <div>
            <p className="eyebrow">Votre espace</p>
            <h2>Une place à votre table.</h2>
            <p>Retrouvez bientôt ici vos campagnes et vos personnages.</p>
          </div>
          <span className="callout-note">Le Grimoire prend forme</span>
            </section>
          </>
        )}
      </main>

      <footer className="site-footer">
        <a
          className="footer-brand"
          href="#accueil"
          onClick={() => setPage("home")}
        >
          Le Grimoire
        </a>
        <span>Herebos - DCO 2026</span>
        <span>Un compagnon pour vos aventures, quelle que soit votre table.</span>
        <span className="footer-edition">Édition 2014 · 5e</span>
      </footer>
      {isFormOpen && (
        <div
          className="campaign-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsFormOpen(false);
          }}
        >
          <section
            className="campaign-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-form-title"
          >
            <div className="campaign-modal-heading">
              <div>
                <p className="eyebrow section-eyebrow">
                  {editingId ? "Mettre à jour" : "Nouvelle aventure"}
                </p>
                <h2 id="campaign-form-title">
                  {editingId ? "Modifier la campagne" : "Créer une campagne"}
                </h2>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="Fermer"
                onClick={() => setIsFormOpen(false)}
              >
                ×
              </button>
            </div>
            <form className="campaign-form" onSubmit={saveCampaign}>
              <label className="form-field">
                <span>Nom de la campagne <span aria-hidden="true">*</span></span>
                <input
                  autoFocus
                  required
                  maxLength={80}
                  value={form.name}
                  placeholder="Les Chroniques de Valombre"
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }));
                    setCampaignFormError(null);
                  }}
                />
              </label>
              <label className="form-field">
                <span>Joueurs (noms seulement)</span>
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={playersInput}
                  placeholder="Un joueur par ligne (ou séparés par des virgules)"
                  onChange={(event) => {
                    setPlayersInput(event.target.value);
                    setCampaignFormError(null);
                  }}
                />
                <small>
                  Vous pourrez ensuite compléter chaque fiche avec le personnage,
                  la classe et le niveau.
                </small>
              </label>
              {campaignFormError && (
                <p className="player-error" role="alert">
                  {campaignFormError}
                </p>
              )}
              <div className="form-row">
                <label className="form-field">
                  <span>État de la campagne</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      {
                        const status = event.target.value;
                        if (isCampaignStatus(status)) {
                          setForm((current) => ({ ...current, status }));
                        }
                      }
                    }
                  >
                    <option>En préparation</option>
                    <option>En cours</option>
                    <option>En pause</option>
                    <option>Terminée</option>
                  </select>
                </label>
              </div>
              <div className="campaign-form-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                >
                  Annuler
                </button>
                <button className="button button-primary" type="submit">
                  {editingId ? "Enregistrer" : "Créer la campagne"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {isSummaryFormOpen && (
        <div
          className="campaign-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsSummaryFormOpen(false);
            }
          }}
        >
          <section
            className="campaign-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="summary-form-title"
          >
            <div className="campaign-modal-heading">
              <div>
                <p className="eyebrow section-eyebrow">Chronique de campagne</p>
                <h2 id="summary-form-title">
                  {editingSummaryId ? "Modifier le résumé" : "Ajouter un résumé"}
                </h2>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="Fermer"
                onClick={() => setIsSummaryFormOpen(false)}
              >
                ×
              </button>
            </div>
            <form className="campaign-form" onSubmit={saveSummary}>
              <label className="form-field">
                <span>Résumé <span aria-hidden="true">*</span></span>
                <textarea
                  autoFocus
                  required
                  rows={8}
                  maxLength={5000}
                  value={summaryForm.content}
                  placeholder="Racontez les événements marquants de la campagne…"
                  onChange={(event) => {
                    setSummaryForm({ content: event.target.value });
                    setSummaryFormError(null);
                  }}
                />
                <small>
                  La date de publication est enregistrée automatiquement. Les
                  résumés s’affichent du plus ancien au plus récent.
                </small>
              </label>
              {summaryFormError && (
                <p className="resource-form-error" role="alert">
                  {summaryFormError}
                </p>
              )}
              <aside className="markdown-help" aria-label="Aide Markdown">
                <h3>Aide Markdown</h3>
                <div className="markdown-help-grid">
                  <code># Titre</code>
                  <span>Titre</span>
                  <code>**gras**</code>
                  <span><strong>gras</strong></span>
                  <code>*italique*</code>
                  <span><em>italique</em></span>
                  <code>{"<u>souligné</u>"}</code>
                  <span><u>souligné</u></span>
                  <code>- Élément</code>
                  <span>Liste à puces</span>
                  <code>[texte](https://…)</code>
                  <span>Lien</span>
                  <code>~~barré~~</code>
                  <span><del>barré</del></span>
                  <code>`code`</code>
                  <span>Code en ligne</span>
                </div>
              </aside>
              <div className="campaign-form-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setIsSummaryFormOpen(false)}
                >
                  Annuler
                </button>
                <button className="button button-primary" type="submit">
                  {editingSummaryId ? "Enregistrer" : "Ajouter le résumé"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {viewingSummary && (
        <div
          className="campaign-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setViewingSummary(null);
            }
          }}
        >
          <section
            className="campaign-modal summary-reading-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="summary-reading-title"
          >
            <div className="campaign-modal-heading">
              <div>
                <p className="eyebrow section-eyebrow">Chronique de campagne</p>
                <h2 id="summary-reading-title">Résumé</h2>
                <p className="campaign-updated">
                  Publié le {formatDate(viewingSummary.publishedAt)}
                </p>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="Fermer"
                onClick={() => setViewingSummary(null)}
              >
                ×
              </button>
            </div>
            <MarkdownContent
              className="campaign-prose summary-reading-content"
              content={viewingSummary.content}
            />
            <div className="campaign-form-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setViewingSummary(null)}
              >
                Fermer
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={() => {
                  openEditSummary(viewingSummary);
                  setViewingSummary(null);
                }}
              >
                Modifier le résumé
              </button>
            </div>
          </section>
        </div>
      )}
      {isPlayerFormOpen && (
        <div
          className="campaign-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsPlayerFormOpen(false);
            }
          }}
        >
          <section
            className="campaign-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="player-form-title"
          >
            <div className="campaign-modal-heading">
              <div>
                <p className="eyebrow section-eyebrow">À votre table</p>
                <h2 id="player-form-title">
                  {editingPlayerId ? "Modifier le joueur" : "Ajouter un joueur"}
                </h2>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="Fermer"
                onClick={() => setIsPlayerFormOpen(false)}
              >
                ×
              </button>
            </div>
            <form className="campaign-form" onSubmit={savePlayer}>
              <label className="form-field">
                <span>Nom du joueur <span aria-hidden="true">*</span></span>
                <input
                  autoFocus
                  required
                  maxLength={60}
                  value={playerForm.name}
                  placeholder="Camille"
                  onChange={(event) => {
                    setPlayerForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }));
                    setPlayerError(null);
                  }}
                />
              </label>
              <label className="form-field">
                <span>Nom du personnage</span>
                <input
                  maxLength={60}
                  value={playerForm.characterName}
                  placeholder="Aelar Lunargent"
                  onChange={(event) =>
                    setPlayerForm((current) => ({
                      ...current,
                      characterName: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="player-form-row">
                <label className="form-field">
                  <span>Classe</span>
                  <select
                    value={
                      isCustomPlayerClass ? "custom" : playerForm.className
                    }
                    onChange={(event) => {
                      const selectedClass = event.target.value;
                      const isCustom = selectedClass === "custom";
                      setIsCustomPlayerClass(isCustom);
                      setPlayerForm((current) => ({
                        ...current,
                        className: isCustom ? "" : selectedClass,
                      }));
                    }}
                  >
                    <option value="">Choisir une classe</option>
                    {officialClasses.map((className) => (
                      <option key={className} value={className}>
                        {className}
                      </option>
                    ))}
                    <option value="custom">Autre (saisie libre)</option>
                  </select>
                  {isCustomPlayerClass && (
                    <input
                      autoFocus
                      maxLength={40}
                      aria-label="Saisir une classe personnalisée"
                      value={playerForm.className}
                      placeholder="Nom de la classe"
                      onChange={(event) =>
                        setPlayerForm((current) => ({
                          ...current,
                          className: event.target.value,
                        }))
                      }
                    />
                  )}
                  <small>
                    Classes officielles de la 5e édition 2014, ou saisie libre.
                  </small>
                </label>
                <label className="form-field">
                  <span>Niveau</span>
                  <input
                    required
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    value={playerForm.level}
                    onChange={(event) =>
                      setPlayerForm((current) => ({
                        ...current,
                        level: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              {playerError && (
                <p className="player-error" role="alert">
                  {playerError}
                </p>
              )}
              <div className="campaign-form-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setIsPlayerFormOpen(false)}
                >
                  Annuler
                </button>
                <button className="button button-primary" type="submit">
                  {editingPlayerId ? "Enregistrer" : "Ajouter le joueur"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {isNoteFormOpen && (
        <div
          className="campaign-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsNoteFormOpen(false);
          }}
        >
          <section
            className="campaign-modal note-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-form-title"
          >
            <div className="campaign-modal-heading">
              <div>
                <p className="eyebrow section-eyebrow">Carnet de campagne</p>
                <h2 id="note-form-title">
                  {editingNoteId ? "Modifier la note" : "Nouvelle note"}
                </h2>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="Fermer"
                onClick={() => setIsNoteFormOpen(false)}
              >
                ×
              </button>
            </div>
            <form className="campaign-form" onSubmit={saveNote}>
              <label className="form-field">
                <span>Contenu de la note <span aria-hidden="true">*</span></span>
                <textarea
                  autoFocus
                  required
                  rows={7}
                  maxLength={5000}
                  value={noteContent}
                  placeholder="Notez un indice, un PNJ rencontré ou une idée pour la prochaine séance…"
                  onChange={(event) => {
                    setNoteContent(event.target.value);
                    setNoteFormError(null);
                  }}
                />
              </label>
              <label className="form-field">
                <span>Tags</span>
                <input
                  maxLength={200}
                  value={noteTagsInput}
                  placeholder="PNJ, Lieux, Séance 3"
                  onChange={(event) => {
                    setNoteTagsInput(event.target.value);
                    setNoteFormError(null);
                  }}
                />
                <small>
                  Séparez les tags par des virgules pour retrouver et trier vos
                  notes plus facilement.
                </small>
              </label>
              {usedTags.length > 0 && (
                <div className="note-tag-suggestions">
                  <span>Tags déjà utilisés</span>
                  <div className="note-tag-suggestion-list">
                    {usedTags.map((tag) => {
                      const selected = selectedNoteTags.has(
                        tag.toLocaleLowerCase("fr"),
                      );
                      return (
                        <button
                          className={selected ? "selected" : ""}
                          type="button"
                          aria-pressed={selected}
                          key={tag}
                          onClick={() => toggleNoteTag(tag)}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {noteFormError && (
                <p className="resource-form-error" role="alert">
                  {noteFormError}
                </p>
              )}
              <div className="campaign-form-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setIsNoteFormOpen(false)}
                >
                  Annuler
                </button>
                <button className="button button-primary" type="submit">
                  {editingNoteId ? "Enregistrer" : "Ajouter la note"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {isResourceFormOpen && (
        <div
          className="campaign-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsResourceFormOpen(false);
            }
          }}
        >
          <section
            className="campaign-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="resource-form-title"
          >
            <div className="campaign-modal-heading">
              <div>
                <p className="eyebrow section-eyebrow">
                  {resourceType === "link" ? "Ressources de campagne" : "Galerie de campagne"}
                </p>
                <h2 id="resource-form-title">
                  {resourceType === "link"
                    ? editingResourceId
                      ? "Modifier le lien"
                      : "Ajouter un lien"
                    : editingResourceId
                      ? "Modifier l’image"
                      : "Ajouter une image"}
                </h2>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="Fermer"
                onClick={() => setIsResourceFormOpen(false)}
              >
                ×
              </button>
            </div>
            <form className="campaign-form" onSubmit={saveResource}>
              {resourceType === "link" && (
                <label className="form-field">
                  <span>Titre du lien <span aria-hidden="true">*</span></span>
                  <input
                    autoFocus
                    required
                    maxLength={100}
                    value={resourceTitle}
                    placeholder="Wiki de campagne, carte du monde…"
                    onChange={(event) => {
                      setResourceTitle(event.target.value);
                      setResourceFormError(null);
                    }}
                  />
                </label>
              )}
              <label className="form-field">
                <span>
                  {resourceType === "link" ? "Adresse web" : "Adresse de l’image"}{" "}
                  <span aria-hidden="true">*</span>
                </span>
                <input
                  autoFocus={resourceType === "image"}
                  required
                  type="url"
                  maxLength={2048}
                  value={resourceUrl}
                  placeholder="https://exemple.com/..."
                  onChange={(event) => {
                    setResourceUrl(event.target.value);
                    setResourceFormError(null);
                  }}
                />
                <small>
                  {resourceType === "link"
                    ? "Le lien s’ouvrira dans un nouvel onglet."
                    : "Utilisez l’adresse directe d’une image accessible sur le web."}
                </small>
              </label>
              {resourceType === "image" && (
                <label className="form-field">
                  <span>Légende (facultative)</span>
                  <input
                    maxLength={120}
                    value={resourceCaption}
                    placeholder="Le château de Valombre"
                    onChange={(event) => {
                      setResourceCaption(event.target.value);
                      setResourceFormError(null);
                    }}
                  />
                </label>
              )}
              {resourceFormError && (
                <p className="resource-form-error" role="alert">
                  {resourceFormError}
                </p>
              )}
              <div className="campaign-form-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setIsResourceFormOpen(false)}
                >
                  Annuler
                </button>
                <button className="button button-primary" type="submit">
                  {editingResourceId
                    ? "Enregistrer"
                    : resourceType === "link"
                      ? "Ajouter le lien"
                      : "Ajouter à la galerie"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {lightboxImage && (
        <div
          className="image-lightbox-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLightboxImage(null);
          }}
        >
          <section
            className="image-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={lightboxImage.caption || "Aperçu de l’image"}
          >
            <button
              className="lightbox-close"
              type="button"
              aria-label="Fermer l’image agrandie"
              onClick={() => setLightboxImage(null)}
            >
              ×
            </button>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.caption || "Image agrandie de la campagne"}
            />
            {lightboxImage.caption && (
              <p className="lightbox-caption">{lightboxImage.caption}</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
