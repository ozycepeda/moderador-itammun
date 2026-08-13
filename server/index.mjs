import http from "node:http";
import { Pool } from "pg";

const port = Number(process.env.PORT || 8787);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL es obligatoria para iniciar la API compartida.");
}

const pool = new Pool({ connectionString: databaseUrl, max: 10 });

function send(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": process.env.WEB_ORIGIN || "http://localhost:3000",
    "access-control-allow-methods": "GET, PUT, OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("Payload demasiado grande");
  }
  return JSON.parse(body || "{}");
}

async function touchPresence(client, committeeKey, clientId) {
  if (!/^[0-9a-f-]{36}$/i.test(clientId || "")) return;
  await client.query(
    `INSERT INTO moderator.committee_presence (committee_key, client_id, last_seen_at)
     VALUES ($1, $2, now())
     ON CONFLICT (committee_key, client_id)
     DO UPDATE SET last_seen_at = now()`,
    [committeeKey, clientId],
  );
  await client.query(
    `DELETE FROM moderator.committee_presence
     WHERE committee_key = $1 AND last_seen_at < now() - interval '20 seconds'`,
    [committeeKey],
  );
}

async function activeClients(client, committeeKey) {
  const result = await client.query(
    `SELECT count(*)::int AS count FROM moderator.committee_presence
     WHERE committee_key = $1 AND last_seen_at >= now() - interval '20 seconds'`,
    [committeeKey],
  );
  return result.rows[0]?.count ?? 0;
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") return send(response, 204, {});
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  const match = url.pathname.match(/^\/api\/moderator\/committees\/([^/]+)\/state$/);
  if (!match) return send(response, 404, { error: "Ruta no encontrada" });

  const committeeKey = decodeURIComponent(match[1]);
  if (!/^[a-z0-9-]{2,100}$/i.test(committeeKey)) return send(response, 400, { error: "Comité inválido" });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO moderator.committee_session (committee_key)
       VALUES ($1) ON CONFLICT (committee_key) DO NOTHING`,
      [committeeKey],
    );

    if (request.method === "GET") {
      const clientId = url.searchParams.get("clientId");
      await touchPresence(client, committeeKey, clientId);
      const current = await client.query(
        `SELECT state, revision FROM moderator.committee_session WHERE committee_key = $1`,
        [committeeKey],
      );
      const row = current.rows[0];
      await client.query("COMMIT");
      return send(response, 200, {
        state: row.revision === "0" || row.revision === 0 ? null : row.state,
        revision: Number(row.revision),
        activeClients: await activeClients(pool, committeeKey),
      });
    }

    if (request.method === "PUT") {
      const body = await readJson(request);
      if (!body.state || typeof body.state !== "object") throw new Error("Estado inválido");
      await touchPresence(client, committeeKey, body.clientId);
      const updated = await client.query(
        `UPDATE moderator.committee_session
         SET state = $2::jsonb, revision = revision + 1, updated_at = now()
         WHERE committee_key = $1 AND revision = $3
         RETURNING state, revision`,
        [committeeKey, JSON.stringify(body.state), Number(body.baseRevision || 0)],
      );
      if (updated.rowCount === 0) {
        const current = await client.query(
          `SELECT state, revision FROM moderator.committee_session WHERE committee_key = $1`,
          [committeeKey],
        );
        await client.query("ROLLBACK");
        return send(response, 409, {
          state: current.rows[0].state,
          revision: Number(current.rows[0].revision),
          activeClients: await activeClients(pool, committeeKey),
        });
      }
      await client.query("COMMIT");
      return send(response, 200, {
        state: updated.rows[0].state,
        revision: Number(updated.rows[0].revision),
        activeClients: await activeClients(pool, committeeKey),
      });
    }

    await client.query("ROLLBACK");
    return send(response, 405, { error: "Método no permitido" });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return send(response, 400, { error: error instanceof Error ? error.message : "Solicitud inválida" });
  } finally {
    client.release();
  }
});

server.listen(port, () => {
  console.log(`API Moderador ITAMMUN disponible en http://localhost:${port}`);
});

process.on("SIGTERM", async () => {
  await pool.end();
  server.close();
});
