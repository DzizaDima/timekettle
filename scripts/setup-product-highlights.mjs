#!/usr/bin/env node
// Создаёт определение метаполя товара custom.highlights (list.single_line_text_field)
// и заполняет его короткими буллетами для бай-бокса PDP.
// Секция sections/main-pdp.liquid, блок «Key highlights», читает его;
// если метаполя нет — берёт текст из настройки блока.
//
// Использование:  node scripts/setup-product-highlights.mjs [--dry]

import { graphql } from "./shopify.mjs";

const DRY = process.argv.includes("--dry");

const HIGHLIGHTS = {
  "w4-pro-ai-interpreter-earbuds-2026": [
    "Efficient Simultaneous Interpreting",
    "Onsite & Online Meeting Assistant",
    "Phone Call & Video Translation",
    "Audio and Text Saved, Export AI Memo",
    "Open-Ear Design, Comfortable All Day",
    "52 Languages with 106 Accents",
    "13 Pairs of Offline Languages",
  ],
  "w4-ai-interpreter-earbuds": [
    "Bone-Voiceprint Sensor for Voice Capture",
    "Up to 98% Translation Accuracy",
    "0.2s Response, Translation in Seconds",
    "Self-Correcting AI Translation",
    "52 Languages, 106 Accents Supported",
    "Intelligent System Babel OS 2.0",
  ],
  "x1-meeting-interpreter-hub": [
    "Multi-Person Translation in One Conversation",
    "Presentation Mode with Real-Time Subtitles",
    "Listen Mode for Lectures and Meetings",
    "Pocket-Sized Hub, Works with Any Audio Output",
    "52 Languages, 106 Accents Supported",
  ],
  "m3-travel-translator-earbuds": [
    "3-in-1 Translator Earbuds, 43 Languages",
    "Natural, Uninterrupted Interpretation",
    "Three Modes for Travel, Dining and Shopping",
    "13 Offline Language Packs, No Wi-Fi Needed",
    "25-Hour Battery with Charging Case",
  ],
  "fluentalk-t1-handheld-translator-device": [
    "AI Edge-Model, Non-Stop Offline Translation",
    "31+ Offline Language Packs",
    "5 Versatile Translation Modes",
    "52 Languages, 105 Accents",
    "24-Month Free Global Data",
    "Built-in Travel Tools",
  ],
};

async function ensureDefinition() {
  const { data: existing } = await graphql(
    `{ metafieldDefinitions(ownerType: PRODUCT, namespace: "custom", key: "highlights", first: 1) { nodes { id } } }`,
  );
  if (existing.metafieldDefinitions.nodes.length) {
    console.log("= custom.highlights уже существует");
    return;
  }
  if (DRY) return console.log("[dry] создал бы определение custom.highlights");

  const { data: res } = await graphql(
    `mutation Create($d: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $d) {
        createdDefinition { id namespace key type { name } }
        userErrors { field message }
      }
    }`,
    {
      d: {
        name: "Key highlights",
        namespace: "custom",
        key: "highlights",
        description: "Короткие буллеты преимуществ в бай-боксе PDP",
        type: "list.single_line_text_field",
        ownerType: "PRODUCT",
        access: { storefront: "PUBLIC_READ" },
      },
    },
  );
  const errs = res.metafieldDefinitionCreate.userErrors;
  if (errs.length) throw new Error(JSON.stringify(errs));
  console.log("+ создано custom.highlights (list.single_line_text_field)");
}

async function productIdByHandle(handle) {
  const { data: r } = await graphql(`query($h: String!) { productByHandle(handle: $h) { id title } }`, { h: handle });
  return r.productByHandle;
}

await ensureDefinition();

for (const [handle, items] of Object.entries(HIGHLIGHTS)) {
  const p = await productIdByHandle(handle);
  if (!p) {
    console.log(`? ${handle} — товар не найден, пропуск`);
    continue;
  }
  if (DRY) {
    console.log(`[dry] ${handle}: ${items.length} пунктов`);
    continue;
  }
  const { data: res } = await graphql(
    `mutation Set($m: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $m) { metafields { id } userErrors { field message } }
    }`,
    {
      m: [
        {
          ownerId: p.id,
          namespace: "custom",
          key: "highlights",
          type: "list.single_line_text_field",
          value: JSON.stringify(items),
        },
      ],
    },
  );
  const errs = res.metafieldsSet.userErrors;
  if (errs.length) console.error(`✗ ${handle}:`, JSON.stringify(errs));
  else console.log(`✓ ${p.title}: ${items.length} пунктов`);
}
