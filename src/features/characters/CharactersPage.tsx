import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { isRecord } from "../../utils/isRecord";
import {
  fetchAccountCollection,
  saveAccountCollection,
} from "../../utils/accountCollectionApi";

const API_BASE_URL = "https://www.dnd5eapi.co/api/2014";
const MAX_PORTRAIT_BYTES = 2 * 1024 * 1024;
const MAX_CHARACTER_IMPORT_BYTES = 20 * 1024 * 1024;
const CHARACTER_EXPORT_FORMAT = "le-grimoire-characters";
const CHARACTER_EXPORT_VERSION = 1;
const abilityScores = [
  ["strength", "Force"],
  ["dexterity", "Dextérité"],
  ["constitution", "Constitution"],
  ["intelligence", "Intelligence"],
  ["wisdom", "Sagesse"],
  ["charisma", "Charisme"],
] as const;

const skillNames = [
  "Acrobaties",
  "Dressage",
  "Arcanes",
  "Athlétisme",
  "Discrétion",
  "Histoire",
  "Intimidation",
  "Investigation",
  "Médecine",
  "Nature",
  "Perception",
  "Perspicacité",
  "Persuasion",
  "Représentation",
  "Religion",
  "Escamotage",
  "Survie",
  "Tromperie",
];

type AbilityKey = (typeof abilityScores)[number][0];
type CharacterOption = { index: string; name: string };
type CharacterLists = {
  races: CharacterOption[];
  classes: CharacterOption[];
  backgrounds: CharacterOption[];
  equipment: CharacterOption[];
  weapons: CharacterOption[];
  magicItems: CharacterOption[];
  spells: CharacterOption[];
};
type CharacterForm = {
  name: string;
  portrait: string;
  playerName: string;
  race: string;
  subrace: string;
  className: string;
  subclass: string;
  level: string;
  background: string;
  alignment: string;
  experience: string;
  abilities: Record<AbilityKey, string>;
  armorClass: string;
  initiative: string;
  speed: string;
  hitPoints: string;
  maximumHitPoints: string;
  temporaryHitPoints: string;
  hitDice: string;
  skills: string[];
  equipment: string[];
  weapons: string[];
  magicItems: string[];
  spells: string[];
  customEquipment: string;
  customWeapons: string;
  proficiencies: string;
  traits: string;
  appearance: string;
  personality: string;
  ideals: string;
  bonds: string;
  flaws: string;
  notes: string;
};
type Character = CharacterForm & {
  id: string;
  updatedAt: string;
};

const emptyCharacter: CharacterForm = {
  name: "",
  portrait: "",
  playerName: "",
  race: "",
  subrace: "",
  className: "",
  subclass: "",
  level: "1",
  background: "",
  alignment: "",
  experience: "0",
  abilities: {
    strength: "10",
    dexterity: "10",
    constitution: "10",
    intelligence: "10",
    wisdom: "10",
    charisma: "10",
  },
  armorClass: "10",
  initiative: "0",
  speed: "9",
  hitPoints: "1",
  maximumHitPoints: "1",
  temporaryHitPoints: "0",
  hitDice: "1d8",
  skills: [],
  equipment: [],
  weapons: [],
  magicItems: [],
  spells: [],
  customEquipment: "",
  customWeapons: "",
  proficiencies: "",
  traits: "",
  appearance: "",
  personality: "",
  ideals: "",
  bonds: "",
  flaws: "",
  notes: "",
};

const listCategories = [
  ["races", "races"],
  ["classes", "classes"],
  ["backgrounds", "backgrounds"],
  ["equipment", "equipment"],
  ["magicItems", "magic-items"],
  ["spells", "spells"],
] as const;

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Une erreur inattendue est survenue. Réessayez.";
}

async function fetchWeaponOptions(signal: AbortSignal) {
  const response = await fetch(
    `${API_BASE_URL}/equipment-categories/weapon`,
    {
      signal,
      headers: { Accept: "application/json", "Accept-Language": "fr-FR" },
    },
  );
  if (!response.ok) {
    throw new Error(`L’API a répondu avec le statut ${response.status}.`);
  }
  const data: unknown = await response.json();
  if (!isRecord(data) || !Array.isArray(data.equipment)) {
    throw new Error("La liste des armes renvoyée par l’API est invalide.");
  }
  return data.equipment.flatMap((item): CharacterOption[] =>
    isRecord(item) &&
    typeof item.index === "string" &&
    typeof item.name === "string"
      ? [{ index: item.index, name: item.name }]
      : [],
  );
}

