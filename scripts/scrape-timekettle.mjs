#!/usr/bin/env node
// Скрейпер продуктов с timekettle.co (публичный storefront) -> scripts/data/products.json
//
// Тянем: название, описание (body_html), фото, цену в GBP (маркет GB), варианты,
// число и рейтинг отзывов (Judge.me SSR: глобал MetafieldReviews на странице).
//
// Использование:  node scripts/scrape-timekettle.mjs
//
// Замечания:
//  - Цены маркета GB: у timekettle.co GB price list численно совпадает с USD,
//    но валюта GBP (price_currency в .json?country=GB). Числа берём как есть.
//  - Богатый контент страницы (page-builder секции) в storefront JSON недоступен —
//    для продуктов с пустым body_html описание задаётся вручную в DESCRIPTION_OVERRIDES.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const OUT_DIR = path.join(ROOT, "scripts", "data");
const OUT_FILE = path.join(OUT_DIR, "products.json");

const HANDLES = [
  "w4-ai-interpreter-earbuds",
  "w4-pro-ai-interpreter-earbuds-2026",
  "x1-meeting-interpreter-hub",
  "m3-travel-translator-earbuds",
  "fluentalk-t1-handheld-translator-device",
];

// Для продуктов, у которых body_html на источнике пустой/бедный.
// Собрано вручную из маркетингового текста страницы продукта.
const DESCRIPTION_OVERRIDES = {
  "x1-meeting-interpreter-hub": `
<p>The X1 Meeting Interpreter Hub is a flagship simultaneous interpretation solution for global business teams and cross-border meetings.</p>
<p>Powered by HybridComm 3.0, the pocket-sized X1 breaks language barriers with seamless, real-time translation. Instantly connect across multiple languages, making it perfect for international collaboration and global communication. Experience transformative technology with versatile modes, adapting to various scenarios from business meetings to social gatherings.</p>
<h5>Key features</h5>
<ul>
<li>Multi-Person Translation &ndash; everyone speaks their own language in the same conversation</li>
<li>Presentation Mode &ndash; real-time subtitles for talks and pitches</li>
<li>Listen Mode &ndash; follow lectures and meetings in your language</li>
<li>Pocket-sized hub, works with earbuds, headphones or speaker output</li>
</ul>`.trim(),
};

const OPT_IGNORE = new Set(["Title"]); // служебная опция Shopify для одновариантных

function isDefaultOnlyOption(opt) {
  return (
    OPT_IGNORE.has(opt.name) &&
    opt.values.length === 1 &&
    opt.values[0] === "Default Title"
  );
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: { "Accept-Language": "en-GB", "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

async function fetchText(url) {
  const r = await fetch(url, { headers: { "Accept-Language": "en-GB", "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.text();
}

function parseReviews(html) {
  // Judge.me кладёт на страницу глобал: MetafieldReviews = {"rating":{...,"value":"4.59"},"rating_count":32};
  const m = html.match(/MetafieldReviews\s*=\s*(\{.*?\})\s*;/s);
  if (!m) return { reviewsCount: null, reviewsRating: null, note: "MetafieldReviews не найден" };
  try {
    const j = JSON.parse(m[1]);
    const count = Number(j?.rating_count ?? j?.ratingCount);
    const rating = Number(j?.rating?.value);
    return {
      reviewsCount: Number.isFinite(count) ? count : null,
      reviewsRating: Number.isFinite(rating) ? Math.round(rating * 10) / 10 : null,
      note: null,
    };
  } catch (e) {
    return { reviewsCount: null, reviewsRating: null, note: "MetafieldReviews не распарсился: " + e.message };
  }
}

function normalize(handle, product, reviews) {
  const realOptions = product.options.filter((o) => !isDefaultOnlyOption(o));
  const hasRealOptions = realOptions.length > 0;

  const options = realOptions.map((o) => ({ name: o.name, values: o.values }));

  const variants = product.variants.map((v) => {
    const optionValues = [];
    if (hasRealOptions) {
      realOptions.forEach((o, i) => {
        const val = v[`option${o.position}`] ?? v[`option${i + 1}`];
        if (val != null) optionValues.push({ optionName: o.name, name: val });
      });
    }
    return {
      title: v.title,
      sku: v.sku || null,
      barcode: v.barcode || null,
      price: v.price, // строка, GBP-маркет
      compareAtPrice: v.compare_at_price || null,
      currency: v.price_currency,
      optionValues,
    };
  });

  const images = product.images.map((im) => im.src);

  const bodyHtml = DESCRIPTION_OVERRIDES[handle] || product.body_html || "";

  return {
    sourceUrl: `https://www.timekettle.co/products/${handle}`,
    handle,
    sourceProductId: product.id,
    title: product.title,
    descriptionHtml: bodyHtml,
    descriptionSource: DESCRIPTION_OVERRIDES[handle]
      ? "manual-override"
      : product.body_html
        ? "source-body_html"
        : "EMPTY",
    vendor: product.vendor || "Timekettle",
    productType: product.product_type || "",
    tags: product.tags || [],
    hasRealOptions,
    options,
    variants,
    images,
    reviewsCount: reviews.reviewsCount,
    reviewsRating: reviews.reviewsRating,
    warnings: [
      ...(reviews.note ? [reviews.note] : []),
      ...(bodyHtml ? [] : ["описание пустое"]),
      ...(variants.some((v) => v.currency !== "GBP") ? ["не все цены в GBP"] : []),
    ],
  };
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const results = [];

  for (const handle of HANDLES) {
    process.stdout.write(`fetch ${handle} ... `);
    const [{ product }, html] = await Promise.all([
      fetchJson(`https://www.timekettle.co/products/${handle}.json?country=GB`),
      fetchText(`https://www.timekettle.co/products/${handle}`),
    ]);
    const reviews = parseReviews(html);
    const p = normalize(handle, product, reviews);
    results.push(p);
    console.log("ok");
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2) + "\n");

  // сводная таблица
  console.log("\n" + "=".repeat(96));
  for (const p of results) {
    const priceSet = [...new Set(p.variants.map((v) => `${v.currency} ${v.price}`))].join(", ");
    console.log(
      `${p.title}\n` +
        `  handle:   ${p.handle}\n` +
        `  price:    ${priceSet}` +
        (p.variants.some((v) => v.compareAtPrice) ? ` (compare-at present)` : ``) +
        `\n` +
        `  variants: ${p.variants.length}${p.hasRealOptions ? ` [${p.options.map((o) => o.name).join(" / ")}]` : ` (single)`}\n` +
        `  images:   ${p.images.length}\n` +
        `  desc:     ${p.descriptionSource} (${p.descriptionHtml.length} chars)\n` +
        `  reviews:  count=${p.reviewsCount} rating=${p.reviewsRating}\n` +
        (p.warnings.length ? `  ⚠ ${p.warnings.join("; ")}\n` : ``),
    );
  }
  console.log(`written -> ${path.relative(ROOT, OUT_FILE)}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
