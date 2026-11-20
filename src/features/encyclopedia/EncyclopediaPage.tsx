import { useEffect, useState } from "react";
import MarkdownContent from "../../components/MarkdownContent";
import { isRecord } from "../../utils/isRecord";

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

export default function EncyclopediaPage() {
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

