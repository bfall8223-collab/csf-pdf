// Portrait (US Letter) PDF for Breakdowns (csf_breakdown: main.csf-er with .csf-col-intro). Called from render.js.
// Added Nov 14 2026 (CSF PDF Download 1.0.17), layout approved by the owner from a mockup of the live
// "Hotel Competitive Set" Breakdown. Same house style as editorial.js (Deep Dives / Commentary):
//  - page 1 = the page's own magazine cover (window.csfPdfCover, printed by the plugin, label "Breakdown");
//  - one solid site blue, practice tag top right (links to the practice page), footer "City Shift Finance"
//    (links to the homepage) and the page number;
//  - body: title, standfirst, intro and section 1 in two columns (the Q&A sidebar as a box; "How we help clients"
//    is left out, as in every PDF), then the exhibit on its own page (the live chart, captured as an image, with its
//    method/notes/source lines and the "City Shift Finance" line), then section 2 opening with the key figure box
//    (bold), then the FAQs and the sources (plain text, no links);
//  - no Related cards, no Contact us, no in-text links.
// Everything is read from the live page, so new Breakdowns need no change here.
const { PDFDocument, PDFName, PDFString, PDFArray } = require('pdf-lib');

module.exports = async function breakdownPdf(b, p, OUT) {
  await p.waitForFunction(() => typeof window.csfPdfCover === 'function', null, { timeout: 30000 }).catch(() => {});
  // the chart draws itself when it scrolls into view: bring it on screen, wait, then capture it as an image
  let chart = '';
  const plot = await p.$('.csf-col-ex .cc-plot');
  if (plot) {
    await plot.scrollIntoViewIfNeeded().catch(() => {});
    await p.waitForFunction(() => { const e = document.querySelector('.csf-col-ex .cc-plot'); return e && e.children.length && e.getBoundingClientRect().height > 20; }, null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(1500);
    try { chart = 'data:image/png;base64,' + (await plot.screenshot({ type: 'png' })).toString('base64'); } catch (e) {}
  }
  if (!chart) { const ns = await p.evaluate(() => { const n = document.querySelector('.csf-col-ex noscript'); const m = n && /src="([^"]+)"/.exec(n.textContent); return m ? m[1] : ''; }); if (ns) chart = ns; }
  const d = await p.evaluate(async () => {
    const q = (s, r) => (r || document).querySelector(s);
    const T = (s, r) => { const e = q(s, r); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
    const clean = el => { const c = el.cloneNode(true); c.querySelectorAll('.csf-er-fn, sup, .csf-er-plus').forEach(n => n.remove()); c.querySelectorAll('*').forEach(n => { if (!['STRONG', 'B', 'EM', 'I', 'BR'].includes(n.tagName)) { n.replaceWith(...n.childNodes); return; } [...n.attributes].forEach(a => n.removeAttribute(a.name)); }); return c.innerHTML.replace(/\[\d+\]/g, '').trim(); };
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const blocks = root => { const out = []; if (!root) return ''; [...root.children].forEach(n => {
      if (n.matches('.csf-er-sidebar--help, .csf-er-clear, aside, h2, .csf-pdf-dl-host, script, noscript')) return;
      if (n.matches('.csf-er-sidebar')) { out.push(`<div class="box"><h4>${esc(T('.csf-er-sidebar-title', n))}</h4>${[...n.querySelectorAll('.csf-er-sidebar-body p, .csf-er-sidebar-body li')].map(x => `<p>${clean(x)}</p>`).join('')}</div>`); return; }
      if (n.matches('h3')) { out.push(`<h3 class="serif">${esc(n.textContent.trim())}</h3>`); return; }
      if (n.matches('p')) { if (n.textContent.trim()) out.push(`<p>${clean(n)}</p>`); return; }
      if (n.matches('ul, ol')) out.push(`<ul>${[...n.children].map(li => `<li>${clean(li)}</li>`).join('')}</ul>`);
    }); return out.join(''); };
    const fonts = (() => { const o = []; for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; } const base = sh.href || location.href; for (const r of rules) { if (r.type === 5) o.push(r.cssText.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, qq, u) => 'url("' + new URL(u, base).href + '")')); } } return o.join('\n'); })();
    let cover = '';
    if (window.csfPdfCover) { try { const c = await window.csfPdfCover(1632, 2112); cover = c.toDataURL('image/jpeg', 0.9); } catch (e) {} }
    const bodies = [...document.querySelectorAll('.csf-col-secbody')];
    const fig = q('.csf-col-ex'), kf = q('aside.csf-col-fig');
    const svc = q('.csf-col-split a') || q('.csf-er-hero__service');
    return {
      fonts, cover, origin: location.origin,
      title: T('.csf-col-split h1') || T('h1'), standfirst: T('.csf-col-stand'),
      practice: svc ? svc.textContent.trim() : '', practiceUrl: svc ? svc.href : '',
      intro: blocks(q('.csf-col-intro')),
      s1h: bodies[0] ? T('h2', bodies[0]) : '', s1: blocks(bodies[0]),
      s2h: bodies[1] ? T('h2', bodies[1]) : '', s2: blocks(bodies[1]),
      fig: fig ? { t: T('.ttl', fig), s: T('.sub', fig), notes: [...fig.querySelectorAll('.notes p')].map(x => esc(x.textContent.replace(/\s+/g, ' ').trim())), firm: T('.firm', fig) || 'City Shift Finance' } : null,
      kf: kf ? { v: T('.v', kf), t: T('.t', kf), s: T('.s', kf) } : null,
      faq: [...document.querySelectorAll('.csf-col-ac .ac-i')].map(i => ({ q: T('.ac-q span', i) || T('.ac-q', i), a: [...i.querySelectorAll('.ac-a p')].map(clean) })),
      src: [...document.querySelectorAll('.csf-col-src li')].map(li => esc(li.textContent.replace(/\s+/g, ' ').replace(/\s*,?\s*(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}\/\S*/gi, '').trim()))
    };
  });
  if (!d.title) throw new Error('Title not found on the page');
  if (!d.cover) throw new Error('Cover function (CSF PDF Download 1.0.17) not found on the page');
  if (!d.intro && !d.s1) throw new Error('Body text not found on the page');
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  let inner = `<div class="h serif">${esc(d.title)}</div>${d.standfirst ? `<p class="sf">${esc(d.standfirst)}</p>` : ''}`;
  inner += `<div class="cols">${d.intro}${d.s1h ? `<h3 class="serif sec">${esc(d.s1h)}</h3>` : ''}${d.s1}</div>`;
  if (d.fig) inner += `<div class="pb"><div class="et serif">${esc(d.fig.t)}</div>${d.fig.s ? `<div class="es">${esc(d.fig.s)}</div>` : ''}${chart ? `<div class="chart"><img src="${chart}"></div>` : ''}<div class="nt">${d.fig.notes.map(x => `<p>${x}</p>`).join('')}</div><div class="brand">${esc(d.fig.firm)}</div></div>`;
  if (d.s2 || d.kf) inner += `<div class="pb">${d.s2h ? `<h2 class="serif">${esc(d.s2h)}</h2>` : ''}<div class="cols">${d.kf ? `<div class="kf"><div class="v">${esc(d.kf.v)}</div><p>${esc(d.kf.t)}</p>${d.kf.s ? `<small>${esc(d.kf.s)}</small>` : ''}</div>` : ''}${d.s2}</div></div>`;
  if (d.faq.length || d.src.length) inner += `<div class="pb">${d.faq.length ? `<h2 class="serif">Frequently asked questions</h2><div class="cols">${d.faq.map(f => `<div class="qa"><h3 class="serif">${esc(f.q)}</h3>${f.a.map(x => `<p>${x}</p>`).join('')}</div>`).join('')}</div>` : ''}${d.src.length ? `<div class="src"><div class="lab">Sources</div><ol>${d.src.map(x => `<li>${x}</li>`).join('')}</ol></div>` : ''}</div>`;
  const BLUE = '#071D46';
  const bodyHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${d.fonts}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:${BLUE};-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Helvetica Now","Helvetica Neue",Helvetica,Arial,sans-serif;color:#fff}
