/* ======================================================================
   Tetrisize Platform — Obstacle (keep-out volume)
   Contract object: window.TZ_OBSTACLE   (read components/COMPONENT_AUTHORING_BRIEF.md)

   A keep-out box: column | wall | machine (schema §2 Obstacle = footprint + height).
   Units: schema in mm, renderer in metres (api.M = 0.001). Z-up. Datum = pose (base centre).
   ⚠ Box form (footprint = rectangle); extend to full polygon later. See obstacle/spec.md.
   ====================================================================== */
(function () {
  "use strict";
  var KIND_COLOR = { column: 0x6b7280, wall: 0x70798a, machine: 0x55606e };

  var DEFAULTS = { "obstacle.width": 600, "obstacle.depth": 600, "obstacle.height": 4000, "obstacle.kind": "column" };
  function num(inst, k) { var v = inst && inst.params ? inst.params[k] : undefined; return (v == null) ? DEFAULTS[k] : v; }

  var SCHEMA_TYPE = {
    typeId: "obstacle", name: "Obstacle (keep-out)", category: "obstacle",
    status: "DRAFT — box form (rectangle footprint); schema §2 supports a footprint polygon. Placeholder size.",
    params: [
      { key: "obstacle.width",  type: "number", default: 600, units: "mm", desc: "Footprint width (local X)." },
      { key: "obstacle.depth",  type: "number", default: 600, units: "mm", desc: "Footprint depth (local Y)." },
      { key: "obstacle.height", type: "number", default: 4000, units: "mm", desc: "Keep-out height (Z)." },
      { key: "obstacle.kind",   type: "enum", default: "column", options: ["column", "wall", "machine"], desc: "Obstacle kind (schema §2)." }
    ],
    geometry: { note: "Keep-out box (rectangle footprint x height). schema §2 Obstacle = footprintPolygon[] + height; rectangle is the simple case.",
      frame: "Datum = pose {position,yaw} at base centre; local X = width, Y = depth, Z up." },
    connectionPoints: [],
    datum: { kind: "pose", form: "{ position:[x,y,z] mm, yaw rad }" },
    meta: { author: "component-authoring session (parallel)", kinds: Object.keys(KIND_COLOR),
      references: ["coordinate_frame_and_component_schema_v0.1.md §2 (Obstacle: column|wall|machine)"],
      remainingAssumptions: "rectangle vs polygon footprint; default sizes; hazard styling." }
  };

  window.TZ_OBSTACLE = {
    typeId: "obstacle", category: "obstacle", schemaType: SCHEMA_TYPE, defaults: DEFAULTS,

    draw3D: function (api, inst, lod) {
      var M = api.M, pose = inst.pose || {}, pos = pose.position || [0, 0, 0], yaw = pose.yaw || 0;
      var cx = pos[0] * M, cy = pos[1] * M, cz = pos[2] * M, al = [Math.cos(yaw), Math.sin(yaw)], ac = [-al[1], al[0]];
      var hw = num(inst, "obstacle.width") / 2 * M, hd = num(inst, "obstacle.depth") / 2 * M, h = num(inst, "obstacle.height") * M;
      var col = KIND_COLOR[num(inst, "obstacle.kind")] || KIND_COLOR.column;
      api.obox(cx, cy, cz, cz + h, al, ac, hw, hd, col);
      if (lod === "full") api.obox(cx, cy, cz + h, cz + h + 0.02, al, ac, hw, hd, 0xd6a52a);   // hazard cap
    },

    footprint2D: function (inst) {
      var pose = inst.pose || {}, pos = pose.position || [0, 0, 0], yaw = pose.yaw || 0, al = [Math.cos(yaw), Math.sin(yaw)], ac = [-al[1], al[0]];
      var hw = num(inst, "obstacle.width") / 2, hd = num(inst, "obstacle.depth") / 2;
      return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(function (q) { return [pos[0] + al[0] * q[0] + ac[0] * q[1], pos[1] + al[1] * q[0] + ac[1] * q[1]]; });
    },

    bbox: function (inst) {
      var M = 0.001, pose = inst.pose || {}, pos = pose.position || [0, 0, 0], yaw = pose.yaw || 0, cx = pos[0] * M, cy = pos[1] * M, cz = pos[2] * M;
      var hw = num(inst, "obstacle.width") / 2 * M, hd = num(inst, "obstacle.depth") / 2 * M, h = num(inst, "obstacle.height") * M, ca = Math.abs(Math.cos(yaw)), sa = Math.abs(Math.sin(yaw));
      var ex = ca * hw + sa * hd, ey = sa * hw + ca * hd;
      return { min: [cx - ex, cy - ey, cz], max: [cx + ex, cy + ey, cz + h] };
    }
  };
})();
