/* ============================================================================
   TETRISIZE COMMISSIONING — application (router + views)
   Hub-and-spoke: Home dashboard is the hub; sidebar reaches each module.
   RBAC: navigation and actions are filtered by the signed-in employee's role.
   Build sessions: S1 shell/login/home/staff/alarms/audit · S2 wizard ·
   S3 lane controls & alarm detail · S4 maintenance/reports/settings depth.
   ========================================================================== */
(function(){
'use strict';
const $  = s => document.querySelector(s);
const DB = window.TZDB;

/* ---------- helpers ---------- */
const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = n => (n==null?'—':Number(n).toLocaleString('en-AU'));
const fmtDT = t => { if(!t) return '—'; const d=new Date(t);
  return d.toLocaleDateString('en-AU',{day:'2-digit',month:'short'}) + ' ' + d.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit',hour12:false}); };
const fmtD = t => t ? new Date(t).toLocaleDateString('en-AU',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const ago = t => { if(!t) return '—'; const s=(Date.now()-new Date(t))/1000;
  if(s<60) return Math.floor(s)+'s ago'; if(s<3600) return Math.floor(s/60)+'m ago';
  if(s<86400) return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; };
const empName = id => (DB.get('employees',id)||{}).name || '—';
const initials = n => n.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
function avatar(emp, px){
  if(!emp) return '';
  const fs = Math.round(px*0.38);
  return `<span class="tzc-av ${emp.role}" style="width:${px}px;height:${px}px;font-size:${fs}px">${initials(emp.name)}
    <img src="commissioning/assets/employees/${esc(emp.photo)}" alt="" onerror="this.remove()"></span>`;
}
function toast(msg){ let t=$('#tzcToast'); if(!t){ t=document.createElement('div'); t.id='tzcToast'; document.body.appendChild(t); }
  t.textContent=msg; requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>t.classList.add('show'), 60);   // rAF fallback for hidden tabs
  clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'),2600); }

/* ---------- modal ---------- */
function modal(html){
  let w=$('#tzcModalWrap');
  if(!w){ w=document.createElement('div'); w.id='tzcModalWrap'; w.innerHTML='<div id="tzcModal"></div>'; document.body.appendChild(w);
    w.addEventListener('click', e=>{ if(e.target===w) closeModal(); }); }
  $('#tzcModal').innerHTML=html; w.classList.add('open'); return $('#tzcModal');
}
function closeModal(){ const w=$('#tzcModalWrap'); if(w) w.classList.remove('open'); }

/* ---------- detail side panel ---------- */
function panel(html){
  let p=$('#tzcDetail');
  if(!p){ p=document.createElement('div'); p.id='tzcDetail'; document.body.appendChild(p); }
  p.innerHTML=`<button class="tzc-btn x" onclick="TZC.closePanel()">✕</button>`+html;
  requestAnimationFrame(()=>p.classList.add('open'));
  setTimeout(()=>p.classList.add('open'), 60);   // rAF is paused in hidden tabs — timer fallback
}
function closePanel(){ const p=$('#tzcDetail'); if(p) p.classList.remove('open'); }

/* ---------- navigation ---------- */
const NAV = [
  { r:'home',        ic:'⌂',  label:'Home' },
  { r:'fleet',       ic:'▦',  label:'Fleet' },
  { r:'commission',  ic:'◉',  label:'Commissioning', perm:'commission' },
  { r:'alarms',      ic:'⚠',  label:'Alarms', badge:()=>DB.openAlarms().length },
  { r:'maintenance', ic:'🛠', label:'Maintenance', perm:'maintenance' },
  { r:'reports',     ic:'▤',  label:'Reports' },
  { r:'staff',       ic:'👤', label:'Staff' },
  { r:'settings',    ic:'⚙',  label:'Settings', perm:'settings' },
  { r:'help',        ic:'?',  label:'Help' }
];
const route = () => (location.hash.replace(/^#\/?/,'') || 'home').split('?')[0];
const go = r => { location.hash = '#/'+r; };

/* ---------- shell ---------- */
function render(){
  closePanel(); closeModal();
  if(window.TZW) TZW.cleanup();      // stop any wizard animations when the view changes
  if(typeof pbCleanup === 'function') pbCleanup();   // and pause incident playback
  const app = $('#app');
  const me = DB.current();
  if(!me){ app.innerHTML = loginHTML(); wireLogin(); return; }
  const r = route();
  const view = VIEWS[r] || VIEWS.home;
  const nav = NAV.filter(n => !n.perm || DB.can(n.perm)).map(n=>{
    const b = n.badge ? n.badge() : 0;
    return `<a class="tzc-nav ${n.r===r?'on':''}" href="#/${n.r}"><span class="ic">${n.ic}</span><span class="lb">${n.label}</span>${b?`<span class="bdg">${b}</span>`:''}</a>`;
  }).join('');
  app.innerHTML = `
    <div id="tzcSide">
      ${nav}
      <div class="tzc-foot">
        <div class="tzc-me" onclick="TZC.myCard()">${avatar(me,34)}
          <span class="meta"><div class="nm">${esc(me.name)}</div><div class="rl">${esc(me.title)}</div></span></div>
        <a class="tzc-nav" href="javascript:TZC.logout()"><span class="ic">⎋</span><span class="lb">Sign out</span></a>
      </div>
    </div>
    <div id="tzcMain">${view.html(me)}</div>`;
  if(view.wire) view.wire(me);
  if(window.TZL) TZL.start();        // live feed runs while someone is signed in
}

/* ---------- LOGIN ---------- */
function loginHTML(){
  return `<div id="tzcLogin"><div class="box">
    <p class="wm">TETRI<b>SIZE</b></p><p class="tag">Commissioning</p>
    <label>Operator</label><input id="lgUser" autocomplete="username" placeholder="admin" autofocus>
    <label>Password</label><input id="lgPass" type="password" autocomplete="current-password" placeholder="password">
    <button class="tzc-btn pri go" id="lgGo">Sign in</button>
    <div class="err" id="lgErr"></div>
    <div style="text-align:center;margin-top:10px"><a href="javascript:void 0" id="lgForgot" style="font-size:11.5px;color:var(--tz-accent)">Forgot password?</a></div>
    <div class="hint"><b>Demo site:</b> sign in with <code>admin</code> / <code>password</code>.<br>
      Each sample employee also signs in with their first name (e.g. <code>dwayne</code>, <code>ryan</code>, <code>sarah</code>) and <code>password</code> — roles change what you can see and do.</div>
  </div></div>`;
}
function wireLogin(){
  const tryIt = () => {
    const emp = DB.login($('#lgUser').value, $('#lgPass').value);
    if(emp){ toast(`Welcome, ${emp.name.split(' ')[0]} — signed in as ${emp.role}`); go('home'); render(); }
    else $('#lgErr').textContent = 'Unknown operator or wrong password.';
  };
  $('#lgGo').onclick = tryIt;
  $('#lgPass').addEventListener('keydown', e=>{ if(e.key==='Enter') tryIt(); });
  $('#lgUser').addEventListener('keydown', e=>{ if(e.key==='Enter') $('#lgPass').focus(); });
  $('#lgForgot').onclick = () => {        // Screen 42 fidelity — reset-request flow (demo stub)
    const box = document.querySelector('#tzcLogin .box');
    box.innerHTML = `<p class="wm">TETRI<b>SIZE</b></p><p class="tag">Reset password</p>
      <label>Email</label><input id="rpEmail" type="email" placeholder="you@company.com" autofocus>
      <button class="tzc-btn pri go" id="rpGo">Send reset link</button>
      <div class="err" id="rpMsg"></div>
      <div style="text-align:center;margin-top:10px"><a href="javascript:void 0" id="rpBack" style="font-size:11.5px;color:var(--tz-accent)">← Back to sign in</a></div>`;
    box.querySelector('#rpGo').onclick = () => {
      const em = box.querySelector('#rpEmail').value.trim();
      if(!em || !em.includes('@')){ box.querySelector('#rpMsg').textContent='Enter a valid email.'; return; }
      box.querySelector('#rpMsg').style.color='var(--tz-green)';
      box.querySelector('#rpMsg').textContent='Demo: a reset link would be emailed to '+em+'.';
      toast('Reset link sent (demo)');
    };
    box.querySelector('#rpBack').onclick = () => render();
  };
}

/* ---------- HOME ---------- */
function laneRows(){
  const lanes = {};
  DB.all('idbms').forEach(u => (lanes[u.lane_id] = lanes[u.lane_id] || []).push(u));
  Object.values(lanes).forEach(a => a.sort((x,y)=>x.slot-y.slot));
  return lanes;
}
const VIEWS = {};

/* ---------- LARGE-SITE HIERARCHY HOME (S11) ----------
   Above ~200 units the flat grid is unusable; monitoring becomes
   Site → Level → Zone drill-down with alarm roll-up, plus an
   exception-first "needs attention" list. Leaf zones (~150 units)
   render as compact status cells. */
let bigSel = { level:null, zone:null };
const LEVEL_LABELS = { 'Z0':'Level 1 — floor', 'Z2200':'Level 2', 'Z4400':'Level 3', 'MD':'Mobile devices — crane beds' };
function bigStats(idbms, open){
  const alarmed = new Set(open.map(a=>a.idbm));
  const lv = {};
  idbms.forEach(u=>{
    const L = u.level||'Z0';
    const e = lv[L] = lv[L] || { units:0, online:0, alarms:0, zones:{} };
    e.units++; if(u.status==='online') e.online++;
    if(alarmed.has(u.serial)) e.alarms++;
    const z = e.zones[u.zone] = e.zones[u.zone] || { units:0, online:0, alarms:0, list:[] };
    z.units++; if(u.status==='online') z.online++; if(alarmed.has(u.serial)) z.alarms++;
    z.list.push(u);
  });
  return lv;
}
function bigExceptions(idbms, open){
  const seen = new Set(), out = [];
  open.forEach(a=>{ const u = idbms.find(x=>x.serial===a.idbm);
    if(u && !seen.has(u.serial)){ seen.add(u.serial);
      out.push({ u, tag:a.severity, cls:a.severity, why:a.type.replace(/_/g,' ') }); } });
  idbms.forEach(u=>{ if(seen.has(u.serial)) return;
    if(u.status==='offline'){ seen.add(u.serial); out.push({ u, tag:'offline', cls:'critical', why:'no heartbeat' }); }
    else if(u.status==='maintenance'){ seen.add(u.serial); out.push({ u, tag:'maint', cls:'warning', why:'in maintenance' }); }
    else if(u.odometer_maintenance>=10000){ seen.add(u.serial); out.push({ u, tag:'service', cls:'info', why:num(u.odometer_maintenance)+' since service' }); } });
  return out;
}
function bigHomeBody(idbms, open){
  const lv = bigStats(idbms, open);
  const order = ['Z0','Z2200','Z4400','MD'].filter(k=>lv[k]);
  const bar = (on,total) => `<div class="tzw-prog" style="height:6px;margin-top:7px"><div style="width:${(on/total*100).toFixed(0)}%;background:${on===total?'var(--tz-green)':'var(--tz-gold)'}"></div></div>`;
  let left='';
  if(!bigSel.level){
    left = `<h3 style="margin:0 0 10px;font-size:13px">Site map — ${num(idbms.length)} IDBMs <span class="tzc-pill">click a level</span></h3>
      <div class="tzc-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
      ${order.map(k=>{ const e=lv[k]; return `<div class="tzc-kpi" data-lv="${k}" style="cursor:pointer">
        <div class="l">${esc(LEVEL_LABELS[k]||k)}</div>
        <div class="v" style="font-size:19px">${e.online}/${e.units} <span style="font-size:11px;color:var(--tz-muted);font-weight:600">online</span>
          ${e.alarms?`<span class="bdg" style="background:var(--tz-orange);color:#fff;font-size:10px;font-weight:800;border-radius:99px;padding:1px 7px;margin-left:6px">${e.alarms}</span>`:''}</div>
        <div class="d">${Object.keys(e.zones).length} zones</div>${bar(e.online,e.units)}</div>`; }).join('')}</div>`;
  } else if(!bigSel.zone){
    const e = lv[bigSel.level] || { zones:{} };
    left = `<div style="font-size:11px;color:var(--tz-muted);margin-bottom:8px"><a href="javascript:void 0" data-back="site" style="color:var(--tz-accent)">Site</a> › ${esc(LEVEL_LABELS[bigSel.level]||bigSel.level)}</div>
      <div class="tzc-grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">
      ${Object.keys(e.zones).sort().map(zn=>{ const z=e.zones[zn];
        const md = z.list[0] && z.list[0].mount==='vehicle';
        return `<div class="tzc-kpi" data-zn="${esc(zn)}" style="cursor:pointer">
          <div class="l">Zone ${esc(zn)}</div>
          <div class="v" style="font-size:18px">${z.online}/${z.units}
            ${z.alarms?`<span style="font-size:10px;font-weight:800;border-radius:99px;padding:1px 7px;margin-left:6px;background:var(--tz-orange);color:#fff">${z.alarms}</span>`:''}</div>
          <div class="d">${md?('on '+esc(z.list[0].vehicle)+' · block y '+z.list[0].y+' m'):(z.units+' fixed units')}</div>${bar(z.online,z.units)}</div>`; }).join('')}</div>`;
  } else {
    const e = lv[bigSel.level], z = e && e.zones[bigSel.zone];
    const alarmed = new Set(open.map(a=>a.idbm));
    left = `<div style="font-size:11px;color:var(--tz-muted);margin-bottom:8px"><a href="javascript:void 0" data-back="site" style="color:var(--tz-accent)">Site</a> › <a href="javascript:void 0" data-back="level" style="color:var(--tz-accent)">${esc(LEVEL_LABELS[bigSel.level]||bigSel.level)}</a> › Zone ${esc(bigSel.zone)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
      ${(z?z.list:[]).sort((a,b)=>a.x-b.x||a.y-b.y).map(u=>`<div class="tzw-mini ${u.status==='online'?'on':u.status==='maintenance'?'mtn':'offl'}${alarmed.has(u.serial)?' almr':''}" data-sn="${u.id}" title="${esc(u.serial)} · ${u.x} m, ${u.y} m · ${esc(u.status)}" style="cursor:pointer;width:58px">${esc(u.serial.replace(/^IDBM-/,'').replace(/^CRANE-/,'C'))}</div>`).join('')}
      </div>
      <p style="font-size:10.5px;color:var(--tz-muted);margin-top:10px">Click a unit for detail · alarmed units pulse red · for spatial context use the 3D locator (⌘K → “3D Fault Locator”).</p>`;
  }
  const ex = bigExceptions(idbms, open).slice(0,14);
  const right = `<h3 style="margin:0 0 8px;font-size:13px">Needs attention <span class="tzc-pill">${ex.length?ex.length:'all clear'}</span></h3>
    ${ex.length?ex.map(x=>`<div data-ex="${x.u.id}" style="display:flex;gap:9px;align-items:center;padding:7px 0;border-top:1px solid var(--tz-brd);cursor:pointer">
      <span class="tzc-sev ${x.cls}" style="flex:0 0 auto">${esc(x.tag)}</span>
      <span style="font-size:12px"><b>${esc(x.u.serial)}</b> <span style="color:var(--tz-muted)">· ${esc(x.u.zone)} · ${esc(x.why)}</span></span></div>`).join('')
      :'<p style="font-size:12px;color:var(--tz-muted)">Nothing needs attention — green across the site.</p>'}`;
  return `<div class="tzc-grid" style="grid-template-columns:minmax(0,1.7fr) minmax(280px,1fr)">
    <div class="tzc-panel">${left}</div><div class="tzc-panel">${right}</div></div>`;
}
function bigHomeWire(){
  document.querySelectorAll('[data-lv]').forEach(c=>c.onclick=()=>{ bigSel={level:c.dataset.lv,zone:null}; render(); });
  document.querySelectorAll('[data-zn]').forEach(c=>c.onclick=()=>{ bigSel.zone=c.dataset.zn; render(); });
  document.querySelectorAll('[data-back]').forEach(a=>a.onclick=()=>{ if(a.dataset.back==='site') bigSel={level:null,zone:null}; else bigSel.zone=null; render(); });
  document.querySelectorAll('[data-ex]').forEach(r=>r.onclick=()=>idbmPanel(+r.dataset.ex));
  document.querySelectorAll('.tzw-mini[data-sn]').forEach(c=>c.onclick=()=>idbmPanel(+c.dataset.sn));
}

VIEWS.home = {
  html(){
    const site = DB.all('sites')[0];
    const idbms = DB.all('idbms');
    const online = idbms.filter(u=>u.status==='online').length;
    const open = DB.openAlarms();
    const today = DB.all('daily_stats').slice(-1)[0] || {units:0,target:0};
    const lanes = laneRows();
    const laneOk = Object.values(lanes).filter(a=>a.every(u=>u.status==='online')).length;
    const alarmedSN = new Set(open.map(a=>a.idbm));
    const big = idbms.length > 200;
    let content = '';
    if(big){ content = bigHomeBody(idbms, open); } else {
    const arrays = {};
    Object.keys(lanes).sort().forEach(lid => (arrays[lid[0]] = arrays[lid[0]] || []).push(lid));
    const grid = Object.keys(arrays).map(a=>`
      <div class="tzc-array"><h3>Array ${a}</h3>
      ${arrays[a].map(lid=>{ const hs = laneHeld(lid); return `<div class="tzc-lane"><span class="lid lk" data-lane="${lid}" title="Lane detail & controls">${lid}${hs?' ⏸':''}</span>
        ${lanes[lid].map(u=>`<div class="tzc-cell ${u.status}${alarmedSN.has(u.serial)?' alarmed':''}${hs?' held':''}" data-sn="${u.id}" title="${u.serial} · ${u.lane_id} slot ${u.slot} · ${u.status}${hs?' · lane held':''}">${u.serial}</div>`).join('')}
      </div>`;}).join('')}</div>`).join('');
    const feed = DB.all('operations_log').slice().sort((a,b)=>b.ts.localeCompare(a.ts)).slice(0,8).map(l=>`
      <div class="it"><span class="when">${fmtDT(l.ts)}</span>
      <span><b>${esc(empName(l.operator_id))}</b> · ${esc(actionLabel(l.action))} <b>${esc(l.target)}</b><br><span class="what">${esc(l.detail||'')}</span></span></div>`).join('');
    content = `<div class="tzc-grid" style="grid-template-columns:minmax(0,1.7fr) minmax(280px,1fr)">
        <div class="tzc-panel"><h3 style="margin:0 0 12px;font-size:13px">Live Array <span class="tzc-pill">click a module for detail</span></h3>${grid}</div>
        <div class="tzc-panel"><h3 style="margin:0 0 10px;font-size:13px">Recent activity</h3><div class="tzc-feed">${feed}</div></div>
      </div>`;
    }
    return `
      <div class="tzc-head"><div>
        <div class="tzc-crumb">Home</div><h1 class="tzc-h1">${esc(site.name)}</h1>
        <p class="tzc-sub">${esc(site.customer)} · ${esc(site.location)} · ${site.commissioned_date?`commissioned ${fmtD(site.commissioned_date)} · <span class="tzc-ok">${esc(site.status)}</span>`:`<b style="color:var(--tz-gold)">not commissioned</b>`}</p>
      </div>
      ${site.status==='active' ? `<div style="display:flex;gap:8px;align-items:center;padding-bottom:14px">
        <button class="tzc-btn" id="hLive" title="Pause / resume the live data feed">${(window.TZL&&TZL.paused)?'❚❚ paused':'● live'}</button>
        <button class="tzc-btn" id="hHandover">⇄ Handover…</button>
        ${DB.can('soft_stop') && !site.soft_estop ? '<button class="tzc-btn danger" id="hEstop">⛔ Soft E-stop…</button>' : ''}
      </div>`:''}</div>
      ${window.TZL && TZL.meshLost ? meshBanner() : ''}
      ${site.soft_estop ? `<div class="tzc-estop">
        <span style="font-size:24px">⛔</span>
        <div style="flex:1;min-width:240px"><b style="font-size:13.5px;color:var(--tz-orange)">SOFT E-STOP ACTIVE — ${esc(site.soft_estop.scope)}</b>
        <div style="font-size:12px;color:var(--tz-muted)">by ${esc(empName(site.soft_estop.by))} · ${ago(site.soft_estop.at)} · ${esc(site.soft_estop.reason)} · lane controls locked</div></div>
        ${DB.can('soft_stop')?`<button class="tzc-btn pri" onclick="TZC.estopResume()">Resume operations…</button>`:''}
      </div>`:''}
      ${site.status!=='active' ? `<div class="tzc-panel" style="border-color:var(--tz-gold);display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px">
        <span style="font-size:22px">◉</span>
        <div style="flex:1;min-width:240px"><b style="font-size:13.5px">This site has not been commissioned.</b>
        <div style="font-size:12px;color:var(--tz-muted)">All ${idbms.length} IDBMs are dark. Run the seven-gate commissioning wizard to bring the site live.</div></div>
        ${DB.can('commission')?`<button class="tzc-btn pri" onclick="location.hash='#/commission'">Start commissioning →</button>`:''}
      </div>`:''}
      <div class="tzc-kpis">
        <div class="tzc-kpi"><div class="l">Units today</div><div class="v">${num(today.units)}</div><div class="d">target ${num(today.target)}</div></div>
        <div class="tzc-kpi ${open.some(a=>a.severity==='critical')?'bad':(open.length?'warn':'ok')}"><div class="l">Open alarms</div><div class="v">${open.length}</div><div class="d">${open.filter(a=>a.severity==='critical').length} critical</div></div>
        <div class="tzc-kpi ${online===idbms.length?'ok':'warn'}"><div class="l">IDBMs online</div><div class="v">${online}/${idbms.length}</div><div class="d">${idbms.length-online} in maintenance</div></div>
        <div class="tzc-kpi ${laneOk===Object.keys(lanes).length?'ok':'warn'}"><div class="l">Lanes nominal</div><div class="v">${laneOk}/${Object.keys(lanes).length}</div><div class="d">across 3 arrays</div></div>
      </div>
      ${content}`;
  },
  wire(){
    const live = $('#hLive'); if(live) live.onclick = () => TZL.toggle();
    const es = $('#hEstop'); if(es) es.onclick = estopModal;
    const ho = $('#hHandover'); if(ho) ho.onclick = handoverModal;
    const rt = $('#hRetry'); if(rt) rt.onclick = () => TZL.retry();
    if(DB.all('idbms').length > 200){ bigHomeWire(); return; }
    document.querySelectorAll('.tzc-cell').forEach(c => c.onclick = () => idbmPanel(+c.dataset.sn));
    document.querySelectorAll('.lid.lk').forEach(l => l.onclick = () => lanePanel(l.dataset.lane));
  }
};

/* per-IDBM threshold override (Screen 33, S12) */
function thresholdModal(id){
  const u = DB.get('idbms', id); if(!u) return;
  const me = DB.current();
  const sv = k => (DB.all('settings').find(s=>s.key===k)||{}).value||'';
  const cur = k => (u.overrides && u.overrides[k]!=null) ? u.overrides[k] : sv(k);
  const F = (k,l) => `<div class="row"><label>${l} <span style="text-transform:none;color:var(--tz-muted)">(site: ${esc(String(sv(k)))})</span></label>
    <input id="th_${k}" type="number" value="${esc(String(cur(k)))}"></div>`;
  const m = modal(`<h2>Thresholds — ${esc(u.serial)}</h2>
    <p style="font-size:12px;color:var(--tz-muted)">Per-unit override. These values apply to this IDBM only and survive site-wide broadcasts. Every change is audited.</p>
    ${F('threshold_xval_warn','Cross-validation warn (%)')}
    ${F('threshold_xval_fault','Cross-validation fault (%)')}
    ${F('slip_warn_mm','Slip warn (mm)')}
    <div class="row"><label>Reason for override (required, audited)</label><textarea id="thReason" rows="2"></textarea></div>
    <div class="acts">${u.overrides?'<button class="tzc-btn danger" id="thRevert">Revert to site values</button>':''}
      <button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button>
      <button class="tzc-btn pri" id="thGo">Apply override</button></div>`);
  m.querySelector('#thGo').onclick = () => {
    const reason = m.querySelector('#thReason').value.trim();
    if(!reason){ m.querySelector('#thReason').style.borderColor='var(--tz-orange)'; return; }
    const o = {}; ['threshold_xval_warn','threshold_xval_fault','slip_warn_mm']
      .forEach(k=>o[k]=m.querySelector('#th_'+k).value.trim());
    const old = u.overrides ? JSON.stringify(u.overrides) : 'site values';
    u.overrides = o; DB.persist();
    DB.insert('config_audit_trail', { site_id:1, key:'override:'+u.serial, old, new:JSON.stringify(o),
      by:me.id, at:new Date().toISOString(), reason });
    DB.log('config_change', u.serial, 'Per-unit threshold override — '+reason);
    closeModal(); toast('Override applied to '+u.serial); idbmPanel(u.id);
  };
  const rv = m.querySelector('#thRevert');
  if(rv) rv.onclick = () => {
    DB.insert('config_audit_trail', { site_id:1, key:'override:'+u.serial, old:JSON.stringify(u.overrides),
      new:'site values', by:me.id, at:new Date().toISOString(), reason:'Override reverted to site values.' });
    delete u.overrides; DB.persist();
    DB.log('config_change', u.serial, 'Threshold override reverted to site values.');
    closeModal(); toast(u.serial+' back on site values'); idbmPanel(u.id);
  };
}

/* mesh-loss banner (Screen 49/50) — shown on Home while TZL.meshLost is set */
function meshBanner(){
  const m = TZL.meshLost, s = Math.max(0, Math.ceil((m.until-Date.now())/1000));
  return `<div class="tzc-estop" style="border-color:var(--tz-orange);background:repeating-linear-gradient(45deg,rgba(224,60,49,.10) 0 14px,rgba(224,60,49,.04) 14px 28px)">
    <span style="font-size:24px">📡</span>
    <div style="flex:1;min-width:240px"><b style="font-size:13.5px;color:var(--tz-orange)">CONNECTION LOST — reconnecting to the mesh…</b>
    <div style="font-size:12px;color:var(--tz-muted)">Supervisory cannot reach the IDBM mesh. Live data is paused — the mesh itself continues to operate. Auto-retry in ${s}s.</div></div>
    <button class="tzc-btn pri" id="hRetry">Retry now</button></div>`;
}

/* ---- shift handover (S4) ---- */
function handoverModal(){
  const me = DB.current(); if(!me) return;
  const today = new Date().toISOString().slice(0,10);
  const units = (DB.all('daily_stats').find(d=>d.date===today)||{units:0}).units;
  const open = DB.openAlarms().length;
  const todayLog = DB.all('operations_log').filter(l=>l.ts.slice(0,10)===today);
  const overrides = todayLog.filter(l=>l.action==='override').length;
  const holds = todayLog.filter(l=>l.action==='hold_lane').length;
  const others = DB.all('employees').filter(e=>e.is_active && e.id!==me.id);
  const hr = new Date().getHours();
  const shift = hr>=6&&hr<14 ? 'A (06:00–14:00)' : hr>=14&&hr<22 ? 'B (14:00–22:00)' : 'C (22:00–06:00)';
  const m = modal(`<h2>Shift handover — ${shift}</h2>
    <div class="tzc-panel" style="padding:10px 12px;margin:10px 0;box-shadow:none">
      <div style="font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--tz-muted);font-weight:700;margin-bottom:6px">Auto-summary for this shift</div>
      <div style="display:flex;gap:18px;flex-wrap:wrap;font-size:12.5px">
        <span>Units today <b>${num(units)}</b></span><span>Open alarms <b>${open}</b></span>
        <span>Holds <b>${holds}</b></span><span>Overrides <b>${overrides}</b></span></div></div>
    <div class="row"><label>Outgoing</label><div style="font-size:13px;padding:4px 0"><b>${esc(me.name)}</b> — ${esc(me.title)}</div></div>
    <div class="row"><label>Incoming operator</label>
      <select id="hoIn">${others.map(e=>`<option value="${e.id}">${esc(e.name)} — ${esc(e.title)}</option>`).join('')}</select></div>
    <div class="row"><label>Notes for the incoming shift (audited)</label>
      <textarea id="hoNotes" rows="3" placeholder="What to watch, what's pending…"></textarea></div>
    <label style="display:flex;gap:8px;font-size:12px;margin:10px 0;cursor:pointer"><input type="checkbox" id="hoOut" checked style="width:auto"> Sign me out after the handover is accepted</label>
    <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button>
      <button class="tzc-btn pri" id="hoGo">Hand over shift</button></div>`);
  m.querySelector('#hoGo').onclick = () => {
    const notes = m.querySelector('#hoNotes').value.trim();
    if(!notes){ m.querySelector('#hoNotes').style.borderColor='var(--tz-orange)'; return; }
    const inId = +m.querySelector('#hoIn').value;
    DB.insert('shift_handovers', { site_id:1, date:today, shift, operator_id:me.id, incoming_id:inId,
      started_at:null, ended_at:new Date().toISOString(), units, unresolved:open, overrides, confirmed:true, notes });
    DB.log('shift_handover', shift, `→ ${empName(inId)}. ${notes}`);
    const out = m.querySelector('#hoOut').checked;
    closeModal(); toast('Shift handed over to '+empName(inId));
    if(out){ logout(); } else render();
  };
}
function actionLabel(a){ return ({login:'signed in to',logout:'signed out of',ack_alarm:'acknowledged alarm on',
  maintenance:'performed maintenance on',maintenance_signoff:'signed off work on',config_change:'changed setting',
  hold_lane:'held lane',release_lane:'released lane',discharge:'discharged lane',override:'overrode routing on',
  soft_stop:'soft E-stopped',estop_resume:'resumed from E-stop on',shift_handover:'handed over shift',
  mesh_lost:'lost connection to',mesh_restored:'restored connection to',fault_clip:'recorded fault clip for',
  gate_passed:'passed gate',commission_start:'started commissioning',commission_signoff:'signed off commissioning of',
  commission_abort:'aborted commissioning of'})[a] || a; }

function idbmPanel(id){
  const u = DB.get('idbms', id); if(!u) return;
  const open = DB.openAlarms().filter(a=>a.idbm===u.serial);
  const hist = DB.all('maintenance_history').filter(m=>m.idbm===u.serial);
  panel(`
    <h2 style="margin:0 0 2px;font-size:17px">${esc(u.serial)} <span class="tzc-pill">${esc(u.lane_id)} · slot ${u.slot}</span></h2>
    <p class="tzc-sub" style="margin-bottom:12px">status: <b class="${u.status==='online'?'tzc-ok':''}">${esc(u.status)}</b></p>
    ${open.map(a=>`<div class="tzc-panel" style="padding:10px 12px;margin-bottom:10px;border-color:var(--tz-orange)">
      <span class="tzc-sev ${a.severity}">${a.severity}</span> <b style="font-size:12px">${esc(a.type.replace(/_/g,' '))}</b>
      <p style="font-size:11.5px;color:var(--tz-muted);margin:6px 0 0">${esc(a.message)}</p></div>`).join('')}
    <div class="tzc-kv"><span>Firmware</span><b>${esc(u.fw)}</b></div>
    <div class="tzc-kv"><span>Master odometer</span><b>${num(u.odometer_master)} transfers</b></div>
    <div class="tzc-kv"><span>Since last service</span><b>${num(u.odometer_maintenance)} transfers</b></div>
    <div class="tzc-kv"><span>Last heartbeat</span><b>${ago(u.last_heartbeat)}</b></div>
    <div class="tzc-kv"><span>Position (x · y)</span><b>${u.x} m · ${u.y} m</b></div>
    <div class="tzc-kv"><span>Commissioned</span><b>${fmtD(u.commissioned_date)}</b></div>
    <h3 style="font-size:12px;margin:16px 0 4px;text-transform:uppercase;letter-spacing:.07em;color:var(--tz-muted)">Thresholds in force ${u.overrides?'<span class="tzc-pill" style="background:var(--tz-gold);color:#3b2f00">unit override</span>':'<span class="tzc-pill">site values</span>'}</h3>
    ${[['threshold_xval_warn','Cross-val warn (%)'],['threshold_xval_fault','Cross-val fault (%)'],['slip_warn_mm','Slip warn (mm)']].map(([k,l])=>{
      const site=(DB.all('settings').find(s=>s.key===k)||{}).value||'—';
      const eff=(u.overrides&&u.overrides[k]!=null)?u.overrides[k]:site;
      return `<div class="tzc-kv"><span>${l}</span><b>${esc(String(eff))}${u.overrides&&u.overrides[k]!=null?` <span style="font-weight:400;color:var(--tz-muted)">(site ${esc(String(site))})</span>`:''}</b></div>`;}).join('')}
    ${(DB.can('settings')||DB.can('maintenance'))?`<button class="tzc-btn" style="margin-top:8px" onclick="TZC.thresholds(${u.id})">Adjust thresholds…</button>`:''}
    <h3 style="font-size:12px;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.07em;color:var(--tz-muted)">Maintenance history</h3>
    ${hist.length ? hist.map(m=>`<div style="font-size:12px;padding:7px 0;border-top:1px solid var(--tz-brd)">
        <b>${esc(m.component)}</b> · ${fmtD(m.performed_at)} · ${esc(empName(m.performed_by))}
        <div style="color:var(--tz-muted);margin-top:2px">${esc(m.work)}</div>
        <div style="margin-top:3px;font-size:10.5px">${m.signed_off_by?`<span class="tzc-ok">✓ signed off — ${esc(empName(m.signed_off_by))}</span>`:'<span style="color:var(--tz-gold);font-weight:700">awaiting sign-off</span>'}</div>
      </div>`).join('') : '<p style="font-size:12px;color:var(--tz-muted)">No maintenance recorded.</p>'}
    ${u.mount==='vehicle'?`<div class="tzc-panel" style="padding:9px 12px;margin-top:12px;border-color:var(--tz-cyan)">
      <b style="font-size:12px">🛗 Vehicle-mounted</b>
      <p style="font-size:11.5px;color:var(--tz-muted);margin:4px 0 0">Rides on <b>${esc(u.vehicle)}</b> — tracked at zone level (${esc(u.zone)}, block y ${u.y} m). Live XY lives in the Viewer 3D.</p></div>`:''}
    ${DB.all('idbms').length<=200?`<div style="display:flex;gap:8px;margin-top:16px">
      <button class="tzc-btn" onclick="TZC.lane('${esc(u.lane_id)}')">Lane ${esc(u.lane_id)} detail</button>
      ${(DB.can('hold_release')||DB.can('discharge')||DB.can('override'))?`<button class="tzc-btn pri" onclick="TZC.laneControl('${esc(u.lane_id)}','hold')">Lane controls…</button>`:''}
    </div>`:''}`);
}

/* ---------- FLEET (Screen 56 — multi-site overview) ---------- */
VIEWS.fleet = {
  html(){
    const site = DB.all('sites')[0];
    const idbms = DB.all('idbms');
    const online = idbms.filter(u=>u.status==='online').length;
    const open = DB.openAlarms().length;
    const crit = DB.openAlarms().some(a=>a.severity==='critical');
    const today = (DB.all('daily_stats').slice(-1)[0]||{units:0}).units;
    const lanesOk = Object.values(laneRows()).filter(a=>a.every(u=>u.status==='online')).length;
    const health = site.status!=='active' ? ['not commissioned','warn'] : crit ? ['critical','bad'] : open ? ['warnings','warn'] : ['ok','ok'];
    const HB = ([t,c]) => `<span class="tzc-sev ${c==='ok'?'info':c==='bad'?'critical':'warning'}" style="${c==='ok'?'background:var(--tz-green)':''}">${t}</span>`;
    // illustrative sites — static placeholders so the multi-site story is visible in demos
    const demo = [
      ['02','Melbourne East','Allied Packaging & Logistics',72,0,['ok','ok'],14820],
      ['03','Sydney North','Allied Packaging & Logistics',60,3,['warnings','warn'],11240],
      ['04','Perth South','Allied Packaging & Logistics',90,0,['ok','ok'],19660]
    ];
    return `<div class="tzc-crumb">Fleet</div><h1 class="tzc-h1">Fleet — sites</h1>
      <p class="tzc-sub">Every commissioned site under this organisation. Click a site to enter its operations shell. <b>Sites 02–04 are illustrative placeholders</b> — multi-site federation is a future phase; each site's data stays on its own supervisory.</p>
      <div class="tzc-kpis">
        <div class="tzc-kpi"><div class="l">Sites</div><div class="v">4</div><div class="d">1 live · 3 illustrative</div></div>
        <div class="tzc-kpi"><div class="l">Fleet IDBMs</div><div class="v">${num(45+72+60+90)}</div><div class="d">across all sites</div></div>
        <div class="tzc-kpi"><div class="l">Units today</div><div class="v">${num(today+14820+11240+19660)}</div><div class="d">aggregate</div></div>
        <div class="tzc-kpi ${crit?'bad':(open?'warn':'ok')}"><div class="l">Open alarms</div><div class="v">${open+3}</div><div class="d">fleet-wide</div></div>
      </div>
      <div class="tzc-panel" style="padding:6px 10px"><table class="tzc-table">
        <tr><th>#</th><th>Site</th><th>Customer</th><th>IDBMs</th><th>Units today</th><th>Alarms</th><th>Health</th></tr>
        <tr data-fleet="real" style="cursor:pointer" title="Enter operations shell">
          <td class="mono">01</td><td><b>${esc(site.name)}</b><br><span style="font-size:10.5px;color:var(--tz-muted)">${esc(site.location)} · this supervisory</span></td>
          <td>${esc(site.customer)}</td><td class="mono">${online}/${idbms.length}</td><td class="mono">${num(today)}</td>
          <td class="mono">${open}</td><td>${HB(health)}</td></tr>
        ${demo.map(([id,name,cust,n,al,h,u])=>`<tr data-fleet="demo" style="cursor:pointer;opacity:.62" title="Illustrative placeholder">
          <td class="mono">${id}</td><td><b>${name}</b> <span class="tzc-pill">sample</span></td>
          <td>${cust}</td><td class="mono">${n}/${n}</td><td class="mono">${num(u)}</td><td class="mono">${al}</td><td>${HB(h)}</td></tr>`).join('')}
      </table></div>
      <p style="font-size:11px;color:var(--tz-muted);margin-top:10px">Cloud learning (opt-in, future): anonymised dimensional/timing data only — no customer product identities — used to improve allocation strategies across the fleet.</p>`;
  },
  wire(){
    document.querySelectorAll('[data-fleet]').forEach(r => r.onclick = () => {
      if(r.dataset.fleet==='real'){ go('home'); }
      else toast('Illustrative site — multi-site federation is a future phase');
    });
  }
};

/* ---------- COMMISSIONING (delegates to the wizard when a run is live) ---------- */
VIEWS.commission = {
  html(me){
    if(window.TZW && TZW.activeRun()) return TZW.html(me);
    const run = window.TZW ? TZW.lastPassed() : null;
    if(!run) return `<div class="tzc-crumb">Commissioning</div><h1 class="tzc-h1">Commission this site</h1>
      <p class="tzc-sub">No commissioning run on record for this supervisory.</p>
      <div class="tzc-panel" style="max-width:620px">
        <h3 style="margin:0 0 6px;font-size:14px">Seven gates from power-up to customer sign-off</h3>
        <p style="font-size:12.5px;color:var(--tz-muted);line-height:1.7;margin:0 0 14px">
          Topology discovery → calibration → power & electrical → network & mesh → pilot run → configuration broadcast → sign-off.
          Every gate is stamped with who checked it and when; the run is resumable, and the result is a printable commissioning report.</p>
        <button class="tzc-btn pri" onclick="TZW.begin()" style="font-size:13.5px;padding:10px 18px">◉ Start commissioning</button>
      </div>`;
    const checks = DB.all('commissioning_checks').filter(c=>c.run_id===run.id).sort((a,b)=>a.seq-b.seq);
    const days = Math.max(1, Math.round((new Date(run.completed_at)-new Date(run.started_at))/86400000));
    return `
      <div class="tzc-crumb">Commissioning</div><h1 class="tzc-h1">Commissioning record</h1>
      <p class="tzc-sub">${esc(run.installation_type.replace(/_/g,' '))} · started ${fmtD(run.started_at)} · completed ${fmtD(run.completed_at)} · status <b class="tzc-ok">${esc(run.status)}</b></p>
      <div class="tzc-grid" style="grid-template-columns:minmax(0,1.4fr) minmax(260px,1fr)">
        <div class="tzc-panel">
          <h3 style="margin:0 0 6px;font-size:13px">${checks.length} gates — all passed</h3>
          ${checks.map(c=>`<div class="tzc-gate"><div class="n">✓</div><div>
            <h4>${c.seq}. ${esc(c.name)}</h4><p>${esc(c.notes)}</p>
            <div class="meta">checked by <b>${esc(empName(c.checked_by))}</b> · ${fmtDT(c.checked_at)}</div></div></div>`).join('')}
        </div>
        <div>
          <div class="tzc-panel" style="margin-bottom:14px">
            <h3 style="margin:0 0 8px;font-size:13px">Run summary</h3>
            <div class="tzc-kv"><span>IDBMs found</span><b>${run.total_idbms_found}</b></div>
            <div class="tzc-kv"><span>Started by</span><b>${esc(empName(run.started_by))}</b></div>
            <div class="tzc-kv"><span>Customer rep</span><b>${esc(run.customer_rep||'—')}</b></div>
            <div class="tzc-kv"><span>Duration</span><b>${days} day${days>1?'s':''}</b></div>
            <p style="font-size:11.5px;color:var(--tz-muted);margin:10px 0 0">${esc(run.notes)}</p>
            <button class="tzc-btn pri" onclick="TZW.printReport(${run.id})" style="width:100%;margin-top:12px">🖨 Print commissioning report</button>
          </div>
          ${DB.can('commission') ? `<div class="tzc-panel">
            <h3 style="margin:0 0 8px;font-size:13px">Re-commission</h3>
            <p style="font-size:11.5px;color:var(--tz-muted);margin:0 0 10px">Re-runs every gate and issues a fresh settings broadcast — use after hardware reconfiguration or layout changes.</p>
            <button class="tzc-btn" onclick="TZW.begin()">Start new commissioning run</button>
          </div>`:''}
        </div>
      </div>`;
  },
  wire(me){ if(window.TZW && TZW.activeRun()) TZW.wire(me); }
};

/* ---------- ALARMS ---------- */
let alarmFlt = { sev:'', type:'' };
let auditFlt = { op:'', act:'' };
VIEWS.alarms = {
  html(){
    const tab = (location.hash.split('?t=')[1]) || 'active';
    const open = DB.openAlarms().sort((a,b)=>b.created_at.localeCompare(a.created_at));
    let hist = DB.all('alarms').filter(a=>a.acknowledged).sort((a,b)=>b.created_at.localeCompare(a.created_at));
    const histAll = hist.length;
    const types = [...new Set(DB.all('alarms').map(a=>a.type))].sort();
    if(tab==='history'){
      if(alarmFlt.sev) hist = hist.filter(a=>a.severity===alarmFlt.sev);
      if(alarmFlt.type) hist = hist.filter(a=>a.type===alarmFlt.type);
    }
    const filterBar = tab==='history' ? `<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;font-size:12px">
      <label style="font-size:10.5px;font-weight:700;color:var(--tz-muted)">FILTER</label>
      <select id="afSev" style="font:inherit;font-size:12px;padding:5px 8px;border:1px solid var(--tz-brd);border-radius:7px;background:var(--tz-panel-solid);color:var(--tz-ink)">
        <option value="">All severities</option>${['critical','warning','info'].map(s=>`<option ${alarmFlt.sev===s?'selected':''}>${s}</option>`).join('')}</select>
      <select id="afType" style="font:inherit;font-size:12px;padding:5px 8px;border:1px solid var(--tz-brd);border-radius:7px;background:var(--tz-panel-solid);color:var(--tz-ink)">
        <option value="">All types</option>${types.map(t=>`<option value="${t}" ${alarmFlt.type===t?'selected':''}>${t.replace(/_/g,' ')}</option>`).join('')}</select>
      <span style="color:var(--tz-muted)">${hist.length} of ${histAll}</span></div>` : '';
    const rows = (tab==='active'?open:hist).map(a=>`<tr data-aid="${a.id}" style="cursor:pointer" title="Open alarm detail">
      <td><span class="tzc-sev ${a.severity}">${a.severity}</span></td>
      <td class="mono">${fmtDT(a.created_at)}</td>
      <td><b>${esc(a.idbm)}</b><br><span style="color:var(--tz-muted);font-size:11px">${esc(a.lane)}</span></td>
      <td>${esc(a.type.replace(/_/g,' '))}<br><span style="color:var(--tz-muted);font-size:11px">${esc(a.message)}</span></td>
      ${tab==='active'
        ? `<td><button class="tzc-btn" data-ack="${a.id}">Acknowledge…</button></td>`
        : `<td style="font-size:11px"><span class="tzc-ok">✓ ${esc(empName(a.acknowledged_by))}</span> · ${fmtDT(a.acknowledged_at)}<br><span style="color:var(--tz-muted)">${esc(a.ack_note||'')}</span></td>`}
    </tr>`).join('');
    return `
      <div class="tzc-crumb">Alarms</div><h1 class="tzc-h1">Alarms</h1>
      <p class="tzc-sub">${open.length} active · ${hist.length} resolved in the last 30 days · every acknowledgment requires a note and lands in the audit trail</p>
      <div class="tzc-tabs">
        <span class="t ${tab==='active'?'on':''}" onclick="location.hash='#/alarms?t=active'">Active (${open.length})</span>
        <span class="t ${tab==='history'?'on':''}" onclick="location.hash='#/alarms?t=history'">History (${hist.length})</span>
        <button class="tzc-btn" style="margin-left:auto;margin-bottom:6px;padding:5px 11px;font-size:11px" onclick="TZC.exportAlarms()">⬇ Export CSV</button>
      </div>
      ${filterBar}
      <div class="tzc-panel" style="padding:6px 10px"><table class="tzc-table">
        <tr><th style="width:70px">Sev</th><th style="width:110px">Raised</th><th style="width:90px">Source</th><th>Event</th><th style="width:${tab==='active'?'140':'220'}px">${tab==='active'?'Action':'Resolution'}</th></tr>
        ${rows || `<tr><td colspan="5" style="color:var(--tz-muted);padding:20px;text-align:center">Nothing here — all clear.</td></tr>`}
      </table></div>`;
  },
  wire(){
    document.querySelectorAll('[data-ack]').forEach(b => b.onclick = (e) => {
      e.stopPropagation(); ackModal(DB.get('alarms', +b.dataset.ack)); });
    document.querySelectorAll('tr[data-aid]').forEach(r => r.onclick = (e) => {
      if(e.target.closest('button')) return; alarmPanel(+r.dataset.aid); });
    const fs = $('#afSev'), ft = $('#afType');
    if(fs) fs.onchange = () => { alarmFlt.sev = fs.value; render(); };
    if(ft) ft.onchange = () => { alarmFlt.type = ft.value; render(); };
  }
};

/* ---------- MAINTENANCE (S4: forecast + replacement wizard + sign-offs) ---------- */
const SERVICE_INTERVAL = 12000, SERVICE_DUE = 10000, SERVICE_SOON = 8000;
const COMPONENTS = ['Belt','Drive motor','Encoder','Photo-eye','IR transceiver','Controller','Comms module'];
function canSignOff(){ const me=DB.current(); return me && me.sign_off_authority==='full'; }
VIEWS.maintenance = {
  html(){
    const tab = (location.hash.split('?t=')[1]) || 'dash';
    const sp = DB.all('spare_pool');
    const mh = DB.all('maintenance_history').slice().sort((a,b)=>b.performed_at.localeCompare(a.performed_at));
    const pend = mh.filter(m=>!m.signed_off_by);
    let body = '';
    if(tab==='dash'){
      const units = DB.all('idbms').slice().sort((a,b)=>b.odometer_maintenance-a.odometer_maintenance);
      const due  = units.filter(u=>u.odometer_maintenance>=SERVICE_DUE);
      const soon = units.filter(u=>u.odometer_maintenance>=SERVICE_SOON && u.odometer_maintenance<SERVICE_DUE);
      const bar = u => { const p=Math.min(100,u.odometer_maintenance/SERVICE_INTERVAL*100);
        return `<div class="tzw-prog" style="height:7px"><div style="width:${p}%;background:${p>=83?'var(--tz-orange)':p>=66?'var(--tz-gold)':'var(--tz-green)'}"></div></div>`; };
      const row = u => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--tz-brd)">
        <button class="tzc-btn" style="padding:3px 9px;font-size:11px" onclick="TZC.unit(${u.id})"><b>${u.serial}</b></button>
        <span style="font-size:11px;color:var(--tz-muted);flex:0 0 56px">${u.lane_id}</span>
        <div style="flex:1">${bar(u)}</div>
        <span class="mono" style="font-size:11px;flex:0 0 120px;text-align:right">${num(u.odometer_maintenance)} / ${num(SERVICE_INTERVAL)}</span></div>`;
      body = `
        <div class="tzc-kpis">
          <div class="tzc-kpi ${due.length?'bad':'ok'}"><div class="l">Service due</div><div class="v">${due.length}</div><div class="d">past ${num(SERVICE_DUE)} transfers</div></div>
          <div class="tzc-kpi ${soon.length?'warn':'ok'}"><div class="l">Predicted soon</div><div class="v">${soon.length}</div><div class="d">next ~30 days</div></div>
          <div class="tzc-kpi"><div class="l">Spares in stock</div><div class="v">${sp.filter(s=>s.status==='in_stock').length}</div><div class="d">of ${sp.length} in pool</div></div>
          <div class="tzc-kpi ${pend.length?'warn':'ok'}"><div class="l">Awaiting sign-off</div><div class="v">${pend.length}</div><div class="d">completed jobs</div></div>
        </div>
        <div class="tzc-grid" style="grid-template-columns:minmax(0,1.4fr) minmax(280px,1fr)">
          <div class="tzc-panel">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <h3 style="margin:0;font-size:13px">Service-due forecast <span class="tzc-pill">interval ${num(SERVICE_INTERVAL)} transfers</span></h3>
              ${DB.can('maintenance')?'<button class="tzc-btn pri" id="mRec">🛠 Record component replacement…</button>':''}
            </div>
            ${[...due,...soon].length ? [...due,...soon].map(row).join('') : '<p style="font-size:12px;color:var(--tz-muted)">Nothing due — fleet is inside service intervals.</p>'}
          </div>
          <div class="tzc-panel">
            <h3 style="margin:0 0 8px;font-size:13px">Awaiting supervisor sign-off</h3>
            ${pend.length ? pend.map(m=>`<div style="font-size:12px;padding:8px 0;border-top:1px solid var(--tz-brd)">
              <b>${esc(m.idbm)}</b> · ${esc(m.component)} · ${fmtD(m.performed_at)} by ${esc(empName(m.performed_by))}
              <div style="color:var(--tz-muted);margin:2px 0 6px">${esc(m.work)}</div>
              ${canSignOff()?`<button class="tzc-btn" data-signoff="${m.id}" style="padding:4px 10px;font-size:11px">✓ Sign off</button>`:'<span style="font-size:10.5px;color:var(--tz-gold);font-weight:700">requires full sign-off authority</span>'}
            </div>`).join('') : '<p style="font-size:12px;color:var(--tz-muted)">Nothing pending.</p>'}
          </div>
        </div>`;
    } else if(tab==='spares'){
      body = `<div class="tzc-panel" style="padding:6px 10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin:10px 8px">
          <h3 style="margin:0;font-size:13px">Spare pool (${sp.length})</h3>
          ${DB.can('maintenance')?'<button class="tzc-btn" id="mAddSp">+ Add spare</button>':''}</div>
        <table class="tzc-table"><tr><th>SN</th><th>Length</th><th>Rev</th><th>Warranty</th><th>Status</th><th>Deployed</th></tr>
        ${sp.map(s=>`<tr data-sp="${s.id}" style="cursor:pointer" title="Spare detail"><td><b>${esc(s.serial)}</b></td><td>${s.length_m} m</td><td>${esc(s.rev)}</td><td>${s.warranty_months} mo</td>
          <td>${s.status==='in_stock'?'<span class="tzc-ok">in stock</span>':`<span style="color:var(--tz-gold);font-weight:700">${esc(s.status)}</span>`}</td>
          <td style="font-size:11px;color:var(--tz-muted)">${s.deployed_lane?esc(s.deployed_lane)+' · '+fmtD(s.last_deployment_date):(s.note?esc(s.note):'—')}</td></tr>`).join('')}
        </table></div>`;
    } else {
      body = `<div class="tzc-panel" style="padding:6px 10px"><table class="tzc-table">
        <tr><th>When</th><th>Unit</th><th>Work</th><th>Spare used</th><th>Sign-off</th></tr>
        ${mh.map(m=>`<tr><td class="mono">${fmtD(m.performed_at)}</td>
          <td><b>${esc(m.idbm)}</b><br><span style="font-size:10.5px;color:var(--tz-muted)">${esc(m.component)}</span></td>
          <td style="font-size:12px">${esc(m.issue)}<br><span style="color:var(--tz-muted)">${esc(m.work)}</span><br><span style="font-size:10.5px">by ${esc(empName(m.performed_by))}</span></td>
          <td style="font-size:11.5px">${m.spare_serial?'<b>'+esc(m.spare_serial)+'</b>':'—'}</td>
          <td style="font-size:11px">${m.signed_off_by?`<span class="tzc-ok">✓ ${esc(empName(m.signed_off_by))}</span><br>${fmtD(m.signed_off_at)}`
            :(canSignOff()?`<button class="tzc-btn" data-signoff="${m.id}" style="padding:4px 10px;font-size:11px">✓ Sign off</button>`:'<span style="color:var(--tz-gold);font-weight:700">awaiting<br>sign-off</span>')}</td></tr>`).join('')}
      </table></div>`;
    }
    const T=(id,lbl)=>`<span class="t ${tab===id?'on':''}" onclick="location.hash='#/maintenance?t=${id}'">${lbl}</span>`;
    return `<div class="tzc-crumb">Maintenance</div><h1 class="tzc-h1">Maintenance</h1>
      <p class="tzc-sub">Predictive service, component replacement with spare-pool tracking, and supervisor sign-offs — every job lands on the audit trail.</p>
      <div class="tzc-tabs">${T('dash','Dashboard')}${T('spares','Spare pool')}${T('history','History')}</div>${body}`;
  },
  wire(){
    const rec = $('#mRec'); if(rec) rec.onclick = () => replacementWizard(1, {});
    document.querySelectorAll('[data-signoff]').forEach(b => b.onclick = () => {
      const m = DB.get('maintenance_history', +b.dataset.signoff);
      const mod = modal(`<h2>Sign off maintenance</h2>
        <p style="font-size:12.5px;color:var(--tz-muted)"><b>${esc(m.idbm)}</b> · ${esc(m.component)} — ${esc(m.work)}<br>Performed by ${esc(empName(m.performed_by))}, ${fmtD(m.performed_at)}.</p>
        <p style="font-size:12px">Signing confirms the work is verified and the unit is fit for service.</p>
        <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button><button class="tzc-btn pri" id="soGo">Sign off as ${esc(DB.current().name)}</button></div>`);
      mod.querySelector('#soGo').onclick = () => {
        DB.update('maintenance_history', m.id, { signed_off_by:DB.current().id, signed_off_at:new Date().toISOString() });
        DB.log('maintenance_signoff', m.idbm, m.component+' work verified and signed off.');
        closeModal(); toast('Signed off — audit trail updated'); render();
      };
    });
    document.querySelectorAll('tr[data-sp]').forEach(r => r.onclick = () => sparePanel(+r.dataset.sp));
    const add = $('#mAddSp'); if(add) add.onclick = () => {
      const mod = modal(`<h2>Add spare to pool</h2>
        <div class="row"><label>Serial</label><input id="spSn" placeholder="SP06"></div>
        <div class="row"><label>Length (m)</label><input id="spLen" type="number" value="6.0"></div>
        <div class="row"><label>Hardware revision</label><input id="spRev" value="2B"></div>
        <div class="row"><label>Warranty (months)</label><input id="spWty" type="number" value="12"></div>
        <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button><button class="tzc-btn pri" id="spGo">Add to pool</button></div>`);
      mod.querySelector('#spGo').onclick = () => {
        const sn = mod.querySelector('#spSn').value.trim(); if(!sn) return;
        DB.insert('spare_pool', { serial:sn, length_m:+mod.querySelector('#spLen').value, rev:mod.querySelector('#spRev').value.trim(),
          warranty_months:+mod.querySelector('#spWty').value, status:'in_stock' });
        DB.log('maintenance', 'Spare pool', 'Added spare '+sn+' to the pool.');
        closeModal(); toast('Spare '+sn+' added'); render();
      };
    };
  }
};

/* ---- spare-pool detail card (Screens 24-25, S14) ---- */
function sparePanel(id){
  const s = DB.get('spare_pool', id); if(!s) return;
  const jobs = DB.all('maintenance_history').filter(m=>m.spare_serial===s.serial)
    .sort((a,b)=>b.performed_at.localeCompare(a.performed_at));
  const canM = DB.can('maintenance');
  panel(`
    <h2 style="margin:0 0 2px;font-size:17px">${esc(s.serial)} <span class="tzc-pill">spare unit</span></h2>
    <p class="tzc-sub" style="margin-bottom:12px">status: ${s.status==='in_stock'?'<b class="tzc-ok">in stock</b>':`<b style="color:var(--tz-gold)">${esc(s.status)}</b>`}</p>
    <div class="tzc-kv"><span>Length</span><b>${s.length_m} m</b></div>
    <div class="tzc-kv"><span>Hardware revision</span><b>${esc(s.rev)}</b></div>
    <div class="tzc-kv"><span>Warranty remaining</span><b>${s.warranty_months} months</b></div>
    <div class="tzc-kv"><span>Deployed</span><b>${s.deployed_lane?esc(s.deployed_lane)+' · '+fmtD(s.last_deployment_date):'—'}</b></div>
    ${s.note?`<p style="font-size:11.5px;color:var(--tz-muted);margin-top:8px">${esc(s.note)}</p>`:''}
    <h3 style="font-size:12px;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.07em;color:var(--tz-muted)">Used in jobs</h3>
    ${jobs.length?jobs.map(m=>`<div style="font-size:12px;padding:7px 0;border-top:1px solid var(--tz-brd)">
      <b>${esc(m.idbm)}</b> · ${esc(m.component)} · ${fmtD(m.performed_at)} by ${esc(empName(m.performed_by))}
      <div style="color:var(--tz-muted)">${esc(m.work)}</div></div>`).join('')
      :'<p style="font-size:12px;color:var(--tz-muted)">Not yet used in any recorded job.</p>'}
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
      ${s.status==='repair' && canSignOff() ? `<button class="tzc-btn pri" onclick="TZC.spareReady(${s.id})">✓ Mark as ready</button>`:''}
      ${s.status==='in_stock' && canM ? `<button class="tzc-btn danger" onclick="TZC.spareRepair(${s.id})">Send to repair…</button>`:''}
    </div>`);
}
function spareReady(id){
  const s = DB.get('spare_pool', id); if(!s) return;
  DB.update('spare_pool', id, { status:'in_stock', note:null });
  DB.log('maintenance_signoff', s.serial, 'Spare verified after repair and returned to the pool as ready.');
  toast(s.serial+' back in the pool'); render(); sparePanel(id);
}
function spareRepair(id){
  const s = DB.get('spare_pool', id); if(!s) return;
  const m = modal(`<h2>Send ${esc(s.serial)} to repair</h2>
    <div class="row"><label>Fault / reason (audited)</label><textarea id="srWhy" rows="2"></textarea></div>
    <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button>
    <button class="tzc-btn pri" id="srGo">Send to repair</button></div>`);
  m.querySelector('#srGo').onclick = () => {
    const why = m.querySelector('#srWhy').value.trim();
    if(!why){ m.querySelector('#srWhy').style.borderColor='var(--tz-orange)'; return; }
    DB.update('spare_pool', id, { status:'repair', note:why });
    DB.log('maintenance', s.serial, 'Spare sent to repair — '+why);
    closeModal(); toast(s.serial+' sent to repair'); render(); sparePanel(id);
  };
}

/* ---- 4-step component replacement wizard (modal) ---- */
function replacementWizard(step, data){
  const units = DB.all('idbms').slice().sort((a,b)=>b.odometer_maintenance-a.odometer_maintenance);
  const spares = DB.all('spare_pool').filter(s=>s.status==='in_stock');
  const me = DB.current();
  const stepHdr = `<div style="font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--tz-muted);font-weight:700">Record component replacement — step ${step} of 4</div>`;
  let body='', nextLabel='Next →';
  if(step===1) body = `<h2 style="margin:4px 0 10px">Which IDBM was serviced?</h2>
    <select id="rwUnit" size="8" style="width:100%;font:inherit;font-size:12.5px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel);color:var(--tz-ink)">
      ${units.map(u=>`<option value="${u.serial}" ${data.unit===u.serial?'selected':''}>${u.serial} — ${u.lane_id} slot ${u.slot} · ${num(u.odometer_maintenance)} since service${u.odometer_maintenance>=SERVICE_DUE?'  ⚠ DUE':''}</option>`).join('')}</select>`;
  if(step===2) body = `<h2 style="margin:4px 0 10px">${esc(data.unit)} — what was replaced, and why?</h2>
    <div class="row"><label>Component</label><select id="rwComp">${COMPONENTS.map(c=>`<option ${data.comp===c?'selected':''}>${c}</option>`).join('')}</select></div>
    <div class="row"><label>Issue found (audited)</label><textarea id="rwIssue" rows="2" placeholder="What was wrong…">${esc(data.issue||'')}</textarea></div>`;
  if(step===3) body = `<h2 style="margin:4px 0 10px">Work performed</h2>
    <div class="row"><label>Work description (audited)</label><textarea id="rwWork" rows="2" placeholder="What was done…">${esc(data.work||'')}</textarea></div>
    <div class="row"><label>Spare used (from pool)</label><select id="rwSpare"><option value="">None — repaired in place</option>
      ${spares.map(s=>`<option value="${s.serial}" ${data.spare===s.serial?'selected':''}>${s.serial} · ${s.length_m} m · rev ${s.rev}</option>`).join('')}</select></div>
    <label style="display:flex;gap:8px;font-size:12px;margin:10px 0;cursor:pointer"><input type="checkbox" id="rwReset" ${data.reset!==false?'checked':''} style="width:auto"> Reset the service odometer for this unit</label>`;
  if(step===4){ nextLabel = 'Record job';
    body = `<h2 style="margin:4px 0 10px">Review & record</h2>
    <div class="tzc-kv"><span>Unit</span><b>${esc(data.unit)}</b></div>
    <div class="tzc-kv"><span>Component</span><b>${esc(data.comp)}</b></div>
    <div class="tzc-kv"><span>Issue</span><b style="font-weight:400;text-align:right;max-width:60%">${esc(data.issue)}</b></div>
    <div class="tzc-kv"><span>Work</span><b style="font-weight:400;text-align:right;max-width:60%">${esc(data.work)}</b></div>
    <div class="tzc-kv"><span>Spare used</span><b>${esc(data.spare||'none')}</b></div>
    <div class="tzc-kv"><span>Recorded by</span><b>${esc(me.name)}</b></div>
    <div class="tzc-kv"><span>Sign-off</span><b>${canSignOff()?'<span class="tzc-ok">immediate (full authority)</span>':'<span style="color:var(--tz-gold)">pending supervisor</span>'}</b></div>`; }
  const m = modal(`${stepHdr}${body}
    <div class="acts">
      <button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button>
      ${step>1?`<button class="tzc-btn" id="rwBack">← Back</button>`:''}
      <button class="tzc-btn pri" id="rwNext">${nextLabel}</button>
    </div>`);
  const grab = () => {
    if(step===1){ const s=m.querySelector('#rwUnit'); data.unit = s.value || (s.options[0]&&s.options[0].value); }
    if(step===2){ data.comp = m.querySelector('#rwComp').value; data.issue = m.querySelector('#rwIssue').value.trim(); }
    if(step===3){ data.work = m.querySelector('#rwWork').value.trim(); data.spare = m.querySelector('#rwSpare').value; data.reset = m.querySelector('#rwReset').checked; }
  };
  const back = m.querySelector('#rwBack'); if(back) back.onclick = () => { grab(); replacementWizard(step-1, data); };
  m.querySelector('#rwNext').onclick = () => {
    grab();
    if(step===1 && !data.unit) return;
    if(step===2 && !data.issue){ m.querySelector('#rwIssue').style.borderColor='var(--tz-orange)'; return; }
    if(step===3 && !data.work){ m.querySelector('#rwWork').style.borderColor='var(--tz-orange)'; return; }
    if(step<4){ replacementWizard(step+1, data); return; }
    // commit
    const unit = DB.all('idbms').find(u=>u.serial===data.unit);
    const now = new Date().toISOString();
    DB.insert('maintenance_history', { idbm:data.unit, type:'replacement', component:data.comp,
      issue:data.issue, work:data.work, performed_by:me.id, performed_at:now, spare_serial:data.spare||null,
      signed_off_by: canSignOff()?me.id:null, signed_off_at: canSignOff()?now:null });
    if(data.spare){ const sp = DB.all('spare_pool').find(s=>s.serial===data.spare);
      if(sp) DB.update('spare_pool', sp.id, { status:'deployed', deployed_lane:unit?unit.lane_id:null, last_deployment_date:now }); }
    if(data.reset && unit){ unit.odometer_maintenance = 0; }
    DB.log('maintenance', data.unit, `${data.comp} replaced — ${data.work}${data.spare?' (spare '+data.spare+' from pool)':''}`);
    DB.persist();
    closeModal(); toast('Replacement recorded'+(canSignOff()?' and signed off':' — awaiting supervisor sign-off')); render();
  };
}

/* ---------- INCIDENT PLAYBACK (Screen 41 — training/replay tool) ---------- */
let pbTimer=null, pbT=0, pbSpeed=2, pbLast=0;
const PB_DUR = 26;                      // simulated minutes; 1 sim-min = 1 real-sec at 1×
const PB_SCRIPT = [
  [0,'log',null,'Lane A-L3 running progressive fill — all nominal.'],
  [4,'amber','SN12','SN12 velocity mismatch 2.1% vs SN13 (below warn threshold).'],
  [8,'log',null,'Mismatch rising: 4.2%. Adaptive trends flag the SN12→SN13 pair.'],
  [11,'alarm','SN12','Slip 45 mm measured at handover → WARNING raised.'],
  [13,'hold','A-L3','Supervisor holds lane A-L3 for inspection (audited).'],
  [17,'log',null,'Technician applies +3 mm skew offset; calibration re-test queued.'],
  [21,'clear','SN12','Calibration-square re-test PASS (Δ 1.8 mm).'],
  [23,'release','A-L3','Lane released — flow resumes at full rate.'],
  [26,'log',null,'Alarm acknowledged with note. Incident closed — 26 minutes end to end.']
];
function pbCleanup(){ if(pbTimer){ clearInterval(pbTimer); pbTimer=null; } }
function pbClock(t){ const m = 2+Math.floor(t); return '14:'+String(m).padStart(2,'0'); }
function pbApply(){
  const fired = PB_SCRIPT.filter(e=>e[0]<=pbT);
  const has = (ty,from) => fired.some(e=>e[1]===ty);
  const amber=has('amber'), alarm=has('alarm'), held=has('hold'), cleared=has('clear'), released=has('release');
  document.querySelectorAll('[data-pb]').forEach(c=>{
    c.classList.remove('pbam','pbal','pbhd');
    if(c.dataset.lane==='A-L3' && held && !released) c.classList.add('pbhd');
    if(c.dataset.pb==='SN12'){ if(alarm && !cleared) c.classList.add('pbal'); else if(amber && !cleared) c.classList.add('pbam'); }
  });
  const log = $('#pbLog');
  if(log) log.innerHTML = fired.slice().reverse().map(e=>`<div>[${pbClock(e[0])}] ${esc(e[3])}</div>`).join('');
  const ck = $('#pbClock'); if(ck) ck.textContent = pbClock(pbT);
  const sc = $('#pbScrub'); if(sc && document.activeElement!==sc) sc.value = pbT;
  const pl = $('#pbPlay'); if(pl) pl.textContent = pbTimer ? '⏸ Pause' : (pbT>=PB_DUR?'↺ Replay':'▶ Play');
}
function pbStart(){
  if(pbTimer) return;
  if(pbT>=PB_DUR) pbT = 0;
  pbLast = Date.now();
  pbTimer = setInterval(()=>{ const now=Date.now();
    pbT = Math.min(PB_DUR, pbT + (now-pbLast)/1000*pbSpeed); pbLast=now;
    pbApply();
    if(pbT>=PB_DUR){ pbCleanup(); pbApply(); }
  }, 60);
  pbApply();
}
function pbGrid(){
  const lanes = laneRows(), arrays = {};
  Object.keys(lanes).sort().forEach(lid => (arrays[lid[0]] = arrays[lid[0]] || []).push(lid));
  return Object.keys(arrays).map(a=>`<div class="tzc-array" style="margin-bottom:10px"><h3>Array ${a}</h3>
    ${arrays[a].map(lid=>`<div class="tzc-lane"><span class="lid">${lid}</span>
      ${lanes[lid].map(u=>`<div class="tzw-mini on" data-pb="${u.serial}" data-lane="${lid}">${u.serial}</div>`).join('')}
    </div>`).join('')}</div>`).join('');
}

/* ---------- REPORTS ---------- */
VIEWS.reports = {
  html(me){
    const tab = (location.hash.split('?t=')[1]) || 'throughput';
    const canAudit = DB.can('audit');
    let body = '';
    if(tab==='throughput'){
      const ds = DB.all('daily_stats');
      const W=900,H=220,P=28, bw=(W-P*2)/ds.length;
      const max = Math.max(...ds.map(d=>d.units), ds[0].target)*1.1;
      const bars = ds.map((d,i)=>{
        const h=(d.units/max)*(H-P*2), x=P+i*bw, y=H-P-h;
        const c = d.units>=d.target ? 'var(--tz-green)' : 'var(--tz-cyan)';
        return `<rect x="${(x+1).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw-2.5).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${c}"><title>${d.date}: ${d.units} units</title></rect>`;
      }).join('');
      const ty = H-P-(ds[0].target/max)*(H-P*2);
      const tot = ds.reduce((s,d)=>s+d.units,0);
      const wkdays = ds.filter(d=>{ const g=new Date(d.date+'T12:00:00').getDay(); return g>=1 && g<=5; });
      const met = wkdays.filter(d=>d.units>=d.target).length;
      body = `<div class="tzc-kpis">
        <div class="tzc-kpi"><div class="l">30-day total</div><div class="v">${num(tot)}</div><div class="d">units handled</div></div>
        <div class="tzc-kpi"><div class="l">Daily average</div><div class="v">${num(Math.round(tot/ds.length))}</div><div class="d">target ${num(ds[0].target)}</div></div>
        <div class="tzc-kpi ${met/wkdays.length>=0.6?'ok':'warn'}"><div class="l">Weekdays at target</div><div class="v">${met}/${wkdays.length}</div><div class="d">weekend shifts run reduced</div></div></div>
      <div class="tzc-panel"><h3 style="margin:0 0 10px;font-size:13px;display:flex;align-items:center">Units per day — last 30 days <span class="tzc-pill">green = target met</span>
        <button class="tzc-btn" style="margin-left:auto;padding:4px 10px;font-size:11px" onclick="TZC.exportThroughput()">⬇ Export CSV</button></h3>
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
          <line x1="${P}" y1="${ty}" x2="${W-P}" y2="${ty}" stroke="var(--tz-orange)" stroke-width="1.5" stroke-dasharray="5 4"/>
          <text x="${W-P}" y="${ty-6}" text-anchor="end" font-size="10" fill="var(--tz-orange)">target ${ds[0].target}</text>
          ${bars}</svg></div>`;
    } else if(tab==='audit'){
      if(!canAudit) body = `<div class="tzc-panel"><p style="font-size:13px;margin:0">Your role (<b>${esc(me.role)}</b>) does not include audit-trail access. Ask an admin or supervisor.</p></div>`;
      else {
        let logs = DB.all('operations_log').slice().sort((a,b)=>b.ts.localeCompare(a.ts));
        const total = logs.length;
        const acts = [...new Set(logs.map(l=>l.action))].sort();
        if(auditFlt.op)  logs = logs.filter(l=>l.operator_id===+auditFlt.op);
        if(auditFlt.act) logs = logs.filter(l=>l.action===auditFlt.act);
        logs = logs.slice(0,250);
        const selSt = 'font:inherit;font-size:12px;padding:5px 8px;border:1px solid var(--tz-brd);border-radius:7px;background:var(--tz-panel-solid);color:var(--tz-ink)';
        body = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
          <label style="font-size:10.5px;font-weight:700;color:var(--tz-muted)">FILTER</label>
          <select id="auOp" style="${selSt}"><option value="">All operators</option>
            ${DB.all('employees').map(e=>`<option value="${e.id}" ${auditFlt.op==String(e.id)?'selected':''}>${esc(e.name)}</option>`).join('')}</select>
          <select id="auAct" style="${selSt}"><option value="">All actions</option>
            ${acts.map(a2=>`<option value="${a2}" ${auditFlt.act===a2?'selected':''}>${esc(a2.replace(/_/g,' '))}</option>`).join('')}</select>
          <span style="font-size:11.5px;color:var(--tz-muted)">${logs.length} of ${total}</span>
          <button class="tzc-btn" style="margin-left:auto;padding:5px 11px;font-size:11px" onclick="TZC.exportAudit()">⬇ Export CSV</button></div>
        <div class="tzc-panel" style="padding:6px 10px"><table class="tzc-table">
          <tr><th style="width:120px">When</th><th style="width:150px">Operator</th><th style="width:170px">Action</th><th>Detail</th></tr>
          ${logs.map(l=>`<tr><td class="mono">${fmtDT(l.ts)}</td><td>${esc(empName(l.operator_id))}</td>
            <td>${esc(actionLabel(l.action))} <b>${esc(l.target)}</b></td><td style="color:var(--tz-muted)">${esc(l.detail||'')}</td></tr>`).join('')}
        </table></div>`;
      }
    } else if(tab==='shifts'){
      const sh = DB.all('shift_handovers').slice().sort((a,b)=>b.started_at.localeCompare(a.started_at));
      body = `<div class="tzc-panel" style="padding:6px 10px"><table class="tzc-table">
        <tr><th>Date</th><th>Shift</th><th>Outgoing → Incoming</th><th>Units</th><th>Notes</th></tr>
        ${sh.map(s=>`<tr><td class="mono">${esc(s.date)}</td><td>${esc(s.shift)}</td>
          <td>${esc(empName(s.operator_id))} → ${esc(empName(s.incoming_id))} ${s.confirmed?'<span class="tzc-ok">✓</span>':''}</td>
          <td class="mono">${num(s.units)}</td><td style="color:var(--tz-muted);font-size:12px">${esc(s.notes)}</td></tr>`).join('')}
      </table></div>`;
    }
    else if(tab==='util'){
      const lids = Object.keys(laneRows()).sort();
      const inten = (lid,h) => { // deterministic pseudo activity: day shifts busy, nights quiet
        const seed = [...lid].reduce((s,c)=>s+c.charCodeAt(0),0);
        const day = h>=6&&h<22 ? 1 : 0.25;
        return Math.max(0, Math.min(1, day*(0.35 + 0.45*Math.abs(Math.sin(seed+h*0.7))) - (h>=22||h<5?0.1:0)));
      };
      const cells = lids.map(lid=>`<div style="display:flex;gap:2px;align-items:center;margin-bottom:3px">
        <span style="flex:0 0 44px;font-size:10px;font-weight:800;color:var(--tz-muted)">${lid}</span>
        ${Array.from({length:24},(_,h)=>`<div title="${lid} ${String(h).padStart(2,'0')}:00 — ${(inten(lid,h)*100).toFixed(0)}% occupied" style="flex:1;height:18px;border-radius:3px;background:var(--tz-cyan);opacity:${(0.08+inten(lid,h)*0.9).toFixed(2)}"></div>`).join('')}
      </div>`).join('');
      const avg = lids.map(lid=>({lid, v:Array.from({length:24},(_,h)=>inten(lid,h)).reduce((s,x)=>s+x,0)/24}));
      avg.sort((a,b)=>b.v-a.v);
      const idle = Math.round((1-avg.reduce((s,a)=>s+a.v,0)/avg.length)*100);
      body = `<div class="tzc-kpis">
        <div class="tzc-kpi"><div class="l">Busiest lane</div><div class="v">${avg[0].lid}</div><div class="d">${Math.round(avg[0].v*100)}% avg occupancy</div></div>
        <div class="tzc-kpi"><div class="l">Quietest lane</div><div class="v">${avg[avg.length-1].lid}</div><div class="d">${Math.round(avg[avg.length-1].v*100)}% avg occupancy</div></div>
        <div class="tzc-kpi"><div class="l">Fleet idle time</div><div class="v">${idle}%</div><div class="d">of the 24 h cycle</div></div></div>
        <div class="tzc-panel"><h3 style="margin:0 0 10px;font-size:13px">Occupancy heatmap — lane × hour of day <span class="tzc-pill">darker = busier</span></h3>
        ${cells}
        <div style="display:flex;gap:2px;margin-top:4px"><span style="flex:0 0 44px"></span>
          ${Array.from({length:24},(_,h)=>`<span style="flex:1;font-size:8px;color:var(--tz-muted);text-align:center">${h%4===0?String(h).padStart(2,'0'):''}</span>`).join('')}</div></div>`;
    }
    else if(tab==='trends'){
      const W=900,H=200,P=26;
      const pts = Array.from({length:30},(_,i)=> 7.5 + Math.sin(i*0.5)*1.4 + (i>21?(i-21)*0.55:0) + (i%7===0?0.8:0));
      const max = Math.max(...pts)*1.2;
      const path = pts.map((v,i)=>`${i?'L':'M'}${(P+i*(W-P*2)/29).toFixed(1)} ${(H-P-(v/max)*(H-P*2)).toFixed(1)}`).join(' ');
      const byUnit = {};
      DB.all('alarms').forEach(a=>{ if(a.type==='handover_fault'||a.type==='calibration_drift') byUnit[a.idbm]=(byUnit[a.idbm]||0)+1; });
      const movers = Object.entries(byUnit).sort((a,b)=>b[1]-a[1]).slice(0,3);
      body = `<div class="tzc-grid" style="grid-template-columns:minmax(0,1.6fr) minmax(260px,1fr)">
        <div class="tzc-panel"><h3 style="margin:0 0 10px;font-size:13px">Slip frequency — events per 1,000 transfers, last 30 days</h3>
          <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
            <path d="${path}" fill="none" stroke="var(--tz-cyan)" stroke-width="2"/>
            <line x1="${P}" y1="${H-P-(9.5/max)*(H-P*2)}" x2="${W-P}" y2="${H-P-(9.5/max)*(H-P*2)}" stroke="var(--tz-gold)" stroke-width="1.2" stroke-dasharray="5 4"/>
            <text x="${W-P}" y="${H-P-(9.5/max)*(H-P*2)-6}" text-anchor="end" font-size="10" fill="var(--tz-gold)">watch threshold</text></svg>
          <p style="font-size:11.5px;color:var(--tz-muted);margin:8px 0 0">Trend is rising over the last week — consistent with the recurring SN12 handover events. Tightening the slip-warn threshold (done ${fmtD(DB.all('config_audit_trail').slice(-1)[0]?.at)}) gives operators earlier warning.</p></div>
        <div>
          <div class="tzc-panel" style="margin-bottom:14px"><h3 style="margin:0 0 8px;font-size:13px">Top movers (fault count, 30 d)</h3>
            ${movers.length?movers.map(([sn,n],i)=>`<div class="tzc-kv"><span><b>${esc(sn)}</b></span><b style="color:${i===0?'var(--tz-orange)':'var(--tz-gold)'}">${n} event${n>1?'s':''}</b></div>`).join(''):'<p style="font-size:12px;color:var(--tz-muted)">No recurring faults.</p>'}</div>
          <div class="tzc-panel"><h3 style="margin:0 0 8px;font-size:13px">Recurring fault zone</h3>
            <p style="font-size:12px;line-height:1.6;margin:0">The <b>SN12 → SN13</b> handover on A-L3 clusters ${(byUnit['SN12']||0)+1} events this month. Suggested: schedule a calibration-square re-test at the next planned-idle window.</p>
            <button class="tzc-btn" style="margin-top:10px" onclick="location.hash='#/maintenance'">Open maintenance →</button></div>
        </div></div>`;
    }
    else if(tab==='playback'){
      body = `<div style="border:1.5px solid var(--tz-gold);background:rgba(234,171,0,.08);border-radius:10px;padding:8px 14px;margin-bottom:14px;font-size:11.5px;font-weight:700;color:var(--tz-gold)">DEMO MODE (REPLAY) — recorded incident, not live data</div>
      <div class="tzc-grid" style="grid-template-columns:minmax(0,1.4fr) minmax(280px,1fr)">
        <div class="tzc-panel">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
            <h3 style="margin:0;font-size:13px">Incident replay</h3>
            <select style="font:inherit;font-size:12px;padding:5px 9px;border:1px solid var(--tz-brd);border-radius:7px;background:var(--tz-panel-solid);color:var(--tz-ink)">
              <option>Handover failure — SN12 slip (recorded, 26 min)</option>
              <option disabled>Training: photo-eye obstruction (coming)</option></select></div>
          ${pbGrid()}
          <div style="display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap">
            <button class="tzc-btn pri" id="pbPlay">▶ Play</button>
            ${[1,2,4,8].map(s=>`<button class="tzc-btn pbsp ${s===pbSpeed?'on':''}" data-pbs="${s}" style="padding:5px 10px;font-size:11px">${s}×</button>`).join('')}
            <b id="pbClock" style="margin-left:auto;font-variant-numeric:tabular-nums;font-size:14px">14:02</b></div>
          <input id="pbScrub" type="range" min="0" max="${PB_DUR}" step="0.1" value="0" style="width:100%;margin-top:10px">
        </div>
        <div>
          <div class="tzc-panel" style="margin-bottom:14px"><h3 style="margin:0 0 8px;font-size:13px">Incident notes</h3>
            <p style="font-size:12px;line-height:1.7;margin:0;color:var(--tz-muted)">Severe skew developed on the <b>SN12 → SN13</b> handover (lane A-L3) starting 14:06. Slip crossed the 45 mm line at 14:13 raising a warning; the supervisor held the lane, the technician corrected skew offset, and the re-test passed at 14:23. Total impact: one lane held for 10 minutes, zero product damage. Use ▶ to walk new operators through how the team responded.</p></div>
          <div class="tzc-panel"><h3 style="margin:0 0 8px;font-size:13px">Event log</h3>
            <div class="tzw-console" id="pbLog" style="max-height:300px"><div>[14:02] Press play to begin the replay.</div></div></div>
        </div></div>`;
    }
    else if(tab==='health'){
      const units = DB.all('idbms');
      const alarmed = new Set(DB.openAlarms().map(a=>a.idbm));
      const stale = u => (Date.now() - +new Date(u.last_heartbeat)) > 120000;
      const offline = units.filter(u=>u.status==='offline').length;
      const maint = units.filter(u=>u.status==='maintenance').length;
      const nStale = units.filter(u=>u.status==='online' && stale(u)).length;
      const fw = {}; units.forEach(u=>fw[u.fw]=(fw[u.fw]||0)+1);
      const bv = (DB.all('settings').find(s=>s.key==='__bv')||{}).value||'1';
      const lastSet = DB.all('settings').reduce((m,s)=>Math.max(m, +new Date(s.set_at||0)), 0);
      const groups = {};
      units.forEach(u=>{ const g = u.level || 'Site'; (groups[g]=groups[g]||[]).push(u); });
      const sq = u => `<span class="tzc-hq ${u.status==='offline'?'offl':u.status==='maintenance'?'mtn':(stale(u)?'stale':'')}${alarmed.has(u.serial)?' aq':''}" data-sn="${u.id}" title="${esc(u.serial)} · ${esc(u.lane_id)} · ${esc(u.status)}${alarmed.has(u.serial)?' · OPEN ALARM':''}"></span>`;
      body = `<div class="tzc-kpis">
        <div class="tzc-kpi ${offline?'bad':'ok'}"><div class="l">Unreachable</div><div class="v">${offline}</div><div class="d">no heartbeat</div></div>
        <div class="tzc-kpi ${nStale?'warn':'ok'}"><div class="l">Shadow-stale</div><div class="v">${nStale}</div><div class="d">heartbeat &gt; 2 min</div></div>
        <div class="tzc-kpi ${maint?'warn':'ok'}"><div class="l">In maintenance</div><div class="v">${maint}</div><div class="d">of ${num(units.length)}</div></div>
        <div class="tzc-kpi"><div class="l">Broadcast</div><div class="v">v${esc(bv)}</div><div class="d">${lastSet?fmtDT(lastSet):'—'}</div></div></div>
      <div class="tzc-panel"><h3 style="margin:0 0 8px;font-size:13px">Mesh health — every unit <span class="tzc-pill">click a square</span></h3>
        ${Object.keys(groups).sort().map(g=>`<div style="margin-bottom:8px">
          <div style="font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--tz-muted);font-weight:800;margin-bottom:3px">${esc(g)} · ${groups[g].length}</div>
          <div style="line-height:0">${groups[g].map(sq).join('')}</div></div>`).join('')}
        <p style="font-size:10.5px;color:var(--tz-muted);margin:10px 0 0">Firmware: ${Object.entries(fw).map(([v,n])=>v+' × '+n).join(' · ')} · wire format JSON / schema v${TZ_SEED.VERSION}</p></div>`;
    }
    const T = (id,lbl) => `<span class="t ${tab===id?'on':''}" onclick="location.hash='#/reports?t=${id}'">${lbl}</span>`;
    return `<div class="tzc-crumb">Reports</div><h1 class="tzc-h1">Reports</h1>
      <p class="tzc-sub">Operational reporting, incident replay and the immutable audit trail.</p>
      <div class="tzc-tabs">${T('throughput','Throughput')}${T('util','Lane utilisation')}${T('trends','Adaptive trends')}${T('playback','Incident playback')}${T('health','System health')}${T('shifts','Shift handovers')}${T('audit','Audit trail')}</div>
      ${body}`;
  },
  wire(){
    const play = $('#pbPlay');
    if(play){
      play.onclick = () => { if(pbTimer){ pbCleanup(); pbApply(); } else pbStart(); };
      document.querySelectorAll('[data-pbs]').forEach(b => b.onclick = () => { pbSpeed = +b.dataset.pbs;
        document.querySelectorAll('.pbsp').forEach(x=>x.classList.toggle('on', +x.dataset.pbs===pbSpeed)); });
      const sc = $('#pbScrub'); if(sc) sc.oninput = () => { pbT = +sc.value; pbLast = Date.now(); pbApply(); };
      pbApply();   // restore current playback position after a re-render
    }
    const auOp = $('#auOp'), auAct = $('#auAct');
    if(auOp) auOp.onchange = () => { auditFlt.op = auOp.value; render(); };
    if(auAct) auAct.onchange = () => { auditFlt.act = auAct.value; render(); };
    document.querySelectorAll('.tzc-hq[data-sn]').forEach(q => q.onclick = () => idbmPanel(+q.dataset.sn));
  }
};

/* ---------- STAFF ---------- */
VIEWS.staff = {
  html(){
    const emps = DB.all('employees');
    return `<div class="tzc-crumb">Staff</div>
      <div class="tzc-head"><div><h1 class="tzc-h1">Staff & roles</h1>
      <p class="tzc-sub">${emps.length} demo employees — sample placeholder records showing how profile cards, certifications and sign-off authority work. Drop real photos into <code style="font-size:11px">commissioning/assets/employees/</code> and the cards pick them up.</p></div>
      ${DB.can('operators')?'<div style="padding-bottom:14px"><button class="tzc-btn pri" id="stAddOp">+ Add operator</button></div>':''}</div>
      <div class="tzc-staff">${emps.map(e=>`
        <div class="tzc-card" data-emp="${e.id}">
          <div class="top">${avatar(e,46)}<div><div class="nm">${esc(e.name)}</div><div class="tt">${esc(e.title)}</div></div></div>
          <div><span class="tzc-chip ${e.role}">${e.role}</span> <span class="tzc-pill">${esc(e.department)}</span></div>
          <div class="certs">${e.certifications.slice(0,3).map(c=>`<span class="cert">${esc(c)}</span>`).join('')}</div>
          <div class="ft"><span>sign-off: <b>${esc(e.sign_off_authority)}</b></span><span>${ago(e.last_login)}</span></div>
        </div>`).join('')}</div>`;
  },
  wire(){
    document.querySelectorAll('[data-emp]').forEach(c => c.onclick = () => staffPanel(+c.dataset.emp));
    const add = $('#stAddOp'); if(add) add.onclick = () => addOperatorModal();
  }
};

/* shared: used by the Staff page and the wizard's Operators gate (S10) */
function addOperatorModal(onDone){
  const m = modal(`<h2>Add operator</h2>
    <p style="font-size:11.5px;color:var(--tz-muted)">New accounts sign in with their first name (lowercase) and the demo password. In production this issues an invite with a forced password set.</p>
    <div class="row"><label>Full name</label><input id="opName" placeholder="Jane Citizen"></div>
    <div class="row"><label>Role</label><select id="opRole">${DB.all('roles').map(r=>`<option value="${r.name}">${r.label}</option>`).join('')}</select></div>
    <div class="row"><label>Title</label><input id="opTitle" placeholder="Line Operator — Shift C"></div>
    <div class="row"><label>Department</label><input id="opDept" placeholder="Line Operations"></div>
    <div class="row"><label>Phone</label><input id="opPhone" placeholder="+61 7 5550 10XX"></div>
    <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button><button class="tzc-btn pri" id="opGo">Create account</button></div>`);
  m.querySelector('#opGo').onclick = () => {
    const name = m.querySelector('#opName').value.trim(); if(!name) return;
    const uname = name.split(/\s+/)[0].toLowerCase();
    if(DB.all('employees').find(e=>e.username===uname)){ toast('Username "'+uname+'" already exists.'); return; }
    const role = m.querySelector('#opRole').value;
    DB.insert('employees', { name, username:uname, email:uname+'@tetrisize.local', role,
      title:m.querySelector('#opTitle').value.trim()||DB.all('roles').find(r=>r.name===role).label,
      department:m.querySelector('#opDept').value.trim()||'Line Operations',
      phone:m.querySelector('#opPhone').value.trim()||'', photo:uname+'.jpg', certifications:[],
      training_status:'in_progress', sign_off_authority: role==='admin'||role==='supervisor'?'full':'none',
      is_active:true, password:'password', created_at:new Date().toISOString(), last_login:null });
    DB.log('config_change','Operators', `Created ${role} account for ${name} (${uname}).`);
    closeModal(); toast(name+' added — signs in as "'+uname+'" / password');
    if(onDone) onDone(); else render();
  };
}
function staffPanel(id){
  const e = DB.get('employees', id); if(!e) return;
  const role = DB.all('roles').find(r=>r.name===e.role);
  const PERM_LABELS = {hold_release:'Hold / release lanes',discharge:'Discharge lanes',override:'Routing overrides',soft_stop:'Soft E-stop',ack_alarms:'Acknowledge alarms',maintenance:'Maintenance & spares',settings:'Edit site settings',operators:'Manage operators',audit:'View audit trail',commission:'Run commissioning'};
  const acts = DB.all('operations_log').filter(l=>l.operator_id===id).sort((a,b)=>b.ts.localeCompare(a.ts)).slice(0,6);
  panel(`
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px">${avatar(e,62)}
      <div><h2 style="margin:0;font-size:17px">${esc(e.name)}</h2>
      <div style="font-size:12px;color:var(--tz-muted)">${esc(e.title)} · ${esc(e.department)}</div>
      <div style="margin-top:5px"><span class="tzc-chip ${e.role}">${e.role}</span></div></div></div>
    <div class="tzc-kv"><span>Email</span><b style="font-size:11.5px">${esc(e.email)}</b></div>
    <div class="tzc-kv"><span>Phone</span><b>${esc(e.phone)}</b></div>
    <div class="tzc-kv"><span>Training</span><b>${esc(e.training_status.replace('_',' '))}</b></div>
    <div class="tzc-kv"><span>Sign-off authority</span><b>${esc(e.sign_off_authority)}</b></div>
    <div class="tzc-kv"><span>Last sign-in</span><b>${ago(e.last_login)}</b></div>
    <h3 style="font-size:12px;margin:16px 0 4px;text-transform:uppercase;letter-spacing:.07em;color:var(--tz-muted)">Certifications</h3>
    <div class="certs" style="display:flex;flex-wrap:wrap;gap:4px">${e.certifications.map(c=>`<span class="cert" style="font-size:10px;background:rgba(127,127,127,.12);border-radius:5px;padding:3px 8px;font-weight:700;color:var(--tz-muted)">${esc(c)}</span>`).join('')}</div>
    <h3 style="font-size:12px;margin:16px 0 4px;text-transform:uppercase;letter-spacing:.07em;color:var(--tz-muted)">Role permissions — ${esc(role.label)}</h3>
    ${Object.keys(PERM_LABELS).map(k=>`<div class="tzc-kv"><span>${PERM_LABELS[k]}</span><b>${role.perms[k]?'<span class="tzc-ok">✓</span>':'<span style="color:var(--tz-muted)">—</span>'}</b></div>`).join('')}
    <h3 style="font-size:12px;margin:16px 0 4px;text-transform:uppercase;letter-spacing:.07em;color:var(--tz-muted)">Recent activity</h3>
    ${acts.length ? acts.map(l=>`<div style="font-size:11.5px;padding:6px 0;border-top:1px solid var(--tz-brd)">
      <span style="color:var(--tz-muted)">${fmtDT(l.ts)}</span> — ${esc(actionLabel(l.action))} <b>${esc(l.target)}</b></div>`).join('')
      : '<p style="font-size:12px;color:var(--tz-muted)">No recorded activity.</p>'}
    ${e.id === DB.current().id ? `
      <h3 style="font-size:12px;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.07em;color:var(--tz-muted)">My account</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="tzc-btn" onclick="TZC.changePassword()">Change password…</button>
        <button class="tzc-btn" onclick="TZC.lock()">Lock session now</button>
      </div>
      <p style="font-size:10.5px;color:var(--tz-muted);margin-top:8px">Sessions auto-lock after 5 minutes idle. ⌘K / Ctrl+K opens the command palette.</p>`:''}
    ${DB.can('operators') && e.id !== DB.current().id ? `
      <h3 style="font-size:12px;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.07em;color:var(--tz-muted)">Admin — manage account</h3>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select id="spRole" style="font:inherit;font-size:12px;padding:6px 9px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel-solid);color:var(--tz-ink)">
          ${DB.all('roles').map(r=>`<option value="${r.name}" ${r.name===e.role?'selected':''}>${r.label}</option>`).join('')}</select>
        <button class="tzc-btn" id="spRoleGo">Change role</button>
        <button class="tzc-btn ${e.is_active?'danger':''}" id="spActive">${e.is_active?'Deactivate':'Reactivate'}</button>
      </div>`:''}`);
  if(DB.can('operators') && e.id !== DB.current().id){
    const rg = document.querySelector('#tzcDetail #spRoleGo');
    if(rg) rg.onclick = () => {
      const role = document.querySelector('#tzcDetail #spRole').value;
      if(role === e.role) return;
      DB.update('employees', e.id, { role });
      DB.log('config_change','Operators', `Changed ${e.name}'s role: ${e.role} → ${role}.`);
      toast(e.name+' is now '+role); staffPanel(e.id);
    };
    const av = document.querySelector('#tzcDetail #spActive');
    if(av) av.onclick = () => {
      const wasActive = e.is_active;
      DB.update('employees', e.id, { is_active: !wasActive });
      DB.log('config_change','Operators', `${wasActive?'Deactivated':'Reactivated'} ${e.name}'s account.`);
      toast(e.name+(wasActive?' can no longer sign in':' reactivated')); staffPanel(e.id);
    };
  }
}

/* ======================================================================
   LIVE OPERATIONS (build session 3) — lane state, controls, E-stop, alarm detail
   ====================================================================== */
const laneHeld = lid => DB.all('lane_states').find(s => s.lane_id===lid && s.held) || null;
const laneOcc  = lid => [...lid].reduce((s,c)=>s+c.charCodeAt(0)*7, 0) % 6;        // demo occupancy
function setHeld(lid, held, info){
  let s = DB.all('lane_states').find(x => x.lane_id===lid);
  if(!s) s = DB.insert('lane_states', { lane_id: lid, held:false });
  DB.update('lane_states', s.id, held
    ? { held:true, by:DB.current().id, reason:info.reason, note:info.note||'', since:new Date().toISOString() }
    : { held:false, by:null, reason:null, note:null, since:null });
}

function lanePanel(lid){
  const members = DB.all('idbms').filter(u=>u.lane_id===lid).sort((a,b)=>a.slot-b.slot);
  const hs = laneHeld(lid), occ = laneOcc(lid);
  const acts = DB.all('operations_log').filter(l=>l.target===lid).sort((a,b)=>b.ts.localeCompare(a.ts)).slice(0,5);
  const can = { h:DB.can('hold_release'), d:DB.can('discharge'), o:DB.can('override') };
  panel(`
    <h2 style="margin:0 0 2px;font-size:17px">Lane ${esc(lid)} ${hs?'<span class="tzc-pill" style="background:var(--tz-gold);color:#3b2f00">HELD</span>':''}</h2>
    <p class="tzc-sub" style="margin-bottom:12px">${members.length} modules · ${occ} product${occ===1?'':'s'} in lane</p>
    ${hs?`<div class="tzc-panel" style="padding:10px 12px;margin-bottom:12px;border-color:var(--tz-gold)">
      <b style="font-size:12px">⏸ Held by ${esc(empName(hs.by))}</b> · ${ago(hs.since)}
      <div style="font-size:11.5px;color:var(--tz-muted);margin-top:3px">${esc(hs.reason)}${hs.note?' — '+esc(hs.note):''}</div></div>`:''}
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
      ${can.h && !hs ? `<button class="tzc-btn" onclick="TZC.laneControl('${lid}','hold')">⏸ Hold…</button>`:''}
      ${can.h && hs  ? `<button class="tzc-btn pri" onclick="TZC.laneControl('${lid}','release')">▶ Release…</button>`:''}
      ${can.d ? `<button class="tzc-btn" onclick="TZC.laneControl('${lid}','discharge')">⤓ Discharge…</button>`:''}
      ${can.o ? `<button class="tzc-btn" onclick="TZC.laneControl('${lid}','override')">⇄ Override…</button>`:''}
      ${(!can.h&&!can.d&&!can.o)?'<span style="font-size:11.5px;color:var(--tz-muted)">Your role can monitor this lane but not control it.</span>':''}
    </div>
    <h3 style="font-size:12px;margin:0 0 6px;text-transform:uppercase;letter-spacing:.07em;color:var(--tz-muted)">Members</h3>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px">
      ${members.map(u=>`<button class="tzc-btn" style="padding:4px 9px;font-size:10.5px" onclick="TZC.unit(${u.id})">${u.serial}</button>`).join('')}</div>
    <h3 style="font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.07em;color:var(--tz-muted)">Recent actions on this lane</h3>
    ${acts.length?acts.map(l=>`<div style="font-size:11.5px;padding:6px 0;border-top:1px solid var(--tz-brd)">
      <span style="color:var(--tz-muted)">${fmtDT(l.ts)}</span> — <b>${esc(empName(l.operator_id))}</b> ${esc(actionLabel(l.action))}
      <div style="color:var(--tz-muted)">${esc(l.detail||'')}</div></div>`).join('')
      :'<p style="font-size:12px;color:var(--tz-muted)">No recorded actions.</p>'}`);
}

const HOLD_REASONS = ['Operator inspection','Upstream not ready','Downstream blocked','Maintenance','Other'];
function laneControlModal(lid, tab){
  const me = DB.current(); if(!me) return;
  const TABS = [['hold','Hold','hold_release'],['release','Release','hold_release'],
                ['discharge','Discharge','discharge'],['override','Override','override']]
               .filter(t=>DB.can(t[2]));
  if(!TABS.length){ toast('Your role has no lane-control permissions.'); return; }
  if(!TABS.find(t=>t[0]===tab)) tab = TABS[0][0];
  const site = DB.all('sites')[0], hs = laneHeld(lid), occ = laneOcc(lid);
  const sel = (id,opts) => `<select id="${id}" style="width:100%;font:inherit;font-size:13px;padding:8px 10px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel);color:var(--tz-ink)">${opts.map(o=>`<option>${o}</option>`).join('')}</select>`;
  let body = '';
  if(site.soft_estop){
    body = `<p style="font-size:12.5px;color:var(--tz-orange);font-weight:600">Soft E-stop is active — lane controls are locked until an authorised operator resumes the array.</p>`;
  } else if(tab==='hold'){
    body = hs ? `<p style="font-size:12.5px;color:var(--tz-muted)">Lane ${esc(lid)} is already held (${esc(empName(hs.by))}, ${ago(hs.since)}). Use Release.</p>`
    : `<div class="row"><label>Reason (audited)</label>${sel('lcReason',HOLD_REASONS)}</div>
       <div class="row"><label>Expected duration</label>${sel('lcDur',['5 min','15 min','30 min','Until released'])}</div>
       <div class="row"><label>Note (optional)</label><textarea id="lcNote" rows="2"></textarea></div>
       <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button><button class="tzc-btn pri" id="lcGo">Hold lane</button></div>`;
  } else if(tab==='release'){
    body = !hs ? `<p style="font-size:12.5px;color:var(--tz-muted)">Lane ${esc(lid)} is not held.</p>`
    : `<p style="font-size:12.5px">Held by <b>${esc(empName(hs.by))}</b> ${ago(hs.since)} — ${esc(hs.reason)}</p>
       <div class="row"><label>Release note (optional)</label><textarea id="lcNote" rows="2"></textarea></div>
       <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button><button class="tzc-btn pri" id="lcGo">Release lane</button></div>`;
  } else if(tab==='discharge'){
    body = `<p style="font-size:12.5px;color:var(--tz-muted)">${occ} product${occ===1?'':'s'} currently in lane ${esc(lid)}.</p>
       <div class="row"><label>Discharge to</label>${sel('lcDest',['Outbound conveyor — East','Outbound conveyor — West','Manual pick station'])}</div>
       <div class="row"><label>Sequence</label>${sel('lcSeq',['Front-of-line first','Operator-paced (one at a time)'])}</div>
       <label style="display:flex;gap:8px;font-size:12px;margin:10px 0;cursor:pointer"><input type="checkbox" id="lcOk" style="width:auto"> I confirm the discharge destination is clear and ready.</label>
       <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button><button class="tzc-btn pri" id="lcGo" disabled>Begin discharge</button></div>`;
  } else if(tab==='override'){
    body = `<div class="row"><label>Instruction</label>${sel('lcInstr',['Divert','Hold at entry','Resume','Re-route'])}</div>
       <div class="row"><label>Destination (if divert / re-route)</label>${sel('lcDest',['Lane B (west outbound)','Lane C (east outbound)','Buffer zone'])}</div>
       <div class="row"><label>Time-to-live</label>${sel('lcTtl',['Until cancelled','30 min','This shift'])}</div>
       <div class="row"><label>Justification (required, audited)</label><textarea id="lcJust" rows="2" placeholder="Why is this override needed?"></textarea></div>
       <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button><button class="tzc-btn pri" id="lcGo">Apply override</button></div>`;
  }
  const m = modal(`<h2>Lane ${esc(lid)} — controls</h2>
    <div class="tzc-tabs" style="margin-top:10px">${TABS.map(t=>`<span class="t ${t[0]===tab?'on':''}" onclick="TZC.laneControl('${lid}','${t[0]}')">${t[1]}</span>`).join('')}</div>
    ${body}
    <p style="font-size:10.5px;color:var(--tz-muted);margin:14px 0 0">Operator: ${esc(me.name)} (auto-filled from session) · every action is audited</p>`);
  const go = m.querySelector('#lcGo'); if(!go) return;
  const ok = m.querySelector('#lcOk'); if(ok) ok.onchange = () => go.disabled = !ok.checked;
  go.onclick = () => {
    const v = id => { const e=m.querySelector('#'+id); return e?e.value.trim():''; };
    if(tab==='hold'){ setHeld(lid,true,{reason:v('lcReason'),note:v('lcNote')});
      DB.log('hold_lane', lid, `${v('lcReason')} · expected ${v('lcDur')}${v('lcNote')?' — '+v('lcNote'):''}`); toast('Lane '+lid+' held'); }
    if(tab==='release'){ setHeld(lid,false,{});
      DB.log('release_lane', lid, v('lcNote')||'Released.'); toast('Lane '+lid+' released'); }
    if(tab==='discharge'){ DB.log('discharge', lid, `${occ} products → ${v('lcDest')} · ${v('lcSeq')}`); toast('Discharge of '+lid+' begun'); }
    if(tab==='override'){ if(!v('lcJust')){ m.querySelector('#lcJust').style.borderColor='var(--tz-orange)'; return; }
      DB.log('override', lid, `${v('lcInstr')} → ${v('lcDest')} · TTL ${v('lcTtl')} — ${v('lcJust')}`); toast('Override applied to '+lid); }
    closeModal(); render();
  };
}

function estopModal(){
  if(!DB.can('soft_stop')){ toast('Your role cannot issue a soft E-stop.'); return; }
  const me = DB.current(); const lids = Object.keys(laneRows()).sort();
  const m = modal(`<h2 style="color:var(--tz-orange)">⛔ Soft E-stop</h2>
    <p style="font-size:12px;color:var(--tz-muted)">Brings motion to a controlled stop and locks lane controls. The hardware E-stop remains the primary safety device — this does not replace it.</p>
    <div class="row"><label>Scope</label>
      <label style="display:flex;gap:8px;font-size:12.5px;margin:4px 0;cursor:pointer"><input type="radio" name="esScope" value="whole" checked style="width:auto"> The whole array</label>
      <label style="display:flex;gap:8px;font-size:12.5px;cursor:pointer;align-items:center"><input type="radio" name="esScope" value="lane" style="width:auto"> Selected lane:
        <select id="esLane" style="font:inherit;font-size:12px;padding:4px 8px;border:1px solid var(--tz-brd);border-radius:7px;background:var(--tz-panel);color:var(--tz-ink)">${lids.map(l=>`<option>${l}</option>`).join('')}</select></label></div>
    <div class="row"><label>Reason (audited)</label>
      <select id="esReason" style="width:100%;font:inherit;font-size:13px;padding:8px 10px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel);color:var(--tz-ink)">
        <option>Safety concern</option><option>Equipment damage risk</option><option>Operator request</option><option>Other</option></select></div>
    <div class="row"><label>Type <b style="color:var(--tz-orange)">STOP</b> to confirm</label><input id="esConfirm" autocomplete="off"></div>
    <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button>
      <button class="tzc-btn danger" id="esGo" disabled>Soft E-stop</button></div>`);
  const go = m.querySelector('#esGo'), inp = m.querySelector('#esConfirm');
  inp.addEventListener('input', ()=> go.disabled = inp.value.trim().toUpperCase()!=='STOP');
  go.onclick = () => {
    const scope = m.querySelector('input[name="esScope"]:checked').value==='whole' ? 'whole array' : 'lane '+m.querySelector('#esLane').value;
    const reason = m.querySelector('#esReason').value;
    DB.update('sites', 1, { soft_estop: { by:me.id, at:new Date().toISOString(), reason, scope } });
    DB.log('soft_stop', scope, reason);
    closeModal(); toast('Soft E-stop active — '+scope); render();
  };
}
function estopResume(){
  if(!DB.can('soft_stop')){ toast('Your role cannot resume from a soft E-stop.'); return; }
  const es = DB.all('sites')[0].soft_estop; if(!es) return;
  const m = modal(`<h2>Resume from soft E-stop?</h2>
    <p style="font-size:12.5px;color:var(--tz-muted)">Stopped by <b>${esc(empName(es.by))}</b> ${ago(es.at)} — ${esc(es.reason)} (${esc(es.scope)}).
    Confirm the cause is cleared and the area is safe before resuming motion.</p>
    <div class="row"><label>Resume note (audited)</label><textarea id="esNote" rows="2" placeholder="What was checked / cleared…"></textarea></div>
    <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button>
      <button class="tzc-btn pri" id="esRGo">Resume operations</button></div>`);
  m.querySelector('#esRGo').onclick = () => {
    const note = m.querySelector('#esNote').value.trim();
    if(!note){ m.querySelector('#esNote').style.borderColor='var(--tz-orange)'; return; }
    DB.update('sites', 1, { soft_estop:null });
    DB.log('estop_resume', es.scope, note);
    closeModal(); toast('Operations resumed'); render();
  };
}

const SUGGEST = {
  handover_fault:   ['Inspect the handover pair alignment on the floor','Run a calibration-square test on the lane','Review slip thresholds against the product mix'],
  calibration_drift:['Schedule recalibration at the next planned-idle window','Inspect encoder and sensor-bracket mounting','Compare learned length against neighbour baselines'],
  connection_lost:  ['Check link LEDs and the RJ45 latch at the unit','Confirm mesh re-route is carrying traffic','If persistent, swap the comms module from the spare pool'],
  photo_eye_blocked:['Clear any obstruction in the beam path','Clean the photo-eye lens','Verify alignment with the test square'],
  motor_overcurrent:['Check belt tension and product jam points','Inspect drive for debris','Re-baseline current draw after service'],
  ir_handshake:     ['Clean both IR windows on the pair','Check unit spacing and alignment','Re-flash the transceiver if recurring']
};
function alarmPanel(id){
  const a = DB.get('alarms', id); if(!a) return;
  const chain = (a.event_chain && a.event_chain.length) ? a.event_chain : [{ t:a.created_at, e:'Alarm raised' }];
  const unit = DB.all('idbms').find(u=>u.serial===a.idbm);
  const spark = (()=>{ let p='', x=0; for(let i=0;i<40;i++){ const y=26-(Math.sin(i*0.7)*6+Math.random()*8)-(i>28?8:0); p+=(i?'L':'M')+(x.toFixed(1))+' '+y.toFixed(1)+' '; x+=5.2; } return p; })();
  panel(`
    <h2 style="margin:0 0 4px;font-size:16px"><span class="tzc-sev ${a.severity}">${a.severity}</span> &nbsp;${esc(a.type.replace(/_/g,' '))}</h2>
    <p class="tzc-sub" style="margin-bottom:10px">raised ${fmtDT(a.created_at)} · <b>${esc(a.idbm)}</b> (${esc(a.lane)})</p>
    <p style="font-size:12.5px;line-height:1.6;margin:0 0 12px">${esc(a.message)}</p>
    ${a.clip_name?`<p style="font-size:11px;color:var(--tz-muted);margin:0 0 10px">🎬 Fault clip on file: <b>${esc(a.clip_name)}</b></p>`:''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      ${!a.acknowledged?`<button class="tzc-btn pri" onclick="TZC.ackUI(${a.id})">Acknowledge…</button>`:''}
      <button class="tzc-btn" style="border-color:var(--tz-orange);color:var(--tz-orange)" onclick="TZC.locate('${esc(a.idbm)}', ${a.id})">📍 Locate in 3D</button>
      <button class="tzc-btn" onclick="TZC.faultClip('${esc(a.idbm)}', ${a.id})" title="Records the corridor fly-through as a .webm with a burned-in evidence strip">⏺ Record fault clip</button>
      ${unit?`<button class="tzc-btn" onclick="TZC.unit(${unit.id})">View ${esc(a.idbm)}</button>`:''}
      ${a.lane?`<button class="tzc-btn" onclick="TZC.lane('${esc(a.lane)}')">Lane ${esc(a.lane)}</button>`:''}
    </div>
    <h3 style="font-size:12px;margin:0 0 6px;text-transform:uppercase;letter-spacing:.07em;color:var(--tz-muted)">Telemetry around event</h3>
    <svg viewBox="0 0 210 34" style="width:100%;height:46px;margin-bottom:12px"><path d="${spark}" fill="none" stroke="var(--tz-cyan)" stroke-width="1.6"/><line x1="150" y1="0" x2="150" y2="34" stroke="var(--tz-orange)" stroke-width="1.2" stroke-dasharray="3 3"/></svg>
    <h3 style="font-size:12px;margin:0 0 6px;text-transform:uppercase;letter-spacing:.07em;color:var(--tz-muted)">Event chain</h3>
    <div class="tzc-tl">${chain.map(ev=>`<div class="ev"><span class="dot"></span><div><div style="font-size:10.5px;color:var(--tz-muted);font-variant-numeric:tabular-nums">${fmtDT(ev.t)}</div><div style="font-size:12px">${esc(ev.e)}</div></div></div>`).join('')}
      ${a.acknowledged?`<div class="ev"><span class="dot" style="background:var(--tz-green)"></span><div><div style="font-size:10.5px;color:var(--tz-muted)">${fmtDT(a.acknowledged_at)}</div><div style="font-size:12px"><b>Acknowledged by ${esc(empName(a.acknowledged_by))}</b> — ${esc(a.ack_note||'')}</div></div></div>`:''}</div>
    <h3 style="font-size:12px;margin:14px 0 6px;text-transform:uppercase;letter-spacing:.07em;color:var(--tz-muted)">Suggested actions</h3>
    <ul style="font-size:12px;line-height:1.8;margin:0;padding-left:18px;color:var(--tz-muted)">${(SUGGEST[a.type]||['Investigate at the unit']).map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`);
}
function ackModal(a){
  const m = modal(`<h2>Acknowledge alarm</h2>
    <p style="font-size:12px;color:var(--tz-muted);margin:4px 0 0"><span class="tzc-sev ${a.severity}">${a.severity}</span> &nbsp;${esc(a.message)}</p>
    <div class="row"><label>Resolution note (required, audited)</label>
    <textarea id="ackNote" rows="3" placeholder="What was found, what was done…"></textarea></div>
    <p style="font-size:11px;color:var(--tz-muted)">Recorded as ${esc(DB.current().name)} · ${fmtDT(new Date().toISOString())}</p>
    <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button>
    <button class="tzc-btn pri" id="ackGo">Acknowledge</button></div>`);
  m.querySelector('#ackGo').onclick = () => {
    const note = m.querySelector('#ackNote').value.trim();
    if(!note) { m.querySelector('#ackNote').style.borderColor='var(--tz-orange)'; return; }
    DB.ackAlarm(a.id, note); closeModal(); closePanel(); toast('Alarm acknowledged — logged to audit trail'); render();
  };
}

/* ---------- SETTINGS ---------- */
VIEWS.settings = {
  html(me){
    if(!DB.can('settings')) return `<div class="tzc-crumb">Settings</div><h1 class="tzc-h1">Settings</h1>
      <div class="tzc-panel"><p style="font-size:13px;margin:0">Your role (<b>${esc(me.role)}</b>) does not include settings access.</p></div>`;
    const tab = (location.hash.split('?t=')[1]) || 'site';
    const T = (id,l) => `<span class="t ${tab===id?'on':''}" onclick="location.hash='#/settings?t=${id}'">${l}</span>`;
    const hdr = `<div class="tzc-crumb">Settings</div><h1 class="tzc-h1">Settings</h1>
      <p class="tzc-sub">Site configuration, integrations and demo-data management — every change is audited.</p>
      <div class="tzc-tabs">${T('site','Site settings')}${T('erp','ERP / WMS')}${T('demo','Demo data')}</div>`;
    const sv = (k,d) => { const r = DB.all('settings').find(s=>s.key===k); return r ? r.value : d; };
    let body = '';
    if(tab==='site'){
      const st = DB.all('settings').filter(s=>!String(s.key).startsWith('__') && !String(s.key).startsWith('erp_'));
      const bv = sv('__bv','1');
      const cat = DB.all('config_audit_trail').slice().sort((a,b)=>b.at.localeCompare(a.at)).slice(0,12);
      body = `<div class="tzc-panel" style="max-width:680px">
          <h3 style="margin:0 0 10px;font-size:13px">Site settings <span class="tzc-pill">broadcast v${esc(bv)}</span></h3>
          ${st.map(s=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <label style="flex:1;font-size:12px;font-weight:600">${esc(s.label||s.key)}</label>
            <input data-cfg="${esc(s.key)}" value="${esc(s.value)}" style="width:170px;font:inherit;font-size:12.5px;padding:6px 9px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel-solid);color:var(--tz-ink)"></div>`).join('')}
          <div style="margin-top:12px"><label style="display:block;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--tz-muted);margin-bottom:5px">Reason for change (required, audited)</label>
          <textarea id="cfgReason" rows="2" style="width:100%;font:inherit;font-size:12.5px;padding:8px 10px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel-solid);color:var(--tz-ink)" placeholder="Why are these values changing…"></textarea></div>
          <button class="tzc-btn pri" id="cfgSave" style="margin-top:10px">Save & broadcast to 45 IDBMs</button>
          <p style="font-size:11px;margin-top:10px"><a href="commissioning_tuning.html" style="color:var(--tz-accent)">⚙ Live engine tuning panel →</a> <span style="color:var(--tz-muted)">real-time simulation variables (car speeds, latches, arrival cadence) applied live to the running Viewer/Brain.</span></p>
          <h3 style="margin:18px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--tz-muted)">Configuration change history</h3>
          ${cat.map(c=>`<div style="font-size:11.5px;padding:6px 0;border-top:1px solid var(--tz-brd)">
            <b>${esc(c.key)}</b>: ${esc(String(c.old))} → <b>${esc(String(c.new))}</b>
            <div style="color:var(--tz-muted)">${fmtDT(c.at)} · ${esc(empName(c.by))} — ${esc(c.reason)}</div></div>`).join('')}
        </div>`;
    } else if(tab==='erp'){
      const MAPS = [['erp_map_order','order#','order_id',1],['erp_map_sku','sku','sku_code',1],
                    ['erp_map_batch','batch','lot_number',0],['erp_map_pallet','pallet','pallet_type',0]];
      body = `<div class="tzc-grid" style="grid-template-columns:minmax(300px,1.1fr) minmax(260px,1fr);max-width:980px">
        <div class="tzc-panel">
          <h3 style="margin:0 0 6px;font-size:13px">ERP / WMS integration <span class="tzc-pill">${sv('erp_endpoint','')?'configured':'not configured'}</span></h3>
          <p style="font-size:11.5px;color:var(--tz-muted);margin:0 0 14px">Where product identity comes from. These settings live on this supervisory only — they are not broadcast to the mesh. Customer data never leaves site.</p>
          <div class="row" style="margin-bottom:10px"><label style="display:block;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--tz-muted);margin-bottom:5px">Identity-source method</label>
            <select id="erpMethod" style="width:100%;font:inherit;font-size:12.5px;padding:8px 10px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel-solid);color:var(--tz-ink)">
              ${['Query on receive','Upstream-attached','None (manual entry)'].map(o=>`<option ${sv('erp_method','Query on receive')===o?'selected':''}>${o}</option>`).join('')}</select></div>
          <div class="row" style="margin-bottom:10px"><label style="display:block;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--tz-muted);margin-bottom:5px">Endpoint URL</label>
            <input id="erpUrl" value="${esc(sv('erp_endpoint',''))}" placeholder="https://wms.customer.example/api/v2/items" style="width:100%;font:inherit;font-size:12.5px;padding:8px 10px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel-solid);color:var(--tz-ink)"></div>
          <div style="display:flex;gap:10px;margin-bottom:10px">
            <div style="flex:1"><label style="display:block;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--tz-muted);margin-bottom:5px">Auth</label>
              <select id="erpAuth" style="width:100%;font:inherit;font-size:12.5px;padding:8px 10px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel-solid);color:var(--tz-ink)">
                ${['Bearer token','Basic auth','mTLS certificate'].map(o=>`<option ${sv('erp_auth','Bearer token')===o?'selected':''}>${o}</option>`).join('')}</select></div>
            <div style="flex:1"><label style="display:block;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--tz-muted);margin-bottom:5px">Token / secret</label>
              <input id="erpToken" type="password" value="${esc(sv('erp_token',''))}" placeholder="••••••••••••" style="width:100%;font:inherit;font-size:12.5px;padding:8px 10px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel-solid);color:var(--tz-ink)"></div></div>
          <div style="display:flex;gap:10px;align-items:center">
            <button class="tzc-btn" id="erpTest">Test connection</button>
            <span id="erpStatus" style="font-size:12px;color:var(--tz-muted)">${sv('erp_endpoint','')?'untested this session':'configure an endpoint first'}</span>
            <button class="tzc-btn pri" id="erpSave" style="margin-left:auto">Save integration settings</button></div>
        </div>
        <div class="tzc-panel">
          <h3 style="margin:0 0 8px;font-size:13px">Schema mapping</h3>
          <table class="tzc-table"><tr><th>IDBM field</th><th>WMS field</th><th>Req</th></tr>
            ${MAPS.map(([k,idbm,def,req])=>`<tr><td><b>${idbm}</b></td>
              <td><input data-erpmap="${k}" value="${esc(sv(k,def))}" style="width:120px;font:inherit;font-size:11.5px;padding:4px 7px;border:1px solid var(--tz-brd);border-radius:6px;background:var(--tz-panel-solid);color:var(--tz-ink)"></td>
              <td>${req?'<span class="tzc-ok">✓</span>':'<span style="color:var(--tz-muted)">—</span>'}</td></tr>`).join('')}</table>
          <h3 style="margin:14px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--tz-muted)">Pallet-type catalogue</h3>
          <div style="display:flex;flex-wrap:wrap;gap:5px">
            ${['CHEP 1200×1000','CHEP 1200×800','Custom 1100×1100'].map(p=>`<span class="tzc-pill" style="font-size:10px;padding:4px 9px">${p}</span>`).join('')}</div>
          <p style="font-size:10.5px;color:var(--tz-muted);margin-top:12px">In production this validates each inbound pallet's identity against the WMS at the in-feed photo-eye; the cross-validation thresholds in Site settings decide warn/fault behaviour.</p>
        </div></div>`;
    } else {
      body = `<div class="tzc-panel" style="max-width:560px">
          <h3 style="margin:0 0 8px;font-size:13px">Demo data</h3>
          <p style="font-size:11.5px;color:var(--tz-muted);margin:0 0 12px">For customer demos: regenerate the lived-in dataset, or wipe to a blank un-commissioned site so a new client never sees another client's run. Export/import moves a dataset between machines.</p>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            <button class="tzc-btn" id="stReset">↻ Small site (45 IDBMs, lived-in)</button>
            <button class="tzc-btn" id="stLarge">⛁ Large site (1,856 IDBMs from layout import)</button>
            <button class="tzc-btn danger" id="stBlank">⌫ Blank slate (new customer)</button>
            <button class="tzc-btn" id="stExport">⬇ Export JSON</button>
            <button class="tzc-btn" id="stImport">⬆ Import JSON</button>
            <input id="stFile" type="file" accept="application/json" style="display:none">
          </div>
        </div>`;
    }
    return hdr + body;
  },
  wire(){
    const el = id => $('#'+id);
    const save = el('cfgSave');
    if(save) save.onclick = () => {
      const reason = el('cfgReason').value.trim();
      const changes = [];
      document.querySelectorAll('[data-cfg]').forEach(inp => {
        const row = DB.all('settings').find(s=>s.key===inp.dataset.cfg);
        if(row && String(row.value) !== String(inp.value.trim())) changes.push([row, inp.value.trim()]);
      });
      if(!changes.length){ toast('No changes to broadcast.'); return; }
      if(!reason){ el('cfgReason').style.borderColor='var(--tz-orange)'; toast('A change reason is required.'); return; }
      const me = DB.current(), now = new Date().toISOString();
      changes.forEach(([row, val]) => {
        DB.insert('config_audit_trail', { site_id:1, key:row.key, old:row.value, new:val, by:me.id, at:now, reason });
        DB.update('settings', row.id, { value:val, set_by:me.id, set_at:now });
      });
      let bv = DB.all('settings').find(s=>s.key==='__bv');
      if(!bv) bv = DB.insert('settings', { site_id:1, key:'__bv', label:'__bv', value:'1', set_by:me.id, set_at:now });
      DB.update('settings', bv.id, { value:String((+bv.value||1)+1) });
      DB.log('config_change','Site settings', changes.map(([r,v])=>`${r.key}: ${r.value}→${v}`).join(', ')+' — '+reason);
      toast(`Broadcast v${bv.value} issued — ${changes.length} setting${changes.length>1?'s':''} updated, 45/45 acknowledged`); render();
    };
    const test = el('erpTest');
    if(test) test.onclick = () => {
      const url = el('erpUrl').value.trim(), st = el('erpStatus');
      if(!url){ st.textContent='configure an endpoint first'; st.style.color='var(--tz-orange)'; return; }
      st.textContent='testing…'; st.style.color='var(--tz-cyan)';
      setTimeout(()=>{ st.textContent='ok · '+(90+Math.floor(Math.random()*120))+' ms · schema v2 detected';
        st.style.color='var(--tz-green)'; }, 700);
    };
    const esave = el('erpSave');
    if(esave) esave.onclick = () => {
      const me = DB.current(), now = new Date().toISOString();
      const vals = { erp_method:['Identity-source method', el('erpMethod').value],
        erp_endpoint:['ERP endpoint', el('erpUrl').value.trim()],
        erp_auth:['ERP auth method', el('erpAuth').value],
        erp_token:['ERP token', el('erpToken').value] };
      document.querySelectorAll('[data-erpmap]').forEach(i => vals[i.dataset.erpmap] = ['Mapping '+i.dataset.erpmap.replace('erp_map_',''), i.value.trim()]);
      let changed = 0;
      Object.entries(vals).forEach(([k,[label,val]]) => {
        const row = DB.all('settings').find(s=>s.key===k);
        if(!row){ DB.insert('settings', { site_id:1, key:k, label, value:val, set_by:me.id, set_at:now }); changed++; }
        else if(String(row.value)!==String(val)){
          DB.insert('config_audit_trail', { site_id:1, key:k, old:(k==='erp_token'?'••••':row.value), new:(k==='erp_token'?'••••':val), by:me.id, at:now, reason:'ERP/WMS integration settings update.' });
          DB.update('settings', row.id, { value:val, set_by:me.id, set_at:now }); changed++;
        }
      });
      if(!changed){ toast('No integration changes.'); return; }
      DB.log('config_change','ERP / WMS', `Integration settings saved (${changed} value${changed>1?'s':''}). Supervisory-local, not broadcast.`);
      toast('Integration settings saved'); render();
    };
    if(!el('stReset')) return;
    el('stLarge').onclick = () => {
      toast('Importing layout…');
      fetch('commissioning/data/site_layout.json').then(r=>r.json()).then(j=>{
        const D = TZ_SEED.generateLarge(j);
        DB.importJSON(JSON.stringify(D));
        bigSel = { level:null, zone:null };
        toast('Large site loaded — '+D.idbms.length.toLocaleString()+' IDBMs across 3 levels + crane beds');
        go('home'); render();
      }).catch(e=>toast('Layout import failed: '+e.message));
    };
    el('stReset').onclick = () => { const m=modal(`<h2>Regenerate demo data?</h2><p style="font-size:12.5px;color:var(--tz-muted)">Replaces everything with a fresh lived-in dataset (staff, 45 IDBMs, history). You stay signed in.</p>
      <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button><button class="tzc-btn pri" id="ok">Regenerate</button></div>`);
      m.querySelector('#ok').onclick=()=>{ DB.resetDemo(false); closeModal(); toast('Demo data regenerated'); render(); }; };
    el('stBlank').onclick = () => { const m=modal(`<h2>Blank slate?</h2><p style="font-size:12.5px;color:var(--tz-muted)">Wipes all operational history and marks the site <b>not commissioned</b> — the state you'd start a real customer demo from. Staff accounts are kept.</p>
      <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button><button class="tzc-btn danger" id="ok">Wipe to blank</button></div>`);
      m.querySelector('#ok').onclick=()=>{ DB.resetDemo(true); closeModal(); toast('Blank site ready — go to Commissioning to begin'); render(); }; };
    el('stExport').onclick = () => { const a=document.createElement('a');
      a.href=URL.createObjectURL(new Blob([DB.exportJSON()],{type:'application/json'}));
      a.download='tetrisize-commissioning-data.json'; a.click(); toast('Dataset exported'); };
    el('stImport').onclick = () => el('stFile').click();
    el('stFile').onchange = e => { const f=e.target.files[0]; if(!f) return;
      f.text().then(t=>{ try{ DB.importJSON(t); toast('Dataset imported'); render(); }catch(err){ toast('Import failed: '+err.message); } }); };
  }
};

/* ---------- HELP ---------- */
VIEWS.help = {
  html(){
    return `<div class="tzc-crumb">Help</div><h1 class="tzc-h1">Help</h1>
      <p class="tzc-sub">Quick orientation for the commissioning supervisory.</p>
      <div class="tzc-grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
        <div class="tzc-panel"><h3 style="margin:0 0 8px;font-size:13px">Getting around</h3>
          <p style="font-size:12.5px;color:var(--tz-muted);line-height:1.7;margin:0"><b>Home</b> is the live array — click any module for its detail card.
          <b>Alarms</b> shows what needs attention; acknowledging always asks for a note. <b>Commissioning</b> holds the site's commissioning record and (session 2) the guided wizard.
          <b>Reports → Audit trail</b> is the immutable log of every action.</p></div>
        <div class="tzc-panel"><h3 style="margin:0 0 8px;font-size:13px">Roles</h3>
          <p style="font-size:12.5px;color:var(--tz-muted);line-height:1.7;margin:0"><span class="tzc-chip admin">admin</span> full control, settings, operators ·
          <span class="tzc-chip supervisor">supervisor</span> lane control, overrides, sign-offs ·
          <span class="tzc-chip technician">technician</span> maintenance & calibration ·
          <span class="tzc-chip operator">operator</span> monitoring & alarm acknowledgment. Sign in as different demo staff to feel the difference.</p></div>
        <div class="tzc-panel"><h3 style="margin:0 0 8px;font-size:13px">Demos</h3>
          <p style="font-size:12.5px;color:var(--tz-muted);line-height:1.7;margin:0">Before a client session, an admin uses <b>Settings → Demo data</b>: <i>Blank slate</i> for a fresh un-commissioned site, or <i>Regenerate</i> for the lived-in showcase. Data lives entirely in this browser (localStorage) — nothing leaves the machine.</p></div>
        <div class="tzc-panel"><h3 style="margin:0 0 8px;font-size:13px">Shortcuts & security</h3>
          <div class="tzc-kv"><span>Command palette</span><b>⌘K / Ctrl+K</b></div>
          <div class="tzc-kv"><span>Close panel / modal</span><b>Esc</b></div>
          <div class="tzc-kv"><span>Idle session lock</span><b>after 5 min (password to unlock)</b></div>
          <div class="tzc-kv"><span>Theme</span><b>day / night via ☾ in the menu bar</b></div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="tzc-btn" onclick="TZC.about()">About this software…</button>
            <button class="tzc-btn" onclick="TZC.palette()">Open command palette</button></div></div>
      </div>`;
  }
};

/* ======================================================================
   SESSION 5 — idle lock, command palette, CSV export, about, my account
   ====================================================================== */

/* ---- CSV export ---- */
function downloadCSV(name, rows){
  const csv = rows.map(r=>r.map(v=>{ v=String(v==null?'':v);
    return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }).join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=name; a.click();
  toast('Exported '+name);
}
function exportAlarmsCSV(){
  const rows=[['id','severity','type','idbm','lane','message','raised','acknowledged_by','acknowledged_at','note']];
  DB.all('alarms').forEach(a=>rows.push([a.id,a.severity,a.type,a.idbm,a.lane,a.message,a.created_at,
    a.acknowledged?empName(a.acknowledged_by):'',a.acknowledged_at||'',a.ack_note||'']));
  downloadCSV('alarms.csv', rows);
}
function exportAuditCSV(){
  const rows=[['id','timestamp','operator','action','target','detail']];
  DB.all('operations_log').slice().sort((a,b)=>b.ts.localeCompare(a.ts))
    .forEach(l=>rows.push([l.id,l.ts,empName(l.operator_id),l.action,l.target,l.detail||'']));
  downloadCSV('audit-trail.csv', rows);
}
function exportThroughputCSV(){
  const rows=[['date','units','target']];
  DB.all('daily_stats').forEach(d=>rows.push([d.date,d.units,d.target]));
  downloadCSV('throughput.csv', rows);
}

/* ---- idle session lock (Screen 44 fidelity) ---- */
const LOCK_AFTER_MS = 5*60*1000;
let lastActivity = Date.now();
['pointerdown','keydown','wheel'].forEach(ev =>
  window.addEventListener(ev, ()=>{ lastActivity = Date.now(); }, {passive:true}));
function lockSession(){
  const me = DB.current(); if(!me || $('#tzcLock')) return;
  try{ sessionStorage.setItem('tzc-locked','1'); }catch(e){}
  const d = document.createElement('div'); d.id='tzcLock';
  d.innerHTML = `<div class="box">
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px">${avatar(me,64)}
      <div style="text-align:center"><b style="font-size:15px">${esc(me.name)}</b>
      <div style="font-size:11.5px;color:var(--tz-muted)">Session locked after ${LOCK_AFTER_MS/60000} min idle</div></div></div>
    <input id="lkPass" type="password" placeholder="Password to unlock" autocomplete="current-password">
    <div class="err" id="lkErr"></div>
    <button class="tzc-btn pri" id="lkGo" style="width:100%">Unlock</button>
    <div style="display:flex;justify-content:center;gap:16px;margin-top:12px;font-size:11.5px">
      <a href="javascript:void 0" id="lkSwitch" style="color:var(--tz-accent)">Switch operator</a>
      <a href="javascript:void 0" id="lkOut" style="color:var(--tz-muted)">Sign out as ${esc(me.name.split(' ')[0])}</a></div></div>`;
  document.body.appendChild(d);
  const unlock = () => {
    if(d.querySelector('#lkPass').value !== me.password){ d.querySelector('#lkErr').textContent='Wrong password.'; return; }
    try{ sessionStorage.removeItem('tzc-locked'); }catch(e){}
    lastActivity = Date.now(); d.remove();
  };
  d.querySelector('#lkGo').onclick = unlock;
  d.querySelector('#lkPass').addEventListener('keydown', e=>{ if(e.key==='Enter') unlock(); });
  d.querySelector('#lkPass').focus();
  const out = () => { try{ sessionStorage.removeItem('tzc-locked'); }catch(e){} d.remove(); DB.logout(); go('home'); render(); };
  d.querySelector('#lkSwitch').onclick = out;
  d.querySelector('#lkOut').onclick = out;
}
setInterval(()=>{ if(DB.current() && !$('#tzcLock') && Date.now()-lastActivity > LOCK_AFTER_MS) lockSession(); }, 10000);

/* ---- command palette (Cmd/Ctrl+K, Screen 48 fidelity) ---- */
function paletteItems(){
  const items = [];
  NAV.filter(n=>!n.perm || DB.can(n.perm)).forEach(n =>
    items.push({ g:'Navigate', label:n.label, hint:'#/'+n.r, run:()=>go(n.r) }));
  Object.keys(laneRows()).sort().forEach(lid =>
    items.push({ g:'Lanes', label:'Lane '+lid, hint:'detail & controls', run:()=>{ go('home'); setTimeout(()=>lanePanel(lid),50); } }));
  DB.all('idbms').forEach(u =>
    items.push({ g:'IDBMs', label:u.serial, hint:u.lane_id+' slot '+u.slot+' · '+u.status, run:()=>{ go('home'); setTimeout(()=>idbmPanel(u.id),50); } }));
  DB.all('employees').filter(e=>e.is_active).forEach(e =>
    items.push({ g:'Staff', label:e.name, hint:e.title, run:()=>{ go('staff'); setTimeout(()=>staffPanel(e.id),50); } }));
  items.push({ g:'Actions', label:'Shift handover…', hint:'hand this shift to the next operator', run:()=>{ go('home'); setTimeout(handoverModal,50); } });
  if(DB.can('soft_stop')) items.push({ g:'Actions', label:'Soft E-stop…', hint:'controlled stop, type STOP to confirm', run:()=>{ go('home'); setTimeout(estopModal,50); } });
  if(DB.can('maintenance')) items.push({ g:'Actions', label:'Record component replacement…', hint:'4-step maintenance wizard', run:()=>replacementWizard(1,{}) });
  if(DB.can('settings')) items.push({ g:'Actions', label:'Reset demo data…', hint:'Settings → Demo data', run:()=>go('settings') });
  items.push({ g:'Actions', label:'3D Fault Locator', hint:'fly the corridor route to any unit (1,820-IDBM site)', run:()=>TZC.locate(null) });
  items.push({ g:'Actions', label:'3D Locator — WebGL beta', hint:'instanced rendering, real lighting, true depth buffer', run:()=>TZGL.open(null) });
  if(DB.can('settings')) items.push({ g:'Actions', label:'Simulate mesh loss', hint:'demo the connection-lost overlay & recovery', run:()=>{ go('home'); setTimeout(()=>TZL.simulateLoss(), 80); } });
  return items;
}
function openPalette(){
  if(!DB.current()) return;
  const items = paletteItems();
  let sel = 0, shown = [];
  const m = modal(`<div style="display:flex;align-items:center;gap:9px">
      <input id="palQ" placeholder="Type to search screens, lanes, IDBMs, staff, actions…" autocomplete="off"
        style="flex:1;font:inherit;font-size:14px;padding:10px 12px;border:1px solid var(--tz-brd);border-radius:9px;background:var(--tz-panel);color:var(--tz-ink)">
      <span class="tzc-pill">⌘K</span></div>
    <div id="palList" style="margin-top:10px;max-height:46vh;overflow-y:auto"></div>`);
  const q = m.querySelector('#palQ'), list = m.querySelector('#palList');
  function draw(){
    const needle = q.value.trim().toLowerCase();
    shown = items.filter(i => !needle || (i.label+' '+i.g+' '+i.hint).toLowerCase().includes(needle)).slice(0, 14);
    sel = Math.min(sel, Math.max(0, shown.length-1));
    let lastG = '';
    list.innerHTML = shown.map((i,ix)=>{
      const gh = i.g!==lastG ? `<div style="font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--tz-muted);font-weight:800;margin:8px 2px 3px">${i.g}</div>` : '';
      lastG = i.g;
      return gh+`<div class="tzc-palrow ${ix===sel?'on':''}" data-ix="${ix}">
        <b style="font-size:12.5px">${esc(i.label)}</b><span style="font-size:10.5px;color:var(--tz-muted);margin-left:auto">${esc(i.hint)}</span></div>`;
    }).join('') || '<div style="font-size:12px;color:var(--tz-muted);padding:14px 4px">No matches.</div>';
    list.querySelectorAll('.tzc-palrow').forEach(r => r.onclick = () => { closeModal(); shown[+r.dataset.ix].run(); });
  }
  q.addEventListener('input', ()=>{ sel=0; draw(); });
  q.addEventListener('keydown', e=>{
    if(e.key==='ArrowDown'){ sel=Math.min(sel+1, shown.length-1); draw(); e.preventDefault(); }
    if(e.key==='ArrowUp'){ sel=Math.max(sel-1, 0); draw(); e.preventDefault(); }
    if(e.key==='Enter' && shown[sel]){ closeModal(); shown[sel].run(); }
  });
  draw(); q.focus();
}
document.addEventListener('keydown', e=>{
  if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); openPalette(); }
});

/* ---- about / diagnostics modal (Screen 39 fidelity) ---- */
function aboutModal(){
  const site = DB.all('sites')[0];
  const units = DB.all('idbms');
  const fw = {}; units.forEach(u=>fw[u.fw]=(fw[u.fw]||0)+1);
  const online = units.filter(u=>u.status==='online').length;
  modal(`<h2>About — Tetrisize Commissioning</h2>
    <div class="tzc-kv"><span>Application</span><b>v0.5 · build S5 · schema seed v${TZ_SEED.VERSION}</b></div>
    <div class="tzc-kv"><span>Site</span><b>${esc(site.name)} — ${esc(site.customer)}</b></div>
    <div class="tzc-kv"><span>Commissioned</span><b>${fmtD(site.commissioned_date)}</b></div>
    <div class="tzc-kv"><span>Mesh</span><b>${online}/${units.length} IDBMs online</b></div>
    <div class="tzc-kv"><span>Firmware</span><b>${Object.entries(fw).map(([v,n])=>v+' × '+n).join(' · ')}</b></div>
    <div class="tzc-kv"><span>Licence</span><b>Demo — sample dataset, placeholder staff</b></div>
    <div class="tzc-kv"><span>Data store</span><b>localStorage (this browser only)</b></div>
    <div class="tzc-kv"><span>Support</span><b>support@tetrisize.com.au</b></div>
    <div class="acts"><button class="tzc-btn pri" onclick="TZC.closeModal()">Close</button></div>`);
}

/* ---- change password (my account) ---- */
function changePasswordModal(){
  const me = DB.current(); if(!me) return;
  const m = modal(`<h2>Change password</h2>
    <div class="row"><label>Current password</label><input id="cpOld" type="password"></div>
    <div class="row"><label>New password (min 6 chars)</label><input id="cpNew" type="password"></div>
    <div class="err" id="cpErr" style="color:var(--tz-orange);font-size:12px;min-height:16px"></div>
    <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button>
      <button class="tzc-btn pri" id="cpGo">Change password</button></div>`);
  m.querySelector('#cpGo').onclick = () => {
    const oldP = m.querySelector('#cpOld').value, newP = m.querySelector('#cpNew').value;
    if(oldP !== me.password){ m.querySelector('#cpErr').textContent='Current password is wrong.'; return; }
    if(newP.length < 6){ m.querySelector('#cpErr').textContent='New password too short.'; return; }
    DB.update('employees', me.id, { password:newP });
    DB.log('config_change','My account','Password changed.');
    closeModal(); toast('Password changed');
  };
}

/* ---------- boot ---------- */
function logout(){ DB.logout(); go('home'); render(); }
function myCard(){ const me=DB.current(); if(me) staffPanel(me.id); }
window.TZC = { closeModal, closePanel, logout, myCard, modal, toast, rerender: render,
  laneControl: laneControlModal, lane: lanePanel, unit: idbmPanel,
  ackUI: id => ackModal(DB.get("alarms", id)), estopResume, thresholds: thresholdModal,
  lock: lockSession, palette: openPalette, about: aboutModal, changePassword: changePasswordModal,
  exportAlarms: exportAlarmsCSV, exportAudit: exportAuditCSV, exportThroughput: exportThroughputCSV,
  locate: (ref, alarmId) => { const a = alarmId ? DB.get('alarms', alarmId) : null;
    closePanel(); TZLOC.open(ref, a ? a.severity.toUpperCase()+' — '+a.message : null); },
  faultClip: (ref, alarmId) => { const a = alarmId ? DB.get('alarms', alarmId) : null;
    closePanel(); TZLOC.open(ref, a ? a.severity.toUpperCase()+' — '+a.message : null, { autoClip:{ alarmId } }); },
  addOperator: addOperatorModal, spareReady, spareRepair };
window.addEventListener('hashchange', render);
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeModal(); closePanel(); } });
render();
})();
