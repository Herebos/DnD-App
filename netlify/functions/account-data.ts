import { getDatabase } from "@netlify/database";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

type Collection = "campaigns" | "characters";
type StoredItem = Record<string, unknown> & { id: string; name: string };

const maxRequestBytes = 5 * 1024 * 1024;

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCollection(value: string | undefined): value is Collection {
  return value === "campaigns" || value === "characters";
}

function validateItems(value: unknown): value is StoredItem[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      item.id.length === 0 ||
      item.id.length > 128 ||
      typeof item.name !== "string" ||
      item.name.length === 0 ||
      item.name.length > 200 ||
      ids.has(item.id)
    ) {
      return false;
    }
    ids.add(item.id);
    return true;
  });
}

export default async function handler(
  request: Request,
  context: Context,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "PUT") {
    return jsonResponse({ error: "Méthode non autorisée." }, 405);
  }

  const collection = context.params.collection;
  if (!isCollection(collection)) {
    return jsonResponse({ error: "Collection inconnue." }, 404);
  }

  let user: Awaited<ReturnType<typeof getUser>>;
  try {
    user = await getUser();
  } catch (error: unknown) {
    console.error("Erreur de vérification du compte Netlify Identity.", error);
    return jsonResponse(
      { error: "L’authentification est momentanément indisponible." },
      503,
    );
  }
  if (!user) {
    return jsonResponse(
      { error: "Connectez-vous pour accéder à vos données." },
      401,
    );
  }

  try {
    const db = getDatabase();
    if (request.method === "GET") {
      const rows = await db.sql<{ items: unknown }>`
        SELECT items
        FROM account_collections
        WHERE account_id = ${user.id} AND collection = ${collection}
        LIMIT 1
      `;
      const storedItems = rows[0]?.items;
      if (storedItems === undefined) {
        return jsonResponse({ items: [], initialized: false });
      }
      if (!validateItems(storedItems)) {
        throw new Error(`Données invalides dans la collection ${collection}.`);
      }
      return jsonResponse({ items: storedItems, initialized: true });
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > maxRequestBytes) {
      return jsonResponse(
        { error: "La sauvegarde dépasse la taille maximale autorisée." },
        413,
      );
    }

    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > maxRequestBytes) {
      return jsonResponse(
        { error: "La sauvegarde dépasse la taille maximale autorisée." },
        413,
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return jsonResponse(
        { error: "Le format JSON de la sauvegarde est invalide." },
        400,
      );
    }
    if (!isRecord(payload) || !validateItems(payload.items)) {
      return jsonResponse(
        { error: "La liste de données est invalide." },
        400,
      );
    }

    await db.sql`
      INSERT INTO account_collections (account_id, collection, items, updated_at)
      VALUES (${user.id}, ${collection}, ${JSON.stringify(payload.items)}::jsonb, NOW())
      ON CONFLICT (account_id, collection)
      DO UPDATE SET items = EXCLUDED.items, updated_at = NOW()
    `;
    return jsonResponse({ saved: true });
  } catch (error: unknown) {
    console.error("Erreur d’accès aux données du compte.", error);
    return jsonResponse(
      { error: "La base de données est momentanément indisponible." },
      500,
    );
  }
}

export const config: Config = {
  path: "/api/data/:collection",
  method: ["GET", "PUT"],
};
