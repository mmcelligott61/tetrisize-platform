/* ======================================================================
   Tetrisize Platform — Shuttle Car (low bed between two end "trunks")
   Contract object: window.TZ_SHUTTLE   (read components/COMPONENT_AUTHORING_BRIEF.md)

   FORM (per Mike 2026-06-05): a low nested IDBM bed between TWO tall (~1000 mm) "trunk"
   end-structures — one at each X end, set back from the outer lane by trunk.gap (clearance for
   products entering/exiting) — housing batteries, motors, controls, each with a centre Lidar on
   its outer face (both ends; runs both ways). The cart may be LONGER in X than the outer IDBMs,
   but NOTHING is wider (in Y) than the IDBM ends (trunks slightly SHORTER than the IDBM length).

   IDBMs NEST LOW: long body rests on the deck → IDBM-top = chassis.height + 85 (min 210 at 125).
   Draw order is FAR-trunk -> bed -> NEAR-trunk (recomputed per view) so no dark structure ever
   paints over the IDBMs at any iso angle.

   Units: schema in mm, renderer in metres (api.M = 0.001). Z-up, right-handed.
   Local +X = travel/side-by-side ; local +Y = IDBM length/convey ; +Z = up. Datum = chassis pose.
   ⚠ Some dimensions are placeholder ASSUMPTIONS — see shuttle/spec.md.
   ====================================================================== */
