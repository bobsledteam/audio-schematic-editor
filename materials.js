/**
 * Materials catalog — shared layer for circuit + electromagnet engines.
 *
 * Owns intrinsic material properties (magnetic, electrical, mechanical hints)
 * and default bindings from object types → material ids (e.g. screw → stainless).
 * Engines look up by material id or object role; product UI may override
 * magnet grades via bobbinMagnetType while screws/pins stay stainless.
 *
 * Coherence with CalcEngines:
 *   - materials → electromagnet  (μ, Br/Hc, eddy, coreWeight)
 *   - materials → circuit        (ρ, σ, eddy)
 *   - electromagnet → circuit    (derived Z/L; materials only supply props)
 *
 * @see CalcMaterials
 * @see CalcEngines.ENGINE_BRIDGES
 * @see CalcEngines.MATERIALS
 */
(function (global) {
  'use strict';

  /**
   * @typedef {Readonly<{
   *   id: string,
   *   label: string,
   *   family: string,
   *   Br?: number,
   *   Hc?: number,
   *   BHmax?: number,
   *   muRel: number,
   *   strengthRel?: number,
   *   eddyRel: number,
   *   resistivityOhmM?: number,
   *   conductivityMS?: number,
   *   tempCoefBr?: number,
   *   coreWeight?: number,
   *   engines: Readonly<{ electromagnet: string[], circuit: string[] }>,
   *   note?: string,
   * }>} MaterialDef
   */

  /** @type {Readonly<Record<string, MaterialDef>>} */
  const MATERIALS = Object.freeze({
    stainlessSteel: Object.freeze({
      id: 'stainlessSteel',
      label: 'Stainless steel',
      family: 'stainless',
      /** Austenitic SS ≈ non-magnetic permanent magnet (Br≈0). */
      Br: 0,
      Hc: 0,
      BHmax: 0,
      muRel: 1.05,
      strengthRel: 0.05,
      eddyRel: 0.35,
      resistivityOhmM: 7.4e-7,
      conductivityMS: 1.35,
      coreWeight: 0.10,
      engines: Object.freeze({
        electromagnet: Object.freeze(['muRel', 'eddyRel', 'coreWeight', 'Br', 'Hc']),
        circuit: Object.freeze(['resistivityOhmM', 'eddyRel']),
      }),
      note: 'Austenitic stainless (pickup screws / pins). Nearly non-magnetic; mild eddy loss.',
    }),
    nickelSilver: Object.freeze({
      id: 'nickelSilver',
      label: 'Nickel silver',
      family: 'nickelSilver',
      Br: 0,
      Hc: 0,
      BHmax: 0,
      muRel: 1.0,
      strengthRel: 0,
      eddyRel: 0.85,
      resistivityOhmM: 3.0e-7,
      conductivityMS: 3.3,
      engines: Object.freeze({
        electromagnet: Object.freeze(['muRel', 'eddyRel']),
        circuit: Object.freeze(['resistivityOhmM', 'eddyRel', 'conductivityMS']),
      }),
      note: 'Cu–Ni–Zn baseplate stock — non-magnetic, conductive (eddy damping).',
    }),
    brass: Object.freeze({
      id: 'brass',
      label: 'Brass',
      family: 'brass',
      Br: 0,
      Hc: 0,
      BHmax: 0,
      muRel: 1.0,
      strengthRel: 0,
      /** Higher σ than NiAg → stronger eddy damping under vibrating string field. */
      eddyRel: 1.1,
      /** Cartridge brass (C260) ballpark at 20 °C. */
      resistivityOhmM: 6.4e-8,
      conductivityMS: 15.6,
      engines: Object.freeze({
        electromagnet: Object.freeze(['muRel', 'eddyRel']),
        circuit: Object.freeze(['resistivityOhmM', 'eddyRel', 'conductivityMS']),
      }),
      note: 'Cu–Zn baseplate stock — non-magnetic; more conductive than nickel silver (eddy damp).',
    }),
    alnico2: Object.freeze({
      id: 'alnico2',
      label: 'AlNiCo 2',
      family: 'alnico',
      Br: 0.75,
      Hc: 45,
      BHmax: 14,
      muRel: 4.5,
      strengthRel: 0.72,
      eddyRel: 1.05,
      tempCoefBr: -0.02,
      engines: Object.freeze({
        electromagnet: Object.freeze(['Br', 'Hc', 'BHmax', 'muRel', 'strengthRel', 'eddyRel']),
        circuit: Object.freeze(['eddyRel']),
      }),
    }),
    alnico3: Object.freeze({
      id: 'alnico3',
      label: 'AlNiCo 3',
      family: 'alnico',
      Br: 0.70,
      Hc: 40,
      BHmax: 11,
      muRel: 5.0,
      strengthRel: 0.65,
      eddyRel: 1.08,
      tempCoefBr: -0.02,
      engines: Object.freeze({
        electromagnet: Object.freeze(['Br', 'Hc', 'BHmax', 'muRel', 'strengthRel', 'eddyRel']),
        circuit: Object.freeze(['eddyRel']),
      }),
    }),
    alnico4: Object.freeze({
      id: 'alnico4',
      label: 'AlNiCo 4',
      family: 'alnico',
      Br: 0.80,
      Hc: 55,
      BHmax: 16,
      muRel: 3.8,
      strengthRel: 0.82,
      eddyRel: 1.0,
      tempCoefBr: -0.02,
      engines: Object.freeze({
        electromagnet: Object.freeze(['Br', 'Hc', 'BHmax', 'muRel', 'strengthRel', 'eddyRel']),
        circuit: Object.freeze(['eddyRel']),
      }),
    }),
    alnico5: Object.freeze({
      id: 'alnico5',
      label: 'AlNiCo 5',
      family: 'alnico',
      Br: 1.25,
      Hc: 50,
      BHmax: 40,
      muRel: 3.5,
      strengthRel: 1.0,
      eddyRel: 1.0,
      tempCoefBr: -0.02,
      engines: Object.freeze({
        electromagnet: Object.freeze(['Br', 'Hc', 'BHmax', 'muRel', 'strengthRel', 'eddyRel']),
        circuit: Object.freeze(['eddyRel']),
      }),
    }),
    alnico8: Object.freeze({
      id: 'alnico8',
      label: 'AlNiCo 8',
      family: 'alnico',
      Br: 0.80,
      Hc: 120,
      BHmax: 40,
      muRel: 2.0,
      strengthRel: 1.15,
      eddyRel: 0.95,
      tempCoefBr: -0.02,
      engines: Object.freeze({
        electromagnet: Object.freeze(['Br', 'Hc', 'BHmax', 'muRel', 'strengthRel', 'eddyRel']),
        circuit: Object.freeze(['eddyRel']),
      }),
    }),
    ceramic5: Object.freeze({
      id: 'ceramic5',
      label: 'Ceramic 5',
      family: 'ceramic',
      Br: 0.40,
      Hc: 240,
      BHmax: 28,
      muRel: 1.05,
      strengthRel: 1.25,
      eddyRel: 0.15,
      tempCoefBr: -0.20,
      engines: Object.freeze({
        electromagnet: Object.freeze(['Br', 'Hc', 'BHmax', 'muRel', 'strengthRel', 'eddyRel']),
        circuit: Object.freeze(['eddyRel']),
      }),
    }),
    neodymium: Object.freeze({
      id: 'neodymium',
      label: 'Neodymium',
      family: 'rareEarth',
      Br: 1.25,
      Hc: 900,
      BHmax: 280,
      muRel: 1.05,
      strengthRel: 2.4,
      eddyRel: 0.25,
      tempCoefBr: -0.12,
      engines: Object.freeze({
        electromagnet: Object.freeze(['Br', 'Hc', 'BHmax', 'muRel', 'strengthRel', 'eddyRel']),
        circuit: Object.freeze(['eddyRel']),
      }),
    }),
    samariumCobalt: Object.freeze({
      id: 'samariumCobalt',
      label: 'Samarium cobalt',
      family: 'rareEarth',
      Br: 0.95,
      Hc: 700,
      BHmax: 180,
      muRel: 1.05,
      strengthRel: 1.9,
      eddyRel: 0.20,
      tempCoefBr: -0.04,
      engines: Object.freeze({
        electromagnet: Object.freeze(['Br', 'Hc', 'BHmax', 'muRel', 'strengthRel', 'eddyRel']),
        circuit: Object.freeze(['eddyRel']),
      }),
    }),
    copper: Object.freeze({
      id: 'copper',
      label: 'Copper',
      family: 'conductor',
      Br: 0,
      Hc: 0,
      BHmax: 0,
      muRel: 1.0,
      strengthRel: 0,
      eddyRel: 1.2,
      /** Annealed Cu at 20 °C — single source for hookup wire + magnet wire. */
      resistivityOhmM: 1.68e-8,
      conductivityMS: 58,
      engines: Object.freeze({
        electromagnet: Object.freeze(['eddyRel']),
        circuit: Object.freeze(['resistivityOhmM', 'conductivityMS']),
      }),
      note: 'Magnet-wire / hookup conductor baseline (ρ at 20 °C). Circuit R=ρL/A.',
    }),
  });

  const MATERIAL_IDS = Object.freeze(Object.keys(MATERIALS));

  /**
   * Default material binding by physical object role.
   * Engines resolve `materialId` (fixed) or `materialIdFromDataset` (component override).
   */
  const OBJECT_MATERIALS = Object.freeze({
    screw: Object.freeze({
      objectType: 'screw',
      poleKind: 'S',
      materialId: 'stainlessSteel',
      label: 'Pickup screw',
      engines: Object.freeze(['electromagnet', 'circuit']),
    }),
    pin: Object.freeze({
      objectType: 'pin',
      poleKind: 'P',
      materialId: 'stainlessSteel',
      label: 'Pickup pin / slug',
      engines: Object.freeze(['electromagnet', 'circuit']),
    }),
    magnet: Object.freeze({
      objectType: 'magnet',
      poleKind: 'M',
      /** Resolved from component dataset (bobbinMagnetType). */
      materialIdFromDataset: 'bobbinMagnetType',
      defaultMaterialId: 'alnico5',
      label: 'Pickup pole magnet',
      engines: Object.freeze(['electromagnet', 'circuit']),
    }),
    barMagnet: Object.freeze({
      objectType: 'barMagnet',
      /** Under-bobbin HB bar — bobbinBarMagnetType. */
      materialIdFromDataset: 'bobbinBarMagnetType',
      defaultMaterialId: 'alnico5',
      label: 'Humbucker bar magnet',
      engines: Object.freeze(['electromagnet', 'circuit']),
    }),
    baseplate: Object.freeze({
      objectType: 'baseplate',
      /** Resolved from component dataset (bobbinBaseplateType). */
      materialIdFromDataset: 'bobbinBaseplateType',
      defaultMaterialId: 'nickelSilver',
      label: 'Pickup baseplate',
      engines: Object.freeze(['electromagnet', 'circuit']),
    }),
    magnetWire: Object.freeze({
      objectType: 'magnetWire',
      materialId: 'copper',
      label: 'Coil magnet wire',
      engines: Object.freeze(['circuit', 'electromagnet']),
    }),
  });

  const OBJECT_TYPE_IDS = Object.freeze(Object.keys(OBJECT_MATERIALS));

  function getMaterial(id) {
    const key = String(id || '').trim();
    return MATERIALS[key] || null;
  }

  function normalizeMaterialId(id, fallback) {
    const m = getMaterial(id);
    if (m) return m.id;
    const fb = getMaterial(fallback);
    return fb ? fb.id : 'alnico5';
  }

  /**
   * Resolve material for an object role.
   * @param {string} objectType — screw | pin | magnet | baseplate | magnetWire
   * @param {{ dataset?: Record<string, string>, materialId?: string }} [opts]
   */
  function materialForObjectType(objectType, opts) {
    const role = OBJECT_MATERIALS[objectType];
    if (!role) return null;
    if (opts?.materialId) {
      return getMaterial(normalizeMaterialId(opts.materialId, role.defaultMaterialId || role.materialId));
    }
    if (role.materialIdFromDataset && opts?.dataset) {
      const fromDs = opts.dataset[role.materialIdFromDataset];
      return getMaterial(normalizeMaterialId(fromDs, role.defaultMaterialId || 'alnico5'));
    }
    if (role.materialId) return getMaterial(role.materialId);
    return getMaterial(role.defaultMaterialId || 'alnico5');
  }

  /** Pole kind S/M/P → object type. */
  function objectTypeForPoleKind(poleKind) {
    const k = String(poleKind || 'M').toUpperCase();
    if (k === 'S') return 'screw';
    if (k === 'P') return 'pin';
    return 'magnet';
  }

  function materialForPoleKind(poleKind, opts) {
    return materialForObjectType(objectTypeForPoleKind(poleKind), opts);
  }

  /** Snapshot for serialize / debug — object type ↔ material id pairs in use. */
  function collectObjectMaterialRefs(opts) {
    const dataset = opts?.dataset || {};
    const out = {};
    OBJECT_TYPE_IDS.forEach((type) => {
      const mat = materialForObjectType(type, { dataset });
      if (mat) {
        out[type] = {
          objectType: type,
          materialId: mat.id,
          family: mat.family,
          label: mat.label,
        };
      }
    });
    return out;
  }

  /** Magnet-grade ids only (for UI selects). */
  function listMagnetMaterialIds() {
    return MATERIAL_IDS.filter((id) => {
      const f = MATERIALS[id].family;
      return f === 'alnico' || f === 'ceramic' || f === 'rareEarth';
    });
  }

  /** Baseplate stock ids (NiAg / brass) for SC + HB plate selects. */
  function listBaseplateMaterialIds() {
    return ['nickelSilver', 'brass'].filter((id) => !!MATERIALS[id]);
  }

  function listBaseplateMaterials() {
    const out = {};
    listBaseplateMaterialIds().forEach((id) => {
      out[id] = MATERIALS[id];
    });
    return out;
  }

  /** Magnet-grade map id → MaterialDef (for UI / EM fallbacks). */
  function listMagnetMaterials() {
    const out = {};
    listMagnetMaterialIds().forEach((id) => {
      out[id] = MATERIALS[id];
    });
    return out;
  }

  /**
   * Slice of a material’s props relevant to one engine (per MaterialDef.engines).
   * @param {string} materialId
   * @param {'electromagnet'|'circuit'} engineId
   * @returns {Record<string, number|string>|null}
   */
  function propsForEngine(materialId, engineId) {
    const mat = getMaterial(materialId);
    if (!mat) return null;
    const keys = mat.engines?.[engineId];
    if (!keys || !keys.length) return { id: mat.id, family: mat.family, label: mat.label };
    const out = { id: mat.id, family: mat.family, label: mat.label };
    keys.forEach((k) => {
      if (mat[k] != null) out[k] = mat[k];
    });
    return out;
  }

  /** Resistivity Ω·m for circuit R=ρL/A (defaults to copper). */
  function resistivityOhmM(materialId) {
    const mat = getMaterial(materialId || 'copper');
    return mat?.resistivityOhmM ?? MATERIALS.copper.resistivityOhmM;
  }

  /** ρ in Ω·mm²/m — convenient for magnet-wire Ω/m = ρ / areaMm2. */
  function resistivityOhmMm2PerM(materialId) {
    return resistivityOhmM(materialId) * 1e6;
  }

  /** Circular conductor A = π(d/2)² in m² from diameter mm. */
  function crossSectionAreaM2(diameterMm) {
    const dM = Number(diameterMm) / 1000;
    if (!Number.isFinite(dM) || dM <= 0) return null;
    return Math.PI * (dM / 2) ** 2;
  }

  /**
   * Ω/m from R=ρL/A → ρ/A (materials→circuit bridge).
   * @param {number} diameterMm
   * @param {string} [materialId='copper']
   */
  function ohmPerMeterForDiameterMm(diameterMm, materialId) {
    const areaM2 = crossSectionAreaM2(diameterMm);
    if (areaM2 == null || areaM2 <= 0) return null;
    return resistivityOhmM(materialId || 'copper') / areaM2;
  }

  /**
   * R = ρ L / A for a round conductor.
   * @param {number} lengthMm path length (1 grid = 1 mm in this app)
   * @param {number} diameterMm
   * @param {string} [materialId='copper']
   */
  function resistanceOhmsRhoLA(lengthMm, diameterMm, materialId) {
    const lengthM = Number(lengthMm) / 1000;
    const areaM2 = crossSectionAreaM2(diameterMm);
    if (!Number.isFinite(lengthM) || lengthM < 0 || areaM2 == null || areaM2 <= 0) return null;
    return (resistivityOhmM(materialId || 'copper') * lengthM) / areaM2;
  }

  /**
   * Props for an object role, already sliced for an engine.
   * @param {string} objectType
   * @param {'electromagnet'|'circuit'} engineId
   * @param {{ dataset?: object, materialId?: string }} [opts]
   */
  function propsForObjectType(objectType, engineId, opts) {
    const mat = materialForObjectType(objectType, opts);
    return mat ? propsForEngine(mat.id, engineId) : null;
  }

  global.CalcMaterials = Object.freeze({
    MATERIALS,
    MATERIAL_IDS,
    OBJECT_MATERIALS,
    OBJECT_TYPE_IDS,
    getMaterial,
    normalizeMaterialId,
    materialForObjectType,
    objectTypeForPoleKind,
    materialForPoleKind,
    collectObjectMaterialRefs,
    listMagnetMaterialIds,
    listMagnetMaterials,
    listBaseplateMaterialIds,
    listBaseplateMaterials,
    propsForEngine,
    propsForObjectType,
    resistivityOhmM,
    resistivityOhmMm2PerM,
    crossSectionAreaM2,
    ohmPerMeterForDiameterMm,
    resistanceOhmsRhoLA,
  });
})(typeof window !== 'undefined' ? window : globalThis);
