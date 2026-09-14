/**
 * Calculation-layer registry (domain-agnostic).
 *
 * Three physics engines form one coherent stack (plus diagnostics):
 *
 *   materials ──μ, ρ, Br/Hc, eddy──► electromagnet ──derived Z/L──► circuit
 *       │                                    │
 *       └──────────ρ, eddy, σ────────────────┘
 *
 *   errorreporting → Bugtest capture / categorize / Cursor export (no dataset keys)
 *
 * Ownership rules:
 *   - circuit     → network values (impedance, inductance, …) + schematic analysis/render
 *   - electromagnet → geometry (bobbin* mm) + bridge flags (bobbinCircuitDerived/Manual)
 *   - materials   → intrinsic material props + object-type bindings
 *
 * Shared refs (not geometry, not network values):
 *   - bobbinMagnetType  — magnet grade id; stored on EM components, resolved in materials
 *   - objectMaterials   — serialize snapshot of objectType→materialId (materials-owned)
 *
 * Product surfaces (guitar, pedal, amp) layer presets/UI without renaming these APIs.
 *
 * @see CalcEngines
 * @see CalcMaterials
 */
(function (global) {
  'use strict';

  /** @typedef {'circuit' | 'electromagnet' | 'materials' | 'errorreporting'} EngineId */

  /**
   * Explicit cross-engine contracts. App bridges must honor these — do not
   * write circuit Z/L under bobbin* keys, or duplicate Br/μ tables in EM code.
   *
   * @type {ReadonlyArray<{
   *   id: string,
   *   from: EngineId,
   *   to: EngineId,
   *   via: ReadonlyArray<string>,
   *   flags?: ReadonlyArray<string>,
   *   note: string,
   * }>}
   */
  const ENGINE_BRIDGES = Object.freeze([
    Object.freeze({
      id: 'materials-to-electromagnet',
      from: 'materials',
      to: 'electromagnet',
      via: Object.freeze([
        'muRel', 'Br', 'Hc', 'BHmax', 'strengthRel', 'eddyRel', 'coreWeight',
        'OBJECT_MATERIALS',
      ]),
      note:
        'Pole / magnet / baseplate physics via CalcMaterials.materialForObjectType '
        + '(or materialForPoleKind). Geometry stays bobbin*; materials stay ids + props.',
    }),
    Object.freeze({
      id: 'materials-to-circuit',
      from: 'materials',
      to: 'circuit',
      via: Object.freeze(['resistivityOhmM', 'conductivityMS', 'eddyRel']),
      note:
        'Conductor ρ for R=ρL/A (hookup + magnet wire); eddyRel as loss proxy. '
        + 'Look up copper / stainless / nickel-silver from CalcMaterials — do not hardcode ρ.',
    }),
    Object.freeze({
      id: 'electromagnet-to-circuit',
      from: 'electromagnet',
      to: 'circuit',
      via: Object.freeze(['impedance', 'inductance']),
      flags: Object.freeze(['bobbinCircuitDerived', 'bobbinCircuitManual', 'bobbinCalcBridge']),
      note:
        'Dimensional pickup estimate may write circuit impedance (DCR) + inductance '
        + 'when bobbinCalcBridge is enabled (off by default). '
        + 'Flags track auto vs manual; never store R/L under bobbin* keys.',
    }),
  ]);

  /**
   * Keys whose meaning is owned by materials but may be stored alongside EM geometry.
   * @type {Readonly<{
   *   bobbinMagnetType: { owner: EngineId, storedWith: EngineId, role: string },
   *   objectMaterials: { owner: EngineId, serializeOnly: true, role: string },
   * }>}
   */
  const SHARED_REF_KEYS = Object.freeze({
    bobbinMagnetType: Object.freeze({
      owner: 'materials',
      storedWith: 'electromagnet',
      role: 'Pole magnet-grade material id (resolved via CalcMaterials.MATERIALS)',
    }),
    bobbinBarMagnetType: Object.freeze({
      owner: 'materials',
      storedWith: 'electromagnet',
      role: 'HB under-bobbin bar magnet grade id',
    }),
    bobbinBaseplateType: Object.freeze({
      owner: 'materials',
      storedWith: 'electromagnet',
      role: 'Baseplate stock id (nickelSilver | brass)',
    }),
    objectMaterials: Object.freeze({
      owner: 'materials',
      serializeOnly: true,
      role: 'Snapshot of objectType → materialId for integrations / debug',
    }),
  });

  /**
   * @type {Readonly<Record<EngineId, {
   *   id: EngineId,
   *   name: string,
   *   owns: ReadonlyArray<string>,
   *   consumes: ReadonlyArray<EngineId>,
   *   provides: ReadonlyArray<string>,
   *   datasetKeys: ReadonlyArray<string>,
   *   note: string,
   *   serializeFlatKeys?: ReadonlyArray<string>,
   * }>>}
   */
  const ENGINES = Object.freeze({
    circuit: Object.freeze({
      id: 'circuit',
      name: 'Circuit engine',
      owns: Object.freeze([
        'ELECTRICAL_VALUE_DEFS',
        'ELECTRICAL_FORMULAS',
        'component electrical dataset (impedance, inductance, resistance, …)',
        'analysis: computeCircuitAnalysis / schematic pin metrics',
        'rendering: schematic SVG, peek, wire totals',
        'wire conductor resistance (ρL/A) and formula hosts',
        'pot / cap / source electrical network heuristics',
      ]),
      consumes: Object.freeze(['materials', 'electromagnet']),
      provides: Object.freeze([
        'network Z / L / R / C values',
        'schematic analysis + rendering',
      ]),
      datasetKeys: Object.freeze([
        'impedance',
        'inductance',
        'resistance',
        'capacitance',
        'forwardVoltage',
        'reverseVoltage',
        'forwardCurrent',
        'hfe',
        'idss',
        'vgsOff',
        'vgsTh',
        'rdsOn',
        'mu',
        'heaterVoltage',
        'plateDissipation',
        'openLoopGain',
        'gainBandwidth',
        'slewRate',
        'inputOffset',
        'supplyVoltage',
        'voltage',
        'currentRating',
        'primaryVoltage',
        'secondaryVoltage',
        'turnsRatio',
        'coilVoltage',
        'powerRating',
        'tolerance',
        'glowColor',
      ]),
      /** Legacy flat keys always written on component serialize (subset of datasetKeys). */
      serializeFlatKeys: Object.freeze([
        'impedance',
        'resistance',
        'capacitance',
        'forwardVoltage',
        'reverseVoltage',
        'forwardCurrent',
        'inductance',
        'voltage',
        'hfe',
        'idss',
        'vgsOff',
        'vgsTh',
        'rdsOn',
        'mu',
        'heaterVoltage',
        'plateDissipation',
        'openLoopGain',
        'gainBandwidth',
        'slewRate',
        'inputOffset',
        'supplyVoltage',
        'powerRating',
        'tolerance',
      ]),
      note:
        'Electrical network values, formulas, schematic analysis, and circuit rendering. '
        + 'Symbols like L (inductance) and V (voltage) belong here — not bobbin length or bevel V. '
        + 'Consumes materials (ρ, eddy) and optional EM→circuit derived Z/L.',
    }),
    electromagnet: Object.freeze({
      id: 'electromagnet',
      name: 'Electromagnet engine',
      owns: Object.freeze([
        'coil-form / bobbin geometry (length, width, ratio)',
        'dual-coil: two bobbins + coil gap; poles per coil (North/South may differ)',
        'magnet count(s), body diameters, heights, bevels (V025/M050), string spacing',
        'per-pole type S/M/P (Screw / Magnet / Pin) — material via CalcMaterials',
        'HB under-stack: spacers + bar magnet + baseplate (material via CalcMaterials)',
        'per-magnet XY offsets + bottom-distance readout',
        'bobbin preview + magnet selection UI',
        'dataset keys bobbin* (geometry + bridge flags)',
        'derived top diameters (body − 2×chamfer)',
      ]),
      consumes: Object.freeze(['materials']),
      provides: Object.freeze([
        'bobbin* geometry',
        'pole layout for EM estimates',
        'optional derived circuit Z/L (via electromagnet-to-circuit bridge)',
      ]),
      datasetKeys: Object.freeze([
        'bobbinLengthMm',
        'bobbinWidthMm',
        'bobbinMagnetCount',
        'bobbinMagnetCounts',
        'bobbinStringSpacingMm',
        'bobbinMagnetDiameterMm',
        'bobbinMagnetDiametersMm',
        'bobbinMagnetHeightMm',
        'bobbinMagnetHeightsMm',
        'bobbinCavityHeightMm',
        'bobbinThicknessMm',
        'bobbinBottomThicknessMm',
        'bobbinCoilWireAwg',
        'bobbinCoilWireAwgs',
        'bobbinCoilInsulation',
        'bobbinCoilInsulations',
        'bobbinCoilTurns',
        'bobbinCoilTurnsManual',
        /** Material grade ref — meaning owned by materials; stored with EM geometry. */
        'bobbinMagnetType',
        'bobbinBarMagnetType',
        'bobbinBaseplateType',
        'bobbinBaseplateEnabled',
        'bobbinBaseplateThicknessMm',
        'bobbinMagnetBevels',
        'bobbinMagnetOffsetsMm',
        'bobbinMagnetTopDiametersMm',
        'bobbinMagnetBottomDistancesMm',
        'bobbinCoilGapMm',
        'bobbinPoleTypes',
        'bobbinGeometryPreset',
        'bobbinGeometryPresets',
        'bobbinCircuitDerived',
        'bobbinCircuitManual',
        /** Opt-in: dimensional model writes circuit Z/L (off by default per asset). */
        'bobbinCalcBridge',
      ]),
      note:
        'Coil-form and pole-piece geometry. Keep prefixed bobbin* keys. '
        + 'Resolve μ/Br/eddy through CalcMaterials — do not duplicate material tables here. '
        + 'May derive circuit impedance/inductance when bobbinCalcBridge is on; '
        + 'flags bobbinCircuitDerived/Manual only. '
        + 'bobbinGeometryPreset is the active slot id; bobbinGeometryPresets stores '
        + 'per-slot snapshots (dimensional + electrical) including user-created presets.',
    }),
    materials: Object.freeze({
      id: 'materials',
      name: 'Materials catalog',
      owns: Object.freeze([
        'CalcMaterials.MATERIALS — Br, Hc, BHmax, μr, eddyRel, resistivity, …',
        'OBJECT_MATERIALS — object type → material id (screw→stainless, …)',
        'shared lookups for electromagnet + circuit formulas',
        'serialize refs via objectMaterials (+ bobbinMagnetType meaning)',
      ]),
      consumes: Object.freeze([]),
      provides: Object.freeze([
        'material props by id',
        'object-type → material bindings',
        'engine-scoped property slices (propsForEngine)',
      ]),
      datasetKeys: Object.freeze([
        'bobbinMagnetType',
        'bobbinBarMagnetType',
        'bobbinBaseplateType',
        'objectMaterials',
      ]),
      note:
        'Intrinsic material database and object-type bindings. No geometry, no network Z/L. '
        + 'Electromagnet and circuit both consume this catalog via ENGINE_BRIDGES.',
    }),
    errorreporting: Object.freeze({
      id: 'errorreporting',
      name: 'Error-reporting engine',
      owns: Object.freeze([
        'Bugtest capture (console.error / window.onerror / unhandledrejection)',
        'dedupe + consolidate (≥5 → [×N] lines)',
        'category buckets: calculation | render | electromagnetism | UI',
        'Cursor-oriented .txt export via Bugtest badge click cycle',
      ]),
      consumes: Object.freeze([]),
      provides: Object.freeze([
        'ErrorReporting API',
        'categorized bugtest reports',
      ]),
      datasetKeys: Object.freeze([]),
      note:
        'Diagnostics only — no geometry, materials, or network values. '
        + 'Maps faults onto calculation / render / electromagnetism / UI for Cursor fixes. '
        + 'Runtime lives in errorreporting.js (Bugtest Ver. + build badge).',
    }),
  });

  const CIRCUIT = 'circuit';
  const ELECTROMAGNET = 'electromagnet';
  const MATERIALS = 'materials';
  const ERRORREPORTING = 'errorreporting';

  function getEngine(id) {
    return ENGINES[id] || null;
  }

  function listEngines() {
    return Object.values(ENGINES);
  }

  function listEngineBridges() {
    return ENGINE_BRIDGES.slice();
  }

  /** Bridges that feed `engineId` (as `to`) or leave it (as `from`). */
  function bridgesFor(engineId) {
    return ENGINE_BRIDGES.filter((b) => b.from === engineId || b.to === engineId);
  }

  /** True if a component dataset key is owned by the circuit engine. */
  function isCircuitDatasetKey(key) {
    return ENGINES.circuit.datasetKeys.includes(key);
  }

  /** True if a component dataset key is owned by the electromagnet engine. */
  function isElectromagnetDatasetKey(key) {
    return typeof key === 'string' && (
      ENGINES.electromagnet.datasetKeys.includes(key)
      || (key.startsWith('bobbin') && !isMaterialsDatasetKey(key))
    );
  }

  function isMaterialsDatasetKey(key) {
    return ENGINES.materials.datasetKeys.includes(key);
  }

  /**
   * Primary owner of a dataset / serialize key.
   * Shared refs prefer materials (meaning) even when stored with EM geometry.
   * @returns {EngineId|null}
   */
  function ownerOfDatasetKey(key) {
    if (typeof key !== 'string' || !key) return null;
    if (Object.prototype.hasOwnProperty.call(SHARED_REF_KEYS, key)) {
      return SHARED_REF_KEYS[key].owner;
    }
    if (isCircuitDatasetKey(key)) return CIRCUIT;
    if (ENGINES.electromagnet.datasetKeys.includes(key) || key.startsWith('bobbin')) {
      return ELECTROMAGNET;
    }
    return null;
  }

  /**
   * Aggregate unique wires on circuit edges (shared by analysis + schematic rendering).
   * Adapters keep app-specific wire geometry out of the engine registry.
   *
   * @param {Array<{ wire?: object }>} edges
   * @param {{
   *   getLengthMm: (wire: object) => number,
   *   getResistanceOhms: (wire: object) => number|null|undefined,
   *   getGaugeLabel: (wire: object) => string,
   * }} adapters
   */
  function summarizeCircuitWireEdges(edges, adapters) {
    const getLengthMm = adapters?.getLengthMm || (() => 0);
    const getResistanceOhms = adapters?.getResistanceOhms || (() => null);
    const getGaugeLabel = adapters?.getGaugeLabel || (() => '—');
    const seen = new Set();
    let lengthMmSum = 0;
    let resistanceSum = 0;
    let hasResistance = false;
    const gaugeCounts = new Map();

    (edges || []).forEach((edge) => {
      const wire = edge?.wire;
      if (!wire || seen.has(wire)) return;
      seen.add(wire);
      lengthMmSum += Number(getLengthMm(wire)) || 0;
      const r = getResistanceOhms(wire);
      if (r != null && Number.isFinite(r)) {
        resistanceSum += r;
        hasResistance = true;
      }
      const label = getGaugeLabel(wire) || '—';
      gaugeCounts.set(label, (gaugeCounts.get(label) || 0) + 1);
    });

    return {
      wireCount: seen.size,
      lengthMmSum,
      resistanceSum: hasResistance ? resistanceSum : 0,
      hasResistance,
      gaugeCounts,
    };
  }

  /**
   * Compact ρL/A equation markup for circuit rendering wire stats.
   * Kept on wire-resist-* classes (schematic CSS); identity matches
   * ELECTRICAL_FORMULAS.conductorResistance in the circuit engine.
   * ρ should come from CalcMaterials (materials→circuit bridge).
   */
  function buildConductorResistanceEqHtml(valueText) {
    const value = valueText == null ? '—' : String(valueText);
    return [
      '<span class="wire-resist-eq" aria-label="R equals rho L over A">',
      '<i class="wire-resist-var">R</i>',
      '<span class="wire-resist-op">=</span>',
      '<span class="wire-resist-frac">',
      '<span class="wire-resist-num"><i class="wire-resist-var">ρ</i><i class="wire-resist-var">L</i></span>',
      '<span class="wire-resist-den"><i class="wire-resist-var">A</i></span>',
      '</span>',
      '</span>',
      `<span class="wire-resist-value">${value}</span>`,
    ].join('');
  }

  /** Pick only circuit-engine flat serialize keys from a DOM element. */
  function collectCircuitFlatFields(el) {
    const out = {};
    if (!el?.dataset) return out;
    ENGINES.circuit.serializeFlatKeys.forEach((key) => {
      out[key] = el.dataset[key] || '';
    });
    return out;
  }

  /**
   * Electromagnet geometry (+ bridge flags) from a saved component record.
   * Does not include materials-only serialize keys (objectMaterials).
   */
  function pickElectromagnetFieldsFromRecord(compData) {
    const out = {};
    if (!compData || typeof compData !== 'object') return out;
    ENGINES.electromagnet.datasetKeys.forEach((key) => {
      if (compData[key] != null && compData[key] !== '') out[key] = compData[key];
    });
    return out;
  }

  /**
   * Materials refs from a saved component record (grade id + optional snapshot).
   */
  function pickMaterialsFieldsFromRecord(compData) {
    const out = {};
    if (!compData || typeof compData !== 'object') return out;
    ENGINES.materials.datasetKeys.forEach((key) => {
      if (compData[key] != null && compData[key] !== '') out[key] = compData[key];
    });
    return out;
  }

  /**
   * Materials serialize payload for a component (grade + object-type bindings).
   * Uses CalcMaterials when loaded.
   */
  function collectMaterialsSerializeFields(el) {
    const out = {};
    if (!el?.dataset) return out;
    if (el.dataset.bobbinMagnetType) {
      out.bobbinMagnetType = el.dataset.bobbinMagnetType;
    }
    if (el.dataset.bobbinBarMagnetType) {
      out.bobbinBarMagnetType = el.dataset.bobbinBarMagnetType;
    }
    if (el.dataset.bobbinBaseplateType) {
      out.bobbinBaseplateType = el.dataset.bobbinBaseplateType;
    }
    if (typeof global.CalcMaterials?.collectObjectMaterialRefs === 'function') {
      out.objectMaterials = global.CalcMaterials.collectObjectMaterialRefs({
        dataset: el.dataset,
      });
    }
    return out;
  }

  /**
   * Live link to CalcMaterials when the materials script has loaded.
   * Prefer this over reaching for window.CalcMaterials in engine-aware code.
   */
  function getMaterialsCatalog() {
    return global.CalcMaterials || null;
  }

  global.CalcEngines = Object.freeze({
    ENGINES,
    ENGINE_BRIDGES,
    SHARED_REF_KEYS,
    CIRCUIT,
    ELECTROMAGNET,
    MATERIALS,
    ERRORREPORTING,
    getEngine,
    listEngines,
    listEngineBridges,
    bridgesFor,
    isCircuitDatasetKey,
    isElectromagnetDatasetKey,
    isMaterialsDatasetKey,
    ownerOfDatasetKey,
    summarizeCircuitWireEdges,
    buildConductorResistanceEqHtml,
    collectCircuitFlatFields,
    pickElectromagnetFieldsFromRecord,
    pickMaterialsFieldsFromRecord,
    collectMaterialsSerializeFields,
    getMaterialsCatalog,
  });
})(typeof window !== 'undefined' ? window : globalThis);
