#!/usr/bin/env node
// Генерирует templates/index.json из scripts/home-content.mjs.
//  1. заливает картинки секций в Files (по одному разу, идемпотентно по filename)
//  2. собирает JSON-шаблон Dawn (секции/блоки/настройки как пишет редактор темы)
//
// Использование:  node scripts/build-home.mjs [--dry]
//   --dry  — не трогать Files, подставить фиктивные ссылки (для проверки структуры)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { graphql } from "./shopify.mjs";
import { SECTIONS, IMAGE_SOURCES } from "./home-content.mjs";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const OUT = path.join(ROOT, "templates", "index.json");
const DRY = process.argv.includes("--dry");

const IMAGE_SETTING_KEYS = new Set(["image", "image_2"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extOf(url) {
  const m = url.split("?")[0].match(/\.([a-z0-9]+)$/i);
  return (m ? m[1] : "jpg").toLowerCase();
}
const filenameFor = (key) => `home-${key}.${extOf(IMAGE_SOURCES[key])}`;

const Q_FILES = `
query ($q: String!) {
  files(first: 5, query: $q) {
    nodes {
      fileStatus
      alt
      ... on MediaImage { id image { url width height } }
    }
  }
}`;

const M_FILE_CREATE = `
mutation ($files: [FileCreateInput!]!) {
  fileCreate(files: $files) {
    files {
      fileStatus
      ... on MediaImage { id image { url } }
    }
    userErrors { field message code }
  }
}`;

async function findFile(filename) {
  const out = await graphql(Q_FILES, { q: `filename:${filename}` });
  return out.data.files.nodes[0] || null;
}

async function waitReady(filename, { tries = 30, delay = 2000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const f = await findFile(filename);
    if (f && f.fileStatus === "READY") return f;
    if (f && f.fileStatus === "FAILED") throw new Error(`Files: ${filename} FAILED`);
    await sleep(delay);
  }
  throw new Error(`Files: ${filename} не дошёл до READY`);
}

async function ensureImage(key) {
  const filename = filenameFor(key);
  const existing = await findFile(filename);
  if (existing && existing.fileStatus === "READY") {
    console.log(`  = ${filename} (уже в Files)`);
    return filename;
  }
  if (!existing) {
    const out = await graphql(M_FILE_CREATE, {
      files: [
        {
          originalSource: IMAGE_SOURCES[key],
          filename,
          contentType: "IMAGE",
          alt: key.replace(/-/g, " "),
          duplicateResolutionMode: "REPLACE",
        },
      ],
    });
    const errs = out.data.fileCreate.userErrors || [];
    if (errs.length) throw new Error(`fileCreate ${filename}: ${JSON.stringify(errs)}`);
    console.log(`  + ${filename} <- ${IMAGE_SOURCES[key]}`);
  }
  await waitReady(filename);
  console.log(`    READY`);
  return filename;
}

function resolveSettings(settings, refMap) {
  const out = {};
  for (const [k, v] of Object.entries(settings)) {
    if (IMAGE_SETTING_KEYS.has(k) && typeof v === "string" && v in IMAGE_SOURCES) {
      out[k] = refMap[v];
    } else {
      out[k] = v;
    }
  }
  return out;
}

function buildTemplate(refMap) {
  const sections = {};
  const order = [];
  for (const s of SECTIONS) {
    order.push(s.key);
    const node = { type: s.type, settings: resolveSettings(s.settings || {}, refMap) };
    if (s.blocks && s.blocks.length) {
      node.blocks = {};
      node.block_order = [];
      s.blocks.forEach((b, i) => {
        const bkey = `${b.type}_${i}`;
        node.blocks[bkey] = { type: b.type, settings: resolveSettings(b.settings || {}, refMap) };
        node.block_order.push(bkey);
      });
    }
    sections[s.key] = node;
  }
  return { sections, order };
}

const HEADER = `/*
 * ------------------------------------------------------------
 * IMPORTANT: The contents of this file are auto-generated.
 *
 * This file may be updated by the Shopify admin theme editor
 * or related systems. Please exercise caution as any changes
 * made to this file may be overwritten.
 * ------------------------------------------------------------
 */
`;

async function run() {
  const keys = [...new Set(Object.keys(IMAGE_SOURCES))];
  const refMap = {};

  if (DRY) {
    for (const k of keys) refMap[k] = `shopify://shop_images/${filenameFor(k)}`;
    console.log("(--dry) картинки не загружаются");
  } else {
    console.log(`Картинки (${keys.length}):`);
    for (const k of keys) {
      const filename = await ensureImage(k);
      refMap[k] = `shopify://shop_images/${filename}`;
    }
  }

  const template = buildTemplate(refMap);
  fs.writeFileSync(OUT, HEADER + JSON.stringify(template, null, 2) + "\n");

  console.log(`\nСекции (${template.order.length}):`);
  for (const key of template.order) {
    const s = template.sections[key];
    const nb = s.block_order ? s.block_order.length : 0;
    console.log(`  ${key.padEnd(18)} ${s.type.padEnd(20)} блоков: ${nb}`);
  }
  // проверка незаполненных картинок
  const raw = fs.readFileSync(OUT, "utf8");
  const unresolved = [...raw.matchAll(/"image(?:_2)?":\s*"([^"]+)"/g)].map((m) => m[1]).filter((v) => !v.startsWith("shopify://"));
  if (unresolved.length) console.log(`\n⚠ незаполненные image: ${unresolved.join(", ")}`);
  console.log(`\nwritten -> ${path.relative(ROOT, OUT)}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
