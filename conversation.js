// Portrait (US Letter) PDF for Executive Conversations and Book Recommendations (post type csf_exec_conv).
// Called from render.js when the page has the conversation layout (.csf-conv-prose).
// Design approved Nov 9 2026: one solid site blue (#071D46) on every page, no gradients or fades;
//  - cover: "City Shift Finance" centered (light Helvetica Now), label box under it
//    ("Executive Conversation" or "Book Recommendation"), serif title, standfirst, hero image at the
//    bottom on a background sampled from the image itself so the image never shows as a box;
//  - body pages: practice tag top right (links to the practice page), page number bottom right;
//    Executive Conversation = all questions and answers in two columns;
//    Book = one page per question with its image, then the author image and the three end columns;
//  - no in-text links (only the practice tag and the Connect with us button link out);
//  - last block on every PDF: "WHO WE ARE" (homepage meta description, read live) + centered
//    "Connect with us" button (the practice's Contact link from the page header).
// Book cover title = the real book title, read from the ABOUT THE BOOK column ("<title> was written by ...");
// falls back to the book name shown above the questions.
// Everything is read from the live page, so new conversations need no changes here.
const { PDFDocument, PDFName, PDFString, PDFArray } = require('pdf-lib');

module.exports = async function conversationPdf(b, p, OUT) {
  const d = await p.evaluate(() => {
    const q = (s, r) => (r || document).querySelector(s);
    const T = (s, r) => { const e = q(s, r); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
    // in-text links (including automatic contextual links) are dropped: only the text is kept, so the PDF never points to a page that may later be removed
    const clean = el => { const c = el.cloneNode(true); c.querySelectorAll('*').forEach(n => { if (!['STRONG', 'B', 'EM', 'I', 'SUP', 'BR'].includes(n.tagName)) { n.replaceWith(...n.childNodes); return; } [...n.attributes].forEach(a => n.removeAttribute(a.name)); }); return c.innerHTML.trim(); };
    const paras = el => el ? [...el.querySelectorAll('p')].filter(x => x.textContent.trim()).map(clean) : [];
    const src = img => img ? (img.currentSrc || img.src || img.getAttribute('data-src') || '') : '';
    const svc = q('.csf-chm-service');
    const contact = [...document.querySelectorAll('header a, nav a, a')].find(a => /^\s*contact\s*$/i.test(a.textContent) && /contact/i.test(a.href));
    const out = {
      title: T('.csf-report-hero__title') || T('h1'), standfirst: T('.csf-profile__bio'),
      hero: src(q('.csf-report-hero__media img')), og: ((q('meta[property="og:image"]') || {}).content || ''),
      practice: svc ? svc.textContent.trim() : '', practiceUrl: svc ? svc.href : '',
      contact: contact ? contact.href : location.origin + '/contact/', origin: location.origin,
      book: !!q('.csf-book-interview-body'),
      fonts: (() => { const o = []; for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; } const base = sh.href || location.href; for (const r of rules) { if (r.type === 5) o.push(r.cssText.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, qq, u) => 'url("' + new URL(u, base).href + '")')); } } return o.join('\n'); })()
    };
    if (out.book) {
      out.part = T('.csf-book-interview-part');
      out.sections = [...document.querySelectorAll('.csf-book-interview-section')].map(s => ({ q: T('h2, h3', s), img: src(q('figure img', s)), a: paras(q('.csf-book-interview-answer', s)) }));
      out.endImg = src(q('.csf-book-end__image img'));
      // the column links (About the author, profile, Related interview, Order the book) stay on the website only
      const noLinks = el => { if (!el) return []; const c = el.cloneNode(true); c.querySelectorAll('.csf-book-end__link').forEach(n => n.remove()); [...c.querySelectorAll('p')].forEach(x => { const a = x.querySelector('a'); if (a && x.textContent.trim() === a.textContent.trim()) x.remove(); }); return paras(c); };
      out.cols = [...document.querySelectorAll('.csf-book-end__column')].map(c => ({ h: T('h2, h3, h4', c), body: noLinks(q('.csf-book-end__copy', c)) }));
    } else {
      const qa = [];
      // any depth: some older conversations were pasted inside nested <div>s; cards/notes are skipped
      [...document.querySelectorAll('.csf-conv-prose p')].filter(el => !el.closest('aside, .csf-conv-editorial-card, .csf-er-autolink-note')).forEach(el => {
        if (!el.textContent.trim()) return;
        const st = el.firstElementChild && el.firstElementChild.tagName === 'STRONG' && el.innerHTML.trim().startsWith('<strong') ? el.firstElementChild : null;
        const label = st ? st.textContent.trim() : '';
        const c = el.cloneNode(true); if (st) c.firstElementChild.remove();
        const html = clean(c).replace(/^\s+/, '');
        if (/^City Shift Finance\s*:?$/i.test(label)) qa.push({ q: c.textContent.trim() });
        else if (label) qa.push({ who: label.replace(/:$/, ''), a: [html] });
        else if (qa.length && qa[qa.length - 1].a) qa[qa.length - 1].a.push(html);
        else qa.push({ who: '', a: [html] });
      });
      out.qa = qa;
    }
    return out;
  });
  if (!d.title) throw new Error('Conversation title not found on the page');
  if (d.book ? !(d.sections || []).length : !(d.qa || []).some(x => x.q)) throw new Error('Conversation questions not found on the page');

  // images as data URLs (the PDF never depends on the site being reachable later)
  // images are re-encoded as JPEG (max 1800px wide) so the download stays small (a book PDF was 14 MB with PNGs)
  const shrink = u => p.evaluate(async src => { const i = new Image(); i.src = src; await i.decode(); const k = Math.min(1, 1800 / i.naturalWidth); const c = document.createElement('canvas'); c.width = Math.round(i.naturalWidth * k); c.height = Math.round(i.naturalHeight * k); c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.86); }, u).catch(() => u);
  const data = async u => { if (!u) return ''; try { const r = await p.request.get(u); if (r.ok() && /^image\//.test(r.headers()['content-type'] || '')) return await shrink('data:' + r.headers()['content-type'] + ';base64,' + (await r.body()).toString('base64')); } catch (e) {} return ''; };
  const hero = (await data(d.hero)) || (await data(d.og));
  if (d.book) { for (const s of d.sections) s.data = await data(s.img); d.endData = await data(d.endImg); }
  // cover background = the hero image's own background colour (top-left pixel), so the image blends in
  let coverBg = '#071D46';
  if (hero) { try { coverBg = await p.evaluate(async u => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = 8; c.height = 8; const x = c.getContext('2d'); x.drawImage(i, 0, 0, 8, 8, 0, 0, 8, 8); const px = x.getImageData(1, 1, 1, 1).data; const lum = (0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]) / 255; return lum > 0.3 ? '' : 'rgb(' + px[0] + ',' + px[1] + ',' + px[2] + ')'; }, hero) || '#071D46'; } catch (e) {} }
  // (a light image background, e.g. a white studio photo, keeps the site blue so the white title stays readable)
  // WHO WE ARE: the homepage's own description (Yoast), read live
  let who = '';
  try { const q2 = await b.newPage(); await q2.goto(d.origin + '/', { waitUntil: 'domcontentloaded', timeout: 45000 }); who = await q2.evaluate(() => { const g = s => { const e = document.querySelector(s); return e ? (e.getAttribute('content') || '').trim() : ''; }; return g('meta[name="description"]') || g('meta[property="og:description"]'); }); await q2.close(); } catch (e) {}

  // real book title from "ABOUT THE BOOK": "<Title: Subtitle> was written by ..."
  let coverTitle = d.title;
  if (d.book) {
    const ab = (d.cols || []).find(c => /about the book/i.test(c.h));
    const txt = ab ? ab.body.join(' ').replace(/<[^>]+>/g, '') : '';
    const m = txt.match(/^(.+?)\s+was\s+(?:co-)?(?:written|published|authored)\b/i);
    coverTitle = m ? m[1].trim() : (d.part || d.title);
  }

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const BLUE = '#071D46';
  const base = d.fonts + `
*{box-sizing:border-box;margin:0;padding:0}
html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Helvetica Now","Helvetica Neue",Helvetica,Arial,sans-serif;color:#fff}
.serif{font-family:"Tiempos Headline",Georgia,serif;font-weight:600}
`;
  // ---------- cover ----------
  const kind = d.book ? 'Book Recommendation' : 'Executive Conversation';
  const imgH = d.book ? '7in' : '6.375in';
  const coverHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${base}
@page{size:8.5in 11in;margin:0}
html,body{background:${coverBg}}
.pg{width:8.5in;height:11in;background:${coverBg};position:relative;overflow:hidden}
.brand{position:absolute;top:.5in;left:0;right:0;text-align:center;font-size:15px;font-weight:400;letter-spacing:.01em}
.kind{position:absolute;top:.82in;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:9px;letter-spacing:.14em;color:#3AADFA;border:1px solid #3AADFA;padding:6px 10px;text-transform:uppercase}
.txt{position:absolute;top:1.55in;left:1.3in;right:.9in}
.t{font-size:${coverTitle.length > 70 ? 40 : 52}px;line-height:1.06}
.sub{margin-top:22px;max-width:5.6in;font-size:15px;line-height:1.5;color:#dbe5ff}
.img{position:absolute;left:0;right:0;bottom:0;height:${imgH};background:url('${hero}') center bottom/cover no-repeat}
</style></head><body><div class="pg"><div class="brand">City Shift Finance</div><div class="kind">${esc(kind)}</div>
<div class="txt"><div class="t serif">${esc(coverTitle)}</div><div class="sub">${esc(d.standfirst)}</div></div>${hero ? '<div class="img"></div>' : ''}</div></body></html>`;

  // ---------- body ----------
  const btn = `<a class="btn" href="${esc(d.contact)}"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><rect x="3" y="5.5" width="18" height="13"/><path d="M3 6l9 7 9-7"/></svg>Connect with us</a>`;
  const whoBlk = `<div class="whoblk"><h4>WHO WE ARE</h4>${who ? `<p>${esc(who)}</p>` : ''}${btn}</div>`;
  let inner = '';
  if (d.book) {
    d.sections.forEach((s, i) => {
      inner += `<div class="${i ? 'sec' : ''}"><div class="bigq serif">${esc(s.q)}</div>${s.data ? `<div class="qimg" style="aspect-ratio:2/1;background-image:url('${s.data}')"></div>` : ''}<div class="cols">${s.a.map(h => `<p>${h}</p>`).join('')}</div></div>`;
    });
    inner += `<div class="sec">${d.endData ? `<div class="qimg" style="aspect-ratio:1864/844;background-image:url('${d.endData}')"></div>` : ''}<div class="end3">${(d.cols || []).map(c => `<div><h4>${esc(c.h)}</h4>${c.body.map(h => `<p>${h}</p>`).join('')}</div>`).join('')}</div>${whoBlk}</div>`;
  } else {
    inner += `<div class="h serif">${esc(d.title)}</div><div class="cols">`;
    d.qa.forEach(x => { if (x.q) inner += `<div class="q serif">${esc(x.q)}</div>`; else inner += x.a.map(h => `<p>${h}</p>`).join(''); });
    inner += `</div>${whoBlk}`;
  }
  const bodyHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${base}
html,body{background:${BLUE}} /* margins are painted in assemble */
.h{font-size:34px;line-height:1.15;margin:0 0 .35in 0;max-width:6in}
.cols{column-count:2;column-gap:.32in;font-size:9.6px;line-height:1.62;color:#e9efff}
.cols p{margin:0 0 9px}
.q{font-size:12.5px;line-height:1.4;color:#fff;margin:4px 0 8px;break-inside:avoid;break-after:avoid}
.sec{break-before:page}
.qimg{width:100%;background-size:cover;background-position:center;margin:2px 0 14px;break-inside:avoid}
.bigq{font-size:19px;line-height:1.25;margin:0 0 .25in}
.end3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.25in;font-size:9.2px;line-height:1.6;color:#e9efff;margin-top:.25in}
.end3 h4{font-size:9px;letter-spacing:.12em;color:#fff;margin-bottom:7px}
.end3 p{margin:0 0 7px}
a{color:inherit;text-decoration:none}
.cols a,.end3 a{background-image:linear-gradient(#1794DE,#1794DE);background-repeat:no-repeat;background-size:100% 1px;background-position:0 100%}
.whoblk{break-inside:avoid;margin-top:.35in;border-top:1px solid rgba(255,255,255,.25);padding-top:.25in}
.whoblk h4{font-size:9px;letter-spacing:.12em;color:#fff;margin-bottom:8px;text-align:center}
.whoblk p{font-size:11px;line-height:1.6;color:#e9efff;max-width:5.6in}
.btn{display:flex;width:fit-content;align-items:center;gap:8px;background:#2251FF;color:#fff;font-size:11px;padding:10px 18px;margin:14px auto 0;background-image:none}
.btn svg{width:14px;height:14px}
</style></head><body>${inner}</body></html>`;

  const pg = await b.newPage();
  await pg.setContent(coverHtml, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready);
  const coverPdf = await pg.pdf({ width: '8.5in', height: '11in', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
  await pg.setContent(bodyHtml, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready);
  const tag = d.practice ? `<div style="width:100%;height:100%;position:relative;-webkit-print-color-adjust:exact"><div style="position:absolute;top:0;right:.55in;font-family:Helvetica,Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:.14em;color:#3AADFA;border:1px solid #3AADFA;border-top:none;padding:7px 10px;text-transform:uppercase">${esc(d.practice)}</div></div>` : '<div></div>';
  const bodyPdf = await pg.pdf({
    width: '8.5in', height: '11in', printBackground: true,
    margin: { top: '1.05in', bottom: '0.8in', left: '1.3in', right: '0.9in' },
    displayHeaderFooter: true, headerTemplate: tag,
    footerTemplate: '<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:8px;color:#9fb6ff;padding:0 .9in;text-align:right"><span class="pageNumber"></span></div>'
  });
  // measure the tag (for its clickable area)
  let tagBox = null;
  if (d.practice) {
    await pg.setContent(`<html><body style="margin:0;width:816px">${tag}</body></html>`);
    tagBox = await pg.evaluate(() => { const e = document.body.querySelector('div > div'); const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
  }
  await pg.close();

  // ---------- assemble: cover + body, tag links, metadata ----------
  const outDoc = await PDFDocument.create();
  for (const src of [coverPdf, bodyPdf]) { const s = await PDFDocument.load(src); (await outDoc.copyPages(s, s.getPageIndices())).forEach(x => outDoc.addPage(x)); }
  // Chromium leaves the page margins unpainted, so each body page gets a full-page site-blue
  // rectangle drawn underneath its content (content, links and button stay on top).
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
  outDoc.setTitle('City Shift Finance - ' + (d.book ? coverTitle : d.title));
  outDoc.setAuthor('City Shift Finance'); outDoc.setCreator('City Shift Finance'); outDoc.setProducer('City Shift Finance');
  require('fs').writeFileSync(OUT, await outDoc.save());
};
