/* ============================================================================
   TETRISIZE COMMISSIONING — 7-gate wizard (build session 2)
   A guided, resumable commissioning run: every gate persists its result to
   commissioning_checks + the audit trail the moment it passes, so an installer
   can save & exit mid-run and pick up where they left off. Strict order —
   power is verified before the pilot run, sign-off only after every gate.
   Set window.TZW_FAST=1 (console) to speed all animations ~8× for demos/tests.
   ========================================================================== */
window.TZW = (function(){
'use strict';
const DB = window.TZDB;
const $  = s => document.querySelector(s);
const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nowIso = () => new Date().toISOString();
const SPD = () => window.TZW_FAST ? 0.12 : 1;

let timers = [];
const T = (fn,ms) => { const h=setTimeout(fn, ms*SPD()); timers.push(h); return h; };
const I = (fn,ms) => { const h=setInterval(fn, Math.max(16,ms*SPD())); timers.push(h); return h; };
function cleanup(){ timers.forEach(h=>{ clearTimeout(h); clearInterval(h); }); timers=[]; }

/* S10 fidelity pass: 10 gates — restores the original renders' Site Identity,
   Operators (Screen 05) and Component Baseline (Screen 06) steps alongside
   the safety gates this build added. */
const GATES = [
  { key:'site_identity',      name:'Site Identity',          short:'Identity'   },
  { key:'topology_discovery', name:'Topology Discovery',     short:'Topology'   },
  { key:'spatial_mapping',    name:'Spatial Mapping (Zero-Key)', short:'Mapping' },
  { key:'calibration',        name:'Calibration',            short:'Calibration'},
  { key:'power_verify',       name:'Power & Electrical',     short:'Power'      },
  { key:'network_verify',     name:'Network & Mesh',         short:'Network'    },
  { key:'roles_confirm',      name:'Operators & Roles',      short:'Roles'      },
  { key:'baseline',           name:'Component Baseline',     short:'Baseline'   },
  { key:'first_run',          name:'First Run (Pilot)',      short:'Pilot'      },
  { key:'configuration',      name:'Configuration Broadcast',short:'Config'     },
  { key:'handoff',            name:'Customer Sign-off',      short:'Sign-off'   }
];

const activeRun = () => DB.all('commissioning_runs').find(r=>r.status==='in_progress');
const lastPassed = () => DB.all('commissioning_runs').filter(r=>r.status==='passed').slice(-1)[0] || null;
function W(run){ run.wizard = run.wizard || { gate:1 }; return run.wizard; }
function persist(run){ DB.update('commissioning_runs', run.id, { wizard: run.wizard }); }
function lanes(){ const m={}; DB.all('idbms').forEach(u=>(m[u.lane_id]=m[u.lane_id]||[]).push(u));
  Object.values(m).forEach(a=>a.sort((x,y)=>x.slot-y.slot)); return m; }

/* ---------- start / abort ---------- */
const TYPE_INFO = [
  ['new_install','New Install','Setting up everything from scratch — full discovery, calibration and verification.'],
  ['reused_mesh','Reused IDBMs','Connecting previously configured IDBMs. Discovery will rehydrate their held state.'],
  ['firmware_only','Firmware-Only Site','Local deployment, no cloud sync. Same gates, broadcast stays on-premises.']
];
function begin(){
  if(!DB.can('commission')){ TZC.toast('Your role cannot start a commissioning run.'); return; }
  const site = DB.all('sites')[0];
  if(site.status !== 'active' && !lastPassed()){     // Screen 45: recovery / fresh-install decision
    const n = DB.all('idbms').length;
    const m = TZC.modal(`
      <h2>No site configuration found</h2>
      <p style="font-size:12.5px;color:var(--tz-muted)">This supervisory has no commissioning record — but the network shows an existing IDBM mesh: <b>${n} IDBMs reachable</b>.</p>
      <div class="tzw-type" style="border:1.5px solid var(--tz-green);border-radius:10px;padding:12px 14px;margin-top:10px">
        <b style="font-size:13px">Rehydrate from mesh <span class="tzc-pill" style="background:var(--tz-green);color:#fff">recommended</span></b>
        <p style="font-size:11.5px;color:var(--tz-muted);margin:4px 0 8px">Discover existing IDBMs and pull their held state — reconstructs the site configuration without factory downtime.</p>
        <button class="tzc-btn pri" id="wRehydrate">⟳ Rehydrate</button></div>
      <div class="tzw-type" style="border:1.5px solid var(--tz-brd);border-radius:10px;padding:12px 14px;margin-top:10px">
        <b style="font-size:13px">Commission new site</b>
        <p style="font-size:11.5px;color:var(--tz-muted);margin:4px 0 8px">Run the standard ten-gate wizard from scratch. Use for a brand-new factory.</p>
        <button class="tzc-btn" id="wCommNew">Commission…</button></div>
      <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button></div>`);
    m.querySelector('#wCommNew').onclick = () => { TZC.closeModal(); typeChooser(); };
    m.querySelector('#wRehydrate').onclick = () => {
      const b = m.querySelector('#wRehydrate'); b.disabled = true; b.textContent = 'Pulling held state…';
      setTimeout(()=>{
        const now = nowIso();
        DB.all('idbms').forEach(u=>{ u.status='online'; u.last_heartbeat=now; u.commissioned_date=u.commissioned_date||now; });
        DB.update('sites', site.id, { status:'active', commissioned_date: site.commissioned_date || now });
        const run = DB.insert('commissioning_runs', { site_id:1, started_by:DB.current().id,
          started_at:now, completed_at:now, status:'passed', installation_type:'reused_mesh',
          total_idbms_found:DB.all('idbms').length, customer_rep:'— (rehydrated)',
          notes:'Rehydrated from mesh: all units reported their held configuration; supervisory state reconstructed without downtime.' });
        DB.insert('commissioning_checks', { run_id:run.id, key:'rehydrate', name:'Mesh Rehydration',
          status:'passed', checked_by:DB.current().id, checked_at:now, seq:1,
          notes:DB.all('idbms').length+'/'+DB.all('idbms').length+' units reported held configuration (topology, calibration, learned lengths). Supervisory state rebuilt.' });
        DB.log('commission_signoff','Central Site 01','Site rehydrated from existing mesh — no commissioning downtime.');
        DB.persist(); TZC.closeModal(); TZC.toast('🎉 Site rehydrated — '+DB.all('idbms').length+' IDBMs online'); TZC.rerender();
      }, 1400*SPD());
    };
    return;
  }
  typeChooser();
}
function typeChooser(){
  const recommission = !!lastPassed();
  const m = TZC.modal(`
    <h2>How are we starting?</h2>
    <p style="font-size:12px;color:var(--tz-muted);margin:4px 0 0">${recommission
      ? '<b style="color:var(--tz-gold)">Re-commission:</b> this site already has a passed run on record. A new run re-verifies every gate and issues a fresh settings broadcast.'
      : 'Pick the option that matches this installation.'}</p>
    ${TYPE_INFO.map(([v,t,d],i)=>`
      <label class="tzw-type" style="display:flex;gap:11px;align-items:flex-start;border:1.5px solid var(--tz-brd);border-radius:10px;padding:11px 13px;margin-top:10px;cursor:pointer">
        <input type="radio" name="wType" value="${v}" ${i===0?'checked':''} style="margin-top:3px;width:auto">
        <span><b style="font-size:13px">${t}</b><br><span style="font-size:11.5px;color:var(--tz-muted)">${d}</span></span>
      </label>`).join('')}
    <details style="margin-top:12px"><summary style="font-size:11.5px;font-weight:700;color:var(--tz-accent);cursor:pointer">Why this matters</summary>
      <p style="font-size:11.5px;color:var(--tz-muted);line-height:1.65;margin:8px 0 0"><b>New Install</b> runs every gate from scratch — discovery, calibration, electrical, the lot.
      <b>Reused IDBMs</b> trusts each unit's held calibration and learned lengths, which shortens the calibration gate but still re-verifies safety.
      <b>Firmware-Only</b> keeps everything on-premises: broadcasts, reports and audit stay local with no cloud sync. Your choice changes which downstream steps can be fast-tracked — it never skips a safety gate.</p></details>
    <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Cancel</button>
    <button class="tzc-btn pri" id="wStart">Start commissioning</button></div>`);
  m.querySelector('#wStart').onclick = () => {
    const type = m.querySelector('input[name="wType"]:checked').value;
    const run = DB.insert('commissioning_runs', { site_id:1, started_by:DB.current().id,
      started_at:nowIso(), status:'in_progress', installation_type:type, notes:'', wizard:{gate:1} });
    DB.log('commission_start','Central Site 01',`Commissioning run #${run.id} started (${type.replace(/_/g,' ')}).`);
    TZC.closeModal(); TZC.toast('Commissioning run started — Gate 1: Topology Discovery');
    location.hash='#/commission'; TZC.rerender();
  };
}
function abort(){
  const run = activeRun(); if(!run) return;
  const m = TZC.modal(`<h2>Abort this run?</h2>
    <p style="font-size:12.5px;color:var(--tz-muted)">Gates already passed stay on the audit trail. The run is marked <b>aborted</b> and the site remains un-commissioned until a new run completes.</p>
    <div class="acts"><button class="tzc-btn" onclick="TZC.closeModal()">Keep going</button>
    <button class="tzc-btn danger" id="wAbort">Abort run</button></div>`);
  m.querySelector('#wAbort').onclick = () => {
    DB.update('commissioning_runs', run.id, { status:'aborted', completed_at:nowIso() });
    DB.log('commission_abort','Central Site 01',`Run #${run.id} aborted at gate ${W(run).gate} (${GATES[W(run).gate-1].name}).`);
    TZC.closeModal(); TZC.toast('Run aborted'); TZC.rerender();
  };
}

/* ---------- gate completion ---------- */
function passGate(run, idx, notes){
  const g = GATES[idx];
  DB.insert('commissioning_checks', { run_id:run.id, key:g.key, name:g.name, status:'passed',
    checked_by:DB.current().id, checked_at:nowIso(), notes, seq:idx+1 });
  DB.log('gate_passed', g.name, notes);
  W(run).gate = idx+2; persist(run);
  TZC.toast(`Gate ${idx+1} passed — ${g.name}`);
  TZC.rerender();
}

/* ---------- shell ---------- */
function html(){
  const run = activeRun();
  W(run).gate = Math.min(W(run).gate, GATES.length);   // guard runs persisted by older gate rosters
  const gate = W(run).gate;
  const steps = GATES.map((g,i)=>{ const n=i+1;
    const cls = n<gate ? 'done' : (n===gate ? 'cur' : '');
    return `<div class="tzw-step ${cls}"><div class="dot">${n<gate?'✓':n}</div><span>${g.short}</span></div>`;
  }).join('<div class="tzw-link"></div>');
  return `
    <div class="tzc-crumb">Commissioning · run in progress</div>
    <div class="tzc-head"><h1 class="tzc-h1">Gate ${gate}: ${GATES[gate-1].name}</h1>
      <div style="display:flex;gap:8px">
        <button class="tzc-btn" onclick="location.hash='#/home'">Save & exit</button>
        <button class="tzc-btn danger" onclick="TZW.abort()">Abort run</button>
      </div></div>
    <div class="tzw-steps">${steps}</div>
    <div id="tzwBody"></div>`;
}
function wire(){
  const run = activeRun();
  GATE_RENDER[Math.min(W(run).gate, GATES.length)-1](run, $('#tzwBody'));
}

/* ======================================================================
   GATE 1 — Site Identity (S10, from original Screen 08's identity block)
   ====================================================================== */
const FIELD = (id,label,val,ph) => `<div style="margin-bottom:10px">
  <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--tz-muted);margin-bottom:5px">${label}</label>
  <input id="${id}" value="${esc(val||'')}" placeholder="${ph||''}" style="width:100%;font:inherit;font-size:13px;padding:8px 10px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel-solid);color:var(--tz-ink)"></div>`;
function gSite(run, el){
  const site = DB.all('sites')[0];
  const TZS = ['Australia/Brisbane','Australia/Sydney','Australia/Melbourne','Australia/Adelaide','Australia/Perth','Pacific/Auckland','UTC'];
  el.innerHTML = `<div class="tzc-panel" style="max-width:620px">
    <h3 style="margin:0 0 4px;font-size:13px">Who and where is this site?</h3>
    <p style="font-size:11.5px;color:var(--tz-muted);margin:0 0 14px">Everything downstream carries this identity — the settings broadcast, every report, and the commissioning certificate the customer signs.</p>
    ${FIELD('wsName','Site name', site.name, 'Central Site 01')}
    ${FIELD('wsCust','Customer', site.customer, 'Company Pty Ltd')}
    ${FIELD('wsLoc','Location', site.location, 'City, State')}
    <div style="display:flex;gap:10px">
      <div style="flex:1"><label style="display:block;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--tz-muted);margin-bottom:5px">Timezone</label>
        <select id="wsTz" style="width:100%;font:inherit;font-size:13px;padding:8px 10px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel-solid);color:var(--tz-ink)">
          ${TZS.map(t=>`<option ${t===site.timezone?'selected':''}>${t}</option>`).join('')}</select></div>
      <div style="flex:1"><label style="display:block;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--tz-muted);margin-bottom:5px">Units</label>
        <select id="wsUnits" style="width:100%;font:inherit;font-size:13px;padding:8px 10px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel-solid);color:var(--tz-ink)">
          <option>Metric (mm)</option><option>Imperial (in)</option></select></div></div>
    <h3 style="margin:16px 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--tz-muted)">System network</h3>
    <p style="font-size:11px;color:var(--tz-muted);margin:0 0 8px">The secured Wi-Fi every IDBM joins. The supervisory broadcasts these credentials to the mesh during commissioning.</p>
    <div style="display:flex;gap:10px">
      <div style="flex:1">${FIELD('wsSsid','Mesh Wi-Fi SSID', (DB.all('settings').find(s=>s.key==='wifi_ssid')||{}).value||'', 'TZ-MESH-01')}</div>
      <div style="flex:1"><label style="display:block;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--tz-muted);margin-bottom:5px">Wi-Fi password</label>
        <input id="wsWpass" type="password" placeholder="••••••••" style="width:100%;font:inherit;font-size:13px;padding:8px 10px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel-solid);color:var(--tz-ink)"></div></div>
    <button class="tzc-btn pri" id="wsGo" style="margin-top:14px">Confirm site identity →</button></div>`;
  $('#wsGo').onclick = () => {
    const v = id => $('#'+id).value.trim();
    if(!v('wsName') || !v('wsCust')){ ['wsName','wsCust'].forEach(id=>{ if(!v(id)) $('#'+id).style.borderColor='var(--tz-orange)'; }); return; }
    DB.update('sites', site.id, { name:v('wsName'), customer:v('wsCust'), location:v('wsLoc'),
      timezone:$('#wsTz').value, units:$('#wsUnits').value });
    // mesh Wi-Fi credentials (broadcast to units during commissioning)
    [['wifi_ssid','Mesh Wi-Fi SSID', v('wsSsid')], ['wifi_pass','Mesh Wi-Fi password', $('#wsWpass').value]]
      .forEach(([k,label,val])=>{ if(!val) return;
        const row = DB.all('settings').find(s=>s.key===k);
        if(row) DB.update('settings', row.id, { value:val, set_by:DB.current().id, set_at:nowIso() });
        else DB.insert('settings', { site_id:1, key:k, label, value:val, set_by:DB.current().id, set_at:nowIso() }); });
    passGate(run, 0, `Site identity confirmed: ${v('wsName')} — ${v('wsCust')}, ${v('wsLoc')} (${$('#wsTz').value}, ${$('#wsUnits').value}).${v('wsSsid')?' Mesh Wi-Fi “'+v('wsSsid')+'” configured (password withheld from log).':''}`);
  };
}

/* ======================================================================
   GATE 6 — Operators & Roles checkpoint (S10, original Screen 05)
   ====================================================================== */
function gRoles(run, el){
  const emps = DB.all('employees').filter(e=>e.is_active);
  const n = r => emps.filter(e=>e.role===r).length;
  const ok = n('admin')>=1 && n('supervisor')>=1;
  const REQ = [['admin','At least one Admin (settings, operators, sign-off)',1,true],
               ['supervisor','At least one Supervisor (lane control, E-stop, sign-offs)',1,true],
               ['technician','A Technician for maintenance (recommended)',1,false]];
  el.innerHTML = `<div class="tzc-grid" style="grid-template-columns:minmax(0,1.3fr) minmax(280px,1fr)">
    <div class="tzc-panel">
      <h3 style="margin:0 0 4px;font-size:13px">Who operates this site?</h3>
      <p style="font-size:11.5px;color:var(--tz-muted);margin:0 0 10px">Confirm the people and tiers before anything moves. Access here is structural — if a role can't do it, the button doesn't exist.</p>
      <table class="tzc-table"><tr><th>Name</th><th>Role</th><th>Sign-off</th></tr>
        ${emps.map(e=>`<tr><td><b>${esc(e.name)}</b><br><span style="font-size:10.5px;color:var(--tz-muted)">${esc(e.title)}</span></td>
          <td><span class="tzc-chip ${e.role}">${e.role}</span></td><td style="font-size:11.5px">${esc(e.sign_off_authority)}</td></tr>`).join('')}</table>
      <button class="tzc-btn" id="wrAdd" style="margin-top:10px">+ Add operator…</button>
    </div>
    <div class="tzc-panel">
      <h3 style="margin:0 0 8px;font-size:13px">Checkpoint</h3>
      ${REQ.map(([r,label,min,hard])=>{ const met=n(r)>=min;
        return `<div style="display:flex;gap:9px;font-size:12px;padding:7px 0;border-top:1px solid var(--tz-brd)">
          <span style="font-weight:800;color:${met?'var(--tz-green)':(hard?'var(--tz-orange)':'var(--tz-gold)')}">${met?'✓':(hard?'✗':'!')}</span>
          <span>${label} <b>(${n(r)})</b></span></div>`;}).join('')}
      <button class="tzc-btn pri" id="wrGo" style="margin-top:14px;width:100%" ${ok?'':'disabled'}>Confirm operators →</button>
      ${ok?'':'<p style="font-size:11px;color:var(--tz-orange);margin-top:8px">Add the missing roles before continuing.</p>'}
    </div></div>`;
  $('#wrAdd').onclick = () => TZC.addOperator(()=>TZC.rerender());
  $('#wrGo').onclick = () => passGate(run, 6,
    `${emps.length} active operators confirmed (${n('admin')} admin, ${n('supervisor')} supervisor, ${n('technician')} technician, ${n('operator')} operator). RBAC matrix in force; sign-off tiers verified.`);
}

/* ======================================================================
   GATE 7 — Component Baseline (S10, original Screen 06 "Mode control")
   ====================================================================== */
const BASE_COMPONENTS = ['Belts','Drive motors','Rollers','Photo-eyes','Wiring','Lubrication','Chassis'];
function gBaseline(run, el){
  const st = W(run).gBase = W(run).gBase || {};
  const today = new Date().toISOString().slice(0,10);
  const N = DB.all('idbms').length;
  el.innerHTML = `<div class="tzc-panel" style="max-width:720px">
    <h3 style="margin:0 0 4px;font-size:13px">When was each component installed?</h3>
    <p style="font-size:11.5px;color:var(--tz-muted);margin:0 0 12px">This seeds the maintenance baseline — service-due forecasting measures wear from these dates. Bulk-apply for a new install; choose per-IDBM for mixed/reused hardware (recorded at each unit's first service).</p>
    <table class="tzc-table"><tr><th>Component</th><th>Mode</th><th>Install date</th></tr>
      ${BASE_COMPONENTS.map((c,i)=>`<tr>
        <td><b>${c}</b></td>
        <td><select data-bmode="${i}" style="font:inherit;font-size:12px;padding:5px 8px;border:1px solid var(--tz-brd);border-radius:7px;background:var(--tz-panel-solid);color:var(--tz-ink)">
          <option value="bulk">Bulk — all ${N} IDBMs</option><option value="per">Per-IDBM (record at first service)</option></select></td>
        <td><input data-bdate="${i}" type="date" value="${today}" style="font:inherit;font-size:12px;padding:5px 8px;border:1px solid var(--tz-brd);border-radius:7px;background:var(--tz-panel-solid);color:var(--tz-ink)"></td></tr>`).join('')}
    </table>
    <button class="tzc-btn pri" id="wbGo" style="margin-top:14px">Apply baseline to all ${N} IDBMs →</button></div>`;
  el.querySelectorAll('[data-bmode]').forEach(s => s.onchange = () => {
    el.querySelector(`[data-bdate="${s.dataset.bmode}"]`).disabled = s.value==='per'; });
  $('#wbGo').onclick = () => {
    const baseline = {}; const perList = [];
    BASE_COMPONENTS.forEach((c,i)=>{
      const mode = el.querySelector(`[data-bmode="${i}"]`).value;
      baseline[c] = mode==='per' ? 'per-unit' : el.querySelector(`[data-bdate="${i}"]`).value;
      if(mode==='per') perList.push(c);
    });
    DB.all('idbms').forEach(u => { u.baseline = baseline; });
    DB.persist();
    passGate(run, 7, `Maintenance baseline applied to ${N} IDBMs: `+
      BASE_COMPONENTS.filter(c=>baseline[c]!=='per-unit').map(c=>c+' '+baseline[c]).join(', ')+
      (perList.length?`. ${perList.join(', ')} to be recorded per-IDBM at first service.`:'.')+
      ' Service-due forecasting measures from these dates.');
  };
}

/* ======================================================================
   GATE 3 — Spatial Mapping (Zero-Key anchors & beacons)
   The guided survey from the Quick Start Guide: the software names a unit
   and an end, the installer fits the antenna mount, seats the beacon and
   presses SET; two points lock the first unit's position AND orientation,
   then the task list walks reference points that triangulate every zone.
   Adjacency (gate 2) + these reference dimensions = true X/Y/Z for all.
   ====================================================================== */
function mapTasks(){
  const ln = lanes(), lids = Object.keys(ln).sort();
  const t = [], seen = new Set();
  const add = (u, end) => { if(!u) return;
    t.push({ id:u.id, sn:u.serial, lane:u.lane_id, end,
      x:+((u.x||0)+(end==='A'?-0.58:0.58)).toFixed(2), y:+(u.y||0).toFixed(2), z:+((u.z||0)+0.11).toFixed(2) });
    seen.add(u.id); };
  const first = ln[lids[0]][0];
  add(first,'A'); add(first,'B');                       // first unit: both ends → position + orientation
  const groups = [...new Set(lids.map(l=>l[0]))];        // one far reference per array/zone group
  groups.forEach(g=>{
    const gl = lids.filter(l=>l[0]===g);
    const lastLane = ln[gl[gl.length-1]], lu = lastLane[lastLane.length-1];
    if(!seen.has(lu.id)) add(lu,'B');
    const fl = ln[gl[0]], fu = fl[fl.length-1];
    if(!seen.has(fu.id)) add(fu,'B');
  });
  return t.slice(0,8);
}
function gMap(run, el){
  const st = W(run).gMap = W(run).gMap || { locked:[], complete:false };
  const tasks = mapTasks();
  const cur = tasks.findIndex((_,i)=>!st.locked.includes(i));
  const ln = lanes(), lids = Object.keys(ln).sort();
  const curTask = cur>=0 ? tasks[cur] : null;
  const grid = lids.map(lid=>`<div class="tzc-lane"><span class="lid">${lid}</span>
    ${ln[lid].map(u=>{ const isCur = curTask && u.id===curTask.id;
      const done = tasks.some((t2,i)=>t2.id===u.id && st.locked.includes(i));
      return `<div class="tzw-mini ${done?'on':''}" style="${isCur?'background:var(--tz-orange);color:#fff;animation:tzcPulse 1.2s infinite':''}">${u.serial}${isCur?' '+curTask.end:''}</div>`;}).join('')}
  </div>`).join('');
  el.innerHTML = `
    <div class="tzc-grid" style="grid-template-columns:minmax(280px,1fr) minmax(0,1.2fr)">
      <div class="tzc-panel">
        <h3 style="margin:0 0 4px;font-size:13px">Reference points <span class="tzc-pill">${st.locked.length} of ${tasks.length} locked</span></h3>
        <div class="tzw-prog" style="margin-bottom:10px"><div style="width:${(st.locked.length/tasks.length*100).toFixed(0)}%"></div></div>
        ${tasks.map((t2,i)=>{ const done=st.locked.includes(i), now=i===cur;
          return `<div style="display:flex;gap:9px;align-items:center;padding:6px 0;border-top:1px solid var(--tz-brd);${now?'':done?'':'opacity:.45'}">
            <span style="font-weight:800;color:${done?'var(--tz-green)':now?'var(--tz-orange)':'var(--tz-muted)'}">${done?'✓':now?'▶':'○'}</span>
            <span style="font-size:12px"><b>${esc(t2.sn)}</b> — End ${t2.end} <span style="color:var(--tz-muted)">· ${esc(t2.lane)}</span>
            ${done?`<br><span style="font-size:10.5px;color:var(--tz-muted);font-variant-numeric:tabular-nums">locked X ${t2.x} · Y ${t2.y} · Z ${t2.z} m</span>`:''}</span></div>`;}).join('')}
      </div>
      <div class="tzc-panel">
        ${st.complete ? `
          <h3 style="margin:0 0 8px;font-size:13px"><span class="tzc-ok">✓</span> Spatial map complete</h3>
          <p style="font-size:12.5px;line-height:1.7">${DB.all('idbms').length} IDBMs locked into true factory space from ${tasks.length} reference points + the adjacency map. Maximum solve residual <b>3.8 mm</b>. Every unit now carries true X / Y / Z coordinates, level and zone — this drives the 3D fault locator, fly-throughs and drone waypoints.</p>
          <p style="font-size:11.5px;color:var(--tz-muted);line-height:1.6">Mobile-device antennas (crane cars, shuttles) are registered against this anchor map and will self-align continuously. The hand-held survey beacons can go back in the kit.</p>
          <button class="tzc-btn pri" id="wmGo" style="margin-top:10px">Confirm spatial map →</button>`
        : cur>=0 ? `
          <h3 style="margin:0 0 4px;font-size:13px">Go to <span style="color:var(--tz-orange)">${esc(curTask.sn)} — End ${curTask.end}</span></h3>
          <p style="font-size:12px;color:var(--tz-muted);margin:0 0 10px">1 · Clip the antenna mount onto <b>End ${curTask.end}</b> of ${esc(curTask.sn)} (${esc(curTask.lane)}) &nbsp; 2 · Seat the Zero-Key beacon &nbsp; 3 · Hold steady and press SET</p>
          <div style="margin-bottom:12px">${grid}</div>
          <div style="display:flex;align-items:center;gap:14px">
            <button class="tzc-btn pri" id="wmSet" style="font-size:15px;padding:12px 34px;letter-spacing:.08em">SET</button>
            <span id="wmStatus" style="font-size:12px;color:var(--tz-muted)">Coordinates to lock: X ${curTask.x} · Y ${curTask.y} · Z ${curTask.z} m</span></div>`
        : `
          <h3 style="margin:0 0 8px;font-size:13px">All points captured</h3>
          <p style="font-size:12.5px;color:var(--tz-muted)">Solve the spatial map to lock every IDBM into true factory coordinates.</p>
          <button class="tzc-btn pri" id="wmSolve">Solve spatial map</button>`}
      </div>
    </div>`;
  const set = $('#wmSet');
  if(set) set.onclick = () => {
    set.disabled = true; set.textContent = 'RANGING…';
    $('#wmStatus').textContent = 'Ranging beacon against fixed anchors…';
    T(()=>{ st.locked.push(cur); persist(run);
      TZC.toast('✓ '+curTask.sn+' End '+curTask.end+' locked'); gMap(run, el); }, 1100);
  };
  const sol = $('#wmSolve');
  if(sol) sol.onclick = () => {
    sol.disabled = true; sol.textContent = 'Solving…';
    T(()=>{ st.complete = true; persist(run); gMap(run, el);
      TZC.toast('Spatial map solved — residual 3.8 mm'); }, 1300);
  };
  const go = $('#wmGo');
  if(go) go.onclick = () => passGate(run, 2,
    `Zero-Key survey complete: ${tasks.length} reference points locked (first unit both ends for orientation, far corners per zone). Spatial solve residual 3.8 mm — all ${DB.all('idbms').length} IDBMs locked into true factory X/Y/Z. Mobile-device antennas registered for continuous self-alignment against the anchor map.`);
}

/* ======================================================================
   GATE 2 — Topology Discovery
   ====================================================================== */
function g1(run, el){
  const units = DB.all('idbms');
  const st = W(run).g1 = W(run).g1 || {};
  const ln = lanes();
  const grid = Object.keys(ln).sort().map(lid=>`<div class="tzc-lane"><span class="lid">${lid}</span>
    ${ln[lid].map(u=>`<div class="tzw-mini" id="tzwU${u.id}">${u.serial}</div>`).join('')}</div>`).join('');
  el.innerHTML = `
    <div class="tzc-grid" style="grid-template-columns:minmax(0,1.15fr) minmax(280px,1fr)">
      <div class="tzc-panel">
        <h3 style="margin:0 0 4px;font-size:13px">Power up the IDBMs, then start discovery</h3>
        <p style="font-size:11.5px;color:var(--tz-muted);margin:0 0 12px">Each unit announces itself on the mesh, links to its neighbours and reports its lane position. Watch the map fill in — anything that fails to report shows as a gap.</p>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <button class="tzc-btn pri" id="wDisc">⟳ Start discovery</button>
          <b id="wCount" style="font-size:13px;font-variant-numeric:tabular-nums">${st.done?units.length:0} of ${units.length} reporting</b>
        </div>
        ${grid}
      </div>
      <div>
        <div class="tzc-panel" style="margin-bottom:12px"><h3 style="margin:0 0 8px;font-size:13px">Discovery log</h3>
          <div class="tzw-console" id="wLog">${st.done?'<div>— previous discovery complete: 45/45 —</div>':''}</div></div>
        <div class="tzc-panel" id="wAnom" style="display:${st.done?'block':'none'}">
          <h3 style="margin:0 0 8px;font-size:13px">Anomaly summary</h3>
          <div style="font-size:12px;line-height:1.6" id="wAnomBody"></div>
          <button class="tzc-btn pri" id="wApprove" style="margin-top:12px;width:100%">Approve layout — 45 IDBMs, 3 arrays</button>
        </div>
      </div>
    </div>`;
  function showAnoms(){
    const old = units.filter(u=>u.fw!=='1.4.2');
    $('#wAnomBody').innerHTML = `
      <div>✅ 45 of 45 units reporting · 9 lanes formed · neighbour links verified</div>
      ${old.length?`<div style="color:var(--tz-gold);font-weight:600">⚠ ${old.length} unit${old.length>1?'s':''} on firmware 1.4.0 (${old.map(u=>u.serial).join(', ')}) — staged for update at Gate 4.</div>`:''}
      <div>✅ No length mismatches · no duplicate serials</div>`;
    $('#wAnom').style.display='block';
    $('#wApprove').onclick = () => passGate(run, 1,
      `45 IDBMs discovered across 3 arrays (9 lanes). Neighbour links verified, no duplicates.${old.length?' '+old.length+' unit(s) on fw 1.4.0 flagged for Gate 4.':''}`);
  }
  if(st.done){ units.forEach(u=>{ const c=$('#tzwU'+u.id); if(c) c.classList.add('on'); }); showAnoms(); }
  $('#wDisc').onclick = () => {
    $('#wDisc').disabled = true;
    const order = units.map(u=>u.id).sort(()=>Math.random()-0.5);
    const logEl = $('#wLog'); logEl.innerHTML='';
    // time-based reveal: immune to browser interval throttling (backgrounded tabs, iPads)
    let n = 0; const t0=Date.now(), per=160*SPD();
    const h = I(()=>{
      const want = Math.min(order.length, Math.floor((Date.now()-t0)/per));
      while(n<want){
        const u = DB.get('idbms', order[n]); n++;
        u.status='online'; u.last_heartbeat = nowIso();
        const c = $('#tzwU'+u.id); if(c) c.classList.add('on');
        const ev = n%7===0 ? 'TOPOLOGY_REPORTED' : (n%3===0 ? 'NEIGHBOUR_LINKED' : 'HELLO');
        logEl.insertAdjacentHTML('afterbegin', `<div>[${new Date().toLocaleTimeString('en-AU',{hour12:false})}] ${u.serial}: ${ev} · ${u.lane_id} slot ${u.slot}</div>`);
        $('#wCount').textContent = `${n} of ${order.length} reporting`;
      }
      if(n>=order.length){
        clearInterval(h);
        st.done = true; persist(run);            // single save also persists the 45 status flips
        logEl.insertAdjacentHTML('afterbegin','<div style="color:var(--tz-green);font-weight:700">— discovery complete: 45/45 —</div>');
        showAnoms();
      }
    }, 320);
  };
}

/* ======================================================================
   GATE 2 — Calibration (per-lane calibration-square test)
   ====================================================================== */
function g2(run, el){
  const st = W(run).g2 = W(run).g2 || { results:{}, attempts:{} };
  const lids = Object.keys(lanes()).sort();
  const FAIL_LANE = lids[4];                                  // first attempt on this lane fails → demonstrates re-test
  function row(lid){
    const r = st.results[lid];
    return `<tr id="wCal${lid.replace(/\W/g,'')}">
      <td><b>${lid}</b></td>
      <td class="mono">${r ? r.t.toFixed(1)+' s' : '—'}</td>
      <td class="mono">${r ? r.delta.toFixed(1)+' mm' : '—'}</td>
      <td>${r ? (r.pass ? '<span class="tzc-ok">PASS</span>' : '<b style="color:var(--tz-orange)">FAIL</b>') : '<span style="color:var(--tz-muted)">pending</span>'}</td>
      <td><button class="tzc-btn" data-cal="${lid}" style="padding:4px 10px;font-size:11px">${r&&!r.pass?'Re-test':'Run test'}</button></td></tr>`;
  }
  el.innerHTML = `
    <div class="tzc-panel">
      <h3 style="margin:0 0 4px;font-size:13px">Calibration-square test, every lane</h3>
      <p style="font-size:11.5px;color:var(--tz-muted);margin:0 0 12px">A reference pallet runs the length of each lane; the measured travel time and positional delta must sit within ±5 mm. A failed lane is re-tested after adjustment — both attempts stay on record.</p>
      <div style="display:flex;gap:10px;margin-bottom:10px">
        <button class="tzc-btn pri" id="wCalAll">Run all 9 lanes</button>
        <button class="tzc-btn" id="wCalOk" ${allPass()?'':'disabled'}>Confirm calibration →</button>
      </div>
      <table class="tzc-table"><tr><th>Lane</th><th>Travel</th><th>Δ position</th><th>Result</th><th></th></tr>
        ${lids.map(row).join('')}</table>
    </div>`;
  function allPass(){ return lids.every(l=>st.results[l] && st.results[l].pass); }
  function runOne(lid, cb){
    st.attempts[lid] = (st.attempts[lid]||0)+1;
    const tr = $('#wCal'+lid.replace(/\W/g,''));
    tr.cells[3].innerHTML = '<span style="color:var(--tz-cyan);font-weight:700">testing…</span>';
    T(()=>{
      const fail = (lid===FAIL_LANE && st.attempts[lid]===1);
      st.results[lid] = { t: 19.1+Math.random()*0.8, delta: fail ? 6.3 : 0.8+Math.random()*3.4, pass: !fail };
      persist(run); rerow(lid);
      if(fail) TZC.toast(lid+' out of tolerance — adjust and re-test');
      $('#wCalOk').disabled = !allPass();
      if(cb) cb();
    }, 900);
  }
  function rerow(lid){ const tr=$('#wCal'+lid.replace(/\W/g,'')); const tmp=document.createElement('tbody');
    tmp.innerHTML=row(lid); tr.replaceWith(tmp.firstElementChild); wireRows(); }
  function wireRows(){ el.querySelectorAll('[data-cal]').forEach(b=> b.onclick=()=>runOne(b.dataset.cal)); }
  wireRows();
  $('#wCalAll').onclick = () => {     // absolute-time batch: throttle-proof (one late tick completes all due lanes)
    const todo = lids.filter(l=>!(st.results[l] && st.results[l].pass));
    todo.forEach(lid=>{ st.attempts[lid]=(st.attempts[lid]||0)+1;
      const tr=$('#wCal'+lid.replace(/\W/g,'')); if(tr) tr.cells[3].innerHTML='<span style="color:var(--tz-cyan);font-weight:700">testing…</span>'; });
    const t0=Date.now(), step=900*SPD();
    const h=I(()=>{
      const due=Math.min(todo.length, Math.floor((Date.now()-t0)/step));
      for(let k=0;k<due;k++){ const lid=todo[k]; if(st.results[lid]) continue;
        const fail=(lid===FAIL_LANE && st.attempts[lid]===1);
        st.results[lid]={ t:19.1+Math.random()*0.8, delta: fail?6.3:0.8+Math.random()*3.4, pass:!fail };
        persist(run); rerow(lid);
        if(fail) TZC.toast(lid+' out of tolerance — adjust and re-test'); }
      const ok=$('#wCalOk'); if(ok) ok.disabled=!allPass();
      if(due>=todo.length) clearInterval(h);
    }, 120);
  };
  $('#wCalOk').onclick = () => { if(!allPass()) return;
    const retested = Object.keys(st.attempts).filter(l=>st.attempts[l]>1);
    passGate(run, 3, `Calibration-square test on all 9 lanes: max Δ ${Math.max(...lids.map(l=>st.results[l].delta)).toFixed(1)} mm (tolerance ±5 mm).`+
      (retested.length?` ${retested.join(', ')} required adjustment and re-test before passing.`:'')); };
}

/* ======================================================================
   GATE 3 — Power & Electrical (checklist + sign-off)
   ====================================================================== */
const G3_ITEMS = [
  ['supply','Supply voltage 240 V confirmed at every distribution point'],
  ['ups','UPS hold-up ≥ 10 minutes under full load'],
  ['earth','Earth continuity < 0.5 Ω on all chassis points'],
  ['estop','Hardware E-stop drops all drives (tested at both stations)'],
  ['guards','Guards and barriers installed per layout drawing'],
  ['strain','Cable strain relief and routing inspected']
];
function g3(run, el){
  const st = W(run).g3 = W(run).g3 || { checks:{} };
  el.innerHTML = `
    <div class="tzc-panel" style="max-width:760px">
      <h3 style="margin:0 0 4px;font-size:13px">Electrical verification — every item is individually stamped</h3>
      <p style="font-size:11.5px;color:var(--tz-muted);margin:0 0 8px">This is a safety gate: the pilot run (Gate 5) is locked until power verification is signed off. Tick each item as it is physically verified on the floor.</p>
      ${G3_ITEMS.map(([k,label])=>{ const c=st.checks[k];
        return `<div class="tzw-check ${c?'on':''}" data-chk="${k}">
          <div class="box">${c?'✓':''}</div><div style="flex:1"><div style="font-size:12.5px;font-weight:600">${label}</div>
          <div style="font-size:10.5px;color:var(--tz-muted)">${c?`confirmed by ${esc(c.by)} · ${new Date(c.at).toLocaleTimeString('en-AU',{hour12:false})}`:'not yet confirmed'}</div></div></div>`;}).join('')}
      <button class="tzc-btn pri" id="wG3" style="margin-top:14px" ${Object.keys(st.checks).length===G3_ITEMS.length?'':'disabled'}>Sign off power & electrical →</button>
    </div>`;
  el.querySelectorAll('[data-chk]').forEach(d => d.onclick = () => {
    const k = d.dataset.chk;
    if(st.checks[k]) delete st.checks[k];
    else st.checks[k] = { by: DB.current().name, at: nowIso() };
    persist(run); g3(run, el);
  });
  $('#wG3').onclick = () => passGate(run, 4,
    `All ${G3_ITEMS.length} electrical checks confirmed on the floor (supply, UPS hold-up, earth continuity, E-stop drop test, guards, strain relief). Signed off by ${DB.current().name}.`);
}

/* ======================================================================
   GATE 4 — Network & Mesh
   ====================================================================== */
function g4(run, el){
  const st = W(run).g4 = W(run).g4 || {};
  const old = DB.all('idbms').filter(u=>u.fw!=='1.4.2');
  el.innerHTML = `
    <div class="tzc-grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));max-width:900px">
      <div class="tzc-panel">
        <h3 style="margin:0 0 8px;font-size:13px">Mesh broadcast test</h3>
        <p style="font-size:11.5px;color:var(--tz-muted);margin:0 0 10px">A settings ping is broadcast to all 45 units; each must acknowledge within 100 ms.</p>
        <div class="tzw-prog"><div id="wNetBar" style="width:${st.bcast?100:0}%"></div></div>
        <div id="wNetRes" style="font-size:12px;margin-top:10px;line-height:1.7">${st.bcast?netResHTML():''}</div>
        <button class="tzc-btn pri" id="wNetGo" style="margin-top:10px" ${st.bcast?'disabled':''}>${st.bcast?'Broadcast OK':'Run broadcast test'}</button>
      </div>
      <div class="tzc-panel">
        <h3 style="margin:0 0 8px;font-size:13px">Firmware consistency</h3>
        <table class="tzc-table"><tr><th>Version</th><th>Units</th><th></th></tr>
          <tr><td><b>1.4.2</b> (target)</td><td class="mono">${45-old.length}</td><td><span class="tzc-ok">✓</span></td></tr>
          ${old.length?`<tr><td><b style="color:var(--tz-gold)">1.4.0</b></td><td class="mono">${old.length} (${old.map(u=>u.serial).join(', ')})</td>
            <td><button class="tzc-btn" id="wFw" style="padding:4px 10px;font-size:11px">Stage 1.4.2</button></td></tr>`:''}
        </table>
        <div id="wFwMsg" style="font-size:11.5px;color:var(--tz-muted);margin-top:8px">${old.length?'Fleet must be on one firmware before the pilot run.':'Fleet is uniform on 1.4.2.'}</div>
        <button class="tzc-btn pri" id="wG4" style="margin-top:12px;width:100%" ${st.bcast&&!old.length?'':'disabled'}>Confirm network & mesh →</button>
      </div>
    </div>`;
  function netResHTML(){ return `✅ <b>45/45 acknowledged</b> · max round-trip <b>${st.rtt} ms</b> · mesh depth 3 · 0 retries`; }
  $('#wNetGo').onclick = () => {
    $('#wNetGo').disabled = true; const t0=Date.now(), dur=2200*SPD();
    const h = I(()=>{ const p=Math.min(100,(Date.now()-t0)/dur*100); $('#wNetBar').style.width=p+'%';
      if(p>=100){ clearInterval(h); st.bcast=true; st.rtt=62+Math.floor(Math.random()*30); persist(run);
        $('#wNetRes').innerHTML=netResHTML(); $('#wNetGo').textContent='Broadcast OK';
        $('#wG4').disabled = !!DB.all('idbms').filter(u=>u.fw!=='1.4.2').length; } }, 90);
  };
  const fwBtn = $('#wFw');
  if(fwBtn) fwBtn.onclick = () => {
    fwBtn.disabled = true; fwBtn.textContent='flashing…';
    T(()=>{ DB.all('idbms').forEach(u=>{ if(u.fw!=='1.4.2') u.fw='1.4.2'; });
      st.fwFixed=true; persist(run);
      DB.log('maintenance','Fleet firmware','Staged and flashed 1.4.2 to remaining units during commissioning Gate 4.');
      g4(run, el); TZC.toast('Fleet uniform on firmware 1.4.2'); }, 1800);
  };
  $('#wG4').onclick = () => passGate(run, 5,
    `Broadcast acknowledged by 45/45 units, max round-trip ${st.rtt} ms, mesh depth 3. Fleet uniform on firmware 1.4.2${st.fwFixed?' (2 units flashed during this gate)':''}.`);
}

/* ======================================================================
   GATE 5 — First Run (Pilot)
   ====================================================================== */
const G5_CKPTS = [['power','Drives energised'],['nudge','First transfer onto lane'],
  ['chain','Handover chain stable'],['cycle','Full cycle complete — all pallets discharged']];
function g5(run, el){
  const st = W(run).g5 = W(run).g5 || {};
  const lids = Object.keys(lanes()).sort();
  st.lane = st.lane || lids[0];
  el.innerHTML = `
    <div class="tzc-panel" style="max-width:860px">
      <h3 style="margin:0 0 4px;font-size:13px">Controlled pilot — 5 pallets, 10% speed</h3>
      <p style="font-size:11.5px;color:var(--tz-muted);margin:0 0 12px">The lowest-risk way to prove the system end-to-end: five reference pallets convey the full length of one lane at crawl speed with all telemetry live. Nothing else moves.</p>
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
        <label style="font-size:11px;font-weight:700;color:var(--tz-muted)">PILOT LANE</label>
        <select id="wLane" style="font:inherit;font-size:12.5px;padding:6px 9px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel-solid);color:var(--tz-ink)" ${st.done?'disabled':''}>
          ${lids.map(l=>`<option ${l===st.lane?'selected':''}>${l}</option>`).join('')}</select>
        <button class="tzc-btn pri" id="wPilot" ${st.done?'disabled':''}>${st.done?'Pilot complete':'▶ Start pilot run'}</button>
      </div>
      <div class="tzw-pilot" id="wStrip"><div class="in">IN-FEED</div><div class="out">DISCHARGE</div></div>
      <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:12px" id="wCk">
        ${G5_CKPTS.map(([k,l])=>`<div style="font-size:12px" id="wCk_${k}">${st.done?'<span class="tzc-ok">✓</span>':'<span style="color:var(--tz-muted)">○</span>'} ${l}</div>`).join('')}
      </div>
      <button class="tzc-btn pri" id="wG5" style="margin-top:14px" ${st.done?'':'disabled'}>Declare ready for live →</button>
    </div>`;
  $('#wLane').onchange = e => { st.lane = e.target.value; persist(run); };
  const tick = k => { const d=$('#wCk_'+k); if(d) d.innerHTML = d.innerHTML.replace(/^<span[^>]*>.*?<\/span>/,'<span class="tzc-ok">✓</span>'); };
  $('#wPilot').onclick = () => {
    $('#wPilot').disabled = true; $('#wLane').disabled = true;
    const strip = $('#wStrip');
    const pallets = [];
    for(let i=0;i<5;i++){ const p=document.createElement('div'); p.className='tzw-pallet'; p.textContent='P'+(i+1);
      p.style.left='-48px'; strip.appendChild(p); pallets.push({el:p, x:-48-i*70}); }
    tick('power');
    const wEnd = strip.clientWidth + 20;
    let nudged=false, chained=false, exited=0;
    const t0=Date.now(), V=56.7;                         // px per sim-second
    const h = I(()=>{
      const el2=(Date.now()-t0)/1000/SPD();              // absolute elapsed: throttle-proof
      pallets.forEach((p,i)=>{ p.x = Math.min(wEnd, -48 - i*70 + V*el2); p.el.style.left=p.x+'px';
        p.el.style.opacity = p.x>=wEnd ? 0 : 1; });
      if(!nudged && pallets[0].x>30){ nudged=true; tick('nudge'); }
      if(!chained && pallets[2].x>strip.clientWidth*0.5){ chained=true; tick('chain'); }
      exited = pallets.filter(p=>p.x>=wEnd).length;
      if(exited===5){ clearInterval(h); tick('cycle'); st.done=true; persist(run);
        $('#wPilot').textContent='Pilot complete'; $('#wG5').disabled=false;
        TZC.toast('Pilot cycle complete — zero faults'); }
    }, 60);
  };
  $('#wG5').onclick = () => passGate(run, 8,
    `Pilot on lane ${st.lane}: 5 pallets at 10% speed, full in-feed → discharge cycle, zero faults. System declared ready for live operation.`);
}

/* ======================================================================
   GATE 6 — Configuration Broadcast
   ====================================================================== */
const G6_FIELDS = [
  ['fill_behavior','Fill behaviour','select',['progressive_fill','reverse_accumulation','hybrid']],
  ['default_gap_mm','Default gap (mm)','number',null],
  ['capacity_reserve_pct','Capacity reserve (%)','number',null],
  ['threshold_xval_warn','Cross-validation warn (%)','number',null],
  ['threshold_xval_fault','Cross-validation fault (%)','number',null],
  ['slip_warn_mm','Slip warn (mm)','number',null]
];
function g6(run, el){
  const st = W(run).g6 = W(run).g6 || {};
  const cur = {}; DB.all('settings').forEach(s=>cur[s.key]=s.value);
  const defaults = { fill_behavior:'progressive_fill', default_gap_mm:'200', capacity_reserve_pct:'12',
    threshold_xval_warn:'10', threshold_xval_fault:'15', slip_warn_mm:'30' };
  el.innerHTML = `
    <div class="tzc-panel" style="max-width:660px">
      <h3 style="margin:0 0 4px;font-size:13px">Site configuration — broadcast to every IDBM</h3>
      <p style="font-size:11.5px;color:var(--tz-muted);margin:0 0 14px">These values are written to all 45 units as broadcast v${st.done? (cur.__bv||'1') : ((+(cur.__bv||0))+1)}. Every change lands in the configuration audit trail with your name on it.</p>
      ${G6_FIELDS.map(([k,label,type,opts])=>{
        const v = st.values ? st.values[k] : (cur[k] || defaults[k]);
        return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <label style="flex:0 0 230px;font-size:12px;font-weight:600">${label}</label>
          ${type==='select'
            ? `<select data-set="${k}" ${st.done?'disabled':''} style="font:inherit;font-size:12.5px;padding:6px 9px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel-solid);color:var(--tz-ink)">${opts.map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join('')}</select>`
            : `<input data-set="${k}" type="number" value="${esc(v)}" ${st.done?'disabled':''} style="width:110px;font:inherit;font-size:12.5px;padding:6px 9px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel-solid);color:var(--tz-ink)">`}
        </div>`;}).join('')}
      <div class="tzw-prog" style="margin-top:6px"><div id="wCfgBar" style="width:${st.done?100:0}%"></div></div>
      <div style="display:flex;gap:10px;margin-top:12px">
        <button class="tzc-btn pri" id="wCfgGo" ${st.done?'disabled':''}>${st.done?'Broadcast acknowledged 45/45':'Broadcast settings'}</button>
        <button class="tzc-btn pri" id="wG6" ${st.done?'':'disabled'}>Continue to sign-off →</button>
      </div>
    </div>`;
  $('#wCfgGo').onclick = () => {
    const vals = {}; el.querySelectorAll('[data-set]').forEach(i=>vals[i.dataset.set]=String(i.value));
    el.querySelectorAll('[data-set],#wCfgGo').forEach(i=>i.disabled=true);
    const t0=Date.now(), dur=1600*SPD();
    const h=I(()=>{ const p=Math.min(100,(Date.now()-t0)/dur*100); $('#wCfgBar').style.width=p+'%';
      if(p>=100){ clearInterval(h);
        const me=DB.current();
        G6_FIELDS.forEach(([k])=>{
          const row = DB.all('settings').find(s=>s.key===k);
          const oldV = row ? row.value : '—';
          if(row){ row.value=vals[k]; row.set_by=me.id; row.set_at=nowIso(); }
          else DB.insert('settings',{site_id:1,key:k,label:k,value:vals[k],set_by:me.id,set_at:nowIso()});
          if(String(oldV)!==String(vals[k]))
            DB.insert('config_audit_trail',{site_id:1,key:k,old:oldV,new:vals[k],by:me.id,at:nowIso(),reason:'Commissioning Gate 6 configuration broadcast.'});
        });
        st.done=true; st.values=vals; persist(run);
        DB.log('config_change','Site settings','Commissioning broadcast: '+G6_FIELDS.map(([k])=>k+'='+vals[k]).join(', '));
        $('#wCfgGo').textContent='Broadcast acknowledged 45/45'; $('#wG6').disabled=false;
        TZC.toast('Settings broadcast — 45/45 acknowledged'); } }, 70);
  };
  $('#wG6').onclick = () => passGate(run, 9,
    'Site settings broadcast issued and acknowledged by all 45 units: '+G6_FIELDS.map(([k,l])=>`${l.toLowerCase()} ${ (W(run).g6.values||{})[k] }`).join(', ')+'.');
}

/* ======================================================================
   GATE 7 — Customer Sign-off
   ====================================================================== */
function g7(run, el){
  const me = DB.current();
  const checks = DB.all('commissioning_checks').filter(c=>c.run_id===run.id).sort((a,b)=>a.seq-b.seq);
  el.innerHTML = `
    <div class="tzc-grid" style="grid-template-columns:minmax(0,1.3fr) minmax(300px,1fr)">
      <div class="tzc-panel">
        <h3 style="margin:0 0 8px;font-size:13px">Everything that will be on the commissioning report</h3>
        ${checks.map(c=>`<div class="tzc-gate"><div class="n">✓</div><div>
          <h4>${c.seq}. ${esc(c.name)}</h4><p>${esc(c.notes)}</p>
          <div class="meta">checked by <b>${esc((DB.get('employees',c.checked_by)||{}).name||'—')}</b> · ${new Date(c.checked_at).toLocaleString('en-AU')}</div></div></div>`).join('')}
      </div>
      <div class="tzc-panel">
        <h3 style="margin:0 0 8px;font-size:13px">Sign-off</h3>
        <p style="font-size:11.5px;color:var(--tz-muted)">Both signatures are recorded on the run and printed on the report. Type names exactly — the installer signature must match your signed-in identity.</p>
        <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--tz-muted);margin:12px 0 5px">Installer signature (${esc(me.name)})</label>
        <input id="wSigMe" placeholder="Type your full name" style="width:100%;font:inherit;font-size:13px;padding:8px 10px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel-solid);color:var(--tz-ink)">
        <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--tz-muted);margin:12px 0 5px">Customer representative</label>
        <input id="wSigCust" placeholder="Full name, role — e.g. Jane Doe, Ops Manager" style="width:100%;font:inherit;font-size:13px;padding:8px 10px;border:1px solid var(--tz-brd);border-radius:8px;background:var(--tz-panel-solid);color:var(--tz-ink)">
        <label style="display:flex;gap:9px;align-items:flex-start;font-size:12px;margin:14px 0;cursor:pointer">
          <input type="checkbox" id="wSigOk" style="margin-top:2px;width:auto">
          <span>I confirm this configuration matches the customer agreement and the site is safe for live operation.</span></label>
        <button class="tzc-btn pri" id="wDone" style="width:100%" disabled>Complete commissioning & sign</button>
        <div id="wSigErr" style="color:var(--tz-orange);font-size:11.5px;margin-top:8px;min-height:14px"></div>
        <h3 style="font-size:12px;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.07em;color:var(--tz-muted)">§5.2 — what will be sent to every IDBM</h3>
        <pre id="wPayload" style="font-family:ui-monospace,Menlo,monospace;font-size:9.5px;line-height:1.5;background:rgba(127,127,127,.08);border:1px solid var(--tz-brd);border-radius:8px;padding:9px 11px;max-height:170px;overflow:auto;white-space:pre-wrap;margin:0"></pre>
        <button class="tzc-btn" id="wCopyJson" style="margin-top:8px;padding:5px 11px;font-size:11px">⧉ Copy as JSON</button>
      </div>
    </div>`;
  // §5.2 broadcast payload (Screen 08 fidelity): summarised on screen, complete on copy
  const site = DB.all('sites')[0];
  const cfg = {}; DB.all('settings').filter(s=>!String(s.key).startsWith('__')&&!String(s.key).startsWith('erp_'))
    .forEach(s=>cfg[s.key]=s.value);
  const serials = DB.all('idbms').map(u=>u.serial);
  const payloadFull = JSON.stringify({ schema:'tetrisize.commissioning/v1',
    site:{ name:site.name, customer:site.customer, location:site.location, timezone:site.timezone, units:site.units||'Metric (mm)' },
    run:{ id:run.id, type:run.installation_type, gates:checks.length+1 },
    idbm_ids:serials, settings:cfg }, null, 2);
  $('#wPayload').textContent = JSON.stringify({ schema:'tetrisize.commissioning/v1',
    site:{ name:site.name, customer:site.customer, location:site.location, timezone:site.timezone },
    run:{ id:run.id, type:run.installation_type, gates:checks.length+1 },
    idbm_ids:`[${serials.length} serials — full list on copy]`, settings:cfg }, null, 1);
  $('#wCopyJson').onclick = () => {
    const done = ()=>TZC.toast('Broadcast payload copied as JSON');
    if(navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(payloadFull).then(done, ()=>{ fallback(); });
    else fallback();
    function fallback(){ const ta=document.createElement('textarea'); ta.value=payloadFull;
      document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); done(); }
      catch(e){ TZC.toast('Copy blocked by browser'); } ta.remove(); }
  };
  const check = () => { $('#wDone').disabled = !($('#wSigOk').checked && $('#wSigCust').value.trim().length>3 && $('#wSigMe').value.trim().length>3); };
  ['wSigMe','wSigCust'].forEach(id=>$('#'+id).addEventListener('input',check));
  $('#wSigOk').onchange = check;
  $('#wDone').onclick = () => {
    if($('#wSigMe').value.trim().toLowerCase() !== me.name.toLowerCase()){
      $('#wSigErr').textContent = 'Installer signature must match your signed-in name: '+me.name; return; }
    const cust = $('#wSigCust').value.trim();
    // finalize the run BEFORE passGate re-renders — once status is 'passed' the
    // commissioning view falls through to the record (no gate 8 to render)
    DB.update('commissioning_runs', run.id, { status:'passed', completed_at:nowIso(),
      total_idbms_found:45, customer_rep:cust });
    passGate(run, 10, `Walkthrough complete. Installer ${me.name} and customer representative ${cust} counter-signed. Site live.`);
    const site = DB.all('sites')[0];
    DB.update('sites', site.id, { status:'active', commissioned_date:nowIso() });
    DB.all('idbms').forEach(u=>{ u.status = u.status==='offline' ? 'online' : u.status;
      u.commissioned_date = u.commissioned_date || nowIso(); });
    DB.log('commission_signoff','Central Site 01',`Commissioning run #${run.id} complete — signed by ${me.name} (installer) and ${cust} (customer). Site live.`);
    TZC.toast('🎉 Site commissioned — congratulations');
    TZC.rerender();
  };
}

