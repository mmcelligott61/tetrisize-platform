/* ======================================================================
   Tetrisize Platform — Mezzanine Deck
   Contract object: window.TZ_MEZZANINE   (read components/COMPONENT_AUTHORING_BRIEF.md)

   A raised deck on a grid of posts (schema §2 mezzanine_deck) — a second level the
   platform can run on. Units: schema in mm, renderer in metres (M=0.001). Z-up.
   Datum = pose at the deck's base centre (floor). Local X = width, Y = depth, Z up.
   ⚠ Placeholder dimensions. See mezzanine/spec.md.
   ====================================================================== */
(function () {
  "use strict";
  var STEEL = 0x55606e, DECK = 0x8a93a0;

  var DEFAULTS = {
    "deck.width": 8000, "deck.depth": 6000, "deck.height": 3000, "deck.thickness": 200,
    "post.section": 150, "post.cols": 3, "post.rows": 2
  };
  function num(inst, k) { var v = inst && inst.params ? inst.params[k] : undefined; return (v == null) ? DEFAULTS[k] : v; }

  var SCHEMA_TYPE = {
    typeId: "mezzanine", name: "Mezzanine Deck", category: "mezzanine_deck",
    status: "DRAFT — placeholder dimensions; confirm with Mike.",
    params: [
      { key: "deck.width",     type: "number", default: 8000, units: "mm", desc: "Deck width (local X)." },
      { key: "deck.depth",     type: "number", default: 6000, units: "mm", desc: "Deck depth (local Y)." },
      { key: "deck.height",    type: "number", default: 3000, units: "mm", desc: "Deck top surface height above floor (Z)." },
      { key: "deck.thickness", type: "number", default: 200, units: "mm", assumption: true, desc: "Deck slab thickness." },
      { key: "post.section",   type: "number", default: 150, units: "mm", assumption: true, desc: "Square post section." },
      { key: "post.cols",      type: "number", default: 3, min: 2, units: "count", assumption: true, desc: "Post columns along X." },
      { key: "post.rows",      type: "number", default: 2, min: 2, units: "count", assumption: true, desc: "Post rows along Y." }
    ],
    geometry: { note: "Posts grid (cols x rows) floor→deck underside; deck slab on top.",
      frame: "Datum = pose {position,yaw} at base centre; local X = width, Y = depth, Z up.",
      deck: "slab of deck.thickness with top at deck.height; posts at a cols x rows grid spanning the footprint." },
    connectionPoints: [{ id: "deck_level", face: "top", offset: [0, 0, 1], kind: "level", desc: "Deck top surface — a level the platform can run on." }],
    datum: { kind: "pose", form: "{ position:[x,y,z] mm, yaw rad }" },
    meta: { author: "component-authoring session (parallel)", colours: "Steel posts 0x55606e, deck 0x8a93a0.",
      references: ["coordinate_frame_and_component_schema_v0.1.md §2 (mezzanine_deck), §1 (Level)"],
      remainingAssumptions: "deck.thickness, post.section, post grid, handrails, stairs. Appearance to be revisited." }
  };

  window.TZ_MEZZANINE = {
    typeId: "mezzanine", category: "mezzanine_deck", schemaType: SCHEMA_TYPE, defaults: DEFAULTS,

    draw3D: function (api, inst, lod) {
      var M = api.M, pose = inst.pose || {}, pos = pose.position || [0, 0, 0], yaw = pose.yaw || 0;
      var cx = pos[0] * M, cy = pos[1] * M, cz = pos[2] * M, al = [Math.cos(yaw), Math.sin(yaw)], ac = [-al[1], al[0]];
      var hw = num(inst, "deck.width") / 2 * M, hd = num(inst, "deck.depth") / 2 * M;
      var top = cz + num(inst, "deck.height") * M, th = num(inst, "deck.thickness") * M, ps = num(inst, "post.section") * M;
      var cols = num(inst, "post.cols"), rows = num(inst, "post.rows"), deckBot = top - th;
      var parts = []; function add(x, y, z, f) { parts.push({ k: api.depth(x, y) + z * 0.01, f: f }); }

      // posts on a cols x rows grid (posts inset from the edges by post.section)
      for (var i = 0; i < cols; i++) {
        for (var j = 0; j < rows; j++) {
          var fx = (cols === 1 ? 0 : (-1 + 2 * i / (cols - 1))) * (hw - ps);
          var fy = (rows === 1 ? 0 : (-1 + 2 * j / (rows - 1))) * (hd - ps);
          var px = cx + al[0] * fx + ac[0] * fy, py = cy + al[1] * fx + ac[1] * fy;
          (function (X, Y) { add(X, Y, cz + deckBot / 2, function () { api.obox(X, Y, cz, deckBot, al, ac, ps / 2, ps / 2, STEEL); }); })(px, py);
        }
      }
      // deck slab
      add(cx, cy, (deckBot + top) / 2, function () { api.obox(cx, cy, deckBot, top, al, ac, hw, hd, DECK); });
      parts.sort(function (a, b) { return a.k - b.k; }).forEach(function (p) { p.f(); });
    },

    footprint2D: function (inst) {
      var pose = inst.pose || {}, pos = pose.position || [0, 0, 0], yaw = pose.yaw || 0, al = [Math.cos(yaw), Math.sin(yaw)], ac = [-al[1], al[0]];
      var hw = num(inst, "deck.width") / 2, hd = num(inst, "deck.depth") / 2;
      return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(function (q) { return [pos[0] + al[0] * q[0] + ac[0] * q[1], pos[1] + al[1] * q[0] + ac[1] * q[1]]; });
    },

    bbox: function (inst) {
      var M = 0.001, pose = inst.pose || {}, pos = pose.position || [0, 0, 0], yaw = pose.yaw || 0, cx = pos[0] * M, cy = pos[1] * M, cz = pos[2] * M;
      var hw = num(inst, "deck.width") / 2 * M, hd = num(inst, "deck.depth") / 2 * M, top = num(inst, "deck.height") * M, ca = Math.abs(Math.cos(yaw)), sa = Math.abs(Math.sin(yaw));
      var ex = ca * hw + sa * hd, ey = sa * hw + ca * hd;
      return { min: [cx - ex, cy - ey, cz], max: [cx + ex, cy + ey, cz + top] };
    }
  };
})();
