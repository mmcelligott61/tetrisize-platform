/* ============================================================================
   TETRISIZE COMMISSIONING — WebGL Fault Locator (beta, build session 15)
   Rung 2 of the graphics ladder: Three.js (vendored locally — no internet
   needed on demo drives), all units rendered as ONE instanced draw call,
   real lighting + fog + a true depth buffer (no painter's-algorithm halos).
   Runs beside the canvas locator; same corridor-routed flight plan.
   Units: metres, Z-up (matches the layout export).
   ========================================================================== */
import * as THREE from '../vendor/three.module.js';

THREE.Object3D.DEFAULT_UP = new THREE.Vector3(0,0,1);

let renderer=null, scene=null, camera=null, L=null, ov=null;
let flight=null, orbit=null, speed=1, target=null, targetMesh=null, beacon=null, glow=null;
let lastT=0, watchdog=null;   // watchdog keeps frames flowing when the browser pauses rAF
let xray=false, pallets=null, unitsMesh=null, unitsMat=null, craneMats=[];
let recState=null, c2=null, ctx2=null;   // clip recorder: composite 2D canvas carries the evidence strip

const lerp3=(a,b,t)=>[a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const $=s=>document.querySelector(s);

/* ---------- scene build ---------- */
function build(layout, unitRef, info){
  // layout comes from TZLOC in mm — convert once to metres
  L = {
    units: layout.units.map(u=>({ id:u.id, sn:u.id, serial:u.id,
      a:u.a.map(v=>v/1000), b:u.b.map(v=>v/1000),
      mid:u.mid.map(v=>v/1000), w:u.w/1000, h:u.h/1000, z:u.z/1000 })),
    corridors: layout.corridors.map(c=>({ poly:c.poly.map(p=>[p[0]/1000,p[1]/1000]),
      yMid:c.yMid/1000, x0:c.x0/1000, x1:c.x1/1000 })),
    vehicles: layout.vehicles.map(v=>({ id:v.id, p:v.p.map(x=>x/1000), top:v.top/1000 })),
    levels: layout.levels,
    bounds: { x0:layout.bounds.x0/1000, x1:layout.bounds.x1/1000,
              y0:layout.bounds.y0/1000, y1:layout.bounds.y1/1000 },
    center: layout.center.map(v=>v/1000)
  };
  const night = document.documentElement.getAttribute('data-tz-theme')==='night';
  scene = new THREE.Scene();
  scene.background = new THREE.Color(night?0x0a0f16:0xdfe8f2);
  scene.fog = new THREE.FogExp2(night?0x0a0f16:0xdfe8f2, 0.0085);

  scene.add(new THREE.HemisphereLight(0xcfe2f0, 0x31404e, night?0.75:1.05));
  const sun = new THREE.DirectionalLight(0xffffff, night?0.9:1.5);
  sun.position.set(40,-28,55);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048);
  const sc = sun.shadow.camera;
  sc.left=-40; sc.right=40; sc.top=40; sc.bottom=-40; sc.near=5; sc.far=160;
  scene.add(sun); scene.add(sun.target);
  sun.target.position.set(0,-10,0);

  const B=L.bounds, spanX=B.x1-B.x0, spanY=B.y1-B.y0;
  // floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(spanX+8, spanY+8),
    new THREE.MeshStandardMaterial({ color: night?0x222c38:0xb9c7d6, roughness:0.96 }));
  floor.receiveShadow = true;
  floor.position.set((B.x0+B.x1)/2,(B.y0+B.y1)/2,0); scene.add(floor);
  // corridors (yellow paint)
  L.corridors.forEach(c=>{
    const xs=c.poly.map(p=>p[0]), ys=c.poly.map(p=>p[1]);
    const w=Math.max(...xs)-Math.min(...xs), h=Math.max(...ys)-Math.min(...ys);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
      new THREE.MeshBasicMaterial({ color:0xEAAB00, transparent:true, opacity:0.28 }));
    m.position.set(Math.min(...xs)+w/2, Math.min(...ys)+h/2, 0.012); scene.add(m);
  });
  // all units: ONE instanced draw call
  const geo=new THREE.BoxGeometry(1,1,1);
  const mat=new THREE.MeshStandardMaterial({ roughness:0.62, metalness:0.18 });
  const inst=new THREE.InstancedMesh(geo, mat, L.units.length);
  const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), S=new THREE.Vector3(), P=new THREE.Vector3();
  const tint={'0':new THREE.Color(0x5f7080),'2':new THREE.Color(0x6d7e8e),'4':new THREE.Color(0x7c8c9b)};
  L.units.forEach((u,i)=>{
    const len=Math.hypot(u.b[0]-u.a[0], u.b[1]-u.a[1]);
    const alongX=Math.abs(u.b[0]-u.a[0])>Math.abs(u.b[1]-u.a[1]);
    P.set(u.mid[0],u.mid[1],u.z+u.h/2);
    S.set(alongX?len:u.w, alongX?u.w:len, u.h);
    M.compose(P,Q,S); inst.setMatrixAt(i,M);
    inst.setColorAt(i, tint[String(Math.round(u.z))] || tint['0'] || new THREE.Color(0x6d7e8e));
  });
  inst.castShadow = true; inst.receiveShadow = true;
  inst.instanceColor.needsUpdate=true; scene.add(inst);
  unitsMesh = inst; unitsMat = mat; mat.transparent = true;
  // crane cars
  const craneMat=new THREE.MeshStandardMaterial({ color:0x00AEEF, transparent:true, opacity:0.85,
    emissive:0x00AEEF, emissiveIntensity:0.15, roughness:0.4 });
  craneMats=[craneMat];
  L.vehicles.forEach(v=>{
    const ch=new THREE.Mesh(new THREE.BoxGeometry(1.9,0.42,0.3), craneMat);
    ch.position.set(v.p[0],v.p[1],0.15); scene.add(ch);
    [-1,1].forEach(s=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,v.top), craneMat);
      m.position.set(v.p[0]+s*0.9, v.p[1], v.top/2); scene.add(m); });
  });
  // target
  target = (typeof unitRef==='string' && (L.units.find(u=>u.id===unitRef) || mapSerial(unitRef)))
           || L.units[Math.floor(L.units.length/2)];
  const tlen=Math.hypot(target.b[0]-target.a[0], target.b[1]-target.a[1]);
  targetMesh = new THREE.Mesh(new THREE.BoxGeometry(target.w+0.08, tlen+0.08, target.h+0.07),
    new THREE.MeshStandardMaterial({ color:0xE03C31, emissive:0xE03C31, emissiveIntensity:0.9, roughness:0.35 }));
  targetMesh.position.set(target.mid[0], target.mid[1], target.z+target.h/2);
  scene.add(targetMesh);
  beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,2.6,8),
    new THREE.MeshBasicMaterial({ color:0xE03C31, transparent:true, opacity:0.85 }));
  beacon.rotation.x = Math.PI/2;
  beacon.position.set(target.mid[0], target.mid[1], target.z+1.4);
  scene.add(beacon);
  glow = new THREE.PointLight(0xE03C31, 10, 9); glow.position.copy(targetMesh.position).z += 0.6;
  scene.add(glow);

  // camera at the ISO reference
  camera = new THREE.PerspectiveCamera(55, 1, 0.05, 600);
  camera.up.set(0,0,1);
  const span=Math.max(spanX,spanY);
  camera.position.set(L.center[0]+span*0.85, L.center[1]-span*0.62, span*0.78);
  camera.lookAt(L.center[0], L.center[1], 0);
  return info;
}
function mapSerial(sn){
  const n=parseInt(String(sn).replace(/\D/g,''),10)||1;
  return L.units[(n*73)%L.units.length];
}

