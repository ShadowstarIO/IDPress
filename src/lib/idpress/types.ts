export type Service = "pd" | "sheriff" | "parks" | "military";
export type Tone = "dark" | "light";
export type Shape = "rect" | "ellipse" | "line" | "triangle" | "diamond" | "chevron" | "star" | "hex" | "pill";
export type Blend = "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "knockout";
export type FontId = "sans" | "serif" | "condensed" | "display" | "mono";
export type TextRoute = "straight" | "arch" | "archDown" | "wave" | "circle" | "path";

export type ArtLayer = {
  id: string;
  name: string;
  kind: "image" | "block";
  src: string | null;
  shape: Shape;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  fillOn: boolean;
  radius: number;
  stroke: string;
  strokeWidth: number;
  locked: boolean;
  hidden: boolean;
  alpha: number;
  blend: Blend;
  skewX: number;
  skewY: number;
  texture: string | null;
  order: number;
};

export type TextLayer = {
  id: string;
  label: string;
  text: string;
  x: number;
  y: number;
  maxW: number;
  size: number;
  font: FontId;
  weight: "400" | "600" | "700";
  color: string;
  align: "left" | "center" | "right";
  curve: number;
  locked: boolean;
  hidden: boolean;
  alpha: number;
  blend: Blend;
  skewX: number;
  skewY: number;
  tracking: number;
  squish: number;
  fit: boolean;
  route: TextRoute;
  bend: number;
  depth: number;
  cx: number;
  cy: number;
  order: number;
};

export type Doc = {
  name: string;
  w: number;
  h: number;
  ground: string | null;
  art: ArtLayer[];
  texts: TextLayer[];
};

export type FileKind = "idpress-template" | "idpress-save";

export type TemplateFile = {
  version: 3;
  kind: FileKind;
  doc: Doc;
};

export type ArchiveItem = {
  id: string;
  name: string;
  kind: "art" | "text";
  art: ArtLayer | null;
  text: TextLayer | null;
};

export function isDoc(value: unknown): value is Doc {
  if (!value || typeof value !== "object") return false;
  const doc = value as Doc;
  return typeof doc.name === "string" && typeof doc.w === "number" && Array.isArray(doc.art) && Array.isArray(doc.texts);
}
