(function (global) {
  'use strict';

  /** Match electronics workspace grid (app WORKSPACE_GRID / UNIT). */
  const EDITOR_GRID = 10;
  const EDITOR_STAGE_MIN_W = 200;
  const EDITOR_STAGE_MIN_H = 200;
  const EDITOR_PREVIEW_PAD = 20;
  const EDITOR_ZOOM_MIN = 0.5;
  const EDITOR_ZOOM_MAX = 3;
  const EDITOR_ZOOM_STEP = 0.25;
  /** Magnetic pull distance (px) when dragging terminals/wires onto the label box edges. */
  const EDITOR_EDGE_SNAP = 10;
  /** Loom stub length from pickup body exit → fan junction (matches workspace). */
  const EDITOR_LOOM_LEN = 36;
  const EDITOR_FAN_LEN = 32;
  const EDITOR_LOOM_STROKE = 4.3;
  const EDITOR_FAN_STROKE = 1.9;
  const EDITOR_DEFAULT_LOOM_COLOR = '#111111';
  const STORAGE_KEY = 'guitar-custom-assets';
  const TERM_W = 22;
  const TERM_H = 18;
  const TERM_RECT_W = 39;
  const TERM_RECT_H = 16;
  const TERM_GAP = 2;
  const TERM_BELOW_BODY = 4;
  const ACTIVE_TERM_COLOR = '#e74c3c';
  const BODY_MIN_W = 20;
  const BODY_MIN_H = 20;
  const RESIZE_HANDLES = [
    { id: 'nw', cursor: 'nwse-resize' },
    { id: 'n', cursor: 'ns-resize' },
    { id: 'ne', cursor: 'nesw-resize' },
    { id: 'e', cursor: 'ew-resize' },
    { id: 'se', cursor: 'nwse-resize' },
    { id: 's', cursor: 'ns-resize' },
    { id: 'sw', cursor: 'nesw-resize' },
    { id: 'w', cursor: 'ew-resize' },
  ];
  const TERMINAL_PALETTE = [
    { name: 'White', value: '#ffffff' },
    { name: 'Black', value: '#111111' },
    { name: 'Yellow', value: '#ffd700' },
    { name: 'Green', value: '#2ecc71' },
    { name: 'Orange', value: '#ff8c00' },
    { name: 'Red', value: '#e74c3c' },
    { name: 'Blue', value: '#4aa3ff' },
  ];

  const EDITOR_CATEGORIES = [
    { id: 'pickup', label: 'Pickups' },
    { id: 'switch', label: 'Switches' },
    { id: 'jack', label: 'Jacks' },
    { id: 'power', label: 'Power' },
    { id: 'component', label: 'Components' },
    { id: 'custom', label: 'User' },
  ];

  const CATEGORIES = [
    { id: 'pickup', label: 'Pickups' },
    { id: 'switch', label: 'Switches' },
    { id: 'jack', label: 'Jacks' },
    { id: 'power', label: 'Power' },
    { id: 'component', label: 'Components' },
    /* Hidden from placement menu — templates still load/save */
    { id: 'wire', label: 'Wire', hidden: true },
    { id: 'custom', label: 'User' },
  ];

  const PANEL_CATEGORIES = [
    { id: 'guitar', label: 'Guitars' },
    { id: 'amp', label: 'Amps' },
    { id: 'pedal', label: 'Pedals' },
  ];

  /** Nested type groups inside a placement category (hover to expand). */
  const CATEGORY_TYPES = {
    switch: [
      {
        id: '2way',
        label: '2-Way Toggle',
        match: (t) => t?.typeGroup === '2way'
          || t?.subtype === 'dpdt-on-on'
          || t?.switchThrow === 'on-on',
      },
      {
        id: '3way',
        label: '3-Way Toggle',
        match: (t) => t?.typeGroup === '3way'
          || t?.subtype === 'dpdt'
          || t?.subtype === 'dpdt-on-off-on'
          || t?.switchThrow === 'on-on-on'
          || t?.switchThrow === 'on-off-on',
      },
    ],
  };

  const SUBTYPES = {
    custom: [],
    pickup: [
      { id: 'singlecoil', label: 'Single Coil' },
      { id: 'dualcoil', label: 'Dual Coil' },
    ],
    switch: [
      { id: 'dpdt-on-on', label: 'ON-ON' },
      { id: 'dpdt', label: 'ON-ON-ON' },
      { id: 'dpdt-on-off-on', label: 'ON-OFF-ON' },
    ],
    jack: [
      { id: 'monooutput', label: 'Mono Output' },
      { id: 'stereooutput', label: 'Stereo Output' },
    ],
    power: [{ id: 'ninevolt', label: '9-Volt Battery' }],
    component: [
      { id: 'potentiometer', label: 'Potentiometer' },
      { id: 'capacitor', label: 'Capacitor' },
    ],
    wire: [{ id: '4conductor', label: '4 Conductor' }],
  };

  /** Electronics grid unit (px) — matches app WORKSPACE_GRID. */
  const UNIT = 10;

  /** Canonical electrical quantities for schematics + config (extend here for new values). */
  const ELECTRICAL_VALUE_DEFS = {
    impedance: {
      key: 'impedance',
      symbol: 'Z',
      unit: 'Ω',
      dataset: 'impedance',
      label: 'Impedance (Z)',
      placeholder: 'e.g. 7500 or 7.5k',
    },
    inductance: {
      key: 'inductance',
      symbol: 'L',
      unit: 'H',
      dataset: 'inductance',
      label: 'Inductance (H)',
      placeholder: 'e.g. 2.5',
    },
    resistance: {
      key: 'resistance',
      symbol: 'R',
      unit: 'Ω',
      dataset: 'resistance',
      label: 'Resistance (Ω)',
      placeholder: 'e.g. 250k',
    },
    capacitance: {
      key: 'capacitance',
      symbol: 'C',
      unit: 'µF',
      dataset: 'capacitance',
      label: 'Capacitance (µF)',
      placeholder: 'e.g. 0.022',
    },
    voltage: {
      key: 'voltage',
      symbol: 'V',
      unit: 'V',
      dataset: 'voltage',
      label: 'Voltage (V)',
      placeholder: 'e.g. 9',
    },
  };

  function defaultValueFieldsForSubtype(category, subtype) {
    if (category === 'pickup' || subtype === 'singlecoil' || subtype === 'dualcoil' || subtype === '4conductor') {
      return ['impedance', 'inductance'];
    }
    if (subtype === 'capacitor' || (category === 'component' && subtype === 'capacitor')) {
      return ['capacitance'];
    }
    if (subtype === 'potentiometer' || (category === 'component' && subtype === 'potentiometer')) {
      return ['resistance'];
    }
    if (subtype === 'ninevolt' || category === 'power') {
      return ['voltage'];
    }
    return [];
  }

  function relevantValueFieldsForDraft(draft) {
    return normalizeValueFields(
      defaultValueFieldsForSubtype(draft?.category, draft?.subtype)
    );
  }

  function normalizeValueFields(fields) {
    if (!Array.isArray(fields)) return [];
    const out = [];
    fields.forEach((f) => {
      const key = typeof f === 'string' ? f : f?.key;
      if (key && ELECTRICAL_VALUE_DEFS[key] && !out.includes(key)) out.push(key);
    });
    return out;
  }

  function resolveValueFieldDefs(template) {
    const keys = normalizeValueFields(
      template?.valueFields ?? defaultValueFieldsForSubtype(template?.category, template?.subtype)
    );
    return keys.map((key) => ({ ...ELECTRICAL_VALUE_DEFS[key] }));
  }


  function singleCoilTerminalPair(bx, by, bw, bodyH, shape = 'square') {
    const { w: tw } = getTermSize(shape);
    const ty = by + bodyH + TERM_BELOW_BODY;
    const centerX = bx + bw / 2;
    const gapLeft = centerX - TERM_GAP / 2;
    const hX = gapLeft - tw;
    const gX = gapLeft + TERM_GAP;
    return [
      { label: 'H', color: '#2ecc71', className: 'hot', role: 'H', x: hX, y: ty },
      { label: 'G', color: '#ffffff', className: 'ground', role: 'G', x: gX, y: ty },
    ];
  }

  /**
   * Dual coil / humbucker — 5-conductor loom exits horizontally to the right.
   * State menu / wires: H black, N white, R red, S green, G copper.
   */
  function dualCoilTerminals(bx, by, bw, bodyH) {
    const tip = 10;
    const exitX = bx + bw;
    const exitY = by + bodyH / 2;
    const jx = exitX + 36;
    const jy = exitY;
    const fanLen = 32;
    const specs = [
      {
        label: 'H',
        role: 'H',
        tipLabel: 'H',
        menuLabel: 'H (Black)',
        wireColor: '#111111',
        title: 'Black — Hot',
        keepColorWhenActive: true,
        textColor: '#eeeeee',
      },
      {
        label: 'N',
        role: 'N',
        tipLabel: 'N',
        menuLabel: 'N (white)',
        wireColor: '#ffffff',
        title: 'White — North coil',
        keepColorWhenActive: true,
      },
      {
        label: 'R',
        role: 'R',
        tipLabel: 'R',
        menuLabel: 'R (Red)',
        wireColor: '#e74c3c',
        title: 'Red',
        keepColorWhenActive: true,
      },
      {
        label: 'S',
        role: 'S',
        tipLabel: 'S',
        menuLabel: 'S (Green)',
        wireColor: '#2ecc71',
        title: 'Green — South coil',
        keepColorWhenActive: true,
      },
      {
        label: 'G',
        role: 'G',
        tipLabel: 'G',
        menuLabel: 'G (Copper)',
        wireColor: '#b87333',
        title: 'Copper — Bare / shield ground',
        isGround: true,
      },
    ];
    return specs.map((spec, i) => {
      const t = specs.length === 1 ? 0.5 : i / (specs.length - 1);
      const angle = -0.75 + t * 1.5; // radians about +X (fan to the right)
      const tx = jx + Math.cos(angle) * fanLen;
      const ty = jy + Math.sin(angle) * fanLen;
      return {
        label: '',
        role: spec.role,
        color: 'transparent',
        className: `hb-tip${spec.isGround ? ' is-ground' : ''}`,
        wireColor: spec.wireColor,
        title: spec.title,
        keepColorWhenActive: !!spec.keepColorWhenActive,
        textColor: spec.textColor,
        isGround: !!spec.isGround,
        tipLabel: spec.tipLabel,
        menuLabel: spec.menuLabel,
        x: tx - tip / 2,
        y: ty - tip / 2,
        w: tip,
        h: tip,
      };
    });
  }

  function monoOutputTerminals(bx, by, bw, bodyH) {
    const gSize = getTermSize('rect');
    const hSize = getTermSize('square');
    const gap = TERM_GAP;
    const rowW = gSize.w + gap + hSize.w;
    const startX = bx + snapEditor((bw - rowW) / 2);
    const rowH = Math.max(gSize.h, hSize.h);
    const ty = by - TERM_BELOW_BODY - rowH;
    return [
      {
        label: 'G',
        color: '#ffffff',
        className: 'ground is-ground',
        role: 'G',
        x: startX,
        y: ty,
        w: gSize.w,
        h: gSize.h,
        isGround: true,
      },
      {
        label: 'H',
        color: '#2ecc71',
        className: 'hot',
        role: 'H',
        x: startX + gSize.w + gap,
        y: ty + (rowH - hSize.h),
        w: hSize.w,
        h: hSize.h,
        keepColorWhenActive: true,
      },
    ];
  }

  /** TRS stereo jack: sleeve (G), ring (R), tip (H) — left to right. */
  function stereoOutputTerminals(bx, by, bw, bodyH) {
    const gSize = getTermSize('rect');
    const sq = getTermSize('square');
    const gap = TERM_GAP;
    const rowW = gSize.w + gap + sq.w + gap + sq.w;
    const startX = bx + snapEditor((bw - rowW) / 2);
    const rowH = Math.max(gSize.h, sq.h);
    const ty = by - TERM_BELOW_BODY - rowH;
    const sqY = ty + (rowH - sq.h);
    return [
      {
        label: 'G',
        color: '#ffffff',
        className: 'ground is-ground',
        role: 'G',
        title: 'Sleeve — Ground',
        x: startX,
        y: ty,
        w: gSize.w,
        h: gSize.h,
        isGround: true,
      },
      {
        label: 'R',
        color: '#e74c3c',
        className: 'ring',
        role: 'R',
        title: 'Ring',
        x: startX + gSize.w + gap,
        y: sqY,
        w: sq.w,
        h: sq.h,
        keepColorWhenActive: true,
      },
      {
        label: 'H',
        color: '#2ecc71',
        className: 'hot',
        role: 'H',
        title: 'Tip — Hot',
        x: startX + gSize.w + gap + sq.w + gap,
        y: sqY,
        w: sq.w,
        h: sq.h,
        keepColorWhenActive: true,
      },
    ];
  }

  function nineVoltTerminals(bx, by, bw, bodyH) {
    const { w: tw, h: th } = getTermSize('square');
    const gap = TERM_GAP;
    const rowW = tw * 2 + gap;
    const startX = bx + snapEditor((bw - rowW) / 2);
    const ty = by + bodyH + TERM_BELOW_BODY;
    return [
      {
        label: '+',
        color: '#e74c3c',
        className: 'power-plus',
        role: 'P+',
        x: startX,
        y: ty,
        w: tw,
        h: th,
        keepColorWhenActive: true,
      },
      {
        label: '−',
        color: '#111111',
        className: 'power-minus',
        role: 'P-',
        x: startX + tw + gap,
        y: ty,
        w: tw,
        h: th,
        keepColorWhenActive: true,
      },
    ];
  }

  /** Pot lugs 1 / 2 (wiper) / 3 below + case ground on the left side. */
  function potentiometerTerminals(bx, by, bw, bodyH) {
    const { w: tw, h: th } = getTermSize('square');
    const gap = TERM_GAP;
    const rowW = tw * 3 + gap * 2;
    const startX = bx + snapEditor((bw - rowW) / 2);
    const ty = by + bodyH + TERM_BELOW_BODY;
    const sideGap = TERM_GAP + 2;
    return [
      {
        label: '1',
        color: '#ffffff',
        className: 'pot-lug',
        role: '1',
        x: startX,
        y: ty,
        w: tw,
        h: th,
      },
      {
        label: '2',
        color: '#2ecc71',
        className: 'pot-lug pot-wiper',
        role: '2',
        x: startX + tw + gap,
        y: ty,
        w: tw,
        h: th,
        keepColorWhenActive: true,
      },
      {
        label: '3',
        color: '#ffd700',
        className: 'pot-lug',
        role: '3',
        x: startX + (tw + gap) * 2,
        y: ty,
        w: tw,
        h: th,
      },
      {
        label: 'G',
        color: '#ffffff',
        className: 'ground pot-case-ground',
        role: 'G',
        x: bx - sideGap - tw,
        y: by + snapEditor((bodyH - th) / 2),
        w: tw,
        h: th,
      },
    ];
  }

  /**
   * Capacitor: 2×3 unit body (portrait), 2-unit leads top & bottom.
   * Lead tips are wire-like ends (role C — not a hard bridge).
   */
  function capacitorParts(bx = 0, by = 0) {
    const bodyW = 2 * UNIT;
    const bodyH = 3 * UNIT;
    const lead = 2 * UNIT;
    const tip = 10;
    const bodyX = bx;
    const bodyY = by + lead;
    const cx = bodyX + bodyW / 2;
    return {
      bodyX,
      bodyY,
      bodyW,
      bodyH,
      terminals: [
        {
          label: '',
          role: 'C',
          color: 'transparent',
          className: 'cap-term',
          x: cx - tip / 2,
          y: by,
          w: tip,
          h: tip,
        },
        {
          label: '',
          role: 'C',
          color: 'transparent',
          className: 'cap-term',
          x: cx - tip / 2,
          y: bodyY + bodyH + lead - tip,
          w: tip,
          h: tip,
        },
      ],
    };
  }

  function getTermSize(shape) {
    if (shape === 'rect') return { w: TERM_RECT_W, h: TERM_RECT_H };
    return { w: TERM_W, h: TERM_H };
  }

  function getSpecTermSize(spec, template) {
    if (spec?.w != null && spec?.h != null) return { w: spec.w, h: spec.h };
    return getTermSize(template?.terminalShape || 'square');
  }

  function getDraftTermSize(draft) {
    return getTermSize(draft?.terminalShape || 'square');
  }

  function termPartKind(term) {
    if (!term) return 'terminal';
    if (term.partKind) return term.partKind;
    if (String(term.className || '').includes('hb-tip')) return 'conductor';
    if (String(term.className || '').includes('cap-term')) return 'lead';
    if (String(term.className || '').includes('wire-term')) return 'wire';
    return 'terminal';
  }

  function isTermLabelColorEditable(term) {
    const kind = termPartKind(term);
    return kind === 'terminal' || kind === 'wire';
  }

  function makeEditorLeadTerminal(draft, offsetIndex = 0) {
    const tip = 10;
    const lead = 2 * UNIT;
    const cx = draft.bodyX + draft.bodyW / 2;
    const y = draft.bodyY + draft.bodyH + lead - tip + offsetIndex * (tip + 4);
    return {
      label: '',
      role: 'C',
      color: 'transparent',
      className: 'cap-term',
      partKind: 'lead',
      x: snapEditor(cx - tip / 2),
      y: snapEditor(y),
      w: tip,
      h: tip,
    };
  }

  function makeEditorWireTerminal(draft) {
    const tip = 10;
    const color = '#c9a227';
    return {
      label: 'W',
      tipLabel: 'W',
      color,
      wireColor: color,
      className: 'wire-term',
      partKind: 'wire',
      role: 'W',
      keepColorWhenActive: true,
      x: snapEditor(draft.bodyX + draft.bodyW + EDITOR_GRID),
      y: snapEditor(draft.bodyY + Math.max(0, draft.bodyH / 2 - tip / 2)),
      w: tip,
      h: tip,
    };
  }

  function makeEditorTerminal(draft) {
    const { w: tw, h: th } = getDraftTermSize(draft);
    return {
      label: 'N',
      color: '#6ab0ff',
      partKind: 'terminal',
      x: snapEditor(draft.bodyX + 8),
      y: snapEditor(draft.bodyY + draft.bodyH + 8),
      w: tw,
      h: th,
    };
  }

  function appendFourConductorFan(draft) {
    // Replace any existing conductor tips with a fresh loom fan
    draft.terminals = (draft.terminals || []).filter((t) => termPartKind(t) !== 'conductor');
    const tips = dualCoilTerminals(draft.bodyX, draft.bodyY, draft.bodyW, draft.bodyH).map((t) => ({
      ...t,
      partKind: 'conductor',
    }));
    draft.terminals.push(...tips);
    draft.hasLoom = true;
    draft.loomColor = draft.loomColor || EDITOR_DEFAULT_LOOM_COLOR;
    ensureEditorLoomJunction(draft);
    layoutEditorConductorFan(draft);
    activateEditorConductors(draft);
    const cls = String(draft.cssClass || 'custom');
    if (!cls.includes('dualcoil')) {
      draft.cssClass = `${cls} dualcoil`.trim();
    }
  }

  function draftHasLoom(draft) {
    if (!draft) return false;
    if (draft.hasLoom) return true;
    return (draft.terminals || []).some((t) => termPartKind(t) === 'conductor');
  }

  function activateEditorConductors(draft) {
    if (!draft) return;
    ensureEditorStates(draft);
    draft.states.forEach((state) => {
      if (!state.terminalActive) state.terminalActive = [];
      draft.terminals.forEach((term, i) => {
        if (termPartKind(term) === 'conductor') state.terminalActive[i] = true;
      });
    });
  }

  function getEditorLoomExit(draft, junction) {
    const bx = draft.bodyX;
    const by = draft.bodyY;
    const br = bx + draft.bodyW;
    const bb = by + draft.bodyH;
    const jx = junction?.x ?? (br + EDITOR_LOOM_LEN);
    const jy = junction?.y ?? (by + draft.bodyH / 2);
    const cx = bx + draft.bodyW / 2;
    const cy = by + draft.bodyH / 2;
    // Choose the side whose outward normal best faces the junction
    const candidates = [
      { side: 'right', x: br, y: Math.min(bb, Math.max(by, jy)), nx: 1, ny: 0 },
      { side: 'left', x: bx, y: Math.min(bb, Math.max(by, jy)), nx: -1, ny: 0 },
      { side: 'top', x: Math.min(br, Math.max(bx, jx)), y: by, nx: 0, ny: -1 },
      { side: 'bottom', x: Math.min(br, Math.max(bx, jx)), y: bb, nx: 0, ny: 1 },
    ];
    let best = candidates[0];
    let bestScore = -Infinity;
    candidates.forEach((c) => {
      const dx = jx - cx;
      const dy = jy - cy;
      const score = dx * c.nx + dy * c.ny;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    });
    return {
      x: snapEditor(best.x),
      y: snapEditor(best.y),
      side: best.side,
      nx: best.nx,
      ny: best.ny,
    };
  }

  function ensureEditorLoomJunction(draft) {
    if (!draftHasLoom(draft)) return null;
    if (draft.loomJunction && Number.isFinite(draft.loomJunction.x) && Number.isFinite(draft.loomJunction.y)) {
      return draft.loomJunction;
    }
    const exit = getEditorLoomExit(draft, null);
    draft.loomJunction = {
      x: snapEditor(exit.x + exit.nx * EDITOR_LOOM_LEN),
      y: snapEditor(exit.y + exit.ny * EDITOR_LOOM_LEN),
    };
    return draft.loomJunction;
  }

  /** Snap loom so exit sits on a body side; junction sits EDITOR_LOOM_LEN outward. */
  function snapEditorLoomToBody(draft, rawJx, rawJy) {
    const bx = draft.bodyX;
    const by = draft.bodyY;
    const br = bx + draft.bodyW;
    const bb = by + draft.bodyH;
    const cx = bx + draft.bodyW / 2;
    const cy = by + draft.bodyH / 2;
    const dx = rawJx - cx;
    const dy = rawJy - cy;
    const sides = [
      { side: 'right', nx: 1, ny: 0, score: dx },
      { side: 'left', nx: -1, ny: 0, score: -dx },
      { side: 'bottom', nx: 0, ny: 1, score: dy },
      { side: 'top', nx: 0, ny: -1, score: -dy },
    ];
    sides.sort((a, b) => b.score - a.score);
    const side = sides[0];
    let ex;
    let ey;
    if (side.side === 'right' || side.side === 'left') {
      ex = side.side === 'right' ? br : bx;
      ey = snapEditor(Math.min(bb, Math.max(by, rawJy)));
    } else {
      ey = side.side === 'bottom' ? bb : by;
      ex = snapEditor(Math.min(br, Math.max(bx, rawJx)));
    }
    draft.loomJunction = {
      x: snapEditor(ex + side.nx * EDITOR_LOOM_LEN),
      y: snapEditor(ey + side.ny * EDITOR_LOOM_LEN),
    };
    layoutEditorConductorFan(draft);
    return draft.loomJunction;
  }

  /** Place conductor tips in a workspace-style fan around the loom junction. */
  function layoutEditorConductorFan(draft) {
    if (!draftHasLoom(draft)) return;
    const junction = ensureEditorLoomJunction(draft);
    const exit = getEditorLoomExit(draft, junction);
    // Fan opens away from the body along the loom direction
    const baseAngle = Math.atan2(exit.ny, exit.nx);
    const conductors = draft.terminals.filter((t) => termPartKind(t) === 'conductor');
    const tip = 10;
    const n = conductors.length || 1;
    conductors.forEach((term, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const angle = baseAngle + (-0.75 + t * 1.5);
      const tx = junction.x + Math.cos(angle) * EDITOR_FAN_LEN;
      const ty = junction.y + Math.sin(angle) * EDITOR_FAN_LEN;
      term.x = snapEditor(tx - tip / 2);
      term.y = snapEditor(ty - tip / 2);
      term.w = tip;
      term.h = tip;
      term.partKind = 'conductor';
    });
  }


  const BUILTIN_TEMPLATES = [
    {
      id: 'singlecoil',
      name: 'Single Coil',
      category: 'pickup',
      subtype: 'singlecoil',
      builtin: true,
      valueFields: ['impedance', 'inductance'],
      placeLabel: 'SC',
      bodyX: 0,
      bodyY: 0,
      bodyW: 70,
      bodyH: 48,
      cssClass: 'singlecoil',
      layout: 'absolute',
      hideStateLabel: true,
      states: [
        { id: 0, terminalActive: [true, false] },
      ],
      terminals: (() => {
        const pair = singleCoilTerminalPair(0, 0, 70, 48);
        pair[0].keepColorWhenActive = true;
        return pair;
      })(),
    },
    {
      id: 'dualcoil',
      name: 'Dual Coil',
      category: 'pickup',
      subtype: 'dualcoil',
      builtin: true,
      needsGrounding: true,
      valueFields: ['impedance', 'inductance'],
      placeLabel: 'HB',
      bodyX: 0,
      bodyY: 0,
      bodyW: 120,
      bodyH: 48,
      cssClass: 'dualcoil',
      layout: 'absolute',
      hideStateLabel: true,
      states: [
        { id: 0, terminalActive: [true, true, true, true, true] },
      ],
      terminals: dualCoilTerminals(0, 0, 120, 48),
    },
    {
      id: '4conductor',
      name: '4 Conductor',
      category: 'wire',
      subtype: '4conductor',
      builtin: true,
      needsGrounding: true,
      valueFields: ['impedance', 'inductance'],
      placeLabel: '4C',
      bodyX: 0,
      bodyY: 0,
      bodyW: 120,
      bodyH: 48,
      cssClass: 'dualcoil',
      layout: 'absolute',
      hideStateLabel: true,
      states: [
        { id: 0, terminalActive: [true, true, true, true, true] },
      ],
      terminals: dualCoilTerminals(0, 0, 120, 48),
    },
    {
      id: 'dpdt',
      name: 'ON-ON-ON',
      category: 'switch',
      subtype: 'dpdt',
      typeGroup: '3way',
      switchThrow: 'on-on-on',
      builtin: true,
      placeLabel: '3WAY',
      bodyW: 80,
      bodyH: 56,
      cssClass: 'dpdt',
      layout: 'grid-3x2',
      /*
       * Pin grid (row-major):
       *   T1 T2   →  1 4
       *   T3 T4   →  2 5  (commons)
       *   T5 T6   →  3 6
       * Default throw: ON-ON-ON (all three positions conduct).
       * Primary names: Up (1), Middle (2), Down (3).
       */
      states: [
        {
          id: 1,
          label: 'Up (1)',
          terminalActive: [false, false, true, true, true, true],
          bridges: [[2, 4], [3, 5]], // 2-3, 5-6
        },
        {
          id: 2,
          label: 'Middle (2)',
          terminalActive: [true, true, true, true, true, true], // all closed-contact poles
          bridges: [[2, 0], [2, 4], [3, 1], [3, 5]], // 2-1, 2-3, 5-4, 5-6
        },
        {
          id: 3,
          label: 'Down (3)',
          terminalActive: [true, true, true, true, false, false],
          bridges: [[2, 0], [3, 1]], // 2-1, 5-4
        },
      ],
      terminals: Array.from({ length: 6 }, (_, i) => ({
        label: `T${i + 1}`,
        color: '#c9a227',
        className: 'switch-term',
      })),
    },
    {
      id: 'dpdt-on-off-on',
      name: 'ON-OFF-ON',
      category: 'switch',
      subtype: 'dpdt-on-off-on',
      typeGroup: '3way',
      switchThrow: 'on-off-on',
      builtin: true,
      placeLabel: 'OFO',
      bodyW: 80,
      bodyH: 56,
      cssClass: 'dpdt',
      layout: 'grid-3x2',
      /*
       * Type 1: Up T3/T4/T5/T6, Middle off, Down T1/T2/T3/T4.
       * Type 2: Up/Down active sets swapped.
       */
      states: [
        {
          id: 1,
          label: 'Up (1)',
          terminalActive: [false, false, true, true, true, true], // T3, T4, T5, T6
          bridges: [[2, 4], [3, 5]], // T3–T5, T4–T6
        },
        {
          id: 2,
          label: 'Middle (2)',
          terminalActive: [false, false, false, false, false, false],
          bridges: [],
        },
        {
          id: 3,
          label: 'Down (3)',
          terminalActive: [true, true, true, true, false, false], // T1, T2, T3, T4
          bridges: [[0, 2], [1, 3]], // T1–T3, T2–T4
        },
      ],
      terminals: Array.from({ length: 6 }, (_, i) => ({
        label: `T${i + 1}`,
        color: '#c9a227',
        className: 'switch-term',
      })),
    },
    {
      id: 'dpdt-on-on',
      name: 'ON-ON',
      category: 'switch',
      subtype: 'dpdt-on-on',
      typeGroup: '2way',
      switchThrow: 'on-on',
      builtin: true,
      placeLabel: '2WAY',
      bodyW: 80,
      bodyH: 56,
      cssClass: 'dpdt',
      layout: 'grid-3x2',
      /*
       * Two throws only (no middle/off). Same pin grid as DPDT.
       * Type 1: Up T3/T4/T5/T6, Down T1/T2/T3/T4.
       * Type 2: Up/Down active sets swapped.
       */
      states: [
        {
          id: 1,
          label: 'Up (1)',
          terminalActive: [false, false, true, true, true, true], // T3, T4, T5, T6
          bridges: [[2, 4], [3, 5]], // T3–T5, T4–T6
        },
        {
          id: 2,
          label: 'Down (2)',
          terminalActive: [true, true, true, true, false, false], // T1, T2, T3, T4
          bridges: [[0, 2], [1, 3]], // T1–T3, T2–T4
        },
      ],
      terminals: Array.from({ length: 6 }, (_, i) => ({
        label: `T${i + 1}`,
        color: '#c9a227',
        className: 'switch-term',
      })),
    },
    {
      id: 'mono-output',
      name: 'Mono Output',
      category: 'jack',
      subtype: 'monooutput',
      builtin: true,
      isOutputJack: true,
      placeLabel: 'OUT',
      bodyX: 0,
      bodyY: 0,
      bodyW: 70,
      bodyH: 40,
      cssClass: 'mono-output',
      layout: 'absolute',
      hideStateLabel: true,
      states: [
        { id: 0, terminalActive: [false, true] },
      ],
      terminals: monoOutputTerminals(0, 0, 70, 40),
    },
    {
      id: 'stereo-output',
      name: 'Stereo Output',
      category: 'jack',
      subtype: 'stereooutput',
      builtin: true,
      isOutputJack: true,
      placeLabel: 'STR',
      bodyX: 0,
      bodyY: 0,
      bodyW: 90,
      bodyH: 40,
      cssClass: 'mono-output stereo-output',
      layout: 'absolute',
      hideStateLabel: true,
      states: [
        { id: 0, terminalActive: [false, true, true] },
      ],
      terminals: stereoOutputTerminals(0, 0, 90, 40),
    },
    {
      id: 'ninevolt',
      name: '9-Volt Battery',
      category: 'power',
      subtype: 'ninevolt',
      builtin: true,
      needsGrounding: true,
      valueFields: ['voltage'],
      placeLabel: '9V',
      bodyX: 0,
      bodyY: 0,
      bodyW: 56,
      bodyH: 72,
      cssClass: 'ninevolt',
      layout: 'absolute',
      hideStateLabel: true,
      states: [
        { id: 0, terminalActive: [true, true] },
      ],
      terminals: nineVoltTerminals(0, 0, 56, 72),
    },
    {
      id: 'potentiometer',
      name: 'Potentiometer',
      category: 'component',
      subtype: 'potentiometer',
      builtin: true,
      needsGrounding: true,
      valueFields: ['resistance'],
      placeLabel: 'POT',
      bodyX: 0,
      bodyY: 0,
      bodyW: 64,
      bodyH: 48,
      cssClass: 'potentiometer',
      layout: 'absolute',
      hideStateLabel: true,
      /* Lugs 1/2/3 resistive; side G is case ground (no hard bridge to lugs) */
      states: [
        { id: 0, terminalActive: [false, true, false, false] },
      ],
      terminals: potentiometerTerminals(0, 0, 64, 48),
    },
    (() => {
      const parts = capacitorParts(0, 0);
      return {
        id: 'capacitor',
        name: 'Capacitor',
        category: 'component',
        subtype: 'capacitor',
        builtin: true,
        needsGrounding: true,
        valueFields: ['capacitance'],
        placeLabel: '',
        bodyX: parts.bodyX,
        bodyY: parts.bodyY,
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        cssClass: 'capacitor',
        layout: 'absolute',
        hideStateLabel: true,
        /* Open between ends DC — not a hard short */
        states: [
          { id: 0, terminalActive: [false, false] },
        ],
        terminals: parts.terminals,
      };
    })(),
  ];

  let customTemplates = [];
  let deps = null;
  let editorDraft = null;
  let editorDrag = null;
  let editorSelection = null;
  let contextTarget = null;
  let pendingDelete = null;
  /** Preview render layout: content offset + zoom (stage px → draft px). */
  let editorPreviewLayout = { ox: 0, oy: 0, zoom: 1, stageW: EDITOR_STAGE_MIN_W, stageH: EDITOR_STAGE_MIN_H };

  const menuEl = () => document.getElementById('asset-context-menu');
  const deleteConfirmEl = () => document.getElementById('asset-delete-confirm');
  const menuListEl = () => document.getElementById('context-menu-items');
  const editorEl = () => document.getElementById('asset-editor');

  function snapEditor(v) {
    return Math.round(v / EDITOR_GRID) * EDITOR_GRID;
  }

  function snapGrid(v) {
    return snapEditor(v);
  }

  function centerBodyInDraft(draft) {
    draft.bodyX = 0;
    draft.bodyY = 0;
  }

  function normalizeDraft(draft) {
    const xs = [draft.bodyX, ...draft.terminals.map((t) => t.x)];
    const ys = [draft.bodyY, ...draft.terminals.map((t) => t.y)];
    if (draft.loomJunction) {
      xs.push(draft.loomJunction.x);
      ys.push(draft.loomJunction.y);
    }
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    draft.bodyX -= minX;
    draft.bodyY -= minY;
    draft.terminals.forEach((t) => {
      t.x -= minX;
      t.y -= minY;
    });
    if (draft.loomJunction) {
      draft.loomJunction.x -= minX;
      draft.loomJunction.y -= minY;
    }
  }

  function getDraftContentBounds(draft) {
    let minX = draft.bodyX;
    let minY = draft.bodyY;
    let maxX = draft.bodyX + draft.bodyW;
    let maxY = draft.bodyY + draft.bodyH;
    (draft.terminals || []).forEach((term) => {
      const { w, h } = getSpecTermSize(term, draft);
      minX = Math.min(minX, term.x);
      minY = Math.min(minY, term.y);
      maxX = Math.max(maxX, term.x + w);
      maxY = Math.max(maxY, term.y + h);
    });
    if (draft.loomJunction) {
      minX = Math.min(minX, draft.loomJunction.x - 4);
      minY = Math.min(minY, draft.loomJunction.y - 4);
      maxX = Math.max(maxX, draft.loomJunction.x + 4);
      maxY = Math.max(maxY, draft.loomJunction.y + 4);
    }
    return {
      minX,
      minY,
      maxX,
      maxY,
      w: Math.max(EDITOR_GRID, maxX - minX),
      h: Math.max(EDITOR_GRID, maxY - minY),
    };
  }

  function clampEditorZoom(z) {
    const n = Number(z);
    if (!Number.isFinite(n)) return 1;
    return Math.min(EDITOR_ZOOM_MAX, Math.max(EDITOR_ZOOM_MIN, Math.round(n / EDITOR_ZOOM_STEP) * EDITOR_ZOOM_STEP));
  }

  function getEditorZoom() {
    return clampEditorZoom(editorDraft?.previewZoom ?? 1);
  }

  function setEditorZoom(next) {
    if (!editorDraft) return;
    editorDraft.previewZoom = clampEditorZoom(next);
    renderEditorPreview();
  }

  /** Map pointer → unscaled stage coordinates (accounts for CSS zoom). */
  function clientToStagePoint(clientX, clientY, stage) {
    const rect = stage.getBoundingClientRect();
    const zoom = editorPreviewLayout.zoom || 1;
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    };
  }

  function draftToStageX(x) {
    return x + editorPreviewLayout.ox;
  }

  function draftToStageY(y) {
    return y + editorPreviewLayout.oy;
  }

  function stageToDraftX(x) {
    return x - editorPreviewLayout.ox;
  }

  function stageToDraftY(y) {
    return y - editorPreviewLayout.oy;
  }

  /**
   * Load category/subtype body + terminal presets into the draft, then shift so
   * all parts sit at >= 0 (jacks/pots/caps place terminals above or beside the body).
   */
  function applyPresetLayout(draft) {
    Object.assign(draft, defaultBody(draft.category, draft.subtype));
    centerBodyInDraft(draft);
    draft.terminals = defaultTerminals(draft.category, draft.subtype, draft);
    const isHb = draft.subtype === 'dualcoil' || draft.subtype === '4conductor'
      || (draft.terminals || []).some((t) => String(t.className || '').includes('hb-tip'));
    if (isHb) {
      draft.terminals = draft.terminals.map((t) => (
        String(t.className || '').includes('hb-tip') ? { ...t, partKind: 'conductor' } : t
      ));
      draft.hasLoom = true;
      draft.loomColor = draft.loomColor || EDITOR_DEFAULT_LOOM_COLOR;
      draft.loomJunction = null;
      ensureEditorLoomJunction(draft);
      layoutEditorConductorFan(draft);
      activateEditorConductors(draft);
      const cls = String(draft.cssClass || 'custom');
      if (!cls.includes('dualcoil')) draft.cssClass = `${cls} dualcoil`.trim();
    } else if (!draftHasLoom(draft)) {
      draft.hasLoom = false;
      delete draft.loomJunction;
    }
    normalizeDraft(draft);
  }

  /** Snap a raw axis value to the nearest body-edge target when within range, else grid. */
  function snapAxisToBodyEdges(raw, targets) {
    let bestTarget = null;
    let bestDist = EDITOR_EDGE_SNAP + 1;
    targets.forEach((t) => {
      const d = Math.abs(raw - t);
      if (d <= EDITOR_EDGE_SNAP && d < bestDist) {
        bestDist = d;
        bestTarget = t;
      }
    });
    if (bestTarget != null) return bestTarget;
    return snapEditor(raw);
  }

  /**
   * Grid-snap terminal/wire position, with magnetic snap of the part's edges
   * onto the four sides of the label box (body/placeholder).
   */
  function snapTerminalToBody(rawX, rawY, term, draft) {
    const { w: tw, h: th } = getSpecTermSize(term, draft);
    const bx = draft.bodyX;
    const by = draft.bodyY;
    const br = bx + draft.bodyW;
    const bb = by + draft.bodyH;
    const xTargets = [
      bx,          // left edges aligned
      br - tw,     // right edges aligned
      bx - tw,     // flush outside left side
      br,          // flush outside right side
    ];
    const yTargets = [
      by,          // top edges aligned
      bb - th,     // bottom edges aligned
      by - th,     // flush outside top side
      bb,          // flush outside bottom side
    ];
    return {
      x: snapAxisToBodyEdges(rawX, xTargets),
      y: snapAxisToBodyEdges(rawY, yTargets),
    };
  }

  function syncStateTerminalFlags(draft) {
    const n = draft.terminals.length;
    draft.states.forEach((state) => {
      if (!state.terminalActive) state.terminalActive = [];
      while (state.terminalActive.length < n) state.terminalActive.push(false);
      state.terminalActive.length = n;
    });
  }

  function ensureEditorStates(draft) {
    if (!draft.states?.length) {
      draft.states = [{ id: 1, terminalActive: draft.terminals.map(() => false) }];
      draft.activeStateIndex = 0;
      return;
    }
    if (draft.activeStateIndex == null || draft.activeStateIndex >= draft.states.length) {
      draft.activeStateIndex = 0;
    }
    syncStateTerminalFlags(draft);
  }

  function getActiveEditorState() {
    return editorDraft.states[editorDraft.activeStateIndex];
  }

  function isTerminalActiveInEditor(idx) {
    return !!getActiveEditorState().terminalActive[idx];
  }

  function setTerminalActiveInEditor(idx, active) {
    getActiveEditorState().terminalActive[idx] = !!active;
  }

  function resetEditorStatesFromTerminals() {
    editorDraft.states = [{ id: 1, terminalActive: editorDraft.terminals.map(() => false) }];
    editorDraft.activeStateIndex = 0;
    activateEditorConductors(editorDraft);
  }

  function syncEditorFieldsFromDom() {
    if (!editorDraft) return;
    const nameEl = document.getElementById('asset-editor-name');
    const labelEl = document.getElementById('asset-editor-placelabel');
    const groundEl = document.getElementById('asset-editor-grounding');
    if (nameEl) editorDraft.name = nameEl.value;
    if (labelEl) editorDraft.placeLabel = labelEl.value.slice(0, 8);
    if (groundEl) editorDraft.needsGrounding = !!groundEl.checked;
  }

  function renderEditorStateView() {
    if (!editorDraft) return;
    syncEditorFieldsFromDom();
    ensureEditorStates(editorDraft);
    renderStateBar();
    renderTerminalEditorList();
    renderEditorPreview();
  }

  function addEditorState() {
    if (!editorDraft) return;
    syncEditorFieldsFromDom();
    ensureEditorStates(editorDraft);
    const nextId = Math.max(0, ...editorDraft.states.map((s) => s.id)) + 1;
    editorDraft.states.push({
      id: nextId,
      terminalActive: editorDraft.terminals.map(() => false),
    });
    editorDraft.activeStateIndex = editorDraft.states.length - 1;
    activateEditorConductors(editorDraft);
    renderEditorStateView();
  }

  function deleteEditorState() {
    if (!editorDraft) return;
    syncEditorFieldsFromDom();
    const current = editorDraft.states[editorDraft.activeStateIndex];
    if (!current || current.id === 1) return;
    editorDraft.states.splice(editorDraft.activeStateIndex, 1);
    editorDraft.activeStateIndex = Math.min(editorDraft.activeStateIndex, editorDraft.states.length - 1);
    renderEditorStateView();
  }

  function renderStateBar() {
    const tabs = document.getElementById('asset-editor-state-tabs');
    const delBtn = document.getElementById('asset-editor-delete-state');
    if (!tabs || !editorDraft) return;
    tabs.innerHTML = '';
    editorDraft.states.forEach((state, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `asset-editor-state-tab${i === editorDraft.activeStateIndex ? ' active' : ''}`;
      btn.textContent = String(state.id);
      btn.title = `State ${state.id}`;
      btn.addEventListener('click', () => {
        if (editorDraft.activeStateIndex === i) return;
        syncEditorFieldsFromDom();
        editorDraft.activeStateIndex = i;
        renderEditorStateView();
      });
      tabs.appendChild(btn);
    });
    if (delBtn) {
      const current = editorDraft.states[editorDraft.activeStateIndex];
      delBtn.disabled = !current || current.id === 1;
    }
  }

  function editorTerminalPreviewStyle(box, term, idx) {
    const kind = termPartKind(term);
    if (kind === 'wire' || kind === 'conductor') {
      // Tip hit-target only — letter lives on the float label (like 4-conductor)
      box.style.background = 'transparent';
      box.style.borderColor = 'transparent';
      box.style.color = 'transparent';
      const float = box.querySelector('.asset-editor-wire-float-label');
      if (float) {
        const text = term.tipLabel || term.label || '';
        const color = term.wireColor || term.color || '#c8cdd6';
        float.textContent = text;
        float.style.setProperty('--hb-wire-color', color);
        float.style.color = text === 'H' ? '#eeeeee' : color;
        float.classList.toggle('is-h', text === 'H');
        float.classList.toggle('is-g', text === 'G');
        float.classList.toggle('is-active', isTerminalActiveInEditor(idx));
      }
      return;
    }
    if (isTerminalActiveInEditor(idx)) {
      box.style.background = ACTIVE_TERM_COLOR;
      box.style.color = '#fff';
      if (term.wireColor) box.style.borderColor = term.wireColor;
      return;
    }
    if (kind === 'lead') {
      box.style.background = 'rgba(255, 255, 255, 0.12)';
      box.style.color = '#eee';
      box.style.borderColor = '#888';
      return;
    }
    box.style.background = term.color;
    box.style.color = '#111';
    if (term.wireColor) box.style.borderColor = term.wireColor;
  }

  function updateEditorGridToggle() {
    const btn = document.getElementById('asset-editor-grid-toggle');
    const preview = document.getElementById('asset-editor-preview');
    const stage = preview?.querySelector('.asset-editor-stage');
    if (!btn || !editorDraft) return;
    btn.textContent = editorDraft.gridVisible ? 'Grid: On' : 'Grid: Off';
    preview?.classList.toggle('show-grid', !!editorDraft.gridVisible);
    stage?.classList.toggle('show-grid', !!editorDraft.gridVisible);
  }

  function updateEditorZoomChrome() {
    const label = document.getElementById('asset-editor-zoom-label');
    if (label) label.textContent = `${Math.round(getEditorZoom() * 100)}%`;
  }

  function loadCustomTemplates() {
    try {
      customTemplates = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      customTemplates.forEach((template) => {
        if (!template.states?.length) {
          template.states = [{ id: 1, terminalActive: (template.terminals || []).map(() => false) }];
        } else {
          const n = (template.terminals || []).length;
          template.states.forEach((state) => {
            if (!state.terminalActive) state.terminalActive = [];
            while (state.terminalActive.length < n) state.terminalActive.push(false);
            state.terminalActive.length = n;
          });
        }
      });
    } catch {
      customTemplates = [];
    }
  }

  function saveCustomTemplates() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customTemplates));
  }

  function getAllTemplates() {
    return [...BUILTIN_TEMPLATES, ...customTemplates];
  }

  function getTemplate(id) {
    return getAllTemplates().find((t) => t.id === id) || null;
  }

  function defaultTerminals(category, subtype, draft) {
    const bx = draft.bodyX;
    const by = draft.bodyY;
    const bw = draft.bodyW;
    const shape = draft.terminalShape || (category === 'switch' || category === 'jack' ? 'rect' : 'square');
    if (category === 'pickup' && subtype === 'singlecoil') {
      return singleCoilTerminalPair(bx, by, bw, draft.bodyH, shape);
    }
    if (category === 'pickup' && subtype === 'dualcoil') {
      return dualCoilTerminals(bx, by, bw, draft.bodyH, shape);
    }
    if (category === 'wire' && subtype === '4conductor') {
      return dualCoilTerminals(bx, by, bw, draft.bodyH, shape);
    }
    if (category === 'jack' && subtype === 'monooutput') {
      return monoOutputTerminals(bx, by, bw, draft.bodyH);
    }
    if (category === 'jack' && subtype === 'stereooutput') {
      return stereoOutputTerminals(bx, by, bw, draft.bodyH);
    }
    if (category === 'power' && subtype === 'ninevolt') {
      return nineVoltTerminals(bx, by, bw, draft.bodyH);
    }
    if (category === 'component' && subtype === 'potentiometer') {
      return potentiometerTerminals(bx, by, bw, draft.bodyH);
    }
    if (category === 'component' && subtype === 'capacitor') {
      // Place leads relative to the draft body box (not capacitorParts' part-origin).
      const tip = 10;
      const lead = 2 * UNIT;
      const cx = bx + bw / 2;
      return [
        {
          label: '',
          role: 'C',
          color: 'transparent',
          className: 'cap-term',
          partKind: 'lead',
          x: cx - tip / 2,
          y: by - lead,
          w: tip,
          h: tip,
        },
        {
          label: '',
          role: 'C',
          color: 'transparent',
          className: 'cap-term',
          partKind: 'lead',
          x: cx - tip / 2,
          y: by + draft.bodyH + lead - tip,
          w: tip,
          h: tip,
        },
      ];
    }
    if (category === 'switch' && (subtype === 'dpdt' || subtype === 'dpdt-on-off-on' || subtype === 'dpdt-on-on')) {
      const { w: tw, h: th } = getTermSize(shape);
      const gap = TERM_GAP;
      const gridW = tw * 2 + gap;
      const startX = bx + snapEditor((bw - gridW) / 2);
      const startY = by + draft.bodyH + TERM_BELOW_BODY;
      const terms = [];
      let i = 0;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 2; col++) {
          terms.push({
            label: `T${i + 1}`,
            color: '#c9a227',
            className: 'switch-term',
            x: startX + col * (tw + gap),
            y: startY + row * (th + gap),
          });
          i++;
        }
      }
      return terms;
    }
    return singleCoilTerminalPair(bx, by, bw, draft.bodyH, shape);
  }

  function defaultBody(category, subtype) {
    if (category === 'custom' || !subtype) return { bodyW: 70, bodyH: 48, placeLabel: 'CU' };
    if (category === 'switch' && subtype === 'dpdt') return { bodyW: 80, bodyH: 56, placeLabel: '3WAY' };
    if (category === 'switch' && subtype === 'dpdt-on-off-on') return { bodyW: 80, bodyH: 56, placeLabel: 'OFO' };
    if (category === 'switch' && subtype === 'dpdt-on-on') return { bodyW: 80, bodyH: 56, placeLabel: '2WAY' };
    if (category === 'jack' && subtype === 'monooutput') return { bodyW: 70, bodyH: 40, placeLabel: 'OUT' };
    if (category === 'jack' && subtype === 'stereooutput') return { bodyW: 90, bodyH: 40, placeLabel: 'STR' };
    if (category === 'power' && subtype === 'ninevolt') return { bodyW: 56, bodyH: 72, placeLabel: '9V' };
    if (category === 'component' && subtype === 'potentiometer') return { bodyW: 64, bodyH: 48, placeLabel: 'POT' };
    if (category === 'component' && subtype === 'capacitor') {
      const parts = capacitorParts(0, 0);
      return {
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        placeLabel: '',
      };
    }
    if (category === 'pickup' && subtype === 'dualcoil') {
      return { bodyW: 120, bodyH: 48, placeLabel: 'HB' };
    }
    if (category === 'wire' && subtype === '4conductor') {
      return { bodyW: 120, bodyH: 48, placeLabel: '4C' };
    }
    return { bodyW: 70, bodyH: 48, placeLabel: 'PU' };
  }

  function defaultTerminalShape(category) {
    return category === 'switch' || category === 'jack' ? 'rect' : 'square';
  }

  function setEditorSelection(selection) {
    editorSelection = selection;
    const stage = document.querySelector('#asset-editor-preview .asset-editor-stage');
    if (!stage) return;
    stage.querySelectorAll('.asset-editor-body.selected, .asset-editor-terminal.selected, .asset-editor-loom-handle.selected').forEach((el) => {
      el.classList.remove('selected');
    });
    if (!selection) return;
    if (selection.type === 'body') {
      stage.querySelector('.asset-editor-body')?.classList.add('selected');
    } else if (selection.type === 'terminal') {
      stage.querySelector(`.asset-editor-terminal[data-idx="${selection.idx}"]`)?.classList.add('selected');
    } else if (selection.type === 'loom') {
      stage.querySelector('.asset-editor-loom-handle')?.classList.add('selected');
    }
  }

  function toggleTerminalShape() {
    if (!editorDraft) return;
    editorDraft.terminalShape = editorDraft.terminalShape === 'rect' ? 'square' : 'rect';
    if (
      (editorDraft.category === 'switch' && (editorDraft.subtype === 'dpdt' || editorDraft.subtype === 'dpdt-on-off-on' || editorDraft.subtype === 'dpdt-on-on'))
      || (editorDraft.category === 'pickup' && editorDraft.subtype === 'singlecoil')
      || (editorDraft.category === 'pickup' && editorDraft.subtype === 'dualcoil')
    ) {
      editorDraft.terminals = defaultTerminals(editorDraft.category, editorDraft.subtype, editorDraft);
      if (editorDraft.subtype === 'dualcoil') {
        editorDraft.terminals = editorDraft.terminals.map((t) => (
          String(t.className || '').includes('hb-tip') ? { ...t, partKind: 'conductor' } : t
        ));
        editorDraft.hasLoom = true;
        editorDraft.loomColor = editorDraft.loomColor || EDITOR_DEFAULT_LOOM_COLOR;
        editorDraft.loomJunction = null;
        ensureEditorLoomJunction(editorDraft);
        layoutEditorConductorFan(editorDraft);
        activateEditorConductors(editorDraft);
      }
      syncStateTerminalFlags(editorDraft);
    }
    renderEditorPreview();
  }

  function hideContextMenu() {
    menuEl()?.classList.add('hidden');
    contextTarget = null;
  }

  function hideDeleteConfirm() {
    deleteConfirmEl()?.classList.add('hidden');
    pendingDelete = null;
  }

  function performDeleteCustomAsset(id, name) {
    const label = name || 'this custom asset';
    const idx = customTemplates.findIndex((t) => t.id === id);
    if (idx === -1) return;
    customTemplates.splice(idx, 1);
    saveCustomTemplates();
    hideDeleteConfirm();
    hideContextMenu();
    deps.setStatus(`Deleted custom asset "${label}"`);
  }

  function showDeleteConfirm(id, name) {
    const dialog = deleteConfirmEl();
    const title = document.getElementById('asset-delete-confirm-title');
    const message = document.getElementById('asset-delete-confirm-message');
    if (!dialog || !message) return;
    const label = name || 'this custom asset';
    if (title) title.textContent = 'Delete custom asset?';
    message.textContent = `Delete "${label}" from your custom assets? This cannot be undone.`;
    pendingDelete = { id, name: label };
    hideContextMenu();
    dialog.classList.remove('hidden');
    document.getElementById('asset-delete-confirm-cancel')?.focus();
  }

  function setupDeleteConfirm() {
    document.getElementById('asset-delete-confirm-ok')?.addEventListener('click', () => {
      if (!pendingDelete) return;
      performDeleteCustomAsset(pendingDelete.id, pendingDelete.name);
    });
    document.getElementById('asset-delete-confirm-cancel')?.addEventListener('click', hideDeleteConfirm);
    deleteConfirmEl()?.addEventListener('click', (e) => {
      if (e.target === deleteConfirmEl()) hideDeleteConfirm();
    });
  }

  function collectActiveCanvasTerminals(componentsMap) {
    const result = [];
    if (!componentsMap) return result;
    componentsMap.forEach((comp) => {
      const template = getTemplate(comp.dataset.assetId);
      if (!template) return;
      const states = getEffectiveStates(comp);
      const state = states[getComponentStateIndex(comp)];
      if (!state) return;
      comp.querySelectorAll('.terminal').forEach((term, idx) => {
        if (state.terminalActive?.[idx]) result.push(term);
      });
    });
    return result;
  }

  function cloneStatesForInstance(states, terminalCount) {
    const n = terminalCount || 0;
    const source = states?.length
      ? states
      : [{ id: 1, terminalActive: Array(n).fill(false) }];
    return source.map((s, i) => ({
      id: s.id != null ? s.id : i + 1,
      label: s.label,
      secondaryLabel: s.secondaryLabel != null ? String(s.secondaryLabel) : '',
      terminalActive: Array.from({ length: n }, (_, j) => !!s.terminalActive?.[j]),
      bridges: Array.isArray(s.bridges) ? s.bridges.map((pair) => [...pair]) : [],
    }));
  }

  function getEffectiveStates(el) {
    const template = getTemplate(el?.dataset?.assetId);
    if (!template) return [];
    if (el._instanceStates?.length) return el._instanceStates;
    if (template.states?.length) return template.states;
    return [{ id: 1, terminalActive: (template.terminals || []).map(() => false) }];
  }

  function ensureInstanceStates(el) {
    if (el._instanceStates?.length) return el._instanceStates;
    const template = getTemplate(el.dataset.assetId);
    const n = (template?.terminals || []).length;
    el._instanceStates = cloneStatesForInstance(template?.states, n);
    return el._instanceStates;
  }

  function setInstanceStates(el, states) {
    if (!el) return;
    if (!states?.length) {
      el._instanceStates = null;
      return;
    }
    const template = getTemplate(el.dataset.assetId);
    const n = (template?.terminals || []).length || states[0]?.terminalActive?.length || 0;
    el._instanceStates = cloneStatesForInstance(states, n);
  }

  function addInstanceState(el) {
    const template = getTemplate(el.dataset.assetId);
    if (!template) return -1;
    const states = ensureInstanceStates(el);
    const n = (template.terminals || []).length;
    const nextId = Math.max(0, ...states.map((s) => Number(s.id) || 0)) + 1;
    states.push({ id: nextId, terminalActive: Array(n).fill(false) });
    applyComponentStateVisuals(el, template, states.length - 1);
    return states.length - 1;
  }

  function removeInstanceState(el, stateIndex) {
    const template = getTemplate(el.dataset.assetId);
    if (!template) return -1;
    const states = ensureInstanceStates(el);
    if (states.length <= 1) return getComponentStateIndex(el);
    if (stateIndex < 0 || stateIndex >= states.length) return getComponentStateIndex(el);
    const current = getComponentStateIndex(el);
    states.splice(stateIndex, 1);
    let next = current;
    if (current === stateIndex) {
      next = Math.min(stateIndex, states.length - 1);
    } else if (current > stateIndex) {
      next = current - 1;
    }
    applyComponentStateVisuals(el, template, next);
    return next;
  }

  function setInstanceTerminalActive(el, stateIndex, termIndex, active) {
    const template = getTemplate(el.dataset.assetId);
    if (!template) return false;
    const states = ensureInstanceStates(el);
    if (!states[stateIndex]) return false;
    if (!states[stateIndex].terminalActive) {
      states[stateIndex].terminalActive = (template.terminals || []).map(() => false);
    }
    states[stateIndex].terminalActive[termIndex] = !!active;
    if (getComponentStateIndex(el) === stateIndex) {
      applyComponentStateVisuals(el, template, stateIndex);
    }
    return true;
  }

  function setInstanceStateSecondaryLabel(el, stateIndex, secondaryLabel) {
    const template = getTemplate(el?.dataset?.assetId);
    if (!template) return false;
    const states = ensureInstanceStates(el);
    if (!states[stateIndex]) return false;
    const next = String(secondaryLabel || '').trim().slice(0, 24);
    states[stateIndex].secondaryLabel = next;
    if (getComponentStateIndex(el) === stateIndex) {
      updateComponentStateLabel(el);
    }
    return true;
  }

  function syncContextMenuPowerButton() {
    const btn = document.getElementById('context-menu-power');
    if (!btn || !deps.getLightningMode) return;
    const on = deps.getLightningMode();
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function syncContextMenuGroundButton() {
    const btn = document.getElementById('context-menu-ground');
    if (!btn || !deps.getGroundCheckMode) return;
    const on = deps.getGroundCheckMode();
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function syncContextMenuWireFocusButton() {
    const btn = document.getElementById('context-menu-wire-focus');
    if (!btn || !deps.getWireEditFocusMode) return;
    const on = deps.getWireEditFocusMode();
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function syncContextMenuShortCheckButton() {
    const btn = document.getElementById('context-menu-short-check');
    if (!btn || !deps.getShortCheckMode) return;
    const on = deps.getShortCheckMode();
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function getAssetConnectionCount(asset) {
    if (!asset) return 0;
    return Array.isArray(asset.terminals) ? asset.terminals.length : 0;
  }

  /** Menu / wheel label: name plus (connection points). */
  function formatAssetMenuLabel(asset) {
    const name = String(asset?.name || asset?.id || 'Asset').trim();
    const n = getAssetConnectionCount(asset);
    if (n <= 0) return name;
    if (new RegExp(`\(${n}\)\s*$`).test(name)) return name;
    return `${name} (${n})`;
  }


  function createAssetMenuRow(asset) {
    const li = document.createElement('li');
    li.className = 'context-menu-row';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'context-menu-item';
    btn.setAttribute('role', 'menuitem');
    const label = formatAssetMenuLabel(asset);
    btn.textContent = label;
    btn.title = label;
    btn.addEventListener('click', () => {
      hideContextMenu();
      deps.setAssetPlacement(asset.id);
    });
    li.appendChild(btn);

    if (!asset.builtin) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'context-menu-edit';
      editBtn.textContent = '✎';
      editBtn.title = `Edit ${asset.name}`;
      editBtn.setAttribute('aria-label', `Edit ${asset.name}`);
      editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openEditorForTemplate(asset.id);
      });
      li.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'context-menu-delete';
      delBtn.textContent = '×';
      delBtn.title = `Delete ${asset.name}`;
      delBtn.setAttribute('aria-label', `Delete ${asset.name}`);
      delBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showDeleteConfirm(asset.id, asset.name);
      });
      li.appendChild(delBtn);
    }

    return li;
  }

  function sortSwitchThrowAssets(assets) {
    const throwRank = (t) => (
      t.switchThrow === 'on-on' || t.subtype === 'dpdt-on-on' ? 0
        : t.switchThrow === 'on-on-on' || t.subtype === 'dpdt' ? 1
          : t.switchThrow === 'on-off-on' ? 2
            : 3
    );
    return [...assets].sort((a, b) => throwRank(a) - throwRank(b) || String(a.name).localeCompare(String(b.name)));
  }

  function closeCategoryFlyout(li) {
    if (!li) return;
    li.classList.remove('is-open');
    li.querySelector(':scope > .context-menu-category-btn')?.setAttribute('aria-expanded', 'false');
    li.querySelectorAll('.context-menu-category.is-open').forEach((nested) => {
      nested.classList.remove('is-open');
      nested.querySelector(':scope > .context-menu-category-btn')?.setAttribute('aria-expanded', 'false');
    });
  }

  /** Only one sibling category/type flyout open at a time — prevents hover stacking. */
  function bindExclusiveCategoryHover(li) {
    const btn = li.querySelector(':scope > .context-menu-category-btn');
    li.addEventListener('mouseenter', () => {
      const parent = li.parentElement;
      if (parent) {
        parent.querySelectorAll(':scope > .context-menu-category.is-open').forEach((other) => {
          if (other !== li) closeCategoryFlyout(other);
        });
      }
      li.classList.add('is-open');
      btn?.setAttribute('aria-expanded', 'true');
    });
    li.addEventListener('mouseleave', () => {
      closeCategoryFlyout(li);
    });
  }

  function createTypeMenuRow(typeDef, assets, flyoutLeft) {
    const li = document.createElement('li');
    li.className = 'context-menu-category context-menu-type';
    if (flyoutLeft) li.classList.add('flyout-left');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'context-menu-item context-menu-category-btn';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = `<span>${typeDef.label}</span><span class="context-menu-chevron" aria-hidden="true">›</span>`;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    li.appendChild(btn);

    const flyout = document.createElement('ul');
    flyout.className = 'context-menu-flyout context-menu-type-flyout';
    flyout.setAttribute('role', 'menu');
    flyout.setAttribute('aria-label', typeDef.label);

    const sorted = (typeDef.id === '2way' || typeDef.id === '3way') ? sortSwitchThrowAssets(assets) : assets;
    sorted.forEach((asset) => flyout.appendChild(createAssetMenuRow(asset)));

    if (!sorted.length) {
      const empty = document.createElement('li');
      empty.className = 'context-menu-empty';
      empty.textContent = 'None yet';
      flyout.appendChild(empty);
    }

    li.appendChild(flyout);
    bindExclusiveCategoryHover(li);
    return li;
  }

  function createCategoryMenuRow(category, assets, flyoutLeft) {
    const li = document.createElement('li');
    li.className = 'context-menu-category';
    if (flyoutLeft) li.classList.add('flyout-left');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'context-menu-item context-menu-category-btn';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = `<span>${category.label}</span><span class="context-menu-chevron" aria-hidden="true">›</span>`;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    li.appendChild(btn);

    const flyout = document.createElement('ul');
    flyout.className = 'context-menu-flyout';
    flyout.setAttribute('role', 'menu');
    flyout.setAttribute('aria-label', category.label);

    const typeDefs = CATEGORY_TYPES[category.id] || [];
    const claimed = new Set();
    typeDefs.forEach((typeDef) => {
      const typed = assets.filter((a) => {
        try { return !!typeDef.match?.(a); } catch (_) { return false; }
      });
      typed.forEach((a) => claimed.add(a.id));
      flyout.appendChild(createTypeMenuRow(typeDef, typed, flyoutLeft));
    });

    const leftover = assets.filter((a) => !claimed.has(a.id));
    leftover.forEach((asset) => flyout.appendChild(createAssetMenuRow(asset)));

    if (!typeDefs.length && !leftover.length) {
      const empty = document.createElement('li');
      empty.className = 'context-menu-empty';
      empty.textContent = 'None yet';
      flyout.appendChild(empty);
    }

    if (EDITOR_CATEGORIES.some((c) => c.id === category.id)) {
      const addLi = document.createElement('li');
      addLi.className = 'context-menu-row';
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'context-menu-add context-menu-flyout-add';
      addBtn.textContent = '+';
      addBtn.title = `Create custom ${category.id}`;
      addBtn.setAttribute('aria-label', `Add custom asset in ${category.label}`);
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openEditor(category.id);
      });
      addLi.appendChild(addBtn);
      flyout.appendChild(addLi);
    }

    li.appendChild(flyout);
    bindExclusiveCategoryHover(li);

    return li;
  }

  function showContextMenu(clientX, clientY, component) {
    contextTarget = component || null;
    if (component && deps.selectComponent) {
      deps.selectComponent(component);
    }
    const menu = menuEl();
    const list = menuListEl();
    if (!menu || !list) return;

    const onPanel = deps.getActiveWorkspacePage?.() === 'panel';
    syncContextMenuPowerButton();
    syncContextMenuGroundButton();
    syncContextMenuWireFocusButton();
    syncContextMenuShortCheckButton();
    list.innerHTML = '';

    const powerRow = menu.querySelector('.context-menu-power-row');
    if (powerRow) powerRow.classList.remove('hidden');

    const powerBtn = document.getElementById('context-menu-power');
    const groundBtn = document.getElementById('context-menu-ground');
    const wireFocusBtn = document.getElementById('context-menu-wire-focus');
    const shortCheckBtn = document.getElementById('context-menu-short-check');
    if (powerBtn) {
      if (onPanel) {
        powerBtn.innerHTML =
          '<svg class="context-menu-bullseye" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
          '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>' +
          '<circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/>' +
          '<circle cx="12" cy="12" r="1.75" fill="currentColor"/>' +
          '</svg>';
        powerBtn.title = 'Place panel snap points';
        powerBtn.setAttribute('aria-label', 'Panel snap points');
        powerBtn.classList.toggle('panel-snap-active', !!deps.getPanelSnapMode?.());
        powerBtn.classList.remove('active');
        powerBtn.setAttribute('aria-pressed', deps.getPanelSnapMode?.() ? 'true' : 'false');
      } else {
        powerBtn.textContent = '⚡';
        powerBtn.title = 'Focus: Active — highlight wires on active signal path';
        powerBtn.setAttribute('aria-label', 'Focus: Active signal path');
        powerBtn.classList.remove('panel-snap-active');
        syncContextMenuPowerButton();
      }
    }
    if (groundBtn) {
      if (onPanel) {
        groundBtn.title = 'Ground (panel — no action)';
        groundBtn.classList.remove('active');
        groundBtn.setAttribute('aria-pressed', 'false');
      } else {
        groundBtn.title = 'Focus: Ground — highlight ungrounded YESGROUND assets';
        groundBtn.setAttribute('aria-label', 'Focus: Ground check');
        syncContextMenuGroundButton();
      }
    }
    if (wireFocusBtn) {
      wireFocusBtn.classList.toggle('hidden', onPanel);
      if (!onPanel) {
        wireFocusBtn.title = 'Focus: Wire — grey & lock assets, wires in front';
        wireFocusBtn.setAttribute('aria-label', 'Focus: Wire edit');
        syncContextMenuWireFocusButton();
      }
    }
    if (shortCheckBtn) {
      shortCheckBtn.classList.toggle('hidden', onPanel);
      if (!onPanel) {
        shortCheckBtn.title = 'Focus: Short — detect hard shorts (H↔G, tip–sleeve, battery)';
        shortCheckBtn.setAttribute('aria-label', 'Focus: Short check');
        syncContextMenuShortCheckButton();
      }
    }

    if (component && !onPanel) {
      const compTemplate = getTemplate(component.dataset.assetId);
      if (compTemplate && !compTemplate.builtin) {
        const editRow = document.createElement('li');
        editRow.className = 'context-menu-row context-menu-edit-row';
        const editItem = document.createElement('button');
        editItem.type = 'button';
        editItem.className = 'context-menu-item context-menu-edit-item';
        editItem.textContent = `Edit ${compTemplate.name}…`;
        editItem.addEventListener('click', () => openEditorForTemplate(compTemplate.id));
        editRow.appendChild(editItem);
        list.appendChild(editRow);
      }
    }

    const templates = getAllTemplates();
    const flyoutLeft = clientX > window.innerWidth - 320;
    const categories = onPanel ? PANEL_CATEGORIES : CATEGORIES;
    // Keep User (custom) last in the list so it sits directly above "+ Custom Asset"
    const ordered = onPanel
      ? categories
      : [
          ...categories.filter((c) => c.id !== 'custom'),
          ...categories.filter((c) => c.id === 'custom'),
        ];
    ordered.forEach((category) => {
      if (category.hidden) return;
      const assets = templates.filter((t) => t.category === category.id);
      list.appendChild(createCategoryMenuRow(category, assets, flyoutLeft));
    });

    const addBtn = document.getElementById('context-menu-add');
    if (addBtn) {
      addBtn.textContent = onPanel ? '+ Import File' : '+ Custom Asset';
      addBtn.title = onPanel ? 'Import DXF/DWG file' : 'Create custom asset';
      addBtn.dataset.mode = onPanel ? 'import' : 'custom';
    }

    menu.classList.toggle('flyout-left', flyoutLeft);
    menu.classList.toggle('context-menu-panel', onPanel);
    menu.classList.remove('hidden');
    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${Math.max(4, clientX - rect.width)}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${Math.max(4, clientY - rect.height)}px`;
    }
  }

  function openEditorForTemplate(templateId) {
    const template = getTemplate(templateId);
    if (!template || template.builtin) return;
    hideContextMenu();
    editorSelection = null;
    editorDraft = {
      ...JSON.parse(JSON.stringify(template)),
      editingId: template.id,
      gridVisible: false,
      previewZoom: 1,
      activeStateIndex: 0,
      terminalShape: template.terminalShape || defaultTerminalShape(template.category),
      needsGrounding: !!template.needsGrounding,
      valueFields: normalizeValueFields(
        template.valueFields ?? defaultValueFieldsForSubtype(template.category, template.subtype)
      ),
      defaultValues: { ...(template.defaultValues || {}) },
    };
    if (editorDraft.bodyX == null) editorDraft.bodyX = 0;
    if (editorDraft.bodyY == null) editorDraft.bodyY = 12;
    if (!Array.isArray(editorDraft.terminals)) editorDraft.terminals = [];
    editorDraft.terminals.forEach((t) => {
      if (termPartKind(t) !== 'wire') return;
      t.w = 10;
      t.h = 10;
      if (!t.wireColor) t.wireColor = t.color || '#c9a227';
      if (!t.tipLabel) t.tipLabel = t.label || 'W';
      if (!t.className || !String(t.className).includes('wire-term')) {
        t.className = `${t.className || ''} wire-term`.trim();
      }
      t.partKind = 'wire';
      t.keepColorWhenActive = true;
    });
    editorDraft.terminals.forEach((t) => {
      if (String(t.className || '').includes('hb-tip') || t.partKind === 'conductor') {
        t.partKind = 'conductor';
      }
    });
    if (draftHasLoom(editorDraft)) {
      editorDraft.hasLoom = true;
      editorDraft.loomColor = editorDraft.loomColor || EDITOR_DEFAULT_LOOM_COLOR;
      if (!editorDraft.loomJunction && Number.isFinite(parseFloat(editorDraft.hbJunctionLeft))) {
        editorDraft.loomJunction = {
          x: parseFloat(editorDraft.hbJunctionLeft),
          y: parseFloat(editorDraft.hbJunctionTop),
        };
      }
      ensureEditorLoomJunction(editorDraft);
      layoutEditorConductorFan(editorDraft);
      activateEditorConductors(editorDraft);
    }
    normalizeDraft(editorDraft);
    editorEl()?.classList.remove('hidden');
    renderEditor();
    deps.setStatus(`Editing "${template.name}" — Save to apply changes`);
  }

  function openEditor(categoryId) {
    hideContextMenu();
    const category = EDITOR_CATEGORIES.some((c) => c.id === categoryId) ? categoryId : 'custom';
    const subtypeOpts = SUBTYPES[category] || [];
    const subtype = subtypeOpts[0]?.id || '';
    editorSelection = null;
    editorDraft = {
      name: '',
      category,
      subtype,
      terminalShape: defaultTerminalShape(category),
      needsGrounding: false,
      cssClass: 'custom',
      layout: 'absolute',
      gridVisible: false,
      previewZoom: 1,
      bodyW: 70,
      bodyH: 48,
      bodyX: 0,
      bodyY: 12,
      placeLabel: 'CU',
      terminals: [],
      valueFields: defaultValueFieldsForSubtype(category, subtype),
      defaultValues: {},
      editingId: null,
    };
    applyPresetLayout(editorDraft);
    resetEditorStatesFromTerminals();
    editorEl()?.classList.remove('hidden');
    renderEditor();
    deps.setStatus('Edit custom asset — drag body & terminals, Save or Cancel');
  }

  function closeEditor() {
    editorDraft = null;
    editorSelection = null;
    editorEl()?.classList.add('hidden');
  }

  function renderSubtypeOptions() {
    const sel = document.getElementById('asset-editor-subtype');
    const field = document.getElementById('asset-editor-subtype-field');
    if (!sel || !editorDraft) return;
    const options = SUBTYPES[editorDraft.category] || [];
    sel.innerHTML = '';
    options.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.id;
      o.textContent = opt.label;
      sel.appendChild(o);
    });
    if (options.length) {
      if (!options.some((o) => o.id === editorDraft.subtype)) {
        editorDraft.subtype = options[0].id;
      }
      sel.value = editorDraft.subtype;
      field?.classList.remove('hidden');
      sel.disabled = false;
    } else {
      editorDraft.subtype = '';
      field?.classList.add('hidden');
      sel.disabled = true;
    }
  }

  function captureTerminalResizeRelation(term, draft) {
    const { w, h } = getSpecTermSize(term, draft);
    const bx = draft.bodyX;
    const by = draft.bodyY;
    const br = bx + draft.bodyW;
    const bb = by + draft.bodyH;
    const gapBottom = term.y - bb;
    const gapTop = by - (term.y + h);
    const gapLeft = bx - (term.x + w);
    const gapRight = term.x - br;
    const bodyCy = by + draft.bodyH / 2;
    const termCy = term.y + h / 2;

    if (gapBottom >= -1 && gapBottom >= gapTop && gapBottom >= gapLeft && gapBottom >= gapRight) {
      return { anchor: 'bottom', gap: gapBottom };
    }
    if (gapTop >= -1 && gapTop >= gapLeft && gapTop >= gapRight) {
      return { anchor: 'top', gap: gapTop };
    }
    if (gapLeft >= -1 && gapLeft >= gapRight) {
      return { anchor: 'left', gap: gapLeft, centerYOffset: termCy - bodyCy };
    }
    if (gapRight >= -1) {
      return { anchor: 'right', gap: gapRight, centerYOffset: termCy - bodyCy };
    }
    return {
      anchor: 'free',
      relX: term.x - bx,
      relY: term.y - by,
    };
  }

  function repositionTerminalsAfterBodyResize(startTerms) {
    const bx = editorDraft.bodyX;
    const by = editorDraft.bodyY;
    const br = bx + editorDraft.bodyW;
    const bb = by + editorDraft.bodyH;
    const bodyCy = by + editorDraft.bodyH / 2;

    editorDraft.terminals.forEach((term, i) => {
      const s = startTerms[i];
      const { w, h } = getSpecTermSize(term, editorDraft);
      if (s.anchor === 'bottom') {
        term.y = snapEditor(bb + s.gap);
      } else if (s.anchor === 'top') {
        term.y = snapEditor(by - s.gap - h);
      } else if (s.anchor === 'left') {
        term.x = snapEditor(bx - s.gap - w);
        term.y = snapEditor(bodyCy - h / 2 + (s.centerYOffset || 0));
      } else if (s.anchor === 'right') {
        term.x = snapEditor(br + s.gap);
        term.y = snapEditor(bodyCy - h / 2 + (s.centerYOffset || 0));
      } else if (s.anchor === 'free') {
        term.x = snapEditor(bx + s.relX);
        term.y = snapEditor(by + s.relY);
      }
    });
  }

  function snapBodySize(v, min) {
    return Math.max(min, snapEditor(v));
  }

  function applyCenterLockedResize(handle, deltaX, deltaY, drag) {
    let newW = drag.startW;
    let newH = drag.startH;

    if (handle.includes('e')) {
      newW = drag.startW + 2 * deltaX;
    } else if (handle.includes('w')) {
      newW = drag.startW - 2 * deltaX;
    }

    if (handle.includes('s')) {
      newH = drag.startH + 2 * deltaY;
    } else if (handle.includes('n')) {
      newH = drag.startH - 2 * deltaY;
    }

    editorDraft.bodyW = snapBodySize(newW, BODY_MIN_W);
    editorDraft.bodyH = snapBodySize(newH, BODY_MIN_H);
    editorDraft.bodyX = snapEditor(drag.startCx - editorDraft.bodyW / 2);
    editorDraft.bodyY = snapEditor(drag.startCy - editorDraft.bodyH / 2);
  }

  function updateEditorBodyVisual(stage) {
    const bodyEl = stage.querySelector('.asset-editor-body');
    if (!bodyEl || !editorDraft) return;
    bodyEl.style.width = `${editorDraft.bodyW}px`;
    bodyEl.style.height = `${editorDraft.bodyH}px`;
    bodyEl.style.left = `${draftToStageX(editorDraft.bodyX)}px`;
    bodyEl.style.top = `${draftToStageY(editorDraft.bodyY)}px`;
    const label = bodyEl.querySelector('.asset-editor-body-label');
    if (label) label.textContent = editorDraft.placeLabel || '??';
    updateEditorWireLines(stage);
  }

  function updateEditorTerminalVisuals(stage) {
    if (!stage || !editorDraft) return;
    editorDraft.terminals.forEach((term, idx) => {
      const box = stage.querySelector(`.asset-editor-terminal[data-idx="${idx}"]`);
      if (!box) return;
      box.style.left = `${draftToStageX(term.x)}px`;
      box.style.top = `${draftToStageY(term.y)}px`;
    });
    updateEditorWireLines(stage);
  }

  /** Draw loom sheath + conductor fan (workspace-accurate) and plain lead/wire strokes. */
  function updateEditorWireLines(stage) {
    if (!stage || !editorDraft) return;
    let svg = stage.querySelector('.asset-editor-wire-svg');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'asset-editor-wire-svg');
      stage.insertBefore(svg, stage.firstChild);
    }
    const sw = editorPreviewLayout.stageW || stage.offsetWidth || 0;
    const sh = editorPreviewLayout.stageH || stage.offsetHeight || 0;
    svg.setAttribute('width', String(sw));
    svg.setAttribute('height', String(sh));
    svg.setAttribute('viewBox', `0 0 ${sw} ${sh}`);
    svg.innerHTML = '';
    stage.querySelectorAll('.asset-editor-loom-handle').forEach((n) => n.remove());

    const bx = draftToStageX(editorDraft.bodyX);
    const by = draftToStageY(editorDraft.bodyY);
    const bw = editorDraft.bodyW;
    const bh = editorDraft.bodyH;

    if (draftHasLoom(editorDraft)) {
      const junction = ensureEditorLoomJunction(editorDraft);
      const exit = getEditorLoomExit(editorDraft, junction);
      const ex = draftToStageX(exit.x);
      const ey = draftToStageY(exit.y);
      const jx = draftToStageX(junction.x);
      const jy = draftToStageY(junction.y);
      const loomColor = editorDraft.loomColor || EDITOR_DEFAULT_LOOM_COLOR;

      const loomBorder = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      loomBorder.setAttribute('x1', String(ex));
      loomBorder.setAttribute('y1', String(ey));
      loomBorder.setAttribute('x2', String(jx));
      loomBorder.setAttribute('y2', String(jy));
      loomBorder.setAttribute('stroke', '#3a3a3a');
      loomBorder.setAttribute('stroke-width', String(EDITOR_LOOM_STROKE + 1.4));
      loomBorder.setAttribute('stroke-linecap', 'round');
      svg.appendChild(loomBorder);

      const loom = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      loom.setAttribute('x1', String(ex));
      loom.setAttribute('y1', String(ey));
      loom.setAttribute('x2', String(jx));
      loom.setAttribute('y2', String(jy));
      loom.setAttribute('stroke', loomColor);
      loom.setAttribute('stroke-width', String(EDITOR_LOOM_STROKE));
      loom.setAttribute('stroke-linecap', 'round');
      svg.appendChild(loom);

      editorDraft.terminals.forEach((term) => {
        if (termPartKind(term) !== 'conductor') return;
        const { w, h } = getSpecTermSize(term, editorDraft);
        const tipCx = draftToStageX(term.x) + w / 2;
        const tipCy = draftToStageY(term.y) + h / 2;
        const fan = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        fan.setAttribute('x1', String(jx));
        fan.setAttribute('y1', String(jy));
        fan.setAttribute('x2', String(tipCx));
        fan.setAttribute('y2', String(tipCy));
        fan.setAttribute('stroke', term.wireColor || '#888');
        fan.setAttribute('stroke-width', String(EDITOR_FAN_STROKE));
        fan.setAttribute('stroke-linecap', 'round');
        svg.appendChild(fan);
      });

      // Draggable junction handle
      const handle = document.createElement('div');
      handle.className = 'asset-editor-loom-handle';
      if (editorSelection?.type === 'loom') handle.classList.add('selected');
      handle.style.left = `${jx - 6}px`;
      handle.style.top = `${jy - 6}px`;
      handle.title = 'Drag loom — snaps to pickup sides';
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setEditorSelection({ type: 'loom' });
        const pt = clientToStagePoint(e.clientX, e.clientY, stage);
        editorDrag = {
          type: 'loom',
          offsetX: stageToDraftX(pt.x) - junction.x,
          offsetY: stageToDraftY(pt.y) - junction.y,
        };
      });
      stage.appendChild(handle);
      return;
    }

    editorDraft.terminals.forEach((term) => {
      const kind = termPartKind(term);
      if (kind !== 'lead' && kind !== 'wire') return;
      const { w, h } = getSpecTermSize(term, editorDraft);
      const tipCx = draftToStageX(term.x) + w / 2;
      const tipCy = draftToStageY(term.y) + h / 2;
      let x1 = bx + bw / 2;
      let y1 = by + bh / 2;
      if (tipCx < bx) x1 = bx;
      else if (tipCx > bx + bw) x1 = bx + bw;
      if (tipCy < by) y1 = by;
      else if (tipCy > by + bh) y1 = by + bh;
      if (tipCx < bx || tipCx > bx + bw) {
        y1 = Math.min(by + bh, Math.max(by, tipCy));
      } else if (tipCy < by || tipCy > by + bh) {
        x1 = Math.min(bx + bw, Math.max(bx, tipCx));
      }
      const stroke = term.wireColor
        || (kind === 'wire' ? '#c9a227' : '#9aa0a6');
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(tipCx));
      line.setAttribute('y2', String(tipCy));
      line.setAttribute('stroke', stroke);
      line.setAttribute('stroke-width', kind === 'wire' ? '2.5' : '2');
      line.setAttribute('stroke-linecap', 'round');
      if (kind === 'lead') line.setAttribute('stroke-dasharray', '3 2');
      svg.appendChild(line);
    });
  }

  function attachResizeHandles(body, stage) {
    RESIZE_HANDLES.forEach(({ id, cursor }) => {
      const handle = document.createElement('div');
      handle.className = `asset-editor-resize-handle asset-editor-resize-${id}`;
      handle.dataset.handle = id;
      handle.style.cursor = cursor;
      handle.title = id.length === 1
        ? (id === 'n' || id === 's' ? 'Resize height' : 'Resize width')
        : 'Resize width & height';
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setEditorSelection({ type: 'body' });
        const pt = clientToStagePoint(e.clientX, e.clientY, stage);
        editorDrag = {
          type: 'resize',
          handle: id,
          startCx: editorDraft.bodyX + editorDraft.bodyW / 2,
          startCy: editorDraft.bodyY + editorDraft.bodyH / 2,
          startW: editorDraft.bodyW,
          startH: editorDraft.bodyH,
          startMx: pt.x,
          startMy: pt.y,
          startTerms: editorDraft.terminals.map((t) => captureTerminalResizeRelation(t, editorDraft)),
        };
        body.classList.add('resizing');
      });
      body.appendChild(handle);
    });
  }

  function renderTerminalEditorList() {
    const list = document.getElementById('asset-editor-terminals-list');
    if (!list || !editorDraft) return;
    list.innerHTML = '';

    if (draftHasLoom(editorDraft)) {
      const loomRow = document.createElement('div');
      loomRow.className = 'asset-editor-term-row asset-editor-loom-row';
      const kindEl = document.createElement('span');
      kindEl.className = 'asset-editor-term-kind';
      kindEl.textContent = 'Loom';
      kindEl.title = '4-conductor loom (fixed fan — colour only)';
      const label = document.createElement('span');
      label.className = 'asset-editor-loom-label';
      label.textContent = 'Sheath';
      const colorSel = document.createElement('select');
      colorSel.className = 'asset-editor-select';
      TERMINAL_PALETTE.forEach((c) => {
        const o = document.createElement('option');
        o.value = c.value;
        o.textContent = c.name;
        colorSel.appendChild(o);
      });
      const loomColor = editorDraft.loomColor || EDITOR_DEFAULT_LOOM_COLOR;
      if (![...colorSel.options].some((o) => o.value === loomColor)) {
        const o = document.createElement('option');
        o.value = loomColor;
        o.textContent = 'Custom';
        colorSel.appendChild(o);
      }
      colorSel.value = loomColor;
      colorSel.addEventListener('change', () => {
        editorDraft.loomColor = colorSel.value;
        renderEditorPreview();
      });
      loomRow.appendChild(kindEl);
      loomRow.appendChild(label);
      loomRow.appendChild(colorSel);
      list.appendChild(loomRow);
    }

    editorDraft.terminals.forEach((term, idx) => {
      const kind = termPartKind(term);
      // Conductors are driven by the loom fan — not listed individually
      if (kind === 'conductor') return;
      const row = document.createElement('div');
      const editable = isTermLabelColorEditable(term);
      row.className = `asset-editor-term-row${editable ? '' : ' is-locked'}`;

      const kindEl = document.createElement('span');
      kindEl.className = 'asset-editor-term-kind';
      kindEl.textContent = kind;
      kindEl.title = kind;

      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'asset-editor-input';
      labelInput.value = term.tipLabel || term.label || '';
      labelInput.maxLength = 4;
      labelInput.readOnly = !editable;
      labelInput.disabled = !editable;
      if (editable) {
        labelInput.addEventListener('input', () => {
          const next = labelInput.value.slice(0, 4) || '?';
          term.label = next;
          term.tipLabel = next;
          renderEditorPreview();
        });
      }

      const colorSel = document.createElement('select');
      colorSel.className = 'asset-editor-select';
      TERMINAL_PALETTE.forEach((c) => {
        const o = document.createElement('option');
        o.value = c.value;
        o.textContent = c.name;
        colorSel.appendChild(o);
      });
      const shownColor = term.wireColor || term.color || '#6ab0ff';
      if (![...colorSel.options].some((o) => o.value === shownColor)) {
        const o = document.createElement('option');
        o.value = shownColor;
        o.textContent = 'Fixed';
        colorSel.appendChild(o);
      }
      colorSel.value = shownColor;
      colorSel.disabled = !editable;
      if (editable) {
        colorSel.addEventListener('change', () => {
          term.color = colorSel.value;
          if (kind === 'wire') term.wireColor = colorSel.value;
          renderEditorPreview();
        });
      }

      const activeLabel = document.createElement('label');
      activeLabel.className = 'asset-editor-term-active-label';
      activeLabel.title = 'Active in this state';
      const activeToggle = document.createElement('input');
      activeToggle.type = 'checkbox';
      activeToggle.checked = isTerminalActiveInEditor(idx);
      activeToggle.addEventListener('change', () => {
        setTerminalActiveInEditor(idx, activeToggle.checked);
        renderEditorPreview();
      });
      activeLabel.appendChild(activeToggle);
      activeLabel.appendChild(document.createTextNode('On'));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'asset-editor-icon-btn';
      delBtn.textContent = '×';
      delBtn.title = 'Remove';
      delBtn.addEventListener('click', () => {
        editorDraft.terminals.splice(idx, 1);
        syncStateTerminalFlags(editorDraft);
        renderEditor();
      });

      row.appendChild(kindEl);
      row.appendChild(labelInput);
      row.appendChild(colorSel);
      row.appendChild(activeLabel);
      row.appendChild(delBtn);
      list.appendChild(row);
    });
  }

  function renderEditorPreview() {
    const preview = document.getElementById('asset-editor-preview');
    if (!preview || !editorDraft) return;
    preview.innerHTML = '';

    const zoom = getEditorZoom();
    editorDraft.previewZoom = zoom;

    const viewport = document.createElement('div');
    viewport.className = 'asset-editor-preview-viewport';

    const zoomBar = document.createElement('div');
    zoomBar.className = 'asset-editor-zoom-bar';
    zoomBar.innerHTML = `
      <button type="button" class="asset-editor-zoom-btn" data-zoom="-1" title="Zoom out" aria-label="Zoom out">−</button>
      <span id="asset-editor-zoom-label" class="asset-editor-zoom-label">${Math.round(zoom * 100)}%</span>
      <button type="button" class="asset-editor-zoom-btn" data-zoom="1" title="Zoom in" aria-label="Zoom in">+</button>
      <button type="button" class="asset-editor-zoom-btn asset-editor-zoom-reset" data-zoom="reset" title="Reset zoom" aria-label="Reset zoom">100%</button>
    `;
    zoomBar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-zoom]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const action = btn.getAttribute('data-zoom');
      if (action === 'reset') setEditorZoom(1);
      else if (action === '-1') setEditorZoom(getEditorZoom() - EDITOR_ZOOM_STEP);
      else if (action === '1') setEditorZoom(getEditorZoom() + EDITOR_ZOOM_STEP);
    });

    // Measure viewport after chrome is in the DOM for accurate centering
    preview.appendChild(zoomBar);
    preview.appendChild(viewport);

    const bounds = getDraftContentBounds(editorDraft);
    const viewW = Math.max(EDITOR_STAGE_MIN_W, viewport.clientWidth || preview.clientWidth || EDITOR_STAGE_MIN_W);
    const viewH = Math.max(EDITOR_STAGE_MIN_H, viewport.clientHeight || 220);
    const stageW = Math.max(
      EDITOR_STAGE_MIN_W,
      Math.ceil((viewW / zoom)),
      Math.ceil(bounds.w + EDITOR_PREVIEW_PAD * 2)
    );
    const stageH = Math.max(
      EDITOR_STAGE_MIN_H,
      Math.ceil((viewH / zoom)),
      Math.ceil(bounds.h + EDITOR_PREVIEW_PAD * 2)
    );
    const ox = snapEditor((stageW - bounds.w) / 2 - bounds.minX);
    const oy = snapEditor((stageH - bounds.h) / 2 - bounds.minY);
    editorPreviewLayout = { ox, oy, zoom, stageW, stageH };

    const stage = document.createElement('div');
    stage.className = 'asset-editor-stage';
    stage.style.width = `${stageW}px`;
    stage.style.height = `${stageH}px`;
    stage.style.transform = `scale(${zoom})`;
    stage.style.transformOrigin = '0 0';
    if (editorDraft.gridVisible) stage.classList.add('show-grid');

    const scaler = document.createElement('div');
    scaler.className = 'asset-editor-stage-scaler';
    scaler.style.width = `${stageW * zoom}px`;
    scaler.style.height = `${stageH * zoom}px`;

    const body = document.createElement('div');
    body.className = 'asset-editor-body';
    if (editorSelection?.type === 'body') body.classList.add('selected');
    const label = document.createElement('span');
    label.className = 'asset-editor-body-label';
    label.textContent = editorDraft.placeLabel || '??';
    body.appendChild(label);
    body.style.width = `${editorDraft.bodyW}px`;
    body.style.height = `${editorDraft.bodyH}px`;
    body.style.left = `${draftToStageX(editorDraft.bodyX)}px`;
    body.style.top = `${draftToStageY(editorDraft.bodyY)}px`;

    body.addEventListener('mousedown', (e) => {
      if (e.target.closest('.asset-editor-resize-handle')) return;
      e.preventDefault();
      e.stopPropagation();
      setEditorSelection({ type: 'body' });
      const pt = clientToStagePoint(e.clientX, e.clientY, stage);
      editorDrag = {
        type: 'body',
        offsetX: stageToDraftX(pt.x) - editorDraft.bodyX,
        offsetY: stageToDraftY(pt.y) - editorDraft.bodyY,
        startBodyX: editorDraft.bodyX,
        startBodyY: editorDraft.bodyY,
        startTerms: editorDraft.terminals.map((t) => ({ x: t.x, y: t.y })),
        startLoom: editorDraft.loomJunction
          ? { x: editorDraft.loomJunction.x, y: editorDraft.loomJunction.y }
          : null,
      };
      body.classList.add('dragging');
    });

    attachResizeHandles(body, stage);
    stage.appendChild(body);

    editorDraft.terminals.forEach((term, idx) => {
      const kind = termPartKind(term);
      const isWireLike = kind === 'wire' || kind === 'conductor';
      const { w: termW, h: termH } = isWireLike
        ? { w: term.w || 10, h: term.h || 10 }
        : getSpecTermSize(term, editorDraft);
      const box = document.createElement('div');
      box.className = 'asset-editor-terminal';
      if (!isWireLike && (termW > TERM_W || editorDraft.terminalShape === 'rect')) {
        box.classList.add('is-rect');
      }
      if (editorSelection?.type === 'terminal' && editorSelection.idx === idx) {
        box.classList.add('selected');
      }
      box.style.left = `${draftToStageX(term.x)}px`;
      box.style.top = `${draftToStageY(term.y)}px`;
      box.style.width = `${termW}px`;
      box.style.height = `${termH}px`;
      box.dataset.idx = String(idx);

      if (kind === 'lead') box.classList.add('is-lead');
      if (kind === 'conductor') {
        box.classList.add('is-conductor', 'is-wire-tip', 'is-locked-tip');
        box.title = term.menuLabel || term.tipLabel || 'Conductor (fan from loom)';
      }
      if (kind === 'wire') box.classList.add('is-wire', 'is-wire-tip');

      if (isWireLike) {
        // Match 4-conductor: invisible tip + coloured float letter
        const float = document.createElement('span');
        float.className = 'asset-editor-wire-float-label hb-float-label';
        float.setAttribute('aria-hidden', 'true');
        box.appendChild(float);
      } else {
        const termLabel = document.createElement('span');
        termLabel.className = 'asset-editor-terminal-label';
        termLabel.textContent = term.tipLabel || term.label || '';
        box.appendChild(termLabel);
      }

      editorTerminalPreviewStyle(box, term, idx);

      if (kind !== 'conductor') {
        box.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          setEditorSelection({ type: 'terminal', idx });
          const pt = clientToStagePoint(e.clientX, e.clientY, stage);
          editorDrag = {
            type: 'terminal',
            idx,
            offsetX: stageToDraftX(pt.x) - term.x,
            offsetY: stageToDraftY(pt.y) - term.y,
          };
        });
      }

      stage.appendChild(box);
    });

    updateEditorWireLines(stage);

    stage.addEventListener('mousedown', (e) => {
      if (e.target === stage || e.target.classList?.contains('asset-editor-wire-svg')) {
        setEditorSelection(null);
      }
    });
    scaler.appendChild(stage);
    viewport.appendChild(scaler);

    const shapeBtn = document.createElement('button');
    shapeBtn.type = 'button';
    shapeBtn.className = `asset-editor-shape-btn${editorDraft.terminalShape === 'rect' ? ' is-rect' : ''}`;
    shapeBtn.title = editorDraft.terminalShape === 'rect'
      ? 'Use square terminal boxes'
      : 'Use rectangular terminal boxes';
    shapeBtn.setAttribute('aria-label', shapeBtn.title);
    shapeBtn.setAttribute('aria-pressed', editorDraft.terminalShape === 'rect' ? 'true' : 'false');
    shapeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleTerminalShape();
    });
    preview.appendChild(shapeBtn);

    updateEditorGridToggle();
    updateEditorZoomChrome();
  }

  function ensureDraftDefaultValues() {
    if (!editorDraft) return;
    if (!editorDraft.defaultValues || typeof editorDraft.defaultValues !== 'object') {
      editorDraft.defaultValues = {};
    }
  }

  function pruneDraftDefaultValues() {
    ensureDraftDefaultValues();
    const allowed = new Set(normalizeValueFields(editorDraft.valueFields));
    Object.keys(editorDraft.defaultValues).forEach((key) => {
      if (!allowed.has(key)) delete editorDraft.defaultValues[key];
    });
  }

  function renderEditorValueFields() {
    const host = document.querySelector('.asset-editor-value-fields');
    const list = document.getElementById('asset-editor-value-fields-list');
    const title = host?.querySelector('.asset-editor-value-fields-label');
    if (!list || !editorDraft) return;

    ensureDraftDefaultValues();
    const isCustom = editorDraft.category === 'custom';
    const relevant = isCustom
      ? Object.keys(ELECTRICAL_VALUE_DEFS)
      : relevantValueFieldsForDraft(editorDraft);

    if (!isCustom) {
      editorDraft.valueFields = [...relevant];
      pruneDraftDefaultValues();
    } else {
      editorDraft.valueFields = normalizeValueFields(editorDraft.valueFields);
      pruneDraftDefaultValues();
    }

    const enabled = new Set(normalizeValueFields(editorDraft.valueFields));
    list.replaceChildren();

    const keysToShow = isCustom ? Object.keys(ELECTRICAL_VALUE_DEFS) : relevant;
    if (!keysToShow.length) {
      host?.classList.add('is-empty');
      if (title) title.hidden = true;
      return;
    }
    host?.classList.remove('is-empty');
    if (title) title.hidden = false;

    keysToShow.forEach((key) => {
      const def = ELECTRICAL_VALUE_DEFS[key];
      if (!def) return;
      const on = enabled.has(key);
      const row = document.createElement('div');
      row.className = `asset-editor-value-row${on ? ' is-enabled' : ''}`;

      if (isCustom) {
        const toggle = document.createElement('label');
        toggle.className = 'asset-editor-value-enable';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = on;
        box.addEventListener('change', () => {
          const next = new Set(normalizeValueFields(editorDraft.valueFields));
          if (box.checked) next.add(key);
          else {
            next.delete(key);
            delete editorDraft.defaultValues[key];
          }
          editorDraft.valueFields = [...next];
          renderEditorValueFields();
        });
        const lab = document.createElement('span');
        lab.innerHTML = `<span class="asset-editor-value-field-sym">${def.symbol}</span> ${def.label}`;
        toggle.appendChild(box);
        toggle.appendChild(lab);
        row.appendChild(toggle);
      } else {
        const lab = document.createElement('div');
        lab.className = 'asset-editor-value-fixed-label';
        lab.innerHTML = `<span class="asset-editor-value-field-sym">${def.symbol}</span> ${def.label}`;
        row.appendChild(lab);
      }

      if (on || !isCustom) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'asset-editor-input asset-editor-value-input';
        input.placeholder = def.placeholder || '';
        input.value = editorDraft.defaultValues[key] || '';
        input.setAttribute('aria-label', def.label);
        input.addEventListener('input', () => {
          ensureDraftDefaultValues();
          const v = input.value.trim();
          if (v) editorDraft.defaultValues[key] = v;
          else delete editorDraft.defaultValues[key];
        });
        row.appendChild(input);
      }

      list.appendChild(row);
    });
  }

  function renderEditor() {
    if (!editorDraft) return;
    syncEditorFieldsFromDom();
    ensureEditorStates(editorDraft);
    const header = document.getElementById('asset-editor-header');
    if (header) {
      header.textContent = editorDraft.editingId ? 'Edit Custom Asset' : 'Custom Asset';
    }
    document.getElementById('asset-editor-name').value = editorDraft.name || '';
    document.getElementById('asset-editor-category').value = editorDraft.category;
    document.getElementById('asset-editor-placelabel').value = editorDraft.placeLabel;
    const groundToggle = document.getElementById('asset-editor-grounding');
    const groundRow = document.querySelector('.asset-editor-ground-option');
    const isJackCat = editorDraft.category === 'jack';
    if (groundRow) groundRow.classList.toggle('hidden', isJackCat);
    if (groundToggle) {
      if (isJackCat) {
        editorDraft.needsGrounding = false;
        groundToggle.checked = false;
      } else {
        groundToggle.checked = !!editorDraft.needsGrounding;
      }
    }
    renderStateBar();
    renderSubtypeOptions();
    renderEditorValueFields();
    renderTerminalEditorList();
    renderEditorPreview();
  }

  function saveEditor() {
    if (!editorDraft) return;
    syncEditorFieldsFromDom();
    const name = (editorDraft.name || '').trim();
    if (!name) {
      deps.setStatus('Enter a name for the custom asset');
      return;
    }
    const editingId = editorDraft.editingId;
    const isJack = editorDraft.category === 'jack';
    const needsGrounding = isJack ? false : !!editorDraft.needsGrounding;
    const hasConductorTips = (editorDraft.terminals || []).some((t) => (
      termPartKind(t) === 'conductor' || String(t.className || '').includes('hb-tip')
    ));
    const hasLoom = !!(editorDraft.hasLoom || hasConductorTips);
    const cssParts = new Set(['custom']);
    if (isJack) cssParts.add('mono-output');
    if (hasLoom) cssParts.add('dualcoil');
    String(editorDraft.cssClass || '').split(/\s+/).forEach((c) => {
      if (c && c !== 'custom') cssParts.add(c);
    });
    const saved = {
      ...JSON.parse(JSON.stringify(editorDraft)),
      id: editingId || `custom-${Date.now()}`,
      name,
      placeLabel: (editorDraft.placeLabel || '').trim().slice(0, 8) || 'CU',
      needsGrounding,
      layout: 'absolute',
      cssClass: [...cssParts].join(' '),
      hasLoom,
      builtin: false,
      valueFields: normalizeValueFields(editorDraft.valueFields),
      defaultValues: (() => {
        const allowed = new Set(normalizeValueFields(editorDraft.valueFields));
        const out = {};
        Object.entries(editorDraft.defaultValues || {}).forEach(([k, v]) => {
          const text = String(v ?? '').trim();
          if (allowed.has(k) && text) out[k] = text;
        });
        return out;
      })(),
    };
    if (hasLoom) {
      const j = ensureEditorLoomJunction(editorDraft);
      layoutEditorConductorFan(editorDraft);
      activateEditorConductors(editorDraft);
      saved.terminals = JSON.parse(JSON.stringify(editorDraft.terminals));
      saved.loomJunction = j ? { x: j.x, y: j.y } : null;
      saved.loomColor = editorDraft.loomColor || EDITOR_DEFAULT_LOOM_COLOR;
      saved.hbJunctionLeft = j ? j.x : undefined;
      saved.hbJunctionTop = j ? j.y : undefined;
      saved.states = JSON.parse(JSON.stringify(editorDraft.states));
    } else {
      delete saved.loomJunction;
      delete saved.loomColor;
      delete saved.hbJunctionLeft;
      delete saved.hbJunctionTop;
      delete saved.hasLoom;
    }
    if (isJack) {
      saved.isOutputJack = true;
      saved.needsGrounding = false;
      // Jack G terminals are always ISGROUND
      saved.terminals = (saved.terminals || []).map((term) => {
        const isG = term.role === 'G' || term.label === 'G' || term.tipLabel === 'G'
          || String(term.className || '').includes('ground');
        if (!isG) return term;
        return {
          ...term,
          role: 'G',
          isGround: true,
          className: `${String(term.className || '').replace(/\bis-ground\b/g, '').trim()} ground is-ground`.trim(),
        };
      });
    } else {
      delete saved.isOutputJack;
    }
    delete saved.gridVisible;
    delete saved.previewZoom;
    delete saved.activeStateIndex;
    delete saved.editingId;
    if (!saved.states?.length) {
      saved.states = [{ id: 1, terminalActive: saved.terminals.map(() => false) }];
    }
    // Grounding is asset-level only — strip from any state payloads.
    saved.needsGrounding = needsGrounding;
    saved.states = saved.states.map((state) => {
      const next = { ...state };
      delete next.needsGrounding;
      return next;
    });
    syncStateTerminalFlags(saved);
    normalizeDraft(saved);

    if (editingId) {
      const idx = customTemplates.findIndex((t) => t.id === editingId);
      if (idx === -1) {
        deps.setStatus('Custom asset no longer exists');
        closeEditor();
        return;
      }
      customTemplates[idx] = saved;
      saveCustomTemplates();
      deps.refreshComponentsForTemplate?.(saved.id);
      closeEditor();
      deps.setStatus(`Updated custom asset "${name}"`);
      return;
    }

    customTemplates.push(saved);
    saveCustomTemplates();
    closeEditor();
    deps.setStatus(`Saved custom asset "${name}" — right-click to place`);
  }

  function setupEditor() {
    const editor = editorEl();
    if (!editor) return;

    const header = document.getElementById('asset-editor-header');
    let panelDrag = null;

    header?.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      const rect = editor.getBoundingClientRect();
      panelDrag = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (panelDrag) {
        editor.style.left = `${Math.max(0, e.clientX - panelDrag.x)}px`;
        editor.style.top = `${Math.max(0, e.clientY - panelDrag.y)}px`;
      }
      if (editorDrag && editorDraft) {
        const stage = document.querySelector('#asset-editor-preview .asset-editor-stage');
        if (!stage) return;
        const pt = clientToStagePoint(e.clientX, e.clientY, stage);

        if (editorDrag.type === 'body') {
          const newBodyX = snapEditor(pt.x - editorPreviewLayout.ox - editorDrag.offsetX);
          const newBodyY = snapEditor(pt.y - editorPreviewLayout.oy - editorDrag.offsetY);
          const dx = newBodyX - editorDrag.startBodyX;
          const dy = newBodyY - editorDrag.startBodyY;
          editorDraft.bodyX = newBodyX;
          editorDraft.bodyY = newBodyY;
          editorDraft.terminals.forEach((term, i) => {
            term.x = editorDrag.startTerms[i].x + dx;
            term.y = editorDrag.startTerms[i].y + dy;
          });
          if (editorDrag.startLoom) {
            editorDraft.loomJunction = {
              x: editorDrag.startLoom.x + dx,
              y: editorDrag.startLoom.y + dy,
            };
          }
          updateEditorBodyVisual(stage);
          updateEditorTerminalVisuals(stage);
        } else if (editorDrag.type === 'resize') {
          const deltaX = pt.x - editorDrag.startMx;
          const deltaY = pt.y - editorDrag.startMy;
          applyCenterLockedResize(editorDrag.handle, deltaX, deltaY, editorDrag);
          repositionTerminalsAfterBodyResize(editorDrag.startTerms);
          if (draftHasLoom(editorDraft)) {
            const j = ensureEditorLoomJunction(editorDraft);
            snapEditorLoomToBody(editorDraft, j.x, j.y);
          }
          updateEditorBodyVisual(stage);
          updateEditorTerminalVisuals(stage);
        } else if (editorDrag.type === 'loom') {
          const rawX = stageToDraftX(pt.x) - editorDrag.offsetX;
          const rawY = stageToDraftY(pt.y) - editorDrag.offsetY;
          snapEditorLoomToBody(editorDraft, rawX, rawY);
          updateEditorTerminalVisuals(stage);
          updateEditorWireLines(stage);
        } else if (editorDrag.type === 'terminal') {
          const term = editorDraft.terminals[editorDrag.idx];
          if (termPartKind(term) === 'conductor') return;
          const rawX = stageToDraftX(pt.x) - editorDrag.offsetX;
          const rawY = stageToDraftY(pt.y) - editorDrag.offsetY;
          const snapped = snapTerminalToBody(rawX, rawY, term, editorDraft);
          term.x = snapped.x;
          term.y = snapped.y;
          const box = stage.querySelector(`.asset-editor-terminal[data-idx="${editorDrag.idx}"]`);
          if (box) {
            box.style.left = `${draftToStageX(term.x)}px`;
            box.style.top = `${draftToStageY(term.y)}px`;
          }
          updateEditorWireLines(stage);
        }
      }
    });

    document.addEventListener('mouseup', () => {
      const wasEditorDrag = !!editorDrag;
      document.querySelector('.asset-editor-body.dragging')?.classList.remove('dragging');
      document.querySelector('.asset-editor-body.resizing')?.classList.remove('resizing');
      panelDrag = null;
      editorDrag = null;
      // Re-center the asset in the preview after a move/resize
      if (wasEditorDrag && editorDraft) renderEditorPreview();
    });

    document.getElementById('asset-editor-add-state')?.addEventListener('click', () => {
      if (!editorDraft) return;
      addEditorState();
    });

    document.getElementById('asset-editor-delete-state')?.addEventListener('click', () => {
      if (!editorDraft) return;
      deleteEditorState();
    });

    document.getElementById('asset-editor-grid-toggle')?.addEventListener('click', () => {
      if (!editorDraft) return;
      editorDraft.gridVisible = !editorDraft.gridVisible;
      updateEditorGridToggle();
    });

    document.getElementById('asset-editor-preview')?.addEventListener('wheel', (e) => {
      if (!editorDraft) return;
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const step = e.deltaY > 0 ? -EDITOR_ZOOM_STEP : EDITOR_ZOOM_STEP;
      setEditorZoom(getEditorZoom() + step);
    }, { passive: false });

    document.getElementById('asset-editor-category')?.addEventListener('change', (e) => {
      editorDraft.category = e.target.value;
      if (editorDraft.category === 'jack') editorDraft.needsGrounding = false;
      const opts = SUBTYPES[editorDraft.category] || [];
      editorDraft.subtype = opts[0]?.id || '';
      editorDraft.terminalShape = defaultTerminalShape(editorDraft.category);
      applyPresetLayout(editorDraft);
      editorDraft.valueFields = defaultValueFieldsForSubtype(editorDraft.category, editorDraft.subtype);
      if (editorDraft.category !== 'custom') {
        const keep = new Set(editorDraft.valueFields);
        Object.keys(editorDraft.defaultValues || {}).forEach((k) => {
          if (!keep.has(k)) delete editorDraft.defaultValues[k];
        });
      }
      resetEditorStatesFromTerminals();
      renderEditor();
    });

    document.getElementById('asset-editor-subtype')?.addEventListener('change', (e) => {
      editorDraft.subtype = e.target.value;
      if (editorDraft.category === 'switch' && (editorDraft.subtype === 'dpdt' || editorDraft.subtype === 'dpdt-on-off-on' || editorDraft.subtype === 'dpdt-on-on')) {
        editorDraft.terminalShape = 'rect';
      }
      applyPresetLayout(editorDraft);
      editorDraft.valueFields = defaultValueFieldsForSubtype(editorDraft.category, editorDraft.subtype);
      const keep = new Set(editorDraft.valueFields);
      Object.keys(editorDraft.defaultValues || {}).forEach((k) => {
        if (!keep.has(k)) delete editorDraft.defaultValues[k];
      });
      resetEditorStatesFromTerminals();
      renderEditor();
    });

    document.getElementById('asset-editor-placelabel')?.addEventListener('input', (e) => {
      if (!editorDraft) return;
      editorDraft.placeLabel = e.target.value.slice(0, 8);
      const labelEl = document.querySelector('.asset-editor-body-label');
      if (labelEl) labelEl.textContent = editorDraft.placeLabel || '??';
    });

    document.getElementById('asset-editor-name')?.addEventListener('input', (e) => {
      if (!editorDraft) return;
      editorDraft.name = e.target.value;
    });

    document.getElementById('asset-editor-grounding')?.addEventListener('change', (e) => {
      if (!editorDraft) return;
      editorDraft.needsGrounding = !!e.target.checked;
    });

    document.getElementById('asset-editor-add-terminal')?.addEventListener('click', () => {
      if (!editorDraft) return;
      editorDraft.terminals.push(makeEditorTerminal(editorDraft));
      syncStateTerminalFlags(editorDraft);
      renderEditor();
    });

    document.getElementById('asset-editor-add-lead')?.addEventListener('click', () => {
      if (!editorDraft) return;
      const leadCount = editorDraft.terminals.filter((t) => termPartKind(t) === 'lead').length;
      editorDraft.terminals.push(makeEditorLeadTerminal(editorDraft, leadCount));
      syncStateTerminalFlags(editorDraft);
      renderEditor();
    });

    document.getElementById('asset-editor-add-conductor')?.addEventListener('click', () => {
      if (!editorDraft) return;
      appendFourConductorFan(editorDraft);
      syncStateTerminalFlags(editorDraft);
      renderEditor();
    });

    document.getElementById('asset-editor-add-wire')?.addEventListener('click', () => {
      if (!editorDraft) return;
      editorDraft.terminals.push(makeEditorWireTerminal(editorDraft));
      syncStateTerminalFlags(editorDraft);
      renderEditor();
    });

    // Dialog bottom-right resize
    const panelResize = document.getElementById('asset-editor-resize');
    panelResize?.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const panel = editorEl();
      if (!panel) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = panel.offsetWidth;
      const startH = panel.offsetHeight;
      function onMove(ev) {
        const nextW = Math.max(260, Math.min(window.innerWidth - 24, startW + (ev.clientX - startX)));
        const nextH = Math.max(280, Math.min(window.innerHeight - 24, startH + (ev.clientY - startY)));
        panel.style.width = `${nextW}px`;
        panel.style.height = `${nextH}px`;
      }
      function onUp() {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    document.getElementById('asset-editor-save')?.addEventListener('click', saveEditor);
    document.getElementById('asset-editor-cancel')?.addEventListener('click', () => {
      closeEditor();
      deps.setStatus('Custom asset cancelled');
    });
  }

  function setupContextMenu() {
    document.getElementById('context-menu-add')?.addEventListener('click', () => {
      const addBtn = document.getElementById('context-menu-add');
      if (addBtn?.dataset.mode === 'import' || deps.getActiveWorkspacePage?.() === 'panel') {
        hideContextMenu();
        deps.openCadImportDialog?.();
        return;
      }
      openEditor();
    });
    document.getElementById('context-menu-power')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (deps.getActiveWorkspacePage?.() === 'panel') {
        deps.togglePanelSnapMode?.();
        const powerBtn = document.getElementById('context-menu-power');
        powerBtn?.classList.toggle('panel-snap-active', !!deps.getPanelSnapMode?.());
        powerBtn?.classList.remove('active');
        return;
      }
      deps.toggleLightningMode?.();
      syncContextMenuPowerButton();
    });
    document.getElementById('context-menu-ground')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (deps.getActiveWorkspacePage?.() === 'panel') {
        // Decorative only on panel — no grounding check.
        return;
      }
      deps.toggleGroundCheckMode?.();
      syncContextMenuGroundButton();
    });
    document.getElementById('context-menu-wire-focus')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (deps.getActiveWorkspacePage?.() === 'panel') return;
      deps.toggleWireEditFocusMode?.();
      syncContextMenuWireFocusButton();
    });
    document.getElementById('context-menu-short-check')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (deps.getActiveWorkspacePage?.() === 'panel') return;
      deps.toggleShortCheckMode?.();
      syncContextMenuShortCheckButton();
    });
    document.addEventListener('click', (e) => {
      if (e.target.closest('#asset-delete-confirm')) return;
      if (!e.target.closest('#asset-context-menu')) hideContextMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!deleteConfirmEl()?.classList.contains('hidden')) {
          hideDeleteConfirm();
          return;
        }
        hideContextMenu();
        if (!editorEl()?.classList.contains('hidden')) {
          closeEditor();
        }
      }
    });
  }

  /** For switch states with bridges: terminal is active if it participates in any closed contact. */
  function terminalActiveForState(state, idx) {
    const bridges = state?.bridges;
    if (bridges?.length) {
      return bridges.some((pair) => pair[0] === idx || pair[1] === idx);
    }
    return !!state?.terminalActive?.[idx];
  }

  function applyComponentStateVisuals(el, template, stateIndex) {
    const states = getEffectiveStates(el);
    const state = states[stateIndex];
    if (!state || !template) return;
    const termEls = el.querySelectorAll('.terminal');
    // Keep stored terminalActive in sync with bridges for switch-like states
    if (state.bridges?.length && state.terminalActive) {
      for (let i = 0; i < state.terminalActive.length; i++) {
        state.terminalActive[i] = terminalActiveForState(state, i);
      }
    }
    template.terminals.forEach((spec, idx) => {
      const term = termEls[idx];
      if (!term) return;
      if (spec.isGround || term.dataset.isGround === 'true' || term.dataset.tag === 'ISGROUND') {
        if (term.classList.contains('hb-tip')) {
          const active = terminalActiveForState(state, idx);
          term.classList.toggle('state-active', active);
          term.classList.remove('keep-base-color');
          return;
        }
        term.style.background = '#ffffff';
        term.style.color = '#111';
        term.classList.remove('state-active', 'keep-base-color');
        return;
      }
      if (term.classList.contains('hb-tip') || term.classList.contains('cap-term') || term.classList.contains('wire-term')) {
        const active = terminalActiveForState(state, idx);
        term.classList.toggle('state-active', active);
        if (spec.keepColorWhenActive) term.classList.add('keep-base-color');
        else term.classList.remove('keep-base-color');
        const float = term.querySelector('.wire-float-label')
          || el.querySelector(`.asset-wire-float-label[data-aw-label="${[...el.querySelectorAll('.terminal.wire-term')].indexOf(term)}"]`);
        if (float) float.classList.toggle('is-active', active);
        return;
      }
      const baseColor = term.dataset.baseColor || spec.color || '';
      const active = terminalActiveForState(state, idx);
      if (active) {
        if (spec.keepColorWhenActive) {
          term.style.background = baseColor;
          term.style.color = spec.textColor || '#111';
          term.classList.add('state-active', 'keep-base-color');
        } else {
          term.style.background = ACTIVE_TERM_COLOR;
          term.style.color = '#fff';
          term.classList.add('state-active');
          term.classList.remove('keep-base-color');
        }
      } else {
        term.style.background = baseColor;
        term.style.color = spec.textColor || '#111';
        term.classList.remove('state-active', 'keep-base-color');
      }
    });
    el.dataset.assetStateIndex = String(stateIndex);
    el.dataset.assetStateId = String(state.id);
    updateComponentStateLabel(el);
    deps.refreshLightningWireGlow?.();
    deps.refreshShortCircuitCheck?.();
    deps.refreshGroundCheckAlert?.();
  }

  function updateComponentStateLabel(el) {
    const label = el.querySelector('.component-state-label');
    if (!label) return;
    const template = getTemplate(el.dataset.assetId);
    const states = getEffectiveStates(el);
    if (!template || !states.length || template.hideStateLabel) {
      label.hidden = true;
      return;
    }
    const state = states[getComponentStateIndex(el)];
    const primary = state?.label != null ? String(state.label) : `State ${state?.id ?? ''}`;
    const secondary = String(state?.secondaryLabel || '').trim();

    label.replaceChildren();
    label.classList.toggle('has-secondary', !!secondary);
    if (secondary) {
      const sec = document.createElement('span');
      sec.className = 'component-state-label-secondary';
      sec.textContent = secondary;
      const pri = document.createElement('span');
      pri.className = 'component-state-label-primary';
      pri.textContent = primary;
      label.appendChild(sec);
      label.appendChild(pri);
    } else {
      const pri = document.createElement('span');
      pri.className = 'component-state-label-primary is-solo';
      pri.textContent = primary;
      label.appendChild(pri);
    }
    label.hidden = false;
    const rot = ((parseFloat(el.dataset.rotation) || 0) % 360 + 360) % 360;
    label.style.transformOrigin = '50% 100%';
    label.style.transform = `translateX(-50%) rotate(${-rot}deg)`;
  }

  function getComponentStateIndex(el) {
    return parseInt(el.dataset.assetStateIndex || '0', 10) || 0;
  }

  function setComponentStateIndex(el, stateIndex) {
    const template = getTemplate(el.dataset.assetId);
    const states = getEffectiveStates(el);
    if (!template || !states.length) return false;
    const count = states.length;
    const idx = ((stateIndex % count) + count) % count;
    applyComponentStateVisuals(el, template, idx);
    return true;
  }

  function cycleComponentState(el, direction) {
    const states = getEffectiveStates(el);
    if (states.length <= 1) return false;
    return setComponentStateIndex(el, getComponentStateIndex(el) + direction);
  }

  function hasAssetStates(el) {
    return getEffectiveStates(el).length > 1;
  }

  function getComponentStateLabel(el) {
    const states = getEffectiveStates(el);
    if (!states.length) return null;
    const idx = getComponentStateIndex(el);
    const state = states[idx];
    if (!state) return null;
    const primary = state.label != null ? state.label : state.id;
    const secondary = String(state.secondaryLabel || '').trim();
    return secondary ? `${secondary} · ${primary}` : primary;
  }

  function getAbsoluteBounds(template) {
    let minX = template.bodyX || 0;
    let minY = template.bodyY || 0;
    let maxX = minX + (template.bodyW || 70);
    let maxY = minY + (template.bodyH || 48);
    template.terminals.forEach((spec) => {
      const { w: termW, h: termH } = getSpecTermSize(spec, template);
      if (spec.x != null) {
        minX = Math.min(minX, spec.x);
        maxX = Math.max(maxX, spec.x + termW);
      }
      if (spec.y != null) {
        minY = Math.min(minY, spec.y);
        maxY = Math.max(maxY, spec.y + termH);
      }
    });
    const jx = template.loomJunction?.x ?? parseFloat(template.hbJunctionLeft);
    const jy = template.loomJunction?.y ?? parseFloat(template.hbJunctionTop);
    if (Number.isFinite(jx) && Number.isFinite(jy)) {
      minX = Math.min(minX, jx - 4);
      maxX = Math.max(maxX, jx + 4);
      minY = Math.min(minY, jy - 4);
      maxY = Math.max(maxY, jy + 4);
    }
    return { minX, minY, maxX, maxY };
  }

  function buildComponentDOM(template, id) {
    const el = document.createElement('div');
    el.className = `component ${template.cssClass || 'custom'}`;
    el.dataset.id = id;
    el.dataset.type = template.id;
    el.dataset.assetId = template.id;
    el.dataset.groundTag = 'NOGROUND';
    if (template.isOutputJack) {
      el.dataset.groundFlash = 'true';
    }

    const groundMarker = document.createElement('span');
    groundMarker.className = 'asset-ground-tag';
    groundMarker.hidden = true;
    groundMarker.setAttribute('aria-hidden', 'true');
    groundMarker.dataset.tag = 'NOGROUND';
    groundMarker.textContent = 'NOGROUND';
    el.appendChild(groundMarker);

    const bounds = template.layout === 'absolute' ? getAbsoluteBounds(template) : null;
    const originX = bounds?.minX || 0;
    const originY = bounds?.minY || 0;

    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.setAttribute('aria-label', template.name);
    placeholder.textContent = template.placeLabel != null ? template.placeLabel : '??';
    if (template.bodyW) placeholder.style.width = `${template.bodyW}px`;
    if (template.bodyH) placeholder.style.height = `${template.bodyH}px`;
    if (template.layout === 'absolute') {
      placeholder.style.position = 'absolute';
      placeholder.style.left = `${(template.bodyX || 0) - originX}px`;
      placeholder.style.top = `${(template.bodyY || 0) - originY}px`;
    }
    if (template.cssClass === 'singlecoil' || String(template.cssClass || '').split(/\s+/).includes('singlecoil')) {
      placeholder.style.backgroundImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='48' viewBox='0 0 70 48'%3E%3Cellipse cx='35' cy='24' rx='27' ry='16' fill='none' stroke='%23888' stroke-width='2'/%3E%3Cellipse cx='35' cy='24' rx='17' ry='10' fill='none' stroke='%23666' stroke-width='1'/%3E%3Ccircle cx='35' cy='24' r='4' fill='%23555'/%3E%3C/svg%3E\")";
      placeholder.style.backgroundRepeat = 'no-repeat';
      placeholder.style.backgroundPosition = 'center';
    }
    if (String(template.cssClass || '').split(/\s+/).includes('dualcoil')) {
      placeholder.style.backgroundImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='48' viewBox='0 0 120 48'%3E%3Cellipse cx='38' cy='24' rx='22' ry='14' fill='none' stroke='%23888' stroke-width='2'/%3E%3Cellipse cx='38' cy='24' rx='12' ry='8' fill='none' stroke='%23666' stroke-width='1'/%3E%3Ccircle cx='38' cy='24' r='3' fill='%23555'/%3E%3Cellipse cx='82' cy='24' rx='22' ry='14' fill='none' stroke='%23888' stroke-width='2'/%3E%3Cellipse cx='82' cy='24' rx='12' ry='8' fill='none' stroke='%23666' stroke-width='1'/%3E%3Ccircle cx='82' cy='24' r='3' fill='%23555'/%3E%3C/svg%3E\")";
      placeholder.style.backgroundRepeat = 'no-repeat';
      placeholder.style.backgroundPosition = 'center';
    }
    if (template.hasLoom) el.dataset.hasLoom = 'true';
    if (Number.isFinite(parseFloat(template.hbJunctionLeft)) || template.loomJunction) {
      const jx = template.loomJunction?.x ?? parseFloat(template.hbJunctionLeft);
      const jy = template.loomJunction?.y ?? parseFloat(template.hbJunctionTop);
      if (Number.isFinite(jx) && Number.isFinite(jy)) {
        el.dataset.hbJunctionLeft = String(jx - originX);
        el.dataset.hbJunctionTop = String(jy - originY);
      }
    }
    if (template.loomColor) el.dataset.loomColor = template.loomColor;

    const terminals = document.createElement('div');
    terminals.className = 'terminals';
    if (template.layout === 'grid-3x2') {
      terminals.classList.add('grid-3x2');
    } else if (template.layout === 'absolute') {
      terminals.classList.add('custom-layout');
    } else {
      terminals.classList.add('row-layout');
    }

    template.terminals.forEach((spec, idx) => {
      const term = deps.createTerminal(spec.label, {
        color: spec.color,
        className: spec.className,
      });
      term.dataset.baseColor = spec.color || '';
      term.dataset.terminalIndex = String(idx);
      const role = spec.role
        || (spec.isGround ? 'G' : null)
        || (spec.label === 'H' ? 'H' : null)
        || (spec.label === 'R' ? 'R' : null)
        || (spec.label === 'G' ? 'G' : null)
        || (spec.label === '+' ? 'P+' : null)
        || (spec.label === '−' || spec.label === '-' ? 'P-' : null);
      if (role) term.dataset.role = role;
      if (spec.title) term.title = spec.title;
      if (spec.textColor) term.style.color = spec.textColor;
      if (spec.wireColor) {
        term.dataset.wireColor = spec.wireColor;
        term.style.setProperty('--hb-wire-color', spec.wireColor);
      }
      if (spec.tipLabel) {
        term.dataset.tipLabel = spec.tipLabel;
        term.dataset.terminalLabel = spec.tipLabel;
      }
      const isJackAsset = template.category === 'jack' || !!template.isOutputJack;
      const jackG = isJackAsset && (
        role === 'G'
        || spec.label === 'G'
        || spec.tipLabel === 'G'
        || spec.className?.includes('ground')
      );
      if (spec.isGround || jackG) {
        term.dataset.isGround = 'true';
        term.dataset.tag = 'ISGROUND';
        term.classList.add('is-ground', 'ground');
        if (!term.dataset.role) term.dataset.role = 'G';
        if (!term.classList.contains('hb-tip') && !term.classList.contains('cap-term')) {
          term.dataset.baseColor = '#ffffff';
          term.style.background = '#ffffff';
          term.style.color = '#111';
        }
        if (!term.querySelector('.terminal-ground-tag')) {
          const groundTag = document.createElement('span');
          groundTag.className = 'terminal-ground-tag';
          groundTag.hidden = true;
          groundTag.setAttribute('aria-hidden', 'true');
          groundTag.dataset.tag = 'ISGROUND';
          groundTag.textContent = 'ISGROUND';
          term.appendChild(groundTag);
        }
      } else if (role === 'G' || spec.className?.includes('ground')) {
        if (!term.classList.contains('hb-tip') && !term.classList.contains('cap-term')) {
          term.dataset.baseColor = '#ffffff';
          term.style.background = '#ffffff';
          term.style.color = '#111';
        }
      }
      if (template.layout === 'absolute' && spec.x != null) {
        const { w: termW, h: termH } = getSpecTermSize(spec, template);
        term.style.position = 'absolute';
        term.style.left = `${spec.x - originX}px`;
        term.style.top = `${spec.y - originY}px`;
        term.style.width = `${termW}px`;
        term.style.height = `${termH}px`;
      }
      // Wire ends: tip hit-target + coloured float label (same language as 4-conductor)
      if (term.classList.contains('wire-term') || spec.partKind === 'wire') {
        const text = spec.tipLabel || spec.label || 'W';
        const color = spec.wireColor || spec.color || '#c9a227';
        term.textContent = '';
        term.style.background = 'transparent';
        term.style.color = 'transparent';
        term.style.border = 'none';
        term.dataset.terminalLabel = text;
        term.dataset.tipLabel = text;
        if (!term.dataset.wireColor) {
          term.dataset.wireColor = color;
          term.style.setProperty('--hb-wire-color', color);
        }
        term.style.width = `${spec.w || 10}px`;
        term.style.height = `${spec.h || 10}px`;
        const float = document.createElement('span');
        float.className = 'hb-float-label wire-float-label';
        float.setAttribute('aria-hidden', 'true');
        float.textContent = text;
        float.style.setProperty('--hb-wire-color', color);
        float.style.color = text === 'H' ? '#eeeeee' : color;
        float.classList.toggle('is-h', text === 'H');
        float.classList.toggle('is-g', text === 'G');
        term.appendChild(float);
      }
      terminals.appendChild(term);
    });

    if (template.layout === 'absolute' && bounds) {
      el.classList.add('custom-absolute');
      el.style.width = `${bounds.maxX - bounds.minX}px`;
      el.style.height = `${bounds.maxY - bounds.minY}px`;
      terminals.style.position = 'absolute';
      terminals.style.left = '0';
      terminals.style.top = '0';
      terminals.style.width = '100%';
      terminals.style.height = '100%';
      terminals.style.marginTop = '0';
    }

    if (template.states?.length && !template.hideStateLabel) {
      const stateLabel = document.createElement('div');
      stateLabel.className = 'component-state-label';
      stateLabel.hidden = true;
      el.appendChild(stateLabel);
    }

    el.appendChild(placeholder);
    el.appendChild(terminals);
    return el;
  }

  function createComponent(template, x, y) {
    const id = deps.nextComponentId();
    const el = buildComponentDOM(template, id);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    if (template.states?.length) {
      applyComponentStateVisuals(el, template, 0);
    }
    if (deps.applyComponentGroundTag) {
      const isJack = template.category === 'jack' || !!template.isOutputJack;
      deps.applyComponentGroundTag(el, isJack ? false : !!template.needsGrounding);
    }
    if (template.defaultValues && deps.applyComponentElectricalValues) {
      deps.applyComponentElectricalValues(el, template.defaultValues, { notify: false });
    }
    deps.setupComponentInteraction(el);
    deps.canvas.appendChild(el);
    deps.components.set(id, el);
    deps.selectComponent(el);
    return el;
  }

  function getPlacementOffset(template) {
    if (template.layout === 'absolute') {
      const { minX, minY, maxX, maxY } = getAbsoluteBounds(template);
      return { offsetX: (minX + maxX) / 2, offsetY: (minY + maxY) / 2 };
    }
    const w = template.bodyW || 72;
    const h = template.bodyH || 48;
    let termH = 24;
    if (template.layout === 'grid-3x2') {
      termH = 54;
    }
    return { offsetX: w / 2, offsetY: h / 2 + termH / 2 };
  }

  function init(dependencies) {
    deps = dependencies;
    loadCustomTemplates();
    setupDeleteConfirm();
    setupContextMenu();
    setupEditor();
  }

  global.GuitarAssets = {
    init,
    getAllTemplates,
    getTemplate,
    ELECTRICAL_VALUE_DEFS,
    defaultValueFieldsForSubtype,
    normalizeValueFields,
    resolveValueFieldDefs,
    createComponent,
    buildComponentDOM,
    getPlacementOffset,
    showContextMenu,
    hideContextMenu,
    cycleComponentState,
    hasAssetStates,
    getComponentStateIndex,
    setComponentStateIndex,
    getComponentStateLabel,
    updateComponentStateLabel,
    applyComponentStateVisuals,
    collectActiveCanvasTerminals,
    getEffectiveStates,
    formatAssetMenuLabel,
    ensureInstanceStates,
    setInstanceStates,
    addInstanceState,
    removeInstanceState,
    setInstanceTerminalActive,
    setInstanceStateSecondaryLabel,
  };
})(window);