function isCharacter(value: unknown): value is Character {
  if (!isRecord(value) || !isRecord(value.abilities)) return false;
  const abilities = value.abilities;
  const textFields = [
    "name",
    "portrait",
    "playerName",
    "race",
    "subrace",
    "className",
    "subclass",
    "level",
    "background",
    "alignment",
    "experience",
    "armorClass",
    "initiative",
    "speed",
    "hitPoints",
    "maximumHitPoints",
    "temporaryHitPoints",
    "hitDice",
    "customEquipment",
    "customWeapons",
    "proficiencies",
    "traits",
    "appearance",
    "personality",
    "ideals",
    "bonds",
    "flaws",
    "notes",
  ];
  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    value.id.length <= 128 &&
    typeof value.updatedAt === "string" &&
    Number.isFinite(Date.parse(value.updatedAt)) &&
    textFields.every((field) => typeof value[field] === "string") &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    value.name.length <= 80 &&
    (value.portrait === "" ||
      (typeof value.portrait === "string" &&
        value.portrait.length <= Math.ceil((MAX_PORTRAIT_BYTES * 4) / 3) + 40 &&
        /^data:image\/(?:jpeg|png|webp|gif);base64,[a-zA-Z0-9+/]*={0,2}$/.test(
          value.portrait,
        ))) &&
    Number.isInteger(Number(value.level)) &&
    Number(value.level) >= 1 &&
    Number(value.level) <= 20 &&
    abilityScores.every(
      ([key]) =>
        typeof abilities[key] === "string" &&
        Number.isInteger(Number(abilities[key])) &&
        Number(abilities[key]) >= 1 &&
        Number(abilities[key]) <= 30,
    ) &&
    ["skills", "equipment", "weapons", "magicItems", "spells"].every(
      (field) =>
        Array.isArray(value[field]) &&
        value[field].every((item: unknown) => typeof item === "string"),
    )
  );
}

function migrateCharacter(value: unknown): Character | null {
  if (!isRecord(value)) return null;
  const migrated = {
    ...value,
    portrait: value.portrait === undefined ? "" : value.portrait,
    magicItems: value.magicItems === undefined ? [] : value.magicItems,
  };
  return isCharacter(migrated) ? migrated : null;
}

function hasUniqueCharacterIds(characters: readonly Character[]) {
  const ids = characters.map((character) => character.id);
  return new Set(ids).size === ids.length;
}

function serializeCharacters(characters: Character[]) {
  return JSON.stringify(
    {
      format: CHARACTER_EXPORT_FORMAT,
      version: CHARACTER_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      characters,
    },
    null,
    2,
  );
}

function parseCharacterImport(jsonText: string): Character[] {
  if (
    new TextEncoder().encode(jsonText).byteLength >
    MAX_CHARACTER_IMPORT_BYTES
  ) {
    throw new Error("Le fichier dépasse la taille maximale autorisée de 20 Mo.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Le fichier sélectionné ne contient pas un JSON valide.");
  }

  if (
    !isRecord(parsed) ||
    parsed.format !== CHARACTER_EXPORT_FORMAT ||
    parsed.version !== CHARACTER_EXPORT_VERSION ||
    typeof parsed.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(parsed.exportedAt)) ||
    !Array.isArray(parsed.characters)
  ) {
    throw new Error(
      "Le fichier ne correspond pas à une sauvegarde de personnages reconnue.",
    );
  }
  if (parsed.characters.length === 0) {
    throw new Error("La sauvegarde ne contient aucun personnage à importer.");
  }

  const characters = parsed.characters.map(migrateCharacter);
  if (characters.some((character) => character === null)) {
    throw new Error(
      "La sauvegarde contient un personnage invalide ou incompatible. Aucun personnage n’a été importé.",
    );
  }
  const validCharacters = characters.filter(
    (character): character is Character => character !== null,
  );
  if (!hasUniqueCharacterIds(validCharacters)) {
    throw new Error(
      "La sauvegarde contient des identifiants de personnage en double.",
    );
  }
  return validCharacters;
}

function parseCharacterCollection(items: unknown[]): Character[] {
  const characters = items.map(migrateCharacter);
  if (characters.some((character) => character === null)) {
    throw new Error("La base contient un personnage invalide ou incompatible.");
  }
  const validCharacters = characters.filter(
    (character): character is Character => character !== null,
  );
  if (!hasUniqueCharacterIds(validCharacters)) {
    throw new Error("La base contient des identifiants de personnage en double.");
  }
  return validCharacters;
}

async function fetchOptions(category: string, signal: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/${category}?limit=1000`, {
    signal,
    headers: { Accept: "application/json", "Accept-Language": "fr-FR" },
  });
  if (!response.ok) {
    throw new Error(`L’API a répondu avec le statut ${response.status}.`);
  }
  const data: unknown = await response.json();
  if (!isRecord(data) || !Array.isArray(data.results)) {
    throw new Error(`La liste « ${category} » renvoyée par l’API est invalide.`);
  }
  return data.results.flatMap((item): CharacterOption[] =>
    isRecord(item) &&
    typeof item.index === "string" &&
    typeof item.name === "string"
      ? [{ index: item.index, name: item.name }]
      : [],
  );
}

async function fetchRelatedOptions(path: string, signal: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/${path}?limit=1000`, {
    signal,
    headers: { Accept: "application/json", "Accept-Language": "fr-FR" },
  });
  if (!response.ok) {
    throw new Error(`L’API a répondu avec le statut ${response.status}.`);
  }
  const data: unknown = await response.json();
  if (!isRecord(data) || !Array.isArray(data.results)) {
    throw new Error("La liste de choix renvoyée par l’API est invalide.");
  }
  return data.results.flatMap((item): CharacterOption[] =>
    isRecord(item) &&
    typeof item.index === "string" &&
    typeof item.name === "string"
      ? [{ index: item.index, name: item.name }]
      : [],
  );
}

