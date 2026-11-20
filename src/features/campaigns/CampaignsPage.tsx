import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import MarkdownContent from "../../components/MarkdownContent";
import {
  emptyForm,
  emptyPlayerForm,
  emptySummaryForm,
  formatDate,
  getStatusClass,
  isCampaignStatus,
  isValidWebUrl,
  loadCampaigns,
  MAX_CAMPAIGN_IMPORT_BYTES,
  officialClasses,
  parseCampaignImport,
  parseTags,
  serializeCampaigns,
  STORAGE_KEY,
  type Campaign,
  type CampaignForm,
  type CampaignImage,
  type CampaignLink,
  type CampaignNote,
  type CampaignPlayer,
  type CampaignPlayerForm,
  type CampaignSummary,
  type CampaignSummaryForm,
} from "./campaignData";

type CampaignsPageProps = {
  hidden: boolean;
  selectionReset: number;
};

export default function CampaignsPage({
  hidden,
  selectionReset,
}: CampaignsPageProps) {
  const [storedCampaigns] = useState(loadCampaigns);
  const [campaigns, setCampaignsState] = useState(storedCampaigns.campaigns);
  const campaignsRef = useRef(campaigns);
  const [storageError, setStorageError] = useState(storedCampaigns.error);
  const [shouldPersist, setShouldPersist] = useState(!storedCampaigns.error);
  const [pendingCampaignImport, setPendingCampaignImport] = useState<{
    fileName: string;
    resultCampaigns: Campaign[];
    conflicts: Campaign[];
    conflictIndex: number;
    importedCount: number;
  } | null>(null);
  const [campaignImportError, setCampaignImportError] = useState<string | null>(
    null,
  );
  const [campaignImportSuccess, setCampaignImportSuccess] = useState<
    string | null
  >(null);
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

  function updateCampaigns(update: (current: Campaign[]) => Campaign[]) {
    setCampaignsState((current) => {
      const next = update(current);
      campaignsRef.current = next;
      return next;
    });
  }

  function replaceCampaigns(updatedCampaigns: Campaign[]) {
    campaignsRef.current = updatedCampaigns;
    setCampaignsState(updatedCampaigns);
  }

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
      !viewingSummary &&
      !pendingCampaignImport
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
        setPendingCampaignImport(null);
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
    pendingCampaignImport,
  ]);


  useEffect(() => {
    setSelectedId(null);
  }, [selectionReset]);

  function openNewCampaign() {
    setEditingId(null);
    setForm(emptyForm);
    setPlayersInput("");
    setCampaignFormError(null);
    setIsFormOpen(true);
  }

  function exportCampaigns() {
    const campaignsToExport = selectedCampaign
      ? [selectedCampaign]
      : campaigns;
    if (!campaignsToExport.length) return;

    const blob = new Blob([serializeCampaigns(campaignsToExport)], {
      type: "application/json",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    const exportName = selectedCampaign
      ? selectedCampaign.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase() || "campagne"
      : "campagnes";
    downloadLink.download = `le-grimoire-${exportName}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
  }

  async function importCampaigns(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    setCampaignImportError(null);
    setCampaignImportSuccess(null);
    setPendingCampaignImport(null);
    if (file.size > MAX_CAMPAIGN_IMPORT_BYTES) {
      setCampaignImportError("Le fichier dépasse la taille maximale autorisée de 4 Mo.");
      return;
    }

    try {
      const importedCampaigns = parseCampaignImport(await file.text());
      const currentCampaigns = campaignsRef.current;
      const conflicts = importedCampaigns.filter((importedCampaign) =>
        currentCampaigns.some(
          (campaign) => campaign.id === importedCampaign.id,
        ),
      );
      const nonConflictingCampaigns = importedCampaigns.filter(
        (importedCampaign) =>
          !currentCampaigns.some(
            (campaign) => campaign.id === importedCampaign.id,
          ),
      );

      if (conflicts.length) {
        setPendingCampaignImport({
          fileName: file.name,
          resultCampaigns: [...currentCampaigns, ...nonConflictingCampaigns],
          conflicts,
          conflictIndex: 0,
          importedCount: importedCampaigns.length,
        });
      } else {
        applyCampaignImport(
          [...currentCampaigns, ...importedCampaigns],
          importedCampaigns.length,
        );
      }
    } catch (error) {
      setCampaignImportError(
        error instanceof Error
          ? error.message
          : "Impossible de lire le fichier de sauvegarde sélectionné.",
      );
    }
  }

  function applyCampaignImport(importedCampaigns: Campaign[], importedCount: number) {
    replaceCampaigns(importedCampaigns);
    setShouldPersist(true);
    setPendingCampaignImport(null);
    setCampaignImportError(null);
    setCampaignImportSuccess(
      `${importedCount} ${importedCount === 1 ? "campagne importée" : "campagnes importées"}.`,
    );
  }

  function resolveCampaignImportConflict(choice: "replace" | "copy") {
    if (!pendingCampaignImport) return;

    const importedCampaign =
      pendingCampaignImport.conflicts[pendingCampaignImport.conflictIndex];
    let resultCampaigns = pendingCampaignImport.resultCampaigns;
    if (choice === "replace") {
      resultCampaigns = resultCampaigns.map((campaign) =>
        campaign.id === importedCampaign.id ? importedCampaign : campaign,
      );
    } else {
      const copySuffix = " (copie)";
      const copyName = `${importedCampaign.name
        .slice(0, 80 - copySuffix.length)
        .trimEnd()}${copySuffix}`;
      let newId = crypto.randomUUID();
      while (resultCampaigns.some((campaign) => campaign.id === newId)) {
        newId = crypto.randomUUID();
      }
      resultCampaigns = [
        ...resultCampaigns,
        { ...importedCampaign, id: newId, name: copyName },
      ];
    }

    const nextConflictIndex = pendingCampaignImport.conflictIndex + 1;
    if (nextConflictIndex < pendingCampaignImport.conflicts.length) {
      setPendingCampaignImport({
        ...pendingCampaignImport,
        resultCampaigns,
        conflictIndex: nextConflictIndex,
      });
      return;
    }
    applyCampaignImport(resultCampaigns, pendingCampaignImport.importedCount);
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

    updateCampaigns((current) =>
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
    updateCampaigns((current) =>
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
    updateCampaigns((current) =>
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

  const currentImportConflict = pendingCampaignImport
    ? pendingCampaignImport.conflicts[pendingCampaignImport.conflictIndex]
    : null;
  const existingImportConflict = currentImportConflict
    ? pendingCampaignImport?.resultCampaigns.find(
        (campaign) => campaign.id === currentImportConflict.id,
      )
    : null;

  return (
    <>
      <section className="campaigns-page" hidden={hidden} aria-labelledby="campaigns-title">
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
          <div className="campaign-data-actions">
            <button
              className="button button-secondary"
              type="button"
              disabled={!selectedCampaign && !campaigns.length}
              onClick={exportCampaigns}
            >
              {selectedCampaign
                ? "Exporter cette campagne"
                : "Exporter toutes les campagnes"}
            </button>
            <label className="button button-secondary campaign-import-control">
              Importer JSON
              <input
                className="visually-hidden"
                type="file"
                accept=".json,application/json"
                aria-label="Importer une sauvegarde JSON de campagnes"
                onChange={importCampaigns}
              />
            </label>
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
        </div>

        {campaignImportError && (
          <p className="campaign-import-feedback campaign-import-error" role="alert">
            {campaignImportError}
          </p>
        )}
        {campaignImportSuccess && (
          <p
            className="campaign-import-feedback campaign-import-success"
            role="status"
          >
            {campaignImportSuccess}
          </p>
        )}

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
      {pendingCampaignImport &&
        currentImportConflict &&
        existingImportConflict && (
        <div
          className="campaign-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPendingCampaignImport(null);
            }
          }}
        >
          <section
            className="campaign-modal campaign-import-confirmation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-import-conflict-title"
            aria-describedby="campaign-import-conflict-description"
          >
            <div className="campaign-modal-heading">
              <div>
                <p className="eyebrow section-eyebrow">
                  Conflit {pendingCampaignImport.conflictIndex + 1} sur{" "}
                  {pendingCampaignImport.conflicts.length}
                </p>
                <h2 id="campaign-import-conflict-title">
                  Identifiant déjà utilisé
                </h2>
              </div>
            </div>
            <p id="campaign-import-conflict-description">
              La campagne « {currentImportConflict.name} » du fichier{" "}
              « {pendingCampaignImport.fileName} » partage son identifiant avec
              « {existingImportConflict.name} ». Choisis comment traiter ce
              conflit :
            </p>
            <div className="campaign-form-actions">
              <button
                className="button button-secondary"
                type="button"
                autoFocus
                onClick={() => setPendingCampaignImport(null)}
              >
                Annuler l’import
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => resolveCampaignImportConflict("copy")}
              >
                Importer comme copie
              </button>
              <button
                className="button button-danger"
                type="button"
                onClick={() => resolveCampaignImportConflict("replace")}
              >
                Remplacer la campagne
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