/* ---------- X-ray inventory: simulated pallets as one instanced mesh ---------- */
const PROD_COLS=[0xd11f2d,0xe7e2d4,0x3f6fa3,0x4f9d5c,0xb98a3e];
function ensurePallets(){
  if(pallets) return;
  const items=[];
  L.units.forEach(u=>{
    let h=0; for(const ch of u.id) h=(h*31+ch.charCodeAt(0))>>>0;
    const n=h%5, dx=u.b[0]-u.a[0], dy=u.b[1]-u.a[1], len=Math.hypot(dx,dy)||1;
    for(let i=0;i<n;i++){
      const off=(0.7+i*1.3+((h>>(i*3))%5)*0.04)/len;
      items.push({ x:u.a[0]+dx*off, y:u.a[1]+dy*off, z:u.z+u.h+0.525, c:PROD_COLS[(h>>(i*2))%5] });
    }
  });
  const geo=new THREE.BoxGeometry(0.95,1.1,1.05);
  const mat=new THREE.MeshStandardMaterial({ roughness:0.7, metalness:0.05 });
  pallets=new THREE.InstancedMesh(geo, mat, items.length);
  const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), S=new THREE.Vector3(1,1,1), P=new THREE.Vector3();
  const C=new THREE.Color();
  items.forEach((it,i)=>{ P.set(it.x,it.y,it.z); M.compose(P,Q,S); pallets.setMatrixAt(i,M);
    pallets.setColorAt(i, C.setHex(it.c)); });
  pallets.castShadow=true; pallets.instanceColor.needsUpdate=true;
  pallets.visible=false; scene.add(pallets);
}
function setXray(on){
  xray=on; ensurePallets();
  pallets.visible=on;
  unitsMat.opacity = on?0.07:1; unitsMat.needsUpdate=true;
  craneMats.forEach(m=>{ m.opacity = on?0.10:0.85; });
  const b=$('#glXray'); if(b) b.classList.toggle('on', on);
}

