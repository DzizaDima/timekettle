// Контент home-страницы по образцу https://www.timekettle.co/ (снимок текущей версии).
// Чистые данные: build-home.mjs превращает их в templates/index.json, подставляя
// ссылки на картинки, загруженные в Files.
//
// image: "<key>"  -> ключ из IMAGE_SOURCES; build-home.mjs заменит на
//                    "shopify://shop_images/home-<key>.<ext>"

export const PRODUCT_URL = {
  w4: "shopify://products/w4-ai-interpreter-earbuds",
  w4pro: "shopify://products/w4-pro-ai-interpreter-earbuds-2026",
  x1: "shopify://products/x1-meeting-interpreter-hub",
  m3: "shopify://products/m3-travel-translator-earbuds",
  t1: "shopify://products/fluentalk-t1-handheld-translator-device",
};
export const ALL = "shopify://collections/all";

// key -> исходный URL картинки на CDN timekettle (полное разрешение: ?v= оставляем, &width= убираем)
export const IMAGE_SOURCES = {
  "hero-x1": "https://www.timekettle.co/cdn/shop/files/1-PC_baa5f911-7b4d-4b49-81a5-2c39182f282a.jpg?v=1781623674",
  "hero-x1-mobile": "https://www.timekettle.co/cdn/shop/files/1-m_1580e0a8-92af-4324-b4a5-f7f3b3a97cec.jpg?v=1781623673",
  "w4": "https://www.timekettle.co/cdn/shop/files/W4...jpg?v=1756978464",
  "card-w4pro": "https://www.timekettle.co/cdn/shop/files/W4-Pro_51531828-ffe8-47c9-bdb0-d3ba37d65437.jpg?v=1748329486",
  "card-x1": "https://www.timekettle.co/cdn/shop/files/X1..jpg?v=1781765070",
  "card-m3": "https://www.timekettle.co/cdn/shop/files/M3_4bea56bc-5b28-4be2-a429-2a3def96ae11.jpg?v=1748329486",
  "card-t1": "https://www.timekettle.co/cdn/shop/files/T1_e3ebac21-7485-4db3-9544-10f8f782f888.jpg?v=1748329486",
  "usecase-call": "https://www.timekettle.co/cdn/shop/files/1_ff9ab217-db82-405e-ad6e-1bea485675d8_2000x.jpg?v=1748310140",
  "usecase-meeting": "https://www.timekettle.co/cdn/shop/files/2_f7b43558-94fe-49d3-b175-218090a21f03_2000x.jpg?v=1748310141",
  "usecase-media": "https://www.timekettle.co/cdn/shop/files/3_b66cd4ba-bb13-4783-a65f-1f586a460d04_2000x.jpg?v=1748578345",
  "perks": "https://www.timekettle.co/cdn/shop/files/community.jpg?v=1769581518",
  "perks-mobile": "https://www.timekettle.co/cdn/shop/files/community_m.jpg?v=1769581517",
  "business": "https://www.timekettle.co/cdn/shop/files/2024-08-05W4_Pro_0515_P_1_9d6d73ea-10f0-49a0-be70-51d47cbfd9df_1500x.jpg?v=1748242261",
};

