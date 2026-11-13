// Portrait (US Letter) magazine PDF for the Las Vegas monthly report (page "Is Las Vegas Dying?", WordPress page 25117).
// Called from render.js when the page has the report layout (main.lv-main).
// Design = the approved Executive Conversation / Book PDF (conversation.js, Nov 9 2026):
//  - one solid site blue (#071D46) on every page, practice tag top right, page number bottom right;
//  - cover: "City Shift Finance", label box ("Monthly Report"), serif title, standfirst, hero image at the bottom;
//  - body: opening in two columns + Methodology box; each "What changed" step on its own page with its photo;
//    each chart section with the chart exactly as on the website (screenshot); operator cards; the inflation
//    explorer as shown by default; closing; WHO WE ARE + Connect with us (same as conversation.js);
//  - no in-text links, no footnote markers (sources stay in each exhibit's Source line).
// The gate (CSF Report Access) is opened before reading, so the PDF always carries the full report.
// Everything is read from the live page, so monthly updates need no changes here.
const { PDFDocument, PDFName, PDFString, PDFArray } = require('pdf-lib');

module.exports = async function reportPdf(b, p, OUT) {
  // open the account gate and show every block the page hides from visitors
  await p.evaluate(() => {
    document.documentElement.classList.add('csf-ra-open');
    document.documentElement.classList.remove('csf-ra-locking');
    document.querySelectorAll('.csf-ra-hidden').forEach(e => e.classList.remove('csf-ra-hidden'));
    document.querySelectorAll('.csf-ra-fade').forEach(e => e.classList.remove('csf-ra-fade'));
    document.querySelectorAll('.csf-ra-gate').forEach(e => e.remove());
  });
  await p.addStyleTag({ content: '.csf-er-fn__pop{display:none!important}.lv-hero-video,.csf-er-hero__pause{display:none!important}' });
  await p.waitForTimeout(1500);

  const d = await p.evaluate(() => {
    const q = (s, r) => (r || document).querySelector(s);
    const qa = (s, r) => [...(r || document).querySelectorAll(s)];
    const T = (s, r) => { const e = q(s, r); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
    // links and footnote markers are dropped; bold and italics kept
    const clean = el => { const c = el.cloneNode(true); c.querySelectorAll('.csf-er-fn, sup').forEach(n => n.remove()); c.querySelectorAll('*').forEach(n => { if (!['STRONG', 'B', 'EM', 'I', 'BR'].includes(n.tagName)) { n.replaceWith(...n.childNodes); return; } [...n.attributes].forEach(a => n.removeAttribute(a.name)); }); return c.innerHTML.replace(/\s+/g, ' ').trim(); };
    const paras = (sel, r) => qa(sel, r).filter(x => x.textContent.trim()).map(clean);
    const src = img => img ? (img.currentSrc || img.src || img.getAttribute('data-src') || '') : '';
    const contact = [...document.querySelectorAll('header a, nav a, a')].find(a => /^\s*contact\s*$/i.test(a.textContent) && /contact/i.test(a.href));
    const hero = q('.lv-hero-tall .img img') || q('.csf-ir-hero img');
    const out = {
      title: T('.csf-ir-hero h1') || T('h1'), standfirst: T('.lv-hero-sub'),
      kind: T('.csf-report-hero__type') || 'Report', practice: T('.csf-report-hero__service'),
      practiceUrl: (q('a.csf-report-hero__service') || {}).href || '',
      hero: src(hero), og: ((q('meta[property="og:image"]') || {}).content || ''),
      contact: contact ? contact.href : location.origin + '/contact/', origin: location.origin,
      opening: paras('.glance .csf-er-intro__copy > p'),
      method: (() => { const s = qa('.glance details.csf-er-sidebar').find(x => /methodology/i.test(x.textContent)); return s ? { h: T('.csf-er-sidebar-title', s) || 'Methodology', p: paras('.csf-er-sidebar-body p, .csf-er-sidebar-body li', s) } : null; })(),
      fonts: (() => { const o = []; for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; } const base = sh.href || location.href; for (const r of rules) { if (r.type === 5) o.push(r.cssText.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, qq, u) => 'url("' + new URL(u, base).href + '")')); } } return o.join('\n'); })()
    };
    // "What changed" section: heading, intro, one step per photo
    const sc = q('#lv-changes');
    out.changes = sc ? { h: T('.lv-scrolly__head h2', sc), intro: paras('.lv-scrolly__head p', sc),
      steps: qa('.lv-step', sc).map(s => ({ h: T('h3', s), img: src(q('img', s)), p: paras('p', s) })) } : null;
    // chart sections (01, 02): eyebrow, heading, text; the exhibit is screenshotted
    out.charts = qa('section.lv-chart:not(.lv-ops)').map((s, i) => { s.setAttribute('data-pdf-ex', 'c' + i); return { id: 'c' + i, eb: T('.lv-eb', s), h: T('.lv-ttl', s), p: paras('.lv-chart__text p', s) }; });
    // operators: eyebrow, heading, intro; the card grid is screenshotted; notes as text
    const op = q('section.lv-ops');
    out.ops = op ? (op.setAttribute('data-pdf-ops', '1'), { eb: T('.lv-eb', op), h: T('.lv-ttl', op), intro: paras('.lv-ops__intro', op), notes: paras('.lv-ops__notes p', op) }) : null;
    // explorer: shown as on the page by default (latest full year against 2019)
    const ex = q('#lv-explorer');
    out.explorer = ex ? { eb: T('.lv-eb', ex), h: T('.lv-ttl', ex), lbl: T('.lv-full__right .lv-full__lbl', ex), area: T('.lv-full__pill.is-on', ex), period: T('.lv-full__per button.is-on', ex), notes: paras('p', ex).filter(t => /^(Method|Source)/.test(t.replace(/<[^>]+>/g, ''))) } : null;
    out.closing = paras('.lv-close__p');
    return out;
  });
  if (!d.title) throw new Error('Report title not found on the page');
  if (!d.opening.length) throw new Error('Report opening not found on the page');

  // screenshots of the exhibits exactly as on the website
  const shot = async sel => { const el = await p.$(sel); if (!el) return ''; await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(900); return 'data:image/png;base64,' + (await el.screenshot({ type: 'png' })).toString('base64'); };
  for (const c of d.charts) c.png = await shot(`[data-pdf-ex="${c.id}"] figure.csf-col-ex`) || await shot(`[data-pdf-ex="${c.id}"] .lv-chart__fig`);
  if (d.ops) d.ops.png = await shot('[data-pdf-ops] .lv-ops__grid');
  if (d.explorer) d.explorer.png = await shot('#lv-explorer .lv-full__right');

  // images as data URLs, re-encoded as JPEG (max 1800px) so the download stays small
  const shrink = u => p.evaluate(async s => { const i = new Image(); i.src = s; await i.decode(); const k = Math.min(1, 1800 / i.naturalWidth); const c = document.createElement('canvas'); c.width = Math.round(i.naturalWidth * k); c.height = Math.round(i.naturalHeight * k); c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.86); }, u).catch(() => u);
  const data = async u => { if (!u) return ''; try { const r = await p.request.get(u); if (r.ok() && /^image\//.test(r.headers()['content-type'] || '')) return await shrink('data:' + r.headers()['content-type'] + ';base64,' + (await r.body()).toString('base64')); } catch (e) {} return ''; };
  const hero = (await data(d.hero)) || (await data(d.og));
  if (d.changes) for (const s of d.changes.steps) s.data = await data(s.img);
  let coverBg = '#071D46';
  if (hero) { try { coverBg = await p.evaluate(async u => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = 8; c.height = 8; const x = c.getContext('2d'); x.drawImage(i, 0, 0, 8, 8, 0, 0, 8, 8); const px = x.getImageData(1, 1, 1, 1).data; const lum = (0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]) / 255; return lum > 0.3 ? '' : 'rgb(' + px[0] + ',' + px[1] + ',' + px[2] + ')'; }, hero) || '#071D46'; } catch (e) {} }
  let who = '';
  try { const q2 = await b.newPage(); await q2.goto(d.origin + '/', { waitUntil: 'domcontentloaded', timeout: 45000 }); who = await q2.evaluate(() => { const g = s => { const e = document.querySelector(s); return e ? (e.getAttribute('content') || '').trim() : ''; }; return g('meta[name="description"]') || g('meta[property="og:description"]'); }); await q2.close(); } catch (e) {}

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const P = arr => (arr || []).map(h => `<p>${h}</p>`).join('');
  const base = d.fonts + `
*{box-sizing:border-box;margin:0;padding:0}
html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Helvetica Now","Helvetica Neue",Helvetica,Arial,sans-serif;color:#fff}
.serif{font-family:"Tiempos Headline",Georgia,serif;font-weight:600}
`;
  // ---------- cover (same as conversation.js) ----------
  const coverHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${base}
@page{size:8.5in 11in;margin:0}
html,body{background:${coverBg}}
.pg{width:8.5in;height:11in;background:${coverBg};position:relative;overflow:hidden}
.brand{position:absolute;top:.5in;left:0;right:0;text-align:center;font-size:15px;font-weight:400;letter-spacing:.01em}
.kind{position:absolute;top:.82in;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:9px;letter-spacing:.14em;color:#3AADFA;border:1px solid #3AADFA;padding:6px 10px;text-transform:uppercase}
.txt{position:absolute;top:1.55in;left:1.3in;right:.9in}
.t{font-size:${d.title.length > 70 ? 40 : 46}px;line-height:1.08}
.sub{margin-top:22px;max-width:5.6in;font-size:15px;line-height:1.5;color:#dbe5ff}
.img{position:absolute;left:0;right:0;bottom:0;height:6in;background:url('${hero}') center bottom/cover no-repeat}
</style></head><body><div class="pg"><div class="brand">City Shift Finance</div><div class="kind">${esc(d.kind)}</div>
<div class="txt"><div class="t serif">${esc(d.title)}</div><div class="sub">${esc(d.standfirst)}</div></div>${hero ? '<div class="img"></div>' : ''}</div></body></html>`;

  // ---------- body ----------
  const btn = `<a class="btn" href="${esc(d.contact)}"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><rect x="3" y="5.5" width="18" height="13"/><path d="M3 6l9 7 9-7"/></svg>Connect with us</a>`;
  const head = (eb, h) => `${eb ? `<div class="eb">${esc(eb)}</div>` : ''}<div class="h2 serif">${esc(h)}</div>`;
  let inner = `<div class="h serif">${esc(d.title)}</div><div class="cols">${P(d.opening)}</div>`;
  if (d.method && d.method.p.length) inner += `<div class="box"><div class="boxh">${esc(d.method.h)}</div><div class="cols">${P(d.method.p)}</div></div>`;
  if (d.changes) {
    inner += `<div class="sec">${head('', d.changes.h)}<div class="cols lead">${P(d.changes.intro)}</div>`;
    d.changes.steps.forEach((s, i) => {
      inner += `${i ? '<div class="sec">' : ''}${s.data ? `<div class="qimg" style="background-image:url('${s.data}')"></div>` : ''}<div class="h3 serif">${esc(s.h)}</div><div class="cols">${P(s.p)}</div>${i ? '</div>' : ''}`;
    });
    inner += `</div>`;
  }
  d.charts.forEach(c => { inner += `<div class="sec">${head(c.eb, c.h)}<div class="cols">${P(c.p)}</div>${c.png ? `<img class="ex" src="${c.png}">` : ''}</div>`; });
  if (d.ops) inner += `<div class="sec">${head(d.ops.eb, d.ops.h)}<div class="cols">${P(d.ops.intro)}</div>${d.ops.png ? `<img class="ex" src="${d.ops.png}">` : ''}<div class="notes">${P(d.ops.notes)}</div></div>`;
  if (d.explorer && d.explorer.png) inner += `<div class="sec">${head(d.explorer.eb, d.explorer.h)}<div class="exlbl">${esc([d.explorer.area, d.explorer.period].filter(Boolean).join(' · '))}</div><img class="ex" src="${d.explorer.png}"><div class="notes">${P(d.explorer.notes)}</div></div>`;
  if (d.closing.length) inner += `<div class="sec"><div class="cols closing">${P(d.closing)}</div><div class="whoblk"><h4>WHO WE ARE</h4>${who ? `<p>${esc(who)}</p>` : ''}${btn}</div></div>`;

  const bodyHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${base}
html,body{background:#071D46}
.h{font-size:30px;line-height:1.15;margin:0 0 .3in 0;max-width:6in}
.eb{font-size:8.5px;letter-spacing:.14em;color:#3AADFA;margin-bottom:8px;text-transform:uppercase}
.h2{font-size:24px;line-height:1.18;margin:0 0 .22in 0;max-width:5.8in}
.h3{font-size:17px;line-height:1.25;margin:0 0 .16in}
.cols{column-count:2;column-gap:.32in;font-size:9.6px;line-height:1.62;color:#e9efff}
.cols p{margin:0 0 9px}
.cols strong,.cols b{color:#fff}
.lead{margin-bottom:.3in}
.sec{break-before:page}
.qimg{width:100%;aspect-ratio:2/1;background-size:cover;background-position:center;margin:2px 0 16px;break-inside:avoid}
.box{break-inside:avoid;margin-top:.3in;background:rgba(255,255,255,.06);padding:.22in .25in}
.boxh{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#3AADFA;margin-bottom:10px}
.box .cols{font-size:8.8px}
.ex{display:block;width:100%;margin:.18in 0 .1in;break-inside:avoid}
.exlbl{font-size:9px;letter-spacing:.08em;color:#9fb6ff;margin-bottom:4px}
.notes{font-size:8px;line-height:1.55;color:#c9d6f5;margin-top:.12in}
.notes p{margin:0 0 6px}
.closing{font-size:10.4px}
a{color:inherit;text-decoration:none}
.whoblk{break-inside:avoid;margin-top:.35in;border-top:1px solid rgba(255,255,255,.25);padding-top:.25in}
.whoblk h4{font-size:9px;letter-spacing:.12em;color:#fff;margin-bottom:8px;text-align:center}
.whoblk p{font-size:11px;line-height:1.6;color:#e9efff;max-width:5.6in}
.btn{display:flex;width:fit-content;align-items:center;gap:8px;background:#2251FF;color:#fff;font-size:11px;padding:10px 18px;margin:14px auto 0}
.btn svg{width:14px;height:14px}
</style></head><body>${inner}</body></html>`;

  const pg = await b.newPage();
  await pg.setContent(coverHtml, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready);
  const coverPdf = await pg.pdf({ width: '8.5in', height: '11in', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
  await pg.setContent(bodyHtml, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready);
  const tag = d.practice ? `<div style="width:100%;height:100%;position:relative;-webkit-print-color-adjust:exact"><div style="position:absolute;top:0;right:.55in;font-family:Helvetica,Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:.14em;color:#3AADFA;border:1px solid #3AADFA;border-top:none;padding:7px 10px;text-transform:uppercase">${esc(d.practice)}</div></div>` : '<div></div>';
  const bodyPdf = await pg.pdf({
    width: '8.5in', height: '11in', printBackground: true,
    margin: { top: '1.05in', bottom: '0.8in', left: '1.1in', right: '0.9in' },
    displayHeaderFooter: true, headerTemplate: tag,
    footerTemplate: '<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:8px;color:#9fb6ff;padding:0 .9in;text-align:right"><span class="pageNumber"></span></div>'
  });
  let tagBox = null;
  if (d.practice) {
    await pg.setContent(`<html><body style="margin:0;width:816px">${tag}</body></html>`);
    tagBox = await pg.evaluate(() => { const e = document.body.querySelector('div > div'); const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
  }
  await pg.close();

  // ---------- assemble (same as conversation.js) ----------
  const outDoc = await PDFDocument.create();
  for (const s0 of [coverPdf, bodyPdf]) { const s = await PDFDocument.load(s0); (await outDoc.copyPages(s, s.getPageIndices())).forEach(x => outDoc.addPage(x)); }
  { const pages = outDoc.getPages();
    for (let i = 1; i < pages.length; i++) {
      const pgx = pages[i];
      const bgRef = outDoc.context.register(outDoc.context.flateStream(`q 0.0275 0.1137 0.2745 rg 0 0 ${pgx.getWidth()} ${pgx.getHeight()} re f Q\n`));
      const c = pgx.node.get(PDFName.of('Contents'));
      if (c instanceof PDFArray) c.insert(0, bgRef); else pgx.node.set(PDFName.of('Contents'), outDoc.context.obj(c ? [bgRef, c] : [bgRef]));
    } }
  if (tagBox && d.practiceUrl) {
    const k = 0.75, pages = outDoc.getPages();
    for (let i = 1; i < pages.length; i++) {
      const pgx = pages[i], H = pgx.getHeight();
      const link = outDoc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [tagBox[0] * k, H - tagBox[3] * k - 2, tagBox[2] * k, H - tagBox[1] * k], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of(d.practiceUrl) } });
      const ref = outDoc.context.register(link);
      const annots = pgx.node.lookup(PDFName.of('Annots'));
      if (annots) annots.push(ref); else pgx.node.set(PDFName.of('Annots'), outDoc.context.obj([ref]));
    }
  }
  outDoc.setTitle('City Shift Finance - ' + d.title);
  outDoc.setAuthor('City Shift Finance'); outDoc.setCreator('City Shift Finance'); outDoc.setProducer('City Shift Finance');
  require('fs').writeFileSync(OUT, await outDoc.save());
};