/* ---------- click-to-retarget (raycast on the instanced mesh) ---------- */
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
function pick(e, cv){
  const r=cv.getBoundingClientRect();
  ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc, camera);
  const hit=ray.intersectObject(unitsMesh, false)[0];
  if(!hit || hit.instanceId==null) return;
  retarget(L.units[hit.instanceId]);
}
function retarget(u){
  target=u;
  const tlen=Math.hypot(u.b[0]-u.a[0], u.b[1]-u.a[1]);
  targetMesh.geometry.dispose();
  targetMesh.geometry=new THREE.BoxGeometry(u.w+0.08, tlen+0.08, u.h+0.07);
  targetMesh.position.set(u.mid[0],u.mid[1],u.z+u.h/2);
  beacon.position.set(u.mid[0],u.mid[1],u.z+1.4);
  glow.position.set(u.mid[0],u.mid[1],u.z+u.h/2+0.6);
  if(orbit) orbit.c=[u.mid[0],u.mid[1],u.z+0.1];
  updateCard();
  setPhase('Target — '+u.id);
}
function updateCard(){
  const el=$('#glTarget'); if(!el||!target) return;
  const m=v=>v.toFixed(2)+' m';
  const lvl=(L.levels||[]).length?(L.levels.slice().reverse().find(l=>target.z*1000>=l.baseZ)||L.levels[0]).levelId:'—';
  el.innerHTML=`<div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--tz-muted);font-weight:800">Target</div>
    <div style="font-size:15px;font-weight:800;color:var(--tz-orange)">${target.id}</div>
    <div class="loc-kv"><span>X</span><b>${m(target.mid[0])}</b></div>
    <div class="loc-kv"><span>Y</span><b>${m(target.mid[1])}</b></div>
    <div class="loc-kv"><span>Z (belt)</span><b>${m(target.z+0.11)}</b></div>
    <div class="loc-kv"><span>Level</span><b>${lvl}</b></div>
    <div style="font-size:10px;color:var(--tz-muted);margin-top:6px">Click any unit to retarget · drag to orbit</div>`;
}

/* ---------- clip recorder (composited evidence strip over the GL frame) ---------- */
function clipName(){
  const site=window.TZDB?((TZDB.all('sites')[0]||{}).name||'site'):'site';
  return (site+'_'+(target?target.id:'overview')+'_GL_'+new Date().toISOString().slice(0,16)).replace(/[^\w.-]+/g,'-');
}
function startRec(sec, cv){
  if(recState) return;
  if(!c2){ c2=document.createElement('canvas'); ctx2=c2.getContext('2d'); }
  c2.width=cv.width; c2.height=cv.height;
  const stream=c2.captureStream(60);
  const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
  const mr=new MediaRecorder(stream,{ mimeType:mime, videoBitsPerSecond:8e6 });
  const chunks=[]; const name=clipName()+'.webm';
  mr.ondataavailable=e=>{ if(e.data.size) chunks.push(e.data); };
  mr.onstop=()=>{ const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob(chunks,{type:'video/webm'})); a.download=name; a.click();
    if(window.TZC) TZC.toast('Clip saved — '+name); };
  mr.start(250);
  recState={ mr, t0:performance.now(), dur:sec, cv };
  const b=$('#glRec'); if(b) b.textContent='■ Stop';
}
function stopRec(){ if(!recState) return; try{ recState.mr.stop(); }catch(e){} recState=null;
  const b=$('#glRec'); if(b) b.textContent='⏺ Record'; }
