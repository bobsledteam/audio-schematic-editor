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
  const STORAGE_KEY = 'endo-asd-custom-assets';
  const STORAGE_KEY_LEGACY = 'guitar-custom-assets';
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
    { id: 'custom', label: 'User' },
  ];

  const CATEGORIES = [
    { id: 'pickup', label: 'Pickups' },
    { id: 'switch', label: 'Switches' },
    { id: 'jack', label: 'Jacks' },
    { id: 'power', label: 'Power' },
    { id: 'component', label: 'Components' },
    /* Wire / 4-conductor: data + editor only — not in the place menu */
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
        id: '1way',
        label: '1-Way Toggle',
        match: (t) => t?.typeGroup === '1way'
          || t?.subtype === 'spst-on-off'
          || t?.switchThrow === 'on-off',
      },
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
    component: [
      {
        id: 'potentiometer',
        label: 'Potentiometer',
        match: (t) => t?.potFamily === 'potentiometer'
          || t?.subtype === 'potentiometer'
          || t?.subtype === 'push-pot-on-on'
          || !!t?.pushPull,
        children: [
          {
            // Place Standard pot as a direct row under Potentiometer (no extra flyout)
            id: 'pot-standard',
            direct: true,
            match: (t) => (t?.subtype === 'potentiometer' || t?.id === 'potentiometer') && !t?.pushPull,
          },
          {
            id: 'pot-special',
            label: 'Special',
            match: (t) => !!t?.pushPull || t?.subtype === 'push-pot-on-on',
          },
        ],
      },
    ],
  };

  const SUBTYPES = {
    custom: [],
    pickup: [
      { id: 'singlecoil', label: 'Single Coil' },
      { id: 'dualcoil', label: 'Dual Coil' },
      { id: '4conductor', label: '4 Conductor HB' },
    ],
    switch: [
      { id: 'spst-on-off', label: 'ON-OFF' },
      { id: 'dpdt-on-on', label: 'ON-ON' },
      { id: 'dpdt', label: 'ON-ON-ON' },
      { id: 'dpdt-on-off-on', label: 'ON-OFF-ON' },
      { id: 'footswitch', label: 'Footswitch' },
    ],
    jack: [
      { id: 'monooutput', label: 'Mono Output' },
      { id: 'stereooutput', label: 'Stereo Output' },
    ],
    power: [
      { id: 'ninevolt', label: 'Power Supply' },
      { id: 'dc-jack', label: 'DC Jack' },
      { id: 'heater-supply', label: 'Heater Supply' },
      { id: 'hv-supply', label: 'B+ / HV Supply' },
      { id: 'dual-rail', label: 'Dual-Rail Supply' },
      { id: 'power-transformer', label: 'Power Transformer' },
    ],
    component: [
      { id: 'potentiometer', label: 'Standard Pot' },
      { id: 'push-pot-on-on', label: 'Push/Pull ON-ON' },
      { id: 'capacitor', label: 'Capacitor' },
      { id: 'resistor', label: 'Resistor' },
      { id: 'diode', label: 'Diode' },
      { id: 'led-indicator', label: 'LED' },
      { id: 'inductor', label: 'Inductor / Choke' },
      { id: 'audio-transformer', label: 'Audio Transformer' },
      { id: 'relay', label: 'Relay' },
      { id: 'transistor', label: 'Transistor' },
      { id: 'opamp', label: 'Op Amp' },
      { id: 'vacuum-tube', label: 'Vacuum Tube' },
    ],
    wire: [],
  };

  /** Electronics grid unit (px) — matches app WORKSPACE_GRID. */
  const UNIT = 10;

  /**
   * Browser tooltip: "Full name (Symbol)".
   * Used for every asset terminal so hover text stays consistent.
   */
  function switchTerminalSpec(index) {
    const n = index + 1;
    return {
      label: `T${n}`,
      role: `T${n}`,
      color: '#c9a227',
      className: 'switch-term',
      termName: `Terminal ${n}`,
      symbol: `T${n}`,
      title: `Terminal ${n} (T${n})`,
    };
  }

  /** Chassis / frame ground lug (IEEE 315 §3.9.2) — not part of the throw matrix. */
  function switchCaseGroundSpec() {
    return {
      label: 'G',
      role: 'G',
      color: '#ffffff',
      className: 'ground switch-case-ground is-ground',
      termName: 'Chassis / case ground',
      symbol: 'G',
      title: 'Chassis / case ground (G)',
      isGround: true,
      signalMark: 'chassis',
    };
  }

  function switchTerminalsWithCaseGround(count = 6) {
    return [
      ...Array.from({ length: count }, (_, i) => switchTerminalSpec(i)),
      switchCaseGroundSpec(),
    ];
  }

  function formatTerminalTitle(fullName, symbol) {
    const name = String(fullName || '').trim();
    const sym = String(symbol || '').trim();
    if (name && sym) {
      const wrapped = `(${sym})`;
      if (name.endsWith(wrapped) || name.includes(` ${wrapped}`)) return name;
      return `${name} (${sym})`;
    }
    return name || sym || 'Terminal';
  }

  /**
   * Secondary polarity / earth glyph under the primary terminal letter.
   * Returns 'plus' | 'minus' | 'ground' | null.
   * Skip when the primary label already is +/−, or for tip/pin UIs that use float labels.
   */
  function resolveTerminalSignalMark(spec, ctx = {}) {
    if (!spec) return null;
    const explicit = spec.signalMark;
    if (explicit === false || explicit === 'none' || explicit === null) return null;
    if (explicit === '+' || explicit === 'plus') return 'plus';
    if (explicit === '-' || explicit === '−' || explicit === 'minus') return 'minus';
    if (explicit === 'G' || explicit === 'ground' || explicit === 'earth') return 'ground';
    if (explicit === 'chassis' || explicit === 'frame') return 'chassis';

    const className = String(spec.className || '');
    // Tip / pin / lead UIs render marks on float labels (or skip)
    if (
      className.includes('hb-tip')
      || className.includes('opamp-pin')
      || className.includes('tube-pin')
      || className.includes('cap-term')
      || className.includes('wire-term')
    ) {
      return null;
    }

    const role = String(spec.role || '').trim();
    const label = String(spec.label || spec.symbol || '').trim();
    // Primary glyph already carries polarity
    if (label === '+' || label === '−' || label === '-') return null;

    const identity = resolveTerminalIdentity(spec, ctx);
    const name = String(identity?.name || spec.termName || '');

    // Enclosure / case lugs → chassis mark (not earth bars)
    if (
      className.includes('pot-case-ground')
      || className.includes('switch-case-ground')
      || /\bchassis\b|\bcase ground\b/i.test(name)
    ) {
      return 'chassis';
    }

    if (
      spec.isGround
      || role === 'G'
      || className.includes('is-ground')
      || (/\bground\b/i.test(className) && role !== 'H')
    ) {
      return 'ground';
    }
    if (role === 'P+' || role === 'V+' || role === 'B+' || role === 'IN+') return 'plus';
    if (role === 'P-' || role === 'V-' || role === 'IN-') return 'minus';
    if (role === 'A') return 'plus';
    if (role === 'K') return 'minus';
    // Hot / tip (not tube heater)
    if (role === 'H' && !/heater/i.test(name)) return 'plus';

    return null;
  }

  /** Compact IEEE-style earth mark (three bars) for lug boxes / float labels. */
  function buildTerminalEarthIconHtml() {
    return (
      '<svg class="terminal-earth-icon" width="7" height="5" viewBox="0 0 10 8" aria-hidden="true" focusable="false">'
      + '<path d="M5 0v2.2M1.2 2.2h7.6M2.4 4.3h5.2M3.5 6.4h3" fill="none" '
      + 'stroke="currentColor" stroke-width="1.2" stroke-linecap="square"/>'
      + '</svg>'
    );
  }

  /** Compact IEEE 315 §3.9.2 chassis / frame ground mark for case lugs. */
  function buildTerminalChassisIconHtml() {
    return (
      '<svg class="terminal-chassis-icon" width="8" height="6" viewBox="0 0 12 9" aria-hidden="true" focusable="false">'
      + '<path d="M1 1.5h10M2.2 1.5l-1.2 5.5M6 1.5l-1 5.5M9.8 1.5l-1.2 5.5" fill="none" '
      + 'stroke="currentColor" stroke-width="1.15" stroke-linecap="square"/>'
      + '</svg>'
    );
  }

  /** Paint primary letter + optional +/−/earth/chassis under it on a box terminal. */
  function applyTerminalSignalMarkDom(term, mark, primaryText) {
    if (!term || !mark) return;
    const text = String(primaryText ?? term.dataset.terminalLabel ?? term.dataset.termSymbol ?? '').trim();
    const keep = [...term.children].filter((ch) => (
      ch.classList?.contains('terminal-ground-tag')
      || ch.classList?.contains('wire-count')
      || ch.classList?.contains('opamp-hover-label')
    ));
    term.replaceChildren();
    const primary = document.createElement('span');
    primary.className = 'terminal-primary-label';
    primary.textContent = text;
    term.appendChild(primary);
    const markEl = document.createElement('span');
    markEl.className = `terminal-signal-mark is-${mark}`;
    markEl.setAttribute('aria-hidden', 'true');
    if (mark === 'plus') markEl.textContent = '+';
    else if (mark === 'minus') markEl.textContent = '−';
    else if (mark === 'chassis') markEl.innerHTML = buildTerminalChassisIconHtml();
    else if (mark === 'ground') markEl.innerHTML = buildTerminalEarthIconHtml();
    term.appendChild(markEl);
    keep.forEach((ch) => term.appendChild(ch));
    term.classList.add('has-signal-mark');
    term.dataset.signalMark = mark;
  }

  /** Fill a float label (HB / asset-wire) with letter + optional polarity mark. */
  function fillFloatLabelWithSignalMark(labelEl, text) {
    if (!labelEl) return;
    const t = String(text || '').trim();
    labelEl.replaceChildren();
    const primary = document.createElement('span');
    primary.className = 'hb-float-primary';
    primary.textContent = t;
    labelEl.appendChild(primary);
    let mark = null;
    if (t === 'H') mark = 'plus';
    else if (t === 'G') mark = 'ground';
    if (mark) {
      const markEl = document.createElement('span');
      markEl.className = `hb-float-signal-mark is-${mark}`;
      markEl.setAttribute('aria-hidden', 'true');
      if (mark === 'plus') markEl.textContent = '+';
      else markEl.innerHTML = buildTerminalEarthIconHtml();
      labelEl.appendChild(markEl);
      labelEl.classList.add('has-signal-mark');
    } else {
      labelEl.classList.remove('has-signal-mark');
    }
  }

  /** Canonical full names keyed by role / symbol. Context overrides apply in resolveTerminalIdentity. */
  const TERMINAL_IDENTITY = {
    H: { name: 'Hot', symbol: 'H' },
    G: { name: 'Ground', symbol: 'G' },
    N: { name: 'North coil', symbol: 'N' },
    R: { name: 'Red', symbol: 'R' },
    S: { name: 'South coil', symbol: 'S' },
    A: { name: 'Anode', symbol: 'A' },
    K: { name: 'Cathode', symbol: 'K' },
    E: { name: 'Emitter', symbol: 'E' },
    B: { name: 'Base', symbol: 'B' },
    C: { name: 'Collector', symbol: 'C' },
    '1': { name: 'Lug 1', symbol: '1' },
    '2': { name: 'Wiper', symbol: '2' },
    '3': { name: 'Lug 3', symbol: '3' },
    'P+': { name: 'Positive', symbol: '+' },
    'P-': { name: 'Negative', symbol: '−' },
    '+': { name: 'Positive', symbol: '+' },
    '−': { name: 'Negative', symbol: '−' },
    '-': { name: 'Negative', symbol: '−' },
    'IN-': { name: 'Inverting input', symbol: '−' },
    'IN+': { name: 'Non-inverting input', symbol: '+' },
    OUT: { name: 'Output', symbol: 'Out' },
    'V+': { name: 'Positive supply', symbol: 'V+' },
    'V-': { name: 'Negative supply', symbol: 'V−' },
    P: { name: 'Plate', symbol: 'P' },
    P1: { name: 'Plate A', symbol: 'P1' },
    P2: { name: 'Plate B', symbol: 'P2' },
    G1: { name: 'Control grid', symbol: 'G1' },
    G2: { name: 'Screen grid', symbol: 'G2' },
    G3: { name: 'Suppressor grid', symbol: 'G3' },
    K1: { name: 'Cathode A', symbol: 'K1' },
    K2: { name: 'Cathode B', symbol: 'K2' },
    CT: { name: 'Heater center tap', symbol: 'CT' },
    NC: { name: 'No connection', symbol: 'NC' },
    W: { name: 'Wire', symbol: 'W' },
  };

  function switchTerminalIdentity(label) {
    const m = /^T(\d+)$/i.exec(String(label || '').trim());
    if (!m) return null;
    return { name: `Terminal ${m[1]}`, symbol: `T${m[1]}` };
  }

  /**
   * Resolve full name + symbol for a terminal spec (template / editor).
   * Prefer explicit spec.termName / spec.symbol; else role/label + asset context.
   */
  function resolveTerminalIdentity(spec, ctx = {}) {
    const template = ctx.template || null;
    const subtype = template?.subtype || ctx.subtype || '';
    const category = template?.category || ctx.category || '';
    const className = String(spec?.className || '');
    const role = String(spec?.role || '').trim();
    const tip = String(spec?.tipLabel || '').trim();
    const hover = String(spec?.hoverLabel || '').trim();
    const label = String(spec?.label || '').trim();
    const symbol = String(spec?.symbol || tip || hover || label || role || '').trim();
    const isTube = !!(className.includes('tube-pin') || template?.tubeFamily
      || subtype === 'vacuum-tube' || subtype === 'tube-generic'
      || subtype === 'tube-12ax7' || subtype === 'tube-6v6');
    const isJack = category === 'jack' || !!template?.isOutputJack;

    if (spec?.termName) {
      return {
        name: String(spec.termName).trim(),
        symbol: symbol || label || role,
      };
    }

    // Custom / numbered tube pins: label "1"…"9" (not P1 plate codes)
    if (/^\d+$/.test(label)) {
      return { name: `Pin ${label}`, symbol: label };
    }

    const sw = switchTerminalIdentity(label || role);
    if (sw) return sw;

    if (subtype === 'capacitor' && (role === 'C' || className.includes('cap-term'))) {
      return { name: 'Capacitor lead', symbol: 'C' };
    }
    if (subtype === 'resistor' && (role === 'C' || className.includes('cap-term'))) {
      return { name: 'Resistor lead', symbol: '·' };
    }
    if (subtype === 'transistor' && role === 'C') {
      return { name: 'Collector', symbol: 'C' };
    }
    if (isJack && (role === 'G' || label === 'G')) {
      return { name: 'Sleeve', symbol: 'G' };
    }
    if (isJack && (role === 'H' || label === 'H')) {
      return { name: 'Tip', symbol: 'H' };
    }
    if ((subtype === 'stereooutput' || className.includes('ring')) && (role === 'R' || label === 'R')) {
      return { name: 'Ring', symbol: 'R' };
    }
    if (className.includes('pot-case-ground') && (role === 'G' || label === 'G')) {
      return { name: 'Chassis / case ground', symbol: 'G' };
    }
    if (className.includes('switch-case-ground') && (role === 'G' || label === 'G')) {
      return { name: 'Chassis / case ground', symbol: 'G' };
    }
    if (isTube) {
      if (role === 'H' || label === 'H') return { name: 'Heater', symbol: 'H' };
      if (role === 'G' || label === 'G') return { name: 'Grid', symbol: 'G' };
      if (role === 'NC' || label === '—' || label === '-' || label === 'NC' || symbol === '—') {
        return { name: 'No connection', symbol: 'NC' };
      }
    }
    if (className.includes('hb-tip') && (role === 'R' || tip === 'R' || label === 'R')) {
      return { name: 'Red', symbol: 'R' };
    }

    const key = role || symbol || label;
    const known = TERMINAL_IDENTITY[key] || TERMINAL_IDENTITY[symbol] || TERMINAL_IDENTITY[label];
    if (known) {
      return {
        name: known.name,
        symbol: known.symbol || symbol || key,
      };
    }
    if (label === '—') return { name: 'No connection', symbol: 'NC' };
    return {
      name: label || role || 'Terminal',
      symbol: symbol || label || role || '?',
    };
  }

  function terminalTooltipForSpec(spec, ctx = {}) {
    const id = resolveTerminalIdentity(spec, ctx);
    // If author already supplied "Name (Sym)" keep it; else build from identity.
    const raw = String(spec?.title || '').trim();
    if (raw && /\([^)]+\)\s*$/.test(raw) && !/^Pin\s+\d+\s/i.test(raw)) {
      return raw;
    }
    return formatTerminalTitle(id.name, id.symbol);
  }

  /**
   * ── Circuit engine (`CalcEngines.CIRCUIT`) ──────────────────────────────
   * Canonical electrical quantities for schematics + config (extend here for new values).
   */
  const ELECTRICAL_VALUE_DEFS = {
    coilWinds: {
      key: 'coilWinds',
      symbol: 'N',
      unit: '',
      dataset: 'bobbinCoilTurnsTotal',
      label: 'Total coil winds',
      placeholder: 'e.g. 8000',
      /** EM-owned; shown with Z/L but not stored as circuit electricalValues. */
      electromagnetOnly: true,
    },
    impedance: {
      key: 'impedance',
      symbol: 'Z',
      unit: 'Ω',
      dataset: 'impedance',
      label: 'Impedance (Z)',
      placeholder: 'e.g. 7500 or 7.5',
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
      placeholder: 'e.g. 250000',
    },
    capacitance: {
      key: 'capacitance',
      symbol: 'C',
      unit: 'µF',
      dataset: 'capacitance',
      label: 'Capacitance (µF)',
      placeholder: 'e.g. 0.022',
    },
    forwardVoltage: {
      key: 'forwardVoltage',
      symbol: 'Vf',
      unit: 'V',
      dataset: 'forwardVoltage',
      label: 'Forward voltage (Vf)',
      placeholder: 'e.g. 0.7',
    },
    reverseVoltage: {
      key: 'reverseVoltage',
      symbol: 'Vr',
      unit: 'V',
      dataset: 'reverseVoltage',
      label: 'Peak reverse (Vr / PIV)',
      placeholder: 'e.g. 100 or 1000',
    },
    forwardCurrent: {
      key: 'forwardCurrent',
      symbol: 'If',
      unit: 'A',
      dataset: 'forwardCurrent',
      label: 'Forward current (If)',
      placeholder: 'e.g. 0.2 or 1',
    },
    hfe: {
      key: 'hfe',
      symbol: 'β',
      unit: '',
      dataset: 'hfe',
      label: 'Current gain (hFE / β)',
      placeholder: 'e.g. 100',
    },
    mu: {
      key: 'mu',
      symbol: 'μ',
      unit: '',
      dataset: 'mu',
      label: 'Amplification factor (μ)',
      placeholder: 'e.g. 100',
    },
    heaterVoltage: {
      key: 'heaterVoltage',
      symbol: 'Vf',
      unit: 'V',
      dataset: 'heaterVoltage',
      label: 'Heater voltage (Vf)',
      placeholder: 'e.g. 6.3 or 12.6',
    },
    plateDissipation: {
      key: 'plateDissipation',
      symbol: 'Pa',
      unit: 'W',
      dataset: 'plateDissipation',
      label: 'Plate dissipation (W)',
      placeholder: 'e.g. 12 or 30',
    },
    openLoopGain: {
      key: 'openLoopGain',
      symbol: 'Aol',
      unit: 'V/V',
      dataset: 'openLoopGain',
      label: 'Open-loop gain (Aol)',
      placeholder: 'e.g. 100000',
    },
    gainBandwidth: {
      key: 'gainBandwidth',
      symbol: 'GBW',
      unit: 'MHz',
      dataset: 'gainBandwidth',
      label: 'Gain-bandwidth (GBW)',
      placeholder: 'e.g. 1 or 3',
    },
    slewRate: {
      key: 'slewRate',
      symbol: 'SR',
      unit: 'V/µs',
      dataset: 'slewRate',
      label: 'Slew rate (SR)',
      placeholder: 'e.g. 0.5 or 13',
    },
    inputOffset: {
      key: 'inputOffset',
      symbol: 'Vos',
      unit: 'mV',
      dataset: 'inputOffset',
      label: 'Input offset (Vos)',
      placeholder: 'e.g. 1 or 3',
    },
    supplyVoltage: {
      key: 'supplyVoltage',
      symbol: 'Vs',
      unit: 'V',
      dataset: 'supplyVoltage',
      label: 'Supply voltage (Vs)',
      placeholder: 'e.g. 9 or 15',
    },
    voltage: {
      key: 'voltage',
      symbol: 'V',
      unit: 'V',
      dataset: 'voltage',
      label: 'Voltage (V)',
      placeholder: 'e.g. 9',
    },
    currentRating: {
      key: 'currentRating',
      symbol: 'I',
      unit: 'A',
      dataset: 'currentRating',
      label: 'Current rating (A)',
      placeholder: 'e.g. 0.5 or 2',
    },
    primaryVoltage: {
      key: 'primaryVoltage',
      symbol: 'Vp',
      unit: 'V',
      dataset: 'primaryVoltage',
      label: 'Primary voltage (Vp)',
      placeholder: 'e.g. 120 or 240',
    },
    secondaryVoltage: {
      key: 'secondaryVoltage',
      symbol: 'Vs',
      unit: 'V',
      dataset: 'secondaryVoltage',
      label: 'Secondary voltage (Vs)',
      placeholder: 'e.g. 250 or 6.3',
    },
    turnsRatio: {
      key: 'turnsRatio',
      symbol: 'n',
      unit: '',
      dataset: 'turnsRatio',
      label: 'Turns ratio (Np:Ns)',
      placeholder: 'e.g. 10 or 1',
    },
    coilVoltage: {
      key: 'coilVoltage',
      symbol: 'Vc',
      unit: 'V',
      dataset: 'coilVoltage',
      label: 'Coil voltage (Vc)',
      placeholder: 'e.g. 5 or 12',
    },
    powerRating: {
      key: 'powerRating',
      symbol: 'P',
      unit: 'W',
      dataset: 'powerRating',
      label: 'Power rating (W)',
      placeholder: 'e.g. 0.25 or 1',
    },
    tolerance: {
      key: 'tolerance',
      symbol: 'tol',
      unit: '%',
      dataset: 'tolerance',
      label: 'Tolerance (%)',
      placeholder: 'e.g. 1 or 5',
    },
    glowColor: {
      key: 'glowColor',
      symbol: 'λ',
      unit: '',
      dataset: 'glowColor',
      label: 'Glow colour',
      placeholder: '#ff3b30',
      inputType: 'color',
      schematicHidden: true,
    },
  };

  function defaultValueFieldsForSubtype(category, subtype) {
    if (subtype === '4conductor'
      || category === 'pickup'
      || subtype === 'singlecoil'
      || subtype === 'dualcoil') {
      return ['coilWinds', 'impedance', 'inductance'];
    }
    if (subtype === 'capacitor' || (category === 'component' && subtype === 'capacitor')) {
      return ['capacitance'];
    }
    if (subtype === 'resistor' || (category === 'component' && subtype === 'resistor')) {
      return ['resistance', 'powerRating', 'tolerance'];
    }
    if (subtype === 'diode' || (category === 'component' && subtype === 'diode')) {
      return ['forwardVoltage', 'reverseVoltage', 'forwardCurrent'];
    }
    if (subtype === 'led-indicator' || (category === 'component' && subtype === 'led-indicator')) {
      return ['forwardVoltage', 'forwardCurrent', 'glowColor'];
    }
    if (subtype === 'transistor' || (category === 'component' && subtype === 'transistor')) {
      return ['hfe'];
    }
    if (subtype === 'opamp' || (category === 'component' && subtype === 'opamp')) {
      return ['openLoopGain', 'gainBandwidth', 'slewRate', 'inputOffset', 'supplyVoltage'];
    }
    if (subtype === 'vacuum-tube' || subtype === 'tube-generic'
      || (category === 'component' && (subtype === 'vacuum-tube' || subtype === 'tube-generic'))) {
      return ['mu', 'plateDissipation', 'heaterVoltage'];
    }
    if (subtype === 'potentiometer' || (category === 'component' && subtype === 'potentiometer')) {
      return ['resistance'];
    }
    if (subtype === 'push-pot-on-on' || (category === 'component' && subtype === 'push-pot-on-on')) {
      return ['resistance'];
    }
    if (subtype === 'inductor' || (category === 'component' && subtype === 'inductor')) {
      return ['inductance', 'currentRating'];
    }
    if (subtype === 'audio-transformer' || (category === 'component' && subtype === 'audio-transformer')) {
      return ['turnsRatio', 'impedance'];
    }
    if (subtype === 'relay' || (category === 'component' && subtype === 'relay')) {
      return ['coilVoltage', 'resistance'];
    }
    if (subtype === 'dc-jack') return ['voltage', 'currentRating'];
    if (subtype === 'heater-supply') return ['heaterVoltage', 'currentRating'];
    if (subtype === 'hv-supply') return ['voltage', 'currentRating'];
    if (subtype === 'dual-rail') return ['supplyVoltage', 'currentRating'];
    if (subtype === 'power-transformer') {
      return ['primaryVoltage', 'secondaryVoltage', 'powerRating'];
    }
    if (subtype === 'ninevolt' || category === 'power') {
      return ['voltage'];
    }
    return [];
  }

  /**
   * Default YESGROUND for parts whose metalwork / return path should reach jack G.
   * Jacks are ground sources — never YESGROUND.
   * Signal-only passives (cap, R, diode, …) default NOGROUND unless the template opts in.
   */
  function defaultNeedsGrounding(category, subtype) {
    if (category === 'jack') return false;
    if (category === 'pickup'
      || subtype === 'singlecoil'
      || subtype === 'dualcoil'
      || subtype === '4conductor') {
      return true;
    }
    if (category === 'switch'
      || subtype === 'dpdt'
      || subtype === 'dpdt-on-on'
      || subtype === 'dpdt-on-off-on'
      || subtype === 'spst-on-off'
      || subtype === 'footswitch') {
      return true;
    }
    if (subtype === 'potentiometer'
      || subtype === 'push-pot-on-on'
      || subtype === 'vacuum-tube'
      || subtype === 'tube-generic'
      || subtype === 'audio-transformer'
      || subtype === 'power-transformer'
      || subtype === 'relay') {
      return true;
    }
    // Signal-only passives — chassis YESGROUND only when template opts in
    if (subtype === 'capacitor'
      || subtype === 'resistor'
      || subtype === 'diode'
      || subtype === 'transistor'
      || subtype === 'opamp'
      || subtype === 'inductor') {
      return false;
    }
    // Power sources / LED indicators: return path is electrical (P− / K), not chassis YESGROUND
    if (subtype === 'led-indicator'
      || subtype === 'ninevolt'
      || subtype === 'dc-jack'
      || subtype === 'heater-supply'
      || subtype === 'hv-supply'
      || subtype === 'dual-rail') {
      return false;
    }
    if (category === 'power') {
      return false;
    }
    return false;
  }

  /** Visible electrical-value presets in the custom asset editor. */
  const ELECTRICAL_VALUE_PRESETS = [
    { id: 'none', label: 'None' },
    { id: 'pickup', label: 'Pickup' },
    { id: 'potentiometer', label: 'Potentiometer' },
    { id: 'switch', label: 'Switch' },
    { id: 'power', label: 'Power' },
    { id: 'dc-jack', label: 'DC Jack' },
    { id: 'heater-supply', label: 'Heater Supply' },
    { id: 'hv-supply', label: 'B+ / HV Supply' },
    { id: 'dual-rail', label: 'Dual-Rail Supply' },
    { id: 'power-transformer', label: 'Power Transformer' },
    { id: 'capacitor', label: 'Capacitor' },
    { id: 'resistor', label: 'Resistor' },
    { id: 'diode', label: 'Diode' },
    { id: 'led-indicator', label: 'LED' },
    { id: 'inductor', label: 'Inductor / Choke' },
    { id: 'audio-transformer', label: 'Audio Transformer' },
    { id: 'relay', label: 'Relay' },
    { id: 'transistor', label: 'Transistor' },
    { id: 'opamp', label: 'Op Amp' },
    { id: 'vacuum-tube', label: 'Vacuum Tube' },
  ];

  /** Hidden presets — activated via settings (e.g. Push/Pull under Potentiometer). */
  const HIDDEN_ELECTRICAL_PRESETS = [
    { id: 'push-pot', label: 'Push/Pull Potentiometer' },
  ];

  /** Builtin template cloned into the editor preview when a Preset is chosen. */
  const ELECTRICAL_PRESET_SOURCE_TEMPLATE = {
    pickup: 'singlecoil',
    potentiometer: 'potentiometer',
    'push-pot': 'push-pot-on-on',
    switch: 'dpdt-on-on',
    power: 'ninevolt',
    'dc-jack': 'dc-jack',
    'heater-supply': 'heater-supply',
    'hv-supply': 'hv-supply',
    'dual-rail': 'dual-rail',
    'power-transformer': 'power-transformer',
    capacitor: 'capacitor',
    resistor: 'resistor',
    diode: 'diode',
    'led-indicator': 'led-indicator',
    inductor: 'inductor',
    'audio-transformer': 'audio-transformer',
    relay: 'relay',
    transistor: 'transistor',
    opamp: 'opamp',
    'vacuum-tube': 'vacuum-tube',
  };

  /** null = free mode (None): every quantity listed with enable toggles. */
  function valueFieldsForElectricalPreset(presetId) {
    switch (presetId) {
      case 'pickup':
        return ['coilWinds', 'impedance', 'inductance'];
      case 'potentiometer':
      case 'push-pot':
        return ['resistance'];
      case 'power':
        return ['voltage'];
      case 'dc-jack':
        return ['voltage', 'currentRating'];
      case 'heater-supply':
        return ['heaterVoltage', 'currentRating'];
      case 'hv-supply':
        return ['voltage', 'currentRating'];
      case 'dual-rail':
        return ['supplyVoltage', 'currentRating'];
      case 'power-transformer':
        return ['primaryVoltage', 'secondaryVoltage', 'powerRating'];
      case 'capacitor':
        return ['capacitance'];
      case 'resistor':
        return ['resistance', 'powerRating', 'tolerance'];
      case 'diode':
        return ['forwardVoltage', 'reverseVoltage', 'forwardCurrent'];
      case 'led-indicator':
        return ['forwardVoltage', 'forwardCurrent', 'glowColor'];
      case 'inductor':
        return ['inductance', 'currentRating'];
      case 'audio-transformer':
        return ['turnsRatio', 'impedance'];
      case 'relay':
        return ['coilVoltage', 'resistance'];
      case 'transistor':
        return ['hfe'];
      case 'opamp':
        return ['openLoopGain', 'gainBandwidth', 'slewRate', 'inputOffset', 'supplyVoltage'];
      case 'vacuum-tube':
        return ['mu', 'plateDissipation', 'heaterVoltage'];
      case 'switch':
      case 'jack':
        return [];
      case 'none':
      default:
        return null;
    }
  }

  function normalizeElectricalPresetId(id) {
    const raw = String(id || 'none').trim();
    // Jack preset removed from creator — migrate old drafts to None.
    if (raw === 'jack') return 'none';
    if (ELECTRICAL_VALUE_PRESETS.some((p) => p.id === raw)) return raw;
    if (HIDDEN_ELECTRICAL_PRESETS.some((p) => p.id === raw)) return raw;
    return 'none';
  }

  function isPotentiometerFamilyPreset(id) {
    const p = normalizeElectricalPresetId(id);
    return p === 'potentiometer' || p === 'push-pot';
  }

  /** Preset value shown in the visible <select> (hidden push-pot maps to Potentiometer). */
  function visibleElectricalPresetId(id) {
    const p = normalizeElectricalPresetId(id);
    return p === 'push-pot' ? 'potentiometer' : p;
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
      { label: 'H', color: '#2ecc71', className: 'hot', role: 'H', termName: 'Hot', symbol: 'H', x: hX, y: ty },
      { label: 'G', color: '#ffffff', className: 'ground', role: 'G', termName: 'Ground', symbol: 'G', x: gX, y: ty },
    ];
  }

  /**
   * Dual coil / humbucker — 5-conductor loom exits horizontally to the right.
   * SD-style 4-conductor colour code (NA guitar practice):
   *   H black = North start (hot) · N white = North finish
   *   R red = South finish (series) · S green = South start · G bare = shield
   * Stock series: solder N↔R, take hot from H, ground S+G.
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
        menuLabel: 'Hot / North start (H)',
        wireColor: '#111111',
        termName: 'Hot (North start)',
        symbol: 'H',
        keepColorWhenActive: true,
        textColor: '#eeeeee',
      },
      {
        label: 'N',
        role: 'N',
        tipLabel: 'N',
        menuLabel: 'North finish (N)',
        wireColor: '#ffffff',
        termName: 'North finish',
        symbol: 'N',
        keepColorWhenActive: true,
      },
      {
        label: 'R',
        role: 'R',
        tipLabel: 'R',
        menuLabel: 'South finish / series (R)',
        wireColor: '#e74c3c',
        termName: 'South finish',
        symbol: 'R',
        keepColorWhenActive: true,
      },
      {
        label: 'S',
        role: 'S',
        tipLabel: 'S',
        menuLabel: 'South start (S)',
        wireColor: '#2ecc71',
        termName: 'South start',
        symbol: 'S',
        keepColorWhenActive: true,
      },
      {
        label: 'G',
        role: 'G',
        tipLabel: 'G',
        menuLabel: 'Shield / ground (G)',
        wireColor: '#b87333',
        termName: 'Shield',
        symbol: 'G',
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
        termName: spec.termName,
        symbol: spec.symbol,
        title: formatTerminalTitle(spec.termName, spec.symbol),
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
        termName: 'Sleeve',
        symbol: 'G',
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
        termName: 'Tip',
        symbol: 'H',
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
        termName: 'Sleeve',
        symbol: 'G',
        title: 'Sleeve (G)',
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
        termName: 'Ring',
        symbol: 'R',
        title: 'Ring (R)',
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
        termName: 'Tip',
        symbol: 'H',
        title: 'Tip (H)',
        x: startX + gSize.w + gap + sq.w + gap,
        y: sqY,
        w: sq.w,
        h: sq.h,
        keepColorWhenActive: true,
      },
    ];
  }

  function powerSupplyTerminals(bx, by, bw, bodyH) {
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
        termName: 'Positive',
        symbol: '+',
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
        termName: 'Negative',
        symbol: '−',
        x: startX + tw + gap,
        y: ty,
        w: tw,
        h: th,
        keepColorWhenActive: true,
      },
    ];
  }

  /** @deprecated alias — prefer powerSupplyTerminals */
  const nineVoltTerminals = powerSupplyTerminals;

  /** DC barrel jack — tip (+) and sleeve (G). */
  function dcJackTerminals(bx, by, bw, bodyH) {
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
        termName: 'Tip (+)',
        symbol: '+',
        x: startX,
        y: ty,
        w: tw,
        h: th,
        keepColorWhenActive: true,
      },
      {
        label: 'G',
        color: '#111111',
        className: 'ground',
        role: 'G',
        termName: 'Sleeve (G)',
        symbol: 'G',
        x: startX + tw + gap,
        y: ty,
        w: tw,
        h: th,
        keepColorWhenActive: true,
        isGround: true,
      },
    ];
  }

  /** Tube heater winding / 6.3 V rail — H · H (optional CT). */
  function heaterSupplyTerminals(bx, by, bw, bodyH) {
    const { w: tw, h: th } = getTermSize('square');
    const gap = TERM_GAP;
    const rowW = tw * 3 + gap * 2;
    const startX = bx + snapEditor((bw - rowW) / 2);
    const ty = by + bodyH + TERM_BELOW_BODY;
    return [
      {
        label: 'H',
        color: '#ffd700',
        className: 'heater-term',
        role: 'H',
        termName: 'Heater',
        symbol: 'H',
        x: startX,
        y: ty,
        w: tw,
        h: th,
        keepColorWhenActive: true,
      },
      {
        label: 'CT',
        color: '#888888',
        className: 'heater-ct',
        role: 'CT',
        termName: 'Heater CT',
        symbol: 'CT',
        x: startX + tw + gap,
        y: ty,
        w: tw,
        h: th,
      },
      {
        label: 'H',
        color: '#ffd700',
        className: 'heater-term',
        role: 'H',
        termName: 'Heater',
        symbol: 'H',
        x: startX + (tw + gap) * 2,
        y: ty,
        w: tw,
        h: th,
        keepColorWhenActive: true,
      },
    ];
  }

  /** High-voltage B+ rail — B+ and chassis G. */
  function hvSupplyTerminals(bx, by, bw, bodyH) {
    const { w: tw, h: th } = getTermSize('square');
    const gap = TERM_GAP;
    const rowW = tw * 2 + gap;
    const startX = bx + snapEditor((bw - rowW) / 2);
    const ty = by + bodyH + TERM_BELOW_BODY;
    return [
      {
        label: 'B+',
        color: '#e74c3c',
        className: 'hv-plus',
        role: 'B+',
        termName: 'B+',
        symbol: 'B+',
        x: startX,
        y: ty,
        w: tw,
        h: th,
        keepColorWhenActive: true,
      },
      {
        label: 'G',
        color: '#111111',
        className: 'ground',
        role: 'G',
        termName: 'Ground',
        symbol: 'G',
        x: startX + tw + gap,
        y: ty,
        w: tw,
        h: th,
        keepColorWhenActive: true,
        isGround: true,
      },
    ];
  }

  /** Dual-rail PSU — V+ · G · V−. */
  function dualRailTerminals(bx, by, bw, bodyH) {
    const { w: tw, h: th } = getTermSize('square');
    const gap = TERM_GAP;
    const rowW = tw * 3 + gap * 2;
    const startX = bx + snapEditor((bw - rowW) / 2);
    const ty = by + bodyH + TERM_BELOW_BODY;
    return [
      {
        label: '+',
        color: '#e74c3c',
        className: 'power-plus',
        role: 'V+',
        termName: 'Positive rail',
        symbol: '+',
        x: startX,
        y: ty,
        w: tw,
        h: th,
        keepColorWhenActive: true,
      },
      {
        label: 'G',
        color: '#111111',
        className: 'ground',
        role: 'G',
        termName: 'Ground',
        symbol: 'G',
        x: startX + tw + gap,
        y: ty,
        w: tw,
        h: th,
        keepColorWhenActive: true,
        isGround: true,
      },
      {
        label: '−',
        color: '#4aa3ff',
        className: 'power-minus',
        role: 'V-',
        termName: 'Negative rail',
        symbol: '−',
        x: startX + (tw + gap) * 2,
        y: ty,
        w: tw,
        h: th,
        keepColorWhenActive: true,
      },
    ];
  }

  /** Two-winding transformer — primary left, secondary right. */
  function transformerTerminals(bx, by, bw, bodyH, labels = ['P1', 'P2', 'S1', 'S2']) {
    const { w: tw, h: th } = getTermSize('square');
    const gap = TERM_GAP;
    const sideGap = TERM_GAP + 2;
    const colH = th * 2 + gap;
    const startY = by + snapEditor((bodyH - colH) / 2);
    return [
      {
        label: labels[0],
        color: '#c9a227',
        className: 'xfmr-pri',
        role: labels[0],
        termName: `Primary ${labels[0]}`,
        symbol: labels[0],
        x: bx - tw - sideGap,
        y: startY,
        w: tw,
        h: th,
      },
      {
        label: labels[1],
        color: '#c9a227',
        className: 'xfmr-pri',
        role: labels[1],
        termName: `Primary ${labels[1]}`,
        symbol: labels[1],
        x: bx - tw - sideGap,
        y: startY + th + gap,
        w: tw,
        h: th,
      },
      {
        label: labels[2],
        color: '#4aa3ff',
        className: 'xfmr-sec',
        role: labels[2],
        termName: `Secondary ${labels[2]}`,
        symbol: labels[2],
        x: bx + bw + sideGap,
        y: startY,
        w: tw,
        h: th,
      },
      {
        label: labels[3],
        color: '#4aa3ff',
        className: 'xfmr-sec',
        role: labels[3],
        termName: `Secondary ${labels[3]}`,
        symbol: labels[3],
        x: bx + bw + sideGap,
        y: startY + th + gap,
        w: tw,
        h: th,
      },
    ];
  }

  /** Axial-style body with two square terminals below (inductor / LED). */
  function twoTerminalBelowParts(bx, by, bodyW, bodyH, leftTerm, rightTerm) {
    const { w: tw, h: th } = getTermSize('square');
    const gap = TERM_GAP;
    const rowW = tw * 2 + gap;
    const startX = bx + snapEditor((bodyW - rowW) / 2);
    const ty = by + bodyH + TERM_BELOW_BODY;
    return {
      bodyX: bx,
      bodyY: by,
      bodyW,
      bodyH,
      terminals: [
        {
          label: leftTerm.label,
          role: leftTerm.role,
          color: leftTerm.color,
          className: leftTerm.className,
          termName: leftTerm.termName,
          symbol: leftTerm.symbol,
          title: leftTerm.title,
          x: startX,
          y: ty,
          w: tw,
          h: th,
          keepColorWhenActive: true,
        },
        {
          label: rightTerm.label,
          role: rightTerm.role,
          color: rightTerm.color,
          className: rightTerm.className,
          termName: rightTerm.termName,
          symbol: rightTerm.symbol,
          title: rightTerm.title,
          x: startX + tw + gap,
          y: ty,
          w: tw,
          h: th,
          keepColorWhenActive: true,
        },
      ],
    };
  }

  function inductorParts(bx = 0, by = 0) {
    return twoTerminalBelowParts(bx, by, 36, 28, {
      label: '1',
      role: 'L',
      color: '#c9a227',
      className: 'inductor-term',
      termName: 'Inductor 1',
      symbol: '1',
      title: 'Inductor lead 1',
    }, {
      label: '2',
      role: 'L',
      color: '#c9a227',
      className: 'inductor-term',
      termName: 'Inductor 2',
      symbol: '2',
      title: 'Inductor lead 2',
    });
  }

  function ledIndicatorParts(bx = 0, by = 0) {
    return twoTerminalBelowParts(bx, by, 28, 28, {
      label: 'A',
      role: 'A',
      color: '#e74c3c',
      className: 'led-anode',
      termName: 'Anode',
      symbol: 'A',
      title: 'Anode (A)',
    }, {
      label: 'K',
      role: 'K',
      color: '#111111',
      className: 'led-cathode',
      termName: 'Cathode',
      symbol: 'K',
      title: 'Cathode (K)',
    });
  }

  /** SPDT footswitch — C · NO · NC. */
  function footswitchTerminals(bx, by, bw, bodyH) {
    const { w: tw, h: th } = getTermSize('rect');
    const gap = TERM_GAP;
    const rowW = tw * 3 + gap * 2;
    const startX = bx + snapEditor((bw - rowW) / 2);
    const ty = by + bodyH + TERM_BELOW_BODY;
    return [
      {
        label: 'C',
        color: '#c9a227',
        className: 'switch-term',
        role: 'C',
        termName: 'Common',
        symbol: 'C',
        title: 'Common (C)',
        x: startX,
        y: ty,
        w: tw,
        h: th,
      },
      {
        label: 'NO',
        color: '#2ecc71',
        className: 'switch-term',
        role: 'NO',
        termName: 'Normally open',
        symbol: 'NO',
        title: 'Normally open (NO)',
        x: startX + tw + gap,
        y: ty,
        w: tw,
        h: th,
      },
      {
        label: 'NC',
        color: '#e74c3c',
        className: 'switch-term',
        role: 'NC',
        termName: 'Normally closed',
        symbol: 'NC',
        title: 'Normally closed (NC)',
        x: startX + (tw + gap) * 2,
        y: ty,
        w: tw,
        h: th,
      },
    ];
  }

  /** Relay — coil left, SPDT contacts right. */
  function relayParts(bx = 0, by = 0) {
    const bodyW = 56;
    const bodyH = 40;
    const { w: tw, h: th } = getTermSize('square');
    const gap = TERM_GAP;
    const sideGap = TERM_GAP + 2;
    const colH = th * 2 + gap;
    const startY = by + snapEditor((bodyH - colH) / 2);
    const contactY = by + snapEditor((bodyH - (th * 3 + gap * 2)) / 2);
    return {
      bodyX: bx,
      bodyY: by,
      bodyW,
      bodyH,
      terminals: [
        {
          label: 'C+',
          color: '#e74c3c',
          className: 'relay-coil',
          role: 'C+',
          termName: 'Coil +',
          symbol: '+',
          x: bx - tw - sideGap,
          y: startY,
          w: tw,
          h: th,
        },
        {
          label: 'C−',
          color: '#111111',
          className: 'relay-coil',
          role: 'C-',
          termName: 'Coil −',
          symbol: '−',
          x: bx - tw - sideGap,
          y: startY + th + gap,
          w: tw,
          h: th,
        },
        {
          label: 'C',
          color: '#c9a227',
          className: 'relay-contact',
          role: 'C',
          termName: 'Common',
          symbol: 'C',
          x: bx + bodyW + sideGap,
          y: contactY,
          w: tw,
          h: th,
        },
        {
          label: 'NO',
          color: '#2ecc71',
          className: 'relay-contact',
          role: 'NO',
          termName: 'Normally open',
          symbol: 'NO',
          x: bx + bodyW + sideGap,
          y: contactY + th + gap,
          w: tw,
          h: th,
        },
        {
          label: 'NC',
          color: '#e74c3c',
          className: 'relay-contact',
          role: 'NC',
          termName: 'Normally closed',
          symbol: 'NC',
          x: bx + bodyW + sideGap,
          y: contactY + (th + gap) * 2,
          w: tw,
          h: th,
        },
      ],
    };
  }

  /**
   * Pot lugs 1 / 2 (wiper) / 3 below + chassis/case ground on the left shell.
   * NA practice: case is IEEE chassis ground (connectable); often bonded to lug 1
   * on volume pots — schematic shows that bond when wiring allows.
   */
  function potentiometerTerminals(bx, by, bw, bodyH) {
    const { w: tw, h: th } = getTermSize('square');
    const gap = TERM_GAP;
    const rowW = tw * 3 + gap * 2;
    const startX = bx + snapEditor((bw - rowW) / 2);
    const ty = by + bodyH + TERM_BELOW_BODY;
    // Extra apron so case G clears lug 1 (cap leads attach here often)
    const sideGap = TERM_GAP + 6;
    return [
      {
        label: '1',
        color: '#ffffff',
        className: 'pot-lug',
        role: '1',
        termName: 'Lug 1',
        symbol: '1',
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
        termName: 'Wiper',
        symbol: '2',
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
        termName: 'Lug 3',
        symbol: '3',
        x: startX + (tw + gap) * 2,
        y: ty,
        w: tw,
        h: th,
      },
      {
        label: 'G',
        color: '#ffffff',
        className: 'ground pot-case-ground is-ground',
        role: 'G',
        termName: 'Chassis / case ground',
        symbol: 'G',
        title: 'Chassis / case ground (G)',
        isGround: true,
        signalMark: 'chassis',
        x: bx - sideGap - tw,
        y: by + snapEditor((bodyH - th) / 2),
        w: tw,
        h: th,
      },
    ];
  }

  /**
   * Push/Pull pot: DPDT 3×2 grid above the body (same pin order as toggle switches),
   * plus standard pot lugs 1/2/3 below and case G on the left.
   */
  function pushPotOnOnParts(bx = 0, by = 0) {
    const { w: tw, h: th } = getTermSize('square');
    // Slightly roomier than default TERM_GAP so T1–T6 aren’t cramped
    const gap = 3;
    const switchBodyGap = 10;
    const lugRowW = tw * 3 + TERM_GAP * 2;
    // Match body width to the 1/2/3 lug row so the stack doesn’t stair-step
    const bw = lugRowW;
    const bh = 48;
    const gridW = tw * 2 + gap;
    const gridH = th * 3 + gap * 2;
    const bodyX = bx;
    const bodyY = by + gridH + switchBodyGap;
    // True center (avoid 10px grid snap pulling the switch block off-center)
    const switchStartX = bodyX + Math.round((bw - gridW) / 2);
    const switchStartY = by;
    const switchTerms = [];
    let i = 0;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        switchTerms.push({
          label: `T${i + 1}`,
          color: '#c9a227',
          className: 'switch-term push-pot-switch-term',
          role: `T${i + 1}`,
          termName: `Terminal ${i + 1}`,
          symbol: `T${i + 1}`,
          x: switchStartX + col * (tw + gap),
          y: switchStartY + row * (th + gap),
          w: tw,
          h: th,
        });
        i += 1;
      }
    }
    return {
      bodyX,
      bodyY,
      bodyW: bw,
      bodyH: bh,
      terminals: [...switchTerms, ...potentiometerTerminals(bodyX, bodyY, bw, bh)],
    };
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
          termName: 'Capacitor lead',
          symbol: 'C',
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
          termName: 'Capacitor lead',
          symbol: 'C',
          x: cx - tip / 2,
          y: bodyY + bodyH + lead - tip,
          w: tip,
          h: tip,
        },
      ],
    };
  }

  /**
   * Axial diode: compact body with cathode band, 2-unit leads top (K) & bottom (A).
   * Lead tips use the same cap-term / lead-leg behavior as capacitors.
   */
  function diodeParts(bx = 0, by = 0) {
    const bodyW = Math.round(1.4 * UNIT);
    const bodyH = 2 * UNIT;
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
          role: 'K',
          color: 'transparent',
          className: 'cap-term',
          partKind: 'lead',
          title: 'Cathode (K)',
          termName: 'Cathode',
          symbol: 'K',
          x: cx - tip / 2,
          y: by,
          w: tip,
          h: tip,
        },
        {
          label: '',
          role: 'A',
          color: 'transparent',
          className: 'cap-term',
          partKind: 'lead',
          title: 'Anode (A)',
          termName: 'Anode',
          symbol: 'A',
          x: cx - tip / 2,
          y: bodyY + bodyH + lead - tip,
          w: tip,
          h: tip,
        },
      ],
    };
  }

  /**
   * Axial resistor: body between two lead tips (same bendable-lead pattern as caps/diodes).
   */
  function resistorParts(bx = 0, by = 0) {
    const bodyW = Math.round(1.4 * UNIT);
    const bodyH = 2 * UNIT;
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
          partKind: 'lead',
          title: 'Resistor lead',
          termName: 'Resistor lead',
          symbol: '·',
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
          partKind: 'lead',
          title: 'Resistor lead',
          termName: 'Resistor lead',
          symbol: '·',
          x: cx - tip / 2,
          y: bodyY + bodyH + lead - tip,
          w: tip,
          h: tip,
        },
      ],
    };
  }

  /**
   * Transistor: square body half capacitor width (1×1 unit), 3 straight leads below (E/B/C).
   * Lead tips use the same cap-term / lead-leg behavior as capacitors.
   */
  function transistorParts(bx = 0, by = 0) {
    const bodyW = UNIT;
    const bodyH = UNIT;
    const lead = 2 * UNIT;
    const tip = 10;
    const tipGap = 2;
    const bodyX = bx;
    const bodyY = by;
    const tipsSpan = tip * 3 + tipGap * 2;
    const tipStartX = bodyX + (bodyW - tipsSpan) / 2;
    const tipY = bodyY + bodyH + lead - tip;
    const roles = [
      { role: 'E', termName: 'Emitter', symbol: 'E' },
      { role: 'B', termName: 'Base', symbol: 'B' },
      { role: 'C', termName: 'Collector', symbol: 'C' },
    ];
    return {
      bodyX,
      bodyY,
      bodyW,
      bodyH,
      terminals: roles.map((pin, i) => ({
        label: '',
        role: pin.role,
        color: 'transparent',
        className: 'cap-term',
        partKind: 'lead',
        termName: pin.termName,
        symbol: pin.symbol,
        title: formatTerminalTitle(pin.termName, pin.symbol),
        x: tipStartX + i * (tip + tipGap),
        y: tipY,
        w: tip,
        h: tip,
      })),
    };
  }

  /**
   * Op amp: square DIP-style body (physical IC), five small coloured pins.
   * Pin names appear as coloured hover labels (terminals stay tiny).
   * Pin order: IN−, IN+, OUT, V+, V−
   */
  function opampParts(bx = 0, by = 0) {
    const tip = 8;
    const pad = 2;
    const bodyW = 4 * UNIT;
    const bodyH = 4 * UNIT;
    const bodyX = bx + tip + pad;
    const bodyY = by + tip + pad;
    const pins = [
      {
        role: 'IN-',
        hoverLabel: '−',
        hoverSide: 'left',
        color: '#4aa3ff',
        termName: 'Inverting input',
        symbol: '−',
        title: 'Inverting input (−)',
        x: bodyX - tip,
        y: bodyY + bodyH * 0.28 - tip / 2,
      },
      {
        role: 'IN+',
        hoverLabel: '+',
        hoverSide: 'left',
        color: '#2ecc71',
        termName: 'Non-inverting input',
        symbol: '+',
        title: 'Non-inverting input (+)',
        x: bodyX - tip,
        y: bodyY + bodyH * 0.72 - tip / 2,
      },
      {
        role: 'OUT',
        hoverLabel: 'Out',
        hoverSide: 'right',
        color: '#f0a500',
        termName: 'Output',
        symbol: 'Out',
        title: 'Output (Out)',
        x: bodyX + bodyW,
        y: bodyY + bodyH / 2 - tip / 2,
      },
      {
        role: 'V+',
        hoverLabel: 'V+',
        hoverSide: 'top',
        color: '#e74c3c',
        termName: 'Positive supply',
        symbol: 'V+',
        title: 'Positive supply (V+)',
        x: bodyX + bodyW / 2 - tip / 2,
        y: bodyY - tip,
      },
      {
        role: 'V-',
        hoverLabel: 'V−',
        hoverSide: 'bottom',
        color: '#c8cdd6',
        termName: 'Negative supply',
        symbol: 'V−',
        title: 'Negative supply (V−)',
        x: bodyX + bodyW / 2 - tip / 2,
        y: bodyY + bodyH,
      },
    ];
    return {
      bodyX,
      bodyY,
      bodyW,
      bodyH,
      terminals: pins.map((pin) => ({
        label: '',
        role: pin.role,
        color: pin.color,
        className: 'opamp-pin',
        partKind: 'terminal',
        keepColorWhenActive: true,
        hoverLabel: pin.hoverLabel,
        hoverSide: pin.hoverSide,
        termName: pin.termName,
        symbol: pin.symbol,
        title: pin.title,
        x: pin.x,
        y: pin.y,
        w: tip,
        h: tip,
      })),
    };
  }

  /**
   * Shared tube socket row: pins centered under a glass envelope body.
   * pinDefs: { label, role, color, enabled? }
   */
  function makeTubePinRow(bx, by, bodyW, bodyH, pinDefs) {
    const pinW = 14;
    const pinH = 14;
    const gap = 2;
    const bodyX = bx;
    const bodyY = by;
    const span = pinDefs.length * pinW + (pinDefs.length - 1) * gap;
    const tipStartX = bodyX + (bodyW - span) / 2;
    const tipY = bodyY + bodyH + TERM_BELOW_BODY;
    return {
      bodyX,
      bodyY,
      bodyW,
      bodyH,
      terminals: pinDefs.map((pin, i) => {
        const identity = resolveTerminalIdentity(
          { ...pin, className: 'tube-pin' },
          { subtype: 'vacuum-tube', category: 'component' }
        );
        const title = formatTerminalTitle(identity.name, identity.symbol);
        return {
          label: pin.label,
          role: pin.role,
          color: pin.color,
          className: 'tube-pin',
          partKind: 'terminal',
          keepColorWhenActive: true,
          enabled: pin.enabled !== false,
          termName: identity.name,
          symbol: identity.symbol,
          title: pin.title && /\([^)]+\)\s*$/.test(pin.title) ? pin.title : title,
          x: tipStartX + i * (pinW + gap),
          y: tipY,
          w: pinW,
          h: pinH,
        };
      }),
    };
  }

  function padTubePins(pins, count = 9) {
    const out = pins.slice(0, count).map((p) => ({ ...p, enabled: p.enabled !== false }));
    while (out.length < count) {
      const i = out.length;
      const n = String(i + 1);
      out.push({
        label: n,
        role: `P${n}`,
        color: '#666666',
        enabled: false,
        termName: `Pin ${n}`,
        symbol: n,
      });
    }
    return out;
  }

  /** Cog-menu pinout presets for Generic Tube (and reference pin maps). */
  const TUBE_PINOUT_PRESETS = {
    custom: {
      id: 'custom',
      label: 'Custom (1–9)',
      placeLabel: 'TUBE',
      valueFields: ['mu', 'plateDissipation', 'heaterVoltage'],
      pins: padTubePins(Array.from({ length: 9 }, (_, i) => {
        const n = String(i + 1);
        return {
          label: n,
          role: `P${n}`,
          color: '#c9a227',
          enabled: true,
          termName: `Pin ${n}`,
          symbol: n,
        };
      })),
    },
    '12ax7': {
      id: '12ax7',
      label: '12AX7 dual triode',
      placeLabel: 'AX7',
      valueFields: ['mu', 'heaterVoltage'],
      pins: padTubePins([
        { label: 'P1', role: 'P1', color: '#e74c3c', termName: 'Plate A', symbol: 'P1' },
        { label: 'G1', role: 'G1', color: '#4aa3ff', termName: 'Grid A', symbol: 'G1' },
        { label: 'K1', role: 'K1', color: '#ffffff', termName: 'Cathode A', symbol: 'K1' },
        { label: 'H', role: 'H', color: '#ffd700', termName: 'Heater', symbol: 'H' },
        { label: 'H', role: 'H', color: '#ffd700', termName: 'Heater', symbol: 'H' },
        { label: 'P2', role: 'P2', color: '#e74c3c', termName: 'Plate B', symbol: 'P2' },
        { label: 'G2', role: 'G2', color: '#4aa3ff', termName: 'Grid B', symbol: 'G2' },
        { label: 'K2', role: 'K2', color: '#ffffff', termName: 'Cathode B', symbol: 'K2' },
        { label: 'CT', role: 'CT', color: '#ffd700', termName: 'Heater center tap', symbol: 'CT' },
      ]),
    },
    '12at7': {
      id: '12at7',
      label: '12AT7 dual triode',
      placeLabel: 'AT7',
      valueFields: ['mu', 'heaterVoltage'],
      pins: null, // filled below from 12ax7
    },
    '12au7': {
      id: '12au7',
      label: '12AU7 dual triode',
      placeLabel: 'AU7',
      valueFields: ['mu', 'heaterVoltage'],
      pins: null,
    },
    '6v6': {
      id: '6v6',
      label: '6V6GT (Power Tube)',
      placeLabel: '6V6',
      valueFields: ['plateDissipation', 'heaterVoltage'],
      pins: null, // filled from shared octal beam map below
    },
    '6v6gt': {
      id: '6v6gt',
      label: '6V6GT (Power Tube)',
      placeLabel: '6V6',
      valueFields: ['plateDissipation', 'heaterVoltage'],
      pins: null,
    },
    '6l6gc': {
      id: '6l6gc',
      label: '6L6GC (Power Tube)',
      placeLabel: '6L6',
      valueFields: ['plateDissipation', 'heaterVoltage'],
      pins: null,
    },
    el34: {
      id: 'el34',
      label: 'EL34 (Power Tube)',
      placeLabel: 'EL34',
      valueFields: ['plateDissipation', 'heaterVoltage'],
      pins: padTubePins([
        { label: 'G3', role: 'G3', color: '#9b59b6', termName: 'Suppressor grid', symbol: 'G3' },
        { label: 'H', role: 'H', color: '#ffd700', termName: 'Heater', symbol: 'H' },
        { label: 'P', role: 'P', color: '#e74c3c', termName: 'Plate', symbol: 'P' },
        { label: 'G2', role: 'G2', color: '#2ecc71', termName: 'Screen grid', symbol: 'G2' },
        { label: 'G1', role: 'G1', color: '#4aa3ff', termName: 'Control grid', symbol: 'G1' },
        { label: '—', role: 'NC', color: '#666666', enabled: false, termName: 'No connection', symbol: 'NC' },
        { label: 'K', role: 'K', color: '#ffffff', termName: 'Cathode', symbol: 'K' },
        { label: 'H', role: 'H', color: '#ffd700', termName: 'Heater', symbol: 'H' },
      ]),
    },
    kt88: {
      id: 'kt88',
      label: 'KT88 (Power Tube)',
      placeLabel: 'KT88',
      valueFields: ['plateDissipation', 'heaterVoltage'],
      pins: null,
    },
    el84: {
      id: 'el84',
      label: 'EL84 (Power Tube)',
      placeLabel: 'EL84',
      valueFields: ['plateDissipation', 'heaterVoltage'],
      pins: padTubePins([
        { label: 'G2', role: 'G2', color: '#2ecc71', termName: 'Screen grid', symbol: 'G2' },
        { label: 'G1', role: 'G1', color: '#4aa3ff', termName: 'Control grid', symbol: 'G1' },
        { label: 'K', role: 'K', color: '#ffffff', termName: 'Cathode', symbol: 'K' },
        { label: 'H', role: 'H', color: '#ffd700', termName: 'Heater', symbol: 'H' },
        { label: 'H', role: 'H', color: '#ffd700', termName: 'Heater', symbol: 'H' },
        { label: '—', role: 'NC', color: '#666666', enabled: false, termName: 'No connection', symbol: 'NC' },
        { label: 'P', role: 'P', color: '#e74c3c', termName: 'Plate', symbol: 'P' },
        { label: '—', role: 'NC', color: '#666666', enabled: false, termName: 'No connection', symbol: 'NC' },
        { label: 'G3', role: 'G3', color: '#9b59b6', termName: 'Suppressor grid', symbol: 'G3' },
      ]),
    },
    triode: {
      id: 'triode',
      label: 'Single triode',
      placeLabel: 'V',
      valueFields: ['mu', 'heaterVoltage'],
      pins: padTubePins([
        { label: 'P', role: 'P', color: '#e74c3c', title: 'Plate' },
        { label: 'G', role: 'G1', color: '#4aa3ff', title: 'Grid' },
        { label: 'K', role: 'K', color: '#ffffff', title: 'Cathode' },
        { label: 'H', role: 'H', color: '#ffd700', title: 'Heater' },
        { label: 'H', role: 'H', color: '#ffd700', title: 'Heater' },
        { label: '—', role: 'NC', color: '#666666', enabled: false },
        { label: '—', role: 'NC', color: '#666666', enabled: false },
        { label: '—', role: 'NC', color: '#666666', enabled: false },
        { label: 'CT', role: 'CT', color: '#ffd700', enabled: true, title: 'Heater CT' },
      ]),
    },
  };

  /** Shared octal beam / kinkless tetrode map (6V6GT, 6L6GC, KT88). */
  const OCTAL_BEAM_POWER_PINS = padTubePins([
    { label: '—', role: 'NC', color: '#666666', enabled: false, title: 'Pin 1 NC' },
    { label: 'H', role: 'H', color: '#ffd700', title: 'Pin 2 Heater' },
    { label: 'P', role: 'P', color: '#e74c3c', title: 'Pin 3 Plate' },
    { label: 'G2', role: 'G2', color: '#2ecc71', title: 'Pin 4 Screen' },
    { label: 'G1', role: 'G1', color: '#4aa3ff', title: 'Pin 5 Grid' },
    { label: '—', role: 'NC', color: '#666666', enabled: false, title: 'Pin 6 NC' },
    { label: 'K', role: 'K', color: '#ffffff', title: 'Pin 7 Cathode' },
    { label: 'H', role: 'H', color: '#ffd700', title: 'Pin 8 Heater' },
  ]);
  TUBE_PINOUT_PRESETS['12at7'].pins = TUBE_PINOUT_PRESETS['12ax7'].pins.map((p) => ({ ...p }));
  TUBE_PINOUT_PRESETS['12au7'].pins = TUBE_PINOUT_PRESETS['12ax7'].pins.map((p) => ({ ...p }));
  TUBE_PINOUT_PRESETS['6v6'].pins = OCTAL_BEAM_POWER_PINS.map((p) => ({ ...p }));
  TUBE_PINOUT_PRESETS['6v6gt'].pins = OCTAL_BEAM_POWER_PINS.map((p) => ({ ...p }));
  TUBE_PINOUT_PRESETS['6l6gc'].pins = OCTAL_BEAM_POWER_PINS.map((p) => ({ ...p }));
  TUBE_PINOUT_PRESETS.kt88.pins = OCTAL_BEAM_POWER_PINS.map((p) => ({ ...p }));

  function listTubePinoutPresets() {
    const custom = TUBE_PINOUT_PRESETS.custom;
    const rest = Object.values(TUBE_PINOUT_PRESETS)
      .filter((preset) => preset?.id && preset.id !== 'custom' && preset.id !== '6v6')
      .sort((a, b) => String(a.label || a.id).localeCompare(
        String(b.label || b.id),
        undefined,
        { numeric: true, sensitivity: 'base' }
      ));
    return custom ? [custom, ...rest] : rest;
  }

  function getTubePinoutPreset(id) {
    if (id === '6v6') return TUBE_PINOUT_PRESETS['6v6gt'] || TUBE_PINOUT_PRESETS['6v6'];
    return TUBE_PINOUT_PRESETS[id] || TUBE_PINOUT_PRESETS.custom;
  }

  function tubePinMaskFromPins(pins) {
    return (pins || []).map((p) => (p.enabled === false ? '0' : '1')).join('');
  }

  /**
   * Diode material presets — typical ranges for guitar/pedal work.
   * Shockley equation shown symbolically in the cog (not numerically filled).
   */
  const DIODE_MATERIAL_PRESETS = {
    silicon: {
      id: 'silicon',
      label: 'Silicon',
      placeLabel: 'Si',
      defaults: {
        forwardVoltage: '0.7',
        reverseVoltage: '100',
        forwardCurrent: '1',
      },
      ranges: [
        'Vf ≈ 0.6–0.7 V (typ. at rated If)',
        'Vr / PIV ≈ 50–1000+ V',
        'If ≈ 0.1–3 A (signal → power)',
        'n ≈ 1–2',
        'Is ≈ 10⁻¹² – 10⁻¹⁴ A',
      ],
    },
    germanium: {
      id: 'germanium',
      label: 'Germanium',
      placeLabel: 'Ge',
      defaults: {
        forwardVoltage: '0.3',
        reverseVoltage: '50',
        forwardCurrent: '0.05',
      },
      ranges: [
        'Vf ≈ 0.2–0.3 V (typ.; soft knee)',
        'Vr / PIV ≈ 20–100 V (lower than Si)',
        'If ≈ 10–100 mA (small-signal)',
        'n ≈ 1–2',
        'Is ≈ 10⁻⁵ – 10⁻⁷ A (much higher leakage than Si)',
      ],
    },
    led: {
      id: 'led',
      label: 'LED',
      placeLabel: 'LED',
      defaults: {
        forwardVoltage: '2.0',
        reverseVoltage: '5',
        forwardCurrent: '0.02',
      },
      ranges: [
        'Vf ≈ 1.6–3.3 V (color / chemistry dependent)',
        'Vr / PIV ≈ 5 V typ. (do not reverse-bias)',
        'If ≈ 10–30 mA typ. indicator current',
        'n ≈ 1–2',
        'Is ≪ Si signal diodes (varies widely by LED type)',
      ],
    },
  };

  const SHOCKLEY_DIODE_EQUATION = {
    title: 'Shockley diode equation',
    /** Textbook form — symbols only (not numerically filled). */
    html: [
      '<span class="shockley-eq" aria-label="I equals I sub S open paren e to the V over n V sub T minus 1 close paren">',
      '<i class="shockley-var">I</i>',
      '<span class="shockley-op">=</span>',
      '<span class="shockley-term"><i class="shockley-var">I</i><sub>S</sub></span>',
      '<span class="shockley-paren">(</span>',
      '<span class="shockley-expbase"><i class="shockley-var">e</i>',
      '<span class="shockley-expon">',
      '<span class="shockley-frac">',
      '<span class="shockley-num"><i class="shockley-var">V</i></span>',
      '<span class="shockley-den"><i class="shockley-var">n</i><span class="shockley-term"><i class="shockley-var">V</i><sub>T</sub></span></span>',
      '</span>',
      '</span>',
      '</span>',
      '<span class="shockley-op">−</span>',
      '<span class="shockley-numeral">1</span>',
      '<span class="shockley-paren">)</span>',
      '</span>',
    ].join(''),
    legend: 'I current · V voltage · I_S saturation · n ideality · V_T thermal voltage',
  };

  /**
   * Resistor construction presets — typical guitar / pedal / amp values.
   * Electrical formulas shown symbolically in the cog (not numerically filled).
   */
  const RESISTOR_TYPE_PRESETS = {
    'carbon-film': {
      id: 'carbon-film',
      label: 'Carbon film',
      placeLabel: 'CF',
      defaults: {
        resistance: '10000',
        powerRating: '0.25',
        tolerance: '5',
      },
      ranges: [
        'R ≈ 1 Ω – 10 MΩ (common axial)',
        'P ≈ ⅛ – ½ W (¾ W less common)',
        'tol ≈ ±5% (typ.)',
        'Noise / TCR higher than metal film',
      ],
    },
    'metal-film': {
      id: 'metal-film',
      label: 'Metal film',
      placeLabel: 'MF',
      defaults: {
        resistance: '10000',
        powerRating: '0.25',
        tolerance: '1',
      },
      ranges: [
        'R ≈ 1 Ω – 10 MΩ',
        'P ≈ ⅛ – ½ W (signal / bias)',
        'tol ≈ ±1% (typ.; 0.1% available)',
        'Low noise — preferred in audio preamps',
      ],
    },
    'metal-oxide': {
      id: 'metal-oxide',
      label: 'Metal oxide',
      placeLabel: 'MO',
      defaults: {
        resistance: '1000',
        powerRating: '1',
        tolerance: '5',
      },
      ranges: [
        'R ≈ 0.1 Ω – 1 MΩ',
        'P ≈ ½ – 5 W (power / surge)',
        'tol ≈ ±5%',
        'Higher surge / flameproof grades common',
      ],
    },
    wirewound: {
      id: 'wirewound',
      label: 'Wirewound',
      placeLabel: 'WW',
      defaults: {
        resistance: '100',
        powerRating: '5',
        tolerance: '5',
      },
      ranges: [
        'R ≈ 0.1 Ω – 100 kΩ (power grades)',
        'P ≈ 1 – 50+ W',
        'tol ≈ ±5% (typ.)',
        'Inductive — avoid in HF feedback unless non-inductive',
      ],
    },
  };

  /**
   * ── Circuit engine (`CalcEngines.CIRCUIT`) ──────────────────────────────
   * Canonical electrical formulas used for value determination / readout.
   * Each entry is rendered under the shared "Electrical formula" tag.
   */
  const ELECTRICAL_FORMULAS = {
    conductorResistance: {
      id: 'conductor-resistance',
      tag: 'Electrical formula',
      title: 'Conductor resistance',
      html: [
        '<span class="eq-inline" aria-label="R equals rho L over A">',
        '<i class="eq-var">R</i><span class="eq-op">=</span>',
        '<span class="eq-frac"><span class="eq-num"><i class="eq-var">ρ</i><i class="eq-var">L</i></span>',
        '<span class="eq-den"><i class="eq-var">A</i></span></span>',
        '</span>',
      ].join(''),
      legend: 'ρ resistivity · L length · A cross-sectional area',
    },
    ohmLaw: {
      id: 'ohm-law',
      tag: 'Electrical formula',
      title: "Ohm's law",
      html: [
        '<span class="eq-inline" aria-label="V equals I R">',
        '<i class="eq-var">V</i><span class="eq-op">=</span>',
        '<i class="eq-var">I</i><i class="eq-var">R</i>',
        '</span>',
        '<span class="eq-sep">·</span>',
        '<span class="eq-inline" aria-label="R equals V over I">',
        '<i class="eq-var">R</i><span class="eq-op">=</span>',
        '<span class="eq-frac"><span class="eq-num"><i class="eq-var">V</i></span>',
        '<span class="eq-den"><i class="eq-var">I</i></span></span>',
        '</span>',
      ].join(''),
      legend: 'V voltage · I current · R resistance',
    },
    jouleHeating: {
      id: 'joule-heating',
      tag: 'Electrical formula',
      title: 'Power dissipation',
      html: [
        '<span class="eq-inline" aria-label="P equals I squared R equals V squared over R equals V I">',
        '<i class="eq-var">P</i><span class="eq-op">=</span>',
        '<i class="eq-var">I</i><sup>2</sup><i class="eq-var">R</i>',
        '<span class="eq-op">=</span>',
        '<span class="eq-frac"><span class="eq-num"><i class="eq-var">V</i><sup>2</sup></span>',
        '<span class="eq-den"><i class="eq-var">R</i></span></span>',
        '<span class="eq-op">=</span>',
        '<i class="eq-var">V</i><i class="eq-var">I</i>',
        '</span>',
      ].join(''),
      legend: 'P power · keep P ≤ rated wattage',
    },
    shockley: {
      id: 'shockley',
      tag: 'Electrical formula',
      title: SHOCKLEY_DIODE_EQUATION.title,
      html: SHOCKLEY_DIODE_EQUATION.html,
      legend: SHOCKLEY_DIODE_EQUATION.legend,
    },
    capacitiveReactance: {
      id: 'capacitive-reactance',
      tag: 'Electrical formula',
      title: 'Capacitive reactance',
      html: [
        '<span class="eq-inline" aria-label="X sub C equals 1 over 2 pi f C">',
        '<span class="eq-term"><i class="eq-var">X</i><sub>C</sub></span>',
        '<span class="eq-op">=</span>',
        '<span class="eq-frac"><span class="eq-num">1</span>',
        '<span class="eq-den">2<i class="eq-var">π</i><i class="eq-var">f</i><i class="eq-var">C</i></span></span>',
        '</span>',
      ].join(''),
      legend: 'f frequency · C capacitance · |Z| ≈ X_C (ideal)',
    },
    nonInvertingGain: {
      id: 'non-inverting-gain',
      tag: 'Electrical formula',
      title: 'Non-inverting closed-loop gain',
      html: [
        '<span class="eq-inline" aria-label="A equals 1 plus R sub f over R sub g">',
        '<i class="eq-var">A</i><span class="eq-op">=</span>',
        '<span class="eq-numeral">1</span><span class="eq-op">+</span>',
        '<span class="eq-frac"><span class="eq-num"><i class="eq-var">R</i><sub>f</sub></span>',
        '<span class="eq-den"><i class="eq-var">R</i><sub>g</sub></span></span>',
        '</span>',
      ].join(''),
      legend: 'R_f feedback · R_g ground leg · ideal op amp',
    },
    voltageDivider: {
      id: 'voltage-divider',
      tag: 'Electrical formula',
      title: 'Voltage divider',
      html: [
        '<span class="eq-inline" aria-label="V out equals V in times R 2 over R 1 plus R 2">',
        '<span class="eq-term"><i class="eq-var">V</i><sub>out</sub></span>',
        '<span class="eq-op">=</span>',
        '<span class="eq-term"><i class="eq-var">V</i><sub>in</sub></span>',
        '<span class="eq-op">·</span>',
        '<span class="eq-frac"><span class="eq-num"><i class="eq-var">R</i><sub>2</sub></span>',
        '<span class="eq-den"><i class="eq-var">R</i><sub>1</sub><span class="eq-op">+</span><i class="eq-var">R</i><sub>2</sub></span></span>',
        '</span>',
      ].join(''),
      legend: 'Pot wiper ≈ R₁ / R₂ split of total R',
    },
    inductiveReactance: {
      id: 'inductive-reactance',
      tag: 'Electrical formula',
      title: 'Inductive reactance',
      html: [
        '<span class="eq-inline" aria-label="X sub L equals 2 pi f L">',
        '<span class="eq-term"><i class="eq-var">X</i><sub>L</sub></span>',
        '<span class="eq-op">=</span>',
        '<span class="eq-numeral">2</span><i class="eq-var">π</i><i class="eq-var">f</i><i class="eq-var">L</i>',
        '</span>',
      ].join(''),
      legend: 'f frequency · L inductance · |Z| ≈ X_L (ideal choke)',
    },
    pickupCoilResistance: {
      id: 'pickup-coil-resistance',
      tag: 'Electrical formula',
      title: 'Pickup coil DC resistance',
      html: [
        '<span class="eq-inline" aria-label="R equals N times ell times rho over A">',
        '<i class="eq-var">R</i><span class="eq-op">=</span>',
        '<i class="eq-var">N</i><i class="eq-var">ℓ</i>',
        '<span class="eq-frac"><span class="eq-num"><i class="eq-var">ρ</i></span>',
        '<span class="eq-den"><i class="eq-var">A</i></span></span>',
        '</span>',
      ].join(''),
      legend: 'N turns · ℓ mean turn length · ρ/A from AWG · from bobbin cavity, wire & offsets',
    },
    pickupCoilInductance: {
      id: 'pickup-coil-inductance',
      tag: 'Electrical formula',
      title: 'Pickup coil inductance',
      html: [
        '<span class="eq-inline" aria-label="L equals mu sub 0 mu sub eff N squared A over ell sub m">',
        '<i class="eq-var">L</i><span class="eq-op">=</span>',
        '<i class="eq-var">μ</i><sub>0</sub><i class="eq-var">μ</i><sub>eff</sub>',
        '<span class="eq-frac"><span class="eq-num"><i class="eq-var">N</i><sup>2</sup><i class="eq-var">A</i></span>',
        '<span class="eq-den"><i class="eq-var">ℓ</i><sub>m</sub></span></span>',
        '</span>',
      ].join(''),
      legend: 'A tip / pole area (bevel) · ℓ_m magnet height · μ_eff from magnet + stainless poles',
    },
    pickupPoleMaterials: {
      id: 'pickup-pole-materials',
      tag: 'Electrical formula',
      title: 'Pole & baseplate materials',
      html: [
        '<span class="eq-inline" aria-label="mu eff from magnet and stainless; eddy damp from nickel silver">',
        '<i class="eq-var">μ</i><sub>eff</sub><span class="eq-op">←</span>',
        '<i class="eq-var">M</i><span class="eq-op">+</span><i class="eq-var">SS</i>',
        '<span class="eq-op">·</span>',
        '<i class="eq-var">L</i><span class="eq-op">×</span><i class="eq-var">η</i><sub>eddy</sub>',
        '</span>',
      ].join(''),
      legend: 'S/P = stainless steel (μ_r≈1, eddy) · M = magnet grade · baseplate = NiAg/brass eddy damp',
    },
    transformerRatio: {
      id: 'transformer-ratio',
      tag: 'Electrical formula',
      title: 'Transformer turns ratio',
      html: [
        '<span class="eq-inline" aria-label="V p over V s equals N p over N s equals n">',
        '<span class="eq-frac"><span class="eq-num"><i class="eq-var">V</i><sub>p</sub></span>',
        '<span class="eq-den"><i class="eq-var">V</i><sub>s</sub></span></span>',
        '<span class="eq-op">=</span>',
        '<span class="eq-frac"><span class="eq-num"><i class="eq-var">N</i><sub>p</sub></span>',
        '<span class="eq-den"><i class="eq-var">N</i><sub>s</sub></span></span>',
        '<span class="eq-op">=</span><i class="eq-var">n</i>',
        '</span>',
      ].join(''),
      legend: 'Ideal · impedance scales ≈ n² · watch polarity dots',
    },
    ledBallast: {
      id: 'led-ballast',
      tag: 'Electrical formula',
      title: 'LED series resistor',
      html: [
        '<span class="eq-inline" aria-label="R equals V s minus V f over I f">',
        '<i class="eq-var">R</i><span class="eq-op">=</span>',
        '<span class="eq-frac"><span class="eq-num"><i class="eq-var">V</i><sub>s</sub><span class="eq-op">−</span><i class="eq-var">V</i><sub>f</sub></span>',
        '<span class="eq-den"><i class="eq-var">I</i><sub>f</sub></span></span>',
        '</span>',
      ].join(''),
      legend: 'V_s supply · V_f LED drop · I_f LED current · P = I_f²R',
    },
    supplyPower: {
      id: 'supply-power',
      tag: 'Electrical formula',
      title: 'DC power',
      html: [
        '<span class="eq-inline" aria-label="P equals V I">',
        '<i class="eq-var">P</i><span class="eq-op">=</span>',
        '<i class="eq-var">V</i><i class="eq-var">I</i>',
        '</span>',
      ].join(''),
      legend: 'Keep load current ≤ supply / transformer rating',
    },
    ledForwardPower: {
      id: 'led-forward-power',
      tag: 'Electrical formula',
      title: 'LED forward power',
      html: [
        '<span class="eq-inline" aria-label="P equals V sub f times I sub f">',
        '<i class="eq-var">P</i><span class="eq-op">=</span>',
        '<i class="eq-var">V</i><sub>f</sub><i class="eq-var">I</i><sub>f</sub>',
        '</span>',
      ].join(''),
      legend: 'Dissipation in the LED die · keep P ≤ package rating',
    },
    kirchhoffVoltage: {
      id: 'kirchhoff-voltage',
      tag: 'Electrical formula',
      title: "Kirchhoff's voltage law",
      html: [
        '<span class="eq-inline" aria-label="sum of V equals zero">',
        '<span class="eq-term">∑<i class="eq-var">V</i></span>',
        '<span class="eq-op">=</span>',
        '<span class="eq-numeral">0</span>',
        '</span>',
        '<span class="eq-sep">·</span>',
        '<span class="eq-inline" aria-label="V s equals V f plus I f R">',
        '<i class="eq-var">V</i><sub>s</sub><span class="eq-op">=</span>',
        '<i class="eq-var">V</i><sub>f</sub><span class="eq-op">+</span>',
        '<i class="eq-var">I</i><sub>f</sub><i class="eq-var">R</i>',
        '</span>',
      ].join(''),
      legend: 'Closed loop · supply drop equals LED + ballast drops',
    },
    kirchhoffCurrent: {
      id: 'kirchhoff-current',
      tag: 'Electrical formula',
      title: "Kirchhoff's current law",
      html: [
        '<span class="eq-inline" aria-label="sum of I equals zero">',
        '<span class="eq-term">∑<i class="eq-var">I</i></span>',
        '<span class="eq-op">=</span>',
        '<span class="eq-numeral">0</span>',
        '</span>',
      ].join(''),
      legend: 'Current into a node equals current out · series LED chain shares I_f',
    },
    necBranchCircuit: {
      id: 'nec-branch-circuit',
      tag: 'Electrical formula',
      title: 'NEC branch loading (informational)',
      html: [
        '<span class="eq-inline" aria-label="I load less than or equal to 0.8 I breaker">',
        '<i class="eq-var">I</i><sub>load</sub>',
        '<span class="eq-op">≤</span>',
        '<span class="eq-numeral">0.8</span>',
        '<i class="eq-var">I</i><sub>OCPD</sub>',
        '</span>',
      ].join(''),
      legend: 'NFPA 70 continuous-load guidance · schematic only — not a permit drawing',
    },
  };

  function listDiodeMaterialPresets() {
    return ['led', 'silicon', 'germanium']
      .map((id) => DIODE_MATERIAL_PRESETS[id])
      .filter(Boolean);
  }

  function getDiodeMaterialPreset(id) {
    return DIODE_MATERIAL_PRESETS[id] || DIODE_MATERIAL_PRESETS.silicon;
  }

  function listResistorTypePresets() {
    return ['metal-film', 'carbon-film', 'metal-oxide', 'wirewound']
      .map((id) => RESISTOR_TYPE_PRESETS[id])
      .filter(Boolean);
  }

  function getResistorTypePreset(id) {
    return RESISTOR_TYPE_PRESETS[id] || RESISTOR_TYPE_PRESETS['metal-film'];
  }

  function getElectricalFormula(id) {
    if (!id) return null;
    if (ELECTRICAL_FORMULAS[id]) return ELECTRICAL_FORMULAS[id];
    const needle = String(id);
    return Object.values(ELECTRICAL_FORMULAS).find((f) => f.id === needle) || null;
  }

  function listElectricalFormulas(...ids) {
    return ids.map((id) => getElectricalFormula(id)).filter(Boolean);
  }

  /**
   * Dual-triode noval (B9A) — 12AX7 / ECC83 family.
   * Amp preamp stages, phase inverters (12AT7), and tube pedals.
   */
  function dualTriodeTubeParts(bx = 0, by = 0) {
    return makeTubePinRow(bx, by, 32, 50, TUBE_PINOUT_PRESETS['12ax7'].pins);
  }

  /**
   * Octal power tube — 6V6-GT family (also usable for 6L6 / EL34-style octal wiring).
   * NC pins stay visible as "—" for socket pin-count reference.
   */
  function powerOctalTubeParts(bx = 0, by = 0) {
    const pins = [
      { label: '—', role: 'NC', color: '#666666', enabled: true, title: 'Pin 1 NC' },
      { label: 'H', role: 'H', color: '#ffd700', title: 'Pin 2 Heater' },
      { label: 'P', role: 'P', color: '#e74c3c', title: 'Pin 3 Plate' },
      { label: 'G2', role: 'G2', color: '#2ecc71', title: 'Pin 4 Screen' },
      { label: 'G1', role: 'G1', color: '#4aa3ff', title: 'Pin 5 Grid' },
      { label: '—', role: 'NC', color: '#666666', enabled: true, title: 'Pin 6 NC' },
      { label: 'K', role: 'K', color: '#ffffff', title: 'Pin 7 Cathode' },
      { label: 'H', role: 'H', color: '#ffd700', title: 'Pin 8 Heater' },
    ];
    return makeTubePinRow(bx, by, 40, 56, pins);
  }

  /** Generic 9-pin tube — pinout + enables set from cog menu. */
  function genericTubeParts(bx = 0, by = 0) {
    return makeTubePinRow(bx, by, 36, 52, TUBE_PINOUT_PRESETS.custom.pins);
  }

  /** @deprecated alias */
  function vacuumTubeParts(bx = 0, by = 0) {
    return dualTriodeTubeParts(bx, by);
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

  /** Chassis / case ground lug for custom assets (IEEE §3.9.2). */
  function makeEditorChassisGroundTerminal(draft) {
    const { w: tw, h: th } = getDraftTermSize(draft);
    const isSwitch = String(draft.cssClass || '').includes('switch')
      || draft.switchThrow
      || /switch/i.test(String(draft.subtype || ''));
    const className = isSwitch
      ? 'ground switch-case-ground is-ground'
      : 'ground pot-case-ground is-ground';
    return {
      label: 'G',
      role: 'G',
      color: '#ffffff',
      className,
      termName: 'Chassis / case ground',
      symbol: 'G',
      title: 'Chassis / case ground (G)',
      isGround: true,
      signalMark: 'chassis',
      partKind: 'terminal',
      x: snapEditor(draft.bodyX - tw - TERM_GAP),
      y: snapEditor(draft.bodyY + Math.max(0, (draft.bodyH - th) / 2)),
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

  /** Remove 4-conductor loom sheath + fan tips from a custom-asset draft. */
  function removeFourConductorLoom(draft) {
    if (!draft) return;
    draft.terminals = (draft.terminals || []).filter((t) => termPartKind(t) !== 'conductor');
    draft.hasLoom = false;
    delete draft.loomJunction;
    delete draft.loomColor;
    draft.cssClass = String(draft.cssClass || 'custom')
      .split(/\s+/)
      .filter((c) => c && c !== 'dualcoil')
      .join(' ') || 'custom';
    if (editorSelection?.type === 'loom') editorSelection = null;
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
  function snapEditorLoomToBody(draft, rawJx, rawJy, free = false) {
    if (free) {
      draft.loomJunction = { x: rawJx, y: rawJy };
      layoutEditorConductorFan(draft);
      return draft.loomJunction;
    }
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
      valueFields: ['coilWinds', 'impedance', 'inductance'],
      placeLabel: 'SC',
      bodyX: 0,
      bodyY: 0,
      bodyW: 70,
      bodyH: 48,
      cssClass: 'singlecoil',
      layout: 'absolute',
      hideStateLabel: true,
      needsGrounding: true,
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
      valueFields: ['coilWinds', 'impedance', 'inductance'],
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
      name: '4 Conductor HB',
      category: 'pickup',
      subtype: '4conductor',
      builtin: true,
      needsGrounding: true,
      valueFields: ['coilWinds', 'impedance', 'inductance'],
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
      needsGrounding: true,
      placeLabel: '3WAY',
      bodyW: 48,
      bodyH: 56,
      cssClass: 'dpdt',
      layout: 'grid-3x2',
      /*
       * Pin grid (row-major):
       *   T1 T2   →  1 4
       *   T3 T4   →  2 5  (commons)
       *   T5 T6   →  3 6
       * T7 = chassis / case ground under the grid (NA / IEEE §3.9.2).
       * Default throw: ON-ON-ON (all three positions conduct).
       * Primary names: Up (1), Middle (2), Down (3).
       */
      states: [
        {
          id: 1,
          label: 'Up (1)',
          terminalActive: [false, false, true, true, true, true, false],
          bridges: [[2, 4], [3, 5]], // 2-3, 5-6
        },
        {
          id: 2,
          label: 'Middle (2)',
          terminalActive: [true, true, true, true, true, true, false], // all closed-contact poles
          bridges: [[2, 0], [2, 4], [3, 1], [3, 5]], // 2-1, 2-3, 5-4, 5-6
        },
        {
          id: 3,
          label: 'Down (3)',
          terminalActive: [true, true, true, true, false, false, false],
          bridges: [[2, 0], [3, 1]], // 2-1, 5-4
        },
      ],
      terminals: switchTerminalsWithCaseGround(6),
    },
    {
      id: 'dpdt-on-off-on',
      name: 'ON-OFF-ON',
      category: 'switch',
      subtype: 'dpdt-on-off-on',
      typeGroup: '3way',
      switchThrow: 'on-off-on',
      builtin: true,
      needsGrounding: true,
      placeLabel: 'OFO',
      bodyW: 48,
      bodyH: 56,
      cssClass: 'dpdt',
      layout: 'grid-3x2',
      /*
       * Type 1: Up T3/T4/T5/T6, Middle off, Down T1/T2/T3/T4.
       * Type 2: Up/Down active sets swapped.
       * T7 = chassis / case ground (centered under pole grid — NA / IEEE practice).
       */
      states: [
        {
          id: 1,
          label: 'Up (1)',
          terminalActive: [false, false, true, true, true, true, false], // T3, T4, T5, T6
          bridges: [[2, 4], [3, 5]], // T3–T5, T4–T6
        },
        {
          id: 2,
          label: 'Middle (2)',
          terminalActive: [false, false, false, false, false, false, false],
          bridges: [],
        },
        {
          id: 3,
          label: 'Down (3)',
          terminalActive: [true, true, true, true, false, false, false], // T1, T2, T3, T4
          bridges: [[0, 2], [1, 3]], // T1–T3, T2–T4
        },
      ],
      terminals: switchTerminalsWithCaseGround(6),
    },
    {
      id: 'spst-on-off',
      name: 'ON-OFF',
      category: 'switch',
      subtype: 'spst-on-off',
      typeGroup: '1way',
      switchThrow: 'on-off',
      builtin: true,
      needsGrounding: true,
      placeLabel: '1WAY',
      bodyW: 40,
      bodyH: 48,
      cssClass: 'dpdt spst-on-off',
      layout: 'grid-1x2',
      /*
       * SPST: T1–T2 close when On; T3 = chassis / case ground.
       * Two states only (no middle).
       */
      states: [
        {
          id: 1,
          label: 'On (1)',
          terminalActive: [true, true, false],
          bridges: [[0, 1]],
        },
        {
          id: 2,
          label: 'Off (2)',
          terminalActive: [false, false, false],
          bridges: [],
        },
      ],
      terminals: switchTerminalsWithCaseGround(2),
    },
    {
      id: 'dpdt-on-on',
      name: 'ON-ON',
      category: 'switch',
      subtype: 'dpdt-on-on',
      typeGroup: '2way',
      switchThrow: 'on-on',
      builtin: true,
      needsGrounding: true,
      placeLabel: '2WAY',
      bodyW: 48,
      bodyH: 56,
      cssClass: 'dpdt',
      layout: 'grid-3x2',
      /*
       * Two throws only (no middle/off). Same pin grid as DPDT.
       * Type 1: Up T3/T4/T5/T6, Down T1/T2/T3/T4.
       * Type 2: Up/Down active sets swapped.
       * T7 = chassis / case ground (centered under pole grid — NA / IEEE practice).
       */
      states: [
        {
          id: 1,
          label: 'Up (1)',
          terminalActive: [false, false, true, true, true, true, false], // T3, T4, T5, T6
          bridges: [[2, 4], [3, 5]], // T3–T5, T4–T6
        },
        {
          id: 2,
          label: 'Down (2)',
          terminalActive: [true, true, true, true, false, false, false], // T1, T2, T3, T4
          bridges: [[0, 2], [1, 3]], // T1–T3, T2–T4
        },
      ],
      terminals: switchTerminalsWithCaseGround(6),
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
      name: 'Power Supply',
      category: 'power',
      subtype: 'ninevolt',
      builtin: true,
      needsGrounding: false,
      valueFields: ['voltage'],
      placeLabel: 'PSU',
      bodyX: 0,
      bodyY: 0,
      bodyW: 56,
      bodyH: 72,
      cssClass: 'ninevolt power-supply',
      layout: 'absolute',
      hideStateLabel: true,
      defaultValues: { voltage: '9V' },
      states: [
        { id: 0, terminalActive: [true, true] },
      ],
      terminals: powerSupplyTerminals(0, 0, 56, 72),
    },
    {
      id: 'potentiometer',
      name: 'Standard',
      category: 'component',
      subtype: 'potentiometer',
      potFamily: 'potentiometer',
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
      /* Lugs 1/2/3 resistive; side G is chassis/case ground (IEEE §3.9.2, connectable) */
      states: [
        { id: 0, terminalActive: [false, true, false, false] },
      ],
      terminals: potentiometerTerminals(0, 0, 64, 48),
    },
    (() => {
      const parts = pushPotOnOnParts(0, 0);
      /*
       * Push/Pull ON-ON: identical to 2-way ON-ON DPDT.
       * Shaft Pulled (1) ≡ switch Up · shaft Pushed (2) ≡ switch Down.
       * T1–T6 first (indices 0–5), then pot 1/2/3/G (6–9).
       * Type 1: Pulled T3–T6 · Pushed T1–T4.
       */
      const potIdle = [false, true, false, false]; // wiper stays lit; not hard-bridged
      return {
        id: 'push-pot-on-on',
        name: 'Push/Pull ON-ON',
        category: 'component',
        subtype: 'push-pot-on-on',
        potFamily: 'potentiometer',
        pushPull: true,
        switchThrow: 'on-on',
        builtin: true,
        menuHidden: true,
        needsGrounding: true,
        valueFields: ['resistance'],
        placeLabel: 'P/P',
        bodyX: parts.bodyX,
        bodyY: parts.bodyY,
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        cssClass: 'potentiometer push-pot',
        layout: 'absolute',
        hideStateLabel: true,
        states: [
          {
            id: 1,
            label: 'Pulled (1)',
            terminalActive: [false, false, true, true, true, true, ...potIdle],
            bridges: [[2, 4], [3, 5]], // T3–T5, T4–T6 (same as 2WAY Up)
          },
          {
            id: 2,
            label: 'Pushed (2)',
            terminalActive: [true, true, true, true, false, false, ...potIdle],
            bridges: [[0, 2], [1, 3]], // T1–T3, T2–T4 (same as 2WAY Down)
          },
        ],
        terminals: parts.terminals,
      };
    })(),
    (() => {
      const parts = capacitorParts(0, 0);
      return {
        id: 'capacitor',
        name: 'Capacitor',
        category: 'component',
        subtype: 'capacitor',
        builtin: true,
        needsGrounding: false,
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
    (() => {
      const parts = diodeParts(0, 0);
      return {
        id: 'diode',
        name: 'Diode',
        category: 'component',
        subtype: 'diode',
        builtin: true,
        needsGrounding: false,
        valueFields: ['forwardVoltage', 'reverseVoltage', 'forwardCurrent'],
        placeLabel: '',
        bodyX: parts.bodyX,
        bodyY: parts.bodyY,
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        cssClass: 'diode',
        layout: 'absolute',
        hideStateLabel: true,
        defaultMaterial: 'silicon',
        defaultValues: { ...DIODE_MATERIAL_PRESETS.silicon.defaults },
        /* Open between anode/cathode DC — not a hard short */
        states: [
          { id: 0, terminalActive: [false, false] },
        ],
        terminals: parts.terminals,
      };
    })(),
    (() => {
      const parts = resistorParts(0, 0);
      return {
        id: 'resistor',
        name: 'Resistor',
        category: 'component',
        subtype: 'resistor',
        builtin: true,
        needsGrounding: false,
        valueFields: ['resistance', 'powerRating', 'tolerance'],
        placeLabel: '',
        bodyX: parts.bodyX,
        bodyY: parts.bodyY,
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        cssClass: 'resistor',
        layout: 'absolute',
        hideStateLabel: true,
        defaultResistorType: 'metal-film',
        defaultValues: { ...RESISTOR_TYPE_PRESETS['metal-film'].defaults },
        /* Resistive path — not a hard short bridge (same rule as pots/coils) */
        states: [
          { id: 0, terminalActive: [false, false] },
        ],
        terminals: parts.terminals,
      };
    })(),
    (() => {
      const parts = transistorParts(0, 0);
      return {
        id: 'transistor',
        name: 'Transistor',
        category: 'component',
        subtype: 'transistor',
        builtin: true,
        needsGrounding: false,
        valueFields: ['hfe'],
        placeLabel: '',
        bodyX: parts.bodyX,
        bodyY: parts.bodyY,
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        cssClass: 'transistor',
        layout: 'absolute',
        hideStateLabel: true,
        /* Open between E/B/C — not a hard short */
        states: [
          { id: 0, terminalActive: [false, false, false] },
        ],
        terminals: parts.terminals,
      };
    })(),
    (() => {
      const parts = opampParts(0, 0);
      return {
        id: 'opamp',
        name: 'Op Amp',
        category: 'component',
        subtype: 'opamp',
        builtin: true,
        needsGrounding: false,
        valueFields: ['openLoopGain', 'gainBandwidth', 'slewRate', 'inputOffset', 'supplyVoltage'],
        placeLabel: 'OA',
        bodyX: parts.bodyX,
        bodyY: parts.bodyY,
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        cssClass: 'opamp',
        layout: 'absolute',
        hideStateLabel: true,
        defaultValues: {
          openLoopGain: '100000',
          gainBandwidth: '3',
          slewRate: '13',
          inputOffset: '3',
          supplyVoltage: '9',
        },
        /* Open between pins DC — not a hard short */
        states: [
          { id: 0, terminalActive: [false, false, false, false, false] },
        ],
        terminals: parts.terminals,
      };
    })(),
    (() => {
      const parts = genericTubeParts(0, 0);
      return {
        id: 'vacuum-tube',
        name: 'Vacuum Tube',
        category: 'component',
        subtype: 'vacuum-tube',
        tubeFamily: 'vacuum',
        tubeKind: 'generic',
        tubePinConfig: true,
        builtin: true,
        needsGrounding: true,
        valueFields: ['mu', 'plateDissipation', 'heaterVoltage'],
        placeLabel: 'TUBE',
        bodyX: parts.bodyX,
        bodyY: parts.bodyY,
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        cssClass: 'vacuum-tube',
        layout: 'absolute',
        hideStateLabel: true,
        defaultPinout: 'custom',
        states: [
          { id: 0, terminalActive: parts.terminals.map(() => false) },
        ],
        terminals: parts.terminals,
      };
    })(),
    {
      id: 'dc-jack',
      name: 'DC Jack',
      category: 'power',
      subtype: 'dc-jack',
      builtin: true,
      needsGrounding: false,
      valueFields: ['voltage', 'currentRating'],
      placeLabel: 'DC',
      bodyX: 0,
      bodyY: 0,
      bodyW: 56,
      bodyH: 40,
      cssClass: 'dc-jack',
      layout: 'absolute',
      hideStateLabel: true,
      defaultValues: { voltage: '9', currentRating: '0.5' },
      states: [{ id: 0, terminalActive: [true, true] }],
      terminals: dcJackTerminals(0, 0, 56, 40),
    },
    {
      id: 'heater-supply',
      name: 'Heater Supply',
      category: 'power',
      subtype: 'heater-supply',
      builtin: true,
      needsGrounding: false,
      valueFields: ['heaterVoltage', 'currentRating'],
      placeLabel: 'HTR',
      bodyX: 0,
      bodyY: 0,
      bodyW: 70,
      bodyH: 40,
      cssClass: 'heater-supply',
      layout: 'absolute',
      hideStateLabel: true,
      defaultValues: { heaterVoltage: '6.3', currentRating: '1' },
      states: [{ id: 0, terminalActive: [true, false, true] }],
      terminals: heaterSupplyTerminals(0, 0, 70, 40),
    },
    {
      id: 'hv-supply',
      name: 'B+ / HV Supply',
      category: 'power',
      subtype: 'hv-supply',
      builtin: true,
      needsGrounding: false,
      valueFields: ['voltage', 'currentRating'],
      placeLabel: 'B+',
      bodyX: 0,
      bodyY: 0,
      bodyW: 64,
      bodyH: 44,
      cssClass: 'hv-supply',
      layout: 'absolute',
      hideStateLabel: true,
      defaultValues: { voltage: '250', currentRating: '0.05' },
      states: [{ id: 0, terminalActive: [true, true] }],
      terminals: hvSupplyTerminals(0, 0, 64, 44),
    },
    {
      id: 'dual-rail',
      name: 'Dual-Rail Supply',
      category: 'power',
      subtype: 'dual-rail',
      builtin: true,
      needsGrounding: false,
      valueFields: ['supplyVoltage', 'currentRating'],
      placeLabel: '±V',
      bodyX: 0,
      bodyY: 0,
      bodyW: 70,
      bodyH: 44,
      cssClass: 'dual-rail',
      layout: 'absolute',
      hideStateLabel: true,
      defaultValues: { supplyVoltage: '±15', currentRating: '0.1' },
      states: [{ id: 0, terminalActive: [true, true, true] }],
      terminals: dualRailTerminals(0, 0, 70, 44),
    },
    {
      id: 'power-transformer',
      name: 'Power Transformer',
      category: 'power',
      subtype: 'power-transformer',
      builtin: true,
      needsGrounding: true,
      valueFields: ['primaryVoltage', 'secondaryVoltage', 'powerRating'],
      placeLabel: 'PT',
      bodyX: 0,
      bodyY: 0,
      bodyW: 64,
      bodyH: 48,
      cssClass: 'power-transformer',
      layout: 'absolute',
      hideStateLabel: true,
      defaultValues: { primaryVoltage: '120', secondaryVoltage: '250', powerRating: '50' },
      states: [{ id: 0, terminalActive: [false, false, false, false] }],
      terminals: transformerTerminals(0, 0, 64, 48),
    },
    (() => {
      const parts = inductorParts(0, 0);
      return {
        id: 'inductor',
        name: 'Inductor / Choke',
        category: 'component',
        subtype: 'inductor',
        builtin: true,
        needsGrounding: false,
        valueFields: ['inductance', 'currentRating'],
        placeLabel: 'L',
        bodyX: parts.bodyX,
        bodyY: parts.bodyY,
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        cssClass: 'inductor',
        layout: 'absolute',
        hideStateLabel: true,
        defaultValues: { inductance: '0.01', currentRating: '0.1' },
        states: [{ id: 0, terminalActive: [false, false] }],
        terminals: parts.terminals,
      };
    })(),
    {
      id: 'audio-transformer',
      name: 'Audio Transformer',
      category: 'component',
      subtype: 'audio-transformer',
      builtin: true,
      needsGrounding: true,
      valueFields: ['turnsRatio', 'impedance'],
      placeLabel: 'XFMR',
      bodyX: 0,
      bodyY: 0,
      bodyW: 56,
      bodyH: 40,
      cssClass: 'audio-transformer',
      layout: 'absolute',
      hideStateLabel: true,
      defaultValues: { turnsRatio: '1', impedance: '10000' },
      states: [{ id: 0, terminalActive: [false, false, false, false] }],
      terminals: transformerTerminals(0, 0, 56, 40),
    },
    (() => {
      const parts = ledIndicatorParts(0, 0);
      return {
        id: 'led-indicator',
        name: 'LED',
        category: 'component',
        subtype: 'led-indicator',
        builtin: true,
        needsGrounding: false,
        valueFields: ['forwardVoltage', 'forwardCurrent', 'glowColor'],
        placeLabel: 'LED',
        bodyX: parts.bodyX,
        bodyY: parts.bodyY,
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        cssClass: 'led-indicator',
        layout: 'absolute',
        hideStateLabel: true,
        defaultValues: {
          forwardVoltage: '2.0',
          forwardCurrent: '0.02',
          glowColor: '#ff3b30',
        },
        states: [{ id: 0, terminalActive: [false, false] }],
        terminals: parts.terminals,
      };
    })(),
    (() => {
      const parts = relayParts(0, 0);
      return {
        id: 'relay',
        name: 'Relay',
        category: 'component',
        subtype: 'relay',
        builtin: true,
        needsGrounding: true,
        valueFields: ['coilVoltage', 'resistance'],
        placeLabel: 'RLY',
        bodyX: parts.bodyX,
        bodyY: parts.bodyY,
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        cssClass: 'relay',
        layout: 'absolute',
        hideStateLabel: true,
        defaultValues: { coilVoltage: '12', resistance: '400' },
        states: [
          {
            id: 1,
            label: '1',
            terminalActive: [true, true, true, true, false],
            bridges: [[2, 3]], // C–NO when energized
          },
          {
            id: 2,
            label: '2',
            terminalActive: [false, false, true, false, true],
            bridges: [[2, 4]], // C–NC when idle
          },
        ],
        terminals: parts.terminals,
      };
    })(),
    {
      id: 'footswitch',
      name: 'Footswitch',
      category: 'switch',
      subtype: 'footswitch',
      builtin: true,
      needsGrounding: true,
      placeLabel: 'FSW',
      bodyX: 0,
      bodyY: 0,
      bodyW: 56,
      bodyH: 40,
      cssClass: 'footswitch',
      layout: 'absolute',
      hideStateLabel: true,
      terminalShape: 'rect',
      states: [
        {
          id: 1,
          label: '1',
          terminalActive: [true, true, false],
          bridges: [[0, 1]], // C–NO
        },
        {
          id: 2,
          label: '2',
          terminalActive: [true, false, true],
          bridges: [[0, 2]], // C–NC
        },
      ],
      terminals: footswitchTerminals(0, 0, 56, 40),
    },
  ];

  let customTemplates = [];
  let deps = null;
  let editorDraft = null;
  let editorDrag = null;
  let editorMarqueeEl = null;
  /** Multi-select state for the custom-asset preview (body / terminals / loom). */
  let editorSelectedBody = false;
  let editorSelectedTerminals = new Set();
  let editorSelectedLoom = false;
  let editorSelection = null;
  let contextTarget = null;
  let pendingDelete = null;
  /** Preview render layout: content offset + zoom (stage px → draft px). */
  let editorPreviewLayout = { ox: 0, oy: 0, zoom: 1, stageW: EDITOR_STAGE_MIN_W, stageH: EDITOR_STAGE_MIN_H };

  const menuEl = () => document.getElementById('asset-context-menu');
  const deleteConfirmEl = () => document.getElementById('asset-delete-confirm');
  const menuListEl = () => document.getElementById('context-menu-items');
  const editorEl = () => document.getElementById('asset-editor');

  function snapEditor(v, free = false) {
    if (free) return v;
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
  function snapAxisToBodyEdges(raw, targets, free = false) {
    if (free) return raw;
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
   * Shift free-move skips grid and magnetic snap.
   */
  function snapTerminalToBody(rawX, rawY, term, draft, free = false) {
    if (free) return { x: rawX, y: rawY };
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
    if (labelEl) editorDraft.placeLabel = labelEl.value.slice(0, 24);
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
        fillFloatLabelWithSignalMark(float, text);
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
      const raw =
        localStorage.getItem(STORAGE_KEY)
        || localStorage.getItem(STORAGE_KEY_LEGACY)
        || '[]';
      customTemplates = JSON.parse(raw);
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
    const legacy = {
      'tube-generic': 'vacuum-tube',
      'tube-12ax7': 'vacuum-tube',
      'tube-6v6': 'vacuum-tube',
    };
    const resolved = legacy[id] || id;
    return getAllTemplates().find((t) => t.id === resolved) || null;
  }

  function defaultTerminals(category, subtype, draft) {
    const bx = draft.bodyX;
    const by = draft.bodyY;
    const bw = draft.bodyW;
    const shape = draft.terminalShape || (category === 'switch' || category === 'jack' ? 'rect' : 'square');
    if (category === 'pickup' && subtype === 'singlecoil') {
      return singleCoilTerminalPair(bx, by, bw, draft.bodyH, shape);
    }
    if (category === 'pickup' && (subtype === 'dualcoil' || subtype === '4conductor')) {
      return dualCoilTerminals(bx, by, bw, draft.bodyH, shape);
    }
    if (category === 'jack' && subtype === 'monooutput') {
      return monoOutputTerminals(bx, by, bw, draft.bodyH);
    }
    if (category === 'jack' && subtype === 'stereooutput') {
      return stereoOutputTerminals(bx, by, bw, draft.bodyH);
    }
    if (category === 'power' && subtype === 'ninevolt') {
      return powerSupplyTerminals(bx, by, bw, draft.bodyH);
    }
    if (category === 'power' && subtype === 'dc-jack') {
      return dcJackTerminals(bx, by, bw, draft.bodyH);
    }
    if (category === 'power' && subtype === 'heater-supply') {
      return heaterSupplyTerminals(bx, by, bw, draft.bodyH);
    }
    if (category === 'power' && subtype === 'hv-supply') {
      return hvSupplyTerminals(bx, by, bw, draft.bodyH);
    }
    if (category === 'power' && subtype === 'dual-rail') {
      return dualRailTerminals(bx, by, bw, draft.bodyH);
    }
    if (category === 'power' && subtype === 'power-transformer') {
      return transformerTerminals(bx, by, bw, draft.bodyH);
    }
    if (category === 'component' && subtype === 'inductor') {
      const parts = inductorParts(bx, by);
      draft.bodyX = parts.bodyX;
      draft.bodyY = parts.bodyY;
      draft.bodyW = parts.bodyW;
      draft.bodyH = parts.bodyH;
      return parts.terminals;
    }
    if (category === 'component' && subtype === 'led-indicator') {
      const parts = ledIndicatorParts(bx, by);
      draft.bodyX = parts.bodyX;
      draft.bodyY = parts.bodyY;
      draft.bodyW = parts.bodyW;
      draft.bodyH = parts.bodyH;
      return parts.terminals;
    }
    if (category === 'component' && subtype === 'audio-transformer') {
      return transformerTerminals(bx, by, bw, draft.bodyH);
    }
    if (category === 'component' && subtype === 'relay') {
      const parts = relayParts(bx, by);
      draft.bodyX = parts.bodyX;
      draft.bodyY = parts.bodyY;
      draft.bodyW = parts.bodyW;
      draft.bodyH = parts.bodyH;
      return parts.terminals;
    }
    if (category === 'switch' && subtype === 'footswitch') {
      return footswitchTerminals(bx, by, bw, draft.bodyH);
    }
    if (category === 'component' && subtype === 'potentiometer') {
      return potentiometerTerminals(bx, by, bw, draft.bodyH);
    }
    if (category === 'component' && subtype === 'push-pot-on-on') {
      const parts = pushPotOnOnParts(bx, by);
      draft.bodyX = parts.bodyX;
      draft.bodyY = parts.bodyY;
      draft.bodyW = parts.bodyW;
      draft.bodyH = parts.bodyH;
      return parts.terminals;
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
    if (category === 'component' && subtype === 'diode') {
      const tip = 10;
      const lead = 2 * UNIT;
      const cx = bx + bw / 2;
      return [
        {
          label: '',
          role: 'K',
          color: 'transparent',
          className: 'cap-term',
          partKind: 'lead',
          title: 'Cathode (K)',
          x: cx - tip / 2,
          y: by - lead,
          w: tip,
          h: tip,
        },
        {
          label: '',
          role: 'A',
          color: 'transparent',
          className: 'cap-term',
          partKind: 'lead',
          title: 'Anode (A)',
          x: cx - tip / 2,
          y: by + draft.bodyH + lead - tip,
          w: tip,
          h: tip,
        },
      ];
    }
    if (category === 'component' && subtype === 'resistor') {
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
          title: 'Resistor lead',
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
          title: 'Resistor lead',
          x: cx - tip / 2,
          y: by + draft.bodyH + lead - tip,
          w: tip,
          h: tip,
        },
      ];
    }
    if (category === 'component' && subtype === 'transistor') {
      const tip = 10;
      const tipGap = 2;
      const lead = 2 * UNIT;
      const tipsSpan = tip * 3 + tipGap * 2;
      const tipStartX = bx + (bw - tipsSpan) / 2;
      const tipY = by + draft.bodyH + lead - tip;
      return ['E', 'B', 'C'].map((role, i) => ({
        label: '',
        role,
        color: 'transparent',
        className: 'cap-term',
        partKind: 'lead',
        x: tipStartX + i * (tip + tipGap),
        y: tipY,
        w: tip,
        h: tip,
      }));
    }
    if (category === 'component' && subtype === 'opamp') {
      const parts = opampParts(bx, by);
      draft.bodyX = parts.bodyX;
      draft.bodyY = parts.bodyY;
      draft.bodyW = parts.bodyW;
      draft.bodyH = parts.bodyH;
      return parts.terminals;
    }
    if (category === 'component' && (subtype === 'vacuum-tube' || subtype === 'tube-generic'
      || subtype === 'tube-12ax7' || subtype === 'tube-6v6')) {
      return genericTubeParts(bx, by).terminals;
    }
    if (category === 'switch' && subtype === 'spst-on-off') {
      const { w: tw, h: th } = getTermSize(shape);
      const gap = TERM_GAP;
      const startX = bx + snapEditor((bw - tw) / 2);
      const startY = by + draft.bodyH + TERM_BELOW_BODY;
      return [
        { ...switchTerminalSpec(0), x: startX, y: startY },
        { ...switchTerminalSpec(1), x: startX, y: startY + th + gap },
        { ...switchCaseGroundSpec(), x: startX, y: startY + 2 * (th + gap) },
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
            ...switchTerminalSpec(i),
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
    if (category === 'switch' && subtype === 'dpdt') return { bodyW: 48, bodyH: 56, placeLabel: '3WAY' };
    if (category === 'switch' && subtype === 'dpdt-on-off-on') return { bodyW: 48, bodyH: 56, placeLabel: 'OFO' };
    if (category === 'switch' && subtype === 'dpdt-on-on') return { bodyW: 48, bodyH: 56, placeLabel: '2WAY' };
    if (category === 'switch' && subtype === 'spst-on-off') return { bodyW: 40, bodyH: 48, placeLabel: '1WAY' };
    if (category === 'jack' && subtype === 'monooutput') return { bodyW: 70, bodyH: 40, placeLabel: 'OUT' };
    if (category === 'jack' && subtype === 'stereooutput') return { bodyW: 90, bodyH: 40, placeLabel: 'STR' };
    if (category === 'power' && subtype === 'ninevolt') return { bodyW: 56, bodyH: 72, placeLabel: 'PSU' };
    if (category === 'power' && subtype === 'dc-jack') return { bodyW: 56, bodyH: 40, placeLabel: 'DC' };
    if (category === 'power' && subtype === 'heater-supply') return { bodyW: 70, bodyH: 40, placeLabel: 'HTR' };
    if (category === 'power' && subtype === 'hv-supply') return { bodyW: 64, bodyH: 44, placeLabel: 'B+' };
    if (category === 'power' && subtype === 'dual-rail') return { bodyW: 70, bodyH: 44, placeLabel: '±V' };
    if (category === 'power' && subtype === 'power-transformer') return { bodyW: 64, bodyH: 48, placeLabel: 'PT' };
    if (category === 'component' && subtype === 'inductor') {
      const parts = inductorParts(0, 0);
      return { bodyW: parts.bodyW, bodyH: parts.bodyH, placeLabel: 'L' };
    }
    if (category === 'component' && subtype === 'led-indicator') {
      const parts = ledIndicatorParts(0, 0);
      return { bodyW: parts.bodyW, bodyH: parts.bodyH, placeLabel: 'LED' };
    }
    if (category === 'component' && subtype === 'audio-transformer') {
      return { bodyW: 56, bodyH: 40, placeLabel: 'XFMR' };
    }
    if (category === 'component' && subtype === 'relay') {
      const parts = relayParts(0, 0);
      return {
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        bodyX: parts.bodyX,
        bodyY: parts.bodyY,
        placeLabel: 'RLY',
      };
    }
    if (category === 'switch' && subtype === 'footswitch') {
      return { bodyW: 56, bodyH: 40, placeLabel: 'FSW' };
    }
    if (category === 'component' && subtype === 'potentiometer') return { bodyW: 64, bodyH: 48, placeLabel: 'POT' };
    if (category === 'component' && subtype === 'push-pot-on-on') {
      const parts = pushPotOnOnParts(0, 0);
      return {
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        bodyX: parts.bodyX,
        bodyY: parts.bodyY,
        placeLabel: 'P/P',
      };
    }
    if (category === 'component' && subtype === 'capacitor') {
      const parts = capacitorParts(0, 0);
      return {
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        placeLabel: '',
      };
    }
    if (category === 'component' && subtype === 'diode') {
      const parts = diodeParts(0, 0);
      return {
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        placeLabel: '',
      };
    }
    if (category === 'component' && subtype === 'resistor') {
      const parts = resistorParts(0, 0);
      return {
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        placeLabel: '',
      };
    }
    if (category === 'component' && subtype === 'transistor') {
      const parts = transistorParts(0, 0);
      return {
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        placeLabel: '',
      };
    }
    if (category === 'component' && subtype === 'opamp') {
      const parts = opampParts(0, 0);
      return {
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        bodyX: parts.bodyX,
        bodyY: parts.bodyY,
        placeLabel: 'OA',
      };
    }
    if (category === 'component' && (subtype === 'vacuum-tube' || subtype === 'tube-generic'
      || subtype === 'tube-12ax7' || subtype === 'tube-6v6')) {
      const parts = genericTubeParts(0, 0);
      return {
        bodyW: parts.bodyW,
        bodyH: parts.bodyH,
        placeLabel: 'TUBE',
      };
    }
    if (category === 'pickup' && (subtype === 'dualcoil' || subtype === '4conductor')) {
      return { bodyW: 120, bodyH: 48, placeLabel: subtype === '4conductor' ? '4C' : 'HB' };
    }
    return { bodyW: 70, bodyH: 48, placeLabel: 'PU' };
  }

  function defaultTerminalShape(category) {
    return category === 'switch' || category === 'jack' ? 'rect' : 'square';
  }

  function clearEditorSelectionState() {
    editorSelectedBody = false;
    editorSelectedTerminals = new Set();
    editorSelectedLoom = false;
    editorSelection = null;
  }

  function refreshEditorSelectionVisuals() {
    const stage = document.querySelector('#asset-editor-preview .asset-editor-stage');
    if (!stage) return;
    stage.querySelectorAll('.asset-editor-body.selected, .asset-editor-terminal.selected, .asset-editor-loom-handle.selected').forEach((el) => {
      el.classList.remove('selected');
    });
    if (editorSelectedBody) {
      stage.querySelector('.asset-editor-body')?.classList.add('selected');
    }
    editorSelectedTerminals.forEach((idx) => {
      stage.querySelector(`.asset-editor-terminal[data-idx="${idx}"]`)?.classList.add('selected');
    });
    if (editorSelectedLoom) {
      stage.querySelector('.asset-editor-loom-handle')?.classList.add('selected');
    }
  }

  function setEditorSelection(selection, { additive = false } = {}) {
    if (!additive) {
      editorSelectedBody = false;
      editorSelectedTerminals = new Set();
      editorSelectedLoom = false;
    }
    if (!selection) {
      editorSelection = null;
      refreshEditorSelectionVisuals();
      return;
    }
    editorSelection = selection;
    if (selection.type === 'body') {
      editorSelectedBody = true;
    } else if (selection.type === 'terminal') {
      editorSelectedTerminals.add(selection.idx);
    } else if (selection.type === 'loom') {
      editorSelectedLoom = true;
    }
    refreshEditorSelectionVisuals();
  }

  function formatEditorDraftValueChip(key, raw) {
    const def = ELECTRICAL_VALUE_DEFS[key];
    if (!def) return '';
    let text = String(raw ?? '').trim();
    if (!text) return '';
    const isPot = editorDraft
      && (editorDraft.subtype === 'potentiometer'
        || editorDraft.potFamily === 'potentiometer'
        || editorDraft.electricalPreset === 'potentiometer');
    if (def.key === 'resistance' && isPot) {
      const n = parseFloat(String(text).replace(/[^\d.]/g, ''));
      if (Number.isFinite(n) && n > 0) {
        const k = Math.max(1, Math.round(n / 1000));
        return `${k}kΩ`;
      }
    }
    if (def.symbol) {
      const sym = String(def.symbol).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(`^${sym}\\s*`, 'i'), '').trim() || text;
    }
    if (def.unit === 'Ω' || def.unit === 'Ω') {
      if (!/[ΩΩ]/.test(text) && !/ohm/i.test(text)) text = `${text}Ω`;
    } else if (def.unit && !new RegExp(`${def.unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(text)) {
      text = `${text}${def.unit}`;
    }
    return text;
  }

  function fillEditorBodyLabel(bodyEl) {
    if (!bodyEl || !editorDraft) return;
    bodyEl.classList.add('asset-label-box');
    bodyEl.querySelector('.asset-editor-body-label')?.remove();
    let stack = bodyEl.querySelector('.asset-label-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'asset-label-stack';
      bodyEl.insertBefore(stack, bodyEl.firstChild);
    }
    stack.replaceChildren();
    const nameEl = document.createElement('span');
    nameEl.className = 'asset-label-chip asset-label-name';
    nameEl.textContent = (editorDraft.placeLabel && String(editorDraft.placeLabel).trim())
      || editorDraft.name
      || 'CU';
    stack.appendChild(nameEl);
    const valsEl = document.createElement('div');
    valsEl.className = 'asset-label-values';
    const keys = normalizeValueFields(editorDraft.valueFields);
    keys.forEach((key) => {
      const chipText = formatEditorDraftValueChip(key, editorDraft.defaultValues?.[key]);
      if (!chipText) return;
      const chip = document.createElement('span');
      chip.className = 'asset-label-chip asset-label-value';
      chip.textContent = chipText;
      valsEl.appendChild(chip);
    });
    if (valsEl.childNodes.length) stack.appendChild(valsEl);
  }

  function scaleEditorBodyLabel(bodyEl) {
    const stack = bodyEl?.querySelector?.('.asset-label-stack');
    if (!bodyEl || !stack) return;
    bodyEl.style.setProperty('--asset-label-scale', '1');
    const pad = 4;
    const availW = Math.max(1, (bodyEl.clientWidth || editorDraft?.bodyW || 1) - pad);
    const availH = Math.max(1, (bodyEl.clientHeight || editorDraft?.bodyH || 1) - pad);
    const needW = Math.max(1, stack.scrollWidth || stack.offsetWidth || 1);
    const needH = Math.max(1, stack.scrollHeight || stack.offsetHeight || 1);
    const scale = Math.min(1, availW / needW, availH / needH);
    bodyEl.style.setProperty('--asset-label-scale', String(Math.max(0.45, scale)));
  }

  function editorRectsIntersect(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function ensureEditorMarquee(stage) {
    if (!editorMarqueeEl || !editorMarqueeEl.isConnected) {
      editorMarqueeEl = document.createElement('div');
      editorMarqueeEl.className = 'asset-editor-marquee hidden';
    }
    if (editorMarqueeEl.parentNode !== stage) stage.appendChild(editorMarqueeEl);
    return editorMarqueeEl;
  }

  function updateEditorMarqueeBox(x1, y1, x2, y2) {
    if (!editorMarqueeEl) return;
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    editorMarqueeEl.classList.remove('hidden');
    editorMarqueeEl.style.left = `${left}px`;
    editorMarqueeEl.style.top = `${top}px`;
    editorMarqueeEl.style.width = `${Math.abs(x2 - x1)}px`;
    editorMarqueeEl.style.height = `${Math.abs(y2 - y1)}px`;
  }

  function hideEditorMarquee() {
    editorMarqueeEl?.classList.add('hidden');
  }

  function applyEditorMarqueeSelection(rect, { additive = false } = {}) {
    if (!editorDraft) return;
    if (!additive) clearEditorSelectionState();
    const bodyRect = {
      left: draftToStageX(editorDraft.bodyX),
      top: draftToStageY(editorDraft.bodyY),
      right: draftToStageX(editorDraft.bodyX) + editorDraft.bodyW,
      bottom: draftToStageY(editorDraft.bodyY) + editorDraft.bodyH,
    };
    if (editorRectsIntersect(rect, bodyRect)) editorSelectedBody = true;
    editorDraft.terminals.forEach((term, idx) => {
      if (termPartKind(term) === 'conductor') return;
      const { w, h } = getSpecTermSize(term, editorDraft);
      const termRect = {
        left: draftToStageX(term.x),
        top: draftToStageY(term.y),
        right: draftToStageX(term.x) + w,
        bottom: draftToStageY(term.y) + h,
      };
      if (editorRectsIntersect(rect, termRect)) editorSelectedTerminals.add(idx);
    });
    if (draftHasLoom(editorDraft) && editorDraft.loomJunction) {
      const jx = draftToStageX(editorDraft.loomJunction.x);
      const jy = draftToStageY(editorDraft.loomJunction.y);
      const loomRect = { left: jx - 6, top: jy - 6, right: jx + 6, bottom: jy + 6 };
      if (editorRectsIntersect(rect, loomRect)) editorSelectedLoom = true;
    }
    if (editorSelectedBody) editorSelection = { type: 'body' };
    else if (editorSelectedLoom) editorSelection = { type: 'loom' };
    else if (editorSelectedTerminals.size) {
      editorSelection = { type: 'terminal', idx: [...editorSelectedTerminals][0] };
    } else {
      editorSelection = null;
    }
    refreshEditorSelectionVisuals();
  }

  function toggleTerminalShape() {
    if (!editorDraft) return;
    editorDraft.terminalShape = editorDraft.terminalShape === 'rect' ? 'square' : 'rect';
    if (
      (editorDraft.category === 'switch' && (editorDraft.subtype === 'dpdt' || editorDraft.subtype === 'dpdt-on-off-on' || editorDraft.subtype === 'dpdt-on-on' || editorDraft.subtype === 'spst-on-off'))
      || (editorDraft.category === 'pickup' && editorDraft.subtype === 'singlecoil')
      || (editorDraft.category === 'pickup' && editorDraft.subtype === 'dualcoil')
      || (editorDraft.category === 'pickup' && editorDraft.subtype === '4conductor')
    ) {
      editorDraft.terminals = defaultTerminals(editorDraft.category, editorDraft.subtype, editorDraft);
      if (editorDraft.subtype === 'dualcoil' || editorDraft.subtype === '4conductor') {
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
    states.push({ id: nextId, label: undefined, secondaryLabel: '', terminalActive: Array(n).fill(false) });
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
    const termEls = el.querySelectorAll('.terminal');
    const termEl = termEls[termIndex];
    const isSwitchPole = !!termEl?.classList?.contains('switch-term');
    const bridges = states[stateIndex].bridges;
    // Throw-matrix switches: poles follow bridges — toggling a pole edits the bridge set
    if (isSwitchPole && Array.isArray(bridges) && (bridges.length > 0 || template.switchThrow)) {
      if (!states[stateIndex].bridges) states[stateIndex].bridges = [];
      if (!active) {
        states[stateIndex].bridges = states[stateIndex].bridges.filter(
          (pair) => !Array.isArray(pair) || (pair[0] !== termIndex && pair[1] !== termIndex)
        );
      } else if (!states[stateIndex].bridges.some((pair) => pair[0] === termIndex || pair[1] === termIndex)) {
        const switchIndices = [];
        termEls.forEach((t, i) => {
          if (t?.classList?.contains('switch-term')) switchIndices.push(i);
        });
        let pairWith = null;
        // SPST / few-pole: close to the other pole (never case-ground commons)
        if (template.switchThrow === 'on-off' || switchIndices.length <= 2) {
          pairWith = switchIndices.find((i) => i !== termIndex);
        } else {
          // DPDT grid: pair with nearest common (T3/T4 = idx 2/3)
          const commons = [2, 3].filter((c) => c !== termIndex && c < (states[stateIndex].terminalActive?.length || 0));
          pairWith = commons.find((c) => Math.abs(c - termIndex) <= 2) ?? commons[0];
        }
        if (pairWith != null) {
          states[stateIndex].bridges.push([Math.min(termIndex, pairWith), Math.max(termIndex, pairWith)]);
        }
      }
      // Re-derive all switch-pole actives from bridges for this state
      const n = states[stateIndex].terminalActive.length;
      for (let i = 0; i < n; i++) {
        const t = el.querySelectorAll('.terminal')[i];
        if (t?.classList?.contains('switch-term')) {
          states[stateIndex].terminalActive[i] = terminalActiveForState(states[stateIndex], i, t);
        }
      }
    } else {
      states[stateIndex].terminalActive[termIndex] = !!active;
    }
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
    const next = String(secondaryLabel || '').trim().slice(0, 48);
    states[stateIndex].secondaryLabel = next;
    if (getComponentStateIndex(el) === stateIndex) {
      updateComponentStateLabel(el);
    }
    return true;
  }

  /** Default primary label from the template (e.g. “Up (1)”). */
  function getTemplateStateLabel(el, stateIndex) {
    const template = getTemplate(el?.dataset?.assetId);
    const states = ensureInstanceStates(el);
    const s = states[stateIndex];
    const fromTemplate = template?.states?.[stateIndex]?.label;
    if (fromTemplate != null && String(fromTemplate).trim() !== '') {
      return String(fromTemplate).trim().slice(0, 48);
    }
    return `State ${s?.id ?? stateIndex + 1}`;
  }

  /**
   * Primary per-state hover float (same chip toggles show as “Up (1)”).
   * Empty `label` is allowed on hideStateLabel assets (no float); switches
   * fall back to the template default when cleared.
   */
  function setInstanceStateLabel(el, stateIndex, label) {
    const template = getTemplate(el?.dataset?.assetId);
    if (!template) return false;
    const states = ensureInstanceStates(el);
    if (!states[stateIndex]) return false;
    const next = String(label ?? '').trim().slice(0, 48);
    if (!next && !template.hideStateLabel) {
      const fromTemplate = template?.states?.[stateIndex]?.label;
      states[stateIndex].label = (fromTemplate != null && String(fromTemplate).trim() !== '')
        ? String(fromTemplate).trim().slice(0, 48)
        : undefined;
    } else {
      states[stateIndex].label = next;
    }
    if (getComponentStateIndex(el) === stateIndex) {
      updateComponentStateLabel(el);
    }
    return true;
  }

  const CONTEXT_FOCUS_ICON_ACTIVE =
    '<svg class="context-menu-focus-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M13 2L4 14h7l-1 8 10-14h-7l1-6z" fill="currentColor"/>' +
    '</svg>';
  const CONTEXT_FOCUS_ICON_GROUND =
    '<svg class="context-menu-focus-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M12 3v8M5 11h14M7.5 14.5h9M9.5 18h5M11 21h2" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>' +
    '</svg>';
  const CONTEXT_FOCUS_ICON_WIRE =
    '<svg class="context-menu-focus-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>' +
    '</svg>';
  const CONTEXT_FOCUS_ICON_SHORT =
    '<svg class="context-menu-focus-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke="currentColor" stroke-width="2.1"/>' +
    '<line x1="15.2" y1="15.2" x2="20" y2="20" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>' +
    '</svg>';
  const CONTEXT_PANEL_SNAP_ICON =
    '<svg class="context-menu-bullseye context-menu-focus-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<circle cx="12" cy="12" r="1.75" fill="currentColor"/>' +
    '</svg>';

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


  /** Categories shown in the electronics right-click place menu (source of truth for presets). */
  function listPlacementMenuCategories() {
    return CATEGORIES
      .filter((c) => !c.hidden)
      .map((c) => ({ id: c.id, label: c.label }));
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
      t.switchThrow === 'on-off' || t.subtype === 'spst-on-off' ? 0
        : t.switchThrow === 'on-on' || t.subtype === 'dpdt-on-on' ? 1
          : t.switchThrow === 'on-on-on' || t.subtype === 'dpdt' ? 2
            : t.switchThrow === 'on-off-on' ? 3
              : 4
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

    if (typeDef.children?.length) {
      const claimed = new Set();
      typeDef.children.forEach((childDef) => {
        const childAssets = assets.filter((a) => {
          try { return !!childDef.match?.(a); } catch (_) { return false; }
        });
        childAssets.forEach((a) => claimed.add(a.id));
        if (childDef.direct) {
          childAssets.forEach((asset) => flyout.appendChild(createAssetMenuRow(asset)));
        } else {
          flyout.appendChild(createTypeMenuRow(childDef, childAssets, flyoutLeft));
        }
      });
      assets.filter((a) => !claimed.has(a.id)).forEach((asset) => {
        flyout.appendChild(createAssetMenuRow(asset));
      });
    } else {
      const sorted = (typeDef.id === '2way' || typeDef.id === '3way')
        ? sortSwitchThrowAssets(assets)
        : assets;
      sorted.forEach((asset) => flyout.appendChild(createAssetMenuRow(asset)));

      if (!sorted.length) {
        const empty = document.createElement('li');
        empty.className = 'context-menu-empty';
        empty.textContent = 'None yet';
        flyout.appendChild(empty);
      }
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

    if (category.id === 'custom') {
      const addLi = document.createElement('li');
      addLi.className = 'context-menu-row';
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'context-menu-add context-menu-flyout-add';
      addBtn.textContent = '+';
      addBtn.title = 'Create custom asset';
      addBtn.setAttribute('aria-label', 'Add custom User asset');
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openEditor('custom');
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
        powerBtn.innerHTML = CONTEXT_PANEL_SNAP_ICON;
        powerBtn.title = 'Place panel snap points';
        powerBtn.setAttribute('aria-label', 'Panel snap points');
        powerBtn.classList.toggle('panel-snap-active', !!deps.getPanelSnapMode?.());
        powerBtn.classList.remove('active');
        powerBtn.setAttribute('aria-pressed', deps.getPanelSnapMode?.() ? 'true' : 'false');
      } else {
        powerBtn.innerHTML = CONTEXT_FOCUS_ICON_ACTIVE;
        powerBtn.title = 'Focus: Active — highlight wires on active signal path';
        powerBtn.setAttribute('aria-label', 'Focus: Active signal path');
        powerBtn.classList.remove('panel-snap-active');
        syncContextMenuPowerButton();
      }
    }
    if (groundBtn) {
      if (onPanel) {
        groundBtn.innerHTML = CONTEXT_FOCUS_ICON_GROUND;
        groundBtn.title = 'Ground (panel — no action)';
        groundBtn.classList.remove('active');
        groundBtn.setAttribute('aria-pressed', 'false');
      } else {
        groundBtn.innerHTML = CONTEXT_FOCUS_ICON_GROUND;
        groundBtn.title = 'Focus: Ground — highlight ungrounded YESGROUND assets';
        groundBtn.setAttribute('aria-label', 'Focus: Ground check');
        syncContextMenuGroundButton();
      }
    }
    if (wireFocusBtn) {
      wireFocusBtn.classList.toggle('hidden', onPanel);
      if (!onPanel) {
        wireFocusBtn.innerHTML = CONTEXT_FOCUS_ICON_WIRE;
        wireFocusBtn.title = 'Focus: Wire — grey & lock assets, wires in front';
        wireFocusBtn.setAttribute('aria-label', 'Focus: Wire edit');
        syncContextMenuWireFocusButton();
      }
    }
    if (shortCheckBtn) {
      shortCheckBtn.classList.toggle('hidden', onPanel);
      if (!onPanel) {
        shortCheckBtn.innerHTML = CONTEXT_FOCUS_ICON_SHORT;
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
      const assets = templates.filter((t) => (
        t.category === category.id && !t.menuHidden
      ));
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
    clearEditorSelectionState();
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
      electricalPreset: normalizeElectricalPresetId(template.electricalPreset || 'none'),
    };
    editorDraft.category = 'custom';
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
    // Custom asset creator is User-category only for now.
    const category = 'custom';
    const subtypeOpts = SUBTYPES[category] || [];
    const subtype = subtypeOpts[0]?.id || '';
    clearEditorSelectionState();
    editorDraft = {
      name: '',
      category,
      subtype,
      terminalShape: defaultTerminalShape(category),
      needsGrounding: defaultNeedsGrounding(category, subtype),
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
      electricalPreset: 'none',
      valueFields: [],
      defaultValues: {},
      editingId: null,
    };
    applyPresetLayout(editorDraft);
    resetEditorStatesFromTerminals();
    editorEl()?.classList.remove('hidden');
    renderEditor();
    deps.setStatus('Edit custom asset — choose a Preset or build from scratch, then Save');
  }

  function closeEditor() {
    editorDraft = null;
    clearEditorSelectionState();
    editorDrag = null;
    editorMarqueeEl = null;
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
    fillEditorBodyLabel(bodyEl);
    scaleEditorBodyLabel(bodyEl);
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
      if (editorSelectedLoom || editorSelection?.type === 'loom') handle.classList.add('selected');
      handle.style.left = `${jx - 6}px`;
      handle.style.top = `${jy - 6}px`;
      handle.title = 'Drag loom — snaps to pickup sides (Shift: free move)';
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          if (!editorSelectedLoom) setEditorSelection({ type: 'loom' }, { additive: true });
        } else if (!editorSelectedLoom) {
          setEditorSelection({ type: 'loom' });
        } else {
          editorSelection = { type: 'loom' };
          refreshEditorSelectionVisuals();
        }
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
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'asset-editor-icon-btn';
      delBtn.textContent = '×';
      delBtn.title = 'Remove 4-conductor loom';
      delBtn.setAttribute('aria-label', 'Remove 4-conductor loom');
      delBtn.addEventListener('click', () => {
        removeFourConductorLoom(editorDraft);
        syncStateTerminalFlags(editorDraft);
        renderEditor();
      });
      loomRow.appendChild(kindEl);
      loomRow.appendChild(label);
      loomRow.appendChild(colorSel);
      loomRow.appendChild(delBtn);
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
      labelInput.maxLength = 24;
      labelInput.readOnly = !editable;
      labelInput.disabled = !editable;
      if (editable) {
        labelInput.addEventListener('input', () => {
          const next = labelInput.value.slice(0, 24) || '?';
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
    editorMarqueeEl = null;
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
    if (editorSelectedBody) body.classList.add('selected');
    fillEditorBodyLabel(body);
    body.style.width = `${editorDraft.bodyW}px`;
    body.style.height = `${editorDraft.bodyH}px`;
    body.style.left = `${draftToStageX(editorDraft.bodyX)}px`;
    body.style.top = `${draftToStageY(editorDraft.bodyY)}px`;

    body.addEventListener('mousedown', (e) => {
      if (e.target.closest('.asset-editor-resize-handle')) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        if (!editorSelectedBody) setEditorSelection({ type: 'body' }, { additive: true });
      } else if (!editorSelectedBody) {
        setEditorSelection({ type: 'body' });
      } else {
        editorSelection = { type: 'body' };
        refreshEditorSelectionVisuals();
      }
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
    scaleEditorBodyLabel(body);

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
      if (editorSelectedTerminals.has(idx)) {
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
        fillFloatLabelWithSignalMark(float, term.tipLabel || term.label || '');
        box.appendChild(float);
      } else {
        const termLabel = document.createElement('span');
        termLabel.className = 'asset-editor-terminal-label';
        const mark = resolveTerminalSignalMark(term, { category: editorDraft?.category, subtype: editorDraft?.subtype });
        const primary = term.tipLabel || term.label || '';
        if (mark) {
          termLabel.classList.add('has-signal-mark');
          const p = document.createElement('span');
          p.className = 'terminal-primary-label';
          p.textContent = primary;
          termLabel.appendChild(p);
          const m = document.createElement('span');
          m.className = `terminal-signal-mark is-${mark}`;
          m.setAttribute('aria-hidden', 'true');
          if (mark === 'plus') m.textContent = '+';
          else if (mark === 'minus') m.textContent = '−';
          else if (mark === 'chassis') m.innerHTML = buildTerminalChassisIconHtml();
          else m.innerHTML = buildTerminalEarthIconHtml();
          termLabel.appendChild(m);
        } else {
          termLabel.textContent = primary;
        }
        box.appendChild(termLabel);
      }

      editorTerminalPreviewStyle(box, term, idx);

      if (kind !== 'conductor') {
        box.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) {
            if (!editorSelectedTerminals.has(idx)) {
              setEditorSelection({ type: 'terminal', idx }, { additive: true });
            }
          } else if (!editorSelectedTerminals.has(idx)) {
            setEditorSelection({ type: 'terminal', idx });
          } else {
            editorSelection = { type: 'terminal', idx };
            refreshEditorSelectionVisuals();
          }
          const pt = clientToStagePoint(e.clientX, e.clientY, stage);
          const moveIdxs = editorSelectedTerminals.has(idx)
            ? [...editorSelectedTerminals]
            : [idx];
          editorDrag = {
            type: 'terminals',
            idx,
            idxs: moveIdxs,
            offsetX: stageToDraftX(pt.x) - term.x,
            offsetY: stageToDraftY(pt.y) - term.y,
            startTerms: moveIdxs.map((i) => ({
              idx: i,
              x: editorDraft.terminals[i].x,
              y: editorDraft.terminals[i].y,
            })),
          };
        });
      }

      stage.appendChild(box);
    });

    updateEditorWireLines(stage);

    stage.addEventListener('mousedown', (e) => {
      if (e.target !== stage && !e.target.classList?.contains('asset-editor-wire-svg')) return;
      e.preventDefault();
      const pt = clientToStagePoint(e.clientX, e.clientY, stage);
      if (!e.shiftKey) {
        clearEditorSelectionState();
        refreshEditorSelectionVisuals();
      }
      editorDrag = {
        type: 'marquee',
        startX: pt.x,
        startY: pt.y,
        additive: !!e.shiftKey,
      };
      ensureEditorMarquee(stage);
      updateEditorMarqueeBox(pt.x, pt.y, pt.x, pt.y);
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

  function applyElectricalPresetToDraft(draft, presetId, { pruneDefaults = true } = {}) {
    if (!draft) return;
    draft.electricalPreset = normalizeElectricalPresetId(presetId);
    const locked = valueFieldsForElectricalPreset(draft.electricalPreset);
    if (locked) {
      draft.valueFields = normalizeValueFields(locked);
    } else {
      draft.valueFields = normalizeValueFields(draft.valueFields);
    }
    if (pruneDefaults) pruneDraftDefaultValues();
  }

  /**
   * Apply a Preset: lock electrical fields and clone the matching builtin
   * body / terminals / wires / legs into the editor draft (category stays User).
   */
  function applyElectricalPresetLayout(draft, presetId) {
    if (!draft) return;
    const id = normalizeElectricalPresetId(presetId);
    const keepName = draft.name;
    const keepEditingId = draft.editingId;
    const keepGrid = draft.gridVisible;
    const keepZoom = draft.previewZoom;
    const keepDefaults = { ...(draft.defaultValues || {}) };

    applyElectricalPresetToDraft(draft, id, { pruneDefaults: false });
    draft.category = 'custom';

    const clearLayoutMeta = () => {
      draft.hasLoom = false;
      delete draft.loomJunction;
      delete draft.loomColor;
      delete draft.potFamily;
      delete draft.pushPull;
      delete draft.switchThrow;
      delete draft.typeGroup;
      delete draft.isOutputJack;
      delete draft.tubeFamily;
      delete draft.tubePinConfig;
      delete draft.hbJunctionLeft;
      delete draft.hbJunctionTop;
    };

    if (id === 'none') {
      clearLayoutMeta();
      draft.subtype = '';
      draft.cssClass = 'custom';
      draft.needsGrounding = false;
      draft.terminalShape = 'square';
      draft.layout = 'absolute';
      draft.bodyW = 70;
      draft.bodyH = 48;
      draft.bodyX = 0;
      draft.bodyY = 0;
      draft.placeLabel = 'CU';
      draft.terminals = [];
      draft.hideStateLabel = true;
      draft.defaultValues = {};
      resetEditorStatesFromTerminals();
    } else {
      const sourceId = ELECTRICAL_PRESET_SOURCE_TEMPLATE[id];
      const src = sourceId ? getTemplate(sourceId) : null;
      if (!src) {
        pruneDraftDefaultValues();
        draft.name = keepName;
        draft.editingId = keepEditingId;
        draft.gridVisible = keepGrid;
        draft.previewZoom = keepZoom;
        return;
      }
      clearLayoutMeta();
      draft.subtype = src.subtype || '';
      draft.bodyW = src.bodyW;
      draft.bodyH = src.bodyH;
      draft.bodyX = src.bodyX ?? 0;
      draft.bodyY = src.bodyY ?? 0;
      draft.placeLabel = src.placeLabel != null ? String(src.placeLabel) : 'CU';
      draft.states = src.states ? JSON.parse(JSON.stringify(src.states)) : [];
      draft.activeStateIndex = 0;
      const cssParts = new Set(['custom']);
      String(src.cssClass || '').split(/\s+/).forEach((c) => { if (c) cssParts.add(c); });
      draft.cssClass = [...cssParts].join(' ');
      draft.needsGrounding = !!src.needsGrounding;
      draft.layout = 'absolute';
      draft.terminalShape = src.terminalShape || defaultTerminalShape(src.category);
      draft.hideStateLabel = src.hideStateLabel !== false;

      [
        'hasLoom', 'loomColor', 'loomJunction', 'potFamily', 'pushPull',
        'switchThrow', 'typeGroup', 'isOutputJack', 'tubeFamily', 'tubePinConfig',
        'hbJunctionLeft', 'hbJunctionTop',
      ].forEach((key) => {
        if (src[key] == null) return;
        draft[key] = typeof src[key] === 'object'
          ? JSON.parse(JSON.stringify(src[key]))
          : src[key];
      });

      // Switches (and any grid layout) store terminals without x/y — expand to absolute
      // coords for the custom-asset preview (always layout: absolute).
      const srcTerms = src.terminals || [];
      const missingAbsolute = src.layout === 'grid-3x2'
        || srcTerms.some((t) => !Number.isFinite(t?.x) || !Number.isFinite(t?.y));
      if (missingAbsolute) {
        draft.terminals = defaultTerminals(src.category, src.subtype, draft);
      } else {
        draft.terminals = JSON.parse(JSON.stringify(srcTerms));
      }

      draft.terminals = draft.terminals.map((t) => (
        String(t.className || '').includes('hb-tip') || t.partKind === 'conductor'
          ? { ...t, partKind: 'conductor' }
          : t
      ));
      const hasConductors = draft.terminals.some((t) => termPartKind(t) === 'conductor');
      if (draft.hasLoom || hasConductors) {
        draft.hasLoom = true;
        draft.loomColor = draft.loomColor || EDITOR_DEFAULT_LOOM_COLOR;
        draft.loomJunction = draft.loomJunction || null;
        ensureEditorLoomJunction(draft);
        layoutEditorConductorFan(draft);
        activateEditorConductors(draft);
      }

      draft.defaultValues = { ...(src.defaultValues || {}) };
      normalizeValueFields(draft.valueFields).forEach((key) => {
        if (keepDefaults[key] != null && String(keepDefaults[key]).trim() !== '') {
          draft.defaultValues[key] = keepDefaults[key];
        }
      });

      if (!draft.states?.length) resetEditorStatesFromTerminals();
      else {
        syncStateTerminalFlags(draft);
        ensureEditorStates(draft);
      }
      normalizeDraft(draft);
    }

    pruneDraftDefaultValues();
    draft.name = keepName;
    draft.editingId = keepEditingId;
    draft.gridVisible = keepGrid;
    draft.previewZoom = keepZoom;
    draft.electricalPreset = id;
    draft.category = 'custom';
  }

  function renderEditorValueFields() {
    const host = document.querySelector('.asset-editor-value-fields');
    const list = document.getElementById('asset-editor-value-fields-list');
    const title = host?.querySelector('.asset-editor-value-fields-label');
    if (!list || !editorDraft) return;

    ensureDraftDefaultValues();
    editorDraft.electricalPreset = normalizeElectricalPresetId(editorDraft.electricalPreset);
    const lockedFields = valueFieldsForElectricalPreset(editorDraft.electricalPreset);
    const freeMode = lockedFields == null;

    if (!freeMode) {
      editorDraft.valueFields = normalizeValueFields(lockedFields);
    } else {
      editorDraft.valueFields = normalizeValueFields(editorDraft.valueFields);
    }
    pruneDraftDefaultValues();

    const enabled = new Set(normalizeValueFields(editorDraft.valueFields));
    list.replaceChildren();

    const keysToShow = freeMode
      ? Object.keys(ELECTRICAL_VALUE_DEFS)
      : normalizeValueFields(lockedFields);

    if (!keysToShow.length) {
      host?.classList.add('is-empty');
      if (title) {
        title.hidden = false;
        title.textContent = freeMode ? 'Electrical values' : 'Electrical values (none for this preset)';
      }
      return;
    }
    host?.classList.remove('is-empty');
    if (title) {
      title.hidden = false;
      title.textContent = 'Electrical values';
    }

    keysToShow.forEach((key) => {
      const def = ELECTRICAL_VALUE_DEFS[key];
      if (!def) return;
      const on = freeMode ? enabled.has(key) : true;
      const row = document.createElement('div');
      row.className = `asset-editor-value-row${on ? ' is-enabled' : ''}`;

      if (freeMode) {
        const toggle = document.createElement('label');
        toggle.className = 'asset-editor-value-enable';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = on;
        box.setAttribute('aria-label', `Enable ${def.label}`);
        box.addEventListener('change', () => {
          const next = new Set(normalizeValueFields(editorDraft.valueFields));
          if (box.checked) next.add(key);
          else {
            next.delete(key);
            delete editorDraft.defaultValues[key];
          }
          editorDraft.valueFields = [...next];
          renderEditorValueFields();
          const stage = document.querySelector('#asset-editor-preview .asset-editor-stage');
          const bodyEl = stage?.querySelector('.asset-editor-body');
          if (bodyEl) {
            fillEditorBodyLabel(bodyEl);
            scaleEditorBodyLabel(bodyEl);
          }
        });
        const lab = document.createElement('span');
        lab.className = 'asset-editor-value-name';
        lab.textContent = def.label;
        toggle.appendChild(box);
        toggle.appendChild(lab);
        row.appendChild(toggle);
      } else {
        const lab = document.createElement('div');
        lab.className = 'asset-editor-value-fixed-label';
        lab.textContent = def.label;
        row.appendChild(lab);
      }

      if (on) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'asset-editor-input asset-editor-value-input';
        input.placeholder = def.placeholder || '';
        input.value = editorDraft.defaultValues[key] || '';
        input.setAttribute('aria-label', `${def.label} default`);
        input.addEventListener('input', () => {
          ensureDraftDefaultValues();
          const v = input.value.trim();
          if (v) editorDraft.defaultValues[key] = v;
          else delete editorDraft.defaultValues[key];
          const stage = document.querySelector('#asset-editor-preview .asset-editor-stage');
          const bodyEl = stage?.querySelector('.asset-editor-body');
          if (bodyEl) {
            fillEditorBodyLabel(bodyEl);
            scaleEditorBodyLabel(bodyEl);
          }
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
    const presetSel = document.getElementById('asset-editor-electrical-preset');
    if (presetSel) {
      editorDraft.electricalPreset = normalizeElectricalPresetId(editorDraft.electricalPreset);
      presetSel.value = editorDraft.electricalPreset;
    }
    const groundToggle = document.getElementById('asset-editor-grounding');
    const groundRow = document.querySelector('.asset-editor-ground-option');
    const isJackCat = !!editorDraft.isOutputJack
      || editorDraft.electricalPreset === 'jack'
      || editorDraft.subtype === 'monooutput'
      || editorDraft.subtype === 'stereooutput';
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
    const isJack = !!editorDraft.isOutputJack
      || editorDraft.electricalPreset === 'jack'
      || editorDraft.subtype === 'monooutput'
      || editorDraft.subtype === 'stereooutput';
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
      category: 'custom',
      placeLabel: (editorDraft.placeLabel || '').trim().slice(0, 24) || 'CU',
      needsGrounding,
      layout: 'absolute',
      cssClass: [...cssParts].join(' '),
      hasLoom,
      builtin: false,
      electricalPreset: normalizeElectricalPresetId(editorDraft.electricalPreset),
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
        const free = !!e.shiftKey;

        if (editorDrag.type === 'marquee') {
          updateEditorMarqueeBox(editorDrag.startX, editorDrag.startY, pt.x, pt.y);
        } else if (editorDrag.type === 'body') {
          const newBodyX = snapEditor(pt.x - editorPreviewLayout.ox - editorDrag.offsetX, free);
          const newBodyY = snapEditor(pt.y - editorPreviewLayout.oy - editorDrag.offsetY, free);
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
          snapEditorLoomToBody(editorDraft, rawX, rawY, free);
          updateEditorTerminalVisuals(stage);
          updateEditorWireLines(stage);
        } else if (editorDrag.type === 'terminals' || editorDrag.type === 'terminal') {
          const idxs = editorDrag.idxs || [editorDrag.idx];
          const anchorIdx = editorDrag.idx;
          const anchorTerm = editorDraft.terminals[anchorIdx];
          if (!anchorTerm || termPartKind(anchorTerm) === 'conductor') return;
          const rawX = stageToDraftX(pt.x) - editorDrag.offsetX;
          const rawY = stageToDraftY(pt.y) - editorDrag.offsetY;
          const snapped = snapTerminalToBody(rawX, rawY, anchorTerm, editorDraft, free);
          const startAnchor = (editorDrag.startTerms || []).find((s) => s.idx === anchorIdx)
            || { x: anchorTerm.x, y: anchorTerm.y };
          const dx = snapped.x - startAnchor.x;
          const dy = snapped.y - startAnchor.y;
          idxs.forEach((i) => {
            const term = editorDraft.terminals[i];
            if (!term || termPartKind(term) === 'conductor') return;
            const start = (editorDrag.startTerms || []).find((s) => s.idx === i)
              || { x: term.x, y: term.y };
            if (free) {
              term.x = start.x + dx;
              term.y = start.y + dy;
            } else {
              const pos = snapTerminalToBody(start.x + dx, start.y + dy, term, editorDraft, false);
              term.x = pos.x;
              term.y = pos.y;
            }
            const box = stage.querySelector(`.asset-editor-terminal[data-idx="${i}"]`);
            if (box) {
              box.style.left = `${draftToStageX(term.x)}px`;
              box.style.top = `${draftToStageY(term.y)}px`;
            }
          });
          updateEditorWireLines(stage);
        }
      }
    });

    document.addEventListener('mouseup', (e) => {
      const wasEditorDrag = !!editorDrag;
      const dragType = editorDrag?.type;
      if (editorDrag?.type === 'marquee' && editorDraft) {
        const stage = document.querySelector('#asset-editor-preview .asset-editor-stage');
        if (stage) {
          const pt = clientToStagePoint(e.clientX, e.clientY, stage);
          const left = Math.min(editorDrag.startX, pt.x);
          const top = Math.min(editorDrag.startY, pt.y);
          const right = Math.max(editorDrag.startX, pt.x);
          const bottom = Math.max(editorDrag.startY, pt.y);
          if (right - left > 2 || bottom - top > 2) {
            applyEditorMarqueeSelection(
              { left, top, right, bottom },
              { additive: !!editorDrag.additive }
            );
          }
        }
        hideEditorMarquee();
      }
      document.querySelector('.asset-editor-body.dragging')?.classList.remove('dragging');
      document.querySelector('.asset-editor-body.resizing')?.classList.remove('resizing');
      panelDrag = null;
      editorDrag = null;
      // Re-center the asset in the preview after a move/resize (not after marquee-only)
      if (wasEditorDrag && editorDraft && dragType !== 'marquee') renderEditorPreview();
      else if (wasEditorDrag && dragType === 'marquee') refreshEditorSelectionVisuals();
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
      // Creator is locked to User for now.
      editorDraft.category = 'custom';
      e.target.value = 'custom';
      const opts = SUBTYPES[editorDraft.category] || [];
      editorDraft.subtype = opts[0]?.id || '';
      editorDraft.needsGrounding = defaultNeedsGrounding(editorDraft.category, editorDraft.subtype);
      editorDraft.terminalShape = defaultTerminalShape(editorDraft.category);
      if (normalizeElectricalPresetId(editorDraft.electricalPreset) !== 'none') {
        applyElectricalPresetLayout(editorDraft, editorDraft.electricalPreset);
      } else {
        applyPresetLayout(editorDraft);
        resetEditorStatesFromTerminals();
      }
      renderEditor();
    });

    document.getElementById('asset-editor-subtype')?.addEventListener('change', (e) => {
      editorDraft.subtype = e.target.value;
      editorDraft.needsGrounding = defaultNeedsGrounding(editorDraft.category, editorDraft.subtype);
      if (editorDraft.category === 'switch' && (editorDraft.subtype === 'dpdt' || editorDraft.subtype === 'dpdt-on-off-on' || editorDraft.subtype === 'dpdt-on-on' || editorDraft.subtype === 'spst-on-off')) {
        editorDraft.terminalShape = 'rect';
      }
      applyPresetLayout(editorDraft);
      if (normalizeElectricalPresetId(editorDraft.electricalPreset) !== 'none') {
        applyElectricalPresetLayout(editorDraft, editorDraft.electricalPreset);
      } else {
        resetEditorStatesFromTerminals();
      }
      renderEditor();
    });

    document.getElementById('asset-editor-electrical-preset')?.addEventListener('change', (e) => {
      if (!editorDraft) return;
      applyElectricalPresetLayout(editorDraft, e.target.value);
      clearEditorSelectionState();
      renderEditor();
    });

    document.getElementById('asset-editor-placelabel')?.addEventListener('input', (e) => {
      if (!editorDraft) return;
      editorDraft.placeLabel = e.target.value.slice(0, 24);
      const stage = document.querySelector('#asset-editor-preview .asset-editor-stage');
      const bodyEl = stage?.querySelector('.asset-editor-body');
      if (bodyEl) {
        fillEditorBodyLabel(bodyEl);
        scaleEditorBodyLabel(bodyEl);
      }
    });

    document.getElementById('asset-editor-name')?.addEventListener('input', (e) => {
      if (!editorDraft) return;
      editorDraft.name = e.target.value;
      if (!(editorDraft.placeLabel && String(editorDraft.placeLabel).trim())) {
        const stage = document.querySelector('#asset-editor-preview .asset-editor-stage');
        const bodyEl = stage?.querySelector('.asset-editor-body');
        if (bodyEl) {
          fillEditorBodyLabel(bodyEl);
          scaleEditorBodyLabel(bodyEl);
        }
      }
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

    document.getElementById('asset-editor-add-case-g')?.addEventListener('click', () => {
      if (!editorDraft) return;
      const already = (editorDraft.terminals || []).some((t) => (
        !!t.isGround
        || String(t.className || '').includes('case-ground')
        || (t.role === 'G' && t.signalMark === 'chassis')
      ));
      if (already) {
        renderEditor();
        return;
      }
      editorDraft.terminals.push(makeEditorChassisGroundTerminal(editorDraft));
      editorDraft.needsGrounding = true;
      const groundChk = document.getElementById('asset-editor-grounding');
      if (groundChk) groundChk.checked = true;
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

  /** For switch states with bridges: switch poles follow closed contacts; other lugs keep stored actives. */
  function terminalActiveForState(state, idx, termEl) {
    const bridges = state?.bridges;
    if (Array.isArray(bridges)) {
      if (bridges.length) {
        const onBridge = bridges.some((pair) => pair[0] === idx || pair[1] === idx);
        if (onBridge) return true;
        if (termEl?.classList?.contains('switch-term')) return false;
        return !!state?.terminalActive?.[idx];
      }
      // Empty bridges = open / OFF throw — switch poles are inactive
      if (termEl?.classList?.contains('switch-term')) return false;
    }
    return !!state?.terminalActive?.[idx];
  }

  function applyComponentStateVisuals(el, template, stateIndex) {
    const states = getEffectiveStates(el);
    const state = states[stateIndex];
    if (!state || !template) return;
    const termEls = el.querySelectorAll('.terminal');
    // Keep stored terminalActive in sync with bridges for switch poles
    if (Array.isArray(state.bridges) && state.terminalActive) {
      for (let i = 0; i < state.terminalActive.length; i++) {
        const term = termEls[i];
        if (term?.classList?.contains('switch-term') || (template.switchThrow && !template.pushPull)) {
          state.terminalActive[i] = terminalActiveForState(state, i, term);
        } else if (template.pushPull && term?.classList?.contains('switch-term')) {
          state.terminalActive[i] = terminalActiveForState(state, i, term);
        }
      }
    }
    // T terminals joined by an internal jumper (bridge) in this state
    const jumpered = new Set();
    (state.bridges || []).forEach((pair) => {
      if (!Array.isArray(pair) || pair.length < 2) return;
      const a = Number(pair[0]);
      const b = Number(pair[1]);
      if (Number.isFinite(a)) jumpered.add(a);
      if (Number.isFinite(b)) jumpered.add(b);
    });
    template.terminals.forEach((spec, idx) => {
      const term = termEls[idx];
      if (!term) return;
      const isT = term.classList.contains('switch-term')
        || /^T\d+/i.test(String(spec.label || term.dataset.terminalLabel || term.textContent || '').trim());
      term.classList.toggle('internal-jumper', isT && jumpered.has(idx));
      if (spec.isGround || term.dataset.isGround === 'true' || term.dataset.tag === 'ISGROUND') {
        if (term.classList.contains('hb-tip')) {
          const active = terminalActiveForState(state, idx, term);
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
        const active = terminalActiveForState(state, idx, term);
        term.classList.toggle('state-active', active);
        if (spec.keepColorWhenActive) term.classList.add('keep-base-color');
        else term.classList.remove('keep-base-color');
        const float = term.querySelector('.wire-float-label')
          || el.querySelector(`.asset-wire-float-label[data-aw-label="${[...el.querySelectorAll('.terminal.wire-term')].indexOf(term)}"]`);
        if (float) float.classList.toggle('is-active', active);
        return;
      }
      const baseColor = term.dataset.baseColor || spec.color || '';
      const active = terminalActiveForState(state, idx, term);
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
    if (!el) return;
    let label = el.querySelector('.component-state-label');
    const template = getTemplate(el.dataset.assetId);
    const states = getEffectiveStates(el);
    if (!template || !states.length) {
      if (label) {
        label.hidden = true;
        label.replaceChildren();
      }
      return;
    }

    const state = states[getComponentStateIndex(el)] || states[0];
    const explicit = state?.label != null ? String(state.label).trim() : '';
    // Same float toggles use for “Up (1)”. hideStateLabel assets only show it
    // when the user set an explicit Hover name (via label).
    let primary = explicit;
    if (!primary && !template.hideStateLabel) {
      const idx = getComponentStateIndex(el);
      const fromTemplate = template?.states?.[idx]?.label;
      primary = (fromTemplate != null && String(fromTemplate).trim() !== '')
        ? String(fromTemplate).trim()
        : `State ${state?.id ?? ''}`;
    }
    // Legacy: Hover was briefly stored in secondaryLabel on hideStateLabel assets
    const legacyHover = String(state?.secondaryLabel || '').trim();
    if (template.hideStateLabel && !primary && legacyHover) {
      primary = legacyHover;
    }
    const secondary = (!template.hideStateLabel && legacyHover && legacyHover !== primary)
      ? legacyHover
      : '';
    const showPrimary = !!primary;
    const showSecondary = !!secondary;

    if (!showPrimary && !showSecondary) {
      if (label) {
        label.hidden = true;
        label.replaceChildren();
      }
      return;
    }

    if (!label) {
      label = document.createElement('div');
      label.className = 'component-state-label';
      el.appendChild(label);
    }

    label.replaceChildren();
    if (showPrimary && showSecondary) {
      label.classList.add('has-secondary');
      const sec = document.createElement('span');
      sec.className = 'component-state-label-secondary';
      sec.textContent = secondary;
      const pri = document.createElement('span');
      pri.className = 'component-state-label-primary';
      pri.textContent = primary;
      label.appendChild(sec);
      label.appendChild(pri);
    } else {
      // Solo float — identical chip for switch state names and asset Hover
      label.classList.remove('has-secondary');
      const pri = document.createElement('span');
      pri.className = 'component-state-label-primary is-solo';
      pri.textContent = primary || secondary;
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

  /** Capacitor / transistor / op-amp keep dedicated value shells; all other assets use label chips. */
  function templateUsesPartsShell(template) {
    if (!template || template.forceLabelBox) return false;
    const sub = template.subtype || template.id;
    return sub === 'capacitor' || sub === 'transistor' || sub === 'opamp';
  }

  function placeLabelText(template) {
    if (template?.placeLabel != null && String(template.placeLabel).trim() !== '') {
      return String(template.placeLabel).trim();
    }
    return template?.name || '??';
  }

  function buildComponentDOM(template, id) {
    const el = document.createElement('div');
    el.className = `component ${template.cssClass || 'custom'}`;
    el.dataset.id = id;
    el.dataset.type = template.id;
    el.dataset.assetId = template.id;
    el.dataset.assetCategory = template.category || 'custom';
    el.dataset.groundTag = 'NOGROUND';
    /* Label-box shell for everything except capacitor / transistor / op-amp. */
    const usePartsShell = templateUsesPartsShell(template);
    el.classList.toggle('asset-shell-parts', usePartsShell);
    el.classList.toggle('asset-shell-label', !usePartsShell);
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
    if (template.bodyW) placeholder.style.width = `${template.bodyW}px`;
    if (template.bodyH) placeholder.style.height = `${template.bodyH}px`;
    if (template.layout === 'absolute') {
      placeholder.style.position = 'absolute';
      placeholder.style.left = `${(template.bodyX || 0) - originX}px`;
      placeholder.style.top = `${(template.bodyY || 0) - originY}px`;
    }
    if (usePartsShell) {
      placeholder.textContent = placeLabelText(template);
    } else {
      placeholder.classList.add('asset-label-box');
      const stack = document.createElement('div');
      stack.className = 'asset-label-stack';
      const nameEl = document.createElement('span');
      nameEl.className = 'asset-label-chip asset-label-name';
      nameEl.textContent = placeLabelText(template);
      const valsEl = document.createElement('div');
      valsEl.className = 'asset-label-values';
      valsEl.hidden = true;
      stack.appendChild(nameEl);
      stack.appendChild(valsEl);
      placeholder.appendChild(stack);
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
      if (String(spec.className || '').includes('tube-pin')) {
        const on = spec.enabled !== false;
        term.dataset.tubePinEnabled = on ? '1' : '0';
        term.classList.toggle('tube-pin-disabled', !on);
        term.hidden = !on;
      }
      if (String(spec.className || '').includes('opamp-pin')) {
        const pinLabel = spec.hoverLabel || spec.label || spec.role || '';
        term.textContent = '';
        term.dataset.terminalLabel = pinLabel;
        term.dataset.pinLabel = pinLabel;
        term.style.setProperty('--opamp-pin-color', spec.color || '#c8cdd6');
        const float = document.createElement('span');
        float.className = 'opamp-hover-label';
        float.dataset.side = spec.hoverSide || 'left';
        float.setAttribute('aria-hidden', 'true');
        float.textContent = pinLabel;
        float.style.setProperty('--opamp-pin-color', spec.color || '#c8cdd6');
        term.appendChild(float);
      }
      const role = spec.role
        || (spec.isGround ? 'G' : null)
        || (spec.label === 'H' ? 'H' : null)
        || (spec.label === 'R' ? 'R' : null)
        || (spec.label === 'G' ? 'G' : null)
        || (spec.label === '+' ? 'P+' : null)
        || (spec.label === '−' || spec.label === '-' ? 'P-' : null);
      if (role) term.dataset.role = role;
      const identity = resolveTerminalIdentity(spec, { template });
      const tooltip = terminalTooltipForSpec(spec, { template });
      term.dataset.termName = identity.name;
      term.dataset.termSymbol = identity.symbol;
      term.title = tooltip;
      if (!term.dataset.terminalLabel) {
        term.dataset.terminalLabel = identity.symbol || spec.label || '';
      }
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
        fillFloatLabelWithSignalMark(float, text);
        float.style.setProperty('--hb-wire-color', color);
        float.style.color = text === 'H' ? '#eeeeee' : color;
        float.classList.toggle('is-h', text === 'H');
        float.classList.toggle('is-g', text === 'G');
        term.appendChild(float);
      } else {
        const mark = resolveTerminalSignalMark(spec, { template });
        if (mark) {
          applyTerminalSignalMarkDom(
            term,
            mark,
            term.dataset.terminalLabel || identity.symbol || spec.label || '',
          );
        }
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
      // T-grid + chassis/case ground parked under the poles
      termH = 74;
    } else if (template.layout === 'grid-1x2' || template.switchThrow === 'on-off') {
      termH = 56;
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
    TUBE_PINOUT_PRESETS,
    listTubePinoutPresets,
    getTubePinoutPreset,
    tubePinMaskFromPins,
    DIODE_MATERIAL_PRESETS,
    listDiodeMaterialPresets,
    getDiodeMaterialPreset,
    SHOCKLEY_DIODE_EQUATION,
    RESISTOR_TYPE_PRESETS,
    listResistorTypePresets,
    getResistorTypePreset,
    ELECTRICAL_FORMULAS,
    getElectricalFormula,
    listElectricalFormulas,
    defaultValueFieldsForSubtype,
    defaultNeedsGrounding,
    normalizeValueFields,
    resolveValueFieldDefs,
    templateUsesPartsShell,
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
    formatTerminalTitle,
    resolveTerminalIdentity,
    resolveTerminalSignalMark,
    fillFloatLabelWithSignalMark,
    terminalTooltipForSpec,
    listPlacementMenuCategories,
    ensureInstanceStates,
    setInstanceStates,
    addInstanceState,
    removeInstanceState,
    setInstanceTerminalActive,
    setInstanceStateSecondaryLabel,
    setInstanceStateLabel,
  };
})(window);
