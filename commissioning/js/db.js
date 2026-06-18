/* ============================================================================
   TETRISIZE COMMISSIONING — data layer
   localStorage-backed store seeded from TZ_SEED. Mirrors the SQL schema in
   02_DATABASE_SCHEMA.sql (the contract for a future server backend).
   Every state-changing call goes through TZDB so the audit trail stays honest.
   ========================================================================== */
window.TZDB = (function(){
  'use strict';
  const KEY = 'tzc-db', SKEY = 'tzc-session';
  let D = null;

  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(raw){ const p = JSON.parse(raw); if(p && p.__v === TZ_SEED.VERSION){ D = p; return; } }
    }catch(e){ /* corrupted store → reseed */ }
    D = TZ_SEED.generate(); save();
  }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(D)); }catch(e){ console.warn('TZDB save failed', e); } }

  /* ---- generic table access ---- */
  const all   = t => D[t] || [];
  const get   = (t,id) => all(t).find(r => r.id === id) || null;
  const nextId= t => all(t).reduce((m,r)=>Math.max(m, r.id||0), 0) + 1;
  function insert(t, row){ if(!D[t]) D[t]=[];          // tables can be created on demand (e.g. lane_states)
    row.id = row.id || nextId(t); D[t].push(row); save(); return row; }
  function update(t, id, patch){ const r = get(t,id); if(r){ Object.assign(r, patch); save(); } return r; }

  /* ---- session & auth ---- */
  function login(user, pass){
    const u = String(user||'').trim().toLowerCase();
    const emp = all('employees').find(e => e.is_active &&
      (e.username === u || e.email === u || (u === 'admin' && e.id === 1)));
    if(!emp || String(pass) !== emp.password) return null;
    emp.last_login = new Date().toISOString();
    try{ sessionStorage.setItem(SKEY, String(emp.id)); }catch(e){}
    log(emp.id, 'login', 'Supervisory', 'Signed in.');
    return emp;
  }
  function logout(){
    const me = current();
    if(me) log(me.id, 'logout', 'Supervisory', 'Signed out.');
    try{ sessionStorage.removeItem(SKEY); }catch(e){}
  }
  function current(){
    try{ const id = +sessionStorage.getItem(SKEY); return id ? get('employees', id) : null; }
    catch(e){ return null; }
  }
  function roleOf(emp){ return all('roles').find(r => r.name === (emp||{}).role) || null; }
  function can(perm){ const r = roleOf(current()); return !!(r && r.perms[perm]); }

  /* ---- audit trail (append-only) ---- */
  function log(operator_id, action, target, detail){
    insert('operations_log', { ts:new Date().toISOString(), operator_id, action, target, detail });
  }
  function logAction(action, target, detail){ const me = current(); if(me) log(me.id, action, target, detail); }

  /* ---- alarm helpers ---- */
  const openAlarms = () => all('alarms').filter(a => !a.acknowledged);
  function ackAlarm(id, note){
    const me = current(); const a = get('alarms', id);
    if(!me || !a || a.acknowledged) return null;
    update('alarms', id, { acknowledged:true, acknowledged_by:me.id,
      acknowledged_at:new Date().toISOString(), ack_note:note||'' });
    log(me.id, 'ack_alarm', `${a.idbm} (${a.lane})`, note || a.message);
    return a;
  }

  /* ---- demo data management ---- */
  function resetDemo(blank){
    D = TZ_SEED.generate();
    if(blank){ // fresh-customer mode: keep structure + staff, wipe operational history
      D.alarms = []; D.operations_log = []; D.shift_handovers = [];
      D.maintenance_history = []; D.daily_stats = []; D.config_audit_trail = [];
      D.commissioning_runs = []; D.commissioning_checks = [];
      D.idbms.forEach(u => { u.status='offline'; u.odometer_master=0; u.odometer_maintenance=0; });
      D.sites[0].status = 'not_commissioned'; D.sites[0].commissioned_date = null;
    }
    save();
  }
  function exportJSON(){ return JSON.stringify(D, null, 1); }
  function importJSON(text){ const p = JSON.parse(text); if(!p || !p.employees) throw new Error('Not a commissioning dataset'); D = p; D.__v = TZ_SEED.VERSION; save(); }

  load();
  return { all, get, insert, update, login, logout, current, roleOf, can,
           log:logAction, openAlarms, ackAlarm, resetDemo, exportJSON, importJSON,
           persist: save };   // for bulk in-place mutations (live sim heartbeats etc.)
})();
