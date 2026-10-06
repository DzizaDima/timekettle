#!/usr/bin/env node
// Возможности переводчиков (иконки на карточках / Key Features на PDP), статус наличия
// и коллекции Online / Offline Translators.
//
//   custom.capabilities  — list.single_line_text_field, choices:
//                          online / offline / conversation / hands_free / meetings
//                          (рендер — snippets/capability-icons.liquid, порядок вывода фиксирован там)
//   custom.stock_status  — single_line_text_field, choices: uk_stock / to_order
//                          (пусто = uk_stock; текст — snippets/stock-badge.liquid)
//
// Коллекции — ручные (MANUAL sort), публикуются в Online Store.
//
// Использование:  node scripts/setup-capabilities.mjs
// Идемпотентно: определения/коллекции, которые уже есть, не пересоздаются; значения перезаписываются.

import { graphql } from "./shopify.mjs";

const CAPABILITIES = ["online", "offline", "conversation", "hands_free", "meetings"];

const PRODUCTS = {
  "w4-pro-ai-interpreter-earbuds-2026": { capabilities: ["online", "offline", "conversation", "hands_free"], stock: "uk_stock" },
  "w4-plus-ai-interpreter-earbuds": { capabilities: ["online", "offline", "conversation", "hands_free"], stock: "uk_stock" },
  "w4-ai-interpreter-earbuds": { capabilities: ["online", "offline", "conversation", "hands_free"], stock: "uk_stock" },
  "x1-meeting-interpreter-hub": { capabilities: ["online", "offline", "conversation", "meetings"], stock: "to_order" },
  "fluentalk-t1-handheld-translator-device": { capabilities: ["online", "offline", "conversation"], stock: "uk_stock" },
  "m3-travel-translator-earbuds": { capabilities: ["online", "offline", "conversation"], stock: "uk_stock" },
};

const COLLECTIONS = [
  {
    handle: "online-translators",
    title: "Online Translators",
    descriptionHtml:
      "<p>AI translators that use a cloud connection for the most accurate real-time translation in 52 languages and 106 accents.</p>",
    products: ["w4-pro-ai-interpreter-earbuds-2026", "w4-plus-ai-interpreter-earbuds", "x1-meeting-interpreter-hub"],
  },
  {
    handle: "offline-translators",
    title: "Offline Translators",
    descriptionHtml:
      "<p>Translators that keep working with no Wi-Fi or mobile data — download offline language packs before you travel.</p>",
    products: [
      "fluentalk-t1-handheld-translator-device",
      "w4-pro-ai-interpreter-earbuds-2026",
      "w4-plus-ai-interpreter-earbuds",
      "x1-meeting-interpreter-hub",
    ],
  },
];

const DEFINITIONS = [
  {
    name: "Capabilities",
    key: "capabilities",
    type: "list.single_line_text_field",
    description: "Что умеет переводчик (иконки): online, offline, conversation, hands_free, meetings.",
    validations: [{ name: "choices", value: JSON.stringify(CAPABILITIES) }],
  },
  {
    name: "Stock status",
    key: "stock_status",
    type: "single_line_text_field",
    description: "uk_stock — «In Stock — UK Warehouse»; to_order — «Available to Order — Approx. 14 Days». Пусто = uk_stock.",
    validations: [{ name: "choices", value: JSON.stringify(["uk_stock", "to_order"]) }],
  },
];

function check(label, res) {
  if (res?.userErrors?.length) {
    console.log(`✗ ${label}: ${JSON.stringify(res.userErrors)}`);
    return false;
  }
  return true;
}

// 1. Определения метаполей
for (const d of DEFINITIONS) {
  const out = await graphql(
    `mutation ($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id }
        userErrors { field message code }
      }
    }`,
    { definition: { ...d, namespace: "custom", ownerType: "PRODUCT", pin: true } },
  );
  const res = out.data.metafieldDefinitionCreate;
  if (res.userErrors?.some((e) => e.code === "TAKEN")) console.log(`· definition custom.${d.key}: уже есть`);
  else if (check(`definition custom.${d.key}`, res)) console.log(`✓ definition custom.${d.key}`);
}

// 2. id товаров
const ids = {};
for (const handle of Object.keys(PRODUCTS)) {
  const out = await graphql(`query ($h: String!) { productByHandle: productByIdentifier(identifier: { handle: $h }) { id } }`, {
    h: handle,
  });
  const id = out.data.productByHandle?.id;
  if (!id) throw new Error(`Товар не найден: ${handle}`);
  ids[handle] = id;
}

// 3. Значения метаполей
const metafields = Object.entries(PRODUCTS).flatMap(([handle, p]) => [
  { ownerId: ids[handle], namespace: "custom", key: "capabilities", type: "list.single_line_text_field", value: JSON.stringify(p.capabilities) },
  { ownerId: ids[handle], namespace: "custom", key: "stock_status", type: "single_line_text_field", value: p.stock },
]);
{
  const out = await graphql(
    `mutation ($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { metafields { key } userErrors { field message } } }`,
    { m: metafields },
  );
  if (check("metafieldsSet", out.data.metafieldsSet)) console.log(`✓ metafields: ${out.data.metafieldsSet.metafields.length}`);
}

// 4. Коллекции
const pubs = await graphql(`{ publications(first: 20) { nodes { id name } } }`);
const onlineStore = pubs.data.publications.nodes.find((p) => p.name === "Online Store");
if (!onlineStore) throw new Error("Online Store publication не найдена");

for (const c of COLLECTIONS) {
  const found = await graphql(`query ($h: String!) { collectionByIdentifier(identifier: { handle: $h }) { id } }`, { h: c.handle });
  let id = found.data.collectionByIdentifier?.id;
  if (!id) {
    const out = await graphql(
      `mutation ($input: CollectionInput!) { collectionCreate(input: $input) { collection { id } userErrors { field message } } }`,
      {
        input: {
          handle: c.handle,
          title: c.title,
          descriptionHtml: c.descriptionHtml,
          sortOrder: "MANUAL",
          products: c.products.map((h) => ids[h]),
        },
      },
    );
    if (!check(`collection ${c.handle}`, out.data.collectionCreate)) continue;
    id = out.data.collectionCreate.collection.id;
    console.log(`✓ collection ${c.handle} создана`);
  } else {
    // уже есть: досыпаем недостающие товары и выставляем порядок
    const add = await graphql(
      `mutation ($id: ID!, $p: [ID!]!) { collectionAddProductsV2(id: $id, productIds: $p) { userErrors { field message } } }`,
      { id, p: c.products.map((h) => ids[h]) },
    );
    const errs = add.data.collectionAddProductsV2.userErrors.filter((e) => !/already/i.test(e.message));
    if (errs.length) console.log(`✗ collection ${c.handle} add: ${JSON.stringify(errs)}`);
    const moves = c.products.map((h, i) => ({ id: ids[h], newPosition: String(i) }));
    const re = await graphql(
      `mutation ($id: ID!, $moves: [MoveInput!]!) { collectionReorderProducts(id: $id, moves: $moves) { userErrors { field message } } }`,
      { id, moves },
    );
    check(`collection ${c.handle} reorder`, re.data.collectionReorderProducts);
    console.log(`· collection ${c.handle}: уже есть, состав/порядок синхронизированы`);
  }

  const pub = await graphql(
    `mutation ($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { field message } } }`,
    { id, input: [{ publicationId: onlineStore.id }] },
  );
  if (check(`publish ${c.handle}`, pub.data.publishablePublish)) console.log(`✓ ${c.handle} опубликована в Online Store`);
}
