#!/usr/bin/env node
// Проставляет templateSuffix пяти продуктам (product.<suffix>.json).
// Заработает после коммита темплейтов в тему пользователем.
//
// Использование:  node scripts/set-product-templates.mjs [--unset]

import { graphql } from "./shopify.mjs";

const UNSET = process.argv.includes("--unset");

const MAP = {
  "w4-ai-interpreter-earbuds": "w4",
  "w4-pro-ai-interpreter-earbuds-2026": "w4-pro",
  "x1-meeting-interpreter-hub": "x1",
  "m3-travel-translator-earbuds": "m3",
  "fluentalk-t1-handheld-translator-device": "t1",
};

const Q = `query ($q: String!) { products(first: 1, query: $q) { nodes { id handle templateSuffix } } }`;
const M = `
mutation ($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product { handle templateSuffix }
    userErrors { field message }
  }
}`;

for (const [handle, suffix] of Object.entries(MAP)) {
  const found = await graphql(Q, { q: `handle:${handle}` });
  const p = found.data.products.nodes[0];
  if (!p) {
    console.log(`✗ ${handle}: не найден`);
    continue;
  }
  const value = UNSET ? null : suffix;
  const out = await graphql(M, { product: { id: p.id, templateSuffix: value } });
  const res = out.data.productUpdate;
  if (res.userErrors?.length) {
    console.log(`✗ ${handle}: ${JSON.stringify(res.userErrors)}`);
  } else {
    console.log(`✓ ${handle} -> templateSuffix=${JSON.stringify(res.product.templateSuffix)}`);
  }
}