function loadCharacters(storageKey: string) {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return { characters: [] as Character[], error: null };
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return {
        characters: [] as Character[],
        error:
          "Les personnages enregistrés sont illisibles. Ils n’ont pas été supprimés.",
      };
    }
    const characters = parsed.map(migrateCharacter);
    if (characters.some((character) => character === null)) {
      return {
        characters: [] as Character[],
        error:
          "Les personnages enregistrés sont illisibles. Ils n’ont pas été supprimés.",
      };
    }
    return {
      characters: characters.filter(
        (character): character is Character => character !== null,
      ),
      error: null,
    };
  } catch {
    return {
      characters: [] as Character[],
      error: "Impossible de lire les personnages enregistrés dans ce navigateur.",
    };
  }
}

function numericValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        type={type}
        min={min}
        max={max}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function OptionSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  placeholder = "Choisir ou saisir…",
}: {
  label: string;
  value: string;
  options: CharacterOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const listId = `character-options-${label
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        list={listId}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option value={option.name} key={option.index} />
        ))}
      </datalist>
    </label>
  );
}

function SearchableOptionPicker({
  label,
  options,
  selected,
  onChange,
  placeholder,
}: {
  label: string;
  options: CharacterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
  const filteredOptions = options
    .filter((option) => {
      const normalizedName = option.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("fr");
      return (
        !selected.includes(option.name) &&
        normalizedName.includes(normalizedSearch)
      );
    })
    .slice(0, 40);

  return (
    <div className="character-option-picker">
      <label className="form-field">
        <span>{label}</span>
        <input
          type="search"
          value={search}
          placeholder={placeholder}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="character-option-results">
        {filteredOptions.length ? (
          filteredOptions.map((option) => (
            <button
              type="button"
              className="character-option-result"
              key={option.index}
              onClick={() => onChange([...selected, option.name])}
            >
              <span>{option.name}</span>
              <span aria-hidden="true">＋</span>
            </button>
          ))
        ) : (
          <p className="character-option-empty">
            {options.length
              ? "Aucun élément ne correspond à la recherche."
              : "Options indisponibles."}
          </p>
        )}
      </div>
      {selected.length ? (
        <ul className="character-option-selected" aria-label={`${label} sélectionnés`}>
          {selected.map((item) => (
            <li key={item}>
              <span>{item}</span>
              <button
                type="button"
                aria-label={`Retirer ${item}`}
                onClick={() => onChange(selected.filter((value) => value !== item))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="character-option-empty">Aucun élément ajouté.</p>
      )}
    </div>
  );
}

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Le fichier image n’a pas pu être lu."));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Le fichier image n’a pas pu être lu."));
    };
    reader.readAsDataURL(file);
  });
}

export default function CharactersPage({
  storageKey,
  databaseEnabled,
}: {
  storageKey: string;
  databaseEnabled: boolean;
}) {
  const [stored] = useState(() => loadCharacters(storageKey));
  const [characters, setCharacters] = useState(stored.characters);
  const [storageError, setStorageError] = useState(stored.error);
  const [shouldPersist, setShouldPersist] = useState(!stored.error);
  const [databaseReady, setDatabaseReady] = useState(!databaseEnabled);
  const [databaseLoadError, setDatabaseLoadError] = useState<string | null>(
    null,
  );
  const [databaseSaveError, setDatabaseSaveError] = useState<string | null>(
    null,
  );
  const [databaseLoadRequest, setDatabaseLoadRequest] = useState(0);
  const [databaseSaveRequest, setDatabaseSaveRequest] = useState(0);
  const [lists, setLists] = useState<CharacterLists>({
    races: [],
    classes: [],
    backgrounds: [],
    equipment: [],
    weapons: [],
    magicItems: [],
    spells: [],
  });
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [subraces, setSubraces] = useState<CharacterOption[]>([]);
  const [subclasses, setSubclasses] = useState<CharacterOption[]>([]);
  const [relatedOptionsError, setRelatedOptionsError] = useState<string | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CharacterForm>(emptyCharacter);
  const [formError, setFormError] = useState<string | null>(null);
  const [portraitError, setPortraitError] = useState<string | null>(null);
  const [characterImportError, setCharacterImportError] = useState<
    string | null
  >(null);
  const [characterImportSuccess, setCharacterImportSuccess] = useState<
    string | null
  >(null);
  const [pendingCharacterImport, setPendingCharacterImport] = useState<{
    fileName: string;
    resultCharacters: Character[];
    conflicts: Character[];
    conflictIndex: number;
    importedCount: number;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingOptions(true);
    Promise.all([
      listCategories.map(async ([key, category]) => [
        key,
        await fetchOptions(category, controller.signal),
      ] as const),
      fetchWeaponOptions(controller.signal).then(
        (weapons) => ["weapons", weapons] as const,
      ),
    ].flat())
      .then((entries) => {
        if (controller.signal.aborted) return;
        setLists(Object.fromEntries(entries) as CharacterLists);
        setApiError(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setApiError(getErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingOptions(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!shouldPersist) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(characters));
      setStorageError(null);
    } catch {
      setStorageError(
        "La sauvegarde locale a échoué. Vos changements ne seront pas conservés après fermeture du navigateur.",
      );
    }
  }, [characters, shouldPersist, storageKey]);

  useEffect(() => {
    if (!databaseEnabled) return;
    const controller = new AbortController();
    setDatabaseReady(false);
    setDatabaseLoadError(null);
    fetchAccountCollection(
      "characters",
      controller.signal,
      parseCharacterCollection,
    )
      .then(async (result) => {
        if (controller.signal.aborted) return;
        if (!result.initialized) {
          if (!stored.error && stored.characters.length > 0) {
            await saveAccountCollection(
              "characters",
              stored.characters,
              controller.signal,
            );
          }
          return;
        }
        setCharacters(result.items);
      })
      .then(() => {
        if (controller.signal.aborted) return;
        setDatabaseReady(true);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setDatabaseLoadError(getErrorMessage(error));
      });
    return () => controller.abort();
  }, [databaseEnabled, databaseLoadRequest, storageKey, stored]);

  useEffect(() => {
    if (!databaseEnabled || !databaseReady || !shouldPersist) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      saveAccountCollection("characters", characters, controller.signal)
        .then(() => setDatabaseSaveError(null))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setDatabaseSaveError(getErrorMessage(error));
        });
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    characters,
    databaseEnabled,
    databaseReady,
    databaseSaveRequest,
    shouldPersist,
  ]);

  useEffect(() => {
    if (!isFormOpen && !pendingCharacterImport) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFormOpen(false);
        setPendingCharacterImport(null);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isFormOpen, pendingCharacterImport]);

  const selectedRace = lists.races.find((race) => race.name === form.race);
  const selectedClass = lists.classes.find(
    (classOption) => classOption.name === form.className,
  );

  useEffect(() => {
    const controller = new AbortController();
    setSubraces([]);
    setSubclasses([]);
    setRelatedOptionsError(null);
    const requests: Promise<void>[] = [];
    if (selectedRace) {
      requests.push(
        fetchRelatedOptions(`races/${selectedRace.index}/subraces`, controller.signal)
          .then(setSubraces),
      );
    }
    if (selectedClass) {
      requests.push(
        fetchRelatedOptions(`classes/${selectedClass.index}/subclasses`, controller.signal)
          .then(setSubclasses),
      );
    }
    Promise.all(requests).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setRelatedOptionsError(getErrorMessage(error));
      }
    });
    return () => controller.abort();
  }, [selectedClass, selectedRace]);

  function updateForm<K extends keyof CharacterForm>(
    key: K,
    value: CharacterForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openNewCharacter() {
    setEditingId(null);
    setForm(emptyCharacter);
    setFormError(null);
    setPortraitError(null);
    setIsFormOpen(true);
  }

  function openEditCharacter(character: Character) {
    const { id: _id, updatedAt: _updatedAt, ...characterForm } = character;
    setEditingId(character.id);
    setForm(characterForm);
    setFormError(null);
    setPortraitError(null);
    setIsFormOpen(true);
  }

  async function selectPortrait(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    setPortraitError(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setPortraitError("Choisissez une image JPEG, PNG, WebP ou GIF.");
      return;
    }
    if (file.size > MAX_PORTRAIT_BYTES) {
      setPortraitError("L’image ne doit pas dépasser 2 Mo.");
      return;
    }
    try {
      const portrait = await readImageAsDataUrl(file);
      setForm((current) => ({ ...current, portrait }));
    } catch (error: unknown) {
      setPortraitError(getErrorMessage(error));
    }
  }

  async function importCharacters(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    setCharacterImportError(null);
    setCharacterImportSuccess(null);
    setPendingCharacterImport(null);
    if (file.size > MAX_CHARACTER_IMPORT_BYTES) {
      setCharacterImportError(
        "Le fichier dépasse la taille maximale autorisée de 20 Mo.",
      );
      return;
    }

    try {
      const importedCharacters = parseCharacterImport(await file.text());
      const conflicts = importedCharacters.filter((importedCharacter) =>
        characters.some(
          (character) => character.id === importedCharacter.id,
        ),
      );
      const nonConflictingCharacters = importedCharacters.filter(
        (importedCharacter) =>
          !characters.some(
            (character) => character.id === importedCharacter.id,
          ),
      );

      if (conflicts.length) {
        setPendingCharacterImport({
          fileName: file.name,
          resultCharacters: [...characters, ...nonConflictingCharacters],
          conflicts,
          conflictIndex: 0,
          importedCount: importedCharacters.length,
        });
      } else {
        applyCharacterImport(
          [...characters, ...importedCharacters],
          importedCharacters.length,
        );
      }
    } catch (error: unknown) {
      setCharacterImportError(
        error instanceof Error
          ? error.message
          : "Impossible de lire le fichier de sauvegarde sélectionné.",
      );
    }
  }

  function applyCharacterImport(
    importedCharacters: Character[],
    importedCount: number,
  ) {
    setCharacters(importedCharacters);
    setShouldPersist(true);
    setPendingCharacterImport(null);
    setCharacterImportError(null);
    setCharacterImportSuccess(
      `${importedCount} ${
        importedCount === 1
          ? "personnage importé"
          : "personnages importés"
      }.`,
    );
  }

  function resolveCharacterImportConflict(choice: "replace" | "copy") {
    if (!pendingCharacterImport) return;

    const importedCharacter =
      pendingCharacterImport.conflicts[
        pendingCharacterImport.conflictIndex
      ];
    let resultCharacters = pendingCharacterImport.resultCharacters;
    if (choice === "replace") {
      resultCharacters = resultCharacters.map((character) =>
        character.id === importedCharacter.id
          ? importedCharacter
          : character,
      );
    } else {
      const copySuffix = " (copie)";
      const copyName = `${importedCharacter.name
        .slice(0, 80 - copySuffix.length)
        .trimEnd()}${copySuffix}`;
      let newId = crypto.randomUUID();
      while (resultCharacters.some((character) => character.id === newId)) {
        newId = crypto.randomUUID();
      }
      resultCharacters = [
        ...resultCharacters,
        { ...importedCharacter, id: newId, name: copyName },
      ];
    }

    const nextConflictIndex = pendingCharacterImport.conflictIndex + 1;
    if (nextConflictIndex < pendingCharacterImport.conflicts.length) {
      setPendingCharacterImport({
        ...pendingCharacterImport,
        resultCharacters,
        conflictIndex: nextConflictIndex,
      });
      return;
    }
    applyCharacterImport(resultCharacters, pendingCharacterImport.importedCount);
  }

  function saveCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const level = Number(form.level);
    const scores = Object.values(form.abilities).map(Number);
    if (!form.name.trim() || form.name.trim().length > 80) {
      setFormError("Le nom du personnage est obligatoire (80 caractères maximum).");
      return;
    }
    if (!Number.isInteger(level) || level < 1 || level > 20) {
      setFormError("Le niveau doit être compris entre 1 et 20.");
      return;
    }
    if (
      scores.some((score) => !Number.isInteger(score) || score < 1 || score > 30)
    ) {
      setFormError("Chaque caractéristique doit être comprise entre 1 et 30.");
      return;
    }
    const character: Character = {
      ...form,
      name: form.name.trim(),
      level: String(level),
      id: editingId ?? crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    setCharacters((current) =>
      editingId
        ? current.map((item) => (item.id === editingId ? character : item))
        : [character, ...current],
    );
    setShouldPersist(true);
    setSelectedId(character.id);
    setIsFormOpen(false);
    setFormError(null);
  }

  function deleteCharacter(character: Character) {
    if (
      !window.confirm(
        `Supprimer le personnage « ${character.name} » ? Cette action est définitive.`,
      )
    ) {
      return;
    }
    setCharacters((current) =>
      current.filter((item) => item.id !== character.id),
    );
    setShouldPersist(true);
    setSelectedId(null);
  }

  const selectedCharacter = characters.find(
    (character) => character.id === selectedId,
  );
  const currentImportConflict = pendingCharacterImport
    ? pendingCharacterImport.conflicts[
        pendingCharacterImport.conflictIndex
      ]
    : null;
  const existingImportConflict = currentImportConflict
    ? pendingCharacterImport?.resultCharacters.find(
        (character) => character.id === currentImportConflict.id,
      )
    : null;
  const proficiencyBonus = selectedCharacter
    ? Math.ceil(Number(selectedCharacter.level) / 4) + 1
    : 2;

  function exportCharacters(characterToExport?: Character) {
    const charactersToExport = characterToExport
      ? [characterToExport]
      : characters;
    if (!charactersToExport.length) return;

    const blob = new Blob([serializeCharacters(charactersToExport)], {
      type: "application/json",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    const exportName = characterToExport
      ? characterToExport.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase() || "personnage"
      : "personnages";
    downloadLink.download = `le-grimoire-${exportName}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
  }

  if (databaseEnabled && !databaseReady) {
    return (
      <section className="campaigns-page protected-access">
        <div className="protected-access-card">
          <p className="eyebrow section-eyebrow">Synchronisation du compte</p>
          <h1>Chargement de vos personnages…</h1>
          <p role={databaseLoadError ? "alert" : "status"}>
            {databaseLoadError
              ? `La base de données n’a pas pu être chargée : ${databaseLoadError} Vos données locales restent intactes.`
              : "Nous récupérons vos personnages avant d’autoriser les modifications."}
          </p>
          {databaseLoadError ? (
            <button
              className="button button-primary"
              type="button"
              onClick={() => setDatabaseLoadRequest((current) => current + 1)}
            >
              Réessayer
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="campaigns-page characters-page">
      <div className="campaigns-heading">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-line" />
            Votre espace personnel
          </p>
          <h1>Vos <em>personnages.</em></h1>
          <p className="campaigns-intro">
            Créez et retrouvez les fiches de vos héros de D&amp;D 5e (2014).
          </p>
        </div>
        <div className="campaign-data-actions character-data-actions">
          <button
            className="button button-secondary"
            type="button"
            disabled={!characters.length}
            onClick={() => exportCharacters()}
          >
            Exporter tous les personnages
          </button>
          {selectedCharacter ? (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => exportCharacters(selectedCharacter)}
            >
              Exporter ce personnage
            </button>
          ) : null}
          <label className="button button-secondary campaign-import-control">
            Importer JSON
            <input
              className="visually-hidden"
              type="file"
              accept=".json,application/json"
              aria-label="Importer une sauvegarde JSON de personnages"
              onChange={importCharacters}
            />
          </label>
          <button
            className="button button-primary campaign-create"
            type="button"
            onClick={openNewCharacter}
          >
            <span aria-hidden="true">＋</span> Créer un personnage
          </button>
        </div>
      </div>

      {characterImportError ? (
        <p
          className="campaign-import-feedback campaign-import-error"
          role="alert"
        >
          {characterImportError}
        </p>
      ) : null}
      {characterImportSuccess ? (
        <p
          className="campaign-import-feedback campaign-import-success"
          role="status"
        >
          {characterImportSuccess}
        </p>
      ) : null}
      {storageError ? (
        <p className="characters-message characters-error" role="alert">
          {storageError}
        </p>
      ) : null}
      {databaseSaveError ? (
        <p className="characters-message characters-error" role="alert">
          La synchronisation avec la base a échoué : {databaseSaveError}
          {" "}Vos changements restent dans ce navigateur.
          <button
            className="text-link"
            type="button"
            onClick={() => setDatabaseSaveRequest((current) => current + 1)}
          >
            Réessayer
          </button>
        </p>
      ) : null}
      {apiError ? (
        <p className="characters-message characters-error" role="alert">
          Les options de l’encyclopédie n’ont pas pu être chargées : {apiError}
          {" "}Vous pouvez tout de même compléter les champs manuellement.
        </p>
      ) : isLoadingOptions ? (
        <p className="characters-message" role="status">
          Chargement des options de l’encyclopédie…
        </p>
      ) : null}

      {characters.length === 0 ? (
        <div className="characters-empty">
          <span aria-hidden="true">♙</span>
          <h2>Votre aventure commence ici.</h2>
          <p>Créez votre premier personnage et donnez vie à votre héros.</p>
          <button
            className="button button-primary"
            type="button"
            onClick={openNewCharacter}
          >
            Créer un personnage
          </button>
        </div>
      ) : (
        <div className="characters-layout">
          <div className="character-list" aria-label="Vos personnages">
            {characters.map((character) => (
              <button
                type="button"
                key={character.id}
                className={`character-card${selectedId === character.id ? " character-card-active" : ""}`}
                aria-pressed={selectedId === character.id}
                onClick={() => setSelectedId(character.id)}
              >
                {character.portrait ? (
                  <img
                    className="character-card-portrait"
                    src={character.portrait}
                    alt=""
                  />
                ) : (
                  <span className="character-card-mark" aria-hidden="true">♙</span>
                )}
                <span className="character-card-copy">
                  <strong>{character.name}</strong>
                  <small>
                    {[character.race, character.className, `Niv. ${character.level}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <span className="character-card-arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>

          {selectedCharacter ? (
            <article className="character-sheet">
              <header className="character-sheet-header">
                <div className="character-sheet-identity">
                  {selectedCharacter.portrait ? (
                    <img
                      className="character-sheet-portrait"
                      src={selectedCharacter.portrait}
                      alt={`Portrait de ${selectedCharacter.name}`}
                    />
                  ) : null}
                  <div className="character-sheet-identity-copy">
                    <p className="eyebrow section-eyebrow">
                      {selectedCharacter.playerName || "Fiche de personnage"}
                    </p>
                    <h2>{selectedCharacter.name}</h2>
                    <p>
                      {[
                        selectedCharacter.race,
                        selectedCharacter.subrace,
                        selectedCharacter.className,
                        selectedCharacter.subclass,
                        `Niveau ${selectedCharacter.level}`,
                        selectedCharacter.background,
                        selectedCharacter.alignment,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="character-sheet-actions">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => openEditCharacter(selectedCharacter)}
                  >
                    Modifier
                  </button>
                  <button
                    className="button button-danger"
                    type="button"
                    onClick={() => deleteCharacter(selectedCharacter)}
                  >
                    Supprimer
                  </button>
                </div>
              </header>

              <div className="character-combat-stats">
                <div><small>Classe d’armure</small><strong>{selectedCharacter.armorClass || "—"}</strong></div>
                <div><small>Initiative</small><strong>{numericValue(selectedCharacter.initiative) >= 0 ? "+" : ""}{selectedCharacter.initiative || "0"}</strong></div>
                <div><small>Vitesse</small><strong>{selectedCharacter.speed || "—"} m</strong></div>
                <div><small>Points de vie</small><strong>{selectedCharacter.hitPoints || "—"} / {selectedCharacter.maximumHitPoints || "—"}</strong></div>
                <div><small>Bonus de maîtrise</small><strong>+{proficiencyBonus}</strong></div>
                <div><small>Expérience</small><strong>{selectedCharacter.experience || "0"}</strong></div>
              </div>

              <section className="character-sheet-section">
                <h3>Caractéristiques</h3>
                <div className="character-ability-grid">
                  {abilityScores.map(([key, label]) => {
                    const score = numericValue(selectedCharacter.abilities[key]);
                    const modifier = Math.floor((score - 10) / 2);
                    return (
                      <div className="character-ability" key={key}>
                        <small>{label}</small>
                        <strong>{score}</strong>
                        <span>{modifier >= 0 ? "+" : ""}{modifier}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="character-sheet-columns">
                <section className="character-sheet-section">
                  <h3>Maîtrises et compétences</h3>
                  <p><strong>Compétences maîtrisées :</strong> {selectedCharacter.skills.join(", ") || "—"}</p>
                  <p><strong>Autres maîtrises :</strong> {selectedCharacter.proficiencies || "—"}</p>
                </section>
                <section className="character-sheet-section">
                  <h3>Équipement et armes</h3>
                  <p><strong>Équipement :</strong> {[...selectedCharacter.equipment, selectedCharacter.customEquipment].filter(Boolean).join(", ") || "—"}</p>
                  <p><strong>Armes :</strong> {[...selectedCharacter.weapons, selectedCharacter.customWeapons].filter(Boolean).join(", ") || "—"}</p>
                  <p><strong>Objets magiques :</strong> {selectedCharacter.magicItems.join(", ") || "—"}</p>
                  <p><strong>Dés de vie :</strong> {selectedCharacter.hitDice || "—"} · <strong>PV temporaires :</strong> {selectedCharacter.temporaryHitPoints || "0"}</p>
                </section>
                <section className="character-sheet-section">
                  <h3>Sorts</h3>
                  <p>{selectedCharacter.spells.join(", ") || "Aucun sort renseigné."}</p>
                </section>
                <section className="character-sheet-section">
                  <h3>Traits et apparence</h3>
                  <p><strong>Traits :</strong> {selectedCharacter.traits || "—"}</p>
                  <p><strong>Apparence :</strong> {selectedCharacter.appearance || "—"}</p>
                </section>
                <section className="character-sheet-section">
                  <h3>Personnalité</h3>
                  <p><strong>Traits :</strong> {selectedCharacter.personality || "—"}</p>
                  <p><strong>Idéaux :</strong> {selectedCharacter.ideals || "—"}</p>
                  <p><strong>Liens :</strong> {selectedCharacter.bonds || "—"}</p>
                  <p><strong>Défauts :</strong> {selectedCharacter.flaws || "—"}</p>
                </section>
                <section className="character-sheet-section">
                  <h3>Notes</h3>
                  <p>{selectedCharacter.notes || "—"}</p>
                </section>
              </div>
            </article>
          ) : (
            <div className="character-selection-hint">
              <span aria-hidden="true">♙</span>
              <p>Sélectionnez un personnage pour consulter sa fiche.</p>
            </div>
          )}
        </div>
      )}

      {isFormOpen ? (
        <div
          className="campaign-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsFormOpen(false);
          }}
        >
          <section
            className="campaign-modal character-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="character-form-title"
          >
            <div className="campaign-modal-heading">
              <div>
                <p className="eyebrow section-eyebrow">Fiche D&amp;D · Édition 2014</p>
                <h2 id="character-form-title">
                  {editingId ? "Modifier le personnage" : "Créer un personnage"}
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

            <form className="campaign-form character-form" onSubmit={saveCharacter}>
              <fieldset className="character-form-section">
                <legend>Identité et progression</legend>
                <div className="character-portrait-editor">
                  {form.portrait ? (
                    <img
                      className="character-portrait-preview"
                      src={form.portrait}
                      alt="Aperçu du portrait du personnage"
                    />
                  ) : (
                    <div className="character-portrait-placeholder" aria-hidden="true">
                      ♙
                    </div>
                  )}
                  <div className="character-portrait-controls">
                    <label className="form-field">
                      <span>Portrait du personnage</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        aria-label="Choisir le portrait du personnage"
                        onChange={selectPortrait}
                      />
                      <small>JPEG, PNG, WebP ou GIF · 2 Mo maximum.</small>
                    </label>
                    {form.portrait ? (
                      <button
                        className="text-link character-remove-portrait"
                        type="button"
                        onClick={() => updateForm("portrait", "")}
                      >
                        Retirer l’image
                      </button>
                    ) : null}
                    {portraitError ? (
                      <p className="characters-inline-error" role="alert">
                        {portraitError}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="character-form-grid">
                  <Field label="Nom du personnage *" value={form.name} onChange={(value) => updateForm("name", value)} />
                  <Field label="Nom du joueur" value={form.playerName} onChange={(value) => updateForm("playerName", value)} />
                  <OptionSelect label="Race" value={form.race} options={lists.races} onChange={(value) => setForm((current) => ({ ...current, race: value, subrace: "" }))} />
                  <OptionSelect label="Sous-race" value={form.subrace} options={subraces} disabled={!form.race} placeholder="Choisir une sous-race ou saisir du texte…" onChange={(value) => updateForm("subrace", value)} />
                  <OptionSelect label="Classe" value={form.className} options={lists.classes} onChange={(value) => setForm((current) => ({ ...current, className: value, subclass: "" }))} />
                  <OptionSelect label="Sous-classe" value={form.subclass} options={subclasses} disabled={!form.className} placeholder="Choisir une sous-classe ou saisir du texte…" onChange={(value) => updateForm("subclass", value)} />
                  <Field label="Niveau" type="number" min={1} max={20} value={form.level} onChange={(value) => updateForm("level", value)} />
                  <OptionSelect label="Historique" value={form.background} options={lists.backgrounds} onChange={(value) => updateForm("background", value)} />
                  <Field label="Alignement" value={form.alignment} placeholder="Ex. Neutre bon" onChange={(value) => updateForm("alignment", value)} />
                  <Field label="Points d’expérience" type="number" min={0} value={form.experience} onChange={(value) => updateForm("experience", value)} />
                </div>
                {relatedOptionsError ? <p className="characters-inline-error" role="alert">Impossible de charger les sous-choix : {relatedOptionsError}</p> : null}
              </fieldset>

              <fieldset className="character-form-section">
                <legend>Caractéristiques</legend>
                <div className="character-form-grid character-score-grid">
                  {abilityScores.map(([key, label]) => (
                    <Field key={key} label={label} type="number" min={1} max={30} value={form.abilities[key]} onChange={(value) => setForm((current) => ({ ...current, abilities: { ...current.abilities, [key]: value } }))} />
                  ))}
                </div>
              </fieldset>

              <fieldset className="character-form-section">
                <legend>Combat et survie</legend>
                <div className="character-form-grid character-combat-form-grid">
                  <Field label="Classe d’armure" type="number" min={0} value={form.armorClass} onChange={(value) => updateForm("armorClass", value)} />
                  <Field label="Initiative" type="number" value={form.initiative} onChange={(value) => updateForm("initiative", value)} />
                  <Field label="Vitesse (m)" type="number" min={0} value={form.speed} onChange={(value) => updateForm("speed", value)} />
                  <Field label="Points de vie actuels" type="number" min={0} value={form.hitPoints} onChange={(value) => updateForm("hitPoints", value)} />
                  <Field label="Points de vie maximum" type="number" min={0} value={form.maximumHitPoints} onChange={(value) => updateForm("maximumHitPoints", value)} />
                  <Field label="Points de vie temporaires" type="number" min={0} value={form.temporaryHitPoints} onChange={(value) => updateForm("temporaryHitPoints", value)} />
                  <Field label="Dés de vie" value={form.hitDice} onChange={(value) => updateForm("hitDice", value)} />
                </div>
              </fieldset>

              <fieldset className="character-form-section">
                <legend>Compétences, équipement et magie</legend>
                <SearchableOptionPicker label="Compétences maîtrisées" options={skillNames.map((name) => ({ index: name, name }))} selected={form.skills} onChange={(value) => updateForm("skills", value)} placeholder="Rechercher une compétence…" />
                <TextAreaField label="Maîtrises, langues et autres aptitudes" value={form.proficiencies} onChange={(value) => updateForm("proficiencies", value)} placeholder="Armes, armures, outils, langues…" />
                <div className="character-option-picker-grid">
                  <SearchableOptionPicker label="Équipement" options={lists.equipment} selected={form.equipment} onChange={(value) => updateForm("equipment", value)} placeholder="Rechercher un équipement…" />
                    <TextAreaField label="Équipement personnalisé" value={form.customEquipment} onChange={(value) => updateForm("customEquipment", value)} placeholder="Objets non répertoriés, pièces…" />
                  <SearchableOptionPicker label="Armes" options={lists.weapons} selected={form.weapons} onChange={(value) => updateForm("weapons", value)} placeholder="Rechercher une arme…" />
                    <TextAreaField label="Armes personnalisées" value={form.customWeapons} onChange={(value) => updateForm("customWeapons", value)} placeholder="Armes hors encyclopédie…" />
                  <SearchableOptionPicker label="Objets magiques" options={lists.magicItems} selected={form.magicItems} onChange={(value) => updateForm("magicItems", value)} placeholder="Rechercher un objet magique…" />
                  <SearchableOptionPicker label="Sorts" options={lists.spells} selected={form.spells} onChange={(value) => updateForm("spells", value)} placeholder="Rechercher un sort…" />
                </div>
              </fieldset>

              <fieldset className="character-form-section">
                <legend>Description et personnalité</legend>
                <TextAreaField label="Traits et capacités" value={form.traits} onChange={(value) => updateForm("traits", value)} />
                <TextAreaField label="Apparence" value={form.appearance} onChange={(value) => updateForm("appearance", value)} />
                <div className="character-form-grid">
                  <TextAreaField label="Traits de personnalité" value={form.personality} onChange={(value) => updateForm("personality", value)} />
                  <TextAreaField label="Idéaux" value={form.ideals} onChange={(value) => updateForm("ideals", value)} />
                  <TextAreaField label="Liens" value={form.bonds} onChange={(value) => updateForm("bonds", value)} />
                  <TextAreaField label="Défauts" value={form.flaws} onChange={(value) => updateForm("flaws", value)} />
                </div>
                <TextAreaField label="Notes de la fiche" value={form.notes} onChange={(value) => updateForm("notes", value)} />
              </fieldset>

              {formError ? <p className="characters-inline-error" role="alert">{formError}</p> : null}
              <div className="campaign-form-actions">
                <button className="button button-secondary" type="button" onClick={() => setIsFormOpen(false)}>Annuler</button>
                <button className="button button-primary" type="submit">{editingId ? "Enregistrer" : "Créer le personnage"}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {pendingCharacterImport &&
        currentImportConflict &&
        existingImportConflict ? (
          <div
            className="campaign-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setPendingCharacterImport(null);
              }
            }}
          >
            <section
              className="campaign-modal campaign-import-confirmation"
              role="dialog"
              aria-modal="true"
              aria-labelledby="character-import-conflict-title"
              aria-describedby="character-import-conflict-description"
            >
              <div className="campaign-modal-heading">
                <div>
                  <p className="eyebrow section-eyebrow">
                    Conflit {pendingCharacterImport.conflictIndex + 1} sur{" "}
                    {pendingCharacterImport.conflicts.length}
                  </p>
                  <h2 id="character-import-conflict-title">
                    Identifiant déjà utilisé
                  </h2>
                </div>
              </div>
              <p id="character-import-conflict-description">
                Le personnage « {currentImportConflict.name} » du fichier «{" "}
                {pendingCharacterImport.fileName} » partage son identifiant
                avec « {existingImportConflict.name} ». Choisis comment traiter
                ce conflit :
              </p>
              <div className="campaign-form-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  autoFocus
                  onClick={() => setPendingCharacterImport(null)}
                >
                  Annuler l’import
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => resolveCharacterImportConflict("copy")}
                >
                  Importer comme copie
                </button>
                <button
                  className="button button-danger"
                  type="button"
                  onClick={() => resolveCharacterImportConflict("replace")}
                >
                  Remplacer le personnage
                </button>
              </div>
            </section>
          </div>
        ) : null}
    </section>
  );
}
