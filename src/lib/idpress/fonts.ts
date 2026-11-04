import type { Blend, FontId } from "@/lib/idpress/types";

export const FONT_STACK: Record<FontId, string> = {
  sans: '"Instrument Sans", "Segoe UI", sans-serif',
  serif: '"Libre Baskerville", Georgia, serif',
  condensed: '"Barlow Condensed", "Arial Narrow", sans-serif',
  display: '"Oswald", Impact, sans-serif',
  mono: '"Share Tech Mono", ui-monospace, monospace',
};

export const FONT_LABEL: Record<FontId, string> = {
  sans: "Sans",
  serif: "Serif",
  condensed: "Condensed",
  display: "Display",
  mono: "Mono",
};

export const BLEND_OP: Record<Blend, GlobalCompositeOperation> = {
  normal: "source-over",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  darken: "darken",
  lighten: "lighten",
  knockout: "destination-out",
};
