(function (global) {
  'use strict';

  /** 2D DXF entity types we import. Everything else is ignored. */
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
  ]);

  function isBinaryDwg(buffer) {
    if (!buffer || buffer.byteLength < 6) return false;
    const bytes = new Uint8Array(buffer, 0, 6);
    const head = String.fromCharCode(...bytes);
    return head.startsWith('AC10') || head.startsWith('AC2');
  }

  function parseGroupPairs(text) {
    const raw = String(text || '').replace(/^\uFEFF/, '');
    const lines = raw.split(/\r?\n/);
    const pairs = [];
    for (let i = 0; i + 1 < lines.length; i += 2) {
      const code = Number.parseInt(lines[i].trim(), 10);
      if (Number.isNaN(code)) continue;
      pairs.push({ code, value: lines[i + 1].trim() });
    }
    return pairs;
  }

  function num(v, fallback = 0) {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function extractEntities(pairs) {
    const entities = [];
    let inEntities = false;
    let current = null;
    let poly = null;

    function pushCurrent() {
      if (!current) return;
      if (current.type === 'POLYLINE') {
        poly = current;
        entities.push(current);
      } else if (current.type === 'VERTEX' && poly) {
        poly.vertices = poly.vertices || [];
        poly.vertices.push({
          x: current.x ?? 0,
          y: current.y ?? 0,
          z: current.z ?? 0,
        });
      } else if (current.type === 'SEQEND') {
        poly = null;
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
      if (!inEntities) continue;

      if (code === 0) {
        pushCurrent();
        current = { type: value.toUpperCase() };
        continue;
      }
      if (!current) continue;

      switch (code) {
        case 10: current.x = num(value); if (current.type === 'LWPOLYLINE') {
          current._vx = num(value);
        } break;
        case 20: current.y = num(value); if (current.type === 'LWPOLYLINE' && current._vx != null) {
          current.vertices = current.vertices || [];
          current.vertices.push({ x: current._vx, y: num(value) });
          current._vx = null;
        } break;
        case 30: current.z = num(value); break;
        case 11: current.x2 = num(value); break;
        case 21: current.y2 = num(value); break;
        case 31: current.z2 = num(value); break;
        case 40: current.r = num(value); current.major = num(value); break;
        case 41: current.ratio = num(value); break;
        case 42: current.bulge = num(value); break;
        case 50: current.startAngle = num(value); break;
        case 51: current.endAngle = num(value); break;
        case 70: current.flags = Number.parseInt(value, 10) || 0; break;
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
    // bit 8 = 3D polyline, bit 16 = 3D polygon mesh, bit 64 = polyface mesh
    return !!(flags & (8 | 16 | 64));
  }

  function filter2dEntities(entities) {
    return entities.filter((ent) => {
      if (!ALLOWED_2D.has(ent.type)) return false;
      if (ent.type === 'VERTEX' || ent.type === 'SEQEND') return false;
      if (is3dPolyline(ent)) return false;
      // Skip clearly elevated 3D segments (both ends off the XY plane)
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

  function entityToSvgParts(ent, yFlipMax) {
    const fy = (y) => yFlipMax - y;
    const parts = [];

    if (ent.type === 'LINE') {
      parts.push({
        tag: 'line',
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
      // DXF CCW; with Y flip sweep becomes clockwise in SVG → sweep-flag 0
      const d = `M ${start.x} ${fy(start.y)} A ${r} ${r} 0 ${large} 0 ${end.x} ${fy(end.y)}`;
      parts.push({ tag: 'path', attrs: { d } });
    } else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
      const verts = ent.vertices || [];
      if (verts.length < 2) return parts;
      const closed = !!(ent.flags & 1);
      let d = `M ${verts[0].x} ${fy(verts[0].y)}`;
      for (let i = 1; i < verts.length; i++) {
        d += ` L ${verts[i].x} ${fy(verts[i].y)}`;
      }
      if (closed) d += ' Z';
      parts.push({ tag: 'path', attrs: { d } });
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

  function buildSvgModel(entities) {
    const filtered = filter2dEntities(entities);
    // Collect raw Y for flip extent from entity geometry in DXF space
    let rawMaxY = -Infinity;
    let rawMinY = Infinity;
    filtered.forEach((ent) => {
      const ys = [ent.y, ent.y2];
      (ent.vertices || []).forEach((v) => ys.push(v.y));
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

    const parts = [];
    filtered.forEach((ent) => {
      parts.push(...entityToSvgParts(ent, rawMaxY));
    });

    const bounds = boundsOfParts(parts);
    const pad = 1;
    const width = Math.max(1, bounds.maxX - bounds.minX + pad * 2);
    const height = Math.max(1, bounds.maxY - bounds.minY + pad * 2);
    const ox = bounds.minX - pad;
    const oy = bounds.minY - pad;

    const normalized = parts.map((p) => {
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
      return { tag: p.tag, attrs: a };
    });

    return {
      width,
      height,
      parts: normalized,
      entityCount: filtered.length,
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

  /**
   * Parse DXF text into a 2D SVG model (drawing units).
   * Returns null if no 2D geometry found.
   */
  function parseDxfToSvgModel(dxfText) {
    const pairs = parseGroupPairs(dxfText);
    if (!pairs.length) {
      throw new Error('Empty or invalid DXF');
    }
    const entities = extractEntities(pairs);
    const model = buildSvgModel(entities);
    if (!model.entityCount) {
      throw new Error('No 2D geometry found in file');
    }
    model.svgInner = partsToSvgInner(model.parts);
    return model;
  }

  async function readCadFile(file) {
    const buffer = await file.arrayBuffer();
    if (isBinaryDwg(buffer)) {
      throw new Error('Binary DWG is not supported — export as DXF (2D) and try again');
    }
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    if (!/SECTION/i.test(text) || !/ENTITIES/i.test(text)) {
      throw new Error('File does not look like a DXF drawing');
    }
    return parseDxfToSvgModel(text);
  }

  global.GuitarCad = {
    readCadFile,
    parseDxfToSvgModel,
    isBinaryDwg,
  };
})(window);
