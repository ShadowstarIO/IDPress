import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Copy, Eye, EyeOff, GripVertical, ImagePlus, Lock, Maximize2, Minimize2, Minus, Plus, Redo2, Share2, Trash2, Undo2, Unlock, Upload } from "lucide-react";
import { imageFromFile, renderPng, tightFrame } from "@/lib/idpress/draw";
import { FONT_LABEL } from "@/lib/idpress/fonts";
import { signatureKit, tapeKit, titleKit } from "@/lib/idpress/kits";
import { encodeTemplate, packFile, parseFile, sanitizeArchive, sanitizeDoc } from "@/lib/idpress/share";
import { blankDoc, completeDoc, nextOrder, shapeLayer, textLayer } from "@/lib/idpress/starter";
import type { ArchiveItem, ArtLayer, Blend, Doc, FontId, Service, TextLayer, TextRoute, Tone } from "@/lib/idpress/types";
import { renderSvg } from "@/lib/idpress/svg";
import { Stage, STAGE_PAD } from "@/components/studio/Stage";
import { IdMark } from "@/components/IdMark";

const STORE_KEY = "idpress.v2";

const SERVICES: { id: Service; label: string }[] = [
  { id: "pd", label: "PD" },
  { id: "sheriff", label: "Sheriff" },
  { id: "parks", label: "Parks" },
  { id: "military", label: "Military" },
];
const BLENDS: Blend[] = ["normal", "multiply", "screen", "overlay", "darken", "lighten", "knockout"];
const FONTS: FontId[] = ["sans", "serif", "condensed", "display", "mono"];
const ROUTES: { id: TextRoute; label: string }[] = [
  { id: "straight", label: "Straight" },
  { id: "arch", label: "Arch up" },
  { id: "archDown", label: "Arch down" },
  { id: "wave", label: "Wave" },
  { id: "circle", label: "Circle" },
  { id: "path", label: "Path" },
];

const GUIDE: Record<Service, string> = {
  pd: "#3d7ec8",
  sheriff: "#c4a36a",
  parks: "#3e8f5a",
  military: "#8a9a62",
};

type Saved = { id: string; name: string; doc: Doc };
type Library = { current: Doc; templates: Saved[]; archive: ArchiveItem[]; service: Service; tone: Tone; fillOnly: boolean; canvas: boolean };

function readLibrary(): Library | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Library>;
    const current = sanitizeDoc(data.current);
    if (!current) return null;
    if (current.art.length === 0 && current.texts.length === 0 && current.w === 1600 && current.h === 280) current.h = 512;
    return {
      current,
      templates: Array.isArray(data.templates)
        ? data.templates.flatMap((item) => {
            if (!item || typeof item !== "object") return [];
            const row = item as Partial<Saved>;
            const stored = sanitizeDoc(row.doc);
            if (!stored) return [];
            return [{ id: typeof row.id === "string" ? row.id : crypto.randomUUID(), name: stored.name, doc: stored }];
          })
        : [],
      archive: sanitizeArchive(data.archive),
      service: data.service ?? "pd",
      tone: data.tone ?? "dark",
      fillOnly: Boolean(data.fillOnly),
      canvas: data.canvas !== false,
    };
  } catch {
    return null;
  }
}

function download(filename: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "idpress";
}

function field(label: string, children: ReactNode) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] tracking-[0.14em] text-muted uppercase">{label}</span>
      <span className="block text-sm text-ink">{children}</span>
    </label>
  );
}

function Block({ title, extra, collapse, children }: { title: string; extra?: ReactNode; collapse?: boolean; children: ReactNode }) {
  if (!collapse) {
    return (
      <section className="rounded-[10px] border border-line bg-bg">
        <div className="flex items-center gap-2 border-b border-line px-2 py-1.5">
          <h2 className="min-w-0 flex-1 truncate text-[11px] tracking-[0.18em] text-muted uppercase">{title}</h2>
          {extra}
        </div>
        <div className="grid gap-2 p-2">{children}</div>
      </section>
    );
  }
  return (
    <details open className="group rounded-[10px] border border-line bg-bg">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 text-muted [&::-webkit-details-marker]:hidden [&::marker]:content-none">
        <ChevronDown aria-hidden className="size-3.5 shrink-0 -rotate-90 transition-transform group-open:rotate-0" />
        <h2 className="min-w-0 flex-1 truncate text-[11px] tracking-[0.18em] uppercase">{title}</h2>
        {extra}
      </summary>
      <div className="grid gap-2 border-t border-line p-2">{children}</div>
    </details>
  );
}

function LayerBar({
  name,
  selected,
  hidden,
  locked,
  armed,
  note,
  onSelect,
  onHide,
  onLock,
  onDuplicate,
  onDelete,
}: {
  name: string;
  selected: boolean;
  hidden?: boolean;
  locked: boolean;
  armed?: boolean;
  note?: string;
  onSelect: () => void;
  onHide?: () => void;
  onLock?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className={`flex items-center ${hidden ? "opacity-45" : ""}`}>
      <GripVertical className="ml-1 size-3.5 shrink-0 text-muted" aria-hidden />
      <button type="button" onClick={onSelect} className={`h-8 min-w-0 flex-1 truncate px-1 text-left text-sm ${selected ? "text-accent" : ""}`}>
        {name}
      </button>
      {note ? (
        <span className="mr-1 shrink-0 text-[10px] tracking-wide text-muted uppercase" title={note}>
          Off
        </span>
      ) : null}
      <span className="flex shrink-0 items-center pr-0.5" onPointerDown={(event) => event.stopPropagation()}>
        {onHide ? (
          <button type="button" title={hidden ? "Show" : "Hide"} aria-label={hidden ? `Show ${name}` : `Hide ${name}`} className="inline-flex size-8 items-center justify-center text-muted" onClick={onHide}>
            {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        ) : null}
        {onLock ? (
          <button
            type="button"
            title={locked ? "Unlock" : "Lock"}
            aria-label={locked ? `Unlock ${name}` : `Lock ${name}`}
            aria-pressed={locked}
            className="inline-flex size-8 items-center justify-center"
            onClick={onLock}
          >
            {locked ? <Lock className="size-3.5 text-accent" /> : <Unlock className="size-3.5 text-muted" />}
          </button>
        ) : null}
        {onDuplicate ? (
          <button type="button" title="Duplicate" aria-label={`Duplicate ${name}`} className="inline-flex size-8 items-center justify-center text-muted" onClick={onDuplicate}>
            <Copy className="size-3.5" />
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            title={locked ? "Unlock to delete" : armed ? "Click again to delete" : "Delete"}
            aria-label={armed ? `Delete ${name}` : `Arm delete for ${name}`}
            disabled={locked}
            className={`inline-flex size-8 items-center justify-center disabled:opacity-40 ${armed ? "text-danger" : "text-muted"}`}
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </span>
    </div>
  );
}

function tickStep(scale: number) {
  const raw = 72 / Math.max(scale, 0.0001);
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-6)));
  const n = raw / pow;
  const nice = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10;
  return nice * pow;
}

