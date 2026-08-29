#!/usr/bin/env node
// Пушит локальный templates/index.json в тему магазина через Admin API (themeFilesUpsert).
// Требует scope write_themes (+ read_themes).
//
// Использование:
//   node scripts/push-theme.mjs                 # цель: dev/unpublished тема; MAIN только с --yes
//   node scripts/push-theme.mjs --theme 123456  # явная тема по числовому id или gid
//   node scripts/push-theme.mjs --yes           # разрешить пуш в опубликованную (MAIN) тему
//   node scripts/push-theme.mjs --file templates/index.json [--file templates/foo.json ...]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { graphql } from "./shopify.mjs";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const STORE = (fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/SHOPIFY_STORE\s*=\s*(\S+)/) || [])[1] || "";
const slug = STORE.replace(/\.myshopify\.com$/, "");

const argv = process.argv.slice(2);
const YES = argv.includes("--yes");
const themeArgIdx = argv.indexOf("--theme");
const THEME_ARG = themeArgIdx > -1 ? argv[themeArgIdx + 1] : null;
const files = [];
for (let i = 0; i < argv.length; i++) if (argv[i] === "--file") files.push(argv[i + 1]);
if (!files.length) files.push("templates/index.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const Q_THEMES = `query { themes(first: 50) { nodes { id name role } } }`;
const Q_JOB = `query ($id: ID!) { job(id: $id) { id done } }`;
const M_UPSERT = `
mutation ($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
  themeFilesUpsert(themeId: $themeId, files: $files) {
    upsertedThemeFiles { filename }
    job { id done }
    userErrors { field message }
  }
}`;

function gid(id) {
  return String(id).startsWith("gid://") ? String(id) : `gid://shopify/OnlineStoreTheme/${id}`;
}
const numId = (g) => String(g).split("/").pop();

async function pickTheme() {
  const out = await graphql(Q_THEMES);
  const nodes = out.data.themes.nodes;
  console.log("Темы магазина:");
  for (const t of nodes) console.log(`  ${numId(t.id).padEnd(14)} ${t.role.padEnd(12)} ${t.name}`);
  if (THEME_ARG) {
    const t = nodes.find((n) => numId(n.id) === numId(THEME_ARG));
    if (!t) throw new Error(`тема ${THEME_ARG} не найдена`);
    return t;
  }
  const dev = nodes.find((n) => n.role === "DEVELOPMENT") || nodes.find((n) => n.role === "UNPUBLISHED");
  if (dev) return dev;
  const main = nodes.find((n) => n.role === "MAIN");
  if (main && !YES) {
    throw new Error(
      `есть только опубликованная (MAIN) тема "${main.name}". Пуш в live запрещён без --yes.\n` +
        `Вариант: продублируй тему в админке (Online Store → Themes → ... → Duplicate) и укажи --theme <id>,\n` +
        `либо запусти с --yes чтобы писать прямо в MAIN.`,
    );
  }
  if (main) return main;
  throw new Error("подходящая тема не найдена");
}

async function run() {
  const theme = await pickTheme();
  const payload = files.map((f) => {
    const abs = path.join(ROOT, f);
    return { filename: f.replace(/\\/g, "/"), body: { type: "TEXT", value: fs.readFileSync(abs, "utf8") } };
  });
  console.log(`\n-> тема ${numId(theme.id)} "${theme.name}" (${theme.role})`);
  console.log(`   файлы: ${files.join(", ")}`);

  const out = await graphql(M_UPSERT, { themeId: gid(theme.id), files: payload });
  const res = out.data.themeFilesUpsert;
  if (res.userErrors?.length) {
    console.error("✗ userErrors:", JSON.stringify(res.userErrors, null, 2));
    process.exit(1);
  }
  console.log("upserted:", res.upsertedThemeFiles.map((f) => f.filename).join(", ") || "(async)");

  let job = res.job;
  for (let i = 0; job && !job.done && i < 30; i++) {
    await sleep(1500);
    job = (await graphql(Q_JOB, { id: job.id })).data.job;
  }
  console.log("job:", job ? (job.done ? "done" : "still running") : "n/a");

  const id = numId(theme.id);
  console.log(`\nПревью:   https://${STORE}/?preview_theme_id=${id}`);
  console.log(`Редактор: https://admin.shopify.com/store/${slug}/themes/${id}/editor`);
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
