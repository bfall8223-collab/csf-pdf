// Portrait (US Letter) editorial PDF for gated City Shift Finance case studies.
// Called from render.js when the page contains the new case study layout (.csf-cs-bd).
// Reads the text from the page itself plus the PDF-only block <script id="csf-cs-pdf-data">
// (At a glance, phases, chart) that the CSF Case Study Editorial plugin prints on gated case studies.
// Pages: cover, The Opportunity, The Solution, The Impact (+ How we can help). Long sections
// continue onto extra pages automatically.
// NEW (Oct 2026): if the PDF content box also has cover_image + page2_headline + page2_body,
// the PDF is the designed cover image followed by a McKinsey-style article page (see coverArticle).
module.exports = async function caseStudyPdf(b, p, OUT) {
  const d = await p.evaluate(() => {
    const q = (s, r) => (r || document).querySelector(s);
    const T = (s, r) => { const e = q(s, r); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
    const clean = el => { const c = el.cloneNode(true); c.querySelectorAll('*').forEach(n => { if (!['A', 'STRONG', 'B', 'EM', 'I', 'SUP', 'BR'].includes(n.tagName)) { n.replaceWith(...n.childNodes); return; } [...n.attributes].forEach(a => { if (!(n.tagName === 'A' && a.name === 'href')) n.removeAttribute(a.name); }); if (n.tagName === 'A') n.setAttribute('href', n.href); }); return c.innerHTML.trim(); };
    const paras = (el, skip) => el ? [...el.querySelectorAll('p')].filter(x => x.textContent.trim() && !(skip && x.closest(skip))).map(clean) : [];
    let data = {}; try { data = JSON.parse((q('#csf-cs-pdf-data') || {}).textContent || '{}'); } catch (e) {}
    const bd = q('.csf-cs-bd'); const img = q('.csf-col-split .img img', bd); const meta = q('.csf-col-split .meta a', bd);
    const sol = q('.csf-cs-solution'); const imp = q('.csf-cs-impact');
    const head = el => { if (!el) return ''; const h = q('h2, h3', el); if (h) return h.textContent.replace(/\s+/g, ' ').trim(); const c = el.cloneNode(true); c.querySelectorAll('.csf-cs-kicker').forEach(k => k.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); };
    return {
      title: T('h1', bd), practice: meta ? meta.textContent.trim() : '', practiceUrl: data.practice_url || (meta ? meta.href : ''),
      standfirst: T('.csf-col-stand', bd), hero: img ? (img.currentSrc || img.src || '') : '',
      og: ((q('meta[property="og:image"]') || {}).content || ''), url: (q('link[rel=canonical]') || {}).href || location.href.split('?')[0],
      intro: paras(q('.csf-col-intro', bd)),
      solHead: data.solution_heading || head(q('.csf-cs-solution__intro', sol)), sol: paras(q('.csf-cs-solution__copy', sol), '.csf-cs-feature-wrap'),
      impHead: head(q('.csf-cs-impact__header', imp)), imp: paras(q('.csf-cs-impact__copy', imp)),
      quote: T('.csf-cs-impact__quote', imp).replace(/^[“"]+|[”"]+$/g, ''), cite: T('.csf-cs-impact__attribution', imp),
      oppHead: data.opportunity_heading || '', cover: data.cover_image || '', p2Head: data.page2_headline || '', p2Body: data.page2_body || '', glance: data.glance || {}, phases: data.phases || [], chart: data.chart || {}, contact: data.contact_url || '/contact/',
      fonts: (() => { const out = []; for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; } const base = sh.href || location.href; for (const r of rules) { if (r.type === 5) out.push(r.cssText.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, qq, u) => 'url("' + new URL(u, base).href + '")')); } } return out.join('\n'); })()
    };
  });
  if (!d.title) throw new Error('Case study title not found on the page');
  if (d.cover && d.p2Body) return coverArticle(b, d, OUT);
  if (!d.intro.length) throw new Error('Case study Opportunity text not found on the page');

  // service page one-liner for "How we can help" (Yoast description of the practice page)
  let svc = '';
  if (d.practiceUrl) { try { const q2 = await b.newPage(); await q2.goto(d.practiceUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }); svc = await q2.evaluate(() => { const g = s => { const e = document.querySelector(s); return e ? (e.getAttribute('content') || '').trim() : ''; }; return g('meta[name="description"]') || g('meta[property="og:description"]'); }); await q2.close(); } catch (e) {} }
  let hero = ''; for (const u of [d.hero, d.og].filter(Boolean)) { try { const r = await p.request.get(u); if (r.ok() && /^image\//.test(r.headers()['content-type'] || '')) { hero = 'data:' + r.headers()['content-type'] + ';base64,' + (await r.body()).toString('base64'); break; } } catch (e) {} }

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const css = d.fonts + `
@page{size:8.5in 11in;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#071D46;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Helvetica Now","Helvetica Neue",Helvetica,Arial,sans-serif;color:#fff}
.pg{width:8.5in;height:11in;position:relative;overflow:hidden;page-break-after:always;background:#071D46}
.area{position:absolute;top:.67in;left:.58in;right:.58in;bottom:.8in;overflow:hidden}
.ft{position:absolute;left:.58in;right:.58in;bottom:.3in;display:flex;justify-content:space-between;font-size:7.5pt;color:rgba(255,255,255,.62)}
.ft a{color:#1794DE;text-decoration:none;font-weight:700}
.kick{font-weight:700;font-size:8pt;letter-spacing:.14em;text-transform:uppercase;color:#1794DE;margin:0 0 .14in}
h3{font:600 22pt/1.2 "Tiempos Headline",Georgia,serif;color:#fff;margin:0 0 .22in}
p{font-size:10.4pt;line-height:1.62;color:rgba(255,255,255,.86);margin:0 0 .12in}
.lead{font-size:13.5pt;line-height:1.55;color:#fff}
p a{color:inherit;text-decoration:none;background-image:linear-gradient(#1794DE,#1794DE);background-repeat:no-repeat;background-size:100% 1px;background-position:0 calc(100% - 1px)}
strong,b{color:#fff}
.cols{column-count:2;column-gap:.33in}.cols p{break-inside:avoid}
.cover .im{position:absolute;left:0;right:0;top:0;height:6.25in;background:#031722 center/cover no-repeat}
.cover .tx{position:absolute;left:0;right:0;top:6.25in;bottom:0;background:#031722;padding:.46in .58in}
.cover .wm{position:absolute;top:.42in;left:.58in;font-weight:700;font-size:11pt;letter-spacing:.05em;color:#fff;text-shadow:0 1px 8px rgba(3,23,34,.5)}
.cover .wm small{display:block;font-size:6pt;letter-spacing:.45em;margin-top:3px;padding-left:7px}
.meta{font-size:10pt;color:#fff;margin:0 0 .15in}.meta a{color:#1794DE;text-decoration:none;background:none}
.cover h1{font:600 31pt/1.12 "Tiempos Headline",Georgia,serif;color:#fff;margin:0 0 .19in}
.cover .sf{font-size:13pt;line-height:1.5;color:#fff;max-width:6.7in}
.g2{display:grid;grid-template-columns:2.42in 1fr;gap:.38in;align-items:start}
.glance{background:#031722;padding:.27in .29in}
.glance dt{font-weight:700;font-size:7pt;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.62);margin:0 0 .04in}
.glance dd{font-size:10pt;line-height:1.45;color:#fff;margin:0}.glance div{margin:0 0 .17in}.glance div:last-child{margin:0}
.ph{display:grid;grid-template-columns:1.25in 1fr;gap:.19in;background:rgba(255,255,255,.05);padding:.25in .23in;margin:0 0 .15in}
.ph .n{font:600 11pt/1.2 "Tiempos Headline",Georgia,serif;color:#1794DE}
.ph h4{font-weight:700;font-size:11pt;color:#fff;margin:0 0 .08in}.ph p{margin:0}
.quote{font:400 17pt/1.42 "Tiempos Headline",Georgia,serif;color:#fff;margin:.12in 0 0}
.quote cite{display:block;font:400 9.5pt/1.4 "Helvetica Now","Helvetica Neue",Arial,sans-serif;font-style:normal;color:rgba(255,255,255,.62);margin-top:.14in}
.chart-t{font-weight:700;font-size:10.5pt;color:#fff;margin:0 0 .12in}
.legend{display:flex;gap:.2in;font-size:8.5pt;color:rgba(255,255,255,.62);margin:0 0 .16in}.legend i{display:inline-block;width:.12in;height:.12in;margin-right:.06in;vertical-align:-1px}
.chart{display:grid;grid-template-columns:1.6in 1fr;row-gap:.14in;column-gap:.16in;align-items:center}
.chart .lab{font-size:9.5pt;line-height:1.3;color:#fff;text-align:right}
.bars{display:flex;flex-direction:column;gap:.04in}
.bar{height:.17in;display:flex;align-items:center;justify-content:flex-end;padding-right:.06in;font-weight:700;font-size:8pt;color:#fff;min-width:.42in}
.bar.b{background:rgba(255,255,255,.28)}.bar.a{background:#1794DE}
.src{font-size:8pt;color:rgba(255,255,255,.62);margin:.14in 0 .26in}
.help{background:#031722;padding:.3in .33in;margin-top:.12in}
.help p{color:#fff}
.btn{display:inline-block;background:#2326C6;color:#fff;font-weight:700;font-size:10pt;padding:.14in .22in;text-decoration:none;margin-top:.04in}
`;
  const kick = t => `<div class="kick">${t}</div>`;
  const glance = () => { const g = d.glance || {}; const rows = [['Client', g.client], ['Practice', d.practice], ['Scope', g.scope], ['Engagement', g.engagement]].filter(r => r[1]); return rows.length ? `<dl class="glance">${rows.map(r => `<div><dt>${r[0]}</dt><dd>${esc(r[1])}</dd></div>`).join('')}</dl>` : ''; };
  const phases = () => (d.phases || []).map((ph, i) => `<div class="ph"><div class="n">${String(i + 1).padStart(2, '0')} ${esc(ph.label)}</div><div>${ph.title ? `<h4>${esc(ph.title)}</h4>` : ''}<p>${esc(ph.text)}</p></div></div>`).join('');
  const quote = () => d.quote ? `<div class="quote">“${esc(d.quote)}”${d.cite ? `<cite>${esc(d.cite)}</cite>` : ''}</div>` : '';
  const chart = () => {
    const c = d.chart || {}; const rows = c.rows || []; if (!rows.length) return '';
    const max = Math.max(...rows.map(r => Math.max(Math.abs(r.before), Math.abs(r.after))), 1); const u = c.unit || '';
    const w = v => Math.max(6, Math.round(Math.abs(v) / max * 92));
    return `${c.title ? `<div class="chart-t">${esc(c.title)}</div>` : ''}<div class="legend"><span><i style="background:rgba(255,255,255,.28)"></i>Before</span><span><i style="background:#1794DE"></i>After</span></div><div class="chart">${rows.map(r => `<div class="lab">${esc(r.label)}</div><div class="bars"><div class="bar b" style="width:${w(r.before)}%">${esc(r.before + u)}</div><div class="bar a" style="width:${w(r.after)}%">${esc(r.after + u)}</div></div>`).join('')}</div><p class="src">Exhibit 1${c.source ? ' · ' + esc(c.source) : ''}</p>`;
  };
  const help = () => `<div class="help">${kick('How we can help')}${svc ? `<p>${esc(svc)}</p>` : ''}<a class="btn" href="${esc(d.contact)}">Talk to City Shift Finance</a></div>`;

  // measuring page: same CSS, used to decide how much text fits on each page
  const lay = await b.newPage({ viewport: { width: 816, height: 1056 } });
  await lay.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="m"></div></body></html>`, { waitUntil: 'load' });
  const fits = async inner => lay.evaluate(h => { const m = document.getElementById('m'); m.innerHTML = `<section class="pg"><div class="area">${h}</div></section>`; const a = m.querySelector('.area'); return a.scrollHeight <= a.clientHeight + 1; }, inner);
  // greedy: how many paragraphs fit with the given wrapper
  const take = async (list, wrap) => { let k = 0; while (k < list.length && await fits(wrap(list.slice(0, k + 1)))) k++; return k; };
  const P = list => list.map(h => `<p>${h}</p>`).join('');
  const cols = list => list.length ? `<div class="cols">${P(list)}</div>` : '';

  const pages = [];
  // The Opportunity: glance box left, text right; overflow continues in two columns
  {
    const top = kick('The Opportunity') + (d.oppHead ? `<h3>${esc(d.oppHead)}</h3>` : '');
    const g = glance(); const first = d.intro.map((h, i) => i === 0 ? `<p class="lead">${h}</p>` : `<p>${h}</p>`);
    const wrap = l => top + (g ? `<div class="g2">${g}<div>${l.join('')}</div></div>` : l.join(''));
    let k = await take(first, wrap); if (!k) k = 1;
    pages.push(wrap(first.slice(0, k)));
    let rest = d.intro.slice(k);
    while (rest.length) { const n = Math.max(1, await take(rest, l => cols(l))); pages.push(cols(rest.slice(0, n))); rest = rest.slice(n); }
  }
  // The Solution: phases, text in two columns, then the client quote
  {
    const top = kick('The Solution') + (d.solHead ? `<h3>${esc(d.solHead)}</h3>` : '') + phases();
    let rest = d.sol.slice(); let head = top; let q = quote();
    for (;;) {
      const n = await take(rest, l => head + cols(l));
      const cur = rest.slice(0, n); rest = rest.slice(n);
      if (!rest.length && q && await fits(head + cols(cur) + q)) { pages.push(head + cols(cur) + q); q = ''; break; }
      if (!cur.length && head === '') { break; }
      pages.push(head + cols(cur)); head = '';
      if (!rest.length) { if (q) pages.push(q); break; }
    }
  }
  // The Impact: heading, chart, text, How we can help
  {
    const top = kick('The Impact') + (d.impHead ? `<h3>${esc(d.impHead)}</h3>` : '') + chart();
    let rest = d.imp.slice(); let head = top; let hp = help();
    for (;;) {
      const n = await take(rest, l => head + cols(l));
      const cur = rest.slice(0, n); rest = rest.slice(n);
      if (!rest.length && await fits(head + cols(cur) + hp)) { pages.push(head + cols(cur) + hp); hp = ''; break; }
      if (!cur.length && head === '') { break; }
      pages.push(head + cols(cur)); head = '';
      if (!rest.length) { if (hp) pages.push(hp); break; }
    }
  }
  await lay.close();

  const foot = n => `<div class="ft"><span><a href="${esc(d.url)}">City Shift Finance</a> &nbsp;|&nbsp; Case Study</span><span>${esc(d.title)} &nbsp;&nbsp; ${n}</span></div>`;
  let body = `<section class="pg cover"><div class="im" style="background-image:url('${hero}')"></div><div class="wm">CITY SHIFT<small>FINANCE</small></div><div class="tx"><p class="meta">${d.practiceUrl ? `<a href="${esc(d.practiceUrl)}">${esc(d.practice)}</a>` : esc(d.practice)} | Case Study</p><h1>${esc(d.title)}</h1>${d.standfirst ? `<p class="sf">${esc(d.standfirst)}</p>` : ''}</div></section>`;
  pages.forEach((h, i) => { body += `<section class="pg"><div class="area">${h}</div>${foot(i + 2)}</section>`; });
  const pp = await b.newPage();
  await pp.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>City Shift Finance - ${esc(d.title)}</title><style>${css}</style></head><body>${body}</body></html>`, { waitUntil: 'load' });
  await pp.waitForTimeout(500);
  await pp.pdf({ path: OUT, preferCSSPageSize: true, printBackground: true });
};


// ---------------------------------------------------------------------------
// Cover + article layout (approved Oct 2026, modeled on McKinsey on Finance page 3).
// Used when the PDF content box has "cover_image", "page2_headline" and "page2_body".
// Page 1: the designed cover image, full page. Page 2 onward: blue gradient, practice tab
// top right, large serif headline, body in two columns; long text continues on more pages.
// Without those fields the original portrait layout above is used, unchanged.
async function coverArticle(b, d, OUT) {
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  let cover = '';
  try { const pg = await b.newPage(); const r = await pg.request.get(d.cover); if (r.ok() && /^image\//.test(r.headers()['content-type'] || '')) cover = 'data:' + r.headers()['content-type'] + ';base64,' + (await r.body()).toString('base64'); await pg.close(); } catch (e) {}
  if (!cover) throw new Error('PDF cover image could not be downloaded: ' + d.cover);
  const paras = (() => { const m = String(d.p2Body).match(/<p[^>]*>[\s\S]*?<\/p>/gi); return (m && m.length ? m : [String(d.p2Body)]).map(x => x.replace(/^<p[^>]*>|<\/p>$/gi, '').trim()).filter(Boolean); })();
  const css = d.fonts + `
@page{size:8.5in 11in;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Helvetica Now","Helvetica Neue",Helvetica,Arial,sans-serif;color:#fff}
.pg{width:8.5in;height:11in;position:relative;overflow:hidden;page-break-after:always;background:linear-gradient(180deg,#1a58f8 0%,#0b3cc8 35%,#012182 70%,#01103f 100%)}
.cv{background:#01103f center/cover no-repeat}
.tab{position:absolute;top:0;right:.56in;border:1pt solid #4cd9fd;border-top:none;padding:.14in .1in .07in;font-weight:700;font-size:6.5pt;letter-spacing:.09em;text-transform:uppercase;color:#4cd9fd}
.tab a{color:inherit;text-decoration:none}
h1{position:absolute;top:1.28in;left:1.64in;right:.83in;font:600 34pt/1.08 "Tiempos Headline",Georgia,serif;color:#fff}
.area{position:absolute;left:1.64in;right:.61in;bottom:.83in}
.cols{column-count:2;column-gap:.31in;height:100%;column-fill:auto}
p{font-size:8.4pt;line-height:1.5;color:rgba(255,255,255,.92);margin:0 0 .125in}
p a{color:inherit;text-decoration:none;background-image:linear-gradient(#4cd9fd,#4cd9fd);background-repeat:no-repeat;background-size:100% 1px;background-position:0 calc(100% - 1px)}
strong,b{color:#fff}
.pn{position:absolute;bottom:.36in;right:.61in;font-size:7pt;color:rgba(255,255,255,.7)}
`;
  const tab = d.practice ? `<div class="tab">${d.practiceUrl ? `<a href="${esc(d.practiceUrl)}">${esc(d.practice)}</a>` : esc(d.practice)}</div>` : '';
  const P = l => `<div class="cols">${l.map(h => `<p>${h}</p>`).join('')}</div>`;
  // measure: the first article page starts below the headline, later pages start near the top
  const lay = await b.newPage({ viewport: { width: 816, height: 1056 } });
  await lay.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="m"></div></body></html>`, { waitUntil: 'load' });
  const headH = await lay.evaluate(h => { const m = document.getElementById('m'); m.innerHTML = `<section class="pg"><h1>${h}</h1></section>`; const e = m.querySelector('h1'); return e.offsetTop + e.offsetHeight; }, esc(d.p2Head || d.title));
  const top1 = Math.round(headH + 52), topN = 96;
  const fits = (l, top) => lay.evaluate(([h, t]) => { const m = document.getElementById('m'); m.innerHTML = `<section class="pg"><div class="area" style="top:${t}px">${h}</div></section>`; const c = m.querySelector('.cols'); const a = m.querySelector('.area'); const last = c.lastElementChild; if (!last) return true; const r = last.getBoundingClientRect(), ar = a.getBoundingClientRect(); return r.bottom <= ar.bottom + 1 && r.right <= ar.right + 1; }, [P(l), top]);
  const pages = []; let rest = paras.slice(); let top = top1;
  while (rest.length) { let k = 0; while (k < rest.length && await fits(rest.slice(0, k + 1), top)) k++; if (!k) k = 1; pages.push({ top, l: rest.slice(0, k) }); rest = rest.slice(k); top = topN; }
  await lay.close();
  let body = `<section class="pg cv" style="background-image:url('${cover}')"></section>`;
  pages.forEach((pg, i) => { body += `<section class="pg">${tab}${i === 0 ? `<h1>${esc(d.p2Head || d.title)}</h1>` : ''}<div class="area" style="top:${pg.top}px">${P(pg.l)}</div><div class="pn">${i + 2}</div></section>`; });
  const pp = await b.newPage();
  await pp.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>City Shift Finance - ${esc(d.title)}</title><style>${css}</style></head><body>${body}</body></html>`, { waitUntil: 'load' });
  await pp.waitForTimeout(500);
  await pp.pdf({ path: OUT, preferCSSPageSize: true, printBackground: true });
}
