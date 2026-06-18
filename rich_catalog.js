/* ============================================================================
   TETRISIZE PLATFORM — RICH GENERIC CATALOGUE  (the "everything a customer might
   carry" showcase dataset)
   ----------------------------------------------------------------------------
   The default random stream carries almost nothing; the customer .json files
   (100 / 1000) carry dims + destination + downstream_requirements but no
   ENVIRONMENTAL rules. This catalogue produces fully-populated `tetrisize.product`
   records exercising EVERY tier of PRODUCT_PARAMETER_DICTIONARY.md:
     CORE                id · product · length/width/height/mass
     RECOGNISED-OPTIONAL manufactured_at · destination · declared_dims · rules{}
     CUSTOM-CARRIED      sku · FO/CO/batch · pallet brand/type · owner · priority · po_line
   So heat rules drive the climate engine, destinations drive the (coming) routing
   Lens, dwell-age drives slow-mover sorting, and widths span lane classes 3..19.

   window.TZ_RICH(n)  ->  { meta, items:[ … n records … ] }   (same shape __runDataset loads)
   ========================================================================== */
window.TZ_RICH = (function(){
  // n=name · sku · l/w/kg/h (mm,mm,kg,mm) · v=velocity · dz=destination pool · r=rules · pt=pallet
  const C = [
    // ---- CHILLED (max_temp_c) ----
    {n:'Cadbury Dairy Milk blocks',  sku:'CAD-DM-CTN',   l:1165,w:1165,kg:430,h:1450, v:'fast', dz:'COLD', r:{max_temp_c:30}, pt:'CHEP B1165'},
    {n:'Lindt praline boxes',        sku:'LIN-PRL-CTN',  l:1165,w:1165,kg:310,h:1300, v:'med',  dz:'COLD', r:{max_temp_c:25}, pt:'CHEP B1165'},
    {n:'Brie & camembert wheels',    sku:'DAIRY-SOFT',   l:1200,w:1000,kg:280,h:1150, v:'med',  dz:'COLD', r:{min_temp_c:2,max_temp_c:8}, pt:'Loscam'},
    {n:'Sliced ham 2kg',             sku:'SMALL-SML-HAM',l:1165,w:1165,kg:360,h:1200, v:'fast', dz:'COLD', r:{min_temp_c:1,max_temp_c:5}, pt:'CHEP B1165'},
    // ---- FROZEN (deep cold) ----
    {n:"Birds Eye frozen peas",      sku:'BE-PEAS-1KG',  l:1165,w:1165,kg:520,h:1450, v:'fast', dz:'COLD', r:{max_temp_c:-18}, pt:'CHEP B1165'},
    {n:'Streets ice cream tubs',     sku:'STR-ICE-2L',   l:1165,w:1165,kg:480,h:1400, v:'med',  dz:'COLD', r:{max_temp_c:-22}, pt:'CHEP B1165'},
    {n:'Frozen chips 2.5kg',         sku:'FRZ-CHIP',     l:1165,w:1165,kg:560,h:1500, v:'fast', dz:'COLD', r:{max_temp_c:-18}, pt:'CHEP B1165'},
    // ---- PHARMA (tight range, small, slow) ----
    {n:'Vaccine cartons (cold-chain)',sku:'PHARMA-VAX',  l:800, w:600, kg:90, h:900,  v:'slow', dz:'COLD', r:{min_temp_c:2,max_temp_c:8}, pt:'Display quarter'},
    {n:'Insulin cartons',            sku:'PHARMA-INS',   l:800, w:600, kg:75, h:850,  v:'slow', dz:'COLD', r:{min_temp_c:2,max_temp_c:8}, pt:'Display quarter'},
    // ---- PRODUCE (ethylene + temp; segregation rule is a future tier) ----
    {n:'Bananas (ripening)',         sku:'PROD-BAN',     l:1200,w:1000,kg:340,h:1100, v:'fast', dz:'PICK', r:{max_temp_c:14,ethylene:'emit'}, pt:'Returnable cage'},
    {n:'Lettuce (ethylene-sensitive)',sku:'PROD-LET',    l:1200,w:1000,kg:240,h:1050, v:'fast', dz:'PICK', r:{max_temp_c:5,ethylene:'sensitive'}, pt:'Returnable cage'},
    {n:'Apples (ethylene)',          sku:'PROD-APP',     l:1200,w:1000,kg:380,h:1150, v:'med',  dz:'PICK', r:{max_temp_c:4,ethylene:'emit'}, pt:'Loscam'},
    // ---- ELECTRONICS (humidity) ----
    {n:'LCD televisions',            sku:'ELEC-TV-55',   l:1400,w:1100,kg:300,h:1400, v:'med',  dz:'DOOR', r:{max_humidity_pct:60}, pt:'Custom'},
    {n:'Laptop cartons',             sku:'ELEC-LAP',     l:1165,w:1165,kg:260,h:1300, v:'fast', dz:'DOOR', r:{max_humidity_pct:55}, pt:'CHEP B1165'},
    {n:'Server racks',               sku:'ELEC-SVR',     l:1300,w:1100,kg:680,h:1500, v:'slow', dz:'DOOR', r:{max_humidity_pct:50}, pt:'Custom heavy'},
    // ---- PAPER / CARDBOARD (humidity — warps) ----
    {n:'Corrugated sheet stacks',    sku:'CARD-CORR',    l:2000,w:1200,kg:620,h:1400, v:'slow', dz:'BULK', r:{max_humidity_pct:65}, pt:'Custom flat'},
    {n:'Printing paper reels',       sku:'PAPER-REEL',   l:1200,w:1200,kg:900,h:1200, v:'med',  dz:'BULK', r:{max_humidity_pct:60}, pt:'Reel cradle'},
    {n:'Weet-Bix cartons',           sku:'GROC-WB',      l:1165,w:1165,kg:300,h:1500, v:'fast', dz:'PICK', r:null, pt:'CHEP B1165'},
    // ---- BUILDING MATERIALS (wide / heavy, no rules — lane-class stress) ----
    {n:'2.4m treated pine bundle',   sku:'BUILD-PINE',   l:2400,w:1100,kg:780,h:900,  v:'slow', dz:'BULK', r:null, pt:'Timber gluts'},
    {n:'Steel extrusions strapped',  sku:'BUILD-STEEL',  l:2300,w:5400,kg:1200,h:600, v:'slow', dz:'BULK', r:null, pt:'Steel cradle'},
    {n:'Cement 20kg bags',           sku:'BUILD-CEM',    l:1165,w:1165,kg:1000,h:1200,v:'med',  dz:'BULK', r:null, pt:'CHEP B1165'},
    {n:'Plasterboard sheets',        sku:'BUILD-PB',     l:2400,w:1200,kg:540,h:300,  v:'med',  dz:'BULK', r:null, pt:'Custom flat'},
    {n:'Aluminium window profiles',  sku:'BUILD-ALU',    l:2400,w:900, kg:420,h:800,  v:'slow', dz:'BULK', r:null, pt:'Profile cradle'},
    // ---- AMBIENT BEVERAGE (fast, high-volume, no rules) ----
    {n:'Coca-Cola cartons',          sku:'BEV-COKE',     l:1165,w:1165,kg:560,h:1300, v:'fast', dz:'DOOR', r:null, pt:'CHEP B1165'},
    {n:'VB longneck cartons',        sku:'BEV-VB',       l:1165,w:1165,kg:620,h:1250, v:'fast', dz:'DOOR', r:null, pt:'CHEP B1165'},
    {n:'Mount Franklin water',       sku:'BEV-WATER',    l:1165,w:1165,kg:600,h:1400, v:'fast', dz:'DOOR', r:null, pt:'CHEP B1165'},
    {n:'Bundaberg ginger beer',      sku:'BEV-BUND',     l:1165,w:1165,kg:540,h:1200, v:'med',  dz:'DOOR', r:null, pt:'Loscam'},
    // ---- DRY GROCERY (no rules, varied weight) ----
    {n:'Bakers flour 25kg bags',     sku:'GROC-FLR',     l:1165,w:1165,kg:1050,h:1100,v:'med',  dz:'PICK', r:null, pt:'CHEP B1165'},
    {n:"Arnott's mixed biscuits",    sku:'GROC-ARN',     l:1165,w:1165,kg:280,h:1500, v:'med',  dz:'PICK', r:null, pt:'CHEP B1165'},
    {n:'Tinned tomatoes',            sku:'GROC-TOM',     l:1165,w:1165,kg:720,h:1100, v:'fast', dz:'PICK', r:null, pt:'CHEP B1165'},
    {n:"Kellogg's Cornflakes",       sku:'GROC-KEL',     l:1165,w:1165,kg:240,h:1550, v:'fast', dz:'PICK', r:null, pt:'CHEP B1165'},
    // ---- CHEMICAL (segregation — future keep-apart rule) ----
    {n:'Caustic soda 1000L IBC',     sku:'CHEM-CAUS',    l:1200,w:1000,kg:1150,h:1200,v:'slow', dz:'SPECIAL', r:{segregation:'corrosive'}, pt:'IBC'},
    {n:'Pool chlorine drums',        sku:'CHEM-CL',      l:1165,w:1165,kg:760,h:1100, v:'slow', dz:'SPECIAL', r:{segregation:'oxidiser'}, pt:'CHEP B1165'},
    // ---- E-COMMERCE (fast, small/light) ----
    {n:'Mixed parcel cartons',       sku:'ECOM-MIX',     l:1165,w:1165,kg:180,h:1400, v:'fast', dz:'PICK', r:null, pt:'CHEP B1165'},
    {n:'Apparel overpack',           sku:'ECOM-APP',     l:1165,w:1165,kg:120,h:1200, v:'fast', dz:'PICK', r:null, pt:'CHEP B1165'},
  ];
  const DEST = { COLD:['COLD-DOCK-01','COLD-DOCK-02'], DOOR:['DOOR-01','DOOR-02','DOOR-03','DOOR-04','DOOR-05','DOOR-06'],
    PICK:['PICK-LINE-A','PICK-LINE-B'], BULK:['BULK-OUT-01','BULK-OUT-02'], SPECIAL:['QA-HOLD','RETURNS','CROSS-DOCK'] };
  const OWNERS=['ACME-3PL','NESTLE-AU','BUNNINGS','WOOLWORTHS','TECHDIST','FRESHCO'];
  const PRIOS=['standard','standard','standard','expedite','hold'];
  const AGE={ fast:[0,2], med:[1,12], slow:[7,75] };                                          // days since arrival/manufacture — slow movers run old (the "been on the shelf" sorters)
  // velocity weighting: fast movers dominate the stream, slow movers are rare-but-aged
  const POOL=[]; C.forEach((p,i)=>{ const w=p.v==='fast'?6:p.v==='med'?3:1; for(let k=0;k<w;k++)POOL.push(i); });
  let rng=1; const rnd=()=>{ rng=(rng*1103515245+12345)&0x7fffffff; return rng/0x7fffffff; };   // deterministic — same dataset every run
  const pick=a=>a[Math.floor(rnd()*a.length)];
  const pad=(v,n)=>String(v).padStart(n,'0');
  function rec(seq){ const p=C[pick(POOL)], age=AGE[p.v], days=age[0]+rnd()*(age[1]-age[0]);
    const mfg=new Date(Date.now()-days*86400000).toISOString();
    const dest=pick(DEST[p.dz]);
    // declared vs measured: ~9% arrive mis-declared (the scanner-reconciliation case)
    const off=rnd()<0.09, dl=p.l+(off?Math.round((rnd()-0.5)*120):0), dw=p.w+(off?Math.round((rnd()-0.5)*100):0);
    return { pid:'PALLET-'+pad(seq,6), sku:p.sku, len:p.l, wid:p.w, kg:p.kg,
      rules:p.r||null,                                                                          // CANONICAL active rules (environmental / segregation)
      declared_dims:{length_mm:dl,width_mm:dw,height_mm:p.h,mass_kg:p.kg},
      payload:{ description:p.n, case_count:20+Math.floor(rnd()*40), case_description:p.n, manufactured_at:mfg,
        production_run_serial_number:'RUN-'+p.sku+'-'+pad(seq,4), factory_order_number:'FO-'+(900000+seq),
        customer_order_number:'CO-'+(400000+Math.floor(rnd()*99999)), batch_code:'B-'+p.sku.slice(0,6)+'-'+pad(seq,3),
        pallet_brand:p.pt.split(' ')[0], pallet_type:p.pt, height_mm:p.h, velocity:p.v, rules:p.r||null,
        downstream_requirements:{ destination:dest, strap_required:p.kg>700, stretch_wrap_required:rnd()<0.7, label_required:true },
        owner:pick(OWNERS), priority:pick(PRIOS), po_line:1+Math.floor(rnd()*60) } };
  }
  return function(n){ n=Math.max(1,Math.round(+n||500)); rng=1; const items=[]; for(let i=1;i<=n;i++)items.push(rec(i));
    return { meta:'Rich generic catalogue — '+C.length+' SKUs, full canonical fields ('+n+')', items:items, products:items }; };
})();
