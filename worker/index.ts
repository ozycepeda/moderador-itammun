/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  accessCookie,
  accessToken,
  pinMatches,
  requestHasAccess,
  safeNextPath,
} from "./access-control";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  ACCESS_MODE?: "protected" | "public";
  ACCESS_PIN?: string;
  ACCESS_SESSION_SECRET?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env | undefined, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const runtimeEnv = env ?? {
      ACCESS_MODE: process.env.ACCESS_MODE as Env["ACCESS_MODE"],
      ACCESS_PIN: process.env.ACCESS_PIN,
      ACCESS_SESSION_SECRET: process.env.ACCESS_SESSION_SECRET,
    };

    if (runtimeEnv.ACCESS_MODE !== "public") {
      const publicPath = url.pathname === "/acceso"
        || url.pathname === "/api/access/login"
        || url.pathname === "/manifest.webmanifest"
        || url.pathname === "/favicon.svg"
        || url.pathname === "/icon-192.png"
        || url.pathname === "/icon-512.png"
        || url.pathname === "/og.png"
        || url.pathname.startsWith("/assets/")
        || url.pathname.startsWith("/_vinext/");

      if (url.pathname === "/api/access/login" && request.method === "POST") {
        if (!runtimeEnv.ACCESS_PIN || !runtimeEnv.ACCESS_SESSION_SECRET) {
          return Response.json({ ok: false, error: "not_configured" }, { status: 503 });
        }
        let body: { pin?: unknown; next?: unknown };
        try {
          body = await request.json() as { pin?: unknown; next?: unknown };
        } catch {
          return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
        }
        const submittedPin = typeof body.pin === "string" ? body.pin : "";
        if (!await pinMatches(submittedPin, runtimeEnv.ACCESS_PIN)) {
          return Response.json({ ok: false, error: "invalid_pin" }, { status: 401 });
        }
        const token = await accessToken(runtimeEnv.ACCESS_SESSION_SECRET);
        const secure = url.protocol === "https:" && url.hostname !== "localhost";
        return Response.json(
          { ok: true, next: safeNextPath(body.next) },
          { headers: { "Set-Cookie": accessCookie(token, secure), "Cache-Control": "no-store" } },
        );
      }

      if (!publicPath) {
        const configured = Boolean(runtimeEnv.ACCESS_PIN && runtimeEnv.ACCESS_SESSION_SECRET);
        const authorized = configured && await requestHasAccess(request, runtimeEnv.ACCESS_SESSION_SECRET!);
        if (!authorized) {
          if (request.method !== "GET" || url.pathname.startsWith("/api/")) {
            return Response.json({ ok: false, error: configured ? "unauthorized" : "not_configured" }, { status: configured ? 401 : 503 });
          }
          const next = safeNextPath(`${url.pathname}${url.search}`);
          return Response.redirect(new URL(`/acceso?next=${encodeURIComponent(next)}`, url), 302);
        }
      }
    }

    if (url.pathname === "/_vinext/image") {
      if (!runtimeEnv.ASSETS || !runtimeEnv.IMAGES) return handler.fetch(request, runtimeEnv, ctx);
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => runtimeEnv.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await runtimeEnv.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, runtimeEnv, ctx);
  },
};

export default worker;
