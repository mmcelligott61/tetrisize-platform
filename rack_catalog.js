/* ============================================================================
   TETRISIZE PLATFORM — PALLET-RACK CATALOGUE & LOAD MODEL   (rack_catalog.js)
   ----------------------------------------------------------------------------
   Encodes the Shelving.com adjustable teardrop pallet-rack design data
   (metric-converted) so the Configurator's "+ Rack" tool can let a customer
   pick the racking they ALREADY OWN (metric or imperial) and carry its
   certified-benchmark load capacities through into the model.

   TETRISIZE INTEGRATION: an IDBM (default 6000 mm) rests ACROSS the beams of
   N frame-sets along a rack run (2 frame-sets = 4 beams ... 4 frame-sets =
   8 beams). Design IDBM load ≈ N × beam-pair capacity, capped by the upright
   frame capacity (which itself assumes ~1219 mm vertical beam spacing).

   All values are BENCHMARKS for layout/comparison — confirm certified
   manufacturer figures before procurement / installation.
   ============================================================================ */
(function (root) {
  'use strict';

  var MM_PER_IN = 25.4, LB_PER_KG = 2.20462;
  var mm2in = function (mm) { return Math.round(mm / MM_PER_IN * 10) / 10; };
  var kg2lb = function (kg) { return Math.round(kg * LB_PER_KG); };

  var CAT = {
    meta: {
      source: 'Shelving.com adjustable teardrop pallet rack (metric-converted)',
      capacityBasis_beamSpacing_mm: 1219,   // published upright capacities assume ~1219 mm vertical beam spacing
      disclaimer: 'Benchmark values for layout/comparison only — confirm certified manufacturer specs before procurement.'
    },

    // ---- unit system the customer selects (data is stored metric; imperial is a view) ----
    units: {
      metric:   { dim: 'mm', load: 'kg' },
      imperial: { dim: 'in', load: 'lb', mm2in: mm2in, kg2lb: kg2lb }
    },

    // ---- 3 FRAME TYPES (finish drives environment + load class) ----
    frameTypes: [
      { key: 'light', label: 'Light duty — powder-coated', column_mm: '76 × 41', finish: 'powder',     use: 'Standard indoor storage' },
      { key: 'heavy', label: 'Heavy duty — powder-coated', column_mm: '76 × 76', finish: 'powder',     use: 'Higher-load indoor storage' },
      { key: 'galv',  label: 'Galvanised',                 column_mm: 'varies',  finish: 'galvanised', use: 'Outdoor / humid / freezer / cooler / chemical' }
    ],

    // ---- FRAME DEPTHS (mm) + the practical depth rule ----
    depths_mm: [610, 914, 1067, 1219],
    depthRule: { overhangAllowance_mm: 152, formula: 'rackDepth = palletDepth − 152 mm',
                 example: '1219 mm pallet − 152 = 1067 mm rack depth' },

    // ---- FRAME HEIGHTS (mm) — not every depth/type/finish exists in every height ----
    heights_mm: [1829, 2438, 3048, 3658, 4267, 4877, 6096],

    // ---- BEAM LENGTHS (mm) + practical selection guide ----
    beamLengths_mm: [1219, 1524, 1829, 2438, 2743, 3048, 3658],
    beamSelectionGuide: [
      { need: 'Two standard (NA-style) pallets',  beam_mm: 2438 },
      { need: 'Two pallets + extra side clearance', beam_mm: 2743 },
      { need: 'Larger goods',                      beam_mm: 3048 },
      { need: 'Long-span goods',                   beam_mm: 3658 },
      { need: 'Small / non-standard goods',        beam_mm: 1219 }
    ],

    // ---- BEAM CAPACITY (kg PER BEAM PAIR, uniformly distributed). Beam HEIGHT/profile matters as much as length. ----
    beamProfiles: {
      powder: [
        { len: 1219, h: 89,  cap: 3175 },
        { len: 1524, h: 89,  cap: 2631 },
        { len: 1829, h: 89,  cap: 2111 },
        { len: 2438, h: 89,  cap: 1535 },
        { len: 2438, h: 102, cap: 1814 },
        { len: 2438, h: 114, cap: 2313 },
        { len: 2438, h: 130, cap: 3211 },
        { len: 2438, h: 152, cap: 4144 },
        { len: 2743, h: 105, cap: 1826 },
        { len: 2743, h: 127, cap: 2268 },
        { len: 3048, h: 117, cap: 1969 },
        { len: 3048, h: 130, cap: 2561 },
        { len: 3658, h: 130, cap: 1778 }
      ],
      galv: [
        { len: 1219, h: 64,  cap: 1907 },
        { len: 1829, h: 89,  cap: 2111 },
        { len: 2438, h: 130, cap: 3211 },
        { len: 2743, h: 130, cap: 2849 },
        { len: 3048, h: 130, cap: 2561 },
        { len: 3658, h: 165, cap: 3248 }
      ]
    },

    // ---- UPRIGHT FRAME CAPACITY (kg) at the 1219 mm beam-spacing basis ----
    uprightCapacities: [
      { depth_mm: 610,  heightRange_mm: '1829',      column: 'standard',    cap: 7257 },
      { depth_mm: 1067, heightRange_mm: '2438-3658', column: 'standard',    cap: 7257 },
      { depth_mm: 1219, heightRange_mm: '2438-3658', column: 'standard',    cap: 7257 },
      { depth_mm: 1219, heightRange_mm: '3658',      column: 'heavy',       cap: 9616 },
      { depth_mm: 1219, heightRange_mm: 'any',       column: 'galvanised',  cap: 13154 },
      { depth_mm: 914,  heightRange_mm: 'any',       column: 'galvanised',  cap: 11068 }
    ],
    uprightCaution: 'Published upright capacity assumes ~1219 mm vertical beam spacing. Wider spacing may reduce it — confirm with engineering.',

    // ---- LAYOUT options ----
    aisleWidths_mm: [3048, 3658, 4267],   // tight / mid / wide (always re-check against forklift + pallet + traffic)
    beamLevelsTypical: [2, 3],            // more possible depending on height
    bayRule: 'Total upright frames = number of bays + 1 (add-on bays share a frame)',
    verticalAdjust_mm: 51,                // teardrop punching pitch
    beamStepForDeck_mm: 41,
    anchor_mm: { diameter: 13, length: 76, rule: 'Treat anchoring as mandatory for industrial racking (≥1 anchor per baseplate).' },

    // ---- DECKING ----
    decking: { types: ['timber', 'wire mesh', 'pallet support bars'],
               rule: 'Safe level load = LOWER of beam-pair capacity and decking capacity (check separately).' },

    // ---- TETRISIZE: IDBM resting across N frame-sets ----
    idbm: {
      lengthDefault_mm: 6000,
      frameSetsOptions: [2, 3, 4],        // 2 = ends only (4 beams) ... 4 = 8 beams
      model: 'IDBM rests on a beam-pair at each frame-set it crosses. Design IDBM load ≈ N × beam-pair capacity, then capped by upright frame capacity per frame.'
    },

    // ---- the pre-purchase checklist (reference) ----
    designChecks: [
      'Pallet size / orientation / max weight', 'Pallets (or IDBMs) per level', 'Loaded levels',
      'Beam length', 'Beam-pair capacity', 'Upright frame capacity', 'Vertical beam spacing',
      'Rack depth', 'Rack height', 'Forklift reach height', 'Forklift aisle width', 'Slab capacity',
      'Anchor suitability', 'Sprinkler & lighting clearance', 'Local codes', 'Rack protection',
      'Inspection & maintenance'
    ]
  };

  // ---- helpers ----------------------------------------------------------------
  // beam profiles available for a finish + length, sorted light→heavy
  CAT.beamsFor = function (finish, len) {
    var key = (finish === 'galvanised' || finish === 'galv') ? 'galv' : 'powder';
    return CAT.beamProfiles[key].filter(function (b) { return len == null || b.len === len; })
                                .sort(function (a, b) { return a.cap - b.cap; });
  };
  // the lightest beam profile (for a finish+length) that meets a required per-level load
  CAT.beamForLoad = function (finish, len, requiredKg) {
    return CAT.beamsFor(finish, len).find(function (b) { return b.cap >= requiredKg; }) || null;
  };
  // best published upright capacity for a depth + column class
  CAT.uprightCapFor = function (depth, column) {
    var col = column || 'standard';
    var hits = CAT.uprightCapacities.filter(function (u) {
      return u.depth_mm === depth && (u.column === col || (col === 'galvanised' && u.column === 'galvanised'));
    });
    if (!hits.length) hits = CAT.uprightCapacities.filter(function (u) { return u.column === col; });
    return hits.reduce(function (m, u) { return Math.max(m, u.cap); }, 0) || null;
  };

  /* THE LOAD CALCULATOR — turn a rack selection into carried-through specs.
     opts = { finish, beamLen, beamH, frameSets, levels, depth, column } */
  CAT.calc = function (opts) {
    opts = opts || {};
    var finish = opts.finish || 'powder';
    var prof = CAT.beamsFor(finish, opts.beamLen).find(function (b) { return b.h === opts.beamH; })
            || CAT.beamsFor(finish, opts.beamLen)[0] || null;
    if (!prof) return { error: 'no beam profile for finish=' + finish + ' len=' + opts.beamLen };
    var beamPair = prof.cap;
    var N = opts.frameSets || 2;                                  // frame-sets the IDBM spans
    var levels = opts.levels || 2;
    var col = opts.column || (finish === 'galv' || finish === 'galvanised' ? 'galvanised' : 'standard');
    var uprightCap = CAT.uprightCapFor(opts.depth, col);

    var idbmLoadCap = N * beamPair;                              // design load the IDBM can carry across its N supports
    var perLevelBayLoad = beamPair;                             // a loaded level rests on one beam-pair per bay
    var totalBayLoad = perLevelBayLoad * levels;
    var uprightOK = uprightCap == null ? null : totalBayLoad <= uprightCap;

    return {
      beam: prof,                       // {len,h,cap}
      beamPairCap_kg: beamPair,
      frameSets: N, beamsUnderIdbm: N * 2,
      idbmLoadCap_kg: idbmLoadCap,      // headline: what the IDBM can carry with this racking
      levels: levels,
      totalBayLoad_kg: totalBayLoad,
      uprightCap_kg: uprightCap,
      uprightOK: uprightOK,             // true = bay load within upright frame rating
      basisSpacing_mm: CAT.meta.capacityBasis_beamSpacing_mm,
      note: 'Benchmark — confirm certified specs; upright rating assumes ~1219 mm beam spacing.'
    };
  };

  root.TZ_RACKCAT = CAT;
})(typeof window !== 'undefined' ? window : this);