function RulerBar({ origin, scale, length, vertical }: { origin: number; scale: number; length: number; vertical?: boolean }) {
  const marks: { at: number; label: string }[] = [];
  if (length > 0 && scale > 0) {
    const step = tickStep(scale);
    const first = Math.floor(-origin / scale / step) * step - step;
    const last = (-origin + length) / scale + step;
    for (let value = first; value <= last; value += step) {
      const at = origin + value * scale;
      if (at < -8 || at > length + 8) continue;
      marks.push({ at, label: String(Math.round(value)) });
    }
  }
  return (
    <svg className={vertical ? "h-full w-7" : "h-5 w-full"} aria-hidden>
      {marks.map((mark) =>
        vertical ? (
          <g key={`${mark.label}-${mark.at}`}>
            <line x1={18} y1={mark.at} x2={28} y2={mark.at} stroke="currentColor" strokeWidth={1} />
            <text x={2} y={mark.at - 2} fill="currentColor" fontSize={9}>
              {mark.label}
            </text>
          </g>
        ) : (
          <g key={`${mark.label}-${mark.at}`}>
            <line x1={mark.at} y1={12} x2={mark.at} y2={20} stroke="currentColor" strokeWidth={1} />
            <text x={mark.at + 3} y={11} fill="currentColor" fontSize={9}>
              {mark.label}
            </text>
          </g>
        ),
      )}
    </svg>
  );
}

