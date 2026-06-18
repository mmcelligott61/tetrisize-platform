// ============================================================================
//  TETRISIZE BRAIN — storage allocation engine  (pure logic, no DOM)
//  Two-phase slotting, the way a real WMS works:
//    PLAN  (from the inbound manifest / ASN the brain knows in advance)
//       • one CONTIGUOUS lane-zone per product category (clustered)
//       • each batch gets a CONTIGUOUS run of lanes inside its zone
//       • lanes are single-category, sized by ceil(count / laneCap)
//    PLACE (as the scrambled physical loads actually arrive)
//       • drop each load into the first non-full lane its batch was planned into
//  Result: a scrambled arrival stream lands perfectly sorted & contiguous.
//  Factory form so the SAME code runs in node (test) and the viewer.
// ============================================================================
function makeBrain(lanes, laneCap, manifest) {
  laneCap = laneCap || 8;

  // ---------- PLAN ----------
  const plan = {};                          // batchId -> {lanes:[idx], cat, count}
  const laneOwner = lanes.map(() => null);  // laneIdx -> {cat, batchId}
  const catOrder = [], catBatches = {};
  manifest.forEach(b => {
    if (!catBatches[b.category]) { catBatches[b.category] = []; catOrder.push(b.category); }
    catBatches[b.category].push(b);
  });
  const zones = [];
  let cursor = 0;
  catOrder.forEach(cat => {
    const start = cursor;
    catBatches[cat].forEach(b => {
      const need = Math.max(1, Math.ceil(b.count / laneCap));
      const ls = [];
      for (let k = 0; k < need && cursor < lanes.length; k++) { ls.push(cursor); laneOwner[cursor] = { cat, batchId: b.batchId }; cursor++; }
      plan[b.batchId] = { lanes: ls, cat, count: b.count };
    });
    zones.push({ cat, start, end: cursor - 1, lanes: cursor - start });
  });

  // ---------- PLACE ----------
  const occ = lanes.map(() => []);
  const log = [];
  function allocate(load) {
    const p = plan[load.batchId];
    let li, reason, opened = false;
    if (p) {
      li = p.lanes.find(l => occ[l].length < laneCap);
      if (li == null) li = p.lanes[p.lanes.length - 1];
      opened = occ[li].length === 0;
      const z = zones.find(zz => zz.cat === p.cat);
      reason = opened
        ? 'lane ' + lanes[li].id + '  ·  planned ' + load.productCategory + ' zone (lanes ' + lanes[z.start].id + '–' + lanes[z.end].id + ')'
        : 'batch ' + load.batchId + ' stays together in lane ' + lanes[li].id;
    } else {
      li = occ.findIndex(o => o.length === 0);
      opened = true;
      reason = 'unplanned load · nearest free lane ' + (li >= 0 ? lanes[li].id : '?');
    }
    const slot = occ[li].length;
    occ[li].push(load);
    const rec = { load, lane: li, laneId: lanes[li].id, slot, opened, reason };
    log.push(rec);
    return rec;
  }

  function summary() {
    const byCat = {};
    zones.forEach(z => byCat[z.cat] = z.lanes);
    return { lanesUsed: occ.filter(o => o.length).length, totalLanes: lanes.length, byCat, placed: log.filter(r => r.lane != null).length, zones };
  }
  return { allocate, summary, plan, zones, laneOwner, occ, log, laneCap };
}

// ---- deterministic mixed-arrival stream (round-robin interleave = scrambled) ----
function makeStream(batches) {
  const queues = batches.map(b => {
    const arr = [];
    for (let i = 0; i < b.count; i++) arr.push({
      sku: b.sku, productCategory: b.category, customerId: b.customer,
      factoryOrderId: b.order, batchId: b.batchId, unit: i + 1, of: b.count
    });
    return arr;
  });
  const stream = []; let alive = true;
  while (alive) { alive = false; for (const q of queues) if (q.length) { stream.push(q.shift()); alive = true; } }
  return stream;
}

if (typeof module !== 'undefined') module.exports = { makeBrain, makeStream };
