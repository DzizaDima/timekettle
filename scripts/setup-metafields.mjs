#!/usr/bin/env node
// Однократно: создаёт определения метаполей продукта под фейковые отзывы.
//   custom.reviews_count  — number_integer
//   custom.reviews_rating — number_decimal
//
// Использование:  node scripts/setup-metafields.mjs
// Идемпотентно: если определение уже есть — пропускает без ошибки.

import { graphql } from "./shopify.mjs";

const DEFINITIONS = [
  {
    name: "Reviews count",
    namespace: "custom",
    key: "reviews_count",
    type: "number_integer",
    description: "Количество отзывов (витринное, отзывы фейковые).",
  },
  {
    name: "Reviews rating",
    namespace: "custom",
    key: "reviews_rating",
    type: "number_decimal",
    description: "Средний рейтинг отзывов, 1.0–5.0 (витринный).",
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
      namespace: d.namespace,
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
      console.log(`= ${d.namespace}.${d.key} уже существует — пропуск`);
    } else {
      console.error(`✗ ${d.namespace}.${d.key}:`, JSON.stringify(errs));
      process.exitCode = 1;
    }
  } else {
    console.log(`+ создано ${res.createdDefinition.namespace}.${res.createdDefinition.key} (${res.createdDefinition.type.name})`);
  }
}
