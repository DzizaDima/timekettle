#!/usr/bin/env node
// Переносит таблицу языков из метаполя ПРОДУКТА custom.language_table
// в метаполе МАГАЗИНА custom.language_table — одно значение на весь сайт,
// доступно в Liquid как shop.metafields.custom.language_table.value
// (и на главной, и на карточке товара, и где угодно).
//
//   node scripts/setup-language-metaobject.mjs          — создать/обновить метаполе магазина
//   node scripts/setup-language-metaobject.mjs --drop   — то же + удалить определение
//                                                          метаполя продукта (со значениями)
//
// Идемпотентно. Источник — самое полное (52 языка) значение среди продуктов.
//
// ПОЧЕМУ НЕ МЕТАОБЪЕКТ: metaobjectDefinitionCreate требует scope
// write_metaobject_definitions, которого у приложения нет
// ("Not authorized. This type is reserved for use by another application").
// Если scope выдать — данные те же, в секции меняется одна строка assign.

import { graphql } from "./shopify.mjs";

const NS = "custom";
const KEY = "language_table";
const DROP = process.argv.includes("--drop");

async function gql(q, v = {}) {
  const r = await graphql(q, v);
  if (r.errors) throw new Error(JSON.stringify(r.errors));
  return r.data;
}

function bail(label, errs) {
  if (errs?.length) {
    console.error(`✗ ${label}:`, JSON.stringify(errs));
    process.exit(1);
  }
}

// ---------- 1. исходные данные ----------
const prods = await gql(`query {
  products(first: 50) {
    nodes { handle metafield(namespace: "${NS}", key: "${KEY}") { value } }
  }
}`);

let source = null;
for (const p of prods.products.nodes) {
  if (!p.metafield?.value) continue;
  const n = JSON.parse(p.metafield.value).languages?.length ?? 0;
  if (!source || n > source.count) source = { count: n, value: p.metafield.value, from: p.handle };
}
if (!source) {
  console.error(`✗ ни у одного продукта нет ${NS}.${KEY} — нечего переносить`);
  process.exit(1);
}
console.log(`источник: ${source.from} (${source.count} языков, ${source.value.length} байт)`);

// ---------- 2. определение метаполя магазина (даёт UI в админке) ----------
const existing = await gql(
  `query{ metafieldDefinitions(first:10, ownerType:SHOP, namespace:"${NS}", key:"${KEY}"){ nodes{ id } } }`
);

if (existing.metafieldDefinitions.nodes.length) {
  console.log(`= определение метаполя магазина ${NS}.${KEY} уже есть`);
} else {
  const res = await gql(
    `mutation($d:MetafieldDefinitionInput!){
      metafieldDefinitionCreate(definition:$d){
        createdDefinition{ id }
        userErrors{ field message code }
      }
    }`,
    {
      d: {
        name: "Language table",
        namespace: NS,
        key: KEY,
        description: "Таблица поддерживаемых языков. Одна на весь сайт (секция languages-scrolling).",
        type: "json",
        ownerType: "SHOP",
        access: { storefront: "PUBLIC_READ" },
      },
    }
  );
  bail("metafieldDefinitionCreate", res.metafieldDefinitionCreate.userErrors);
  console.log(`+ создано определение метаполя магазина ${NS}.${KEY}`);
}

// ---------- 3. значение ----------
const shop = await gql(`query{ shop{ id } }`);
const set = await gql(
  `mutation($m:[MetafieldsSetInput!]!){
    metafieldsSet(metafields:$m){ metafields{ key } userErrors{ field message code } }
  }`,
  { m: [{ ownerId: shop.shop.id, namespace: NS, key: KEY, type: "json", value: source.value }] }
);
bail("metafieldsSet", set.metafieldsSet.userErrors);
console.log(`+ записано shop.metafields.${NS}.${KEY}`);

// ---------- 4. удалить метаполе продукта ----------
if (DROP) {
  const defs = await gql(
    `query{ metafieldDefinitions(first:50, ownerType:PRODUCT, namespace:"${NS}", key:"${KEY}"){ nodes{ id } } }`
  );
  const def = defs.metafieldDefinitions.nodes[0];
  if (!def) {
    console.log(`= метаполя продукта ${NS}.${KEY} уже нет`);
  } else {
    const res = await gql(
      `mutation($id:ID!){
        metafieldDefinitionDelete(id:$id, deleteAllAssociatedMetafields:true){
          deletedDefinitionId userErrors{ field message code }
        }
      }`,
      { id: def.id }
    );
    bail("metafieldDefinitionDelete", res.metafieldDefinitionDelete.userErrors);
    console.log(`− удалено определение метаполя продукта ${NS}.${KEY} (со значениями)`);
  }
} else {
  console.log("· метаполе продукта оставлено; удалить — запустить с --drop");
}
