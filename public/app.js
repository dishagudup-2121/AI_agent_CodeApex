/**
 * PolicyGuard Dashboard — Frontend v2.0
 * AI summary, insights, charts, filters, collapsible sections, file upload, random data
 * v2.1 fixes: toast notifications, risk bar, export, no double-eval
 */
(function(){
'use strict';

// ── Toast Notification System ──
const toastContainer = document.createElement('div');
toastContainer.id = 'toast-container';
toastContainer.style.cssText = 'position:fixed;top:80px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
document.body.appendChild(toastContainer);

function toast(msg, type = 'info', duration = 3500) {
  const colors = { info: '#3a7bd5', success: '#2ecc71', error: '#e04848', warn: '#e68a2e' };
  const icons  = { info: 'ℹ️', success: '✅', error: '❌', warn: '⚠️' };
  const el = document.createElement('div');
  el.style.cssText = `background:#1a2035;border:1px solid ${colors[type]}55;border-left:3px solid ${colors[type]};color:#e6eaf3;padding:12px 16px;border-radius:10px;font-size:13px;max-width:320px;pointer-events:auto;box-shadow:0 4px 20px rgba(0,0,0,0.4);display:flex;align-items:center;gap:10px;opacity:0;transform:translateX(30px);transition:all 0.3s ease;`;
  el.innerHTML = `<span style="font-size:16px">${icons[type]}</span><span>${msg}</span>`;
  toastContainer.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(0)'; });
  setTimeout(() => {
    el.style.opacity = '0'; el.style.transform = 'translateX(30px)';
    setTimeout(() => el.remove(), 350);
  }, duration);
}
const $=id=>document.getElementById(id);
const els={
  policyInput:$('policyInput'),txInput:$('transactionInput'),
  charCount:$('policyCharCount'),jsonVal:$('jsonValidator'),
  randomBtn:$('randomBtn'),clearBtn:$('clearBtn'),runBtn:$('runPipelineBtn'),
  fileUpload:$('fileUpload'),status:$('pipelineStatus'),
  empty:$('emptyState'),progress:$('pipelineProgress'),progressFill:$('progressBarFill'),
  dash:$('resultsDashboard'),aiSummary:$('aiSummary'),insightsRow:$('insightsRow'),
  filterSev:$('filterSeverity'),filterStat:$('filterStatus'),highlightBtn:$('highlightBtn'),
  ruleBar:$('ruleBarChart'),sevLegend:$('severityLegend')
};

let data=null, highlightMode=false;

// ── Validation ──
els.policyInput.addEventListener('input',()=>{els.charCount.textContent=els.policyInput.value.length+' chars'});
els.txInput.addEventListener('input',valJson);
function valJson(){
  const v=els.txInput.value.trim(),j=els.jsonVal;
  if(!v){j.className='json-validator';j.querySelector('.json-text').textContent='Awaiting input';return}
  try{const p=JSON.parse(v);if(!Array.isArray(p))throw 0;j.className='json-validator valid';j.querySelector('.json-text').textContent=`Valid · ${p.length} items`}
  catch{j.className='json-validator invalid';j.querySelector('.json-text').textContent='Invalid JSON'}
}

function setStatus(s,t){els.status.className='status-badge '+(s||'');els.status.querySelector('.status-text').textContent=t}

// ── Progress Animation ──
function showProgress(){
  els.empty.style.display='none';els.dash.style.display='none';els.progress.style.display='block';
  const steps=[...els.progress.querySelectorAll('.progress-step')];
  steps.forEach(s=>{s.className='progress-step'});els.progressFill.style.width='0%';
  let i=0;
  const iv=setInterval(()=>{
    if(i>0)steps[i-1].classList.replace('active','done');
    if(i<steps.length){steps[i].classList.add('active');els.progressFill.style.width=((i+1)/steps.length*100)+'%';i++}
    else clearInterval(iv)
  },300);
  return new Promise(r=>setTimeout(()=>{steps.forEach(s=>{s.className='progress-step done'});els.progressFill.style.width='100%';r()},steps.length*300+250));
}

// ── API ──
async function loadRandom(){
  try{
    setStatus('running','Loading...');
    const r=await fetch('/api/random-sample'),d=await r.json();
    if(!r.ok){setStatus('error','Error');toast(d.error||'Failed to load dataset','error');return;}
    els.policyInput.value=d.policyText;els.txInput.value=JSON.stringify(d.transactions,null,2);
    els.charCount.textContent=d.policyText.length+' chars';valJson();setStatus('','Ready');
    toast(`Loaded dataset: ${d.dataset_name||'random'} (${d.transactions.length} transactions)`,'info',2500);
  }catch(e){setStatus('error','Error');console.error(e);toast('Failed to fetch random dataset','error')}
}

async function runPipeline(){
  const pt=els.policyInput.value.trim();let txs;
  try{txs=JSON.parse(els.txInput.value.trim());if(!Array.isArray(txs))throw 0}
  catch{toast('Invalid JSON in transactions field.','error');return}
  if(!pt){toast('Please provide a policy document.','warn');return}
  setStatus('running','Executing...');
  const prog=showProgress();
  try{
    const[res]=await Promise.all([fetch('/api/run-pipeline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({policyText:pt,transactions:txs})}),prog]);
    const r=await res.json();
    if(res.ok){data=r;els.progress.style.display='none';renderAll(r);setStatus('done','Completed');toast(`Pipeline complete — ${r.analytics.violations} violation${r.analytics.violations!==1?'s':''} found`,'success')}
    else{els.progress.style.display='none';setStatus('error','Failed');toast(r.error||'Pipeline failed','error')}
  }catch(e){els.progress.style.display='none';setStatus('error','Error');console.error(e);toast('Pipeline request failed. Is the server running?','error')}
}

// ── File Upload ──
els.fileUpload.addEventListener('change',async(e)=>{
  const file=e.target.files[0];if(!file)return;
  const fd=new FormData();fd.append('policyFile',file);
  try{setStatus('running','Uploading...');const r=await fetch('/api/upload-policy',{method:'POST',body:fd}),d=await r.json();
    if(r.ok){els.policyInput.value=d.policyText;els.charCount.textContent=d.policyText.length+' chars';setStatus('','Ready');toast(`Policy uploaded: ${d.filename}`,'success')}
    else{setStatus('error','Error');toast(d.error||'Upload failed','error')}
  }catch(err){setStatus('error','Error');console.error(err);toast('Upload failed','error')}
  e.target.value='';
});

// ── Render All ──
function renderAll(d){
  els.empty.style.display='none';els.dash.style.display='block';
  renderAISummary(d);renderInsights(d);renderSummary(d);renderPie(d.transactions_analysis);renderBar(d);
  renderTransactions(d.transactions_analysis);renderRules(d.rules);renderConflicts(d.conflicts);renderGaps(d.gap_analysis);
  renderExportBar(d);updateCounts(d);initCollapsible();initFilters();
  const expBtn = document.getElementById('exportBtn');
  if (expBtn) expBtn.style.display = 'inline-flex';
  els.dash.scrollIntoView({behavior:'smooth',block:'start'});
}

// ── AI Summary ──
function renderAISummary(d){
  let html=`<div class="ai-label">🧠 AI Compliance Summary</div><div class="ai-text">${esc(d.ai_summary)}</div>`;
  if(d.recommendations&&d.recommendations.length>0){
    html+=`<div class="ai-recs">${d.recommendations.map(r=>`<div class="ai-rec">${esc(r)}</div>`).join('')}</div>`;
  }
  const method = d.metadata && d.metadata.extraction_method;
  const methodBadge = method === 'regex_fallback'
    ? `<div class="ai-method-badge warn">⚠️ Regex fallback used — LLM extraction failed</div>`
    : method === 'demo_mode'
    ? `<div class="ai-method-badge info">🎯 Demo mode — sample data</div>`
    : `<div class="ai-method-badge ok">🤖 AI extracted ${d.rules ? d.rules.length : 0} rules</div>`;
  html += methodBadge;
  els.aiSummary.innerHTML=html;
}

// ── Key Insights ──
function renderInsights(d){
  const ins=[],a=d.analytics,tx=d.transactions_analysis;
  const critTx=tx.filter(t=>t.severity==='critical');
  if(critTx.length>0)ins.push({type:'i-danger',icon:'🚨',title:`${critTx.length} Critical Alert${critTx.length>1?'s':''}`,text:'Transactions '+critTx.map(t=>t.transaction_id).join(', ')+' require immediate review.'});
  if(a.total_conflicts>0)ins.push({type:'i-warn',icon:'⚠️',title:`${a.total_conflicts} Rule Conflict${a.total_conflicts>1?'s':''}`,text:'Overlapping or contradictory rules detected.'});
  const redundant=d.gap_analysis.filter(g=>g.status==='redundant').length;
  if(redundant>0)ins.push({type:'i-info',icon:'🔁',title:`${redundant} Redundant Rule${redundant>1?'s':''}`,text:'Some rules overlap and may cause alert fatigue.'});
  if(a.risk_score_stats.max>80)ins.push({type:'i-danger',icon:'📉',title:`Peak Risk Score: ${a.risk_score_stats.max}`,text:`Average risk ${a.risk_score_stats.average}, max ${a.risk_score_stats.max}. High-risk accounts detected.`});
  els.insightsRow.innerHTML=ins.map(i=>`<div class="insight-card ${i.type}"><div class="insight-title">${i.icon} ${i.title}</div><div class="insight-text">${i.text}</div></div>`).join('');
}

// ── Summary Cards ──
function renderSummary(d){
  const a=d.analytics;
  anim($('valTotal'),a.total_transactions);anim($('valViolations'),a.violations);
  anim($('valCritical'),a.critical_count);anim($('valRisk'),a.risk_score_stats.average);
  anim($('valRuleCount'),a.total_rules);
  // Risk bar
  const avg=a.risk_score_stats.average||0,mx=a.risk_score_stats.max||0;
  let existing=$('riskBarWrap');if(existing)existing.remove();
  const wrap=document.createElement('div');wrap.id='riskBarWrap';
  const col=avg>75?'#e04848':avg>50?'#e68a2e':avg>30?'#dbb73a':'#3fad62';
  wrap.innerHTML=`<div style="margin:8px 0 4px;font-size:11px;color:#6b7b95;display:flex;justify-content:space-between;"><span>RISK SCORE</span><span>avg <b style="color:${col}">${avg}</b> / max <b>${mx}</b></span></div><div style="background:#151a28;border-radius:6px;height:8px;overflow:hidden;"><div style="width:${avg}%;height:100%;background:${col};border-radius:6px;transition:width 0.8s cubic-bezier(.22,1,.36,1);"></div></div>`;
  const summaryRow=$('summaryRow');if(summaryRow&&summaryRow.parentNode)summaryRow.parentNode.insertBefore(wrap,summaryRow.nextSibling);
}
function anim(el,tgt){
  const dur=550,s=performance.now();
  (function tick(n){const p=Math.min((n-s)/dur,1);el.textContent=Math.round(tgt*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(tick)})(s);
}

// ── Pie Chart ──
function renderPie(txs){
  const cnt={critical:0,high:0,medium:0,low:0,none:0};
  txs.forEach(t=>{cnt[t.severity]=(cnt[t.severity]||0)+1});
  const cols={critical:'#e04848',high:'#e68a2e',medium:'#dbb73a',low:'#3fad62',none:'#6b7b95'};
  const total=txs.length||1,canvas=$('severityChart'),ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1,sz=180;
  canvas.width=sz*dpr;canvas.height=sz*dpr;canvas.style.width=sz+'px';canvas.style.height=sz+'px';ctx.scale(dpr,dpr);
  const cx=sz/2,cy=sz/2,R=72,r=46;let ang=-Math.PI/2;ctx.clearRect(0,0,sz,sz);
  const ent=Object.entries(cnt).filter(([,v])=>v>0);
  if(ent.length===0){ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.arc(cx,cy,r,0,Math.PI*2,true);ctx.fillStyle='#151a28';ctx.fill()}
  else ent.forEach(([sev,c])=>{const sw=(c/total)*Math.PI*2;ctx.beginPath();ctx.moveTo(cx+r*Math.cos(ang),cy+r*Math.sin(ang));ctx.arc(cx,cy,R,ang,ang+sw);ctx.arc(cx,cy,r,ang+sw,ang,true);ctx.closePath();ctx.fillStyle=cols[sev];ctx.fill();ang+=sw});
  ctx.fillStyle='#e6eaf3';ctx.font='800 24px "JetBrains Mono"';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(total,cx,cy-5);
  ctx.fillStyle='#6b7b95';ctx.font='600 9px "Inter"';ctx.fillText('TOTAL',cx,cy+12);
  els.sevLegend.innerHTML=ent.map(([s,c])=>`<div class="legend-item"><span class="legend-dot" style="background:${cols[s]}"></span>${s}: ${c}</div>`).join('');
}

// ── Bar Chart ──
function renderBar(d){
  const hits={};d.transactions_analysis.forEach(t=>t.triggered_rules.forEach(r=>{hits[r]=(hits[r]||0)+1}));
  const sorted=Object.entries(hits).sort((a,b)=>b[1]-a[1]),max=sorted.length>0?sorted[0][1]:1;
  const rMap={};d.rules.forEach(r=>{rMap[r.rule_id]=r.description});
  els.ruleBar.innerHTML=sorted.map(([id,c])=>{const p=(c/max)*100;const desc=rMap[id]||'';const sh=desc.length>35?desc.substring(0,35)+'...':desc;
    return `<div class="bar-row"><span class="bar-label">${id}</span><div class="bar-track"><div class="bar-fill" style="width:${p}%"><span class="bar-value">${c}</span></div></div><span class="bar-desc" title="${esc(desc)}">${esc(sh)}</span></div>`}).join('');
}

// ── Transactions ──
function renderTransactions(txs){
  const body=$('secTransactionsBody');
  body.innerHTML=txs.map((tx,i)=>{
    const cls=tx.violated?'violated':'cleared';const lbl=tx.violated?'🚨 VIOLATED':'✅ CLEARED';
    const chains=tx.causal_chain.map(s=>`<div class="causal-step">${esc(s)}</div>`).join('');
    const shortReason=tx.triggered_rules.length>0?`Triggered ${tx.triggered_rules.join(', ')}`:'No rules triggered';
    const txAmt = tx.transaction_amount !== undefined ? `<div class="tx-amount">$${Number(tx.transaction_amount).toLocaleString()}</div>` : '';
    const riskPct = tx.risk_score !== undefined ? tx.risk_score : 0;
    const riskColor = riskPct > 70 ? 'var(--crit)' : riskPct > 40 ? 'var(--high)' : 'var(--low)';
    const riskBar = tx.risk_score !== undefined ? `<div class="risk-bar-row"><span class="risk-label">Risk</span><div class="risk-bar-track"><div class="risk-bar-fill" style="width:${riskPct}%;background:${riskColor}"></div></div><span class="risk-val" style="color:${riskColor}">${riskPct}</span></div>` : '';
    return `<div class="tx-card ${cls}" data-sev="${tx.severity}" data-status="${tx.violated?'violated':'passed'}">
      <div class="tx-header"><span class="tx-id">${tx.transaction_id}</span><div class="tx-badges"><span class="badge badge-${tx.severity}">${tx.severity}</span><span class="badge badge-${tx.action}">${tx.action}</span><span class="badge ${tx.violated?'badge-critical':'badge-low'}">${lbl}</span></div></div>
      ${txAmt}${riskBar}
      <div class="tx-reason">${esc(shortReason)}</div>
      ${tx.triggered_rules.length>0?`<div class="tx-rules">${tx.triggered_rules.map(r=>`<span class="rule-chip">${r}</span>`).join('')}</div>`:''}
      <button class="tx-causal-toggle" onclick="toggleCausal(this,'cc-${i}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg> Expand (${tx.causal_chain.length} steps)</button>
      <div class="causal-chain" id="cc-${i}">${chains}<div class="tx-reason" style="margin-top:8px;border-left-color:var(--purple)">${esc(tx.explanation)}</div></div>
    </div>`}).join('');
}

// ── Rules ──
function renderRules(rules){
  $('secRulesBody').innerHTML=`<div class="rules-grid">${rules.map(r=>`<div class="rule-card severity-${r.severity}"><div class="rule-card-header"><span class="rule-id">${r.rule_id}</span><div style="display:flex;gap:4px"><span class="badge badge-${r.severity}">${r.severity}</span><span class="badge badge-${r.action}">${r.action}</span></div></div><p class="rule-desc">${r.description}</p><div class="rule-meta"><span class="badge badge-none">${r.scope}</span><span class="badge badge-none">${r.conditions.length} cond</span></div></div>`).join('')}</div>`;
}

// ── Conflicts ──
function renderConflicts(conflicts){
  $('secConflictsBody').innerHTML=conflicts.length===0?'<p class="no-results-msg">✅ No conflicts detected.</p>':
    conflicts.map(c=>`<div class="conflict-card"><div class="conflict-header"><div class="conflict-rules"><span class="rule-chip">${c.rule_1}</span><span class="conflict-vs">VS</span><span class="rule-chip">${c.rule_2}</span></div><span class="badge badge-${c.type==='contradiction'?'critical':c.type==='priority'?'high':'medium'}">${c.type}</span></div><p class="conflict-reason">${esc(c.reason)}</p></div>`).join('');
}

// ── Gaps ──
function renderGaps(gaps){
  $('secGapsBody').innerHTML=gaps.length===0?'<p class="no-results-msg">✅ No gaps identified.</p>':
    gaps.map(g=>`<div class="gap-card"><div class="gap-header"><span class="gap-id">${g.rule_id}</span><span class="badge badge-${g.status}">${g.status}</span>${g.hit_rate&&g.hit_rate!=='N/A'?`<span class="badge badge-none">${g.hit_rate}</span>`:''}</div><p class="gap-reason">${esc(g.reason)}</p><div class="gap-recommendation">${esc(g.recommendation)}</div></div>`).join('');
}

// ── Counts ──
function updateCounts(d){
  $('cntTx').textContent=d.transactions_analysis.length;
  $('cntRules').textContent=d.rules.length;
  $('cntConflicts').textContent=d.conflicts.length;
  $('cntGaps').textContent=d.gap_analysis.length;
}

// ── Collapsible ──
function initCollapsible(){
  document.querySelectorAll('.collapse-header').forEach(btn=>{
    btn.onclick=()=>{
      const body=$(btn.dataset.target);
      const open=body.classList.contains('expanded');
      body.classList.toggle('expanded',!open);body.classList.toggle('collapsed',open);
      btn.classList.toggle('open',!open);
    };
  });
}

// ── Filters ──
function initFilters(){
  els.filterSev.onchange=applyFilters;
  els.filterStat.onchange=applyFilters;
}

function applyFilters(){
  const sev=els.filterSev.value,stat=els.filterStat.value;
  document.querySelectorAll('.tx-card').forEach(card=>{
    const cardSev=card.dataset.sev,cardStat=card.dataset.status;
    let show=true;
    if(sev!=='all'&&cardSev!==sev)show=false;
    if(stat!=='all'&&cardStat!==stat)show=false;
    if(highlightMode&&cardSev!=='critical')show=false;
    card.classList.toggle('hidden-by-filter',!show);
  });
}

// ── Highlight Mode ──
els.highlightBtn.addEventListener('click',()=>{
  highlightMode=!highlightMode;
  els.highlightBtn.classList.toggle('active',highlightMode);
  els.highlightBtn.textContent=highlightMode?'🔦 Show All':'🔦 Critical Only';
  applyFilters();
});

// ── Export ──
function renderExportBar(d){
  let bar=$('exportBar');if(bar)bar.remove();
  bar=document.createElement('div');bar.id='exportBar';
  bar.style.cssText='display:flex;gap:10px;margin-bottom:16px;justify-content:flex-end;';
  bar.innerHTML=`
    <button id="exportJsonBtn" class="btn btn-ghost btn-sm">⬇ Export JSON</button>
    <button id="exportCsvBtn" class="btn btn-ghost btn-sm">📊 Export CSV</button>`;
  const dash=$('resultsDashboard');
  const aiSum=$('aiSummary');
  if(aiSum&&aiSum.parentNode)aiSum.parentNode.insertBefore(bar,aiSum);
  $('exportJsonBtn').onclick=()=>exportJson(d);
  $('exportCsvBtn').onclick=()=>exportCsv(d);
}
function exportJson(d){
  const blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
  dlFile(blob,'policyguard_results.json');toast('JSON exported','success',2000);
}
function exportCsv(d){
  const rows=[['transaction_id','violated','severity','action','triggered_rules']];
  d.transactions_analysis.forEach(t=>rows.push([t.transaction_id,t.violated,t.severity,t.action,t.triggered_rules.join('|')]));
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  dlFile(blob,'policyguard_transactions.csv');toast('CSV exported','success',2000);
}
function dlFile(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href);}

// ── Helpers ──
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
window.toggleCausal=function(btn,id){const el=$(id);const o=el.classList.contains('visible');el.classList.toggle('visible',!o);btn.classList.toggle('open',!o)};

// ── Events ──
els.randomBtn.addEventListener('click',loadRandom);
els.runBtn.addEventListener('click',runPipeline);
els.clearBtn.addEventListener('click',()=>{
  els.policyInput.value='';els.txInput.value='';els.charCount.textContent='0 chars';
  els.jsonVal.className='json-validator';els.jsonVal.querySelector('.json-text').textContent='Awaiting input';
  els.dash.style.display='none';els.empty.style.display='flex';setStatus('','Ready');highlightMode=false;
  els.highlightBtn.classList.remove('active');els.highlightBtn.textContent='🔦 Critical Only';
});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')runPipeline()});

// Export button handler
const exportBtn = document.getElementById('exportBtn');
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    if (!data) return;
    try {
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
      const a = document.createElement('a');
      a.href = `/api/export-report?data=${encoded}`;
      a.download = `compliance-report-${Date.now()}.txt`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch(e) { toast('Export failed — data too large for URL', 'error'); }
  });
}

})();
