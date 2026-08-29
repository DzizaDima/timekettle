#!/usr/bin/env node
// Сверка: секция исходника timekettle -> что получилось в templates/product.<suffix>.json.
// Прогоняет маппер посекционно, поэтому соответствие точное (без угадывания парности).
//
// Использование:  node scripts/verify-product-pages.mjs [w4 m3 ...]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mapSection } from "./product-mapping.mjs";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const DATA = path.join(ROOT, "scripts", "data", "product-pages.json");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

// какие типы Dawn допустимы для измеренной раскладки
const ALLOWED = {
  banner: ["image-banner", "rich-text"],
  "rows-alternating": ["multirow", "rich-text"],
  "rows-wide": ["multicolumn"],
  rows: ["multirow", "rich-text", "multicolumn"],
  grid: ["multicolumn"],
  accordion: ["collapsible-content"],
  marquee: ["languages-scrolling"],
  text: ["rich-text"],
};

const all = JSON.parse(fs.readFileSync(DATA, "utf8"));
let problems = 0;
let totalSrc = 0;
let totalGen = 0;

for (const d of Object.values(all)) {
  if (only.length && !only.includes(d.suffix)) continue;
  const tplPath = path.join(ROOT, "templates", `product.${d.suffix}.json`);
  const tpl = JSON.parse(fs.readFileSync(tplPath, "utf8").replace(/^\/\*[\s\S]*?\*\//, ""));
  const genKeys = tpl.order.filter((k) => k !== "main" && k !== "related-products");

  console.log(`\n${"#".repeat(70)}\n### ${d.suffix}  (${d.handle})`);
  let gi = 0;
  let heroDone = false;
  const issues = [];

  d.sections.forEach((s, i) => {
    if (s.layout === "banner" && !heroDone) { s.isHero = true; heroDone = true; }
    let r = null;
    try {
      r = mapSection(s, { handle: d.handle, img: (u) => (u ? "REF" : "") });
    } catch (e) {
      issues.push(`[${i}] ${s.type}: ошибка маппера ${e.message}`);
    }
    const nodes = (Array.isArray(r) ? r : [r]).filter(Boolean);
    const genTypes = [];
    const genBlocks = [];
    for (const n of nodes) {
      const key = genKeys[gi++];
      const g = key ? tpl.sections[key] : null;
      genTypes.push(g ? g.type : "(нет в темплейте)");
      genBlocks.push(g && g.block_order ? g.block_order.length : 0);
      if (g && g.type !== n.type) issues.push(`[${i}] темплейт разошёлся: ждали ${n.type}, в файле ${g.type}`);
    }

    const allowed = ALLOWED[s.layout] || [];
    const ok = nodes.length > 0 && nodes.every((n) => allowed.includes(n.type));
    if (!ok) { problems++; issues.push(`[${i}] ${s.type}/${s.layout} -> ${genTypes.join("+") || "ПРОПУЩЕНО"}`); }

    const srcItems = s.items.length;
    const blocks = genBlocks.reduce((a, b) => a + b, 0);
    // потеря контента: карточек в исходнике заметно больше, чем блоков у нас
    const lost = s.layout !== "banner" && s.layout !== "marquee" && srcItems > blocks + 1;
    if (lost) issues.push(`[${i}] ${s.type}: карточек ${srcItems}, блоков ${blocks} — возможна потеря контента`);

    console.log(
      `  ${ok ? "✓" : "✗"} [${String(i).padStart(2)}] ${s.type.padEnd(23)} ${s.layout.padEnd(17)} items=${String(srcItems).padStart(2)}` +
        ` -> ${genTypes.join(" + ").padEnd(32)} blocks=${blocks}${lost ? "  ⚠" : ""}`,
    );
    totalSrc++;
    totalGen += nodes.length;
  });

  if (gi < genKeys.length) issues.push(`лишние секции в темплейте: ${genKeys.slice(gi).map((k) => tpl.sections[k].type).join(", ")}`);

  // пустые ссылки на картинки
  const raw = JSON.stringify(tpl);
  const emptyImg = (raw.match(/"image(?:_2)?":\s*""/g) || []).length;
  if (emptyImg) issues.push(`пустых image: ${emptyImg}`);

  if (issues.length) {
    console.log("  ── замечания:");
    issues.forEach((x) => console.log(`     • ${x}`));
  }
}

console.log(`\n${"=".repeat(70)}`);
console.log(`секций в исходниках: ${totalSrc}, секций сгенерировано: ${totalGen}, несоответствий: ${problems}`);
process.exitCode = problems ? 1 : 0;
