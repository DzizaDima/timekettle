#!/usr/bin/env node
// Собирает дефолтный шаблон товара templates/product.json.
// Контент — референс timekettle.co/products/w4-pro-ai-interpreter-earbuds-2026
// (уже перенесён в templates/product.w4-pro.json: тексты, FAQ, картинки в Shopify Files).
// Раскладка — наши кастомные секции + секции Dawn в ритме главной:
// белый scheme-1 / лавандовый scheme-3 / тёмный scheme-4, H0-заголовки, отступы 80.
//
// Использование:  node scripts/build-default-pdp.mjs

import fs from "node:fs";

const read = (f) => JSON.parse(fs.readFileSync(f, "utf8").replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ""));
const pro = read("templates/product.w4-pro.json").sections;
const w4 = read("templates/product.w4.json").sections;

const img = (name) => `shopify://shop_images/${name}`;

// [[id, type, settings], ...] → { blocks, block_order }
const blocks = (list) => ({
  blocks: Object.fromEntries(list.map(([id, type, settings]) => [id, { type, settings }])),
  block_order: list.map(([id]) => id),
});

// type — тип блока в ЦЕЛЕВОЙ секции (источник может быть другого типа, напр. collapsible_row → column)
const blocksFrom = (section, type, map) =>
  section.block_order.map((id, i) => [`b${i}`, type, map(section.blocks[id].settings)]);

const ratingLiquid = w4.main.blocks.rating.settings.custom_liquid;

const DETAILS_LIQUID = `{%- if product.description != blank -%}
<div class="product__accordion accordion">
  <details>
    <summary>
      <div class="summary__title"><h2 class="h4 accordion__title">Product details</h2></div>
      {{- 'icon-caret.svg' | inline_asset_content -}}
    </summary>
    <div class="accordion__content rte product__description">{{ product.description }}</div>
  </details>
</div>
{%- endif -%}`;

