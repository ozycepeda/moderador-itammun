import { buildAdminAttendanceCsv } from "./attendance-export";
import {
  exportAttendanceRows,
  getLatestCommitteeTopic,
  getAttendanceSession,
  listAttendanceSessions,
  saveAttendanceSession,
  type AttendanceFilters,
} from "./attendance-store";
import { validateAttendanceClosePayload } from "./attendance-validation";
import type { AttendanceDatabase } from "./d1-types";

const jsonHeaders = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: jsonHeaders });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

function dateFilter(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function filters(url: URL): AttendanceFilters {
  const committeeSlug = url.searchParams.get("committee")?.trim().slice(0, 160) || undefined;
  return { committeeSlug, from: dateFilter(url.searchParams.get("from")), to: dateFilter(url.searchParams.get("to")) };
}

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export async function handleAttendanceApi(request: Request, db: AttendanceDatabase | undefined): Promise<Response | null> {
  const url = new URL(request.url);
  const closeMatch = url.pathname.match(/^\/api\/attendance\/sessions\/([^/]+)\/close$/);
  const topicMatch = url.pathname.match(/^\/api\/attendance\/committees\/([^/]+)\/latest-topic$/);

  if (topicMatch) {
    if (request.method !== "GET") return json({ ok: false, error: "method-not-allowed" }, 405);
    if (!db) return json({ ok: false, error: "database-unavailable" }, 503);
    const committeeSlug = decodePathSegment(topicMatch[1]);
    if (!committeeSlug) return json({ ok: false, error: "invalid-request" }, 400);
    try {
      const topic = await getLatestCommitteeTopic(db, committeeSlug);
      return topic ? json({ ok: true, topic }) : json({ ok: false, error: "not-found" }, 404);
    } catch (error) {
      console.error("Latest committee topic failed", error);
      return json({ ok: false, error: "internal-error" }, 500);
    }
  }

  if (closeMatch) {
    if (request.method !== "POST") return json({ ok: false, error: "method-not-allowed" }, 405);
    if (!sameOrigin(request)) return json({ ok: false, error: "invalid-origin" }, 403);
    if (!db) return json({ ok: false, error: "database-unavailable" }, 503);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalid-request" }, 400);
    }
    const sessionId = decodePathSegment(closeMatch[1]);
    if (!sessionId) return json({ ok: false, error: "invalid-request" }, 400);
    const payload = validateAttendanceClosePayload(body, sessionId);
    if (!payload) return json({ ok: false, error: "invalid-request" }, 400);
    try {
      const result = await saveAttendanceSession(db, payload);
      return result.ok ? json(result) : json(result, 409);
    } catch (error) {
      console.error("Attendance close failed", error);
      return json({ ok: false, error: "internal-error" }, 500);
    }
  }

  if (url.pathname === "/api/admin/attendance") {
    if (request.method !== "GET") return json({ ok: false, error: "method-not-allowed" }, 405);
    if (!db) return json({ ok: false, error: "database-unavailable" }, 503);
    try {
      return json({ ok: true, sessions: await listAttendanceSessions(db, filters(url)) });
    } catch (error) {
      console.error("Attendance list failed", error);
      return json({ ok: false, error: "internal-error" }, 500);
    }
  }

  if (url.pathname === "/api/admin/attendance/export.csv") {
    if (request.method !== "GET") return json({ ok: false, error: "method-not-allowed" }, 405);
    if (!db) return json({ ok: false, error: "database-unavailable" }, 503);
    try {
      const language = url.searchParams.get("lang") === "en" ? "en" : "es";
      const csv = buildAdminAttendanceCsv(await exportAttendanceRows(db, filters(url)), language);
      const stamp = new Date().toISOString().slice(0, 10);
      return new Response(csv, {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="itammun-bitacora-asistencia-${stamp}.csv"`,
        },
      });
    } catch (error) {
      console.error("Attendance export failed", error);
      return json({ ok: false, error: "internal-error" }, 500);
    }
  }

  const detailMatch = url.pathname.match(/^\/api\/admin\/attendance\/([^/]+)$/);
  if (detailMatch) {
    if (request.method !== "GET") return json({ ok: false, error: "method-not-allowed" }, 405);
    if (!db) return json({ ok: false, error: "database-unavailable" }, 503);
    try {
      const sessionId = decodePathSegment(detailMatch[1]);
      if (!sessionId) return json({ ok: false, error: "invalid-request" }, 400);
      const session = await getAttendanceSession(db, sessionId);
      return session ? json({ ok: true, session }) : json({ ok: false, error: "not-found" }, 404);
    } catch (error) {
      console.error("Attendance detail failed", error);
      return json({ ok: false, error: "internal-error" }, 500);
    }
  }

  return null;
}
