(function () {
  'use strict';

  const SNAP_DELAY_MS = 2000;
  /** Pointer movement past this (px) after snap clears magnet immediately. */
  const SNAP_MOVE_CANCEL_PX = 3;
  const ASSET_CONFIG_BTN_SIZE = 12.6;
  /** Optical nudge matching .asset-config-btn transform. */
  const ASSET_CONFIG_BTN_NUDGE_X = -1;
  const LAYER_COUNT = 4;
  const SLACK_STEP = 6;
  const SLACK_MAX = 120;
  const WORKSPACE_GRID = 10;
  /** Panel page: 1 grid unit = 1 mm (rendered at this many CSS px). */
  const PANEL_GRID_PX = 10;
  /** Screen-px radius to magnetically lock placement onto a panel snap point. */
  const PLACEMENT_PANEL_SNAP_SCREEN_PX = 14;
  const PANEL_MM_PER_UNIT = 1;
  const WORKSPACE_SIZE = 5000;
  const ROT_STEP = 22.5 / 3;
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 4;
  const ZOOM_STEP = 0.05;
  const ZOOM_SENS = 0.0012;

  const canvas = document.getElementById('canvas');
  const workspace = document.getElementById('workspace');
  const WIRE_COLORS = {
    white: '#ffffff',
    black: '#111111',
    yellow: '#ffd700',
    green: '#2ecc71',
    orange: '#ff8c00',
    red: '#e74c3c',
    blue: '#4aa3ff',
    copper: '#b87333',
  };

  function syncWireBorderClasses(wire) {
    if (!wire?.group) return;
    wire.group.classList.toggle('wire-white', wire.color === 'white');
  }
  const ACCENT_THEMES = [
    { name: 'red', color: '#e74c3c' },
    { name: 'pink', color: '#ff69b4' },
    { name: 'white', color: '#ffffff' },
  ];

  const wiresBelow = document.getElementById('wires-below');
  const wiresAbove = document.getElementById('wires-above');
  const snapIndicator = document.getElementById('snap-indicator');
  const statusText = document.getElementById('status-text');
  const snapInfo = document.getElementById('snap-info');
  const btnWire = document.getElementById('btn-wire');
  const wireGaugeBar = document.getElementById('wire-gauge-bar');
  const wireGaugeDimensionalToggle = document.getElementById('wire-gauge-dimensional-toggle');
  const wireGaugePreviewToggle = document.getElementById('wire-gauge-preview-toggle');
  const wireSelectionReadout = document.getElementById('wire-selection-readout');
  const wireGaugeLengthEl = document.getElementById('wire-gauge-length');
  const wireGaugeResistanceEl = document.getElementById('wire-gauge-resistance');
  const wirePlaceCursorMark = document.getElementById('wire-place-cursor-mark');
  const wireGaugeMenuClose = document.getElementById('wire-gauge-menu-close');
  const wireGaugeReopen = document.getElementById('wire-gauge-reopen');
  const wireGaugeReopenLabel = document.getElementById('wire-gauge-reopen-label');
  const wireGaugeDropdownBtn = document.getElementById('wire-gauge-dropdown-btn');
  const wireGaugeDropdownLabel = document.getElementById('wire-gauge-dropdown-label');
  const wireGaugeOptionsEl = document.getElementById('wire-gauge-options');
  const wireGaugeOptions = document.querySelectorAll('.wire-gauge-option');
  const btnSolid = document.getElementById('btn-solid');
  const btnDashed = document.getElementById('btn-dashed');
  const btnLayerVisibility = document.getElementById('btn-layer-visibility');
  const btnLayerFront = document.getElementById('btn-layer-front');
  const btnLayerBack = document.getElementById('btn-layer-back');
  const layerButtonsEl = document.getElementById('layer-buttons');
  const colorSwatches = document.querySelectorAll('.color-swatch');
  const btnAccentCycle = document.getElementById('btn-accent-cycle');
  const marqueeBox = document.getElementById('marquee-box');
  const wireEndLabelStart = document.querySelector('.wire-end-label[data-end="start"]');
  const wireEndLabelEnd = document.querySelector('.wire-end-label[data-end="end"]');
  let wireEndLabelHoverId = null;
  const assetConfigBtn = document.getElementById('asset-config-btn');
  const assetConfigMenu = document.getElementById('asset-config-menu');
  const assetStateChrome = document.getElementById('asset-state-chrome');
  const assetStateNumbers = document.getElementById('asset-state-numbers');
  const assetStateAdd = document.getElementById('asset-state-add');
  const assetStateTermMenu = document.getElementById('asset-state-term-menu');
  let assetStateClickTimer = null;
  let assetStateMenuIndex = null;
  const alignBar = document.getElementById('align-bar');
  const btnAlignColumn = document.getElementById('btn-align-column');
  const btnAlignRow = document.getElementById('btn-align-row');
  const btnRotateCcw = document.getElementById('btn-rotate-ccw');
  const btnRotateCw = document.getElementById('btn-rotate-cw');

  let placementMode = null;
  let accentThemeIndex = 0;
  let wireMode = false;
  let wireStyle = 'solid';
  let wireColor = 'white';
  /** Default new-wire gauge (mm). 1 grid unit = 1 mm → stroke_px = mm × WORKSPACE_GRID. */
  const DEFAULT_WIRE_GAUGE_MM = 0.64;
  /** Non-dim tip (1px) / sleeve (2px); dimensional tips = sleeveStroke × TIP_RATIO. */
  const TIP_RATIO = 0.5;
  let wireGaugeMm = DEFAULT_WIRE_GAUGE_MM;
  /** When false (default), gauge data is inactive for resistance; stored gaugeMm kept. */
  let dimensionalWireGauge = false;
  /** When false (default), wires keep legacy visual thickness even if dimensional data is on. */
  let wireGaugePreview = false;
  let wireGaugeMenuOpen = false;
  let wireGaugeDropdownOpen = false;
  let wirePlaceCursorMarkTimer = null;
  let activeLayer = 1;
  let activeWorkspacePage = 'electronics';
  const textCommandBox = document.getElementById('text-command-box');
  const textCommandInput = document.getElementById('text-command-input');
  const textCommandHint = document.getElementById('text-command-hint');
  const dimLayer = document.getElementById('dim-layer');
  const dimLine = dimLayer?.querySelector('.dim-line');
  const dimMarkA = dimLayer?.querySelector('.dim-mark-a');
  const dimMarkB = dimLayer?.querySelector('.dim-mark-b');
  const dimLabel = dimLayer?.querySelector('.dim-label');
  const dimAnnotationsEl = document.getElementById('dim-annotations');
  const dimAnnotations = new Map();
  let dimAnnotationIdCounter = 0;
  const selectedDimAnnotationIds = new Set();
  let textCommandOpen = false;
  let dimTool = null;
  let schematicPeekOpen = false;
  let schematicPeekZoom = 1;
  let schematicPeekPanX = 0;
  let schematicPeekPanY = 0;
  const SCHEMATIC_ZOOM_MIN = 0.5;
  const SCHEMATIC_ZOOM_MAX = 3;
  const SCHEMATIC_ZOOM_STEP = 0.1;
  const workspacePageElectronics = document.getElementById('workspace-page-electronics');
  const workspacePagePanel = document.getElementById('workspace-page-panel');
  const panelSnapPoints = new Map();
  let panelSnapMode = false;
  let panelSnapIdCounter = 0;
  let selectedPanelSnapIds = new Set();
  let panelLayerVisible = true;
  /** Panel CAD: Tab toggles cursor grid snap (object mid/center snaps still apply). */
  let panelCursorGridSnap = true;
  const workspacePagePanelVisibility = document.getElementById('workspace-page-panel-visibility');
  const selectedComponents = new Set();
  const selectedWireGroups = new Set();
  let componentIdCounter = 0;
  let wireIdCounter = 0;
  let snapTimer = null;
  let activeHoverTerminal = null;
  let snappedTerminal = null;
  let snapPoint = null;
  /** Client coords when snap locked; move away from these to cancel. */
  let snapLockPointer = null;
  let wireDraftStart = null;
  let wireDraftAnchors = [];
  let wirePreviewLine = null;
  let marqueeStart = null;
  let marqueeActive = false;
  let suppressNextClick = false;
  const MARQUEE_MIN_PX = 4;
  const Q_HOLD_MS = 50;
  const Q_HOLD_MS_SELECTED = 310;
  /** Releases shorter than this are taps — wheel must not open / confirm. */
  const Q_TAP_MAX_MS = 140;
  const WIRE_WHEEL_ITEM = '__wire__';
  let recentAssetIds = [];
  let qHoldTimer = null;
  let qWheelOpen = false;
  let qWheelIndex = 0;
  let qKeyHeld = false;
  let qOpenedWheel = false;
  let qKeyDownAt = 0;
  let lastPointerX = 0;
  let lastPointerY = 0;
  /** True while pointer is down on a selected dual-coil body (placeholder). */
  let dualCoilBodyHeld = false;
  /** Wire currently under pointer-down (for +/- / wheel bend while holding). */
  let heldWireId = null;
  /** Dual-coil tip/fan held for bend (tip + coloured lead are one conductor). */
  let heldHbConductor = null;

  const components = new Map();
  const wires = new Map();
  const terminalWireMap = new Map();
  const layerState = {};
  const layerGroups = { below: {}, above: {} };

  for (let i = 1; i <= LAYER_COUNT; i++) {
    layerState[i] = { visible: true, above: false };
  }

  /** User-facing zoom: 1 = 100% → 1 grid = WORKSPACE_GRID CSS px on screen. */
  let zoom = 1;
  let panX = 0;
  let panY = 0;

  /** CSS transform scale factor (identity with zoom; zoom=1 → scale(1)). */
  function viewportScale(z = zoom) {
    return z;
  }

  const gridScaleSquare = document.getElementById('grid-scale-square');
  const gridScaleLabelV = document.querySelector('.grid-scale-label-v');
  const gridScaleLabelH = document.querySelector('.grid-scale-label-h');

  function updateGridScaleIndicator(currentZoom = zoom) {
    if (!gridScaleSquare) return;
    // At zoom = 1 (100%), square is 5mm × 5mm on screen (former 200% size).
    const sideMm = 5 * currentZoom;
    gridScaleSquare.style.width = `${sideMm}mm`;
    gridScaleSquare.style.height = `${sideMm}mm`;
    const label = `${currentZoom.toFixed(2)}x`;
    if (gridScaleLabelV) gridScaleLabelV.textContent = label;
    if (gridScaleLabelH) gridScaleLabelH.textContent = label;
  }

  function applyViewport() {
    workspace.style.transform = `translate(${panX}px, ${panY}px) scale(${viewportScale()})`;
    updateAllWirePositions();
    updateAssetConfigChrome();
    updateGridScaleIndicator(zoom);
  }

  function clientToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const s = viewportScale();
    return {
      x: (clientX - rect.left - panX) / s,
      y: (clientY - rect.top - panY) / s,
    };
  }

  function worldToClient(x, y) {
    const rect = canvas.getBoundingClientRect();
    const s = viewportScale();
    return {
      x: rect.left + panX + x * s,
      y: rect.top + panY + y * s,
    };
  }

  function screenDeltaToWorld(dx, dy) {
    const s = viewportScale();
    return { x: dx / s, y: dy / s };
  }

  function placementPanelSnapThresholdWorld() {
    return PLACEMENT_PANEL_SNAP_SCREEN_PX / viewportScale();
  }

  function isMouseWheel(e) {
    return e.deltaMode === WheelEvent.DOM_DELTA_LINE;
  }

  function setZoomAt(clientX, clientY, nextZoom) {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoom));
    if (clamped === zoom) return;
    const rect = canvas.getBoundingClientRect();
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;
    const s = viewportScale();
    const nextS = viewportScale(clamped);
    const worldX = (vx - panX) / s;
    const worldY = (vy - panY) / s;
    panX = vx - worldX * nextS;
    panY = vy - worldY * nextS;
    zoom = clamped;
    applyViewport();
    // Re-project CAD cursor — screen position of the snap point changes with zoom/pan
    if (activeWorkspacePage === 'panel' && panelCursorGridSnap) {
      refreshPanelCadCursorAfterViewport(clientX, clientY);
    }
    setStatus(`Zoom ${Math.round(zoom * 100)}%`);
  }

  function zoomAtSmooth(clientX, clientY, deltaY) {
    const factor = Math.exp(-deltaY * ZOOM_SENS);
    setZoomAt(clientX, clientY, zoom * factor);
  }

  function zoomAtStep(clientX, clientY, direction) {
    const stepped = Math.round(zoom / ZOOM_STEP) * ZOOM_STEP + direction * ZOOM_STEP;
    setZoomAt(clientX, clientY, stepped);
  }

  let lightningMode = false;
  let groundCheckMode = false;
  let wireEditFocusMode = false;
  let shortCheckMode = false;

  /**
   * Lightning mode: glow wires on conducting nets that carry signal.
   * Seeds = terminalActive terminals + switch closed-contact (bridge) poles.
   * Nets from buildWireNets() (wires, tip docks, state bridges).
   */
  function refreshLightningWireGlow() {
    wires.forEach((wire) => {
      wire.group.classList.remove('lightning-glow');
    });
    if (!lightningMode) return;

    const seedTerms = new Set();
    components.forEach((comp) => {
      const template = GuitarAssets.getTemplate(comp.dataset.assetId);
      if (!template) return;
      const states = GuitarAssets.getEffectiveStates(comp);
      const state = states[GuitarAssets.getComponentStateIndex(comp)];
      if (!state) return;
      const terms = [...comp.querySelectorAll('.terminal')];
      terms.forEach((term, idx) => {
        if (state.terminalActive?.[idx]) seedTerms.add(term);
      });
      // Closed contacts: seed bridge poles even if terminalActive drifts
      state.bridges?.forEach((pair) => {
        const a = terms[pair[0]];
        const b = terms[pair[1]];
        if (a) seedTerms.add(a);
        if (b) seedTerms.add(b);
      });
    });
    if (!seedTerms.size) return;

    const liveTerms = new Set();
    buildWireNets().forEach((net) => {
      let seeded = false;
      for (const t of seedTerms) {
        if (net.has(t)) {
          seeded = true;
          break;
        }
      }
      if (!seeded) return;
      net.forEach((t) => liveTerms.add(t));
    });
    if (!liveTerms.size) return;

    wires.forEach((wire) => {
      if (liveTerms.has(wire.start.terminal) || liveTerms.has(wire.end.terminal)) {
        wire.group.classList.add('lightning-glow');
      }
    });
  }

  function refreshGroundCheckAlert() {
    components.forEach((comp) => {
      comp.classList.remove('ungrounded-alert');
    });
    if (groundCheckMode) {
      components.forEach((comp) => {
        if (!componentNeedsGrounding(comp)) return;
        if (componentReachesOutputGround(comp)) return;
        comp.classList.add('ungrounded-alert');
      });
    }
    notifyCircuitFaultWarningChanged();
    refreshGroundNetChase();
  }

  /** Terminals + wires on nets that reach an output-jack ISGROUND (G). */
  function collectGroundNetMembership() {
    const groundSources = collectOutputJackGroundTerminals();
    const groundTerms = new Set();
    if (!groundSources.size) return { groundSources, groundTerms, groundWires: [] };
    buildWireNets().forEach((net) => {
      let touches = false;
      for (const g of groundSources) {
        if (net.has(g)) {
          touches = true;
          break;
        }
      }
      if (!touches) return;
      net.forEach((t) => groundTerms.add(t));
    });
    const groundWires = [];
    wires.forEach((wire) => {
      const a = wire.start?.terminal;
      const b = wire.end?.terminal;
      if ((a && groundTerms.has(a)) || (b && groundTerms.has(b))) {
        groundWires.push(wire);
      }
    });
    return { groundSources, groundTerms, groundWires };
  }

  /**
   * Ordered wire hops from YESGROUND (or ground-net leaves) toward output jack G.
   * Each step: { wire, from, to } traveling toward ground.
   */
  function buildGroundChaseChains(membership) {
    const { groundSources, groundTerms } = membership;
    if (!groundSources?.size || !groundTerms?.size) return [];

    const adj = new Map();
    function link(a, b, wire) {
      if (!a || !b || a === b) return;
      if (!groundTerms.has(a) || !groundTerms.has(b)) return;
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push({ term: b, wire });
      adj.get(b).push({ term: a, wire });
    }
    wires.forEach((wire) => link(wire.start?.terminal, wire.end?.terminal, wire));

    // BFS from ISGROUND sinks so parent pointers walk leaf → ground
    const parent = new Map();
    const queue = [];
    groundSources.forEach((g) => {
      if (!groundTerms.has(g)) return;
      parent.set(g, null);
      queue.push(g);
    });
    while (queue.length) {
      const cur = queue.shift();
      for (const edge of adj.get(cur) || []) {
        if (parent.has(edge.term)) continue;
        parent.set(edge.term, { prev: cur, wire: edge.wire });
        queue.push(edge.term);
      }
    }

    const seeds = [];
    const seedSeen = new Set();
    function addSeed(term) {
      if (!term || !parent.has(term) || seedSeen.has(term)) return;
      if (groundSources.has(term)) return;
      seedSeen.add(term);
      seeds.push(term);
    }

    components.forEach((comp) => {
      if (!componentNeedsGrounding(comp)) return;
      if (!componentReachesOutputGround(comp)) return;
      comp.querySelectorAll('.terminal').forEach((term) => addSeed(term));
    });

    // Fallback: farthest leaves on the ground wire graph
    if (!seeds.length) {
      groundTerms.forEach((term) => {
        if (groundSources.has(term)) return;
        const degree = (adj.get(term) || []).length;
        if (degree <= 1) addSeed(term);
      });
    }
    if (!seeds.length) {
      groundTerms.forEach((term) => addSeed(term));
    }

    const chains = [];
    const seenSig = new Set();
    seeds.forEach((seed) => {
      const steps = [];
      let cur = seed;
      const guard = new Set();
      while (parent.get(cur)) {
        if (guard.has(cur)) break;
        guard.add(cur);
        const hop = parent.get(cur);
        steps.push({ wire: hop.wire, from: cur, to: hop.prev });
        cur = hop.prev;
      }
      if (!steps.length) return;
      const sig = steps.map((s) => `${s.wire.id}:${s.from?.dataset?.id || ''}`).join('>');
      if (seenSig.has(sig)) return;
      seenSig.add(sig);
      chains.push(steps);
    });
    return chains;
  }

  function sampleOrientedWirePathD(measurePath, wire, fromTerm, toTerm) {
    const src = wire?.visible || wire?.hit;
    const d = src?.getAttribute?.('d');
    if (!d || !measurePath) return null;
    measurePath.setAttribute('d', d);
    let len = 0;
    try {
      len = measurePath.getTotalLength();
    } catch (_) {
      return null;
    }
    if (!(len > 0)) return null;

    function termWorld(term) {
      if (!term) return null;
      const c = getTerminalCenter(term);
      return clientToWorld(c.x, c.y);
    }

    const toW = termWorld(toTerm);
    const fromW = termWorld(fromTerm);
    let reverse = false;
    const p0 = measurePath.getPointAtLength(0);
    const p1 = measurePath.getPointAtLength(len);
    // Prefer ending at the ground-ward terminal so the chase runs into ISGROUND
    if (toW) {
      const d0 = Math.hypot(p0.x - toW.x, p0.y - toW.y);
      const d1 = Math.hypot(p1.x - toW.x, p1.y - toW.y);
      reverse = d0 < d1;
    } else if (fromW) {
      const d0 = Math.hypot(p0.x - fromW.x, p0.y - fromW.y);
      const d1 = Math.hypot(p1.x - fromW.x, p1.y - fromW.y);
      reverse = d1 < d0;
    } else if (fromTerm && wire.start?.terminal === toTerm) {
      reverse = true;
    }

    const steps = Math.max(14, Math.min(96, Math.ceil(len / 3)));
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = reverse ? (steps - i) / steps : i / steps;
      pts.push(measurePath.getPointAtLength(len * t));
    }
    return {
      d: pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' '),
      points: pts,
      length: len,
    };
  }

  const GROUND_CHASE_BASE_LEN = 32;
  const GROUND_CHASE_SPEED = 100; // world px / sec
  const GROUND_CHASE_TOUCH = 6; // merge when gaps ≤ this
  let groundChaseAnim = null;

  function stopGroundChaseAnim() {
    if (groundChaseAnim?.raf) cancelAnimationFrame(groundChaseAnim.raf);
    groundChaseAnim = null;
  }

  function clearGroundNetChase() {
    stopGroundChaseAnim();
    document.body.classList.remove('ground-net-chase-active');
    wires.forEach((wire) => wire.group?.classList.remove('ground-net-glow'));
    document.querySelectorAll('.terminal.ground-chase-sink').forEach((el) => {
      el.classList.remove('ground-chase-sink');
    });
    const layer = document.getElementById('ground-chase-layer');
    if (layer) layer.replaceChildren();
  }

  function ensureGroundChaseLayer() {
    let layer = document.getElementById('ground-chase-layer');
    if (!layer) {
      layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      layer.id = 'ground-chase-layer';
      layer.setAttribute('class', 'ground-chase-layer');
      layer.setAttribute('pointer-events', 'none');
      wiresAbove?.appendChild(layer);
    } else {
      wiresAbove?.appendChild(layer);
    }
    return layer;
  }

  /** Remaining distance along edge chain from a head position to ISGROUND. */
  function groundChaseDistToSink(edges, edgeIdx, head) {
    if (edgeIdx == null || !edges[edgeIdx]) return 0;
    let dist = Math.max(0, edges[edgeIdx].length - head);
    let idx = edges[edgeIdx].nextIdx;
    const guard = new Set();
    while (idx != null && edges[idx] && !guard.has(idx)) {
      guard.add(idx);
      dist += edges[idx].length;
      idx = edges[idx].nextIdx;
    }
    return dist;
  }

  /**
   * Absolute progress toward G (larger = closer to sink) for merge compares.
   * Uses a large offset per edge chain so different branches stay separate until
   * they share the same edge (or adjacent edges into the same trunk).
   */
  function groundChaseFrontKey(edges, blob) {
    return -groundChaseDistToSink(edges, blob.edgeIdx, blob.head);
  }

  function mergeGroundChaseBlobs(edges, blobs) {
    if (blobs.length < 2) return blobs;
    const touch = GROUND_CHASE_TOUCH;
    let list = blobs.map((b) => ({ ...b }));
    let changed = true;
    let guard = 0;
    while (changed && guard++ < 64) {
      changed = false;
      // Same-edge merges
      const byEdge = new Map();
      list.forEach((b, i) => {
        if (b.edgeIdx == null) return;
        if (!byEdge.has(b.edgeIdx)) byEdge.set(b.edgeIdx, []);
        byEdge.get(b.edgeIdx).push(i);
      });
      const remove = new Set();
      byEdge.forEach((idxs) => {
        idxs.sort((a, b) => list[a].head - list[b].head);
        for (let n = 1; n < idxs.length; n++) {
          const iPrev = idxs[n - 1];
          const iCur = idxs[n];
          if (remove.has(iPrev) || remove.has(iCur)) continue;
          const a = list[iPrev];
          const b = list[iCur];
          const aTail = a.head - a.length;
          const bTail = b.head - b.length;
          // Touch / overlap along the edge
          if (bTail > a.head + touch) continue;
          const front = Math.max(a.head, b.head);
          const combined = a.length + b.length; // combine lengths; grow only in the back
          a.head = front;
          a.length = combined;
          remove.add(iCur);
          changed = true;
        }
      });
      if (remove.size) {
        list = list.filter((_, i) => !remove.has(i));
        continue;
      }

      // Adjacent-edge merges (rear blob entering the edge ahead)
      let didAdj = false;
      for (let i = 0; i < list.length && !didAdj; i++) {
        const a = list[i];
        if (a.edgeIdx == null) continue;
        const nextIdx = edges[a.edgeIdx]?.nextIdx;
        if (nextIdx == null) continue;
        const edgeLen = edges[a.edgeIdx].length;
        if (a.head < edgeLen - touch) continue;
        for (let j = 0; j < list.length; j++) {
          if (i === j) continue;
          const b = list[j];
          if (b.edgeIdx !== nextIdx) continue;
          const bTail = b.head - b.length;
          if (bTail > touch && a.head < edgeLen) continue;
          const aKey = groundChaseFrontKey(edges, a);
          const bKey = groundChaseFrontKey(edges, b);
          if (bKey >= aKey) {
            // b ahead — keep its front; combined length grows only in the back
            b.length = a.length + b.length;
            list.splice(i, 1);
          } else {
            a.length = a.length + b.length;
            list.splice(j, 1);
          }
          changed = true;
          didAdj = true;
          break;
        }
      }
    }
    return list;
  }

  function advanceGroundChaseBlobs(edges, blobs, dt) {
    const speed = GROUND_CHASE_SPEED;
    const next = [];
    blobs.forEach((blob) => {
      let edgeIdx = blob.edgeIdx;
      let head = blob.head + speed * dt;
      let length = blob.length;
      if (edgeIdx == null || !edges[edgeIdx]) return;

      while (edges[edgeIdx] && head > edges[edgeIdx].length) {
        const overflow = head - edges[edgeIdx].length;
        const nIdx = edges[edgeIdx].nextIdx;
        if (nIdx == null) {
          // Disappear into ISGROUND: eat length from the front
          length -= overflow;
          head = edges[edgeIdx].length;
          break;
        }
        edgeIdx = nIdx;
        head = overflow;
      }

      if (length <= 1) {
        // Respawn at origin of this blob's chain
        const spawn = blob.spawnEdgeIdx;
        if (spawn != null && edges[spawn]) {
          next.push({
            edgeIdx: spawn,
            head: 0,
            length: GROUND_CHASE_BASE_LEN,
            spawnEdgeIdx: spawn,
          });
        }
        return;
      }

      next.push({
        edgeIdx,
        head,
        length,
        spawnEdgeIdx: blob.spawnEdgeIdx,
      });
    });
    return mergeGroundChaseBlobs(edges, next);
  }

  /** Subpath of an oriented edge between distances [a, b] along the edge. */
  function groundChaseEdgeSubpath(edge, a, b) {
    const pts = edge.points;
    if (!pts?.length) return '';
    const len = edge.length || 1;
    const t0 = Math.max(0, Math.min(1, a / len));
    const t1 = Math.max(0, Math.min(1, b / len));
    if (t1 <= t0 + 1e-4) return '';
    const i0 = Math.floor(t0 * (pts.length - 1));
    const i1 = Math.max(i0 + 1, Math.ceil(t1 * (pts.length - 1)));
    function lerpAt(t) {
      const f = t * (pts.length - 1);
      const i = Math.floor(f);
      const j = Math.min(pts.length - 1, i + 1);
      const u = f - i;
      return {
        x: pts[i].x + (pts[j].x - pts[i].x) * u,
        y: pts[i].y + (pts[j].y - pts[i].y) * u,
      };
    }
    const start = lerpAt(t0);
    const end = lerpAt(t1);
    let d = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;
    for (let i = i0 + 1; i < i1; i++) {
      d += ` L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
    }
    d += ` L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    return d;
  }

  /**
   * Draw a blob that may extend behind its head across previous edges.
   * Length only paints behind the front (toward the leaves).
   */
  function groundChaseBlobPathD(edges, blob) {
    let remaining = blob.length;
    let edgeIdx = blob.edgeIdx;
    let head = blob.head;
    const parts = [];
    const guard = new Set();

    while (remaining > 0.5 && edgeIdx != null && edges[edgeIdx] && !guard.has(edgeIdx)) {
      guard.add(edgeIdx);
      const edge = edges[edgeIdx];
      const paintEnd = Math.min(edge.length, Math.max(0, head));
      const paintStart = Math.max(0, paintEnd - remaining);
      const sub = groundChaseEdgeSubpath(edge, paintStart, paintEnd);
      if (sub) parts.push(sub);
      remaining -= (paintEnd - paintStart);
      if (remaining <= 0.5) break;
      // Walk backward toward leaves: find edge whose next is this one
      let prevIdx = null;
      for (let i = 0; i < edges.length; i++) {
        if (edges[i].nextIdx === edgeIdx) {
          prevIdx = i;
          break;
        }
      }
      // If multiple parents (merged trunk), prefer spawn spine via spawnEdgeIdx walk — take first
      // For branched backs after merge, length sits on the spine behind the front only (one path)
      if (prevIdx == null) break;
      edgeIdx = prevIdx;
      head = edges[edgeIdx].length;
    }

    return parts.join(' ');
  }

  function renderGroundChaseRunners(anim) {
    const { edges, blobs, runnerEls, layer } = anim;
    while (runnerEls.length < blobs.length) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('class', 'ground-chase-runner');
      el.setAttribute('fill', 'none');
      layer.appendChild(el);
      runnerEls.push(el);
    }
    runnerEls.forEach((el, i) => {
      if (i >= blobs.length) {
        el.setAttribute('d', '');
        el.style.display = 'none';
        return;
      }
      el.style.display = '';
      el.setAttribute('d', groundChaseBlobPathD(edges, blobs[i]));
    });
  }

  function startGroundChaseAnim(edges, blobs, layer) {
    stopGroundChaseAnim();
    const runnerEls = [];
    groundChaseAnim = {
      edges,
      blobs,
      layer,
      runnerEls,
      lastT: performance.now(),
      raf: 0,
    };
    renderGroundChaseRunners(groundChaseAnim);

    function frame(now) {
      if (!groundChaseAnim) return;
      const dt = Math.min(0.048, (now - groundChaseAnim.lastT) / 1000);
      groundChaseAnim.lastT = now;
      groundChaseAnim.blobs = advanceGroundChaseBlobs(
        groundChaseAnim.edges,
        groundChaseAnim.blobs,
        dt
      );
      renderGroundChaseRunners(groundChaseAnim);
      groundChaseAnim.raf = requestAnimationFrame(frame);
    }
    groundChaseAnim.raf = requestAnimationFrame(frame);
  }

  /**
   * Wire-focus + ground-focus: highlight the grounding net and chase a white
   * solid segment along each chain into the output jack ISGROUND (G).
   * Meeting segments merge (combined length; front stays, grows only in the back).
   */
  function refreshGroundNetChase() {
    clearGroundNetChase();
    if (!wireEditFocusMode || !groundCheckMode) return;

    const membership = collectGroundNetMembership();
    if (!membership.groundSources.size || !membership.groundWires.length) return;

    document.body.classList.add('ground-net-chase-active');
    membership.groundWires.forEach((wire) => {
      wire.group?.classList.add('ground-net-glow');
    });
    membership.groundSources.forEach((term) => {
      term.classList.add('ground-chase-sink');
    });

    const chains = buildGroundChaseChains(membership);
    if (!chains.length) return;

    const layer = ensureGroundChaseLayer();
    const measure = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    measure.setAttribute('fill', 'none');
    layer.appendChild(measure);

    // Unique directed edges toward G (wire may appear on multiple chains — share one edge)
    const edges = [];
    const edgeKeyToIdx = new Map();

    function polylineLen(pts) {
      let l = 0;
      for (let i = 1; i < pts.length; i++) {
        l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      }
      return l;
    }

    function ensureEdge(step) {
      const key = `${step.wire.id}>${step.to?.dataset?.terminalIndex ?? ''}:${step.to?.closest?.('.component')?.dataset?.id ?? ''}`;
      if (edgeKeyToIdx.has(key)) return edgeKeyToIdx.get(key);
      const oriented = sampleOrientedWirePathD(measure, step.wire, step.from, step.to);
      if (!oriented) return null;
      const idx = edges.length;
      const length = Math.max(oriented.length, polylineLen(oriented.points));
      edges.push({
        key,
        wire: step.wire,
        from: step.from,
        to: step.to,
        d: oriented.d,
        points: oriented.points,
        length,
        nextIdx: null,
      });
      edgeKeyToIdx.set(key, idx);
      return idx;
    }

    const chainStartEdges = [];
    chains.forEach((steps) => {
      const idxs = [];
      steps.forEach((step) => {
        const idx = ensureEdge(step);
        if (idx != null) idxs.push(idx);
      });
      for (let i = 0; i < idxs.length - 1; i++) {
        edges[idxs[i]].nextIdx = idxs[i + 1];
      }
      if (idxs.length) chainStartEdges.push(idxs[0]);
    });

    // Trails
    edges.forEach((edge) => {
      const trail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      trail.setAttribute('class', 'ground-chase-trail');
      trail.setAttribute('d', edge.d);
      trail.setAttribute('fill', 'none');
      layer.appendChild(trail);
    });

    measure.remove();

    const blobs = chainStartEdges.map((spawnEdgeIdx) => ({
      edgeIdx: spawnEdgeIdx,
      head: 0,
      length: GROUND_CHASE_BASE_LEN,
      spawnEdgeIdx,
    }));

    startGroundChaseAnim(edges, blobs, layer);
  }

  const MOODLE_ISSUE = {
    grounding: 'Grounding Problem',
    short: 'Short Circuit',
    disconnected: 'Disconnected',
  };

  let moodleIssueCache = { byComp: new Map(), byWire: new Map() };
  let moodleFaultHighlightActive = false;
  let moodleDisconnectedHighlightActive = false;
  let moodleHoverBound = false;

  /** Asset id at a wire end via terminal attach or tip designation. */
  function resolveWireEndAssetId(wire, which) {
    if (!wire) return null;
    const ep = wire[which];

    if (isAssetWire(wire) && wire.assetWireCompId != null) {
      const ownerId = String(wire.assetWireCompId);
      if (which === 'start') return components.has(ownerId) ? ownerId : null;
      const owner = components.get(ownerId);
      if (!owner) return null;
      const tipIdx = wire.assetWireTipIndex;
      const attachTerm = getAssetWireTipAttachedTerminal(owner, tipIdx);
      if (attachTerm) {
        const host = attachTerm.closest('.component');
        if (host?.dataset?.id && components.has(host.dataset.id)) return host.dataset.id;
      }
      const attachCompId = owner.dataset[`awTip${tipIdx}AttachComp`];
      if (attachCompId && components.has(attachCompId)) return String(attachCompId);
      // Tip terminal alone is still the owning asset — not a second connection
      return null;
    }

    if (isHbLeadWire(wire) && wire.hbLeadCompId != null) {
      const ownerId = String(wire.hbLeadCompId);
      const tipOnStart = wire.start?.terminal?.classList?.contains('hb-tip');
      const tipOnEnd = wire.end?.terminal?.classList?.contains('hb-tip');
      const isTipEnd =
        (which === 'start' && tipOnStart) ||
        (which === 'end' && tipOnEnd) ||
        (which === 'start' && !tipOnStart && !tipOnEnd);
      if (isTipEnd) return components.has(ownerId) ? ownerId : null;
      if (ep?.terminal && document.body.contains(ep.terminal)) {
        const host = ep.terminal.closest('.component');
        if (host?.dataset?.id && components.has(host.dataset.id)) return host.dataset.id;
      }
      const owner = components.get(ownerId);
      if (owner) {
        const attachTerm = getHbTipAttachedTerminal(owner, wire.hbLeadTipIndex);
        if (attachTerm) {
          const host = attachTerm.closest('.component');
          if (host?.dataset?.id && components.has(host.dataset.id)) return host.dataset.id;
        }
        const attachCompId = owner.dataset[`hbTip${wire.hbLeadTipIndex}AttachComp`];
        if (attachCompId && components.has(attachCompId)) return String(attachCompId);
      }
      return null;
    }

    if (ep?.terminal && document.body.contains(ep.terminal)) {
      const host = ep.terminal.closest('.component');
      if (host?.dataset?.id && components.has(host.dataset.id)) return host.dataset.id;
    }
    return null;
  }

  /** Connected = both ends resolve to assets (terminal or designation). */
  function isWireConnectedToTwoAssets(wire) {
    const a = resolveWireEndAssetId(wire, 'start');
    const b = resolveWireEndAssetId(wire, 'end');
    return !!(a && b);
  }

  function isElectronicsWire(wire) {
    if (!wire) return false;
    const ids = [
      resolveWireEndAssetId(wire, 'start'),
      resolveWireEndAssetId(wire, 'end'),
      wire.assetWireCompId != null ? String(wire.assetWireCompId) : null,
      wire.hbLeadCompId != null ? String(wire.hbLeadCompId) : null,
    ].filter(Boolean);
    if (ids.length) {
      return ids.some((id) => {
        const c = components.get(id);
        return (
          c &&
          getComponentWorkspacePage(c) === 'electronics' &&
          !c.classList.contains('workspace-page-hidden')
        );
      });
    }
    return typeof activeWorkspacePage === 'undefined' || activeWorkspacePage === 'electronics';
  }

  function primaryMoodleIssue(reasons) {
    if (!reasons?.size) return null;
    if (reasons.has(MOODLE_ISSUE.short)) return MOODLE_ISSUE.short;
    if (reasons.has(MOODLE_ISSUE.grounding)) return MOODLE_ISSUE.grounding;
    if (reasons.has(MOODLE_ISSUE.disconnected)) return MOODLE_ISSUE.disconnected;
    return [...reasons][0] || null;
  }

  function collectMoodleIssues() {
    const byComp = new Map();
    const byWire = new Map();

    function addComp(comp, reason) {
      if (!comp) return;
      if (getComponentWorkspacePage(comp) !== 'electronics') return;
      if (comp.classList.contains('workspace-page-hidden')) return;
      if (!byComp.has(comp)) byComp.set(comp, new Set());
      byComp.get(comp).add(reason);
    }

    function addWire(id, reason) {
      if (id == null) return;
      const wire = wires.get(id);
      if (!wire || !isElectronicsWire(wire)) return;
      if (!byWire.has(id)) byWire.set(id, new Set());
      byWire.get(id).add(reason);
    }

    components.forEach((comp) => {
      if (!componentNeedsGrounding(comp)) return;
      if (componentReachesOutputGround(comp)) return;
      addComp(comp, MOODLE_ISSUE.grounding);
    });

    analyzeShortCircuits().shorts.forEach((s) => {
      s.terminals.forEach((t) => {
        addComp(t.closest?.('.component'), MOODLE_ISSUE.short);
        terminalWireMap.get(t)?.forEach((wid) => addWire(wid, MOODLE_ISSUE.short));
      });
    });

    wires.forEach((wire) => {
      if (!isElectronicsWire(wire)) return;
      if (!isWireConnectedToTwoAssets(wire)) {
        addWire(wire.id, MOODLE_ISSUE.disconnected);
      }
    });

    moodleIssueCache = { byComp, byWire };
    return moodleIssueCache;
  }

  function countMoodleWarningIssues(cache) {
    const issues = new Set();
    (cache || moodleIssueCache).byComp.forEach((reasons, comp) => {
      if (reasons.has(MOODLE_ISSUE.grounding) || reasons.has(MOODLE_ISSUE.short)) {
        const id = comp.dataset?.id || comp.id;
        if (id) issues.add(`c:${id}`);
      }
    });
    (cache || moodleIssueCache).byWire.forEach((reasons, id) => {
      if (reasons.has(MOODLE_ISSUE.grounding) || reasons.has(MOODLE_ISSUE.short)) {
        issues.add(`w:${id}`);
      }
    });
    return issues.size;
  }

  function countMoodleDisconnectedIssues(cache) {
    let n = 0;
    (cache || moodleIssueCache).byWire.forEach((reasons) => {
      if (reasons.has(MOODLE_ISSUE.disconnected)) n += 1;
    });
    return n;
  }

  function clearMoodleFaultHighlights() {
    moodleFaultHighlightActive = false;
    document.body.classList.remove('moodle-faults-live');
    components.forEach((comp) => comp.classList.remove('moodle-fault-alert'));
    wires.forEach((wire) => wire.group?.classList.remove('moodle-fault-glow'));
    hideMoodleIssueFloat();
  }

  function clearMoodleDisconnectedHighlights() {
    moodleDisconnectedHighlightActive = false;
    document.body.classList.remove('moodle-disconnected-live');
    wires.forEach((wire) => wire.group?.classList.remove('moodle-disconnected-throb'));
    hideMoodleIssueFloat();
  }

  function applyMoodleFaultHighlights() {
    const cache = collectMoodleIssues();
    clearMoodleFaultHighlights();
    let n = 0;
    cache.byComp.forEach((reasons, comp) => {
      if (reasons.has(MOODLE_ISSUE.grounding) || reasons.has(MOODLE_ISSUE.short)) {
        comp.classList.add('moodle-fault-alert');
        n += 1;
      }
    });
    cache.byWire.forEach((reasons, id) => {
      if (!(reasons.has(MOODLE_ISSUE.grounding) || reasons.has(MOODLE_ISSUE.short))) return;
      const wire = wires.get(id);
      if (wire?.group) {
        wire.group.classList.add('moodle-fault-glow');
        n += 1;
      }
    });
    if (n === 0) {
      setStatus('Moodle — no faults');
      return;
    }
    moodleFaultHighlightActive = true;
    document.body.classList.add('moodle-faults-live');
    setStatus(`Moodle — highlighting ${n} problem${n === 1 ? '' : 's'}`);
  }

  function applyMoodleDisconnectedHighlights() {
    const cache = collectMoodleIssues();
    clearMoodleDisconnectedHighlights();
    let n = 0;
    cache.byWire.forEach((reasons, id) => {
      if (!reasons.has(MOODLE_ISSUE.disconnected)) return;
      const wire = wires.get(id);
      if (wire?.group) {
        wire.group.classList.add('moodle-disconnected-throb');
        n += 1;
      }
    });
    if (n === 0) {
      setStatus('Moodle — no disconnected wires');
      return;
    }
    moodleDisconnectedHighlightActive = true;
    document.body.classList.add('moodle-disconnected-live');
    setStatus(`Moodle — ${n} disconnected wire${n === 1 ? '' : 's'}`);
  }

  function hideMoodleIssueFloat() {
    const el = document.getElementById('moodle-issue-float');
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
  }

  function showMoodleIssueFloat(text, clientX, clientY) {
    const el = document.getElementById('moodle-issue-float');
    if (!el || !text) {
      hideMoodleIssueFloat();
      return;
    }
    el.textContent = text;
    el.style.left = `${clientX}px`;
    el.style.top = `${clientY}px`;
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
  }

  function moodleIssueUnderPointer(clientX, clientY) {
    if (!moodleFaultHighlightActive && !moodleDisconnectedHighlightActive) return null;
    for (const el of document.elementsFromPoint(clientX, clientY)) {
      const group = el.closest?.('.wire-group');
      if (group?.dataset?.id) {
        const reasons = moodleIssueCache.byWire.get(group.dataset.id);
        if (!reasons?.size) continue;
        if (
          moodleDisconnectedHighlightActive &&
          group.classList.contains('moodle-disconnected-throb') &&
          reasons.has(MOODLE_ISSUE.disconnected)
        ) {
          return MOODLE_ISSUE.disconnected;
        }
        if (
          moodleFaultHighlightActive &&
          group.classList.contains('moodle-fault-glow')
        ) {
          const label = primaryMoodleIssue(reasons);
          if (label && label !== MOODLE_ISSUE.disconnected) return label;
        }
      }
      const comp = el.closest?.('.component');
      if (
        comp &&
        moodleFaultHighlightActive &&
        comp.classList.contains('moodle-fault-alert')
      ) {
        const reasons = moodleIssueCache.byComp.get(comp);
        const label = primaryMoodleIssue(reasons);
        if (label) return label;
      }
    }
    return null;
  }

  function bindMoodleIssueHover() {
    if (moodleHoverBound) return;
    moodleHoverBound = true;
    const onMove = (e) => {
      if (!moodleFaultHighlightActive && !moodleDisconnectedHighlightActive) {
        hideMoodleIssueFloat();
        return;
      }
      const issue = moodleIssueUnderPointer(e.clientX, e.clientY);
      if (issue) showMoodleIssueFloat(issue, e.clientX, e.clientY);
      else hideMoodleIssueFloat();
    };
    document.addEventListener('pointermove', onMove, { passive: true });
  }

  let circuitFaultWarningTimer = null;
  let moodleClickBound = false;

  function notifyCircuitFaultWarningChanged() {
    clearTimeout(circuitFaultWarningTimer);
    circuitFaultWarningTimer = setTimeout(() => {
      refreshCircuitFaultWarning();
    }, 120);
  }

  function setMoodleVisibility(el, badge, count, label) {
    if (!el || !badge) return;
    if (count > 0) {
      badge.textContent = String(count > 99 ? '99+' : count);
      el.hidden = false;
      el.removeAttribute('hidden');
      el.setAttribute('aria-hidden', 'false');
      el.tabIndex = 0;
      el.title = `Moodle — ${count} ${label}${count === 1 ? '' : 's'} (click to highlight)`;
      el.setAttribute('aria-label', `Moodle — ${count} ${label}${count === 1 ? '' : 's'}`);
      if (!el.classList.contains('is-visible')) {
        void el.offsetWidth;
        requestAnimationFrame(() => el.classList.add('is-visible'));
      }
    } else {
      el.classList.remove('is-visible');
      el.title = 'Moodle';
      el.setAttribute('aria-hidden', 'true');
      el.tabIndex = -1;
      window.setTimeout(() => {
        if (el.classList.contains('is-visible')) return;
        el.hidden = true;
        el.setAttribute('hidden', '');
      }, 420);
    }
  }

  function bindMoodleClick() {
    if (moodleClickBound) return;
    const warn = document.getElementById('circuit-fault-warning');
    const disc = document.getElementById('circuit-moodle-disconnected');
    moodleClickBound = true;
    bindMoodleIssueHover();

    if (warn) {
      const activateWarn = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!warn.classList.contains('is-visible') || warn.hidden) return;
        if (moodleFaultHighlightActive) {
          clearMoodleFaultHighlights();
          setStatus('Moodle — cleared fault highlight');
          return;
        }
        applyMoodleFaultHighlights();
      };
      warn.addEventListener('click', activateWarn);
      warn.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        activateWarn(e);
      });
    }

    if (disc) {
      const activateDisc = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disc.classList.contains('is-visible') || disc.hidden) return;
        if (moodleDisconnectedHighlightActive) {
          clearMoodleDisconnectedHighlights();
          setStatus('Moodle — cleared disconnected highlight');
          return;
        }
        applyMoodleDisconnectedHighlights();
      };
      disc.addEventListener('click', activateDisc);
      disc.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        activateDisc(e);
      });
    }
  }

  function refreshCircuitFaultWarning() {
    bindMoodleClick();
    let cache;
    try {
      cache = collectMoodleIssues();
    } catch (_) {
      cache = { byComp: new Map(), byWire: new Map() };
      moodleIssueCache = cache;
    }

    const warnCount = countMoodleWarningIssues(cache);
    const discCount = countMoodleDisconnectedIssues(cache);

    setMoodleVisibility(
      document.getElementById('circuit-fault-warning'),
      document.getElementById('circuit-fault-warning-badge'),
      warnCount,
      'fault'
    );
    setMoodleVisibility(
      document.getElementById('circuit-moodle-disconnected'),
      document.getElementById('circuit-moodle-disconnected-badge'),
      discCount,
      'disconnected wire'
    );

    if (moodleFaultHighlightActive) {
      if (warnCount === 0) clearMoodleFaultHighlights();
      else applyMoodleFaultHighlights();
    }
    if (moodleDisconnectedHighlightActive) {
      if (discCount === 0) clearMoodleDisconnectedHighlights();
      else applyMoodleDisconnectedHighlights();
    }
  }

  function getTerminalRole(term) {
    if (!term) return null;
    const explicit = term.dataset.role;
    if (explicit) return explicit;
    if (term.dataset.isGround === 'true' || term.dataset.tag === 'ISGROUND') return 'G';
    const label = (term.dataset.terminalLabel || '').trim();
    if (label === 'H') return 'H';
    if (label === 'G') return 'G';
    if (label === '+') return 'P+';
    if (label === '−' || label === '-') return 'P-';
    if (label === 'N') return 'N';
    if (label === 'R') return 'R';
    if (label === 'S') return 'S';
    return null;
  }

  /** Build nets from wires + switch hard bridges in the current state. */
  function buildWireNets() {
    const parent = new Map();

    function find(t) {
      if (!parent.has(t)) parent.set(t, t);
      let root = t;
      while (parent.get(root) !== root) root = parent.get(root);
      let cur = t;
      while (cur !== root) {
        const next = parent.get(cur);
        parent.set(cur, root);
        cur = next;
      }
      return root;
    }

    function union(a, b) {
      if (!a || !b) return;
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    }

    wires.forEach((wire) => {
      union(wire.start.terminal, wire.end.terminal);
    });

    // Capacitor lead tips docked onto other terminals
    eachCapTipAttachmentPair(union);
    // Dual-coil fan tips docked onto other terminals
    eachHbTipAttachmentPair(union);
    // Custom-asset wire tips docked onto other terminals
    eachAssetWireTipAttachmentPair(union);

    // Switch (and any future) hard bridges for the active state
    components.forEach((comp) => {
      const template = GuitarAssets.getTemplate(comp.dataset.assetId);
      if (!template) return;
      const states = GuitarAssets.getEffectiveStates(comp);
      const state = states[GuitarAssets.getComponentStateIndex(comp)];
      const bridges = state?.bridges;
      if (!bridges?.length) return;
      const terms = [...comp.querySelectorAll('.terminal')];
      bridges.forEach((pair) => {
        const a = terms[pair[0]];
        const b = terms[pair[1]];
        if (a && b) union(a, b);
      });
    });

    const nets = new Map();
    parent.forEach((_, term) => {
      const root = find(term);
      if (!nets.has(root)) nets.set(root, new Set());
      nets.get(root).add(term);
    });
    components.forEach((comp) => {
      comp.querySelectorAll('.terminal').forEach((term) => {
        if (!parent.has(term)) {
          nets.set(term, new Set([term]));
        }
      });
    });
    return [...nets.values()];
  }

  /**
   * Passive guitar short check (wire graph only).
   * Pots/coils are resistive — not treated as hard bridges.
   * Ground↔ground ties are normal and never flagged.
   * P−↔G is a normal battery return and never flagged.
   */
  function analyzeShortCircuits() {
    const shorts = [];

    function flagNet(netTerms, reason) {
      shorts.push({ reason, terminals: [...netTerms] });
    }

    buildWireNets().forEach((net) => {
      if (net.size < 2) return;
      const roles = { H: [], R: [], G: [], 'P+': [], 'P-': [] };
      net.forEach((term) => {
        const role = getTerminalRole(term);
        if (role && roles[role]) roles[role].push(term);
      });

      const hasHG = roles.H.length > 0 && roles.G.length > 0;
      if (hasHG) {
        // Prefer tip–sleeve wording when an output jack's H and G are both on this net
        let tipSleeve = false;
        components.forEach((comp) => {
          if (!isOutputJackComponent(comp)) return;
          const terms = [...comp.querySelectorAll('.terminal')];
          const outH = terms.find((t) => getTerminalRole(t) === 'H');
          const outG = terms.find((t) => getTerminalRole(t) === 'G');
          if (outH && outG && net.has(outH) && net.has(outG)) tipSleeve = true;
        });
        flagNet(net, tipSleeve ? 'Output tip–sleeve short (H↔G)' : 'Signal short to ground (H↔G)');
      }

      const hasRG = roles.R.length > 0 && roles.G.length > 0;
      if (hasRG) {
        let ringSleeve = false;
        components.forEach((comp) => {
          if (!isOutputJackComponent(comp)) return;
          const terms = [...comp.querySelectorAll('.terminal')];
          const outR = terms.find((t) => getTerminalRole(t) === 'R');
          const outG = terms.find((t) => getTerminalRole(t) === 'G');
          if (outR && outG && net.has(outR) && net.has(outG)) ringSleeve = true;
        });
        flagNet(net, ringSleeve ? 'Output ring–sleeve short (R↔G)' : 'Ring short to ground (R↔G)');
      }

      const hasHR = roles.H.length > 0 && roles.R.length > 0;
      if (hasHR) {
        let tipRing = false;
        components.forEach((comp) => {
          if (!isOutputJackComponent(comp)) return;
          const terms = [...comp.querySelectorAll('.terminal')];
          const outH = terms.find((t) => getTerminalRole(t) === 'H');
          const outR = terms.find((t) => getTerminalRole(t) === 'R');
          if (outH && outR && net.has(outH) && net.has(outR)) tipRing = true;
        });
        flagNet(net, tipRing ? 'Output tip–ring short (H↔R)' : 'Tip–ring short (H↔R)');
      }

      // Active-power faults (only relevant if a battery is on the board)
      if (roles['P+'].length && roles['P-'].length) {
        flagNet(net, 'Battery short (P+↔P−)');
      }
      if (roles['P+'].length && roles.G.length) {
        flagNet(net, 'Battery + shorted to ground (P+↔G)');
      }
      // P−↔G intentionally ignored — normal ground return
    });

    return { shorts };
  }

  function clearShortCircuitHighlights() {
    components.forEach((comp) => {
      comp.classList.remove('short-alert', 'short-alert-warn');
    });
    wires.forEach((wire) => {
      wire.group.classList.remove('short-glow', 'short-glow-warn');
    });
  }

  function refreshShortCircuitCheck() {
    clearShortCircuitHighlights();
    if (!shortCheckMode) {
      notifyCircuitFaultWarningChanged();
      return null;
    }
    const result = analyzeShortCircuits();

    const shortCompSet = new Set();
    const shortWireSet = new Set();
    result.shorts.forEach((s) => {
      s.terminals.forEach((t) => {
        const c = t.closest?.('.component');
        if (c) shortCompSet.add(c);
        terminalWireMap.get(t)?.forEach((id) => shortWireSet.add(id));
      });
    });

    shortCompSet.forEach((comp) => comp.classList.add('short-alert'));
    shortWireSet.forEach((id) => wires.get(id)?.group.classList.add('short-glow'));

    notifyCircuitFaultWarningChanged();
    return result;
  }

  function toggleLightningMode() {
    lightningMode = !lightningMode;
    refreshLightningWireGlow();
    setStatus(lightningMode ? 'Active signal-path wires highlighted' : 'Active signal-path highlight off');
  }

  function toggleGroundCheckMode() {
    groundCheckMode = !groundCheckMode;
    document.body.classList.toggle('ground-check-on', groundCheckMode);
    refreshGroundCheckAlert();
    const ungrounded = groundCheckMode
      ? [...components.values()].filter(
          (comp) => componentNeedsGrounding(comp) && !componentReachesOutputGround(comp)
        )
      : [];
    if (!groundCheckMode) {
      setStatus('Ungrounded asset highlight off');
    } else if (wireEditFocusMode) {
      setStatus(
        ungrounded.length === 0
          ? 'Ground focus — grounding net highlighted · chase into ISGROUND'
          : `Ground focus — ${ungrounded.length} YESGROUND asset(s) not linked · net chase on connected chains`
      );
    } else if (ungrounded.length === 0) {
      setStatus('All YESGROUND assets are grounded to output jack G');
    } else {
      setStatus(`${ungrounded.length} YESGROUND asset(s) not linked to output jack G`);
    }
  }

  function toggleShortCheckMode() {
    shortCheckMode = !shortCheckMode;
    const result = refreshShortCircuitCheck();
    syncContextMenuShortCheckButtonLocal();
    if (!shortCheckMode) {
      setStatus('Short-circuit check off');
      return;
    }
    const nShort = result?.shorts.length || 0;
    if (nShort === 0) {
      setStatus('No hard shorts detected');
    } else {
      const reasons = [...new Set(result.shorts.map((s) => s.reason))];
      const detail = reasons.length <= 2 ? ` — ${reasons.join('; ')}` : '';
      setStatus(`${nShort} hard short(s)${detail}`);
    }
  }

  function syncContextMenuShortCheckButtonLocal() {
    const btn = document.getElementById('context-menu-short-check');
    if (!btn) return;
    btn.classList.toggle('active', shortCheckMode);
    btn.setAttribute('aria-pressed', shortCheckMode ? 'true' : 'false');
  }

  function syncContextMenuPowerButton() {
    const btn = document.getElementById('context-menu-power');
    if (!btn) return;
    btn.classList.toggle('active', lightningMode);
    btn.setAttribute('aria-pressed', lightningMode ? 'true' : 'false');
  }

  function syncContextMenuGroundButton() {
    const btn = document.getElementById('context-menu-ground');
    if (!btn) return;
    btn.classList.toggle('active', groundCheckMode);
    btn.setAttribute('aria-pressed', groundCheckMode ? 'true' : 'false');
  }

  function syncContextMenuWireFocusButton() {
    const btn = document.getElementById('context-menu-wire-focus');
    if (!btn) return;
    btn.classList.toggle('active', wireEditFocusMode);
    btn.setAttribute('aria-pressed', wireEditFocusMode ? 'true' : 'false');
  }

  function wireStackAboveForLayer(layer) {
    if (wireEditFocusMode && layerState[layer]?.visible) return true;
    return !!layerState[layer]?.above;
  }

  function applyWireEditFocusStacks() {
    wires.forEach((wire) => moveWireToStack(wire));
    if (wirePreviewLine) movePreviewToActiveLayer();
    moveAllHbWorldLeads();
  }

  function setWireEditFocusMode(active) {
    const next = !!active;
    if (wireEditFocusMode === next) {
      syncContextMenuWireFocusButton();
      return;
    }
    wireEditFocusMode = next;
    document.body.classList.toggle('wire-edit-focus', wireEditFocusMode);
    if (wireEditFocusMode) {
      selectedComponents.forEach((el) => el.classList.remove('selected'));
      selectedComponents.clear();
      closeAssetConfigMenu();
      closeAssetStateTermMenu();
      clearAssetStateClickTimer();
      updateAlignBar();
    } else {
      hideWireEndLabels();
    }
    applyWireEditFocusStacks();
    syncContextMenuWireFocusButton();
    refreshGroundNetChase();
    setStatus(
      wireEditFocusMode
        ? (groundCheckMode
          ? 'Wire edit focus on — ground net chase into ISGROUND'
          : 'Wire edit focus on — assets locked · visible wires in front')
        : 'Wire edit focus off — layer front/back restored'
    );
  }

  function toggleWireEditFocusMode() {
    setWireEditFocusMode(!wireEditFocusMode);
  }

  function isTypingTarget() {
    const tag = document.activeElement?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  /** Registry of Enter-box text commands (extend here). */
  const textCommands = [
    {
      id: 'dimension',
      name: 'Dimension',
      short: 'DIM',
      aliases: ['DIM', 'DIMENSION', 'D'],
      description: 'Measure distance between two points',
      run: () => startDimensionTool(),
    },
    {
      id: 'move',
      name: 'Move',
      short: 'MOVE',
      aliases: ['MOVE', 'M'],
      description: 'Move selection base→dest (snaps to object mid/centers)',
      run: () => startMoveTool(),
    },
    {
      id: 'note',
      name: 'Note',
      short: 'NOTE',
      aliases: ['NOTE', 'N', 'TEXT'],
      description: 'Add a draggable note window on the active page and layer',
      run: () => createNoteAtPointer(),
    },
  ];

  let moveTool = null;

  const noteWindowsEl = document.getElementById('note-windows');
  const noteWindows = new Map();
  let noteIdCounter = 0;
  const DEFAULT_NOTE_TITLE = 'Note - Untitled';

  const NOTE_SVG = {
    chevron:
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>',
    lockOpen:
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<rect x="5" y="11" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
      '<path d="M8 11V8a4 4 0 0 1 7.5-1.9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      '</svg>',
    lockClosed:
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<rect x="5" y="11" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
      '<path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      '</svg>',
    save:
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M5 3h11l3 3v15H5V3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="M8 3v6h8V3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="M8 17h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      '<rect x="9" y="13" width="6" height="4" fill="currentColor" opacity="0.35"/>' +
      '</svg>',
    pen:
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M4 20h4l11-11-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="M13 7l4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      '</svg>',
    del:
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>',
  };

  function syncNoteWindowVisibility(note) {
    if (!note?.el) return;
    const pageOk = note.page === activeWorkspacePage;
    const layerOk = layerState[note.layer]?.visible !== false;
    note.el.classList.toggle('hidden', !(pageOk && layerOk));
    note.el.style.zIndex = String(40 + (Number(note.layer) || 1));
  }

  function syncAllNoteWindowVisibility() {
    noteWindows.forEach(syncNoteWindowVisibility);
  }

  function setNoteExpanded(note, expanded) {
    note.expanded = !!expanded;
    note.el.classList.toggle('is-expanded', note.expanded);
    note.chevronBtn.setAttribute('aria-expanded', note.expanded ? 'true' : 'false');
    note.body.setAttribute('aria-hidden', note.expanded ? 'false' : 'true');
  }

  function setNoteEditing(note, editing) {
    note.editing = !!editing;
    note.el.classList.toggle('is-editing', note.editing);
    note.titleInput.disabled = !note.editing;
    note.pad.readOnly = !note.editing;
    note.pad.disabled = false;
    if (note.editing) {
      note.pad.focus();
    } else if (document.activeElement === note.pad || document.activeElement === note.titleInput) {
      note.pad.blur();
      note.titleInput.blur();
    }
  }

  function setNoteLocked(note, locked) {
    note.locked = !!locked;
    note.el.classList.toggle('is-locked', note.locked);
    note.lockBtn.innerHTML = note.locked ? NOTE_SVG.lockClosed : NOTE_SVG.lockOpen;
    note.lockBtn.title = note.locked ? 'Unlock — allow dragging' : 'Lock — prevent dragging';
    note.lockBtn.setAttribute('aria-pressed', note.locked ? 'true' : 'false');
  }

  async function exportNoteWindow(note) {
    const title = (note.titleInput.value || DEFAULT_NOTE_TITLE).trim() || DEFAULT_NOTE_TITLE;
    const body = note.pad.value || '';
    const text = `${title}\n\n${body}`;
    const safeName = `${title.replace(/[^\w\-]+/g, '_').slice(0, 48) || 'Note'}.txt`;
    try {
      if (typeof window.showSaveFilePicker === 'function') {
        const handle = await window.showSaveFilePicker({
          suggestedName: safeName,
          types: [
            {
              description: 'Text file',
              accept: { 'text/plain': ['.txt'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        setStatus(`Exported “${title}”`);
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported “${title}”`);
  }

  function deleteNoteWindow(id) {
    const note = noteWindows.get(id);
    if (!note) return;
    note.el.remove();
    noteWindows.delete(id);
    markProjectDirty();
    setStatus('Note deleted');
  }

  function clearAllNoteWindows() {
    noteWindows.forEach((note) => note.el.remove());
    noteWindows.clear();
    noteIdCounter = 0;
  }

  function createNoteWindow(opts = {}) {
    if (!noteWindowsEl) return null;
    const id = opts.id || `note-${++noteIdCounter}`;
    const match = /^note-(\d+)$/.exec(id);
    if (match) noteIdCounter = Math.max(noteIdCounter, Number(match[1]));

    const el = document.createElement('div');
    el.className = 'note-window';
    el.dataset.id = id;
    const x = opts.x ?? 80;
    const y = opts.y ?? 80;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    const panel = document.createElement('div');
    panel.className = 'note-panel';

    const bar = document.createElement('div');
    bar.className = 'note-bar';

    const chevronBtn = document.createElement('button');
    chevronBtn.type = 'button';
    chevronBtn.className = 'note-chevron';
    chevronBtn.title = 'Expand / collapse';
    chevronBtn.setAttribute('aria-label', 'Expand note');
    chevronBtn.innerHTML = NOTE_SVG.chevron;

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'note-title';
    titleInput.value = opts.title || DEFAULT_NOTE_TITLE;
    titleInput.maxLength = 48;
    titleInput.spellcheck = false;
    titleInput.autocomplete = 'off';
    titleInput.disabled = true;

    const actions = document.createElement('div');
    actions.className = 'note-actions';

    const lockBtn = document.createElement('button');
    lockBtn.type = 'button';
    lockBtn.className = 'note-action note-lock';
    lockBtn.setAttribute('aria-label', 'Lock note position');

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'note-action note-save';
    saveBtn.title = 'Export note to folder';
    saveBtn.setAttribute('aria-label', 'Export note');
    saveBtn.innerHTML = NOTE_SVG.save;

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'note-action note-edit';
    editBtn.title = 'Toggle editing';
    editBtn.setAttribute('aria-label', 'Toggle editing');
    editBtn.innerHTML = NOTE_SVG.pen;

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'note-action note-delete';
    deleteBtn.title = 'Delete note';
    deleteBtn.setAttribute('aria-label', 'Delete note');
    deleteBtn.innerHTML = NOTE_SVG.del;

    actions.appendChild(lockBtn);
    actions.appendChild(saveBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    bar.appendChild(chevronBtn);
    bar.appendChild(titleInput);
    bar.appendChild(actions);

    const body = document.createElement('div');
    body.className = 'note-body';
    body.setAttribute('aria-hidden', 'true');
    const bodyInner = document.createElement('div');
    bodyInner.className = 'note-body-inner';
    const pad = document.createElement('textarea');
    pad.className = 'note-pad';
    pad.placeholder = 'Write a note…';
    pad.value = opts.body || '';
    pad.spellcheck = true;
    pad.readOnly = true;
    bodyInner.appendChild(pad);
    body.appendChild(bodyInner);

    panel.appendChild(bar);
    panel.appendChild(body);
    el.appendChild(panel);
    noteWindowsEl.appendChild(el);

    const note = {
      id,
      el,
      bar,
      chevronBtn,
      titleInput,
      lockBtn,
      saveBtn,
      editBtn,
      deleteBtn,
      body,
      pad,
      x,
      y,
      page: opts.page === 'panel' ? 'panel' : 'electronics',
      layer: Math.min(LAYER_COUNT, Math.max(1, Number(opts.layer) || activeLayer || 1)),
      expanded: false,
      editing: false,
      locked: false,
    };
    noteWindows.set(id, note);

    setNoteLocked(note, opts.locked === true);
    setNoteEditing(note, false);
    setNoteExpanded(note, opts.expanded !== false);
    syncNoteWindowVisibility(note);

    chevronBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setNoteExpanded(note, !note.expanded);
      markProjectDirty();
    });
    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setNoteLocked(note, !note.locked);
      markProjectDirty();
      setStatus(note.locked ? 'Note locked — position fixed' : 'Note unlocked — drag to move');
    });
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportNoteWindow(note);
    });
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setNoteEditing(note, !note.editing);
      markProjectDirty();
      setStatus(note.editing ? 'Note editing on' : 'Note editing off');
    });
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteNoteWindow(id);
    });
    titleInput.addEventListener('input', () => markProjectDirty());
    pad.addEventListener('input', () => markProjectDirty());
    titleInput.addEventListener('mousedown', (e) => {
      if (note.editing) e.stopPropagation();
    });
    pad.addEventListener('mousedown', (e) => e.stopPropagation());

    bar.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (note.locked) return;
      if (e.target.closest('button')) return;
      if (e.target === titleInput && note.editing) return;
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const originX = note.x;
      const originY = note.y;
      let dragging = false;

      function onMove(ev) {
        if (!dragging) {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < MARQUEE_MIN_PX) return;
          dragging = true;
          el.classList.add('is-dragging');
        }
        const world = clientToWorld(ev.clientX, ev.clientY);
        const originWorld = clientToWorld(startX, startY);
        note.x = Math.max(0, originX + (world.x - originWorld.x));
        note.y = Math.max(0, originY + (world.y - originWorld.y));
        el.style.left = `${note.x}px`;
        el.style.top = `${note.y}px`;
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        el.classList.remove('is-dragging');
        if (dragging) {
          markProjectDirty();
          suppressNextClick = true;
        }
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    return note;
  }

  function createNoteAtPointer() {
    const world = clientToWorld(lastPointerX, lastPointerY);
    const note = createNoteWindow({
      x: Math.max(0, world.x),
      y: Math.max(0, world.y),
      page: activeWorkspacePage,
      layer: activeLayer,
      title: DEFAULT_NOTE_TITLE,
      body: '',
      expanded: true,
      locked: false,
    });
    markProjectDirty();
    setStatus(
      `Note on ${activeWorkspacePage === 'panel' ? 'Panel' : 'Electronics'} · Layer ${activeLayer}`
    );
    return note;
  }

  function getTextCommandKeys(cmd) {
    return [cmd.short, cmd.name, ...(cmd.aliases || [])].filter(Boolean);
  }

  function findNearestTextCommand(query) {
    const q = String(query || '').trim().toUpperCase();
    if (!q) return null;
    let best = null;
    let bestScore = Infinity;
    textCommands.forEach((cmd) => {
      getTextCommandKeys(cmd).forEach((key) => {
        const k = key.toUpperCase();
        let score = Infinity;
        if (k === q) score = 0;
        else if (k.startsWith(q)) score = k.length - q.length;
        else if (k.includes(q)) score = 50 + k.indexOf(q);
        if (score < bestScore) {
          bestScore = score;
          best = cmd;
        }
      });
    });
    return best;
  }

  function updateTextCommandHint() {
    if (!textCommandHint || !textCommandInput) return;
    const match = findNearestTextCommand(textCommandInput.value);
    if (!match) {
      textCommandHint.textContent = '';
      return;
    }
    const typed = textCommandInput.value.trim().toUpperCase();
    const label = (match.short || match.name).toUpperCase();
    textCommandHint.textContent = typed && label.startsWith(typed) ? label.slice(typed.length) : label;
  }

  function openTextCommandBox(clientX = lastPointerX, clientY = lastPointerY) {
    if (!textCommandBox || !textCommandInput) return;
    if (isEditorOpen()) return;
    textCommandOpen = true;
    textCommandBox.classList.remove('hidden');
    textCommandBox.setAttribute('aria-hidden', 'false');
    const unitOffset = getWorkspaceGrid() * viewportScale() * 2;
    const x = Math.min(window.innerWidth - 180, Math.max(8, clientX + unitOffset));
    const y = Math.min(window.innerHeight - 36, Math.max(8, clientY - 12));
    textCommandBox.style.left = `${x}px`;
    textCommandBox.style.top = `${y}px`;
    textCommandInput.value = '';
    updateTextCommandHint();
    textCommandInput.focus();
    textCommandInput.select();
  }

  function closeTextCommandBox() {
    if (!textCommandBox || !textCommandInput) return;
    textCommandOpen = false;
    textCommandBox.classList.add('hidden');
    textCommandBox.setAttribute('aria-hidden', 'true');
    textCommandInput.value = '';
    if (textCommandHint) textCommandHint.textContent = '';
    if (document.activeElement === textCommandInput) textCommandInput.blur();
    canvas.focus();
  }

  function runMatchedTextCommand() {
    const match = findNearestTextCommand(textCommandInput?.value || '');
    closeTextCommandBox();
    if (!match) {
      setStatus('No matching command');
      return;
    }
    match.run?.();
  }

  function formatDimensionValue(distPx) {
    const grid = getWorkspaceGrid();
    const units = distPx / grid;
    if (activeWorkspacePage === 'panel') {
      const mm = units * PANEL_MM_PER_UNIT;
      return `${mm.toFixed(mm >= 100 ? 1 : 2)} mm`;
    }
    return `${units.toFixed(units >= 100 ? 1 : 2)} u`;
  }

  function collectObjectSnapPoints() {
    const pts = [];
    const push = (x, y, kind) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      pts.push({ x, y, kind });
    };
    components.forEach((comp) => {
      if (comp.classList.contains('workspace-page-hidden')) return;
      if (!componentOnActivePage(comp) && getComponentWorkspacePage(comp) !== 'panel') {
        // allow panel underlay snaps when on electronics only for panel snaps below
      }
      if (activeWorkspacePage === 'electronics' && getComponentWorkspacePage(comp) === 'panel') return;
      if (activeWorkspacePage === 'panel' && getComponentWorkspacePage(comp) !== 'panel') return;
      const b = getComponentChromeBounds(comp);
      const cx = (b.left + b.right) / 2;
      const cy = (b.top + b.bottom) / 2;
      push(cx, cy, 'center');
      push(cx, b.top, 'mid');
      push(cx, b.bottom, 'mid');
      push(b.left, cy, 'mid');
      push(b.right, cy, 'mid');
      // CAD groups: also corners
      if (comp.dataset.cadImport === 'true') {
        push(b.left, b.top, 'corner');
        push(b.right, b.top, 'corner');
        push(b.left, b.bottom, 'corner');
        push(b.right, b.bottom, 'corner');
      }
    });
    if (panelLayerVisible) {
      panelSnapPoints.forEach((entry) => {
        push(entry.x, entry.y, 'snap');
      });
    }
    return pts;
  }

  function findNearestObjectSnap(worldX, worldY, thresh) {
    const priority = { center: 0, mid: 1, corner: 2, snap: 3 };
    let best = null;
    let bestDist = thresh;
    let bestPri = 99;
    collectObjectSnapPoints().forEach((p) => {
      const d = Math.hypot(p.x - worldX, p.y - worldY);
      if (d > bestDist + 0.01) return;
      const pri = priority[p.kind] ?? 9;
      if (d < bestDist - 0.01 || pri < bestPri) {
        bestDist = d;
        bestPri = pri;
        best = p;
      }
    });
    return best;
  }

  function resolveDimPick(clientX, clientY, free) {
    const world = clientToWorld(clientX, clientY);
    if (free) return { x: world.x, y: world.y, kind: 'free' };

    const thresh = 14 / viewportScale();
    const obj = findNearestObjectSnap(world.x, world.y, thresh);
    if (obj) return { x: obj.x, y: obj.y, kind: obj.kind };

    if (panelLayerVisible && panelSnapPoints.size > 0) {
      const snap = findNearestPanelSnap(world.x, world.y, thresh);
      if (snap) return { x: snap.x, y: snap.y, kind: 'snap' };
    }

    let bestTerm = null;
    let bestDist = thresh;
    components.forEach((comp) => {
      if (comp.classList.contains('workspace-page-hidden')) return;
      comp.querySelectorAll('.terminal').forEach((term) => {
        const center = getTerminalCenter(term);
        const tw = clientToWorld(center.x, center.y);
        const dist = Math.hypot(tw.x - world.x, tw.y - world.y);
        if (dist <= bestDist) {
          bestDist = dist;
          bestTerm = { x: tw.x, y: tw.y, kind: 'terminal' };
        }
      });
    });
    if (bestTerm) return bestTerm;

    const gx = snapWorkspace(world.x);
    const gy = snapWorkspace(world.y);
    const gridOn = !(activeWorkspacePage === 'panel' && !panelCursorGridSnap);
    return {
      x: gx,
      y: gy,
      kind: gridOn ? 'grid' : 'free',
    };
  }

  function resizeDimLayer() {
    const svg = dimLayer?.querySelector('.dim-svg');
    if (!svg) return;
    svg.setAttribute('width', String(WORKSPACE_SIZE));
    svg.setAttribute('height', String(WORKSPACE_SIZE));
    svg.setAttribute('viewBox', `0 0 ${WORKSPACE_SIZE} ${WORKSPACE_SIZE}`);
  }

  function hideDimensionToolVisual(clearTool = false) {
    dimLayer?.classList.add('hidden');
    dimLayer?.setAttribute('aria-hidden', 'true');
    if (!snappedTerminal && !placementMode) snapIndicator.classList.add('hidden');
    if (clearTool) dimTool = null;
  }

  function updateDimensionVisual() {
    if (!dimTool || !dimLayer || !dimLine || !dimMarkA || !dimMarkB || !dimLabel) return;
    const a = dimTool.start;
    const b = dimTool.current;
    if (!a) {
      dimLayer.classList.add('hidden');
      return;
    }
    dimLayer.classList.remove('hidden');
    dimLayer.setAttribute('aria-hidden', 'false');
    const bx = b ? b.x : a.x;
    const by = b ? b.y : a.y;
    dimLine.setAttribute('x1', a.x);
    dimLine.setAttribute('y1', a.y);
    dimLine.setAttribute('x2', bx);
    dimLine.setAttribute('y2', by);
    dimMarkA.setAttribute('cx', a.x);
    dimMarkA.setAttribute('cy', a.y);
    dimMarkB.setAttribute('cx', bx);
    dimMarkB.setAttribute('cy', by);
    const dist = Math.hypot(bx - a.x, by - a.y);
    const midX = (a.x + bx) / 2;
    const midY = (a.y + by) / 2;
    dimLabel.textContent = formatDimensionValue(dist);
    dimLabel.style.left = `${midX}px`;
    dimLabel.style.top = `${midY}px`;

    if (dimTool.current) {
      showSnapAtWorldPick(dimTool.current, { pulse: false });
    } else if (!snappedTerminal) {
      snapIndicator.classList.add('hidden');
    }

    if (b && dimTool.phase !== 'done') {
      setStatus(
        `DIM ${formatDimensionValue(dist)} · ${dimTool.current?.kind || 'point'} · click second point · Shift=free · Esc cancel`
      );
    }
  }

  function startDimensionTool() {
    cancelWireDraft();
    cancelMoveTool();
    setWireMode(false);
    setAssetPlacement(null);
    deselectAll();
    clearSnapState();
    dimTool = {
      phase: 'first',
      start: null,
      current: null,
    };
    hideDimensionToolVisual(false);
    dimLayer?.classList.add('hidden');
    setStatus('DIM — click first point (snap: center / mid / terminals / grid · Shift=free)');
  }

  function cancelDimensionTool() {
    if (!dimTool) return false;
    hideDimensionToolVisual(true);
    setStatus('Ready');
    return true;
  }

  function startMoveTool() {
    cancelWireDraft();
    cancelDimensionTool();
    setWireMode(false);
    setAssetPlacement(null);
    clearSnapState();
    if (
      selectedComponents.size === 0
      && selectedWireGroups.size === 0
      && selectedPanelSnapIds.size === 0
    ) {
      setStatus('MOVE — select objects first, then Enter → MOVE');
      return;
    }
    moveTool = {
      phase: 'base',
      base: null,
      current: null,
    };
    setStatus('MOVE — click base point (snap: center / mid) · Shift=free · Esc cancel');
  }

  function cancelMoveTool() {
    if (!moveTool) return false;
    moveTool = null;
    if (!snappedTerminal && !placementMode) snapIndicator.classList.add('hidden');
    setStatus('Ready');
    return true;
  }

  function handleMovePointer(clientX, clientY, free) {
    if (!moveTool) return;
    const pick = resolveDimPick(clientX, clientY, free);
    moveTool.current = pick;
    showSnapAtWorldPick(pick, { pulse: false });
    if (moveTool.phase === 'base') {
      setStatus(`MOVE base · ${pick.kind || 'point'} — click to set · Shift=free`);
    } else if (moveTool.base) {
      const dx = pick.x - moveTool.base.x;
      const dy = pick.y - moveTool.base.y;
      setStatus(
        `MOVE dest · Δ ${formatDimensionValue(Math.hypot(dx, dy))} · ${pick.kind || 'point'} — click to place`
      );
    }
  }

  /** Detach terminal ends so a wire can translate as free geometry (not for HB leads). */
  function ensureWireMovableGeometry(wire) {
    if (!wire) return;
    if (wire.hbLeadCompId || wire.group?.dataset?.hbLead === 'true') return;
    ['start', 'end'].forEach((which) => {
      const ep = wire[which];
      if (!ep?.terminal) return;
      const pt = getAttachPoint(wire, which);
      unregisterTerminalWire(ep.terminal, wire.id);
      ep.terminal = null;
      ep.x = pt.x;
      ep.y = pt.y;
    });
  }

  function isHbLeadWire(wire) {
    return !!(wire?.hbLeadCompId || wire?.group?.dataset?.hbLead === 'true');
  }

  function isAssetWire(wire) {
    return !!(wire?.assetWireCompId || wire?.group?.dataset?.assetWire === 'true');
  }

  /** Body-anchored custom-asset pigtail: start at body exit, end at movable tip. */
  function getAssetWireRoute(wire) {
    if (!isAssetWire(wire)) return null;
    const comp = components.get(wire.assetWireCompId);
    if (!comp || !document.body.contains(comp)) return null;
    const tip = getAssetWireTips(comp)[wire.assetWireTipIndex];
    if (!tip || !document.body.contains(tip)) return null;
    const ends = getAssetWireBodyAnchor(comp, tip);
    if (!ends) return null;
    const start = hbLocalToWorld(comp, ends.x1, ends.y1);
    const tipC = getTerminalCenter(tip);
    const end = clientToWorld(tipC.x, tipC.y);
    const slack = Number.isFinite(wire.slack)
      ? wire.slack
      : getAssetWireLeadSlack(comp, wire.assetWireTipIndex);
    return { start, end, slack: slack || 0, tip, comp };
  }

  function applyMoveDelta(dx, dy, free) {
    selectedComponents.forEach((comp) => {
      const left = parseFloat(comp.style.left) || 0;
      const top = parseFloat(comp.style.top) || 0;
      const nx = Math.max(0, free ? left + dx : snapWorkspace(left + dx));
      const ny = Math.max(0, free ? top + dy : snapWorkspace(top + dy));
      comp.style.left = `${nx}px`;
      comp.style.top = `${ny}px`;
    });
    selectedWireGroups.forEach((group) => {
      const wire = wires.get(group.dataset.id);
      if (!wire || isHbLeadWire(wire)) return;
      if (isAssetWire(wire)) {
        const route = getAssetWireRoute(wire);
        if (!route?.tip || !route.comp) return;
        const client = worldToClient(wire.end.x + dx, wire.end.y + dy);
        // Use current tip world + delta
        const tipC = getTerminalCenter(route.tip);
        const tipW = clientToWorld(tipC.x, tipC.y);
        const next = worldToClient(
          free ? tipW.x + dx : snapWorkspace(tipW.x + dx),
          free ? tipW.y + dy : snapWorkspace(tipW.y + dy)
        );
        placeAssetWireTipAtClient(route.comp, route.tip, next.x, next.y);
        setAssetWireTipAttachment(route.comp, wire.assetWireTipIndex, null);
        persistAssetWireTipPositions(route.comp);
        updateWirePosition(wire);
        layoutAssetWireFloatLabels(route.comp);
        return;
      }
      ensureWireMovableGeometry(wire);
      wire.start.x = free ? wire.start.x + dx : snapWorkspace(wire.start.x + dx);
      wire.start.y = free ? wire.start.y + dy : snapWorkspace(wire.start.y + dy);
      wire.end.x = free ? wire.end.x + dx : snapWorkspace(wire.end.x + dx);
      wire.end.y = free ? wire.end.y + dy : snapWorkspace(wire.end.y + dy);
      wire.anchors = (wire.anchors || []).map((a) => ({
        x: free ? a.x + dx : snapWorkspace(a.x + dx),
        y: free ? a.y + dy : snapWorkspace(a.y + dy),
      }));
      updateWirePosition(wire);
    });
    selectedPanelSnapIds.forEach((id) => {
      const entry = panelSnapPoints.get(id);
      if (!entry) return;
      entry.x = free ? entry.x + dx : snapWorkspace(entry.x + dx);
      entry.y = free ? entry.y + dy : snapWorkspace(entry.y + dy);
      entry.el.style.left = `${entry.x}px`;
      entry.el.style.top = `${entry.y}px`;
    });
    updateAllWirePositions();
    updateAssetConfigChrome();
    markProjectDirty();
  }

  function commitMoveClick(clientX, clientY, free) {
    if (!moveTool) return false;
    const pick = resolveDimPick(clientX, clientY, free);
    if (moveTool.phase === 'base') {
      moveTool.base = pick;
      moveTool.current = pick;
      moveTool.phase = 'dest';
      setStatus(`MOVE — base set (${pick.kind}) · click destination · Shift=free`);
      return true;
    }
    const dx = pick.x - moveTool.base.x;
    const dy = pick.y - moveTool.base.y;
    applyMoveDelta(dx, dy, free);
    moveTool = null;
    if (!snappedTerminal && !placementMode) snapIndicator.classList.add('hidden');
    setStatus(`Moved · Δ ${formatDimensionValue(Math.hypot(dx, dy))}`);
    return true;
  }

  function handleDimPointer(clientX, clientY, free) {
    if (!dimTool || dimTool.phase === 'done') return;
    const pick = resolveDimPick(clientX, clientY, free);
    if (dimTool.phase === 'first') {
      dimTool.current = pick;
      return;
    }
    dimTool.current = pick;
    updateDimensionVisual();
  }

  function clearDimAnnotationSelection() {
    selectedDimAnnotationIds.forEach((id) => {
      dimAnnotations.get(id)?.el.classList.remove('selected');
    });
    selectedDimAnnotationIds.clear();
  }

  function selectDimAnnotation(id, additive = false) {
    if (!additive) {
      selectedComponents.forEach((el) => el.classList.remove('selected'));
      selectedComponents.clear();
      selectedWireGroups.forEach((el) => el.classList.remove('selected'));
      selectedWireGroups.clear();
      clearPanelSnapSelection();
      clearDimAnnotationSelection();
      closeAssetConfigMenu();
      closeAssetStateTermMenu();
    }
    const entry = dimAnnotations.get(id);
    if (!entry) return;
    selectedDimAnnotationIds.add(id);
    entry.el.classList.add('selected');
    updateAlignBar();
    setStatus('Dimension label selected — drag to move · Delete to remove');
  }

  function deleteSelectedDimAnnotations() {
    if (selectedDimAnnotationIds.size === 0) return false;
    const ids = [...selectedDimAnnotationIds];
    ids.forEach((id) => {
      const entry = dimAnnotations.get(id);
      if (!entry) return;
      entry.el.remove();
      dimAnnotations.delete(id);
    });
    selectedDimAnnotationIds.clear();
    updateAlignBar();
    markProjectDirty();
    setStatus(ids.length === 1 ? 'Dimension label deleted' : `Deleted ${ids.length} dimension labels`);
    return true;
  }

  function getDimAnnotationRect(entry) {
    const halfW = Math.max(6, (entry.el.offsetWidth || 12) / 2);
    const halfH = Math.max(4, (entry.el.offsetHeight || 8) / 2);
    return {
      left: entry.x - halfW,
      top: entry.y - halfH,
      right: entry.x + halfW,
      bottom: entry.y + halfH,
    };
  }

  function createDimAnnotation(x, y, text) {
    if (!dimAnnotationsEl) return null;
    const id = `dim-${++dimAnnotationIdCounter}`;
    const el = document.createElement('div');
    el.className = 'dim-annotation';
    el.dataset.id = id;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.title = 'Dimension label';

    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (!selectedDimAnnotationIds.has(id) || e.shiftKey) {
        selectDimAnnotation(id, e.shiftKey);
      }

      const startX = e.clientX;
      const startY = e.clientY;
      const dragIds = selectedDimAnnotationIds.has(id)
        ? [...selectedDimAnnotationIds]
        : [id];
      const origins = dragIds.map((dragId) => {
        const entry = dimAnnotations.get(dragId);
        return {
          id: dragId,
          x: entry ? entry.x : 0,
          y: entry ? entry.y : 0,
        };
      });
      let dragging = false;

      function onMove(ev) {
        if (!dragging) {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < MARQUEE_MIN_PX) return;
          dragging = true;
          dragIds.forEach((dragId) => dimAnnotations.get(dragId)?.el.classList.add('dragging'));
        }
        const world = clientToWorld(ev.clientX, ev.clientY);
        const originWorld = clientToWorld(startX, startY);
        const dx = world.x - originWorld.x;
        const dy = world.y - originWorld.y;
        origins.forEach(({ id: dragId, x: ox, y: oy }) => {
          const entry = dimAnnotations.get(dragId);
          if (!entry) return;
          const nextX = Math.max(0, ox + dx);
          const nextY = Math.max(0, oy + dy);
          entry.el.style.left = `${nextX}px`;
          entry.el.style.top = `${nextY}px`;
          entry.x = nextX;
          entry.y = nextY;
        });
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        dragIds.forEach((dragId) => dimAnnotations.get(dragId)?.el.classList.remove('dragging'));
        if (dragging) markProjectDirty();
        suppressNextClick = true;
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    dimAnnotationsEl.appendChild(el);
    dimAnnotations.set(id, { id, el, x, y, text });
    return id;
  }

  function handleDimClick(e) {
    if (!dimTool || dimTool.phase === 'done') return false;
    e.preventDefault();
    e.stopPropagation();
    const pick = resolveDimPick(e.clientX, e.clientY, e.shiftKey);
    if (dimTool.phase === 'first') {
      dimTool.start = pick;
      dimTool.current = pick;
      dimTool.phase = 'second';
      updateDimensionVisual();
      setStatus('DIM — click second point (or move mouse to preview)');
      return true;
    }
    dimTool.current = pick;
    const dist = Math.hypot(pick.x - dimTool.start.x, pick.y - dimTool.start.y);
    const text = formatDimensionValue(dist);
    const midX = (dimTool.start.x + pick.x) / 2;
    const midY = (dimTool.start.y + pick.y) / 2;
    createDimAnnotation(midX, midY, text);
    hideDimensionToolVisual(true);
    markProjectDirty();
    setStatus(`DIM ${text} — label placed`);
    return true;
  }

  function isEditorOpen() {
    return !document.getElementById('asset-editor')?.classList.contains('hidden');
  }

  function recordRecentAsset(assetId) {
    if (!assetId || !GuitarAssets.getTemplate(assetId)) return;
    recentAssetIds = [assetId, ...recentAssetIds.filter((id) => id !== assetId)].slice(0, 3);
  }

  function getQHoldDelay() {
    if (selectedComponents.size > 0 || selectedWireGroups.size > 0) {
      return Q_HOLD_MS_SELECTED;
    }
    return Q_HOLD_MS;
  }

  function scheduleQHoldWheel() {
    clearTimeout(qHoldTimer);
    // Keep original delays, but never open on a tap (floor above tap length)
    const delay = Math.max(getQHoldDelay(), Q_TAP_MAX_MS + 1);
    qHoldTimer = setTimeout(() => {
      if (!qKeyHeld) return;
      if (performance.now() - qKeyDownAt < Q_TAP_MAX_MS) return;
      if (openAssetWheel()) qOpenedWheel = true;
    }, delay);
  }

  function getWheelSlotAngles(count) {
    const start = -Math.PI / 2;
    return Array.from({ length: count }, (_, i) => start + ((2 * Math.PI * i) / count));
  }

  function getAssetWheelItems() {
    return [WIRE_WHEEL_ITEM, ...recentAssetIds.slice(0, 3)];
  }

  function createDrawIcon(className) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', className || 'draw-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', 'M12 20h9');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', 'currentColor');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');
    const pencil = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pencil.setAttribute('d', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z');
    pencil.setAttribute('fill', 'none');
    pencil.setAttribute('stroke', 'currentColor');
    pencil.setAttribute('stroke-width', '2');
    pencil.setAttribute('stroke-linecap', 'round');
    pencil.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(line);
    svg.appendChild(pencil);
    return svg;
  }

  function renderAssetWheel() {
    const container = document.getElementById('asset-wheel-items');
    if (!container) return;
    container.innerHTML = '';
    const ids = getAssetWheelItems();
    const radius = 78;
    const angles = getWheelSlotAngles(ids.length);
    ids.forEach((id, i) => {
      const isWire = id === WIRE_WHEEL_ITEM;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `asset-wheel-item${isWire ? ' asset-wheel-item-wire' : ''}${i === qWheelIndex ? ' selected' : ''}${isWire && wireMode ? ' wire-active' : ''}`;
      if (isWire) {
        btn.setAttribute('aria-label', wireMode ? 'Wire mode (on)' : 'Wire mode');
        btn.title = 'Wire';
        btn.appendChild(createDrawIcon('asset-wheel-draw-icon'));
      } else {
        btn.textContent = GuitarAssets.formatAssetMenuLabel?.(GuitarAssets.getTemplate(id))
          || GuitarAssets.getTemplate(id)?.name
          || id;
      }
      btn.dataset.wheelId = id;
      const angle = angles[i];
      btn.style.left = `calc(50% + ${Math.cos(angle) * radius}px)`;
      btn.style.top = `calc(50% + ${Math.sin(angle) * radius}px)`;
      container.appendChild(btn);
    });
  }

  function openAssetWheel() {
    const items = getAssetWheelItems();
    if (items.length === 0) return false;
    qWheelIndex = 0;
    renderAssetWheel();
    const wheel = document.getElementById('asset-wheel');
    if (!wheel) return false;
    wheel.classList.remove('hidden', 'asset-wheel-animate');
    void wheel.offsetWidth;
    wheel.classList.add('asset-wheel-animate');
    qWheelOpen = true;
    document.body.classList.add('asset-wheel-open');
    updateWheelIndexFromPointer(lastPointerX, lastPointerY);
    setStatus('Recent assets — scroll or point, release Q to select');
    return true;
  }

  function closeAssetWheel() {
    qWheelOpen = false;
    const wheel = document.getElementById('asset-wheel');
    wheel?.classList.remove('asset-wheel-animate');
    wheel?.classList.add('hidden');
    document.body.classList.remove('asset-wheel-open');
  }

  function confirmAssetWheelSelection() {
    const id = getAssetWheelItems()[qWheelIndex];
    if (!id) return;
    if (id === WIRE_WHEEL_ITEM) {
      setWireMode(!wireMode);
      return;
    }
    recordRecentAsset(id);
    setAssetPlacement(id);
  }

  function getWheelHubCenter() {
    const hub = document.querySelector('.asset-wheel-hub');
    if (!hub) return null;
    const rect = hub.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  function updateWheelCursorRotation(clientX, clientY) {
    const cursor = document.querySelector('.asset-wheel-cursor');
    const center = getWheelHubCenter();
    if (!cursor || !center) return;
    const angle = Math.atan2(clientY - center.y, clientX - center.x);
    const deg = angle * (180 / Math.PI) + 90;
    cursor.style.transform = `rotate(${deg}deg)`;
  }

  function updateWheelIndexFromPointer(clientX, clientY) {
    const items = getAssetWheelItems();
    if (!qWheelOpen || items.length === 0) return;
    const center = getWheelHubCenter();
    if (!center) return;
    updateWheelCursorRotation(clientX, clientY);
    const angle = Math.atan2(clientY - center.y, clientX - center.x);
    const n = items.length;
    const angles = getWheelSlotAngles(n);
    let best = 0;
    let bestDist = Infinity;
    angles.forEach((slotAngle, i) => {
      const diff = Math.abs(Math.atan2(Math.sin(angle - slotAngle), Math.cos(angle - slotAngle)));
      if (diff < bestDist) {
        bestDist = diff;
        best = i;
      }
    });
    if (best !== qWheelIndex) {
      qWheelIndex = best;
      renderAssetWheel();
    }
  }

  function cycleSelectedComponentState(direction) {
    if (selectedComponents.size === 0) return false;
    let changed = false;
    selectedComponents.forEach((comp) => {
      if (GuitarAssets.cycleComponentState(comp, direction)) changed = true;
    });
    if (changed) {
      updateAllWirePositions();
      refreshLightningWireGlow();
      updateSelectionStatus();
      markProjectDirty();
      notifySchematicCircuitChanged();
    }
    return changed;
  }

  function getWorkspaceGrid() {
    return activeWorkspacePage === 'panel' ? PANEL_GRID_PX : WORKSPACE_GRID;
  }

  /** Convert gauge (mm) to SVG stroke width. 1 grid unit = 1 mm → stroke = mm × WORKSPACE_GRID. */
  function gaugeMmToStroke(mm) {
    return Number(mm) * WORKSPACE_GRID;
  }

  /** HB loom/fan + asset-wire pigtails keep their own stroke; capacitor legs are component SVG (not wires). */
  function isDimensionalGaugeExempt(wire) {
    return isHbLeadWire(wire) || isAssetWire(wire);
  }

  /** Use CSS style (not presentation attr) so stylesheet stroke-width: 2 cannot win. */
  function setWireStrokeWidth(el, px) {
    if (!el) return;
    if (px == null) {
      el.style.removeProperty('stroke-width');
      el.removeAttribute('stroke-width');
      return;
    }
    el.style.setProperty('stroke-width', String(px));
  }

  function clearInlineWireStroke(wire) {
    if (!wire?.visible) return;
    setWireStrokeWidth(wire.visible, null);
    if (wire.outline) setWireStrokeWidth(wire.outline, null);
    if (wire.cloth) setWireStrokeWidth(wire.cloth, null);
    if (wire.tipStart) setWireStrokeWidth(wire.tipStart, null);
    if (wire.tipEnd) setWireStrokeWidth(wire.tipEnd, null);
  }

  function formatWireGaugeChipLabel(mm) {
    const active = getActiveWireGaugeOption();
    const awg = active?.dataset?.awg;
    if (awg) return `${awg} AWG`;
    const n = Number(mm);
    if (!Number.isFinite(n)) return '22 AWG';
    return `${n.toFixed(2)}mm`;
  }

  function formatWireGaugeDropdownLabel(mm) {
    const active = getActiveWireGaugeOption();
    const label = active?.querySelector('.wire-gauge-option-label')?.textContent?.trim();
    if (label) return label;
    const awg = active?.dataset?.awg;
    const n = Number(mm);
    if (awg && Number.isFinite(n)) return `${awg} AWG (${n.toFixed(2)}mm)`;
    if (!Number.isFinite(n)) return '22 AWG (0.64mm)';
    return `${n.toFixed(2)}mm`;
  }

  function getActiveWireGaugeOption() {
    for (const opt of wireGaugeOptions) {
      const g = Number(opt.dataset.gauge);
      if (Number.isFinite(g) && Math.abs(g - wireGaugeMm) < 1e-6) return opt;
    }
    return null;
  }

  function setWireGaugeDropdownOpen(open) {
    wireGaugeDropdownOpen = !!open && !!wireGaugeMenuOpen;
    wireGaugeOptionsEl?.classList.toggle('hidden', !wireGaugeDropdownOpen);
    if (wireGaugeDropdownOpen) wireGaugeOptionsEl?.removeAttribute('hidden');
    else wireGaugeOptionsEl?.setAttribute('hidden', '');
    wireGaugeDropdownBtn?.setAttribute('aria-expanded', wireGaugeDropdownOpen ? 'true' : 'false');
  }

  function getPreviewStrokeWidth() {
    if (!dimensionalWireGauge || !wireGaugePreview) return 2;
    return gaugeMmToStroke(wireGaugeMm);
  }

  function applyPreviewStrokeWidth() {
    if (!wirePreviewLine) return;
    if (dimensionalWireGauge && wireGaugePreview) {
      setWireStrokeWidth(wirePreviewLine, getPreviewStrokeWidth());
    } else {
      setWireStrokeWidth(wirePreviewLine, null);
    }
  }

  /**
   * Apply dimensional gauge stroke only when dimensional AND preview are ON.
   * Dimensional ON + preview OFF: clear inline strokes (legacy look) but keep gaugeMm.
   * Uses stored wire.gaugeMm only — does not invent gauge from the dropdown.
   */
  function applyNonHbWireGaugeStroke(wire) {
    if (!wire?.visible) return;
    if (isDimensionalGaugeExempt(wire)) return;
    if (!dimensionalWireGauge || !wireGaugePreview) {
      clearInlineWireStroke(wire);
      return;
    }
    const mm = wire.gaugeMm;
    if (!Number.isFinite(mm) || mm <= 0) {
      clearInlineWireStroke(wire);
      return;
    }
    const stroke = gaugeMmToStroke(mm);
    const tipStroke = stroke * TIP_RATIO;
    setWireStrokeWidth(wire.visible, stroke);
    if (wire.outline) setWireStrokeWidth(wire.outline, stroke);
    if (wire.cloth) setWireStrokeWidth(wire.cloth, stroke * 1.1);
    if (wire.tipStart) setWireStrokeWidth(wire.tipStart, tipStroke);
    if (wire.tipEnd) setWireStrokeWidth(wire.tipEnd, tipStroke);
  }

  /** Re-apply dimensional strokes from each wire's stored gaugeMm (no overwrite). */
  function reapplyStoredDimensionalGauges() {
    wires.forEach((wire) => {
      if (!wire || isDimensionalGaugeExempt(wire)) return;
      if (!Number.isFinite(wire.gaugeMm) || wire.gaugeMm <= 0) return;
      applyNonHbWireGaugeStroke(wire);
    });
  }

  function syncWireGaugeUi() {
    wireGaugeOptions.forEach((opt) => {
      const g = Number(opt.dataset.gauge);
      const isActive = Number.isFinite(g) && Math.abs(g - wireGaugeMm) < 1e-6;
      opt.classList.toggle('active', isActive);
      opt.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    if (wireGaugeDimensionalToggle) {
      wireGaugeDimensionalToggle.checked = !!dimensionalWireGauge;
    }
    if (wireGaugePreviewToggle) {
      wireGaugePreviewToggle.checked = !!wireGaugePreview;
    }
    if (wireGaugeReopenLabel) {
      wireGaugeReopenLabel.textContent = formatWireGaugeChipLabel(wireGaugeMm);
    }
    if (wireGaugeDropdownLabel) {
      wireGaugeDropdownLabel.textContent = formatWireGaugeDropdownLabel(wireGaugeMm);
    }
  }

  function setWireGaugeReopenVisible(visible) {
    const show = !!visible && !!wireMode && !wireGaugeMenuOpen;
    wireGaugeReopen?.classList.toggle('hidden', !show);
    if (show) wireGaugeReopen?.removeAttribute('hidden');
    else wireGaugeReopen?.setAttribute('hidden', '');
  }

  function setWireGaugeMenuOpen(open) {
    wireGaugeMenuOpen = !!open && !!wireMode;
    wireGaugeBar?.classList.toggle('hidden', !wireGaugeMenuOpen);
    wireGaugeBar?.setAttribute('aria-hidden', wireGaugeMenuOpen ? 'false' : 'true');
    if (!wireGaugeMenuOpen) setWireGaugeDropdownOpen(false);
    setWireGaugeReopenVisible(!wireGaugeMenuOpen);
    syncWireSelectionReadoutOffset();
    updateWireGaugeReadout();
  }

  function setWireGaugeBarVisible(visible) {
    if (visible) {
      setWireGaugeMenuOpen(true);
    } else {
      wireGaugeMenuOpen = false;
      wireGaugeBar?.classList.add('hidden');
      wireGaugeBar?.setAttribute('aria-hidden', 'true');
      setWireGaugeDropdownOpen(false);
      setWireGaugeReopenVisible(false);
      syncWireSelectionReadoutOffset();
    }
  }

  function syncWireSelectionReadoutOffset() {
    wireSelectionReadout?.classList.toggle('below-gauge', !!wireGaugeMenuOpen);
  }

  function getWireLengthMm(wire) {
    if (!wire) return 0;
    return getWirePathLengthPx(wire) / WORKSPACE_GRID;
  }

  function formatWireLengthReadout(lengthMm) {
    const m = lengthMm / 1000;
    const inch = lengthMm / 25.4;
    const ft = lengthMm / 304.8;
    return `${lengthMm.toFixed(2)} mm (${m.toFixed(5)} m) (${inch.toFixed(4)} in) (${ft.toFixed(5)} ft)`;
  }

  /** Compact L · R for schematic path labels / list rows. */
  function formatSchematicWireCompact(wire) {
    const lengthMm = getWireLengthMm(wire);
    const len = `${lengthMm.toFixed(2)} mm`;
    const r = getWireResistanceOhmsApprox(wire);
    if (r == null || !Number.isFinite(r)) return len;
    return `${len} · ${r.toFixed(3)} Ω`;
  }

  function formatSchematicWireListLine(wire) {
    const lengthMm = getWireLengthMm(wire);
    const lengthText = formatWireLengthReadout(lengthMm);
    const r = getWireResistanceOhmsApprox(wire);
    if (r == null || !Number.isFinite(r)) return lengthText;
    return `${lengthText} · ${r.toFixed(3)} Ω`;
  }

  function getAwgLabelForGaugeMm(mm) {
    const target = Number.isFinite(mm) && mm > 0 ? mm : wireGaugeMm;
    for (const opt of wireGaugeOptions) {
      const g = Number(opt.dataset.gauge);
      if (Number.isFinite(g) && Math.abs(g - target) < 1e-6) {
        const awg = opt.dataset.awg;
        if (awg) return `${awg} AWG`;
      }
    }
    if (Number.isFinite(target)) return `${target.toFixed(2)} mm`;
    return '22 AWG';
  }

  /** Approximate resistance from stored gauge + length (independent of dimensional toggle). */
  function getWireResistanceOhmsApprox(wire) {
    if (!wire) return null;
    const mm = Number.isFinite(wire.gaugeMm) && wire.gaugeMm > 0 ? wire.gaugeMm : wireGaugeMm;
    const ohmPerM = getOhmPerMeterForGauge(mm);
    if (!Number.isFinite(ohmPerM)) return null;
    const lengthMm = getWireLengthMm(wire);
    return (lengthMm / 1000) * ohmPerM;
  }

  function setDimensionalWireGauge(on) {
    const next = !!on;
    if (dimensionalWireGauge === next) {
      syncWireGaugeUi();
      return;
    }
    dimensionalWireGauge = next;
    if (dimensionalWireGauge) {
      // Re-enable stored gauges only — do not assign dropdown to wires lacking gaugeMm.
      // Visual thickness still gated by wireGaugePreview.
      reapplyStoredDimensionalGauges();
    } else {
      // Hide dimensional visuals; keep wire.gaugeMm for when toggle turns back on.
      wires.forEach((wire) => {
        if (!wire || isDimensionalGaugeExempt(wire)) return;
        clearInlineWireStroke(wire);
      });
    }
    applyPreviewStrokeWidth();
    syncWireGaugeUi();
    updateWireGaugeReadout();
  }

  function setWireGaugePreview(on) {
    const next = !!on;
    if (wireGaugePreview === next) {
      syncWireGaugeUi();
      return;
    }
    wireGaugePreview = next;
    if (dimensionalWireGauge && wireGaugePreview) {
      reapplyStoredDimensionalGauges();
    } else {
      wires.forEach((wire) => {
        if (!wire || isDimensionalGaugeExempt(wire)) return;
        clearInlineWireStroke(wire);
      });
    }
    applyPreviewStrokeWidth();
    syncWireGaugeUi();
  }

  function getOhmPerMeterForGauge(mm) {
    const target = Number.isFinite(mm) && mm > 0 ? mm : wireGaugeMm;
    for (const opt of wireGaugeOptions) {
      const g = Number(opt.dataset.gauge);
      if (Number.isFinite(g) && Math.abs(g - target) < 1e-6) {
        const ohm = Number(opt.dataset.ohm);
        return Number.isFinite(ohm) ? ohm : null;
      }
    }
    return null;
  }

  /** Path length in world px (same flatten/route sampling as short-wire / bounds helpers). */
  function getWirePathLengthPx(wire) {
    if (!wire) return 0;
    const startPt = { x: wire.start.x, y: wire.start.y };
    const endPt = { x: wire.end.x, y: wire.end.y };
    const pts = getWireRoutePoints(wire, startPt, endPt);
    const hasAnchors = (wire.anchors || []).length > 0;
    const slack = hasAnchors ? 0 : (wire.slack || 0);
    const samples = flattenWireRoute(pts, slack, hasAnchors ? 4 : 8);
    if (samples.length < 2) {
      return Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y);
    }
    let len = 0;
    for (let i = 1; i < samples.length; i++) {
      len += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
    }
    return len;
  }

  function getWireResistanceOhms(wire) {
    if (!wire) return null;
    if (!dimensionalWireGauge) return null;
    const mm = Number.isFinite(wire.gaugeMm) && wire.gaugeMm > 0 ? wire.gaugeMm : wireGaugeMm;
    const ohmPerM = getOhmPerMeterForGauge(mm);
    if (!Number.isFinite(ohmPerM)) return null;
    const lengthMm = getWirePathLengthPx(wire) / WORKSPACE_GRID;
    return (lengthMm / 1000) * ohmPerM;
  }

  function updateWireGaugeReadout() {
    if (!wireSelectionReadout) return;
    const show = selectedWireGroups.size >= 1;
    wireSelectionReadout.classList.toggle('hidden', !show);
    if (show) wireSelectionReadout.removeAttribute('hidden');
    else wireSelectionReadout.setAttribute('hidden', '');
    wireSelectionReadout.setAttribute('aria-hidden', show ? 'false' : 'true');
    syncWireSelectionReadoutOffset();
    if (schematicPeekOpen) notifySchematicCircuitChanged();
    if (!show) return;

    let lengthMmSum = 0;
    let resistanceSum = 0;
    let resistanceOk = true;
    selectedWireGroups.forEach((group) => {
      const wire = wires.get(group.dataset.id);
      if (!wire) return;
      lengthMmSum += getWireLengthMm(wire);
      const r = getWireResistanceOhms(wire);
      if (r == null || !Number.isFinite(r)) resistanceOk = false;
      else resistanceSum += r;
    });

    if (wireGaugeLengthEl) {
      wireGaugeLengthEl.textContent = formatWireLengthReadout(lengthMmSum);
    }
    if (wireGaugeResistanceEl) {
      wireGaugeResistanceEl.textContent = resistanceOk
        ? `${resistanceSum.toFixed(3)} Ω`
        : '—';
    }
  }

  function showWirePlaceCursorMark(ok, clientX = lastPointerX, clientY = lastPointerY) {
    if (!wirePlaceCursorMark) return;
    if (wirePlaceCursorMarkTimer) {
      clearTimeout(wirePlaceCursorMarkTimer);
      wirePlaceCursorMarkTimer = null;
    }
    wirePlaceCursorMark.textContent = ok ? '✓' : '✗';
    wirePlaceCursorMark.classList.toggle('ok', !!ok);
    wirePlaceCursorMark.classList.toggle('bad', !ok);
    wirePlaceCursorMark.style.left = `${clientX}px`;
    wirePlaceCursorMark.style.top = `${clientY}px`;
    wirePlaceCursorMark.classList.remove('hidden');
    wirePlaceCursorMark.removeAttribute('hidden');
    wirePlaceCursorMark.setAttribute('aria-hidden', 'false');
    wirePlaceCursorMarkTimer = setTimeout(() => {
      wirePlaceCursorMark.classList.add('hidden');
      wirePlaceCursorMark.setAttribute('hidden', '');
      wirePlaceCursorMark.setAttribute('aria-hidden', 'true');
      wirePlaceCursorMarkTimer = null;
    }, 1000);
  }

  function syncSelectedWireConnectHighlights() {
    clearWireEndAttachHighlights();
    selectedWireGroups.forEach((group) => {
      const wire = wires.get(group.dataset.id);
      if (!wire) return;
      if (wire.start.terminal) {
        wire.start.terminal.classList.add('wire-end-attach-target');
      }
      if (wire.end.terminal) {
        wire.end.terminal.classList.add('wire-end-attach-target');
      }
    });
  }

  function applyWorkspaceGridSize() {
    document.documentElement.style.setProperty('--workspace-grid-size', `${getWorkspaceGrid()}px`);
  }

  function snapWorkspace(v, free) {
    if (free) return v;
    if (activeWorkspacePage === 'panel' && !panelCursorGridSnap) return v;
    const grid = getWorkspaceGrid();
    return Math.round(v / grid) * grid;
  }

  function togglePanelCursorGridSnap() {
    if (activeWorkspacePage !== 'panel') return false;
    panelCursorGridSnap = !panelCursorGridSnap;
    document.body.classList.toggle('panel-grid-snap-off', !panelCursorGridSnap);
    setStatus(
      panelCursorGridSnap
        ? 'Grid snap ON — cursor locks to grid / mid / center · Tab to turn off'
        : 'Grid snap OFF — free cursor · Tab to turn on'
    );
    updatePanelCursorSnap(lastPointerX, lastPointerY, false);
    return true;
  }

  let panelCursorSnapActive = false;

  function clearPanelCursorSnap() {
    if (!panelCursorSnapActive) {
      document.body.classList.remove('panel-cursor-snapping');
      return;
    }
    panelCursorSnapActive = false;
    document.body.classList.remove('panel-cursor-snapping');
    if (
      !snappedTerminal
      && !placementMode
      && !(dimTool && dimTool.phase !== 'done')
      && !moveTool
    ) {
      snapIndicator.classList.add('hidden');
      setSnapIndicatorHost(false);
    }
  }

  /** Live CAD cursor: when Panel grid snap is on, lock indicator to grid / object snaps. */
  function updatePanelCursorSnap(clientX, clientY, shiftFree) {
    if (activeWorkspacePage !== 'panel' || !panelCursorGridSnap || shiftFree) {
      clearPanelCursorSnap();
      return;
    }
    if (qWheelOpen || textCommandOpen) {
      clearPanelCursorSnap();
      return;
    }
    syncPanelCadCursorSize();
    if (dimTool && dimTool.phase !== 'done') {
      panelCursorSnapActive = true;
      document.body.classList.add('panel-cursor-snapping');
      return;
    }
    if (moveTool) {
      panelCursorSnapActive = true;
      document.body.classList.add('panel-cursor-snapping');
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (
      clientX < rect.left
      || clientX > rect.right
      || clientY < rect.top
      || clientY > rect.bottom
    ) {
      clearPanelCursorSnap();
      return;
    }

    const pick = resolveDimPick(clientX, clientY, false);
    panelCursorSnapActive = true;
    document.body.classList.add('panel-cursor-snapping');
    showSnapAtWorldPick(pick, { pulse: false });
  }

  function updateAlignBar() {
    if (!alignBar) return;
    const n = selectedComponents.size;
    const show = n >= 1;
    alignBar.classList.toggle('hidden', !show);
    if (btnAlignColumn) btnAlignColumn.disabled = n < 2;
    if (btnAlignRow) btnAlignRow.disabled = n < 2;
  }

  function alignSelectedColumn() {
    const comps = [...selectedComponents];
    if (comps.length < 2) return;
    const refY = parseFloat(comps[0].style.top) || 0;
    comps.forEach((c) => {
      c.style.top = `${snapWorkspace(refY)}px`;
    });
    updateAllWirePositions();
    updateAssetConfigChrome();
    markProjectDirty();
    setStatus(`Aligned ${comps.length} assets to same Y`);
  }

  function alignSelectedRow() {
    const comps = [...selectedComponents];
    if (comps.length < 2) return;
    const refX = parseFloat(comps[0].style.left) || 0;
    comps.forEach((c) => {
      c.style.left = `${snapWorkspace(refX)}px`;
    });
    updateAllWirePositions();
    updateAssetConfigChrome();
    markProjectDirty();
    setStatus(`Aligned ${comps.length} assets to same X`);
  }

  function rotateSelected(deltaDeg) {
    [...selectedComponents].forEach((comp) => {
      let rot = parseFloat(comp.dataset.rotation) || 0;
      rot = ((rot + deltaDeg) % 360 + 360) % 360;
      comp.dataset.rotation = String(rot);
      comp.style.transform = rot ? `rotate(${rot}deg)` : '';
      GuitarAssets.updateComponentStateLabel(comp);
    });
    updateAllWirePositions();
    markProjectDirty();
    setStatus(`Rotated ${selectedComponents.size} asset(s) ${deltaDeg > 0 ? '+' : ''}${deltaDeg}°`);
    updateAssetConfigChrome();
  }

  function selectionIncludesDualCoil() {
    return [...selectedComponents].some(isDualCoilComponent);
  }

  function isPointerOverSelectedDualCoilBody(clientX, clientY) {
    const hit = document.elementFromPoint(clientX, clientY);
    if (!hit) return false;
    const ph = hit.closest?.('.placeholder');
    if (!ph) return false;
    const comp = ph.closest('.component');
    if (!comp || !selectedComponents.has(comp) || !isDualCoilComponent(comp)) return false;
    return true;
  }

  /** Dual-coil rotates only while hovering or holding the body box — not when over leads/wires. */
  function canRotateDualCoilWithPointer(clientX, clientY) {
    if (!selectionIncludesDualCoil()) return true;
    if (dualCoilBodyHeld) return true;
    return isPointerOverSelectedDualCoilBody(clientX, clientY);
  }

  function findWireAtClient(clientX, clientY) {
    for (const el of document.elementsFromPoint(clientX, clientY)) {
      const g = el.closest?.('.wire-group');
      if (!g?.dataset?.id) continue;
      const wire = wires.get(g.dataset.id);
      if (wire) return wire;
    }
    return null;
  }

  /** Tip-lead wire for a dual-coil fan/tip under the pointer (or selected dual coil leads). */
  function findHbTipLeadWireNearPointer(clientX, clientY) {
    const hits = document.elementsFromPoint(clientX, clientY);
    let tipIdx = null;
    let host = null;
    for (const el of hits) {
      const tip = el.closest?.('.terminal.hb-tip');
      if (tip) {
        host = tip.closest('.component');
        if (host && isDualCoilComponent(host)) {
          tipIdx = [...host.querySelectorAll('.terminal.hb-tip')].indexOf(tip);
          if (tipIdx >= 0) break;
        }
      }
      const fanHit = el.closest?.('[data-hb-fan-hit]');
      if (fanHit) {
        host = fanHit.closest('.component');
        if (host && isDualCoilComponent(host)) {
          tipIdx = Number(fanHit.dataset.hbFanHit);
          if (Number.isFinite(tipIdx)) break;
        }
      }
    }
    if (host && tipIdx != null && tipIdx >= 0) {
      const wireId = host.dataset[`hbTip${tipIdx}WireId`];
      const wire = wireId ? wires.get(wireId) : null;
      if (wire) return wire;
    }
    // Selected dual coil: if pointer is anywhere on it (not body-only rotate), prefer its tip leads near pointer
    for (const comp of selectedComponents) {
      if (!isDualCoilComponent(comp)) continue;
      for (let i = 0; i < HB_FAN_COUNT; i++) {
        const wireId = comp.dataset[`hbTip${i}WireId`];
        const wire = wireId ? wires.get(wireId) : null;
        if (!wire) continue;
        // Prefer the lead whose tip is closest to the pointer
        const tip = comp.querySelectorAll('.terminal.hb-tip')[i];
        if (!tip) continue;
        const c = getTerminalCenter(tip);
        if (Math.hypot(c.x - clientX, c.y - clientY) < 48) return wire;
      }
    }
    return null;
  }

  function resolveWireForSlackAdjust(clientX, clientY) {
    if (heldWireId && wires.has(heldWireId)) return wires.get(heldWireId);
    const under = findWireAtClient(clientX, clientY);
    if (under) return under;
    if (selectedWireGroups.size === 1) {
      return wires.get([...selectedWireGroups][0].dataset.id) || null;
    }
    if (selectedWireGroups.size > 1) return null;
    return findHbTipLeadWireNearPointer(clientX, clientY);
  }

  function adjustWireSlackAtPointer(clientX, clientY, delta) {
    if (selectedWireGroups.size > 1 && !heldWireId && !heldHbConductor) {
      return adjustSelectedWireSlack(delta);
    }
    // Prefer the wire/conductor currently held under the pointer
    if (heldWireId && wires.has(heldWireId)) {
      const held = wires.get(heldWireId);
      if (held?.hbLeadCompId != null && held.hbLeadTipIndex != null) {
        const comp = components.get(held.hbLeadCompId);
        if (comp) {
          setHbConductorSlack(comp, held.hbLeadTipIndex, getHbFanSlack(comp, held.hbLeadTipIndex) + delta);
          setStatus(`Lead bend: ${Math.round(getHbFanSlack(comp, held.hbLeadTipIndex))}px — +/- or wheel`);
          markProjectDirty();
          return true;
        }
      }
      adjustWireSlack(held, delta);
      return true;
    }
    if (heldHbConductor) {
      return adjustHbConductorSlackAtPointer(clientX, clientY, delta);
    }
    // Dual-coil tip + coloured fan = one conductor
    if (adjustHbConductorSlackAtPointer(clientX, clientY, delta)) {
      return true;
    }
    const wire = resolveWireForSlackAdjust(clientX, clientY);
    if (!wire) {
      if (selectedWireGroups.size > 0) return adjustSelectedWireSlack(delta);
      return false;
    }
    if (!selectedWireGroups.has(wire.group)) {
      selectWire(wire);
    }
    adjustWireSlack(wire, delta);
    return true;
  }

  function syncHbLeadWireToFan(wire) {
    if (!wire?.hbLeadCompId || wire.hbLeadTipIndex == null) return;
    const comp = components.get(wire.hbLeadCompId);
    if (!comp || !isDualCoilComponent(comp)) return;
    setHbConductorSlack(comp, wire.hbLeadTipIndex, wire.slack || 0, { skipWire: true });
  }

  /** Tip + coloured fan are one conductor: route is junction → lug (not tip stub → lug). */
  function getHbLeadRoute(wire) {
    if (!wire?.hbLeadCompId || wire.hbLeadTipIndex == null) return null;
    const comp = components.get(wire.hbLeadCompId);
    if (!comp || !isDualCoilComponent(comp)) return null;
    const tip = comp.querySelectorAll('.terminal.hb-tip')[wire.hbLeadTipIndex];
    if (!tip) return null;
    const lugTerm = wire.start.terminal === tip
      ? wire.end.terminal
      : wire.end.terminal === tip
        ? wire.start.terminal
        : null;
    if (!lugTerm || !document.body.contains(lugTerm)) return null;
    const junction = getHbJunction(comp);
    const start = hbLocalToWorld(comp, junction.x, junction.y);
    const lugC = getTerminalCenter(lugTerm);
    const end = clientToWorld(lugC.x, lugC.y);
    const slack = isHbFanSlackUserSet(comp, wire.hbLeadTipIndex)
      ? getHbFanSlack(comp, wire.hbLeadTipIndex)
      : (wire.slack || 0);
    return { start, end, slack, tip, lugTerm, comp };
  }

  function parkHbTipOnTerminal(el, tip, terminal) {
    if (!el || !tip || !terminal) return;
    const center = getTerminalCenter(terminal);
    placeHbTipAtClient(el, tip, center.x, center.y);
  }

  const WIRE_TIP_GRAB_PX = 16;

  function getWireEndpointClient(wire, which) {
    const pt = getAttachPoint(wire, which);
    return worldToClient(pt.x, pt.y);
  }

  /** Which drawn-wire tip is under the pointer. */
  function hitWireEndpoint(wire, clientX, clientY) {
    if (!wire) return null;
    // 4-conductor leads: grab the lug end (tip is parked on the lug when attached)
    if (isHbLeadWire(wire)) {
      const route = getHbLeadRoute(wire);
      if (!route) return null;
      const lug = worldToClient(route.end.x, route.end.y);
      if (Math.hypot(lug.x - clientX, lug.y - clientY) <= WIRE_TIP_GRAB_PX) return 'lug';
      return null;
    }
    // Asset pigtails: only the free tip is re-routable; body end stays locked
    if (isAssetWire(wire)) {
      const tipWhich = wire.end.terminal?.classList?.contains('wire-term')
        ? 'end'
        : wire.start.terminal?.classList?.contains('wire-term')
          ? 'start'
          : 'end';
      const tip = getWireEndpointClient(wire, tipWhich);
      if (Math.hypot(tip.x - clientX, tip.y - clientY) <= WIRE_TIP_GRAB_PX) return tipWhich;
      return null;
    }
    const start = getWireEndpointClient(wire, 'start');
    const end = getWireEndpointClient(wire, 'end');
    const startD = Math.hypot(start.x - clientX, start.y - clientY);
    const endD = Math.hypot(end.x - clientX, end.y - clientY);
    const thresh = WIRE_TIP_GRAB_PX;
    if (startD <= thresh && startD <= endD) return 'start';
    if (endD <= thresh) return 'end';
    return null;
  }

  function findTerminalNearClient(clientX, clientY, exceptTerminal) {
    const maxDist = 14;
    let best = null;
    let bestDist = maxDist;
    components.forEach((comp) => {
      if (!componentOnActivePage(comp)) return;
      if (comp.classList.contains('workspace-page-hidden')) return;
      comp.querySelectorAll('.terminal').forEach((term) => {
        if (term === exceptTerminal) return;
        if (term.classList.contains('hb-tip')) return;
        const c = getTerminalCenter(term);
        const d = Math.hypot(c.x - clientX, c.y - clientY);
        if (d < bestDist) {
          bestDist = d;
          best = term;
        }
      });
    });
    return best;
  }

  function clearWireEndAttachHighlights() {
    document.querySelectorAll('.terminal.wire-end-attach-target').forEach((t) => {
      t.classList.remove('wire-end-attach-target');
    });
  }

  /** Drag a drawn-wire tip after placement — re-route to a terminal or free point. */
  function beginWireEndpointDrag(wire, which, e) {
    if (!wire || (which !== 'start' && which !== 'end')) return;
    heldWireId = wire.id;
    wire.group.classList.add('is-dragging-end');

    const otherWhich = which === 'start' ? 'end' : 'start';
    const oldTerm = wire[which].terminal;
    // Keep terminal attached until the pointer actually moves (click/select must not detach).

    const clearHold = () => {
      if (heldWireId === wire.id) heldWireId = null;
      wire.group.classList.remove('is-dragging-end');
      document.removeEventListener('mouseup', clearHold);
    };
    document.addEventListener('mouseup', clearHold);

    let hoverTarget = null;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    let moved = false;

    function detachForDrag() {
      if (!oldTerm || wire[which].terminal !== oldTerm) return;
      unregisterTerminalWire(oldTerm, wire.id);
      wire[which].terminal = null;
    }

    function onMove(ev) {
      if (!moved && Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) < 3) return;
      if (!moved) {
        moved = true;
        detachForDrag();
      }
      clearWireEndAttachHighlights();
      hoverTarget = findTerminalNearClient(ev.clientX, ev.clientY, wire[otherWhich].terminal);
      if (hoverTarget) {
        hoverTarget.classList.add('wire-end-attach-target');
        const c = getTerminalCenter(hoverTarget);
        showSnapIndicator(c.x, c.y);
        const world = clientToWorld(c.x, c.y);
        wire[which].x = world.x;
        wire[which].y = world.y;
        setStatus(`Connect tip → ${hoverTarget.dataset.terminalLabel || 'terminal'}`);
      } else {
        snapIndicator.classList.add('hidden');
        const free = ev.shiftKey;
        const world = clientToWorld(ev.clientX, ev.clientY);
        wire[which].x = snapWorkspace(world.x, free);
        wire[which].y = snapWorkspace(world.y, free);
        setStatus('Moving wire tip — drop on a terminal or free point · then bend with drag / +/-');
      }
      updateWirePosition(wire);
      if (selectedWireGroups.has(wire.group)) placeWireEndLabels(wire);
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      clearWireEndAttachHighlights();
      snapIndicator.classList.add('hidden');
      document.body.classList.remove('snap-active');

      // Click without drag — leave terminal attachment untouched
      if (!moved) {
        updateWirePosition(wire);
        if (selectedWireGroups.has(wire.group)) {
          placeWireEndLabels(wire);
          syncSelectedWireConnectHighlights();
        }
        return;
      }

      if (hoverTarget && document.body.contains(hoverTarget)) {
        wire[which].terminal = hoverTarget;
        registerTerminalWire(hoverTarget, wire.id);
        const c = getTerminalCenter(hoverTarget);
        const world = clientToWorld(c.x, c.y);
        wire[which].x = world.x;
        wire[which].y = world.y;
      }

      updateWirePosition(wire);
      [wire.start.terminal, wire.end.terminal].forEach((term) => {
        if (term) collectWiresSharingTerminal(term, null).forEach((w) => updateWirePosition(w));
      });

      if (isWireTooShort(wire)) {
        // Restore previous terminal if we emptied the wire
        if (oldTerm && document.body.contains(oldTerm) && !wire[which].terminal) {
          wire[which].terminal = oldTerm;
          registerTerminalWire(oldTerm, wire.id);
          updateWirePosition(wire);
          setStatus('Tip move cancelled — wire too short');
        } else {
          discardWire(wire, 'Wire too short after tip move — deleted');
          markProjectDirty();
          return;
        }
      } else {
        assignDivergentSlack(wire);
        updateWirePosition(wire);
        markProjectDirty();
        setStatus(
          wire[which].terminal
            ? `Tip attached to ${wire[which].terminal.dataset.terminalLabel || 'terminal'} — drag to move · double-click sleeve to bend`
            : 'Tip placed — drag to move · double-click sleeve to bend'
        );
      }
      refreshLightningWireGlow();
      refreshShortCircuitCheck();
      validateYesGroundConnections();
      if (selectedWireGroups.has(wire.group)) {
        placeWireEndLabels(wire);
        syncSelectedWireConnectHighlights();
        updateWireGaugeReadout();
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    setStatus('Drag wire tip to re-route · drag sleeve to move · double-click sleeve to bend');
  }

  const WIRE_BEND_DBLCLICK_MS = 280;
  const WIRE_BEND_DBLCLICK_MOVE_PX = 6;
  let wireBendClickStamp = null;

  /** Quick successive double-click on the same wire sleeve → bend edit. */
  function consumeQuickWireBendDoubleClick(wireId, clientX, clientY) {
    const now = performance.now();
    const prev = wireBendClickStamp;
    wireBendClickStamp = { id: wireId, t: now, x: clientX, y: clientY };
    if (!prev || prev.id !== wireId) return false;
    if (now - prev.t > WIRE_BEND_DBLCLICK_MS) return false;
    if (Math.hypot(clientX - prev.x, clientY - prev.y) > WIRE_BEND_DBLCLICK_MOVE_PX) return false;
    wireBendClickStamp = null;
    return true;
  }

  function collectSelectedWireTranslateTargets() {
    return [...selectedWireGroups]
      .map((g) => wires.get(g.dataset.id))
      .filter((w) => w && !isHbLeadWire(w));
  }

  function detachWiresForTranslate(targets) {
    targets.forEach((w) => {
      if (!isAssetWire(w)) ensureWireMovableGeometry(w);
    });
  }

  function snapshotWiresForTranslate(targets) {
    return targets.map((wire) => {
      const aw = getAssetWireRoute(wire);
      const owner = isAssetWire(wire) ? components.get(wire.assetWireCompId) : null;
      let startX;
      let startY;
      let endX;
      let endY;
      if (aw) {
        startX = aw.start.x;
        startY = aw.start.y;
        endX = aw.end.x;
        endY = aw.end.y;
      } else {
        const startPt = wire.start.terminal ? getAttachPoint(wire, 'start') : wire.start;
        const endPt = wire.end.terminal ? getAttachPoint(wire, 'end') : wire.end;
        startX = startPt.x;
        startY = startPt.y;
        endX = endPt.x;
        endY = endPt.y;
      }
      return {
        wire,
        startX,
        startY,
        endX,
        endY,
        anchors: (wire.anchors || []).map((a) => ({ x: a.x, y: a.y })),
        startTerm: wire.start.terminal || null,
        endTerm: wire.end.terminal || null,
        ownerSelected: !!(owner && selectedComponents.has(owner)),
      };
    });
  }

  function applyWireTranslateSnapshots(snapshot, dx, dy) {
    if (!snapshot?.length) return;
    snapshot.forEach((s) => {
      if (isAssetWire(s.wire)) {
        // Owner asset is moving with the selection — tip rides along; don't double-apply
        if (s.ownerSelected) {
          updateWirePosition(s.wire);
          return;
        }
        const route = getAssetWireRoute(s.wire);
        if (!route?.tip || !route.comp) return;
        const client = worldToClient(s.endX + dx, s.endY + dy);
        placeAssetWireTipAtClient(route.comp, route.tip, client.x, client.y);
        setAssetWireTipAttachment(route.comp, s.wire.assetWireTipIndex, null);
        persistAssetWireTipPositions(route.comp);
        updateWirePosition(s.wire);
        layoutAssetWireFloatLabels(route.comp);
        return;
      }
      s.wire.start.x = s.startX + dx;
      s.wire.start.y = s.startY + dy;
      s.wire.end.x = s.endX + dx;
      s.wire.end.y = s.endY + dy;
      s.wire.anchors = s.anchors.map((a) => ({ x: a.x + dx, y: a.y + dy }));
      updateWirePosition(s.wire);
    });
  }

  function restoreWireTerminalsAfterTranslate(snapshot) {
    if (!snapshot?.length) return;
    snapshot.forEach(({ wire, startTerm, endTerm }) => {
      if (!wire || isAssetWire(wire)) return;
      if (startTerm && document.body.contains(startTerm)) {
        if (!wire.start.terminal) {
          wire.start.terminal = startTerm;
          registerTerminalWire(startTerm, wire.id);
        }
      }
      if (endTerm && document.body.contains(endTerm)) {
        if (!wire.end.terminal) {
          wire.end.terminal = endTerm;
          registerTerminalWire(endTerm, wire.id);
        }
      }
      updateWirePosition(wire);
    });
  }

  /** Translate all selected (non–HB-lead) wires together — normal sleeve drag. */
  function beginSelectedWiresTranslate(e) {
    if (e.button !== 0 || e.ctrlKey || e.metaKey) return;
    const wireTargets = collectSelectedWireTranslateTargets();
    const compTargets = [...selectedComponents];
    if (wireTargets.length === 0 && compTargets.length === 0) return;

    // Snapshot terminal attachments; only detach once a real drag starts
    const termSnapshots = wireTargets.map((wire) => ({
      wire,
      startTerm: wire.start.terminal || null,
      endTerm: wire.end.terminal || null,
    }));

    heldWireId = wireTargets[0]?.id || `sel-${Date.now()}`;
    const holdId = heldWireId;
    const clearHold = () => {
      if (heldWireId === holdId) heldWireId = null;
      document.removeEventListener('mouseup', clearHold);
    };
    document.addEventListener('mouseup', clearHold);

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startWorld = clientToWorld(e.clientX, e.clientY);
    let dragging = false;
    let detached = false;
    const grid = getWorkspaceGrid();
    let wireSnapshot = null;
    let compSnapshot = null;

    function ensureDetachedForDrag() {
      if (detached) return;
      detached = true;
      wireSnapshot = snapshotWiresForTranslate(wireTargets);
      detachWiresForTranslate(wireTargets);
      compSnapshot = compTargets.map((c) => ({
        el: c,
        left: parseFloat(c.style.left) || 0,
        top: parseFloat(c.style.top) || 0,
      }));
    }

    function onMove(ev) {
      const dist = Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY);
      if (!dragging && dist < 5) return;
      dragging = true;
      ensureDetachedForDrag();
      if (!wireSnapshot && !compSnapshot) return;
      const free = ev.shiftKey;
      const cur = clientToWorld(ev.clientX, ev.clientY);
      let dx = cur.x - startWorld.x;
      let dy = cur.y - startWorld.y;
      if (!free) {
        dx = Math.round(dx / grid) * grid;
        dy = Math.round(dy / grid) * grid;
      }
      if (compSnapshot) {
        compSnapshot.forEach(({ el, left, top }) => {
          el.style.left = `${Math.max(0, left + dx)}px`;
          el.style.top = `${Math.max(0, top + dy)}px`;
        });
      }
      if (wireSnapshot) applyWireTranslateSnapshots(wireSnapshot, dx, dy);
      updateAllWirePositions();
      updateAssetConfigChrome();
      const nw = wireTargets.length;
      const nc = compTargets.length;
      const parts = [];
      if (nc) parts.push(`${nc} part${nc === 1 ? '' : 's'}`);
      if (nw) parts.push(`${nw} wire${nw === 1 ? '' : 's'}`);
      setStatus(
        free
          ? `Moving ${parts.join(' + ')} · free (Shift)`
          : `Moving ${parts.join(' + ')} · grid · Shift=free`
      );
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!dragging) {
        // Click without drag — keep terminal attachments; restore if somehow cleared
        termSnapshots.forEach(({ wire, startTerm, endTerm }) => {
          if (startTerm && !wire.start.terminal && document.body.contains(startTerm)) {
            wire.start.terminal = startTerm;
            registerTerminalWire(startTerm, wire.id);
          }
          if (endTerm && !wire.end.terminal && document.body.contains(endTerm)) {
            wire.end.terminal = endTerm;
            registerTerminalWire(endTerm, wire.id);
          }
          updateWirePosition(wire);
        });
        return;
      }
      if (wireSnapshot) restoreWireTerminalsAfterTranslate(wireSnapshot);
      updateAllWirePositions();
      updateAssetConfigChrome();
      markProjectDirty();
      refreshLightningWireGlow();
      refreshShortCircuitCheck();
      validateYesGroundConnections();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function beginWireSlackHold(wire, e) {
    if (!wire) return;
    heldWireId = wire.id;
    const clearHold = () => {
      if (heldWireId === wire.id) heldWireId = null;
      document.removeEventListener('mouseup', clearHold);
    };
    document.addEventListener('mouseup', clearHold);

    if (e.button !== 0 || e.ctrlKey || e.metaKey) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    let dragging = false;
    const hbComp = wire.hbLeadCompId ? components.get(wire.hbLeadCompId) : null;
    const hbTipIdx = wire.hbLeadTipIndex;

    function onMove(ev) {
      const dist = Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY);
      if (!dragging && dist < 5) return;
      dragging = true;
      // Dual-coil tip lead = perpendicular slack along the coloured conductor
      if (hbComp && hbTipIdx != null && isDualCoilComponent(hbComp)) {
        const junction = getHbJunction(hbComp);
        const route = getHbLeadRoute(wire);
        let endLocal;
        if (route?.lugTerm) {
          const lugC = getTerminalCenter(route.lugTerm);
          endLocal = clientToDualCoilLocal(hbComp, lugC.x, lugC.y);
        } else {
          const tip = hbComp.querySelectorAll('.terminal.hb-tip')[hbTipIdx];
          if (!tip) return;
          const tipC = getTerminalCenter(tip);
          endLocal = clientToDualCoilLocal(hbComp, tipC.x, tipC.y);
        }
        const pointerLocal = clientToDualCoilLocal(hbComp, ev.clientX, ev.clientY);
        const dx = endLocal.x - junction.x;
        const dy = endLocal.y - junction.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const mx = (junction.x + endLocal.x) / 2;
        const my = (junction.y + endLocal.y) / 2;
        const slack = (pointerLocal.x - mx) * nx + (pointerLocal.y - my) * ny;
        setHbConductorSlack(hbComp, hbTipIdx, slack);
        setStatus(`Lead bend: ${Math.round(getHbFanSlack(hbComp, hbTipIdx))}px — drag, +/- or wheel`);
        return;
      }
      // Drawn wire: move a mid control point in 2D (grid snap, Shift = free)
      const free = ev.shiftKey;
      const world = clientToWorld(ev.clientX, ev.clientY);
      const x = snapWorkspace(world.x, free);
      const y = snapWorkspace(world.y, free);
      wire.anchors = [{ x, y }];
      wire.slack = 0;
      updateWirePosition(wire);
      setStatus(
        free
          ? `Wire mid ${Math.round(x)}, ${Math.round(y)} — free (Shift)`
          : `Wire mid ${Math.round(x)}, ${Math.round(y)} — grid snap · hold Shift for free`
      );
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (dragging) markProjectDirty();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    setStatus('Bend edit — drag mid point · Shift=free · Esc / click out keeps multi-select');
  }

  function raiseSelectedWiresInStack() {
    selectedWireGroups.forEach((group) => {
      group.parentNode?.appendChild(group);
    });
  }

  const OVERLAP_WIRE_NEAR_PX = 16;
  const OVERLAP_TERMINAL_NEAR_PX = 20;

  /** Screen-space proximity to a wire hit path (stroke test + sampled length). */
  function wireNearClient(wire, clientX, clientY, maxDist = OVERLAP_WIRE_NEAR_PX) {
    if (!wire) return false;
    if (wireHitContainsClient(wire, clientX, clientY)) return true;
    if (hitWireEndpoint(wire, clientX, clientY)) return true;
    const hit = wire.hit;
    if (!hit || typeof hit.getTotalLength !== 'function') return false;
    try {
      const len = hit.getTotalLength();
      if (!(len > 0)) return false;
      const svg = hit.ownerSVGElement;
      const ctm = hit.getScreenCTM();
      if (!svg || !ctm) return false;
      const steps = Math.max(10, Math.min(64, Math.ceil(len / 5)));
      const pt = svg.createSVGPoint();
      for (let i = 0; i <= steps; i++) {
        const p = hit.getPointAtLength((len * i) / steps);
        pt.x = p.x;
        pt.y = p.y;
        const screen = pt.matrixTransform(ctm);
        if (Math.hypot(screen.x - clientX, screen.y - clientY) <= maxDist) return true;
      }
    } catch (_) {
      /* ignore */
    }
    return false;
  }

  function terminalsNearClient(clientX, clientY, maxDist = OVERLAP_TERMINAL_NEAR_PX) {
    const list = [];
    components.forEach((comp) => {
      if (comp.classList.contains('workspace-page-hidden')) return;
      if (!componentOnActivePage(comp)) return;
      comp.querySelectorAll('.terminal').forEach((term) => {
        const c = getTerminalCenter(term);
        if (Math.hypot(c.x - clientX, c.y - clientY) <= maxDist) list.push(term);
      });
    });
    return list;
  }

  /** Screen-space proximity to an arbitrary SVG stroke path. */
  function pathNearClient(pathEl, clientX, clientY, maxDist = OVERLAP_WIRE_NEAR_PX) {
    if (!pathEl) return false;
    if (pathHitContainsClient(pathEl, clientX, clientY)) return true;
    if (typeof pathEl.getTotalLength !== 'function') return false;
    try {
      const len = pathEl.getTotalLength();
      if (!(len > 0)) return false;
      const svg = pathEl.ownerSVGElement;
      const ctm = pathEl.getScreenCTM();
      if (!svg || !ctm) return false;
      const steps = Math.max(8, Math.min(48, Math.ceil(len / 5)));
      const pt = svg.createSVGPoint();
      for (let i = 0; i <= steps; i++) {
        const p = pathEl.getPointAtLength((len * i) / steps);
        pt.x = p.x;
        pt.y = p.y;
        const screen = pt.matrixTransform(ctm);
        if (Math.hypot(screen.x - clientX, screen.y - clientY) <= maxDist) return true;
      }
    } catch (_) {
      /* ignore */
    }
    return false;
  }

  /** True if pointer is near this dual-coil tip’s coloured fan (local hit or attached lead wire). */
  function hbFanConductorNearClient(comp, tipIdx, clientX, clientY, maxDist = OVERLAP_WIRE_NEAR_PX) {
    if (!comp || tipIdx == null) return false;
    const wire = getHbTipLeadWire(comp, tipIdx);
    if (wire && wireNearClient(wire, clientX, clientY, maxDist)) return true;
    const hit = comp.querySelector(`[data-hb-fan-hit="${tipIdx}"] .hb-fan-hit`);
    if (pathNearClient(hit, clientX, clientY, maxDist)) return true;
    const tip = comp.querySelectorAll('.terminal.hb-tip')[tipIdx];
    if (tip) {
      const c = getTerminalCenter(tip);
      if (Math.hypot(c.x - clientX, c.y - clientY) <= maxDist + 4) return true;
    }
    return false;
  }

  /**
   * Every wire stacked at / near the pointer — stroke hits, proximity samples,
   * and full lug stacks (all wires on nearby terminals).
   */
  function collectAllStackedWiresAtClient(clientX, clientY) {
    const found = [];
    const seen = new Set();

    function add(wire) {
      if (!wire?.id || seen.has(wire.id)) return;
      if (wire.group?.classList.contains('workspace-page-hidden')) return;
      seen.add(wire.id);
      found.push(wire);
    }

    peekWiresAtClient(clientX, clientY).forEach(add);

    wires.forEach((wire) => {
      if (wireNearClient(wire, clientX, clientY)) add(wire);
    });

    // Full stacks on any nearby terminal (covers tips parked over lugs)
    terminalsNearClient(clientX, clientY).forEach((term) => {
      terminalWireMap.get(term)?.forEach((wid) => add(wires.get(wid)));
      collectHbLeadWiresForTerminal(term).forEach(add);
      collectAssetWiresForTerminal(term).forEach(add);
    });

    // Dual-coil fan bundle: any near fan → all sibling conductors also near (or at junction)
    components.forEach((comp) => {
      if (!isDualCoilComponent(comp)) return;
      if (comp.classList.contains('workspace-page-hidden')) return;
      if (!componentOnActivePage(comp)) return;
      const junction = getHbJunction(comp);
      const jWorld = hbLocalToWorld(comp, junction.x, junction.y);
      const jClient = worldToClient(jWorld.x, jWorld.y);
      const nearJunction = Math.hypot(jClient.x - clientX, jClient.y - clientY) <= 40;
      let anyFanNear = nearJunction;
      if (!anyFanNear) {
        for (let i = 0; i < HB_FAN_COUNT; i++) {
          if (hbFanConductorNearClient(comp, i, clientX, clientY, OVERLAP_WIRE_NEAR_PX * 1.5)) {
            anyFanNear = true;
            break;
          }
        }
      }
      if (!anyFanNear) return;
      for (let i = 0; i < HB_FAN_COUNT; i++) {
        const w = getHbTipLeadWire(comp, i);
        if (!w) continue;
        if (nearJunction || hbFanConductorNearClient(comp, i, clientX, clientY, OVERLAP_WIRE_NEAR_PX * 2.25)) {
          add(w);
        }
      }
    });

    // Expand: any other lead of the same dual-coil / asset owner that is also nearby
    const owners = new Set();
    found.forEach((wire) => {
      if (isHbLeadWire(wire) && wire.hbLeadCompId != null) owners.add(`hb:${wire.hbLeadCompId}`);
      if (isAssetWire(wire) && wire.assetWireCompId != null) owners.add(`aw:${wire.assetWireCompId}`);
    });
    owners.forEach((key) => {
      const [kind, id] = key.split(':');
      const comp = components.get(id);
      if (!comp) return;
      if (kind === 'hb') {
        const tips = [...comp.querySelectorAll('.terminal.hb-tip')];
        tips.forEach((_, idx) => {
          const w = getHbTipLeadWire(comp, idx);
          if (w && wireNearClient(w, clientX, clientY, OVERLAP_WIRE_NEAR_PX * 1.75)) add(w);
        });
      } else if (kind === 'aw') {
        getAssetWireTips(comp).forEach((_, idx) => {
          const wid = comp.dataset[`awTip${idx}WireId`];
          const w = wid ? wires.get(wid) : null;
          if (w && wireNearClient(w, clientX, clientY, OVERLAP_WIRE_NEAR_PX * 1.75)) add(w);
        });
      }
    });

    return found;
  }

  /**
   * Coloured fan conductors under the pointer (attached lead wires OR unattached local fans).
   * Returns overlap-cycle items: { kind:'wire', wire } or { kind:'hb-fan', el, tipIdx, ... }.
   */
  function collectHbFanOverlapItemsAtClient(clientX, clientY) {
    const items = [];
    const seen = new Set();

    function pushFan(comp, tipIdx) {
      const tip = comp.querySelectorAll('.terminal.hb-tip')[tipIdx];
      if (!tip) return;
      const key = `${comp.dataset.id}:${tipIdx}`;
      if (seen.has(key)) return;
      seen.add(key);
      const tipName = tip.dataset?.tipLabel || tip.dataset?.terminalLabel || '';
      const hex = tip.dataset?.wireColor || tip.dataset?.baseColor || '#888';
      const wire = getHbTipLeadWire(comp, tipIdx);
      if (wire) {
        items.push({ kind: 'wire', wire, label: tipName || describeWireForOverlap(wire) });
        return;
      }
      items.push({
        kind: 'hb-fan',
        el: comp,
        tipIdx,
        label: tipName || `Fan (${hexToWireColorKey(hex) || 'lead'})`,
        color: hex,
      });
    }

    components.forEach((comp) => {
      if (!isDualCoilComponent(comp)) return;
      if (comp.classList.contains('workspace-page-hidden')) return;
      if (!componentOnActivePage(comp)) return;
      const junction = getHbJunction(comp);
      const jWorld = hbLocalToWorld(comp, junction.x, junction.y);
      const jClient = worldToClient(jWorld.x, jWorld.y);
      const nearJunction = Math.hypot(jClient.x - clientX, jClient.y - clientY) <= 40;
      const nearIdx = [];
      for (let i = 0; i < HB_FAN_COUNT; i++) {
        if (hbFanConductorNearClient(comp, i, clientX, clientY, OVERLAP_WIRE_NEAR_PX * 1.5)) {
          nearIdx.push(i);
        }
      }
      if (!nearJunction && !nearIdx.length) return;
      for (let i = 0; i < HB_FAN_COUNT; i++) {
        if (nearJunction || nearIdx.includes(i)
          || hbFanConductorNearClient(comp, i, clientX, clientY, OVERLAP_WIRE_NEAR_PX * 2.25)) {
          pushFan(comp, i);
        }
      }
    });

    return items;
  }

  /**
   * Temporarily ignore assets/terminals/fan hits so elementsFromPoint can hit wire
   * paths that sit behind them (back wire layers + 4-conductor leads under lugs).
   */
  function peekWiresAtClient(clientX, clientY) {
    const occluders = document.querySelectorAll(
      '.component, .panel-snap-point, .terminal, .hb-fan-hit, .hb-loom-hit, .hb-leads-hit-svg, .cap-lead-hit'
    );
    const saved = [];
    occluders.forEach((el) => {
      saved.push([el, el.style.pointerEvents]);
      el.style.pointerEvents = 'none';
    });
    const found = [];
    const seen = new Set();
    try {
      for (const el of document.elementsFromPoint(clientX, clientY)) {
        const g = el.closest?.('.wire-group');
        if (!g?.dataset?.id || seen.has(g.dataset.id)) continue;
        const wire = wires.get(g.dataset.id);
        if (!wire || wire.group.classList.contains('workspace-page-hidden')) continue;
        seen.add(g.dataset.id);
        found.push(wire);
      }
      // Geometry: include every wire under the pointer (stacked leads, etc.)
      wires.forEach((wire) => {
        if (!wire || seen.has(wire.id)) return;
        if (wire.group?.classList.contains('workspace-page-hidden')) return;
        if (!wireNearClient(wire, clientX, clientY)) return;
        seen.add(wire.id);
        found.push(wire);
      });
    } finally {
      saved.forEach(([el, pe]) => {
        el.style.pointerEvents = pe;
      });
    }
    return found;
  }

  /** True if the pointer is on an SVG path’s stroke (isPointInStroke). */
  function pathHitContainsClient(pathEl, clientX, clientY) {
    const svg = pathEl?.ownerSVGElement;
    if (!pathEl || !svg || typeof pathEl.isPointInStroke !== 'function') return false;
    try {
      const pt = svg.createSVGPoint();
      const ctm = pathEl.getScreenCTM();
      if (!ctm) return false;
      const inv = ctm.inverse();
      pt.x = clientX;
      pt.y = clientY;
      const local = pt.matrixTransform(inv);
      return pathEl.isPointInStroke(local);
    } catch (_) {
      return false;
    }
  }

  /** True if the pointer is on this wire’s fat hit path (SVG isPointInStroke). */
  function wireHitContainsClient(wire, clientX, clientY) {
    return pathHitContainsClient(wire?.hit, clientX, clientY);
  }

  /** HB leads whose tip is parked on / attached to this terminal (click-through + overlap). */
  function collectHbLeadWiresForTerminal(terminal) {
    if (!terminal) return [];
    const list = [];
    components.forEach((comp) => {
      if (!isDualCoilComponent(comp)) return;
      const tips = [...comp.querySelectorAll('.terminal.hb-tip')];
      tips.forEach((tip, idx) => {
        const attached = getHbTipAttachedTerminal(comp, idx);
        if (attached !== terminal && tip !== terminal) return;
        const w = getHbTipLeadWire(comp, idx);
        if (w) list.push(w);
      });
    });
    return list;
  }

  /** Asset-wire pigtails docked on / ending at this terminal. */
  function collectAssetWiresForTerminal(terminal) {
    if (!terminal) return [];
    const list = [];
    components.forEach((comp) => {
      if (!hasAssetWireTerms(comp)) return;
      getAssetWireTips(comp).forEach((tip, idx) => {
        const attached = getAssetWireTipAttachedTerminal(comp, idx);
        if (attached !== terminal && tip !== terminal) return;
        const wid = comp.dataset[`awTip${idx}WireId`];
        const w = wid ? wires.get(wid) : null;
        if (w) list.push(w);
      });
    });
    return list;
  }

  /** Display name for overlap cycle / float (regular, fan, asset lead). */
  function describeWireForOverlap(wire) {
    if (!wire) return 'Wire';
    if (isHbLeadWire(wire)) {
      const tip = components.get(wire.hbLeadCompId)
        ?.querySelectorAll?.('.terminal.hb-tip')?.[wire.hbLeadTipIndex];
      const tipName = tip?.dataset?.tipLabel || tip?.dataset?.terminalLabel || '';
      return tipName || `Fan (${wire.color || 'lead'})`;
    }
    if (isAssetWire(wire)) {
      const tip = getAssetWireTips(components.get(wire.assetWireCompId))?.[wire.assetWireTipIndex];
      const tipName = tip?.dataset?.tipLabel || tip?.dataset?.terminalLabel || '';
      return tipName || `Lead (${wire.color || 'wire'})`;
    }
    const a = getWireEndpointDisplayName(wire.start);
    const b = getWireEndpointDisplayName(wire.end);
    if (a !== '·' || b !== '·') return `${a}–${b}`;
    const color = wire.color || 'wire';
    return `Wire (${color})`;
  }

  /** Colour key or hex for overlap float text. */
  function wireOverlapColor(wire) {
    if (!wire) return '#ffffff';
    if (isAssetWire(wire)) {
      const tip = getAssetWireTips(components.get(wire.assetWireCompId))?.[wire.assetWireTipIndex];
      const hex = tip?.dataset?.wireColor || tip?.dataset?.baseColor;
      if (hex) return hex;
    }
    if (isHbLeadWire(wire)) {
      const tip = components.get(wire.hbLeadCompId)
        ?.querySelectorAll?.('.terminal.hb-tip')?.[wire.hbLeadTipIndex];
      const hex = tip?.dataset?.wireColor || tip?.dataset?.baseColor;
      if (hex) return hex;
    }
    return wire.color || '#ffffff';
  }

  function clearOverlapLeadHighlights() {
    document.querySelectorAll(
      '.cap-lead.overlap-cycle-selected, .cap-lead-hit.overlap-cycle-selected, '
      + '.hb-fan.overlap-cycle-selected, .hb-fan-hit.overlap-cycle-selected'
    ).forEach((el) => {
      el.classList.remove('overlap-cycle-selected');
    });
  }

  function highlightCapLeadOverlap(comp, which) {
    clearOverlapLeadHighlights();
    if (!comp || !which) return;
    const g = comp.querySelector(`[data-cap-lead="${which}"]`);
    g?.querySelector('.cap-lead')?.classList.add('overlap-cycle-selected');
    g?.querySelector('.cap-lead-hit')?.classList.add('overlap-cycle-selected');
  }

  function highlightHbFanOverlap(comp, tipIdx) {
    clearOverlapLeadHighlights();
    if (!comp || tipIdx == null) return;
    comp.querySelector(`[data-hb-fan="${tipIdx}"] .hb-fan`)?.classList.add('overlap-cycle-selected');
    comp.querySelector(`[data-hb-fan-hit="${tipIdx}"] .hb-fan-hit`)?.classList.add('overlap-cycle-selected');
  }

  /** Capacitor lead legs under the pointer. */
  function collectCapLeadsAtClient(clientX, clientY) {
    const list = [];
    components.forEach((comp) => {
      if (!isCapacitorComponent(comp)) return;
      if (comp.classList.contains('workspace-page-hidden')) return;
      CAP_LEAD_SIDES.forEach((which) => {
        const hit = comp.querySelector(`[data-cap-lead="${which}"] .cap-lead-hit`);
        if (!pathHitContainsClient(hit, clientX, clientY)) return;
        list.push({
          kind: 'cap-lead',
          el: comp,
          which,
          label: `Cap ${which} lead`,
          color: '#c8cdd6',
        });
      });
    });
    return list;
  }

  /** HB lead whose tip is parked on / attached to this terminal (click-through). */
  function findHbLeadWireForTerminal(terminal) {
    return collectHbLeadWiresForTerminal(terminal)[0] || null;
  }

  function beginWirePointerInteraction(wire, e) {
    if (!wire || !e) return;
    raiseSelectedWiresInStack();
    const endHit = hitWireEndpoint(wire, e.clientX, e.clientY);
    if (endHit === 'lug' && isHbLeadWire(wire)) {
      beginHbLeadEndpointDrag(wire, e);
      return;
    }
    if (endHit && isAssetWire(wire)) {
      beginAssetWireEndpointDrag(wire, e);
      return;
    }
    if (endHit) {
      beginWireEndpointDrag(wire, endHit, e);
      return;
    }
    if (isHbLeadWire(wire)) {
      if (consumeQuickWireBendDoubleClick(wire.id, e.clientX, e.clientY)) {
        beginWireSlackHold(wire, e);
      }
      return;
    }
    if (consumeQuickWireBendDoubleClick(wire.id, e.clientX, e.clientY)) {
      beginWireSlackHold(wire, e);
    } else {
      beginSelectedWiresTranslate(e);
    }
  }

  /**
   * Re-route a 4-conductor lead from its lug end (incl. through the covering terminal),
   * matching regular wire tip drag: click keeps attach; drag detaches and re-parks.
   */
  function beginHbLeadEndpointDrag(wire, e) {
    if (!isHbLeadWire(wire) || e.button !== 0) return;
    const el = components.get(wire.hbLeadCompId);
    const tipIdx = wire.hbLeadTipIndex;
    if (!el || tipIdx == null) return;
    const tip = el.querySelectorAll('.terminal.hb-tip')[tipIdx];
    if (!tip) return;

    heldWireId = wire.id;
    heldHbConductor = { compId: el.dataset.id, tipIdx };
    wire.group.classList.add('is-dragging-end');
    tip.classList.add('is-dragging');
    wire.group.classList.add('near-wire-tip');

    const clearHold = () => {
      if (heldWireId === wire.id) heldWireId = null;
      if (heldHbConductor?.compId === el.dataset.id && heldHbConductor?.tipIdx === tipIdx) {
        heldHbConductor = null;
      }
      tip.classList.remove('is-dragging');
      wire.group?.classList.remove('is-dragging-end', 'near-wire-tip');
      document.removeEventListener('mouseup', clearHold);
    };
    document.addEventListener('mouseup', clearHold);

    let hoverTarget = null;
    let moved = false;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const prevAttach = getHbTipAttachedTerminal(el, tipIdx);

    function onMove(ev) {
      if (!moved && Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) < 3) return;
      if (!moved) {
        moved = true;
        // Detach only after real drag — same as regular wire tips
        setHbTipAttachment(el, tipIdx, null);
        if (heldWireId === wire.id) heldWireId = null;
      }
      clearCapLeadAttachHighlights();
      hoverTarget = findHbTipAttachTarget(el, ev.clientX, ev.clientY);
      placeHbTipAtClient(el, tip, ev.clientX, ev.clientY);
      if (hoverTarget) {
        hoverTarget.classList.add('cap-lead-attach-target');
        const center = getTerminalCenter(hoverTarget);
        showSnapIndicator(center.x, center.y);
        setStatus(
          `Connect ${tip.dataset.tipLabel || tip.dataset.terminalLabel || 'lead'} → ${hoverTarget.dataset.terminalLabel || 'terminal'}`
        );
      } else {
        snapIndicator.classList.add('hidden');
        setStatus(`Moving ${tip.dataset.tipLabel || 'fan'} lead tip — drop on a terminal · +/- bends`);
      }
      updateDualCoilLeadPaths(el);
      updateAllWirePositions();
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      tip.classList.remove('is-dragging');
      clearCapLeadAttachHighlights();
      snapIndicator.classList.add('hidden');
      document.body.classList.remove('snap-active');

      if (!moved) {
        // Click through terminal / tip — keep attachment, just select
        if (prevAttach && !getHbTipAttachedTerminal(el, tipIdx)) {
          setHbTipAttachment(el, tipIdx, prevAttach);
        }
        const live = getHbTipLeadWire(el, tipIdx) || wire;
        if (live && wires.has(live.id)) {
          selectWire(live);
          live.group.classList.remove('is-dragging-end', 'near-wire-tip');
        }
        updateDualCoilLeadPaths(el);
        return;
      }

      if (hoverTarget && document.body.contains(hoverTarget)) {
        setHbTipAttachment(el, tipIdx, hoverTarget);
        syncDualCoilTipAttachments(el);
        refreshShortCircuitCheck();
        validateYesGroundConnections();
        refreshLightningWireGlow();
        const live = getHbTipLeadWire(el, tipIdx);
        if (live) selectWire(live);
        setStatus(`Lead wired to ${hoverTarget.dataset.terminalLabel || 'terminal'}`);
      } else {
        setHbTipAttachment(el, tipIdx, null);
        persistHbTipPositions(el);
        updateDualCoilLeadPaths(el);
        setStatus('Fan lead placed');
      }
      markProjectDirty();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    setStatus('Drag lead tip to re-route · double-click sleeve to bend');
  }

  function applyWireClickSelection(wire, e) {
    if (!wire) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && selectedWireGroups.has(wire.group) && selectedWireGroups.size > 1) {
      selectWire(wire, { toggleOff: true });
      return false;
    }
    if (e.shiftKey) {
      if (!selectedWireGroups.has(wire.group)) selectWire(wire, { additive: true });
    } else if (ctrl) {
      if (!selectedWireGroups.has(wire.group)) selectWire(wire, { additive: true });
    } else if (!selectedWireGroups.has(wire.group)) {
      selectWire(wire);
    }
    return selectedWireGroups.has(wire.group);
  }

  /** Selected wires stay interactive through assets / other wires covering them. */
  function tryInteractSelectedWireThrough(e) {
    if (wireMode || wireEditFocusMode || moveTool || e.button !== 0) return false;
    if (selectedWireGroups.size === 0) return false;
    if (e.shiftKey || e.ctrlKey || e.metaKey) return false;
    if (e.target.closest?.('.app-header, .toolbar, #asset-config-menu, #asset-state-term-menu, .context-menu, .note-window')) {
      return false;
    }
    // Prefer hit testing that sees through assets/terminals
    let wire = null;
    for (const w of peekWiresAtClient(e.clientX, e.clientY)) {
      if (selectedWireGroups.has(w.group)) {
        wire = w;
        break;
      }
    }
    if (!wire) {
      const under = document.elementsFromPoint(e.clientX, e.clientY);
      for (const el of under) {
        const g = el.closest?.('.wire-group');
        if (!g?.dataset?.id) continue;
        if (!selectedWireGroups.has(g)) continue;
        wire = wires.get(g.dataset.id) || null;
        break;
      }
    }
    if (!wire) return false;
    e.preventDefault();
    e.stopPropagation();
    beginWirePointerInteraction(wire, e);
    return true;
  }

  /** Select / drag a wire even when an asset or terminal is painted on top of it. */
  function trySelectWireThroughOccluders(e) {
    if (wireMode || moveTool || e.button !== 0) return false;
    if (e.target.closest?.('.app-header, .toolbar, #asset-config-menu, #asset-state-term-menu, .context-menu, .note-window')) {
      return false;
    }
    // Direct wire hits use the wire group's own handler
    if (e.target.closest?.('.wire-group')) return false;
    // Only poke through when the click lands on an asset/terminal (or their chrome)
    const onOccluder = e.target.closest?.(
      '.component, .terminal, .hb-fan-hit, .hb-loom-hit, .hb-leads-hit-svg, .cap-lead-hit'
    );
    if (!onOccluder) return false;

    let peeks = peekWiresAtClient(e.clientX, e.clientY);
    // Tip parked on a lug: include all conductors on that terminal
    const term = e.target.closest?.('.terminal');
    if (term) {
      collectHbLeadWiresForTerminal(term).forEach((hbWire) => {
        if (!peeks.includes(hbWire)) peeks = [hbWire, ...peeks];
      });
    }
    if (!peeks.length) return false;

    const wire = peeks[0];
    e.preventDefault();
    e.stopPropagation();
    const keep = applyWireClickSelection(wire, e);
    if (!keep) return true;
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      beginWirePointerInteraction(wire, e);
    }
    return true;
  }

  function setStatus(msg) {
    statusText.textContent = msg;
  }

  function getComponentWorkspacePage(el) {
    return el?.dataset?.workspacePage || 'electronics';
  }

  function setComponentWorkspacePage(el, page) {
    if (!el) return;
    el.dataset.workspacePage = page === 'panel' ? 'panel' : 'electronics';
  }

  function componentOnActivePage(el) {
    return getComponentWorkspacePage(el) === activeWorkspacePage;
  }

  function syncWorkspacePageButtons() {
    const isElectronics = activeWorkspacePage === 'electronics';
    workspacePageElectronics?.classList.toggle('is-active', isElectronics);
    workspacePagePanel?.classList.toggle('is-active', !isElectronics);
    workspacePageElectronics?.setAttribute('aria-selected', isElectronics ? 'true' : 'false');
    workspacePagePanel?.setAttribute('aria-selected', isElectronics ? 'false' : 'true');
    document.body.classList.toggle('workspace-on-panel', !isElectronics);
    document.body.classList.toggle('workspace-on-electronics', isElectronics);
    document.body.classList.toggle('workspace-cad', !isElectronics);
  }

  function wireTouchesPage(wire, page) {
    const startComp = wire.start.terminal?.closest('.component');
    const endComp = wire.end.terminal?.closest('.component');
    const startPage = startComp ? getComponentWorkspacePage(startComp) : page;
    const endPage = endComp ? getComponentWorkspacePage(endComp) : page;
    return startPage === page || endPage === page;
  }

  function syncPanelSnapVisuals() {
    const onElectronics = activeWorkspacePage === 'electronics';
    const placementActive = onElectronics && !!placementMode && panelLayerVisible;
    panelSnapPoints.forEach(({ el }) => {
      const underlay = onElectronics && !placementActive;
      el.classList.toggle('is-underlay', underlay);
      el.classList.toggle('is-placement-target', placementActive);
      if (!placementActive) el.classList.remove('is-placement-hover');
      if (underlay && selectedPanelSnapIds.has(el.dataset.id)) {
        el.classList.remove('selected');
        selectedPanelSnapIds.delete(el.dataset.id);
      }
    });
  }

  function findNearestPanelSnap(x, y, thresholdPx = 10) {
    if (!panelLayerVisible || panelSnapPoints.size === 0) return null;
    let best = null;
    let bestDist = thresholdPx;
    panelSnapPoints.forEach((entry) => {
      const dist = Math.hypot(entry.x - x, entry.y - y);
      if (dist <= bestDist) {
        bestDist = dist;
        best = entry;
      }
    });
    return best;
  }

  let placementSnapHoverId = null;

  function clearPlacementSnapHover() {
    if (placementSnapHoverId) {
      panelSnapPoints.forEach(({ el }) => el.classList.remove('is-placement-hover'));
      placementSnapHoverId = null;
    }
    if (!snappedTerminal) snapIndicator.classList.add('hidden');
  }

  function updatePlacementSnapHover(clientX, clientY) {
    if (!placementMode || activeWorkspacePage !== 'electronics' || !panelLayerVisible) {
      clearPlacementSnapHover();
      return null;
    }
    const world = clientToWorld(clientX, clientY);
    const nearest = findNearestPanelSnap(world.x, world.y, placementPanelSnapThresholdWorld());
    panelSnapPoints.forEach(({ el }) => {
      el.classList.toggle('is-placement-hover', nearest?.el === el);
    });
    const id = nearest?.el?.dataset.id || null;
    if (id !== placementSnapHoverId) {
      placementSnapHoverId = id;
      if (nearest) {
        const screen = worldToClient(nearest.x, nearest.y);
        showSnapIndicator(screen.x, screen.y);
      } else if (!snappedTerminal) {
        snapIndicator.classList.add('hidden');
      }
    }
    return nearest;
  }

  function clearPanelSnapSelection() {
    selectedPanelSnapIds.forEach((id) => {
      panelSnapPoints.get(id)?.el.classList.remove('selected');
    });
    selectedPanelSnapIds.clear();
  }

  function selectPanelSnapPoint(id, additive = false) {
    if (!additive) {
      selectedComponents.forEach((el) => el.classList.remove('selected'));
      selectedComponents.clear();
      selectedWireGroups.forEach((el) => el.classList.remove('selected'));
      selectedWireGroups.clear();
      clearPanelSnapSelection();
      closeAssetConfigMenu();
      closeAssetStateTermMenu();
      updateAlignBar();
      updateAssetConfigChrome();
    } else {
      selectedComponents.forEach((el) => el.classList.remove('selected'));
      selectedComponents.clear();
      selectedWireGroups.forEach((el) => el.classList.remove('selected'));
      selectedWireGroups.clear();
      closeAssetConfigMenu();
      closeAssetStateTermMenu();
    }
    const entry = panelSnapPoints.get(id);
    if (!entry) return;
    selectedPanelSnapIds.add(id);
    entry.el.classList.add('selected');
    const n = selectedPanelSnapIds.size;
    setStatus(
      n === 1
        ? 'Panel snap point selected — drag to move · Delete to remove'
        : `${n} panel snap points selected — Delete to remove`
    );
  }

  function deleteSelectedPanelSnapPoint() {
    if (selectedPanelSnapIds.size === 0) return false;
    const ids = [...selectedPanelSnapIds];
    ids.forEach((id) => {
      const entry = panelSnapPoints.get(id);
      if (!entry) return;
      entry.el.remove();
      panelSnapPoints.delete(id);
    });
    selectedPanelSnapIds.clear();
    markProjectDirty();
    setStatus(ids.length === 1 ? 'Panel snap point deleted' : `Deleted ${ids.length} snap points`);
    return true;
  }

  function createPanelSnapPoint(x, y, id) {
    const snapId = id || `psnap-${++panelSnapIdCounter}`;
    const match = /^psnap-(\d+)$/.exec(snapId);
    if (match) panelSnapIdCounter = Math.max(panelSnapIdCounter, Number(match[1]));

    const el = document.createElement('div');
    el.className = 'panel-snap-point';
    el.dataset.id = snapId;
    el.style.left = `${Math.max(0, x)}px`;
    el.style.top = `${Math.max(0, y)}px`;
    el.title = 'Panel snap point';
    el.innerHTML =
      '<svg class="panel-snap-point-icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false">' +
      '<circle cx="6" cy="6" r="5.25" fill="none" stroke="currentColor" stroke-width="0.7"/>' +
      '<path d="M6 4.6v2.8M4.6 6h2.8" fill="none" stroke="currentColor" stroke-width="0.7" stroke-linecap="square"/>' +
      '</svg>';

    el.addEventListener('mousedown', (e) => {
      if (activeWorkspacePage !== 'panel' || !panelLayerVisible) return;
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      selectPanelSnapPoint(snapId, e.shiftKey);

      const startX = e.clientX;
      const startY = e.clientY;
      const originLeft = parseFloat(el.style.left) || 0;
      const originTop = parseFloat(el.style.top) || 0;
      const dragIds = selectedPanelSnapIds.has(snapId)
        ? [...selectedPanelSnapIds]
        : [snapId];
      const origins = dragIds.map((id) => {
        const entry = panelSnapPoints.get(id);
        return {
          id,
          left: entry ? entry.x : 0,
          top: entry ? entry.y : 0,
        };
      });
      let dragging = false;

      function onMove(ev) {
        if (!dragging) {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < MARQUEE_MIN_PX) return;
          dragging = true;
          dragIds.forEach((id) => panelSnapPoints.get(id)?.el.classList.add('dragging'));
        }
        const world = clientToWorld(ev.clientX, ev.clientY);
        const originWorld = clientToWorld(startX, startY);
        const dx = world.x - originWorld.x;
        const dy = world.y - originWorld.y;
        const free = ev.shiftKey || !panelCursorGridSnap;
        const grid = getWorkspaceGrid();
        let snapDx = dx;
        let snapDy = dy;
        if (!free) {
          snapDx = Math.round(dx / grid) * grid;
          snapDy = Math.round(dy / grid) * grid;
        }
        origins.forEach(({ id, left, top }) => {
          const entry = panelSnapPoints.get(id);
          if (!entry) return;
          const nextX = Math.max(0, left + snapDx);
          const nextY = Math.max(0, top + snapDy);
          entry.el.style.left = `${nextX}px`;
          entry.el.style.top = `${nextY}px`;
          entry.x = nextX;
          entry.y = nextY;
        });
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (dragging) {
          dragIds.forEach((id) => panelSnapPoints.get(id)?.el.classList.remove('dragging'));
          markProjectDirty();
        }
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    workspace.appendChild(el);
    panelSnapPoints.set(snapId, {
      el,
      x: parseFloat(el.style.left) || 0,
      y: parseFloat(el.style.top) || 0,
    });
    syncPanelSnapVisuals();
    return snapId;
  }

  function clearAllPanelSnapPoints() {
    panelSnapPoints.forEach(({ el }) => el.remove());
    panelSnapPoints.clear();
    selectedPanelSnapIds.clear();
  }

  function syncPanelLayerVisibilityButton() {
    if (!workspacePagePanelVisibility) return;
    workspacePagePanelVisibility.classList.toggle('is-layer-hidden', !panelLayerVisible);
    workspacePagePanelVisibility.setAttribute('aria-pressed', panelLayerVisible ? 'true' : 'false');
    workspacePagePanelVisibility.setAttribute(
      'aria-label',
      panelLayerVisible ? 'Hide Panel layer' : 'Show Panel layer'
    );
    workspacePagePanelVisibility.title = panelLayerVisible ? 'Hide Panel layer' : 'Show Panel layer';
    const openEye = workspacePagePanelVisibility.querySelector('.workspace-page-eye-open');
    const closedEye = workspacePagePanelVisibility.querySelector('.workspace-page-eye-closed');
    openEye?.classList.toggle('hidden', !panelLayerVisible);
    closedEye?.classList.toggle('hidden', panelLayerVisible);
    document.body.classList.toggle('panel-layer-hidden', !panelLayerVisible);
  }

  function setPanelLayerVisible(visible) {
    panelLayerVisible = !!visible;
    if (!panelLayerVisible) {
      clearPanelSnapSelection();
      if (panelSnapMode) setPanelSnapMode(false);
    }
    syncPanelLayerVisibilityButton();
  }

  function togglePanelLayerVisible() {
    setPanelLayerVisible(!panelLayerVisible);
  }

  function setPanelSnapMode(active) {
    panelSnapMode = !!active;
    if (panelSnapMode) {
      if (wireMode) setWireMode(false);
      setAssetPlacement(null);
      if (activeWorkspacePage !== 'panel') setActiveWorkspacePage('panel');
      setStatus('Snap point mode — click canvas to place · click points to move/delete');
    } else if (activeWorkspacePage === 'panel') {
      setStatus(`Panel page · 1 grid = ${PANEL_MM_PER_UNIT} mm`);
    }
    const powerBtn = document.getElementById('context-menu-power');
    if (powerBtn && activeWorkspacePage === 'panel') {
      powerBtn.classList.toggle('panel-snap-active', panelSnapMode);
      powerBtn.classList.remove('active');
    }
  }

  function togglePanelSnapMode() {
    setPanelSnapMode(!panelSnapMode);
  }

  function getPanelSnapMode() {
    return panelSnapMode;
  }

  function applyWorkspacePageVisibility() {
    const onElectronics = activeWorkspacePage === 'electronics';

    components.forEach((el) => {
      const page = getComponentWorkspacePage(el);
      const isElectronicsAsset = page === 'electronics';
      el.classList.remove('workspace-page-hidden', 'workspace-page-underlay');

      if (onElectronics) {
        if (!isElectronicsAsset) el.classList.add('workspace-page-underlay');
      } else if (isElectronicsAsset) {
        el.classList.add('workspace-page-hidden');
      }

      const interactive = onElectronics ? isElectronicsAsset : !isElectronicsAsset;
      if (!interactive && selectedComponents.has(el)) {
        selectedComponents.delete(el);
        el.classList.remove('selected');
      }
    });

    wires.forEach((wire) => {
      wire.group.classList.remove('workspace-page-hidden', 'workspace-page-underlay');
      const onElectronicsWire = wireTouchesPage(wire, 'electronics');
      const onPanelWire = wireTouchesPage(wire, 'panel');

      if (onElectronics) {
        if (!onElectronicsWire && onPanelWire) {
          wire.group.classList.add('workspace-page-underlay');
        } else if (!onElectronicsWire && !onPanelWire) {
          wire.group.classList.add('workspace-page-hidden');
        }
      } else if (onElectronicsWire && !onPanelWire) {
        wire.group.classList.add('workspace-page-hidden');
      }

      const interactive = onElectronics
        ? onElectronicsWire
        : onPanelWire || !onElectronicsWire;
      if (!interactive && selectedWireGroups.has(wire.group)) {
        selectedWireGroups.delete(wire.group);
        wire.group.classList.remove('selected');
      }
    });

    syncPanelSnapVisuals();
    if (onElectronics && panelSnapMode) setPanelSnapMode(false);
    syncAllNoteWindowVisibility();

    closeAssetConfigMenu();
    closeAssetStateTermMenu();
    updateSelectionStatus();
    updateAllWirePositions();
    refreshLightningWireGlow();
    refreshGroundCheckAlert();
  }

  function setActiveWorkspacePage(page) {
    const next = page === 'panel' ? 'panel' : 'electronics';
    if (activeWorkspacePage === next) return;
    activeWorkspacePage = next;
    if (next === 'panel' && wireEditFocusMode) {
      setWireEditFocusMode(false);
    }
    syncWorkspacePageButtons();
    applyWorkspaceGridSize();
    applyWorkspacePageVisibility();
    markProjectDirty();
    setStatus(
      next === 'panel'
        ? `Panel · CAD · 1 grid = ${PANEL_MM_PER_UNIT} mm · Tab toggles grid snap (${panelCursorGridSnap ? 'ON' : 'OFF'}) · Enter → MOVE / DIM`
        : 'Electronics page'
    );
    document.body.classList.toggle('panel-grid-snap-off', next === 'panel' && !panelCursorGridSnap);
    if (next !== 'panel') clearPanelCursorSnap();
    else updatePanelCursorSnap(lastPointerX, lastPointerY, false);
  }

  function applyAccentTheme(index) {
    accentThemeIndex = ((index % ACCENT_THEMES.length) + ACCENT_THEMES.length) % ACCENT_THEMES.length;
    const theme = ACCENT_THEMES[accentThemeIndex];
    document.documentElement.style.setProperty('--accent', theme.color);
    document.documentElement.style.setProperty('--selected', theme.color);
    btnAccentCycle.style.background = theme.color;
    btnAccentCycle.dataset.accent = theme.name;
    btnAccentCycle.title = `Accent: ${theme.name} (click to cycle)`;
  }

  function cycleAccentTheme() {
    applyAccentTheme(accentThemeIndex + 1);
    setStatus(`Accent colour: ${ACCENT_THEMES[accentThemeIndex].name}`);
  }

  function deselectAll() {
    selectedComponents.forEach((el) => el.classList.remove('selected'));
    selectedComponents.clear();
    selectedWireGroups.forEach((el) => el.classList.remove('selected'));
    selectedWireGroups.clear();
    clearWireEndAttachHighlights();
    clearOverlapLeadHighlights();
    clearPanelSnapSelection();
    clearDimAnnotationSelection();
    closeAssetConfigMenu();
    closeAssetStateTermMenu();
    clearAssetStateClickTimer();
    if (!wireEditFocusMode) hideWireEndLabels();
    updateAlignBar();
    updateAssetConfigChrome();
    updateWireGaugeReadout();
  }

  function getComponentWorldBounds(comp) {
    const r = comp.getBoundingClientRect();
    const tl = clientToWorld(r.left, r.top);
    const br = clientToWorld(r.right, r.bottom);
    return {
      left: Math.min(tl.x, br.x),
      top: Math.min(tl.y, br.y),
      right: Math.max(tl.x, br.x),
      bottom: Math.max(tl.y, br.y),
    };
  }

  /** Bounds of the asset body for chrome (cog / state chips), ignoring leads & float labels. */
  function getComponentChromeBounds(comp) {
    const body = comp?.querySelector?.('.placeholder');
    const target = body || comp;
    const r = target.getBoundingClientRect();
    const tl = clientToWorld(r.left, r.top);
    const br = clientToWorld(r.right, r.bottom);
    return {
      left: Math.min(tl.x, br.x),
      top: Math.min(tl.y, br.y),
      right: Math.max(tl.x, br.x),
      bottom: Math.max(tl.y, br.y),
    };
  }

  function closeAssetConfigMenu() {
    if (!assetConfigMenu || !assetConfigBtn) return;
    assetConfigMenu.classList.add('hidden');
    assetConfigBtn.setAttribute('aria-expanded', 'false');
  }

  function closeAssetStateTermMenu() {
    if (!assetStateTermMenu) return;
    assetStateTermMenu.classList.add('hidden');
    assetStateTermMenu.innerHTML = '';
    assetStateMenuIndex = null;
  }

  function clearAssetStateClickTimer() {
    if (assetStateClickTimer) {
      clearTimeout(assetStateClickTimer);
      assetStateClickTimer = null;
    }
  }

  function openAssetStateTermMenu(comp, stateIndex, anchorEl) {
    if (!assetStateTermMenu || !comp) return;
    const template = GuitarAssets.getTemplate(comp.dataset.assetId);
    if (!template) return;
    const states = GuitarAssets.getEffectiveStates(comp);
    const state = states[stateIndex];
    if (!state) return;

    assetStateMenuIndex = stateIndex;
    assetStateTermMenu.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'asset-state-term-header';
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'asset-state-term-remove';
    removeBtn.textContent = '−';
    removeBtn.title = 'Delete state';
    removeBtn.setAttribute('aria-label', `Delete state ${stateIndex + 1}`);
    removeBtn.disabled = states.length <= 1;
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (states.length <= 1) return;
      GuitarAssets.removeInstanceState(comp, stateIndex);
      closeAssetStateTermMenu();
      markProjectDirty();
      updateSelectionStatus();
      updateAssetConfigChrome();
      setStatus(`${comp.dataset.type}: deleted state ${stateIndex + 1}`);
    });

    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'asset-state-term-rename';
    renameBtn.title = 'Secondary state label';
    renameBtn.setAttribute('aria-label', 'Edit secondary state label');
    renameBtn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'd="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' +
      '</svg>';

    header.appendChild(removeBtn);
    header.appendChild(renameBtn);
    assetStateTermMenu.appendChild(header);

    const secondaryRow = document.createElement('div');
    secondaryRow.className = 'asset-state-secondary-row';
    const secondaryInput = document.createElement('input');
    secondaryInput.type = 'text';
    secondaryInput.className = 'asset-state-secondary-input';
    secondaryInput.maxLength = 24;
    secondaryInput.placeholder = 'Secondary label…';
    secondaryInput.value = String(state.secondaryLabel || '');
    secondaryInput.spellcheck = false;
    secondaryInput.autocomplete = 'off';
    const secondaryHint = document.createElement('div');
    secondaryHint.className = 'asset-state-secondary-hint';
    secondaryHint.textContent = 'Shown above primary name on the asset';
    secondaryRow.appendChild(secondaryInput);
    secondaryRow.appendChild(secondaryHint);
    assetStateTermMenu.appendChild(secondaryRow);

    const commitSecondary = () => {
      GuitarAssets.setInstanceStateSecondaryLabel(comp, stateIndex, secondaryInput.value);
      markProjectDirty();
      updateSelectionStatus();
      updateAssetConfigChrome();
    };

    renameBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = !secondaryRow.classList.contains('is-open');
      secondaryRow.classList.toggle('is-open', open);
      renameBtn.classList.toggle('is-active', open);
      if (open) {
        secondaryInput.focus();
        secondaryInput.select();
      } else {
        commitSecondary();
      }
    });
    secondaryInput.addEventListener('mousedown', (e) => e.stopPropagation());
    secondaryInput.addEventListener('click', (e) => e.stopPropagation());
    secondaryInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        commitSecondary();
        secondaryRow.classList.remove('is-open');
        renameBtn.classList.remove('is-active');
        secondaryInput.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        secondaryInput.value = String(
          GuitarAssets.getEffectiveStates(comp)[stateIndex]?.secondaryLabel || ''
        );
        secondaryRow.classList.remove('is-open');
        renameBtn.classList.remove('is-active');
        secondaryInput.blur();
      }
    });
    secondaryInput.addEventListener('change', commitSecondary);
    secondaryInput.addEventListener('blur', commitSecondary);

    (template.terminals || []).forEach((spec, termIndex) => {
      const label = document.createElement('label');
      label.className = 'asset-state-term-row';
      const name = document.createElement('span');
      name.className = 'asset-state-term-label';
      name.textContent = spec.menuLabel || spec.tipLabel || spec.label || `T${termIndex + 1}`;
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.className = 'asset-state-term-toggle';
      toggle.checked = !!state.terminalActive?.[termIndex];
      if (spec.isGround) {
        toggle.disabled = true;
        toggle.checked = false;
      }
      toggle.addEventListener('change', () => {
        GuitarAssets.setInstanceTerminalActive(comp, stateIndex, termIndex, toggle.checked);
        markProjectDirty();
        updateSelectionStatus();
      });
      label.appendChild(name);
      label.appendChild(toggle);
      assetStateTermMenu.appendChild(label);
    });

    const chromeRect = assetStateChrome?.getBoundingClientRect();
    const anchorRect = anchorEl?.getBoundingClientRect();
    const bounds = getComponentChromeBounds(comp);
    const btnSize = ASSET_CONFIG_BTN_SIZE;
    const gap = 4;
    const baseLeft = bounds.right + gap + btnSize + 4;
    let top = bounds.top + btnSize + gap;
    if (chromeRect && anchorRect) {
      const worldAnchor = clientToWorld(anchorRect.left, anchorRect.top);
      top = worldAnchor.y;
    }
    assetStateTermMenu.style.left = `${baseLeft}px`;
    assetStateTermMenu.style.top = `${Math.max(0, top)}px`;
    assetStateTermMenu.classList.remove('hidden');
  }

  function rebuildAssetStateNumbers(comp) {
    if (!assetStateNumbers || !comp) return;
    const states = GuitarAssets.getEffectiveStates(comp);
    const activeIdx = GuitarAssets.getComponentStateIndex(comp);
    assetStateNumbers.innerHTML = '';
    states.forEach((_, i) => {
      const num = document.createElement('button');
      num.type = 'button';
      num.className = `asset-state-num${i === activeIdx ? ' is-active' : ''}`;
      num.textContent = String(i + 1);
      num.dataset.stateIndex = String(i);
      num.setAttribute('role', 'listitem');
      num.setAttribute('aria-label', `State ${i + 1}`);
      num.setAttribute('aria-pressed', i === activeIdx ? 'true' : 'false');

      num.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
      num.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearAssetStateClickTimer();
        assetStateClickTimer = setTimeout(() => {
          assetStateClickTimer = null;
          const selected = getSingleSelectedComponent();
          if (selected !== comp) return;
          openAssetStateTermMenu(comp, i, num);
        }, 250);
      });
      num.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearAssetStateClickTimer();
        closeAssetStateTermMenu();
        GuitarAssets.setComponentStateIndex(comp, i);
        markProjectDirty();
        updateSelectionStatus();
        updateAssetConfigChrome();
      });
      assetStateNumbers.appendChild(num);
    });
  }

  function updateAssetStateChrome() {
    if (!assetStateChrome) return;
    const comp = getSingleSelectedComponent();
    if (!comp || selectedWireGroups.size > 0) {
      assetStateChrome.classList.add('hidden');
      closeAssetStateTermMenu();
      clearAssetStateClickTimer();
      return;
    }

    const bounds = getComponentChromeBounds(comp);
    const btnSize = ASSET_CONFIG_BTN_SIZE;
    const gap = 4;
    const cogCenterX = bounds.right + gap + btnSize / 2 + ASSET_CONFIG_BTN_NUDGE_X;
    const top = bounds.top + btnSize + 1;

    rebuildAssetStateNumbers(comp);
    assetStateChrome.style.left = `${cogCenterX}px`;
    assetStateChrome.style.top = `${top}px`;
    assetStateChrome.classList.remove('hidden');

    if (assetStateTermMenu && !assetStateTermMenu.classList.contains('hidden') && assetStateMenuIndex != null) {
      const anchor = assetStateNumbers?.querySelector(`[data-state-index="${assetStateMenuIndex}"]`);
      if (anchor) openAssetStateTermMenu(comp, assetStateMenuIndex, anchor);
      else closeAssetStateTermMenu();
    }
  }

  function isToggleSwitchComponent(comp) {
    const id = comp?.dataset?.assetId;
    return id === 'dpdt' || id === 'dpdt-on-off-on' || id === 'dpdt-on-on';
  }

  function getToggleSwitchThrow(comp) {
    const template = GuitarAssets.getTemplate(comp?.dataset?.assetId);
    if (template?.switchThrow) return template.switchThrow;
    const id = comp?.dataset?.assetId;
    if (id === 'dpdt-on-off-on') return 'on-off-on';
    if (id === 'dpdt-on-on') return 'on-on';
    return 'on-on-on';
  }

  function getToggleSwitchThrowLabel(throwKind) {
    if (throwKind === 'on-off-on') return 'ON-OFF-ON';
    if (throwKind === 'on-on') return 'ON-ON';
    return 'ON-ON-ON';
  }

  function isOnOnOnToggle(comp) {
    return isToggleSwitchComponent(comp) && getToggleSwitchThrow(comp) === 'on-on-on';
  }

  function isOnOffOnToggle(comp) {
    return isToggleSwitchComponent(comp) && getToggleSwitchThrow(comp) === 'on-off-on';
  }

  function isOnOnToggle(comp) {
    return isToggleSwitchComponent(comp) && getToggleSwitchThrow(comp) === 'on-on';
  }

  /** ON-ON-ON middle: A closes all six poles via commons; B is Type-2 mirror.
   *  applyComponentStateVisuals syncs terminalActive from bridges after Type wiring. */
  const TOGGLE_BRIDGES_A = [[2, 0], [2, 4], [3, 1], [3, 5]];
  const TOGGLE_BRIDGES_B = [[2, 1], [2, 5], [3, 0], [3, 4]];

  /** Type 1 middle bridges A — Type 2 mirrored B (actives derived from bridges on apply) */
  const TOGGLE_MIDDLE_BRIDGES = {
    1: TOGGLE_BRIDGES_A,
    2: TOGGLE_BRIDGES_B,
  };

  /** Adjacent throws (commons T3/T4): Up = T3–T6, Down = T1–T4 — shared by ON-OFF-ON + ON-ON */
  const TOGGLE_ON_OFF_ON_ACTIVE_UP = [false, false, true, true, true, true];
  const TOGGLE_ON_OFF_ON_ACTIVE_DOWN = [true, true, true, true, false, false];
  const TOGGLE_ON_OFF_ON_BRIDGES_UP = [[2, 4], [3, 5]]; // T3–T5, T4–T6
  const TOGGLE_ON_OFF_ON_BRIDGES_DOWN = [[0, 2], [1, 3]]; // T1–T3, T2–T4

  /** Adjacent ends: Type 1 Up=3,4,5,6 Down=1,2,3,4 — Type 2 swaps Up/Down */
  const TOGGLE_ON_OFF_ON_ENDS = {
    1: {
      up: TOGGLE_ON_OFF_ON_ACTIVE_UP,
      down: TOGGLE_ON_OFF_ON_ACTIVE_DOWN,
      upBridges: TOGGLE_ON_OFF_ON_BRIDGES_UP,
      downBridges: TOGGLE_ON_OFF_ON_BRIDGES_DOWN,
    },
    2: {
      up: TOGGLE_ON_OFF_ON_ACTIVE_DOWN,
      down: TOGGLE_ON_OFF_ON_ACTIVE_UP,
      upBridges: TOGGLE_ON_OFF_ON_BRIDGES_DOWN,
      downBridges: TOGGLE_ON_OFF_ON_BRIDGES_UP,
    },
  };

  function getToggleSwitchType(el) {
    return el?.dataset?.switchType === '2' ? 2 : 1;
  }

  function refreshToggleSwitchVisuals(el) {
    const template = GuitarAssets.getTemplate(el.dataset.assetId);
    const idx = GuitarAssets.getComponentStateIndex(el);
    if (template) GuitarAssets.applyComponentStateVisuals(el, template, idx);
    refreshLightningWireGlow();
    refreshShortCircuitCheck();
    refreshGroundCheckAlert();
  }

  function applyToggleSwitchMiddleActive(el, type) {
    if (!isOnOnOnToggle(el)) return;
    const states = GuitarAssets.ensureInstanceStates(el);
    const middle = states.find((s) => Number(s.id) === 2) || states[1];
    if (!middle) return;
    const typeKey = type === 2 ? 2 : 1;
    const bridges = TOGGLE_MIDDLE_BRIDGES[typeKey];
    middle.bridges = bridges.map((pair) => [...pair]);
    // Seed actives from closed contacts (all bridge poles); visuals re-sync on apply
    if (middle.terminalActive) {
      const n = middle.terminalActive.length;
      middle.terminalActive = Array.from({ length: n }, (_, i) =>
        bridges.some((pair) => pair[0] === i || pair[1] === i)
      );
    }
    refreshToggleSwitchVisuals(el);
  }

  function applyAdjacentThrowEnds(el, type, { upId, downId, clearMiddle }) {
    const states = GuitarAssets.ensureInstanceStates(el);
    const ends = TOGGLE_ON_OFF_ON_ENDS[type === 2 ? 2 : 1];
    const up = states.find((s) => Number(s.id) === upId) || states[0];
    const down = states.find((s) => Number(s.id) === downId)
      || states[clearMiddle ? 2 : 1];
    if (up?.terminalActive) {
      ends.up.forEach((on, i) => {
        if (i < up.terminalActive.length) up.terminalActive[i] = on;
      });
      up.bridges = ends.upBridges.map((pair) => [...pair]);
    }
    if (down?.terminalActive) {
      ends.down.forEach((on, i) => {
        if (i < down.terminalActive.length) down.terminalActive[i] = on;
      });
      down.bridges = ends.downBridges.map((pair) => [...pair]);
    }
    if (clearMiddle) {
      const middle = states.find((s) => Number(s.id) === 2) || states[1];
      if (middle?.terminalActive) {
        middle.terminalActive = middle.terminalActive.map(() => false);
        middle.bridges = [];
      }
    }
    refreshToggleSwitchVisuals(el);
  }

  function applyToggleSwitchOnOffOnEnds(el, type) {
    if (!isOnOffOnToggle(el)) return;
    applyAdjacentThrowEnds(el, type, { upId: 1, downId: 3, clearMiddle: true });
  }

  function applyToggleSwitchOnOnEnds(el, type) {
    if (!isOnOnToggle(el)) return;
    applyAdjacentThrowEnds(el, type, { upId: 1, downId: 2, clearMiddle: false });
  }

  function applyToggleSwitchTypeWiring(el, type) {
    if (isOnOnOnToggle(el)) applyToggleSwitchMiddleActive(el, type);
    else if (isOnOffOnToggle(el)) applyToggleSwitchOnOffOnEnds(el, type);
    else if (isOnOnToggle(el)) applyToggleSwitchOnOnEnds(el, type);
  }

  function setToggleSwitchType(el, type) {
    if (!el || !isToggleSwitchComponent(el)) return;
    const next = type === 2 ? 2 : 1;
    el.dataset.switchType = String(next);
    applyToggleSwitchTypeWiring(el, next);
    notifySchematicCircuitChanged();
  }

  function setComponentGroundTag(el, needsGrounding) {
    if (!el) return;
    const tag = needsGrounding ? 'YESGROUND' : 'NOGROUND';
    el.dataset.groundTag = tag;
    let marker = el.querySelector('.asset-ground-tag');
    if (!marker) {
      marker = document.createElement('span');
      marker.className = 'asset-ground-tag';
      marker.setAttribute('aria-hidden', 'true');
      el.appendChild(marker);
    }
    marker.hidden = true;
    marker.dataset.tag = tag;
    marker.textContent = tag;
    validateYesGroundConnections();
  }

  function componentNeedsGrounding(el) {
    return el?.dataset?.groundTag === 'YESGROUND';
  }

  /** True only for sleeve/G on an output jack — not HB tip ISGROUND. */
  function isOutputJackGroundTerminal(term) {
    if (!term) return false;
    const host = term.closest?.('.component');
    if (!isOutputJackComponent(host)) return false;
    return term.dataset.tag === 'ISGROUND' || getTerminalRole(term) === 'G';
  }

  function collectOutputJackGroundTerminals() {
    const grounds = new Set();
    components.forEach((comp) => {
      if (!isOutputJackComponent(comp)) return;
      comp.querySelectorAll('.terminal').forEach((term) => {
        if (isOutputJackGroundTerminal(term)) grounds.add(term);
      });
    });
    return grounds;
  }

  /** YESGROUND asset reaches ground iff any terminal shares a net with output jack G. */
  function componentReachesOutputGround(comp) {
    if (!comp) return false;
    const groundSources = collectOutputJackGroundTerminals();
    if (!groundSources.size) return false;
    const myTerms = new Set(comp.querySelectorAll('.terminal'));
    if (!myTerms.size) return false;
    for (const net of buildWireNets()) {
      let touchesComp = false;
      let touchesGround = false;
      for (const t of net) {
        if (myTerms.has(t)) touchesComp = true;
        if (groundSources.has(t)) touchesGround = true;
        if (touchesComp && touchesGround) return true;
      }
    }
    return false;
  }

  function validateYesGroundConnections() {
    const ungrounded = [];
    components.forEach((comp) => {
      const needs = componentNeedsGrounding(comp);
      const ok = !needs || componentReachesOutputGround(comp);
      comp.classList.remove('ungrounded-warning');
      if (needs && !ok) ungrounded.push(comp);
    });
    refreshGroundCheckAlert();
    return ungrounded;
  }

  function reportGroundingStatus(prefix) {
    const ungrounded = validateYesGroundConnections();
    if (ungrounded.length === 0) {
      if (prefix) setStatus(prefix);
      return true;
    }
    const names = ungrounded
      .map((c) => c.dataset.type || 'asset')
      .slice(0, 3)
      .join(', ');
    const extra = ungrounded.length > 3 ? ` +${ungrounded.length - 3}` : '';
    setStatus(
      `Grounding required: ${ungrounded.length} YESGROUND asset(s) not linked to output jack G (${names}${extra})`
    );
    return false;
  }

  function isOutputJackComponent(comp) {
    if (!comp) return false;
    if (comp.dataset.assetId === 'mono-output' || comp.dataset.assetId === 'stereo-output') return true;
    const template = GuitarAssets.getTemplate(comp.dataset.assetId);
    return !!template?.isOutputJack || template?.category === 'jack';
  }

  function isJackComponent(comp) {
    return isOutputJackComponent(comp);
  }

  /** Ensure jack G terminals always carry ISGROUND. */
  function ensureJackGroundTerminals(el) {
    if (!isJackComponent(el)) return;
    el.querySelectorAll('.terminal').forEach((term) => {
      const role = term.dataset.role || term.dataset.terminalLabel || term.textContent?.trim();
      const isG = role === 'G'
        || term.classList.contains('ground')
        || term.classList.contains('is-ground')
        || term.dataset.tag === 'ISGROUND';
      if (!isG) return;
      term.dataset.isGround = 'true';
      term.dataset.tag = 'ISGROUND';
      term.dataset.role = 'G';
      term.classList.add('is-ground', 'ground');
      if (!term.querySelector('.terminal-ground-tag')) {
        const tag = document.createElement('span');
        tag.className = 'terminal-ground-tag';
        tag.hidden = true;
        tag.setAttribute('aria-hidden', 'true');
        tag.dataset.tag = 'ISGROUND';
        tag.textContent = 'ISGROUND';
        term.appendChild(tag);
      }
    });
    // Jacks are ground sources — never YESGROUND
    if (el.dataset.groundTag === 'YESGROUND') {
      setComponentGroundTag(el, false);
    }
  }

  function isPickupComponent(comp) {
    if (!comp) return false;
    const template = GuitarAssets.getTemplate(comp.dataset.assetId);
    return template?.category === 'pickup';
  }

  function isPotentiometerComponent(comp) {
    if (!comp) return false;
    const template = GuitarAssets.getTemplate(comp.dataset.assetId);
    if (!template) return false;
    return template.subtype === 'potentiometer' || template.id === 'potentiometer';
  }

  function isCapacitorComponent(comp) {
    if (!comp) return false;
    const template = GuitarAssets.getTemplate(comp.dataset.assetId);
    if (!template) return false;
    return template.subtype === 'capacitor' || template.id === 'capacitor';
  }

  function isDualCoilComponent(comp) {
    if (!comp) return false;
    if (comp.classList.contains('dualcoil')) return true;
    if (comp.querySelectorAll('.terminal.hb-tip').length >= 5) return true;
    if (comp.dataset.hasLoom === 'true' && comp.querySelector('.terminal.hb-tip')) return true;
    const template = GuitarAssets.getTemplate(comp.dataset.assetId);
    if (!template) return false;
    const cls = String(template.cssClass || '');
    return (
      template.subtype === 'dualcoil'
      || template.subtype === '4conductor'
      || template.id === 'dualcoil'
      || template.id === '4conductor'
      || !!template.hasLoom
      || cls.split(/\s+/).includes('dualcoil')
      || (template.terminals || []).some((t) => String(t.className || '').includes('hb-tip'))
    );
  }

  function applyHbLeadData(el, data) {
    if (!el || !data) return;
    if (data.hbJunctionLeft != null && data.hbJunctionLeft !== '') {
      el.dataset.hbJunctionLeft = String(data.hbJunctionLeft);
    }
    if (data.hbJunctionTop != null && data.hbJunctionTop !== '') {
      el.dataset.hbJunctionTop = String(data.hbJunctionTop);
    }
    if (data.hbLoomSlack != null && data.hbLoomSlack !== '') {
      el.dataset.hbLoomSlack = String(data.hbLoomSlack);
    }
    if (data.hbWireLayer != null && data.hbWireLayer !== '') {
      el.dataset.hbWireLayer = String(data.hbWireLayer);
    }
    for (let i = 0; i < HB_FAN_COUNT; i++) {
      const left = data[`hbTip${i}Left`];
      const top = data[`hbTip${i}Top`];
      if (left != null && left !== '') el.dataset[`hbTip${i}Left`] = String(left);
      if (top != null && top !== '') el.dataset[`hbTip${i}Top`] = String(top);
      const attachComp = data[`hbTip${i}AttachComp`];
      const attachTerm = data[`hbTip${i}AttachTerm`];
      if (attachComp) el.dataset[`hbTip${i}AttachComp`] = String(attachComp);
      if (attachTerm != null && attachTerm !== '') {
        el.dataset[`hbTip${i}AttachTerm`] = String(attachTerm);
      }
      const fanSlack = data[`hbFanSlack${i}`];
      if (fanSlack != null && fanSlack !== '') {
        el.dataset[`hbFanSlack${i}`] = String(fanSlack);
      }
      if (data[`hbFanSlackUser${i}`] === '1' || data[`hbFanSlackUser${i}`] === true) {
        el.dataset[`hbFanSlackUser${i}`] = '1';
      }
    }
  }

  function normalizeImpedanceValue(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return '';
    const cleaned = text.replace(/[,\s]/g, '').replace(/[ΩΩohm]+$/i, '');
    const match = /^([+-]?\d*\.?\d+)\s*([kKmM])?$/.exec(cleaned);
    if (!match) return text;
    let n = parseFloat(match[1]);
    if (!Number.isFinite(n)) return text;
    const suffix = (match[2] || '').toLowerCase();
    if (suffix === 'k') n *= 1000;
    else if (suffix === 'm') n *= 1e6;
    if (Number.isInteger(n)) return String(n);
    return String(Math.round(n * 1000) / 1000);
  }

  function getTemplateValueFieldDefs(compOrTemplate) {
    const template = compOrTemplate?.dataset?.assetId
      ? GuitarAssets.getTemplate(compOrTemplate.dataset.assetId)
      : compOrTemplate;
    return GuitarAssets.resolveValueFieldDefs(template);
  }

  function getComponentElectricalValue(el, key) {
    const def = GuitarAssets.ELECTRICAL_VALUE_DEFS?.[key];
    if (!el || !def) return '';
    return (el.dataset[def.dataset] || '').trim();
  }

  function setComponentElectricalValue(el, key, value, { notify = true } = {}) {
    const def = GuitarAssets.ELECTRICAL_VALUE_DEFS?.[key];
    if (!el || !def) return;
    let next = String(value ?? '').trim();
    if (key === 'impedance') next = normalizeImpedanceValue(value);
    if (next) el.dataset[def.dataset] = next;
    else delete el.dataset[def.dataset];
    if (key === 'capacitance') updateCapacitorValueLabel(el);
    if (notify) notifySchematicCircuitChanged();
  }

  function collectComponentElectricalValues(el) {
    const out = {};
    Object.values(GuitarAssets.ELECTRICAL_VALUE_DEFS || {}).forEach((def) => {
      const raw = (el?.dataset?.[def.dataset] || '').trim();
      if (raw) out[def.key] = raw;
    });
    return out;
  }

  function mergeElectricalValueRecord(compData) {
    if (!compData) return {};
    const out = { ...(compData.electricalValues || {}) };
    Object.keys(GuitarAssets.ELECTRICAL_VALUE_DEFS || {}).forEach((key) => {
      if (compData[key]) out[key] = compData[key];
    });
    return out;
  }

  function applyComponentElectricalValues(el, values, { notify = false } = {}) {
    if (!el || !values) return;
    Object.keys(GuitarAssets.ELECTRICAL_VALUE_DEFS || {}).forEach((key) => {
      if (values[key] != null && values[key] !== '') {
        setComponentElectricalValue(el, key, values[key], { notify: false });
      }
    });
    if (notify) notifySchematicCircuitChanged();
  }

  function formatElectricalValueForSchematic(def, raw) {
    let text = String(raw || '').trim();
    if (!text || !def) return '';
    if (def.key === 'capacitance') {
      text = formatCapacitanceParts(text).num || text;
    }
    const hasUnit = /[a-zA-ZµμΩ]/.test(text);
    const valuePart = hasUnit ? text : `${text}${def.unit}`;
    return `${def.symbol} ${valuePart}`;
  }

  function getComponentSchematicValueLabels(el) {
    return getTemplateValueFieldDefs(el)
      .map((def) => formatElectricalValueForSchematic(def, getComponentElectricalValue(el, def.key)))
      .filter(Boolean);
  }

  function getComponentImpedance(el) {
    return getComponentElectricalValue(el, 'impedance');
  }

  function setComponentImpedance(el, value) {
    setComponentElectricalValue(el, 'impedance', value);
  }

  function getComponentResistance(el) {
    return getComponentElectricalValue(el, 'resistance');
  }

  function setComponentResistance(el, value) {
    setComponentElectricalValue(el, 'resistance', value);
  }

  function getComponentCapacitance(el) {
    return getComponentElectricalValue(el, 'capacitance');
  }

  function setComponentCapacitance(el, value) {
    setComponentElectricalValue(el, 'capacitance', value);
  }

  function formatCapacitanceParts(raw) {
    const text = String(raw || '').trim();
    if (!text) return { num: '', unit: 'µF' };
    const cleaned = text.replace(/\s*(µf|uf|μf)\s*/gi, '').trim();
    return { num: cleaned || text, unit: 'µF' };
  }

  function updateCapacitorValueLabel(el) {
    if (!isCapacitorComponent(el)) return;
    const body = el.querySelector('.placeholder');
    if (!body) return;
    let label = body.querySelector('.cap-value');
    if (!label) {
      label = document.createElement('span');
      label.className = 'cap-value';
      body.textContent = '';
      body.appendChild(label);
    }
    const { num, unit } = formatCapacitanceParts(getComponentCapacitance(el));
    label.innerHTML = '';
    const numEl = document.createElement('span');
    numEl.className = 'cap-value-num';
    numEl.textContent = num || '—';
    const unitEl = document.createElement('span');
    unitEl.className = 'cap-value-unit';
    unitEl.textContent = unit;
    label.appendChild(numEl);
    label.appendChild(unitEl);
    label.title = num ? `${num}${unit}` : 'Set capacitance in config';
  }

  const CAP_LEAD_SLACK_MAX = 48;
  const CAP_LEAD_SIDES = ['top', 'bottom'];
  /** Screen-px radius to dock a capacitor lead tip onto another terminal. */
  const CAP_TIP_ATTACH_SCREEN_PX = 16;

  function getCapLeadSlack(el, which) {
    const map = {
      top: ['capLeadSlackTop', 'capLeadSlackLeft'],
      bottom: ['capLeadSlackBottom', 'capLeadSlackRight'],
    };
    const keys = map[which] || [which];
    for (const key of keys) {
      const n = parseFloat(el.dataset[key]);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  }

  function setCapLeadSlack(el, which, value) {
    const clamped = Math.max(-CAP_LEAD_SLACK_MAX, Math.min(CAP_LEAD_SLACK_MAX, value));
    const key = which === 'top' ? 'capLeadSlackTop' : 'capLeadSlackBottom';
    delete el.dataset.capLeadSlackLeft;
    delete el.dataset.capLeadSlackRight;
    if (Math.abs(clamped) < 0.5) delete el.dataset[key];
    else el.dataset[key] = String(Math.round(clamped * 10) / 10);
  }

  function clientToCapacitorLocal(el, clientX, clientY) {
    const svg = el.querySelector('.cap-leads-svg');
    if (svg) {
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const local = pt.matrixTransform(ctm.inverse());
        return { x: local.x, y: local.y };
      }
    }
    const rect = el.getBoundingClientRect();
    const sx = el.offsetWidth / (rect.width || 1);
    const sy = el.offsetHeight / (rect.height || 1);
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }

  function getCapacitorLeadEndpoints(el, which) {
    const body = el.querySelector('.placeholder');
    const terms = [...el.querySelectorAll('.terminal.cap-term')];
    if (!body || !terms.length) return null;
    const bl = parseFloat(body.style.left) || 0;
    const bt = parseFloat(body.style.top) || 0;
    const bw = body.offsetWidth || parseFloat(body.style.width) || 20;
    const bh = body.offsetHeight || parseFloat(body.style.height) || 30;
    const cx = bl + bw / 2;
    const tip = which === 'top' ? terms[0] : (terms[1] || terms[0]);
    if (which === 'bottom' && terms.length < 2) return null;
    const tipW = tip.offsetWidth || 10;
    const tipH = tip.offsetHeight || 10;
    const tipCx = (parseFloat(tip.style.left) || 0) + tipW / 2;
    const tipCy = (parseFloat(tip.style.top) || 0) + tipH / 2;
    if (which === 'top') {
      return { x1: cx, y1: bt, x2: tipCx, y2: tipCy };
    }
    return { x1: cx, y1: bt + bh, x2: tipCx, y2: tipCy };
  }

  function updateCapacitorLeadPaths(el) {
    if (!isCapacitorComponent(el)) return;
    const svg = el.querySelector('.cap-leads-svg');
    if (!svg) return;
    CAP_LEAD_SIDES.forEach((which) => {
      const ends = getCapacitorLeadEndpoints(el, which);
      if (!ends) return;
      let slack = getCapLeadSlack(el, which);
      if (Math.abs(slack) < 0.5) {
        const len = Math.hypot(ends.x2 - ends.x1, ends.y2 - ends.y1) || 1;
        const side = which === 'top' ? 1 : -1;
        slack = side * Math.min(18, Math.max(8, len * 0.25));
      }
      const d = buildWirePath(ends.x1, ends.y1, ends.x2, ends.y2, slack);
      const g = svg.querySelector(`[data-cap-lead="${which}"]`);
      g?.querySelector('.cap-lead-hit')?.setAttribute('d', d);
      g?.querySelector('.cap-lead')?.setAttribute('d', d);
    });
  }

  function persistCapTipPositions(el) {
    const terms = [...el.querySelectorAll('.terminal.cap-term')];
    terms.forEach((tip, idx) => {
      el.dataset[`capTip${idx}Left`] = String(parseFloat(tip.style.left) || 0);
      el.dataset[`capTip${idx}Top`] = String(parseFloat(tip.style.top) || 0);
    });
  }

  function restoreCapTipPositions(el) {
    const terms = [...el.querySelectorAll('.terminal.cap-term')];
    terms.forEach((tip, idx) => {
      const left = el.dataset[`capTip${idx}Left`];
      const top = el.dataset[`capTip${idx}Top`];
      if (left != null && left !== '') tip.style.left = `${parseFloat(left)}px`;
      if (top != null && top !== '') tip.style.top = `${parseFloat(top)}px`;
    });
  }

  function clearCapLeadAttachHighlights() {
    document.querySelectorAll('.terminal.cap-lead-attach-target').forEach((t) => {
      t.classList.remove('cap-lead-attach-target');
    });
  }

  function getCapTipAttachedTerminal(el, tipIdx) {
    const compId = el?.dataset?.[`capTip${tipIdx}AttachComp`];
    const termIdx = el?.dataset?.[`capTip${tipIdx}AttachTerm`];
    if (!compId || termIdx == null || termIdx === '') return null;
    const comp = components.get(compId);
    if (!comp || !document.body.contains(comp)) return null;
    const term = comp.querySelector(`.terminal[data-terminal-index="${termIdx}"]`);
    if (!term || !document.body.contains(term)) return null;
    return term;
  }

  function setCapTipAttachment(el, tipIdx, terminal) {
    if (!el) return;
    if (!terminal) {
      delete el.dataset[`capTip${tipIdx}AttachComp`];
      delete el.dataset[`capTip${tipIdx}AttachTerm`];
      const tip = el.querySelectorAll('.terminal.cap-term')[tipIdx];
      tip?.classList.remove('is-attached');
      return;
    }
    const host = terminal.closest('.component');
    if (!host?.dataset?.id) return;
    el.dataset[`capTip${tipIdx}AttachComp`] = host.dataset.id;
    el.dataset[`capTip${tipIdx}AttachTerm`] = String(terminal.dataset.terminalIndex ?? '');
    const tip = el.querySelectorAll('.terminal.cap-term')[tipIdx];
    tip?.classList.add('is-attached');
  }

  function findCapTipAttachTarget(excludeComp, clientX, clientY) {
    const excludePage = getComponentWorkspacePage(excludeComp);
    let best = null;
    let bestDist = CAP_TIP_ATTACH_SCREEN_PX;
    components.forEach((comp) => {
      if (comp === excludeComp) return;
      if (getComponentWorkspacePage(comp) !== excludePage) return;
      comp.querySelectorAll('.terminal').forEach((term) => {
        const c = getTerminalCenter(term);
        const d = Math.hypot(c.x - clientX, c.y - clientY);
        if (d <= bestDist) {
          bestDist = d;
          best = term;
        }
      });
    });
    return best;
  }

  function placeCapTipAtClientPoint(el, tip, clientX, clientY) {
    const tipW = tip.offsetWidth || 10;
    const tipH = tip.offsetHeight || 10;
    const local = clientToCapacitorLocal(el, clientX, clientY);
    tip.style.left = `${local.x - tipW / 2}px`;
    tip.style.top = `${local.y - tipH / 2}px`;
  }

  function syncCapacitorTipAttachments(el) {
    if (!isCapacitorComponent(el)) return;
    const tips = [...el.querySelectorAll('.terminal.cap-term')];
    tips.forEach((tip, idx) => {
      const target = getCapTipAttachedTerminal(el, idx);
      if (!target) {
        if (el.dataset[`capTip${idx}AttachComp`]) setCapTipAttachment(el, idx, null);
        tip.classList.remove('is-attached');
        return;
      }
      const center = getTerminalCenter(target);
      placeCapTipAtClientPoint(el, tip, center.x, center.y);
      tip.classList.add('is-attached');
    });
    updateCapacitorLeadPaths(el);
    persistCapTipPositions(el);
  }

  function syncAllCapacitorTipAttachments() {
    components.forEach((comp) => {
      if (isCapacitorComponent(comp)) syncCapacitorTipAttachments(comp);
    });
  }

  function eachCapTipAttachmentPair(fn) {
    components.forEach((comp) => {
      if (!isCapacitorComponent(comp)) return;
      const tips = [...comp.querySelectorAll('.terminal.cap-term')];
      tips.forEach((tip, idx) => {
        const target = getCapTipAttachedTerminal(comp, idx);
        if (tip && target) fn(tip, target);
      });
    });
  }

  function setupCapacitorTipDrag(el) {
    if (el.dataset.capTipBound === 'true') return;
    el.dataset.capTipBound = 'true';
    const terms = [...el.querySelectorAll('.terminal.cap-term')];
    terms.forEach((tip, idx) => {
      const which = idx === 0 ? 'top' : 'bottom';
      if (getCapTipAttachedTerminal(el, idx)) tip.classList.add('is-attached');
      tip.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (wireMode) return; // wire connect via click
        if (wireEditFocusMode) return;
        e.preventDefault();
        e.stopPropagation();
        selectComponent(el);
        tip.classList.add('is-dragging');
        setCapTipAttachment(el, idx, null);
        let hoverTarget = null;

        function onMove(ev) {
          clearCapLeadAttachHighlights();
          hoverTarget = findCapTipAttachTarget(el, ev.clientX, ev.clientY);
          if (hoverTarget) {
            hoverTarget.classList.add('cap-lead-attach-target');
            const center = getTerminalCenter(hoverTarget);
            placeCapTipAtClientPoint(el, tip, center.x, center.y);
            showSnapIndicator(center.x, center.y);
            const label = hoverTarget.dataset.terminalLabel || 'terminal';
            setStatus(`Attach ${which} lead to ${label}`);
          } else {
            placeCapTipAtClientPoint(el, tip, ev.clientX, ev.clientY);
            snapIndicator.classList.add('hidden');
            const ends = getCapacitorLeadEndpoints(el, which);
            if (ends) {
              const len = Math.hypot(ends.x2 - ends.x1, ends.y2 - ends.y1) || 1;
              const bow = Math.max(8, Math.min(CAP_LEAD_SLACK_MAX, len * 0.28));
              const side = which === 'top' ? 1 : -1;
              const lateral = ends.x2 - ends.x1;
              setCapLeadSlack(el, which, side * bow + lateral * 0.25);
            }
            setStatus(`Dragging capacitor ${which} lead end`);
          }
          updateCapacitorLeadPaths(el);
          updateAllWirePositions();
        }
        function onUp() {
          tip.classList.remove('is-dragging');
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          clearCapLeadAttachHighlights();
          snapIndicator.classList.add('hidden');
          if (hoverTarget && document.body.contains(hoverTarget)) {
            setCapTipAttachment(el, idx, hoverTarget);
            syncCapacitorTipAttachments(el);
            refreshShortCircuitCheck();
            validateYesGroundConnections();
            const label = hoverTarget.dataset.terminalLabel || 'terminal';
            setStatus(`Capacitor ${which} lead attached to ${label}`);
          } else {
            setCapTipAttachment(el, idx, null);
            persistCapTipPositions(el);
            setStatus('Capacitor lead end placed');
          }
          markProjectDirty();
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }

  function setupCapacitorLeadDrag(el, svg) {
    if (svg.dataset.capLeadBound === 'true') return;
    svg.dataset.capLeadBound = 'true';
    svg.querySelectorAll('[data-cap-lead]').forEach((g) => {
      const which = g.dataset.capLead;
      const hit = g.querySelector('.cap-lead-hit');
      const vis = g.querySelector('.cap-lead');
      if (!hit || !vis) return;

      hit.addEventListener('click', (e) => {
        if (!wireMode) return;
        e.preventDefault();
        e.stopPropagation();
        const terms = [...el.querySelectorAll('.terminal')];
        const tip = which === 'top' ? terms[0] : terms[1];
        tip?.click();
      });

      hit.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (wireMode) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (wireEditFocusMode) return;
        e.preventDefault();
        e.stopPropagation();
        selectComponent(el);
        hit.classList.add('is-dragging');
        vis.classList.add('is-dragging');
        const ends = getCapacitorLeadEndpoints(el, which);
        if (!ends) return;
        const dx = ends.x2 - ends.x1;
        const dy = ends.y2 - ends.y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const mx = (ends.x1 + ends.x2) / 2;
        const my = (ends.y1 + ends.y2) / 2;

        function onMove(ev) {
          const local = clientToCapacitorLocal(el, ev.clientX, ev.clientY);
          const slack = (local.x - mx) * nx + (local.y - my) * ny;
          setCapLeadSlack(el, which, slack);
          updateCapacitorLeadPaths(el);
          updateAllWirePositions();
          setStatus(`Capacitor ${which} lead curve: ${Math.round(getCapLeadSlack(el, which))}px`);
        }
        function onUp() {
          hit.classList.remove('is-dragging');
          vis.classList.remove('is-dragging');
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          markProjectDirty();
          setStatus('Capacitor lead curve set');
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }

  function ensureCapacitorLeads(el) {
    if (!isCapacitorComponent(el)) return;
    restoreCapTipPositions(el);
    updateCapacitorValueLabel(el);
    let svg = el.querySelector('.cap-leads-svg');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'cap-leads-svg');
      svg.setAttribute('aria-hidden', 'true');
      CAP_LEAD_SIDES.forEach((which) => {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.dataset.capLead = which;
        const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hit.setAttribute('class', 'cap-lead-hit');
        hit.setAttribute('fill', 'none');
        const vis = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        vis.setAttribute('class', 'cap-lead');
        vis.setAttribute('fill', 'none');
        g.appendChild(hit);
        g.appendChild(vis);
        svg.appendChild(g);
      });
      const ph = el.querySelector('.placeholder');
      if (ph) ph.after(svg);
      else el.appendChild(svg);
    } else {
      // Migrate old left/right lead groups if present
      const legacyLeft = svg.querySelector('[data-cap-lead="left"]');
      const legacyRight = svg.querySelector('[data-cap-lead="right"]');
      if (legacyLeft) legacyLeft.dataset.capLead = 'top';
      if (legacyRight) legacyRight.dataset.capLead = 'bottom';
    }
    setupCapacitorLeadDrag(el, svg);
    setupCapacitorTipDrag(el);
    requestAnimationFrame(() => updateCapacitorLeadPaths(el));
  }

  /* —— Custom-asset wire pigtails (body-anchored, movable free tip) —— */
  const ASSET_WIRE_SLACK_MAX = 56;
  const ASSET_WIRE_ATTACH_SCREEN_PX = 16;
  const ASSET_WIRE_STROKE = 2;
  const ASSET_WIRE_TIP_FRACTION = 0.08;

  function hasAssetWireTerms(el) {
    return !!el?.querySelector?.('.terminal.wire-term');
  }

  function getAssetWireTips(el) {
    return [...(el?.querySelectorAll?.('.terminal.wire-term') || [])];
  }

  function getAssetWireBodyAnchor(el, tip) {
    const body = el.querySelector('.placeholder');
    if (!body || !tip) return null;
    const bl = parseFloat(body.style.left) || 0;
    const bt = parseFloat(body.style.top) || 0;
    const bw = body.offsetWidth || parseFloat(body.style.width) || 40;
    const bh = body.offsetHeight || parseFloat(body.style.height) || 40;
    const tipW = tip.offsetWidth || 10;
    const tipH = tip.offsetHeight || 10;
    const tipCx = (parseFloat(tip.style.left) || 0) + tipW / 2;
    const tipCy = (parseFloat(tip.style.top) || 0) + tipH / 2;
    let x1 = bl + bw / 2;
    let y1 = bt + bh / 2;
    if (tipCx < bl) x1 = bl;
    else if (tipCx > bl + bw) x1 = bl + bw;
    if (tipCy < bt) y1 = bt;
    else if (tipCy > bt + bh) y1 = bt + bh;
    if (tipCx < bl || tipCx > bl + bw) {
      y1 = Math.min(bt + bh, Math.max(bt, tipCy));
    } else if (tipCy < bt || tipCy > bt + bh) {
      x1 = Math.min(bl + bw, Math.max(bl, tipCx));
    }
    return { x1, y1, x2: tipCx, y2: tipCy, tipCx, tipCy };
  }

  function getAssetWireLeadSlack(el, tipIdx) {
    const n = parseFloat(el.dataset[`awLeadSlack${tipIdx}`]);
    return Number.isFinite(n) ? n : 0;
  }

  function setAssetWireLeadSlack(el, tipIdx, value) {
    const clamped = Math.max(-ASSET_WIRE_SLACK_MAX, Math.min(ASSET_WIRE_SLACK_MAX, value));
    const key = `awLeadSlack${tipIdx}`;
    if (Math.abs(clamped) < 0.5) delete el.dataset[key];
    else el.dataset[key] = String(Math.round(clamped * 10) / 10);
  }

  function clientToAssetWireLocal(el, clientX, clientY) {
    const svg = el.querySelector('.asset-wire-leads-svg');
    if (svg) {
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const local = pt.matrixTransform(ctm.inverse());
        return { x: local.x, y: local.y };
      }
    }
    const rect = el.getBoundingClientRect();
    const sx = el.offsetWidth / (rect.width || 1);
    const sy = el.offsetHeight / (rect.height || 1);
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }

  function persistAssetWireTipPositions(el) {
    getAssetWireTips(el).forEach((tip, idx) => {
      el.dataset[`awTip${idx}Left`] = String(parseFloat(tip.style.left) || 0);
      el.dataset[`awTip${idx}Top`] = String(parseFloat(tip.style.top) || 0);
    });
  }

  function restoreAssetWireTipPositions(el) {
    getAssetWireTips(el).forEach((tip, idx) => {
      const left = el.dataset[`awTip${idx}Left`];
      const top = el.dataset[`awTip${idx}Top`];
      if (left != null && left !== '') tip.style.left = `${parseFloat(left)}px`;
      if (top != null && top !== '') tip.style.top = `${parseFloat(top)}px`;
    });
  }

  function clearAssetWireAttachHighlights() {
    document.querySelectorAll('.terminal.asset-wire-attach-target').forEach((t) => {
      t.classList.remove('asset-wire-attach-target');
    });
  }

  function getAssetWireTipAttachedTerminal(el, tipIdx) {
    const compId = el?.dataset?.[`awTip${tipIdx}AttachComp`];
    const termIdx = el?.dataset?.[`awTip${tipIdx}AttachTerm`];
    if (!compId || termIdx == null || termIdx === '') return null;
    const comp = components.get(compId);
    if (!comp || !document.body.contains(comp)) return null;
    const term = comp.querySelector(`.terminal[data-terminal-index="${termIdx}"]`);
    if (!term || !document.body.contains(term)) return null;
    return term;
  }

  function setAssetWireTipAttachment(el, tipIdx, terminal) {
    if (!el) return;
    const tip = getAssetWireTips(el)[tipIdx];
    if (!terminal) {
      delete el.dataset[`awTip${tipIdx}AttachComp`];
      delete el.dataset[`awTip${tipIdx}AttachTerm`];
      tip?.classList.remove('is-attached');
      return;
    }
    const host = terminal.closest('.component');
    if (!host?.dataset?.id) return;
    el.dataset[`awTip${tipIdx}AttachComp`] = host.dataset.id;
    el.dataset[`awTip${tipIdx}AttachTerm`] = String(terminal.dataset.terminalIndex ?? '');
    tip?.classList.add('is-attached');
  }

  function findAssetWireAttachTarget(excludeComp, clientX, clientY) {
    const excludePage = getComponentWorkspacePage(excludeComp);
    let best = null;
    let bestDist = ASSET_WIRE_ATTACH_SCREEN_PX;
    components.forEach((comp) => {
      if (comp === excludeComp) return;
      if (getComponentWorkspacePage(comp) !== excludePage) return;
      comp.querySelectorAll('.terminal').forEach((term) => {
        if (term.classList.contains('wire-term')) return;
        const c = getTerminalCenter(term);
        const d = Math.hypot(c.x - clientX, c.y - clientY);
        if (d <= bestDist) {
          bestDist = d;
          best = term;
        }
      });
    });
    return best;
  }

  function placeAssetWireTipAtClient(el, tip, clientX, clientY) {
    const tipW = tip.offsetWidth || 10;
    const tipH = tip.offsetHeight || 10;
    const local = clientToAssetWireLocal(el, clientX, clientY);
    tip.style.left = `${local.x - tipW / 2}px`;
    tip.style.top = `${local.y - tipH / 2}px`;
  }

  function layoutAssetWireFloatLabels(el) {
    if (!hasAssetWireTerms(el)) return;
    const tips = getAssetWireTips(el);
    tips.forEach((tip, idx) => {
      let label = el.querySelector(`.asset-wire-float-label[data-aw-label="${idx}"]`);
      const text = tip.dataset.tipLabel || tip.dataset.terminalLabel || '';
      const color = tip.dataset.wireColor || '#c9a227';
      if (!label) {
        label = document.createElement('span');
        label.className = 'hb-float-label asset-wire-float-label';
        label.dataset.awLabel = String(idx);
        label.setAttribute('aria-hidden', 'true');
        el.appendChild(label);
      }
      // Remove tip-nested labels from buildComponentDOM
      tip.querySelectorAll('.wire-float-label').forEach((n) => n.remove());
      label.textContent = text;
      label.style.setProperty('--hb-wire-color', color);
      label.style.color = text === 'H' ? '#eeeeee' : color;
      label.classList.toggle('is-h', text === 'H');
      label.classList.toggle('is-g', text === 'G');
      label.classList.toggle('is-active', tip.classList.contains('state-active'));

      const ends = getAssetWireBodyAnchor(el, tip);
      if (!ends) return;
      const dx = ends.x2 - ends.x1;
      const dy = ends.y2 - ends.y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = dx / len;
      const ny = dy / len;
      // Park label near the asset-anchored end (not the free tip)
      const x = ends.x1 + nx * 12;
      const y = ends.y1 + ny * 12;
      label.style.left = `${x}px`;
      label.style.top = `${y}px`;
    });
    el.querySelectorAll('.asset-wire-float-label').forEach((label) => {
      const idx = Number(label.dataset.awLabel);
      if (!Number.isFinite(idx) || idx < 0 || idx >= tips.length) label.remove();
    });
  }

  function updateAssetWireLeadPaths(el) {
    if (!hasAssetWireTerms(el)) return;
    // Hide legacy local SVG sleeves — real wires own the visuals now
    el.querySelector('.asset-wire-leads-svg')?.remove();
    getAssetWireTips(el).forEach((_, idx) => {
      const wire = ensureAssetWireLeadWire(el, idx);
      if (wire) updateWirePosition(wire);
    });
    layoutAssetWireFloatLabels(el);
  }

  function removeAssetWireLeadWire(el, tipIdx, opts = {}) {
    const id = el?.dataset?.[`awTip${tipIdx}WireId`];
    if (!id) return;
    const wire = wires.get(id);
    delete el.dataset[`awTip${tipIdx}WireId`];
    if (wire) discardWire(wire, opts.silent ? null : undefined);
  }

  function ensureAssetWireLeadWire(el, tipIdx) {
    const tip = getAssetWireTips(el)[tipIdx];
    if (!el?.dataset?.id || !tip) return null;
    const existingId = el.dataset[`awTip${tipIdx}WireId`];
    if (existingId && wires.has(existingId)) {
      const existing = wires.get(existingId);
      existing.assetWireCompId = el.dataset.id;
      existing.assetWireTipIndex = tipIdx;
      existing.group.dataset.assetWire = 'true';
      if (existing.end.terminal !== tip) {
        if (existing.end.terminal) unregisterTerminalWire(existing.end.terminal, existing.id);
        existing.end.terminal = tip;
        registerTerminalWire(tip, existing.id);
      }
      return existing;
    }

    const ends = getAssetWireBodyAnchor(el, tip);
    if (!ends) return null;
    const start = hbLocalToWorld(el, ends.x1, ends.y1);
    const tipC = getTerminalCenter(tip);
    const end = clientToWorld(tipC.x, tipC.y);
    const colorKey = hexToWireColorKey(tip.dataset.wireColor || tip.dataset.baseColor || '#c9a227');
    const layer = activeLayer || 1;
    const id = `wire-${++wireIdCounter}`;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('wire-group');
    group.dataset.id = id;
    group.dataset.layer = String(layer);
    group.dataset.assetWire = 'true';
    group.dataset.wireKind = 'asset-wire';

    const hit = createWirePathElement('wire-hit');
    const visible = createWirePathElement('wire-visible');
    visible.setAttribute('stroke', WIRE_COLORS[colorKey] || WIRE_COLORS.yellow);
    group.appendChild(hit);

    const initialSlack = getAssetWireLeadSlack(el, tipIdx);
    const wire = {
      id,
      group,
      hit,
      visible,
      outline: null,
      selectBorder: null,
      cloth: null,
      tipStart: null,
      tipStartStreak: null,
      tipEnd: null,
      tipEndStreak: null,
      color: colorKey,
      dashed: false,
      layer,
      slack: initialSlack || 0,
      anchors: [],
      start: { x: start.x, y: start.y, terminal: null },
      end: { x: end.x, y: end.y, terminal: tip },
      assetWireCompId: el.dataset.id,
      assetWireTipIndex: tipIdx,
      wireKind: 'asset-wire',
    };

    appendWireVisualLayers(wire, false);
    syncWireBorderClasses(wire);
    getLayerGroup(layer, wireStackAboveForLayer(layer)).appendChild(group);
    wires.set(id, wire);
    registerTerminalWire(tip, id);
    updateWirePosition(wire);
    setupWireInteraction(wire);
    el.dataset[`awTip${tipIdx}WireId`] = id;
    return wire;
  }

  function syncAssetWireTipAttachments(el) {
    if (!hasAssetWireTerms(el)) return;
    const tips = getAssetWireTips(el);
    tips.forEach((tip, idx) => {
      const target = getAssetWireTipAttachedTerminal(el, idx);
      if (!target) {
        if (el.dataset[`awTip${idx}AttachComp`]) setAssetWireTipAttachment(el, idx, null);
        tip.classList.remove('is-attached');
        return;
      }
      const center = getTerminalCenter(target);
      placeAssetWireTipAtClient(el, tip, center.x, center.y);
      tip.classList.add('is-attached');
    });
    persistAssetWireTipPositions(el);
    tips.forEach((_, idx) => {
      const wire = ensureAssetWireLeadWire(el, idx);
      if (wire) updateWirePosition(wire);
    });
    layoutAssetWireFloatLabels(el);
  }

  function syncAllAssetWireLeads() {
    components.forEach((comp) => {
      if (hasAssetWireTerms(comp)) syncAssetWireTipAttachments(comp);
    });
  }

  function eachAssetWireTipAttachmentPair(fn) {
    components.forEach((comp) => {
      if (!hasAssetWireTerms(comp)) return;
      getAssetWireTips(comp).forEach((tip, idx) => {
        const target = getAssetWireTipAttachedTerminal(comp, idx);
        if (tip && target) fn(tip, target);
      });
    });
  }

  function setupAssetWireTipDrag(el) {
    if (el.dataset.awTipBound === 'true') return;
    el.dataset.awTipBound = 'true';
    getAssetWireTips(el).forEach((tip, idx) => {
      if (getAssetWireTipAttachedTerminal(el, idx)) tip.classList.add('is-attached');
      tip.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (wireMode) return;
        if (wireEditFocusMode) return;
        e.preventDefault();
        e.stopPropagation();
        const wire = ensureAssetWireLeadWire(el, idx);
        if (wire && !selectedWireGroups.has(wire.group)) selectWire(wire);
        tip.classList.add('is-dragging');
        setAssetWireTipAttachment(el, idx, null);
        let hoverTarget = null;

        function onMove(ev) {
          clearAssetWireAttachHighlights();
          hoverTarget = findAssetWireAttachTarget(el, ev.clientX, ev.clientY);
          if (hoverTarget) {
            hoverTarget.classList.add('asset-wire-attach-target');
            const center = getTerminalCenter(hoverTarget);
            placeAssetWireTipAtClient(el, tip, center.x, center.y);
            showSnapIndicator(center.x, center.y);
            setStatus(`Attach wire to ${hoverTarget.dataset.terminalLabel || 'terminal'}`);
          } else {
            placeAssetWireTipAtClient(el, tip, ev.clientX, ev.clientY);
            snapIndicator.classList.add('hidden');
            setStatus('Dragging wire end — drop on a terminal to attach');
          }
          persistAssetWireTipPositions(el);
          if (wire) updateWirePosition(wire);
          layoutAssetWireFloatLabels(el);
          updateAllWirePositions();
        }
        function onUp() {
          tip.classList.remove('is-dragging');
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          clearAssetWireAttachHighlights();
          snapIndicator.classList.add('hidden');
          if (hoverTarget && document.body.contains(hoverTarget)) {
            setAssetWireTipAttachment(el, idx, hoverTarget);
            syncAssetWireTipAttachments(el);
            refreshShortCircuitCheck();
            validateYesGroundConnections();
            setStatus(`Wire attached to ${hoverTarget.dataset.terminalLabel || 'terminal'}`);
          } else {
            setAssetWireTipAttachment(el, idx, null);
            persistAssetWireTipPositions(el);
            if (wire) updateWirePosition(wire);
            layoutAssetWireFloatLabels(el);
            setStatus('Wire end placed');
          }
          markProjectDirty();
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }

  function ensureAssetWireLeads(el) {
    if (!hasAssetWireTerms(el)) return;
    restoreAssetWireTipPositions(el);
    el.querySelector('.asset-wire-leads-svg')?.remove();
    getAssetWireTips(el).forEach((_, idx) => {
      ensureAssetWireLeadWire(el, idx);
    });
    setupAssetWireTipDrag(el);
    requestAnimationFrame(() => {
      syncAssetWireTipAttachments(el);
      layoutAssetWireFloatLabels(el);
    });
  }

  /* —— Dual coil / humbucker 5-way loom + fan —— */
  /** Screen px per mm (CSS reference; not the panel 10px grid). */
  const HB_MM_PX = 96 / 25.4;
  const HB_LOOM_STROKE = 1.15 * HB_MM_PX; // 1.15mm
  const HB_FAN_STROKE = 0.5 * HB_MM_PX; // thinner coloured conductors
  const HB_LOOM_HIT_STROKE = HB_LOOM_STROKE + 8;
  const HB_FAN_HIT_STROKE = HB_FAN_STROKE + 6;
  /** Fan hit paths skip the junction so the loom end owns that click. */
  const HB_FAN_HIT_SKIP = HB_LOOM_STROKE;
  const HB_FAN_COUNT = 5;
  const HB_SLACK_MAX = 56;
  const HB_TIP_ATTACH_SCREEN_PX = 16;
  const WIRE_TIP_FRACTION = 0.05;
  /** Coloured fan tips: 50% longer than base wire tips. */
  const HB_FAN_TIP_FRACTION = WIRE_TIP_FRACTION * 1.5;
  const WIRE_TIP_MIN_PX = 3;
  const WIRE_TIP_COLOR = '#c4a35a';
  const HB_LOOM_BORDER = '#3a3a3a';
  const HB_LOOM_BORDER_PAD = 1.35;

  function clientToDualCoilLocal(el, clientX, clientY) {
    const svg = el.querySelector('.hb-leads-hit-svg') || el.querySelector('.hb-leads-svg');
    if (svg) {
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const local = pt.matrixTransform(ctm.inverse());
        return { x: local.x, y: local.y };
      }
    }
    const rect = el.getBoundingClientRect();
    const sx = el.offsetWidth / (rect.width || 1);
    const sy = el.offsetHeight / (rect.height || 1);
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }

  function getHbExitPoint(el) {
    const body = el.querySelector('.placeholder');
    if (!body) return { x: 120, y: 24 };
    const bl = parseFloat(body.style.left) || 0;
    const bt = parseFloat(body.style.top) || 0;
    const bw = body.offsetWidth || parseFloat(body.style.width) || 120;
    const bh = body.offsetHeight || parseFloat(body.style.height) || 48;
    const br = bl + bw;
    const bb = bt + bh;
    const cx = bl + bw / 2;
    const cy = bt + bh / 2;
    // Prefer the body side facing the loom junction (custom assets may exit L/T/B)
    const jx = parseFloat(el.dataset.hbJunctionLeft);
    const jy = parseFloat(el.dataset.hbJunctionTop);
    if (Number.isFinite(jx) && Number.isFinite(jy)) {
      const dx = jx - cx;
      const dy = jy - cy;
      const candidates = [
        { x: br, y: Math.min(bb, Math.max(bt, jy)), score: dx },
        { x: bl, y: Math.min(bb, Math.max(bt, jy)), score: -dx },
        { x: Math.min(br, Math.max(bl, jx)), y: bt, score: -dy },
        { x: Math.min(br, Math.max(bl, jx)), y: bb, score: dy },
      ];
      candidates.sort((a, b) => b.score - a.score);
      return { x: candidates[0].x, y: candidates[0].y };
    }
    return { x: br, y: cy };
  }

  function getHbJunction(el) {
    const jx = parseFloat(el.dataset.hbJunctionLeft);
    const jy = parseFloat(el.dataset.hbJunctionTop);
    if (Number.isFinite(jx) && Number.isFinite(jy)) return { x: jx, y: jy };
    const exit = getHbExitPoint(el);
    return { x: exit.x + 36, y: exit.y };
  }

  function setHbJunction(el, x, y) {
    el.dataset.hbJunctionLeft = String(Math.round(x * 10) / 10);
    el.dataset.hbJunctionTop = String(Math.round(y * 10) / 10);
  }

  function getHbLoomSlack(el) {
    const n = parseFloat(el.dataset.hbLoomSlack);
    return Number.isFinite(n) ? n : 0;
  }

  function setHbLoomSlack(el, value) {
    const clamped = Math.max(-HB_SLACK_MAX, Math.min(HB_SLACK_MAX, value));
    if (Math.abs(clamped) < 0.5) delete el.dataset.hbLoomSlack;
    else el.dataset.hbLoomSlack = String(Math.round(clamped * 10) / 10);
  }

  function getHbFanSlack(el, idx) {
    const n = parseFloat(el.dataset[`hbFanSlack${idx}`]);
    return Number.isFinite(n) ? n : 0;
  }

  function setHbFanSlack(el, idx, value) {
    const clamped = Math.max(-HB_SLACK_MAX, Math.min(HB_SLACK_MAX, value));
    if (Math.abs(clamped) < 0.5) delete el.dataset[`hbFanSlack${idx}`];
    else el.dataset[`hbFanSlack${idx}`] = String(Math.round(clamped * 10) / 10);
  }

  function isHbFanSlackUserSet(el, idx) {
    return el?.dataset?.[`hbFanSlackUser${idx}`] === '1';
  }

  function markHbFanSlackUser(el, idx, on = true) {
    if (!el) return;
    if (on) el.dataset[`hbFanSlackUser${idx}`] = '1';
    else delete el.dataset[`hbFanSlackUser${idx}`];
  }

  /** Tip + coloured fan are one conductor — slack lives on the fan and syncs to the tip→lug wire. */
  function setHbConductorSlack(el, tipIdx, slack, { skipWire, skipFanRedraw } = {}) {
    if (!el || tipIdx == null) return;
    const clamped = Math.max(-HB_SLACK_MAX, Math.min(HB_SLACK_MAX, Number(slack) || 0));
    setHbFanSlack(el, tipIdx, clamped);
    markHbFanSlackUser(el, tipIdx, true);
    if (!skipWire) {
      const wireId = el.dataset[`hbTip${tipIdx}WireId`];
      const wire = wireId ? wires.get(wireId) : null;
      if (wire) {
        wire.slack = clamped;
        updateWirePosition(wire);
      }
    }
    if (!skipFanRedraw) {
      updateDualCoilLeadPaths(el);
      syncHbWorldLeadVisuals(el);
    }
  }

  function getHbTipLeadWire(el, tipIdx) {
    const wireId = el?.dataset?.[`hbTip${tipIdx}WireId`];
    return wireId ? wires.get(wireId) || null : null;
  }

  function findHbConductorNearPointer(clientX, clientY) {
    const hits = document.elementsFromPoint(clientX, clientY);
    for (const el of hits) {
      const tip = el.closest?.('.terminal.hb-tip');
      if (tip) {
        const host = tip.closest('.component');
        if (host && isDualCoilComponent(host)) {
          const tipIdx = [...host.querySelectorAll('.terminal.hb-tip')].indexOf(tip);
          if (tipIdx >= 0) return { el: host, tipIdx };
        }
      }
      const fanHit = el.closest?.('[data-hb-fan-hit]');
      if (fanHit) {
        const host = fanHit.closest('.component');
        if (host && isDualCoilComponent(host)) {
          const tipIdx = Number(fanHit.dataset.hbFanHit);
          if (Number.isFinite(tipIdx)) return { el: host, tipIdx };
        }
      }
    }
    for (const comp of selectedComponents) {
      if (!isDualCoilComponent(comp)) continue;
      for (let i = 0; i < HB_FAN_COUNT; i++) {
        const tip = comp.querySelectorAll('.terminal.hb-tip')[i];
        if (!tip) continue;
        const c = getTerminalCenter(tip);
        if (Math.hypot(c.x - clientX, c.y - clientY) < 48) {
          return { el: comp, tipIdx: i };
        }
      }
    }
    return null;
  }

  function adjustHbConductorSlackAtPointer(clientX, clientY, delta) {
    let hit = heldHbConductor
      ? { el: components.get(heldHbConductor.compId), tipIdx: heldHbConductor.tipIdx }
      : null;
    if (!hit?.el || !isDualCoilComponent(hit.el)) {
      hit = findHbConductorNearPointer(clientX, clientY);
    }
    if (!hit?.el) return false;
    const next = getHbFanSlack(hit.el, hit.tipIdx) + delta;
    setHbConductorSlack(hit.el, hit.tipIdx, next);
    const wire = getHbTipLeadWire(hit.el, hit.tipIdx);
    if (wire && !selectedWireGroups.has(wire.group)) selectWire(wire);
    setStatus(`Lead bend: ${Math.round(getHbFanSlack(hit.el, hit.tipIdx))}px — +/- or wheel`);
    markProjectDirty();
    return true;
  }

  function beginHbConductorHold(el, tipIdx, e) {
    if (!el || tipIdx == null) return;
    heldHbConductor = { compId: el.dataset.id, tipIdx };
    const clearHold = () => {
      if (heldHbConductor?.compId === el.dataset.id && heldHbConductor?.tipIdx === tipIdx) {
        heldHbConductor = null;
      }
      document.removeEventListener('mouseup', clearHold);
    };
    document.addEventListener('mouseup', clearHold);

    const wire = getHbTipLeadWire(el, tipIdx);
    if (wire) {
      selectWire(wire);
      heldWireId = wire.id;
    }

    if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    let dragging = false;

    function onMove(ev) {
      const dist = Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY);
      if (!dragging && dist < 5) return;
      dragging = true;
      const junction = getHbJunction(el);
      const tip = el.querySelectorAll('.terminal.hb-tip')[tipIdx];
      if (!tip) return;
      const attached = getHbTipAttachedTerminal(el, tipIdx);
      const endC = attached ? getTerminalCenter(attached) : getTerminalCenter(tip);
      const endLocal = clientToDualCoilLocal(el, endC.x, endC.y);
      const pointerLocal = clientToDualCoilLocal(el, ev.clientX, ev.clientY);
      const dx = endLocal.x - junction.x;
      const dy = endLocal.y - junction.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const mx = (junction.x + endLocal.x) / 2;
      const my = (junction.y + endLocal.y) / 2;
      const slack = (pointerLocal.x - mx) * nx + (pointerLocal.y - my) * ny;
      setHbConductorSlack(el, tipIdx, slack);
      setStatus(`Lead bend: ${Math.round(getHbFanSlack(el, tipIdx))}px — drag, +/- or wheel`);
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (dragging) markProjectDirty();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function persistHbTipPositions(el) {
    const tips = [...el.querySelectorAll('.terminal.hb-tip')];
    tips.forEach((tip, idx) => {
      el.dataset[`hbTip${idx}Left`] = String(parseFloat(tip.style.left) || 0);
      el.dataset[`hbTip${idx}Top`] = String(parseFloat(tip.style.top) || 0);
    });
  }

  function restoreHbTipPositions(el) {
    const tips = [...el.querySelectorAll('.terminal.hb-tip')];
    tips.forEach((tip, idx) => {
      const left = el.dataset[`hbTip${idx}Left`];
      const top = el.dataset[`hbTip${idx}Top`];
      if (left != null && left !== '') tip.style.left = `${parseFloat(left)}px`;
      if (top != null && top !== '') tip.style.top = `${parseFloat(top)}px`;
    });
  }

  function getHbTipAttachedTerminal(el, tipIdx) {
    const compId = el?.dataset?.[`hbTip${tipIdx}AttachComp`];
    const termIdx = el?.dataset?.[`hbTip${tipIdx}AttachTerm`];
    if (!compId || termIdx == null || termIdx === '') return null;
    const comp = components.get(compId);
    if (!comp || !document.body.contains(comp)) return null;
    return comp.querySelector(`.terminal[data-terminal-index="${termIdx}"]`) || null;
  }

  function hexToWireColorKey(hex) {
    const h = String(hex || '').trim().toLowerCase();
    if (!h) return 'black';
    for (const [key, value] of Object.entries(WIRE_COLORS)) {
      if (value.toLowerCase() === h) return key;
    }
    if (h === '#111' || h === '#000' || h === '#000000') return 'black';
    if (h === '#fff' || h === '#ffffff') return 'white';
    if (h === '#b87333' || h.includes('copper')) return 'copper';
    if (h === '#c9a227' || h === '#ffd700' || h === '#ffd70') return 'yellow';
    return 'black';
  }

  function clearHbTipLeadWireMeta(wire) {
    if (!wire?.hbLeadCompId) return;
    const comp = components.get(wire.hbLeadCompId);
    const tipIdx = wire.hbLeadTipIndex;
    wire.hbLeadCompId = null;
    wire.hbLeadTipIndex = null;
    if (!comp || tipIdx == null) return;
    if (comp.dataset[`hbTip${tipIdx}WireId`] === wire.id) {
      delete comp.dataset[`hbTip${tipIdx}WireId`];
    }
    delete comp.dataset[`hbTip${tipIdx}AttachComp`];
    delete comp.dataset[`hbTip${tipIdx}AttachTerm`];
    const tip = comp.querySelectorAll('.terminal.hb-tip')[tipIdx];
    tip?.classList.remove('is-attached');
  }

  function removeHbTipLeadWire(el, tipIdx, { silent } = {}) {
    const wireId = el?.dataset?.[`hbTip${tipIdx}WireId`];
    delete el?.dataset?.[`hbTip${tipIdx}WireId`];
    if (!wireId) return;
    const wire = wires.get(wireId);
    if (!wire) return;
    wire.hbLeadCompId = null;
    wire.hbLeadTipIndex = null;
    if (silent) {
      unregisterTerminalWire(wire.start.terminal, wire.id);
      unregisterTerminalWire(wire.end.terminal, wire.id);
      if (selectedWireGroups.has(wire.group)) selectedWireGroups.delete(wire.group);
      wire.group.remove();
      wires.delete(wire.id);
    } else {
      discardWire(wire);
    }
  }

  function collectWiresSharingTerminal(terminal, exceptId) {
    if (!terminal) return [];
    const ids = terminalWireMap.get(terminal);
    if (!ids || ids.size === 0) return [];
    return [...ids]
      .map((id) => wires.get(id))
      .filter((w) => w && w.id !== exceptId);
  }

  /** When several wires share a lug, give the new one a different bow so they don't stack. */
  function assignDivergentSlack(wire) {
    if (!wire || (wire.anchors || []).length > 0) return;
    const neighbors = new Map();
    [wire.start?.terminal, wire.end?.terminal].forEach((term) => {
      collectWiresSharingTerminal(term, wire.id).forEach((w) => neighbors.set(w.id, w));
    });
    const others = [...neighbors.values()];
    if (others.length === 0) return;

    const mySlack = wire.slack || 0;
    const conflicts = others.some((w) => Math.abs((w.slack || 0) - mySlack) < SLACK_STEP * 0.4);
    if (!conflicts) return;

    const used = others.map((w) => w.slack || 0);
    const candidates = [];
    for (let i = 1; i <= 10; i++) {
      candidates.push(i * SLACK_STEP, -i * SLACK_STEP);
    }
    candidates.push(0);
    for (const c of candidates) {
      if (used.every((u) => Math.abs(u - c) >= SLACK_STEP * 0.4)) {
        wire.slack = Math.max(-SLACK_MAX, Math.min(SLACK_MAX, c));
        return;
      }
    }
    wire.slack = Math.max(-SLACK_MAX, Math.min(SLACK_MAX, (others.length + 1) * SLACK_STEP));
  }

  function createHbTipLeadWire(el, tipIdx, tip, terminal) {
    if (!el || !tip || !terminal || tip === terminal) return null;
    removeHbTipLeadWire(el, tipIdx, { silent: true });

    const colorKey = hexToWireColorKey(tip.dataset.wireColor);
    const layer = getHbWireLayer(el);
    const id = `wire-${++wireIdCounter}`;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('wire-group', 'hb-lead-wire');
    group.dataset.id = id;
    group.dataset.layer = String(layer);
    group.dataset.hbLead = 'true';
    group.dataset.wireKind = '4conductor';

    const hit = createWirePathElement('wire-hit');
    const visible = createWirePathElement('wire-visible');
    visible.setAttribute('stroke', WIRE_COLORS[colorKey] || WIRE_COLORS.black);
    visible.setAttribute('stroke-width', String(HB_FAN_STROKE));
    if (colorKey === 'black') visible.setAttribute('stroke-linecap', 'round');
    group.appendChild(hit);

    // Tip parks on the lug — the coloured conductor is junction → lug (one wire)
    parkHbTipOnTerminal(el, tip, terminal);
    persistHbTipPositions(el);

    const tipCenter = getTerminalCenter(tip);
    const termCenter = getTerminalCenter(terminal);
    const tipWorld = clientToWorld(tipCenter.x, tipCenter.y);
    const termWorld = clientToWorld(termCenter.x, termCenter.y);
    const initialSlack = isHbFanSlackUserSet(el, tipIdx)
      ? getHbFanSlack(el, tipIdx)
      : 0;

    const wire = {
      id,
      group,
      hit,
      visible,
      outline: null,
      selectBorder: null,
      cloth: null,
      tipStart: null,
      tipStartStreak: null,
      tipEnd: null,
      tipEndStreak: null,
      color: colorKey,
      dashed: false,
      layer,
      slack: initialSlack,
      anchors: [],
      start: { x: tipWorld.x, y: tipWorld.y, terminal: tip },
      end: { x: termWorld.x, y: termWorld.y, terminal },
      hbLeadCompId: el.dataset.id,
      hbLeadTipIndex: tipIdx,
      wireKind: '4conductor',
    };

    appendWireVisualLayers(wire, false);
    syncWireBorderClasses(wire);
    getLayerGroup(layer, wireStackAboveForLayer(layer)).appendChild(group);
    wires.set(id, wire);
    registerTerminalWire(wire.start.terminal, id);
    registerTerminalWire(wire.end.terminal, id);
    assignDivergentSlack(wire);
    if (wire.slack) {
      setHbFanSlack(el, tipIdx, wire.slack);
      markHbFanSlackUser(el, tipIdx, true);
    }
    updateWirePosition(wire);
    [wire.start.terminal, wire.end.terminal].forEach((term) => {
      collectWiresSharingTerminal(term, null).forEach((w) => updateWirePosition(w));
    });
    setupWireInteraction(wire);
    el.dataset[`hbTip${tipIdx}WireId`] = id;
    updateDualCoilLeadPaths(el);
    return wire;
  }

  function setHbTipAttachment(el, tipIdx, terminal) {
    if (!el) return;
    const tip = el.querySelectorAll('.terminal.hb-tip')[tipIdx];
    if (!terminal) {
      removeHbTipLeadWire(el, tipIdx, { silent: true });
      delete el.dataset[`hbTip${tipIdx}AttachComp`];
      delete el.dataset[`hbTip${tipIdx}AttachTerm`];
      tip?.classList.remove('is-attached');
      return;
    }
    const host = terminal.closest('.component');
    if (!host?.dataset?.id) return;
    el.dataset[`hbTip${tipIdx}AttachComp`] = host.dataset.id;
    el.dataset[`hbTip${tipIdx}AttachTerm`] = String(terminal.dataset.terminalIndex ?? '');
    tip?.classList.add('is-attached');
    createHbTipLeadWire(el, tipIdx, tip, terminal);
  }

  function relinkHbTipLeadWires() {
    components.forEach((comp) => {
      if (!isDualCoilComponent(comp)) return;
      const tips = [...comp.querySelectorAll('.terminal.hb-tip')];
      tips.forEach((tip, idx) => {
        let target = getHbTipAttachedTerminal(comp, idx);
        let linked = null;
        wires.forEach((wire) => {
          if (linked) return;
          const a = wire.start.terminal;
          const b = wire.end.terminal;
          if (a !== tip && b !== tip) return;
          const other = a === tip ? b : a;
          if (!other || other.classList?.contains('hb-tip')) return;
          linked = wire;
          if (!target) target = other;
        });
        if (linked) {
          linked.hbLeadCompId = comp.dataset.id;
          linked.hbLeadTipIndex = idx;
          linked.wireKind = '4conductor';
          linked.group.dataset.hbLead = 'true';
          linked.group.dataset.wireKind = '4conductor';
          linked.group.classList.add('hb-lead-wire');
          linked.visible?.setAttribute('stroke-width', String(HB_FAN_STROKE));
          comp.dataset[`hbTip${idx}WireId`] = linked.id;
          if (target) {
            const host = target.closest('.component');
            if (host?.dataset?.id) {
              comp.dataset[`hbTip${idx}AttachComp`] = host.dataset.id;
              comp.dataset[`hbTip${idx}AttachTerm`] = String(target.dataset.terminalIndex ?? '');
            }
            parkHbTipOnTerminal(comp, tip, target);
          }
          tip.classList.add('is-attached');
          updateWirePosition(linked);
        } else if (target) {
          createHbTipLeadWire(comp, idx, tip, target);
        } else {
          delete comp.dataset[`hbTip${idx}WireId`];
          tip.classList.remove('is-attached');
        }
      });
    });
  }

  function placeHbTipAtClient(el, tip, clientX, clientY) {
    const tipW = tip.offsetWidth || 10;
    const tipH = tip.offsetHeight || 10;
    const local = clientToDualCoilLocal(el, clientX, clientY);
    tip.style.left = `${local.x - tipW / 2}px`;
    tip.style.top = `${local.y - tipH / 2}px`;
  }

  function findHbTipAttachTarget(excludeComp, clientX, clientY) {
    const excludePage = getComponentWorkspacePage(excludeComp);
    let best = null;
    let bestDist = HB_TIP_ATTACH_SCREEN_PX;
    components.forEach((comp) => {
      if (comp === excludeComp) return;
      if (getComponentWorkspacePage(comp) !== excludePage) return;
      comp.querySelectorAll('.terminal').forEach((term) => {
        if (term.classList.contains('hb-tip')) return;
        const c = getTerminalCenter(term);
        const d = Math.hypot(c.x - clientX, c.y - clientY);
        if (d <= bestDist) {
          bestDist = d;
          best = term;
        }
      });
    });
    return best;
  }

  function pointOnWireBow(x1, y1, x2, y2, slack, t) {
    const tt = Math.max(0, Math.min(1, t));
    if (!slack) {
      return { x: x1 + (x2 - x1) * tt, y: y1 + (y2 - y1) * tt };
    }
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const cx = mx + (-dy / len) * slack;
    const cy = my + (dx / len) * slack;
    const u = 1 - tt;
    return {
      x: u * u * x1 + 2 * u * tt * cx + tt * tt * x2,
      y: u * u * y1 + 2 * u * tt * cy + tt * tt * y2,
    };
  }

  function buildFanHitPath(x1, y1, x2, y2, slack, skipPx) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const skip = Math.min(Math.max(0, skipPx), len * 0.45);
    if (skip < 0.5) return buildWirePath(x1, y1, x2, y2, slack);
    const t0 = skip / len;
    const start = pointOnWireBow(x1, y1, x2, y2, slack, t0);
    const remSlack = slack * (1 - t0);
    return buildWirePath(start.x, start.y, x2, y2, remSlack);
  }

  function getHbTipCenters(el) {
    return [...el.querySelectorAll('.terminal.hb-tip')].map((tip) => {
      const tipW = tip.offsetWidth || 10;
      const tipH = tip.offsetHeight || 10;
      return {
        tip,
        x: (parseFloat(tip.style.left) || 0) + tipW / 2,
        y: (parseFloat(tip.style.top) || 0) + tipH / 2,
      };
    });
  }

  /** Bow flips when the tip crosses the fan midline (junction → tip centroid). */
  function computeHbFanSlack(junction, tipX, tipY, midX, midY) {
    const ax = midX - junction.x;
    const ay = midY - junction.y;
    const tx = tipX - junction.x;
    const ty = tipY - junction.y;
    const len = Math.hypot(tx, ty) || 1;
    const cross = ax * ty - ay * tx;
    const sign = cross < -0.5 ? -1 : cross > 0.5 ? 1 : 0;
    return sign * Math.min(16, Math.max(5, len * 0.2));
  }

  /** Loom bow flips when the free end crosses the exit horizontal midline. */
  function computeHbLoomSlack(exit, junction) {
    const len = Math.hypot(junction.x - exit.x, junction.y - exit.y) || 1;
    const amount = Math.min(22, Math.max(10, len * 0.22));
    const sign = junction.y < exit.y - 0.5 ? -1 : 1;
    return sign * amount;
  }

  function orderDualCoilLeadSvg(el, visSvg, hitSvg) {
    if (!el) return;
    const ph = el.querySelector('.placeholder');
    if (visSvg) {
      if (ph) ph.before(visSvg);
      else el.appendChild(visSvg);
      const fans = [...visSvg.querySelectorAll('[data-hb-fan]')];
      fans.forEach((g) => {
        const outline = g.querySelector('.hb-fan-outline');
        const tip = g.querySelector('.hb-fan-tip-end');
        const fan = g.querySelector('.hb-fan');
        const plastic = g.querySelector('.hb-fan-plastic');
        // Outline → tip under sleeve → sleeve → plastic sheen
        if (outline) g.appendChild(outline);
        if (tip) g.appendChild(tip);
        if (fan) g.appendChild(fan);
        if (plastic) g.appendChild(plastic);
        visSvg.appendChild(g);
      });
      const loomBorder = visSvg.querySelector('.hb-loom-border');
      const loom = visSvg.querySelector('.hb-loom');
      const loomPlastic = visSvg.querySelector('.hb-loom-plastic');
      if (loomBorder) visSvg.appendChild(loomBorder);
      if (loom) visSvg.appendChild(loom);
      if (loomPlastic) visSvg.appendChild(loomPlastic);
    }
    if (hitSvg) {
      if (ph) ph.after(hitSvg);
      else el.appendChild(hitSvg);
      const fans = [...hitSvg.querySelectorAll('[data-hb-fan-hit]')];
      const loomHit = hitSvg.querySelector('.hb-loom-hit');
      fans.forEach((g) => hitSvg.appendChild(g));
      if (loomHit) hitSvg.appendChild(loomHit);
    }
  }

  function updateDualCoilLeadPaths(el) {
    if (!isDualCoilComponent(el)) return;
    const visSvg = el.querySelector('.hb-leads-svg');
    const hitSvg = el.querySelector('.hb-leads-hit-svg');
    if (!visSvg && !hitSvg) return;
    ensureHbPlasticDefs(visSvg);
    const exit = getHbExitPoint(el);
    const junction = getHbJunction(el);
    const loomSlack = computeHbLoomSlack(exit, junction);
    setHbLoomSlack(el, loomSlack);
    const loomD = buildWirePath(exit.x, exit.y, junction.x, junction.y, loomSlack);
    const loomBorder = visSvg?.querySelector('.hb-loom-border');
    const loomVis = visSvg?.querySelector('.hb-loom');
    const loomPlastic = visSvg?.querySelector('.hb-loom-plastic');
    if (loomBorder) {
      loomBorder.setAttribute('d', loomD);
      loomBorder.setAttribute('stroke', HB_LOOM_BORDER);
      loomBorder.setAttribute('stroke-width', String(HB_LOOM_STROKE + HB_LOOM_BORDER_PAD));
    }
    if (loomVis) {
      loomVis.setAttribute('d', loomD);
      loomVis.setAttribute('stroke-width', String(HB_LOOM_STROKE));
      const loomColor = el.dataset.loomColor || '#111111';
      loomVis.style.stroke = loomColor;
    }
    if (loomPlastic) {
      loomPlastic.setAttribute('d', loomD);
      loomPlastic.setAttribute('stroke-width', String(Math.max(1, HB_LOOM_STROKE * 0.92)));
    }
    visSvg?.querySelectorAll('.hb-loom-tip-start, .hb-loom-tip-end').forEach((n) => n.remove());
    const loomHit = hitSvg?.querySelector('.hb-loom-hit');
    loomHit?.setAttribute('d', loomD);
    loomHit?.setAttribute('stroke-width', String(HB_LOOM_HIT_STROKE));

    const tipCenters = getHbTipCenters(el);
    let midX = junction.x;
    let midY = junction.y + 1;
    if (tipCenters.length) {
      const midTip = tipCenters[Math.floor((tipCenters.length - 1) / 2)];
      midX = midTip.x;
      midY = midTip.y;
    }
    // Half of sleeve, then +50%
    const fanTipStroke = HB_FAN_STROKE * 0.5 * 1.5;

    tipCenters.forEach((tc, idx) => {
      const attached = getHbTipAttachedTerminal(el, idx);
      const gVis = visSvg?.querySelector(`[data-hb-fan="${idx}"]`);
      const gHit = hitSvg?.querySelector(`[data-hb-fan-hit="${idx}"]`);

      // Attached: tip + coloured fan are the tip→lug wire (junction → lug). Hide local fan duplicate.
      if (attached) {
        gVis?.setAttribute('visibility', 'hidden');
        gHit?.setAttribute('visibility', 'hidden');
        const leadWire = getHbTipLeadWire(el, idx);
        if (leadWire && isHbFanSlackUserSet(el, idx) && leadWire.slack !== getHbFanSlack(el, idx)) {
          leadWire.slack = getHbFanSlack(el, idx);
          updateWirePosition(leadWire);
        } else if (leadWire) {
          updateWirePosition(leadWire);
        }
        return;
      }

      gVis?.removeAttribute('visibility');
      gHit?.removeAttribute('visibility');

      let slack;
      if (isHbFanSlackUserSet(el, idx)) {
        slack = getHbFanSlack(el, idx);
      } else {
        slack = computeHbFanSlack(junction, tc.x, tc.y, midX, midY);
        setHbFanSlack(el, idx, slack);
      }
      const d = buildWirePath(junction.x, junction.y, tc.x, tc.y, slack);
      const hitD = buildFanHitPath(junction.x, junction.y, tc.x, tc.y, slack, HB_FAN_HIT_SKIP);
      const outline = gVis?.querySelector('.hb-fan-outline');
      const vis = gVis?.querySelector('.hb-fan');
      const plastic = gVis?.querySelector('.hb-fan-plastic');
      gVis?.querySelector('.hb-fan-tip-start')?.remove();
      const fanTipEnd = gVis?.querySelector('.hb-fan-tip-end');
      if (vis) {
        const samples = sampleBowPath(junction.x, junction.y, tc.x, tc.y, slack);
        applyTipSplitToPathEls(samples, vis, null, fanTipEnd, d, {
          start: false,
          end: true,
          tipFraction: HB_FAN_TIP_FRACTION,
          underSleeve: true,
        });
        const sleeveD = vis.getAttribute('d') || d;
        vis.setAttribute('stroke-width', String(HB_FAN_STROKE));
        const color = tc.tip.dataset.wireColor || '#888';
        vis.setAttribute('stroke', color);
        const isBlack = color === '#111111' || color === '#111' || color === 'black';
        if (outline) {
          if (isBlack) {
            outline.setAttribute('d', sleeveD);
            outline.setAttribute('stroke', '#9a9a9a');
            outline.setAttribute('stroke-width', String(HB_FAN_STROKE + 1.2));
            outline.style.display = '';
          } else {
            outline.removeAttribute('d');
            outline.style.display = 'none';
          }
        }
        if (fanTipEnd) {
          fanTipEnd.setAttribute('stroke', WIRE_TIP_COLOR);
          fanTipEnd.setAttribute('stroke-width', String(fanTipStroke));
          fanTipEnd.setAttribute('stroke-linecap', 'butt');
        }
        if (plastic) {
          plastic.setAttribute('d', sleeveD);
          plastic.setAttribute('stroke-width', String(Math.max(0.6, HB_FAN_STROKE * 0.9)));
          const isLight = /^#fff/i.test(color) || color === '#ffffff' || color === 'white';
          plastic.classList.toggle('hb-plastic-on-light', isLight);
        }
      }
      const hit = gHit?.querySelector('.hb-fan-hit');
      hit?.setAttribute('d', hitD);
      hit?.setAttribute('stroke-width', String(HB_FAN_HIT_STROKE));
    });
    orderDualCoilLeadSvg(el, visSvg, hitSvg);
    layoutHbFloatLabels(el);
    syncHbWorldLeadVisuals(el);
  }

  function getHbWireLayer(el) {
    const n = Number(el?.dataset?.hbWireLayer);
    if (Number.isFinite(n) && n >= 1 && n <= LAYER_COUNT) return n;
    return activeLayer || 1;
  }

  function hbLocalToWorld(el, x, y) {
    const svg = el.querySelector('.hb-leads-svg');
    const ctm = svg?.getScreenCTM?.();
    if (svg && ctm) {
      const pt = svg.createSVGPoint();
      pt.x = x;
      pt.y = y;
      const screen = pt.matrixTransform(ctm);
      return clientToWorld(screen.x, screen.y);
    }
    const left = parseFloat(el.style.left) || 0;
    const top = parseFloat(el.style.top) || 0;
    return { x: left + x, y: top + y };
  }

  function worldPathFromLocalPath(el, pathEl) {
    if (!pathEl) return '';
    const d = pathEl.getAttribute('d');
    if (!d) return '';
    try {
      const len = pathEl.getTotalLength();
      if (!(len > 0.05)) return '';
      const steps = Math.max(10, Math.min(48, Math.ceil(len / 3)));
      const samples = [];
      for (let i = 0; i <= steps; i++) {
        const p = pathEl.getPointAtLength((len * i) / steps);
        samples.push(hbLocalToWorld(el, p.x, p.y));
      }
      return polylinePath(samples);
    } catch {
      return '';
    }
  }

  function ensureHbWorldPath(parent, className) {
    const primary = className.trim().split(/\s+/)[0];
    let el = [...parent.children].find((c) => c.classList?.contains(primary));
    if (!el) {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('class', className);
      el.setAttribute('fill', 'none');
      parent.appendChild(el);
    }
    return el;
  }

  function ensureHbWorldLeadGroup(el) {
    if (!isDualCoilComponent(el) || !el.dataset.id) return null;
    if (!el.dataset.hbWireLayer) el.dataset.hbWireLayer = String(activeLayer || 1);
    let g = document.querySelector(`g[data-hb-world-leads="${el.dataset.id}"]`);
    if (!g) {
      g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.dataset.hbWorldLeads = el.dataset.id;
      g.setAttribute('class', 'hb-world-leads');
      g.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < HB_FAN_COUNT; i++) {
        const fg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        fg.dataset.hbWorldFan = String(i);
        ensureHbWorldPath(fg, 'hb-fan-outline');
        ensureHbWorldPath(fg, 'hb-fan-tip-end');
        ensureHbWorldPath(fg, 'hb-fan');
        ensureHbWorldPath(fg, 'hb-fan-plastic hb-plastic');
        g.appendChild(fg);
      }
      ensureHbWorldPath(g, 'hb-loom-border');
      ensureHbWorldPath(g, 'hb-loom');
      ensureHbWorldPath(g, 'hb-loom-plastic hb-plastic');
    }
    moveHbWorldLeadsToStack(el, g);
    return g;
  }

  function removeHbWorldLeadGroup(elOrId) {
    const id = typeof elOrId === 'string' ? elOrId : elOrId?.dataset?.id;
    if (!id) return;
    document.querySelectorAll(`g[data-hb-world-leads="${id}"]`).forEach((n) => n.remove());
  }

  function moveHbWorldLeadsToStack(el, group) {
    if (!isDualCoilComponent(el)) return;
    const g = group || document.querySelector(`g[data-hb-world-leads="${el.dataset.id}"]`);
    if (!g) return;
    const layer = getHbWireLayer(el);
    const visible = layerState[layer]?.visible !== false;
    g.style.display = visible ? '' : 'none';
    const container = getLayerGroup(layer, wireStackAboveForLayer(layer));
    if (container) container.appendChild(g);
  }

  function moveAllHbWorldLeads() {
    components.forEach((comp) => {
      if (!isDualCoilComponent(comp)) return;
      if (!document.querySelector(`g[data-hb-world-leads="${comp.dataset.id}"]`)) {
        syncHbWorldLeadVisuals(comp);
      } else {
        moveHbWorldLeadsToStack(comp);
      }
    });
  }

  function syncHbWorldLeadVisuals(el) {
    if (!isDualCoilComponent(el)) return;
    const localSvg = el.querySelector('.hb-leads-svg');
    if (!localSvg) return;
    const g = ensureHbWorldLeadGroup(el);
    if (!g) return;

    const copyStroke = (from, to, extras = {}) => {
      if (!from || !to) return;
      to.setAttribute('d', worldPathFromLocalPath(el, from));
      const sw = from.getAttribute('stroke-width');
      if (sw) to.setAttribute('stroke-width', sw);
      const stroke = from.style.stroke || from.getAttribute('stroke');
      if (stroke) {
        to.setAttribute('stroke', stroke);
        to.style.stroke = stroke;
      }
      Object.entries(extras).forEach(([k, v]) => {
        if (v == null || v === '') to.removeAttribute(k);
        else to.setAttribute(k, v);
      });
    };

    copyStroke(localSvg.querySelector('.hb-loom-border'), [...g.children].find((c) => c.classList?.contains('hb-loom-border')));
    copyStroke(localSvg.querySelector('.hb-loom'), [...g.children].find((c) => c.classList?.contains('hb-loom') && !c.classList.contains('hb-loom-border') && !c.classList.contains('hb-loom-plastic')));
    copyStroke(localSvg.querySelector('.hb-loom-plastic'), [...g.children].find((c) => c.classList?.contains('hb-loom-plastic')));

    for (let i = 0; i < HB_FAN_COUNT; i++) {
      const localG = localSvg.querySelector(`[data-hb-fan="${i}"]`);
      const worldG = g.querySelector(`[data-hb-world-fan="${i}"]`);
      if (!localG || !worldG) continue;
      // Attached conductors are drawn by the tip-lead wire (junction → lug)
      if (getHbTipAttachedTerminal(el, i) || localG.getAttribute('visibility') === 'hidden') {
        worldG.querySelectorAll('path').forEach((p) => p.removeAttribute('d'));
        continue;
      }
      const outline = localG.querySelector('.hb-fan-outline');
      const wOutline = worldG.querySelector('.hb-fan-outline');
      if (outline && outline.style.display === 'none') {
        wOutline?.removeAttribute('d');
        if (wOutline) wOutline.style.display = 'none';
      } else {
        if (wOutline) wOutline.style.display = '';
        copyStroke(outline, wOutline);
      }
      copyStroke(localG.querySelector('.hb-fan-tip-end'), worldG.querySelector('.hb-fan-tip-end'), {
        'stroke-linecap': 'butt',
      });
      copyStroke(localG.querySelector('.hb-fan'), worldG.querySelector('.hb-fan'));
      const localPlastic = localG.querySelector('.hb-fan-plastic');
      const worldPlastic = worldG.querySelector('.hb-fan-plastic');
      copyStroke(localPlastic, worldPlastic);
      worldPlastic?.classList.toggle('hb-plastic-on-light', !!localPlastic?.classList.contains('hb-plastic-on-light'));
    }

    // Paint order: fans (outline/tip/fan/plastic) then loom border/loom/plastic
    [...g.querySelectorAll('[data-hb-world-fan]')].forEach((fg) => {
      const outline = fg.querySelector('.hb-fan-outline');
      const tip = fg.querySelector('.hb-fan-tip-end');
      const fan = fg.querySelector('.hb-fan');
      const plastic = fg.querySelector('.hb-fan-plastic');
      if (outline) fg.appendChild(outline);
      if (tip) fg.appendChild(tip);
      if (fan) fg.appendChild(fan);
      if (plastic) fg.appendChild(plastic);
      g.appendChild(fg);
    });
    const loomBorder = [...g.children].find((c) => c.classList?.contains('hb-loom-border'));
    const loom = [...g.children].find((c) => c.classList?.contains('hb-loom') && !c.classList.contains('hb-loom-border') && !c.classList.contains('hb-loom-plastic'));
    const loomPlastic = [...g.children].find((c) => c.classList?.contains('hb-loom-plastic'));
    if (loomBorder) g.appendChild(loomBorder);
    if (loom) g.appendChild(loom);
    if (loomPlastic) g.appendChild(loomPlastic);

    moveHbWorldLeadsToStack(el, g);
  }

  function ensureHbFloatLabels(el) {
    if (!isDualCoilComponent(el)) return;
    const tips = [...el.querySelectorAll('.terminal.hb-tip')];
    tips.forEach((tip, idx) => {
      let label = el.querySelector(`.hb-float-label[data-hb-label="${idx}"]`);
      if (!label) {
        label = document.createElement('span');
        label.className = 'hb-float-label';
        label.dataset.hbLabel = String(idx);
        label.setAttribute('aria-hidden', 'true');
        el.appendChild(label);
      }
      const text = tip.dataset.tipLabel || tip.dataset.terminalLabel || '';
      label.textContent = text;
      label.classList.toggle('is-h', text === 'H');
      label.classList.toggle('is-g', text === 'G');
      const color = tip.dataset.wireColor || '#c8cdd6';
      label.style.setProperty('--hb-wire-color', color);
      label.style.color = text === 'H' ? '#eeeeee' : color;
    });
    el.querySelectorAll('.hb-float-label').forEach((label) => {
      const idx = Number(label.dataset.hbLabel);
      if (!Number.isFinite(idx) || idx < 0 || idx >= tips.length) label.remove();
    });
  }

  function layoutHbFloatLabels(el) {
    if (!isDualCoilComponent(el)) return;
    ensureHbFloatLabels(el);
    const junction = getHbJunction(el);
    const tipCenters = getHbTipCenters(el);
    const pad = 4;
    const items = tipCenters.map((tc, idx) => {
      const label = el.querySelector(`.hb-float-label[data-hb-label="${idx}"]`);
      if (!label) return null;
      const attached = getHbTipAttachedTerminal(el, idx);
      // Attached: tip sits on the lug — park the label mid-conductor instead
      const endX = attached ? tc.x : tc.x;
      const endY = attached ? tc.y : tc.y;
      const midX = attached ? (junction.x + endX) / 2 : endX;
      const midY = attached ? (junction.y + endY) / 2 : endY;
      const dx = endX - junction.x;
      const dy = endY - junction.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = dx / len;
      const ny = dy / len;
      const px = -ny;
      const py = nx;
      let x = attached ? midX + px * 14 : endX + nx * 16;
      let y = attached ? midY + py * 14 : endY + ny * 16;
      label.style.left = `${x}px`;
      label.style.top = `${y}px`;
      const w = Math.max(10, label.offsetWidth || 14);
      const h = Math.max(8, label.offsetHeight || 10);
      return { label, x, y, w, h, nx: attached ? px : nx, ny: attached ? py : ny, tipX: midX, tipY: midY };
    }).filter(Boolean);

    for (let iter = 0; iter < 16; iter++) {
      let moved = false;
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const minX = (a.w + b.w) / 2 + pad;
          const minY = (a.h + b.h) / 2 + pad;
          const overlapX = minX - Math.abs(dx);
          const overlapY = minY - Math.abs(dy);
          if (overlapX <= 0 || overlapY <= 0) continue;
          // Push apart along weaker overlap axis, biased by fan outward normals
          if (overlapX < overlapY) {
            const push = (overlapX / 2) * (dx === 0 ? 1 : Math.sign(dx) || 1);
            a.x -= push;
            b.x += push;
          } else {
            const push = (overlapY / 2) * (dy === 0 ? 1 : Math.sign(dy) || 1);
            a.y -= push;
            b.y += push;
          }
          // Nudge along each wire's outward direction so labels stay near their tip
          a.x += a.nx * 0.35;
          a.y += a.ny * 0.35;
          b.x += b.nx * 0.35;
          b.y += b.ny * 0.35;
          moved = true;
        }
      }
      if (!moved) break;
    }

    items.forEach((item) => {
      item.label.style.left = `${Math.round(item.x * 10) / 10}px`;
      item.label.style.top = `${Math.round(item.y * 10) / 10}px`;
    });
  }

  function syncDualCoilTipAttachments(el) {
    if (!isDualCoilComponent(el)) return;
    const tips = [...el.querySelectorAll('.terminal.hb-tip')];
    tips.forEach((tip, idx) => {
      const target = getHbTipAttachedTerminal(el, idx);
      const wireId = el.dataset[`hbTip${idx}WireId`];
      const wire = wireId ? wires.get(wireId) : null;
      if (!target) {
        if (el.dataset[`hbTip${idx}AttachComp`]) setHbTipAttachment(el, idx, null);
        tip.classList.remove('is-attached');
        return;
      }
      tip.classList.add('is-attached');
      // Tip is the end of the coloured conductor — park it on the lug
      parkHbTipOnTerminal(el, tip, target);
      if (!wire || !document.body.contains(wire.group)) {
        createHbTipLeadWire(el, idx, tip, target);
      } else {
        if (wire.start.terminal === tip) wire.end.terminal = target;
        else if (wire.end.terminal === tip) wire.start.terminal = target;
        updateWirePosition(wire);
      }
    });
    updateDualCoilLeadPaths(el);
    persistHbTipPositions(el);
  }

  function syncAllDualCoilLeads() {
    components.forEach((comp) => {
      if (isDualCoilComponent(comp)) {
        syncDualCoilTipAttachments(comp);
        updateDualCoilLeadPaths(comp);
      }
    });
  }

  function eachHbTipAttachmentPair(fn) {
    components.forEach((comp) => {
      if (!isDualCoilComponent(comp)) return;
      const tips = [...comp.querySelectorAll('.terminal.hb-tip')];
      tips.forEach((tip, idx) => {
        const target = getHbTipAttachedTerminal(comp, idx);
        if (tip && target) fn(tip, target);
      });
    });
  }

  function setupDualCoilTipDrag(el) {
    if (el.dataset.hbTipBound === 'true') return;
    el.dataset.hbTipBound = 'true';
    const tips = [...el.querySelectorAll('.terminal.hb-tip')];
    tips.forEach((tip, idx) => {
      if (getHbTipAttachedTerminal(el, idx)) tip.classList.add('is-attached');
      tip.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (wireMode) return;
        // Attached tip + coloured fan = one conductor — hold to bend
        // (allowed in wire-focus so fan leads stay selectable / cyclable)
        const attached = getHbTipAttachedTerminal(el, idx);
        if (attached && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          beginHbConductorHold(el, idx, e);
          setStatus('Lead selected — drag or +/- / wheel to bend (Shift-drag tip to re-route)');
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        {
          const lead = getHbTipLeadWire(el, idx);
          if (lead) selectWire(lead);
        }
        heldHbConductor = { compId: el.dataset.id, tipIdx: idx };
        tip.classList.add('is-dragging');
        setHbTipAttachment(el, idx, null);
        let hoverTarget = null;

        function onMove(ev) {
          clearCapLeadAttachHighlights();
          hoverTarget = findHbTipAttachTarget(el, ev.clientX, ev.clientY);
          placeHbTipAtClient(el, tip, ev.clientX, ev.clientY);
          if (hoverTarget) {
            hoverTarget.classList.add('cap-lead-attach-target');
            const center = getTerminalCenter(hoverTarget);
            showSnapIndicator(center.x, center.y);
            setStatus(`Connect ${tip.dataset.tipLabel || tip.dataset.terminalLabel || 'lead'} → ${hoverTarget.dataset.terminalLabel || 'terminal'}`);
          } else {
            snapIndicator.classList.add('hidden');
            setStatus(`Dragging ${tip.dataset.tipLabel || 'fan'} lead · +/- bends`);
          }
          updateDualCoilLeadPaths(el);
          updateAllWirePositions();
        }
        function onUp() {
          tip.classList.remove('is-dragging');
          if (heldHbConductor?.compId === el.dataset.id && heldHbConductor?.tipIdx === idx) {
            heldHbConductor = null;
          }
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          clearCapLeadAttachHighlights();
          snapIndicator.classList.add('hidden');
          if (hoverTarget && document.body.contains(hoverTarget)) {
            setHbTipAttachment(el, idx, hoverTarget);
            syncDualCoilTipAttachments(el);
            clearCapLeadAttachHighlights();
            snapIndicator.classList.add('hidden');
            document.body.classList.remove('snap-active');
            refreshShortCircuitCheck();
            validateYesGroundConnections();
            refreshLightningWireGlow();
            setStatus(`Lead wired to ${hoverTarget.dataset.terminalLabel || 'terminal'}`);
          } else {
            setHbTipAttachment(el, idx, null);
            persistHbTipPositions(el);
            setStatus('Fan lead placed');
          }
          markProjectDirty();
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }

  function setupDualCoilLoomDrag(el, hitSvg) {
    if (!hitSvg || hitSvg.dataset.hbLoomBound === 'true') return;
    hitSvg.dataset.hbLoomBound = 'true';
    const hit = hitSvg.querySelector('.hb-loom-hit');
    const vis = el.querySelector('.hb-leads-svg .hb-loom');
    if (!hit) return;

    hit.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (wireMode) return;
      if (wireEditFocusMode) return;
      e.preventDefault();
      e.stopPropagation();
      selectComponent(el);
      hit.classList.add('is-dragging');
      vis?.classList.add('is-dragging');
      const tips = [...el.querySelectorAll('.terminal.hb-tip')];
      const startJ = getHbJunction(el);
      const startLocal = clientToDualCoilLocal(el, e.clientX, e.clientY);
      const grabDx = startJ.x - startLocal.x;
      const grabDy = startJ.y - startLocal.y;
      const tipOrigins = tips.map((tip) => ({
        left: parseFloat(tip.style.left) || 0,
        top: parseFloat(tip.style.top) || 0,
        attached: tip.classList.contains('is-attached'),
      }));

      function onMove(ev) {
        const local = clientToDualCoilLocal(el, ev.clientX, ev.clientY);
        const jx = local.x + grabDx;
        const jy = local.y + grabDy;
        const dx = jx - startJ.x;
        const dy = jy - startJ.y;
        setHbJunction(el, jx, jy);
        tips.forEach((tip, idx) => {
          if (tipOrigins[idx].attached || getHbTipAttachedTerminal(el, idx)) return;
          tip.style.left = `${tipOrigins[idx].left + dx}px`;
          tip.style.top = `${tipOrigins[idx].top + dy}px`;
        });
        persistHbTipPositions(el);
        updateDualCoilLeadPaths(el);
        updateAllWirePositions();
        setStatus('Moving humbucker loom end');
      }
      function onUp() {
        hit.classList.remove('is-dragging');
        vis?.classList.remove('is-dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        markProjectDirty();
        setStatus('Loom end placed');
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    hitSvg.querySelectorAll('[data-hb-fan-hit]').forEach((g) => {
      const idx = Number(g.dataset.hbFanHit);
      const fanHit = g.querySelector('.hb-fan-hit');
      fanHit?.addEventListener('click', (e) => {
        if (!wireMode) return;
        e.preventDefault();
        e.stopPropagation();
        const tip = el.querySelectorAll('.terminal.hb-tip')[idx];
        tip?.click();
      });
      fanHit?.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (wireMode) return;
        const tip = el.querySelectorAll('.terminal.hb-tip')[idx];
        if (!tip) return;
        e.preventDefault();
        e.stopPropagation();
        const attached = getHbTipAttachedTerminal(el, idx);
        if (attached && !e.shiftKey) {
          beginHbConductorHold(el, idx, e);
          setStatus('Lead selected — drag or +/- / wheel to bend (Shift-drag tip to re-route)');
          return;
        }
        // Unattached: bend conductor in place (same as tip), or Shift to re-route tip
        // (wire-focus keeps coloured fans interactive for select / cycle / bend)
        if (!e.shiftKey) {
          beginHbConductorHold(el, idx, e);
          return;
        }
        tip.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: e.clientX,
          clientY: e.clientY,
          shiftKey: true,
        }));
      });
    });
  }

  function ensureHbPath(parent, className, beforeSelector) {
    let el = parent.querySelector(`.${className}`);
    if (!el) {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('class', className);
      el.setAttribute('fill', 'none');
      el.setAttribute('stroke-linecap', 'round');
      el.setAttribute('stroke-linejoin', 'round');
      const before = beforeSelector ? parent.querySelector(beforeSelector) : null;
      if (before) parent.insertBefore(el, before);
      else parent.appendChild(el);
    }
    return el;
  }

  function ensureHbPlasticDefs(svg) {
    if (!svg || svg.querySelector('#hb-plastic-defs')) return;
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.id = 'hb-plastic-defs';
    defs.innerHTML = `
      <filter id="hb-plastic-sheen" x="-40%" y="-40%" width="180%" height="180%">
        <feTurbulence type="fractalNoise" baseFrequency="2.4 0.35" numOctaves="2" seed="11" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.85" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    `;
    svg.insertBefore(defs, svg.firstChild);
  }

  function ensureDualCoilLeadTipEls(visSvg) {
    if (!visSvg) return;
    ensureHbPlasticDefs(visSvg);
    visSvg.querySelectorAll('.hb-loom-tip-start, .hb-loom-tip-end, .hb-fan-tip-start').forEach((n) => n.remove());
    visSvg.querySelectorAll('[data-hb-fan]').forEach((g) => {
      ensureHbPath(g, 'hb-fan-outline', '.hb-fan');
      // Tip behind sleeve
      ensureHbPath(g, 'hb-fan-tip-end', '.hb-fan');
      ensureHbPath(g, 'hb-fan-plastic');
      const plastic = g.querySelector('.hb-fan-plastic');
      plastic?.classList.add('hb-plastic');
      plastic?.setAttribute('filter', 'url(#hb-plastic-sheen)');
    });
    ensureHbPath(visSvg, 'hb-loom-border', '.hb-loom');
    ensureHbPath(visSvg, 'hb-loom-plastic');
    const loomPlastic = visSvg.querySelector('.hb-loom-plastic');
    loomPlastic?.classList.add('hb-plastic');
    loomPlastic?.setAttribute('filter', 'url(#hb-plastic-sheen)');
  }

  function ensureDualCoilLeads(el) {
    if (!isDualCoilComponent(el)) return;
    restoreHbTipPositions(el);
    if (!el.dataset.hbWireLayer) el.dataset.hbWireLayer = String(activeLayer || 1);

    let visSvg = el.querySelector('.hb-leads-svg');
    let hitSvg = el.querySelector('.hb-leads-hit-svg');

    // Migrate old single-svg layout (hits lived in the visual svg).
    if (visSvg && !hitSvg) {
      visSvg.querySelectorAll('.hb-loom-hit, .hb-fan-hit').forEach((n) => n.remove());
    }

    if (!visSvg) {
      visSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      visSvg.setAttribute('class', 'hb-leads-svg');
      visSvg.setAttribute('aria-hidden', 'true');

      for (let i = 0; i < HB_FAN_COUNT; i++) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.dataset.hbFan = String(i);
        const fan = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        fan.setAttribute('class', 'hb-fan');
        fan.setAttribute('fill', 'none');
        fan.setAttribute('stroke-width', String(HB_FAN_STROKE));
        g.appendChild(fan);
        visSvg.appendChild(g);
      }

      const loom = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      loom.setAttribute('class', 'hb-loom');
      loom.setAttribute('fill', 'none');
      loom.setAttribute('stroke-width', String(HB_LOOM_STROKE));
      visSvg.appendChild(loom);
    }

    if (!hitSvg) {
      hitSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      hitSvg.setAttribute('class', 'hb-leads-hit-svg');
      hitSvg.setAttribute('aria-hidden', 'true');

      for (let i = 0; i < HB_FAN_COUNT; i++) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.dataset.hbFanHit = String(i);
        const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hit.setAttribute('class', 'hb-fan-hit');
        hit.setAttribute('fill', 'none');
        hit.setAttribute('stroke-width', String(HB_FAN_HIT_STROKE));
        g.appendChild(hit);
        hitSvg.appendChild(g);
      }

      const loomHit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      loomHit.setAttribute('class', 'hb-loom-hit');
      loomHit.setAttribute('fill', 'none');
      loomHit.setAttribute('stroke-width', String(HB_LOOM_HIT_STROKE));
      hitSvg.appendChild(loomHit);
    }

    ensureDualCoilLeadTipEls(visSvg);
    orderDualCoilLeadSvg(el, visSvg, hitSvg);
    setupDualCoilLoomDrag(el, hitSvg);
    setupDualCoilTipDrag(el);
    requestAnimationFrame(() => {
      syncDualCoilTipAttachments(el);
      updateDualCoilLeadPaths(el);
    });
  }

  function setComponentGroundFlash(el, enabled) {
    if (!el) return;
    el.dataset.groundFlash = enabled ? 'true' : 'false';
  }

  function componentGroundFlashEnabled(el) {
    if (!el) return true;
    return el.dataset.groundFlash !== 'false';
  }

  function ensureAssetConfigValueFields() {
    const host = document.getElementById('asset-config-value-fields');
    if (!host || host.dataset.ready === '1') return host;
    host.replaceChildren();
    Object.values(GuitarAssets.ELECTRICAL_VALUE_DEFS || {}).forEach((def) => {
      const row = document.createElement('label');
      row.className = 'asset-config-field-row hidden';
      row.dataset.valueKey = def.key;
      row.id = `asset-config-${def.key}-row`;
      const label = document.createElement('span');
      label.className = 'asset-config-field-label';
      label.textContent = def.label;
      const input = document.createElement('input');
      input.type = 'text';
      input.id = `asset-config-${def.key}`;
      input.className = 'asset-config-field-input';
      input.placeholder = def.placeholder || '';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('aria-label', def.label);
      input.dataset.valueKey = def.key;
      row.appendChild(label);
      row.appendChild(input);
      host.appendChild(row);
    });
    host.dataset.ready = '1';
    return host;
  }

  function syncAssetConfigMenuContent(comp) {
    const groundRow = document.getElementById('asset-config-ground-row');
    const groundToggle = document.getElementById('asset-config-grounding');
    const switchThrowRow = document.getElementById('asset-config-switch-throw-row');
    const switchThrowEl = document.getElementById('asset-config-switch-throw');
    const switchTypeRow = document.getElementById('asset-config-switch-type-row');
    const switchTypeToggle = document.getElementById('asset-config-switch-type');
    const flashRow = document.getElementById('asset-config-flash-row');
    const flashToggle = document.getElementById('asset-config-flashing');
    const valueHost = ensureAssetConfigValueFields();
    const isOutput = isOutputJackComponent(comp);
    const isToggle = isToggleSwitchComponent(comp);
    const valueKeys = new Set(getTemplateValueFieldDefs(comp).map((d) => d.key));

    if (groundRow) groundRow.classList.toggle('hidden', isOutput || !comp);
    if (switchThrowRow) switchThrowRow.classList.toggle('hidden', !isToggle || !comp);
    if (switchTypeRow) switchTypeRow.classList.toggle('hidden', !isToggle || !comp);
    if (flashRow) flashRow.classList.toggle('hidden', !isOutput);

    valueHost?.querySelectorAll('[data-value-key]').forEach((row) => {
      const key = row.dataset.valueKey;
      const show = !!comp && valueKeys.has(key);
      row.classList.toggle('hidden', !show);
      const input = row.querySelector('input');
      if (show && input && document.activeElement !== input) {
        input.value = getComponentElectricalValue(comp, key);
      }
    });

    if (!isOutput && groundToggle && comp) {
      groundToggle.checked = componentNeedsGrounding(comp);
    }
    if (isToggle && switchThrowEl && comp) {
      switchThrowEl.textContent = getToggleSwitchThrowLabel(getToggleSwitchThrow(comp));
    }
    if (isToggle && switchTypeToggle && switchTypeRow && comp) {
      const type = getToggleSwitchType(comp);
      switchTypeToggle.checked = type === 2;
      switchTypeRow.dataset.activeType = String(type);
    }
    if (isOutput && flashToggle && comp) {
      flashToggle.checked = componentGroundFlashEnabled(comp);
    }
  }

  function openAssetConfigMenu() {
    if (!assetConfigMenu || !assetConfigBtn) return;
    if (assetConfigBtn.classList.contains('hidden')) return;
    const comp = getSingleSelectedComponent();
    syncAssetConfigMenuContent(comp);
    assetConfigMenu.classList.remove('hidden');
    assetConfigBtn.setAttribute('aria-expanded', 'true');
    updateAssetConfigChrome();
  }

  function toggleAssetConfigMenu() {
    if (!assetConfigMenu) return;
    if (assetConfigMenu.classList.contains('hidden')) openAssetConfigMenu();
    else closeAssetConfigMenu();
  }

  function updateAssetConfigChrome() {
    if (!assetConfigBtn || !assetConfigMenu) return;
    const comp = getSingleSelectedComponent();
    if (!comp || selectedWireGroups.size > 0) {
      assetConfigBtn.classList.add('hidden');
      closeAssetConfigMenu();
      updateAssetStateChrome();
      return;
    }

    const bounds = getComponentChromeBounds(comp);
    const btnSize = ASSET_CONFIG_BTN_SIZE;
    const gap = 4;
    const btnLeft = bounds.right + gap;
    const btnTop = bounds.top;

    assetConfigBtn.style.left = `${btnLeft}px`;
    assetConfigBtn.style.top = `${btnTop}px`;
    assetConfigBtn.classList.remove('hidden');
    syncAssetConfigMenuContent(comp);

    if (!assetConfigMenu.classList.contains('hidden')) {
      assetConfigMenu.style.left = `${btnLeft + btnSize + 4}px`;
      assetConfigMenu.style.top = `${Math.max(0, btnTop)}px`;
    }
    updateAssetStateChrome();
  }

  function getSingleSelectedComponent() {
    if (selectedComponents.size !== 1) return null;
    return [...selectedComponents][0];
  }

  function updateSelectionStatus() {
    const total = selectedComponents.size + selectedWireGroups.size;
    if (total === 0) {
      setStatus(wireMode ? `Click start point (Layer ${activeLayer})` : 'Ready');
      updateAlignBar();
      updateAssetConfigChrome();
      return;
    }
    if (total === 1 && selectedWireGroups.size === 1) {
      const wire = wires.get([...selectedWireGroups][0].dataset.id);
      if (wire) {
        const stack = layerState[wire.layer].above ? 'front' : 'back';
        const slackHint = wire.slack ? `, slack ${wire.slack}px` : '';
        const kindHint = wire.wireKind === '4conductor' ? ', 4 Conductor' : '';
        setStatus(`Wire L${wire.layer} (${stack}, ${wire.color}${slackHint}${kindHint}) — drag to move · double-click sleeve to bend · tip to re-route · +/- / wheel · Delete`);
      }
      updateAlignBar();
      updateAssetConfigChrome();
      return;
    }
    if (total === 1 && selectedComponents.size === 1) {
      const el = [...selectedComponents][0];
      const stateHint = (() => {
        const template = GuitarAssets.getTemplate(el.dataset.assetId);
        if (!template || !template.states?.length) return '';
        if (!GuitarAssets.hasAssetStates(el)) return '';
        const label = GuitarAssets.getComponentStateLabel(el);
        return ` · ${label} · E next · tap Q prev · hold Q recent`;
      })();
      setStatus(`${el.dataset.type} selected — Delete to remove · Shift=free drag · +/- or ↺↻ to rotate${stateHint}`);
      updateAlignBar();
      updateAssetConfigChrome();
      return;
    }
    setStatus(`${total} selected (${selectedComponents.size} parts, ${selectedWireGroups.size} wires) — drag to move · double-click a wire sleeve to bend · Delete`);
    updateAlignBar();
    updateAssetConfigChrome();
  }

  function normalizeRect(x1, y1, x2, y2) {
    return {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      right: Math.max(x1, x2),
      bottom: Math.max(y1, y2),
    };
  }

  function rectsIntersect(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  function getComponentRect(comp) {
    const left = parseFloat(comp.style.left) || 0;
    const top = parseFloat(comp.style.top) || 0;
    return {
      left,
      top,
      right: left + comp.offsetWidth,
      bottom: top + comp.offsetHeight,
    };
  }

  function getWireBounds(wire) {
    const startPt = { x: wire.start.x, y: wire.start.y };
    const endPt = { x: wire.end.x, y: wire.end.y };
    const samples = flattenWireRoute(getWireRoutePoints(wire, startPt, endPt), wire.slack || 0, 8);
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    samples.forEach((p) => {
      left = Math.min(left, p.x);
      top = Math.min(top, p.y);
      right = Math.max(right, p.x);
      bottom = Math.max(bottom, p.y);
    });
    if (!Number.isFinite(left)) {
      left = Math.min(startPt.x, endPt.x);
      top = Math.min(startPt.y, endPt.y);
      right = Math.max(startPt.x, endPt.x);
      bottom = Math.max(startPt.y, endPt.y);
    }
    const pad = 4;
    return {
      left: left - pad,
      top: top - pad,
      right: right + pad,
      bottom: bottom + pad,
    };
  }

  function canStartMarquee(e) {
    if (e.button !== 0) return false;
    if (wireMode) return false;
    if (dimTool && dimTool.phase !== 'done') return false;
    if (moveTool) return false;
    if (placementMode) return false;
    if (e.target.classList.contains('terminal')) return false;
    if (e.target.closest('.component') || e.target.closest('.wire-group')) return false;
    if (e.target.closest('.dim-annotation')) return false;
    if (e.target.closest('.note-window')) return false;
    if (e.target.closest('#asset-config-btn') || e.target.closest('#asset-config-menu')) return false;
    if (e.target.closest('#asset-state-chrome') || e.target.closest('#asset-state-term-menu')) return false;
    if (e.target.closest('.panel-snap-point')) return false;
    return e.target === canvas
      || e.target === workspace
      || e.target === marqueeBox
      || e.target.closest('.wire-stack')
      || e.target.classList.contains('layer-group');
  }

  function updateMarqueeBox(rect) {
    marqueeBox.classList.remove('hidden');
    marqueeBox.style.left = `${rect.left}px`;
    marqueeBox.style.top = `${rect.top}px`;
    marqueeBox.style.width = `${Math.max(0, rect.right - rect.left)}px`;
    marqueeBox.style.height = `${Math.max(0, rect.bottom - rect.top)}px`;
  }

  function hideMarqueeBox() {
    marqueeBox.classList.add('hidden');
    marqueeBox.style.width = '0';
    marqueeBox.style.height = '0';
  }

  function getPanelSnapRect(entry) {
    const size = 8;
    const half = size / 2;
    return {
      left: entry.x - half,
      top: entry.y - half,
      right: entry.x + half,
      bottom: entry.y + half,
    };
  }

  function applyMarqueeSelection(rect, opts = {}) {
    const additive = !!opts.additive;
    if (!additive) deselectAll();
    if (!wireEditFocusMode) {
      components.forEach((comp) => {
        if (activeWorkspacePage === 'panel' && getComponentWorkspacePage(comp) !== 'panel') return;
        if (activeWorkspacePage === 'electronics' && getComponentWorkspacePage(comp) !== 'electronics') return;
        if (!panelLayerVisible && getComponentWorkspacePage(comp) === 'panel') return;
        if (rectsIntersect(rect, getComponentRect(comp))) {
          comp.classList.add('selected');
          selectedComponents.add(comp);
        }
      });
    }
    if (activeWorkspacePage !== 'panel') {
      wires.forEach((wire) => {
        if (rectsIntersect(rect, getWireBounds(wire))) {
          wire.group.classList.add('selected');
          selectedWireGroups.add(wire.group);
        }
      });
    }
    if (activeWorkspacePage === 'panel' && panelLayerVisible) {
      panelSnapPoints.forEach((entry) => {
        if (!rectsIntersect(rect, getPanelSnapRect(entry))) return;
        entry.el.classList.add('selected');
        selectedPanelSnapIds.add(entry.el.dataset.id);
      });
    }
    dimAnnotations.forEach((entry) => {
      if (!rectsIntersect(rect, getDimAnnotationRect(entry))) return;
      entry.el.classList.add('selected');
      selectedDimAnnotationIds.add(entry.id);
    });
    syncWireToolbarFromSelection();
    updateSelectionStatus();
    syncSelectedWireConnectHighlights();
    updateWireGaugeReadout();
    if (selectedDimAnnotationIds.size > 0 && selectedComponents.size === 0 && selectedWireGroups.size === 0) {
      const n = selectedDimAnnotationIds.size;
      setStatus(
        n === 1
          ? 'Dimension label selected — drag to move · Delete to remove'
          : `${n} dimension labels selected — drag to move · Delete to remove`
      );
    } else if (selectedPanelSnapIds.size > 0 && selectedComponents.size === 0) {
      const n = selectedPanelSnapIds.size;
      setStatus(
        n === 1
          ? 'Panel snap point selected — drag to move · Delete to remove'
          : `${n} panel snap points selected — Delete to remove`
      );
    }
  }

  function finishMarquee(e) {
    if (!marqueeStart) return;
    const end = getCanvasCoords(e);
    const rect = normalizeRect(marqueeStart.x, marqueeStart.y, end.x, end.y);
    const dragged = marqueeActive
      || Math.abs(rect.right - rect.left) >= MARQUEE_MIN_PX
      || Math.abs(rect.bottom - rect.top) >= MARQUEE_MIN_PX;

    if (dragged) {
      if (wireDraftStart) cancelWireDraft();
      applyMarqueeSelection(rect, { additive: !!(e && e.shiftKey) });
      suppressNextClick = true;
    }

    marqueeStart = null;
    marqueeActive = false;
    hideMarqueeBox();
  }

  function initLayerGroups() {
    [wiresBelow, wiresAbove].forEach((stack, stackIdx) => {
      ensureWireClothDefs(stack);
      const key = stackIdx === 0 ? 'below' : 'above';
      for (let i = 1; i <= LAYER_COUNT; i++) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'layer-group visible');
        g.dataset.layer = String(i);
        stack.appendChild(g);
        layerGroups[key][i] = g;
      }
    });
  }

  function ensureWireClothDefs(stack) {
    if (!stack || stack.querySelector('#wire-cloth-defs')) return;
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.id = 'wire-cloth-defs';
    defs.innerHTML = `
      <filter id="wire-cloth-rough" x="-50%" y="-50%" width="200%" height="200%">
        <feTurbulence type="fractalNoise" baseFrequency="1.8 0.45" numOctaves="2" seed="7" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.35" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    `;
    stack.insertBefore(defs, stack.firstChild);
  }

  function initLayerUI() {
    layerButtonsEl.innerHTML = '';
    for (let i = 1; i <= LAYER_COUNT; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tool-btn layer-select-btn';
      btn.textContent = String(i);
      btn.dataset.layer = String(i);
      btn.title = `Layer ${i}`;
      btn.addEventListener('click', () => setActiveLayer(i));
      layerButtonsEl.appendChild(btn);
    }
    updateLayerUI();
  }

  function setActiveLayer(layer) {
    activeLayer = layer;
    updateLayerUI();
    setStatus(`Layer ${layer} active${layerState[layer].above ? ' (front)' : ' (back)'}`);
  }

  function updateLayerUI() {
    layerButtonsEl.querySelectorAll('.layer-select-btn').forEach((btn) => {
      const layer = Number(btn.dataset.layer);
      const state = layerState[layer];
      btn.classList.toggle('active', layer === activeLayer);
      btn.classList.toggle('hidden-layer', !state.visible);
      btn.classList.toggle('above-layer', state.above);
    });
    const state = layerState[activeLayer];
    btnLayerVisibility.textContent = state.visible ? 'Hide' : 'Show';
    btnLayerFront.classList.toggle('active', state.above);
    btnLayerBack.classList.toggle('active', !state.above);
  }

  function toggleLayerVisibility() {
    const state = layerState[activeLayer];
    state.visible = !state.visible;
    applyLayerVisibility(activeLayer);
    updateLayerUI();
    markProjectDirty();
    setStatus(`Layer ${activeLayer} ${state.visible ? 'shown' : 'hidden'}`);
  }

  function applyLayerVisibility(layer) {
    const visible = layerState[layer].visible;
    layerGroups.below[layer].classList.toggle('hidden', !visible);
    layerGroups.below[layer].classList.toggle('visible', visible);
    layerGroups.above[layer].classList.toggle('hidden', !visible);
    layerGroups.above[layer].classList.toggle('visible', visible);
    syncAllNoteWindowVisibility();
    moveAllHbWorldLeads();
  }

  function setLayerAbove(layer, above) {
    if (layerState[layer].above === above) return;
    layerState[layer].above = above;
    wires.forEach((wire) => {
      if (wire.layer === layer) moveWireToStack(wire);
    });
    selectedComponents.forEach((comp) => {
      if (!isDualCoilComponent(comp)) return;
      comp.dataset.hbWireLayer = String(layer);
      for (let i = 0; i < HB_FAN_COUNT; i++) {
        const wireId = comp.dataset[`hbTip${i}WireId`];
        const wire = wireId ? wires.get(wireId) : null;
        if (!wire) continue;
        wire.layer = layer;
        wire.group.dataset.layer = String(layer);
        moveWireToStack(wire);
      }
    });
    moveAllHbWorldLeads();
    if (wirePreviewLine) movePreviewToActiveLayer();
    updateLayerUI();
    markProjectDirty();
    setStatus(`Layer ${layer} ${above ? 'in front of' : 'behind'} components`);
  }

  function getLayerGroup(layer, above) {
    return above ? layerGroups.above[layer] : layerGroups.below[layer];
  }

  function moveWireToStack(wire) {
    const container = getLayerGroup(wire.layer, wireStackAboveForLayer(wire.layer));
    container.appendChild(wire.group);
  }

  function movePreviewToActiveLayer() {
    if (!wirePreviewLine) return;
    const container = getLayerGroup(activeLayer, wireStackAboveForLayer(activeLayer));
    container.appendChild(wirePreviewLine);
  }

  function registerTerminalWire(terminal, wireId) {
    if (!terminal) return;
    if (!terminalWireMap.has(terminal)) {
      terminalWireMap.set(terminal, new Set());
    }
    const set = terminalWireMap.get(terminal);
    const before = set.size;
    set.add(wireId);
    updateTerminalBadge(terminal);
    if (set.size !== before) notifySchematicCircuitChanged();
  }

  function unregisterTerminalWire(terminal, wireId) {
    if (!terminal) return;
    const set = terminalWireMap.get(terminal);
    if (!set) return;
    const before = set.size;
    set.delete(wireId);
    if (set.size === 0) terminalWireMap.delete(terminal);
    updateTerminalBadge(terminal);
    if (set.size !== before) notifySchematicCircuitChanged();
  }

  function updateTerminalBadge(terminal) {
    const count = terminalWireMap.get(terminal)?.size || 0;
    terminal.classList.toggle('has-wires', count > 0);
    let badge = terminal.querySelector('.wire-count');
    if (count > 1) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'wire-count';
        terminal.appendChild(badge);
      }
      badge.textContent = String(count);
    } else if (badge) {
      badge.remove();
    }
  }

  function updateAllTerminalBadges() {
    terminalWireMap.forEach((_, terminal) => updateTerminalBadge(terminal));
  }

  function setAssetPlacement(assetId) {
    placementMode = assetId;
    if (assetId) {
      recordRecentAsset(assetId);
      if (wireMode) setWireMode(false);
      if (panelSnapMode) {
        panelSnapMode = false;
        document.getElementById('context-menu-power')?.classList.remove('panel-snap-active');
      }
    } else {
      clearPlacementSnapHover();
    }
    syncPanelSnapVisuals();
    const template = assetId ? GuitarAssets.getTemplate(assetId) : null;
    setStatus(
      template
        ? `Click canvas to place ${template.name}${
            activeWorkspacePage === 'electronics' && panelSnapPoints.size > 0
              ? ' · snap points active'
              : ''
          }`
        : wireMode
          ? wireDraftStart
            ? 'Click end point for wire'
            : `Click start point for wire (Layer ${activeLayer})`
          : 'Ready'
    );
  }

  function setPlacementMode(mode) {
    setAssetPlacement(mode);
  }

  function setWireMode(active) {
    wireMode = active;
    document.body.classList.toggle('wire-mode', !!active);
    if (active) {
      cancelMoveTool();
      cancelDimensionTool();
      setAssetPlacement(null);
      if (panelSnapMode) {
        panelSnapMode = false;
        const powerBtn = document.getElementById('context-menu-power');
        powerBtn?.classList.remove('panel-snap-active');
      }
      if (activeWorkspacePage === 'panel') {
        setActiveWorkspacePage('electronics');
      }
      setWireGaugeBarVisible(true);
    } else {
      cancelWireDraft();
      clearSnapState();
      setWireGaugeBarVisible(false);
    }
    btnWire.classList.toggle('active', active);
    setStatus(
      active
        ? wireDraftStart
          ? 'Click anchors to curve, or a terminal to finish'
          : `Click start terminal (Layer ${activeLayer}) — then anchors, then end terminal`
        : 'Ready'
    );
  }

  function setWireStyle(style) {
    wireStyle = style;
    btnSolid.classList.toggle('active', style === 'solid');
    btnDashed.classList.toggle('active', style === 'dashed');
    const dashed = style === 'dashed';
    if (selectedWireGroups.size === 0) return;
    selectedWireGroups.forEach((group) => {
      const wire = wires.get(group.dataset.id);
      if (!wire || wire.dashed === dashed) return;
      wire.dashed = dashed;
      updateWirePosition(wire);
      markProjectDirty();
    });
    updateSelectionStatus();
  }

  function setWireColor(color) {
    if (!WIRE_COLORS[color]) return;
    wireColor = color;
    colorSwatches.forEach((swatch) => {
      swatch.classList.toggle('active', swatch.dataset.color === color);
    });
    if (selectedWireGroups.size === 0) return;
    selectedWireGroups.forEach((group) => {
      const wire = wires.get(group.dataset.id);
      if (!wire || wire.color === color) return;
      wire.color = color;
      updateWirePosition(wire);
      markProjectDirty();
    });
    updateSelectionStatus();
  }

  function setWireGauge(mm) {
    const next = Number(mm);
    if (!Number.isFinite(next) || next <= 0) return;
    wireGaugeMm = next;
    syncWireGaugeUi();
    applyPreviewStrokeWidth();
    // Selected wires only (like setWireColor); unselected keep their gaugeMm.
    if (selectedWireGroups.size === 0) return;
    selectedWireGroups.forEach((group) => {
      const wire = wires.get(group.dataset.id);
      if (!wire || isDimensionalGaugeExempt(wire)) return;
      wire.gaugeMm = next;
      applyNonHbWireGaugeStroke(wire);
      markProjectDirty();
    });
    updateSelectionStatus();
    updateWireGaugeReadout();
  }

  function syncWireToolbarFromSelection() {
    if (selectedWireGroups.size !== 1 || selectedComponents.size > 0) return;
    const wire = wires.get([...selectedWireGroups][0].dataset.id);
    if (!wire) return;
    wireColor = wire.color;
    colorSwatches.forEach((swatch) => {
      swatch.classList.toggle('active', swatch.dataset.color === wire.color);
    });
    wireStyle = wire.dashed ? 'dashed' : 'solid';
    btnSolid.classList.toggle('active', !wire.dashed);
    btnDashed.classList.toggle('active', !!wire.dashed);
    if (Number.isFinite(wire.gaugeMm)) {
      wireGaugeMm = wire.gaugeMm;
      syncWireGaugeUi();
    }
  }

  function resizeWireStacks() {
    const w = WORKSPACE_SIZE;
    const h = WORKSPACE_SIZE;
    [wiresBelow, wiresAbove].forEach((stack) => {
      stack.setAttribute('width', w);
      stack.setAttribute('height', h);
      stack.setAttribute('viewBox', `0 0 ${w} ${h}`);
    });
    resizeDimLayer();
    updateAllWirePositions();
  }

  function getEndpointFromEvent(e) {
    if (e.target.classList.contains('terminal')) {
      return { type: 'terminal', el: e.target };
    }
    return { type: 'point', clientX: e.clientX, clientY: e.clientY };
  }

  function resolveEndpoint(endpoint) {
    if (endpoint.type === 'terminal') {
      const c = getTerminalCenter(endpoint.el);
      const world = clientToWorld(c.x, c.y);
      return {
        x: world.x,
        y: world.y,
        terminal: endpoint.el,
      };
    }
    if (snapPoint) {
      const world = clientToWorld(snapPoint.x, snapPoint.y);
      return {
        x: world.x,
        y: world.y,
        terminal: snappedTerminal,
      };
    }
    const world = clientToWorld(endpoint.clientX, endpoint.clientY);
    return {
      x: world.x,
      y: world.y,
      terminal: null,
    };
  }

  function cancelWireDraft() {
    wireDraftStart = null;
    wireDraftAnchors = [];
    if (wirePreviewLine) {
      wirePreviewLine.remove();
      wirePreviewLine = null;
    }
  }

  function cancelActiveWireDraft() {
    if (!wireDraftStart) return false;
    cancelWireDraft();
    setStatus(wireMode ? `Click start terminal (Layer ${activeLayer})` : 'Ready');
    return true;
  }

  function ensurePreviewLine() {
    if (wirePreviewLine) return wirePreviewLine;
    wirePreviewLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    wirePreviewLine.setAttribute('class', `wire-preview ${wireStyle === 'dashed' ? 'dashed' : ''}`);
    wirePreviewLine.setAttribute('fill', 'none');
    wirePreviewLine.setAttribute('stroke', WIRE_COLORS[wireColor]);
    applyPreviewStrokeWidth();
    movePreviewToActiveLayer();
    return wirePreviewLine;
  }

  function updatePreviewLine(clientX, clientY) {
    if (!wireDraftStart) return;
    const end = clientToWorld(clientX, clientY);
    const pts = [
      { x: wireDraftStart.x, y: wireDraftStart.y },
      ...wireDraftAnchors,
      { x: end.x, y: end.y },
    ];
    const preview = ensurePreviewLine();
    preview.setAttribute('d', buildSmoothPathThroughPoints(pts));
    preview.setAttribute('stroke', WIRE_COLORS[wireColor]);
    applyPreviewStrokeWidth();
    preview.setAttribute('class', `wire-preview ${wireStyle === 'dashed' ? 'dashed' : ''}`);
  }

  function getSelectedWireObject() {
    if (selectedWireGroups.size !== 1) return null;
    const group = [...selectedWireGroups][0];
    return wires.get(group.dataset.id) || null;
  }

  /** Capacitor lead / 2-point slack bow (unchanged). */
  function buildWirePath(x1, y1, x2, y2, slack) {
    if (!slack) {
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    }
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const cx = mx + (-dy / len) * slack;
    const cy = my + (dx / len) * slack;
    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  }

  function getWireRoutePoints(wire, startPt, endPt) {
    const pts = [{ x: startPt.x, y: startPt.y }];
    (wire.anchors || []).forEach((a) => {
      if (a && Number.isFinite(a.x) && Number.isFinite(a.y)) pts.push({ x: a.x, y: a.y });
    });
    pts.push({ x: endPt.x, y: endPt.y });
    return pts;
  }

  function buildSmoothPathThroughPoints(points) {
    if (!points || points.length < 2) return '';
    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
    }
    return d;
  }

  function buildRoutedWirePath(points, slack) {
    if (!points || points.length < 2) return '';
    if (points.length === 2) {
      return buildWirePath(points[0].x, points[0].y, points[1].x, points[1].y, slack || 0);
    }
    return buildSmoothPathThroughPoints(points);
  }

  function sampleQuadratic(p0, c, p2, t) {
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * c.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * c.y + t * t * p2.y,
    };
  }

  function sampleCubic(p0, c1, c2, p3, t) {
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
    };
  }

  function flattenWireRoute(points, slack, stepsPerSeg = 10) {
    if (!points || points.length < 2) return points ? [...points] : [];
    if (points.length === 2) {
      const p0 = points[0];
      const p2 = points[1];
      if (!slack) {
        const out = [];
        for (let i = 0; i <= stepsPerSeg; i++) {
          const t = i / stepsPerSeg;
          out.push({ x: p0.x + (p2.x - p0.x) * t, y: p0.y + (p2.y - p0.y) * t });
        }
        return out;
      }
      const dx = p2.x - p0.x;
      const dy = p2.y - p0.y;
      const len = Math.hypot(dx, dy) || 1;
      const c = {
        x: (p0.x + p2.x) / 2 + (-dy / len) * slack,
        y: (p0.y + p2.y) / 2 + (dx / len) * slack,
      };
      const out = [];
      for (let i = 0; i <= stepsPerSeg; i++) {
        out.push(sampleQuadratic(p0, c, p2, i / stepsPerSeg));
      }
      return out;
    }
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
      const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
      for (let s = 0; s <= stepsPerSeg; s++) {
        if (i > 0 && s === 0) continue;
        out.push(sampleCubic(p1, c1, c2, p2, s / stepsPerSeg));
      }
    }
    return out;
  }

  function polylinePath(samples) {
    if (!samples.length) return '';
    return samples.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }

  function pointAlongSamples(samples, segLens, total, dist) {
    const target = Math.max(0, Math.min(total, dist));
    if (target <= 0) return { ...samples[0] };
    if (target >= total) return { ...samples[samples.length - 1] };
    let acc = 0;
    for (let i = 0; i < segLens.length; i++) {
      const next = acc + segLens[i];
      if (next >= target) {
        const t = segLens[i] < 1e-9 ? 0 : (target - acc) / segLens[i];
        return {
          x: samples[i].x + (samples[i + 1].x - samples[i].x) * t,
          y: samples[i].y + (samples[i + 1].y - samples[i].y) * t,
        };
      }
      acc = next;
    }
    return { ...samples[samples.length - 1] };
  }

  function tipPathsFromSamples(samples, options = {}) {
    const wantStart = options.start !== false;
    const wantEnd = options.end !== false;
    const underSleeve = !!options.underSleeve;
    const fraction = Number.isFinite(options.tipFraction) ? options.tipFraction : WIRE_TIP_FRACTION;
    if (!samples || samples.length < 2) {
      return { start: '', end: '', mid: '' };
    }
    const segLens = [];
    let total = 0;
    for (let i = 1; i < samples.length; i++) {
      const len = Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
      segLens.push(len);
      total += len;
    }
    if (total < 1e-6) {
      return { start: '', end: '', mid: polylinePath(samples) };
    }

    let tipLen = Math.max(WIRE_TIP_MIN_PX, total * fraction);
    tipLen = Math.min(tipLen, total * 0.45);
    const underlap = underSleeve && wantEnd ? Math.min(tipLen * 0.65, tipLen) : 0;
    const startCut = wantStart ? tipLen : 0;
    const midEnd = wantEnd ? total - tipLen : total;
    const tipBegin = wantEnd ? Math.max(startCut, midEnd - underlap) : total;
    const startJoin = pointAlongSamples(samples, segLens, total, startCut);
    const midJoin = pointAlongSamples(samples, segLens, total, midEnd);
    const tipJoin = pointAlongSamples(samples, segLens, total, tipBegin);

    let startPath = '';
    if (wantStart) {
      const startPts = [samples[0]];
      let acc = 0;
      for (let i = 0; i < segLens.length; i++) {
        const next = acc + segLens[i];
        if (next >= startCut) {
          startPts.push(startJoin);
          break;
        }
        startPts.push(samples[i + 1]);
        acc = next;
      }
      startPath = polylinePath(startPts);
    }

    let endPath = '';
    if (wantEnd) {
      const endPts = [tipJoin];
      let acc = 0;
      let past = false;
      for (let i = 0; i < segLens.length; i++) {
        const a1 = acc + segLens[i];
        if (!past) {
          if (a1 < tipBegin) {
            acc = a1;
            continue;
          }
          past = true;
          acc = a1;
          if (a1 > tipBegin + 1e-9) endPts.push(samples[i + 1]);
          continue;
        }
        endPts.push(samples[i + 1]);
        acc = a1;
      }
      if (endPts.length === 1) endPts.push(samples[samples.length - 1]);
      endPath = polylinePath(endPts);
    }

    const midPts = [startJoin];
    let acc = 0;
    for (let i = 0; i < segLens.length; i++) {
      const a0 = acc;
      const a1 = acc + segLens[i];
      if (a1 <= startCut) {
        acc = a1;
        continue;
      }
      if (a0 >= midEnd) break;
      if (a1 < midEnd) {
        midPts.push(samples[i + 1]);
      } else {
        midPts.push(midJoin);
        break;
      }
      acc = a1;
    }
    if (midPts.length === 1) midPts.push(midJoin);

    return {
      start: startPath,
      end: endPath,
      mid: polylinePath(midPts),
    };
  }

  function sampleBowPath(x1, y1, x2, y2, slack, steps = 16) {
    const out = [];
    for (let i = 0; i <= steps; i++) {
      out.push(pointOnWireBow(x1, y1, x2, y2, slack, i / steps));
    }
    return out;
  }

  function applyTipSplitToPathEls(samples, midEl, tipStartEl, tipEndEl, fullFallbackD, options) {
    const tips = tipPathsFromSamples(samples, options);
    if (midEl) midEl.setAttribute('d', tips.mid || fullFallbackD || '');
    if (tipStartEl) tipStartEl.setAttribute('d', tips.start || '');
    if (tipEndEl) tipEndEl.setAttribute('d', tips.end || '');
  }

  /** Legacy helpers for capacitor leads. */
  function sampleWirePoint(x1, y1, x2, y2, slack, t) {
    const tt = Math.max(0, Math.min(1, t));
    if (!slack) {
      return { x: x1 + (x2 - x1) * tt, y: y1 + (y2 - y1) * tt };
    }
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const cx = mx + (-dy / len) * slack;
    const cy = my + (dx / len) * slack;
    const u = 1 - tt;
    return {
      x: u * u * x1 + 2 * u * tt * cx + tt * tt * x2,
      y: u * u * y1 + 2 * u * tt * cy + tt * tt * y2,
    };
  }

  function buildWireSegmentPath(x1, y1, x2, y2, slack, t0, t1, steps = 5) {
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const t = t0 + (t1 - t0) * (i / steps);
      const p = sampleWirePoint(x1, y1, x2, y2, slack, t);
      d += i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`;
    }
    return d;
  }

  function createWirePathElement(className) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el.setAttribute('class', className);
    el.setAttribute('fill', 'none');
    return el;
  }

  function applyWireGeometry(wire, pathD, route) {
    const isHbLead = !!(wire.hbLeadCompId || wire.group?.dataset?.hbLead === 'true');
    // Tip-lead conductors are one continuous coloured path (no separate tip sleeves)
    if (!isHbLead && route?.points) {
      const samples = flattenWireRoute(route.points, route.slack || 0, 12);
      applyTipSplitToPathEls(
        samples,
        wire.visible,
        wire.tipStart,
        wire.tipEnd,
        pathD,
      );
      const sleeveD = wire.visible.getAttribute('d') || pathD;
      // Sleeve only: fat hit + select border (tips stay separate for re-route grabs)
      wire.hit.setAttribute('d', sleeveD);
      if (wire.selectBorder) wire.selectBorder.setAttribute('d', sleeveD);
      if (wire.outline) wire.outline.setAttribute('d', sleeveD);
      if (wire.cloth) wire.cloth.setAttribute('d', sleeveD);
      if (wire.tipStart) {
        wire.tipStart.setAttribute('stroke', WIRE_TIP_COLOR);
        wire.tipStart.setAttribute('stroke-linecap', 'butt');
        // Width: CSS tip 1 when legacy; dimensional stroke via applyNonHbWireGaugeStroke.
        wire.tipStart.removeAttribute('stroke-width');
      }
      if (wire.tipEnd) {
        wire.tipEnd.setAttribute('stroke', WIRE_TIP_COLOR);
        wire.tipEnd.setAttribute('stroke-linecap', 'butt');
        wire.tipEnd.removeAttribute('stroke-width');
      }
    } else {
      wire.hit.setAttribute('d', pathD);
      if (wire.selectBorder) wire.selectBorder.setAttribute('d', pathD);
      wire.visible.setAttribute('d', pathD);
      if (wire.outline) wire.outline.setAttribute('d', pathD);
      if (wire.cloth) wire.cloth.setAttribute('d', pathD);
      if (wire.tipStart) wire.tipStart.setAttribute('d', '');
      if (wire.tipEnd) wire.tipEnd.setAttribute('d', '');
    }
  }

  function appendWireVisualLayers(wire, dashed) {
    const dashClass = dashed ? 'dashed' : '';
    const outline = createWirePathElement(`wire-visible wire-outline ${dashClass}`.trim());
    wire.group.appendChild(outline);
    wire.outline = outline;

    // Sleeve stack, then its select border, then copper tips on top
    wire.group.appendChild(wire.visible);

    const cloth = createWirePathElement(`wire-cloth ${dashClass}`.trim());
    cloth.setAttribute('filter', 'url(#wire-cloth-rough)');
    wire.group.appendChild(cloth);
    wire.cloth = cloth;

    const selectBorder = createWirePathElement(`wire-select-border ${dashClass}`.trim());
    wire.group.appendChild(selectBorder);
    wire.selectBorder = selectBorder;

    const tipStart = createWirePathElement('wire-tip');
    const tipEnd = createWirePathElement('wire-tip');
    wire.group.appendChild(tipStart);
    wire.group.appendChild(tipEnd);
    wire.tipStart = tipStart;
    wire.tipStartStreak = null;
    wire.tipEnd = tipEnd;
    wire.tipEndStreak = null;
  }

  function adjustWireSlack(wire, delta) {
    if (!wire) return;
    // Single mid control point: +/- nudges it perpendicular to the endpoints
    if ((wire.anchors || []).length === 1) {
      const startPt = getAttachPoint(wire, 'start');
      const endPt = getAttachPoint(wire, 'end');
      const dx = endPt.x - startPt.x;
      const dy = endPt.y - startPt.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const a = wire.anchors[0];
      wire.anchors = [{ x: a.x + nx * delta, y: a.y + ny * delta }];
      wire.slack = 0;
      updateWirePosition(wire);
      syncHbLeadWireToFan(wire);
      markProjectDirty();
      if (selectedWireGroups.has(wire.group)) {
        setStatus(`Wire mid ${Math.round(wire.anchors[0].x)}, ${Math.round(wire.anchors[0].y)} — +/- nudges · drag to place`);
      }
      return;
    }
    if ((wire.anchors || []).length > 1) return;
    const next = Math.max(-SLACK_MAX, Math.min(SLACK_MAX, (wire.slack || 0) + delta));
    if (next === wire.slack) return;
    wire.slack = next;
    updateWirePosition(wire);
    syncHbLeadWireToFan(wire);
    markProjectDirty();
    if (selectedWireGroups.has(wire.group)) {
      const stack = layerState[wire.layer].above ? 'front' : 'back';
      setStatus(`Wire L${wire.layer} slack: ${wire.slack}px — +/- or mouse wheel to adjust`);
    }
  }

  function adjustSelectedWireSlack(delta) {
    if (selectedWireGroups.size === 0) return false;
    let changed = false;
    selectedWireGroups.forEach((group) => {
      const wire = wires.get(group.dataset.id);
      if (!wire) return;
      const prev = wire.slack || 0;
      adjustWireSlack(wire, delta);
      if ((wire.slack || 0) !== prev) changed = true;
    });
    return changed;
  }

  function getAttachPoint(wire, which) {
    const endpoint = which === 'start' ? wire.start : wire.end;

    if (!endpoint.terminal || !document.body.contains(endpoint.terminal)) {
      return { x: endpoint.x, y: endpoint.y };
    }

    const terminal = endpoint.terminal;
    const center = getTerminalCenter(terminal);
    const world = clientToWorld(center.x, center.y);
    let cx = world.x;
    let cy = world.y;

    const attachedIds = terminalWireMap.get(terminal);
    if (!attachedIds || attachedIds.size <= 1) {
      return { x: cx, y: cy };
    }

    const attached = [...attachedIds]
      .map((id) => wires.get(id))
      .filter(Boolean)
      .filter((w) => w.start.terminal === terminal || w.end.terminal === terminal);

    const myIndex = attached.findIndex((w) => w.id === wire.id);
    const count = attached.length;
    if (myIndex === -1 || count <= 1) {
      return { x: cx, y: cy };
    }

    const other = which === 'start' ? wire.end : wire.start;
    let ox;
    let oy;
    if (other.terminal && document.body.contains(other.terminal)) {
      const oc = getTerminalCenter(other.terminal);
      const ow = clientToWorld(oc.x, oc.y);
      ox = ow.x;
      oy = ow.y;
    } else {
      ox = other.x;
      oy = other.y;
    }

    const angle = Math.atan2(oy - cy, ox - cx);
    const perp = angle + Math.PI / 2;
    const spreadIndex = myIndex - (count - 1) / 2;
    const offset = spreadIndex * 5;

    return {
      x: cx + Math.cos(perp) * offset,
      y: cy + Math.sin(perp) * offset,
    };
  }

  function createWire(start, end, anchors) {
    const id = `wire-${++wireIdCounter}`;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('wire-group');
    group.dataset.id = id;
    group.dataset.layer = String(activeLayer);

    const hit = createWirePathElement('wire-hit');

    const visible = createWirePathElement(`wire-visible ${wireStyle === 'dashed' ? 'dashed' : ''}`);
    visible.setAttribute('stroke', WIRE_COLORS[wireColor]);
    if (wireColor === 'black') {
      visible.setAttribute('stroke-linecap', 'round');
    }

    group.appendChild(hit);

    const wire = {
      id,
      group,
      hit,
      visible,
      outline: null,
      selectBorder: null,
      cloth: null,
      tipStart: null,
      tipStartStreak: null,
      tipEnd: null,
      tipEndStreak: null,
      color: wireColor,
      // Always store current AWG for future wires; visuals only when dimensional ON.
      gaugeMm: wireGaugeMm,
      dashed: wireStyle === 'dashed',
      layer: activeLayer,
      slack: 0,
      anchors: (anchors || [])
        .filter((a) => a && Number.isFinite(a.x) && Number.isFinite(a.y))
        .map((a) => ({ x: a.x, y: a.y })),
      start: { x: start.x, y: start.y, terminal: start.terminal || null },
      end: { x: end.x, y: end.y, terminal: end.terminal || null },
    };

    appendWireVisualLayers(wire, wire.dashed);
    syncWireBorderClasses(wire);

    const container = getLayerGroup(activeLayer, wireStackAboveForLayer(activeLayer));
    container.appendChild(group);

    wires.set(id, wire);
    registerTerminalWire(wire.start.terminal, id);
    registerTerminalWire(wire.end.terminal, id);
    assignDivergentSlack(wire);
    updateWirePosition(wire);
    [wire.start.terminal, wire.end.terminal].forEach((term) => {
      collectWiresSharingTerminal(term, null).forEach((w) => updateWirePosition(w));
    });
    if (isWireTooShort(wire)) {
      discardWire(wire, 'Wire too short (< 1 unit) — deleted');
      markProjectDirty();
      return null;
    }
    setupWireInteraction(wire);
    selectWire(wire);
    showWirePlaceCursorMark(!!wire.end.terminal);
    refreshLightningWireGlow();
    refreshShortCircuitCheck();
    validateYesGroundConnections();
    markProjectDirty();
    return wire;
  }

  function updateWirePosition(wire) {
    const startPt = getAttachPoint(wire, 'start');
    const endPt = getAttachPoint(wire, 'end');

    wire.start.x = startPt.x;
    wire.start.y = startPt.y;
    wire.end.x = endPt.x;
    wire.end.y = endPt.y;

    // Dual-coil tip lead: one coloured conductor from loom junction → lug
    const hbRoute = getHbLeadRoute(wire);
    const awRoute = !hbRoute ? getAssetWireRoute(wire) : null;
    const routeStart = hbRoute ? hbRoute.start : (awRoute ? awRoute.start : startPt);
    const routeEnd = hbRoute ? hbRoute.end : (awRoute ? awRoute.end : endPt);
    if (hbRoute) wire.slack = hbRoute.slack;
    if (awRoute) {
      wire.slack = awRoute.slack;
      wire.start.x = awRoute.start.x;
      wire.start.y = awRoute.start.y;
      wire.end.x = awRoute.end.x;
      wire.end.y = awRoute.end.y;
      if (awRoute.comp && awRoute.tip != null) {
        setAssetWireLeadSlack(awRoute.comp, wire.assetWireTipIndex, wire.slack || 0);
      }
    }

    const points = (hbRoute || awRoute)
      ? [routeStart, routeEnd]
      : getWireRoutePoints(wire, startPt, endPt);
    const hasAnchors = !hbRoute && !awRoute && (wire.anchors || []).length > 0;
    const slack = hasAnchors ? 0 : (wire.slack || 0);
    const pathD = buildRoutedWirePath(points, slack);

    applyWireGeometry(wire, pathD, { points, slack });
    wire.visible.setAttribute('stroke', WIRE_COLORS[wire.color]);
    wire.visible.setAttribute('class', `wire-visible ${wire.dashed ? 'dashed' : ''}`);
    if (isHbLeadWire(wire)) {
      wire.visible.setAttribute('stroke-width', String(HB_FAN_STROKE));
      wire.group.classList.add('hb-lead-wire');
    } else if (isAssetWire(wire)) {
      // Asset / custom-wire pigtails keep fixed stroke (never dimensional).
      clearInlineWireStroke(wire);
    } else {
      applyNonHbWireGaugeStroke(wire);
    }
    if (isAssetWire(wire)) {
      wire.group.dataset.assetWire = 'true';
    }
    if (wire.outline) {
      wire.outline.setAttribute('class', `wire-visible wire-outline ${wire.dashed ? 'dashed' : ''}`);
    }
    if (wire.selectBorder) {
      wire.selectBorder.setAttribute('class', `wire-select-border ${wire.dashed ? 'dashed' : ''}`);
    }
    if (wire.cloth) {
      wire.cloth.setAttribute('class', `wire-cloth ${wire.dashed ? 'dashed' : ''}`);
    }
    syncWireBorderClasses(wire);
    if (wireEndLabelHoverId === wire.id) placeWireEndLabels(wire);
    if (selectedWireGroups.has(wire.group)) updateWireGaugeReadout();
  }

  function applyAssetWireData(el, data) {
    if (!el || !data) return;
    const list = Array.isArray(data.assetWires) ? data.assetWires : null;
    if (list) {
      list.forEach((item, idx) => {
        if (!item) return;
        if (item.left != null && item.left !== '') el.dataset[`awTip${idx}Left`] = String(item.left);
        if (item.top != null && item.top !== '') el.dataset[`awTip${idx}Top`] = String(item.top);
        if (Number.isFinite(item.slack) && Math.abs(item.slack) >= 0.5) {
          setAssetWireLeadSlack(el, idx, item.slack);
        }
        if (item.attachComp) el.dataset[`awTip${idx}AttachComp`] = String(item.attachComp);
        if (item.attachTerm != null && item.attachTerm !== '') {
          el.dataset[`awTip${idx}AttachTerm`] = String(item.attachTerm);
        }
      });
      return;
    }
    // Flat-key fallback
    for (let idx = 0; idx < 12; idx++) {
      const left = data[`awTip${idx}Left`];
      const top = data[`awTip${idx}Top`];
      if (left == null && top == null && data[`awLeadSlack${idx}`] == null) {
        if (!data[`awTip${idx}AttachComp`]) break;
      }
      if (left != null && left !== '') el.dataset[`awTip${idx}Left`] = String(left);
      if (top != null && top !== '') el.dataset[`awTip${idx}Top`] = String(top);
      const slack = parseFloat(data[`awLeadSlack${idx}`]);
      if (Number.isFinite(slack)) setAssetWireLeadSlack(el, idx, slack);
      const attachComp = data[`awTip${idx}AttachComp`];
      const attachTerm = data[`awTip${idx}AttachTerm`];
      if (attachComp) el.dataset[`awTip${idx}AttachComp`] = String(attachComp);
      if (attachTerm != null && attachTerm !== '') {
        el.dataset[`awTip${idx}AttachTerm`] = String(attachTerm);
      }
    }
  }

  function remapAssetWireAttachIds(src, orig, idMap) {
    if (!src) return;
    if (Array.isArray(src.assetWires) && Array.isArray(orig?.assetWires)) {
      src.assetWires = orig.assetWires.map((item) => {
        if (!item) return item;
        const next = { ...item };
        if (next.attachComp && idMap.has(next.attachComp)) {
          next.attachComp = idMap.get(next.attachComp);
        } else {
          next.attachComp = '';
          next.attachTerm = '';
        }
        return next;
      });
      return;
    }
    for (let idx = 0; idx < 12; idx++) {
      const attachComp = orig?.[`awTip${idx}AttachComp`];
      if (attachComp && idMap.has(attachComp)) {
        src[`awTip${idx}AttachComp`] = idMap.get(attachComp);
        src[`awTip${idx}AttachTerm`] = orig[`awTip${idx}AttachTerm`];
      } else {
        delete src[`awTip${idx}AttachComp`];
        delete src[`awTip${idx}AttachTerm`];
      }
    }
  }

  function updateAllWirePositions() {
    syncAllCapacitorTipAttachments();
    syncAllDualCoilLeads();
    syncAllAssetWireLeads();
    wires.forEach(updateWirePosition);
    pruneShortWires();
    if (wireEditFocusMode && groundCheckMode) {
      clearTimeout(groundChaseRefreshTimer);
      groundChaseRefreshTimer = setTimeout(() => {
        if (wireEditFocusMode && groundCheckMode) refreshGroundNetChase();
      }, 80);
    }
  }

  function getWireEndpointDisplayName(endpoint) {
    if (!endpoint?.terminal || !document.body.contains(endpoint.terminal)) {
      return '·';
    }
    const tip = endpoint.terminal;
    return tip.dataset.tipLabel || tip.dataset.terminalLabel || '?';
  }

  function hideWireEndLabels() {
    wireEndLabelHoverId = null;
    wireEndLabelStart?.classList.add('hidden');
    wireEndLabelEnd?.classList.add('hidden');
  }

  function placeWireEndLabels(wire) {
    if (!wire || !wireEndLabelStart || !wireEndLabelEnd) return;
    if (isHbLeadWire(wire)) {
      const route = getHbLeadRoute(wire);
      const tip = components.get(wire.hbLeadCompId)
        ?.querySelectorAll?.('.terminal.hb-tip')?.[wire.hbLeadTipIndex];
      const tipName = tip?.dataset?.tipLabel || tip?.dataset?.terminalLabel || '·';
      const lugName = route?.lugTerm
        ? (route.lugTerm.dataset.terminalLabel || '?')
        : getWireEndpointDisplayName(
          wire.start.terminal?.classList?.contains('hb-tip') ? wire.end : wire.start
        );
      wireEndLabelStart.textContent = tipName;
      wireEndLabelEnd.textContent = lugName;
      if (route) {
        wireEndLabelStart.style.left = `${route.start.x}px`;
        wireEndLabelStart.style.top = `${route.start.y}px`;
        wireEndLabelEnd.style.left = `${route.end.x}px`;
        wireEndLabelEnd.style.top = `${route.end.y}px`;
      } else {
        wireEndLabelStart.style.left = `${wire.start.x}px`;
        wireEndLabelStart.style.top = `${wire.start.y}px`;
        wireEndLabelEnd.style.left = `${wire.end.x}px`;
        wireEndLabelEnd.style.top = `${wire.end.y}px`;
      }
      wireEndLabelStart.classList.remove('hidden');
      wireEndLabelEnd.classList.remove('hidden');
      return;
    }
    wireEndLabelStart.textContent = getWireEndpointDisplayName(wire.start);
    wireEndLabelEnd.textContent = getWireEndpointDisplayName(wire.end);
    wireEndLabelStart.style.left = `${wire.start.x}px`;
    wireEndLabelStart.style.top = `${wire.start.y}px`;
    wireEndLabelEnd.style.left = `${wire.end.x}px`;
    wireEndLabelEnd.style.top = `${wire.end.y}px`;
    wireEndLabelStart.classList.remove('hidden');
    wireEndLabelEnd.classList.remove('hidden');
  }

  function showWireEndLabels(wire) {
    if (!wireEditFocusMode || !wire || !wireEndLabelStart || !wireEndLabelEnd) return;
    updateWirePosition(wire);
    if (!wires.has(wire.id)) return;
    wireEndLabelHoverId = wire.id;
    placeWireEndLabels(wire);
  }

  function isWireTooShort(wire) {
    if (!wire) return true;
    // Dual-coil fan lead wires are real connections — never auto-prune
    if (wire.hbLeadCompId || wire.group?.dataset?.hbLead === 'true') return false;
    if (isAssetWire(wire)) return false;
    const pts = getWireRoutePoints(wire, wire.start, wire.end);
    if ((wire.anchors || []).length > 0) {
      const samples = flattenWireRoute(pts, 0, 4);
      let len = 0;
      for (let i = 1; i < samples.length; i++) {
        len += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
      }
      return len < WORKSPACE_GRID;
    }
    return Math.hypot(wire.end.x - wire.start.x, wire.end.y - wire.start.y) < WORKSPACE_GRID;
  }

  function discardWire(wire, statusMsg) {
    if (!wire) return;
    const wasSelected = selectedWireGroups.has(wire.group);
    if (wireEndLabelHoverId === wire.id) hideWireEndLabels();
    clearHbTipLeadWireMeta(wire);
    if (wire.assetWireCompId != null && wire.assetWireTipIndex != null) {
      const comp = components.get(wire.assetWireCompId);
      if (comp && comp.dataset[`awTip${wire.assetWireTipIndex}WireId`] === wire.id) {
        delete comp.dataset[`awTip${wire.assetWireTipIndex}WireId`];
      }
      wire.assetWireCompId = null;
      wire.assetWireTipIndex = null;
    }
    unregisterTerminalWire(wire.start.terminal, wire.id);
    unregisterTerminalWire(wire.end.terminal, wire.id);
    if (wasSelected) selectedWireGroups.delete(wire.group);
    wire.group.remove();
    wires.delete(wire.id);
    if (wasSelected) {
      syncSelectedWireConnectHighlights();
      updateWireGaugeReadout();
    }
    refreshLightningWireGlow();
    refreshShortCircuitCheck();
    validateYesGroundConnections();
    if (statusMsg) setStatus(statusMsg);
  }

  function pruneShortWires() {
    const doomed = [];
    wires.forEach((wire) => {
      if (isWireTooShort(wire)) doomed.push(wire);
    });
    if (doomed.length === 0) return 0;
    doomed.forEach((wire) => discardWire(wire));
    markProjectDirty();
    return doomed.length;
  }

  function beginAssetWireEndpointDrag(wire, e) {
    if (!isAssetWire(wire)) return;
    const comp = components.get(wire.assetWireCompId);
    const tipIdx = wire.assetWireTipIndex;
    const tip = comp ? getAssetWireTips(comp)[tipIdx] : null;
    if (!comp || !tip) return;
    heldWireId = wire.id;
    wire.group.classList.add('is-dragging-end');
    tip.classList.add('is-dragging');
    const prevAttachCompId = comp.dataset[`awTip${tipIdx}AttachComp`];
    const prevAttachLabel = comp.dataset[`awTip${tipIdx}AttachTerm`];
    const prevAttach = (() => {
      if (!prevAttachCompId || prevAttachLabel == null) return null;
      const host = components.get(prevAttachCompId);
      if (!host) return null;
      return [...host.querySelectorAll('.terminal')].find(
        (t) => (t.dataset.terminalLabel || '') === prevAttachLabel
      ) || null;
    })();
    let hoverTarget = null;
    let moved = false;
    const startClientX = e.clientX;
    const startClientY = e.clientY;

    const clearHold = () => {
      if (heldWireId === wire.id) heldWireId = null;
      wire.group.classList.remove('is-dragging-end');
      tip.classList.remove('is-dragging');
      document.removeEventListener('mouseup', clearHold);
    };
    document.addEventListener('mouseup', clearHold);

    function onMove(ev) {
      if (!moved && Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) < 3) return;
      if (!moved) {
        moved = true;
        setAssetWireTipAttachment(comp, tipIdx, null);
      }
      clearAssetWireAttachHighlights();
      hoverTarget = findAssetWireAttachTarget(comp, ev.clientX, ev.clientY);
      if (hoverTarget) {
        hoverTarget.classList.add('asset-wire-attach-target');
        const center = getTerminalCenter(hoverTarget);
        placeAssetWireTipAtClient(comp, tip, center.x, center.y);
        showSnapIndicator(center.x, center.y);
        setStatus(`Attach wire to ${hoverTarget.dataset.terminalLabel || 'terminal'}`);
      } else {
        placeAssetWireTipAtClient(comp, tip, ev.clientX, ev.clientY);
        snapIndicator.classList.add('hidden');
        setStatus('Moving wire tip — drop on a terminal or free point');
      }
      persistAssetWireTipPositions(comp);
      updateWirePosition(wire);
      layoutAssetWireFloatLabels(comp);
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      clearAssetWireAttachHighlights();
      snapIndicator.classList.add('hidden');
      tip.classList.remove('is-dragging');
      wire.group.classList.remove('is-dragging-end');
      if (heldWireId === wire.id) heldWireId = null;
      if (!moved) {
        // Click without drag — keep prior attachment
        if (prevAttach) setAssetWireTipAttachment(comp, tipIdx, prevAttach);
        updateWirePosition(wire);
        return;
      }
      if (hoverTarget && document.body.contains(hoverTarget)) {
        setAssetWireTipAttachment(comp, tipIdx, hoverTarget);
        syncAssetWireTipAttachments(comp);
        refreshShortCircuitCheck();
        validateYesGroundConnections();
        setStatus(`Wire attached to ${hoverTarget.dataset.terminalLabel || 'terminal'}`);
      } else {
        setAssetWireTipAttachment(comp, tipIdx, null);
        persistAssetWireTipPositions(comp);
        updateWirePosition(wire);
        setStatus('Wire tip placed — drag sleeve to move · double-click to bend');
      }
      markProjectDirty();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function setupWireInteraction(wire) {
    wire.group.addEventListener('mousedown', (e) => {
      // Wire mode: never steal clicks from terminals (stacking wires on a lug)
      if (wireMode || moveTool) return;
      e.stopPropagation();
      const keep = applyWireClickSelection(wire, e);
      if (!keep) return;

      // Tip grab = re-route endpoint; sleeve = translate selection; double-click sleeve = bend
      if (e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        beginWirePointerInteraction(wire, e);
      }
    });
    wire.group.addEventListener('mousemove', (e) => {
      if (heldWireId || wireMode) return;
      const endHit = hitWireEndpoint(wire, e.clientX, e.clientY);
      wire.group.classList.toggle('near-wire-tip', !!endHit);
    });
    wire.group.addEventListener('mouseleave', () => {
      wire.group.classList.remove('near-wire-tip');
      if (wireEndLabelHoverId === wire.id && !selectedWireGroups.has(wire.group)) {
        hideWireEndLabels();
      }
    });
    wire.group.addEventListener('mouseenter', () => {
      if (!wireEditFocusMode) return;
      showWireEndLabels(wire);
    });
  }

  function deleteWireGroup(group) {
    const id = group.dataset.id;
    const wire = wires.get(id);
    if (wire) {
      clearHbTipLeadWireMeta(wire);
      unregisterTerminalWire(wire.start.terminal, id);
      unregisterTerminalWire(wire.end.terminal, id);
    }
    group.remove();
    wires.delete(id);
    selectedWireGroups.delete(group);
    refreshLightningWireGlow();
    refreshShortCircuitCheck();
    reportGroundingStatus();
  }

  function deleteSelected() {
    if (deleteSelectedDimAnnotations()) return;
    const wireGroups = [...selectedWireGroups];
    const comps = [...selectedComponents];
    if (wireGroups.length === 0 && comps.length === 0) return;

    wireGroups.forEach(deleteWireGroup);
    comps.forEach((comp) => {
      removeWiresForComponent(comp);
      removeHbWorldLeadGroup(comp);
      components.delete(comp.dataset.id);
      comp.remove();
    });

    deselectAll();
    clearSnapState();
    refreshLightningWireGlow();
    refreshShortCircuitCheck();
    markProjectDirty();
    const n = wireGroups.length + comps.length;
    reportGroundingStatus(n === 1 ? 'Deleted' : `Deleted ${n} items`);
  }

  function removeWiresForComponent(compEl) {
    const terminals = compEl.querySelectorAll('.terminal');
    const toRemove = [];
    wires.forEach((wire, id) => {
      for (const t of terminals) {
        if (wire.start.terminal === t || wire.end.terminal === t) {
          toRemove.push(id);
          break;
        }
      }
    });
    toRemove.forEach((id) => {
      const wire = wires.get(id);
      unregisterTerminalWire(wire.start.terminal, id);
      unregisterTerminalWire(wire.end.terminal, id);
      if (selectedWireGroups.has(wire.group)) selectedWireGroups.delete(wire.group);
      wire.group.remove();
      wires.delete(id);
    });
  }

  function handleWireCanvasClick(e) {
    if (!wireMode) return false;

    const endpoint = resolveEndpoint(getEndpointFromEvent(e));

    if (!wireDraftStart) {
      wireDraftStart = endpoint;
      wireDraftAnchors = [];
      clearSnapState();
      ensurePreviewLine();
      setStatus(
        endpoint.terminal
          ? 'Click canvas for curve anchors, or a terminal to finish'
          : 'Click anchors to route, then a terminal to finish'
      );
      return true;
    }

    if (endpoint.terminal) {
      createWire(wireDraftStart, endpoint, wireDraftAnchors);
      cancelWireDraft();
      clearSnapState();
      reportGroundingStatus(`Wire on Layer ${activeLayer} — click for next wire`);
      return true;
    }

    const free = e.shiftKey;
    const ax = snapWorkspace(endpoint.x, free);
    const ay = snapWorkspace(endpoint.y, free);
    wireDraftAnchors.push({ x: ax, y: ay });
    clearSnapState();
    ensurePreviewLine();
    updatePreviewLine(e.clientX, e.clientY);
    setStatus(
      `Anchor ${wireDraftAnchors.length} set — click more anchors, or a terminal to finish (Esc cancels)`
    );
    return true;
  }

  function createTerminal(label, opts = {}) {
    const className = typeof opts === 'string' ? opts : opts.className || '';
    const color = typeof opts === 'object' ? opts.color : null;
    const el = document.createElement('div');
    el.className = `terminal${className ? ` ${className}` : ''}`;
    el.textContent = label;
    el.dataset.terminalLabel = label;
    if (color) {
      el.style.background = color;
      el.style.color = '#111';
    }
    setupTerminalHover(el);
    setupTerminalWireClick(el);
    return el;
  }

  function setupTerminalWireClick(terminalEl) {
    terminalEl.addEventListener('click', (e) => {
      if (!wireMode) return;
      e.stopPropagation();
      const endpoint = resolveEndpoint({ type: 'terminal', el: terminalEl });
      if (!wireDraftStart) {
        wireDraftStart = endpoint;
        wireDraftAnchors = [];
        clearSnapState();
        ensurePreviewLine();
        setStatus('Click canvas for curve anchors, or a terminal to finish');
      } else {
        createWire(wireDraftStart, endpoint, wireDraftAnchors);
        cancelWireDraft();
        clearSnapState();
        reportGroundingStatus(`Wire on Layer ${activeLayer} — click for next wire`);
      }
    });
  }

  function setupTerminalHover(terminalEl) {
    terminalEl.addEventListener('mouseenter', () => {
      clearSnapTimer();
      activeHoverTerminal = terminalEl;
      terminalEl.classList.add('hovering');
      const wireCount = terminalWireMap.get(terminalEl)?.size || 0;
      const extra = wireCount ? ` · ${wireCount} wire${wireCount > 1 ? 's' : ''} attached` : '';
      setStatus(`Hovering ${terminalEl.dataset.terminalLabel}${extra} — snap in 2s…`);

      snapTimer = setTimeout(() => {
        if (activeHoverTerminal !== terminalEl) return;
        snapToTerminal(terminalEl);
      }, SNAP_DELAY_MS);
    });

    terminalEl.addEventListener('mouseleave', () => {
      terminalEl.classList.remove('hovering');
      if (activeHoverTerminal === terminalEl) {
        clearSnapTimer();
        activeHoverTerminal = null;
        if (snappedTerminal !== terminalEl) {
          setStatus(getSingleSelectedComponent() ? 'Component selected' : wireMode ? `Click start point (Layer ${activeLayer})` : 'Ready');
        }
      }
    });

    terminalEl.addEventListener('mousedown', (e) => {
      if (wireMode) return;
      e.stopPropagation();
    });
  }

  function getTerminalCenter(terminalEl) {
    const rect = terminalEl.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  let worldCoordProbe = null;

  function refreshPanelCadCursorAfterViewport(clientX = lastPointerX, clientY = lastPointerY) {
    if (activeWorkspacePage !== 'panel' || !panelCursorGridSnap) return;
    if (dimTool && dimTool.phase !== 'done') {
      handleDimPointer(clientX, clientY, false);
      return;
    }
    if (moveTool) {
      handleMovePointer(clientX, clientY, false);
      return;
    }
    updatePanelCursorSnap(clientX, clientY, false);
  }

  /** Exact screen position of a workspace world point (matches CSS transform). */
  function worldPointToClient(x, y) {
    if (!worldCoordProbe) {
      worldCoordProbe = document.createElement('div');
      worldCoordProbe.setAttribute('aria-hidden', 'true');
      worldCoordProbe.style.cssText =
        'position:absolute;left:0;top:0;width:0;height:0;margin:0;padding:0;border:0;pointer-events:none;visibility:hidden;';
      workspace.appendChild(worldCoordProbe);
    }
    worldCoordProbe.style.left = `${x}px`;
    worldCoordProbe.style.top = `${y}px`;
    // Force layout so getBoundingClientRect sees the latest pan/zoom transform
    void workspace.offsetWidth;
    const r = worldCoordProbe.getBoundingClientRect();
    return { x: r.left, y: r.top };
  }

  function syncPanelCadCursorSize() {
    if (!snapIndicator) return;
    // Screen px — 1.5 grid units at current zoom, even size for symmetric -50% centering
    let sizePx = 1.5 * getWorkspaceGrid() * viewportScale();
    sizePx = Math.max(10, Math.round(sizePx / 2) * 2);
    snapIndicator.style.setProperty('--cad-cross-size', `${sizePx}px`);
    snapIndicator.style.width = `${sizePx}px`;
    snapIndicator.style.height = `${sizePx}px`;
  }

  function setSnapIndicatorHost(inWorkspace) {
    if (!snapIndicator) return;
    // Panel CAD cursor stays fixed on canvas; only legacy callers use workspace host
    if (inWorkspace) {
      if (snapIndicator.parentElement !== workspace) workspace.appendChild(snapIndicator);
      snapIndicator.classList.add('snap-indicator--workspace');
    } else {
      if (snapIndicator.parentElement !== canvas) canvas.appendChild(snapIndicator);
      snapIndicator.classList.remove('snap-indicator--workspace');
    }
  }

  function showSnapIndicator(x, y, opts = {}) {
    const pulse = opts.pulse !== false;
    const inWorkspace = !!opts.world;
    setSnapIndicatorHost(inWorkspace);
    snapIndicator.classList.remove('hidden');
    if (pulse) {
      snapIndicator.classList.remove('pulse');
      void snapIndicator.offsetWidth;
      snapIndicator.classList.add('pulse');
    } else {
      snapIndicator.classList.remove('pulse');
    }
    if (!inWorkspace && !(activeWorkspacePage === 'panel' && panelCursorGridSnap)) {
      snapIndicator.style.width = '';
      snapIndicator.style.height = '';
    }
    snapIndicator.style.transform = '';
    snapIndicator.style.left = `${x}px`;
    snapIndicator.style.top = `${y}px`;
  }

  /** Show snap mark at a world pick — measure via DOM so zoom/pan stay grid-true. */
  function showSnapAtWorldPick(pick, opts = {}) {
    if (!pick) return;
    if (activeWorkspacePage === 'panel' && panelCursorGridSnap) {
      syncPanelCadCursorSize();
      // CSS grid lines fill [n, n+1] in world px — visual center is n+0.5 (gap grows with zoom)
      let wx = pick.x;
      let wy = pick.y;
      if (pick.kind === 'grid') {
        wx += 0.5;
        wy += 0.5;
      }
      const screen = worldPointToClient(wx, wy);
      setSnapIndicatorHost(false);
      showSnapIndicator(screen.x, screen.y, { ...opts, world: false, pulse: opts.pulse === true });
      return;
    }
    const screen = worldToClient(pick.x, pick.y);
    showSnapIndicator(screen.x, screen.y, opts);
  }

  function snapToTerminal(terminalEl) {
    const center = getTerminalCenter(terminalEl);
    snappedTerminal = terminalEl;
    snapPoint = { ...center };
    snapLockPointer = { x: lastPointerX, y: lastPointerY };

    document.querySelectorAll('.terminal.snapped').forEach((t) => t.classList.remove('snapped'));
    terminalEl.classList.add('snapped');

    showSnapIndicator(center.x, center.y);

    const label = terminalEl.dataset.terminalLabel;
    const comp = terminalEl.closest('.component');
    const compType = comp?.dataset.type ?? 'terminal';
    const wireCount = terminalWireMap.get(terminalEl)?.size || 0;
    snapInfo.textContent = `Snapped: ${label} (${compType})${wireCount ? ` · ${wireCount} wires` : ''}`;
    setStatus(`Snapped to ${label} — move mouse to cancel`);

    document.body.classList.add('snap-active');
    alignSelectedComponentToSnap();
  }

  function alignSelectedComponentToSnap() {
    const comp = getSingleSelectedComponent();
    if (!comp || !snapPoint) return;

    const nearest = findNearestTerminalInComponent(comp, snapPoint.x, snapPoint.y);
    if (!nearest) return;

    const termCenter = getTerminalCenter(nearest);
    const compLeft = parseFloat(comp.style.left) || 0;
    const compTop = parseFloat(comp.style.top) || 0;
    const delta = screenDeltaToWorld(snapPoint.x - termCenter.x, snapPoint.y - termCenter.y);

    comp.style.left = `${Math.max(0, compLeft + delta.x)}px`;
    comp.style.top = `${Math.max(0, compTop + delta.y)}px`;
    updateAllWirePositions();
  }

  function clearSnapTimer() {
    if (snapTimer) {
      clearTimeout(snapTimer);
      snapTimer = null;
    }
  }

  function clearSnapState() {
    clearSnapTimer();
    activeHoverTerminal = null;
    snappedTerminal = null;
    snapPoint = null;
    snapLockPointer = null;
    snapIndicator.classList.add('hidden');
    snapInfo.textContent = '';
    document.body.classList.remove('snap-active');
    document.querySelectorAll('.terminal.snapped').forEach((t) => t.classList.remove('snapped'));
  }

  function placeAssetAt(assetId, x, y) {
    const template = GuitarAssets.getTemplate(assetId);
    if (!template) return;
    let placeX = x;
    let placeY = y;
    let snappedToPanel = false;
    if (activeWorkspacePage === 'electronics' && panelLayerVisible) {
      const snap = findNearestPanelSnap(x, y, placementPanelSnapThresholdWorld());
      if (snap) {
        placeX = snap.x;
        placeY = snap.y;
        snappedToPanel = true;
      }
    }
    const { offsetX, offsetY } = GuitarAssets.getPlacementOffset(template);
    // Panel snap locks the asset center exactly on the point (no grid rounding).
    const left = placeX - offsetX;
    const top = placeY - offsetY;
    GuitarAssets.createComponent(
      template,
      snappedToPanel ? left : snapWorkspace(left),
      snappedToPanel ? top : snapWorkspace(top)
    );
    recordRecentAsset(assetId);
    setAssetPlacement(null);
    markProjectDirty();
    reportGroundingStatus(`Placed ${template.name}`);
  }

  function refreshComponentsForTemplate(templateId) {
    const template = GuitarAssets.getTemplate(templateId);
    if (!template) return;

    components.forEach((el, compId) => {
      if (el.dataset.assetId !== templateId) return;

      const left = parseFloat(el.style.left) || 0;
      const top = parseFloat(el.style.top) || 0;
      const rotation = el.dataset.rotation || '';
      const groundTag = el.dataset.groundTag || 'NOGROUND';
      const groundFlash = el.dataset.groundFlash;
      const switchType = getToggleSwitchType(el);
      const electricalValues = collectComponentElectricalValues(el);
      const capLeadSlackTop = getCapLeadSlack(el, 'top');
      const capLeadSlackBottom = getCapLeadSlack(el, 'bottom');
      const capTip0Left = el.dataset.capTip0Left || '';
      const capTip0Top = el.dataset.capTip0Top || '';
      const capTip1Left = el.dataset.capTip1Left || '';
      const capTip1Top = el.dataset.capTip1Top || '';
      const capTip0AttachComp = el.dataset.capTip0AttachComp || '';
      const capTip0AttachTerm = el.dataset.capTip0AttachTerm || '';
      const capTip1AttachComp = el.dataset.capTip1AttachComp || '';
      const capTip1AttachTerm = el.dataset.capTip1AttachTerm || '';
      const stateIndex = GuitarAssets.getComponentStateIndex(el);
      const instanceStates = el._instanceStates
        ? JSON.parse(JSON.stringify(el._instanceStates))
        : null;
      const wasSelected = selectedComponents.has(el);
      const oldTerms = [...el.querySelectorAll('.terminal')];
      const wireLinks = [];

      wires.forEach((wire) => {
        const startIdx = oldTerms.indexOf(wire.start.terminal);
        if (startIdx !== -1) wireLinks.push({ wire, end: 'start', termIndex: startIdx });
        const endIdx = oldTerms.indexOf(wire.end.terminal);
        if (endIdx !== -1) wireLinks.push({ wire, end: 'end', termIndex: endIdx });
      });

      const newEl = GuitarAssets.buildComponentDOM(template, compId);
      newEl.style.left = `${left}px`;
      newEl.style.top = `${top}px`;
  if (rotation) newEl.dataset.rotation = rotation;
      setComponentGroundTag(newEl, groundTag === 'YESGROUND');
      if (groundFlash != null) newEl.dataset.groundFlash = groundFlash;
      if (isToggleSwitchComponent(newEl)) newEl.dataset.switchType = String(switchType);
      applyComponentElectricalValues(newEl, electricalValues, { notify: false });
      if (capLeadSlackTop) setCapLeadSlack(newEl, 'top', capLeadSlackTop);
      if (capLeadSlackBottom) setCapLeadSlack(newEl, 'bottom', capLeadSlackBottom);
      if (capTip0Left !== '') newEl.dataset.capTip0Left = capTip0Left;
      if (capTip0Top !== '') newEl.dataset.capTip0Top = capTip0Top;
      if (capTip1Left !== '') newEl.dataset.capTip1Left = capTip1Left;
      if (capTip1Top !== '') newEl.dataset.capTip1Top = capTip1Top;
      if (capTip0AttachComp) newEl.dataset.capTip0AttachComp = capTip0AttachComp;
      if (capTip0AttachTerm !== '') newEl.dataset.capTip0AttachTerm = capTip0AttachTerm;
      if (capTip1AttachComp) newEl.dataset.capTip1AttachComp = capTip1AttachComp;
      if (capTip1AttachTerm !== '') newEl.dataset.capTip1AttachTerm = capTip1AttachTerm;
      applyAssetWireData(newEl, {
        assetWires: hasAssetWireTerms(el)
          ? getAssetWireTips(el).map((_, idx) => ({
            left: el.dataset[`awTip${idx}Left`] || '',
            top: el.dataset[`awTip${idx}Top`] || '',
            slack: getAssetWireLeadSlack(el, idx),
            attachComp: el.dataset[`awTip${idx}AttachComp`] || '',
            attachTerm: el.dataset[`awTip${idx}AttachTerm`] || '',
          }))
          : undefined,
      });
      applyHbLeadData(newEl, el.dataset);
      if (instanceStates) GuitarAssets.setInstanceStates(newEl, instanceStates);
      setComponentWorkspacePage(newEl, getComponentWorkspacePage(el));
      if (wasSelected) {
        selectedComponents.delete(el);
        selectedComponents.add(newEl);
        newEl.classList.add('selected');
      }

      removeHbWorldLeadGroup(el);
      el.replaceWith(newEl);
      components.set(compId, newEl);
      setupComponentInteraction(newEl);

      const newTerms = [...newEl.querySelectorAll('.terminal')];
      wireLinks.forEach(({ wire, end, termIndex }) => {
        const newTerm = newTerms[termIndex];
        if (!newTerm) return;
        wire[end].terminal = newTerm;
      });

      if (GuitarAssets.getEffectiveStates(newEl).length) {
        GuitarAssets.applyComponentStateVisuals(newEl, template, stateIndex);
      } else {
        GuitarAssets.updateComponentStateLabel(newEl);
      }
    });

    updateAllTerminalBadges();
    updateAllWirePositions();
    refreshLightningWireGlow();
    updateSelectionStatus();
    validateYesGroundConnections();
  }

  function selectComponent(el, opts = {}) {
    if (wireEditFocusMode) return;
    const additive = !!opts.additive;
    const toggleOff = !!opts.toggleOff;
    if (toggleOff) {
      if (!selectedComponents.has(el)) return;
      selectedComponents.delete(el);
      el.classList.remove('selected');
      updateSelectionStatus();
      return;
    }
    if (additive) {
      if (!el) return;
      clearPanelSnapSelection();
      clearDimAnnotationSelection();
      selectedComponents.add(el);
      el.classList.add('selected');
      updateSelectionStatus();
      return;
    }
    deselectAll();
    if (el) {
      selectedComponents.add(el);
      el.classList.add('selected');
    }
    updateSelectionStatus();
  }

  function selectWire(wire, opts = {}) {
    if (!wire) return;
    clearOverlapLeadHighlights();
    const additive = !!opts.additive;
    const toggleOff = !!opts.toggleOff;
    if (toggleOff) {
      if (!selectedWireGroups.has(wire.group)) return;
      selectedWireGroups.delete(wire.group);
      wire.group.classList.remove('selected');
      syncWireToolbarFromSelection();
      updateSelectionStatus();
      syncSelectedWireEndLabels();
      syncSelectedWireConnectHighlights();
      updateWireGaugeReadout();
      return;
    }
    if (additive) {
      clearPanelSnapSelection();
      clearDimAnnotationSelection();
      selectedWireGroups.add(wire.group);
      wire.group.classList.add('selected');
      raiseSelectedWiresInStack();
      syncWireToolbarFromSelection();
      updateSelectionStatus();
      syncSelectedWireEndLabels();
      syncSelectedWireConnectHighlights();
      updateWireGaugeReadout();
      return;
    }
    deselectAll();
    selectedWireGroups.add(wire.group);
    wire.group.classList.add('selected');
    raiseSelectedWiresInStack();
    syncWireToolbarFromSelection();
    updateSelectionStatus();
    syncSelectedWireEndLabels();
    syncSelectedWireConnectHighlights();
    updateWireGaugeReadout();
  }

  function syncSelectedWireEndLabels() {
    if (selectedWireGroups.size === 1) {
      const wire = wires.get([...selectedWireGroups][0].dataset.id);
      if (wire) {
        updateWirePosition(wire);
        placeWireEndLabels(wire);
        wireEndLabelHoverId = wire.id;
        return;
      }
    }
    if (!wireEditFocusMode) hideWireEndLabels();
  }

  function setupComponentInteraction(el) {
    if (!el.dataset.workspacePage) {
      setComponentWorkspacePage(el, activeWorkspacePage);
    }
    ensureJackGroundTerminals(el);
    ensureCapacitorLeads(el);
    ensureDualCoilLeads(el);
    ensureAssetWireLeads(el);
    el.classList.remove('workspace-page-hidden', 'workspace-page-underlay');
    const page = getComponentWorkspacePage(el);
    if (activeWorkspacePage === 'electronics') {
      if (page !== 'electronics') el.classList.add('workspace-page-underlay');
    } else if (page === 'electronics') {
      el.classList.add('workspace-page-hidden');
    }

    el.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('terminal') || wireMode) return;
      if (e.target.closest('.cap-lead-hit') || e.target.closest('.cap-lead')) return;
      if (e.target.closest('.asset-wire-lead-hit') || e.target.closest('.asset-wire-lead')) return;
      if (e.target.closest('.hb-leads-hit-svg') || e.target.closest('.hb-loom-hit') || e.target.closest('.hb-loom')) return;
      if (e.target.closest('.hb-fan-hit') || e.target.closest('.hb-fan')) return;
      if (dimTool && dimTool.phase !== 'done') {
        e.stopPropagation();
        return;
      }
      if (moveTool) {
        e.stopPropagation();
        return;
      }
      if (wireEditFocusMode) {
        e.stopPropagation();
        return;
      }

      const onBody = !!e.target.closest('.placeholder');
      // Dual coil: only the label box selects / drags the asset
      if (isDualCoilComponent(el) && !onBody) return;

      e.stopPropagation();

      if (isDualCoilComponent(el) && onBody) {
        dualCoilBodyHeld = true;
        const clearBodyHold = () => {
          dualCoilBodyHeld = false;
          document.removeEventListener('mouseup', clearBodyHold);
        };
        document.addEventListener('mouseup', clearBodyHold);
      }

      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && selectedComponents.has(el) && selectedComponents.size > 1) {
        selectComponent(el, { toggleOff: true });
        return;
      }
      if (e.shiftKey) {
        if (!selectedComponents.has(el)) selectComponent(el, { additive: true });
      } else if (ctrl) {
        if (!selectedComponents.has(el)) selectComponent(el, { additive: true });
      } else if (!selectedComponents.has(el)) {
        selectComponent(el);
      }

      if (!selectedComponents.has(el)) return;

      const startClientX = e.clientX;
      const startClientY = e.clientY;
      let isDragging = false;
      let dragOffsetX = 0;
      let dragOffsetY = 0;
      let dragSnapshot = null;
      let wireSnapshot = null;
      let wiresDetached = false;
      const dragTargets = [...selectedComponents];
      const wireTargets = collectSelectedWireTranslateTargets();

      const rect = el.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;

      function onMove(e) {
        if (!isDragging) {
          const dx = e.clientX - startClientX;
          const dy = e.clientY - startClientY;
          if (Math.hypot(dx, dy) < MARQUEE_MIN_PX) return;
          isDragging = true;
          dragSnapshot = dragTargets.map((c) => ({
            el: c,
            left: parseFloat(c.style.left) || 0,
            top: parseFloat(c.style.top) || 0,
          }));
          if (wireTargets.length) {
            wireSnapshot = snapshotWiresForTranslate(wireTargets);
            detachWiresForTranslate(wireTargets);
            wiresDetached = true;
          }
          dragTargets.forEach((c) => c.classList.add('dragging'));
        }

        const dragScale = viewportScale();
        let newX = (e.clientX - dragOffsetX - canvas.getBoundingClientRect().left - panX) / dragScale;
        let newY = (e.clientY - dragOffsetY - canvas.getBoundingClientRect().top - panY) / dragScale;
        const free = e.shiftKey && !snapPoint;

        const primary = dragSnapshot.find((s) => s.el === el);
        if (!primary) return;

        if (snapPoint) {
          newX = Math.max(0, newX);
          newY = Math.max(0, newY);
          el.style.left = `${newX}px`;
          el.style.top = `${newY}px`;

          const nearest = findNearestTerminalInComponent(el, snapPoint.x, snapPoint.y);
          if (nearest) {
            const termCenter = getTerminalCenter(nearest);
            const compLeft = parseFloat(el.style.left) || 0;
            const compTop = parseFloat(el.style.top) || 0;
            const delta = screenDeltaToWorld(snapPoint.x - termCenter.x, snapPoint.y - termCenter.y);
            newX = Math.max(0, compLeft + delta.x);
            newY = Math.max(0, compTop + delta.y);
          }
        } else {
          newX = Math.max(0, snapWorkspace(newX, free));
          newY = Math.max(0, snapWorkspace(newY, free));
        }

        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;

        const dx = newX - primary.left;
        const dy = newY - primary.top;
        dragSnapshot.forEach(({ el: c, left, top }) => {
          if (c === el) return;
          if (snapPoint) {
            c.style.left = `${Math.max(0, left + dx)}px`;
            c.style.top = `${Math.max(0, top + dy)}px`;
          } else {
            c.style.left = `${Math.max(0, snapWorkspace(left + dx, free))}px`;
            c.style.top = `${Math.max(0, snapWorkspace(top + dy, free))}px`;
          }
        });

        // Selected wires translate rigidly with assets (ends + bend midpoints)
        if (wireSnapshot) applyWireTranslateSnapshots(wireSnapshot, dx, dy);

        updateAllWirePositions();
        updateAssetConfigChrome();
      }

      function onUp() {
        if (isDragging) {
          dragTargets.forEach((c) => c.classList.remove('dragging'));
          if (wiresDetached && wireSnapshot) restoreWireTerminalsAfterTranslate(wireSnapshot);
          updateAllWirePositions();
          updateAssetConfigChrome();
          markProjectDirty();
          refreshLightningWireGlow();
          refreshShortCircuitCheck();
          validateYesGroundConnections();
        }
        dragSnapshot = null;
        wireSnapshot = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  function findNearestTerminalInComponent(compEl, targetX, targetY) {
    const terminals = compEl.querySelectorAll('.terminal');
    let nearest = null;
    let minDist = Infinity;
    terminals.forEach((t) => {
      const c = getTerminalCenter(t);
      const dist = Math.hypot(c.x - targetX, c.y - targetY);
      if (dist < minDist) {
        minDist = dist;
        nearest = t;
      }
    });
    return nearest;
  }

  function getCanvasCoords(e) {
    return clientToWorld(e.clientX, e.clientY);
  }

  function findComponentAtPoint(clientX, clientY) {
    for (const el of document.elementsFromPoint(clientX, clientY)) {
      if (el.closest('.wire-stack') || el.classList.contains('snap-indicator')) continue;
      if (el.classList.contains('terminal')) return null;
      const comp = el.closest('.component');
      if (comp) return comp;
    }
    return null;
  }

  /** Top-to-bottom stack of wires + lead legs + components under the pointer (overlap cycling). */
  function collectSelectableAtPoint(clientX, clientY) {
    const items = [];
    const seen = new Set();

    function pushWire(wire) {
      if (!wire?.group?.dataset?.id) return;
      const key = `w:${wire.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ kind: 'wire', wire, label: describeWireForOverlap(wire) });
    }

    function pushCapLead(item) {
      const key = `cap:${item.el.dataset.id}:${item.which}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push(item);
    }

    function pushHbFanItem(item) {
      if (!item) return;
      if (item.kind === 'wire') {
        pushWire(item.wire);
        return;
      }
      const key = `hb-fan:${item.el.dataset.id}:${item.tipIdx}`;
      if (seen.has(key)) return;
      // Prefer real lead wire if it appeared elsewhere in the stack
      const wire = getHbTipLeadWire(item.el, item.tipIdx);
      if (wire) {
        pushWire(wire);
        return;
      }
      seen.add(key);
      items.push(item);
    }

    // Drawn wires / fan leads / asset leads under pointer (full stack)
    collectAllStackedWiresAtClient(clientX, clientY).forEach(pushWire);

    // Coloured fans (attached wires + unattached local fan paths)
    collectHbFanOverlapItemsAtClient(clientX, clientY).forEach(pushHbFanItem);

    // Terminals under pointer → every wire / lead docked there
    for (const el of document.elementsFromPoint(clientX, clientY)) {
      const term = el.classList?.contains('terminal') ? el : el.closest?.('.terminal');
      if (!term) continue;
      collectHbLeadWiresForTerminal(term).forEach(pushWire);
      collectAssetWiresForTerminal(term).forEach(pushWire);
      terminalWireMap.get(term)?.forEach((wid) => {
        if (wid != null) pushWire(wires.get(wid));
      });
    }
    terminalsNearClient(clientX, clientY).forEach((term) => {
      collectHbLeadWiresForTerminal(term).forEach(pushWire);
      collectAssetWiresForTerminal(term).forEach(pushWire);
      terminalWireMap.get(term)?.forEach((wid) => {
        if (wid != null) pushWire(wires.get(wid));
      });
    });

    // Capacitor lead legs (not wire-groups)
    collectCapLeadsAtClient(clientX, clientY).forEach(pushCapLead);

    for (const el of document.elementsFromPoint(clientX, clientY)) {
      if (el.closest?.('#asset-config-menu, #asset-config-btn, #asset-state-chrome, #asset-state-term-menu, .context-menu, .app-header, .toolbar')) {
        continue;
      }
      const wireG = el.closest?.('.wire-group');
      if (wireG?.dataset?.id) {
        pushWire(wires.get(wireG.dataset.id));
        continue;
      }
      const fanHitG = el.closest?.('[data-hb-fan-hit]');
      if (fanHitG) {
        const host = fanHitG.closest?.('.component');
        const tipIdx = Number(fanHitG.dataset.hbFanHit);
        if (host && Number.isFinite(tipIdx)) {
          pushHbFanItem({
            kind: 'hb-fan',
            el: host,
            tipIdx,
            label: host.querySelectorAll('.terminal.hb-tip')[tipIdx]?.dataset?.tipLabel || 'Fan',
            color: host.querySelectorAll('.terminal.hb-tip')[tipIdx]?.dataset?.wireColor || '#888',
          });
        }
        continue;
      }
      const capHit = el.classList?.contains('cap-lead-hit') ? el : el.closest?.('.cap-lead-hit');
      if (capHit) {
        const g = capHit.closest?.('[data-cap-lead]');
        const comp = capHit.closest?.('.component');
        if (comp && g?.dataset?.capLead) {
          pushCapLead({
            kind: 'cap-lead',
            el: comp,
            which: g.dataset.capLead,
            label: `Cap ${g.dataset.capLead} lead`,
            color: '#c8cdd6',
          });
        }
        continue;
      }
      if (el.classList?.contains('terminal') || el.closest?.('.terminal')) continue;
      // Wire focus: assets are locked — cycle wires/fans only
      if (wireEditFocusMode) continue;
      // Dual coil: only cycle the asset when pointer is on the label box
      const ph = el.closest?.('.placeholder');
      const comp = el.closest?.('.component');
      if (!comp?.dataset?.id) continue;
      if (comp.classList.contains('workspace-page-hidden')) continue;
      if (isDualCoilComponent(comp) && !ph) continue;
      if (isCapacitorComponent(comp) && !ph) continue;
      const key = `c:${comp.dataset.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ kind: 'component', el: comp, label: comp.dataset.type || 'Part' });
    }
    return items;
  }

  function selectOverlapItem(item) {
    if (!item) return;
    clearOverlapLeadHighlights();
    if (item.kind !== 'hb-fan') heldHbConductor = null;
    if (item.kind === 'wire') {
      selectWire(item.wire);
      return;
    }
    if (item.kind === 'hb-fan') {
      const wire = getHbTipLeadWire(item.el, item.tipIdx);
      if (wire) {
        heldHbConductor = null;
        selectWire(wire);
        return;
      }
      deselectAll();
      highlightHbFanOverlap(item.el, item.tipIdx);
      heldHbConductor = { compId: item.el.dataset.id, tipIdx: item.tipIdx };
      return;
    }
    if (item.kind === 'cap-lead') {
      deselectAll();
      if (!wireEditFocusMode) selectComponent(item.el);
      highlightCapLeadOverlap(item.el, item.which);
      return;
    }
    if (wireEditFocusMode) return;
    selectComponent(item.el);
  }

  function isOverlapItemSelected(item) {
    if (!item) return false;
    if (item.kind === 'wire') return selectedWireGroups.has(item.wire.group);
    if (item.kind === 'hb-fan') {
      const wire = getHbTipLeadWire(item.el, item.tipIdx);
      if (wire) return selectedWireGroups.has(wire.group);
      return !!item.el.querySelector(`[data-hb-fan="${item.tipIdx}"] .hb-fan.overlap-cycle-selected`);
    }
    if (item.kind === 'cap-lead') {
      return !!item.el.querySelector(`[data-cap-lead="${item.which}"] .cap-lead.overlap-cycle-selected`);
    }
    return selectedComponents.has(item.el);
  }

  /** Quick successive double-click only (stricter than OS dblclick). */
  const OVERLAP_DBLCLICK_MS = 420;
  const OVERLAP_DBLCLICK_MOVE_PX = 10;
  let overlapClickStamp = null;

  function consumeQuickOverlapDoubleClick(clientX, clientY) {
    const now = performance.now();
    const prev = overlapClickStamp;
    overlapClickStamp = { t: now, x: clientX, y: clientY };
    if (!prev) return false;
    if (now - prev.t > OVERLAP_DBLCLICK_MS) return false;
    if (Math.hypot(clientX - prev.x, clientY - prev.y) > OVERLAP_DBLCLICK_MOVE_PX) return false;
    // Pair consumed — next click starts a new potential double-click
    overlapClickStamp = null;
    return true;
  }

  let overlapCycleFloatTimer = null;

  function hideOverlapCycleFloat() {
    const el = document.getElementById('overlap-cycle-float');
    if (!el) return;
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
    el.textContent = '';
  }

  function showOverlapCycleFloat(label, colorKey, clientX, clientY) {
    const el = document.getElementById('overlap-cycle-float');
    if (!el || !label) {
      hideOverlapCycleFloat();
      return;
    }
    const hex = WIRE_COLORS[colorKey] || (typeof colorKey === 'string' && colorKey.startsWith('#') ? colorKey : null) || '#ffffff';
    el.textContent = label;
    el.style.color = hex;
    el.style.left = `${clientX}px`;
    el.style.top = `${clientY}px`;
    const light = colorKey === 'white' || colorKey === 'yellow' || hex.toLowerCase() === '#ffffff' || hex.toLowerCase() === '#ffd700';
    el.classList.toggle('is-light-wire', light);
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
    if (overlapCycleFloatTimer) clearTimeout(overlapCycleFloatTimer);
    overlapCycleFloatTimer = setTimeout(() => {
      hideOverlapCycleFloat();
      overlapCycleFloatTimer = null;
    }, 1400);
  }

  function overlapItemDisplayName(item) {
    if (!item) return '';
    if (item.kind === 'wire' && item.wire) {
      return describeWireForOverlap(item.wire);
    }
    if (item.kind === 'hb-fan') {
      return item.label || 'Fan';
    }
    if (item.kind === 'cap-lead') {
      return item.label || `Cap ${item.which || ''} lead`;
    }
    return item.label || 'Part';
  }

  /** Double-click (quick succession) cycles selection through overlapping wires/components. */
  function cycleOverlapSelectionAtPoint(clientX, clientY) {
    const items = collectSelectableAtPoint(clientX, clientY);
    // Prefer cycling only among wires/leads/fans when a stack is present
    const wireItems = items.filter(
      (it) => it.kind === 'wire' || it.kind === 'cap-lead' || it.kind === 'hb-fan'
    );
    const cycleItems = wireItems.length >= 2 ? wireItems : (wireEditFocusMode ? wireItems : items);
    if (cycleItems.length < 2) return false;
    let idx = cycleItems.findIndex((item) => isOverlapItemSelected(item));
    if (idx < 0) idx = 0;
    else idx = (idx + 1) % cycleItems.length;
    const item = cycleItems[idx];
    selectOverlapItem(item);
    const name = overlapItemDisplayName(item);
    const selectedLabel = `Selected: ${name}`;
    setStatus(`${selectedLabel} (${idx + 1}/${cycleItems.length}) — quick double-click to cycle overlap`);
    if (item.kind === 'wire' && item.wire) {
      showOverlapCycleFloat(selectedLabel, wireOverlapColor(item.wire), clientX, clientY);
    } else if (item.kind === 'hb-fan') {
      showOverlapCycleFloat(selectedLabel, item.color || '#888', clientX, clientY);
    } else if (item.kind === 'cap-lead') {
      showOverlapCycleFloat(selectedLabel, item.color || '#c8cdd6', clientX, clientY);
    } else {
      showOverlapCycleFloat(selectedLabel, '#ffffff', clientX, clientY);
    }
    return true;
  }

  function trySelectComponentUnderWire(e) {
    if (wireMode) return false;
    const top = document.elementsFromPoint(e.clientX, e.clientY)[0];
    if (!top?.closest('.wire-group')) return false;
    const comp = findComponentAtPoint(e.clientX, e.clientY);
    if (!comp) return false;
    e.stopPropagation();
    e.preventDefault();
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && selectedComponents.has(comp) && selectedComponents.size > 1) {
      selectComponent(comp, { toggleOff: true });
    } else if (e.shiftKey || ctrl) {
      if (!selectedComponents.has(comp)) selectComponent(comp, { additive: true });
    } else {
      selectComponent(comp);
    }
    return true;
  }

  btnWire.addEventListener('click', () => {
    setWireMode(!wireMode);
  });

  wireGaugeDimensionalToggle?.addEventListener('change', (e) => {
    e.stopPropagation();
    setDimensionalWireGauge(!!wireGaugeDimensionalToggle.checked);
  });

  wireGaugePreviewToggle?.addEventListener('change', (e) => {
    e.stopPropagation();
    setWireGaugePreview(!!wireGaugePreviewToggle.checked);
  });

  wireGaugeMenuClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    setWireGaugeMenuOpen(false);
  });

  wireGaugeReopen?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!wireMode) return;
    setWireGaugeMenuOpen(true);
  });

  wireGaugeDropdownBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    setWireGaugeDropdownOpen(!wireGaugeDropdownOpen);
  });

  wireGaugeOptions.forEach((opt) => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      setWireGauge(opt.dataset.gauge);
      setWireGaugeDropdownOpen(false);
    });
  });

  wireGaugeBar?.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  wireGaugeBar?.addEventListener('click', (e) => {
    e.stopPropagation();
    const inDropdown =
      wireGaugeDropdownBtn?.contains(e.target) ||
      wireGaugeOptionsEl?.contains(e.target);
    if (wireGaugeDropdownOpen && !inDropdown) {
      setWireGaugeDropdownOpen(false);
    }
  });

  document.addEventListener('click', (e) => {
    if (!wireGaugeDropdownOpen) return;
    if (wireGaugeBar?.contains(e.target)) return;
    setWireGaugeDropdownOpen(false);
  });

  syncWireGaugeUi();
  setWireGaugeDropdownOpen(false);

  btnSolid.addEventListener('click', () => setWireStyle('solid'));
  btnDashed.addEventListener('click', () => setWireStyle('dashed'));

  btnLayerVisibility.addEventListener('click', toggleLayerVisibility);
  btnLayerFront.addEventListener('click', () => setLayerAbove(activeLayer, true));
  btnLayerBack.addEventListener('click', () => setLayerAbove(activeLayer, false));

  colorSwatches.forEach((swatch) => {
    swatch.addEventListener('click', () => setWireColor(swatch.dataset.color));
  });

  btnAccentCycle.addEventListener('click', cycleAccentTheme);

  assetConfigBtn?.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  assetConfigBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleAssetConfigMenu();
  });
  assetConfigMenu?.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  assetConfigMenu?.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  document.getElementById('asset-config-grounding')?.addEventListener('change', (e) => {
    const comp = getSingleSelectedComponent();
    if (!comp || isOutputJackComponent(comp)) return;
    setComponentGroundTag(comp, !!e.target.checked);
    markProjectDirty();
    if (e.target.checked) {
      reportGroundingStatus(`${comp.dataset.type}: needs grounding (YESGROUND)`);
    } else {
      reportGroundingStatus(`${comp.dataset.type}: no grounding (NOGROUND)`);
    }
  });

  document.getElementById('asset-config-switch-type')?.addEventListener('change', (e) => {
    const comp = getSingleSelectedComponent();
    if (!comp || !isToggleSwitchComponent(comp)) return;
    const type = e.target.checked ? 2 : 1;
    setToggleSwitchType(comp, type);
    const row = document.getElementById('asset-config-switch-type-row');
    if (row) row.dataset.activeType = String(type);
    markProjectDirty();
    const throwKind = getToggleSwitchThrowLabel(getToggleSwitchThrow(comp));
    setStatus(
      type === 1
        ? `${comp.dataset.type}: ${throwKind} · Type 1`
        : `${comp.dataset.type}: ${throwKind} · Type 2`
    );
    updateAssetStateChrome();
  });

  function bindAssetConfigTextField(inputId, applyValue, statusLabel) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const commit = () => {
      const comp = getSingleSelectedComponent();
      if (!comp) return;
      applyValue(comp, input.value);
      markProjectDirty();
      const shown = String(input.value || '').trim();
      setStatus(shown ? `${statusLabel}: ${shown}` : `${statusLabel} cleared`);
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
        commit();
      }
      e.stopPropagation();
    });
    input.addEventListener('mousedown', (e) => e.stopPropagation());
    input.addEventListener('click', (e) => e.stopPropagation());
  }

  function bindAssetConfigElectricalValueFields() {
    const host = ensureAssetConfigValueFields();
    if (!host || host.dataset.bound === '1') return;
    host.dataset.bound = '1';
    const commitElectricalField = (input, { status = true } = {}) => {
      const comp = getSingleSelectedComponent();
      if (!comp || !input) return;
      const key = input.dataset.valueKey;
      const allowed = getTemplateValueFieldDefs(comp).some((d) => d.key === key);
      if (!allowed) return;
      setComponentElectricalValue(comp, key, input.value);
      markProjectDirty();
      if (status) {
        const def = GuitarAssets.ELECTRICAL_VALUE_DEFS[key];
        const shown = String(input.value || '').trim();
        setStatus(shown ? `${def?.label || key}: ${shown}` : `${def?.label || key} cleared`);
      }
    };
    host.addEventListener('input', (e) => {
      const input = e.target?.closest?.('input[data-value-key]');
      if (!input) return;
      commitElectricalField(input, { status: false });
    });
    host.addEventListener('change', (e) => {
      const input = e.target?.closest?.('input[data-value-key]');
      if (!input) return;
      commitElectricalField(input, { status: true });
    });
    host.addEventListener('keydown', (e) => {
      const input = e.target?.closest?.('input[data-value-key]');
      if (!input) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      e.stopPropagation();
    });
    host.addEventListener('mousedown', (e) => e.stopPropagation());
    host.addEventListener('click', (e) => e.stopPropagation());
  }
  bindAssetConfigElectricalValueFields();

  document.getElementById('asset-config-flashing')?.addEventListener('change', (e) => {
    const comp = getSingleSelectedComponent();
    if (!comp || !isOutputJackComponent(comp)) return;
    setComponentGroundFlash(comp, !!e.target.checked);
    markProjectDirty();
    setStatus(
      e.target.checked
        ? `${comp.dataset.type}: ground flashing on`
        : `${comp.dataset.type}: ground flashing off`
    );
  });

  assetStateAdd?.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  assetStateAdd?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const comp = getSingleSelectedComponent();
    if (!comp) return;
    clearAssetStateClickTimer();
    closeAssetStateTermMenu();
    const idx = GuitarAssets.addInstanceState(comp);
    if (idx < 0) return;
    markProjectDirty();
    updateSelectionStatus();
    updateAssetConfigChrome();
    setStatus(`${comp.dataset.type}: added state ${idx + 1}`);
  });
  assetStateChrome?.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  assetStateTermMenu?.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  assetStateTermMenu?.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  document.addEventListener('mousedown', (e) => {
    if (!assetConfigMenu || assetConfigMenu.classList.contains('hidden')) return;
    if (e.target.closest('#asset-config-menu') || e.target.closest('#asset-config-btn')) return;
    closeAssetConfigMenu();
  });

  document.addEventListener('mousedown', (e) => {
    if (!assetStateTermMenu || assetStateTermMenu.classList.contains('hidden')) return;
    if (e.target.closest('#asset-state-term-menu') || e.target.closest('#asset-state-chrome')) return;
    closeAssetStateTermMenu();
  });

  btnAlignColumn?.addEventListener('click', alignSelectedColumn);
  btnAlignRow?.addEventListener('click', alignSelectedRow);
  btnRotateCcw?.addEventListener('click', () => rotateSelected(-ROT_STEP));
  btnRotateCw?.addEventListener('click', () => rotateSelected(ROT_STEP));

  canvas.addEventListener('click', (e) => {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    if (moveTool) {
      commitMoveClick(e.clientX, e.clientY, e.shiftKey);
      return;
    }
    if (dimTool && dimTool.phase !== 'done') {
      handleDimClick(e);
      return;
    }
    if (e.target.closest('.wire-group')) return;
    if (e.target.classList.contains('terminal')) return;
    if (e.target.closest('.panel-snap-point')) {
      if (placementMode && activeWorkspacePage === 'electronics' && panelLayerVisible) {
        const snapEl = e.target.closest('.panel-snap-point');
        const entry = panelSnapPoints.get(snapEl?.dataset.id);
        if (entry) {
          placeAssetAt(placementMode, entry.x, entry.y);
          return;
        }
      }
      return;
    }

    if (wireMode && handleWireCanvasClick(e)) return;

    if (panelSnapMode && activeWorkspacePage === 'panel' && panelLayerVisible && !e.target.closest('.component')) {
      const { x, y } = getCanvasCoords(e);
      createPanelSnapPoint(snapWorkspace(x), snapWorkspace(y));
      markProjectDirty();
      setStatus('Snap point placed — click to add more · drag-select or click points to move/delete');
      return;
    }

    if (placementMode && !e.target.closest('.component')) {
      const { x, y } = getCanvasCoords(e);
      placeAssetAt(placementMode, x, y);
      return;
    }

    if (e.target.closest('#asset-config-btn') || e.target.closest('#asset-config-menu')) return;
    if (e.target.closest('#asset-state-chrome') || e.target.closest('#asset-state-term-menu')) return;

    if (e.target === canvas || e.target === workspace || !e.target.closest('.component')) {
      deselectAll();
      clearSnapState();
      setStatus(wireMode ? `Click start point (Layer ${activeLayer})` : 'Ready');
    }
  });

  canvas.addEventListener('contextmenu', (e) => {
    if (wireDraftStart) {
      e.preventDefault();
      cancelActiveWireDraft();
      return;
    }
    if (e.target.closest('.wire-group') || e.target.closest('.wire-stack')) return;
    if (e.target.classList.contains('terminal')) return;
    e.preventDefault();
    const comp = e.target.closest('.component');
    GuitarAssets.showContextMenu(e.clientX, e.clientY, comp);
  });

  canvas.addEventListener('mousedown', (e) => {
    if (moveTool) return;
    // Quick successive double-click cycles overlaps before wire grab/drag steals the click
    // (also in wire-focus mode, including coloured fan leads)
    if (
      e.button === 0
      && !wireMode
      && !textCommandOpen
      && !isEditorOpen()
      && !(dimTool && dimTool.phase !== 'done')
      && !e.target.closest?.('.app-header, .toolbar, #asset-config-menu, #asset-state-term-menu, .context-menu, .note-window')
      && consumeQuickOverlapDoubleClick(e.clientX, e.clientY)
      && cycleOverlapSelectionAtPoint(e.clientX, e.clientY)
    ) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (tryInteractSelectedWireThrough(e)) return;
    if (trySelectWireThroughOccluders(e)) return;
    if (trySelectComponentUnderWire(e)) return;
    if (canStartMarquee(e)) {
      marqueeStart = getCanvasCoords(e);
      marqueeActive = false;
      canvas.focus();
      return;
    }
    if (e.target === canvas || e.target === workspace || e.target.closest('.wire-stack')) {
      canvas.focus();
    }
  }, true);

  // Native dblclick is too loose — overlap cycle uses quick-succession clicks only

  document.addEventListener('mousemove', (e) => {
    if (marqueeStart) {
      const current = getCanvasCoords(e);
      const rect = normalizeRect(marqueeStart.x, marqueeStart.y, current.x, current.y);
      if (!marqueeActive
        && (Math.abs(rect.right - rect.left) >= MARQUEE_MIN_PX
          || Math.abs(rect.bottom - rect.top) >= MARQUEE_MIN_PX)) {
        marqueeActive = true;
      }
      if (marqueeActive) {
        updateMarqueeBox(rect);
      }
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (marqueeStart) {
      finishMarquee(e);
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (wireDraftStart) {
      updatePreviewLine(e.clientX, e.clientY);
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!snapPoint || !document.body.classList.contains('snap-active')) return;
    const origin = snapLockPointer || snapPoint;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    if (Math.hypot(dx, dy) >= SNAP_MOVE_CANCEL_PX) {
      clearSnapState();
      setStatus(getSingleSelectedComponent() ? 'Component selected' : wireMode ? `Click start point (Layer ${activeLayer})` : 'Ready');
      return;
    }
    showSnapIndicator(snapPoint.x, snapPoint.y);
  });

  canvas.addEventListener('wheel', (e) => {
    if (qWheelOpen) return;
    if (isMouseWheel(e)) {
      const slackDelta = e.deltaY < 0 ? SLACK_STEP : -SLACK_STEP;
      if (heldWireId || heldHbConductor || selectedWireGroups.size > 0) {
        if (adjustWireSlackAtPointer(e.clientX, e.clientY, slackDelta)) {
          e.preventDefault();
          return;
        }
      }
      if (selectedComponents.size > 0 && canRotateDualCoilWithPointer(e.clientX, e.clientY)) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? ROT_STEP : -ROT_STEP;
        rotateSelected(delta);
        return;
      }
      if (adjustWireSlackAtPointer(e.clientX, e.clientY, slackDelta)) {
        e.preventDefault();
        return;
      }
    }
    e.preventDefault();
    if (isMouseWheel(e)) {
      zoomAtSmooth(e.clientX, e.clientY, e.deltaY);
    } else {
      zoomAtStep(e.clientX, e.clientY, e.deltaY > 0 ? -1 : 1);
    }
  }, { passive: false });

  document.addEventListener('mousemove', (e) => {
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    if (wirePlaceCursorMark && !wirePlaceCursorMark.classList.contains('hidden')) {
      wirePlaceCursorMark.style.left = `${e.clientX}px`;
      wirePlaceCursorMark.style.top = `${e.clientY}px`;
    }
    if (qWheelOpen) updateWheelIndexFromPointer(e.clientX, e.clientY);
    if (placementMode) updatePlacementSnapHover(e.clientX, e.clientY);
    if (dimTool && dimTool.phase !== 'done') {
      handleDimPointer(e.clientX, e.clientY, e.shiftKey);
    }
    if (moveTool) {
      handleMovePointer(e.clientX, e.clientY, e.shiftKey);
    }
    updatePanelCursorSnap(e.clientX, e.clientY, e.shiftKey);
  });

  document.addEventListener('wheel', (e) => {
    if (!qWheelOpen) return;
    e.preventDefault();
    const n = getAssetWheelItems().length;
    if (n > 1) {
      qWheelIndex = (qWheelIndex + (e.deltaY > 0 ? 1 : -1) + n) % n;
      renderAssetWheel();
    }
  }, { passive: false });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (textCommandOpen) {
        e.preventDefault();
        runMatchedTextCommand();
        return;
      }
      if (isTypingTarget() || isEditorOpen()) return;
      if (dimTool && dimTool.phase !== 'done') return;
      if (moveTool) return;
      e.preventDefault();
      if (selectedWireGroups.size > 0) {
        deselectAll();
        updateSelectionStatus();
      }
      openTextCommandBox(lastPointerX, lastPointerY);
      return;
    }
    if (e.key === 'Tab' && textCommandOpen) {
      e.preventDefault();
      const match = findNearestTextCommand(textCommandInput?.value || '');
      if (match && textCommandInput) {
        textCommandInput.value = (match.short || match.name).toUpperCase();
        updateTextCommandHint();
      }
      return;
    }
    if (
      e.key === 'Tab'
      && !e.ctrlKey
      && !e.metaKey
      && !e.altKey
      && !textCommandOpen
      && !isTypingTarget()
      && !isEditorOpen()
      && activeWorkspacePage === 'panel'
    ) {
      e.preventDefault();
      togglePanelCursorGridSnap();
      return;
    }

    const mod = e.ctrlKey || e.metaKey;
    if (!isTypingTarget() && !textCommandOpen && !isEditorOpen()) {
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redoEdit();
        else undoEdit();
        return;
      }
      if (!mod && e.shiftKey && (e.key === 'z' || e.key === 'Z') && e.code === 'KeyZ') {
        e.preventDefault();
        redoEdit();
        return;
      }
      if (mod && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        copySelectionToClipboard();
        return;
      }
      if (mod && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        cutSelection();
        return;
      }
      if (mod && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        pasteClipboard();
        return;
      }
    }

    if (e.key === 'q' || e.key === 'Q') {
      if (isTypingTarget() || isEditorOpen() || textCommandOpen) return;
      if (e.repeat) return;
      qKeyHeld = true;
      qOpenedWheel = false;
      qKeyDownAt = performance.now();
      scheduleQHoldWheel();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (isTypingTarget() || textCommandOpen) return;
      if (cancelActiveWireDraft()) {
        e.preventDefault();
        return;
      }
      if (deleteSelectedPanelSnapPoint()) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      deleteSelected();
    }
    if ((e.key === '+' || e.key === '=' || e.key === '-' || e.code === 'NumpadAdd' || e.code === 'NumpadSubtract')
      && !isTypingTarget() && !textCommandOpen) {
      const slackDelta = (e.key === '-' || e.code === 'NumpadSubtract') ? -SLACK_STEP : SLACK_STEP;
      // Holding or selecting a wire always bends (even if dual coil is also selected)
      if (heldWireId || heldHbConductor || selectedWireGroups.size > 0) {
        if (adjustWireSlackAtPointer(lastPointerX, lastPointerY, slackDelta)) {
          e.preventDefault();
          return;
        }
      }
      // Dual-coil body hover/hold → rotate; otherwise bend tip leads under the pointer
      if (selectedComponents.size > 0 && canRotateDualCoilWithPointer(lastPointerX, lastPointerY)) {
        e.preventDefault();
        const delta = (e.key === '-' || e.code === 'NumpadSubtract') ? -ROT_STEP : ROT_STEP;
        rotateSelected(delta);
        return;
      }
      if (adjustWireSlackAtPointer(lastPointerX, lastPointerY, slackDelta)) {
        e.preventDefault();
        return;
      }
    }
    if (e.key >= '1' && e.key <= '4' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (isTypingTarget() || textCommandOpen) return;
      setActiveLayer(Number(e.key));
    }
    if ((e.key === 'e' || e.key === 'E')
      && !isTypingTarget()
      && !isEditorOpen()
      && !textCommandOpen
      && document.getElementById('asset-editor')?.classList.contains('hidden')) {
      if (selectedComponents.size > 0 && cycleSelectedComponentState(1)) {
        e.preventDefault();
      }
    }
    if (e.key === 'Escape') {
      if (textCommandOpen) {
        e.preventDefault();
        closeTextCommandBox();
        setStatus('Ready');
        return;
      }
      if (cancelDimensionTool()) {
        e.preventDefault();
        return;
      }
      if (cancelMoveTool()) {
        e.preventDefault();
        return;
      }
      if (qWheelOpen) {
        closeAssetWheel();
        qOpenedWheel = false;
        qKeyHeld = false;
        clearTimeout(qHoldTimer);
        setStatus('Ready');
        return;
      }
      if (assetConfigMenu && !assetConfigMenu.classList.contains('hidden')) {
        closeAssetConfigMenu();
        return;
      }
      cancelWireDraft();
      setPlacementMode(null);
      setWireMode(false);
      deselectAll();
      clearSnapState();
      setStatus('Ready');
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key !== 'q' && e.key !== 'Q') return;
    if (isTypingTarget() || isEditorOpen()) return;
    clearTimeout(qHoldTimer);
    const wasTap = performance.now() - qKeyDownAt < Q_TAP_MAX_MS;
    if (qOpenedWheel && !wasTap) {
      confirmAssetWheelSelection();
    } else if (selectedComponents.size > 0) {
      cycleSelectedComponentState(-1);
    }
    qKeyHeld = false;
    qOpenedWheel = false;
    closeAssetWheel();
  });

  const PROJECTS_STORAGE_KEY = 'guitar-wiring-projects-v1';
  const DEFAULT_PROJECT_NAME = 'Unsaved Project';

  let projectRecords = [];
  let activeProjectId = null;
  let projectName = '';
  let projectDirty = false;
  let projectSwitcherOpen = false;
  let projectListOpen = false;
  let projectSwitcherAnimating = false;
  let projectDetailsMode = null;
  let pendingProjectDelete = false;

  const projectSwitcherEl = () => document.getElementById('project-switcher');
  const projectDetailsEl = () => document.getElementById('project-details-dialog');
  const projectDetailsNameEl = () => document.getElementById('project-details-name');

  function markProjectDirty() {
    if (!historySuspended) {
      commitHistoryBaseline();
    }
    if (projectDirty) return;
    projectDirty = true;
    updateProjectSwitcherUI();
  }

  let undoStack = [];
  let redoStack = [];
  let historyBaseline = null;
  let historySuspended = false;
  const HISTORY_LIMIT = 100;
  const PASTE_OFFSET = WORKSPACE_GRID * 2;
  let editClipboard = null;

  function commitHistoryBaseline() {
    const now = JSON.stringify(serializeProjectData());
    if (historyBaseline == null) {
      historyBaseline = now;
      return;
    }
    if (now === historyBaseline) return;
    undoStack.push(historyBaseline);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
    historyBaseline = now;
  }

  function seedHistoryBaseline(resetStacks) {
    if (resetStacks) {
      undoStack.length = 0;
      redoStack.length = 0;
    }
    historyBaseline = JSON.stringify(serializeProjectData());
  }

  function undoEdit() {
    if (undoStack.length === 0) {
      setStatus('Nothing to undo');
      return false;
    }
    const current = JSON.stringify(serializeProjectData());
    const prev = undoStack.pop();
    redoStack.push(current);
    historySuspended = true;
    try {
      applyProjectData(JSON.parse(prev));
    } finally {
      historySuspended = false;
      historyBaseline = prev;
    }
    projectDirty = true;
    updateProjectSwitcherUI();
    setStatus('Undo');
    return true;
  }

  function redoEdit() {
    if (redoStack.length === 0) {
      setStatus('Nothing to redo');
      return false;
    }
    const current = JSON.stringify(serializeProjectData());
    const next = redoStack.pop();
    undoStack.push(current);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    historySuspended = true;
    try {
      applyProjectData(JSON.parse(next));
    } finally {
      historySuspended = false;
      historyBaseline = next;
    }
    projectDirty = true;
    updateProjectSwitcherUI();
    setStatus('Redo');
    return true;
  }

  function serializeComponentRecord(el) {
    if (el.dataset.cadImport === 'true') {
      return {
        id: el.dataset.id,
        cadImport: true,
        cadName: el.dataset.cadName || 'CAD',
        cadSvg: el.dataset.cadSvg || '',
        cadUnitW: Number(el.dataset.cadUnitW) || 10,
        cadUnitH: Number(el.dataset.cadUnitH) || 10,
        left: parseFloat(el.style.left) || 0,
        top: parseFloat(el.style.top) || 0,
        rotation: parseFloat(el.dataset.rotation) || 0,
        workspacePage: 'panel',
      };
    }
    return {
      id: el.dataset.id,
      assetId: el.dataset.assetId,
      left: parseFloat(el.style.left) || 0,
      top: parseFloat(el.style.top) || 0,
      rotation: parseFloat(el.dataset.rotation) || 0,
      groundTag: el.dataset.groundTag || 'NOGROUND',
      groundFlash: el.dataset.groundFlash !== 'false',
      switchType: isToggleSwitchComponent(el) ? getToggleSwitchType(el) : undefined,
      impedance: el.dataset.impedance || '',
      resistance: el.dataset.resistance || '',
      capacitance: el.dataset.capacitance || '',
      inductance: el.dataset.inductance || '',
      voltage: el.dataset.voltage || '',
      electricalValues: collectComponentElectricalValues(el),
      capLeadSlackTop: parseFloat(el.dataset.capLeadSlackTop) || parseFloat(el.dataset.capLeadSlackLeft) || 0,
      capLeadSlackBottom: parseFloat(el.dataset.capLeadSlackBottom) || parseFloat(el.dataset.capLeadSlackRight) || 0,
      capTip0Left: el.dataset.capTip0Left || '',
      capTip0Top: el.dataset.capTip0Top || '',
      capTip1Left: el.dataset.capTip1Left || '',
      capTip1Top: el.dataset.capTip1Top || '',
      capTip0AttachComp: el.dataset.capTip0AttachComp || '',
      capTip0AttachTerm: el.dataset.capTip0AttachTerm || '',
      capTip1AttachComp: el.dataset.capTip1AttachComp || '',
      capTip1AttachTerm: el.dataset.capTip1AttachTerm || '',
      assetWires: hasAssetWireTerms(el)
        ? getAssetWireTips(el).map((_, idx) => ({
          left: el.dataset[`awTip${idx}Left`] || '',
          top: el.dataset[`awTip${idx}Top`] || '',
          slack: getAssetWireLeadSlack(el, idx),
          attachComp: el.dataset[`awTip${idx}AttachComp`] || '',
          attachTerm: el.dataset[`awTip${idx}AttachTerm`] || '',
        }))
        : undefined,
      hbJunctionLeft: el.dataset.hbJunctionLeft || '',
      hbJunctionTop: el.dataset.hbJunctionTop || '',
      hbLoomSlack: el.dataset.hbLoomSlack || '',
      hbWireLayer: el.dataset.hbWireLayer || '',
      hbTip0Left: el.dataset.hbTip0Left || '',
      hbTip0Top: el.dataset.hbTip0Top || '',
      hbTip1Left: el.dataset.hbTip1Left || '',
      hbTip1Top: el.dataset.hbTip1Top || '',
      hbTip2Left: el.dataset.hbTip2Left || '',
      hbTip2Top: el.dataset.hbTip2Top || '',
      hbTip3Left: el.dataset.hbTip3Left || '',
      hbTip3Top: el.dataset.hbTip3Top || '',
      hbTip4Left: el.dataset.hbTip4Left || '',
      hbTip4Top: el.dataset.hbTip4Top || '',
      hbTip0AttachComp: el.dataset.hbTip0AttachComp || '',
      hbTip0AttachTerm: el.dataset.hbTip0AttachTerm || '',
      hbTip1AttachComp: el.dataset.hbTip1AttachComp || '',
      hbTip1AttachTerm: el.dataset.hbTip1AttachTerm || '',
      hbTip2AttachComp: el.dataset.hbTip2AttachComp || '',
      hbTip2AttachTerm: el.dataset.hbTip2AttachTerm || '',
      hbTip3AttachComp: el.dataset.hbTip3AttachComp || '',
      hbTip3AttachTerm: el.dataset.hbTip3AttachTerm || '',
      hbTip4AttachComp: el.dataset.hbTip4AttachComp || '',
      hbTip4AttachTerm: el.dataset.hbTip4AttachTerm || '',
      hbFanSlack0: el.dataset.hbFanSlack0 || '',
      hbFanSlack1: el.dataset.hbFanSlack1 || '',
      hbFanSlack2: el.dataset.hbFanSlack2 || '',
      hbFanSlack3: el.dataset.hbFanSlack3 || '',
      hbFanSlack4: el.dataset.hbFanSlack4 || '',
      hbFanSlackUser0: el.dataset.hbFanSlackUser0 || '',
      hbFanSlackUser1: el.dataset.hbFanSlackUser1 || '',
      hbFanSlackUser2: el.dataset.hbFanSlackUser2 || '',
      hbFanSlackUser3: el.dataset.hbFanSlackUser3 || '',
      hbFanSlackUser4: el.dataset.hbFanSlackUser4 || '',
      workspacePage: getComponentWorkspacePage(el),
      stateIndex: GuitarAssets.getComponentStateIndex(el),
      instanceStates: el._instanceStates
        ? JSON.parse(JSON.stringify(el._instanceStates))
        : null,
    };
  }

  function serializeWireRecord(wire) {
    if (!wire) return null;
    // Asset pigtails are recreated from the host component tip state
    if (isAssetWire(wire)) return null;
    const record = {
      id: wire.id,
      color: wire.color,
      dashed: !!wire.dashed,
      layer: wire.layer,
      slack: wire.slack || 0,
      anchors: (wire.anchors || []).map((a) => ({ x: a.x, y: a.y })),
      start: terminalRefFromEndpoint(wire.start),
      end: terminalRefFromEndpoint(wire.end),
      wireKind: wire.wireKind || wire.group?.dataset?.wireKind || '',
      hbLead: !!(wire.hbLeadCompId || wire.group?.dataset?.hbLead === 'true'),
    };
    // Only persist gauge when present — missing gaugeMm → legacy CSS 2px stroke on load
    if (Number.isFinite(wire.gaugeMm)) record.gaugeMm = wire.gaugeMm;
    return record;
  }

  function getClipboardWireIds() {
    const ids = new Set([...selectedWireGroups].map((g) => g.dataset.id));
    const compIds = new Set([...selectedComponents].map((c) => c.dataset.id));
    if (compIds.size >= 2) {
      wires.forEach((wire) => {
        const s = wire.start.terminal?.closest('.component')?.dataset.id;
        const e = wire.end.terminal?.closest('.component')?.dataset.id;
        if (s && e && compIds.has(s) && compIds.has(e)) ids.add(wire.id);
      });
    }
    return ids;
  }

  function copySelectionToClipboard() {
    const comps = [...selectedComponents];
    const wireIds = getClipboardWireIds();
    if (comps.length === 0 && wireIds.size === 0) {
      setStatus('Nothing to copy');
      return false;
    }
    editClipboard = {
      components: comps.map(serializeComponentRecord),
      wires: [...wireIds].map((id) => serializeWireRecord(wires.get(id))).filter(Boolean),
    };
    setStatus(`Copied ${comps.length} part(s), ${editClipboard.wires.length} wire(s)`);
    return true;
  }

  function cutSelection() {
    if (!copySelectionToClipboard()) return false;
    deleteSelected();
    setStatus('Cut');
    return true;
  }

  function pasteClipboard() {
    if (!editClipboard?.components?.length && !editClipboard?.wires?.length) {
      setStatus('Clipboard empty');
      return false;
    }
    const idMap = new Map();
    const pastedComps = [];
    const pastedWires = [];

    (editClipboard.components || []).forEach((raw) => {
      const src = JSON.parse(JSON.stringify(raw));
      const oldId = src.id;
      const newId = `cmp-${++componentIdCounter}`;
      idMap.set(oldId, newId);
      src.id = newId;
      src.left = (src.left || 0) + PASTE_OFFSET;
      src.top = (src.top || 0) + PASTE_OFFSET;
      pastedComps.push(src);
    });

    pastedComps.forEach((src, i) => {
      const orig = editClipboard.components[i];
      ['0', '1'].forEach((idx) => {
        const attachComp = orig?.[`capTip${idx}AttachComp`];
        if (attachComp && idMap.has(attachComp)) {
          src[`capTip${idx}AttachComp`] = idMap.get(attachComp);
          src[`capTip${idx}AttachTerm`] = orig[`capTip${idx}AttachTerm`];
        } else {
          delete src[`capTip${idx}AttachComp`];
          delete src[`capTip${idx}AttachTerm`];
        }
      });
      for (let idx = 0; idx < 5; idx++) {
        const attachComp = orig?.[`hbTip${idx}AttachComp`];
        if (attachComp && idMap.has(attachComp)) {
          src[`hbTip${idx}AttachComp`] = idMap.get(attachComp);
          src[`hbTip${idx}AttachTerm`] = orig[`hbTip${idx}AttachTerm`];
        } else {
          delete src[`hbTip${idx}AttachComp`];
          delete src[`hbTip${idx}AttachTerm`];
        }
        delete src[`hbTip${idx}WireId`];
      }
      remapAssetWireAttachIds(src, orig, idMap);
    });

    deselectAll();
    historySuspended = true;
    try {
      pastedComps.forEach((compData) => {
        if (compData.cadImport) {
          restoreCadGroup(compData);
          const el = components.get(compData.id);
          if (el) {
            el.classList.add('selected');
            selectedComponents.add(el);
          }
          return;
        }
        const template = GuitarAssets.getTemplate(compData.assetId);
        if (!template) return;
        const el = GuitarAssets.buildComponentDOM(template, compData.id);
        el.style.left = `${compData.left || 0}px`;
        el.style.top = `${compData.top || 0}px`;
        if (compData.rotation) {
          el.dataset.rotation = String(compData.rotation);
          el.style.transform = `rotate(${compData.rotation}deg)`;
        }
        setComponentGroundTag(el, compData.groundTag === 'YESGROUND');
        if (isToggleSwitchComponent(el)) {
          el.dataset.switchType = compData.switchType === 2 || compData.switchType === '2' ? '2' : '1';
        }
        applyComponentElectricalValues(el, mergeElectricalValueRecord(compData), { notify: false });
        if (compData.capLeadSlackTop) setCapLeadSlack(el, 'top', compData.capLeadSlackTop);
        if (compData.capLeadSlackBottom) setCapLeadSlack(el, 'bottom', compData.capLeadSlackBottom);
        ['0', '1'].forEach((idx) => {
          const left = compData[`capTip${idx}Left`];
          const top = compData[`capTip${idx}Top`];
          if (left != null && left !== '') el.dataset[`capTip${idx}Left`] = String(left);
          if (top != null && top !== '') el.dataset[`capTip${idx}Top`] = String(top);
          const attachComp = compData[`capTip${idx}AttachComp`];
          const attachTerm = compData[`capTip${idx}AttachTerm`];
          if (attachComp) el.dataset[`capTip${idx}AttachComp`] = String(attachComp);
          if (attachTerm != null && attachTerm !== '') {
            el.dataset[`capTip${idx}AttachTerm`] = String(attachTerm);
          }
        });
        applyHbLeadData(el, compData);
        applyAssetWireData(el, compData);
        if (template.isOutputJack || el.dataset.assetId === 'mono-output' || el.dataset.assetId === 'stereo-output') {
          setComponentGroundFlash(el, compData.groundFlash !== false);
        }
        if (compData.instanceStates?.length) {
          GuitarAssets.setInstanceStates(el, compData.instanceStates);
        } else if (isToggleSwitchComponent(el)) {
          applyToggleSwitchTypeWiring(el, getToggleSwitchType(el));
        }
        setComponentWorkspacePage(el, compData.workspacePage || 'electronics');
        workspace.appendChild(el);
        components.set(el.dataset.id, el);
        setupComponentInteraction(el);
        if (GuitarAssets.getEffectiveStates(el).length) {
          GuitarAssets.applyComponentStateVisuals(el, template, compData.stateIndex || 0);
        }
        el.classList.add('selected');
        selectedComponents.add(el);
      });

      (editClipboard.wires || []).forEach((raw) => {
        const src = JSON.parse(JSON.stringify(raw));
        delete src.id;
        const remapEnd = (end) => {
          if (!end) return end;
          if (end.componentId && idMap.has(end.componentId)) {
            return { ...end, componentId: idMap.get(end.componentId) };
          }
          if (end.componentId && !idMap.has(end.componentId)) {
            return { x: (end.x || 0) + PASTE_OFFSET, y: (end.y || 0) + PASTE_OFFSET };
          }
          return {
            x: (end.x || 0) + PASTE_OFFSET,
            y: (end.y || 0) + PASTE_OFFSET,
          };
        };
        src.start = remapEnd(src.start);
        src.end = remapEnd(src.end);
        const wire = createWireFromSnapshot(src);
        if (wire) {
          wire.group.classList.add('selected');
          selectedWireGroups.add(wire.group);
          pastedWires.push(wire);
        }
      });

      syncAllCapacitorTipAttachments();
      syncAllDualCoilLeads();
      relinkHbTipLeadWires();
      updateAllWirePositions();
      refreshLightningWireGlow();
      refreshShortCircuitCheck();
      validateYesGroundConnections();
      syncWireToolbarFromSelection();
      updateSelectionStatus();
    } finally {
      historySuspended = false;
    }
    markProjectDirty();
    setStatus(`Pasted ${pastedComps.length} part(s), ${pastedWires.length} wire(s)`);
    return true;
  }

  function getDisplayProjectName() {
    const base = projectName.trim() || DEFAULT_PROJECT_NAME;
    return projectDirty ? `${base}*` : base;
  }

  function loadProjectRecords() {
    try {
      const raw = JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) || 'null');
      if (!raw || !Array.isArray(raw.projects)) {
        projectRecords = [];
        activeProjectId = null;
        return;
      }
      projectRecords = raw.projects.filter((p) => p && p.id && p.name);
      activeProjectId = raw.activeId && projectRecords.some((p) => p.id === raw.activeId)
        ? raw.activeId
        : null;
    } catch {
      projectRecords = [];
      activeProjectId = null;
    }
  }

  function persistProjectRecords() {
    localStorage.setItem(
      PROJECTS_STORAGE_KEY,
      JSON.stringify({ projects: projectRecords, activeId: activeProjectId })
    );
  }

  function terminalRefFromEndpoint(endpoint) {
    const term = endpoint?.terminal;
    if (!term || !document.body.contains(term)) {
      return { x: endpoint?.x || 0, y: endpoint?.y || 0 };
    }
    const comp = term.closest('.component');
    if (!comp) return { x: endpoint.x, y: endpoint.y };
    const terms = [...comp.querySelectorAll('.terminal')];
    return {
      componentId: comp.dataset.id,
      terminalIndex: terms.indexOf(term),
      x: endpoint.x,
      y: endpoint.y,
    };
  }

  function serializeProjectData() {
    return {
      version: 1,
      panX,
      panY,
      zoom,
      activeLayer,
      activeWorkspacePage,
      wireColor,
      wireStyle,
      wireGaugeMm,
      layerState: JSON.parse(JSON.stringify(layerState)),
      components: [...components.values()].map(serializeComponentRecord),
      wires: [...wires.values()].map(serializeWireRecord).filter(Boolean),
      panelSnapPoints: [...panelSnapPoints.values()].map(({ el, x, y }) => ({
        id: el.dataset.id,
        x,
        y,
      })),
      notes: [...noteWindows.values()].map((note) => ({
        id: note.id,
        x: note.x,
        y: note.y,
        title: note.titleInput.value || DEFAULT_NOTE_TITLE,
        body: note.pad.value || '',
        page: note.page,
        layer: note.layer,
        expanded: !!note.expanded,
        locked: !!note.locked,
      })),
    };
  }

  function clearCanvasContents() {
    deselectAll();
    cancelWireDraft();
    clearSnapState();
    setPanelSnapMode(false);
    clearAllPanelSnapPoints();
    clearAllNoteWindows();
    wires.forEach((wire) => {
      unregisterTerminalWire(wire.start.terminal, wire.id);
      unregisterTerminalWire(wire.end.terminal, wire.id);
      wire.group.remove();
    });
    wires.clear();
    terminalWireMap.clear();
    components.forEach((el) => {
      removeHbWorldLeadGroup(el);
      el.remove();
    });
    document.querySelectorAll('g[data-hb-world-leads]').forEach((n) => n.remove());
    components.clear();
  }

  function resolveTerminalRef(ref) {
    if (!ref?.componentId) return null;
    const comp = components.get(ref.componentId);
    if (!comp) return null;
    const terms = [...comp.querySelectorAll('.terminal')];
    return terms[ref.terminalIndex] || null;
  }

  function createWireFromSnapshot(data) {
    const id = data.id || `wire-${++wireIdCounter}`;
    const match = /^wire-(\d+)$/.exec(id);
    if (match) wireIdCounter = Math.max(wireIdCounter, Number(match[1]));

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('wire-group');
    group.dataset.id = id;
    group.dataset.layer = String(data.layer);

    const hit = createWirePathElement('wire-hit');
    const visible = createWirePathElement(`wire-visible ${data.dashed ? 'dashed' : ''}`);
    visible.setAttribute('stroke', WIRE_COLORS[data.color] || WIRE_COLORS.white);
    if (data.color === 'black') visible.setAttribute('stroke-linecap', 'round');

    group.appendChild(hit);

    const startTerm = resolveTerminalRef(data.start);
    const endTerm = resolveTerminalRef(data.end);
    const wire = {
      id,
      group,
      hit,
      visible,
      outline: null,
      selectBorder: null,
      cloth: null,
      tipStart: null,
      tipStartStreak: null,
      tipEnd: null,
      tipEndStreak: null,
      color: WIRE_COLORS[data.color] ? data.color : 'white',
      // Legacy projects omit gaugeMm → leave unset so CSS stroke-width: 2 remains
      gaugeMm: Number.isFinite(data.gaugeMm) ? data.gaugeMm : undefined,
      dashed: !!data.dashed,
      layer: data.layer || 1,
      slack: data.slack || 0,
      anchors: Array.isArray(data.anchors)
        ? data.anchors
          .filter((a) => a && Number.isFinite(a.x) && Number.isFinite(a.y))
          .map((a) => ({ x: a.x, y: a.y }))
        : [],
      start: {
        x: data.start?.x || 0,
        y: data.start?.y || 0,
        terminal: startTerm,
      },
      end: {
        x: data.end?.x || 0,
        y: data.end?.y || 0,
        terminal: endTerm,
      },
      wireKind: data.wireKind || '',
    };

    if (data.wireKind) group.dataset.wireKind = String(data.wireKind);
    if (data.hbLead || data.wireKind === '4conductor') {
      group.dataset.hbLead = 'true';
      group.classList.add('hb-lead-wire');
      visible.setAttribute('stroke-width', String(HB_FAN_STROKE));
    }

    appendWireVisualLayers(wire, wire.dashed);
    syncWireBorderClasses(wire);

    getLayerGroup(wire.layer, wireStackAboveForLayer(wire.layer)).appendChild(group);
    wires.set(id, wire);
    registerTerminalWire(wire.start.terminal, id);
    registerTerminalWire(wire.end.terminal, id);
    updateWirePosition(wire);
    if (isWireTooShort(wire)) {
      discardWire(wire);
      return null;
    }
    setupWireInteraction(wire);
    return wire;
  }

  function applyProjectData(data, opts = {}) {
    clearCanvasContents();
    if (!data || typeof data !== 'object') {
      panX = 0;
      panY = 0;
      zoom = 1;
      activeLayer = 1;
      activeWorkspacePage = 'electronics';
      syncWorkspacePageButtons();
      applyWorkspaceGridSize();
      for (let i = 1; i <= LAYER_COUNT; i++) {
        layerState[i] = { visible: true, above: false };
        applyLayerVisibility(i);
      }
      updateLayerUI();
      applyViewport();
      validateYesGroundConnections();
      seedHistoryBaseline(!!opts.resetHistory);
      return;
    }

    panX = data.panX || 0;
    panY = data.panY || 0;
    zoom = typeof data.zoom === 'number' ? data.zoom : 1;
    activeLayer = data.activeLayer || 1;
    activeWorkspacePage = data.activeWorkspacePage === 'panel' ? 'panel' : 'electronics';
    syncWorkspacePageButtons();
    applyWorkspaceGridSize();
    if (WIRE_COLORS[data.wireColor]) {
      wireColor = data.wireColor;
      colorSwatches.forEach((swatch) => {
        swatch.classList.toggle('active', swatch.dataset.color === wireColor);
      });
    }
    if (data.wireStyle === 'solid' || data.wireStyle === 'dashed') {
      wireStyle = data.wireStyle;
      btnSolid.classList.toggle('active', wireStyle === 'solid');
      btnDashed.classList.toggle('active', wireStyle === 'dashed');
    }
    if (Number.isFinite(data.wireGaugeMm) && data.wireGaugeMm > 0) {
      wireGaugeMm = data.wireGaugeMm;
      syncWireGaugeUi();
    } else {
      wireGaugeMm = DEFAULT_WIRE_GAUGE_MM;
      syncWireGaugeUi();
    }

    for (let i = 1; i <= LAYER_COUNT; i++) {
      const saved = data.layerState?.[i];
      layerState[i] = {
        visible: saved?.visible !== false,
        above: !!saved?.above,
      };
      applyLayerVisibility(i);
    }
    updateLayerUI();

    (data.components || []).forEach((compData) => {
      if (compData.cadImport) {
        const match = /^cmp-(\d+)$/.exec(compData.id || '');
        if (match) componentIdCounter = Math.max(componentIdCounter, Number(match[1]));
        restoreCadGroup(compData);
        return;
      }
      const template = GuitarAssets.getTemplate(compData.assetId);
      if (!template) return;
      const match = /^cmp-(\d+)$/.exec(compData.id || '');
      if (match) componentIdCounter = Math.max(componentIdCounter, Number(match[1]));
      const el = GuitarAssets.buildComponentDOM(template, compData.id || `cmp-${++componentIdCounter}`);
      el.style.left = `${compData.left || 0}px`;
      el.style.top = `${compData.top || 0}px`;
      if (compData.rotation) {
        el.dataset.rotation = String(compData.rotation);
        el.style.transform = `rotate(${compData.rotation}deg)`;
      }
      setComponentGroundTag(el, compData.groundTag === 'YESGROUND');
      if (isToggleSwitchComponent(el)) {
        el.dataset.switchType = compData.switchType === 2 || compData.switchType === '2' ? '2' : '1';
      }
      applyComponentElectricalValues(el, mergeElectricalValueRecord(compData), { notify: false });
      if (compData.capLeadSlackTop || compData.capLeadSlackLeft) {
        setCapLeadSlack(el, 'top', compData.capLeadSlackTop || compData.capLeadSlackLeft);
      }
      if (compData.capLeadSlackBottom || compData.capLeadSlackRight) {
        setCapLeadSlack(el, 'bottom', compData.capLeadSlackBottom || compData.capLeadSlackRight);
      }
      ['0', '1'].forEach((idx) => {
        const left = compData[`capTip${idx}Left`];
        const top = compData[`capTip${idx}Top`];
        if (left != null && left !== '') el.dataset[`capTip${idx}Left`] = String(left);
        if (top != null && top !== '') el.dataset[`capTip${idx}Top`] = String(top);
        const attachComp = compData[`capTip${idx}AttachComp`];
        const attachTerm = compData[`capTip${idx}AttachTerm`];
        if (attachComp) el.dataset[`capTip${idx}AttachComp`] = String(attachComp);
        if (attachTerm != null && attachTerm !== '') {
          el.dataset[`capTip${idx}AttachTerm`] = String(attachTerm);
        }
      });
      applyHbLeadData(el, compData);
      applyAssetWireData(el, compData);
      if (template.isOutputJack || el.dataset.assetId === 'mono-output' || el.dataset.assetId === 'stereo-output') {
        setComponentGroundFlash(el, compData.groundFlash !== false);
      }
      if (compData.instanceStates?.length) {
        GuitarAssets.setInstanceStates(el, compData.instanceStates);
      } else if (isToggleSwitchComponent(el)) {
        applyToggleSwitchTypeWiring(el, getToggleSwitchType(el));
      }
      setComponentWorkspacePage(el, compData.workspacePage || 'electronics');
      workspace.appendChild(el);
      components.set(el.dataset.id, el);
      setupComponentInteraction(el);
      if (GuitarAssets.getEffectiveStates(el).length) {
        GuitarAssets.applyComponentStateVisuals(el, template, compData.stateIndex || 0);
      }
    });

    (data.wires || []).forEach((wireData) => createWireFromSnapshot(wireData));

    syncAllCapacitorTipAttachments();
    syncAllDualCoilLeads();
    syncAllAssetWireLeads();
    relinkHbTipLeadWires();
    refreshShortCircuitCheck();
    validateYesGroundConnections();

    clearAllPanelSnapPoints();
    (data.panelSnapPoints || []).forEach((pt) => {
      if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
        createPanelSnapPoint(pt.x, pt.y, pt.id);
      }
    });

    clearAllNoteWindows();
    (data.notes || []).forEach((n) => {
      if (!n || !Number.isFinite(n.x) || !Number.isFinite(n.y)) return;
      createNoteWindow({
        id: n.id,
        x: n.x,
        y: n.y,
        title: n.title || DEFAULT_NOTE_TITLE,
        body: n.body || '',
        page: n.page === 'panel' ? 'panel' : 'electronics',
        layer: n.layer || 1,
        expanded: n.expanded !== false,
        locked: !!n.locked,
      });
    });

    applyViewport();
    applyWorkspacePageVisibility();
    updateAllTerminalBadges();
    refreshLightningWireGlow();
    validateYesGroundConnections();
    updateSelectionStatus();
    seedHistoryBaseline(!!opts.resetHistory);
  }

  function getActiveProjectRecord() {
    return projectRecords.find((p) => p.id === activeProjectId) || null;
  }

  function writeActiveProjectSnapshot() {
    const data = serializeProjectData();
    const now = Date.now();
    if (!activeProjectId) {
      activeProjectId = `proj-${now}`;
      projectRecords.push({
        id: activeProjectId,
        name: projectName.trim() || DEFAULT_PROJECT_NAME,
        updatedAt: now,
        data,
      });
    } else {
      const record = getActiveProjectRecord();
      if (record) {
        record.name = projectName.trim() || record.name;
        record.updatedAt = now;
        record.data = data;
      } else {
        projectRecords.push({
          id: activeProjectId,
          name: projectName.trim() || DEFAULT_PROJECT_NAME,
          updatedAt: now,
          data,
        });
      }
    }
    persistProjectRecords();
  }

  function saveCurrentProjectSilent() {
    if (!projectName.trim() && !activeProjectId) return false;
    if (!projectName.trim() && activeProjectId) {
      const record = getActiveProjectRecord();
      projectName = record?.name || DEFAULT_PROJECT_NAME;
    }
    writeActiveProjectSnapshot();
    projectDirty = false;
    updateProjectSwitcherUI();
    setStatus(`Saved “${projectName.trim() || DEFAULT_PROJECT_NAME}”`);
    return true;
  }

  function updateProjectSwitcherUI() {
    const currentBtn = document.getElementById('project-switcher-current');
    if (currentBtn) currentBtn.textContent = getDisplayProjectName();

    const itemsEl = document.getElementById('project-switcher-items');
    if (!itemsEl) return;
    itemsEl.innerHTML = '';
    const sorted = [...projectRecords].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    sorted.forEach((project) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'project-switcher-item';
      if (project.id === activeProjectId) btn.classList.add('is-active');
      btn.textContent = project.name;
      btn.title = project.name;
      btn.setAttribute('role', 'listitem');
      btn.addEventListener('click', () => switchToProject(project.id));
      itemsEl.appendChild(btn);
    });
  }

  function waitMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function openProjectSwitcher() {
    if (projectSwitcherAnimating || projectSwitcherOpen) return;
    const root = projectSwitcherEl();
    const logo = document.querySelector('[data-logo-flash]');
    if (!root) return;
    projectSwitcherAnimating = true;
    projectSwitcherOpen = true;
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    if (logo) logo.setAttribute('aria-expanded', 'true');
    await waitMs(320);
    projectSwitcherAnimating = false;
  }

  async function closeProjectSwitcher() {
    if (projectSwitcherAnimating || !projectSwitcherOpen) return;
    const root = projectSwitcherEl();
    const logo = document.querySelector('[data-logo-flash]');
    if (!root) return;
    projectSwitcherAnimating = true;

    if (projectListOpen) {
      projectListOpen = false;
      root.classList.remove('is-list-open');
      const chevron = document.getElementById('project-switcher-chevron');
      const list = document.getElementById('project-switcher-list');
      if (chevron) chevron.setAttribute('aria-expanded', 'false');
      if (list) list.setAttribute('aria-hidden', 'true');
      await waitMs(250);
    }

    projectSwitcherOpen = false;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    if (logo) logo.setAttribute('aria-expanded', 'false');
    await waitMs(320);
    projectSwitcherAnimating = false;
  }

  function toggleProjectList() {
    if (!projectSwitcherOpen || projectSwitcherAnimating) return;
    const root = projectSwitcherEl();
    if (!root) return;
    projectListOpen = !projectListOpen;
    root.classList.toggle('is-list-open', projectListOpen);
    const chevron = document.getElementById('project-switcher-chevron');
    const list = document.getElementById('project-switcher-list');
    if (chevron) chevron.setAttribute('aria-expanded', String(projectListOpen));
    if (list) list.setAttribute('aria-hidden', String(!projectListOpen));
  }

  function openProjectDetails(mode) {
    projectDetailsMode = mode;
    const dialog = projectDetailsEl();
    const input = projectDetailsNameEl();
    if (!dialog || !input) return;
    input.value = mode === 'create-new' ? '' : (projectName.trim() || '');
    dialog.classList.remove('hidden');
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  function closeProjectDetails() {
    const dialog = projectDetailsEl();
    if (dialog) dialog.classList.add('hidden');
    projectDetailsMode = null;
  }

  function handleProjectSaveClick() {
    if (!activeProjectId || !projectName.trim()) {
      openProjectDetails('save-first');
      return;
    }
    saveCurrentProjectSilent();
  }

  function handleProjectRenameClick() {
    openProjectDetails(activeProjectId && projectName.trim() ? 'rename' : 'save-first');
  }

  function clearPendingProjectDelete() {
    pendingProjectDelete = false;
  }

  function showProjectDeleteConfirm() {
    const dialog = document.getElementById('asset-delete-confirm');
    const title = document.getElementById('asset-delete-confirm-title');
    const message = document.getElementById('asset-delete-confirm-message');
    if (!dialog || !title || !message) return;
    const label = projectName.trim() || DEFAULT_PROJECT_NAME;
    title.textContent = 'Delete project?';
    message.textContent = `Delete "${label}"? This cannot be undone.`;
    pendingProjectDelete = true;
    dialog.classList.remove('hidden');
    document.getElementById('asset-delete-confirm-cancel')?.focus();
  }

  function performDeleteCurrentProject() {
    if (!pendingProjectDelete) return;
    pendingProjectDelete = false;

    const deletedName = projectName.trim() || DEFAULT_PROJECT_NAME;
    const deletedId = activeProjectId;

    if (deletedId) {
      projectRecords = projectRecords.filter((p) => p.id !== deletedId);
    }

    const next = projectRecords[0] || null;
    if (next) {
      activeProjectId = next.id;
      projectName = next.name;
      projectDirty = false;
      persistProjectRecords();
      applyProjectData(next.data, { resetHistory: true });
      setStatus(`Deleted “${deletedName}” · opened “${next.name}”`);
    } else {
      activeProjectId = null;
      projectName = '';
      projectDirty = false;
      persistProjectRecords();
      applyProjectData(null, { resetHistory: true });
      setStatus(`Deleted “${deletedName}”`);
    }

    document.getElementById('asset-delete-confirm')?.classList.add('hidden');
    updateProjectSwitcherUI();
  }

  function confirmProjectDetails() {
    const input = projectDetailsNameEl();
    const name = (input?.value || '').trim();
    if (!name) {
      setStatus('Enter a project name');
      input?.focus();
      return;
    }

    if (projectDetailsMode === 'create-new') {
      if (activeProjectId && projectDirty) saveCurrentProjectSilent();
      else if (activeProjectId) writeActiveProjectSnapshot();

      clearCanvasContents();
      panX = 0;
      panY = 0;
      zoom = 1;
      applyViewport();
      projectName = name;
      activeProjectId = `proj-${Date.now()}`;
      projectDirty = false;
      writeActiveProjectSnapshot();
      seedHistoryBaseline(true);
      updateProjectSwitcherUI();
      closeProjectDetails();
      setStatus(`Created “${name}”`);
      return;
    }

    if (projectDetailsMode === 'rename') {
      projectName = name;
      const record = getActiveProjectRecord();
      if (record) {
        record.name = name;
        record.updatedAt = Date.now();
        persistProjectRecords();
      } else if (activeProjectId) {
        writeActiveProjectSnapshot();
      } else {
        writeActiveProjectSnapshot();
        projectDirty = false;
      }
      updateProjectSwitcherUI();
      closeProjectDetails();
      setStatus(`Renamed to “${name}”`);
      return;
    }

    projectName = name;
    writeActiveProjectSnapshot();
    projectDirty = false;
    updateProjectSwitcherUI();
    closeProjectDetails();
    setStatus(`Saved “${name}”`);
  }

  function switchToProject(projectId) {
    if (projectId === activeProjectId) return;
    const record = projectRecords.find((p) => p.id === projectId);
    if (!record) return;

    if (projectDirty && activeProjectId && projectName.trim()) {
      writeActiveProjectSnapshot();
    }

    activeProjectId = record.id;
    projectName = record.name;
    projectDirty = false;
    persistProjectRecords();
    applyProjectData(record.data, { resetHistory: true });
    updateProjectSwitcherUI();
    setStatus(`Opened “${record.name}”`);
  }

  function initProjectSwitcher() {
    loadProjectRecords();
    if (activeProjectId) {
      const record = getActiveProjectRecord();
      if (record) {
        projectName = record.name;
        projectDirty = false;
        applyProjectData(record.data, { resetHistory: true });
      } else {
        activeProjectId = null;
        projectName = '';
        applyProjectData(null, { resetHistory: true });
      }
    } else {
      applyProjectData(null, { resetHistory: true });
    }
    updateProjectSwitcherUI();

    document.getElementById('project-switcher-chevron')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleProjectList();
    });
    document.getElementById('project-switcher-save')?.addEventListener('click', (e) => {
      e.stopPropagation();
      handleProjectSaveClick();
    });
    document.getElementById('project-switcher-rename')?.addEventListener('click', (e) => {
      e.stopPropagation();
      handleProjectRenameClick();
    });
    document.getElementById('project-switcher-delete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      showProjectDeleteConfirm();
    });
    document.getElementById('project-switcher-add')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openProjectDetails('create-new');
    });
    document.getElementById('project-details-cancel')?.addEventListener('click', closeProjectDetails);
    document.getElementById('project-details-save')?.addEventListener('click', confirmProjectDetails);
    projectDetailsNameEl()?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmProjectDetails();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeProjectDetails();
      }
    });
    projectDetailsEl()?.addEventListener('click', (e) => {
      if (e.target === projectDetailsEl()) closeProjectDetails();
    });

    document.getElementById('asset-delete-confirm-ok')?.addEventListener('click', () => {
      if (!pendingProjectDelete) return;
      performDeleteCurrentProject();
    });
    document.getElementById('asset-delete-confirm-cancel')?.addEventListener('click', clearPendingProjectDelete);
    document.getElementById('asset-delete-confirm')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('asset-delete-confirm')) clearPendingProjectDelete();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!projectDetailsEl()?.classList.contains('hidden')) {
        closeProjectDetails();
        return;
      }
      if (pendingProjectDelete) {
        clearPendingProjectDelete();
        return;
      }
      if (projectSwitcherOpen) closeProjectSwitcher();
    });
  }

  function initLogoMark() {
    const logoMark = document.querySelector('[data-logo-flash]');
    const logoBubbles = document.querySelectorAll('.logo-mark__blob');
    if (!logoMark) return;

    logoMark.addEventListener('click', () => {
      logoBubbles.forEach((bubble) => {
        const hue = Math.floor(Math.random() * 360);
        const saturation = 35 + Math.floor(Math.random() * 35);
        const lightness = 35 + Math.floor(Math.random() * 25);
        bubble.style.backgroundColor = `hsl(${hue} ${saturation}% ${lightness}%)`;
      });

      logoMark.classList.remove('is-flashing');
      void logoMark.offsetWidth;
      logoMark.classList.add('is-flashing');

      const onEnd = (event) => {
        if (event.animationName !== 'logo-flash') return;
        logoMark.classList.remove('is-flashing');
        logoMark.removeEventListener('animationend', onEnd);
      };
      logoMark.addEventListener('animationend', onEnd);

      if (projectSwitcherOpen) closeProjectSwitcher();
      else openProjectSwitcher();
    });
  }

  function isCadImportFile(file) {
    if (!file) return false;
    const name = (file.name || '').toLowerCase();
    return name.endsWith('.dxf') || name.endsWith('.dwg');
  }

  function setCadImportStatus(msg) {
    const el = document.getElementById('cad-import-status');
    if (el) el.textContent = msg || '';
  }

  function closeCadImportDialog() {
    const dialog = document.getElementById('cad-import-dialog');
    const drop = document.getElementById('cad-import-drop');
    if (!dialog) return;
    dialog.classList.add('hidden');
    drop?.classList.remove('is-dragging');
    setCadImportStatus('');
  }

  function openCadImportDialog() {
    const dialog = document.getElementById('cad-import-dialog');
    const panel = document.getElementById('cad-import-panel');
    if (!dialog || !panel) return;
    if (activeWorkspacePage !== 'panel') {
      setActiveWorkspacePage('panel');
    }
    panel.style.left = '50%';
    panel.style.top = '42%';
    panel.style.transform = 'translate(-50%, -50%)';
    dialog.classList.remove('hidden');
    setCadImportStatus('Drop a DXF or DWG file');
  }

  function handleCadImportFile(file, dropWorld) {
    if (!isCadImportFile(file)) {
      setCadImportStatus('Only DXF / DWG files are supported');
      return;
    }
    if (!window.GuitarCad) {
      setCadImportStatus('CAD importer unavailable');
      return;
    }
    setCadImportStatus(`Reading ${file.name}…`);
    GuitarCad.readCadFile(file)
      .then((model) => {
        if (activeWorkspacePage !== 'panel') setActiveWorkspacePage('panel');
        const scale = PANEL_GRID_PX;
        const w = Math.max(1, model.width * scale);
        const h = Math.max(1, model.height * scale);
        let world;
        if (dropWorld) {
          world = { x: dropWorld.x - w / 2, y: dropWorld.y - h / 2 };
        } else {
          const center = clientToWorld(
            canvas.getBoundingClientRect().left + canvas.clientWidth / 2,
            canvas.getBoundingClientRect().top + canvas.clientHeight / 2
          );
          world = { x: center.x - w / 2, y: center.y - h / 2 };
        }
        const el = placeCadGroup(model, world.x, world.y, file.name);
        closeCadImportDialog();
        setCadImportStatus('');
        setStatus(`Placed ${file.name} · ${model.entityCount} 2D entities · grouped`);
        return el;
      })
      .catch((err) => {
        const msg = err?.message || 'Import failed';
        setCadImportStatus(msg);
        setStatus(msg);
      });
  }

  function placeCadGroup(model, x, y, fileName, id, opts = {}) {
    const scale = PANEL_GRID_PX; // 1 drawing unit = 1 mm = 1 panel grid
    const width = Math.max(1, model.width * scale);
    const height = Math.max(1, model.height * scale);
    const compId = id || `cmp-${++componentIdCounter}`;
    const match = /^cmp-(\d+)$/.exec(compId);
    if (match) componentIdCounter = Math.max(componentIdCounter, Number(match[1]));

    const el = document.createElement('div');
    el.className = 'component cad-group';
    el.dataset.id = compId;
    el.dataset.type = 'CAD';
    el.dataset.assetId = 'cad-import';
    el.dataset.cadImport = 'true';
    el.dataset.cadName = fileName || 'CAD';
    el.dataset.cadSvg = model.svgInner || '';
    el.dataset.cadUnitW = String(model.width);
    el.dataset.cadUnitH = String(model.height);
    setComponentWorkspacePage(el, 'panel');
    el.style.left = `${Math.max(0, x)}px`;
    el.style.top = `${Math.max(0, y)}px`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;

    const label = document.createElement('div');
    label.className = 'cad-group-label';
    label.textContent = fileName || 'CAD';
    el.appendChild(label);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'cad-svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${model.width} ${model.height}`);
    svg.innerHTML = model.svgInner || '';
    el.appendChild(svg);

    workspace.appendChild(el);
    components.set(compId, el);
    setupComponentInteraction(el);
    if (opts.select !== false) selectComponent(el);
    markProjectDirty();
    return el;
  }

  function restoreCadGroup(compData) {
    const model = {
      width: Number(compData.cadUnitW) || 10,
      height: Number(compData.cadUnitH) || 10,
      svgInner: compData.cadSvg || '',
      entityCount: 1,
    };
    const el = placeCadGroup(
      model,
      compData.left || 0,
      compData.top || 0,
      compData.cadName || 'CAD',
      compData.id,
      { select: false }
    );
    if (compData.rotation) {
      el.dataset.rotation = String(compData.rotation);
      el.style.transform = `rotate(${compData.rotation}deg)`;
    }
    return el;
  }

  function initCadImportDialog() {
    const dialog = document.getElementById('cad-import-dialog');
    const panel = document.getElementById('cad-import-panel');
    const header = document.getElementById('cad-import-header');
    const drop = document.getElementById('cad-import-drop');
    const browse = document.getElementById('cad-import-browse');
    const input = document.getElementById('cad-import-input');
    const closeBtn = document.getElementById('cad-import-close');
    if (!dialog || !panel || !header || !drop || !input) return;

    closeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      closeCadImportDialog();
    });

    browse?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.click();
    });

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) handleCadImportFile(file);
      input.value = '';
    });

    ['dragenter', 'dragover'].forEach((type) => {
      drop.addEventListener(type, (e) => {
        e.preventDefault();
        e.stopPropagation();
        drop.classList.add('is-dragging');
      });
    });
    ['dragleave', 'dragend'].forEach((type) => {
      drop.addEventListener(type, (e) => {
        e.preventDefault();
        e.stopPropagation();
        drop.classList.remove('is-dragging');
      });
    });
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      drop.classList.remove('is-dragging');
      const file = e.dataTransfer?.files?.[0];
      if (file) handleCadImportFile(file);
    });

    let drag = null;
    header.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('#cad-import-close')) return;
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      drag = {
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      };
      panel.style.transform = 'none';
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
    });
    document.addEventListener('mousemove', (e) => {
      if (!drag) return;
      panel.style.left = `${Math.max(0, e.clientX - drag.offsetX)}px`;
      panel.style.top = `${Math.max(0, e.clientY - drag.offsetY)}px`;
    });
    document.addEventListener('mouseup', () => {
      drag = null;
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (dialog.classList.contains('hidden')) return;
      closeCadImportDialog();
    });
  }

  /** Drop DXF/DWG onto the Panel canvas → one grouped CAD object. */
  function initPanelCadDrop() {
    ['dragenter', 'dragover'].forEach((type) => {
      canvas.addEventListener(type, (e) => {
        if (activeWorkspacePage !== 'panel') return;
        const types = e.dataTransfer?.types;
        if (!types || ![...types].includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      });
    });
    canvas.addEventListener('drop', (e) => {
      if (activeWorkspacePage !== 'panel') return;
      const file = e.dataTransfer?.files?.[0];
      if (!file || !isCadImportFile(file)) return;
      e.preventDefault();
      e.stopPropagation();
      const world = clientToWorld(e.clientX, e.clientY);
      handleCadImportFile(file, world);
    });
  }

  workspacePageElectronics?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveWorkspacePage('electronics');
  });
  workspacePagePanel?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveWorkspacePage('panel');
  });
  workspacePagePanelVisibility?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePanelLayerVisible();
  });

  // --- Schematic peek (status-bar center chevron) ---

  const SCHEMATIC_NS = 'http://www.w3.org/2000/svg';
  let schematicPeekRefreshTimer = null;
  let groundChaseRefreshTimer = null;

  function notifySchematicCircuitChanged() {
    if (schematicPeekOpen) {
      clearTimeout(schematicPeekRefreshTimer);
      schematicPeekRefreshTimer = setTimeout(() => {
        if (schematicPeekOpen) refreshSchematicPeek();
      }, 140);
    }
    notifyCircuitFaultWarningChanged();
    if (wireEditFocusMode && groundCheckMode) {
      clearTimeout(groundChaseRefreshTimer);
      groundChaseRefreshTimer = setTimeout(() => {
        if (wireEditFocusMode && groundCheckMode) refreshGroundNetChase();
      }, 120);
    }
  }

  function getSchematicSymbolKind(comp) {
    const id = comp?.dataset?.assetId || '';
    const template = GuitarAssets.getTemplate(id);
    const subtype = template?.subtype || id;
    if (subtype === 'singlecoil' || id === 'singlecoil') return 'pickup-sc';
    if (subtype === 'dualcoil' || subtype === '4conductor' || id === 'dualcoil' || id === '4conductor') {
      return 'pickup-hb';
    }
    if (subtype === 'potentiometer' || id === 'potentiometer') return 'pot';
    if (subtype === 'capacitor' || id === 'capacitor') return 'capacitor';
    if (subtype === 'ninevolt' || id === 'ninevolt') return 'battery';
    if (subtype === 'monooutput' || id === 'mono-output') return 'jack';
    if (subtype === 'stereooutput' || id === 'stereo-output') return 'jack-stereo';
    if (subtype === 'dpdt' || subtype === 'dpdt-on-off-on' || subtype === 'dpdt-on-on'
      || id === 'dpdt' || id === 'dpdt-on-off-on' || id === 'dpdt-on-on') {
      return 'switch';
    }
    return 'generic';
  }

  function schematicSymbolRank(kind) {
    const order = {
      'pickup-sc': 0,
      'pickup-hb': 0,
      battery: 1,
      pot: 2,
      capacitor: 3,
      switch: 4,
      jack: 5,
      'jack-stereo': 5,
      generic: 6,
    };
    return order[kind] ?? 6;
  }

  /** Components that share at least one wire with another electronics component. */
  function collectConnectedCircuitGraph() {
    const adj = new Map(); // compId -> Set(compId)
    const compById = new Map();
    const edges = []; // { wire, aId, bId, aTerm, bTerm }

    function ensure(comp) {
      if (!comp) return null;
      if (getComponentWorkspacePage(comp) !== 'electronics') return null;
      if (comp.classList.contains('workspace-page-hidden')) return null;
      const id = comp.dataset.id;
      if (!id) return null;
      if (!adj.has(id)) adj.set(id, new Set());
      compById.set(id, comp);
      return id;
    }

    wires.forEach((wire) => {
      if (!wire?.start?.terminal || !wire?.end?.terminal) return;
      if (wire.group?.classList.contains('workspace-page-hidden')) return;
      const a = wire.start.terminal.closest?.('.component');
      const b = wire.end.terminal.closest?.('.component');
      const aId = ensure(a);
      const bId = ensure(b);
      if (!aId || !bId || aId === bId) return;
      adj.get(aId).add(bId);
      adj.get(bId).add(aId);
      edges.push({
        wire,
        aId,
        bId,
        aTerm: wire.start.terminal,
        bTerm: wire.end.terminal,
        color: WIRE_COLORS[wire.color] || '#111',
        dashed: !!wire.dashed,
      });
    });

    // Keep only nodes with degree >= 1
    const connectedIds = [...adj.keys()].filter((id) => adj.get(id).size > 0);
    return { adj, compById, edges, connectedIds };
  }

  function terminalIndexOnComponent(comp, term) {
    if (!comp || !term) return 0;
    const terms = [...comp.querySelectorAll('.terminal')];
    const idx = terms.indexOf(term);
    return idx < 0 ? 0 : idx;
  }

  function svgEl(name, attrs = {}) {
    const el = document.createElementNS(SCHEMATIC_NS, name);
    Object.entries(attrs).forEach(([k, v]) => {
      if (v != null) el.setAttribute(k, String(v));
    });
    return el;
  }

  function strokeAttrs(extra = {}) {
    return {
      fill: 'none',
      stroke: '#111',
      'stroke-width': 1.6,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      ...extra,
    };
  }

  function pinLabel(g, x, y, text, dx = 0, dy = -6) {
    if (!text) return;
    const t = svgEl('text', {
      x: x + dx,
      y: y + dy,
      'text-anchor': 'middle',
      'font-family': 'Consolas, Courier New, monospace',
      'font-size': 7,
      fill: '#444',
    });
    t.textContent = text;
    g.appendChild(t);
  }

  function collectSchematicTerminalMeta(comp) {
    const template = GuitarAssets.getTemplate(comp.dataset.assetId);
    const states = GuitarAssets.getEffectiveStates(comp);
    const stateIndex = GuitarAssets.getComponentStateIndex(comp);
    const state = states[stateIndex] || states[0];
    const termEls = [...comp.querySelectorAll('.terminal')];
    const terms = termEls.map((term, idx) => {
      const spec = template?.terminals?.[idx] || {};
      const role = getTerminalRole(term) || spec.role || term.dataset.terminalLabel || String(idx + 1);
      const label = (term.dataset.terminalLabel || spec.label || role || '').trim();
      const active = state?.terminalActive ? !!state.terminalActive[idx] : true;
      return { idx, term, role, label, active, isGround: !!(spec.isGround || term.dataset.tag === 'ISGROUND') };
    });
    return {
      template,
      state,
      stateIndex,
      stateLabel: state?.label || '',
      bridges: Array.isArray(state?.bridges) ? state.bridges : [],
      switchType: getToggleSwitchType(comp),
      switchThrow: getToggleSwitchThrow(comp),
      valueLabels: getComponentSchematicValueLabels(comp),
      terms,
    };
  }

  /**
   * ANSI / IEEE-style schematic symbols.
   * Pin array order ALWAYS matches DOM `.terminal` order so wires map correctly.
   */
  function buildSchematicSymbol(kind, title, meta) {
    const g = svgEl('g');
    const pins = [];
    const terms = meta?.terms || [];

    const addPin = (x, y, termMeta) => {
      const active = termMeta ? termMeta.active !== false : true;
      pins.push({ x, y });
      g.appendChild(svgEl('circle', {
        cx: x,
        cy: y,
        r: active ? 2.1 : 2.0,
        fill: active ? '#111' : '#fff',
        stroke: '#111',
        'stroke-width': 1.2,
      }));
      if (termMeta?.label) pinLabel(g, x, y, termMeta.label);
    };

    const valueLabels = meta?.valueLabels || [];
    const valueCount = valueLabels.length;
    const nameY = valueCount ? -22 - (valueCount - 1) * 4 : -22;
    const heading = svgEl('text', {
      x: 0,
      y: nameY,
      'text-anchor': 'middle',
      'font-family': 'Consolas, Courier New, monospace',
      'font-size': 8,
      fill: '#333',
    });
    heading.textContent = title;
    g.appendChild(heading);
    valueLabels.forEach((text, i) => {
      const vt = svgEl('text', {
        x: 0,
        y: nameY + 9 + i * 8,
        'text-anchor': 'middle',
        'font-size': 6.5,
        fill: '#555',
        'font-family': 'Consolas, monospace',
      });
      vt.textContent = text;
      g.appendChild(vt);
    });

    if (kind === 'pickup-sc') {
      // IEEE inductor (air-core coil) — H … G
      g.appendChild(svgEl('path', strokeAttrs({
        d: 'M-14 0 c0-7 7-7 7 0 s7 7 7 0 s7 -7 7 0 s7 7 7 0',
      })));
      g.appendChild(svgEl('line', strokeAttrs({ x1: -22, y1: 0, x2: -14, y2: 0 })));
      g.appendChild(svgEl('line', strokeAttrs({ x1: 14, y1: 0, x2: 22, y2: 0 })));
      addPin(-22, 0, terms[0]);
      addPin(22, 0, terms[1]);
    } else if (kind === 'pickup-hb') {
      // Dual coil (series-linked inductors) — pins H N R S G
      g.appendChild(svgEl('path', strokeAttrs({
        d: 'M-12 -8 c0-6 6-6 6 0 s6 6 6 0 s6 -6 6 0',
      })));
      g.appendChild(svgEl('path', strokeAttrs({
        d: 'M-12 8 c0-6 6-6 6 0 s6 6 6 0 s6 -6 6 0',
      })));
      g.appendChild(svgEl('line', strokeAttrs({ x1: -6, y1: -2, x2: -6, y2: 2 })));
      const n = Math.max(terms.length, 5);
      const pinYs = [-16, -8, 0, 8, 16];
      for (let i = 0; i < n; i++) {
        const y = pinYs[i] ?? (-16 + i * 8);
        g.appendChild(svgEl('line', strokeAttrs({ x1: -20, y1: y, x2: -12, y2: y * 0.5 })));
        addPin(-22, y, terms[i]);
      }
    } else if (kind === 'pot') {
      // ANSI variable resistor (zigzag) + wiper arrow; IEC-style case ground optional
      g.appendChild(svgEl('path', strokeAttrs({
        d: 'M-18 0 L-13 -7 L-8 7 L-3 -7 L2 7 L7 -7 L12 7 L18 0',
      })));
      // Wiper (terminal 2)
      g.appendChild(svgEl('line', strokeAttrs({ x1: 0, y1: 2, x2: 0, y2: 16 })));
      g.appendChild(svgEl('path', strokeAttrs({
        d: 'M0 2 L-3 8 L3 8 Z',
        fill: '#111',
      })));
      // 1 — left, 2 — wiper, 3 — right, G — case
      addPin(-18, 0, terms[0]);
      addPin(0, 16, terms[1]);
      addPin(18, 0, terms[2]);
      if (terms[3]) {
        g.appendChild(svgEl('line', strokeAttrs({ x1: -22, y1: -12, x2: -14, y2: -4, 'stroke-dasharray': '2 2' })));
        addPin(-22, -14, terms[3]);
      }
    } else if (kind === 'capacitor') {
      // IEEE non-polarized capacitor
      g.appendChild(svgEl('line', strokeAttrs({ x1: -3.5, y1: -11, x2: -3.5, y2: 11, 'stroke-width': 2.4 })));
      g.appendChild(svgEl('line', strokeAttrs({ x1: 3.5, y1: -11, x2: 3.5, y2: 11, 'stroke-width': 2.4 })));
      g.appendChild(svgEl('line', strokeAttrs({ x1: -18, y1: 0, x2: -3.5, y2: 0 })));
      g.appendChild(svgEl('line', strokeAttrs({ x1: 3.5, y1: 0, x2: 18, y2: 0 })));
      addPin(-18, 0, terms[0]);
      addPin(18, 0, terms[1]);
    } else if (kind === 'battery') {
      // IEEE single-cell battery (+ long / − short)
      g.appendChild(svgEl('line', strokeAttrs({ x1: -5, y1: -11, x2: -5, y2: 11, 'stroke-width': 2.6 })));
      g.appendChild(svgEl('line', strokeAttrs({ x1: 3, y1: -6, x2: 3, y2: 6, 'stroke-width': 1.5 })));
      g.appendChild(svgEl('line', strokeAttrs({ x1: -18, y1: 0, x2: -5, y2: 0 })));
      g.appendChild(svgEl('line', strokeAttrs({ x1: 3, y1: 0, x2: 18, y2: 0 })));
      const plus = svgEl('text', {
        x: -11, y: -14, 'font-size': 9, fill: '#111', 'font-family': 'Consolas, monospace',
      });
      plus.textContent = '+';
      g.appendChild(plus);
      addPin(-18, 0, terms[0]);
      addPin(18, 0, terms[1]);
    } else if (kind === 'jack') {
      // ANSI phone jack: sleeve (G) / tip (H) — DOM order G then H
      g.appendChild(svgEl('circle', strokeAttrs({ cx: 0, cy: 0, r: 9, fill: '#fff' })));
      // Sleeve contact (ground) left
      g.appendChild(svgEl('path', strokeAttrs({ d: 'M-9 0 Q-14 -6 -18 -6' })));
      g.appendChild(svgEl('line', strokeAttrs({ x1: -18, y1: -6, x2: -18, y2: 0 })));
      // Tip contact (hot) right
      g.appendChild(svgEl('line', strokeAttrs({ x1: 9, y1: 0, x2: 18, y2: 0 })));
      g.appendChild(svgEl('line', strokeAttrs({ x1: 14, y1: -3, x2: 18, y2: 0 })));
      g.appendChild(svgEl('line', strokeAttrs({ x1: 14, y1: 3, x2: 18, y2: 0 })));
      addPin(-18, 0, terms[0]); // G
      addPin(18, 0, terms[1]);  // H
    } else if (kind === 'jack-stereo') {
      // ANSI stereo (TRS) phone jack — DOM order G (sleeve), R (ring), H (tip)
      g.appendChild(svgEl('circle', strokeAttrs({ cx: 0, cy: 0, r: 9, fill: '#fff' })));
      // Sleeve contact (ground) left
      g.appendChild(svgEl('path', strokeAttrs({ d: 'M-9 0 Q-14 -6 -18 -6' })));
      g.appendChild(svgEl('line', strokeAttrs({ x1: -18, y1: -6, x2: -18, y2: 0 })));
      // Ring contact from lower arc, pin below
      g.appendChild(svgEl('path', strokeAttrs({ d: 'M-2 8.5 Q2 14 0 18' })));
      g.appendChild(svgEl('line', strokeAttrs({ x1: -3, y1: 16, x2: 3, y2: 16 })));
      // Tip contact (hot) right
      g.appendChild(svgEl('line', strokeAttrs({ x1: 9, y1: 0, x2: 18, y2: 0 })));
      g.appendChild(svgEl('line', strokeAttrs({ x1: 14, y1: -3, x2: 18, y2: 0 })));
      g.appendChild(svgEl('line', strokeAttrs({ x1: 14, y1: 3, x2: 18, y2: 0 })));
      addPin(-18, 0, terms[0]); // G sleeve
      addPin(0, 18, terms[1]);  // R ring
      addPin(18, 0, terms[2]);  // H tip
    } else if (kind === 'switch') {
      // IEEE DPDT toggle: commons T3/T4, throws T1/T5 and T2/T6
      const type = meta?.switchType === 2 ? 2 : 1;
      const throwLabel = getToggleSwitchThrowLabel(meta?.switchThrow);
      const sub = svgEl('text', {
        x: 0, y: nameY - 10, 'text-anchor': 'middle', 'font-size': 7, fill: '#666',
        'font-family': 'Consolas, monospace',
      });
      sub.textContent = `${throwLabel} · Type ${type}${meta?.stateLabel ? ` · ${meta.stateLabel}` : ''}`;
      g.appendChild(sub);

      // Pin positions matching T1..T6 row-major (cols L/R, rows 0..2)
      const positions = [
        { x: -20, y: -16 }, // T1
        { x: 20, y: -16 },  // T2
        { x: -20, y: 0 },   // T3 common A
        { x: 20, y: 0 },    // T4 common B
        { x: -20, y: 16 },  // T5
        { x: 20, y: 16 },   // T6
      ];

      // Draw poles + throws
      for (let i = 0; i < 6; i++) {
        const p = positions[i];
        g.appendChild(svgEl('circle', {
          cx: p.x * 0.55,
          cy: p.y,
          r: 2.2,
          fill: terms[i]?.active ? '#111' : '#fff',
          stroke: '#111',
          'stroke-width': 1.2,
        }));
        g.appendChild(svgEl('line', strokeAttrs({
          x1: p.x * 0.55,
          y1: p.y,
          x2: p.x,
          y2: p.y,
        })));
        addPin(p.x, p.y, terms[i] || { label: `T${i + 1}`, active: true });
      }

      // Show current bridges as switch arms (commons 2,3 → throws)
      (meta?.bridges || []).forEach((pair) => {
        const [a, b] = pair;
        if (a == null || b == null) return;
        const pa = positions[a];
        const pb = positions[b];
        if (!pa || !pb) return;
        g.appendChild(svgEl('line', strokeAttrs({
          x1: pa.x * 0.55,
          y1: pa.y,
          x2: pb.x * 0.55,
          y2: pb.y,
          'stroke-width': 2,
        })));
      });
    } else {
      g.appendChild(svgEl('rect', strokeAttrs({
        x: -16, y: -10, width: 32, height: 20, fill: '#fff',
      })));
      const n = Math.max(2, terms.length || 2);
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        addPin(-16 + t * 32, 14, terms[i]);
      }
    }

    while (pins.length < terms.length) {
      const i = pins.length;
      addPin(-20 + i * 10, 28, terms[i]);
    }

    return { g, pins };
  }

  function schematicColumnForKind(kind) {
    const r = schematicSymbolRank(kind);
    if (r <= 1) return 0; // pickups / battery
    if (r <= 3) return 1; // pots / caps
    if (r === 4) return 2; // switches
    return 3; // jacks / generic
  }

  function syncSchematicZoomLabel() {
    const label = document.getElementById('schematic-zoom-label');
    if (label) label.textContent = `${Math.round(schematicPeekZoom * 100)}%`;
  }

  function setSchematicPeekZoom(next) {
    const z = Math.min(SCHEMATIC_ZOOM_MAX, Math.max(SCHEMATIC_ZOOM_MIN, next));
    if (Math.abs(z - schematicPeekZoom) < 1e-6) {
      syncSchematicZoomLabel();
      return;
    }
    schematicPeekZoom = z;
    syncSchematicZoomLabel();
    applySchematicPeekViewBox();
  }

  function applySchematicPeekViewBox() {
    const svg = document.getElementById('schematic-peek-svg');
    if (!svg) return;
    const baseW = Number(svg.dataset.baseW) || 140;
    const baseH = Number(svg.dataset.baseH) || 100;
    const z = schematicPeekZoom || 1;
    const vw = baseW / z;
    const vh = baseH / z;
    const ox = (baseW - vw) / 2 + schematicPeekPanX;
    const oy = (baseH - vh) / 2 + schematicPeekPanY;
    svg.setAttribute('viewBox', `${ox} ${oy} ${vw} ${vh}`);
  }

  function resetSchematicPeekPan() {
    schematicPeekPanX = 0;
    schematicPeekPanY = 0;
    applySchematicPeekViewBox();
  }

  function renderSchematicWireTotals(wireStatsEl, edges) {
    if (!wireStatsEl) return;
    const seen = new Set();
    let lengthMmSum = 0;
    let resistanceSum = 0;
    let hasR = false;
    const gaugeCounts = new Map();

    edges.forEach((edge) => {
      const wire = edge.wire;
      if (!wire || seen.has(wire)) return;
      seen.add(wire);
      lengthMmSum += getWireLengthMm(wire);
      const r = getWireResistanceOhmsApprox(wire);
      if (r != null && Number.isFinite(r)) {
        resistanceSum += r;
        hasR = true;
      }
      const mm = Number.isFinite(wire.gaugeMm) && wire.gaugeMm > 0 ? wire.gaugeMm : wireGaugeMm;
      const label = getAwgLabelForGaugeMm(mm);
      gaugeCounts.set(label, (gaugeCounts.get(label) || 0) + 1);
    });

    if (seen.size === 0) {
      wireStatsEl.classList.add('hidden');
      wireStatsEl.setAttribute('hidden', '');
      wireStatsEl.replaceChildren();
      return;
    }

    wireStatsEl.classList.remove('hidden');
    wireStatsEl.removeAttribute('hidden');

    const frag = document.createDocumentFragment();
    const lenLine = document.createElement('div');
    lenLine.className = 'schematic-wire-stats-line';
    lenLine.innerHTML = `<span class="schematic-wire-stats-label">Total length</span>${formatWireLengthReadout(lengthMmSum)}`;
    frag.appendChild(lenLine);

    const rLine = document.createElement('div');
    rLine.className = 'schematic-wire-stats-line';
    const rText = hasR ? `≈ ${resistanceSum.toFixed(3)} Ω` : '—';
    rLine.innerHTML = `<span class="schematic-wire-stats-label">Approx. resistance</span>${rText}`;
    frag.appendChild(rLine);

    const gaugeLine = document.createElement('div');
    gaugeLine.className = 'schematic-wire-stats-line';
    const gaugeParts = [...gaugeCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([label, count]) => `${label} (${count})`);
    gaugeLine.innerHTML = `<span class="schematic-wire-stats-label">Wire gauge</span>${gaugeParts.join(' · ') || '—'}`;
    frag.appendChild(gaugeLine);

    wireStatsEl.replaceChildren(frag);
  }

  function refreshSchematicPeek() {
    const svg = document.getElementById('schematic-peek-svg');
    const empty = document.getElementById('schematic-peek-empty');
    const wireStatsEl = document.getElementById('schematic-wire-stats');
    if (!svg) return;

    const { compById, edges, connectedIds } = collectConnectedCircuitGraph();

    if (connectedIds.length === 0) {
      svg.innerHTML = '';
      svg.dataset.baseW = '100';
      svg.dataset.baseH = '60';
      svg.setAttribute('viewBox', '0 0 100 60');
      empty?.classList.remove('hidden');
      if (empty) empty.textContent = 'Connect assets with wires to generate a circuit';
      if (wireStatsEl) {
        wireStatsEl.classList.add('hidden');
        wireStatsEl.setAttribute('hidden', '');
        wireStatsEl.replaceChildren();
      }
      syncSchematicZoomLabel();
      return;
    }
    empty?.classList.add('hidden');

    const nodes = connectedIds.map((id) => {
      const el = compById.get(id);
      const kind = getSchematicSymbolKind(el);
      const meta = collectSchematicTerminalMeta(el);
      const label = (el.dataset.type || meta.template?.name || 'Part').replace(/\s+/g, ' ').trim();
      const short = label.length > 14 ? `${label.slice(0, 12)}…` : label;
      return {
        id,
        el,
        kind,
        meta,
        label: short,
        canvasX: parseFloat(el.style.left) || 0,
        canvasY: parseFloat(el.style.top) || 0,
      };
    });

    // Column layout by part role; stack vertically within each column (uses vertical space).
    const columns = [[], [], [], []];
    nodes.forEach((node) => {
      columns[schematicColumnForKind(node.kind)].push(node);
    });
    columns.forEach((col) => {
      col.sort((a, b) => {
        const dy = a.canvasY - b.canvasY;
        if (Math.abs(dy) > 1) return dy;
        return a.canvasX - b.canvasX;
      });
    });

    const colGap = 108;
    const rowGap = 92;
    const originX = 56;
    const originY = 52;
    const placements = new Map();
    let maxX = originX;
    let maxY = originY;

    columns.forEach((colNodes, ci) => {
      colNodes.forEach((node, ri) => {
        const sym = buildSchematicSymbol(node.kind, node.label, node.meta);
        const x = originX + ci * colGap;
        const y = originY + ri * rowGap;
        sym.g.setAttribute('transform', `translate(${x} ${y})`);
        placements.set(node.id, { x, y, pins: sym.pins, g: sym.g });
        maxX = Math.max(maxX, x + 48);
        maxY = Math.max(maxY, y + 56);
      });
    });

    const frag = document.createDocumentFragment();
    const wireLayer = svgEl('g');
    edges.forEach((edge) => {
      const pa = placements.get(edge.aId);
      const pb = placements.get(edge.bId);
      if (!pa || !pb) return;
      const ia = terminalIndexOnComponent(compById.get(edge.aId), edge.aTerm);
      const ib = terminalIndexOnComponent(compById.get(edge.bId), edge.bTerm);
      const pinA = pa.pins[Math.min(ia, pa.pins.length - 1)] || { x: 0, y: 0 };
      const pinB = pb.pins[Math.min(ib, pb.pins.length - 1)] || { x: 0, y: 0 };
      const x1 = pa.x + pinA.x;
      const y1 = pa.y + pinA.y;
      const x2 = pb.x + pinB.x;
      const y2 = pb.y + pinB.y;
      const mx = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      // Orthogonal-ish route: horizontal then vertical then horizontal for clearer multi-row nets
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      let d;
      if (dx < 8 || dy < 8) {
        d = `M${x1} ${y1} L${x2} ${y2}`;
      } else {
        d = `M${x1} ${y1} L${mx} ${y1} L${mx} ${y2} L${x2} ${y2}`;
      }
      const stroke = (edge.color === '#ffffff' || edge.color === '#fff') ? '#888' : edge.color;
      const selected = !!(edge.wire?.group && selectedWireGroups.has(edge.wire.group));
      const path = svgEl('path', {
        d,
        fill: 'none',
        stroke,
        'stroke-width': selected ? 2.15 : 1.45,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      });
      if (edge.dashed) path.setAttribute('stroke-dasharray', '4 3');
      wireLayer.appendChild(path);
      maxY = Math.max(maxY, y1 + 8, y2 + 8, midY + 8);
    });
    frag.appendChild(wireLayer);
    placements.forEach((p) => frag.appendChild(p.g));

    const baseW = Math.max(160, maxX + 36);
    const baseH = Math.max(140, maxY + 40);
    svg.dataset.baseW = String(baseW);
    svg.dataset.baseH = String(baseH);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.replaceChildren(frag);
    applySchematicPeekViewBox();
    syncSchematicZoomLabel();

    renderSchematicWireTotals(wireStatsEl, edges);
  }

  let schematicPeekAnimTimer = null;
  let schematicPeekWidthHandler = null;

  function clearSchematicPeekAnim() {
    clearTimeout(schematicPeekAnimTimer);
    schematicPeekAnimTimer = null;
    const panel = document.getElementById('schematic-peek');
    if (panel && schematicPeekWidthHandler) {
      panel.removeEventListener('transitionend', schematicPeekWidthHandler);
      schematicPeekWidthHandler = null;
    }
  }

  function syncSchematicPeekChrome(open) {
    const body = document.getElementById('schematic-peek-body');
    const chevron = document.getElementById('schematic-peek-chevron');
    const title = document.querySelector('#schematic-peek .schematic-peek-title');
    body?.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (title) title.textContent = open ? 'Circuit Schematic' : 'Circuit';
    if (chevron) {
      chevron.setAttribute('aria-expanded', open ? 'true' : 'false');
      chevron.setAttribute('aria-label', open ? 'Collapse circuit' : 'Expand circuit');
      chevron.title = open ? 'Hide circuit' : 'Circuit';
    }
  }

  function setSchematicPeekOpen(open) {
    const panel = document.getElementById('schematic-peek');
    const chevron = document.getElementById('schematic-peek-chevron');
    if (!panel || !chevron) return;

    const wantOpen = !!open;
    if (wantOpen === schematicPeekOpen && (
      (wantOpen && panel.classList.contains('is-open'))
      || (!wantOpen && !panel.classList.contains('is-wide') && !panel.classList.contains('is-open'))
    )) {
      return;
    }

    clearSchematicPeekAnim();
    schematicPeekOpen = wantOpen;
    syncSchematicPeekChrome(wantOpen);

    if (wantOpen) {
      // Phase 1: widen the tab; Phase 2: expand content upward
      panel.classList.remove('is-open');
      panel.classList.add('is-wide');
      refreshSchematicPeek();

      const finishExpand = () => {
        clearSchematicPeekAnim();
        if (!schematicPeekOpen) return;
        panel.classList.add('is-open');
        refreshSchematicPeek();
      };

      schematicPeekWidthHandler = (e) => {
        if (e.target !== panel || e.propertyName !== 'width') return;
        finishExpand();
      };
      panel.addEventListener('transitionend', schematicPeekWidthHandler);
      // Fallback if width was already at target (no transition)
      schematicPeekAnimTimer = setTimeout(finishExpand, 320);
    } else {
      // Collapse content first, then shrink width
      panel.classList.remove('is-open');

      const finishNarrow = () => {
        clearSchematicPeekAnim();
        if (schematicPeekOpen) return;
        panel.classList.remove('is-wide');
      };

      schematicPeekWidthHandler = (e) => {
        if (e.target !== panel) return;
        // Wait for body grid collapse via timeout; width shrink after
      };
      schematicPeekAnimTimer = setTimeout(finishNarrow, 360);
    }
  }

  function initSchematicPeek() {
    const panel = document.getElementById('schematic-peek');
    const chevron = document.getElementById('schematic-peek-chevron');
    const refreshBtn = document.getElementById('schematic-peek-refresh');
    const canvas = document.getElementById('schematic-peek-canvas');
    const zoomInBtn = document.getElementById('schematic-zoom-in');
    const zoomOutBtn = document.getElementById('schematic-zoom-out');
    const panHomeBtn = document.getElementById('schematic-pan-home');
    if (!panel || !chevron) return;

    syncSchematicZoomLabel();

    chevron.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = panel.classList.contains('is-open') || panel.classList.contains('is-wide');
      setSchematicPeekOpen(!open);
    });

    refreshBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!panel.classList.contains('is-open')) return;
      refreshBtn.classList.remove('is-spinning');
      // Retrigger spin
      void refreshBtn.offsetWidth;
      refreshBtn.classList.add('is-spinning');
      refreshSchematicPeek();
      setStatus('Circuit refreshed');
      setTimeout(() => refreshBtn.classList.remove('is-spinning'), 400);
    });

    zoomInBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setSchematicPeekZoom(schematicPeekZoom + SCHEMATIC_ZOOM_STEP);
    });
    zoomOutBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setSchematicPeekZoom(schematicPeekZoom - SCHEMATIC_ZOOM_STEP);
    });

    panHomeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetSchematicPeekPan();
    });

    // Drag to pan
    let panDragging = false;
    let panLastX = 0;
    let panLastY = 0;
    canvas?.addEventListener('pointerdown', (e) => {
      if (!panel.classList.contains('is-open')) return;
      if (e.button != null && e.button !== 0) return;
      if (e.target.closest?.('#schematic-pan-home')) return;
      panDragging = true;
      panLastX = e.clientX;
      panLastY = e.clientY;
      canvas.classList.add('is-panning');
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      e.preventDefault();
    });
    canvas?.addEventListener('pointermove', (e) => {
      if (!panDragging) return;
      const svg = document.getElementById('schematic-peek-svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const baseW = Number(svg.dataset.baseW) || 140;
      const baseH = Number(svg.dataset.baseH) || 100;
      const z = schematicPeekZoom || 1;
      const vw = baseW / z;
      const vh = baseH / z;
      const dx = e.clientX - panLastX;
      const dy = e.clientY - panLastY;
      panLastX = e.clientX;
      panLastY = e.clientY;
      schematicPeekPanX -= dx * (vw / rect.width);
      schematicPeekPanY -= dy * (vh / rect.height);
      applySchematicPeekViewBox();
    });
    const endPan = (e) => {
      if (!panDragging) return;
      panDragging = false;
      canvas?.classList.remove('is-panning');
      if (e?.pointerId != null) {
        try { canvas?.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      }
    };
    canvas?.addEventListener('pointerup', endPan);
    canvas?.addEventListener('pointercancel', endPan);
    canvas?.addEventListener('lostpointercapture', endPan);

    canvas?.addEventListener('wheel', (e) => {
      if (!panel.classList.contains('is-open')) return;
      e.preventDefault();
      e.stopPropagation();
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      // Trackpad pinch often reports ctrlKey; also treat dominant vertical scroll as zoom.
      const pinch = e.ctrlKey || e.metaKey;
      if (!pinch && absX > absY * 1.2) return; // horizontal pan gesture — ignore
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      const step = pinch ? SCHEMATIC_ZOOM_STEP * 0.85 : SCHEMATIC_ZOOM_STEP;
      if (delta > 0) setSchematicPeekZoom(schematicPeekZoom - step);
      else if (delta < 0) setSchematicPeekZoom(schematicPeekZoom + step);
    }, { passive: false });

    document.addEventListener('keydown', (e) => {
      if (!panel.classList.contains('is-open')) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return;
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setSchematicPeekZoom(schematicPeekZoom + SCHEMATIC_ZOOM_STEP);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setSchematicPeekZoom(schematicPeekZoom - SCHEMATIC_ZOOM_STEP);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!panel.classList.contains('is-open') && !panel.classList.contains('is-wide')) return;
      // Let commands panel win if both open — commands handler uses stopImmediatePropagation
      if (document.getElementById('commands-panel')?.classList.contains('is-open')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setSchematicPeekOpen(false);
    }, true);
  }

  function initCommandsPanel() {
    const panel = document.getElementById('commands-panel');
    const chevron = document.getElementById('commands-chevron');
    const body = document.getElementById('commands-body');
    const list = document.getElementById('commands-list');
    if (!panel || !chevron || !body || !list) return;

    const commands = [
      { name: '+ / −', description: 'Rotate selected assets, or adjust wire slack when a wire is selected' },
      { name: '1 – 4', description: 'Switch the active wire layer' },
      { name: 'Align', description: 'Align selected assets to the same X (row) or Y (column)' },
      { name: 'MOVE', description: 'Move selection base→dest; snaps to object mid/centers (Enter → MOVE)' },
      { name: 'Tab (Panel)', description: 'Toggle cursor grid snap — when ON, cursor locks to grid / mid / center' },
      { name: 'NOTE', description: 'Add a note window on the active page and layer (Enter → NOTE)' },
      { name: 'DIM', description: 'Measure distance between two points (Enter → DIM)' },
      { name: 'Enter', description: 'Open the text-command box beside the cursor' },
      { name: 'Escape', description: 'Cancel placement, wire draft, menus, dimension, or clear selection' },
      { name: 'Front / Back', description: 'Place the active wire layer above or behind assets' },
      { name: 'Marquee', description: 'Drag on empty canvas to multi-select' },
      { name: 'Mouse wheel', description: 'Zoom the canvas; rotates or adjusts slack when items are selected' },
      { name: 'Q / E', description: 'Cycle selected asset state — Q backward, E forward' },
      { name: 'Q hold', description: 'Open the recent-asset / wire wheel' },
      { name: 'Rotate ↺ ↻', description: 'Rotate selection by 7.5°' },
      { name: 'Shift + drag', description: 'Move selected assets without grid snapping' },
      { name: 'Shift (DIM)', description: 'While dimensioning, pick a free unsnapped point' },
    ].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    list.innerHTML = '';
    commands.forEach(({ name, description }) => {
      const row = document.createElement('div');
      row.className = 'commands-row';
      row.setAttribute('role', 'listitem');
      const nameEl = document.createElement('span');
      nameEl.className = 'commands-name';
      nameEl.textContent = name;
      const descEl = document.createElement('span');
      descEl.className = 'commands-desc';
      descEl.textContent = description;
      row.appendChild(nameEl);
      row.appendChild(descEl);
      list.appendChild(row);
    });

    function setCommandsOpen(open) {
      panel.classList.toggle('is-open', open);
      body.setAttribute('aria-hidden', open ? 'false' : 'true');
      chevron.setAttribute('aria-expanded', open ? 'true' : 'false');
      chevron.setAttribute('aria-label', open ? 'Collapse commands' : 'Expand commands');
      chevron.title = open ? 'Hide commands' : 'Commands';
    }

    chevron.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setCommandsOpen(!panel.classList.contains('is-open'));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!panel.classList.contains('is-open')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setCommandsOpen(false);
    }, true);
  }

  initLayerGroups();
  initLayerUI();
  applyAccentTheme(0);
  initLogoMark();
  initCadImportDialog();
  initPanelCadDrop();
  initCommandsPanel();
  initSchematicPeek();
  textCommandInput?.addEventListener('input', updateTextCommandHint);
  textCommandInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      runMatchedTextCommand();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeTextCommandBox();
      setStatus('Ready');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const match = findNearestTextCommand(textCommandInput.value);
      if (match) {
        textCommandInput.value = (match.short || match.name).toUpperCase();
        updateTextCommandHint();
      }
    }
  });
  document.addEventListener('mousedown', (e) => {
    if (!textCommandOpen) return;
    if (e.target.closest('#text-command-box')) return;
    closeTextCommandBox();
  }, true);
  syncWorkspacePageButtons();
  syncPanelLayerVisibilityButton();
  applyWorkspaceGridSize();

  GuitarAssets.init({
    canvas: workspace,
    components,
    setStatus,
    setAssetPlacement,
    selectComponent,
    setupComponentInteraction,
    createTerminal,
    toggleLightningMode,
    getLightningMode: () => lightningMode,
    toggleGroundCheckMode,
    getGroundCheckMode: () => groundCheckMode,
    toggleWireEditFocusMode,
    getWireEditFocusMode: () => wireEditFocusMode,
    toggleShortCheckMode,
    getShortCheckMode: () => shortCheckMode,
    refreshLightningWireGlow,
    refreshShortCircuitCheck,
    refreshGroundCheckAlert,
    refreshGroundNetChase,
    refreshComponentsForTemplate,
    applyComponentGroundTag: setComponentGroundTag,
    applyComponentElectricalValues,
    getActiveWorkspacePage: () => activeWorkspacePage,
    openCadImportDialog,
    togglePanelSnapMode,
    getPanelSnapMode,
    nextComponentId: () => {
      componentIdCounter += 1;
      return `cmp-${componentIdCounter}`;
    },
  });

  initProjectSwitcher();

  window.addEventListener('resize', resizeWireStacks);
  applyWorkspaceGridSize();
  resizeWireStacks();
  applyViewport();
  refreshCircuitFaultWarning();
  canvas.focus();

  function terminalByRole(comp, role) {
    return [...comp.querySelectorAll('.terminal')].find((t) => getTerminalRole(t) === role) || null;
  }

  function wireBetweenTerminals(termA, termB) {
    if (!termA || !termB) return null;
    const ca = getTerminalCenter(termA);
    const cb = getTerminalCenter(termB);
    const aw = clientToWorld(ca.x, ca.y);
    const bw = clientToWorld(cb.x, cb.y);
    return createWire(
      { x: aw.x, y: aw.y, terminal: termA },
      { x: bw.x, y: bw.y, terminal: termB }
    );
  }

  /** SSS board + intentional Neck-H→Output-G hard short (violet flash). */
  function seedSssHardShortDemo() {
    setActiveWorkspacePage('electronics');
    [...wires.values()].forEach((w) => discardWire(w));
    [...components.values()].forEach((comp) => {
      removeHbWorldLeadGroup(comp);
      components.delete(comp.dataset.id);
      comp.remove();
    });
    deselectAll();

    const place = (id, x, y) => GuitarAssets.createComponent(GuitarAssets.getTemplate(id), x, y);

    const neck = place('singlecoil', 80, 50);
    const mid = place('singlecoil', 80, 170);
    const bridge = place('singlecoil', 80, 290);
    const sw = place('dpdt', 300, 150);
    const vol = place('potentiometer', 520, 100);
    const tone = place('potentiometer', 520, 280);
    const cap = place('capacitor', 680, 270);
    const out = place('mono-output', 780, 140);

    setComponentImpedance(neck, '5800');
    setComponentImpedance(mid, '6200');
    setComponentImpedance(bridge, '7100');
    setComponentResistance(vol, '250k');
    setComponentResistance(tone, '250k');
    setComponentCapacitance(cap, '0.022');
    [neck, mid, bridge, vol, tone, cap].forEach((el) => setComponentGroundTag(el, true));

    GuitarAssets.setComponentStateIndex(sw, 0); // N

    const swT = [...sw.querySelectorAll('.terminal')];
    const volT = [...vol.querySelectorAll('.terminal')];
    const toneT = [...tone.querySelectorAll('.terminal')];
    const capT = [...cap.querySelectorAll('.terminal')];
    const outH = terminalByRole(out, 'H');
    const outG = terminalByRole(out, 'G');

    // Pickup hots → Type-1 throws (N→T5, M→T1, B→T2); commons T3/T4 → volume lug 3
    wireBetweenTerminals(terminalByRole(neck, 'H'), swT[4]);
    wireBetweenTerminals(terminalByRole(mid, 'H'), swT[0]);
    wireBetweenTerminals(terminalByRole(bridge, 'H'), swT[1]);
    wireBetweenTerminals(swT[2], swT[3]);
    wireBetweenTerminals(swT[2], volT[2]);
    wireBetweenTerminals(volT[1], outH);
    wireBetweenTerminals(volT[2], toneT[2]);
    wireBetweenTerminals(toneT[0], capT[0]);
    wireBetweenTerminals(capT[1], outG);

    // Ground bus (normal — must NOT flag)
    const grounds = [
      terminalByRole(neck, 'G'),
      terminalByRole(mid, 'G'),
      terminalByRole(bridge, 'G'),
      volT[3],
      toneT[3],
      outG,
    ];
    for (let i = 1; i < grounds.length; i++) {
      wireBetweenTerminals(grounds[0], grounds[i]);
    }

    // HARD SHORT for the demo: Neck hot tied straight to output sleeve
    const prevColor = wireColor;
    wireColor = 'red';
    wireBetweenTerminals(terminalByRole(neck, 'H'), outG);
    wireColor = prevColor;

    deselectAll();
    shortCheckMode = true;
    refreshShortCircuitCheck();
    syncContextMenuShortCheckButtonLocal();
    panX = 40;
    panY = 20;
    zoom = 1;
    applyViewport();
    setStatus('SSS demo — hard short: Neck H → Output G (grounds OK; violet = short)');
    markProjectDirty();
  }

  if (new URLSearchParams(location.search).get('demo') === 'sss-short') {
    setTimeout(() => seedSssHardShortDemo(), 80);
  }
})();