.serif{font-family:"Tiempos Headline",Georgia,serif;font-weight:600}
.h{font-size:32px;line-height:1.15;margin:0 0 .22in;max-width:6in}
.sf{font-size:13px;line-height:1.6;color:#c9d6f5;max-width:6in;margin:0 0 .35in}
.cols{column-count:2;column-gap:.32in;font-size:9.6px;line-height:1.62;color:#e9efff}
.cols p{margin:0 0 9px}
.cols ul{margin:0 0 9px 14px}.cols li{margin:0 0 5px}
.cols h3{font-size:12.5px;line-height:1.35;color:#fff;margin:6px 0 7px;break-after:avoid}
.cols h3.sec{font-size:15px;margin:10px 0 8px}
.pb{break-before:page}
h2{font-size:22px;line-height:1.2;color:#fff;margin:0 0 .22in;max-width:6in}
.box{border:1px solid rgba(255,255,255,.3);padding:10px 12px;margin:4px 0 12px;break-inside:avoid}
.box h4,.lab{font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:#5FB4FF;margin:0 0 6px;font-weight:700}
.box p{font-size:9.2px;line-height:1.55;margin:0 0 6px}
.kf{background:#0E2A5A;padding:.22in .26in;margin:0 0 12px;break-inside:avoid}
.kf .v{font-weight:700;font-size:30px;color:#3AADFA;line-height:1.1;margin:0 0 6px}
.kf p{font-weight:700;font-size:11px;line-height:1.45;color:#fff;margin:0 0 6px}
.kf small{font-size:8px;color:#9fb6ff}
.et{font-size:18px;line-height:1.25;margin:0 0 6px}
.es{font-size:10px;line-height:1.5;color:#c9d6f5;margin:0 0 .2in}
.chart img{display:block;width:100%;max-height:6in;object-fit:contain;object-position:left top}
.nt{font-size:7.6px;line-height:1.5;color:#b9c7ea;margin-top:.16in}
.nt p{margin:0 0 4px}
.brand{margin-top:.14in;font-size:8px;font-weight:700;color:#fff}
.qa{break-inside:avoid;margin:0 0 10px}.qa h3{margin-top:0}
.src{border-top:1px solid rgba(255,255,255,.25);padding-top:.18in;margin-top:.2in;font-size:8.4px;line-height:1.55;color:#c9d6f5;break-inside:avoid}
.src ol{margin:0 0 0 14px}.src li{margin:0 0 2px}
</style></head><body>${inner}</body></html>`;

  const coverHtml = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:8.5in 11in;margin:0}*{margin:0;padding:0}html,body{background:${BLUE}}img{display:block;width:8.5in;height:11in}</style></head><body><img src="${d.cover}"></body></html>`;
  const pg = await b.newPage();
  await pg.setContent(coverHtml, { waitUntil: 'load' });
  const coverPdf = await pg.pdf({ width: '8.5in', height: '11in', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
  await pg.setContent(bodyHtml, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready);
  const tag = d.practice ? `<div style="width:100%;height:100%;position:relative;-webkit-print-color-adjust:exact"><div style="position:absolute;top:0;right:.55in;font-family:Helvetica,Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:.14em;color:#3AADFA;border:1px solid #3AADFA;border-top:none;padding:7px 10px;text-transform:uppercase">${esc(d.practice)}</div></div>` : '<div></div>';
  const foot = '<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:8px;color:#9fb6ff;padding:0 .9in 0 1.3in;display:flex;justify-content:space-between"><span style="color:#1794DE;font-weight:700">City Shift Finance</span><span class="pageNumber"></span></div>';
  const bodyPdf = await pg.pdf({ width: '8.5in', height: '11in', printBackground: true, margin: { top: '1.05in', bottom: '0.8in', left: '1.3in', right: '0.9in' }, displayHeaderFooter: true, headerTemplate: tag, footerTemplate: foot });
  let tagBox = null;
  if (d.practice) { await pg.setContent(`<html><body style="margin:0;width:816px">${tag}</body></html>`); tagBox = await pg.evaluate(() => { const e = document.body.querySelector('div > div'); const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }); }
  await pg.close();

  const outDoc = await PDFDocument.create();
  for (const s0 of [coverPdf, bodyPdf]) { const s = await PDFDocument.load(s0); (await outDoc.copyPages(s, s.getPageIndices())).forEach(x => outDoc.addPage(x)); }
  const pages = outDoc.getPages();
  const addLink = (pgx, rect, uri) => { const ref = outDoc.context.register(outDoc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: rect, Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of(uri) } })); const an = pgx.node.lookup(PDFName.of('Annots')); if (an) an.push(ref); else pgx.node.set(PDFName.of('Annots'), outDoc.context.obj([ref])); };
  for (let i = 1; i < pages.length; i++) {
    const pgx = pages[i], H = pgx.getHeight();
    // Chromium leaves the margins unpainted: a full-page site-blue rectangle goes underneath the content
    const bgRef = outDoc.context.register(outDoc.context.flateStream(`q 0.0275 0.1137 0.2745 rg 0 0 ${pgx.getWidth()} ${H} re f Q\n`));
    const c = pgx.node.get(PDFName.of('Contents'));
    if (c instanceof PDFArray) c.insert(0, bgRef); else pgx.node.set(PDFName.of('Contents'), outDoc.context.obj(c ? [bgRef, c] : [bgRef]));
    if (tagBox && d.practiceUrl) { const k = 0.75; addLink(pgx, [tagBox[0] * k, H - tagBox[3] * k - 2, tagBox[2] * k, H - tagBox[1] * k], d.practiceUrl); }
    addLink(pgx, [1.3 * 72, 0.25 * 72, 1.3 * 72 + 80, 0.5 * 72], d.origin + '/'); // footer "City Shift Finance" -> homepage
  }
  outDoc.setTitle('City Shift Finance - ' + d.title);
  outDoc.setAuthor('City Shift Finance'); outDoc.setCreator('City Shift Finance'); outDoc.setProducer('City Shift Finance');
  require('fs').writeFileSync(OUT, await outDoc.save());
};