function composite(t){
  const cv=recState.cv;
  if(c2.width!==cv.width||c2.height!==cv.height){ c2.width=cv.width; c2.height=cv.height; }
  ctx2.drawImage(cv,0,0);
  const W2=c2.width, H2=c2.height, h=Math.round(H2*0.055);
  const me=(window.TZDB&&TZDB.current())?TZDB.current().name:'';
  const site=window.TZDB?((TZDB.all('sites')[0]||{}).name||'Site'):'Site';
  const m=v=>v.toFixed(2);
  ctx2.fillStyle='rgba(6,12,18,.85)'; ctx2.fillRect(0,H2-h,W2,h);
  ctx2.fillStyle='#fff'; ctx2.font='700 '+Math.round(h*0.34)+'px -apple-system,Segoe UI,Roboto,sans-serif';
  ctx2.fillText(site+' — '+(target?target.id:'site')+(xray?' · X-RAY':''), 16, H2-h*0.55);
  ctx2.fillStyle='rgba(255,255,255,.68)'; ctx2.font=Math.round(h*0.26)+'px -apple-system,Segoe UI,Roboto,sans-serif';
  ctx2.fillText((target?('X '+m(target.mid[0])+' · Y '+m(target.mid[1])+' · Z '+m(target.z+0.11)+' m  ·  '):'')
    + new Date().toLocaleString('en-AU') + (me?'  ·  recorded by '+me:''), 16, H2-h*0.18);
  ctx2.textAlign='right'; ctx2.fillStyle='rgba(0,174,239,.95)';
  ctx2.font='800 '+Math.round(h*0.26)+'px -apple-system,Segoe UI,Roboto,sans-serif';
  ctx2.fillText('TETRISIZE COMMISSIONING · WEBGL', W2-16, H2-h*0.55);
  const left=Math.max(0, recState.dur-(performance.now()-recState.t0)/1000);
  if(Math.sin(t/220)>0){ ctx2.fillStyle='#e03c31'; ctx2.beginPath();
    ctx2.arc(W2-110, H2-h*0.26, h*0.13, 0, 7); ctx2.fill(); }
  ctx2.fillStyle='#fff'; ctx2.fillText('REC '+Math.ceil(left)+'s', W2-16, H2-h*0.18);
  ctx2.textAlign='left';
}

/* ---------- corridor-routed flight (same plan as the canvas engine, metres) ---------- */
function planFlight(u){
  const B=L.bounds, C=L.center, span=Math.max(B.x1-B.x0,B.y1-B.y0);
  const iso=[C[0]+span*0.85, C[1]-span*0.62, span*0.78];
  const cor=L.corridors.slice().sort((a,b)=>Math.abs(a.yMid-u.mid[1])-Math.abs(b.yMid-u.mid[1]))[0];
  const FLY=2.3;
  const entryX=(Math.abs(iso[0]-cor.x1)<Math.abs(iso[0]-cor.x0))?cor.x1+2.5:cor.x0-2.5;
  const aisleX=u.mid[0]+1.65;
  return { t:0, seg:0, wp:[
    { p:iso,                            look:[C[0],C[1],0],            d:2.6, label:'ISO reference — site overview' },
    { p:[entryX,cor.yMid,FLY+1.8],      look:[aisleX,cor.yMid,FLY],    d:2.4, label:'Descending to corridor' },
    { p:[aisleX,cor.yMid,FLY],          look:[aisleX,u.mid[1],FLY],    d:2.8, label:'Corridor transit — marked route' },
    { p:[aisleX,u.mid[1]+(u.mid[1]>cor.yMid?-4:4),Math.max(u.z+1.6,1.9)], look:u.mid, d:2.6, label:'Aisle approach' },
    { p:[aisleX-0.4,u.mid[1]-2.0,u.z+0.95], look:[u.mid[0],u.mid[1],u.z+0.1], d:1.8, label:'On target' } ] };
}
function setPhase(s){ const e=$('#glPhase'); if(e) e.textContent=s; }

