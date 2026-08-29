// Маппинг секций timekettle -> стоковые секции Dawn.
// Решение принимается по ИЗМЕРЕННОЙ раскладке (sec.layout из scrape-product-pages.mjs),
// а не по имени кастомного типа секции:
//
//   banner            -> image-banner            (большая картинка + текст поверх)
//   rows-alternating  -> multirow (alternate)    (полноширинные строки, картинка лево/право)
//   rows-wide         -> multicolumn cols=1      (картинка на всю ширину, текст под ней)
//   rows              -> multirow | rich-text
//   grid (cols=N)     -> multicolumn cols=N
//   accordion         -> collapsible-content
//   marquee           -> languages-scrolling     (кастомная секция)
//
// Возвращает node | node[] | null. Массив нужен там, где у секции Dawn нет своего
// заголовка (multirow) — тогда заголовок выносится отдельной rich-text секцией.

const H = (s) => (s || "").trim();
const P = (t) => (t ? `<p>${t}</p>` : "");
const uniq = (a) => [...new Set((a || []).filter(Boolean))];

function dedupeHeadingFromText(heading, text) {
  heading = H(heading);
  text = H(text);
  if (heading && text.toLowerCase().startsWith(heading.toLowerCase())) {
    return H(text.slice(heading.length).replace(/^[\s.:–—-]+/, ""));
  }
  return text;
}

const itemImg = (it) => (it.imgs && it.imgs.length ? it.imgs[0].src : null);
const itemHeading = (it) => H(it.headings?.[0]);
function itemText(it) {
  const h = itemHeading(it);
  const paras = uniq(it.paras).map((p) => dedupeHeadingFromText(h, p)).filter(Boolean);
  return paras.slice(0, 2).join(" ");
}

// ---- конструкторы секций Dawn ----

function richText(heading, text, { scheme = "scheme-1", button, size = "h1", pt = 44, pb = 24 } = {}) {
  const blocks = [];
  if (heading) blocks.push({ type: "heading", settings: { heading, heading_size: size } });
  if (text) blocks.push({ type: "text", settings: { text: P(text) } });
  if (button) blocks.push({ type: "button", settings: { button_label: button.label, button_link: button.link, button_style_secondary: true } });
  if (!blocks.length) return null;
  return {
    type: "rich-text",
    settings: {
      desktop_content_position: "center", content_alignment: "center",
      color_scheme: scheme, full_width: true, padding_top: pt, padding_bottom: pb,
    },
    blocks,
  };
}

function multicolumn(title, cards, ctx, { cols, ratio = "adapt", bg = "none", scheme = "scheme-1", swipe } = {}) {
  const n = cols || Math.min(Math.max(cards.length, 1), 4);
  return {
    type: "multicolumn",
    settings: {
      title: title || "",
      heading_size: "h1",
      image_width: "full",
      image_ratio: ratio,
      columns_desktop: Math.min(Math.max(n, 1), 6),
      column_alignment: "left",
      background_style: bg,
      color_scheme: scheme,
      columns_mobile: n >= 4 ? "2" : "1",
      swipe_on_mobile: swipe ?? cards.length > 3,
      padding_top: 40,
      padding_bottom: 40,
    },
    blocks: cards.map((c) => ({
      type: "column",
      settings: {
        ...(c.image ? { image: ctx.img(c.image) } : {}),
        title: c.title || "",
        text: P(c.text),
        ...(c.link ? { link_label: c.linkLabel || "Learn more", link: c.link } : {}),
      },
    })),
  };
}

function multirow(rows, ctx, { alternate = true, imageWidth = "medium", scheme = "scheme-1" } = {}) {
  return {
    type: "multirow",
    settings: {
      image_height: "medium",
      desktop_image_width: imageWidth,
      image_layout: alternate ? "alternate-left" : "align-left",
      heading_size: "h2",
      text_style: "body",
      button_style: "secondary",
      desktop_content_position: "middle",
      desktop_content_alignment: "left",
      mobile_content_alignment: "left",
      section_color_scheme: scheme,
      row_color_scheme: scheme,
      padding_top: 12,
      padding_bottom: 36,
    },
    blocks: rows.map((r) => ({
      type: "row",
      settings: {
        ...(r.image ? { image: ctx.img(r.image) } : {}),
        ...(r.caption ? { caption: r.caption } : {}),
        heading: r.heading || "",
        text: P(r.text),
      },
    })),
  };
}

function imageBanner(image, image2, heading, text, ctx, buyLink, { overlay = 30 } = {}) {
  const blocks = [];
  if (heading) blocks.push({ type: "heading", settings: { heading, heading_size: "h1" } });
  if (text && text !== heading) blocks.push({ type: "text", settings: { text } });
  if (buyLink) blocks.push({ type: "buttons", settings: { button_label_1: "Buy Now", button_link_1: buyLink, button_style_secondary_1: false } });
  return {
    type: "image-banner",
    settings: {
      ...(image ? { image: ctx.img(image) } : {}),
      ...(image2 ? { image_2: ctx.img(image2) } : {}),
      image_overlay_opacity: blocks.length ? overlay : 0,
      image_height: "large",
      desktop_content_position: "middle-left",
      desktop_content_alignment: "left",
      show_text_box: blocks.length > 0,
      color_scheme: "scheme-3",
      mobile_content_alignment: "left",
      stack_images_on_mobile: false,
      show_text_below: false,
    },
    blocks,
  };
}

