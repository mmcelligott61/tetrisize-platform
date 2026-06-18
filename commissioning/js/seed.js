/* ============================================================================
   TETRISIZE COMMISSIONING — sample database generator ("the /loop script")
   Generates a deterministic, lived-in demo dataset: celebrity staff, one
   commissioned site (45 IDBMs), a completed 7-gate commissioning run, and
   ~30 days of operational history (alarms, maintenance, shifts, audit trail).
   All timestamps are relative to "now" so the demo always looks current.
   Regenerate any time via Settings → Demo data → Reset (calls TZ_SEED.generate).
   ========================================================================== */
window.TZ_SEED = (function(){
  'use strict';
  const VERSION = 4;
  const DAY = 86400000, HR = 3600000, MIN = 60000;

  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296; }; }

  function generate(){
    const R = mulberry32(20260611);
    const now = Date.now();
    const iso = t => new Date(t).toISOString();
    const pick = a => a[Math.floor(R()*a.length)];
    const ri = (lo,hi) => lo + Math.floor(R()*(hi-lo+1));

    /* ---- roles & permissions matrix ---- */
    const roles = [
      { name:'admin',      label:'Admin',      perms:{hold_release:1,discharge:1,override:1,soft_stop:1,ack_alarms:1,maintenance:1,settings:1,operators:1,audit:1,commission:1} },
      { name:'supervisor', label:'Supervisor', perms:{hold_release:1,discharge:1,override:1,soft_stop:1,ack_alarms:1,maintenance:1,settings:0,operators:0,audit:1,commission:1} },
      { name:'technician', label:'Technician', perms:{hold_release:0,discharge:0,override:0,soft_stop:0,ack_alarms:1,maintenance:1,settings:0,operators:0,audit:0,commission:1} },
      { name:'operator',   label:'Operator',   perms:{hold_release:0,discharge:0,override:0,soft_stop:0,ack_alarms:1,maintenance:0,settings:0,operators:0,audit:0,commission:0} }
    ];

    /* ---- celebrity demo staff (sample placeholders only — replace with real
           company employees on a true commissioning; photos drop into
           assets/employees/<photo> and the cards pick them up automatically) ---- */
    const employees = [
      { id:1,  name:'George Clooney',     username:'george', role:'admin',      title:'Factory Manager',                  department:'Operations Management', photo:'george-clooney.jpg',     phone:'+61 2 5550 1001', certifications:['IDBM Commissioning','Safety Management','PLC Programming'], training_status:'certified', sign_off_authority:'full'    },
      { id:2,  name:'Julia Louis-Dreyfus',username:'julia',  role:'admin',      title:'Procurement Manager',              department:'Procurement',           photo:'julia-louis-dreyfus.jpg', phone:'+61 2 5550 1002', certifications:['Vendor Management','Spare Parts Procurement','Cost Analysis'], training_status:'certified', sign_off_authority:'limited' },
      { id:3,  name:'Dwayne Johnson',     username:'dwayne', role:'supervisor', title:'Site Supervisor',                  department:'Field Operations',      photo:'dwayne-johnson.jpg',      phone:'+61 2 5550 1003', certifications:['Safety Supervisor','Maintenance Oversight','Shift Leadership'], training_status:'certified', sign_off_authority:'full'    },
      { id:4,  name:'Morgan Freeman',     username:'morgan', role:'supervisor', title:'Engineering Supervisor',           department:'Engineering',           photo:'morgan-freeman.jpg',      phone:'+61 2 5550 1004', certifications:['Systems Integration','Commissioning Sign-off','Risk Assessment'], training_status:'certified', sign_off_authority:'full'    },
      { id:5,  name:'Ryan Reynolds',      username:'ryan',   role:'technician', title:'Maintenance Technician',           department:'Field Service',         photo:'ryan-reynolds.jpg',       phone:'+61 2 5550 1005', certifications:['IDBM Troubleshooting','Component Replacement','Sensor Calibration'], training_status:'certified', sign_off_authority:'limited' },
      { id:6,  name:'Keanu Reeves',       username:'keanu',  role:'technician', title:'Electrical Technician',            department:'Electrical',            photo:'keanu-reeves.jpg',        phone:'+61 2 5550 1006', certifications:['High-Voltage Safety','Electrical Integration','Firmware Flash'], training_status:'certified', sign_off_authority:'limited' },
      { id:7,  name:'Emma Stone',         username:'emma',   role:'technician', title:'Controls & Calibration Technician',department:'Controls',              photo:'emma-stone.jpg',          phone:'+61 2 5550 1007', certifications:['Calibration Square','Encoder Diagnostics','Mesh Networking'], training_status:'in_progress', sign_off_authority:'limited' },
      { id:8,  name:'Sarah Chen',         username:'sarah',  role:'operator',   title:'Line Operator — Shift A',          department:'Line Operations',       photo:'sarah-chen.jpg',          phone:'+61 2 5550 1008', certifications:['IDBM Operations','Alarm Response'], training_status:'certified', sign_off_authority:'none'    },
      { id:9,  name:'Mike McElligott',    username:'mike',   role:'operator',   title:'Line Operator — Shift B',          department:'Line Operations',       photo:'mike-mcelligott.jpg',     phone:'+61 2 5550 1009', certifications:['IDBM Operations','Alarm Response'], training_status:'certified', sign_off_authority:'none'    },
      { id:10, name:'Tom Hanks',          username:'tom',    role:'operator',   title:'Line Operator — Relief',           department:'Line Operations',       photo:'tom-hanks.jpg',           phone:'+61 2 5550 1010', certifications:['IDBM Operations'], training_status:'in_progress', sign_off_authority:'none'    }
    ];
    employees.forEach(e => { e.email = e.username + '@tetrisize.local'; e.password = 'password';
      e.is_active = true; e.created_at = iso(now - ri(60,160)*DAY); e.last_login = iso(now - ri(1,40)*HR); });

    /* ---- site ---- */
    const COMMISSIONED = now - 45*DAY;
    const sites = [{ id:1, name:'Central Site 01', customer:'Allied Packaging & Logistics Australia',
      location:'Brisbane, QLD', timezone:'Australia/Brisbane', idbm_count:45,
      layout:'3 arrays (A–C), 3 lanes per array, 5 modules per lane',
      status:'active', commissioned_date: iso(COMMISSIONED), created_by:1 }];

    /* ---- 45 IDBMs: arrays A/B/C × 3 lanes × 5 modules; module pitch 1365 mm ---- */
    const idbms = []; let sn = 0;
    ['A','B','C'].forEach((arr, ai) => {
      for(let lane=1; lane<=3; lane++){
        for(let slot=1; slot<=5; slot++){
          sn++;
          const serial = 'SN' + String(sn).padStart(2,'0');
          idbms.push({
            id:sn, serial, site_id:1, array:arr, lane_id:`${arr}-L${lane}`, slot,
            x:+((slot-1)*1.365).toFixed(3), y:+(ai*12 + (lane-1)*3).toFixed(3), z:0, yaw:0,
            fw: (serial==='SN41'||serial==='SN44') ? '1.4.0' : '1.4.2',
            status: serial==='SN37' ? 'maintenance' : 'online',
            odometer_master: ri(8000,14000), odometer_maintenance: ri(300,4000),
            last_heartbeat: iso(now - ri(2,28)*1000),
            commissioned_date: iso(COMMISSIONED - ri(0,5)*HR)
          });
        }
      }
    });

    /* a few units approaching the 12,000-transfer service interval (drives the
       maintenance dashboard's service-due forecast) */
    [['SN05',11420],['SN18',10860],['SN29',10240],['SN33',9180],['SN44',8630]].forEach(([sn,od])=>{
      const u = idbms.find(x=>x.serial===sn); if(u) u.odometer_maintenance = od; });

    /* ---- commissioning run: 7 gates, all passed, finished 45 days ago ---- */
    const C0 = COMMISSIONED - 6*DAY;
    const commissioning_runs = [{ id:1, site_id:1, started_by:1, started_at: iso(C0),
      completed_at: iso(COMMISSIONED), status:'passed', installation_type:'new_install',
      total_idbms_found:45,
      notes:'New install for Allied Packaging & Logistics Australia, Brisbane. 45 IDBMs across 3 arrays. All seven gates passed; customer sign-off obtained.' }];
    const GATES = [
      ['topology_discovery','Topology Discovery', 5, 1.2, '45 IDBMs discovered across 3 arrays (A–C), 3 lanes each. All serials unique, neighbour links verified.'],
      ['calibration','Calibration',               7, 2.4, 'Calibration Square test on every lane: all modules within ±5 mm. Skew correction enabled and verified.'],
      ['power_verify','Power & Electrical',       6, 3.1, '240 V supply confirmed on all 45 circuits. UPS hold-up 11 min under load. Earth continuity passed.'],
      ['network_verify','Network & Mesh',         6, 3.6, 'Broadcast round-trip to all 45 units < 100 ms. Firmware 1.4.2 staged fleet-wide (2 units pending → scheduled).'],
      ['first_run','First Run (Pilot)',           3, 4.3, 'Pilot: 5 pallets, lane A-L1, 10% speed, 30-minute cycle. Zero faults. Declared ready for live.'],
      ['configuration','Configuration Broadcast', 1, 5.0, 'Site settings broadcast v1: progressive fill, 200 mm gap, thresholds applied. All units acknowledged.'],
      ['handoff','Customer Sign-off',             1, 6.0, 'Walkthrough complete. Customer representative counter-signed. Site live.']
    ];
    const commissioning_checks = GATES.map((g,i) => ({ id:i+1, run_id:1, key:g[0], name:g[1],
      status:'passed', checked_by:g[2], checked_at: iso(C0 + g[3]*DAY), notes:g[4], seq:i+1 }));

    /* ---- spare pool ---- */
    const spare_pool = [
      { id:1, serial:'SP01', length_m:6.0, rev:'2A', warranty_months:12, status:'in_stock' },
      { id:2, serial:'SP02', length_m:6.0, rev:'2A', warranty_months:12, status:'in_stock' },
      { id:3, serial:'SP03', length_m:6.0, rev:'2B', warranty_months:11, status:'in_stock' },
      { id:4, serial:'SP04', length_m:3.0, rev:'2A', warranty_months:8,  status:'in_stock' },
      { id:5, serial:'SP05', length_m:6.0, rev:'2A', warranty_months:10, status:'repair', note:'Belt replaced; awaiting final QA sign-off before returning to pool.' }
    ];

    /* ---- alarms: 3 open + ~9 resolved over the last 30 days ---- */
    const ATYPES = [
      ['handover_fault','Handover fault','warning'], ['calibration_drift','Calibration drift','info'],
      ['connection_lost','Connection lost','critical'], ['photo_eye_blocked','Photo-eye blocked','warning'],
      ['motor_overcurrent','Motor overcurrent','warning'], ['ir_handshake','Low IR handshake quality','info']
    ];
    const alarms = [];
    let aid = 0;
    function alarm(o){ alarms.push(Object.assign({ id:++aid, site_id:1, acknowledged:false,
      acknowledged_by:null, acknowledged_at:null, ack_note:null, resolved_at:null }, o)); }

    // open alarms (these light up the badge)
    alarm({ severity:'critical', type:'connection_lost', idbm:'SN22', lane:'B-L2',
      message:'Connection lost to SN22 — no heartbeat for 45 s. Mesh re-route active; lane B-L2 degraded.',
      created_at: iso(now - 2*HR),
      event_chain:[{t:iso(now-2*HR-90000),e:'Heartbeat interval rising (3.1 s)'},{t:iso(now-2*HR-45000),e:'Two missed heartbeats'},{t:iso(now-2*HR),e:'Declared offline; neighbours re-routed'}] });
    alarm({ severity:'warning', type:'handover_fault', idbm:'SN12', lane:'A-L3',
      message:'Skew on SN12 → SN13 handover; slip distance 45 mm exceeds 30 mm warn threshold.',
      created_at: iso(now - 5*HR),
      event_chain:[{t:iso(now-5*HR-120000),e:'Velocity mismatch 4.2%'},{t:iso(now-5*HR),e:'Slip 45 mm measured at handover'}] });
    alarm({ severity:'info', type:'calibration_drift', idbm:'SN15', lane:'A-L3',
      message:'SN15 learned length drifted 8 mm from commissioning baseline. Recalibration suggested at next window.',
      created_at: iso(now - 26*HR), event_chain:[{t:iso(now-26*HR),e:'Baseline delta crossed 6 mm floor'}] });

    // resolved history
    const ackers = [3,4,5,6];
    const resolvedNotes = [
      'Reseated connector and re-tested — passing.','Recalibrated pair; slip now 9 mm.','Cleared obstruction, photo-eye verified.',
      'Current draw normal after belt tension adjust.','Re-flashed transceiver; handshake quality nominal.','Sensor bracket realigned; drift eliminated.'
    ];
    for(let i=0;i<9;i++){
      const t = pick(ATYPES); const created = now - ri(2,29)*DAY - ri(0,20)*HR;
      const unit = pick(idbms);
      const who = pick(ackers);
      alarm({ severity:t[2], type:t[0], idbm:unit.serial, lane:unit.lane_id,
        message:`${t[1]} on ${unit.serial} (${unit.lane_id}).`, created_at: iso(created),
        acknowledged:true, acknowledged_by:who, acknowledged_at: iso(created + ri(4,90)*MIN),
        ack_note: pick(resolvedNotes), resolved_at: iso(created + ri(20,180)*MIN) });
    }

    /* ---- maintenance history ---- */
    const maintenance_history = [
      { id:1, idbm:'SN37', type:'repair',  component:'Belt',      issue:'Belt wear beyond 70% — flagged by adaptive trends.', work:'Belt replaced with spare from pool (SP05 rotated in for QA). Unit held in maintenance pending re-calibration.', performed_by:5, performed_at: iso(now - 1*DAY - 3*HR), signed_off_by:null, signed_off_at:null },
      { id:2, idbm:'SN08', type:'repair',  component:'Photo-eye', issue:'Intermittent photo-eye dropouts on B-L1.', work:'Photo-eye assembly replaced; alignment verified with test square.', performed_by:5, performed_at: iso(now - 6*DAY), signed_off_by:3, signed_off_at: iso(now - 6*DAY + 2*HR) },
      { id:3, idbm:'SN03', type:'service', component:'Encoder',   issue:'Encoder counts drifting under load.', work:'Encoder recalibrated against master odometer; tolerance restored to ±2 counts.', performed_by:7, performed_at: iso(now - 12*DAY), signed_off_by:4, signed_off_at: iso(now - 12*DAY + 1*HR) },
      { id:4, idbm:'SN22', type:'repair',  component:'Network',   issue:'RJ45 at SN22 partially backed out of latch.', work:'Connector reseated, strain relief added, link verified at full rate.', performed_by:6, performed_at: iso(now - 17*DAY), signed_off_by:3, signed_off_at: iso(now - 17*DAY + 1*HR) },
      { id:5, idbm:'SN29', type:'service', component:'Drive motor', issue:'Scheduled 10,000-transfer service.', work:'Drive inspected, lubricated; current draw baselined.', performed_by:5, performed_at: iso(now - 22*DAY), signed_off_by:4, signed_off_at: iso(now - 22*DAY + 1*HR) },
      { id:6, idbm:'SN44', type:'service', component:'Firmware',  issue:'Unit on 1.4.0 — fleet target is 1.4.2.', work:'Update staged; awaiting next maintenance window to flash (paired with SN41).', performed_by:6, performed_at: iso(now - 4*DAY), signed_off_by:null, signed_off_at:null }
    ];

    /* ---- shifts & handovers (last 5 days × 2 shifts) ---- */
    const shift_handovers = [];
    let shid = 0;
    for(let d=5; d>=1; d--){
      const base = new Date(now - d*DAY); base.setHours(6,0,0,0);
      const t0 = base.getTime();
      shift_handovers.push({ id:++shid, site_id:1, date: iso(t0).slice(0,10), shift:'A (06:00–14:00)',
        operator_id:8, incoming_id:9, started_at: iso(t0), ended_at: iso(t0+8*HR),
        units: ri(300,430), unresolved: ri(0,2), overrides: ri(0,1), confirmed:true,
        notes: pick(['Smooth shift, no holds.','One brief hold on A-L2 for pallet inspection — released after 4 min.','Handover pair SN12/SN13 worth watching, slip trending up.','Throughput tracking ahead of target.','Nothing unusual; spare pool audit due.']) });
      shift_handovers.push({ id:++shid, site_id:1, date: iso(t0).slice(0,10), shift:'B (14:00–22:00)',
        operator_id:9, incoming_id:10, started_at: iso(t0+8*HR), ended_at: iso(t0+16*HR),
        units: ri(260,400), unresolved: ri(0,2), overrides: ri(0,2), confirmed:true,
        notes: pick(['Steady evening run.','Acked one info alarm (IR handshake) — Keanu notified.','WMS feed paused 10 min upstream; no product impact.','Two manual releases on C-L1 during picking surge.','All lanes nominal at handover.']) });
    }

    /* ---- daily throughput stats (last 30 days) ---- */
    const daily_stats = [];
    for(let d=29; d>=0; d--){
      const t = new Date(now - d*DAY);
      const wd = t.getDay();
      const weekend = (wd===0 || wd===6);
      daily_stats.push({ date: t.toISOString().slice(0,10),
        units: weekend ? ri(340,500) : ri(720,880), target: 760 });
    }

    /* ---- settings + config audit ---- */
    const settings = [
      { key:'fill_behavior', value:'progressive_fill', label:'Fill behaviour' },
      { key:'default_gap_mm', value:'200', label:'Default gap (mm)' },
      { key:'capacity_reserve_pct', value:'12', label:'Capacity reserve (%)' },
      { key:'skew_correction', value:'enabled', label:'Skew correction' },
      { key:'threshold_xval_warn', value:'10', label:'Cross-validation warn (%)' },
      { key:'threshold_xval_fault', value:'15', label:'Cross-validation fault (%)' },
      { key:'slip_warn_mm', value:'30', label:'Slip warn (mm)' },
      { key:'language', value:'en-AU', label:'Language' }
    ].map((s,i)=>Object.assign({id:i+1, site_id:1, set_by:1, set_at: iso(COMMISSIONED)}, s));

    const config_audit_trail = [
      { id:1, key:'fill_behavior', old:'—', new:'progressive_fill', by:1, at: iso(COMMISSIONED), reason:'Commissioning baseline per customer agreement.' },
      { id:2, key:'skew_correction', old:'disabled', new:'enabled', by:6, at: iso(COMMISSIONED - 2*DAY), reason:'Required for calibration gate.' },
      { id:3, key:'slip_warn_mm', old:'40', new:'30', by:4, at: iso(now - 8*DAY), reason:'Tightened after recurring SN12 handover events — earlier warning gives operators time to react.' }
    ];

    /* ---- operations log (audit trail spine) ---- */
    const operations_log = [];
    let oid = 0;
    function log(ts, op, action, target, detail){ operations_log.push({ id:++oid, ts: (typeof ts==='number'?iso(ts):ts), operator_id:op, action, target, detail }); }
    // commissioning trail
    log(C0, 1, 'commission_start', 'Central Site 01', 'New-install commissioning run started.');
    commissioning_checks.forEach(c => log(c.checked_at, c.checked_by, 'gate_passed', c.name, c.notes));
    log(COMMISSIONED, 1, 'commission_signoff', 'Central Site 01', 'Commissioning complete — customer counter-signed. Site live.');
    // maintenance trail
    maintenance_history.forEach(m => { log(m.performed_at, m.performed_by, 'maintenance', m.idbm, `${m.component}: ${m.work}`);
      if(m.signed_off_by) log(m.signed_off_at, m.signed_off_by, 'maintenance_signoff', m.idbm, `${m.component} work signed off.`); });
    // alarm acks
    alarms.filter(a=>a.acknowledged).forEach(a => log(a.acknowledged_at, a.acknowledged_by, 'ack_alarm', `${a.idbm} (${a.lane})`, a.ack_note));
    // config changes
    config_audit_trail.forEach(c => log(c.at, c.by, 'config_change', c.key, `${c.old} → ${c.new} — ${c.reason}`));
    // a few operational actions + recent logins
    log(now - 3*DAY - 5*HR, 3, 'hold_lane', 'A-L2', 'Held for pallet inspection (4 min).');
    log(now - 3*DAY - 5*HR + 4*MIN, 3, 'release_lane', 'A-L2', 'Inspection clear; lane released.');
    log(now - 9*DAY, 4, 'override', 'C-L1', 'Manual routing override during picking surge; reverted after 22 min.');
    shift_handovers.slice(-4).forEach(s => log(s.ended_at, s.operator_id, 'shift_handover', s.shift, s.notes));
    [[1,2],[3,8],[5,26],[6,30],[8,9],[9,16]].forEach(([emp,hrs]) => log(now - hrs*HR, emp, 'login', 'Supervisory', 'Signed in.'));

    return { __v: VERSION, generated_at: iso(now),
      roles, employees, sites, idbms, commissioning_runs, commissioning_checks,
      spare_pool, maintenance_history, alarms, shift_handovers, daily_stats,
      settings, config_audit_trail, operations_log };
  }

  /* ----------------------------------------------------------------------
     LARGE-SITE MODE (S11): generate the dataset FROM a real layout export
     (tetrisize.platform/v0.3 — the same JSON the Configurator produces).
     Derives Level (baseZ band) and Zone (rack block between the marked
     corridors) for every unit, and creates the crane-bed IDBMs as
     mount:'vehicle' with zone-level positions (per Mike: zone is enough
     for mobile devices in the supervisory; the Viewer owns true XY).
     ---------------------------------------------------------------------- */
  function generateLarge(layout){
    const base = generate();                       // staff/roles/spares/settings backbone
    const R = mulberry32(944);
    const now = Date.now();
    const iso = t => new Date(t).toISOString();
    const ri = (lo,hi) => lo + Math.floor(R()*(hi-lo+1));
    const pick = a => a[Math.floor(R()*a.length)];

    const levelOf = z => z < 1000 ? 'Z0' : z < 3500 ? 'Z2200' : 'Z4400';
    const blockOf = y => y > 12610 ? 'N' : y > -7910 ? 'C' : y > -28562 ? 'S' : 'T';

    const units = layout.instances.map((i,ix)=>{
      const a=i.datum.endA, b=i.datum.endB, ymid=(a[1]+b[1])/2;
      const lvl=levelOf(a[2]), blk=blockOf(ymid), zone=lvl+'·'+blk;
      return { id:ix+1, serial:i.instanceId, site_id:1, level:lvl, zone, lane_id:zone,
        array:blk, slot:ix+1, x:+(a[0]/1000).toFixed(2), y:+(ymid/1000).toFixed(2), z:+(a[2]/1000).toFixed(2),
        yaw:0, fw: R()<0.985 ? '1.4.2' : '1.4.0',
        status:'online', mount:'fixed',
        odometer_master: ri(20000,90000), odometer_maintenance: ri(300,7500),
        last_heartbeat: iso(now - ri(2,28)*1000), commissioned_date: iso(now - 45*DAY) };
    });
    // crane-bed IDBMs: mount:'vehicle', positioned at zone level only
    (layout.vehicles||[]).forEach(v=>{
      const beds = (v.params && v.params['bed.laneCount']) || 12;
      const vy = v.pose.position[1], blk = blockOf(vy);
      for(let k=1;k<=beds;k++){
        units.push({ id:units.length+1, serial:`${v.instanceId}-B${String(k).padStart(2,'0')}`,
          site_id:1, level:'MD', zone:'MD·'+v.instanceId, lane_id:'MD·'+v.instanceId,
          array:'MD', slot:k, x:+(v.pose.position[0]/1000).toFixed(2), y:+(vy/1000).toFixed(2), z:0.11,
          yaw:v.pose.yaw||0, fw:'1.4.2', status:'online', mount:'vehicle', vehicle:v.instanceId,
          odometer_master: ri(30000,120000), odometer_maintenance: ri(500,8000),
          last_heartbeat: iso(now - ri(2,20)*1000), commissioned_date: iso(now - 45*DAY) });
      }
    });
    // a believable spread of exceptions for the hierarchy/exception views
    for(let k=0;k<6;k++) pick(units).status='maintenance';
    for(let k=0;k<3;k++) pick(units.filter(u=>u.status==='online')).status='offline';
    for(let k=0;k<9;k++) pick(units).odometer_maintenance = ri(10100,11900);

    base.idbms = units;
    base.sites = [{ id:1, name:'Allied Mega DC 01', customer:'Allied Packaging & Logistics Australia',
      location:'Brisbane, QLD', timezone:'Australia/Brisbane', idbm_count:units.length,
      layout:'3 levels × 4 rack blocks + '+ (layout.vehicles||[]).length +' crane cars (imported from configurator layout)',
      status:'active', commissioned_date: iso(now - 45*DAY), created_by:1 }];
    base.commissioning_runs = [{ id:1, site_id:1, started_by:1, started_at: iso(now-45*DAY),
      completed_at: iso(now-45*DAY+6*HR), status:'passed', installation_type:'reused_mesh',
      total_idbms_found:units.length, customer_rep:'Margaret Holloway, Operations Director',
      notes:'Imported from configurator layout export (tetrisize.platform/v0.3) and verified against the live mesh: '+units.length+' IDBMs across 3 levels, '+(layout.vehicles||[]).length+' crane cars with vehicle-mounted beds.' }];
    base.commissioning_checks = [{ id:1, run_id:1, key:'rehydrate', name:'Layout Import & Mesh Verification',
      status:'passed', checked_by:1, checked_at: iso(now-45*DAY+6*HR), seq:1,
      notes:units.length+'/'+units.length+' units matched the imported layout (serials, levels, lane geometry). Crane-bed units registered as vehicle-mounted with zone-level tracking.' }];
    // alarms & maintenance re-pointed at real serials
    base.alarms = [];
    let aid=0; const mk=(sev,type,msg,ageH,ack)=>{ const u=pick(units);
      base.alarms.push({ id:++aid, site_id:1, severity:sev, type, idbm:u.serial, lane:u.zone,
        message:msg.replace('{sn}',u.serial), created_at: iso(now-ageH*HR),
        acknowledged:!!ack, acknowledged_by:ack?pick([3,4,5,6]):null,
        acknowledged_at:ack?iso(now-ageH*HR+30*MIN):null,
        ack_note:ack?'Corrected and re-tested — passing.':null, resolved_at:ack?iso(now-ageH*HR+45*MIN):null,
        event_chain:[{t:iso(now-ageH*HR),e:'Threshold crossed — alarm raised by '+u.serial}] }); };
    mk('critical','connection_lost','Connection lost to {sn} — no heartbeat for 45 s. Mesh re-route active.',1,false);
    mk('warning','handover_fault','Slip above warn threshold on {sn} handover.',4,false);
    mk('info','calibration_drift','{sn} learned length drifted beyond the 6 mm floor.',20,false);
    for(let k=0;k<7;k++) mk(pick(['warning','info']),pick(['photo_eye_blocked','ir_handshake','motor_overcurrent']),
      'Event recorded on {sn}.',ri(30,500),true);
    base.maintenance_history = base.maintenance_history.slice(0,4).map((m,i)=>({ ...m, id:i+1, idbm:pick(units).serial }));
    base.daily_stats = base.daily_stats.map(d=>({ ...d, units: Math.round(d.units*8.6), target: 6500 }));
    base.shift_handovers = base.shift_handovers.map(s=>({ ...s, units: Math.round(s.units*8.6) }));
    return base;
  }

  return { VERSION, generate, generateLarge };
})();