/* ---------- main loop ---------- */
function tick(t){
  if(!renderer) return;
  const dt=Math.min(0.3,(t-lastT)/1000)||0.016; lastT=t;
  if(flight){
    const seg=flight.wp[flight.seg], nxt=flight.wp[flight.seg+1];
    if(!nxt){
      orbit={ az:Math.atan2(camera.position.y-target.mid[1], camera.position.x-target.mid[0]),
              el:0.22, r:Math.min(Math.max(camera.position.distanceTo(targetMesh.position),2.4),3.4), auto:0.045,
              c:[target.mid[0],target.mid[1],target.z+0.1] };
      setPhase('On target — '+target.id); flight=null;
    } else {
      flight.t += dt*speed/nxt.d;
      const k=ease(Math.min(1,flight.t));
      const p=lerp3(seg.p,nxt.p,k), lk=lerp3(seg.look,nxt.look,k);
      camera.position.set(p[0],p[1],p[2]); camera.lookAt(lk[0],lk[1],lk[2]);
      if(flight.t>=1){ flight.t=0; flight.seg++;
        const n2=flight.wp[flight.seg+1];
        setPhase(n2?flight.wp[flight.seg].label:'Arriving…'); }
    }
  } else if(orbit){
    orbit.az += orbit.auto*dt;
    const c=orbit.c;
    camera.position.set(c[0]+orbit.r*Math.cos(orbit.el)*Math.cos(orbit.az),
                        c[1]+orbit.r*Math.cos(orbit.el)*Math.sin(orbit.az),
                        c[2]+orbit.r*Math.sin(orbit.el));
    camera.lookAt(c[0],c[1],c[2]);
  }
  const pulse=0.55+0.45*Math.sin(t/280);
  if(targetMesh) targetMesh.material.emissiveIntensity = 0.45+0.75*pulse;
  if(beacon) beacon.material.opacity = 0.35+0.6*pulse;
  if(glow) glow.intensity = 4+9*pulse;
  renderer.render(scene,camera);
  if(recState){ composite(t);
    if((performance.now()-recState.t0)/1000 >= recState.dur) stopRec(); }
}

