// Copie les drapeaux (country-flag-icons, SVG 3x2) dans public/flags pour le champ téléphone.
// Lancé automatiquement par npm install, npm run dev et npm run build.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
let src;
try {
  src = path.join(path.dirname(require.resolve("country-flag-icons/package.json")), "3x2");
} catch {
  console.warn("[flags] country-flag-icons absent : drapeaux non copiés");
  process.exit(0);
}
const dest = path.join(process.cwd(), "public", "flags");
mkdirSync(dest, { recursive: true });
const files = readdirSync(src).filter((f) => f.endsWith(".svg"));
for (const f of files) if (!existsSync(path.join(dest, f))) cpSync(path.join(src, f), path.join(dest, f));
console.log(`[flags] ${files.length} drapeaux prêts dans public/flags`);
