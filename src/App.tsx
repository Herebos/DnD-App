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

type StoredCampaigns = {
  campaigns: Campaign[];
  error: string | null;
};

const STORAGE_KEY = "le-grimoire-campaigns";

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

function App() {
  const [page, setPage] = useState<"home" | "campaigns">("home");
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
          <a className="nav-link" href="#encyclopedie">
            Encyclopédie
          </a>
          <a className="nav-link" href="#personnages">
            Personnages
          </a>
          <a className="nav-link" href="#outils">
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
        {page === "campaigns" ? (
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
                        <h2>Notes de campagne</h2>
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
              <a className="text-link" href="#encyclopedie">
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
              <svg viewBox="0 0 260 290" role="img" aria-label="Dé à vingt faces">
                <path className="die-outline" d="m130 12 106 77-40 154-66 35-66-35L24 89 130 12Z" />
                <path className="die-facet facet-top" d="m130 12 106 77H24L130 12Z" />
                <path className="die-facet facet-left" d="M24 89h212l-40 154-66 35-66-35L24 89Z" />
                <path className="die-facet facet-right" d="m130 12 40 154-40 122-66-35L24 89 130 12Z" />
                <path className="die-line" d="m24 89 146 77 66-77M130 12v266m-66-35 106-89" />
                <text x="130" y="146" textAnchor="middle">
                  20
                </text>
              </svg>
            </div>
            <div className="art-caption">
              <span className="caption-rule" />
              <span>À vous d’écrire la suite</span>
            </div>
          </div>

          <div className="hero-index" aria-hidden="true">
            <span>01</span>
            <span className="index-rule" />
            <span>04</span>
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
