import { useEffect, useRef, useState, type PointerEvent } from "react";
import { imageSources, loadImage, paint, type HitBox } from "@/lib/idpress/draw";
import type { Doc } from "@/lib/idpress/types";

type Drag =
  | { mode: "move"; id: string; dx: number; dy: number }
  | { mode: "resize"; id: string; x: number; y: number }
  | { mode: "bend"; id: string }
  | { mode: "pan"; sx: number; sy: number; ox: number; oy: number };

export const STAGE_PAD = 480;

export function Stage({
  doc,
  selectedId,
  fillOnly,
  guide,
  frame,
  viewScale,
  pan,
  onSelect,
  onChange,
  onPan,
}: {
  doc: Doc;
  selectedId: string | null;
  fillOnly: boolean;
  guide: string;
  frame: boolean;
  viewScale: number;
  pan: { x: number; y: number };
  onSelect: (id: string | null) => void;
  onChange: (doc: Doc) => void;
  onPan: (next: { x: number; y: number }) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const boxes = useRef<HitBox[]>([]);
  const drag = useRef<Drag | null>(null);
  const space = useRef(false);
  const [images, setImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [fontsReady, setFontsReady] = useState(false);
  const [grab, setGrab] = useState(false);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select")) return;
      space.current = true;
      setGrab(true);
      event.preventDefault();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      space.current = false;
      setGrab(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    let live = true;
    document.fonts.ready.then(() => {
      if (live) setFontsReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    const layers = imageSources(doc);
    Promise.all(
      layers.map(async (layer) => {
        const image = await loadImage(layer.src);
        return [layer.key, image] as const;
      }),
    ).then((pairs) => {
      if (live) setImages(new Map(pairs));
    });
    return () => {
      live = false;
    };
  }, [doc.art]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !fontsReady) return;
    const maxSide = 4096;
    const worldW = doc.w + STAGE_PAD * 2;
    const worldH = doc.h + STAGE_PAD * 2;
    const dpr = Math.min(2, Math.max(1, viewScale), maxSide / Math.max(worldW, worldH));
    canvas.width = Math.max(1, Math.round(worldW * dpr));
    canvas.height = Math.max(1, Math.round(worldH * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, dpr * STAGE_PAD, dpr * STAGE_PAD);
    ctx.clearRect(-STAGE_PAD, -STAGE_PAD, worldW, worldH);
    boxes.current = paint(ctx, doc, { images, guides: !fillOnly, selectedId, guide, frame, unit: 1 / Math.max(viewScale, 0.15) });
    ctx.save();
    ctx.beginPath();
    ctx.rect(-STAGE_PAD, -STAGE_PAD, worldW, worldH);
    ctx.rect(0, 0, doc.w, doc.h);
    ctx.clip("evenodd");
    ctx.strokeStyle = guide;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = Math.max(1, 1 / Math.max(viewScale, 0.15));
    ctx.beginPath();
    const span = worldW + worldH;
    for (let i = -span; i < span; i += 16) {
      ctx.moveTo(i, -STAGE_PAD);
      ctx.lineTo(i + worldH, doc.h + STAGE_PAD);
    }
    ctx.stroke();
    ctx.restore();
  }, [doc, images, fontsReady, fillOnly, selectedId, guide, frame, viewScale]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = ref.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * (doc.w + STAGE_PAD * 2) - STAGE_PAD,
      y: ((event.clientY - rect.top) / rect.height) * (doc.h + STAGE_PAD * 2) - STAGE_PAD,
      scale: rect.width / doc.w,
    };
  }

  function hit(x: number, y: number) {
    const list = boxes.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const box = list[i]!;
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) return box;
    }
    return null;
  }

  return (
    <canvas
      ref={ref}
      className={`block h-full w-full touch-none ${grab ? "cursor-grab" : ""}`}
      aria-label={doc.name}
      onPointerDown={(event) => {
        const canvas = ref.current;
        if (!canvas) return;
        canvas.setPointerCapture(event.pointerId);
        const panMode = event.button === 1 || event.altKey || space.current;
        if (panMode) {
          drag.current = { mode: "pan", sx: event.clientX, sy: event.clientY, ox: pan.x, oy: pan.y };
          return;
        }
        if (fillOnly) return;
        const { x, y, scale } = point(event);
        const locked = (id: string) =>
          doc.art.find((layer) => layer.id === id)?.locked || doc.texts.find((layer) => layer.id === id)?.locked;
        const selectedText = doc.texts.find((layer) => layer.id === selectedId);
        const handle = selectedText && !selectedText.locked ? boxes.current.find((box) => box.id === selectedText.id)?.handle : null;
        if (selectedText && handle && Math.hypot(x - handle.x, y - handle.y) < 12 / scale) {
          drag.current = { mode: "bend", id: selectedText.id };
          return;
        }
        const selected = boxes.current.find((box) => box.id === selectedId && box.kind === "art");
        if (selected && !locked(selected.id)) {
          const handle = 16 / scale;
          const hx = selected.x + selected.w;
          const hy = selected.y + selected.h;
          if (Math.abs(x - hx) < handle && Math.abs(y - hy) < handle) {
            drag.current = { mode: "resize", id: selected.id, x: selected.x, y: selected.y };
            return;
          }
        }
        const box = hit(x, y);
        onSelect(box?.id ?? null);
        if (!box || locked(box.id)) {
          drag.current = { mode: "pan", sx: event.clientX, sy: event.clientY, ox: pan.x, oy: pan.y };
          return;
        }
        const layer = doc.art.find((item) => item.id === box.id) ?? doc.texts.find((item) => item.id === box.id);
        if (!layer) return;
        drag.current = { mode: "move", id: box.id, dx: x - layer.x, dy: y - layer.y };
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current) return;
        if (current.mode === "pan") {
          onPan({ x: current.ox + event.clientX - current.sx, y: current.oy + event.clientY - current.sy });
          return;
        }
        if (fillOnly) return;
        const { x, y } = point(event);
        if (current.mode === "bend") {
          const layer = doc.texts.find((item) => item.id === current.id);
          if (!layer) return;
          if (layer.route === "path") {
            onChange({
              ...doc,
              texts: doc.texts.map((item) =>
                item.id === layer.id ? { ...item, cx: Math.round(x - layer.x), cy: Math.round(y - layer.y) } : item,
              ),
            });
            return;
          }
          if (layer.route === "circle") {
            const bend = Math.max(12, Math.round(Math.hypot(x - layer.x, y - layer.y)));
            onChange({
              ...doc,
              texts: doc.texts.map((item) => (item.id === layer.id ? { ...item, bend, curve: bend } : item)),
            });
            return;
          }
          if (layer.route === "wave") {
            const bend = Math.round(y - layer.y);
            onChange({
              ...doc,
              texts: doc.texts.map((item) => (item.id === layer.id ? { ...item, bend } : item)),
            });
            return;
          }
          const dy = Math.round(y - layer.y);
          const route = dy >= 0 ? "archDown" : "arch";
          const bend = Math.max(0, Math.abs(dy));
          onChange({
            ...doc,
            texts: doc.texts.map((item) => (item.id === layer.id ? { ...item, route, bend, curve: bend } : item)),
          });
          return;
        }
        if (current.mode === "resize") {
          const target = doc.art.find((layer) => layer.id === current.id);
          const min = target?.shape === "line" ? 4 : 24;
          onChange({
            ...doc,
            art: doc.art.map((layer) =>
              layer.id === current.id
                ? { ...layer, w: Math.max(min, x - current.x), h: Math.max(min, y - current.y) }
                : layer,
            ),
          });
          return;
        }
        const nx = Math.round(x - current.dx);
        const ny = Math.round(y - current.dy);
        if (doc.art.some((layer) => layer.id === current.id)) {
          onChange({
            ...doc,
            art: doc.art.map((layer) => (layer.id === current.id ? { ...layer, x: nx, y: ny } : layer)),
          });
        } else {
          onChange({
            ...doc,
            texts: doc.texts.map((layer) => (layer.id === current.id ? { ...layer, x: nx, y: ny } : layer)),
          });
        }
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
    />
  );
}
