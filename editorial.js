// Portrait (US Letter) PDF for Deep Dives (csf_editorial_report, main.csf-er) and Commentary (.csf-commentary).
// Called from render.js. Added Nov 13 2026 (CSF PDF Download 1.0.15).
//  - page 1 = the magazine cover drawn by the page itself (window.csfPdfCover, printed by the plugin), so the PDF cover
//    and the cover in the page's Downloads block are always identical (photo / gradient-top / cover override rules live
//    in the plugin, in one place);
//  - body pages: one solid site blue (#071D46), practice tag top right (links to the practice page), footer
//    "City Shift Finance" (links to the homepage) and the page number;
//  - Deep Dive: title, standfirst, intro, then each section (its band image, heading, two-column text, sidebars as boxes,
//    pull quotes and the takeaway), then "About the author(s)";
//  - Commentary: title, standfirst, the essay in two columns; no signature and no call to action (owner rule);
//  - no in-text links (pages may be removed later); footnote markers and the site's link notes are left out.
// Everything is read from the live page, so new pieces need no changes here.
const { PDFDocument, PDFName, PDFString, PDFArray } = require('pdf-lib');

module.exports = async function editorialPdf(b, p, OUT) {
  await p.waitForFunction(() => typeof window.csfPdfCover === 'function', null, { timeout: 30000 }).catch(() => {});
  const d = await p.evaluate(async () => {
    const q = (s, r) => (r || document).querySelector(s);
    const T = (s, r) => { const e = q(s, r); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
    const clean = el => { const c = el.cloneNode(true); c.querySelectorAll('.csf-er-fn, sup.csf-er-fn, .csf-er-plus').forEach(n => n.remove()); c.querySelectorAll('*').forEach(n => { if (!['STRONG', 'B', 'EM', 'I', 'BR'].includes(n.tagName)) { n.replaceWith(...n.childNodes); return; } [...n.attributes].forEach(a => n.removeAttribute(a.name)); }); return c.innerHTML.replace(/\[\d+\]/g, '').trim(); };
    const src = img => img ? (img.currentSrc || img.src || img.getAttribute('data-src') || '') : '';
    const skip = el => el.closest('aside, .csf-er-subscribe, .csf-er-sidebar--help, .csf-er-autolink-note, .csf-commentary-autolink-note, .csf-commentary__closing, .csf-pdf-dl-host, .csf-report-related');
    const fonts = (() => { const o = []; for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; } const base = sh.href || location.href; for (const r of rules) { if (r.type === 5) o.push(r.cssText.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, qq, u) => 'url("' + new URL(u, base).href + '")')); } } return o.join('\n'); })();
    let cover = '';
    if (window.csfPdfCover) { try { const c = await window.csfPdfCover(1632, 2112); cover = c.toDataURL('image/jpeg', 0.9); } catch (e) {} }
    // walk a container in page order and turn it into blocks
    const blocks = root => {
      const out = [];
      const visit = el => {
        for (const n of el.children) {
          if (skip(n) && !n.matches('.csf-er-sidebar:not(.csf-er-sidebar--help)')) continue;
          if (n.matches('.csf-er-sidebar')) { const li = [...n.querySelectorAll('li')].map(clean).filter(Boolean); const ps = [...n.querySelectorAll('.csf-er-sidebar-body p')].map(clean).filter(Boolean); out.push({ box: T('.csf-er-sidebar-title', n), li, ps }); continue; }
          if (n.matches('.csf-er-pullquote, blockquote')) { out.push({ quote: n.textContent.replace(/\s+/g, ' ').trim() }); continue; }
          if (n.matches('.csf-er-takeaway')) { out.push({ take: T('.csf-er-takeaway-label', n), text: T('.csf-er-takeaway-text', n) }); continue; }
          if (/^H[2-4]$/.test(n.tagName)) { out.push({ h: n.textContent.replace(/\s+/g, ' ').trim() }); continue; }
          if (n.tagName === 'P') { if (n.textContent.trim()) out.push({ p: clean(n) }); continue; }
          if (n.tagName === 'UL' || n.tagName === 'OL') { out.push({ ul: [...n.querySelectorAll(':scope > li')].map(clean) }); continue; }
          if (n.children.length) visit(n);
        }
      };
      visit(root); return out;
    };
    const er = !!q('main.csf-er');
    const svc = q('.csf-er-hero__service') || q('.csf-commentary-hero__service') || q('.csf-chm-service');
    const out = {
      er, fonts, cover, origin: location.origin,
      title: er ? T('.csf-er-hero__copy h1') || T('h1') : T('.csf-commentary-hero__title') || T('h1'),
      standfirst: er ? T('.csf-er-standfirst') : T('.csf-commentary__standfirst'),
      practice: svc ? svc.textContent.trim() : '', practiceUrl: svc ? svc.href : ''
    };
    if (er) {
      out.intro = blocks(q('.csf-er-intro__copy') || document.createElement('div'));
      out.sections = [...document.querySelectorAll('.csf-er-section')].map(s => ({ img: src(q('.csf-er-band__media img', s)), h: T('.csf-er-band-inner h2, .csf-er-band h2', s) || T('h2', s), blocks: blocks(q('.csf-er-card', s) || s).filter(x => x.h !== T('h2', s)), take: (() => { const t = q('.csf-er-takeaway', s); return t && !t.closest('.csf-er-card') ? { take: T('.csf-er-takeaway-label', t), text: T('.csf-er-takeaway-text', t) } : null; })() }));
      const ab = q('.csf-er-about'); out.about = ab ? { h: T('h2, h3, h4', ab), ps: [...ab.querySelectorAll('p')].map(clean).filter(Boolean) } : null;
    } else {
      out.body = blocks(q('.csf-commentary__transcript') || document.createElement('div'));
    }
    return out;
  });
  if (!d.title) throw new Error('Title not found on the page');
  if (!d.cover) throw new Error('Cover function (CSF PDF Download 1.0.15) not found on the page');
  if (d.er ? !(d.sections || []).length : !(d.body || []).length) throw new Error('Body text not found on the page');

  // section images as data URLs, re-encoded as JPEG (max 1800px wide) so the download stays small
  const shrink = u => p.evaluate(async s => { const i = new Image(); i.src = s; await i.decode(); const k = Math.min(1, 1800 / i.naturalWidth); const c = document.createElement('canvas'); c.width = Math.round(i.naturalWidth * k); c.height = Math.round(i.naturalHeight * k); c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.86); }, u).catch(() => '');
  const data = async u => { if (!u) return ''; try { const r = await p.request.get(u); if (r.ok() && /^image\//.test(r.headers()['content-type'] || '')) return await shrink('data:' + r.headers()['content-type'] + ';base64,' + (await r.body()).toString('base64')); } catch (e) {} return ''; };
  if (d.er) for (const s of d.sections) s.data = await data(s.img);

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const blk = x => x.p !== undefined ? `<p>${x.p}</p>`
    : x.h ? `<h3 class="serif">${esc(x.h)}</h3>`
    : x.ul ? `<ul>${x.ul.map(h => `<li>${h}</li>`).join('')}</ul>`
    : x.quote ? `<blockquote class="serif">${esc(x.quote)}</blockquote>`
    : x.box !== undefined ? `<div class="box"><h4>${esc(x.box)}</h4>${x.ps.map(h => `<p>${h}</p>`).join('')}${x.li.length ? `<ul>${x.li.map(h => `<li>${h}</li>`).join('')}</ul>` : ''}</div>`
    : x.take !== undefined ? `<div class="take"><h4>${esc(x.take || 'Takeaway')}</h4><p class="serif">${esc(x.text)}</p></div>` : '';
  let inner = `<div class="h serif">${esc(d.title)}</div>${d.standfirst ? `<p class="sf">${esc(d.standfirst)}</p>` : ''}`;
  if (d.er) {
    inner += `<div class="cols">${d.intro.map(blk).join('')}</div>`;
    for (const s of d.sections) {
      inner += `<div class="sec">${s.data ? `<div class="band" style="background-image:url('${s.data}')"></div>` : ''}${s.h ? `<h2 class="serif">${esc(s.h)}</h2>` : ''}<div class="cols">${s.blocks.map(blk).join('')}</div>${s.take ? blk(s.take) : ''}</div>`;
    }
    if (d.about && d.about.ps.length) inner += `<div class="about"><h4>${esc(d.about.h || 'About the author(s)')}</h4>${d.about.ps.map(h => `<p>${h}</p>`).join('')}</div>`;
  } else {
    inner += `<div class="cols">${d.body.map(blk).join('')}</div>`;
  }
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
.sec{break-before:page}
.band{width:100%;aspect-ratio:2.6/1;background-size:cover;background-position:center;margin:0 0 .25in}
h2{font-size:22px;line-height:1.2;color:#fff;margin:0 0 .22in;max-width:6in}
blockquote{font-size:14px;line-height:1.35;color:#fff;margin:8px 0 12px;break-inside:avoid}
.box{border:1px solid rgba(255,255,255,.3);padding:10px 12px;margin:4px 0 12px;break-inside:avoid}
.box h4,.take h4,.about h4{font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:#5FB4FF;margin:0 0 6px}
.box p,.box li{font-size:9.2px;line-height:1.55}
.box ul{margin:0 0 0 13px}
.take{background:#0E2A5A;padding:.2in .25in;margin:.2in 0 0;break-inside:avoid}
.take p{font-size:14px;line-height:1.4;color:#fff;margin:0}
.about{break-inside:avoid;margin-top:.4in;border-top:1px solid rgba(255,255,255,.25);padding-top:.22in;font-size:10px;line-height:1.6;color:#e9efff;max-width:6in}
.about p{margin:0 0 8px}
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
