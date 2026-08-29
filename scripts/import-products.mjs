#!/usr/bin/env node
// Создаёт (или обновляет) продукты в Shopify из scripts/data/products.json.
// Один вызов productSet на продукт: title, описание, vendor, тип, статус ACTIVE,
// опции, варианты (цена/compare-at/sku/barcode), фото (product-level media),
// метаполя custom.reviews_count / custom.reviews_rating.
// Затем публикует в канал Online Store.
//
// Использование:
//   node scripts/import-products.mjs                 # создать недостающие, пропустить существующие
//   node scripts/import-products.mjs --force         # обновить существующие (productSet с id)
//   node scripts/import-products.mjs w4-ai-interpreter-earbuds   # только указанные handle

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { graphql } from "./shopify.mjs";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const DATA = path.join(ROOT, "scripts", "data", "products.json");
const STORE = (fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/SHOPIFY_STORE\s*=\s*(\S+)/) || [])[1] || "";

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const onlyHandles = args.filter((a) => !a.startsWith("--"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const Q_PRODUCT_BY_HANDLE = `
query ($q: String!) {
  products(first: 1, query: $q) {
    nodes { id handle title }
  }
}`;

const Q_PUBLICATIONS = `
query { publications(first: 30) { nodes { id catalog { title } } } }`;

const M_PRODUCT_SET = `
mutation Set($input: ProductSetInput!) {
  productSet(synchronous: true, input: $input) {
    product {
      id
      handle
      status
      variants(first: 20) { nodes { id title price compareAtPrice sku } }
      media(first: 30) { nodes { id status mediaContentType alt } }
      metafields(first: 10, namespace: "custom") { nodes { key value } }
    }
    userErrors { field message code }
  }
}`;

const M_PUBLISH = `
mutation Pub($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    publishable { resourcePublicationsCount { count } }
    userErrors { field message }
  }
}`;

const Q_MEDIA = `
query ($id: ID!) {
  product(id: $id) {
    media(first: 40) { nodes { id status ... on MediaImage { image { url } } } }
  }
}`;

function buildInput(p) {
  const input = {
    handle: p.handle,
    title: p.title,
    descriptionHtml: p.descriptionHtml || "",
    vendor: p.vendor || "Timekettle",
    productType: p.productType || "",
    status: "ACTIVE",
    tags: p.tags || [],
    files: p.images.map((src) => ({
      originalSource: src,
      contentType: "IMAGE",
      alt: p.title,
    })),
  };

  if (p.hasRealOptions) {
    input.productOptions = p.options.map((o) => ({
      name: o.name,
      values: o.values.map((v) => ({ name: v })),
    }));
    input.variants = p.variants.map((v) => {
      const vi = {
        optionValues: v.optionValues.map((ov) => ({ optionName: ov.optionName, name: ov.name })),
        price: v.price,
      };
      if (v.compareAtPrice) vi.compareAtPrice = v.compareAtPrice;
      if (v.sku || v.barcode) {
        vi.inventoryItem = {};
        if (v.sku) vi.inventoryItem.sku = v.sku;
      }
      if (v.barcode) vi.barcode = v.barcode;
      return vi;
    });
  } else {
    // Продукт без реальных опций — Shopify требует служебную опцию Title/Default Title.
    input.productOptions = [{ name: "Title", values: [{ name: "Default Title" }] }];
    const v = p.variants[0];
    const vi = {
      optionValues: [{ optionName: "Title", name: "Default Title" }],
      price: v.price,
    };
    if (v.compareAtPrice) vi.compareAtPrice = v.compareAtPrice;
    if (v.sku) vi.inventoryItem = { sku: v.sku };
    if (v.barcode) vi.barcode = v.barcode;
    input.variants = [vi];
  }

  const mf = [];
  if (p.reviewsCount != null)
    mf.push({ namespace: "custom", key: "reviews_count", type: "number_integer", value: String(p.reviewsCount) });
  if (p.reviewsRating != null)
    mf.push({ namespace: "custom", key: "reviews_rating", type: "number_decimal", value: String(p.reviewsRating) });
  if (mf.length) input.metafields = mf;

  return input;
}

async function getOnlineStorePublicationId() {
  const out = await graphql(Q_PUBLICATIONS);
  const nodes = out.data.publications.nodes;
  const title = (n) => n.catalog?.title || "";
  const os = nodes.find((n) => title(n) === "Online Store") || nodes.find((n) => /online store/i.test(title(n)));
  if (!os) throw new Error("канал Online Store не найден среди publications: " + nodes.map(title).join(", "));
  return os.id;
}

async function findExisting(handle) {
  const out = await graphql(Q_PRODUCT_BY_HANDLE, { q: `handle:${handle}` });
  return out.data.products.nodes[0] || null;
}

async function waitMedia(productId, { tries = 20, delay = 3000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const out = await graphql(Q_MEDIA, { id: productId });
    const nodes = out.data.product.media.nodes;
    const pending = nodes.filter((n) => n.status !== "READY" && n.status !== "FAILED");
    if (pending.length === 0) {
      return {
        ready: nodes.filter((n) => n.status === "READY").length,
        failed: nodes.filter((n) => n.status === "FAILED").length,
        total: nodes.length,
      };
    }
    await sleep(delay);
  }
  return { timeout: true };
}

async function importOne(p, publicationId) {
  const label = `[${p.handle}]`;
  const existing = await findExisting(p.handle);
  if (existing && !FORCE) {
    console.log(`${label} уже существует (${existing.id}) — пропуск (--force для обновления)`);
    return;
  }

  const input = buildInput(p);
  if (existing) input.id = existing.id;

  const out = await graphql(M_PRODUCT_SET, { input });
  const res = out.data.productSet;
  if (res.userErrors?.length) {
    console.error(`${label} ✗ productSet userErrors:`, JSON.stringify(res.userErrors, null, 2));
    return;
  }
  const prod = res.product;
  console.log(`${label} ${existing ? "обновлён" : "создан"} ${prod.id}`);

  // дождаться обработки медиа
  const media = await waitMedia(prod.id);
  if (media.timeout) console.log(`${label}   медиа: таймаут ожидания обработки`);
  else console.log(`${label}   медиа: ${media.ready}/${media.total} READY${media.failed ? `, ${media.failed} FAILED` : ""}`);

  // публикация в Online Store
  const pub = await graphql(M_PUBLISH, { id: prod.id, input: [{ publicationId }] });
  if (pub.data.publishablePublish.userErrors?.length) {
    console.error(`${label}   ✗ publish:`, JSON.stringify(pub.data.publishablePublish.userErrors));
  } else {
    console.log(`${label}   опубликован в Online Store`);
  }

  const mfPairs = (prod.metafields?.nodes || []).map((m) => `${m.key}=${m.value}`).join(", ");
  const slug = STORE.replace(/\.myshopify\.com$/, "");
  console.log(
    `${label}   variants: ${prod.variants.nodes.length}, metafields: ${mfPairs || "(нет)"}\n` +
      `${label}   admin: https://admin.shopify.com/store/${slug}/products/${prod.id.split("/").pop()}\n` +
      `${label}   storefront: https://${STORE}/products/${prod.handle}`,
  );
}

async function run() {
  let products = JSON.parse(fs.readFileSync(DATA, "utf8"));
  if (onlyHandles.length) products = products.filter((p) => onlyHandles.includes(p.handle));
  if (!products.length) throw new Error("нет продуктов для импорта");

  const publicationId = await getOnlineStorePublicationId();
  console.log(`Online Store publication: ${publicationId}\n`);

  for (const p of products) {
    try {
      await importOne(p, publicationId);
    } catch (e) {
      console.error(`[${p.handle}] ✗`, e.message);
    }
    console.log("");
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
