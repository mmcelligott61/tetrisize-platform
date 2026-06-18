/* ======================================================================
   Tetrisize Platform — Crane Car (ASRS Stacker, scalable twin-mast)
   Contract object: window.TZ_CRANE   (read components/COMPONENT_AUTHORING_BRIEF.md)

   Units: schema in mm, renderer in metres (api.M = 0.001). Z-up, right-handed.
   Local +X = mast-spacing / side-by-side / TRAVEL axis (linear, along the mast
   centerline) ; local +Y = IDBM length / convey axis (bed depth) ; +Z = up.

   FORM (confirmed with Mike):
     • Twin-mast frame; masts rise FROM THE FLOOR. A LOW lower cross beam (top ≤125 mm)
       ties the mast bases so the lift carriage + IDBMs can descend to the lowest floor lane.
     • Lift carriage (NO deck): IDBMs rest on TWO coplanar support beams; reference plane
       lifts from ~floor up to maxDeliveryHeight; mast top ≥ maxDelivery + 2200.
     • Distance between masts = bed width = laneCount × 300 (masts spread with IDBMs).
     • Guided by a STEEL FLOOR RAIL (mast bottoms) and an OVERHEAD MONORAIL (mast tops) —
       both are scene/installation elements whose length & height the Configurator sets
       from the served IDBM-array coverage.
     • Bed IDBMs are the EXISTING IDBM design (shared api.idbm); real IDBM instances.
   ⚠ Some dims are placeholder ASSUMPTIONS — see crane/spec.md.
   ====================================================================== */
