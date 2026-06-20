/* ============================================================================
   TETRISIZE PLATFORM — shared UI kit (behaviour)
   Injects the branded menu bar on every screen, manages day/night theme,
   hosts the reusable speed slider, and (on the Viewer) the ViewCube + Layers
   controls. Screens declare themselves via window.TZ_SCREEN before this loads,
   and receive events through window.TZ_HOOKS = { onSpeed(v), setView(name),
   rotate(dir), fit(), setLayer(cls,state), persp(on), getCam(), setCam(az,el,fit) }.
   getCam/setCam power the 3D glass ViewCube; without them the flat grid is used.
   ========================================================================== */
(function(){
  'use strict';
  const TZ_VERSION = 'v0.9 · build 2026-06-12';
  const SCREEN = window.TZ_SCREEN || 'viewer';
  const SPEEDS = [1,2,5,10,25,50];
  const LS = k => { try { return localStorage.getItem(k); } catch(e){ return null; } };
  const LSset = (k,v) => { try { localStorage.setItem(k,v); } catch(e){} };

  const UI = window.TZ_UI = {
    speed: +(LS('tz-speed')||1),   // DEFAULT 1× = real time (belt 18 m/min, car 1 m/s). The slider is the user's explicit time-lapse control; we never silently fast-forward.
    theme: LS('tz-theme')||'day',
    layers: { products:'visible', idbms:'visible', vehicles:'visible', structure:'visible' },
    floor: { surface: 'grid', color: LS('tz-floor-color')||'concrete' },   // every boot opens in GRID survey mode (colour is remembered; surface is per-session)
    hooks: () => window.TZ_HOOKS || {}
  };
  document.documentElement.setAttribute('data-tz-theme', UI.theme);
  /* glass effects: backdrop blur over an animating canvas is very expensive on Windows
     compositors (Edge/Chrome) — default to LITE there; overridable in the Layers menu */
  UI.glass = LS('tz-glass') || (/Windows/i.test(navigator.userAgent) ? 'lite' : 'full');
  document.documentElement.classList.toggle('tz-lite', UI.glass==='lite');

  const TABS = [
    { id:'configurator', label:'CONFIGURATOR', href:'configurator_idbm_v0.2.html' },
    { id:'viewer',       label:'VIEWER 3D',    href:'viewer_3d.html' },
    { id:'brainops',     label:'BRAIN OPS',    href:'brainops.html' },
    { id:'maintenance',  label:'MAINTENANCE',  href:'maintenance.html' },
    { id:'benchmark',    label:'BENCHMARK',    href:'benchmark.html' },
    { id:'reports',      label:'REPORTS',      href:'reports.html' },
    { id:'commissioning',label:'COMMISSIONING',href:'commissioning.html' }
  ];

  function el(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstChild; }

  // ---- shared: make any overlay panel draggable (grab a non-control area) + add a × close ----
  UI.dragify = function(panel, handle){
    if(!panel || panel._tzDrag) return; panel._tzDrag = true;
    handle = handle || panel; handle.style.cursor = 'move';
    let on=false, sx=0, sy=0, ox=0, oy=0;
    handle.addEventListener('pointerdown', e=>{
      if(e.button!==0) return;
      if(e.target.closest('button,input,select,textarea,a,[data-cls],[data-s],[data-c],[data-g],.lensval,.lensfacet,.scenbtn,.lensmode')) return;  // never start a drag on a control
      on=true; sx=e.clientX; sy=e.clientY; const r=panel.getBoundingClientRect(); ox=r.left; oy=r.top;
      panel.style.position='fixed'; panel.style.left=ox+'px'; panel.style.top=oy+'px'; panel.style.right='auto'; panel.style.bottom='auto'; panel.style.margin='0';
      try{ handle.setPointerCapture(e.pointerId); }catch(_){}
    });
    handle.addEventListener('pointermove', e=>{ if(!on) return; const dx=e.clientX-sx, dy=e.clientY-sy;
      if(Math.abs(dx)+Math.abs(dy)>3) panel._tzMoved=Date.now();
      panel.style.left=Math.max(0,ox+dx)+'px'; panel.style.top=Math.max(0,oy+dy)+'px'; });
    const end=e=>{ if(!on)return; on=false; try{ handle.releasePointerCapture(e.pointerId); }catch(_){} };
    handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
  };
  UI.addClose = function(panel, onClose){
    if(!panel || panel.querySelector(':scope > .tz-x')) return;
    if(getComputedStyle(panel).position==='static') panel.style.position='relative';
    const x=el('<button class="tz-x" title="Close" aria-label="Close">×</button>');
    x.style.cssText='position:absolute;top:5px;right:7px;border:none;background:transparent;color:var(--tz-muted,#8a94a3);font:16px/1 system-ui;cursor:pointer;padding:2px 5px;z-index:6';
    x.onclick=ev=>{ ev.stopPropagation(); onClose ? onClose() : (panel.style.display='none'); };
    panel.appendChild(x);
  };

  function buildBar(){
    const tabs = TABS.map(t => t.soon
      ? `<span class="tz-tab soon" data-tab="${t.id}">${t.label}<span class="tz-pill">SOON</span></span>`
      : `<a class="tz-tab ${t.id===SCREEN?'on':''}" data-tab="${t.id}" href="${t.href}">${t.label}</a>`).join('');
    const speed = SCREEN==='viewer'
      ? `<div class="tz-speed"><label>SPEED</label><input id="tzSpeed" type="range" min="0" max="${SPEEDS.length-1}" step="1"
           value="${Math.max(0,SPEEDS.indexOf(UI.speed))}"><span class="tz-speedval" id="tzSpeedVal">${UI.speed}&times;</span></div>` : '';
    const bar = el(`<div id="tzBar">
        <img class="tz-logo" id="tzLogo" alt="Tetrisize">
        <div class="tz-tabs">${tabs}</div>
        <div class="tz-right">${speed}
          ${SCREEN==='viewer' ? '<button class="tz-iconbtn" id="tzLayersBtn" title="Layer visibility">Layers</button>' : ''}
          <button class="tz-iconbtn" id="tzTheme" title="Day / night theme">☾</button>
        </div></div>`);
    document.body.prepend(bar);
    applyTheme();
    let logoClicks=0, logoTimer=null;                                                     // hidden Quote: triple-click the logo
    document.getElementById('tzLogo').onclick = () => { logoClicks++; clearTimeout(logoTimer);
      if(logoClicks>=3){ logoClicks=0; location.href='quote.html'; }
      else logoTimer=setTimeout(()=>{logoClicks=0;},700); };
    const themeBtn = document.getElementById('tzTheme');
    themeBtn.onclick = () => { UI.theme = UI.theme==='day' ? 'night' : 'day'; LSset('tz-theme', UI.theme);
      document.documentElement.setAttribute('data-tz-theme', UI.theme); applyTheme();
      if(UI.hooks().theme) UI.hooks().theme(UI.theme); };
    const sl = document.getElementById('tzSpeed');
    if(sl){ sl.oninput = () => { UI.speed = SPEEDS[+sl.value]; LSset('tz-speed', UI.speed);
      document.getElementById('tzSpeedVal').innerHTML = UI.speed+'&times;';
      if(UI.hooks().onSpeed) UI.hooks().onSpeed(UI.speed); }; }
    const lb = document.getElementById('tzLayersBtn');
    if(lb){ lb.onclick = () => { const p=document.getElementById('tzLayers');
      if(p) p.style.display = p.style.display==='block' ? 'none' : 'block'; }; }
  }
  function applyTheme(){
    const logo = document.getElementById('tzLogo');
    if(logo) logo.src = 'assets/' + (UI.theme==='night' ? 'logo_dark.png' : 'logo_dark.png');
    const tb = document.getElementById('tzTheme'); if(tb) tb.textContent = UI.theme==='day' ? '☾' : '☀';
  }

  /* ---- ViewCube: 3D "Apple glass" orientation widget (Khan et al., I3D 2008) ----
     Clickable faces / edges / corners of the UPPER hemisphere only — 17 views; the
     bottom face, bottom edges and bottom corners do not exist (el is clamped ≥ 0 so
     the camera can never look up from below floor level). Rounded-box geometry with
     translucent fills + a backdrop-blur layer clipped live to the cube silhouette. */
  function buildCube(){
    if(!UI.hooks().getCam){ buildCubeFlat(); return; }                  // screens without camera hooks keep the flat grid
    const SZ=140, R=0.32, K=33, CXp=SZ/2, CYp=SZ/2-3, PI=Math.PI, sin=Math.sin, cos=Math.cos;   // R: edge radius — generous, water-droplet rounding
    const cube = el(`<div id="tzCube">
      <div class="tz-cube-stage">
        <div class="tz-cube-glass"></div>
        <canvas id="tzCubeCv" width="${SZ}" height="${SZ}"></canvas>
      </div>
      <div class="tz-cube-foot">
        <button class="tz-btn" data-view="iso" title="Isometric view">ISO</button>
        <button class="tz-btn" id="tzFit" title="Zoom to extents">FIT</button>
        <button class="tz-btn" id="tzPersp" title="Orthographic / perspective">ORTHO</button>
      </div></div>`);
    document.body.appendChild(cube);
    cube.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { const h=UI.hooks(); if(h.setView) h.setView(b.getAttribute('data-view')); });
    document.getElementById('tzFit').onclick = () => { const h=UI.hooks(); if(h.fit) h.fit(); };
    document.getElementById('tzPersp').onclick = (e) => { const h=UI.hooks(); if(h.persp){ const on=h.persp(); e.target.textContent = on ? 'PERSP' : 'ORTHO'; } };

    const cv=document.getElementById('tzCubeCv'), ctx=cv.getContext('2d'), glass=cube.querySelector('.tz-cube-glass');
    const dpr=window.devicePixelRatio||1; cv.width=SZ*dpr; cv.height=SZ*dpr;
    let cAz=0.86, cEl=0.62, hover=null, near=null, anim=null, pdown=null, moved=0;
    /* canvas buttons: 3D rotate rings at the base corners + hold-to-save Home up top */
    const BTNS={ ccw:[19,SZ-15], cw:[SZ-19,SZ-15], home:[16,15] };
    const TIPS={ ccw:'Rotate the view 90° (as the arrow sweeps)', cw:'Rotate the view 90° (as the arrow sweeps)',
                 home:'Home view — click: go there · hold 1.5s: save this exact view' };
    const HOLD_MS=1500;
    let btnHover=null, btnDown=null, holdT0=0, holdDone=false, savedFlash=0;
    const btnAt=(x,y)=>{ for(const k in BTNS){ const b=BTNS[k]; if(Math.hypot(x-b[0],y-b[1])<=14) return k; } return null; };
    function goHome(){ const h=UI.hooks(); let s=null; try{ s=JSON.parse(LS('tz-home-view')||'null'); }catch(e){}
      if(s&&h.applyCamState) h.applyCamState(s); else if(h.setView) h.setView('iso'); }
    function saveHome(){ const h=UI.hooks(); if(h.camState){ LSset('tz-home-view', JSON.stringify(h.camState())); savedFlash=performance.now(); } }

    /* vector + projection helpers — the same orthographic camera as the scene */
    const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    const A3=(p,q,s)=>[p[0]+q[0]*s, p[1]+q[1]*s, p[2]+q[2]*s];
    const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    const norm=a=>{const l=Math.hypot(a[0],a[1],a[2]);return [a[0]/l,a[1]/l,a[2]/l];};
    const LIT=norm([0.35,-0.5,0.85]);                                   // key light: high, front-left — top face brightest
    const wrap=a=>{ while(a>PI)a-=2*PI; while(a<-PI)a+=2*PI; return a; };
    function proj(p){ const ca=cos(cAz),sa=sin(cAz),se=sin(cEl),ce=cos(cEl),dx=p[0],dy=-p[1],dz=p[2];
      return [CXp+(dx*ca-dy*sa)*K, CYp+((dx*sa+dy*ca)*se-dz*ce)*K]; }
    const viewDir=()=>[sin(cAz)*cos(cEl), -cos(cAz)*cos(cEl), sin(cEl)];
    const poly=P=>{ ctx.beginPath(); ctx.moveTo(P[0][0],P[0][1]); for(let k=1;k<P.length;k++)ctx.lineTo(P[k][0],P[k][1]); ctx.closePath(); };

    /* faces: labels follow screen geometry (the face you see on the right reads RIGHT) */
    const F=[
      {n:[0,0,1],  u:[1,0,0],  v:[0,-1,0], lab:'TOP'},
      {n:[0,-1,0], u:[1,0,0],  v:[0,0,-1], lab:'FRONT'},
      {n:[0,1,0],  u:[-1,0,0], v:[0,0,-1], lab:'BACK'},
      {n:[1,0,0],  u:[0,1,0],  v:[0,0,-1], lab:'RIGHT'},
      {n:[-1,0,0], u:[0,-1,0], v:[0,0,-1], lab:'LEFT'} ];               // no bottom face: never visible, never selectable
    const PIECES=[]; for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=0;z<=1;z++){ if(x||y||z) PIECES.push([x,y,z]); }
    function targetFor(d){                                              // piece direction -> exact az/el (floor level = el 0 = TRUE elevation, top = 1.5)
      if(!d[0]&&!d[1]) return {az:Math.round(cAz/(PI/2))*(PI/2), el:1.5};
      return {az:Math.atan2(d[0],-d[1]), el:d[2]?Math.atan2(d[2],Math.hypot(d[0],d[1])):0}; }

    function pick(mx,my){ const vd=viewDir(); let best=null;
      for(const f of F){ const dv=dot(f.n,vd); if(dv<=0.02)continue;
        const p0=proj(f.n), e=1-R;
        const pu=[proj(A3(f.n,f.u,e))[0]-p0[0], proj(A3(f.n,f.u,e))[1]-p0[1]];
        const pv=[proj(A3(f.n,f.v,e))[0]-p0[0], proj(A3(f.n,f.v,e))[1]-p0[1]];
        const det=pu[0]*pv[1]-pu[1]*pv[0]; if(Math.abs(det)<1e-6)continue;
        const wx=mx-p0[0], wy=my-p0[1];
        const a=(wx*pv[1]-wy*pv[0])/det, b=(wy*pu[0]-wx*pu[1])/det;     // logical face coords, ±1 at plate rim
        const bMax = f.n[2]===0 ? 1/(1-R)+0.05 : 1.04;                  // side plates are pickable down to the floor line
        if(Math.abs(a)>1.04||b<-1.04||b>bMax)continue;
        if(!best||dv>best.dv){ const T=0.42, i=a>T?1:(a<-T?-1:0), j=b>T?1:(b<-T?-1:0);
          const d=[f.n[0]+i*f.u[0]+j*f.v[0], f.n[1]+i*f.u[1]+j*f.v[1], Math.max(0,f.n[2]+i*f.u[2]+j*f.v[2])];  // below-floor pieces clamp to floor level
          best={dv:dv,d:d}; } }
      if(best) return best.d;
      const e=1-R;                                                       // the rounded regions are pickable too:
      for(const sx of[-1,1])for(const sy of[-1,1]){                      // top corner spheres (the base is flat — no bottom corners)
        if(dot(norm([sx,sy,1]),vd)<0.10)continue;
        const c=proj([sx*e,sy*e,e]);
        if(Math.hypot(mx-c[0],my-c[1])<=R*K*1.15) return [sx,sy,1]; }
      for(let a=0;a<F.length;a++)for(let b=a+1;b<F.length;b++){ const A=F[a],B=F[b];   // edge bevels
        if(dot(A.n,B.n)!==0||dot(A.n,vd)<=0.02||dot(B.n,vd)<=0.02)continue;
        const ax=cross(A.n,B.n), m=(1+e)/2;
        const O=proj(A3(A3([0,0,0],A.n,m),B.n,m));
        const U=[proj(A3(A3(A3([0,0,0],ax,e),A.n,m),B.n,m))[0]-O[0], proj(A3(A3(A3([0,0,0],ax,e),A.n,m),B.n,m))[1]-O[1]];
        const W=[proj(A3(A3([0,0,0],A.n,e),B.n,1))[0]-O[0], proj(A3(A3([0,0,0],A.n,e),B.n,1))[1]-O[1]];
        const det=U[0]*W[1]-U[1]*W[0]; if(Math.abs(det)<1e-6)continue;
        const wx=mx-O[0], wy=my-O[1];
        const t=(wx*W[1]-wy*W[0])/det, s=(wy*U[0]-wx*U[1])/det;
        let tMin=-1.06, tMax=1.06;                                       // vertical bevels are pickable down to the floor
        if(ax[2]>0)tMin=-(1/e+0.06); else if(ax[2]<0)tMax=1/e+0.06;
        if(t<tMin||t>tMax||Math.abs(s)>1.30)continue;
        const k=t>1/3?1:(t<-1/3?-1:0);
        return [A.n[0]+B.n[0]+k*ax[0], A.n[1]+B.n[1]+k*ax[1], Math.max(0,A.n[2]+B.n[2]+k*ax[2])]; }
      return null; }

    function flyTo(t){ anim={t0:performance.now(), dur:450, a0:cAz, a1:cAz+wrap(t.az-cAz), e0:cEl, e1:t.el}; }
    function snapMaybe(){ let best=null, bd=0.14;                       // snap-and-go: settle onto a fixed view if released within ~8°
      for(const d of PIECES){ const t=targetFor(d), dd=Math.hypot(wrap(cAz-t.az)*Math.max(0.3,cos(cEl)), cEl-t.el);
        if(dd<bd){ bd=dd; best=t; } }
      if(best) flyTo(best); }

    cv.addEventListener('pointerdown', e=>{ const b=btnAt(e.offsetX,e.offsetY);
      if(b){ btnDown=b; holdT0=performance.now(); holdDone=false; cv.setPointerCapture(e.pointerId); return; }
      pdown=[e.offsetX,e.offsetY]; moved=0; anim=null; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e=>{
      if(btnDown) return;                                                // pressing a canvas button: no orbit, no re-hover
      if(pdown&&(e.buttons&1)){ const dx=e.offsetX-pdown[0], dy=e.offsetY-pdown[1]; moved+=Math.abs(dx)+Math.abs(dy);
        if(moved>3){ const h=UI.hooks(); cAz-=dx*0.011; cEl=Math.max(0,Math.min(1.5,cEl+dy*0.008)); if(h.setCam)h.setCam(cAz,cEl,false); hover=null; }
        pdown=[e.offsetX,e.offsetY]; }
      else { btnHover=btnAt(e.offsetX,e.offsetY); hover=btnHover?null:pick(e.offsetX,e.offsetY);
        cv.style.cursor=(btnHover||hover)?'pointer':'default'; cv.title=btnHover?TIPS[btnHover]:''; } });
    cv.addEventListener('pointerup', e=>{
      if(btnDown){ const b=btnAt(e.offsetX,e.offsetY), p=btnDown; btnDown=null;
        if(b!==p) return;
        if(p==='home'){ if(holdDone){} else if(performance.now()-holdT0>=HOLD_MS) saveHome(); else goHome(); }   // long hold saves (even if the tick missed it); short press navigates home
        else { const h=UI.hooks(); if(h.rotate) h.rotate(p==='cw'?'ccw':'cw'); }   // swapped: the scene should turn the way the arrow sweeps
        return; }
      const wasDrag=moved>4; pdown=null;
      if(wasDrag) snapMaybe(); else { const d=pick(e.offsetX,e.offsetY); if(d) flyTo(targetFor(d)); } });
    cv.addEventListener('pointerleave', ()=>{ hover=null; btnHover=null; });

    function draw(){
      const vd=viewDir(), night=document.documentElement.getAttribute('data-tz-theme')==='night';
      ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,SZ,SZ);
      const vis=F.filter(f=>dot(f.n,vd)>0.02).sort((a,b)=>dot(a.n,vd)-dot(b.n,vd));
      /* soft drop shadow with a caustic hot-spot — light focused through the droplet */
      const sp=proj([0,0,-1.12]);
      ctx.save(); ctx.translate(sp[0],sp[1]); ctx.scale(1,Math.max(0.18,sin(cEl)*0.85));
      const sg=ctx.createRadialGradient(0,0,2,0,0,K*1.25);
      sg.addColorStop(0, night?'rgba(160,210,255,0.30)':'rgba(255,255,255,0.55)');
      sg.addColorStop(0.32, night?'rgba(0,0,0,0.45)':'rgba(15,30,55,0.22)');
      sg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(0,0,K*1.25,0,7); ctx.fill(); ctx.restore();
      /* glass body silhouette: top corners are spheres, but the base is FLAT — a sharp
         floor line (no bottom rounding) so nothing implies a view from below ground */
      const hp=[], s1=1-R;
      for(const sx of[-1,1])for(const sy of[-1,1]){
        const ct=proj([sx*s1,sy*s1,s1]);
        for(let t=0;t<16;t++){ const a=t/8*PI; hp.push([ct[0]+cos(a)*R*K, ct[1]+sin(a)*R*K]); }      // top corner spheres
        for(let t=0;t<16;t++){ const a=t/8*PI; hp.push(proj([sx*s1+cos(a)*R, sy*s1+sin(a)*R, -1])); } }  // bottom: cylinder rims sitting on the floor
      hp.sort((p,q)=>p[0]-q[0]||p[1]-q[1]);
      const cr2=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
      const lo=[], hi=[];
      for(const p of hp){ while(lo.length>1&&cr2(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop(); lo.push(p); }
      for(let k=hp.length-1;k>=0;k--){ const p=hp[k]; while(hi.length>1&&cr2(hi[hi.length-2],hi[hi.length-1],p)<=0)hi.pop(); hi.push(p); }
      const hull=lo.concat(hi.slice(1,-1));
      if(UI.glass!=='lite') glass.style.clipPath='polygon('+hull.map(p=>p[0].toFixed(1)+'px '+p[1].toFixed(1)+'px').join(',')+')';   // per-frame backdrop reclip is wasted work in LITE (layer is display:none)
      const bg=ctx.createLinearGradient(CXp-K*1.7,CYp-K*1.7,CXp+K*1.7,CYp+K*1.7);
      if(night){ bg.addColorStop(0,'rgba(170,200,235,0.14)'); bg.addColorStop(1,'rgba(40,60,90,0.18)'); }
      else     { bg.addColorStop(0,'rgba(255,255,255,0.45)'); bg.addColorStop(1,'rgba(208,222,242,0.25)'); }
      poly(hull); ctx.fillStyle=bg; ctx.fill();
      /* face plates: rounded rects inset by the edge radius; side plates run flush to the
         floor with sharp bottom corners (the base has no bevel). No outline strokes —
         the fills blend straight into the bevels for a clean glass read */
      function platePts(f){ const e=1-R, rr=0.12, pts=[], side=f.n[2]===0;
        for(let k=0;k<4;k++){ const su=[1,-1,-1,1][k], sv=[1,1,-1,-1][k];
          if(side&&sv===1){ pts.push(proj(A3(A3(f.n,f.u,su*e),f.v,1))); continue; }   // sharp corner on the floor line
          for(let t=0;t<=5;t++){ const th=(k*90+t*18)*PI/180;
            pts.push(proj(A3(A3(f.n,f.u,su*(e-rr)+cos(th)*rr), f.v, sv*(e-rr)+sin(th)*rr))); } }
        return pts; }
      for(const f of vis){ const b=Math.max(0,dot(f.n,LIT)), P=platePts(f); poly(P);
        ctx.fillStyle = night ? `rgba(175,205,240,${(0.10+0.18*b).toFixed(3)})` : `rgba(255,255,255,${(0.22+0.34*b).toFixed(3)})`;
        ctx.fill();
        if(f.n[2]===1){ const g2=ctx.createLinearGradient(CXp-K,CYp-K,CXp+K*0.6,CYp+K*0.2);   // sheen across the top plate
          g2.addColorStop(0,'rgba(255,255,255,0.46)'); g2.addColorStop(1,'rgba(255,255,255,0)');
          ctx.fillStyle=g2; ctx.fill(); } }
      /* edge bevels between visible face pairs — the glass edges that catch the light */
      for(let i=0;i<vis.length;i++)for(let j=i+1;j<vis.length;j++){ const A=vis[i],B=vis[j];
        if(dot(A.n,B.n)!==0)continue; const ax=cross(A.n,B.n);
        let t0=-s1, t1=s1; if(ax[2]>0)t0=-1; else if(ax[2]<0)t1=1;     // vertical-edge bevels run flush to the floor
        const q=[A3(A3(A3([0,0,0],ax,t0),A.n,1),B.n,s1), A3(A3(A3([0,0,0],ax,t1),A.n,1),B.n,s1),
                 A3(A3(A3([0,0,0],ax,t1),A.n,s1),B.n,1),  A3(A3(A3([0,0,0],ax,t0),A.n,s1),B.n,1)].map(proj);
        const m1=[(q[0][0]+q[1][0])/2,(q[0][1]+q[1][1])/2], m2=[(q[2][0]+q[3][0])/2,(q[2][1]+q[3][1])/2];
        const spec=Math.pow(Math.max(0,dot(norm(A3(A.n,B.n,1)),LIT)),2), pk=(night?0.34:0.60)+0.40*spec;
        const g3=ctx.createLinearGradient(m1[0],m1[1],m2[0],m2[1]);
        g3.addColorStop(0,'rgba(255,255,255,0.04)'); g3.addColorStop(0.5,`rgba(255,255,255,${pk.toFixed(2)})`); g3.addColorStop(1,'rgba(255,255,255,0.04)');
        poly(q); ctx.fillStyle=g3; ctx.fill(); }
      /* glints on visible top corner spheres — bright droplet beads */
      for(const sx of[-1,1])for(const sy of[-1,1]){ const cd=norm([sx,sy,1]); if(dot(cd,vd)<0.5)continue;
        const c=proj([sx*s1,sy*s1,s1]), g4=ctx.createRadialGradient(c[0],c[1],0,c[0],c[1],R*K);
        g4.addColorStop(0,'rgba(255,255,255,0.75)'); g4.addColorStop(0.5,'rgba(255,255,255,0.20)'); g4.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=g4; ctx.beginPath(); ctx.arc(c[0],c[1],R*K,0,7); ctx.fill(); }
      /* glossy droplet specular: an elongated soft highlight where the key light strikes,
         plus a hard glint — both clipped to the body so they ride the glass surface */
      ctx.save(); poly(hull); ctx.clip();
      const hl=proj([0.36,-0.52,0.90]);
      ctx.translate(hl[0],hl[1]); ctx.rotate(-0.55); ctx.scale(1.55,0.85);
      const g5=ctx.createRadialGradient(0,0,0,0,0,K*0.60);
      g5.addColorStop(0,'rgba(255,255,255,0.60)'); g5.addColorStop(0.5,'rgba(255,255,255,0.16)'); g5.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=g5; ctx.beginPath(); ctx.arc(0,0,K*0.60,0,7); ctx.fill();
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const hg=proj([0.62,-0.30,0.94]), g6=ctx.createRadialGradient(hg[0],hg[1],0,hg[0],hg[1],K*0.16);
      g6.addColorStop(0,'rgba(255,255,255,0.85)'); g6.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=g6; ctx.beginPath(); ctx.arc(hg[0],hg[1],K*0.16,0,7); ctx.fill();
      ctx.restore();
      /* labels, mapped affinely onto each plate */
      for(const f of vis){ const dv=dot(f.n,vd); if(dv<0.30)continue;
        const p0=proj(f.n), pU=proj(A3(f.n,f.u,1)), pV=proj(A3(f.n,f.v,1));
        ctx.save(); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.translate(p0[0],p0[1]);
        ctx.transform((pU[0]-p0[0])/20,(pU[1]-p0[1])/20,(pV[0]-p0[0])/20,(pV[1]-p0[1])/20,0,0);
        ctx.font='800 8px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle = night?`rgba(225,240,255,${(0.30+0.45*dv).toFixed(2)})`:`rgba(30,50,80,${(0.28+0.40*dv).toFixed(2)})`;
        ctx.fillText(f.lab,0,0.5); ctx.restore(); }
      /* nearest-fixed-view cue + hover highlight: one continuous region per piece —
         face cells PLUS the rounded bevels and corner spheres that join them — filled
         in layered blurred passes so the whole corner glows softly, no hard boundaries */
      const eq3=(a,b)=>a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2];
      function piecePath(d){ const e=1-R; ctx.beginPath();
        for(const f of vis){ if(dot(f.n,vd)<0.05)continue;                       // flat cells on each visible face
          for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
            const dc=[f.n[0]+i*f.u[0]+j*f.v[0], f.n[1]+i*f.u[1]+j*f.v[1], Math.max(0,f.n[2]+i*f.u[2]+j*f.v[2])];
            if(!eq3(dc,d))continue;
            const P=[[(2*i-1)/3,(2*j-1)/3],[(2*i+1)/3,(2*j-1)/3],[(2*i+1)/3,(2*j+1)/3],[(2*i-1)/3,(2*j+1)/3]]
              .map(c=>proj(A3(A3(f.n,f.u,c[0]*e), f.v, (f.n[2]===0&&c[1]===1)?1:c[1]*e)));   // side-face bottom cells run to the floor line
            ctx.moveTo(P[0][0],P[0][1]); ctx.lineTo(P[1][0],P[1][1]); ctx.lineTo(P[2][0],P[2][1]); ctx.lineTo(P[3][0],P[3][1]); ctx.closePath(); } }
        for(let a=0;a<vis.length;a++)for(let b=a+1;b<vis.length;b++){ const A=vis[a],B=vis[b];   // bevel thirds joining the cells
          if(dot(A.n,B.n)!==0)continue; const ax=cross(A.n,B.n);
          for(let k=-1;k<=1;k++){
            const ds=[A.n[0]+B.n[0]+k*ax[0], A.n[1]+B.n[1]+k*ax[1], Math.max(0,A.n[2]+B.n[2]+k*ax[2])];
            if(!eq3(ds,d))continue;
            let t0=(2*k-1)/3*e, t1=(2*k+1)/3*e;
            if(ax[2]>0&&k===-1)t0=-1; else if(ax[2]<0&&k===1)t1=1;     // bottom third of a vertical edge reaches the floor
            const q=[A3(A3(A3([0,0,0],ax,t0),A.n,1),B.n,e), A3(A3(A3([0,0,0],ax,t1),A.n,1),B.n,e),
                     A3(A3(A3([0,0,0],ax,t1),A.n,e),B.n,1), A3(A3(A3([0,0,0],ax,t0),A.n,e),B.n,1)].map(proj);
            ctx.moveTo(q[0][0],q[0][1]); ctx.lineTo(q[1][0],q[1][1]); ctx.lineTo(q[2][0],q[2][1]); ctx.lineTo(q[3][0],q[3][1]); ctx.closePath(); } }
        for(const sx of[-1,1])for(const sy of[-1,1]){                           // corner spheres capping the region (top only — the base is flat)
          if(!eq3([sx,sy,1],d))continue;
          if(dot(norm([sx,sy,1]),vd)<0.15)continue;
          const c=proj([sx*e,sy*e,e]);
          ctx.moveTo(c[0]+R*K,c[1]); ctx.arc(c[0],c[1],R*K,0,2*PI); } }
      function glowPiece(d,glow,core){ piecePath(d); ctx.save();
        ctx.filter='blur(12px)'; ctx.fillStyle=glow; ctx.fill();                // wide outer haze, well past the region
        ctx.filter='blur(6px)';  ctx.fillStyle=glow; ctx.fill();                // body of the glow
        ctx.filter='blur(3px)';  ctx.fillStyle=core; ctx.fill();                // soft warm centre — nothing crisp anywhere
        ctx.restore(); }
      if(near&&(!hover||!eq3(near,hover))) glowPiece(near, night?'rgba(0,174,239,0.18)':'rgba(0,107,143,0.12)', night?'rgba(170,230,255,0.20)':'rgba(0,107,143,0.14)');
      if(hover) glowPiece(hover,'rgba(224,60,49,0.34)','rgba(255,150,90,0.45)');   // Tetrisize orange glow, molten-glass core
      /* refraction rim: a wide soft halo + a crisp bright line — droplet edge lighting */
      poly(hull); ctx.strokeStyle='rgba(255,255,255,'+(night?0.16:0.45)+')'; ctx.lineWidth=2.6; ctx.stroke();
      poly(hull); ctx.strokeStyle = night?'rgba(255,255,255,0.60)':'rgba(35,60,100,0.38)'; ctx.lineWidth=1.1; ctx.stroke();
      /* rotate rings: flat 3D circular arrows lying in the ground plane — they squash
         and swivel with the cube's az/el, mirrored left (ccw) / right (cw) */
      drawRot(BTNS.ccw[0],BTNS.ccw[1],-1,btnHover==='ccw');
      drawRot(BTNS.cw[0], BTNS.cw[1],  1,btnHover==='cw');
      drawHome(BTNS.home[0],BTNS.home[1],btnHover==='home',night);
    }
    function drawRot(cx,cy,dirn,hot){
      const ca=cos(cAz),sa=sin(cAz),se=Math.max(0.30,sin(cEl));          // ground-plane basis (min squash keeps it readable at floor level)
      const pt=(th,r)=>[cx+r*(cos(th*dirn)*ca+sin(th*dirn)*sa), cy+r*(cos(th*dirn)*sa-sin(th*dirn)*ca)*se];
      const a0=-0.5, a1=4.1, N=22;
      const band=(dy,fill)=>{ ctx.beginPath();
        for(let t=0;t<=N;t++){ const p=pt(a0+(a1-a0)*t/N,11); t?ctx.lineTo(p[0],p[1]+dy):ctx.moveTo(p[0],p[1]+dy); }
        for(let t=N;t>=0;t--){ const p=pt(a0+(a1-a0)*t/N,6.2); ctx.lineTo(p[0],p[1]+dy); }
        ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); };
      const head=(dy,fill)=>{ const pO=pt(a1,15),pI=pt(a1,2.5),pT=pt(a1+0.8,8.6);
        ctx.beginPath(); ctx.moveTo(pO[0],pO[1]+dy); ctx.lineTo(pT[0],pT[1]+dy); ctx.lineTo(pI[0],pI[1]+dy); ctx.closePath();
        ctx.fillStyle=fill; ctx.fill(); };
      band(2.4,'rgba(0,70,105,0.50)'); head(2.4,'rgba(0,70,105,0.50)'); // extruded underside — the 3D thickness
      const g=ctx.createLinearGradient(cx,cy-12,cx,cy+12);
      g.addColorStop(0,hot?'#7fdcff':'#a5e0fa'); g.addColorStop(1,hot?'#00AEEF':'#3ab5e6');
      band(0,g); head(0,g);
      if(hot){ ctx.save(); ctx.shadowColor='rgba(0,174,239,0.85)'; ctx.shadowBlur=9; band(0,'rgba(0,174,239,0.30)'); ctx.restore(); } }
    function drawHome(cx,cy,hot,night){                                  // chunky glass-blue house, same family as the rotate rings
      const now=performance.now(), flash=savedFlash&&now-savedFlash<900;
      if(btnDown==='home'&&!holdDone){ const pr=Math.min(1,(now-holdT0)/HOLD_MS);   // hold-to-save progress ring
        ctx.beginPath(); ctx.arc(cx,cy,12.5,-PI/2,-PI/2+pr*2*PI);
        ctx.strokeStyle='rgba(0,174,239,0.95)'; ctx.lineWidth=2.4; ctx.stroke(); }
      const house=(dy)=>{ ctx.beginPath();                               // roofed pentagon silhouette
        ctx.moveTo(cx,cy-8+dy); ctx.lineTo(cx+7.2,cy-1+dy); ctx.lineTo(cx+5,cy-1+dy); ctx.lineTo(cx+5,cy+6+dy);
        ctx.lineTo(cx-5,cy+6+dy); ctx.lineTo(cx-5,cy-1+dy); ctx.lineTo(cx-7.2,cy-1+dy); ctx.closePath(); };
      house(2.2); ctx.fillStyle='rgba(0,70,105,0.50)'; ctx.fill();       // extruded underside — matches the rings
      const g=ctx.createLinearGradient(cx,cy-9,cx,cy+7);
      if(flash){ g.addColorStop(0,'#8fe5a8'); g.addColorStop(1,'#3F9C35'); }
      else{ g.addColorStop(0,hot?'#7fdcff':'#a5e0fa'); g.addColorStop(1,hot?'#00AEEF':'#3ab5e6'); }
      house(0); ctx.fillStyle=g; ctx.fill();
      ctx.fillStyle='rgba(0,70,105,0.55)'; ctx.fillRect(cx-1.6,cy+1.8,3.2,4.2);   // door punched into the glass
      if(hot){ ctx.save(); ctx.shadowColor='rgba(0,174,239,0.85)'; ctx.shadowBlur=9; house(0); ctx.fillStyle='rgba(0,174,239,0.30)'; ctx.fill(); ctx.restore(); } }

    let lastKey='';
    (function tick(){
      const h=UI.hooks();
      if(anim){ const u=Math.min(1,(performance.now()-anim.t0)/anim.dur), s=u<0.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;
        cAz=anim.a0+(anim.a1-anim.a0)*s; cEl=anim.e0+(anim.e1-anim.e0)*s;
        if(u>=1){ anim=null; if(h.setCam)h.setCam(cAz,cEl,true); } else if(h.setCam)h.setCam(cAz,cEl,false); }
      else if(h.getCam&&!pdown){ const c=h.getCam(); cAz=c.az; cEl=c.el; }
      near=null; let bd=0.03;                                            // solid outline only when exactly on a fixed view
      for(const d of PIECES){ const t=targetFor(d), dd=Math.hypot(wrap(cAz-t.az)*Math.max(0.3,cos(cEl)), cEl-t.el);
        if(dd<bd){ bd=dd; near=d; } }
      if(btnDown==='home'&&!holdDone&&performance.now()-holdT0>=HOLD_MS){ holdDone=true; saveHome(); }   // hold completed → save this exact view
      const animKey=(btnDown==='home'&&!holdDone)?Math.floor((performance.now()-holdT0)/50):           // progress ring / saved flash need frames
                    (savedFlash&&performance.now()-savedFlash<900)?Math.floor((performance.now()-savedFlash)/100):0;
      const key=[cAz.toFixed(3),cEl.toFixed(3),hover&&hover.join(''),near&&near.join(''),btnHover,btnDown,animKey,
        document.documentElement.getAttribute('data-tz-theme')].join('|');
      if(key!==lastKey){ lastKey=key; draw(); }
      requestAnimationFrame(tick); })();
  }

  function buildCubeFlat(){                                              // legacy flat grid — used only when the screen has no camera hooks
    const cube = el(`<div id="tzCube">
      <div class="tz-cube-grid">
        <span></span><div class="tz-face tz-top" data-view="top">TOP</div><span></span>
        <div class="tz-face" data-view="left">LEFT</div>
        <div class="tz-face" data-view="front">FRONT</div>
        <div class="tz-face" data-view="right">RIGHT</div>
        <div class="tz-arrow" data-rot="ccw" title="Rotate 90&deg; counter-clockwise">&#8634;</div>
        <div class="tz-face" data-view="back">BACK</div>
        <div class="tz-arrow" data-rot="cw" title="Rotate 90&deg; clockwise">&#8635;</div>
      </div>
      <div class="tz-cube-foot">
        <button class="tz-btn" data-view="iso" title="Isometric view">ISO</button>
        <button class="tz-btn" id="tzFit" title="Zoom to extents">FIT</button>
        <button class="tz-btn" id="tzPersp" title="Orthographic / perspective">ORTHO</button>
      </div></div>`);
    document.body.appendChild(cube);
    cube.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { const h=UI.hooks(); if(h.setView) h.setView(b.getAttribute('data-view')); });
    cube.querySelectorAll('[data-rot]').forEach(b => b.onclick = () => { const h=UI.hooks(); if(h.rotate) h.rotate(b.getAttribute('data-rot')); });
    document.getElementById('tzFit').onclick = () => { const h=UI.hooks(); if(h.fit) h.fit(); };
    document.getElementById('tzPersp').onclick = (e) => { const h=UI.hooks(); if(h.persp){ const on=h.persp(); e.target.textContent = on ? 'PERSP' : 'ORTHO'; } };
  }

  function buildLayers(){
    const CLS = [ ['products','Products / pallets'], ['idbms','IDBM conveyors'], ['vehicles','Cars / cranes'], ['structure','Racking / structure'] ];
    const rows = CLS.map(([k,lab]) => `<div class="tz-lrow"><span>${lab}</span><span class="tz-3way" data-cls="${k}">
        <button data-s="visible" class="on">SHOW</button><button data-s="ghost">GHOST</button><button data-s="hidden">HIDE</button></span></div>`).join('');
    const SWATCHES = [ ['concrete','#b9bdc1','Concrete grey'], ['deep','#82868b','Deep grey'],
                       ['blue','#006B8F','Tetrisize blue'], ['cyan','#00AEEF','Tetrisize cyan'] ];
    const p = el(`<div id="tzLayers" class="tz-panel"><h4>Scene layers</h4>${rows}
        <h4 class="tz-floor-h">Ground plane</h4>
        <div class="tz-lrow"><span>Surface</span><span class="tz-3way" id="tzFloorSurf">
          <button data-s="grid">GRID</button><button data-s="painted">PAINTED</button></span></div>
        <div class="tz-lrow"><span>Floor colour</span><span class="tz-swatches" id="tzFloorCol">
          ${SWATCHES.map(([k,c,t])=>`<button data-c="${k}" title="${t}" style="background:${c}"></button>`).join('')}</span></div>
        <div class="tz-lrow"><span>Glass effects</span><span class="tz-3way" id="tzGlassSel" title="LITE skips backdrop blur — much faster on Windows GPUs">
          <button data-g="full">FULL</button><button data-g="lite">LITE</button></span></div>
        <button class="tz-btn tz-preset" id="tzFloatPreset">Floating inventory</button>
        <button class="tz-btn tz-preset" id="tzAllPreset">Show everything</button></div>`);
    document.body.appendChild(p);
    UI.dragify(p, p.querySelector('h4')); UI.addClose(p);   // drag by the "Scene layers" header; × closes (no need to re-click the Layers button)
    function setFloor(k,v){ UI.floor[k]=v; if(k==='color')LSset('tz-floor-color', v);   // only the colour persists — surface always boots to GRID
      p.querySelectorAll('#tzFloorSurf button').forEach(b=>b.classList.toggle('on', b.getAttribute('data-s')===UI.floor.surface));
      p.querySelectorAll('#tzFloorCol button').forEach(b=>b.classList.toggle('on', b.getAttribute('data-c')===UI.floor.color));
      const h=UI.hooks(); if(h.setFloor) h.setFloor(UI.floor); }
    p.querySelectorAll('#tzFloorSurf button').forEach(b => b.onclick = () => setFloor('surface', b.getAttribute('data-s')));
    p.querySelectorAll('#tzFloorCol button').forEach(b => b.onclick = () => setFloor('color', b.getAttribute('data-c')));
    setFloor('surface', UI.floor.surface);                               // sync the .on states (and the scene) to the stored prefs
    UI.setFloorUI = setFloor;                                            // screens reset to GRID on a fresh layout load
    function setGlass(v){ UI.glass=v; LSset('tz-glass', v); document.documentElement.classList.toggle('tz-lite', v==='lite');
      p.querySelectorAll('#tzGlassSel button').forEach(b=>b.classList.toggle('on', b.getAttribute('data-g')===v)); }
    p.querySelectorAll('#tzGlassSel button').forEach(b => b.onclick = () => setGlass(b.getAttribute('data-g')));
    setGlass(UI.glass);
    function set(cls, state){ UI.layers[cls]=state;
      p.querySelectorAll(`[data-cls="${cls}"] button`).forEach(b=>b.classList.toggle('on', b.getAttribute('data-s')===state));
      const h=UI.hooks(); if(h.setLayer) h.setLayer(cls, state); }
    p.querySelectorAll('.tz-3way[data-cls] button').forEach(b => b.onclick = () => set(b.parentElement.getAttribute('data-cls'), b.getAttribute('data-s')));   // [data-cls] guard: the Ground-plane surface buttons have their own wiring
    document.getElementById('tzFloatPreset').onclick = () => { set('products','visible'); set('idbms','ghost'); set('vehicles','ghost'); set('structure','ghost'); };
    document.getElementById('tzAllPreset').onclick = () => { ['products','idbms','vehicles','structure'].forEach(c=>set(c,'visible')); };
    UI.setLayerUI = set;
  }

  function buildStamp(){ const d=document.createElement('div');
    d.style.cssText='position:fixed;left:10px;bottom:6px;z-index:5;font:600 9px -apple-system,Arial;color:var(--tz-muted,#8a97a8);opacity:.75;pointer-events:none;letter-spacing:.04em';
    d.textContent='TETRISIZE PLATFORM '+TZ_VERSION+' · '+SCREEN.toUpperCase();
    document.body.appendChild(d); }
  function boot(){ buildBar(); buildStamp(); if(SCREEN==='viewer'){ buildCube(); buildLayers(); } }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
