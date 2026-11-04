import { FONT_STACK } from "@/lib/idpress/fonts";
import type { ArtLayer, Blend, Doc, TextLayer } from "@/lib/idpress/types";

export type Frame = { x: number; y: number; w: number; h: number };

function esc(value: string) {
  const amp = String.fromCharCode(38);
  return value
    .replaceAll(amp, `${amp}amp;`)
    .replaceAll("<", `${amp}lt;`)
    .replaceAll(">", `${amp}gt;`)
    .replaceAll('"', `${amp}quot;`)
    .replaceAll("'", `${amp}#39;`);
}

function blendAttr(blend: Blend, alpha: number) {
  const mode = blend === "normal" ? "normal" : blend === "knockout" ? "normal" : blend;
  return `opacity="${alpha}" style="mix-blend-mode:${mode}"`;
}

function points(x: number, y: number, w: number, h: number, count: number, spin: number, inset: (index: number) => number) {
  let path = "";
  for (let i = 0; i < count; i++) {
    const a = spin + (i / count) * Math.PI * 2;
    const r = inset(i);
    const px = x + w / 2 + ((Math.cos(a) * w) / 2) * r;
    const py = y + h / 2 + ((Math.sin(a) * h) / 2) * r;
    path += `${i === 0 ? "M" : "L"} ${px} ${py} `;
  }
  return `${path}Z`;
}

function shapePath(layer: ArtLayer) {
  const { x, y, w, h } = layer;
  if (layer.shape === "ellipse") return `M ${x + w / 2} ${y} a ${w / 2} ${h / 2} 0 1 0 0.1 0`;
  if (layer.shape === "triangle") return `M ${x + w / 2} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
  if (layer.shape === "diamond") return `M ${x + w / 2} ${y} L ${x + w} ${y + h / 2} L ${x + w / 2} ${y + h} L ${x} ${y + h / 2} Z`;
  if (layer.shape === "chevron") {
    return `M ${x} ${y} L ${x + w * 0.72} ${y} L ${x + w} ${y + h / 2} L ${x + w * 0.72} ${y + h} L ${x} ${y + h} L ${x + w * 0.28} ${y + h / 2} Z`;
  }
  if (layer.shape === "hex") return points(x, y, w, h, 6, -Math.PI / 2, () => 1);
  if (layer.shape === "star") return points(x, y, w, h, 10, -Math.PI / 2, (index) => (index % 2 === 0 ? 1 : 0.42));
  if (layer.shape === "line") return `M ${x} ${y + h / 2} L ${x + w} ${y + h / 2}`;
  const r = layer.shape === "pill" ? Math.min(w, h) / 2 : Math.min(layer.radius, w / 2, h / 2);
  if (r > 0) {
    return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
  }
  return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
}

function around(x: number, y: number, skewX: number, skewY: number, squish = 1) {
  return `translate(${x} ${y}) scale(${squish} 1) skewX(${skewX}) skewY(${skewY}) translate(${-x} ${-y})`;
}

function textPath(layer: TextLayer, id: string) {
  const route = layer.route === "straight" && layer.curve > 8 ? "arch" : layer.route;
  if (route === "straight" || route === "circle" || route === "wave") return "";
  const bend = route === "arch" && layer.curve > 8 && layer.bend === 0 ? layer.curve : layer.bend;
  const y = route === "archDown" ? layer.y + Math.abs(bend) : layer.y - Math.abs(bend);
  const cx = route === "path" ? layer.x + layer.cx : layer.x + layer.maxW / 2;
  const cy = route === "path" ? layer.y + layer.cy : y;
  return `<path id="${id}" d="M ${layer.x} ${layer.y} Q ${cx} ${cy} ${layer.x + layer.maxW} ${layer.y}" fill="none"/>`;
}

export function renderSvg(doc: Doc, frame: Frame | null = null) {
  const parts: string[] = [];
  const view = frame ?? { x: 0, y: 0, w: doc.w, h: doc.h };
  if (!frame && doc.ground) parts.push(`<rect width="100%" height="100%" fill="${esc(doc.ground)}"/>`);
  const stack = [
    ...doc.art.map((layer) => ({ order: layer.order, kind: "art" as const, layer })),
    ...doc.texts.map((layer) => ({ order: layer.order, kind: "text" as const, layer })),
  ].sort((a, b) => a.order - b.order);
  stack.forEach((item, index) => {
    if (item.layer.hidden) return;
    if (item.kind === "art") {
      const layer = item.layer;
      const skew = around(layer.x + layer.w / 2, layer.y + layer.h / 2, layer.skewX, layer.skewY);
      const look = blendAttr(layer.blend, layer.blend === "knockout" ? 1 : layer.alpha);
      if (layer.kind === "image" && layer.src) {
        parts.push(`<image href="${esc(layer.src)}" x="${layer.x}" y="${layer.y}" width="${layer.w}" height="${layer.h}" ${look} transform="${skew}"/>`);
        return;
      }
      if (layer.shape === "line") {
        parts.push(`<path d="${shapePath(layer)}" fill="none" stroke="${esc(layer.stroke)}" stroke-width="${Math.max(layer.strokeWidth, 1)}" ${look} transform="${skew}"/>`);
        return;
      }
      const fill = layer.fillOn ? esc(layer.fill) : "none";
      const stroke = layer.strokeWidth > 0 ? `stroke="${esc(layer.stroke)}" stroke-width="${layer.strokeWidth}"` : "";
      parts.push(`<path d="${shapePath(layer)}" fill="${fill}" ${stroke} ${look} transform="${skew}"/>`);
      return;
    }
    const layer = item.layer;
    const value = layer.text;
    if (!value) return;
    const family = esc(FONT_STACK[layer.font] ?? FONT_STACK.sans);
    const pathId = `route-${index}`;
    const path = textPath(layer, pathId);
    const look = blendAttr(layer.blend, layer.alpha);
    if (path) {
      parts.push(path);
      parts.push(
        `<text fill="${esc(layer.color)}" font-size="${layer.size}" font-family="${family}" letter-spacing="${layer.tracking}" ${look}><textPath href="#${pathId}">${esc(value)}</textPath></text>`,
      );
      return;
    }
    const anchor = layer.align === "center" ? "middle" : layer.align === "right" ? "end" : "start";
    parts.push(
      `<text x="${layer.x}" y="${layer.y}" fill="${esc(layer.color)}" font-size="${layer.size}" font-family="${family}" text-anchor="${anchor}" dominant-baseline="middle" letter-spacing="${layer.tracking}" ${look} transform="${around(layer.x, layer.y, layer.skewX, layer.skewY, layer.squish)}">${esc(value)}</text>`,
    );
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${view.w}" height="${view.h}" viewBox="${view.x} ${view.y} ${view.w} ${view.h}">\n${parts.join("\n")}\n</svg>\n`;
}
