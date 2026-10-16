// Landscape 16:9 editorial PDF, built automatically from a published CSF page.
const {chromium}=require('playwright');
const URL_=process.argv[2], OUT=process.argv[3];
(async()=>{try{
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1200,height:900},deviceScaleFactor:3,userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 CSF-PDF'});
await p.goto(URL_,{waitUntil:'load',timeout:90000});await p.waitForSelector('.csf-report-hero__title, h1',{state:'attached',timeout:45000});await p.waitForTimeout(4000);
await p.addStyleTag({content:'.csf-report-exhibit button,.csf-report-exhibit [role=button]{display:none!important}'});
// 1. content straight from the page (links, bold and italics kept)
const d=await p.evaluate(()=>{
 const T=s=>{const e=document.querySelector(s);return e?e.innerText.trim():''};
 const clean=el=>{const c=el.cloneNode(true);c.querySelectorAll('*').forEach(n=>{if(!['A','STRONG','B','EM','I','SUP','BR'].includes(n.tagName)){n.replaceWith(...n.childNodes);return;}[...n.attributes].forEach(a=>{if(!(n.tagName==='A'&&a.name==='href'))n.removeAttribute(a.name)});if(n.tagName==='A')n.setAttribute('href',n.href);});return c.innerHTML.trim();};
 const paras=el=>el?[...el.querySelectorAll('p')].filter(x=>x.innerText.trim()&&!x.closest('.csf-pdf-dl,.csf-report-subscribe,button,[hidden]')).map(clean):[];
 const img=document.querySelector('.csf-report-hero__media img');
 const S=[];let ex=0;
 document.querySelectorAll('.csf-report-intro, .csf-report-findings, .csf-report-exhibit, .csf-report-numbered, .csf-report-three-paragraphs').forEach(s=>{
  const c=s.classList;
  if(c.contains('csf-report-intro'))S.push({tab:'Introduction',t:'text',title:'Introduction',blocks:[{intro:paras(s)}]});
  else if(c.contains('csf-report-findings'))S.push({tab:'Key findings',t:'text',title:'Key findings',blocks:[...s.querySelectorAll('li')].map(x=>({ul:[clean(x)]}))});
  else if(c.contains('csf-report-exhibit')){ex++;s.setAttribute('data-ex',ex);S.push({tab:'Exhibit '+ex,t:'ex',n:ex});}
  else if(c.contains('csf-report-numbered')){const bl=paras(s.querySelector('.csf-report-numbered__intro')).map(h=>({p:h}));s.querySelectorAll('.csf-report-numbered__item').forEach((it,i)=>{const n=it.querySelector('.csf-report-numbered__num');const cc=it.cloneNode(true);const nn=cc.querySelector('.csf-report-numbered__num');if(nn)nn.remove();bl.push({num:i+1,h:clean(cc)});});paras(s.querySelector('.csf-report-numbered__close')).forEach(h=>bl.push({p:h}));S.push({tab:'Analysis',t:'text',title:'Analysis',blocks:bl});}
  else S.push({tab:'Implications',t:'text',title:'Implications',blocks:paras(s).map(h=>({p:h})),late:true});
 });
 // text before the last exhibit continues the previous text section, so tabs always run in page order
 const lastEx=S.map(x=>x.t).lastIndexOf('ex');let prev='Introduction';
 S.forEach((x,i)=>{if(x.late&&i<lastEx){x.tab=prev;x.title='';}if(x.t==='text')prev=x.tab;});
 // merge consecutive sections that share a tab name
 return {title:T('.csf-report-hero__title')||T('main h1')||T('h1'),practice:T('.csf-report-hero__practice-name'),type:T('.csf-report-hero__type')||'Insight Report',standfirst:T('.csf-report-standfirst'),hero:img?(img.currentSrc||img.src||img.getAttribute('data-src')||''):'',og:((document.querySelector('meta[property="og:image"]')||{}).content||''),url:(document.querySelector('link[rel=canonical]')||{}).href||location.href,practiceUrl:((document.querySelector('a.csf-report-hero__practice-name, a.csf-report-hero__service, a.csf-er-hero__service')||{}).href||''),fonts:(()=>{const out=[];for(const sh of document.styleSheets){let rules;try{rules=sh.cssRules}catch(e){continue}const base=sh.href||location.href;for(const r of rules){if(r.type===5){out.push(r.cssText.replace(/url\((['"]?)([^'")]+)\1\)/g,(m,q,u)=>'url("'+new URL(u,base).href+'")'));}}}return out.join('\n');})(),S};
});
for(const s of d.S)if(s.t==='ex'){const el=await p.$(`[data-ex="${s.n}"] .csf-report-exhibit__inner`)||await p.$(`[data-ex="${s.n}"]`);if(!el)throw new Error('Exhibit '+s.n+' not found on the page');await el.scrollIntoViewIfNeeded();await p.waitForTimeout(800);s.png='data:image/png;base64,'+(await el.screenshot({type:'png'})).toString('base64');}
// closing "How we can help" page: text comes from the service page and the About page (Yoast descriptions)
const meta=async u=>{try{const q=await b.newPage();await q.goto(u,{waitUntil:'domcontentloaded',timeout:45000});const r=await q.evaluate(()=>{const g=s=>{const e=document.querySelector(s);return e?(e.getAttribute('content')||'').trim():''};return g('meta[name="description"]')||g('meta[property="og:description"]')});await q.close();return r}catch(e){return ''}};
d.svcText=d.practiceUrl?await meta(d.practiceUrl):'';
if(process.env.CSF_TEST_SVC){d.svcText=process.env.CSF_TEST_SVC;}
let hero='';for(const u of [d.hero,d.og].filter(Boolean)){try{const r=await p.request.get(u);if(r.ok()&&/^image\//.test(r.headers()['content-type']||'')){hero='data:'+r.headers()['content-type']+';base64,'+(await r.body()).toString('base64');break;}}catch(e){}}
// unique tab list (in order)
const tabs=[];d.S.forEach(s=>{if(!tabs.includes(s.tab))tabs.push(s.tab);});
const id=t=>'s-'+t.toLowerCase().replace(/[^a-z0-9]+/g,'-');
const css=d.fonts+(process.env.CSF_TEST_BIG?'p,li,.num{font-size:10.8pt!important}':'')+`
@page{size:13.333in 7.5in;margin:0}
*{box-sizing:border-box}
html,body{margin:0;background:#071D46;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Helvetica Now","Helvetica Neue",Helvetica,Arial,sans-serif;color:#E8EAED}
.pg{width:13.333in;height:7.5in;position:relative;overflow:hidden;page-break-after:always;background:#071D46}
.tabs{position:absolute;top:0;left:0;right:0;height:.46in;display:flex;align-items:flex-end;gap:.34in;padding:0 .55in;border-bottom:1px solid rgba(255,255,255,.16);font-size:8.5pt}
.tabs a{color:#8FA3C4;text-decoration:none;padding-bottom:.09in;border-bottom:2px solid transparent}
.tabs a.on{color:#fff;border-bottom-color:#1794DE}
.ft{position:absolute;left:.55in;right:.55in;bottom:.26in;display:flex;justify-content:space-between;font-size:7.5pt;color:#8FA3C4}
.ft b{color:#fff;font-weight:600}
.area{position:absolute;top:.8in;left:.55in;right:.55in;bottom:.62in}
.cols{height:100%;column-count:2;column-gap:.5in;column-fill:balance}
h2{font:600 24pt/1.12 "Tiempos Headline",Georgia,serif;color:#fff;margin:0 0 .16in;column-span:all}
p{font-size:10pt;line-height:1.55;margin:0 0 .12in;break-inside:avoid}li{break-inside:avoid}
.cols a,.blk a,.intro a{color: inherit !important;-webkit-text-fill-color: inherit !important;text-decoration: none !important;background-color: transparent !important;background-image: linear-gradient(#1794DE,#1794DE) !important;background-repeat: no-repeat !important;background-size: 100% 1.6px !important;background-position: 0 100% !important;padding-bottom: 2px !important;}.cols a *,.blk a *,.intro a *{color: inherit !important;-webkit-text-fill-color: inherit !important;}
strong,b{color:#fff}
.cols a:not([href]),.blk a:not([href]),.intro a:not([href]){background:none!important;padding:0!important}
.tight p,.tight li,.tight .num{font-size:9.4pt!important;line-height:1.48!important}.tight p,.tight .num{margin-bottom:.09in!important}.help{height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding-bottom:.3in}.help h2{font-size:28pt;margin:.18in 0 .26in}.help .hp{font-size:13pt;line-height:1.6;max-width:7.4in;color:#E8EAED;margin:0 0 .3in}.help .hx{color:#1794DE;text-decoration:none;font-weight:700;font-size:11pt}.help .ha{margin-top:.55in;max-width:7.4in;font-size:9.5pt;color:#8FA3C4}.gwrap{height:100%;overflow:hidden}.grid{display:grid;gap:.5in;margin-top:.1in}.blk{}.blk p{font-size:12pt;line-height:1.6}.intro{column-span:all;max-width:8.6in;margin:0 0 .22in}.intro p{font-size:11.5pt;line-height:1.55;color:#fff}ul{margin:0;padding-left:.3in;break-inside:avoid}
li{font-size:10pt;line-height:1.55;margin:0 0 .11in}
.num{display:grid;grid-template-columns:.38in 1fr;font-size:10pt;line-height:1.55;margin:0 0 .12in;break-inside:avoid}
.num i{font:600 16pt/1 "Tiempos Headline",Georgia,serif;color:#1794DE;font-style:normal}
.cover{display:grid;grid-template-columns:1fr 1fr}
.cover .l{display:flex;flex-direction:column;justify-content:center;padding:0 .7in}
.cover .r{background:#0E2A5A center/cover no-repeat}
.eyebrow{font-weight:700;font-size:9pt;letter-spacing:.14em;text-transform:uppercase;color:#1794DE}
.eyebrow span{color:#fff}
.cover h1{font:600 32pt/1.1 "Tiempos Headline",Georgia,serif;color:#fff;margin:.22in 0 .22in}
.cover .sf{font-size:12pt;line-height:1.55;color:#C9D3E5;margin:0}
.exw{position:absolute;top:.72in;left:.55in;right:.55in;bottom:.6in;display:flex;flex-direction:column}
.exw .lab{font-weight:700;font-size:8pt;letter-spacing:.14em;text-transform:uppercase;color:#1794DE;margin-bottom:.1in}
.exw .im{flex:1;min-height:0;display:flex;justify-content:center}
.exw img{max-width:100%;max-height:100%;object-fit:contain}
`;
const tabBar=act=>`<nav class="tabs">${tabs.map(t=>`<a href="#${id(t)}"${t===act?' class="on"':''}>${t}</a>`).join('')}</nav>`;
const foot=n=>`<div class="ft"><span><a href="${d.url}" style="color:#1794DE;text-decoration:none;font-weight:600">City Shift Finance</a> &nbsp;|&nbsp; ${d.type}</span><span>${d.title} &nbsp;&nbsp; ${n}</span></div>`;
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
// 2. lay out pages: text sections flow into 2 columns, a new page whenever a page is full
const lay=await b.newPage({viewport:{width:1280,height:720}});
await lay.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}.cols{column-fill:auto!important}</style></head><body><div id="doc"></div></body></html>`);
const pages=await lay.evaluate(({S})=>{
 const out=[];const doc=document.getElementById('doc');
 const html=bl=>bl.intro?`<div class="intro">${bl.intro.map(x=>`<p>${x}</p>`).join('')}</div>`:bl.p!==undefined?`<p>${bl.p}</p>`:bl.ul?`<ul>${bl.ul.map(x=>`<li>${x}</li>`).join('')}</ul>`:`<div class="num"><i>${bl.num}</i><div>${bl.h}</div></div>`;
 const slug=t=>'s-'+t.toLowerCase().replace(/[^a-z0-9]+/g,'-');
 const test=(items,tight)=>{doc.innerHTML=`<div class="pg${tight?' tight':''}"><div class="area"><div class="cols">${items.map(x=>x.h).join('')}</div></div></div>`;const c=doc.querySelector('.cols');const ok=c.scrollWidth<=c.clientWidth+2&&c.scrollHeight<=c.clientHeight+2;if(!ok)window.__f=(window.__f||[]).concat([[items.length,c.scrollWidth,c.clientWidth,c.scrollHeight,c.clientHeight]]);return ok;};
 let cur=[];const seen={};
 const flush=()=>{if(cur.length){out.push({tab:cur[0].tab,items:cur.slice(),html:cur.map(x=>x.h).join('')});cur=[];}};
 for(const s of S){
  if(s.t==='ex'){flush();out.push({tab:s.tab,ex:s.n,anchor:!seen[s.tab]});seen[s.tab]=1;continue;}
  if(s.tab==='Implications'&&s.title){ // block grid: one block per paragraph, first sentence as bold lead
   const ps=s.blocks.filter(x=>x.p!==undefined).map(x=>x.p);
   const lead=h=>{const m=h.match(/^([\s\S]+?[.!?])(\s+)(?=[A-Z“"])/);return m?`<strong>${m[1]}</strong>${h.slice(m[1].length)}`:h;};
   const n=ps.length,cols=n<=3?n:2;
   const g=`<a id="${slug(s.tab)}" style="display:block;height:0"></a><h2 style="column-span:none;text-align:center;margin-bottom:.55in">${s.title}</h2><div class="grid" style="grid-template-columns:repeat(${cols},1fr)">${ps.map(h=>`<div class="blk"><p>${lead(h)}</p></div>`).join('')}</div>`;
   doc.innerHTML=`<div class="pg"><div class="area"><div class="gwrap">${g}</div></div></div>`;const w=doc.querySelector('.gwrap');
   if(w.scrollHeight<=w.clientHeight+2){flush();seen[s.tab]=1;out.push({tab:s.tab,grid:g});continue;}
  }
  const items=[];s.blocks.forEach(bl=>items.push(html(bl)));if(s.title&&items.length)items[0]=`<h2>${s.title}</h2>`+items[0];
  items.forEach((h,k)=>{if(k===0&&!seen[s.tab]){h=`<a id="${slug(s.tab)}" style="display:block;height:0"></a>`+h;seen[s.tab]=1;}
   const it={tab:s.tab,h};if(test([...cur,it]))cur.push(it);else{flush();cur=[it];}});
 }
 flush();
 for(let i=out.length-1;i>0;i--){const c=out[i],pv=out[i-1];
  if(!c.items||!pv.items||c.items.length>2)continue;
  const all=pv.items.concat(c.items);
  if(test(all,true)){pv.items=all;pv.tight=true;pv.html=all.map(x=>x.h).join('');out.splice(i,1);}
 }
 return {out,f:window.__f};
},{S:d.S}).then(r=>r.out);
const exById={};d.S.forEach(s=>{if(s.t==='ex')exById[s.n]=s;});
let body='',n=1,seen={};
body+=`<section class="pg cover"><div class="l"><div class="eyebrow">${d.practiceUrl?`<a href="${d.practiceUrl}" style="color:#1794DE;text-decoration:none">${esc(d.practice)}</a>`:esc(d.practice)} <span>| ${esc(d.type)}</span></div><h1>${esc(d.title)}</h1><p class="sf">${esc(d.standfirst)}</p></div><div class="r" style="background-image:url('${hero}')"></div></section>`;
for(const pg of pages){n++;const anchor=pg.ex&&pg.anchor?` id="${id(pg.tab)}"`:'';
 if(pg.ex){const e=exById[pg.ex];body+=`<section class="pg"${anchor}>${tabBar(pg.tab)}<div class="exw"><div class="lab">Exhibit ${e.n}</div><div class="im"><img src="${e.png}"></div></div>${foot(n)}</section>`;}
 else if(pg.grid)body+=`<section class="pg">${tabBar(pg.tab)}<div class="area"><div class="gwrap" style="display:flex;flex-direction:column;justify-content:center;padding-bottom:.3in">${pg.grid}</div></div>${foot(n)}</section>`;
 else body+=`<section class="pg${pg.tight?' tight':''}"${anchor}>${tabBar(pg.tab)}<div class="area"><div class="cols">${pg.html}</div></div>${foot(n)}</section>`;
}
if(d.practice){n++;body+=`<section class="pg">${tabBar('')}<div class="area"><div class="help"><div class="eyebrow">How we can help</div><h2 style="column-span:none">${esc(d.practice)}</h2>${d.svcText?`<p class="hp">${esc(d.svcText)}</p>`:''}${d.practiceUrl?`<p><a class="hx" href="${d.practiceUrl}">Explore ${esc(d.practice)} <span style="font-size:1.3em;line-height:1;position:relative;top:.04em;margin-left:.08em">&rarr;</span></a></p>`:''}</div></div>${foot(n)}</section>`;}
const pp=await b.newPage();
await pp.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>City Shift Finance - ${esc(d.title)}</title><style>${css}</style></head><body>${body}</body></html>`,{waitUntil:'load'});
await pp.pdf({path:OUT,preferCSSPageSize:true,printBackground:true});
await b.close();
}catch(e){require('fs').writeFileSync('error.txt',String(e&&e.message||e).slice(0,400));console.error(e);process.exit(1);}
})();
