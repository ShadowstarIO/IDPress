import { BLEND_OP, FONT_STACK } from "@/lib/idpress/fonts";
import type { ArtLayer, Blend, Doc, FontId, TextLayer, TextRoute } from "@/lib/idpress/types";

export type HitBox = {
  id: string;
  kind: "art" | "text";
  x: number;
  y: number;
  w: number;
  h: number;
  handle?: { x: number; y: number };
  bendFrom?: { x: number; y: number };
  bendTo?: { x: number; y: number };
};

type PaintOpts = {
  images: Map<string, HTMLImageElement>;
  guides: boolean;
  selectedId: string | null;
  guide: string;
  unit?: number;
  frame?: boolean;
};

type Stack =
  | { order: number; kind: "art"; layer: ArtLayer }
  | { order: number; kind: "text"; layer: TextLayer };

export function imageSources(doc: Doc) {
  const list: { key: string; src: string }[] = [];
  for (const layer of doc.art) {
    if (layer.kind === "image" && layer.src) list.push({ key: layer.id, src: layer.src });
    if (layer.texture) list.push({ key: `tex:${layer.id}`, src: layer.texture });
  }
  return list;
}

export function paint(ctx: CanvasRenderingContext2D, doc: Doc, opts: PaintOpts): HitBox[] {
  const boxes: HitBox[] = [];
  ctx.clearRect(0, 0, doc.w, doc.h);
  if (doc.ground) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = doc.ground;
    ctx.fillRect(0, 0, doc.w, doc.h);
    ctx.restore();
  }
  const stack: Stack[] = [
    ...doc.art.map((layer) => ({ order: layer.order, kind: "art" as const, layer })),
    ...doc.texts.map((layer) => ({ order: layer.order, kind: "text" as const, layer })),
  ].sort((a, b) => a.order - b.order);
  for (const item of stack) {
    if (item.layer.hidden) continue;
    if (item.kind === "art") {
      paintArt(ctx, item.layer, opts.images);
      boxes.push({ id: item.layer.id, kind: "art", x: item.layer.x, y: item.layer.y, w: item.layer.w, h: item.layer.h });
    } else {
      const box = paintText(ctx, item.layer, opts.guides);
      if (box) boxes.push(box);
    }
  }
  if (opts.guides && opts.selectedId) {
    const box = boxes.find((item) => item.id === opts.selectedId);
    const art = doc.art.find((layer) => layer.id === opts.selectedId);
    const text = doc.texts.find((layer) => layer.id === opts.selectedId);
    if (box && !art?.locked && !text?.locked) {
      const u = opts.unit ?? 1;
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.strokeStyle = opts.guide;
      ctx.lineWidth = 2 * u;
      ctx.setLineDash([8 * u, 6 * u]);
      ctx.strokeRect(box.x - 4 * u, box.y - 4 * u, box.w + 8 * u, box.h + 8 * u);
      ctx.setLineDash([]);
      if (box.kind === "art") {
        const s = 14 * u;
        ctx.fillStyle = opts.guide;
        ctx.fillRect(box.x + box.w - s / 2, box.y + box.h - s / 2, s, s);
      }
      if (text && box.handle && box.bendFrom && box.bendTo) {
        ctx.lineWidth = 2 * u;
        ctx.strokeStyle = opts.guide;
        ctx.beginPath();
        if (text.route === "circle") {
          ctx.arc(text.x, text.y, Math.hypot(box.handle.x - text.x, box.handle.y - text.y), 0, Math.PI * 2);
        } else if (text.route === "wave") {
          ctx.moveTo(box.bendFrom.x, box.bendFrom.y);
          ctx.lineTo(box.handle.x, box.handle.y);
        } else {
          ctx.moveTo(box.bendFrom.x, box.bendFrom.y);
          ctx.quadraticCurveTo(box.handle.x, box.handle.y, box.bendTo.x, box.bendTo.y);
        }
        ctx.stroke();
        ctx.fillStyle = opts.guide;
        ctx.beginPath();
        ctx.arc(box.handle.x, box.handle.y, 7 * u, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  if (opts.frame) {
    const u = opts.unit ?? 1;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = opts.guide;
    ctx.lineWidth = Math.max(1, u);
    ctx.setLineDash([12 * u, 8 * u]);
    ctx.strokeRect(u, u, Math.max(0, doc.w - u * 2), Math.max(0, doc.h - u * 2));
    ctx.restore();
  }
  return boxes;
}

function fx(ctx: CanvasRenderingContext2D, cx: number, cy: number, skewX: number, skewY: number, alpha: number, blend: Blend) {
  const x = (Math.max(-60, Math.min(60, skewX)) * Math.PI) / 180;
  const y = (Math.max(-60, Math.min(60, skewY)) * Math.PI) / 180;
  ctx.translate(cx, cy);
  ctx.transform(1, Math.tan(y), Math.tan(x), 1, 0, 0);
  ctx.translate(-cx, -cy);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.globalCompositeOperation = BLEND_OP[blend] ?? "source-over";
}

function paintArt(ctx: CanvasRenderingContext2D, layer: ArtLayer, images: Map<string, HTMLImageElement>) {
  ctx.save();
  fx(ctx, layer.x + layer.w / 2, layer.y + layer.h / 2, layer.skewX, layer.skewY, layer.alpha, layer.blend);
  const image = layer.kind === "image" ? (images.get(layer.id) ?? null) : null;
  if (layer.kind === "image" && image) {
    ctx.drawImage(image, layer.x, layer.y, layer.w, layer.h);
    ctx.restore();
    return;
  }
  if (layer.shape === "line") {
    ctx.strokeStyle = layer.stroke;
    ctx.lineWidth = Math.max(layer.strokeWidth, 1);
    ctx.beginPath();
    ctx.moveTo(layer.x, layer.y + layer.h / 2);
    ctx.lineTo(layer.x + layer.w, layer.y + layer.h / 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  trace(ctx, layer);
  if (layer.fillOn) {
    ctx.fillStyle = layer.fill;
    ctx.fill();
  }
  const texture = layer.texture ? images.get(`tex:${layer.id}`) : null;
  if (texture) {
    ctx.save();
    ctx.clip();
    ctx.drawImage(texture, layer.x, layer.y, layer.w, layer.h);
    ctx.restore();
  }
  if (layer.strokeWidth > 0) {
    trace(ctx, layer);
    ctx.strokeStyle = layer.stroke;
    ctx.lineWidth = layer.strokeWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function trace(ctx: CanvasRenderingContext2D, layer: ArtLayer) {
  const { x, y, w, h } = layer;
  ctx.beginPath();
  if (layer.shape === "ellipse") {
    ctx.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
    return;
  }
  if (layer.shape === "pill") {
    round(ctx, x, y, w, h, Math.min(w, h) / 2);
    return;
  }
  if (layer.shape === "triangle") {
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    return;
  }
  if (layer.shape === "diamond") {
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();
    return;
  }
  if (layer.shape === "chevron") {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.72, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w * 0.72, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + w * 0.28, y + h / 2);
    ctx.closePath();
    return;
  }
  if (layer.shape === "hex") {
    poly(ctx, x, y, w, h, 6, -Math.PI / 2);
    return;
  }
  if (layer.shape === "star") {
    star(ctx, x, y, w, h);
    return;
  }
  round(ctx, x, y, w, h, layer.radius);
}

function poly(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sides: number, spin: number) {
  for (let i = 0; i < sides; i++) {
    const a = spin + (i / sides) * Math.PI * 2;
    const px = x + w / 2 + (Math.cos(a) * w) / 2;
    const py = y + h / 2 + (Math.sin(a) * h) / 2;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 === 0 ? 1 : 0.42;
    const px = cx + ((Math.cos(a) * w) / 2) * r;
    const py = cy + ((Math.sin(a) * h) / 2) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function paintText(ctx: CanvasRenderingContext2D, layer: TextLayer, guides: boolean): HitBox | null {
  const ghost = !layer.text;
  const value = layer.text || (guides ? layer.label : "");
  if (!value) return null;
  const family = FONT_STACK[layer.font] ?? FONT_STACK.sans;
  const route = layer.route === "straight" && layer.curve > 8 ? "arch" : layer.route;
  const bend = layer.route === "straight" && layer.curve > 8 ? layer.curve : layer.bend;
  ctx.save();
  fx(ctx, layer.x, layer.y, layer.skewX, layer.skewY, layer.alpha * (ghost ? 0.35 : 1), layer.blend);
  if (route === "circle") {
    const radius = Math.max(12, Math.abs(bend) || 80);
    arcText(ctx, value, layer.x, layer.y, radius, layer.size, layer.color, family, layer.weight, layer.tracking);
    ctx.restore();
    return {
      id: layer.id,
      kind: "text",
      x: layer.x - radius,
      y: layer.y - radius,
      w: radius * 2,
      h: radius * 2,
      handle: { x: layer.x, y: layer.y - radius },
      bendFrom: { x: layer.x, y: layer.y },
      bendTo: { x: layer.x, y: layer.y },
    };
  }
  if (route !== "straight") {
    const box = drawRoute(ctx, layer, value, family, route, bend);
    ctx.restore();
    return box;
  }
  const size = layer.fit ? fitSize(ctx, value, layer.maxW / Math.max(0.2, layer.squish), layer.size, family, layer.weight, layer.tracking) : layer.size;
  const width = measure(ctx, value, size, family, layer.weight, layer.tracking) * layer.squish;
  const left = layer.align === "center" ? layer.x - width / 2 : layer.align === "right" ? layer.x - width : layer.x;
  drawStraight(ctx, value, left, layer.y, size, family, layer.weight, layer.color, layer.tracking, layer.squish);
  ctx.restore();
  return { id: layer.id, kind: "text", x: left, y: layer.y - size / 2, w: Math.max(8, width), h: size };
}

function drawStraight(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  family: string,
  weight: string,
  color: string,
  tracking: number,
  squish: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(squish || 1, 1);
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  let pen = 0;
  for (const char of text) {
    ctx.fillText(char, pen, 0);
    pen += ctx.measureText(char).width + tracking;
  }
  ctx.restore();
}

function drawRoute(ctx: CanvasRenderingContext2D, layer: TextLayer, text: string, family: string, route: TextRoute, bend: number): HitBox {
  let size = layer.size;
  if (layer.fit) {
    ctx.font = `${layer.weight} ${layer.size}px ${family}`;
    const limit = layer.maxW / Math.max(0.2, layer.squish);
    const natural = [...text].reduce((sum, char) => sum + ctx.measureText(char).width + layer.tracking, 0);
    if (natural > limit) size = Math.max(10, (layer.size * limit) / natural);
  }
  ctx.font = `${layer.weight} ${size}px ${family}`;
  const widths = [...text].map((char) => ctx.measureText(char).width + layer.tracking);
  const total = Math.max(1, widths.reduce((sum, width) => sum + width, 0));
  const endX = layer.align === "center" ? total / 2 : layer.maxW;
  const startX = layer.align === "center" ? -total / 2 : layer.align === "right" ? -total : 0;
  const p0 = { x: layer.x + startX, y: layer.y };
  const p2 = { x: layer.x + (layer.align === "left" ? total : endX), y: layer.y };
  const mid = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };
  const amp = bend;
  const cycles = Math.max(1, layer.depth || 1);
  const control =
    route === "path"
      ? { x: layer.x + layer.cx, y: layer.y + layer.cy }
      : route === "archDown"
        ? { x: mid.x, y: mid.y + Math.abs(amp) }
        : route === "wave"
          ? { x: mid.x, y: mid.y }
          : { x: mid.x, y: mid.y - Math.abs(amp) };
  ctx.fillStyle = layer.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let walked = 0;
  [...text].forEach((char, index) => {
    const width = widths[index] ?? size;
    const dist = walked + width / 2;
    const t = Math.max(0, Math.min(1, dist / total));
    const point =
      route === "wave"
        ? { x: p0.x + (p2.x - p0.x) * t, y: p0.y + Math.sin(t * Math.PI * 2 * cycles) * amp }
        : quad(p0, control, p2, t);
    const next =
      route === "wave"
        ? { x: p0.x + (p2.x - p0.x) * Math.min(1, t + 0.02), y: p0.y + Math.sin(Math.min(1, t + 0.02) * Math.PI * 2 * cycles) * amp }
        : quad(p0, control, p2, Math.min(1, t + 0.02));
    const angle = Math.atan2(next.y - point.y, next.x - point.x);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(angle);
    ctx.scale(layer.squish || 1, 1);
    ctx.fillText(char, 0, 0);
    ctx.restore();
    walked += width;
  });
  const top = Math.min(p0.y, p2.y, control.y) - size;
  const bottom = Math.max(p0.y, p2.y, control.y) + size;
  return {
    id: layer.id,
    kind: "text",
    x: Math.min(p0.x, p2.x, control.x) - 8,
    y: top,
    w: Math.max(p2.x, p0.x, control.x) - Math.min(p0.x, p2.x, control.x) + 16,
    h: bottom - top,
    handle: control,
    bendFrom: p0,
    bendTo: p2,
  };
}

function quad(p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, t: number) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function measure(ctx: CanvasRenderingContext2D, text: string, size: number, family: string, weight: string, tracking: number) {
  ctx.font = `${weight} ${size}px ${family}`;
  return [...text].reduce((sum, char) => sum + ctx.measureText(char).width + tracking, 0);
}

function fitSize(ctx: CanvasRenderingContext2D, text: string, max: number, size: number, family: string, weight: string, tracking: number) {
  let next = size;
  while (next > 10 && measure(ctx, text, next, family, weight, tracking) > max) next -= 1;
  return next;
}

function arcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  size: number,
  color: string,
  family: string,
  weight: string,
  tracking: number,
) {
  const chars = [...text];
  if (!chars.length) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const widths = chars.map((char) => ctx.measureText(char).width);
  const gap = size * 0.14 + tracking;
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * (chars.length - 1);
  const span = 2.2;
  const start = -Math.PI / 2 - span / 2;
  const need = total / radius;
  const squeeze = need > span ? span / need : 1;
  let angle = start + (span - Math.min(span, need)) / 2;
  chars.forEach((char, index) => {
    const step = (widths[index]! / radius) * squeeze;
    angle += step / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(char, 0, -radius);
    ctx.restore();
    angle += step / 2 + (gap / radius) * squeeze;
  });
  ctx.restore();
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(Math.max(0, r), w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read that image."));
    image.src = src;
  });
}

async function loadAll(doc: Doc) {
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    imageSources(doc).map(async (item) => {
      images.set(item.key, await loadImage(item.src));
    }),
  );
  return images;
}

export function unionBounds(boxes: HitBox[], pad = 0) {
  if (!boxes.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const box of boxes) {
    x0 = Math.min(x0, box.x);
    y0 = Math.min(y0, box.y);
    x1 = Math.max(x1, box.x + box.w);
    y1 = Math.max(y1, box.y + box.h);
  }
  const x = Math.floor(x0) - pad;
  const y = Math.floor(y0) - pad;
  return { x, y, w: Math.max(1, Math.ceil(x1) - x + pad), h: Math.max(1, Math.ceil(y1) - y + pad) };
}

export async function tightFrame(doc: Doc) {
  const images = await loadAll(doc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  return unionBounds(paint(ctx, doc, { images, guides: false, selectedId: null, guide: "#9bb6d4" }), 1);
}

export async function renderPng(doc: Doc, full = true) {
  const images = await loadAll(doc);
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, doc.w * scale);
  canvas.height = Math.max(1, doc.h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.scale(scale, scale);
  const boxes = paint(ctx, doc, { images, guides: false, selectedId: null, guide: "#9bb6d4" });
  let source = canvas;
  if (!full) {
    const bounds = unionBounds(boxes, 1);
    if (!bounds) return null;
    const cropped = document.createElement("canvas");
    cropped.width = Math.max(1, bounds.w * scale);
    cropped.height = Math.max(1, bounds.h * scale);
    const out = cropped.getContext("2d");
    if (!out) throw new Error("Canvas is unavailable.");
    out.drawImage(canvas, bounds.x * scale, bounds.y * scale, bounds.w * scale, bounds.h * scale, 0, 0, cropped.width, cropped.height);
    source = cropped;
  }
  return new Promise<Blob | null>((resolve, reject) => {
    source.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG failed."))), "image/png");
  });
}

export async function imageFromFile(file: File) {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("Use a PNG, JPEG, or WebP. SVG files are not accepted.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const max = 900;
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    const w = Math.max(1, Math.round(image.width * scale));
    const h = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable.");
    ctx.drawImage(image, 0, 0, w, h);
    return { src: canvas.toDataURL("image/png"), w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function fontFamily(id: FontId) {
  return FONT_STACK[id] ?? FONT_STACK.sans;
}
