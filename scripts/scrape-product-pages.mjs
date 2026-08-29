#!/usr/bin/env node
// Парсит страницы продуктов timekettle.co через Playwright -> scripts/data/product-pages.json
// Ключевое отличие от наивного парсинга: меряем РАСКЛАДКУ (bounding boxes), чтобы отличить
// сетку из N колонок от полноширинных строк с чередованием картинки лево/право.
//
// Требует: npm install playwright && npx playwright install chromium
// Использование:  node scripts/scrape-product-pages.mjs [w4 m3 ...] [--shots]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const OUT_DIR = path.join(ROOT, "scripts", "data");
const OUT = path.join(OUT_DIR, "product-pages.json");

const PRODUCTS = [
  { suffix: "w4", handle: "w4-ai-interpreter-earbuds", url: "https://www.timekettle.co/products/w4-ai-interpreter-earbuds" },
  { suffix: "w4-pro", handle: "w4-pro-ai-interpreter-earbuds-2026", url: "https://www.timekettle.co/products/w4-pro-ai-interpreter-earbuds-2026" },
  { suffix: "x1", handle: "x1-meeting-interpreter-hub", url: "https://www.timekettle.co/products/x1-meeting-interpreter-hub" },
  { suffix: "m3", handle: "m3-travel-translator-earbuds", url: "https://www.timekettle.co/products/m3-travel-translator-earbuds" },
  { suffix: "t1", handle: "fluentalk-t1-handheld-translator-device", url: "https://www.timekettle.co/products/fluentalk-t1-handheld-translator-device" },
];

const args = process.argv.slice(2);
const SHOTS = args.includes("--shots");
const only = args.filter((a) => !a.startsWith("--"));

