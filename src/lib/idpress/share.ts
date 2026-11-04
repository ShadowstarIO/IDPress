import { completeDoc } from "@/lib/idpress/starter";
import type { ArchiveItem, ArtLayer, Doc, FileKind, TemplateFile, TextLayer } from "@/lib/idpress/types";

const RASTER = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i;
const HEX = /^#[0-9a-f]{6}$/i;
const SHAPES = new Set(["rect", "ellipse", "line", "triangle", "diamond", "chevron", "star", "hex", "pill"]);
const BLENDS = new Set(["normal", "multiply", "screen", "overlay", "darken", "lighten", "knockout"]);
const FONTS = new Set(["sans", "serif", "condensed", "display", "mono"]);
const ROUTES = new Set(["straight", "arch", "archDown", "wave", "circle", "path"]);
const ALIGNS = new Set(["left", "center", "right"]);
const WEIGHTS = new Set(["400", "600", "700"]);

function text(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/[<>]/g, "").slice(0, max);
}

function num(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function color(value: unknown, fallback: string) {
  return typeof value === "string" && HEX.test(value.trim()) ? value.trim().toLowerCase() : fallback;
}

function raster(value: unknown) {
  if (typeof value !== "string") return null;
  const src = value.replace(/\s/g, "");
  if (src.length > 2_500_000 || !RASTER.test(src)) return null;
  return src;
}

function oneOf<T extends string>(value: unknown, allowed: Set<string>, fallback: T) {
  return typeof value === "string" && allowed.has(value) ? (value as T) : fallback;
}

function cleanArt(value: unknown, index: number): ArtLayer | null {
  if (!value || typeof value !== "object") return null;
  const layer = value as Partial<ArtLayer>;
  return {
    id: text(layer.id, 80) || `art-${index}`,
    name: text(layer.name, 80) || "Layer",
    kind: layer.kind === "image" ? "image" : "block",
    src: raster(layer.src),
    shape: oneOf(layer.shape, SHAPES, "rect"),
    x: num(layer.x, 0, -4000, 8000),
    y: num(layer.y, 0, -4000, 8000),
    w: num(layer.w, 80, 1, 4000),
    h: num(layer.h, 40, 1, 4000),
    fill: color(layer.fill, "#1b4f8a"),
    fillOn: layer.fillOn !== false,
    radius: num(layer.radius, 0, 0, 800),
    stroke: color(layer.stroke, "#d6e4f5"),
    strokeWidth: num(layer.strokeWidth, 0, 0, 80),
    locked: Boolean(layer.locked),
    hidden: Boolean(layer.hidden),
    alpha: num(layer.alpha, 1, 0, 1),
    blend: oneOf(layer.blend, BLENDS, "normal"),
    skewX: num(layer.skewX, 0, -60, 60),
    skewY: num(layer.skewY, 0, -60, 60),
    texture: raster(layer.texture),
    order: num(layer.order, index, -1000, 10000),
  };
}

function cleanText(value: unknown, index: number): TextLayer | null {
  if (!value || typeof value !== "object") return null;
  const layer = value as Partial<TextLayer>;
  return {
    id: text(layer.id, 80) || `text-${index}`,
    label: text(layer.label, 80) || "Line",
    text: text(layer.text, 400),
    x: num(layer.x, 0, -4000, 8000),
    y: num(layer.y, 0, -4000, 8000),
    maxW: num(layer.maxW, 400, 8, 4000),
    size: num(layer.size, 28, 8, 240),
    font: oneOf(layer.font, FONTS, "sans"),
    weight: oneOf(layer.weight, WEIGHTS, "700"),
    color: color(layer.color, "#f7f9fc"),
    align: oneOf(layer.align, ALIGNS, "left"),
    curve: num(layer.curve, 0, 0, 800),
    locked: Boolean(layer.locked),
    hidden: Boolean(layer.hidden),
    alpha: num(layer.alpha, 1, 0, 1),
    blend: oneOf(layer.blend, BLENDS, "normal"),
    skewX: num(layer.skewX, 0, -60, 60),
    skewY: num(layer.skewY, 0, -60, 60),
    tracking: num(layer.tracking, 0, -20, 80),
    squish: num(layer.squish, 1, 0.2, 3),
    fit: layer.fit !== false,
    route: oneOf(layer.route, ROUTES, "straight"),
    bend: num(layer.bend, 0, -800, 800),
    depth: num(layer.depth, 1, 0, 8),
    cx: num(layer.cx, 200, -4000, 4000),
    cy: num(layer.cy, -40, -4000, 4000),
    order: num(layer.order, index, -1000, 10000),
  };
}

export function sanitizeDoc(value: unknown): Doc | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { name?: unknown; w?: unknown; h?: unknown; ground?: unknown; art?: unknown; texts?: unknown };
  if (!Array.isArray(raw.art) || !Array.isArray(raw.texts)) return null;
  if (raw.art.length > 80 || raw.texts.length > 80) return null;
  const ground = raw.ground == null || raw.ground === "" ? null : color(raw.ground, "");
  return completeDoc({
    name: text(raw.name, 80) || "Untitled",
    w: num(raw.w, 1600, 32, 2400),
    h: num(raw.h, 512, 24, 1600),
    ground: ground || null,
    art: raw.art.map(cleanArt).filter((layer): layer is ArtLayer => Boolean(layer)),
    texts: raw.texts.map(cleanText).filter((layer): layer is TextLayer => Boolean(layer)),
  });
}

export function sanitizeArchive(value: unknown): ArchiveItem[] {
  if (!Array.isArray(value)) return [];
  const items: ArchiveItem[] = [];
  for (const [index, item] of value.slice(0, 60).entries()) {
    if (!item || typeof item !== "object") continue;
    const row = item as { id?: unknown; name?: unknown; kind?: unknown; art?: unknown; text?: unknown };
    if (row.kind === "art") {
      const art = cleanArt(row.art, index);
      if (!art) continue;
      items.push({
        id: text(row.id, 80) || `keep-${index}`,
        name: text(row.name, 80) || art.name,
        kind: "art",
        art,
        text: null,
      });
    } else if (row.kind === "text") {
      const kept = cleanText(row.text, index);
      if (!kept) continue;
      items.push({
        id: text(row.id, 80) || `keep-${index}`,
        name: text(row.name, 80) || kept.label,
        kind: "text",
        art: null,
        text: kept,
      });
    }
  }
  return items;
}

export function parseFile(raw: string): { doc: Doc; kind: FileKind } | null {
  try {
    const data = JSON.parse(raw) as { doc?: unknown; kind?: unknown };
    const kind: FileKind = data.kind === "idpress-save" ? "idpress-save" : "idpress-template";
    const doc = sanitizeDoc(data.kind ? data.doc : data);
    if (!doc) return null;
    return { doc, kind };
  } catch {
    return null;
  }
}

export function packFile(doc: Doc, kind: FileKind): TemplateFile {
  return { version: 3, kind, doc };
}

export function encodeTemplate(doc: Doc): string {
  const json = JSON.stringify(packFile(doc, "idpress-template"));
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin);
}

export function decodeTemplate(hash: string): Doc | null {
  try {
    const bin = atob(hash);
    const bytes = Uint8Array.from(bin, (char) => char.charCodeAt(0));
    return parseFile(new TextDecoder().decode(bytes))?.doc ?? null;
  } catch {
    return null;
  }
}
