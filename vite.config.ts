import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { pressBase } from "./scripts/press-base.mjs";

const mountedAt = pressBase();

export default defineConfig(({ command, isPreview }) => ({
  base: mountedAt ? `${mountedAt}/` : "/",
  server: { host: "127.0.0.1", port: 8080, strictPort: true },
  preview: { host: "127.0.0.1", port: 8081, strictPort: true },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart(mountedAt ? { router: { basepath: mountedAt } } : {}),
    ...(command === "build" || isPreview
      ? [
          nitro({
            preset: "cloudflare_module",
            compatibilityDate: "2026-10-07",
            cloudflare: { deployConfig: true, nodeCompat: true, wrangler: { name: "idpress" } },
          }),
        ]
      : []),
    viteReact(),
  ],
}));
