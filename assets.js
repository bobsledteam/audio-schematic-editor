(function (global) {
  'use strict';

  const EDITOR_GRID = 5;
  const EDITOR_STAGE_W = 168;
  const STORAGE_KEY = 'guitar-custom-assets';
  const TERM_W = 22;
  const TERM_H = 18;
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
    { name: 'Green', value: '#2ecc71' },
    { name: 'White', value: '#f5f5f5' },
    { name: 'Gold', value: '#c9a227' },
    { name: 'Yellow', value: '#ffd700' },
    { name: 'Orange', value: '#ff8c00' },
    { name: 'Blue', value: '#6ab0ff' },
    { name: 'Black', value: '#111111' },
  ];

  const SUBTYPES = {
    pickup: [{ id: 'singlecoil', label: 'Single Coil' }],
    switch: [{ id: 'dpdt', label: 'DPDT type 1' }],
  };

  function singleCoilTerminalPair(bx, by, bw, bodyH) {
    const ty = by + bodyH + TERM_BELOW_BODY;
    const centerX = bx + bw / 2;
    const gapLeft = centerX - TERM_GAP / 2;
    const hX = gapLeft - TERM_W;
    const gX = gapLeft + TERM_GAP;
    return [
      { label: 'H', color: '#2ecc71', className: 'hot', x: hX, y: ty },
      { label: 'G', color: '#f5f5f5', className: 'ground', x: gX, y: ty },
    ];
  }

  const BUILTIN_TEMPLATES = [
    {
      id: 'singlecoil',
      name: 'Single Coil',
      category: 'pickup',
      subtype: 'singlecoil',
      builtin: true,
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
      id: 'dpdt',
      name: 'DPDT type 1',
      category: 'switch',
      subtype: 'dpdt',
      builtin: true,
      placeLabel: 'DPDT',
      bodyW: 80,
      bodyH: 56,
      cssClass: 'dpdt',
      layout: 'grid-3x2',
      states: [
        { id: 0, label: '0', terminalActive: [false, false, false, false, false, false] },
        { id: 1, label: 'Up', terminalActive: [false, false, true, true, true, true] },
        { id: 2, label: 'Middle', terminalActive: [true, false, true, true, false, true] },
        { id: 3, label: 'Down', terminalActive: [true, true, true, true, false, false] },
      ],
      terminals: Array.from({ length: 6 }, (_, i) => ({
        label: `T${i + 1}`,
        color: '#c9a227',
        className: 'switch-term',
      })),
    },
  ];

  let customTemplates = [];
  let deps = null;
  let editorDraft = null;
  let editorDrag = null;
  let contextTarget = null;
  let pendingDelete = null;

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
    draft.bodyX = snapEditor((EDITOR_STAGE_W - draft.bodyW) / 2);
    draft.bodyY = snapEditor(12);
  }

  function normalizeDraft(draft) {
    const xs = [draft.bodyX, ...draft.terminals.map((t) => t.x)];
    const ys = [draft.bodyY, ...draft.terminals.map((t) => t.y)];
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    draft.bodyX -= minX;
    draft.bodyY -= minY;
    draft.terminals.forEach((t) => {
      t.x -= minX;
      t.y -= minY;
    });
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
  }

  function addEditorState() {
    const nextId = Math.max(0, ...editorDraft.states.map((s) => s.id)) + 1;
    editorDraft.states.push({
      id: nextId,
      terminalActive: editorDraft.terminals.map(() => false),
    });
    editorDraft.activeStateIndex = editorDraft.states.length - 1;
    renderEditor();
  }

  function deleteEditorState() {
    const current = editorDraft.states[editorDraft.activeStateIndex];
    if (!current || current.id === 1) return;
    editorDraft.states.splice(editorDraft.activeStateIndex, 1);
    editorDraft.activeStateIndex = Math.min(editorDraft.activeStateIndex, editorDraft.states.length - 1);
    renderEditor();
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
        editorDraft.activeStateIndex = i;
        renderEditor();
      });
      tabs.appendChild(btn);
    });
    if (delBtn) {
      const current = editorDraft.states[editorDraft.activeStateIndex];
      delBtn.disabled = !current || current.id === 1;
    }
  }

  function editorTerminalPreviewStyle(box, term, idx) {
    if (isTerminalActiveInEditor(idx)) {
      box.style.background = ACTIVE_TERM_COLOR;
      box.style.color = '#fff';
    } else {
      box.style.background = term.color;
      box.style.color = '#111';
    }
  }

  function updateEditorGridToggle() {
    const btn = document.getElementById('asset-editor-grid-toggle');
    const preview = document.getElementById('asset-editor-preview');
    if (!btn || !preview || !editorDraft) return;
    btn.textContent = editorDraft.gridVisible ? 'Grid: On' : 'Grid: Off';
    preview.classList.toggle('show-grid', !!editorDraft.gridVisible);
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
    const ty = by + draft.bodyH + TERM_BELOW_BODY;
    if (category === 'pickup' && subtype === 'singlecoil') {
      return singleCoilTerminalPair(bx, by, bw, draft.bodyH);
    }
    if (category === 'switch' && subtype === 'dpdt') {
      const terms = [];
      let i = 0;
      const startX = bx + snapEditor((bw - 56) / 2);
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 2; col++) {
          terms.push({
            label: `T${i + 1}`,
            color: '#c9a227',
            className: 'switch-term',
            x: startX + col * 28,
            y: ty + row * 20,
          });
          i++;
        }
      }
      return terms;
    }
    return singleCoilTerminalPair(bx, by, bw, draft.bodyH);
  }

  function defaultBody(category, subtype) {
    if (category === 'switch' && subtype === 'dpdt') return { bodyW: 80, bodyH: 56, placeLabel: 'SW' };
    return { bodyW: 70, bodyH: 48, placeLabel: 'PU' };
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
    const message = document.getElementById('asset-delete-confirm-message');
    if (!dialog || !message) return;
    const label = name || 'this custom asset';
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
      if (!template || !template.states?.length) return;
      const state = template.states[getComponentStateIndex(comp)];
      if (!state) return;
      comp.querySelectorAll('.terminal').forEach((term, idx) => {
        if (state.terminalActive?.[idx]) result.push(term);
      });
    });
    return result;
  }

  function syncContextMenuPowerButton() {
    const btn = document.getElementById('context-menu-power');
    if (!btn || !deps.getLightningMode) return;
    const on = deps.getLightningMode();
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function showContextMenu(clientX, clientY, component) {
    contextTarget = component || null;
    if (component && deps.selectComponent) {
      deps.selectComponent(component);
    }
    const menu = menuEl();
    const list = menuListEl();
    if (!menu || !list) return;

    syncContextMenuPowerButton();
    list.innerHTML = '';

    if (component) {
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

    getAllTemplates().forEach((asset) => {
      const li = document.createElement('li');
      li.className = 'context-menu-row';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'context-menu-item';
      btn.textContent = asset.name;
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

      list.appendChild(li);
    });

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
    editorDraft = {
      ...JSON.parse(JSON.stringify(template)),
      editingId: template.id,
      gridVisible: false,
      activeStateIndex: 0,
    };
    if (editorDraft.bodyX == null) editorDraft.bodyX = 0;
    if (editorDraft.bodyY == null) editorDraft.bodyY = 12;
    renderEditor();
    editorEl()?.classList.remove('hidden');
    deps.setStatus(`Editing "${template.name}" — Save to apply changes`);
  }

  function openEditor() {
    hideContextMenu();
    const body = defaultBody('pickup', 'singlecoil');
    editorDraft = {
      name: '',
      category: 'pickup',
      subtype: 'singlecoil',
      ...body,
      cssClass: 'custom',
      layout: 'absolute',
      gridVisible: false,
      bodyX: 0,
      bodyY: 12,
      terminals: [],
      editingId: null,
    };
    centerBodyInDraft(editorDraft);
    editorDraft.terminals = defaultTerminals('pickup', 'singlecoil', editorDraft);
    resetEditorStatesFromTerminals();
    renderEditor();
    editorEl()?.classList.remove('hidden');
    deps.setStatus('Edit custom asset — drag body & terminals, Save or Cancel');
  }

  function closeEditor() {
    editorDraft = null;
    editorEl()?.classList.add('hidden');
  }

  function renderSubtypeOptions() {
    const sel = document.getElementById('asset-editor-subtype');
    if (!sel || !editorDraft) return;
    const options = SUBTYPES[editorDraft.category] || [];
    sel.innerHTML = '';
    options.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.id;
      o.textContent = opt.label;
      sel.appendChild(o);
    });
    sel.value = editorDraft.subtype;
  }

  function updateEditorTerminalVisuals(stage) {
    editorDraft.terminals.forEach((term, idx) => {
      const box = stage.querySelector(`.asset-editor-terminal[data-idx="${idx}"]`);
      if (box) {
        box.style.left = `${term.x}px`;
        box.style.top = `${term.y}px`;
      }
    });
  }

  function repositionTerminalsAfterBodyResize(startTerms) {
    editorDraft.terminals.forEach((term, i) => {
      term.y = snapEditor(Math.max(0, editorDraft.bodyY + editorDraft.bodyH + startTerms[i].gapBelowBody));
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
    bodyEl.style.left = `${editorDraft.bodyX}px`;
    bodyEl.style.top = `${editorDraft.bodyY}px`;
    const label = bodyEl.querySelector('.asset-editor-body-label');
    if (label) label.textContent = editorDraft.placeLabel || '??';
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
        const rect = stage.getBoundingClientRect();
        editorDrag = {
          type: 'resize',
          handle: id,
          startCx: editorDraft.bodyX + editorDraft.bodyW / 2,
          startCy: editorDraft.bodyY + editorDraft.bodyH / 2,
          startW: editorDraft.bodyW,
          startH: editorDraft.bodyH,
          startMx: e.clientX - rect.left,
          startMy: e.clientY - rect.top,
          startTerms: editorDraft.terminals.map((t) => ({
            gapBelowBody: t.y - (editorDraft.bodyY + editorDraft.bodyH),
          })),
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

    editorDraft.terminals.forEach((term, idx) => {
      const row = document.createElement('div');
      row.className = 'asset-editor-term-row';

      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'asset-editor-input';
      labelInput.value = term.label;
      labelInput.maxLength = 4;
      labelInput.addEventListener('input', () => {
        term.label = labelInput.value.slice(0, 4) || '?';
        renderEditorPreview();
      });

      const colorSel = document.createElement('select');
      colorSel.className = 'asset-editor-select';
      TERMINAL_PALETTE.forEach((c) => {
        const o = document.createElement('option');
        o.value = c.value;
        o.textContent = c.name;
        colorSel.appendChild(o);
      });
      colorSel.value = term.color;
      colorSel.addEventListener('change', () => {
        term.color = colorSel.value;
        renderEditorPreview();
      });

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
      delBtn.title = 'Remove terminal';
      delBtn.addEventListener('click', () => {
        editorDraft.terminals.splice(idx, 1);
        syncStateTerminalFlags(editorDraft);
        renderEditor();
      });

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
    updateEditorGridToggle();

    const stage = document.createElement('div');
    stage.className = 'asset-editor-stage';

    let maxX = editorDraft.bodyX + editorDraft.bodyW;
    let maxY = editorDraft.bodyY + editorDraft.bodyH;

    const body = document.createElement('div');
    body.className = 'asset-editor-body';
    const label = document.createElement('span');
    label.className = 'asset-editor-body-label';
    label.textContent = editorDraft.placeLabel || '??';
    body.appendChild(label);
    body.style.width = `${editorDraft.bodyW}px`;
    body.style.height = `${editorDraft.bodyH}px`;
    body.style.left = `${editorDraft.bodyX}px`;
    body.style.top = `${editorDraft.bodyY}px`;

    body.addEventListener('mousedown', (e) => {
      if (e.target.closest('.asset-editor-resize-handle')) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = stage.getBoundingClientRect();
      editorDrag = {
        type: 'body',
        offsetX: e.clientX - rect.left - editorDraft.bodyX,
        offsetY: e.clientY - rect.top - editorDraft.bodyY,
        startBodyX: editorDraft.bodyX,
        startBodyY: editorDraft.bodyY,
        startTerms: editorDraft.terminals.map((t) => ({ x: t.x, y: t.y })),
      };
      body.classList.add('dragging');
    });

    attachResizeHandles(body, stage);
    stage.appendChild(body);

    editorDraft.terminals.forEach((term, idx) => {
      const box = document.createElement('div');
      box.className = 'asset-editor-terminal';
      box.style.left = `${term.x}px`;
      box.style.top = `${term.y}px`;
      box.dataset.idx = String(idx);
      editorTerminalPreviewStyle(box, term, idx);

      const termLabel = document.createElement('span');
      termLabel.className = 'asset-editor-terminal-label';
      termLabel.textContent = term.label;
      box.appendChild(termLabel);

      box.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = stage.getBoundingClientRect();
        editorDrag = {
          type: 'terminal',
          idx,
          offsetX: e.clientX - rect.left - term.x,
          offsetY: e.clientY - rect.top - term.y,
        };
      });

      stage.appendChild(box);
      maxX = Math.max(maxX, term.x + 24);
      maxY = Math.max(maxY, term.y + 20);
    });

    stage.style.width = `${Math.max(EDITOR_STAGE_W, maxX + 8)}px`;
    stage.style.height = `${maxY + 12}px`;
    preview.appendChild(stage);
  }

  function renderEditor() {
    if (!editorDraft) return;
    ensureEditorStates(editorDraft);
    const header = document.getElementById('asset-editor-header');
    if (header) {
      header.textContent = editorDraft.editingId ? 'Edit Custom Asset' : 'Custom Asset';
    }
    document.getElementById('asset-editor-name').value = editorDraft.name;
    document.getElementById('asset-editor-category').value = editorDraft.category;
    document.getElementById('asset-editor-placelabel').value = editorDraft.placeLabel;
    renderStateBar();
    renderSubtypeOptions();
    renderTerminalEditorList();
    renderEditorPreview();
  }

  function saveEditor() {
    if (!editorDraft) return;
    const name = document.getElementById('asset-editor-name').value.trim();
    if (!name) {
      deps.setStatus('Enter a name for the custom asset');
      return;
    }
    const editingId = editorDraft.editingId;
    const saved = {
      ...JSON.parse(JSON.stringify(editorDraft)),
      id: editingId || `custom-${Date.now()}`,
      name,
      placeLabel: document.getElementById('asset-editor-placelabel').value.trim().slice(0, 8) || 'CU',
      layout: 'absolute',
      cssClass: 'custom',
      builtin: false,
    };
    delete saved.gridVisible;
    delete saved.activeStateIndex;
    delete saved.editingId;
    if (!saved.states?.length) {
      saved.states = [{ id: 1, terminalActive: saved.terminals.map(() => false) }];
    }
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
        const rect = stage.getBoundingClientRect();

        if (editorDrag.type === 'body') {
          const newBodyX = snapEditor(Math.max(0, e.clientX - rect.left - editorDrag.offsetX));
          const newBodyY = snapEditor(Math.max(0, e.clientY - rect.top - editorDrag.offsetY));
          const dx = newBodyX - editorDrag.startBodyX;
          const dy = newBodyY - editorDrag.startBodyY;
          editorDraft.bodyX = newBodyX;
          editorDraft.bodyY = newBodyY;
          editorDraft.terminals.forEach((term, i) => {
            term.x = editorDrag.startTerms[i].x + dx;
            term.y = editorDrag.startTerms[i].y + dy;
          });
          updateEditorBodyVisual(stage);
          editorDraft.terminals.forEach((term, idx) => {
            const box = stage.querySelector(`.asset-editor-terminal[data-idx="${idx}"]`);
            if (box) {
              box.style.left = `${term.x}px`;
              box.style.top = `${term.y}px`;
            }
          });
        } else if (editorDrag.type === 'resize') {
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const deltaX = mx - editorDrag.startMx;
          const deltaY = my - editorDrag.startMy;
          applyCenterLockedResize(editorDrag.handle, deltaX, deltaY, editorDrag);
          repositionTerminalsAfterBodyResize(editorDrag.startTerms);
          updateEditorBodyVisual(stage);
          updateEditorTerminalVisuals(stage);
        } else if (editorDrag.type === 'terminal') {
          const term = editorDraft.terminals[editorDrag.idx];
          term.x = snapEditor(Math.max(0, e.clientX - rect.left - editorDrag.offsetX));
          term.y = snapEditor(Math.max(0, e.clientY - rect.top - editorDrag.offsetY));
          const box = stage.querySelector(`.asset-editor-terminal[data-idx="${editorDrag.idx}"]`);
          if (box) {
            box.style.left = `${term.x}px`;
            box.style.top = `${term.y}px`;
          }
        }
      }
    });

    document.addEventListener('mouseup', () => {
      document.querySelector('.asset-editor-body.dragging')?.classList.remove('dragging');
      document.querySelector('.asset-editor-body.resizing')?.classList.remove('resizing');
      panelDrag = null;
      editorDrag = null;
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

    document.getElementById('asset-editor-category')?.addEventListener('change', (e) => {
      editorDraft.category = e.target.value;
      editorDraft.subtype = SUBTYPES[editorDraft.category][0].id;
      Object.assign(editorDraft, defaultBody(editorDraft.category, editorDraft.subtype));
      centerBodyInDraft(editorDraft);
      editorDraft.terminals = defaultTerminals(editorDraft.category, editorDraft.subtype, editorDraft);
      resetEditorStatesFromTerminals();
      renderEditor();
    });

    document.getElementById('asset-editor-subtype')?.addEventListener('change', (e) => {
      editorDraft.subtype = e.target.value;
      Object.assign(editorDraft, defaultBody(editorDraft.category, editorDraft.subtype));
      centerBodyInDraft(editorDraft);
      editorDraft.terminals = defaultTerminals(editorDraft.category, editorDraft.subtype, editorDraft);
      resetEditorStatesFromTerminals();
      renderEditor();
    });

    document.getElementById('asset-editor-placelabel')?.addEventListener('input', (e) => {
      if (!editorDraft) return;
      editorDraft.placeLabel = e.target.value.slice(0, 8);
      const labelEl = document.querySelector('.asset-editor-body-label');
      if (labelEl) labelEl.textContent = editorDraft.placeLabel || '??';
    });

    document.getElementById('asset-editor-add-terminal')?.addEventListener('click', () => {
      editorDraft.terminals.push({
        label: 'N',
        color: '#6ab0ff',
        x: snapEditor(editorDraft.bodyX + 8),
        y: snapEditor(editorDraft.bodyY + editorDraft.bodyH + 8),
      });
      syncStateTerminalFlags(editorDraft);
      renderEditor();
    });

    document.getElementById('asset-editor-save')?.addEventListener('click', saveEditor);
    document.getElementById('asset-editor-cancel')?.addEventListener('click', () => {
      closeEditor();
      deps.setStatus('Custom asset cancelled');
    });
  }

  function setupContextMenu() {
    document.getElementById('context-menu-add')?.addEventListener('click', openEditor);
    document.getElementById('context-menu-power')?.addEventListener('click', (e) => {
      e.stopPropagation();
      deps.toggleLightningMode?.();
      syncContextMenuPowerButton();
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

  function applyComponentStateVisuals(el, template, stateIndex) {
    const state = template?.states?.[stateIndex];
    if (!state) return;
    const termEls = el.querySelectorAll('.terminal');
    template.terminals.forEach((spec, idx) => {
      const term = termEls[idx];
      if (!term) return;
      const baseColor = term.dataset.baseColor || spec.color || '';
      const active = !!state.terminalActive?.[idx];
      if (active) {
        if (spec.keepColorWhenActive) {
          term.style.background = baseColor;
          term.style.color = '#111';
          term.classList.add('state-active', 'keep-base-color');
        } else {
          term.style.background = ACTIVE_TERM_COLOR;
          term.style.color = '#fff';
          term.classList.add('state-active');
          term.classList.remove('keep-base-color');
        }
      } else {
        term.style.background = baseColor;
        term.style.color = '#111';
        term.classList.remove('state-active', 'keep-base-color');
      }
    });
    el.dataset.assetStateIndex = String(stateIndex);
    el.dataset.assetStateId = String(state.id);
    updateComponentStateLabel(el);
    deps.refreshLightningWireGlow?.();
  }

  function updateComponentStateLabel(el) {
    const label = el.querySelector('.component-state-label');
    if (!label) return;
    const template = getTemplate(el.dataset.assetId);
    if (!template || !template.states?.length || template.hideStateLabel) {
      label.hidden = true;
      return;
    }
    const state = template.states[getComponentStateIndex(el)];
    label.textContent = state?.label != null ? String(state.label) : `State ${state?.id ?? ''}`;
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
    if (!template?.states?.length) return false;
    const count = template.states.length;
    const idx = ((stateIndex % count) + count) % count;
    applyComponentStateVisuals(el, template, idx);
    return true;
  }

  function cycleComponentState(el, direction) {
    const template = getTemplate(el.dataset.assetId);
    if (!template?.states || template.states.length <= 1) return false;
    return setComponentStateIndex(el, getComponentStateIndex(el) + direction);
  }

  function hasAssetStates(el) {
    const template = getTemplate(el?.dataset?.assetId);
    return !!(template?.states && template.states.length > 1);
  }

  function getComponentStateLabel(el) {
    const template = getTemplate(el?.dataset?.assetId);
    if (!template?.states?.length) return null;
    const idx = getComponentStateIndex(el);
    const state = template.states[idx];
    if (!state) return null;
    return state.label != null ? state.label : state.id;
  }

  function getAbsoluteBounds(template) {
    let minX = template.bodyX || 0;
    let minY = template.bodyY || 0;
    let maxX = minX + (template.bodyW || 70);
    let maxY = minY + (template.bodyH || 48);
    template.terminals.forEach((spec) => {
      if (spec.x != null) {
        minX = Math.min(minX, spec.x);
        maxX = Math.max(maxX, spec.x + TERM_W);
      }
      if (spec.y != null) {
        minY = Math.min(minY, spec.y);
        maxY = Math.max(maxY, spec.y + TERM_H);
      }
    });
    return { minX, minY, maxX, maxY };
  }

  function buildComponentDOM(template, id) {
    const el = document.createElement('div');
    el.className = `component ${template.cssClass || 'custom'}`;
    el.dataset.id = id;
    el.dataset.type = template.id;
    el.dataset.assetId = template.id;

    const bounds = template.layout === 'absolute' ? getAbsoluteBounds(template) : null;
    const originX = bounds?.minX || 0;
    const originY = bounds?.minY || 0;

    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.setAttribute('aria-label', template.name);
    placeholder.textContent = template.placeLabel || '??';
    if (template.bodyW) placeholder.style.width = `${template.bodyW}px`;
    if (template.bodyH) placeholder.style.height = `${template.bodyH}px`;
    if (template.layout === 'absolute') {
      placeholder.style.position = 'absolute';
      placeholder.style.left = `${(template.bodyX || 0) - originX}px`;
      placeholder.style.top = `${(template.bodyY || 0) - originY}px`;
    }
    if (template.cssClass === 'singlecoil') {
      placeholder.style.backgroundImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='48' viewBox='0 0 70 48'%3E%3Cellipse cx='35' cy='24' rx='27' ry='16' fill='none' stroke='%23888' stroke-width='2'/%3E%3Cellipse cx='35' cy='24' rx='17' ry='10' fill='none' stroke='%23666' stroke-width='1'/%3E%3Ccircle cx='35' cy='24' r='4' fill='%23555'/%3E%3C/svg%3E\")";
      placeholder.style.backgroundRepeat = 'no-repeat';
      placeholder.style.backgroundPosition = 'center';
    }

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
      if (template.layout === 'absolute' && spec.x != null) {
        term.style.position = 'absolute';
        term.style.left = `${spec.x - originX}px`;
        term.style.top = `${spec.y - originY}px`;
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
    createComponent,
    buildComponentDOM,
    getPlacementOffset,
    showContextMenu,
    hideContextMenu,
    cycleComponentState,
    hasAssetStates,
    getComponentStateIndex,
    getComponentStateLabel,
    updateComponentStateLabel,
    applyComponentStateVisuals,
    collectActiveCanvasTerminals,
  };
})(window);
