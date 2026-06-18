/* ======================================================================
   Tetrisize Platform — Rack (fixed IDBM storage structure)
   Contract object: window.TZ_RACK   (read components/COMPONENT_AUTHORING_BRIEF.md)

   The fixed multi-level array of IDBM lanes that the Crane/Shuttle/AGV deliver to.
   Uprights + beams form bays × levels; each level holds a row of IDBM lanes.
   Units: schema in mm, renderer in metres (api.M = 0.001). Z-up, right-handed.
   Local +X = run of bays (along the aisle) ; local +Y = lane depth (IDBM length) ;
   +Z = up. Datum = pose at the rack's near-bottom-centre.

   PROPOSED category "racking" (composite of schema §2 racking_upright + racking_beam) —
   the main session merges. Lanes reuse the EXISTING IDBM (shared api.idbm).
   ⚠ Dimensions are placeholder ASSUMPTIONS — see rack/spec.md.
   ====================================================================== */
(function () {
  "use strict";
  var IDW = 300, IDBM_H = 0.200;

  var DEFAULTS = {
    "rack.bays": 3,            // bays along X
    "rack.lanesPerBay": 4,     // IDBM lanes per bay → total lanes = bays * lanesPerBay
    "rack.levels": 4,          // storage levels (Z)
    "rack.levelPitch": 2000,   // vertical pitch between levels
    "bed.idbmLength": 2500,    // lane depth (local Y) = IDBM length
    "upright.section": 100,    // square upright post section
    "beam.section": 100,       // beam section
    "base.height": 150         // first level (lowest beam) height above floor
  };
  function num(inst, k) { var v = inst && inst.params ? inst.params[k] : undefined; return (v == null) ? DEFAULTS[k] : v; }
  function dims(inst) {
    var bays = num(inst, "rack.bays"), lpb = num(inst, "rack.lanesPerBay"), levels = num(inst, "rack.levels");
    var pitch = num(inst, "rack.levelPitch"), L = num(inst, "bed.idbmLength"), base = num(inst, "base.height");
    var lanes = bays * lpb, spanX = lanes * IDW, bayW = lpb * IDW, depthY = L;
    var topZ = base + levels * pitch;
    return { bays: bays, lpb: lpb, levels: levels, pitch: pitch, L: L, base: base, lanes: lanes, spanX: spanX, bayW: bayW, depthY: depthY, topZ: topZ };
  }

  var RACK_BLUE = 0x415a77;   // muted blue-grey for the fixed steel (distinct from the crane's orange)

  var SCHEMA_TYPE = {
    typeId: "rack", name: "Rack (IDBM storage)", category: "racking",
    status: "DRAFT — PROPOSED composite category 'racking' (= schema §2 racking_upright + racking_beam). Placeholder dims; confirm with Mike.",
    params: [
      { key: "rack.bays",       type: "number", default: 3, min: 1, units: "count", desc: "Bays along X (the aisle run)." },
      { key: "rack.lanesPerBay",type: "number", default: 4, min: 1, units: "count", desc: "IDBM lanes per bay; total lanes = bays x lanesPerBay." },
      { key: "rack.levels",     type: "number", default: 4, min: 1, units: "count", desc: "Storage levels (Z)." },
      { key: "rack.levelPitch", type: "number", default: 2000, units: "mm", desc: "Vertical pitch between levels." },
      { key: "bed.idbmLength",  type: "number", default: 2500, units: "mm", desc: "Lane depth (local Y) = IDBM length." },
      { key: "upright.section", type: "number", default: 100, units: "mm", assumption: true, desc: "Square upright post section." },
      { key: "beam.section",    type: "number", default: 100, units: "mm", assumption: true, desc: "Beam section." },
      { key: "base.height",     type: "number", default: 150, units: "mm", assumption: true, desc: "Lowest beam (level 0) height above floor." }
    ],
    kinematics: { drivableAxes: "none", note: "Fixed structure (no motion)." },
    derived: {
      "lanes.total": "rack.bays x rack.lanesPerBay",
      "rack.width":  "lanes.total x 300 (X)",
      "bay.width":   "rack.lanesPerBay x 300",
      "rack.depth":  "bed.idbmLength (Y)",
      "rack.height": "base.height + rack.levels x rack.levelPitch (Z)"
    },
    geometry: {
      note: "Canonical parametric form (mm). Mirrors the IDBM geometry-block pattern (schema §2).",
      frame: "Datum = pose {position,yaw} at near-bottom-centre. local X = bays/aisle run; local Y = lane depth; Z up.",
      uprights: "(bays+1) upright frames at local x = -width/2 + i*bayWidth; each = 2 posts (front -Y, back +Y) of upright.section, floor to rack.height.",
      beams: "front & back beams along X at each level z = base.height + k*levelPitch (k=0..levels-1).",
      lanes: "each level carries lanes.total IDBMs at 300 mm pitch along X, each idbmLength deep along Y, resting on the beams. Reuses the shared IDBM drawer.",
      rule: "IDBM module is FIXED (width 300, height 200). Bays, lanes, levels, pitch and depth all scale from the params."
    },
    connectionPoints: [
      { id: "face_pick", face: "sideL", offset: [0, -1, 0], kind: "transfer", desc: "-Y rack face: lane ends a Crane/Shuttle/AGV transfers to (per level)." }
    ],
    datum: { kind: "pose", form: "{ position:[x,y,z] mm, yaw rad }" },
    meta: { author: "component-authoring session (parallel)", form: "selective rack: uprights + beams + IDBM lanes",
      colours: "Uprights + beams = muted blue-grey (0x415a77); IDBMs unchanged.",
      references: ["coordinate_frame_and_component_schema_v0.1.md §2 (racking_upright, racking_beam)", "viewer_3d.html drawIdbm()"],
      remainingAssumptions: "section sizes, base.height, whether lanes are full-depth or paired, colour. Appearance to be revisited." }
  };

  window.TZ_RACK = {
    typeId: "rack", category: "racking", schemaType: SCHEMA_TYPE, defaults: DEFAULTS,

    draw3D: function (api, inst, lod) {
      var M = api.M, pose = inst.pose || {}, pos = pose.position || [0, 0, 0], yaw = pose.yaw || 0;
      var cx = pos[0] * M, cy = pos[1] * M, cz = pos[2] * M, al = [Math.cos(yaw), Math.sin(yaw)], ac = [-al[1], al[0]];
      var d = dims(inst), spanX = d.spanX * M, bayW = d.bayW * M, depthY = d.depthY * M;
      var up = num(inst, "upright.section") * M, bm = num(inst, "beam.section") * M;
      var base = d.base * M, pitch = d.pitch * M, topZ = cz + d.topZ * M, idw = IDW * M;
      var parts = []; function add(x, y, z, f) { parts.push({ k: api.depth(x, y) + z * 0.01, f: f }); }

      // upright frames (front -Y / back +Y) at each bay boundary
      for (var i = 0; i <= d.bays; i++) {
        var ox = -spanX / 2 + i * bayW;
        [-1, 1].forEach(function (sy) {
          var px = cx + al[0] * ox + ac[0] * (sy * depthY / 2), py = cy + al[1] * ox + ac[1] * (sy * depthY / 2);
          add(px, py, cz + (topZ - cz) / 2, function () { api.obox(px, py, cz, topZ, al, ac, up / 2, up / 2, RACK_BLUE); });
        });
      }
      // beams along X (front & back) at each level
      for (var k = 0; k < d.levels; k++) {
        var bz = cz + base + k * pitch;
        [-1, 1].forEach(function (sy) {
          var by = cy + ac[1] * (sy * depthY / 2), bx = cx + ac[0] * (sy * depthY / 2);
          (function (z, X, Y) { add(X, Y, z + bm / 2, function () { api.obox(X, Y, z, z + bm, al, ac, spanX / 2 + up / 2, bm / 2, RACK_BLUE); }); })(bz, bx, by);
        });
      }
      // IDBM lanes resting on the beams at each level
      for (var k2 = 0; k2 < d.levels; k2++) {
        var lz = cz + base + k2 * pitch + bm;
        for (var lane = 0; lane < d.lanes; lane++) {
          var lx = (lane - (d.lanes - 1) / 2) * idw, gx = cx + al[0] * lx, gy = cy + al[1] * lx;
          (function (x, y, z) { add(x, y, z + IDBM_H / 2, function () { api.idbm(x, y, z, depthY, yaw + Math.PI / 2, lod); }); })(gx, gy, lz);
        }
      }
      parts.sort(function (a, b) { return a.k - b.k; }).forEach(function (p) { p.f(); });
    },

    footprint2D: function (inst) {
      var pose = inst.pose || {}, pos = pose.position || [0, 0, 0], yaw = pose.yaw || 0, al = [Math.cos(yaw), Math.sin(yaw)], ac = [-al[1], al[0]], d = dims(inst);
      var up = num(inst, "upright.section");
      var hX = d.spanX / 2 + up, hY = d.depthY / 2 + up;
      return [[-hX, -hY], [hX, -hY], [hX, hY], [-hX, hY]].map(function (c) { return [pos[0] + al[0] * c[0] + ac[0] * c[1], pos[1] + al[1] * c[0] + ac[1] * c[1]]; });
    },

    bbox: function (inst) {
      var M = 0.001, pose = inst.pose || {}, pos = pose.position || [0, 0, 0], yaw = pose.yaw || 0, cx = pos[0] * M, cy = pos[1] * M, cz = pos[2] * M, d = dims(inst);
      var up = num(inst, "upright.section") * M, hX = (d.spanX / 2) * M + up, hY = (d.depthY / 2) * M + up;
      var ca = Math.abs(Math.cos(yaw)), sa = Math.abs(Math.sin(yaw)), ex = ca * hX + sa * hY, ey = sa * hX + ca * hY;
      return { min: [cx - ex, cy - ey, cz], max: [cx + ex, cy + ey, cz + d.topZ * M] };
    }
  };
})();