/* ---------- overlay / lifecycle ---------- */
function open(unitRef, info){
  if(window.TZLOC) TZLOC.close();
  close();
  TZLOC.getLayout(layout=>{
    let d=document.createElement('div'); d.id='tzcLoc'; ov=d; document.body.appendChild(d);
    build(layout, unitRef, info);
    const m=v=>v.toFixed(2)+' m';
    const lvl = (L.levels||[]).length ? (L.levels.slice().reverse().find(l=>target.z*1000>=l.baseZ)||L.levels[0]).levelId : '—';
    d.innerHTML += `
      <canvas id="glCv"></canvas>
      <div class="loc-hud loc-top">
        <div><b style="font-size:14px">3D Fault Locator</b> <span class="tzc-pill" style="background:var(--tz-cyan);color:#03252f">WEBGL BETA</span>
          <span class="tzc-pill">${L.units.length.toLocaleString()} IDBMs · 1 draw call · true depth buffer</span></div>
        <button class="tzc-btn" id="glClose">✕ Close</button></div>
      <div class="loc-hud loc-target" id="glTarget">
        <div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--tz-muted);font-weight:800">Target</div>
        <div style="font-size:15px;font-weight:800;color:var(--tz-orange)">${target.id}</div>
        ${info?`<div style="font-size:11px;margin:3px 0;max-width:230px">${info}</div>`:''}
        <div class="loc-kv"><span>X</span><b>${m(target.mid[0])}</b></div>
        <div class="loc-kv"><span>Y</span><b>${m(target.mid[1])}</b></div>
        <div class="loc-kv"><span>Z (belt)</span><b>${m(target.z+0.11)}</b></div>
        <div class="loc-kv"><span>Level</span><b>${lvl}</b></div>
        <div style="font-size:10px;color:var(--tz-muted);margin-top:6px">Drag to orbit · scroll to zoom</div></div>
      <div class="loc-hud loc-ctl">
        <button class="tzc-btn pri" id="glFly">▶ Fly the corridor route</button>
        <button class="tzc-btn" id="glIso">⌂ ISO</button>
        ${[1,2,4].map(s=>`<button class="tzc-btn glsp ${s===speed?'on':''}" data-glsp="${s}" style="padding:6px 9px">${s}×</button>`).join('')}
        <button class="tzc-btn" id="glXray" title="Product-only inventory view">👁 X-ray</button>
        <button class="tzc-btn" id="glRec" style="border-color:var(--tz-orange);color:var(--tz-orange)">⏺ Record</button>
        <select id="glRecDur" style="font:inherit;font-size:11.5px;padding:5px 8px;border:1px solid var(--tz-brd);border-radius:7px;background:var(--tz-panel-solid);color:var(--tz-ink)">
          <option value="10">10 s</option><option value="20" selected>20 s</option><option value="30">30 s</option></select>
        <span id="glPhase" style="font-size:12px;font-weight:700;margin-left:6px">ISO reference — site overview</span></div>`;
    updateCard();
    const cv=$('#glCv');
    renderer=new THREE.WebGLRenderer({ canvas:cv, antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const size=()=>{ const w=d.clientWidth,h=d.clientHeight; renderer.setSize(w,h,false);
      camera.aspect=w/h; camera.updateProjectionMatrix(); };
    size(); window.addEventListener('resize',size);
    $('#glClose').onclick=close;
    $('#glFly').onclick=()=>{ orbit=null; flight=planFlight(target); setPhase('Departing ISO reference'); };
    $('#glIso').onclick=()=>{ flight=null; orbit=null;
      const span=Math.max(L.bounds.x1-L.bounds.x0,L.bounds.y1-L.bounds.y0);
      camera.position.set(L.center[0]+span*0.85,L.center[1]-span*0.62,span*0.78);
      camera.lookAt(L.center[0],L.center[1],0); setPhase('ISO reference — site overview'); };
    d.querySelectorAll('[data-glsp]').forEach(b=>b.onclick=()=>{ speed=+b.dataset.glsp;
      d.querySelectorAll('.glsp').forEach(x=>x.classList.toggle('on',+x.dataset.glsp===speed)); });
    $('#glXray').onclick = ()=>{ setXray(!xray);
      if(xray && window.TZC) TZC.toast('X-ray inventory — occupancy simulated in demo'); };
    $('#glRec').onclick = ()=>{ recState ? stopRec() : startRec(+$('#glRecDur').value, cv); };
    let drag=null, downAt=null;
    cv.addEventListener('pointerdown',e=>{ drag={x:e.clientX,y:e.clientY}; downAt={x:e.clientX,y:e.clientY};
      if(!orbit){ const c=[target.mid[0],target.mid[1],target.z];
        orbit={ c, az:Math.atan2(camera.position.y-c[1],camera.position.x-c[0]),
                el:0.5, r:camera.position.distanceTo(new THREE.Vector3(...c)), auto:0 }; }
      orbit.auto=0; });
    cv.addEventListener('pointermove',e=>{ if(!drag||!orbit) return;
      orbit.az-=(e.clientX-drag.x)*0.008;
      orbit.el=Math.min(1.45,Math.max(0.05,orbit.el+(e.clientY-drag.y)*0.006));
      drag={x:e.clientX,y:e.clientY}; });
    window.addEventListener('pointerup',e=>{
      if(downAt && Math.abs(e.clientX-downAt.x)<5 && Math.abs(e.clientY-downAt.y)<5 && e.target===cv) pick(e, cv);
      drag=null; downAt=null; });
    cv.addEventListener('wheel',e=>{ if(orbit){ orbit.r=Math.min(300,Math.max(1.2,orbit.r*(1+e.deltaY*0.001))); e.preventDefault(); } },{passive:false});
    lastT=0;
    renderer.setAnimationLoop(tick);
    watchdog = setInterval(()=>{ if(renderer && performance.now()-lastT > 250) tick(performance.now()); }, 200);
  });
}
function close(){
  if(watchdog){ clearInterval(watchdog); watchdog=null; }
  if(renderer){ renderer.setAnimationLoop(null); renderer.dispose(); renderer=null; }
  if(ov){ ov.remove(); ov=null; }
  scene=null; camera=null; flight=null; orbit=null; targetMesh=null; beacon=null; glow=null;
}

window.TZGL = { open, close };
