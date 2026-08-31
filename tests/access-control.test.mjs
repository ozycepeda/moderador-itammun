import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCESS_COOKIE,
  accessCookie,
  accessToken,
  pinMatches,
  requestHasAccess,
  safeNextPath,
} from "../worker/access-control.ts";

test("validates the shared password and signed access cookie", async () => {
  assert.equal(await pinMatches("correct horse", "correct horse"), true);
  assert.equal(await pinMatches("wrong", "correct horse"), false);
  const token = await accessToken("server-only-secret");
  const request = new Request("https://moderador.itammun.itam.mx/", { headers: { Cookie: `${ACCESS_COOKIE}=${token}` } });
  assert.equal(await requestHasAccess(request, "server-only-secret"), true);
  assert.match(accessCookie(token, true), /HttpOnly; SameSite=Strict/);
  assert.match(accessCookie(token, true), /; Secure$/);
});

test("only accepts local redirect paths after login", () => {
  assert.equal(safeNextPath("/comite/acnur?dia=1"), "/comite/acnur?dia=1");
  assert.equal(safeNextPath("https://example.com"), "/");
  assert.equal(safeNextPath("//example.com"), "/");
  assert.equal(safeNextPath("/acceso?loop=1"), "/");
});
