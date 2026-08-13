import assert from "node:assert/strict";
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
  assert.match(await setup.text(), /Define el tópico y quiénes participan/);

  const projector = await render("/comite/onu-mujeres/pantalla");
  assert.equal(projector.status, 200);
  assert.match(await projector.text(), /Esperando el inicio del debate/);
});

test("keeps local mode public and supports an optional deployment password", async () => {
  assert.equal((await render()).status, 200);

  const unauthorized = await render("/", { env: { MODERATOR_PASSWORD: "secreto" } });
  assert.equal(unauthorized.status, 401);
  assert.match(unauthorized.headers.get("www-authenticate") ?? "", /^Basic /);

  const authorization = `Basic ${Buffer.from("moderacion:secreto").toString("base64")}`;
  const authorized = await render("/", { env: { MODERATOR_PASSWORD: "secreto" }, headers: { authorization } });
  assert.equal(authorized.status, 200);
});
