#!/usr/bin/env node
// Забирает с timekettle.co данные секции «Covering the World, Accent by Accent»:
// список языков с флагами (инлайновый SVG или картинка) + детальную таблицу
// (язык / онлайн / акценты / офлайн). Результат -> scripts/data/language-tables.json
//
// Использование:  node scripts/scrape-languages.mjs [w4 m3 ...]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const OUT = path.join(ROOT, "scripts", "data", "language-tables.json");

const PRODUCTS = {
  w4: "https://www.timekettle.co/products/w4-ai-interpreter-earbuds",
  "w4-pro": "https://www.timekettle.co/products/w4-pro-ai-interpreter-earbuds-2026",
  x1: "https://www.timekettle.co/products/x1-meeting-interpreter-hub",
  m3: "https://www.timekettle.co/products/m3-travel-translator-earbuds",
  t1: "https://www.timekettle.co/products/fluentalk-t1-handheld-translator-device",
};

const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

function extractor() {
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const sec = [...document.querySelectorAll('[id*="aa_languages_scrolling"]')][0];
  if (!sec) return null;

  // 1. чипы бегущей строки: имя + разметка флага
  const chips = [];
  const seen = new Set();
  for (const c of sec.querySelectorAll('[class*="language-scroll-item"]')) {
    const nameEl = c.querySelector('[class*="language-name-scroll"]');
    const name = clean(nameEl?.textContent);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const svg = c.querySelector("svg");
    const img = c.querySelector("img");
    chips.push({
      name,
      svg: svg ? svg.outerHTML.replace(/\s+/g, " ").trim() : null,
      img: img ? (img.currentSrc || img.src).split("?")[0] : null,
    });
  }

  // 2. детальная таблица из попапа
  const header = clean(document.querySelector('[class*="table-header-popup"]')?.textContent || "");
  const rows = [];
  for (const r of document.querySelectorAll(".table-row-popup")) {
    const cells = [...r.children].map((c) => clean(c.textContent));
    if (!cells.length || !cells[0]) continue;
    const flagEl = r.querySelector("svg, img");
    rows.push({
      name: cells[0],
      online: cells[1] || "",
      accents: cells[2] || "",
      offline: cells[3] || "",
      svg: flagEl && flagEl.tagName.toLowerCase() === "svg" ? flagEl.outerHTML.replace(/\s+/g, " ").trim() : null,
      img: flagEl && flagEl.tagName.toLowerCase() === "img" ? (flagEl.currentSrc || flagEl.src).split("?")[0] : null,
    });
  }

  const h = sec.querySelector("h1,h2,h3");
  const p = [...sec.querySelectorAll("p")].find((x) => clean(x.textContent).length > 20);
  const btn = [...sec.querySelectorAll("*")].find((e) => /^\+?\s*View Detailed Language Table$/i.test(clean(e.textContent)));

  return {
    heading: clean(h?.textContent),
    subheading: clean(p?.textContent),
    buttonLabel: clean(btn?.textContent) || "View Detailed Language Table",
    tableHeader: header,
    chips,
    rows,
  };
}

async function run() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route("**/*", (r) =>
    /klaviyo|privy|gorgias|tidio|zendesk|intercom|userway|hotjar|clarity/i.test(r.request().url()) ? r.abort() : r.continue(),
  );
  const page = await ctx.newPage();

  const out = {};
  for (const [suffix, url] of Object.entries(PRODUCTS)) {
    if (only.length && !only.includes(suffix)) continue;
    process.stdout.write(`${suffix} … `);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
    });
    await page.waitForTimeout(1200);
    const data = await page.evaluate(extractor);
    if (!data) { console.log("секция не найдена"); continue; }
    out[suffix] = data;
    const withFlag = data.chips.filter((c) => c.svg || c.img).length;
    console.log(`языков ${data.chips.length} (с флагом ${withFlag}), строк таблицы ${data.rows.length}`);
  }
  await browser.close();

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
  const bytes = fs.statSync(OUT).size;
  console.log(`\nwritten -> ${path.relative(ROOT, OUT)} (${(bytes / 1024).toFixed(0)} KB)`);
}

run().catch((e) => { console.error(e); process.exit(1); });
