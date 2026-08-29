#!/usr/bin/env node
// Кладёт данные секции языков (список + детальная таблица) в метаполе продукта
// custom.language_table (json). Секция sections/languages-scrolling.liquid читает его.
//
// Использование:  node scripts/set-language-metafields.mjs [--dry] [w4 m3 ...]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { graphql } from "./shopify.mjs";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const DATA = path.join(ROOT, "scripts", "data", "language-tables.json");
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const only = args.filter((a) => !a.startsWith("--"));

const HANDLES = {
  w4: "w4-ai-interpreter-earbuds",
  "w4-pro": "w4-pro-ai-interpreter-earbuds-2026",
  x1: "x1-meeting-interpreter-hub",
  m3: "m3-travel-translator-earbuds",
  t1: "fluentalk-t1-handheld-translator-device",
};

const M_DEF = `
mutation ($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition { namespace key }
    userErrors { field message code }
  }
}`;
const Q_PRODUCT = `query ($q: String!) { products(first: 1, query: $q) { nodes { id handle } } }`;
const M_SET = `
mutation ($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { key namespace }
    userErrors { field message code }
  }
}`;

// убираем фиксированные размеры/классы — размер задаёт CSS секции
function normalizeSvg(svg) {
  if (!svg) return null;
  return svg
    .replace(/\s(width|height)="[^"]*"/g, "")
    .replace(/\sclass="[^"]*"/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPayload(d) {
  const flagByName = new Map();
  for (const c of d.chips || []) if (c.svg || c.img) flagByName.set(c.name, { svg: normalizeSvg(c.svg), img: c.img });

  // у исходника местами задваиваются строки (напр. Bengali у M3) — убираем
  const seen = new Set();
  const languages = [];
  for (const r of d.rows || []) {
    if (!r.name || seen.has(r.name)) continue;
    seen.add(r.name);
    const f = flagByName.get(r.name) || { svg: normalizeSvg(r.svg), img: r.img };
    languages.push({
      name: r.name,
      flag: f.svg || null,
      flag_img: f.img || null,
      online: r.online === "✓",
      offline: r.offline === "✓",
      accents: r.accents && r.accents !== "✗" ? r.accents : "",
    });
  }

  return {
    heading: d.heading || "Covering the World, Accent by Accent.",
    subheading: d.subheading || "",
    button_label: d.button_label || d.buttonLabel || "View Detailed Language Table",
    columns: ["Languages", "Online Translation", "Accents", "Offline Translation"],
    languages,
  };
}

async function run() {
  const all = JSON.parse(fs.readFileSync(DATA, "utf8"));

  if (!DRY) {
    const out = await graphql(M_DEF, {
      definition: {
        name: "Language table",
        namespace: "custom",
        key: "language_table",
        description: "Языки, акценты и офлайн-пакеты для секции «Covering the World».",
        type: "json",
        ownerType: "PRODUCT",
        pin: true,
      },
    });
    const errs = out.data.metafieldDefinitionCreate.userErrors || [];
    if (errs.length && errs.some((e) => e.code === "TAKEN" || /taken|already/i.test(e.message))) {
      console.log("= определение custom.language_table уже есть");
    } else if (errs.length) {
      console.error("✗ определение:", JSON.stringify(errs));
      process.exitCode = 1;
    } else {
      console.log("+ создано определение custom.language_table (json)");
    }
  }

  for (const [suffix, d] of Object.entries(all)) {
    if (only.length && !only.includes(suffix)) continue;
    const handle = HANDLES[suffix];
    const payload = buildPayload(d);
    const value = JSON.stringify(payload);
    const kb = (value.length / 1024).toFixed(0);
    const withFlag = payload.languages.filter((l) => l.flag || l.flag_img).length;

    if (DRY) {
      console.log(`${suffix}: языков ${payload.languages.length} (с флагом ${withFlag}), ${kb} KB — dry`);
      continue;
    }
    const found = await graphql(Q_PRODUCT, { q: `handle:${handle}` });
    const p = found.data.products.nodes[0];
    if (!p) { console.log(`✗ ${handle}: не найден`); continue; }

    const res = await graphql(M_SET, {
      metafields: [{ ownerId: p.id, namespace: "custom", key: "language_table", type: "json", value }],
    });
    const errs = res.data.metafieldsSet.userErrors || [];
    if (errs.length) console.log(`✗ ${suffix}: ${JSON.stringify(errs)}`);
    else console.log(`✓ ${suffix}: языков ${payload.languages.length} (с флагом ${withFlag}), ${kb} KB`);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