export function Studio() {
  const [doc, setDoc] = useState<Doc>(() => blankDoc());
  const [templates, setTemplates] = useState<Saved[]>([]);
  const [archive, setArchive] = useState<ArchiveItem[]>([]);
  const [service, setService] = useState<Service>("pd");
  const [tone, setTone] = useState<Tone>("dark");
  const [fillOnly, setFillOnly] = useState(false);
  const [canvasOn, setCanvasOn] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const [menu, setMenu] = useState<"kits" | "export" | "archive" | "view" | null>(null);
  const [secure, setSecure] = useState(false);
  const [status, setStatus] = useState("Arrow keys nudge the selected layer. Shift moves ten. Scroll to zoom in.");
  const [share, setShare] = useState("");
  const [view, setView] = useState({ w: 1, h: 1 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [full, setFull] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const artRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const docRef = useRef(doc);
  const viewSize = useRef(view);
  const pastRef = useRef<Doc[]>([]);
  const futureRef = useRef<Doc[]>([]);
  const snapped = useRef(false);
  const snapTimer = useRef(0);
  const armTimer = useRef(0);
  const [historyTick, setHistoryTick] = useState(0);
  const [armed, setArmed] = useState<string | null>(null);
  zoomRef.current = zoom;
  panRef.current = pan;
  docRef.current = doc;
  viewSize.current = view;

  function edit(update: Doc | ((prev: Doc) => Doc)) {
    setDoc((prev) => {
      const next = typeof update === "function" ? update(prev) : update;
      if (next === prev) return prev;
      if (!snapped.current) {
        pastRef.current.push(structuredClone(prev));
        if (pastRef.current.length > 40) pastRef.current.shift();
        futureRef.current = [];
        snapped.current = true;
      }
      return next;
    });
    window.clearTimeout(snapTimer.current);
    snapTimer.current = window.setTimeout(() => {
      snapped.current = false;
      setHistoryTick((tick) => tick + 1);
    }, 350);
    setHistoryTick((tick) => tick + 1);
  }

  function undo() {
    setDoc((prev) => {
      const snap = pastRef.current.pop();
      if (!snap) return prev;
      futureRef.current.push(structuredClone(prev));
      return snap;
    });
    snapped.current = false;
    setHistoryTick((tick) => tick + 1);
  }

  function redo() {
    setDoc((prev) => {
      const snap = futureRef.current.pop();
      if (!snap) return prev;
      pastRef.current.push(structuredClone(prev));
      return snap;
    });
    snapped.current = false;
    setHistoryTick((tick) => tick + 1);
  }

  function askDelete(id: string, locked: boolean) {
    if (locked) return;
    if (armed === id) {
      window.clearTimeout(armTimer.current);
      setArmed(null);
      edit((prev) => ({
        ...prev,
        art: prev.art.filter((layer) => layer.id !== id),
        texts: prev.texts.filter((layer) => layer.id !== id),
      }));
      setSelectedId((current) => (current === id ? null : current));
      return;
    }
    setArmed(id);
    window.clearTimeout(armTimer.current);
    armTimer.current = window.setTimeout(() => setArmed((current) => (current === id ? null : current)), 2500);
  }

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setView({ w: rect.width, h: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onDown = (event: MouseEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setMenu(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menu]);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(zoomRef.current * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event.clientX - rect.left, event.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (fillOnly || !selectedId) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select")) return;
      const step = event.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (event.key === "ArrowLeft") dx = -step;
      else if (event.key === "ArrowRight") dx = step;
      else if (event.key === "ArrowUp") dy = -step;
      else if (event.key === "ArrowDown") dy = step;
      else return;
      event.preventDefault();
      edit((prev) => {
        const art = prev.art.find((layer) => layer.id === selectedId);
        if (art) {
          if (art.locked || art.hidden) return prev;
          return { ...prev, art: prev.art.map((layer) => (layer.id === selectedId ? { ...layer, x: layer.x + dx, y: layer.y + dy } : layer)) };
        }
        const text = prev.texts.find((layer) => layer.id === selectedId);
        if (!text || text.locked || text.hidden) return prev;
        return { ...prev, texts: prev.texts.map((layer) => (layer.id === selectedId ? { ...layer, x: layer.x + dx, y: layer.y + dy } : layer)) };
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fillOnly, selectedId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      if (key === "y" || event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const stored = readLibrary();
    if (stored) {
      setDoc(stored.current);
      pastRef.current = [];
      futureRef.current = [];
      setTemplates(stored.templates);
      setArchive(stored.archive);
      setService(stored.service);
      setTone(stored.tone);
      setFillOnly(stored.fillOnly);
      setCanvasOn(stored.canvas);
    }
    setBooted(true);
  }, []);

  useEffect(() => {
    if (!booted) return;
    const payload: Library = { current: doc, templates, archive, service, tone, fillOnly, canvas: canvasOn };
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(payload));
    } catch {
      setStatus("This design is too heavy to keep in the browser. Download the template file before you leave.");
    }
  }, [doc, templates, archive, service, tone, fillOnly, canvasOn, booted]);

  function patchArt(id: string, next: Partial<ArtLayer>) {
    edit((prev) => ({ ...prev, art: prev.art.map((layer) => (layer.id === id ? { ...layer, ...next } : layer)) }));
  }

  function patchText(id: string, next: Partial<TextLayer>) {
    edit((prev) => ({ ...prev, texts: prev.texts.map((layer) => (layer.id === id ? { ...layer, ...next } : layer)) }));
  }

  function place(kind: "rect" | "round" | "oval" | "frame" | "edge" | "triangle" | "diamond" | "chevron" | "star" | "hex" | "pill" | "ring") {
    const layer = { ...shapeLayer(kind), order: nextOrder(doc) };
    edit((prev) => ({ ...prev, art: [...prev.art, layer] }));
    setSelectedId(layer.id);
  }

  function applyKit(kit: Doc) {
    const empty = doc.art.length === 0 && doc.texts.length === 0;
    if (empty) {
      edit(kit);
      setStatus(`${kit.name} placed. Upload a seal over the ring, then lock what should not move.`);
      setSelectedId(kit.texts[0]?.id ?? null);
    } else {
      let order = nextOrder(doc);
      const art = kit.art.map((layer) => ({ ...layer, id: crypto.randomUUID(), order: order++ }));
      const texts = kit.texts.map((layer) => ({ ...layer, id: crypto.randomUUID(), order: order++ }));
      edit({
        ...doc,
        art: [...doc.art, ...art],
        texts: [...doc.texts, ...texts],
      });
      setStatus(`${kit.name} added on this plate. Size stays ${doc.w}×${doc.h}.`);
      setSelectedId(texts[0]?.id ?? null);
    }
    fitView();
  }

  async function addImage(file: File) {
    const image = await imageFromFile(file);
    const layer: ArtLayer = {
      id: crypto.randomUUID(),
      name: file.name.replace(/\.[^.]+$/, "") || "Image",
      kind: "image",
      src: image.src,
      shape: "rect",
      x: 40,
      y: 40,
      w: Math.min(image.w, doc.w * 0.4),
      h: Math.min(image.h, doc.h * 0.8),
      fill: "#ffffff",
      fillOn: false,
      radius: 0,
      stroke: "#d6e4f5",
      strokeWidth: 0,
      locked: false,
      hidden: false,
      alpha: 1,
      blend: "normal",
      skewX: 0,
      skewY: 0,
      texture: null,
      order: nextOrder(doc),
    };
    edit((prev) => ({ ...prev, art: [...prev.art, layer] }));
    setSelectedId(layer.id);
    setStatus("Image is on the plate. Drag it, or pull the corner to resize.");
  }

  function addText() {
    const layer = { ...textLayer(Math.round(doc.h / 2)), order: nextOrder(doc) };
    edit((prev) => ({ ...prev, texts: [...prev.texts, layer] }));
    setSelectedId(layer.id);
  }

  function reorder(kind: "art" | "text", draggedId: string, targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    edit((prev) => {
      const list = kind === "art" ? prev.art : prev.texts;
      const visual = [...list].sort((a, b) => b.order - a.order);
      const from = visual.findIndex((layer) => layer.id === draggedId);
      const to = visual.findIndex((layer) => layer.id === targetId);
      if (from < 0 || to < 0) return prev;
      const [moved] = visual.splice(from, 1);
      if (!moved) return prev;
      visual.splice(to, 0, moved);
      const orders = [...visual].map((layer) => layer.order).sort((a, b) => b - a);
      const next = new Map(visual.map((layer, index) => [layer.id, orders[index] ?? layer.order]));
      if (kind === "art") return { ...prev, art: prev.art.map((layer) => ({ ...layer, order: next.get(layer.id) ?? layer.order })) };
      return { ...prev, texts: prev.texts.map((layer) => ({ ...layer, order: next.get(layer.id) ?? layer.order })) };
    });
  }

  function duplicate(kind: "art" | "text", id: string) {
    const copyId = crypto.randomUUID();
    edit((prev) => {
      if (kind === "art") {
        const layer = prev.art.find((item) => item.id === id);
        if (!layer) return prev;
        return { ...prev, art: [...prev.art, { ...structuredClone(layer), id: copyId, name: `${layer.name} copy`, x: layer.x + 16, y: layer.y + 16, order: nextOrder(prev) }] };
      }
      const layer = prev.texts.find((item) => item.id === id);
      if (!layer) return prev;
      return { ...prev, texts: [...prev.texts, { ...structuredClone(layer), id: copyId, label: `${layer.label} copy`, x: layer.x + 16, y: layer.y + 16, order: nextOrder(prev) }] };
    });
    setSelectedId(copyId);
  }

  function handed(source: Doc) {
    if (!secure) return source;
    return {
      ...source,
      art: source.art.map((layer) => ({ ...layer, locked: true })),
      texts: source.texts.map((layer) => ({ ...layer, locked: true })),
    };
  }

  function exportJson(kind: "idpress-template" | "idpress-save") {
    const fileDoc = handed(doc);
    const name = doc.name.trim() || "Untitled";
    if (kind === "idpress-template") {
      const stored: Saved = { id: crypto.randomUUID(), name, doc: structuredClone(fileDoc) };
      setTemplates((prev) => [stored, ...prev.filter((item) => item.name !== name)]);
    }
    const blob = new Blob([JSON.stringify(packFile(fileDoc, kind), null, 2)], { type: "application/json" });
    const ext = kind === "idpress-save" ? "idpress" : "idpress.json";
    download(`${slug(name)}.${ext}`, URL.createObjectURL(blob));
    setMenu(null);
    setStatus(secure ? "Exported with layers locked. Recipients can still unlock one." : "Exported. Nothing on an empty plate is written as a background.");
  }

  async function copyLink() {
    const fileDoc = handed(doc);
    if (fileDoc.art.some((layer) => layer.src || layer.texture)) {
      setStatus("Images are too large for a link. Export a save file instead.");
      return;
    }
    const hash = encodeTemplate(fileDoc);
    if (hash.length > 12000) {
      setStatus("This plate is too large for a link. Export a save file.");
      return;
    }
    const url = `${location.href.split("#")[0]}#${hash}`;
    setShare(url);
    try {
      await navigator.clipboard.writeText(url);
      setStatus(secure ? "Link copied. Layers start locked. Words stay editable, and a layer can be unlocked." : "Link copied.");
    } catch {
      setStatus("Copy the link below. The browser blocked the clipboard.");
    }
  }

  function loadDoc(next: Doc) {
    const loaded = completeDoc(next);
    edit(structuredClone(loaded));
    setFillOnly(false);
    setSelectedId(loaded.texts[0]?.id ?? loaded.art[0]?.id ?? null);
    setShare("");
    setMenu(null);
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });
    const locked = [...loaded.art, ...loaded.texts].some((layer) => layer.locked);
    setStatus(locked ? `Opened ${loaded.name}. Locked layers stay put until you unlock them. Words can still change.` : `Opened ${loaded.name}.`);
  }

  async function onImport(file: File) {
    const parsed = parseFile(await file.text());
    if (!parsed) throw new Error("bad");
    loadDoc(parsed.doc);
  }

  async function exportPng() {
    const blob = await renderPng(handed(doc), canvasOn);
    if (!blob) {
      setStatus("Nothing on the plate to export.");
      return;
    }
    download(`${slug(doc.name)}.png`, URL.createObjectURL(blob));
    setMenu(null);
    setStatus(canvasOn ? (doc.ground ? "PNG saved. Full canvas, with the plate fill." : "PNG saved. Full canvas. Empty space stays clear.") : "PNG saved tight to the pieces.");
  }

  async function exportSvg() {
    const frame = canvasOn ? null : await tightFrame(handed(doc));
    if (!canvasOn && !frame) {
      setStatus("Nothing on the plate to export.");
      return;
    }
    const svg = renderSvg(handed(doc), frame);
    download(`${slug(doc.name)}.svg`, URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })));
    const punched = [...doc.art, ...doc.texts].some((layer) => layer.blend === "knockout");
    setMenu(null);
    setStatus(
      punched
        ? "SVG saved. Knockout punches through in PNG. SVG keeps the other blends."
        : canvasOn
          ? doc.ground
            ? "SVG saved. Full canvas, with the plate fill."
            : "SVG saved. Full canvas. Empty space stays clear."
          : "SVG saved tight to the pieces.",
    );
  }

  function keepLayer(kind: "art" | "text", id: string) {
    if (kind === "art") {
      const layer = doc.art.find((item) => item.id === id);
      if (!layer) return;
      setArchive((prev) => [{ id: crypto.randomUUID(), name: layer.name, kind: "art", art: structuredClone(layer), text: null }, ...prev]);
    } else {
      const layer = doc.texts.find((item) => item.id === id);
      if (!layer) return;
      setArchive((prev) => [{ id: crypto.randomUUID(), name: layer.label, kind: "text", art: null, text: structuredClone(layer) }, ...prev]);
    }
    setStatus("Saved to the archive. Open Archive at the top to place it again.");
  }

  function placeArchived(item: ArchiveItem) {
    const order = nextOrder(doc);
    if (item.kind === "art" && item.art) {
      const layer = { ...structuredClone(item.art), id: crypto.randomUUID(), order };
      edit({ ...doc, art: [...doc.art, layer] });
      setSelectedId(layer.id);
    }
    if (item.kind === "text" && item.text) {
      const layer = { ...structuredClone(item.text), id: crypto.randomUUID(), order };
      edit({ ...doc, texts: [...doc.texts, layer] });
      setSelectedId(layer.id);
    }
    setMenu(null);
  }

  const inputClass = "h-8 w-full rounded-md border border-line bg-bg px-2 text-sm text-ink outline-none";
  const fit = view.w > 1 && view.h > 1 ? Math.min(view.w / doc.w, view.h / doc.h) * 0.94 : 0.5;
  const viewScale = fit * zoom;
  const plateLeft = (view.w - doc.w * viewScale) / 2 + pan.x;
  const plateTop = (view.h - doc.h * viewScale) / 2 + pan.y;

  function zoomAt(next: number, cx: number, cy: number) {
    const plate = docRef.current;
    const size = viewSize.current;
    const fitted = size.w > 1 && size.h > 1 ? Math.min(size.w / plate.w, size.h / plate.h) * 0.94 : 0.5;
    const current = zoomRef.current;
    const clamped = Math.min(16, Math.max(0.5, next));
    const oldScale = fitted * current;
    const newScale = fitted * clamped;
    const p = panRef.current;
    if (oldScale <= 0) {
      zoomRef.current = clamped;
      setZoom(clamped);
      return;
    }
    const baseX = (size.w - plate.w * oldScale) / 2;
    const baseY = (size.h - plate.h * oldScale) / 2;
    const wx = (cx - (baseX + p.x)) / oldScale;
    const wy = (cy - (baseY + p.y)) / oldScale;
    const nextPan = {
      x: cx - (size.w - plate.w * newScale) / 2 - wx * newScale,
      y: cy - (size.h - plate.h * newScale) / 2 - wy * newScale,
    };
    panRef.current = nextPan;
    zoomRef.current = clamped;
    setPan(nextPan);
    setZoom(clamped);
  }

  function moveView(next: { x: number; y: number }) {
    panRef.current = next;
    setPan(next);
  }

  function fitView() {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      setStatus("Full screen is blocked in this browser.");
    }
  }

  return (
    <div ref={rootRef} className="studio flex min-h-dvh flex-col overflow-x-hidden bg-bg text-ink lg:h-dvh lg:overflow-hidden" data-service={service} data-tone={tone}>
      <header ref={barRef} className="relative z-40 shrink-0 border-b border-line bg-bg">
        <div className="flex h-12 items-center gap-3 border-b border-line px-3">
          <IdMark />
          <div className="min-w-0">
            <h1 className="truncate font-serif text-base leading-tight">ID Press</h1>
            <p className="hidden text-[10px] tracking-[0.18em] text-muted uppercase sm:block">Signature studio</p>
          </div>
          <a href="https://press.shadowstar.io/merit" className="ml-auto text-sm text-muted">
            Merit
          </a>
        </div>
        <div className="flex h-11 items-center gap-1 overflow-x-auto px-2">
          <button type="button" title="Undo" aria-label="Undo" disabled={historyTick < 0 || pastRef.current.length === 0} className="grid size-8 place-items-center rounded-md text-ink disabled:opacity-40" onClick={undo}>
            <Undo2 className="size-3.5" />
          </button>
          <button type="button" title="Redo" aria-label="Redo" disabled={historyTick < 0 || futureRef.current.length === 0} className="grid size-8 place-items-center rounded-md text-ink disabled:opacity-40" onClick={redo}>
            <Redo2 className="size-3.5" />
          </button>
          <div className="flex shrink-0 items-center rounded-md border border-line">
            <button type="button" aria-label="Zoom out" className="grid size-8 place-items-center text-ink" onClick={() => zoomAt(zoom / 1.15, view.w / 2, view.h / 2)}>
              <Minus className="size-3.5" />
            </button>
            <label className="flex h-8 items-center" title="Scale. 100% fits the plate.">
              <input
                aria-label="Scale percent"
                className="w-12 bg-transparent text-center font-mono text-xs text-ink outline-none"
                type="number"
                min={50}
                max={1600}
                value={Math.round(zoom * 100)}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!next) return;
                  zoomAt(next / 100, view.w / 2, view.h / 2);
                }}
              />
            </label>
            <button type="button" aria-label="Zoom in" className="grid size-8 place-items-center text-ink" onClick={() => zoomAt(zoom * 1.15, view.w / 2, view.h / 2)}>
              <Plus className="size-3.5" />
            </button>
          </div>
          <button type="button" className="inline-flex h-8 items-center rounded-md px-2 text-xs text-muted" onClick={fitView}>
            Fit
          </button>
          <button
            type="button"
            title={canvasOn ? "Canvas on. Export is the whole plate. Stripes sit off the plate and are left out." : "Canvas off. Export hugs the pieces, including anything striped off the plate."}
            className={`inline-flex h-8 items-center rounded-md px-2 text-xs ${canvasOn ? "text-ink" : "text-muted"}`}
            onClick={() => setCanvasOn((on) => !on)}
          >
            {canvasOn ? "Canvas" : "Tight"}
          </button>
          <button type="button" aria-label={full ? "Exit full screen" : "Full screen"} className="grid size-8 place-items-center rounded-md text-muted" onClick={toggleFull}>
            {full ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
          <label className="flex h-8 items-center gap-2 rounded-md border border-line px-2" title="Name of this plate">
            <span className="text-[10px] tracking-[0.14em] text-muted uppercase">Name</span>
            <input aria-label="Plate name" className="w-28 bg-transparent text-sm outline-none" value={doc.name} onChange={(event) => edit({ ...doc, name: event.target.value })} />
          </label>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button type="button" className={`inline-flex h-8 items-center rounded-md px-2.5 text-xs ${menu === "kits" ? "bg-panel text-ink" : "text-muted"}`} onClick={() => setMenu((open) => (open === "kits" ? null : "kits"))}>Kits</button>
            <button type="button" className={`inline-flex h-8 items-center rounded-md px-2.5 text-xs ${menu === "export" ? "bg-panel text-ink" : "text-muted"}`} onClick={() => setMenu((open) => (open === "export" ? null : "export"))}>Export</button>
            <button type="button" className={`inline-flex h-8 items-center rounded-md px-2.5 text-xs ${menu === "archive" ? "bg-panel text-ink" : "text-muted"}`} onClick={() => setMenu((open) => (open === "archive" ? null : "archive"))}>Archive</button>
            <button type="button" className={`inline-flex h-8 items-center rounded-md px-2.5 text-xs ${menu === "view" ? "bg-panel text-ink" : "text-muted"}`} onClick={() => setMenu((open) => (open === "view" ? null : "view"))}>View</button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.idpress,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              onImport(file).catch(() => setStatus("That file is not an ID Press template or save."));
            }}
          />
        </div>
        {menu ? (
          <div className="absolute right-2 top-full z-50 mt-1 max-h-[min(70vh,36rem)] w-[min(18rem,calc(100vw-1rem))] overflow-y-auto rounded-md border border-line bg-panel p-2 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
            {menu === "kits" ? (
              <div className="grid gap-1">
                <button type="button" className="h-8 rounded-md px-2 text-left text-sm text-muted hover:bg-bg hover:text-ink" onClick={() => { applyKit(signatureKit()); setMenu(null); }}>Signature</button>
                <button type="button" className="h-8 rounded-md px-2 text-left text-sm text-muted hover:bg-bg hover:text-ink" onClick={() => { applyKit(titleKit()); setMenu(null); }}>Title card</button>
                <button type="button" className="h-8 rounded-md px-2 text-left text-sm text-muted hover:bg-bg hover:text-ink" onClick={() => { applyKit(tapeKit()); setMenu(null); }}>Name tape</button>
                <button type="button" className="h-8 rounded-md px-2 text-left text-sm text-muted hover:bg-bg hover:text-ink" onClick={() => { loadDoc(blankDoc()); setMenu(null); }}>Blank plate</button>
                <button type="button" className="inline-flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm text-muted hover:bg-bg hover:text-ink" onClick={() => fileRef.current?.click()}>
                  <Upload className="size-3.5" /> Load file
                </button>
                {templates.length > 0 ? <p className="px-2 pt-1 text-[10px] tracking-[0.18em] text-muted uppercase">Yours</p> : null}
                {templates.map((item) => (
                  <div key={item.id} className="flex items-center gap-1">
                    <button type="button" className="h-8 min-w-0 flex-1 truncate rounded-md px-2 text-left text-sm text-muted hover:bg-bg hover:text-ink" onClick={() => { loadDoc(item.doc); setMenu(null); }}>{item.name}</button>
                    <button type="button" aria-label={`Remove ${item.name}`} className="grid size-8 place-items-center text-muted" onClick={() => setTemplates((prev) => prev.filter((row) => row.id !== item.id))}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {menu === "export" ? (
              <div className="grid gap-1">
                <label className="flex h-8 items-center gap-2 px-2 text-sm text-muted">
                  <input type="checkbox" checked={secure} onChange={(event) => setSecure(event.target.checked)} />
                  Lock layers for recipients
                </label>
                <button type="button" className="h-8 rounded-md px-2 text-left text-sm" onClick={() => { exportPng(); setMenu(null); }}>PNG</button>
                <button type="button" className="h-8 rounded-md px-2 text-left text-sm text-muted" onClick={() => { exportSvg(); setMenu(null); }}>SVG</button>
                <button type="button" className="h-8 rounded-md px-2 text-left text-sm text-muted" onClick={() => { exportJson("idpress-template"); setMenu(null); }}>Template</button>
                <button type="button" className="h-8 rounded-md px-2 text-left text-sm text-muted" onClick={() => { exportJson("idpress-save"); setMenu(null); }}>Save file</button>
                <button type="button" className="inline-flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm text-muted" onClick={copyLink}>
                  <Share2 className="size-3.5" /> Link
                </button>
              </div>
            ) : null}
            {menu === "archive" ? (
              <div className="grid gap-1">
                {archive.length === 0 ? <p className="px-2 text-xs text-muted">No saved layers yet. Use Keep on a layer.</p> : null}
                {archive.map((item) => (
                  <div key={item.id} className="flex items-center gap-1">
                    <input
                      className="h-8 min-w-0 flex-1 rounded-md border border-line bg-bg px-2 text-sm"
                      value={item.name}
                      onChange={(event) =>
                        setArchive((prev) =>
                          prev.map((row) =>
                            row.id === item.id
                              ? {
                                  ...row,
                                  name: event.target.value,
                                  art: row.art ? { ...row.art, name: event.target.value } : null,
                                  text: row.text ? { ...row.text, label: event.target.value } : null,
                                }
                              : row,
                          ),
                        )
                      }
                    />
                    <button type="button" className="h-8 rounded-md px-2 text-xs text-muted" onClick={() => { placeArchived(item); setMenu(null); }}>Place</button>
                    <button type="button" aria-label={`Remove ${item.name}`} className="grid size-8 place-items-center text-muted" onClick={() => setArchive((prev) => prev.filter((row) => row.id !== item.id))}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {menu === "view" ? (
              <div className="grid gap-2">
                <button type="button" className="h-8 rounded-md px-2 text-left text-sm text-muted" onClick={() => setFillOnly((locked) => !locked)}>
                  {fillOnly ? "Words only" : "Move layers"}
                </button>
                <button type="button" className="h-8 rounded-md px-2 text-left text-sm text-muted" onClick={() => setCanvasOn((on) => !on)}>
                  {canvasOn ? "Canvas on" : "Canvas off"}
                </button>
                <div className="flex gap-1 px-1">
                  {(["dark", "light"] as Tone[]).map((item) => (
                    <button key={item} type="button" onClick={() => setTone(item)} className={`h-8 flex-1 rounded-md text-xs capitalize ${tone === item ? "bg-accent text-on-accent" : "text-muted"}`}>
                      {item}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1 px-1">
                  {SERVICES.map((item) => (
                    <button key={item.id} type="button" onClick={() => setService(item.id)} className={`h-8 rounded-md text-xs ${service === item.id ? "bg-accent text-on-accent" : "text-muted"}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="grid min-w-0 lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)_18rem]">
          <aside className="order-3 flex max-h-[70dvh] min-h-0 min-w-0 flex-col gap-3 overflow-y-auto border-b border-line bg-panel p-3 lg:order-1 lg:max-h-none lg:border-r lg:border-b-0">
            {fillOnly ? null : (
            <Block title="Shapes" collapse>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["rect", "Rect"],
                  ["round", "Round"],
                  ["oval", "Oval"],
                  ["frame", "Frame"],
                  ["edge", "Edge"],
                  ["triangle", "Triangle"],
                  ["diamond", "Diamond"],
                  ["chevron", "Chevron"],
                  ["star", "Star"],
                  ["hex", "Hex"],
                  ["pill", "Pill"],
                  ["ring", "Ring"],
                ] as const
              ).map(([kind, label]) => (
                <button key={kind} type="button" className="h-8 rounded-md border border-line px-3 text-sm" onClick={() => place(kind)}>
                  {label}
                </button>
              ))}
              <button type="button" className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm" onClick={() => artRef.current?.click()}>
                <ImagePlus className="size-4" /> Upload
              </button>
              <input
                ref={artRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  addImage(file).catch(() => setStatus("That image could not be placed."));
                }}
              />
            </div>
            </Block>
            )}

          {fillOnly ? null : (
            <Block title="Shape layers">
            <ul className="space-y-1">
              {doc.art.length === 0 ? <li className="text-sm text-muted">No shapes yet.</li> : null}
              {[...doc.art].sort((a, b) => b.order - a.order).map((layer) => (
                <li
                  key={layer.id}
                  draggable
                  onDragStart={(event) => {
                    if ((event.target as HTMLElement).closest("button, input")) {
                      event.preventDefault();
                      return;
                    }
                    event.dataTransfer.setData("text/layer", layer.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    reorder("art", event.dataTransfer.getData("text/layer"), layer.id);
                  }}
                  className="rounded-[10px] border border-line bg-bg"
                >
                  <LayerBar
                    name={layer.name}
                    selected={selectedId === layer.id}
                    hidden={layer.hidden}
                    locked={layer.locked}
                    armed={armed === layer.id}
                    onSelect={() => setSelectedId(selectedId === layer.id ? null : layer.id)}
                    onHide={() => patchArt(layer.id, { hidden: !layer.hidden })}
                    onLock={() => patchArt(layer.id, { locked: !layer.locked })}
                    onDuplicate={() => duplicate("art", layer.id)}
                    onDelete={() => askDelete(layer.id, layer.locked)}
                    note={layer.x < 0 || layer.y < 0 || layer.x + layer.w > doc.w || layer.y + layer.h > doc.h ? "Off the plate. Striped on the canvas. A full-canvas export leaves it out. A tight export still includes it." : undefined}
                  />
                  {selectedId === layer.id ? (
                    <div className="space-y-3 border-t border-line p-3">
                      {field("Layer name", <input className={inputClass} value={layer.name} onChange={(event) => patchArt(layer.id, { name: event.target.value })} />)}
                      {layer.kind === "block" && layer.shape !== "line" ? (
                        <>
                          <button type="button" aria-pressed={layer.fillOn} className={`h-8 w-full rounded-md border text-sm ${layer.fillOn ? "border-accent" : "border-line"}`} onClick={() => patchArt(layer.id, { fillOn: !layer.fillOn })}>
                            {layer.fillOn ? "Filled" : "No fill"}
                          </button>
                          {layer.fillOn ? field("Fill", <input className="h-8 w-full" type="color" value={layer.fill} onChange={(event) => patchArt(layer.id, { fill: event.target.value })} />) : null}
                          {layer.shape === "rect" ? field("Corner", <input className={inputClass} type="number" min={0} max={200} value={layer.radius} disabled={layer.locked} onChange={(event) => patchArt(layer.id, { radius: Number(event.target.value) })} />) : null}
                        </>
                      ) : null}
                      {layer.kind === "block" ? (
                        <div className="grid grid-cols-2 gap-2">
                          {field("Edge", <input className="h-8 w-full" type="color" value={layer.stroke} onChange={(event) => patchArt(layer.id, { stroke: event.target.value })} />)}
                          {field("Weight", <input className={inputClass} type="number" min={0} max={80} value={layer.strokeWidth} onChange={(event) => patchArt(layer.id, { strokeWidth: Number(event.target.value) })} />)}
                        </div>
                      ) : null}
                      <div className="grid grid-cols-2 gap-2">
                        {field("Alpha", <input className={inputClass} type="number" min={0} max={1} step={0.05} value={layer.alpha} onChange={(event) => patchArt(layer.id, { alpha: Number(event.target.value) })} />)}
                        {field(
                          "Blend",
                          <select className={inputClass} value={layer.blend} onChange={(event) => patchArt(layer.id, { blend: event.target.value as Blend })}>
                            {BLENDS.map((blend) => (
                              <option key={blend} value={blend}>
                                {blend}
                              </option>
                            ))}
                          </select>,
                        )}
                        {field("Skew X", <input className={inputClass} type="number" min={-60} max={60} value={layer.skewX} disabled={layer.locked} onChange={(event) => patchArt(layer.id, { skewX: Number(event.target.value) })} />)}
                        {field("Skew Y", <input className={inputClass} type="number" min={-60} max={60} value={layer.skewY} disabled={layer.locked} onChange={(event) => patchArt(layer.id, { skewY: Number(event.target.value) })} />)}
                      </div>
                      <label className="block text-xs tracking-widest text-muted uppercase">
                        Texture
                        <input
                          className="mt-1 block w-full text-sm"
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (!file) return;
                            imageFromFile(file)
                              .then((image) => patchArt(layer.id, { texture: image.src }))
                              .catch(() => setStatus("That texture has to be a PNG, JPEG, or WebP."));
                          }}
                        />
                      </label>
                      {layer.texture ? (
                        <button type="button" className="h-8 w-full rounded-md border border-line text-sm" onClick={() => patchArt(layer.id, { texture: null })}>
                          Clear texture
                        </button>
                      ) : null}
                      <div className="grid grid-cols-2 gap-2">
                        {(["x", "y", "w", "h"] as const).map((key) =>
                          field(key.toUpperCase(), <input className={inputClass} type="number" value={Math.round(layer[key])} disabled={layer.locked} onChange={(event) => patchArt(layer.id, { [key]: Number(event.target.value) })} />),
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" className="h-8 rounded-md border border-line px-3 text-sm" onClick={() => keepLayer("art", layer.id)}>
                          Keep
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            </Block>
          )}
          </aside>

        <main className="order-1 flex min-h-[70dvh] min-w-0 flex-col lg:order-2 lg:min-h-0">
          <div className="flex min-h-0 flex-1">
            <div className="flex w-7 shrink-0 flex-col border-r border-line bg-bg text-muted">
              <div className="h-5 shrink-0 border-b border-line" />
              <div className="relative min-h-0 flex-1">
                <div className="absolute inset-0">
                  <RulerBar origin={plateTop} scale={viewScale} length={view.h} vertical />
                </div>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="h-5 shrink-0 border-b border-line bg-bg text-muted">
                <RulerBar origin={plateLeft} scale={viewScale} length={view.w} />
              </div>
          <div
            ref={viewRef}
            className="well-checker relative min-h-0 flex-1 overflow-hidden"
            onPointerDown={(event) => {
              if (event.target !== event.currentTarget) return;
              const startX = event.clientX;
              const startY = event.clientY;
              const origin = panRef.current;
              const move = (ev: PointerEvent) => moveView({ x: origin.x + ev.clientX - startX, y: origin.y + ev.clientY - startY });
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
          >
            <div className="absolute" style={{ left: plateLeft - STAGE_PAD * viewScale, top: plateTop - STAGE_PAD * viewScale, width: Math.max(1, (doc.w + STAGE_PAD * 2) * viewScale), height: Math.max(1, (doc.h + STAGE_PAD * 2) * viewScale) }}>
              <Stage
                doc={doc}
                selectedId={selectedId}
                fillOnly={fillOnly}
                guide={GUIDE[service]}
                frame
                viewScale={viewScale}
                pan={pan}
                onSelect={setSelectedId}
                onChange={edit}
                onPan={moveView}
              />
            </div>
            <div
              className="pointer-events-none absolute border border-dashed"
              style={{ left: plateLeft, top: plateTop, width: Math.max(1, doc.w * viewScale), height: Math.max(1, doc.h * viewScale), borderColor: GUIDE[service] }}
            />
          </div>
            </div>
          </div>
          <p className="shrink-0 px-4 py-2 text-sm text-muted">{status}</p>
          {share ? <p className="shrink-0 px-4 pb-3 break-all text-xs text-accent">{share}</p> : null}
        </main>

        <aside className="order-2 flex max-h-[70dvh] min-h-0 min-w-0 flex-col gap-3 overflow-y-auto border-t border-line bg-panel p-3 lg:order-3 lg:max-h-none lg:border-t-0 lg:border-l">
          <Block title="Plate" collapse extra={<span className="text-xs text-muted">{doc.w}×{doc.h}</span>}>
            <div className="grid grid-cols-2 gap-2">
              {canvasOn ? (
                <>
                  {field(
                    "Width",
                    <input className={inputClass} type="number" value={doc.w} min={200} max={2400} onChange={(event) => edit({ ...doc, w: Number(event.target.value) || doc.w })} />,
                  )}
                  {field(
                    "Height",
                    <input className={inputClass} type="number" value={doc.h} min={24} max={1600} onChange={(event) => edit({ ...doc, h: Number(event.target.value) || doc.h })} />,
                  )}
                </>
              ) : (
                <p className="col-span-2 text-sm text-muted">Export hugs the pieces. The dashed frame stays. Stripes mark anything sitting off the plate.</p>
              )}
            </div>
            {field(
              "Ground",
              <span className="flex flex-col gap-2">
                <label className="flex h-8 items-center gap-2 text-sm">
                  <input type="checkbox" checked={doc.ground !== null} onChange={(event) => edit({ ...doc, ground: event.target.checked ? "#07090c" : null })} />
                  Plate fill
                </label>
                {doc.ground ? (
                  <input className="h-8 w-full" type="color" value={doc.ground} onChange={(event) => edit({ ...doc, ground: event.target.value })} />
                ) : (
                  <span className="text-sm text-muted">Off. Empty space exports clear.</span>
                )}
              </span>,
            )}
          </Block>
          <Block
            title="Text layers"
            extra={
              fillOnly ? null : (
                <button type="button" className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted" onClick={addText}>
                  <Plus className="size-3.5" /> Line
                </button>
              )
            }
          >
          <ul className="space-y-1">
            {doc.texts.length === 0 ? <li className="text-sm text-muted">No text yet. Add a line, then place it.</li> : null}
            {[...doc.texts].sort((a, b) => b.order - a.order).map((layer) => (
              <li
                key={layer.id}
                draggable={!fillOnly}
                onDragStart={(event) => {
                  if (fillOnly || (event.target as HTMLElement).closest("button, input")) {
                    event.preventDefault();
                    return;
                  }
                  event.dataTransfer.setData("text/line", layer.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  reorder("text", event.dataTransfer.getData("text/line"), layer.id);
                }}
                className={`rounded-[10px] border bg-bg ${selectedId === layer.id ? "border-accent" : "border-line"}`}
              >
                <LayerBar
                  name={layer.label}
                  selected={selectedId === layer.id}
                  hidden={layer.hidden}
                  locked={layer.locked}
                  onSelect={() => setSelectedId(selectedId === layer.id ? null : layer.id)}
                  onHide={fillOnly ? undefined : () => patchText(layer.id, { hidden: !layer.hidden })}
                  onLock={fillOnly ? undefined : () => patchText(layer.id, { locked: !layer.locked })}
                  onDuplicate={fillOnly ? undefined : () => duplicate("text", layer.id)}
                  onDelete={fillOnly ? undefined : () => askDelete(layer.id, layer.locked)}
                  armed={armed === layer.id}
                  note={layer.x < 0 || layer.y - layer.size / 2 < 0 || layer.x + layer.maxW > doc.w || layer.y + layer.size / 2 > doc.h ? "Off the plate. Striped on the canvas. A full-canvas export leaves it out. A tight export still includes it." : undefined}
                />
                {selectedId === layer.id ? (
                  <div className="space-y-3 border-t border-line p-2">
                    <input className={inputClass} value={layer.text} placeholder="Words" onChange={(event) => patchText(layer.id, { text: event.target.value })} />
                    {fillOnly ? null : (
                      <>
                    {field("Slot name", <input className={inputClass} value={layer.label} onChange={(event) => patchText(layer.id, { label: event.target.value })} />)}
                    <div className="grid grid-cols-2 gap-2">
                      {field(
                        "Font",
                        <select className={inputClass} value={layer.font} disabled={layer.locked} onChange={(event) => patchText(layer.id, { font: event.target.value as FontId })}>
                          {FONTS.map((font) => (
                            <option key={font} value={font}>
                              {FONT_LABEL[font]}
                            </option>
                          ))}
                        </select>,
                      )}
                      {field(
                        "Weight",
                        <select className={inputClass} value={layer.weight} disabled={layer.locked} onChange={(event) => patchText(layer.id, { weight: event.target.value as TextLayer["weight"] })}>
                          <option value="400">Regular</option>
                          <option value="600">Semibold</option>
                          <option value="700">Bold</option>
                        </select>,
                      )}
                      {field("Size", <input className={inputClass} type="number" min={8} max={240} value={layer.size} disabled={layer.locked} onChange={(event) => patchText(layer.id, { size: Number(event.target.value) })} />)}
                      {field(
                        "Route",
                        <select
                          className={inputClass}
                          value={layer.route}
                          disabled={layer.locked}
                          onChange={(event) => {
                            const route = event.target.value as TextRoute;
                            const bend = layer.bend !== 0 ? layer.bend : route === "circle" ? 80 : route === "wave" ? 18 : route === "straight" ? 0 : 48;
                            patchText(layer.id, { route, bend, curve: Math.abs(bend) });
                          }}
                        >
                          {ROUTES.map((route) => (
                            <option key={route.id} value={route.id}>
                              {route.label}
                            </option>
                          ))}
                        </select>,
                      )}
                      {field("Bend", <input className={inputClass} type="number" min={-800} max={800} value={layer.bend} disabled={layer.locked} onChange={(event) => patchText(layer.id, { bend: Number(event.target.value), curve: Math.abs(Number(event.target.value)) })} />)}
                      {field("Depth", <input className={inputClass} type="number" min={0} max={8} step={1} value={layer.depth} disabled={layer.locked} onChange={(event) => patchText(layer.id, { depth: Number(event.target.value) })} />)}
                      {field("Tracking", <input className={inputClass} type="number" min={-20} max={80} value={layer.tracking} disabled={layer.locked} onChange={(event) => patchText(layer.id, { tracking: Number(event.target.value) })} />)}
                      {field("Squish", <input className={inputClass} type="number" min={0.2} max={3} step={0.05} value={layer.squish} disabled={layer.locked} onChange={(event) => patchText(layer.id, { squish: Number(event.target.value) })} />)}
                      {field("Skew X", <input className={inputClass} type="number" min={-60} max={60} value={layer.skewX} disabled={layer.locked} onChange={(event) => patchText(layer.id, { skewX: Number(event.target.value) })} />)}
                      {field("Skew Y", <input className={inputClass} type="number" min={-60} max={60} value={layer.skewY} disabled={layer.locked} onChange={(event) => patchText(layer.id, { skewY: Number(event.target.value) })} />)}
                      {field("Alpha", <input className={inputClass} type="number" min={0} max={1} step={0.05} value={layer.alpha} onChange={(event) => patchText(layer.id, { alpha: Number(event.target.value) })} />)}
                      {field(
                        "Blend",
                        <select className={inputClass} value={layer.blend} onChange={(event) => patchText(layer.id, { blend: event.target.value as Blend })}>
                          {BLENDS.map((blend) => (
                            <option key={blend} value={blend}>
                              {blend}
                            </option>
                          ))}
                        </select>,
                      )}
                      {field("X", <input className={inputClass} type="number" value={Math.round(layer.x)} disabled={layer.locked} onChange={(event) => patchText(layer.id, { x: Number(event.target.value) })} />)}
                      {field("Y", <input className={inputClass} type="number" value={Math.round(layer.y)} disabled={layer.locked} onChange={(event) => patchText(layer.id, { y: Number(event.target.value) })} />)}
                      {layer.route === "path" ? field("Path X", <input className={inputClass} type="number" value={layer.cx} disabled={layer.locked} onChange={(event) => patchText(layer.id, { cx: Number(event.target.value) })} />) : null}
                      {layer.route === "path" ? field("Path Y", <input className={inputClass} type="number" value={layer.cy} disabled={layer.locked} onChange={(event) => patchText(layer.id, { cy: Number(event.target.value) })} />) : null}
                      {field("Width", <input className={inputClass} type="number" min={8} max={4000} value={layer.maxW} disabled={layer.locked} onChange={(event) => patchText(layer.id, { maxW: Number(event.target.value) })} />)}
                    </div>
                    <label className="flex h-8 items-center gap-2 text-sm">
                      <input type="checkbox" checked={layer.fit} disabled={layer.locked} onChange={(event) => patchText(layer.id, { fit: event.target.checked })} />
                      Fit to width
                    </label>
                    {layer.route === "straight" ? null : <p className="text-sm text-muted">Drag the mark on the plate to bend this line.</p>}
                    {field("Color", <input className="h-8 w-full" type="color" value={layer.color} onChange={(event) => patchText(layer.id, { color: event.target.value })} />)}
                    <div className="flex gap-2">
                      {(["left", "center", "right"] as const).map((align) => (
                        <button key={align} type="button" disabled={layer.locked} className={`h-8 flex-1 rounded-md border text-sm capitalize ${layer.align === align ? "border-accent" : "border-line"}`} onClick={() => patchText(layer.id, { align })}>
                          {align}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="h-8 rounded-md border border-line px-3 text-sm" onClick={() => keepLayer("text", layer.id)}>
                        Keep
                      </button>
                    </div>
                      </>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          </Block>
        </aside>
      </div>
    </div>
  );
}
