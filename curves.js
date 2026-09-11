/**
 * Panel curve helpers — NURBS evaluation, bulge arcs, SVG path builders.
 * Product-agnostic geometry for Rhino-like Line / Polyline / Arc / Spline tools.
 */
(function (global) {
  'use strict';

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  /** Cox–de Boor NURBS basis N_{i,p}(u). */
  function nurbsBasis(i, p, u, knots) {
    const m = knots.length - 1;
    if (p === 0) {
      const last = i === m - 1;
      if ((u >= knots[i] && u < knots[i + 1]) || (last && u === knots[i + 1])) return 1;
      return 0;
    }
    const d0 = knots[i + p] - knots[i];
    const d1 = knots[i + p + 1] - knots[i + 1];
    const a = d0 > 1e-12 ? ((u - knots[i]) / d0) * nurbsBasis(i, p - 1, u, knots) : 0;
    const b = d1 > 1e-12 ? ((knots[i + p + 1] - u) / d1) * nurbsBasis(i + 1, p - 1, u, knots) : 0;
    return a + b;
  }

  /**
   * Evaluate a NURBS curve at parameter u.
   * ctrlPts: [{x,y}], degree p, knots[], optional weights[].
   */
  function evaluateNurbs(ctrlPts, degree, knots, weights, u) {
    const n = ctrlPts.length - 1;
    const p = degree;
    if (n < 0 || !knots || knots.length < n + p + 2) return null;
    const u0 = knots[p];
    const u1 = knots[n + 1];
    const uu = clamp(u, u0, u1);
    let x = 0;
    let y = 0;
    let wSum = 0;
    for (let i = 0; i <= n; i++) {
      const Ni = nurbsBasis(i, p, uu, knots);
      const w = weights && weights[i] != null ? weights[i] : 1;
      const wi = Ni * w;
      x += wi * ctrlPts[i].x;
      y += wi * ctrlPts[i].y;
      wSum += wi;
    }
    if (wSum < 1e-12) return { x: ctrlPts[0].x, y: ctrlPts[0].y };
    return { x: x / wSum, y: y / wSum };
  }

  /** Open uniform knot vector for n+1 control points, degree p. */
  function openUniformKnots(ctrlCount, degree) {
    const n = ctrlCount - 1;
    const p = degree;
    const m = n + p + 1;
    const knots = [];
    for (let i = 0; i <= m; i++) {
      if (i <= p) knots.push(0);
      else if (i >= m - p) knots.push(1);
      else knots.push((i - p) / (n - p + 1));
    }
    return knots;
  }

  /** Sample NURBS to an SVG path `d` string. */
  function nurbsToSvgPath(ctrlPts, degree, knots, weights, samples = 64) {
    if (!ctrlPts || ctrlPts.length < 2) return '';
    const p = Math.max(1, Math.min(degree || 3, ctrlPts.length - 1));
    const k = knots && knots.length ? knots : openUniformKnots(ctrlPts.length, p);
    const u0 = k[p];
    const u1 = k[ctrlPts.length];
    const nSamp = Math.max(8, samples);
    let d = '';
    for (let s = 0; s <= nSamp; s++) {
      const u = u0 + ((u1 - u0) * s) / nSamp;
      const pt = evaluateNurbs(ctrlPts, p, k, weights, u);
      if (!pt) continue;
      d += (s === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`);
    }
    return d;
  }

  /**
   * DXF bulge (tan of 1/4 included angle) between p0→p1 → SVG arc segment.
   * Returns path command string starting with space (e.g. ` A …` or ` L …`).
   */
  function bulgeToSvgArc(p0, p1, bulge, yFlip = (y) => y) {
    const b = Number(bulge) || 0;
    if (Math.abs(b) < 1e-10) {
      return ` L ${p1.x} ${yFlip(p1.y)}`;
    }
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const c = p0.x + dx / 2 - (dy * (1 - b * b)) / (4 * b);
    const d = p0.y + dy / 2 + (dx * (1 - b * b)) / (4 * b);
    const r = Math.hypot(p0.x - c, p0.y - d);
    if (!(r > 1e-9)) return ` L ${p1.x} ${yFlip(p1.y)}`;
    const large = Math.abs(b) > 1 ? 1 : 0;
    // Positive bulge = CCW in DXF; Y-flip reverses sweep in SVG
    const sweep = b > 0 ? 0 : 1;
    return ` A ${r} ${r} 0 ${large} ${sweep} ${p1.x} ${yFlip(p1.y)}`;
  }

  /** Polyline vertices with optional .bulge → SVG path (DXF Y, then yFlip). */
  function polyWithBulgeToSvgPath(verts, closed, yFlip = (y) => y) {
    if (!verts || verts.length < 2) return '';
    let d = `M ${verts[0].x} ${yFlip(verts[0].y)}`;
    const n = verts.length;
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % n];
      d += bulgeToSvgArc(a, b, a.bulge || 0, yFlip);
    }
    if (closed) d += ' Z';
    return d;
  }

  /** 3-point arc (start, through, end) → center/radius/angles or null. */
  function arcFrom3Points(a, b, c) {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 1e-9) return null;
    const ux = ((a.x * a.x + a.y * a.y) * (b.y - c.y)
      + (b.x * b.x + b.y * b.y) * (c.y - a.y)
      + (c.x * c.x + c.y * c.y) * (a.y - b.y)) / d;
    const uy = ((a.x * a.x + a.y * a.y) * (c.x - b.x)
      + (b.x * b.x + b.y * b.y) * (a.x - c.x)
      + (c.x * c.x + c.y * c.y) * (b.x - a.x)) / d;
    const r = Math.hypot(a.x - ux, a.y - uy);
    const ang = (p) => Math.atan2(p.y - uy, p.x - ux);
    let a0 = ang(a);
    let a1 = ang(c);
    const aMid = ang(b);
    // Ensure mid lies on the swept arc from a0→a1 CCW
    const norm = (t) => {
      while (t < 0) t += Math.PI * 2;
      while (t >= Math.PI * 2) t -= Math.PI * 2;
      return t;
    };
    let aa0 = a0;
    let aa1 = a1;
    const onCcw = (start, end, mid) => {
      const s = norm(mid - start);
      const e = norm(end - start);
      return s <= e + 1e-9;
    };
    if (!onCcw(aa0, aa1, aMid)) {
      const t = aa0;
      aa0 = aa1;
      aa1 = t;
    }
    return { cx: ux, cy: uy, r, a0: aa0, a1: aa1 };
  }

  function arcToSvgPath(arc) {
    if (!arc) return '';
    const { cx, cy, r, a0, a1 } = arc;
    let end = a1;
    while (end <= a0) end += Math.PI * 2;
    const large = end - a0 > Math.PI ? 1 : 0;
    const sx = cx + r * Math.cos(a0);
    const sy = cy + r * Math.sin(a0);
    const ex = cx + r * Math.cos(end);
    const ey = cy + r * Math.sin(end);
    return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
  }

  function typeLabel(type) {
    const map = {
      line: 'Line',
      polyline: 'Polyline',
      arc: 'Arc',
      circle: 'Circle',
      spline: 'Spline',
      ellipse: 'Ellipse',
      point: 'Point',
      cad: 'CAD',
    };
    return map[type] || String(type || 'Curve');
  }

  global.GuitarCurves = {
    evaluateNurbs,
    nurbsBasis,
    openUniformKnots,
    nurbsToSvgPath,
    bulgeToSvgArc,
    polyWithBulgeToSvgPath,
    arcFrom3Points,
    arcToSvgPath,
    typeLabel,
  };
})(window);
