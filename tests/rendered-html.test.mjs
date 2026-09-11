import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ACCESS_COOKIE, accessToken } from "../worker/access-control.ts";

const protectedEnv = { ACCESS_MODE: "protected", ACCESS_PIN: "test-password", ACCESS_SESSION_SECRET: "test-session-secret" };
const protectedCookie = `${ACCESS_COOKIE}=${await accessToken(protectedEnv.ACCESS_SESSION_SECRET)}`;

async function render(path = "/", { env = {}, headers = {}, method = "GET", body } = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { method, body, headers: { accept: "text/html", ...headers } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, ...env },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

function renderProtected(path = "/") {
  return render(path, { env: protectedEnv, headers: { cookie: protectedCookie } });
}

test("renders the protected committee picker", async () => {
  const response = await renderProtected();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Moderador · ITAMMUN<\/title>/i);
  assert.match(html, /¿Qué comité vas a moderar\?/);
  assert.match(html, /Acceso protegido/);
  assert.match(html, /aria-label="Español"/);
  assert.match(html, /aria-label="English"/);
  assert.match(html, /ONU Mujeres/);
  assert.match(html, /Consejo de Seguridad/);
  assert.match(html, /Lienzo en blanco/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("links every official committee to a shareable route", async () => {
  const response = await renderProtected();
  const html = await response.text();
  const slugs = [
    "onu-mujeres", "acnur", "unicef", "cij", "onudi", "cepa",
    "banco-mundial", "consejo-de-seguridad", "interpol", "otan",
  ];
  for (const slug of slugs) assert.match(html, new RegExp(`href="/comite/${slug}"`));
});

test("redirects legacy setup and renders staged attendance and projector routes", async () => {
  const setup = await renderProtected("/comite/onu-mujeres/setup");
  assert.equal(setup.status, 307);
  assert.match(setup.headers.get("location") ?? "", /\/comite\/onu-mujeres$/);

  const consoleResponse = await renderProtected("/comite/onu-mujeres");
  assert.equal(consoleResponse.status, 200);
  const consoleHtml = await consoleResponse.text();
  assert.match(consoleHtml, /Registra la asistencia antes de iniciar/);
  assert.match(consoleHtml, /Seleccionar sesión de trabajo/);
  assert.match(consoleHtml, /Presente y votando/);
  assert.match(consoleHtml, /Observador/);
  assert.match(consoleHtml, /Agregar representación disponible del catálogo|No fue posible cargar el catálogo/);
  assert.doesNotMatch(consoleHtml, /Votación final/);
  assert.doesNotMatch(consoleHtml, />Mociones</);
  assert.doesNotMatch(consoleHtml, /Tiempo por orador/);

  const projector = await renderProtected("/comite/onu-mujeres/pantalla");
  assert.equal(projector.status, 200);
  assert.match(await projector.text(), /Esperando el inicio del debate/);
});

test("keeps the setup catalog wide and responsive", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.setup-grid\.setup-grid-single\s*\{[^}]*max-width:\s*none/);
  assert.match(css, /\.setup-country-list\s*\{[^}]*repeat\(auto-fit,\s*minmax\(290px,\s*1fr\)\)/);
  assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*\.setup-country-list\s*\{\s*grid-template-columns:\s*1fr/);
});

test("requires the shared password before committee selection", async () => {
  const blocked = await render("/", { env: protectedEnv });
  assert.equal(blocked.status, 302);
  assert.match(blocked.headers.get("location") ?? "", /\/acceso\?next=/);
  const accessPage = await render("/acceso", { env: protectedEnv });
  assert.equal(accessPage.status, 200);
  assert.match(await accessPage.text(), /Acceso a Moderador/);
  assert.equal((await renderProtected()).status, 200);
  assert.equal((await render("/", { env: { ACCESS_MODE: "public" } })).status, 200);
  const protectedAdminInPublicMode = await render("/admin/asistencia", { env: { ACCESS_MODE: "public", ACCESS_PIN: "test-password", ACCESS_SESSION_SECRET: "test-session-secret" } });
  assert.equal(protectedAdminInPublicMode.status, 302);
});

test("renders the protected centralized attendance panel", async () => {
  const response = await renderProtected("/admin/asistencia");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Asistencia centralizada/);
  assert.match(html, /Sólo lectura/);
  assert.match(html, /Exportar bitácora CSV/);
});

test("allows the public moderator flow to reach attendance storage without exposing admin routes", async () => {
  const response = await render("/api/attendance/sessions/example/close", {
    env: { ACCESS_MODE: "public", ACCESS_PIN: "test-password", ACCESS_SESSION_SECRET: "test-session-secret" },
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: "database-unavailable" });
});
