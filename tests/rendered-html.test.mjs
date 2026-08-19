import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/", { env = {}, headers = {} } = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html", ...headers } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, ...env },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the open committee picker", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Moderador · ITAMMUN<\/title>/i);
  assert.match(html, /¿Qué comité vas a moderar\?/);
  assert.match(html, /Acceso abierto/);
  assert.match(html, /aria-label="Español"/);
  assert.match(html, /aria-label="English"/);
  assert.match(html, /ONU Mujeres/);
  assert.match(html, /Consejo de Seguridad/);
  assert.match(html, /Lienzo en blanco/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("links every official committee to a shareable route", async () => {
  const response = await render();
  const html = await response.text();
  const slugs = [
    "onu-mujeres", "acnur", "unicef", "cij", "onudi", "cepa",
    "banco-mundial", "consejo-de-seguridad", "interpol", "otan",
  ];
  for (const slug of slugs) assert.match(html, new RegExp(`href="/comite/${slug}/setup"`));
});

test("renders setup and projector routes", async () => {
  const setup = await render("/comite/onu-mujeres/setup");
  assert.equal(setup.status, 200);
  const setupHtml = await setup.text();
  assert.match(setupHtml, /Marca los cupos asignados al inicio/);
  assert.match(setupHtml, /aria-label="Idioma \/ Language"/);
  assert.doesNotMatch(setupHtml, /Cupo asignado|Disponible/);
  assert.match(setupHtml, /Santa Sede/);
  assert.doesNotMatch(setupHtml, /Tema de la sesión/);

  const consoleResponse = await render("/comite/onu-mujeres");
  assert.equal(consoleResponse.status, 200);
  const consoleHtml = await consoleResponse.text();
  assert.match(consoleHtml, /Pase de lista/);
  assert.match(consoleHtml, /Presente y votando/);
  assert.match(consoleHtml, /Observador/);
  assert.match(consoleHtml, /Llamadas de atención/);
  assert.match(consoleHtml, /Votación final/);
  assert.match(consoleHtml, /Pendiente · defínelo/);
  assert.doesNotMatch(consoleHtml, /Tiempo por orador/);

  const projector = await render("/comite/onu-mujeres/pantalla");
  assert.equal(projector.status, 200);
  assert.match(await projector.text(), /Esperando el inicio del debate/);
});

test("keeps the setup catalog wide and responsive", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.setup-grid\.setup-grid-single\s*\{[^}]*max-width:\s*none/);
  assert.match(css, /\.setup-country-list\s*\{[^}]*repeat\(auto-fit,\s*minmax\(290px,\s*1fr\)\)/);
  assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*\.setup-country-list\s*\{\s*grid-template-columns:\s*1fr/);
});

test("keeps every deployment public", async () => {
  assert.equal((await render()).status, 200);
  assert.equal((await render("/", { env: { MODERATOR_PASSWORD: "ignorada" } })).status, 200);
});
