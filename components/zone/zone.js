/* ======================================================================
   Tetrisize Platform — Zone (floor area)
   Contract object: window.TZ_ZONE   (read components/COMPONENT_AUTHORING_BRIEF.md)

   A floor polygon classifying an area: agv_drivable | keepout | storage | staging
   (schema §2 Zone). Drawn as a translucent floor patch + coloured outline.
   Units: schema in mm, renderer in metres (api.M = 0.001). Z-up. Datum = pose (centre).
   ⚠ Placeholder size; rectangle form (extend to full polygon later). See zone/spec.md.
   ====================================================================== */
(function () {
  "use strict";
  var KIND_RGB = { agv_drivable: "46,160,67", keepout: "200,60,60", storage: "43,108,255", staging: "210,150,30" };

  var DEFAULTS = { "zone.width": 6000, "zone.depth": 4000, "zone.kind": "agv_drivable" };
  function num(inst, k) { var v = inst && inst.params ? inst.params[k] : undefined; return (v == null) ? DEFAULTS[k] : v; }

  var SCHEMA_TYPE = {
    typeId: "zone", name: "Zone (floor area)", category: "zone",
    status: "DRAFT — rectangle form; schema §2 supports a full polygon. Placeholder size.",
    params: [
      { key: "zone.width", type: "number", default: 6000, units: "mm", desc: "Zone width (local X)." },
      { key: "zone.depth", type: "number", default: 4000, units: "mm", desc: "Zone depth (local Y)." },
      { key: "zone.kind",  type: "enum", default: "agv_drivable", options: ["agv_drivable", "keepout", "storage", "staging"], desc: "Zone classification (schema §2)." }
    ],
    geometry: { note: "Flat floor patch (rectangle = polygon shortcut). Translucent fill + coloured outline by kind.",
      frame: "Datum = pose {position,yaw} at centre; local X = width, Y = depth, on the floor (Z≈0).",
      polygon: "schema §2 Zone.polygon[] — this rectangle is the simple case; full polygon support is a later extension." },
    connectionPoints: [],
    datum: { kind: "pose", form: "{ position:[x,y,z] mm, yaw rad }" },
    meta: { author: "component-authoring session (parallel)", kinds: Object.keys(KIND_RGB),
      references: ["coordinate_frame_and_component_schema_v0.1.md §2 (Zone: agv_drivable|keepout|storage|staging)"],
      remainingAssumptions: "rectangle vs arbitrary polygon; default size; colour scheme." }
  };

  window.TZ_ZONE = {
    typeId: "zone", category: "zone", schemaType: SCHEMA_TYPE, defaults: DEFAULTS,

    draw3D: function (api, inst, lod) {
      var ctx = api.ctx; if (!ctx) return;
      var M = api.M, pose = inst.pose || {}, pos = pose.position || [0, 0, 0], yaw = pose.yaw || 0;
      var cx = pos[0] * M, cy = pos[1] * M, cz = pos[2] * M + 0.006, al = [Math.cos(yaw), Math.sin(yaw)], ac = [-al[1], al[0]];
      var hw = num(inst, "zone.width") / 2 * M, hd = num(inst, "zone.depth") / 2 * M;
      var rgb = KIND_RGB[num(inst, "zone.kind")] || KIND_RGB.agv_drivable;
      var c = function (sx, sy) { return api.project(cx + al[0] * (sx * hw) + ac[0] * (sy * hd), cy + al[1] * (sx * hw) + ac[1] * (sy * hd), cz); };
      var p = [c(-1, -1), c(1, -1), c(1, 1), c(-1, 1)];
      ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (var i = 1; i < 4; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath();
      ctx.fillStyle = "rgba(" + rgb + ",0.16)"; ctx.fill();
      ctx.strokeStyle = "rgba(" + rgb + ",0.9)"; ctx.lineWidth = 2; ctx.stroke();
    },

    footprint2D: function (inst) {
      var pose = inst.pose || {}, pos = pose.position || [0, 0, 0], yaw = pose.yaw || 0, al = [Math.cos(yaw), Math.sin(yaw)], ac = [-al[1], al[0]];
      var hw = num(inst, "zone.width") / 2, hd = num(inst, "zone.depth") / 2;
      return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(function (q) { return [pos[0] + al[0] * q[0] + ac[0] * q[1], pos[1] + al[1] * q[0] + ac[1] * q[1]]; });
    },

    bbox: function (inst) {
      var M = 0.001, pose = inst.pose || {}, pos = pose.position || [0, 0, 0], yaw = pose.yaw || 0, cx = pos[0] * M, cy = pos[1] * M, cz = pos[2] * M;
      var hw = num(inst, "zone.width") / 2 * M, hd = num(inst, "zone.depth") / 2 * M, ca = Math.abs(Math.cos(yaw)), sa = Math.abs(Math.sin(yaw));
      var ex = ca * hw + sa * hd, ey = sa * hw + ca * hd;
      return { min: [cx - ex, cy - ey, cz], max: [cx + ex, cy + ey, cz + 0.02] };
    }
  };
})();
