#!/usr/bin/env node
// Тонкая обёртка над Shopify Admin GraphQL API.
// Аутентификация: client credentials grant (Dev Dashboard app), токен кэшируется в .shopify-token.json.
//
// Использование:
//   node scripts/shopify.mjs graphql '<query>' '<varsJson?>'
//   node scripts/shopify.mjs gql-file path/to/query.graphql '<varsJson?>'
//   node scripts/shopify.mjs create-product path/to/product.json
//
// product.json — это input для мутации productCreate, например:
//   { "title": "Пример", "status": "DRAFT", "productType": "Translator",
//     "vendor": "Timekettle", "descriptionHtml": "<p>...</p>" }

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const TOKEN_CACHE = path.join(ROOT, ".shopify-token.json");

function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) throw new Error(".env.local не найден");
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const ENV = loadEnv();
const STORE = ENV.SHOPIFY_STORE;
const API_VERSION = ENV.SHOPIFY_API_VERSION || "2026-07";

async function getToken() {
  try {
    const c = JSON.parse(fs.readFileSync(TOKEN_CACHE, "utf8"));
    if (c.store === STORE && c.expiresAt - Date.now() > 60_000) return c.access_token;
  } catch {}
  const res = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: ENV.SHOPIFY_CLIENT_ID,
      client_secret: ENV.SHOPIFY_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`token grant failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  fs.writeFileSync(
    TOKEN_CACHE,
    JSON.stringify({ store: STORE, access_token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 }),
  );
  return j.access_token;
}

export async function graphql(query, variables) {
  const token = await getToken();
  const res = await fetch(`https://${STORE}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: variables || {} }),
  });
  const j = await res.json();
  if (j.errors) throw new Error("GraphQL errors: " + JSON.stringify(j.errors, null, 2));
  return j;
}

const PRODUCT_CREATE = `
mutation CreateProduct($product: ProductCreateInput!) {
  productCreate(product: $product) {
    product { id title handle status onlineStoreUrl }
    userErrors { field message }
  }
}`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "graphql") {
    const out = await graphql(rest[0], rest[1] ? JSON.parse(rest[1]) : {});
    console.log(JSON.stringify(out, null, 2));
  } else if (cmd === "gql-file") {
    const q = fs.readFileSync(rest[0], "utf8");
    const out = await graphql(q, rest[1] ? JSON.parse(rest[1]) : {});
    console.log(JSON.stringify(out, null, 2));
  } else if (cmd === "create-product") {
    const product = JSON.parse(fs.readFileSync(rest[0], "utf8"));
    const out = await graphql(PRODUCT_CREATE, { product });
    console.log(JSON.stringify(out.data.productCreate, null, 2));
    const errs = out.data.productCreate.userErrors;
    if (errs.length) process.exitCode = 1;
  } else {
    console.error("commands: graphql | gql-file | create-product");
    process.exitCode = 2;
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
