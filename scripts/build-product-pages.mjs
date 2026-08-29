#!/usr/bin/env node
// Собирает templates/product.<suffix>.json из scripts/data/product-pages.json.
//  1. прогон маппинга «вхолостую» — узнаём, какие картинки реально нужны
//  2. заливает только их в Files (идемпотентно по имени)
//  3. повторный прогон маппинга с реальными ссылками -> JSON-темплейт
//
// Использование:
//   node scripts/build-product-pages.mjs [--dry] [--prune] [w4 x1 ...]
//     --dry    не трогать Files (проверить структуру)
//     --prune  удалить из Files картинки pp-*, которые больше не используются

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { graphql } from "./shopify.mjs";
import { mapSection } from "./product-mapping.mjs";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const DATA = path.join(ROOT, "scripts", "data", "product-pages.json");
const DEFAULT_TPL = path.join(ROOT, "templates", "product.json");
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const PRUNE = args.includes("--prune");
const only = args.filter((a) => !a.startsWith("--"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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

// Звёзды рейтинга из фейковых метаполей custom.reviews_* (сток Dawn читает reviews.*)
const RATING_LIQUID = `{%- assign rr = product.metafields.custom.reviews_rating.value -%}
{%- assign rc = product.metafields.custom.reviews_count.value -%}
{%- if rr -%}
<div style="display:flex;align-items:center;gap:.45rem;margin:.4rem 0 .2rem;font-size:1.4rem">
  <span aria-hidden="true" style="color:#f5a623;letter-spacing:2px">
    {%- assign full = rr | floor -%}
    {%- for i in (1..5) -%}{%- if i <= full -%}&#9733;{%- else -%}&#9734;{%- endif -%}{%- endfor -%}
  </span>
  <span>{{ rr }} ({{ rc }} reviews)</span>
</div>
{%- endif -%}`;

const Q_FILES = `query ($q: String!) { files(first: 20, query: $q) { nodes { fileStatus ... on MediaImage { id image { url } } } } }`;
const M_FILE_CREATE = `
mutation ($files: [FileCreateInput!]!) {
  fileCreate(files: $files) { files { fileStatus ... on MediaImage { id } } userErrors { field message code } }
}`;
const M_FILE_DELETE = `mutation ($ids: [ID!]!) { fileDelete(fileIds: $ids) { deletedFileIds userErrors { message } } }`;

function extOf(url) {
  const m = url.split("?")[0].match(/\.([a-z0-9]{2,4})$/i);
  const e = (m ? m[1] : "jpg").toLowerCase();
  return ["jpg", "jpeg", "png", "webp", "gif"].includes(e) ? (e === "jpeg" ? "jpg" : e) : "jpg";
}
const fileNameFor = (suffix, url) =>
  `pp-${suffix}-${crypto.createHash("sha1").update(url).digest("hex").slice(0, 10)}.${extOf(url)}`;

async function findFile(filename) {
  const out = await graphql(Q_FILES, { q: `filename:${filename}` });
  return out.data.files.nodes[0] || null;
}
async function ensureImage(suffix, url) {
  const filename = fileNameFor(suffix, url);
  const existing = await findFile(filename);
  if (existing && existing.fileStatus === "READY") return { filename, cached: true };
  if (!existing) {
    const out = await graphql(M_FILE_CREATE, {
      files: [{ originalSource: url, filename, contentType: "IMAGE", alt: "", duplicateResolutionMode: "REPLACE" }],
    });
    const errs = out.data.fileCreate.userErrors || [];
    if (errs.length) {
      console.log(`    ! ${filename}: ${errs.map((e) => e.message).join("; ")}`);
      return { filename, failed: true };
    }
  }
  return { filename, cached: false };
}
async function waitAllReady(filenames) {
  for (let attempt = 0; attempt < 40; attempt++) {
    let pending = 0;
    for (const f of filenames) {
      const rec = await findFile(f);
      if (!rec || (rec.fileStatus !== "READY" && rec.fileStatus !== "FAILED")) pending++;
    }
    if (!pending) return;
    await sleep(2500);
  }
}

// прогон маппинга; collect=true — только собрать нужные URL
function runMapping(sections, handle, resolver) {
  const ctx = { handle, img: resolver };
  const nodes = [];
  const skipped = [];
  let heroDone = false;
  for (const s of sections) {
    if (s.layout === "banner" && !heroDone) {
      s.isHero = true;
      heroDone = true;
    }
    let r = null;
    try {
      r = mapSection(s, ctx);
    } catch (e) {
      console.log(`  ! map ${s.type}: ${e.message}`);
    }
    if (!r) { skipped.push(`${s.type}/${s.layout}`); continue; }
    for (const n of Array.isArray(r) ? r : [r]) if (n) nodes.push(n);
  }
  return { nodes, skipped };
}

function buildMainAndRelated() {
  const tpl = JSON.parse(fs.readFileSync(DEFAULT_TPL, "utf8").replace(/^\/\*[\s\S]*?\*\//, ""));
  const main = tpl.sections.main;
  main.blocks.rating = { type: "custom_liquid", settings: { custom_liquid: RATING_LIQUID } };
  const bo = main.block_order;
  bo.splice(bo.indexOf("price") + 1, 0, "rating");
  return { main, related: tpl.sections["related-products"] };
}

function assembleTemplate(nodes) {
  const { main, related } = buildMainAndRelated();
  const sections = { main };
  const order = ["main"];
  nodes.forEach((n, i) => {
    const key = `s${String(i).padStart(2, "0")}_${n.type.replace(/-/g, "_")}`;
    const node = { type: n.type, settings: n.settings };
    if (n.blocks && n.blocks.length) {
      node.blocks = {};
      node.block_order = [];
      n.blocks.forEach((b, j) => {
        const bk = `b${j}`;
        node.blocks[bk] = { type: b.type, settings: b.settings };
        node.block_order.push(bk);
      });
    }
    sections[key] = node;
    order.push(key);
  });
  sections["related-products"] = related;
  order.push("related-products");
  return { sections, order };
}

async function run() {
  const all = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const entries = Object.values(all).filter((d) => !only.length || only.includes(d.suffix));
  const usedFilenames = new Set();

  for (const d of entries) {
    console.log(`\n=== ${d.suffix} (${d.handle}) ===`);

    // 1. какие картинки реально нужны маппингу
    const needed = new Set();
    runMapping(d.sections, d.handle, (u) => { if (u) needed.add(u); return u; });
    const urls = [...needed];
    console.log(`  нужно картинок: ${urls.length}`);

    // 2. заливаем
    const refMap = {};
    const fresh = [];
    for (const u of urls) {
      const filename = fileNameFor(d.suffix, u);
      usedFilenames.add(filename);
      if (DRY) { refMap[u] = `shopify://shop_images/${filename}`; continue; }
      const r = await ensureImage(d.suffix, u);
      refMap[u] = r.failed ? "" : `shopify://shop_images/${r.filename}`;
      if (!r.cached && !r.failed) fresh.push(r.filename);
    }
    if (fresh.length) {
      process.stdout.write(`  ждём обработки ${fresh.length} новых… `);
      await waitAllReady(fresh);
      console.log("ok");
    }

    // 3. финальный маппинг
    const { nodes, skipped } = runMapping(d.sections, d.handle, (u) => refMap[u] ?? "");
    const template = assembleTemplate(nodes);
    fs.writeFileSync(path.join(ROOT, "templates", `product.${d.suffix}.json`), HEADER + JSON.stringify(template, null, 2) + "\n");

    console.log(`  секций: ${nodes.length} (+ main, related-products)`);
    const counts = {};
    nodes.forEach((n) => (counts[n.type] = (counts[n.type] || 0) + 1));
    console.log(`  состав: ${Object.entries(counts).map(([t, c]) => `${t}×${c}`).join(", ")}`);
    if (skipped.length) console.log(`  пропущено: ${skipped.join(", ")}`);
    const noImg = Object.entries(refMap).filter(([, v]) => !v).length;
    if (noImg) console.log(`  ⚠ картинок не загрузилось: ${noImg}`);
    console.log(`  -> templates/product.${d.suffix}.json`);
  }

  if (PRUNE && !DRY && !only.length) {
    console.log("\n--- prune неиспользуемых pp-* ---");
    const out = await graphql(`query { files(first: 250, query: "filename:pp-") { nodes { id ... on MediaImage { image { url } } } } }`);
    const stale = out.data.files.nodes.filter((n) => {
      const name = (n.image?.url || "").split("/").pop()?.split("?")[0];
      return name && !usedFilenames.has(name);
    });
    console.log(`  кандидатов на удаление: ${stale.length}`);
    for (let i = 0; i < stale.length; i += 50) {
      const batch = stale.slice(i, i + 50).map((n) => n.id);
      const r = await graphql(M_FILE_DELETE, { ids: batch });
      console.log(`  удалено: ${r.data.fileDelete.deletedFileIds.length}`);
    }
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
