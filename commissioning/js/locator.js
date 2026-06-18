/* ============================================================================
   TETRISIZE COMMISSIONING — 3D Fault Locator (build session 8)
   A stripped-down perspective viewer for error assistance at scale. Loads the
   site's layout export (tetrisize.platform/v0.3 — same JSON the Configurator
   produces), then flies a camera from the known ISO reference along the
   site's MARKED CORRIDORS (not as the crow flies) to the faulted IDBM, and
   parks on it with its exact X/Y/Z so a technician — or a drone — knows
   precisely where to go. Pure canvas, no dependencies, ~1,820 units at 60 fps
   (ghost units are drawn as belt lines; only the target neighbourhood gets
   full boxes).
   ========================================================================== */
window.TZLOC = (function(){
'use strict';
const $ = s => document.querySelector(s);
let L = null;            // parsed layout {units[], corridors[], vehicles[], levels[], bounds, center}
let raf = 0, cam = null, flight = null, orbit = null, speed = 1, target = null;
let canvas = null, ctx = null, W = 0, H = 0, DPR = 1;
let xray = false;                      // product-only inventory mode (S9)
let recState = null, burnOnce = false; // clip recorder + evidence strip (S9)
let patrol = null;                     // alarm patrol queue (S9)
let autoClip = null;                   // one-click fault-clip automation (S9)

/* ---------- vector helpers ---------- */
const sub = (a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add = (a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul = (a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot = (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const len = a=>Math.hypot(a[0],a[1],a[2]);
const norm = a=>{ const l=len(a)||1; return [a[0]/l,a[1]/l,a[2]/l]; };
const lerp3 = (a,b,t)=>[a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
const ease = t => t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;

/* ---------- layout loading ---------- */
function parseLayout(d){
  const units = d.instances.map(i=>{
    const a=i.datum.endA, b=i.datum.endB;
    return { id:i.instanceId, a, b, mid:[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],
      w:i.params.width||300, h:i.params.height||170, z:a[2] };
  });
  const zs = [...new Set(units.map(u=>u.z))].sort((x,y)=>x-y);
  const xs=[], ys=[];
  units.forEach(u=>{ xs.push(u.a[0],u.b[0]); ys.push(u.a[1],u.b[1]); });
  const bounds = { x0:Math.min(...xs), x1:Math.max(...xs), y0:Math.min(...ys), y1:Math.max(...ys),
                   z1: zs[zs.length-1]+400 };
  const corridors = (d.markings||[]).filter(m=>m.kind==='corridor').map(m=>{
    const py=m.poly.map(p=>p[1]), px=m.poly.map(p=>p[0]);
    return { poly:m.poly, yMid:(Math.min(...py)+Math.max(...py))/2,
             x0:Math.min(...px), x1:Math.max(...px) };
  });
  return { units, corridors, zs,
    vehicles: (d.vehicles||[]).map(v=>({ id:v.instanceId, p:v.pose.position, yaw:v.pose.yaw||0,
      travel:v.travel||30000, top:(v.params&&v.params['vertical.maxDeliveryHeight']||6000)+2200 })),
    levels: d.levels||[], bounds,
    center: [(bounds.x0+bounds.x1)/2, (bounds.y0+bounds.y1)/2, 0] };
}
function load(cb){
  if(L){ cb(); return; }
  fetch('commissioning/data/site_layout.json').then(r=>r.json())
    .then(d=>{ L=parseLayout(d); cb(); })
    .catch(e=>{ if(window.TZC) TZC.toast('Could not load commissioning/data/site_layout.json — '+e.message); });
}

/* ---------- projection pipeline ----------
   Unified renderer (S9c): every primitive — belt line, box face, pallet —
   goes into one display list, is globally sorted far→near each frame, and is
   CLIPPED against the camera's near plane rather than dropped. Fixes the
   fly-around artifacts: pallets vanishing under boxes (no global sort),
   crane faces popping (whole-primitive near-plane drop), and row-order
   foreground confusion (group paint order beating true depth). */
const NEAR = 80;
let CF=null, CR=null, CU=null;          // camera basis, rebuilt once per frame
function camBasis(){
  CF = norm(sub(cam.look, cam.pos));
  CR = norm(cross(CF,[0,0,1])); if(!isFinite(CR[0])) CR=[1,0,0];
  CU = cross(CR,CF);
}
const cdep = p => dot(sub(p,cam.pos), CF);
function proj(p){                        // callers guarantee cdep(p) >= NEAR
  const rel = sub(p,cam.pos), d = dot(rel,CF), f = H*0.92;
  return [ W/2 + dot(rel,CR)/d*f, H/2 - dot(rel,CU)/d*f, d ];
}
function clipLine3(a,b){
  const da=cdep(a), db=cdep(b);
  if(da<NEAR && db<NEAR) return null;
  if(da>=NEAR && db>=NEAR) return [a,b];
  const m = lerp3(a,b,(NEAR-da)/(db-da));
  return da>=NEAR ? [a,m] : [m,b];
}
function clipPoly3(pts){                 // Sutherland–Hodgman vs the near plane
  const ds = pts.map(cdep);
  if(ds.every(d=>d>=NEAR)) return pts;
  if(ds.every(d=>d<NEAR)) return null;
  const out=[];
  for(let i=0;i<pts.length;i++){
    const a=pts[i], b=pts[(i+1)%pts.length], da=ds[i], db=ds[(i+1)%pts.length];
    if(da>=NEAR) out.push(a);
    if((da>=NEAR)!==(db>=NEAR)) out.push(lerp3(a,b,(NEAR-da)/(db-da)));
  }
  return out.length>=3 ? out : null;
}
function rasterPoly(pts, fill){
  const c = clipPoly3(pts); if(!c) return;
  const P = c.map(proj);
  let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;
  for(const p of P){ if(p[0]<minx)minx=p[0]; if(p[0]>maxx)maxx=p[0];
                     if(p[1]<miny)miny=p[1]; if(p[1]>maxy)maxy=p[1]; }
  if(maxx<0 || minx>W || maxy<0 || miny>H) return;      // viewport cull
  ctx.fillStyle=fill; ctx.beginPath(); ctx.moveTo(P[0][0],P[0][1]);
  for(let i=1;i<P.length;i++) ctx.lineTo(P[i][0],P[i][1]);
  ctx.closePath(); ctx.fill();
}
function rasterLine(a,b,style,w){
  const s = clipLine3(a,b); if(!s) return;
  const A=proj(s[0]), B=proj(s[1]);
  ctx.strokeStyle=style; ctx.lineWidth=w||1;
  ctx.beginPath(); ctx.moveTo(A[0],A[1]); ctx.lineTo(B[0],B[1]); ctx.stroke();
}
/* display list: k0 = poly, k1 = line, k2 = pallet billboard */
let DL=[];
const ctr = pts => { let d=0; for(const p of pts) d+=cdep(p); return d/pts.length; };
function dlPoly(pts, fill){ DL.push({k:0, pts, fill, d:ctr(pts)}); }
function dlLine(a,b,style,w){ DL.push({k:1, a, b, style, w, d:(cdep(a)+cdep(b))/2}); }
function dlPallet(p,c){ const d=cdep(p); if(d>NEAR) DL.push({k:2, p, c, d}); }
function dlBox(c0, c1, fill, topFill){   // emit only the camera-facing faces
  const [x0,y0,z0]=c0,[x1,y1,z1]=c1, cp=cam.pos;
  const fx = cp[0] > (x0+x1)/2 ? x1 : x0;
  const fy = cp[1] > (y0+y1)/2 ? y1 : y0;
  dlPoly([[fx,y0,z0],[fx,y1,z0],[fx,y1,z1],[fx,y0,z1]], fill);
  dlPoly([[x0,fy,z0],[x1,fy,z0],[x1,fy,z1],[x0,fy,z1]], fill);
  if(cp[2] > z1)      dlPoly([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], topFill||fill);
  else if(cp[2] < z0) dlPoly([[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]], topFill||fill);
}
function dlFlush(){
  DL.sort((a,b)=>b.d-a.d);               // far first — true painter ordering
  for(const e of DL){
    if(e.k===0) rasterPoly(e.pts, e.fill);
    else if(e.k===1) rasterLine(e.a, e.b, e.style, e.w);
    else {
      if(e.d < 500) continue;                            // inside / brushing the pallet — skip
      const P = proj(e.p);
      const s = Math.min(H*1.2, Math.max(1.2, H*0.92*1100/P[2]));   // cap screen size
      if(P[0]+s/2<0 || P[0]-s/2>W || P[1]+s/2<0 || P[1]-s/2>H) continue;  // viewport cull
      ctx.globalAlpha=0.92; ctx.fillStyle=e.c;
      ctx.fillRect(P[0]-s/2, P[1]-s*0.42, s, s*0.84);
      ctx.globalAlpha=0.35; ctx.fillStyle='#000';
      ctx.fillRect(P[0]-s/2, P[1]+s*0.30, s, s*0.12);
      ctx.globalAlpha=1;
    }
  }
  DL.length = 0;
}

/* ---------- scene ---------- */
function draw(t){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,W,H);
  camBasis();
  const night = document.documentElement.getAttribute('data-tz-theme')==='night';
  const ink = night?'rgba(220,232,240,':'rgba(31,42,55,';
  const B=L.bounds;
  // background layer: floor + corridor paint (always behind everything)
  rasterPoly([[B.x0-2000,B.y0-2000,0],[B.x1+2000,B.y0-2000,0],[B.x1+2000,B.y1+2000,0],[B.x0-2000,B.y1+2000,0]],
    xray ? (night?'rgba(40,52,66,.18)':'rgba(190,205,220,.15)') : (night?'rgba(40,52,66,.45)':'rgba(190,205,220,.4)'));
  L.corridors.forEach(c=> rasterPoly(c.poly.map(p=>[p[0],p[1],8]), xray?'rgba(234,171,0,.06)':'rgba(234,171,0,.20)'));
  if(!xray) L.corridors.forEach(c=> rasterLine([c.x0,c.yMid,10],[c.x1,c.yMid,10],'rgba(234,171,0,.5)',1));

  // content layer: EVERYTHING goes through the display list so depth wins
  if(xray){
    ensureProducts();
    L.units.forEach(u=> u.prod.forEach(pr=> dlPallet(pr.p, pr.c)));
  } else {
    const tz = target ? target.z : null;
    L.units.forEach(u=>{
      if(u===target) return;
      const a = (tz==null || u.z===tz) ? 0.34 : 0.10;
      dlLine(u.a, u.b, ink+a+')', u.z===tz?1.4:1);
    });
    L.vehicles.forEach(v=>{
      const p=v.p, mast=300;
      dlBox([p[0]-900,p[1]-200,0],[p[0]+900,p[1]+200,300],'rgba(0,174,239,.35)','rgba(0,174,239,.55)');
      [-1,1].forEach(s=>{ const mx=p[0]+s*900;
        dlBox([mx-mast/2,p[1]-mast/2,0],[mx+mast/2,p[1]+mast/2,v.top],'rgba(0,174,239,.30)','rgba(0,174,239,.45)'); });
    });
  }
  let pulse = 0;
  if(target){
    const u=target; pulse=0.55+0.45*Math.sin(t/300);
    const x0=Math.min(u.a[0],u.b[0])-u.w/2, x1=Math.max(u.a[0],u.b[0])+u.w/2;
    const y0=Math.min(u.a[1],u.b[1])-u.w/2, y1=Math.max(u.a[1],u.b[1])+u.w/2;
    // neighbours on the same rack line: light context boxes (sorted with the rest)
    L.units.filter(n=>n!==u && n.z===u.z && Math.abs(n.a[0]-u.a[0])<200 &&
      Math.abs(n.mid[1]-u.mid[1])<13000).forEach(n=>{
        const nx0=Math.min(n.a[0],n.b[0])-n.w/2, nx1=Math.max(n.a[0],n.b[0])+n.w/2;
        const ny0=Math.min(n.a[1],n.b[1])-n.w/2, ny1=Math.max(n.a[1],n.b[1])+n.w/2;
        dlBox([nx0,ny0,n.z-60],[nx1,ny1,n.z+n.h], ink+'0.10)', ink+'0.16)'); });
    dlBox([x0,y0,u.z-60],[x1,y1,u.z+u.h], `rgba(224,60,49,${0.5*pulse+0.3})`, `rgba(224,60,49,${pulse})`);
  }
  dlFlush();
  // marker layer: beacon + label intentionally draw over the scene
  if(target){
    const u=target;
    rasterLine(u.mid, [u.mid[0],u.mid[1],u.mid[2]+2600], `rgba(224,60,49,${pulse})`, 2.5);
    const tipP=[u.mid[0],u.mid[1],u.mid[2]+2600];
    if(cdep(tipP) >= NEAR){
      const tip = proj(tipP);
      ctx.fillStyle=`rgba(224,60,49,${pulse})`; ctx.beginPath();
      ctx.arc(tip[0],tip[1],6,0,7); ctx.fill();
      ctx.font='700 12px -apple-system,Segoe UI,Roboto,sans-serif';
      ctx.fillText(target.id, tip[0]+10, tip[1]-2);
    }
  }
  if(recState || burnOnce) burnStrip(t);
}

/* ---- simulated pallet occupancy for X-ray mode (deterministic per unit) ---- */
const PROD_COLS = ['#d11f2d','#e7e2d4','#3f6fa3','#4f9d5c','#b98a3e'];
function ensureProducts(){
  if(L.units[0].prod) return;
  L.units.forEach(u=>{
    let h=0; for(const ch of u.id) h=(h*31+ch.charCodeAt(0))>>>0;
    const n=h%5, dir=norm(sub(u.b,u.a)); u.prod=[];
    for(let i=0;i<n;i++){
      const q=add(u.a, mul(dir, 700+i*1300+((h>>(i*3))%5)*40));
      q[2]=u.z+170+550;
      u.prod.push({ p:q, c:PROD_COLS[(h>>(i*2))%5] });
    }
  });
}

/* ---- evidence strip, burned into the canvas so it lives inside clips/snapshots ---- */
function burnStrip(t){
  const site = window.TZDB ? ((TZDB.all('sites')[0]||{}).name||'Site') : 'Site';
  const me = (window.TZDB && TZDB.current()) ? TZDB.current().name : '';
  const m = v=>(v/1000).toFixed(2);
  const h=46;
  ctx.fillStyle='rgba(6,12,18,.85)'; ctx.fillRect(0,H-h,W,h);
  ctx.fillStyle='#fff'; ctx.font='700 13px -apple-system,Segoe UI,Roboto,sans-serif';
  ctx.fillText(`${site} — ${target?target.id:'site overview'}${xray?' · X-RAY INVENTORY':''}`, 14, H-h+19);
  ctx.fillStyle='rgba(255,255,255,.68)'; ctx.font='10.5px -apple-system,Segoe UI,Roboto,sans-serif';
  ctx.fillText(`${target?`X ${m(target.mid[0])} · Y ${m(target.mid[1])} · Z ${m(target.mid[2])} m  ·  `:''}${new Date().toLocaleString('en-AU')}${me?'  ·  recorded by '+me:''}`, 14, H-h+36);
  ctx.textAlign='right';
  ctx.fillStyle='rgba(0,174,239,.95)'; ctx.font='800 10px -apple-system,Segoe UI,Roboto,sans-serif';
  ctx.fillText('TETRISIZE COMMISSIONING', W-14, H-h+19);
  if(recState){
    const left = Math.max(0, recState.dur - (performance.now()-recState.t0)/1000);
    if(Math.sin(t/220)>0){ ctx.fillStyle='#e03c31'; ctx.beginPath(); ctx.arc(W-92,H-h+31,4.5,0,7); ctx.fill(); }
    ctx.fillStyle='#fff'; ctx.font='700 11px -apple-system,Segoe UI,Roboto,sans-serif';
    ctx.fillText('REC '+Math.ceil(left)+'s', W-14, H-h+35);
  }
  ctx.textAlign='left';
}

/* ---- clip recorder (canvas.captureStream → MediaRecorder → .webm download) ---- */
function clipName(){
  const site = window.TZDB ? ((TZDB.all('sites')[0]||{}).name||'site') : 'site';
  return (site+'_'+(target?target.id:'overview')+'_'+new Date().toISOString().slice(0,16))
    .replace(/[^\w.-]+/g,'-');
}
function startRec(sec){
  if(recState || !canvas) return;
  if(typeof MediaRecorder==='undefined'){ if(window.TZC) TZC.toast('Recording unsupported in this browser'); return; }
  const stream = canvas.captureStream(60);
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
  const mr = new MediaRecorder(stream, { mimeType:mime, videoBitsPerSecond:8e6 });
  const chunks=[]; const name = clipName()+'.webm';
  mr.ondataavailable = e=>{ if(e.data.size) chunks.push(e.data); };
  mr.onstop = ()=>{
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob(chunks,{type:'video/webm'})); a.download=name; a.click();
    if(window.TZC) TZC.toast('Clip saved — '+name);
    if(autoClip && window.TZDB){
      TZDB.update('alarms', autoClip.alarmId, { clip_name:name });
      TZDB.log('fault_clip', target?target.id:'site', 'Recorded fault-locator clip '+name+' and attached it to the alarm.');
      autoClip=null;
    }
  };
  mr.start(250);
  recState = { mr, t0:performance.now(), dur:sec };
  syncRecUI();
}
function stopRec(){ if(!recState) return; try{ recState.mr.stop(); }catch(e){} recState=null; syncRecUI(); }
function syncRecUI(){ const b=$('#locRec'); if(b) b.textContent = recState ? '■ Stop' : '⏺ Record'; }
function snapshot(){
  burnOnce = true; draw(performance.now()); burnOnce = false;
  canvas.toBlob(b=>{ const a=document.createElement('a');
    a.href=URL.createObjectURL(b); a.download=clipName()+'.png'; a.click();
    if(window.TZC) TZC.toast('Snapshot saved'); }, 'image/png');
}

/* ---- cinematic presets ---- */
let dollyIdx = 0;
function panorama(){
  flight=null; patrol=null;
  const span = Math.max(L.bounds.x1-L.bounds.x0, L.bounds.y1-L.bounds.y0);
  orbit = { center:[L.center[0],L.center[1],1200], az:0.8, el:0.52, r:span*0.95, auto:0.07 };
  setPhase('Panorama — slow site orbit');
}
function corridorDolly(){
  flight=null; orbit=null; patrol=null;
  const c = L.corridors[dollyIdx++ % L.corridors.length], z=2300;
  flight = { wp:[
    { p:cam.pos.slice(),            look:[c.x1, c.yMid, z],        d:1.6, label:'Corridor dolly — entering' },
    { p:[c.x1+2500, c.yMid, z+900], look:[c.x0, c.yMid, z],        d:1.4, label:'Corridor dolly — entering' },
    { p:[c.x1, c.yMid, z],          look:[c.x0, c.yMid, z-200],    d:1.0, label:'Corridor dolly — transit' },
    { p:[c.x0, c.yMid, z],          look:[c.x0-9000, c.yMid, z-400], d:8.5, label:'Corridor dolly — transit' }
  ], t:0, seg:0 };
  setPhase('Corridor dolly — corridor '+(((dollyIdx-1)%L.corridors.length)+1));
}
function startPatrol(refs){
  const targets = (refs||[]).map(r=> L.units.find(u=>u.id===r) || mapSerial(r)).filter(Boolean);
  if(!targets.length){ if(window.TZC) TZC.toast('No open alarms to patrol'); return; }
  orbit=null; patrol = { targets, i:-1, dwellUntil:0 };
  nextPatrolLeg();
}
function nextPatrolLeg(){
  patrol.i++;
  if(patrol.i >= patrol.targets.length){ const done=patrol.targets.length; patrol=null;
    setPhase('Patrol complete — '+done+' alarm site'+(done>1?'s':'')+' toured'); return; }
  target = patrol.targets[patrol.i];
  updateTargetCard(null);
  flight = planFlight(target, cam.pos.slice());
  setPhase('Patrol '+(patrol.i+1)+'/'+patrol.targets.length+' — en route to '+target.id);
}

/* ---------- corridor-routed flight planning ---------- */
function planFlight(u, startPos){
  const B=L.bounds, C=L.center;
  const span = Math.max(B.x1-B.x0, B.y1-B.y0);
  const iso = add(C, [span*0.85, -span*0.62, span*0.78]);              // known ISO reference
  const startP = startPos || iso;
  // nearest marked corridor to the target
  const cor = L.corridors.slice().sort((a,b)=>Math.abs(a.yMid-u.mid[1])-Math.abs(b.yMid-u.mid[1]))[0];
  const FLY = 2300;                                                     // corridor drone height (mm)
  const entryX = (Math.abs(startP[0]-cor.x1) < Math.abs(startP[0]-cor.x0)) ? cor.x1+2500 : cor.x0-2500;
  const aisleX = u.mid[0] + 1650;                                       // hover line one aisle off the rack
  const wp = [
    { p: startP,                                look: startPos ? u.mid : C,       d: startPos ? 1.4 : 2.6, label: startPos ? 'Departing for next target' : 'ISO reference — site overview' },
    { p: [entryX, cor.yMid, FLY+1800],          look: [aisleX, cor.yMid, FLY],    d: 2.4, label:'Descending to corridor' },
    { p: [aisleX, cor.yMid, FLY],               look: [aisleX, u.mid[1], FLY],    d: 2.8, label:'Corridor transit — marked route' },
    { p: [aisleX, u.mid[1]+(u.mid[1]>cor.yMid?-4000:4000), Math.max(u.z+2400,2600)], look: u.mid, d: 2.6, label:'Aisle approach' },
    { p: [aisleX+3400, u.mid[1]-5200, u.z+3200], look: u.mid,                     d: 1.8, label:'On target' }
  ];
  return { wp, t:0, seg:0 };
}
function flyTick(dt){
  if(!flight) return;
  const seg = flight.wp[flight.seg], nxt = flight.wp[flight.seg+1];
  if(!nxt){ // arrived → patrol dwell, or hand over to gentle orbit
    flight = null;
    if(patrol){ patrol.dwellUntil = performance.now()+2400; setPhase('On target — '+target.id+' (patrol)'); return; }
    const u=target;
    if(u) orbit = { center:u.mid, az: Math.atan2(cam.pos[1]-u.mid[1], cam.pos[0]-u.mid[0]), el: 0.40,
              r: Math.max(len(sub(cam.pos,u.mid)), 8200), auto: 0.045 };
    setPhase('On target — '+(u?u.id:'site'));
    if(autoClip && recState){ // fault-clip: hold the hero shot ~2.5 s then finish the recording
      recState.dur = (performance.now()-recState.t0)/1000 + 2.5;
    }
    return;
  }
  flight.t += dt*speed/nxt.d;
  const k = ease(Math.min(1, flight.t));
  cam.pos = lerp3(seg.p, nxt.p, k);
  cam.look = lerp3(seg.look, nxt.look, k);
  if(flight.t>=1){ flight.t=0; flight.seg++; const n2=flight.wp[flight.seg+1]; setPhase(n2?flight.wp[flight.seg].label:'Arriving…'); }
}
function setPhase(s){ const e=$('#locPhase'); if(e) e.textContent=s; }

/* ---------- main loop ----------
   Hybrid driver: rAF for smooth 60 fps when the tab is visible, plus a
   watchdog interval that keeps frames flowing when the browser pauses rAF
   (background tabs, kiosk screens, recording while the operator works
   elsewhere). Time-based animation means flights stay on schedule. */
let lastT = 0, watchdog = null;
function startLoop(){
  cancelAnimationFrame(raf); if(watchdog) clearInterval(watchdog);
  lastT = 0; raf = requestAnimationFrame(frame);
  watchdog = setInterval(()=>{ if(canvas && performance.now()-lastT > 250) frame(performance.now()); }, 200);
}
function frame(t){
  if(!canvas) return;
  const dt = Math.min(0.3,(t-lastT)/1000)||0.016; lastT=t;
  if(flight) flyTick(dt);
  else if(patrol && performance.now() > patrol.dwellUntil) nextPatrolLeg();
  else if(orbit){
    orbit.az += orbit.auto*dt;
    const c = orbit.center || (target ? target.mid : L.center);
    cam.pos = [ c[0]+orbit.r*Math.cos(orbit.el)*Math.cos(orbit.az),
                c[1]+orbit.r*Math.cos(orbit.el)*Math.sin(orbit.az),
                c[2]+orbit.r*Math.sin(orbit.el) ];
    cam.look = c;
  }
  if(recState && (performance.now()-recState.t0)/1000 >= recState.dur) stopRec();
  draw(t);
  raf = requestAnimationFrame(frame);
}

/* ---------- overlay UI ---------- */
let cardInfo = null;
function updateTargetCard(info){
  if(info !== undefined) cardInfo = info;
  const el = $('#locTarget'); if(!el || !target) return;
  const lvl = L.levels.length ? (L.levels.slice().reverse().find(l=>target.z>=l.baseZ)||L.levels[0]).levelId : '—';
  const m = v=>(v/1000).toFixed(2)+' m';
  el.innerHTML = `
    <div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--tz-muted);font-weight:800">Target</div>
    <div style="font-size:15px;font-weight:800;color:var(--tz-orange)">${target.id}</div>
    ${cardInfo?`<div style="font-size:11px;margin:3px 0;max-width:230px">${cardInfo}</div>`:''}
    <div class="loc-kv"><span>X</span><b>${m(target.mid[0])}</b></div>
    <div class="loc-kv"><span>Y</span><b>${m(target.mid[1])}</b></div>
    <div class="loc-kv"><span>Z (belt)</span><b>${m(target.mid[2])}</b></div>
    <div class="loc-kv"><span>Level</span><b>${lvl}</b></div>
    <div style="font-size:10px;color:var(--tz-muted);margin-top:6px">Drag to orbit · scroll to zoom</div>`;
}
function open(unitRef, info, opts){
  load(()=>{
    target = typeof unitRef==='string'
      ? (L.units.find(u=>u.id===unitRef) || mapSerial(unitRef)) : null;
    if(!target) target = L.units[Math.floor(L.units.length/2)];
    xray=false; patrol=null; autoClip=null;
    let d = $('#tzcLoc');
    if(!d){ d=document.createElement('div'); d.id='tzcLoc'; document.body.appendChild(d); }
    d.innerHTML = `
      <canvas id="locCv"></canvas>
      <div class="loc-hud loc-top">
        <div><b style="font-size:14px">3D Fault Locator</b> <span class="tzc-pill">${L.units.length.toLocaleString()} IDBMs · ${L.vehicles.length} crane cars · ${L.corridors.length} marked corridors</span></div>
        <button class="tzc-btn" id="locGL" title="Switch to the WebGL beta engine">⚡ WebGL beta</button> <button class="tzc-btn" id="locClose">✕ Close</button></div>
      <div class="loc-hud loc-target" id="locTarget"></div>
      <div class="loc-hud loc-ctl" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">
          <button class="tzc-btn pri" id="locFly">▶ Fly the corridor route</button>
          <button class="tzc-btn" id="locPan" title="Slow orbit of the whole site">⌖ Panorama</button>
          <button class="tzc-btn" id="locDolly" title="Glide a marked corridor end to end">▷ Dolly</button>
          <button class="tzc-btn" id="locPatrol" title="Auto-tour every open alarm">⚐ Patrol alarms</button>
          <button class="tzc-btn" id="locIso">⌂ ISO</button>
          ${[1,2,4].map(s=>`<button class="tzc-btn locsp ${s===speed?'on':''}" data-locsp="${s}" style="padding:6px 9px">${s}×</button>`).join('')}
          <span id="locPhase" style="font-size:12px;font-weight:700;margin-left:6px">ISO reference — site overview</span></div>
        <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">
          <button class="tzc-btn" id="locRec" style="border-color:var(--tz-orange);color:var(--tz-orange)">⏺ Record</button>
          <select id="locRecDur" style="font:inherit;font-size:11.5px;padding:5px 8px;border:1px solid var(--tz-brd);border-radius:7px;background:var(--tz-panel-solid);color:var(--tz-ink)">
            <option value="10">10 s</option><option value="20" selected>20 s</option><option value="30">30 s</option></select>
          <button class="tzc-btn" id="locSnap">📷 Snapshot</button>
          <button class="tzc-btn" id="locXray" title="Ghost the structure — show only product">👁 X-ray inventory</button>
          <span style="font-size:10px;color:var(--tz-muted)">clips save as .webm with a burned-in evidence strip</span></div></div>`;
    canvas = $('#locCv'); ctx = canvas.getContext('2d');
    DPR = Math.min(window.devicePixelRatio||1, 2);
    const size = ()=>{ W=d.clientWidth; H=d.clientHeight; canvas.width=W*DPR; canvas.height=H*DPR; };
    size(); window.addEventListener('resize', size);
    // initial: ISO
    const B=L.bounds, span=Math.max(B.x1-B.x0,B.y1-B.y0);
    cam = { pos: add(L.center,[span*0.85,-span*0.62,span*0.78]), look: L.center.slice() };
    flight=null; orbit=null;
    updateTargetCard(info||null);
    $('#locClose').onclick = close;
    const glb = $('#locGL');
    if(glb) glb.onclick = () => { const t = target ? target.id : null; const inf = cardInfo; close();
      if(window.TZGL) TZGL.open(t, inf); };
    $('#locIso').onclick = ()=>{ flight=null; orbit=null; patrol=null;
      cam={ pos: add(L.center,[span*0.85,-span*0.62,span*0.78]), look:L.center.slice() };
      setPhase('ISO reference — site overview'); };
    $('#locFly').onclick = ()=>{ orbit=null; patrol=null; flight=planFlight(target); setPhase('Departing ISO reference'); };
    $('#locPan').onclick = panorama;
    $('#locDolly').onclick = corridorDolly;
    $('#locPatrol').onclick = ()=>{ const refs = window.TZDB ? TZDB.openAlarms().map(a=>a.idbm) : [];
      startPatrol(refs); };
    $('#locRec').onclick = ()=>{ recState ? stopRec() : startRec(+$('#locRecDur').value); };
    $('#locSnap').onclick = snapshot;
    $('#locXray').onclick = ()=>{ xray=!xray;
      $('#locXray').classList.toggle('on', xray);
      if(xray && window.TZC) TZC.toast('X-ray inventory — occupancy simulated in demo'); };
    d.querySelectorAll('[data-locsp]').forEach(b=>b.onclick=()=>{ speed=+b.dataset.locsp;
      d.querySelectorAll('.locsp').forEach(x=>x.classList.toggle('on',+x.dataset.locsp===speed)); });
    if(opts && opts.autoClip){       // one-click fault clip: record the whole flight + hero shot
      autoClip = { alarmId: opts.autoClip.alarmId };
      setTimeout(()=>{ startRec(30); flight=planFlight(target); setPhase('Recording fault clip — departing ISO'); }, 400);
    }
    // manual orbit drag (after arrival, or from ISO)
    let drag=null;
    canvas.addEventListener('pointerdown', e=>{ drag={x:e.clientX,y:e.clientY};
      if(!orbit && target){ const u=target.mid;
        orbit={ center:u, az:Math.atan2(cam.pos[1]-u[1],cam.pos[0]-u[0]), el:0.5, r:len(sub(cam.pos,u)), auto:0 }; }
      if(orbit) orbit.auto=0; });
    canvas.addEventListener('pointermove', e=>{ if(!drag||!orbit) return;
      orbit.az -= (e.clientX-drag.x)*0.008; orbit.el = Math.min(1.4,Math.max(0.06, orbit.el+(e.clientY-drag.y)*0.006));
      drag={x:e.clientX,y:e.clientY}; });
    window.addEventListener('pointerup', ()=>{ drag=null; });
    canvas.addEventListener('wheel', e=>{ if(orbit){ orbit.r=Math.min(span*2,Math.max(1200, orbit.r*(1+e.deltaY*0.001))); e.preventDefault(); } }, {passive:false});
    startLoop();
  });
}
function close(){ stopRec(); cancelAnimationFrame(raf); raf=0;
  if(watchdog){ clearInterval(watchdog); watchdog=null; }
  canvas=null; patrol=null; autoClip=null; xray=false;
  const d=$('#tzcLoc'); if(d) d.remove(); }

/* demo bridge: map the small-site serials (SN12 …) onto stable layout instances */
function mapSerial(sn){
  const n = parseInt(String(sn).replace(/\D/g,''),10)||1;
  return L.units[(n*73) % L.units.length];
}

return { open, close,
  getLayout: cb => load(()=>cb(L)),                 // share parsed layout with the WebGL engine
  currentTarget: () => target ? target.id : null };
})();