(function () {
  "use strict";
  var IDW = 300, IDBM_H = 0.200, IDBM_BODY_BOTTOM = 0.115, ORANGE = 0xf26522;  // body underside = 115 mm above the IDBM base (shared idbm BB=.115)

  var DEFAULTS = {
    "bed.laneCount": 10,
    "bed.idbmLength": 2500,
    "mast.section": 300,
    "mast.carriageWidth": 450,            // bottom bogie/carriage width on the floor rail
    "mast.count": 2,
    "base.beamHeight": 125,               // LOW lower-cross-beam height (≤125 so IDBMs reach the floor)
    "vertical.maxDeliveryHeight": 6000,   // highest delivery deck height (scene-driven)
    "mast.clearanceAboveTop": 2200,       // mast extends this far above max delivery
    "carriage.height": 120,               // lift-carriage support-beam height
    "clearance.berth": 150                // Configurator laneway berth (NOT drawn in the Viewer)
  };
  function num(inst, k) { var v = inst && inst.params ? inst.params[k] : undefined; return (v == null) ? DEFAULTS[k] : v; }

  function dims(inst) {
    var N = num(inst, "bed.laneCount"), L = num(inst, "bed.idbmLength"), mastSec = num(inst, "mast.section");
    var carrW = num(inst, "mast.carriageWidth"), beamH = num(inst, "base.beamHeight");
    var maxDel = num(inst, "vertical.maxDeliveryHeight"), clr = num(inst, "mast.clearanceAboveTop");
    var spanX = N * IDW, depthY = L, mastCtrX = spanX / 2 + mastSec / 2, mastTop = maxDel + clr;
    var footX = spanX + mastSec + carrW, footY = Math.max(depthY, carrW) + 100;
    return { N: N, L: L, mastSec: mastSec, carrW: carrW, beamH: beamH, maxDel: maxDel, clr: clr,
             spanX: spanX, depthY: depthY, mastCtrX: mastCtrX, mastTop: mastTop, footX: footX, footY: footY };
  }
  // reference-plane height (mm above floor) where the IDBMs mount — kinematic state
  function liftMM(inst) {
    var d = dims(inst), lo = d.beamH, hi = d.maxDel;        // lowest = top of the low cross beam (~floor)
    var def = lo + 0.6 * (hi - lo);
    var z = (inst && inst.kinematicState && inst.kinematicState.liftZ != null) ? inst.kinematicState.liftZ : def;
    return Math.max(lo, Math.min(hi, z));
  }

  var SCHEMA_TYPE = {
    typeId: "crane", name: "Crane Car (ASRS Stacker, scalable twin-mast)", category: "vehicle", class: "crane",
    status: "Form & scaling confirmed with Mike; masts-from-floor + low (<=125 mm) lower cross beam + floor rail/overhead monorail added 2026-06-05. A few secondary defaults assumed.",
    params: [
      { key: "bed.laneCount",              type: "number", default: 10,  min: 1, units: "count", desc: "IDBMs side-by-side. DRIVES mast spacing & bed width (= laneCount x 300 mm)." },
      { key: "bed.idbmLength",             type: "number", default: 2500, units: "mm", desc: "IDBM length = bed depth (local Y). Variable; common 2500/2800." },
      { key: "mast.section",               type: "number", default: 300,  units: "mm", assumption: true, desc: "Square mast column cross-section." },
      { key: "mast.carriageWidth",         type: "number", default: 450,  units: "mm", desc: "Bottom bogie/carriage width on the floor rail; carriages spread by laneCount x 300." },
      { key: "mast.count",                 type: "enum",   default: 2, options: [1, 2], desc: "Twin-mast (confirmed)." },
      { key: "base.beamHeight",            type: "number", default: 125,  max: 125, units: "mm", desc: "LOW lower-cross-beam height; top <=125 mm so the IDBMs can reach the lowest floor lane. = lowest reference-plane height." },
      { key: "vertical.maxDeliveryHeight", type: "number", default: 6000, units: "mm", desc: "Highest delivery deck height the crane serves. SCENE-driven; sizes the mast." },
      { key: "mast.clearanceAboveTop",     type: "number", default: 2200, units: "mm", desc: "Mast extends this far above maxDeliveryHeight (>= +2200)." },
      { key: "carriage.height",            type: "number", default: 120,  units: "mm", assumption: true, desc: "Lift-carriage support-beam height (the two beams the IDBMs rest on)." },
      { key: "clearance.berth",            type: "number", default: 150,  units: "mm", assumption: true, desc: "Laneway clearance berth for the Configurator footprint (NOT drawn in the Viewer)." }
    ],
    bed: { laneCount: 10, idbmLength: 2500, idbmWidth: 300, idbmType: "idbm", mount: "two coplanar support beams (no deck)", note: "bed = laneCount IDBM instances; obey normal IDBM op rules." },
    kinematics: { drivableAxes: "X", liftAxis: "Z", travelAlong: "mast centerline (local X)", guides: "steel floor rail (mast bottoms) + overhead monorail (mast tops)",
      note: "Linear travel along X (mast centerline) + vertical hoist along Z. Lowest reference plane = base.beamHeight (~floor); top of stroke = maxDeliveryHeight. Floor rail + overhead monorail are scene elements whose length/height the Configurator sets from the served array. Track length: crane END IDBM aligns with the array's OPPOSITE-end IDBM at each extreme (travelRange = arraySpan + (laneCount-1)x300)." },
    derived: {
      "bed.width": "laneCount x 300", "bed.depth": "bed.idbmLength",
      "mast.spacingCtr": "laneCount x 300 + mast.section",
      "mast.height": "maxDeliveryHeight + clearanceAboveTop  (from the FLOOR; masts rise from the floor)",
      "lift.lowest": "base.beamHeight (top of the low cross beam, ~floor)",
      "lift.travel": "maxDeliveryHeight - base.beamHeight",
      "footprint": "(laneCount x 300 + mast.section + mast.carriageWidth) x (idbmLength + 100)",
      "laneway": "Configurator-only: footprint swept along travel (X) +/- clearance.berth (see laneway2D). NOT rendered in the Viewer."
    },
    geometry: {
      note: "Canonical parametric form (mm). FULLY SCALABLE. No platform deck; IDBMs on two coplanar support beams.",
      frame: "Datum = base pose {position,yaw}. local X = mast-spacing/travel; local Y = bed depth; Z up.",
      masts: "mast.count columns of mast.section^2 rising FROM THE FLOOR to maxDeliveryHeight + clearanceAboveTop.",
      lowerCrossBeam: "LOW orange beam (height base.beamHeight, top <=125 mm) tying the mast bases, spanning mast-outer to mast-outer.",
      bogies: "bottom carriages (mast.carriageWidth) at each mast base, riding the steel floor rail.",
      headBeam: "orange beam joining the mast tops; top guide rollers ride the overhead monorail.",
      liftCarriage: "two coplanar support beams (carriage.height) + mast shoes; drawn as one ordered group so the IDBMs always paint on top. The IDBM LONG BODY rests on the beams (body underside = 115 mm above the IDBM end-housing base; the end housings hang ~115 mm lower & outboard of the beams). Reference plane (beam top) lifts base.beamHeight -> maxDeliveryHeight.",
      bed: "laneCount IDBMs at 300 mm pitch along local X; each idbmLength deep along local Y (shared IDBM drawer).",
      colours: "Masts + lower & upper cross beams = Safety Orange (0xf26522); support beams + shoes dark/grey; IDBMs and rails unchanged.",
      rule: "IDBM module FIXED (300 wide, 200 high). Mast spacing, bed, height all scale from the params."
    },
    connectionPoints: [
      { id: "bed_infeed",  face: "endA", offset: [0, -1, 0], kind: "end_to_end", desc: "-Y bed edge: laneCount lane endA's meet upstream IDBM/rack lanes." },
      { id: "bed_outfeed", face: "endB", offset: [0, 1, 0],  kind: "end_to_end", desc: "+Y bed edge: laneCount lane endB's meet downstream rack lanes." },
      { id: "base_datum",  face: "base", offset: [0, 0, 0],  kind: "pose",        desc: "Crane datum (base pose); rides the floor rail + overhead monorail along X." }
    ],
    datum: { kind: "pose", form: "{ position:[x,y,z] mm, yaw rad }", kinematicState: "{ liftZ: mm } - reference-plane height above floor (runtime; optional)" },
    meta: { author: "component-authoring session (parallel)",
      form: "twin-mast stacker, masts-from-floor, low lower cross beam, floor rail + overhead monorail; lift carriage = 2 support beams (no deck)",
      references: ["Mike's reference images + cleanup notes 2026-06-05", "coordinate_frame_and_component_schema_v0.1.md §2/§3/§4", "viewer_3d.html drawIdbm()"],
      remainingAssumptions: "mast.section, carriage.height, clearance.berth. Rails/monorail length & height are Configurator-set. Appearance to be revisited." }
  };

  window.TZ_CRANE = {
    typeId: "crane", category: "vehicle", schemaType: SCHEMA_TYPE, defaults: DEFAULTS,

    draw3D: function (api, inst, lod) {
      var M = api.M, pose = inst.pose || {}, pos = pose.position || [0, 0, 0], yaw = pose.yaw || 0;
      var cx = pos[0] * M, cy = pos[1] * M, cz = pos[2] * M, al = [Math.cos(yaw), Math.sin(yaw)], ac = [-al[1], al[0]];
      var d = dims(inst);
      var mastSec = d.mastSec * M, carrW = d.carrW * M, beamH = d.beamH * M, spanX = d.spanX * M, depthY = d.depthY * M, mastCtrX = d.mastCtrX * M;
      var mastTopAbs = cz + d.mastTop * M, frameH = num(inst, "carriage.height") * M, idw = IDW * M, N = d.N, mastCount = num(inst, "mast.count");
      var refZ = cz + liftMM(inst) * M;
      var sides = (mastCount >= 2) ? [-1, 1] : [-1];
      var parts = []; function add(x, y, z, f) { parts.push({ k: api.depth(x, y) + z * 0.01, f: f }); }

      // bottom bogies/carriages at each mast base (ride the steel floor rail), low
      sides.forEach(function (s) {
        var fx = cx + al[0] * (s * mastCtrX), fy = cy + al[1] * (s * mastCtrX);
        add(fx, fy, cz + beamH / 2, function () { api.obox(fx, fy, cz, cz + beamH, al, ac, carrW / 2, carrW / 2, 0x2b2f36); });
      });
      // LOW lower cross beam (orange, top <=125 mm) tying the mast bases, mast-outer to mast-outer
      if (mastCount >= 2) {
        add(cx, cy, cz + beamH / 2, function () { api.obox(cx, cy, cz, cz + beamH, al, ac, mastCtrX + mastSec / 2, mastSec * 0.55, ORANGE); });
      }
      // masts (orange) FROM THE FLOOR
      sides.forEach(function (s) {
        var mx = cx + al[0] * (s * mastCtrX), my = cy + al[1] * (s * mastCtrX);
        add(mx, my, (cz + mastTopAbs) / 2, function () { api.obox(mx, my, cz, mastTopAbs, al, ac, mastSec / 2, mastSec / 2, ORANGE); });
      });
      // upper cross beam / head beam (orange)
      if (mastCount >= 2) {
        add(cx, cy, mastTopAbs - mastSec / 2, function () { api.obox(cx, cy, mastTopAbs - mastSec, mastTopAbs, al, ac, mastCtrX + mastSec / 2, mastSec / 2, ORANGE); });
      }
      // top guide rollers (ride the overhead monorail) — full LOD
      if (lod === "full" && mastCount >= 2) {
        sides.forEach(function (s) {
          var mx = cx + al[0] * (s * mastCtrX), my = cy + al[1] * (s * mastCtrX);
          add(mx, my, mastTopAbs + 0.06, function () { api.obox(mx, my, mastTopAbs, mastTopAbs + 0.12, al, ac, mastSec * 0.4, mastSec * 0.6, 0x586173); });
        });
      }
      // hoist cables (full) from head beam down to the carriage
      if (lod === "full" && mastCount >= 2 && api.ctx) {
        sides.forEach(function (s) {
          var mx = cx + al[0] * (s * mastCtrX) + ac[0] * (mastSec * 0.6), my = cy + al[1] * (s * mastCtrX) + ac[1] * (mastSec * 0.6);
          add(mx, my, (mastTopAbs + refZ) / 2, function () {
            var ctx = api.ctx, p0 = api.project(mx, my, mastTopAbs - mastSec), p1 = api.project(mx, my, refZ);
            ctx.strokeStyle = "rgba(40,48,60,0.55)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
          });
        });
      }

      // ---- LIFT CARRIAGE drawn as ONE ordered group (support beams -> shoes -> IDBMs on top) ----
      // so the two support beams are always under the IDBMs (no break-through / tilt artifacts).
      add(cx, cy, refZ, function () {
        // two COPLANAR support beams the IDBMs rest on (dark), spanning mast-to-mast under the bed
        [-1, 1].forEach(function (sy) {
          var oy = depthY * 0.32 * sy, ex = cx + ac[0] * oy, ey = cy + ac[1] * oy;
          api.obox(ex, ey, refZ - frameH, refZ, al, ac, mastCtrX * 0.92, 0.06, 0x2b3038);
        });
        // mast shoes (grey) — the carriage rides the masts
        sides.forEach(function (s) {
          var mx = cx + al[0] * (s * mastCtrX), my = cy + al[1] * (s * mastCtrX);
          api.obox(mx, my, refZ - frameH, refZ + frameH, al, ac, mastSec * 0.55, mastSec * 0.7, 0x586173);
        });
        // bed = N IDBM instances drawn far->near so they layer correctly on top.
        // Dropped by IDBM_BODY_BOTTOM so the LONG BODY (underside 115 mm above the IDBM base) rests on
        // the support beams; the end housings then hang ~115 mm lower and outboard of the beams.
        var lanes = [];
        for (var i = 0; i < N; i++) {
          var off = (i - (N - 1) / 2) * idw, bx = cx + al[0] * off, by = cy + al[1] * off;
          lanes.push({ d: api.depth(bx, by), x: bx, y: by });
        }
        lanes.sort(function (a, b) { return a.d - b.d; }).forEach(function (L) { api.idbm(L.x, L.y, refZ - IDBM_BODY_BOTTOM, depthY, yaw + Math.PI / 2, lod); });
      });

      parts.sort(function (a, b) { return a.k - b.k; }).forEach(function (p) { p.f(); });
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
      return { min: [cx - ex, cy - ey, cz], max: [cx + ex, cy + ey, cz + d.mastTop * M] };
    }
  };
})();
