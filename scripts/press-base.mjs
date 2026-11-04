const DEFAULT_BASE = "/id";

export function pressBase() {
  const raw = process.env.PRESS_BASE || (process.env.WORKERS_CI === "1" ? DEFAULT_BASE : "");
  const trimmed = raw.replace(/\/+$/, "");
  if (!trimmed || trimmed === "/") return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
