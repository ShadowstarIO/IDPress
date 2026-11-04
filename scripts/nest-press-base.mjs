import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pressBase } from "./press-base.mjs";

const base = pressBase().replace(/^\//, "");
if (!base) process.exit(0);

const roots = [".output/public"].filter((root) => existsSync(root));
for (const root of roots) {
  const dest = join(root, base);
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(root)) {
    if (name === base) continue;
    cpSync(join(root, name), join(dest, name), { recursive: true });
  }
}
