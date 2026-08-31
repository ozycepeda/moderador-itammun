export const ACCESS_COOKIE = "itammun_moderator_access";
export const ACCESS_MAX_AGE_SECONDS = 12 * 60 * 60;

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export async function pinMatches(submittedPin: string, configuredPin: string) {
  const [submittedHash, configuredHash] = await Promise.all([digest(submittedPin), digest(configuredPin)]);
  return constantTimeEqual(submittedHash, configuredHash);
}

export async function accessToken(sessionSecret: string) {
  return digest(`itammun-moderator-access-v1:${sessionSecret}`);
}

export function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return valueParts.join("=");
  }
  return "";
}

export async function requestHasAccess(request: Request, sessionSecret: string) {
  const [received, expected] = [readCookie(request, ACCESS_COOKIE), await accessToken(sessionSecret)];
  return constantTimeEqual(received, expected);
}

export function safeNextPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/acceso")) return "/";
  return value;
}

export function accessCookie(token: string, secure: boolean) {
  return `${ACCESS_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ACCESS_MAX_AGE_SECONDS}${secure ? "; Secure" : ""}`;
}