// Выполняется в браузере: разбирает страницу на секции с геометрией.
function pageExtractor() {
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const SKIP_ID = /quickview|custom-colors|top-search|back_to_top|predictive|sticky_navbar/;

  // Секции-табы и аккордеоны: контент скрыт (свёрнут/переключается), но он нужен целиком.
  const TAB_TYPES = /aa_content_tab|aa_slider_card|^faq$|help_center|collection_overview/;
  let includeHidden = false;

  // видимость: у timekettle в аккордеонах спрятан контент, он не должен попадать в выдачу
  function visible(el) {
    if (includeHidden) return true;
    if (!el || !el.isConnected) return false;
    if (typeof el.checkVisibility === "function" && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const b = el.getBoundingClientRect();
    if (b.width < 2 || b.height < 2) return false;
    let n = el;
    for (let i = 0; n && i < 12; i++, n = n.parentElement) {
      const st = getComputedStyle(n);
      if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) return false;
      if (st.maxHeight === "0px" || (st.height === "0px" && st.overflow === "hidden")) return false;
    }
    return true;
  }

  // убираем ресайз-параметры CDN, чтобы забирать оригинал
  function fullRes(u) {
    try {
      const url = new URL(u, location.href);
      url.searchParams.delete("width");
      url.searchParams.delete("height");
      return url.toString();
    } catch {
      return u;
    }
  }

  function imgsOf(el, box) {
    const out = [];
    const seen = new Set();
    for (const i of el.querySelectorAll("img")) {
      const b = i.getBoundingClientRect();
      const src = i.currentSrc || i.src || "";
      if (b.width < 40 || b.height < 40) continue;
      if (!visible(i)) continue;
      if (!/cdn\/shop/.test(src)) continue;
      const key = src.split("?")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ src: fullRes(src), w: Math.round(b.width), h: Math.round(b.height), relX: Math.round(b.x - box.x), relY: Math.round(b.y - box.y) });
    }
    // CSS background-image
    for (const n of [el, ...el.querySelectorAll("*")]) {
      const bg = getComputedStyle(n).backgroundImage;
      const m = bg && bg.match(/url\(["']?([^"')]+cdn\/shop\/[^"')]+)["']?\)/);
      if (!m) continue;
      const b = n.getBoundingClientRect();
      if (b.width < 40 || b.height < 40) continue;
      const key = m[1].split("?")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ src: fullRes(m[1]), w: Math.round(b.width), h: Math.round(b.height), relX: Math.round(b.x - box.x), relY: Math.round(b.y - box.y) });
    }
    return out;
  }

  function headingsOf(el) {
    return [...el.querySelectorAll("h1,h2,h3,h4,h5")]
      .filter(visible)
      .map((h) => clean(h.textContent))
      .filter((t) => t.length > 1 && t.length < 220);
  }
  function parasOf(el) {
    const out = [];
    const seen = new Set();
    for (const p of el.querySelectorAll("p,li,div")) {
      if (p.children.length && p.tagName === "DIV") continue; // только листовые div
      if (!visible(p)) continue;
      const t = clean(p.textContent);
      if (t.length < 20 || t.length > 900 || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }

  // Находим контейнер, чьи дети — повторяющиеся «карточки»
  function findItems(sec) {
    const candidates = [];
    const walk = (el, depth) => {
      if (depth > 10) return;
      const kids = [...el.children].filter((c) => {
        const b = c.getBoundingClientRect();
        return b.height > 40 && b.width > 60 && visible(c);
      });
      if (kids.length >= 2) {
        const widths = new Set(kids.map((k) => Math.round(k.getBoundingClientRect().width / 10)));
        if (widths.size <= 2) {
          const withImg = kids.filter((k) => k.querySelector("img")).length;
          const withHead = kids.filter((k) => k.querySelector("h1,h2,h3,h4,h5")).length;
          const area = kids.reduce((a, k) => {
            const b = k.getBoundingClientRect();
            return a + b.width * b.height;
          }, 0);
          candidates.push({ el, kids, withImg, withHead, area, depth });
        }
      }
      for (const c of el.children) walk(c, depth + 1);
    };
    walk(sec, 0);
    if (!candidates.length) return [];
    // приоритет: больше детей С КАРТИНКОЙ, затем больше детей С ЗАГОЛОВКОМ, затем площадь
    candidates.sort((a, b) => b.withImg - a.withImg || b.withHead - a.withHead || b.area - a.area);
    return candidates[0].kids;
  }

  const out = [];
  for (const sec of document.querySelectorAll('[id^="shopify-section-"]')) {
    const rawId = sec.id.replace("shopify-section-", "");
    if (rawId.startsWith("sections--")) continue;
    const afterTpl = rawId.replace(/^template--\d+__/, "");
    if (/^\d/.test(afterTpl) || SKIP_ID.test(afterTpl)) continue;
    const type = afterTpl.replace(/_[A-Za-z0-9]{6}$/, "");
    if (type === "main") continue;
    const box = sec.getBoundingClientRect();
    if (box.height < 60) continue;

    includeHidden = TAB_TYPES.test(type);
    const kids = findItems(sec);
    const items = kids.map((k) => {
      const b = k.getBoundingClientRect();
      const imgs = imgsOf(k, b);
      const headings = headingsOf(k);
      let text = clean(k.textContent);
      for (const h of headings) text = text.replace(h, " ");
      return {
        x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height),
        imgs, headings, paras: parasOf(k),
        text: clean(text).slice(0, 900), // фолбэк, когда абзацы не выделились (напр. ответ FAQ таблицей)
      };
    });

    // текст секции, не попавший в карточки
    const itemText = new Set();
    items.forEach((it) => { it.headings.forEach((t) => itemText.add(t)); it.paras.forEach((t) => itemText.add(t)); });
    const secHeadings = headingsOf(sec).filter((t) => !itemText.has(t));
    const secParas = parasOf(sec).filter((t) => !itemText.has(t));

    out.push({
      type, rawId: afterTpl,
      sectionWidth: Math.round(box.width), sectionHeight: Math.round(box.height),
      secHeadings, secParas,
      items,
      allImages: imgsOf(sec, box).map((i) => i.src),
    });
    includeHidden = false;
  }
  return out;
}

