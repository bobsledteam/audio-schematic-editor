(function () {
  'use strict';

  const SNAP_DELAY_MS = 2000;
  const LAYER_COUNT = 4;
  const SLACK_STEP = 6;
  const SLACK_MAX = 120;
  const WORKSPACE_GRID = 10;
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
  };
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
  const btnSolid = document.getElementById('btn-solid');
  const btnDashed = document.getElementById('btn-dashed');
  const btnLayerVisibility = document.getElementById('btn-layer-visibility');
  const btnLayerFront = document.getElementById('btn-layer-front');
  const btnLayerBack = document.getElementById('btn-layer-back');
  const layerButtonsEl = document.getElementById('layer-buttons');
  const colorSwatches = document.querySelectorAll('.color-swatch');
  const btnAccentCycle = document.getElementById('btn-accent-cycle');
  const marqueeBox = document.getElementById('marquee-box');
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
  let activeLayer = 1;
  const selectedComponents = new Set();
  const selectedWireGroups = new Set();
  let componentIdCounter = 0;
  let wireIdCounter = 0;
  let snapTimer = null;
  let activeHoverTerminal = null;
  let snappedTerminal = null;
  let snapPoint = null;
  let wireDraftStart = null;
  let wirePreviewLine = null;
  let marqueeStart = null;
  let marqueeActive = false;
  let suppressNextClick = false;
  const MARQUEE_MIN_PX = 4;
  const Q_HOLD_MS = 50;
  const Q_HOLD_MS_SELECTED = 400;
  const WIRE_WHEEL_ITEM = '__wire__';
  let recentAssetIds = [];
  let qHoldTimer = null;
  let qWheelOpen = false;
  let qWheelIndex = 0;
  let qKeyHeld = false;
  let qOpenedWheel = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  const components = new Map();
  const wires = new Map();
  const terminalWireMap = new Map();
  const layerState = {};
  const layerGroups = { below: {}, above: {} };

  for (let i = 1; i <= LAYER_COUNT; i++) {
    layerState[i] = { visible: true, above: false };
  }

  let zoom = 1;
  let panX = 0;
  let panY = 0;

  function applyViewport() {
    workspace.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    updateAllWirePositions();
  }

  function clientToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panX) / zoom,
      y: (clientY - rect.top - panY) / zoom,
    };
  }

  function screenDeltaToWorld(dx, dy) {
    return { x: dx / zoom, y: dy / zoom };
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
    const worldX = (vx - panX) / zoom;
    const worldY = (vy - panY) / zoom;
    panX = vx - worldX * clamped;
    panY = vy - worldY * clamped;
    zoom = clamped;
    applyViewport();
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

  function refreshLightningWireGlow() {
    wires.forEach((wire) => {
      wire.group.classList.remove('lightning-glow');
    });
    if (!lightningMode) return;
    const activeTerms = GuitarAssets.collectActiveCanvasTerminals(components);
    const wireIds = new Set();
    activeTerms.forEach((term) => {
      terminalWireMap.get(term)?.forEach((id) => wireIds.add(id));
    });
    wireIds.forEach((id) => {
      const wire = wires.get(id);
      if (wire) wire.group.classList.add('lightning-glow');
    });
  }

  function toggleLightningMode() {
    lightningMode = !lightningMode;
    refreshLightningWireGlow();
    setStatus(lightningMode ? 'Active terminal wires highlighted' : 'Active wire highlight off');
  }

  function syncContextMenuPowerButton() {
    const btn = document.getElementById('context-menu-power');
    if (!btn) return;
    btn.classList.toggle('active', lightningMode);
    btn.setAttribute('aria-pressed', lightningMode ? 'true' : 'false');
  }

  function isTypingTarget() {
    const tag = document.activeElement?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
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
    qHoldTimer = setTimeout(() => {
      if (qKeyHeld && openAssetWheel()) qOpenedWheel = true;
    }, getQHoldDelay());
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
        btn.textContent = GuitarAssets.getTemplate(id)?.name || id;
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
    }
    return changed;
  }

  function snapWorkspace(v, free) {
    if (free) return v;
    return Math.round(v / WORKSPACE_GRID) * WORKSPACE_GRID;
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
    setStatus(`Rotated ${selectedComponents.size} asset(s) ${deltaDeg > 0 ? '+' : ''}${deltaDeg}°`);
  }

  function setStatus(msg) {
    statusText.textContent = msg;
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
    updateAlignBar();
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
      return;
    }
    if (total === 1 && selectedWireGroups.size === 1) {
      const wire = wires.get([...selectedWireGroups][0].dataset.id);
      if (wire) {
        const stack = layerState[wire.layer].above ? 'front' : 'back';
        const slackHint = wire.slack ? `, slack ${wire.slack}px` : '';
        setStatus(`Wire L${wire.layer} (${stack}, ${wire.color}${slackHint}) — +/- or mouse wheel for slack, Delete to remove`);
      }
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
      return;
    }
    setStatus(`${total} selected (${selectedComponents.size} parts, ${selectedWireGroups.size} wires) — Delete to remove`);
    updateAlignBar();
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
    const x1 = wire.start.x;
    const y1 = wire.start.y;
    const x2 = wire.end.x;
    const y2 = wire.end.y;
    let left = Math.min(x1, x2);
    let top = Math.min(y1, y2);
    let right = Math.max(x1, x2);
    let bottom = Math.max(y1, y2);
    if (wire.slack) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const cx = mx + (-dy / len) * wire.slack;
      const cy = my + (dx / len) * wire.slack;
      left = Math.min(left, cx);
      top = Math.min(top, cy);
      right = Math.max(right, cx);
      bottom = Math.max(bottom, cy);
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
    if (placementMode) return false;
    if (e.target.classList.contains('terminal')) return false;
    if (e.target.closest('.component') || e.target.closest('.wire-group')) return false;
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

  function applyMarqueeSelection(rect) {
    deselectAll();
    components.forEach((comp) => {
      if (rectsIntersect(rect, getComponentRect(comp))) {
        comp.classList.add('selected');
        selectedComponents.add(comp);
      }
    });
    wires.forEach((wire) => {
      if (rectsIntersect(rect, getWireBounds(wire))) {
        wire.group.classList.add('selected');
        selectedWireGroups.add(wire.group);
      }
    });
    updateSelectionStatus();
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
      applyMarqueeSelection(rect);
      suppressNextClick = true;
    }

    marqueeStart = null;
    marqueeActive = false;
    hideMarqueeBox();
  }

  function initLayerGroups() {
    [wiresBelow, wiresAbove].forEach((stack, stackIdx) => {
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
    setStatus(`Layer ${activeLayer} ${state.visible ? 'shown' : 'hidden'}`);
  }

  function applyLayerVisibility(layer) {
    const visible = layerState[layer].visible;
    layerGroups.below[layer].classList.toggle('hidden', !visible);
    layerGroups.below[layer].classList.toggle('visible', visible);
    layerGroups.above[layer].classList.toggle('hidden', !visible);
    layerGroups.above[layer].classList.toggle('visible', visible);
  }

  function setLayerAbove(layer, above) {
    if (layerState[layer].above === above) return;
    layerState[layer].above = above;
    wires.forEach((wire) => {
      if (wire.layer === layer) moveWireToStack(wire);
    });
    if (wirePreviewLine) movePreviewToActiveLayer();
    updateLayerUI();
    setStatus(`Layer ${layer} ${above ? 'in front of' : 'behind'} components`);
  }

  function getLayerGroup(layer, above) {
    return above ? layerGroups.above[layer] : layerGroups.below[layer];
  }

  function moveWireToStack(wire) {
    const container = getLayerGroup(wire.layer, layerState[wire.layer].above);
    container.appendChild(wire.group);
  }

  function movePreviewToActiveLayer() {
    if (!wirePreviewLine) return;
    const container = getLayerGroup(activeLayer, layerState[activeLayer].above);
    container.appendChild(wirePreviewLine);
  }

  function registerTerminalWire(terminal, wireId) {
    if (!terminal) return;
    if (!terminalWireMap.has(terminal)) {
      terminalWireMap.set(terminal, new Set());
    }
    terminalWireMap.get(terminal).add(wireId);
    updateTerminalBadge(terminal);
  }

  function unregisterTerminalWire(terminal, wireId) {
    if (!terminal) return;
    const set = terminalWireMap.get(terminal);
    if (!set) return;
    set.delete(wireId);
    if (set.size === 0) terminalWireMap.delete(terminal);
    updateTerminalBadge(terminal);
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
      wireMode = false;
      cancelWireDraft();
      btnWire.classList.remove('active');
    }
    const template = assetId ? GuitarAssets.getTemplate(assetId) : null;
    setStatus(
      template
        ? `Click canvas to place ${template.name}`
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
    if (active) {
      setAssetPlacement(null);
    } else {
      cancelWireDraft();
      clearSnapState();
    }
    btnWire.classList.toggle('active', active);
    setStatus(
      active
        ? wireDraftStart
          ? 'Click end point for wire'
          : `Click start point for wire (Layer ${activeLayer})`
        : 'Ready'
    );
  }

  function setWireStyle(style) {
    wireStyle = style;
    btnSolid.classList.toggle('active', style === 'solid');
    btnDashed.classList.toggle('active', style === 'dashed');
  }

  function setWireColor(color) {
    wireColor = color;
    colorSwatches.forEach((swatch) => {
      swatch.classList.toggle('active', swatch.dataset.color === color);
    });
  }

  function resizeWireStacks() {
    const w = WORKSPACE_SIZE;
    const h = WORKSPACE_SIZE;
    [wiresBelow, wiresAbove].forEach((stack) => {
      stack.setAttribute('width', w);
      stack.setAttribute('height', h);
      stack.setAttribute('viewBox', `0 0 ${w} ${h}`);
    });
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
    if (wirePreviewLine) {
      wirePreviewLine.remove();
      wirePreviewLine = null;
    }
  }

  function cancelActiveWireDraft() {
    if (!wireDraftStart) return false;
    cancelWireDraft();
    setStatus(wireMode ? `Click start point (Layer ${activeLayer})` : 'Ready');
    return true;
  }

  function ensurePreviewLine() {
    if (wirePreviewLine) return wirePreviewLine;
    wirePreviewLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    wirePreviewLine.setAttribute('class', `wire-preview ${wireStyle === 'dashed' ? 'dashed' : ''}`);
    wirePreviewLine.setAttribute('stroke', WIRE_COLORS[wireColor]);
    movePreviewToActiveLayer();
    return wirePreviewLine;
  }

  function updatePreviewLine(clientX, clientY) {
    if (!wireDraftStart) return;
    const end = clientToWorld(clientX, clientY);
    const preview = ensurePreviewLine();
    preview.setAttribute('x1', wireDraftStart.x);
    preview.setAttribute('y1', wireDraftStart.y);
    preview.setAttribute('x2', end.x);
    preview.setAttribute('y2', end.y);
    preview.setAttribute('stroke', WIRE_COLORS[wireColor]);
    preview.setAttribute('class', `wire-preview ${wireStyle === 'dashed' ? 'dashed' : ''}`);
  }

  function getSelectedWireObject() {
    if (selectedWireGroups.size !== 1) return null;
    const group = [...selectedWireGroups][0];
    return wires.get(group.dataset.id) || null;
  }

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

  function createWirePathElement(className) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el.setAttribute('class', className);
    el.setAttribute('fill', 'none');
    return el;
  }

  function applyWireGeometry(wire, pathD) {
    wire.hit.setAttribute('d', pathD);
    wire.visible.setAttribute('d', pathD);
    if (wire.outline) {
      wire.outline.setAttribute('d', pathD);
    }
  }

  function adjustWireSlack(wire, delta) {
    if (!wire) return;
    const next = Math.max(-SLACK_MAX, Math.min(SLACK_MAX, (wire.slack || 0) + delta));
    if (next === wire.slack) return;
    wire.slack = next;
    updateWirePosition(wire);
    if (selectedWireGroups.has(wire.group)) {
      const stack = layerState[wire.layer].above ? 'front' : 'back';
      setStatus(`Wire L${wire.layer} slack: ${wire.slack}px — +/- or mouse wheel to adjust`);
    }
  }

  function adjustSelectedWireSlack(delta) {
    adjustWireSlack(getSelectedWireObject(), delta);
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

  function createWire(start, end) {
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
      color: wireColor,
      dashed: wireStyle === 'dashed',
      layer: activeLayer,
      slack: 0,
      start: { x: start.x, y: start.y, terminal: start.terminal || null },
      end: { x: end.x, y: end.y, terminal: end.terminal || null },
    };

    if (wireColor === 'black') {
      const outline = createWirePathElement(`wire-visible wire-outline ${wireStyle === 'dashed' ? 'dashed' : ''}`);
      outline.setAttribute('stroke', '#666');
      outline.setAttribute('stroke-width', '4');
      group.appendChild(outline);
      wire.outline = outline;
    }

    group.appendChild(visible);

    const container = getLayerGroup(activeLayer, layerState[activeLayer].above);
    container.appendChild(group);

    wires.set(id, wire);
    registerTerminalWire(wire.start.terminal, id);
    registerTerminalWire(wire.end.terminal, id);
    updateWirePosition(wire);
    setupWireInteraction(wire);
    selectWire(wire);
    refreshLightningWireGlow();
    return wire;
  }

  function updateWirePosition(wire) {
    const startPt = getAttachPoint(wire, 'start');
    const endPt = getAttachPoint(wire, 'end');

    wire.start.x = startPt.x;
    wire.start.y = startPt.y;
    wire.end.x = endPt.x;
    wire.end.y = endPt.y;

    const x1 = startPt.x;
    const y1 = startPt.y;
    const x2 = endPt.x;
    const y2 = endPt.y;
    const pathD = buildWirePath(x1, y1, x2, y2, wire.slack || 0);

    applyWireGeometry(wire, pathD);
    wire.visible.setAttribute('stroke', WIRE_COLORS[wire.color]);
    wire.visible.setAttribute('class', `wire-visible ${wire.dashed ? 'dashed' : ''}`);
    if (wire.outline) {
      wire.outline.setAttribute('class', `wire-visible wire-outline ${wire.dashed ? 'dashed' : ''}`);
    }
  }

  function updateAllWirePositions() {
    wires.forEach(updateWirePosition);
  }

  function setupWireInteraction(wire) {
    wire.group.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      selectWire(wire);
    });
  }

  function selectWire(wire) {
    deselectAll();
    selectedWireGroups.add(wire.group);
    wire.group.classList.add('selected');
    updateSelectionStatus();
  }

  function deleteWireGroup(group) {
    const id = group.dataset.id;
    const wire = wires.get(id);
    if (wire) {
      unregisterTerminalWire(wire.start.terminal, id);
      unregisterTerminalWire(wire.end.terminal, id);
    }
    group.remove();
    wires.delete(id);
    selectedWireGroups.delete(group);
    refreshLightningWireGlow();
  }

  function deleteSelected() {
    const wireGroups = [...selectedWireGroups];
    const comps = [...selectedComponents];
    if (wireGroups.length === 0 && comps.length === 0) return;

    wireGroups.forEach(deleteWireGroup);
    comps.forEach((comp) => {
      removeWiresForComponent(comp);
      components.delete(comp.dataset.id);
      comp.remove();
    });

    deselectAll();
    clearSnapState();
    refreshLightningWireGlow();
    const n = wireGroups.length + comps.length;
    setStatus(n === 1 ? 'Deleted' : `Deleted ${n} items`);
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
      clearSnapState();
      ensurePreviewLine();
      setStatus('Click end point for wire (same terminal OK for multiple wires)');
      return true;
    }

    createWire(wireDraftStart, endpoint);
    cancelWireDraft();
    clearSnapState();
    setStatus(`Wire on Layer ${activeLayer} — click for next wire`);
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
        clearSnapState();
        ensurePreviewLine();
        setStatus('Click end point for wire (same terminal OK for multiple wires)');
      } else {
        createWire(wireDraftStart, endpoint);
        cancelWireDraft();
        clearSnapState();
        setStatus(`Wire on Layer ${activeLayer} — click for next wire`);
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

  function showSnapIndicator(x, y) {
    snapIndicator.classList.remove('hidden');
    snapIndicator.classList.remove('pulse');
    void snapIndicator.offsetWidth;
    snapIndicator.classList.add('pulse');
    snapIndicator.style.left = `${x}px`;
    snapIndicator.style.top = `${y}px`;
  }

  function snapToTerminal(terminalEl) {
    const center = getTerminalCenter(terminalEl);
    snappedTerminal = terminalEl;
    snapPoint = { ...center };

    document.querySelectorAll('.terminal.snapped').forEach((t) => t.classList.remove('snapped'));
    terminalEl.classList.add('snapped');

    showSnapIndicator(center.x, center.y);

    const label = terminalEl.dataset.terminalLabel;
    const comp = terminalEl.closest('.component');
    const compType = comp?.dataset.type ?? 'terminal';
    const wireCount = terminalWireMap.get(terminalEl)?.size || 0;
    snapInfo.textContent = `Snapped: ${label} (${compType})${wireCount ? ` · ${wireCount} wires` : ''}`;
    setStatus(`Snapped to ${label} — cursor magnet active`);

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
    snapIndicator.classList.add('hidden');
    snapInfo.textContent = '';
    document.body.classList.remove('snap-active');
    document.querySelectorAll('.terminal.snapped').forEach((t) => t.classList.remove('snapped'));
  }

  function placeAssetAt(assetId, x, y) {
    const template = GuitarAssets.getTemplate(assetId);
    if (!template) return;
    const { offsetX, offsetY } = GuitarAssets.getPlacementOffset(template);
    GuitarAssets.createComponent(
      template,
      snapWorkspace(x - offsetX),
      snapWorkspace(y - offsetY)
    );
    recordRecentAsset(assetId);
    setAssetPlacement(null);
  }

  function refreshComponentsForTemplate(templateId) {
    const template = GuitarAssets.getTemplate(templateId);
    if (!template) return;

    components.forEach((el, compId) => {
      if (el.dataset.assetId !== templateId) return;

      const left = parseFloat(el.style.left) || 0;
      const top = parseFloat(el.style.top) || 0;
      const rotation = el.dataset.rotation || '';
      const stateIndex = GuitarAssets.getComponentStateIndex(el);
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
      if (wasSelected) {
        selectedComponents.delete(el);
        selectedComponents.add(newEl);
        newEl.classList.add('selected');
      }

      el.replaceWith(newEl);
      components.set(compId, newEl);
      setupComponentInteraction(newEl);

      const newTerms = [...newEl.querySelectorAll('.terminal')];
      wireLinks.forEach(({ wire, end, termIndex }) => {
        const newTerm = newTerms[termIndex];
        if (!newTerm) return;
        wire[end].terminal = newTerm;
      });

      if (template.states?.length) {
        GuitarAssets.applyComponentStateVisuals(newEl, template, stateIndex);
      } else {
        GuitarAssets.updateComponentStateLabel(newEl);
      }
    });

    updateAllTerminalBadges();
    updateAllWirePositions();
    refreshLightningWireGlow();
    updateSelectionStatus();
  }

  function selectComponent(el) {
    deselectAll();
    if (el) {
      selectedComponents.add(el);
      el.classList.add('selected');
    }
    updateSelectionStatus();
  }

  function setupComponentInteraction(el) {
    el.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('terminal') || wireMode) return;
      e.stopPropagation();

      if (!selectedComponents.has(el)) {
        selectComponent(el);
      }

      const startClientX = e.clientX;
      const startClientY = e.clientY;
      let isDragging = false;
      let dragOffsetX = 0;
      let dragOffsetY = 0;
      let dragSnapshot = null;
      const dragTargets = [...selectedComponents];

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
          dragTargets.forEach((c) => c.classList.add('dragging'));
        }

        let newX = (e.clientX - dragOffsetX - canvas.getBoundingClientRect().left - panX) / zoom;
        let newY = (e.clientY - dragOffsetY - canvas.getBoundingClientRect().top - panY) / zoom;
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

        updateAllWirePositions();
      }

      function onUp() {
        if (isDragging) {
          dragTargets.forEach((c) => c.classList.remove('dragging'));
        }
        dragSnapshot = null;
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

  function trySelectComponentUnderWire(e) {
    if (wireMode) return false;
    const top = document.elementsFromPoint(e.clientX, e.clientY)[0];
    if (!top?.closest('.wire-group')) return false;
    const comp = findComponentAtPoint(e.clientX, e.clientY);
    if (!comp) return false;
    e.stopPropagation();
    e.preventDefault();
    selectComponent(comp);
    return true;
  }

  btnWire.addEventListener('click', () => {
    setWireMode(!wireMode);
  });

  btnSolid.addEventListener('click', () => setWireStyle('solid'));
  btnDashed.addEventListener('click', () => setWireStyle('dashed'));

  btnLayerVisibility.addEventListener('click', toggleLayerVisibility);
  btnLayerFront.addEventListener('click', () => setLayerAbove(activeLayer, true));
  btnLayerBack.addEventListener('click', () => setLayerAbove(activeLayer, false));

  colorSwatches.forEach((swatch) => {
    swatch.addEventListener('click', () => setWireColor(swatch.dataset.color));
  });

  btnAccentCycle.addEventListener('click', cycleAccentTheme);

  btnAlignColumn?.addEventListener('click', alignSelectedColumn);
  btnAlignRow?.addEventListener('click', alignSelectedRow);
  btnRotateCcw?.addEventListener('click', () => rotateSelected(-ROT_STEP));
  btnRotateCw?.addEventListener('click', () => rotateSelected(ROT_STEP));

  canvas.addEventListener('click', (e) => {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    if (e.target.closest('.wire-group')) return;
    if (e.target.classList.contains('terminal')) return;

    if (wireMode && handleWireCanvasClick(e)) return;

    if (placementMode && !e.target.closest('.component')) {
      const { x, y } = getCanvasCoords(e);
      placeAssetAt(placementMode, x, y);
      return;
    }

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
    showSnapIndicator(snapPoint.x, snapPoint.y);
  });

  canvas.addEventListener('wheel', (e) => {
    if (qWheelOpen) return;
    if (selectedComponents.size > 0 && isMouseWheel(e)) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? ROT_STEP : -ROT_STEP;
      rotateSelected(delta);
      return;
    }
    const wire = getSelectedWireObject();
    if (wire && isMouseWheel(e)) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? SLACK_STEP : -SLACK_STEP;
      adjustWireSlack(wire, delta);
      return;
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
    if (qWheelOpen) updateWheelIndexFromPointer(e.clientX, e.clientY);
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
    if (e.key === 'q' || e.key === 'Q') {
      if (isTypingTarget() || isEditorOpen()) return;
      if (e.repeat) return;
      qKeyHeld = true;
      qOpenedWheel = false;
      scheduleQHoldWheel();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (cancelActiveWireDraft()) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      deleteSelected();
    }
    if ((e.key === '+' || e.key === '=' || e.key === '-') && document.activeElement?.tagName !== 'INPUT') {
      if (selectedComponents.size > 0) {
        e.preventDefault();
        const delta = (e.key === '-') ? -ROT_STEP : ROT_STEP;
        rotateSelected(delta);
        return;
      }
      if (getSelectedWireObject()) {
        e.preventDefault();
        const delta = (e.key === '-') ? -SLACK_STEP : SLACK_STEP;
        adjustSelectedWireSlack(delta);
        return;
      }
    }
    if (e.key >= '1' && e.key <= '4' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (document.activeElement?.tagName === 'INPUT') return;
      setActiveLayer(Number(e.key));
    }
    if ((e.key === 'e' || e.key === 'E')
      && !isTypingTarget()
      && !isEditorOpen()
      && document.getElementById('asset-editor')?.classList.contains('hidden')) {
      if (selectedComponents.size > 0 && cycleSelectedComponentState(1)) {
        e.preventDefault();
      }
    }
    if (e.key === 'Escape') {
      if (qWheelOpen) {
        closeAssetWheel();
        qOpenedWheel = false;
        qKeyHeld = false;
        clearTimeout(qHoldTimer);
        setStatus('Ready');
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
    if (qOpenedWheel) {
      confirmAssetWheelSelection();
    } else if (selectedComponents.size > 0) {
      cycleSelectedComponentState(-1);
    }
    qKeyHeld = false;
    qOpenedWheel = false;
    closeAssetWheel();
  });

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
    });
  }

  initLayerGroups();
  initLayerUI();
  applyAccentTheme(0);
  initLogoMark();

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
    refreshLightningWireGlow,
    refreshComponentsForTemplate,
    nextComponentId: () => {
      componentIdCounter += 1;
      return `cmp-${componentIdCounter}`;
    },
  });

  window.addEventListener('resize', resizeWireStacks);
  document.documentElement.style.setProperty('--workspace-grid-size', `${WORKSPACE_GRID}px`);
  resizeWireStacks();
  applyViewport();
  canvas.focus();
})();
