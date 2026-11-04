import type { ArtLayer, Doc, TextLayer } from "@/lib/idpress/types";

const BAR = "#175896";
const INK = "#ffffff";
const LIGHT = "#1c6bb5";
const DEEP = "#0f3960";

function block(partial: Pick<ArtLayer, "name" | "shape" | "x" | "y" | "w" | "h" | "fill" | "fillOn" | "stroke" | "strokeWidth" | "radius">, order: number): ArtLayer {
  return {
    id: crypto.randomUUID(),
    kind: "block",
    src: null,
    locked: false,
    hidden: false,
    alpha: 1,
    blend: "normal",
    skewX: 0,
    skewY: 0,
    texture: null,
    order,
    ...partial,
  };
}

function line(partial: Pick<TextLayer, "label" | "text" | "x" | "y" | "maxW" | "size" | "color" | "align">, order: number): TextLayer {
  return {
    id: crypto.randomUUID(),
    font: "sans",
    weight: "700",
    curve: 0,
    locked: false,
    hidden: false,
    alpha: 1,
    blend: "normal",
    skewX: 0,
    skewY: 0,
    tracking: 0,
    squish: 1,
    fit: true,
    route: "straight",
    bend: 0,
    depth: 1,
    cx: partial.maxW / 2,
    cy: -48,
    order,
    ...partial,
  };
}

export function signatureKit(): Doc {
  return {
    name: "Signature",
    w: 1493,
    h: 255,
    ground: null,
    art: [
      block({ name: "Name bar", shape: "rect", x: 290, y: 46, w: 1168, h: 62, fill: BAR, fillOn: true, radius: 0, stroke: LIGHT, strokeWidth: 0 }, 1),
      block({ name: "Seal slot", shape: "ellipse", x: 18, y: 28, w: 200, h: 200, fill: "#07090c", fillOn: false, radius: 0, stroke: LIGHT, strokeWidth: 4 }, 2),
    ],
    texts: [
      line({ label: "Name", text: "", x: 340, y: 78, maxW: 820, size: 46, color: INK, align: "left" }, 10),
      line({ label: "Badge", text: "", x: 1240, y: 77, maxW: 230, size: 26, color: LIGHT, align: "left" }, 11),
      line({ label: "Rank", text: "", x: 382, y: 121, maxW: 700, size: 26, color: INK, align: "left" }, 12),
      line({ label: "Serving", text: "", x: 1104, y: 129, maxW: 360, size: 14, color: DEEP, align: "left" }, 13),
      line({ label: "Line one", text: "", x: 340, y: 158, maxW: 1100, size: 20, color: LIGHT, align: "left" }, 14),
      line({ label: "Line two", text: "", x: 340, y: 183, maxW: 1100, size: 20, color: LIGHT, align: "left" }, 15),
      line({ label: "Line three", text: "", x: 340, y: 208, maxW: 1100, size: 20, color: LIGHT, align: "left" }, 16),
      line({ label: "Line four", text: "", x: 340, y: 233, maxW: 1100, size: 20, color: LIGHT, align: "left" }, 17),
    ],
  };
}

export function titleKit(): Doc {
  return {
    name: "Title",
    w: 1493,
    h: 255,
    ground: null,
    art: [
      block({ name: "Name bar", shape: "rect", x: 290, y: 46, w: 1168, h: 62, fill: BAR, fillOn: true, radius: 0, stroke: LIGHT, strokeWidth: 0 }, 1),
      block({ name: "Seal slot", shape: "ellipse", x: 18, y: 28, w: 200, h: 200, fill: "#07090c", fillOn: false, radius: 0, stroke: LIGHT, strokeWidth: 4 }, 2),
    ],
    texts: [
      line({ label: "Main title", text: "", x: 827, y: 82, maxW: 1000, size: 52, color: INK, align: "center" }, 10),
      line({ label: "Sub title", text: "", x: 827, y: 128, maxW: 1000, size: 20, color: LIGHT, align: "center" }, 11),
      line({ label: "Sub-sub title", text: "", x: 827, y: 228, maxW: 1100, size: 33, color: INK, align: "center" }, 12),
    ],
  };
}

export function tapeKit(): Doc {
  return {
    name: "Name tape",
    w: 1400,
    h: 47,
    ground: null,
    art: [block({ name: "Tape", shape: "rect", x: 0, y: 0, w: 1400, h: 47, fill: BAR, fillOn: true, radius: 0, stroke: BAR, strokeWidth: 0 }, 1)],
    texts: [line({ label: "Tape", text: "", x: 30, y: 24, maxW: 1340, size: 32, color: INK, align: "left" }, 2)],
  };
}
