// Vérifie que chaque langue possède exactement les mêmes clés que le français.
import { readFileSync } from "node:fs";
const langs = ["fr", "ary", "ar", "en", "es", "de", "ja", "zh", "ko"];
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
const ref = new Set(flat(JSON.parse(readFileSync("src/messages/fr.json", "utf8"))));
let bad = 0;
for (const l of langs.slice(1)) {
  const keys = new Set(flat(JSON.parse(readFileSync(`src/messages/${l}.json`, "utf8"))));
  const missing = [...ref].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !ref.has(k));
  if (missing.length || extra.length) {
    bad++;
    console.log(`${l}: ${missing.length} manquantes ${missing.slice(0, 8).join(", ")} | ${extra.length} en trop ${extra.slice(0, 8).join(", ")}`);
  }
}
console.log(bad ? `✗ ${bad} langue(s) incomplète(s)` : `✓ ${langs.length} langues, ${ref.size} clés chacune`);
process.exit(bad ? 1 : 0);
