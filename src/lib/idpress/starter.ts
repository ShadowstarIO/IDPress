import type { ArtLayer, Doc, Shape, TextLayer } from "@/lib/idpress/types";

const BUNDLED_ART = new Set(["bar", "seal", "seal-core"]);
const BUNDLED_TEXT = new Set(["mark", "legend", "name", "badge", "dates", "rank", "line1"]);

const SHAPES = new Set<Shape>(["rect", "ellipse", "line", "triangle", "diamond", "chevron", "star", "hex", "pill"]);

export function blankDoc(): Doc {
  return {
    name: "Untitled",
    w: 1600,
    h: 512,
    ground: null,
    art: [],
    texts: [],
  };
}

function artBase(layer: Partial<ArtLayer>, index: number): ArtLayer {
  const shape = layer.shape && SHAPES.has(layer.shape) ? layer.shape : "rect";
  return {
    id: layer.id || `art-${index}`,
    name: layer.name || "Layer",
    kind: layer.kind === "image" ? "image" : "block",
    src: layer.src ?? null,
    shape,
    x: layer.x ?? 0,
    y: layer.y ?? 0,
    w: layer.w ?? 80,
    h: layer.h ?? 40,
    fill: layer.fill || "#1b4f8a",
    fillOn: layer.fillOn !== false,
    radius: layer.radius ?? 0,
    stroke: layer.stroke || "#d6e4f5",
    strokeWidth: layer.strokeWidth ?? 0,
    locked: Boolean(layer.locked),
    hidden: Boolean(layer.hidden),
    alpha: layer.alpha ?? 1,
    blend: layer.blend ?? "normal",
    skewX: layer.skewX ?? 0,
    skewY: layer.skewY ?? 0,
    texture: layer.texture ?? null,
    order: layer.order ?? index,
  };
}

function textBase(layer: Partial<TextLayer>, index: number): TextLayer {
  const curve = layer.curve ?? 0;
  return {
    id: layer.id || `text-${index}`,
    label: layer.label || "Line",
    text: layer.text ?? "",
    x: layer.x ?? 0,
    y: layer.y ?? 0,
    maxW: layer.maxW ?? 400,
    size: layer.size ?? 28,
    font: layer.font ?? "sans",
    weight: layer.weight ?? "700",
    color: layer.color || "#f7f9fc",
    align: layer.align ?? "left",
    curve,
    locked: Boolean(layer.locked),
    hidden: Boolean(layer.hidden),
    alpha: layer.alpha ?? 1,
    blend: layer.blend ?? "normal",
    skewX: layer.skewX ?? 0,
    skewY: layer.skewY ?? 0,
    tracking: layer.tracking ?? 0,
    squish: layer.squish ?? 1,
    fit: layer.fit !== false,
    route: layer.route ?? (curve > 8 ? "arch" : "straight"),
    bend: layer.bend ?? (curve > 8 ? curve : 0),
    depth: layer.depth ?? 1,
    cx: layer.cx ?? 200,
    cy: layer.cy ?? -40,
    order: layer.order ?? 100 + index,
  };
}

export function completeDoc(raw: Doc): Doc {
  const art = (raw.art ?? []).map((layer, index) => artBase(layer, index));
  const texts = (raw.texts ?? []).map((layer, index) => textBase(layer, index));
  const bundled =
    raw.name === "Police signature" &&
    art.every((layer) => BUNDLED_ART.has(layer.id) && !layer.src) &&
    texts.every((layer) => BUNDLED_TEXT.has(layer.id));
  if (bundled) return blankDoc();
  return {
    name: raw.name || "Untitled",
    w: raw.w || 1600,
    h: raw.h || 512,
    ground: raw.ground ?? null,
    art,
    texts,
  };
}

export function shapeLayer(kind: "rect" | "round" | "oval" | "frame" | "edge" | "triangle" | "diamond" | "chevron" | "star" | "hex" | "pill" | "ring"): ArtLayer {
  const shared = {
    id: crypto.randomUUID(),
    kind: "block" as const,
    src: null,
    x: 72,
    y: 48,
    fill: "#1b4f8a",
    locked: false,
    hidden: false,
    alpha: 1,
    blend: "normal" as const,
    skewX: 0,
    skewY: 0,
    texture: null,
    order: 1,
    radius: 0,
    stroke: "#d6e4f5",
    strokeWidth: 0,
    fillOn: true,
  };
  if (kind === "oval") return { ...shared, name: "Oval", shape: "ellipse", w: 160, h: 160 };
  if (kind === "ring") return { ...shared, name: "Ring", shape: "ellipse", w: 180, h: 180, fillOn: false, strokeWidth: 8 };
  if (kind === "frame") return { ...shared, name: "Frame", shape: "rect", w: 520, h: 160, fillOn: false, strokeWidth: 6 };
  if (kind === "edge") return { ...shared, name: "Edge", shape: "line", w: 640, h: 16, y: 120, fillOn: false, strokeWidth: 6 };
  if (kind === "round") return { ...shared, name: "Rounded", shape: "rect", w: 420, h: 96, radius: 18 };
  if (kind === "pill") return { ...shared, name: "Pill", shape: "pill", w: 280, h: 72 };
  if (kind === "triangle") return { ...shared, name: "Triangle", shape: "triangle", w: 180, h: 160 };
  if (kind === "diamond") return { ...shared, name: "Diamond", shape: "diamond", w: 160, h: 160 };
  if (kind === "chevron") return { ...shared, name: "Chevron", shape: "chevron", w: 220, h: 120 };
  if (kind === "star") return { ...shared, name: "Star", shape: "star", w: 160, h: 160 };
  if (kind === "hex") return { ...shared, name: "Hex", shape: "hex", w: 160, h: 160 };
  return { ...shared, name: "Rectangle", shape: "rect", w: 420, h: 96 };
}

export function textLayer(y: number): TextLayer {
  return textBase(
    {
      id: crypto.randomUUID(),
      label: "Line",
      text: "",
      x: 72,
      y,
      maxW: 900,
      size: 36,
      color: "#f7f9fc",
      order: 50,
    },
    0,
  );
}

export function nextOrder(doc: Doc) {
  return Math.max(0, ...doc.art.map((layer) => layer.order), ...doc.texts.map((layer) => layer.order)) + 1;
}