const sections = {
  main: {
    type: "main-pdp",
    ...blocks([
      ["vendor", "text", { text: "{{ product.vendor }}", text_style: "uppercase" }],
      ["title", "title", {}],
      ["rating", "custom_liquid", { custom_liquid: ratingLiquid }],
      ["price", "price", {}],
      [
        "highlights",
        "highlights",
        {
          items:
            "52 Languages with 106 Accents\nReal-Time AI Translation\nOffline Translation Packs\nUK Warranty and Customer Support",
        },
      ],
      ["variant_picker", "variant_picker", { picker_type: "button", swatch_shape: "circle" }],
      ["quantity_selector", "quantity_selector", {}],
      ["buy_buttons", "buy_buttons", { show_dynamic_checkout: true, show_gift_card_recipient: true }],
      [
        "delivery",
        "delivery",
        {
          order_label: "Order today",
          arrives_label: "Estimated arrival",
          days_min: 1,
          days_max: 2,
          note: "<p>Free UK delivery in 48h, dispatched locally by our UK team.</p>",
        },
      ],
      [
        "trust",
        "icon-with-text",
        {
          layout: "vertical",
          icon_1: "check_mark",
          heading_1: "Authorised UK Distributor",
          icon_2: "chat_bubble",
          heading_2: "UK Customer Support",
          icon_3: "return",
          heading_3: "Warranty Support",
        },
      ],
      // Описание товара — в аккордеоне: у каждого товара своё, но в развёрнутом виде
      // дублировало буллеты highlights и растягивало бай-бокс.
      ["details", "custom_liquid", { custom_liquid: DETAILS_LIQUID }],
      ["share", "share", { share_label: "Share" }],
    ]),
    settings: {
      enable_sticky_info: true,
      color_scheme: "scheme-1",
      media_size: "medium",
      constrain_to_viewport: true,
      media_fit: "contain",
      gallery_layout: "thumbnail_slider",
      mobile_thumbnails: "show",
      media_position: "left",
      image_zoom: "lightbox",
      hide_variants: true,
      enable_video_looping: false,
      padding_top: 40,
      padding_bottom: 80,
    },
  },

  features: {
    type: "icon-cards",
    ...blocks([
      ["f1", "card", { icon: "lightning", title: "Simultaneous Interpreting", text: "Instant real-time interpreting for natural, effortless conversations." }],
      ["f2", "card", { icon: "chat", title: "Phone Call Translation", text: "Two-way call translation with live subtitles — no device needed on the other end." }],
      ["f3", "card", { icon: "play", title: "Video Translation", text: "Translate videos, streams and online meetings with real-time subtitles." }],
      ["f4", "card", { icon: "clipboard", title: "Audio and Text Saved", text: "Keep the original audio and translations, then export an AI memo." }],
    ]),
    settings: {
      color_scheme: "scheme-3",
      heading: "",
      button_label: "",
      button_link: "",
      columns_desktop: 4,
      padding_top: 64,
      padding_bottom: 64,
    },
  },

  intro: {
    type: "rich-text",
    ...blocks([
      ["caption", "caption", { caption: "Your Personal Global Business Assistant", text_style: "caption-with-letter-spacing", text_size: "medium" }],
      ["heading", "heading", { heading: "The World's First Earbuds for Phone & Remote Meeting Translation", heading_size: "h0" }],
      ["text", "text", { text: pro.s02_rich_text.blocks.b1.settings.text }],
    ]),
    settings: {
      desktop_content_position: "center",
      content_alignment: "center",
      color_scheme: "scheme-1",
      full_width: false,
      padding_top: 80,
      padding_bottom: 40,
    },
  },

  scenarios: {
    type: "multicolumn",
    ...blocks(blocksFrom(pro.s03_multicolumn, "column", (s) => ({ image: s.image, title: s.title, text: s.text, link_label: "", link: "" }))),
    settings: {
      title: "",
      heading_size: "h1",
      image_width: "full",
      image_ratio: "adapt",
      columns_desktop: 3,
      column_alignment: "left",
      background_style: "primary",
      button_label: "",
      button_link: "",
      color_scheme: "scheme-1",
      columns_mobile: "1",
      swipe_on_mobile: true,
      padding_top: 40,
      padding_bottom: 80,
    },
  },

  mic: {
    type: "image-text-stat",
    blocks: {},
    block_order: [],
    settings: {
      color_scheme: "scheme-3",
      caption: "Clear Audio Capture",
      heading: "3-Mic Voice Reduce, Precise Pick-up",
      image: img("pp-w4-pro-1cad8cccc2.jpg"),
      body:
        "<p>Precisely capture your voice with 3-Mic Voice Reduction even in side-by-side conversations. The clearer the recognition, the better the translation.</p><p>No sound leakage, clear speaking and listening. CVC technology and 3-Mic Voice Reduce work together to cancel noise for an immersive experience.</p>",
      button_label: "",
      button_link: "",
      show_stat: true,
      stat_number: "50%",
      stat_label: "Lower Recognition Error Rate",
      padding_top: 80,
      padding_bottom: 80,
    },
  },

  modes: {
    type: "multicolumn",
    ...blocks(
      blocksFrom(pro.s06_collapsible_content, "column", (s) => ({ image: "", title: s.heading, text: s.row_content, link_label: "", link: "" })),
    ),
    settings: {
      title: "Three More Modes for Global Business Interactions",
      heading_size: "h0",
      image_width: "full",
      image_ratio: "adapt",
      columns_desktop: 3,
      column_alignment: "left",
      background_style: "primary",
      button_label: "",
      button_link: "",
      color_scheme: "scheme-1",
      columns_mobile: "1",
      swipe_on_mobile: false,
      padding_top: 80,
      padding_bottom: 80,
    },
  },

  ai_banner: {
    type: "image-banner",
    blocks: {},
    block_order: [],
    settings: {
      image: img("pp-w4-pro-28fac5e192.jpg"),
      image_overlay_opacity: 0,
      image_height: "medium",
      image_behavior: "none",
      desktop_content_position: "middle-left",
      desktop_content_alignment: "left",
      show_text_box: false,
      color_scheme: "scheme-4",
      stack_images_on_mobile: false,
      mobile_content_alignment: "left",
      show_text_below: false,
    },
  },

  ai_features: {
    type: "multicolumn",
    ...blocks(blocksFrom(pro.s07_multicolumn, "column", (s) => ({ image: s.image, title: s.title, text: s.text, link_label: "", link: "" }))),
    settings: {
      title: "AI Interpreter Earbuds",
      heading_size: "h0",
      image_width: "full",
      image_ratio: "adapt",
      columns_desktop: 3,
      column_alignment: "left",
      background_style: "none",
      button_label: "",
      button_link: "",
      color_scheme: "scheme-1",
      columns_mobile: "1",
      swipe_on_mobile: true,
      padding_top: 80,
      padding_bottom: 80,
    },
  },

  languages_stats: {
    type: "icon-cards",
    ...blocks([
      ["l1", "card", { icon: "pin", title: "52 Languages", text: "Online translation covering 95% of the world's population." }],
      ["l2", "card", { icon: "chat", title: "106 Accents", text: "Adapts to regional dialects and variations, so locals understand you." }],
      ["l3", "card", { icon: "plane", title: "13 Offline Language Packs", text: "Download packs ahead of your trip and keep translating without a connection." }],
    ]),
    settings: {
      color_scheme: "scheme-3",
      heading: "52 Languages and 106 Accents",
      button_label: "",
      button_link: "",
      columns_desktop: 3,
      padding_top: 80,
      padding_bottom: 0,
    },
  },

  languages: {
    type: "languages-scrolling",
    settings: {
      show_heading: false,
      heading: "",
      subheading: "",
      background: "#eff4ff",
      text_color: "#131313",
      label_color: "#3456e6",
      show_table: true,
      button_background: "#3456e6",
      button_text_color: "#ffffff",
      padding_top: 48,
      padding_bottom: 80,
    },
  },

  extra_intro: {
    type: "rich-text",
    ...blocks([
      ["caption", "caption", { caption: "For the Ultimate User Experience", text_style: "caption-with-letter-spacing", text_size: "medium" }],
      ["heading", "heading", { heading: "Unleashing Additional Features", heading_size: "h0" }],
    ]),
    settings: {
      desktop_content_position: "center",
      content_alignment: "center",
      color_scheme: "scheme-1",
      full_width: false,
      padding_top: 80,
      padding_bottom: 0,
    },
  },

  extra_rows: {
    type: "multirow",
    ...blocks(
      blocksFrom(pro.s11_multirow, "row", (s) => ({ image: s.image, caption: "", heading: s.heading, text: s.text, button_label: "", button_link: "" })),
    ),
    settings: {
      image_height: "medium",
      desktop_image_width: "medium",
      image_layout: "alternate-left",
      heading_size: "h2",
      text_style: "body",
      button_style: "secondary",
      desktop_content_position: "middle",
      desktop_content_alignment: "left",
      mobile_content_alignment: "left",
      section_color_scheme: "scheme-1",
      row_color_scheme: "scheme-1",
      padding_top: 40,
      padding_bottom: 80,
    },
  },

  more_features: {
    type: "multicolumn",
    ...blocks([
      [
        "b0",
        "column",
        {
          image: img("pp-w4-pro-115ef06946.png"),
          title: "Great Sound Quality Sets Us Apart",
          text: "<p>Translation is essential, but great audio makes a difference. Partnered with top music studios, the sound quality rivals other Bluetooth headphones in the same price range.</p>",
          link_label: "",
          link: "",
        },
      ],
      [
        "b1",
        "column",
        {
          image: img("pp-w4-pro-f6398a709e.jpg"),
          title: "Soft & Circular Design",
          text: "<p>Pleasant for long wear. The circular shape fits perfectly around your ear, providing a light and comfortable feel.</p>",
          link_label: "",
          link: "",
        },
      ],
      [
        "b2",
        "column",
        {
          image: img("pp-w4-pro-0058ef85f9.jpg"),
          title: "10-Minute Charge for 1 Hour of Translation",
          text: "<p>Enjoy up to 6 hours of continuous translation. When the battery is low, a quick 10-minute charge gives you an extra hour of translation time.</p>",
          link_label: "",
          link: "",
        },
      ],
    ]),
    settings: {
      title: "Unlocking More Features",
      heading_size: "h0",
      image_width: "full",
      image_ratio: "square",
      columns_desktop: 3,
      column_alignment: "left",
      background_style: "primary",
      button_label: "",
      button_link: "",
      color_scheme: "scheme-3",
      columns_mobile: "1",
      swipe_on_mobile: true,
      padding_top: 80,
      padding_bottom: 80,
    },
  },

  lifestyle_banner: {
    type: "image-banner",
    blocks: {},
    block_order: [],
    settings: {
      image: img("pp-w4-pro-d3226f2bb5.jpg"),
      image_overlay_opacity: 0,
      image_height: "adapt",
      image_behavior: "none",
      desktop_content_position: "middle-left",
      desktop_content_alignment: "left",
      show_text_box: false,
      color_scheme: "scheme-4",
      stack_images_on_mobile: false,
      mobile_content_alignment: "left",
      show_text_below: false,
    },
  },

  compare: {
    type: "featured-products",
    settings: {
      collection: "find-your-timekettle",
      products_to_show: 3,
      columns_desktop: 3,
      caption: "Compare Models",
      title: "Find Your Ideal Translation Earbuds",
      heading_size: "h0",
      button_label: "Compare All Models",
      button_link: "shopify://collections/all",
      color_scheme: "scheme-1",
      padding_top: 80,
      padding_bottom: 80,
    },
  },

  faq: {
    type: "collapsible-content",
    ...blocks(
      blocksFrom(pro.s15_collapsible_content, "collapsible_row", (s) => ({ heading: s.heading, icon: "none", row_content: s.row_content })),
    ),
    settings: {
      caption: "",
      heading: "FAQs",
      heading_size: "h0",
      heading_alignment: "center",
      layout: "none",
      container_color_scheme: "scheme-1",
      color_scheme: "scheme-3",
      open_first_collapsible_row: false,
      image_ratio: "adapt",
      desktop_layout: "image_second",
      padding_top: 80,
      padding_bottom: 80,
    },
  },

  tutorials: {
    type: "multicolumn",
    ...blocks(
      blocksFrom(pro.s17_multicolumn, "column", (s) => ({ image: s.image, title: s.title, text: "", link_label: "", link: "" })).slice(0, 6),
    ),
    settings: {
      title: "Product Tutorials",
      heading_size: "h0",
      image_width: "full",
      image_ratio: "adapt",
      columns_desktop: 3,
      column_alignment: "left",
      background_style: "none",
      button_label: "",
      button_link: "",
      color_scheme: "scheme-1",
      columns_mobile: "1",
      swipe_on_mobile: true,
      padding_top: 80,
      padding_bottom: 40,
    },
  },

  "related-products": {
    type: "related-products",
    settings: {
      heading: "You May Also Like",
      heading_size: "h1",
      products_to_show: 4,
      columns_desktop: 4,
      columns_mobile: "2",
      color_scheme: "scheme-1",
      image_ratio: "square",
      image_shape: "default",
      show_secondary_image: true,
      show_vendor: false,
      show_rating: false,
      padding_top: 40,
      padding_bottom: 80,
    },
  },
};

const template = { sections, order: Object.keys(sections) };

const header = `/*
 * ------------------------------------------------------------
 * IMPORTANT: The contents of this file are auto-generated.
 *
 * This file may be updated by the Shopify admin theme editor
 * or related systems. Please exercise caution as any changes
 * made to this file may be overwritten.
 * ------------------------------------------------------------
 */
`;

fs.writeFileSync("templates/product.json", header + JSON.stringify(template, null, 2) + "\n");
console.log(`templates/product.json — ${template.order.length} sections:`);
for (const k of template.order) {
  const s = sections[k];
  console.log(`  ${k.padEnd(18)} ${s.type.padEnd(20)} blocks=${(s.block_order || []).length}`);
}
