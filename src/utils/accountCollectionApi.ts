export type AccountCollection = "campaigns" | "characters";

export type AccountCollectionData<T> = {
  items: T[];
  initialized: boolean;
};

type CollectionParser<T> = (items: unknown[]) => T[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readResponse(response: Response) {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Le serveur a renvoyé une réponse illisible.");
  }
  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : `La requête a échoué (${response.status}).`;
    throw new Error(message);
  }
  return payload;
}

export async function fetchAccountCollection<T>(
  collection: AccountCollection,
  signal: AbortSignal,
  parseItems: CollectionParser<T>,
): Promise<AccountCollectionData<T>> {
  const response = await fetch(`/api/data/${collection}`, {
    credentials: "same-origin",
    signal,
  });
  const payload = await readResponse(response);
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.items) ||
    typeof payload.initialized !== "boolean"
  ) {
    throw new Error("Le serveur a renvoyé des données invalides.");
  }
  return {
    items: parseItems(payload.items),
    initialized: payload.initialized,
  };
}

export async function saveAccountCollection<T>(
  collection: AccountCollection,
  items: T[],
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`/api/data/${collection}`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
    signal,
  });
  await readResponse(response);
}