// Порядок и настройки секций. Тип = имя стоковой секции Dawn (sections/<type>.liquid).
export const SECTIONS = [
  // 1. Hero — X1 (image_with_text_overlay_Wj3QKk)
  {
    key: "hero_x1",
    type: "image-banner",
    settings: {
      image: "hero-x1",
      image_2: "hero-x1-mobile",
      image_overlay_opacity: 30,
      image_height: "large",
      desktop_content_position: "middle-left",
      desktop_content_alignment: "left",
      show_text_box: true,
      color_scheme: "scheme-3",
      mobile_content_alignment: "left",
      stack_images_on_mobile: false,
      show_text_below: false,
    },
    blocks: [
      { type: "text", settings: { text: "Real-Time AI Interpretation for Multi-Person, Multi-Language Meetings", text_style: "caption-with-letter-spacing" } },
      { type: "heading", settings: { heading: "X1 Meeting Interpreter Hub", heading_size: "h1" } },
      { type: "buttons", settings: { button_label_1: "See More", button_link_1: PRODUCT_URL.x1, button_style_secondary_1: false } },
    ],
  },

  // 2. X1 подробно (rich_text_JkmMbz)
  {
    key: "x1_detail",
    type: "rich-text",
    settings: { desktop_content_position: "center", content_alignment: "center", color_scheme: "scheme-1", full_width: true },
    blocks: [
      { type: "caption", settings: { caption: "Real-Time AI Interpretation for Multi-Person, Multi-Language Meetings", text_style: "caption-with-letter-spacing", text_size: "medium" } },
      { type: "heading", settings: { heading: "X1 Meeting Interpreter Hub", heading_size: "h1" } },
      { type: "text", settings: { text: "<p>Designed specifically for meetings and K12 multilingual classrooms, this solution supports up to 50 participants across 5 languages for seamless real-time interaction. No app installation is required, and setup is extremely straightforward. Powered by bone-conduction voice capture technology, it ensures accurate translation even in noisy environments. With support for 52 languages and 106 accents, there are no subscription fees, and free OTA updates are included for life.</p>" } },
      { type: "button", settings: { button_label: "See More", button_link: PRODUCT_URL.x1, button_style_secondary: true } },
    ],
  },

  // 3. W4 bone-conduction (image_with_text_overlay_3N4Lep)
  {
    key: "w4_banner",
    type: "image-banner",
    settings: {
      image: "w4",
      image_overlay_opacity: 40,
      image_height: "large",
      desktop_content_position: "middle-left",
      desktop_content_alignment: "left",
      show_text_box: true,
      color_scheme: "scheme-3",
      mobile_content_alignment: "left",
      stack_images_on_mobile: false,
      show_text_below: false,
    },
    blocks: [
      { type: "text", settings: { text: "Timekettle W4", text_style: "caption-with-letter-spacing" } },
      { type: "heading", settings: { heading: "The World's First Bone-Conduction Interpreter Earbuds", heading_size: "h1" } },
      { type: "buttons", settings: { button_label_1: "Find W4", button_link_1: PRODUCT_URL.w4, button_style_secondary_1: false } },
    ],
  },

  // 4. Карточки продуктов (aa-image_cards_RX7Hw6)
  {
    key: "product_cards",
    type: "multicolumn",
    settings: {
      title: "Meet the Timekettle Family",
      heading_size: "h2",
      image_width: "full",
      image_ratio: "adapt",
      columns_desktop: 5,
      column_alignment: "center",
      background_style: "none",
      color_scheme: "scheme-1",
      columns_mobile: "2",
      swipe_on_mobile: true,
    },
    blocks: [
      { type: "column", settings: { image: "w4", title: "W4", text: "<p>AI Interpreter Earbuds</p>", link_label: "Shop W4", link: PRODUCT_URL.w4 } },
      { type: "column", settings: { image: "card-w4pro", title: "W4 Pro", text: "<p>AI Interpreter Earbuds</p>", link_label: "Shop W4 Pro", link: PRODUCT_URL.w4pro } },
      { type: "column", settings: { image: "card-x1", title: "X1 Meeting", text: "<p>Meeting Interpreter Hub</p>", link_label: "Shop X1", link: PRODUCT_URL.x1 } },
      { type: "column", settings: { image: "card-m3", title: "M3", text: "<p>Language Translator Earbuds</p>", link_label: "Shop M3", link: PRODUCT_URL.m3 } },
      { type: "column", settings: { image: "card-t1", title: "NEW T1", text: "<p>Handheld Translator Device</p>", link_label: "Shop T1", link: PRODUCT_URL.t1 } },
    ],
  },

  // 5. Лид-ин W4 Pro (rich_text_fC6TpM)
  {
    key: "w4pro_leadin",
    type: "rich-text",
    settings: { desktop_content_position: "center", content_alignment: "center", color_scheme: "scheme-2", full_width: true },
    blocks: [
      { type: "caption", settings: { caption: "W4 Pro AI Interpreter Earbuds", text_style: "caption-with-letter-spacing", text_size: "medium" } },
      { type: "heading", settings: { heading: "Personal global business assistant", heading_size: "h1" } },
    ],
  },

  // 6. Сценарии W4 Pro (aa_tab_image_hAQnqD) -> multirow
  {
    key: "w4pro_usecases",
    type: "multirow",
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
    },
    blocks: [
      { type: "row", settings: { image: "usecase-call", caption: "Foreign Calls Translation", heading: "Powerful Immersive Voice-Call Translation", text: "<p>Transcend language barriers in calls among phone or app. No device needed on the other end.</p>" } },
      { type: "row", settings: { image: "usecase-meeting", caption: "Online Meeting Translation", heading: "Online Meeting Now with Translation", text: "<p>Translate and display subtitles during virtual meetings on your phone or tablet.</p>" } },
      { type: "row", settings: { image: "usecase-media", caption: "Media Translation", heading: "News, Series, and Broadcast, Audio Translating with Subtitles", text: "<p>Translates both videos and audios from your phone, tablet, or computer and delivers real-time subtitles.</p>" } },
    ],
  },

  // 7. Абзац W4 Pro (rich_text_Cwq4RD)
  {
    key: "w4pro_detail",
    type: "rich-text",
    settings: { desktop_content_position: "center", content_alignment: "center", color_scheme: "scheme-2", full_width: true },
    blocks: [
      { type: "heading", settings: { heading: "W4 Pro AI Interpreter Earbuds", heading_size: "h2" } },
      { type: "text", settings: { text: "<p>The W4 Pro AI Interpreter Earbuds are more than just a device – they are your personal global business assistant, help to communicate in onsite or online communications, and summarize post-meeting notes, the W4 Pro earbuds are by your side every step of the way, empowering efficient business collaborate communication, ushering in a new era of seamless global business interactions.</p>" } },
      { type: "button", settings: { button_label: "See More", button_link: PRODUCT_URL.w4pro, button_style_secondary: true } },
    ],
  },

  // 8. Perks / Facebook community (image_with_text_overlay_zQE8z6)
  {
    key: "perks",
    type: "image-banner",
    settings: {
      image: "perks",
      image_2: "perks-mobile",
      image_overlay_opacity: 20,
      image_height: "medium",
      desktop_content_position: "middle-center",
      desktop_content_alignment: "center",
      show_text_box: true,
      color_scheme: "scheme-3",
      mobile_content_alignment: "center",
      stack_images_on_mobile: false,
      show_text_below: false,
    },
    blocks: [
      { type: "heading", settings: { heading: "Exclusive Perks for Timekettle Fans", heading_size: "h1" } },
      { type: "text", settings: { text: "Connect with real Timekettle users. Unlock early access & exclusive rewards" } },
      { type: "buttons", settings: { button_label_1: "Join Our Facebook Community", button_link_1: "#", button_style_secondary_1: false } },
    ],
  },

  // 9. Top AI Translation Solutions for Business (aa_featured_blog_MxUJ63)
  {
    key: "business",
    type: "image-with-text",
    settings: {
      image: "business",
      height: "adapt",
      desktop_image_width: "medium",
      layout: "image_first",
      content_layout: "no-overlap",
      desktop_content_position: "middle",
      desktop_content_alignment: "left",
      mobile_content_alignment: "left",
      section_color_scheme: "scheme-1",
      color_scheme: "scheme-1",
    },
    blocks: [
      { type: "heading", settings: { heading: "Top AI Translation Solutions for Business by Timekettle", heading_size: "h2" } },
      { type: "text", settings: { text: "<p>Timekettle’s translation solutions are specifically designed to break down language barriers, offering businesses the tools they need for seamless, real-time communication. Explore our products and empower your business today!</p>", text_style: "body" } },
      { type: "button", settings: { button_label: "Learn More", button_link: ALL, button_style_secondary: false } },
    ],
  },

  // 10. Covering the World (aa_languages_scrolling_KEWTmb)
  {
    key: "languages",
    type: "rich-text",
    settings: { desktop_content_position: "center", content_alignment: "center", color_scheme: "scheme-5", full_width: true },
    blocks: [
      { type: "heading", settings: { heading: "Covering the World, Accent by Accent.", heading_size: "h1" } },
      { type: "text", settings: { text: "<p>52 languages and 106 regional accents — so you’re always understood, no matter how you speak.</p>" } },
    ],
  },

  // 11. Отзывы (product_testimonials_PbKqei)
  {
    key: "testimonials",
    type: "multicolumn",
    settings: {
      title: "Real Reviews. Real Results.",
      heading_size: "h2",
      image_width: "full",
      image_ratio: "adapt",
      columns_desktop: 3,
      column_alignment: "left",
      background_style: "primary",
      color_scheme: "scheme-2",
      columns_mobile: "1",
      swipe_on_mobile: true,
    },
    blocks: [
      { type: "column", settings: { title: "Aldona Glowczynska", text: "<p>“In my case, they work very well. My partner and I speak different languages. And these headphones allow us to communicate reliably. I'm super satisfied. Thank you.”</p><p><strong>W4 Pro AI Interpreter Earbuds</strong></p>", link_label: "Shop W4 Pro", link: PRODUCT_URL.w4pro } },
      { type: "column", settings: { title: "George Brown", text: "<p>“Works well, 1:1 conversations is perfect – and even if another language is spoken outside of selected languages, it will detect and translate it into selected languages.”</p><p><strong>W4 AI Interpreter Earbuds</strong></p>", link_label: "Shop W4", link: PRODUCT_URL.w4 } },
      { type: "column", settings: { title: "JBogle", text: "<p>“Super easy to use. This little handheld is super easy to use and provides good translations of audio or text. Snap a picture of a page of text, and the translation appears in seconds.”</p><p><strong>NEW T1 Handheld Translator Device</strong></p>", link_label: "Shop T1", link: PRODUCT_URL.t1 } },
      { type: "column", settings: { title: "Stefan Crowe", text: "<p>“I previously purchased another brand, they were garbage. My W4 Pro's are not, they work as published. Very happy. The AI features are real, they are solid premium devices. I recommend.”</p><p><strong>W4 Pro AI Interpreter Earbuds</strong></p>", link_label: "Shop W4 Pro", link: PRODUCT_URL.w4pro } },
      { type: "column", settings: { title: "Julia Kendra", text: "<p>“They translate accurately with just slight time delay, got a lot of languages and dialects aswell. Worth the money!!!”</p><p><strong>M3 Language Translator Earbuds</strong></p>", link_label: "Shop M3", link: PRODUCT_URL.m3 } },
    ],
  },

  // 12. Квиз-тизер (aa_quiz_question_pTzKTq)
  {
    key: "quiz",
    type: "rich-text",
    settings: { desktop_content_position: "center", content_alignment: "center", color_scheme: "scheme-1", full_width: true },
    blocks: [
      { type: "heading", settings: { heading: "Find Your Perfect Translator in 30 Seconds", heading_size: "h1" } },
      { type: "text", settings: { text: "<p>Take our smart quiz — we’ll ask about your scenarios, must-have features, and preferred form. Then match you to the ideal Timekettle device.</p>" } },
      { type: "button", settings: { button_label: "Take the Quiz", button_link: "#", button_style_secondary: false } },
    ],
  },

  // 13. Витрина товаров (добавлено)
  {
    key: "shop",
    type: "featured-collection",
    settings: {
      title: "Shop Timekettle Translators",
      heading_size: "h2",
      collection: "all",
      products_to_show: 5,
      columns_desktop: 5,
      color_scheme: "scheme-1",
      full_width: false,
      show_view_all: true,
      view_all_style: "solid",
      image_ratio: "adapt",
      show_secondary_image: true,
      show_vendor: false,
      show_rating: false,
      columns_mobile: "2",
    },
  },
];
