/* ============================================================================
   TETRISIZE COMMISSIONING — live simulation tick (build session 3)
   Makes the dashboard breathe during demos: heartbeats refresh, the units-today
   counter creeps, and the mesh occasionally raises a realistic alarm. Pausable
   from the Home header. Only runs while a commissioned site is active, and
   never re-renders over an open modal, side panel, wizard gate, or focused
   form field. In a real deployment this module is replaced by the mesh feed.
   ========================================================================== */
window.TZL = (function(){
'use strict';
const TICK_MS = 5000;
let h = null, paused = false, lastAlarmAt = Date.now();

const SIM_ALARMS = [
  // [type, severity, message-template, weight]
  ['ir_handshake',     'info',    'Low IR handshake quality between {sn} and its downstream neighbour.', 4],
  ['calibration_drift','info',    '{sn} learned length drifted beyond the 6 mm floor. Recalibration suggested.', 3],
  ['photo_eye_blocked','warning', 'Photo-eye on {sn} reporting blocked for > 8 s with no product registered.', 2],
  ['handover_fault',   'warning', 'Slip above warn threshold on {sn} handover.', 2],
  ['motor_overcurrent','warning', 'Drive current on {sn} 18% above baseline under normal load.', 1]
];

/* mesh-loss simulation (Screen 49/50) — triggered manually (⌘K, admin) */
let meshLost = null;
function simulateLoss(){
  if(meshLost) return;
  meshLost = { since: Date.now(), until: Date.now() + 25000 + Math.random()*20000 };
  if(window.TZDB && TZDB.current()) TZDB.log('mesh_lost','Mesh','Supervisory lost contact with the IDBM mesh — live data paused, mesh continues to operate.');
  if(window.TZC){ TZC.toast('📡 Connection lost — reconnecting…'); TZC.rerender(); }
}
function meshRestore(){
  meshLost = null;
  if(window.TZDB && TZDB.current()) TZDB.log('mesh_restored','Mesh','Connection to the mesh restored; live data resumed.');
  if(window.TZC){ TZC.toast('📡 Mesh connection restored'); TZC.rerender(); }
}
function retry(){
  if(!meshLost) return;
  if(Math.random() < 0.6) meshRestore();
  else { meshLost.until += 8000; if(window.TZC) TZC.toast('Still unreachable — backing off…'); }
}

function tick(){
  const DB = window.TZDB; if(!DB || paused) return;
  const site = DB.all('sites')[0];
  if(!site || site.status !== 'active' || !DB.current()) return;
  if(meshLost){                                  // paused world: only the countdown moves
    if(Date.now() > meshLost.until) meshRestore();
    else refresh();
    return;
  }

  // heartbeats: every online unit just phoned home
  const now = new Date().toISOString();
  DB.all('idbms').forEach(u => { if(u.status === 'online') u.last_heartbeat = now; });

  // throughput creeps while the site runs (creates today's row after a fresh commissioning)
  const today = now.slice(0,10);
  let row = DB.all('daily_stats').find(d => d.date === today);
  if(!row) DB.insert('daily_stats', { date: today, units: 0, target: 760 });
  else if(!site.soft_estop) row.units += Math.floor(Math.random()*3);

  // occasional new alarm — a few per hour, never two within 4 min,
  // and never while ≥4 are already open (a flooded list kills the demo)
  if(DB.openAlarms().length < 4 && Date.now() - lastAlarmAt > 240000 && Math.random() < 0.10){
    lastAlarmAt = Date.now();
    const pool = []; SIM_ALARMS.forEach(a => { for(let i=0;i<a[3];i++) pool.push(a); });
    const [type, severity, tpl] = pool[Math.floor(Math.random()*pool.length)];
    const units = DB.all('idbms').filter(u=>u.status==='online');
    const u = units[Math.floor(Math.random()*units.length)];
    DB.insert('alarms', { site_id:1, severity, type, idbm:u.serial, lane:u.lane_id,
      message: tpl.replace('{sn}', u.serial), created_at: now, acknowledged:false,
      event_chain: [{ t: now, e: 'Threshold crossed — alarm raised by '+u.serial }] });
    if(window.TZC) TZC.toast('⚠ New '+severity+' alarm — '+u.serial+' ('+u.lane_id+')');
  }
  DB.persist();
  refresh();
}

function refresh(){
  // re-render only when it cannot interrupt the user
  const route = (location.hash.replace(/^#\/?/,'') || 'home').split('?')[0];
  if(route !== 'home' && route !== 'alarms') return;
  if(document.querySelector('#tzcModalWrap.open')) return;
  if(document.querySelector('#tzcDetail.open')) return;
  const ae = document.activeElement;
  if(ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return;
  if(window.TZC) TZC.rerender();
}

function start(){ if(!h) h = setInterval(tick, TICK_MS); }
function stop(){ if(h){ clearInterval(h); h = null; } }
function toggle(){ paused = !paused; if(window.TZC){ TZC.toast(paused?'Live feed paused':'Live feed resumed'); TZC.rerender(); } return paused; }

return { start, stop, toggle, simulateLoss, retry,
         get paused(){ return paused; }, get meshLost(){ return meshLost; } };
})();
