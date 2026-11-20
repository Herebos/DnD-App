import { useEffect, useState, type FormEvent } from "react";
import { isRecord } from "../../utils/isRecord";

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

const INITIATIVE_STORAGE_KEY = "le-grimoire-initiative";

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

export default function ToolsPage() {
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