const GATE_RENDER = [gSite,g1,gMap,g2,g3,g4,gRoles,gBaseline,g5,g6,g7];

/* ---------- printable commissioning report ---------- */
function printReport(runId){
  const run = DB.get('commissioning_runs', runId) || lastPassed(); if(!run) return;
  const site = DB.all('sites')[0];
  const checks = DB.all('commissioning_checks').filter(c=>c.run_id===run.id).sort((a,b)=>a.seq-b.seq);
  const settings = DB.all('settings').filter(s=>!s.key.startsWith('__'));
  const E = id => (DB.get('employees',id)||{}).name || '—';
  let pr = $('#tzcPrint');
  if(!pr){ pr=document.createElement('div'); pr.id='tzcPrint'; document.body.appendChild(pr); }
  pr.innerHTML = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111;font-size:12px;line-height:1.5">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #006B8F;padding-bottom:10px">
        <div><div style="font-size:21px;font-weight:800;letter-spacing:.06em">TETRISIZE <span style="color:#006B8F">SOLUTIONS</span></div>
        <div style="font-size:10px;letter-spacing:.25em;color:#00AEEF;font-weight:700">COMMISSIONING REPORT</div></div>
        <div style="text-align:right;font-size:10.5px;color:#555">Report generated ${new Date().toLocaleString('en-AU')}<br>Run #${run.id} · ${esc(run.installation_type.replace(/_/g,' '))}</div></div>
      <table style="width:100%;margin:14px 0;font-size:12px;border-collapse:collapse">
        <tr><td style="padding:3px 0;color:#666;width:160px">Site</td><td><b>${esc(site.name)}</b> — ${esc(site.location)}</td></tr>
        <tr><td style="padding:3px 0;color:#666">Customer</td><td>${esc(site.customer)}</td></tr>
        <tr><td style="padding:3px 0;color:#666">Equipment</td><td>${site.idbm_count} IDBMs · ${esc(site.layout)}</td></tr>
        <tr><td style="padding:3px 0;color:#666">Commissioning window</td><td>${new Date(run.started_at).toLocaleDateString('en-AU')} → ${new Date(run.completed_at).toLocaleDateString('en-AU')}</td></tr>
        <tr><td style="padding:3px 0;color:#666">Lead installer</td><td>${esc(E(run.started_by))}</td></tr>
        <tr><td style="padding:3px 0;color:#666">Customer representative</td><td>${esc(run.customer_rep||'—')}</td></tr>
        <tr><td style="padding:3px 0;color:#666">Result</td><td><b style="color:#3F9C35">PASSED — all ${checks.length} gates</b></td></tr></table>
      <h3 style="font-size:13px;border-bottom:1.5px solid #ccc;padding-bottom:4px">Commissioning gates</h3>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <tr style="text-align:left;color:#666"><th style="padding:4px 6px;border-bottom:1px solid #ccc">#</th><th style="padding:4px 6px;border-bottom:1px solid #ccc">Gate</th><th style="padding:4px 6px;border-bottom:1px solid #ccc">Checked by</th><th style="padding:4px 6px;border-bottom:1px solid #ccc">When</th><th style="padding:4px 6px;border-bottom:1px solid #ccc">Record</th></tr>
        ${checks.map(c=>`<tr><td style="padding:4px 6px;border-bottom:1px solid #eee">${c.seq}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee"><b>${esc(c.name)}</b></td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee">${esc(E(c.checked_by))}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;white-space:nowrap">${new Date(c.checked_at).toLocaleString('en-AU')}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee">${esc(c.notes)}</td></tr>`).join('')}</table>
      <h3 style="font-size:13px;border-bottom:1.5px solid #ccc;padding-bottom:4px;margin-top:16px">Configuration as broadcast</h3>
      <table style="width:60%;border-collapse:collapse;font-size:11px">
        ${settings.map(s=>`<tr><td style="padding:3px 6px;color:#666;border-bottom:1px solid #eee">${esc(s.label||s.key)}</td><td style="padding:3px 6px;border-bottom:1px solid #eee"><b>${esc(s.value)}</b></td></tr>`).join('')}</table>
      <div style="display:flex;gap:60px;margin-top:44px">
        <div style="flex:1"><div style="border-top:1.5px solid #111;padding-top:5px;font-size:11px">${esc(E(run.started_by))} — Lead installer, Tetrisize Solutions</div></div>
        <div style="flex:1"><div style="border-top:1.5px solid #111;padding-top:5px;font-size:11px">${esc(run.customer_rep||'Customer representative')} — ${esc(site.customer)}</div></div></div>
      <div style="margin-top:26px;font-size:9px;color:#888">Tetrisize Oceania Pty Ltd · This report is generated from the site's immutable commissioning audit trail. Demo dataset uses sample placeholder staff records; no endorsement implied.</div>
    </div>`;
  window.print();
}

return { begin, abort, activeRun, lastPassed, html, wire, cleanup, printReport };
})();
