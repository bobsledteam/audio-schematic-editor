(function (global) {
  'use strict';

  /** 2D DXF entity types we import. */
  const ALLOWED_2D = new Set([
    'LINE',
    'CIRCLE',
    'ARC',
    'LWPOLYLINE',
    'POLYLINE',
    'VERTEX',
    'SEQEND',
    'ELLIPSE',
    'POINT',
    'SPLINE',
  ]);

  function isBinaryDwg(buffer) {
    if (!buffer || buffer.byteLength < 6) return false;
    const bytes = new Uint8Array(buffer, 0, Math.min(32, buffer.byteLength));
    const head = String.fromCharCode(...bytes.subarray(0, 6));
    if (head.startsWith('AC10') || head.startsWith('AC2')) return true;
    // AutoCAD Binary DXF magic
    const ascii = String.fromCharCode(...bytes);
    if (/^AutoCAD Binary DXF/i.test(ascii)) return true;
    return false;
  }

  function looksLikeAsciiDxf(text) {
    if (!text || text.length < 12) return false;
    // Tolerant: many exporters omit tidy SECTION headers but still have ENTITIES / 0\nLINE
    return /(?:^|\n)\s*0\s*\r?\n\s*(?:SECTION|LINE|CIRCLE|ARC|LWPOLYLINE|POLYLINE|SPLINE|INSERT)\b/i.test(text)
      || (/SECTION/i.test(text) && /ENTITIES/i.test(text));
  }

  /**
   * Robust group-code pair parser — skips blank lines and realigns after bad codes.
   */
  function parseGroupPairs(text) {
    const raw = String(text || '').replace(/^\uFEFF/, '');
    const lines = raw.split(/\r?\n/);
    const pairs = [];
    let i = 0;
    while (i < lines.length) {
      const codeLine = lines[i].trim();
      i += 1;
      if (codeLine === '') continue;
      const code = Number.parseInt(codeLine, 10);
      if (Number.isNaN(code)) continue;
      while (i < lines.length && lines[i] === undefined) i += 1;
      if (i >= lines.length) break;
      const value = lines[i].trim();
      i += 1;
      pairs.push({ code, value });
    }
    return pairs;
  }

  function num(v, fallback = 0) {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function extractHeaderInsunits(pairs) {
    let inHeader = false;
    let want = false;
    for (let i = 0; i < pairs.length; i++) {
      const { code, value } = pairs[i];
      if (code === 0 && value === 'SECTION') {
        const namePair = pairs[i + 1];
        inHeader = !!(namePair && namePair.code === 2 && namePair.value === 'HEADER');
        continue;
      }
      if (code === 0 && value === 'ENDSEC') {
        if (inHeader) break;
        continue;
      }
      if (!inHeader) continue;
      if (code === 9 && value === '$INSUNITS') {
        want = true;
        continue;
      }
      if (want && code === 70) {
        return Number.parseInt(value, 10) || 0;
      }
    }
    return 0;
  }

  /** mm per drawing unit from $INSUNITS (common AutoCAD codes). */
  function insunitsToMmScale(insunits) {
    switch (insunits) {
      case 1: return 25.4; // inches
      case 2: return 304.8; // feet
      case 4: return 1; // mm
      case 5: return 10; // cm
      case 6: return 1000; // m
      case 10: return 0.0254; // mils? actually 10 = yards in some tables — skip
      default: return 1; // unitless / already mm-ish
    }
  }

  function extractEntities(pairs) {
    const entities = [];
    let inEntities = false;
    let current = null;
    let poly = null;
    let sawEntitiesSection = false;

    function finishLwVertex() {
      if (!current || current.type !== 'LWPOLYLINE') return;
      if (current._vx == null || current._vy == null) return;
      current.vertices = current.vertices || [];
      current.vertices.push({
        x: current._vx,
        y: current._vy,
        bulge: current._bulge || 0,
      });
      current._vx = null;
      current._vy = null;
      current._bulge = 0;
    }

    function pushCurrent() {
      if (!current) return;
      if (current.type === 'LWPOLYLINE') finishLwVertex();
      if (current.type === 'POLYLINE') {
        poly = current;
        current.vertices = current.vertices || [];
        entities.push(current);
      } else if (current.type === 'VERTEX' && poly) {
        poly.vertices = poly.vertices || [];
        poly.vertices.push({
          x: current.x ?? 0,
          y: current.y ?? 0,
          z: current.z ?? 0,
          bulge: current.bulge || 0,
        });
      } else if (current.type === 'SEQEND') {
        poly = null;
      } else if (current.type === 'SPLINE') {
        current.controlPoints = current.controlPoints || [];
        current.fitPoints = current.fitPoints || [];
        current.knots = current.knots || [];
        current.weights = current.weights || [];
        entities.push(current);
      } else if (ALLOWED_2D.has(current.type) && current.type !== 'VERTEX' && current.type !== 'SEQEND') {
        entities.push(current);
      }
      current = null;
    }

    for (let i = 0; i < pairs.length; i++) {
      const { code, value } = pairs[i];
      if (code === 0 && value === 'SECTION') {
        const namePair = pairs[i + 1];
        if (namePair && namePair.code === 2 && namePair.value === 'ENTITIES') {
          inEntities = true;
          sawEntitiesSection = true;
        }
        continue;
      }
      if (code === 0 && value === 'ENDSEC') {
        if (inEntities) {
          pushCurrent();
          break;
        }
        continue;
      }
      // Some minimal DXFs omit SECTION and start with entities at top level
      if (!sawEntitiesSection && code === 0 && ALLOWED_2D.has(value.toUpperCase())) {
        inEntities = true;
      }
      if (!inEntities) continue;

      if (code === 0) {
        pushCurrent();
        current = { type: value.toUpperCase() };
        continue;
      }
      if (!current) continue;

      switch (code) {
        case 10:
          if (current.type === 'LWPOLYLINE') {
            finishLwVertex();
            current._vx = num(value);
          } else if (current.type === 'SPLINE') {
            current._cpx = num(value);
          } else {
            current.x = num(value);
          }
          break;
        case 20:
          if (current.type === 'LWPOLYLINE') {
            current._vy = num(value);
          } else if (current.type === 'SPLINE') {
            current.controlPoints = current.controlPoints || [];
            current.controlPoints.push({ x: current._cpx || 0, y: num(value) });
            current._cpx = null;
          } else {
            current.y = num(value);
          }
          break;
        case 30: current.z = num(value); break;
        case 11: current.x2 = num(value); break;
        case 21: current.y2 = num(value); break;
        case 31: current.z2 = num(value); break;
        case 40:
          if (current.type === 'SPLINE') {
            current.knots = current.knots || [];
            current.knots.push(num(value));
          } else {
            current.r = num(value);
            current.major = num(value);
          }
          break;
        case 41:
          if (current.type === 'SPLINE') {
            current.weights = current.weights || [];
            current.weights.push(num(value, 1));
          } else {
            current.ratio = num(value);
          }
          break;
        case 42:
          if (current.type === 'LWPOLYLINE') {
            current._bulge = num(value);
          } else {
            current.bulge = num(value);
          }
          break;
        case 50: current.startAngle = num(value); break;
        case 51: current.endAngle = num(value); break;
        case 70: current.flags = Number.parseInt(value, 10) || 0; break;
        case 71: current.degree = Number.parseInt(value, 10) || 3; break;
        case 72: current.nKnots = Number.parseInt(value, 10) || 0; break;
        case 73: current.nCtrl = Number.parseInt(value, 10) || 0; break;
        case 74: current.nFit = Number.parseInt(value, 10) || 0; break;
        case 90: current.nVerts = Number.parseInt(value, 10) || 0; break;
        default: break;
      }
    }
    pushCurrent();
    return entities;
  }

  function is3dPolyline(ent) {
    if (!ent || ent.type !== 'POLYLINE') return false;
    const flags = ent.flags || 0;
    return !!(flags & (8 | 16 | 64));
  }

  function filter2dEntities(entities) {
    return entities.filter((ent) => {
      if (!ALLOWED_2D.has(ent.type)) return false;
      if (ent.type === 'VERTEX' || ent.type === 'SEQEND') return false;
      if (is3dPolyline(ent)) return false;
      if (ent.type === 'LINE') {
        const z1 = Math.abs(ent.z || 0);
        const z2 = Math.abs(ent.z2 || 0);
        if (z1 > 1e-6 && z2 > 1e-6 && Math.abs(z1 - z2) > 1e-6) return false;
      }
      return true;
    });
  }

  function degToRad(d) {
    return (d * Math.PI) / 180;
  }

  function kindOf(ent) {
    const t = (ent.type || '').toLowerCase();
    if (t === 'lwpolyline' || t === 'polyline') return 'polyline';
    if (t === 'spline') return 'spline';
    return t;
  }

  function entityToSvgParts(ent, yFlipMax) {
    const fy = (y) => yFlipMax - y;
    const parts = [];
    const Curves = global.GuitarCurves;
    const kind = kindOf(ent);

    if (ent.type === 'LINE') {
      parts.push({
        tag: 'line',
        kind,
        attrs: {
          x1: ent.x || 0,
          y1: fy(ent.y || 0),
          x2: ent.x2 || 0,
          y2: fy(ent.y2 || 0),
        },
      });
    } else if (ent.type === 'CIRCLE') {
      parts.push({
        tag: 'circle',
        kind: 'circle',
        attrs: {
          cx: ent.x || 0,
          cy: fy(ent.y || 0),
          r: Math.abs(ent.r || 0),
        },
      });
    } else if (ent.type === 'ARC') {
      const cx = ent.x || 0;
      const cy = ent.y || 0;
      const r = Math.abs(ent.r || 0);
      let a0 = ent.startAngle ?? 0;
      let a1 = ent.endAngle ?? 0;
      while (a1 <= a0) a1 += 360;
      const start = { x: cx + r * Math.cos(degToRad(a0)), y: cy + r * Math.sin(degToRad(a0)) };
      const end = { x: cx + r * Math.cos(degToRad(a1)), y: cy + r * Math.sin(degToRad(a1)) };
      const large = a1 - a0 > 180 ? 1 : 0;
      const d = `M ${start.x} ${fy(start.y)} A ${r} ${r} 0 ${large} 0 ${end.x} ${fy(end.y)}`;
      parts.push({ tag: 'path', kind: 'arc', attrs: { d } });
    } else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
      const verts = ent.vertices || [];
      if (verts.length < 2) return parts;
      const closed = !!(ent.flags & 1);
      let d;
      if (Curves?.polyWithBulgeToSvgPath) {
        d = Curves.polyWithBulgeToSvgPath(verts, closed, fy);
      } else {
        d = `M ${verts[0].x} ${fy(verts[0].y)}`;
        for (let i = 1; i < verts.length; i++) {
          d += ` L ${verts[i].x} ${fy(verts[i].y)}`;
        }
        if (closed) d += ' Z';
      }
      parts.push({ tag: 'path', kind: 'polyline', attrs: { d } });
    } else if (ent.type === 'SPLINE') {
      const ctrl = ent.controlPoints || [];
      if (ctrl.length < 2) return parts;
      const degree = Math.max(1, Math.min(ent.degree || 3, ctrl.length - 1));
      let knots = ent.knots && ent.knots.length ? ent.knots.slice() : null;
      if (!knots && Curves?.openUniformKnots) {
        knots = Curves.openUniformKnots(ctrl.length, degree);
      }
      const weights = ent.weights && ent.weights.length === ctrl.length ? ent.weights : null;
      let d = '';
      if (Curves?.nurbsToSvgPath) {
        d = Curves.nurbsToSvgPath(ctrl.map((p) => ({ x: p.x, y: fy(p.y) })), degree, knots, weights, 96);
      } else {
        d = `M ${ctrl[0].x} ${fy(ctrl[0].y)}`;
        for (let i = 1; i < ctrl.length; i++) d += ` L ${ctrl[i].x} ${fy(ctrl[i].y)}`;
      }
      parts.push({
        tag: 'path',
        kind: 'spline',
        attrs: { d },
        nurbs: { ctrl, degree, knots, weights },
      });
    } else if (ent.type === 'ELLIPSE') {
      const cx = ent.x || 0;
      const cy = ent.y || 0;
      const mx = (ent.x2 || 0) - cx;
      const my = (ent.y2 || 0) - cy;
      const major = Math.hypot(mx, my) || Math.abs(ent.major || 0);
      const minor = major * Math.abs(ent.ratio == null ? 1 : ent.ratio);
      const rot = (Math.atan2(my, mx) * 180) / Math.PI;
      parts.push({
        tag: 'ellipse',
        kind: 'ellipse',
        attrs: {
          cx,
          cy: fy(cy),
          rx: major,
          ry: minor,
          rot: -rot,
        },
      });
    } else if (ent.type === 'POINT') {
      parts.push({
        tag: 'circle',
        kind: 'point',
        attrs: {
          cx: ent.x || 0,
          cy: fy(ent.y || 0),
          r: 0.4,
          class: 'cad-point',
        },
      });
    }

    return parts;
  }

  function boundsOfParts(parts) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    function addPoint(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    parts.forEach((p) => {
      const a = p.attrs;
      if (p.tag === 'line') {
        addPoint(a.x1, a.y1);
        addPoint(a.x2, a.y2);
      } else if (p.tag === 'circle') {
        addPoint(a.cx - a.r, a.cy - a.r);
        addPoint(a.cx + a.r, a.cy + a.r);
      } else if (p.tag === 'ellipse') {
        addPoint(a.cx - a.rx, a.cy - a.ry);
        addPoint(a.cx + a.rx, a.cy + a.ry);
      } else if (p.tag === 'path' && a.d) {
        const nums = a.d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
        for (let i = 0; i + 1 < nums.length; i += 2) {
          addPoint(Number(nums[i]), Number(nums[i + 1]));
        }
      }
    });

    if (!Number.isFinite(minX)) {
      return { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    }
    return { minX, minY, maxX, maxY };
  }

  function collectRawY(filtered) {
    let rawMaxY = -Infinity;
    let rawMinY = Infinity;
    filtered.forEach((ent) => {
      const ys = [ent.y, ent.y2];
      (ent.vertices || []).forEach((v) => ys.push(v.y));
      (ent.controlPoints || []).forEach((v) => ys.push(v.y));
      ys.forEach((y) => {
        if (Number.isFinite(y)) {
          rawMaxY = Math.max(rawMaxY, y);
          rawMinY = Math.min(rawMinY, y);
        }
      });
      if (ent.type === 'CIRCLE' || ent.type === 'ARC') {
        const r = Math.abs(ent.r || 0);
        rawMaxY = Math.max(rawMaxY, (ent.y || 0) + r);
        rawMinY = Math.min(rawMinY, (ent.y || 0) - r);
      }
    });
    if (!Number.isFinite(rawMaxY)) {
      rawMaxY = 0;
      rawMinY = 0;
    }
    return { rawMaxY, rawMinY };
  }

  function buildSvgModel(entities, opts = {}) {
    const filtered = filter2dEntities(entities);
    const { rawMaxY } = collectRawY(filtered);
    const scale = opts.unitScale || 1;

    const parts = [];
    filtered.forEach((ent) => {
      parts.push(...entityToSvgParts(ent, rawMaxY));
    });

    // Apply unit scale in drawing space before normalize
    if (scale !== 1) {
      parts.forEach((p) => {
        const a = p.attrs;
        const mul = (k) => { if (a[k] != null) a[k] *= scale; };
        if (p.tag === 'line') {
          ['x1', 'y1', 'x2', 'y2'].forEach(mul);
        } else if (p.tag === 'circle' || p.tag === 'ellipse') {
          ['cx', 'cy', 'r', 'rx', 'ry'].forEach(mul);
        } else if (p.tag === 'path' && a.d) {
          a.d = a.d.replace(/(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi, (m) => String(Number(m) * scale));
        }
      });
    }

    const bounds = boundsOfParts(parts);
    const pad = 1;
    const width = Math.max(1, bounds.maxX - bounds.minX + pad * 2);
    const height = Math.max(1, bounds.maxY - bounds.minY + pad * 2);
    const ox = bounds.minX - pad;
    const oy = bounds.minY - pad;

    const normalized = parts.map((p, idx) => {
      const a = { ...p.attrs };
      if (p.tag === 'line') {
        a.x1 -= ox; a.y1 -= oy; a.x2 -= ox; a.y2 -= oy;
      } else if (p.tag === 'circle' || p.tag === 'ellipse') {
        a.cx -= ox; a.cy -= oy;
        if (p.tag === 'ellipse' && a.rot != null) {
          a.transform = `rotate(${a.rot} ${a.cx} ${a.cy})`;
          delete a.rot;
        }
      } else if (p.tag === 'path' && a.d) {
        a.d = a.d.replace(/(-?\d*\.?\d+(?:e[-+]?\d+)?)\s+(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi, (_, x, y) => {
          return `${Number(x) - ox} ${Number(y) - oy}`;
        });
      }
      a.class = `cad-ent cad-ent-${p.kind || 'curve'}`;
      a['data-cad-kind'] = p.kind || 'curve';
      a['data-cad-idx'] = String(idx);
      a['pointer-events'] = 'stroke';
      return { tag: p.tag, kind: p.kind, attrs: a };
    });

    return {
      width,
      height,
      parts: normalized,
      entityCount: filtered.length,
      unitScale: scale,
    };
  }

  function partsToSvgInner(parts) {
    return parts.map((p) => {
      const attr = Object.entries(p.attrs)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      return `<${p.tag} ${attr} />`;
    }).join('');
  }

  function parseDxfToSvgModel(dxfText) {
    const pairs = parseGroupPairs(dxfText);
    if (!pairs.length) {
      throw new Error('Empty or invalid DXF');
    }
    const insunits = extractHeaderInsunits(pairs);
    const unitScale = insunitsToMmScale(insunits);
    const entities = extractEntities(pairs);
    const model = buildSvgModel(entities, { unitScale });
    if (!model.entityCount) {
      throw new Error('No 2D geometry found in file (need LINE/ARC/LWPOLYLINE/SPLINE/…)');
    }
    model.svgInner = partsToSvgInner(model.parts);
    model.insunits = insunits;
    return model;
  }

  async function readCadFile(file) {
    const buffer = await file.arrayBuffer();
    const name = (file.name || '').toLowerCase();

    if (isBinaryDwg(buffer)) {
      // Some writers label binary DXF as .dwg — still unsupported without a converter
      throw new Error(
        'Binary DWG/DXF is not readable in-browser. In Rhino/AutoCAD use Save As → DXF (ASCII, R12–2018, 2D entities) and import that file.'
      );
    }

    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    if (!looksLikeAsciiDxf(text)) {
      if (name.endsWith('.dwg')) {
        throw new Error(
          'This DWG is not ASCII DXF. Export an ASCII DXF from Rhino (Export → DXF) or AutoCAD (Save As DXF), then import.'
        );
      }
      throw new Error('File does not look like an ASCII DXF drawing');
    }
    return parseDxfToSvgModel(text);
  }

  global.GuitarCad = {
    readCadFile,
    parseDxfToSvgModel,
    isBinaryDwg,
    looksLikeAsciiDxf,
  };
})(window);