// ---- классификация раскладки по геометрии ----
function classify(sec) {
  const items = sec.items || [];
  const W = sec.sectionWidth || 1440;

  // оверлей-баннер: одна большая картинка на всю ширину, текст поверх неё
  if (sec.type === "image_with_text_overlay") {
    const textish = items.filter((it) => it.headings.length || it.paras.length).length;
    const wide = items.some((it) => it.imgs.some((im) => im.w > W * 0.7));
    if (wide && (items.length <= 2 || textish <= 1)) return { layout: "banner", cols: 1 };
  }
  if (sec.type === "aa_languages_scrolling") return { layout: "marquee", cols: 1 };

  if (!items.length) return { layout: "text", cols: 0 };

  // колонки = уникальные X (с допуском 24px)
  const xs = [];
  for (const it of items) if (!xs.some((x) => Math.abs(x - it.x) < 24)) xs.push(it.x);
  const cols = xs.length;

  const fullWidth = items.filter((it) => it.w > W * 0.6).length;
  const withImg = items.filter((it) => it.imgs.length).length;
  const withText = items.filter((it) => it.headings.length || it.paras.length).length;

  if (cols === 1 && items.length >= 2 && fullWidth >= items.length - 1 && withImg >= 2 && withText >= 2) {
    // полноширинные строки: смотрим, картинка сбоку или сверху
    const sideImages = items.filter((it) => {
      const im = it.imgs[0];
      return im && im.w < it.w * 0.75;
    }).length;
    const alternates = items.some((it) => (it.imgs[0]?.relX || 0) > it.w * 0.3);
    return { layout: sideImages >= 2 ? (alternates ? "rows-alternating" : "rows") : "rows-wide", cols: 1 };
  }
  if (cols >= 2) return { layout: "grid", cols: Math.min(cols, 6) };
  if (items.length >= 3 && withImg === 0) return { layout: "accordion", cols: 1 };
  return { layout: items.length === 1 ? "single" : "rows", cols: 1 };
}

const PROMO = /%\s*OFF|ALL[- ]TIME LOW|LIMITED[- ]TIME|BLACK FRIDAY|CYBER MONDAY|LOWEST .* PRICE|take a quiz|which product is right for you/i;

async function run() {
  const { chromium } = await import("playwright");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();

  const result = {};
  for (const p of PRODUCTS) {
    if (only.length && !only.includes(p.suffix)) continue;
    process.stdout.write(`${p.suffix} … `);
    await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1800);

    let sections = await page.evaluate(pageExtractor);
    // промо/квиз выкидываем
    sections = sections.filter((s) => {
      const probe = [s.secHeadings.join(" "), s.secParas.join(" "), s.items.map((i) => i.headings.join(" ") + " " + i.paras.join(" ")).join(" ")].join(" ");
      return !PROMO.test(probe);
    });
    sections.forEach((s) => Object.assign(s, classify(s)));

    if (SHOTS) {
      const dir = path.join(OUT_DIR, "shots", p.suffix);
      fs.mkdirSync(dir, { recursive: true });
      for (let i = 0; i < sections.length; i++) {
        const el = await page.$(`[id$="${sections[i].rawId}"]`);
        if (!el) continue;
        try {
          await el.scrollIntoViewIfNeeded();
          await page.waitForTimeout(250);
          await el.screenshot({ path: path.join(dir, `${String(i).padStart(2, "0")}-${sections[i].type}.png`) });
        } catch {}
      }
    }

    result[p.suffix] = { ...p, sections };
    console.log(`${sections.length} sections`);
  }
  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1) + "\n");

  console.log("\n" + "=".repeat(92));
  for (const [suf, d] of Object.entries(result)) {
    console.log(`\n### ${suf} (${d.sections.length})`);
    d.sections.forEach((s, i) => {
      const head = (s.secHeadings[0] || s.items[0]?.headings[0] || "").slice(0, 42);
      console.log(
        `  ${String(i).padStart(2)} ${s.type.padEnd(24)} ${String(s.layout).padEnd(18)} cols=${s.cols} items=${String(s.items.length).padStart(2)}  ${JSON.stringify(head)}`,
      );
    });
  }
  console.log(`\nwritten -> ${path.relative(ROOT, OUT)}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