function collapsible(heading, rows, { scheme = "scheme-1", layout = "row" } = {}) {
  if (!rows.length) return null;
  return {
    type: "collapsible-content",
    settings: {
      heading: heading || "",
      heading_size: "h1",
      heading_alignment: "center",
      layout,
      container_color_scheme: "scheme-2",
      color_scheme: scheme,
      open_first_collapsible_row: false,
      padding_top: 44,
      padding_bottom: 44,
    },
    blocks: rows.map((r) => ({
      type: "collapsible_row",
      settings: { heading: r.heading, icon: "question_mark", row_content: r.content },
    })),
  };
}

// ---- главный маппер ----

export function mapSection(sec, ctx) {
  const buyLink = `shopify://products/${ctx.handle}`;
  const title = H(sec.secHeadings?.[0]);
  const intro = H(sec.secParas?.[0]);
  const items = sec.items || [];

  switch (sec.layout) {
    case "marquee": {
      // содержимое (языки, флаги, таблица) приходит из метаполя custom.language_table,
      // здесь только оформление — стили сняты с исходника
      return {
        type: "languages-scrolling",
        settings: {
          background: "#f5f5f5",
          text_color: "#333333",
          button_background: "#3456e6",
          button_text_color: "#ffffff",
          speed: 60,
          padding_top: 56,
          padding_bottom: 56,
        },
      };
    }

    case "banner": {
      // текст оверлея живёт то в секции, то в карточках
      const texts = uniq([...(sec.secHeadings || []), ...(sec.secParas || []), ...items.flatMap((i) => [...i.headings, ...i.paras])]);
      // если текст один и длинный — это подпись, а не заголовок (заголовок вшит в картинку)
      const headingIsCaption = texts.length === 1 && texts[0].length > 70;
      const heading = headingIsCaption ? "" : texts[0] || "";
      const body = headingIsCaption ? texts[0] : dedupeHeadingFromText(heading, texts.slice(1).join(" "));
      const imgs = uniq(items.flatMap((i) => i.imgs.map((x) => x.src)).concat(sec.allImages || []));
      // самая широкая картинка — десктопная
      const wide = items.flatMap((i) => i.imgs).sort((a, b) => b.w - a.w)[0];
      const image = wide ? wide.src : imgs[0];
      const image2 = imgs.find((u) => u !== image) || null;
      if (!image) return richText(heading, body);
      return imageBanner(image, image2, heading, body.slice(0, 400), ctx, sec.isHero ? buyLink : null);
    }

    case "accordion": {
      const rows = items
        .map((it) => {
          const paras = uniq(it.paras);
          // фолбэк: ответ без <p> (таблица/список) — берём весь текст карточки
          const content = paras.length ? paras.map(P).join("") : P(H(it.text).slice(0, 800));
          return { heading: itemHeading(it), content };
        })
        .filter((r) => r.heading && r.content);
      if (!rows.length) return null;
      return collapsible(title || (sec.type === "faq" ? "FAQs" : ""), rows.slice(0, 20), {
        layout: sec.type === "faq" ? "row" : "section",
      });
    }

    case "rows-alternating":
    case "rows": {
      const withImg = items.filter((it) => itemImg(it));
      if (withImg.length >= 2) {
        const rows = items.map((it) => ({
          image: itemImg(it),
          heading: itemHeading(it),
          text: itemText(it),
        }));
        const head = richText(title, intro, { pb: 8 });
        const body = multirow(rows, ctx, { alternate: sec.layout === "rows-alternating" });
        return head ? [head, body] : [body];
      }
      // без картинок: несколько текстовых карточек -> колонки, одна -> rich-text
      const textCards = items.filter((it) => itemHeading(it) && itemText(it));
      if (textCards.length >= 2) {
        const cards = textCards.map((it) => ({ title: itemHeading(it), text: itemText(it) }));
        return multicolumn(title, cards, ctx, { cols: Math.min(cards.length, 3), bg: "primary", scheme: "scheme-2" });
      }
      const h = title || itemHeading(items[0]);
      const t = intro || itemText(items[0]) || itemText(items[1] || {});
      return richText(h, dedupeHeadingFromText(h, t));
    }

    case "rows-wide": {
      const cards = items.map((it) => ({ image: itemImg(it), title: itemHeading(it), text: itemText(it) }));
      return multicolumn(title, cards, ctx, { cols: 1, swipe: false });
    }

    case "grid": {
      const cards = items.map((it) => {
        const h = itemHeading(it);
        const txt = itemText(it);
        // в видео-гриде подпись лежит в параграфе, а не в заголовке
        return { image: itemImg(it), title: h || H(it.paras?.[0]), text: h ? txt : "" };
      });
      const isIcons = cards.every((c) => !c.text) && sec.cols >= 4;
      const node = multicolumn(title, cards, ctx, {
        cols: sec.cols,
        ratio: isIcons ? "square" : "adapt",
        bg: isIcons ? "primary" : "none",
        scheme: isIcons ? "scheme-2" : "scheme-1",
      });
      if (intro && intro.length <= 140 && !node.settings.title) node.settings.title = intro;
      return node;
    }

    default:
      return richText(title, intro);
  }
}
