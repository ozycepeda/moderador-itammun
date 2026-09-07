declare module "cloudflare:workers" {
  export const env: { DB?: import("./worker/d1-types").AttendanceDatabase };
}