(function () {
  "use strict";
  var IDW = 300, IDBM_H = 0.200, IDBM_BODY_BOTTOM = 0.115, IDBM_END_LEN = 320;
  var BODY = 0x2b2f36, YELLOW = 0xf2c20d, LIDAR = 0x586173, LIDAR_WIN = 0x57c7c7;

  var DEFAULTS = {
    "bed.laneCount": 6,         // IDBMs side-by-side along travel (X)
    "bed.idbmLength": 2500,     // IDBM length = bed depth (local Y); variable
    "chassis.height": 300,      // deck (IDBM body-rest) height; IDBM-top = chassis.height + 85 (min 125 -> 210)
    "trunk.height": 1000,       // tall end-structure height (batteries/motors/controls)
    "trunk.depth": 600,         // how far each trunk extends in X
    "trunk.gap": 150,           // clearance gap between the last IDBM and the trunk (product entry/exit)
    "trunk.widthInset": 200,    // trunk Y-width = idbmLength - this (slightly SHORTER than the IDBM ends)
    "clearance.berth": 150      // Configurator laneway berth (NOT drawn in the Viewer)
  };
  function num(inst, k) { var v = inst && inst.params ? inst.params[k] : undefined; return (v == null) ? DEFAULTS[k] : v; }
  function dims(inst) {
    var N = num(inst, "bed.laneCount"), L = num(inst, "bed.idbmLength"), chH = num(inst, "chassis.height");
    var trunkH = num(inst, "trunk.height"), trunkDepth = num(inst, "trunk.depth"), gap = num(inst, "trunk.gap"), trunkWInset = num(inst, "trunk.widthInset");
    var spanX = N * IDW, depthY = L;
    var deckDepthY = Math.max(L - 2 * IDBM_END_LEN, 400), trunkY = Math.max(L - trunkWInset, 400);
    var trunkInnerX = spanX / 2 + gap, trunkCtrX = trunkInnerX + trunkDepth / 2, outerX = trunkInnerX + trunkDepth, deckHalfX = trunkInnerX;
    var footX = 2 * outerX, footY = L + 100;   // X: bed + 2*(gap + trunk.depth); Y: IDBM ends widest
    return { N: N, L: L, chH: chH, trunkH: trunkH, trunkDepth: trunkDepth, gap: gap, spanX: spanX, depthY: depthY, deckDepthY: deckDepthY, trunkY: trunkY, trunkInnerX: trunkInnerX, trunkCtrX: trunkCtrX, outerX: outerX, deckHalfX: deckHalfX, footX: footX, footY: footY };
  }

  var SCHEMA_TYPE = {
    typeId: "shuttle", name: "Shuttle Car (low bed + end trunks)", category: "vehicle", class: "shuttle",
    status: "Form per Mike 2026-06-05: low nested IDBM bed between two tall end trunks (set back by trunk.gap) + centre Lidar both ends; widest part = the IDBM ends. Cosmetic dims assumed.",
    params: [
      { key: "bed.laneCount",    type: "number", default: 6, min: 1, units: "count", desc: "IDBMs side-by-side along travel (X)." },
      { key: "bed.idbmLength",   type: "number", default: 2500, units: "mm", desc: "IDBM length = bed depth (local Y); the IDBM ends are the widest part." },
      { key: "chassis.height",   type: "number", default: 300, min: 125, units: "mm", desc: "Deck (IDBM body-rest) height. IDBM nests low so IDBM-top = chassis.height + 85; min 125 -> 210 mm." },
      { key: "trunk.height",     type: "number", default: 1000, units: "mm", assumption: true, desc: "Tall end-structure height (batteries/motors/controls)." },
      { key: "trunk.depth",      type: "number", default: 600, units: "mm", assumption: true, desc: "How far each trunk extends in X." },
      { key: "trunk.gap",        type: "number", default: 150, units: "mm", assumption: true, desc: "Clearance gap between the last IDBM and the trunk (so the trunk doesn't interfere with products entering/exiting)." },
      { key: "trunk.widthInset", type: "number", default: 200, units: "mm", assumption: true, desc: "Trunk Y-width = idbmLength - this (slightly SHORTER than the IDBM ends)." },
      { key: "clearance.berth",  type: "number", default: 150, units: "mm", assumption: true, desc: "Laneway clearance berth for the Configurator footprint (NOT drawn in the Viewer)." }
    ],
    bed: { laneCount: 6, idbmLength: 2500, idbmWidth: 300, idbmType: "idbm", mount: "nested low between end trunks", note: "bed = laneCount IDBM instances; obey normal IDBM op rules." },
    kinematics: { drivableAxes: "X", note: "Rail-bound; linear travel along X on a single central floor rail. Symmetric (a trunk + Lidar at each end) — travels both ways. Belt deck conveys ACROSS travel (Y)." },
    derived: {
      "bed.width": "laneCount x 300", "bed.depth": "idbmLength",
      "idbm.top": "chassis.height + 85 (min 210 mm at chassis.height 125)",
      "vehicle.length(X)": "laneCount x 300 + 2 x (trunk.gap + trunk.depth)",
      "vehicle.width(Y)": "idbmLength (IDBM ends; trunks are idbmLength - trunk.widthInset)",
      "vehicle.height(Z)": "max(trunk.height, chassis.height + 85)",
      "laneway": "Configurator-only: footprint swept along travel (X) +/- clearance.berth (see laneway2D). NOT rendered in the Viewer."
    },
    geometry: {
      note: "Low nested IDBM bed between two tall end trunks. Drawn far-trunk -> bed -> near-trunk so nothing dark overpaints the IDBMs.",
      frame: "Datum = chassis pose {position,yaw}. local X = travel/side-by-side; local Y = IDBM length; Z up.",
      deck: "Low slab from trunk to trunk (X = laneCount x 300 + 2 x trunk.gap ; Y = IDBM body length) at chassis.height; IDBM bodies rest on it, end housings overhang in Y.",
      trunks: "two boxes set back by trunk.gap: inner face at laneCount x 300/2 + trunk.gap; each trunk.depth (X) x (idbmLength - trunk.widthInset) (Y) x trunk.height tall.",
      lidar: "a sensor on the OUTER (+/-X) face centre of each trunk (both ends).",
      bed: "laneCount IDBMs at 300 mm pitch along X; each idbmLength along Y; nested low (IDBM-top = chassis.height + 85).",
      rule: "Widest part (Y) = the IDBM ends. The cart may be longer in X than the outer IDBMs. IDBM module FIXED (300 wide, 200 high, body underside 115)."
    },
    connectionPoints: [
      { id: "bed_infeed",  face: "endA", offset: [0, -1, 0], kind: "end_to_end", desc: "-Y bed edge: lane endA's meet a storage lane for transfer." },
      { id: "bed_outfeed", face: "endB", offset: [0, 1, 0],  kind: "end_to_end", desc: "+Y bed edge: lane endB's meet a storage lane for transfer." },
      { id: "base_datum",  face: "base", offset: [0, 0, 0],  kind: "pose",        desc: "Shuttle datum (chassis pose); rides a single central rail along X." }
    ],
    datum: { kind: "pose", form: "{ position:[x,y,z] mm, yaw rad }" },
    meta: { author: "component-authoring session (parallel)", form: "low nested IDBM bed between two tall end trunks (set back by trunk.gap) + centre Lidar each end",
      colours: "Trunks/deck dark + Safety-Orange cap; Lidar grey housing + teal window; IDBMs unchanged.",
      references: ["Mike's notes 2026-06-05 (end trunks, gap, Lidar, widest = IDBM ends)", "coordinate_frame_and_component_schema_v0.1.md §2 (vehicle/shuttle)", "viewer_3d.html drawIdbm()"],
      remainingAssumptions: "trunk.height/depth/gap/widthInset, chassis.height, drive/sensor detail. Appearance to be revisited." }
  };

  window.TZ_SHUTTLE = {
    typeId: "shuttle", category: "vehicle", schemaType: SCHEMA_TYPE, defaults: DEFAULTS,

    draw3D: function (api, inst, lod) {
      var M = api.M, pose = inst.pose || {}, pos = pose.position || [0, 0, 0], yaw = pose.yaw || 0;
      var cx = pos[0] * M, cy = pos[1] * M, cz = pos[2] * M, al = [Math.cos(yaw), Math.sin(yaw)], ac = [-al[1], al[0]];
      var d = dims(inst), deckHalfX = d.deckHalfX * M, deckY = d.deckDepthY * M, idbmLen = d.depthY * M, chTopZ = cz + d.chH * M;
      var trunkH = d.trunkH * M, trunkDepth = d.trunkDepth * M, trunkY = d.trunkY * M, trunkCtrX = d.trunkCtrX * M, outerX = d.outerX * M, idw = IDW * M, N = d.N;

      function drawTrunk(s) {
        var tx = cx + al[0] * (s * trunkCtrX), ty = cy + al[1] * (s * trunkCtrX);
        // Lidar seated ON the outer face (straddles it) and ordered by projected depth vs the trunk
        // body, so the FAR trunk's lidar is hidden behind its own body — only the NEAR one shows.
        var hx = cx + al[0] * (s * outerX), hy = cy + al[1] * (s * outerX), lz = cz + trunkH * 0.55;
        var lidarFront = api.depth(hx, hy) > api.depth(tx, ty);
        function drawLidar() {
          if (lod === "simple") return;
          api.obox(hx, hy, lz, lz + 0.20, al, ac, 0.06, 0.09, LIDAR);
          if (lod === "full") api.obox(hx, hy, lz + 0.06, lz + 0.15, al, ac, 0.065, 0.10, LIDAR_WIN);
        }
        if (!lidarFront) drawLidar();
        api.obox(tx, ty, cz, cz + trunkH, al, ac, trunkDepth / 2, trunkY / 2, BODY);
        if (lod === "full") api.obox(tx, ty, cz + trunkH - 0.06, cz + trunkH, al, ac, trunkDepth / 2, trunkY / 2, YELLOW);
        if (lidarFront) drawLidar();
      }
      function drawBed() {
        api.obox(cx, cy, cz, chTopZ, al, ac, deckHalfX, deckY / 2, BODY);   // low deck slab (reaches the trunks across the gap)
        var lanes = [];
        for (var i = 0; i < N; i++) { var off = (i - (N - 1) / 2) * idw, bx = cx + al[0] * off, by = cy + al[1] * off; lanes.push({ x: bx, y: by, d: api.depth(bx, by) }); }
        lanes.sort(function (a, b) { return a.d - b.d; }).forEach(function (L) { api.idbm(L.x, L.y, chTopZ - IDBM_BODY_BOTTOM, idbmLen, yaw + Math.PI / 2, lod); });
      }
      // FAR trunk -> bed -> NEAR trunk (so no dark structure ever overpaints the IDBMs)
      var ord = [-1, 1].map(function (s) { return { s: s, d: api.depth(cx + al[0] * (s * trunkCtrX), cy + al[1] * (s * trunkCtrX)) }; }).sort(function (a, b) { return a.d - b.d; });
      drawTrunk(ord[0].s); drawBed(); drawTrunk(ord[1].s);
    },

    footprint2D: function (inst) {
      var pose = inst.pose || {}, pos = pose.position || [0, 0, 0], yaw = pose.yaw || 0, al = [Math.cos(yaw), Math.sin(yaw)], ac = [-al[1], al[0]], d = dims(inst);
      var hX = d.footX / 2, hY = d.footY / 2;
      return [[-hX, -hY], [hX, -hY], [hX, hY], [-hX, hY]].map(function (c) { return [pos[0] + al[0] * c[0] + ac[0] * c[1], pos[1] + al[1] * c[0] + ac[1] * c[1]]; });
    },

    /* Configurator-only swept laneway (NOT drawn in the Viewer). travelExtent = full X travel (mm). */
    laneway2D: function (inst, travelExtent) {
      var pose = inst.pose || {}, pos = pose.position || [0, 0, 0], yaw = pose.yaw || 0, al = [Math.cos(yaw), Math.sin(yaw)], ac = [-al[1], al[0]], d = dims(inst);
      var berth = num(inst, "clearance.berth"), te = (travelExtent != null ? travelExtent : 0) / 2;
      var hX = d.footX / 2 + te + berth, hY = d.footY / 2 + berth;
      return [[-hX, -hY], [hX, -hY], [hX, hY], [-hX, hY]].map(function (c) { return [pos[0] + al[0] * c[0] + ac[0] * c[1], pos[1] + al[1] * c[0] + ac[1] * c[1]]; });
    },

    bbox: function (inst) {
      var M = 0.001, pose = inst.pose || {}, pos = pose.position || [0, 0, 0], yaw = pose.yaw || 0, cx = pos[0] * M, cy = pos[1] * M, cz = pos[2] * M, d = dims(inst);
      var hX = (d.footX / 2) * M, hY = (d.footY / 2) * M, ca = Math.abs(Math.cos(yaw)), sa = Math.abs(Math.sin(yaw)), ex = ca * hX + sa * hY, ey = sa * hX + ca * hY;
      var zTop = Math.max(d.trunkH, d.chH + (200 - 115)) * M;
      return { min: [cx - ex, cy - ey, cz], max: [cx + ex, cy + ey, cz + zTop] };
    }
  };
})();
