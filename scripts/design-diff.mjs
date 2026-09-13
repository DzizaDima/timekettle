// Pixel QA: снимает страницу локальной темы и складывает с макетом (overlay/diff/side-by-side).
// Использование:
//   node scripts/design-diff.mjs shoot          — снять скриншоты сайта (desktop+mobile)
//   node scripts/design-diff.mjs compare        — собрать overlay/diff/sbs с макетом
//   node scripts/design-diff.mjs crop <vp> <y0> <y1>  — вырезать полосу из макета и сайта рядом

import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const FIGMA = path.join(ROOT, 'scripts/data/figma');
const OUT = path.join(ROOT, 'scripts/data/diff');
const URL_LOCAL = process.env.QA_URL || 'http://127.0.0.1:9292/?_fd=0&pb=0';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, design: 'desktop-2x.png', designScale: 2 },
  mobile: { width: 402, height: 900, design: 'mobile-full.png', designScale: 2, isMobile: true },
};

fs.mkdirSync(OUT, { recursive: true });

async function shoot() {
  const browser = await chromium.launch();
  const results = {};
  for (const [name, vp] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      isMobile: !!vp.isMobile,
      hasTouch: !!vp.isMobile,
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    await page.goto(URL_LOCAL, { waitUntil: 'load', timeout: 60000 });
    // прокрутить, чтобы догрузились lazy-картинки и сработали reveal-анимации
    await page.evaluate(async () => {
      await new Promise((res) => {
        let y = 0;
        const step = () => {
          y += window.innerHeight * 0.8;
          window.scrollTo(0, y);
          if (y < document.body.scrollHeight) setTimeout(step, 120);
          else { window.scrollTo(0, 0); setTimeout(res, 600); }
        };
        step();
      });
    });
    // заморозить анимации/бегущие строки
    await page.addStyleTag({
      content: `*,*::before,*::after{animation-play-state:paused!important;transition:none!important}
                .scroll-trigger{opacity:1!important;transform:none!important}`,
    });
    await page.waitForTimeout(800);
    const file = path.join(OUT, `site-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    const metrics = await page.evaluate(() => ({
      docHeight: document.documentElement.scrollHeight,
      sections: [...document.querySelectorAll('.shopify-section')].map((s) => {
        const r = s.getBoundingClientRect();
        return {
          id: s.id,
          top: Math.round(r.top + window.scrollY),
          height: Math.round(r.height),
        };
      }),
    }));
    results[name] = { file, ...metrics };
    console.log(`\n== ${name} (${vp.width}px) — высота документа ${metrics.docHeight}px`);
    for (const s of metrics.sections) {
      console.log(`  ${String(s.top).padStart(6)}  h=${String(s.height).padStart(5)}  ${s.id}`);
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(results, null, 2));
  await browser.close();
}

// Композитор на canvas внутри headless-хрома (без нативных зависимостей).
// Картинки отдаём по http — file:// из about:blank хром декодировать не даёт.
async function withCanvas(fn) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': 'image/png' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(base + 'favicon-none', { waitUntil: 'commit' }).catch(() => {});
  try {
    return await fn(page, (abs) => base + path.relative(ROOT, abs).split(path.sep).join('/'));
  } finally {
    await browser.close();
    server.close();
  }
}

async function compare() {
  await withCanvas(async (page, url) => {
    for (const [name, vp] of Object.entries(VIEWPORTS)) {
      const sitePath = path.join(OUT, `site-${name}.png`);
      const designPath = path.join(FIGMA, vp.design);
      if (!fs.existsSync(sitePath)) { console.log(`нет ${sitePath}, сначала shoot`); continue; }
      const siteUrl = url(sitePath);
      const designUrl = url(designPath);

      const out = await page.evaluate(async ({ siteUrl, designUrl, width }) => {
        const load = async (src) => { const im = new Image(); im.src = src; await im.decode(); return im; };
        const [site, design] = await Promise.all([load(siteUrl), load(designUrl)]);
        const dScale = width / design.width;      // макет → CSS-ширина вьюпорта
        const dH = Math.round(design.height * dScale);
        const H = Math.max(site.height, dH);

        const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

        // 1) side-by-side
        const sbs = mk(width * 2 + 24, H);
        let g = sbs.getContext('2d');
        g.fillStyle = '#888'; g.fillRect(0, 0, sbs.width, sbs.height);
        g.drawImage(design, 0, 0, width, dH);
        g.drawImage(site, width + 24, 0, width, site.height);

        // 2) overlay (макет полупрозрачно поверх сайта)
        const ov = mk(width, H);
        g = ov.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, width, H);
        g.drawImage(site, 0, 0, width, site.height);
        g.globalAlpha = 0.5;
        g.drawImage(design, 0, 0, width, dH);

        // 3) difference blend
        const df = mk(width, H);
        g = df.getContext('2d');
        g.fillStyle = '#000'; g.fillRect(0, 0, width, H);
        g.drawImage(site, 0, 0, width, site.height);
        g.globalCompositeOperation = 'difference';
        g.drawImage(design, 0, 0, width, dH);

        return {
          sbs: sbs.toDataURL('image/png'),
          overlay: ov.toDataURL('image/png'),
          diff: df.toDataURL('image/png'),
          info: { siteH: site.height, designH: dH, designRaw: `${design.width}x${design.height}` },
        };
      }, { siteUrl, designUrl, width: vp.width });

      for (const k of ['sbs', 'overlay', 'diff']) {
        const b64 = out[k].split(',')[1];
        fs.writeFileSync(path.join(OUT, `${k}-${name}.png`), Buffer.from(b64, 'base64'));
      }
      console.log(`${name}: сайт ${out.info.siteH}px, макет ${out.info.designH}px (raw ${out.info.designRaw}) → ${out.info.siteH - out.info.designH >= 0 ? '+' : ''}${out.info.siteH - out.info.designH}px`);
    }
  });
}

// Вырезать горизонтальную полосу: макет слева, сайт справа. y — в CSS-пикселях вьюпорта.
async function crop(vpName, dy0, dy1, sy0, sy1) {
  const vp = VIEWPORTS[vpName];
  await withCanvas(async (page, url) => {
    const siteUrl = url(path.join(OUT, `site-${vpName}.png`));
    const designUrl = url(path.join(FIGMA, vp.design));
    const out = await page.evaluate(async ({ siteUrl, designUrl, width, dy0, dy1, sy0, sy1 }) => {
      const load = async (src) => { const im = new Image(); im.src = src; await im.decode(); return im; };
      const [site, design] = await Promise.all([load(siteUrl), load(designUrl)]);
      const s = design.width / width; // макет-пикселей на 1 CSS-пиксель
      const dh = dy1 - dy0, sh = sy1 - sy0;
      const H = Math.max(dh, sh);
      const c = document.createElement('canvas');
      c.width = width * 2 + 24; c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#888'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(design, 0, dy0 * s, design.width, dh * s, 0, 0, width, dh);
      g.drawImage(site, 0, sy0, site.width, sh, width + 24, 0, width, sh);
      return c.toDataURL('image/png');
    }, { siteUrl, designUrl, width: vp.width, dy0, dy1, sy0, sy1 });
    const f = path.join(OUT, `crop-${vpName}-${dy0}-${dy1}.png`);
    fs.writeFileSync(f, Buffer.from(out.split(',')[1], 'base64'));
    console.log(f);
  });
}

// Пачка полос за один запуск браузера. spec: [{name, dy0, dy1, sy0, sy1}]
async function batch(vpName, specPath) {
  const vp = VIEWPORTS[vpName];
  const specs = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  await withCanvas(async (page, url) => {
    const siteUrl = url(path.join(OUT, `site-${vpName}.png`));
    const designUrl = url(path.join(FIGMA, vp.design));
    const outs = await page.evaluate(async ({ siteUrl, designUrl, width, specs }) => {
      const load = async (src) => { const im = new Image(); im.src = src; await im.decode(); return im; };
      const [site, design] = await Promise.all([load(siteUrl), load(designUrl)]);
      const s = design.width / width;
      return specs.map((sp) => {
        const dh = sp.dy1 - sp.dy0, sh = (sp.sy1 ?? sp.dy1) - (sp.sy0 ?? sp.dy0);
        const H = Math.max(dh, sh);
        const c = document.createElement('canvas');
        c.width = width * 2 + 24; c.height = H;
        const g = c.getContext('2d');
        g.fillStyle = '#888'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(design, 0, sp.dy0 * s, design.width, dh * s, 0, 0, width, dh);
        g.drawImage(site, 0, sp.sy0 ?? sp.dy0, site.width, sh, width + 24, 0, width, sh);
        return { name: sp.name, url: c.toDataURL('image/png') };
      });
    }, { siteUrl, designUrl, width: vp.width, specs });
    for (const o of outs) {
      const f = path.join(OUT, `s-${vpName}-${o.name}.png`);
      fs.writeFileSync(f, Buffer.from(o.url.split(',')[1], 'base64'));
      console.log(f);
    }
  });
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'shoot') await shoot();
else if (cmd === 'compare') await compare();
else if (cmd === 'crop') await crop(args[0], +args[1], +args[2], +(args[3] ?? args[1]), +(args[4] ?? args[2]));
else if (cmd === 'batch') await batch(args[0], args[1]);
else console.log('shoot | compare | crop <vp> <dy0> <dy1> [sy0] [sy1] | batch <vp> <spec.json>');
