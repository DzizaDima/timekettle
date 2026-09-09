#!/usr/bin/env node
// Однократно: определения метаполей продукта для секции "Featured products"
// (sections/featured-products.liquid) — карточки "Find Your Timekettle".
//   custom.card_title      — single_line_text_field  (короткое имя, "W4 Pro")
//   custom.card_badge      — single_line_text_field  ("Best for Travel")
//   custom.card_badge_icon — single_line_text_field  (chat/star/plane/truck/check/heart/lock/discount)
//   custom.card_blurb      — multi_line_text_field   (1–2 предложения)
//
// Использование:  node scripts/setup-card-metafields.mjs
// Идемпотентно: существующие определения пропускаются.

import { graphql } from "./shopify.mjs";

const DEFINITIONS = [
  {
    name: "Card title",
    key: "card_title",
    type: "single_line_text_field",
    description: "Короткое имя товара для карточки на главной (напр. «W4 Pro»). Пусто — берётся название товара.",
  },
  {
    name: "Card badge",
    key: "card_badge",
    type: "single_line_text_field",
    description: "Подпись плашки на карточке (напр. «Best for Travel»). Пусто — плашки нет.",
  },
  {
    name: "Card badge icon",
    key: "card_badge_icon",
    type: "single_line_text_field",
    description: "Иконка плашки: chat, star, plane, truck, check, heart, lock, discount.",
  },
  {
    name: "Card blurb",
    key: "card_blurb",
    type: "multi_line_text_field",
    description: "1–2 предложения описания для карточки. Пусто — берётся начало описания товара.",
  },
];

const MUTATION = `
mutation CreateDef($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition { id name namespace key type { name } }
    userErrors { field message code }
  }
}`;

for (const d of DEFINITIONS) {
  const out = await graphql(MUTATION, {
    definition: {
      name: d.name,
      namespace: "custom",
      key: d.key,
      description: d.description,
      type: d.type,
      ownerType: "PRODUCT",
      pin: true,
    },
  });
  const res = out.data.metafieldDefinitionCreate;
  const errs = res.userErrors || [];
  if (errs.length) {
    const taken = errs.some((e) => e.code === "TAKEN" || /taken|already/i.test(e.message));
    if (taken) {
      console.log(`= custom.${d.key} уже существует — пропуск`);
    } else {
      console.error(`✗ custom.${d.key}:`, JSON.stringify(errs));
      process.exitCode = 1;
    }
  } else {
    console.log(`+ создано custom.${res.createdDefinition.key} (${res.createdDefinition.type.name})`);
  }
}
