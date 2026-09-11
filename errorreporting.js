/**
 * Error-reporting engine — Bugtest capture / categorize / Cursor-oriented export.
 *
 * Categories: calculation | render | electromagnetism | UI
 * Click cycle: idle → silent record → click again (or leave) auto-saves to Desktop
 *
 * @see CalcEngines.ERRORREPORTING
 */
(function (global) {
  'use strict';

  const APP_META = Object.freeze({
    label: 'Bugtest Ver.',
    build: 569,
    product: 'Endo Audio Schematic Editor',
  });

  const CATEGORIES = Object.freeze([
    'calculation',
    'render',
    'electromagnetism',
    'UI',
  ]);

  const CONSOLIDATE_AFTER = 5;
  const MONTH_ABBR = Object.freeze([
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]);

  const MODE = Object.freeze({
    idle: 'idle',
    recording: 'recording',
  });

  /** @type {Map<string, {
   *   key: string,
   *   category: string,
   *   message: string,
   *   stack: string,
   *   source: string,
   *   count: number,
   *   firstAt: string,
   *   lastAt: string,
   *   level: string,
   * }>} */
  const entries = new Map();

  let mode = MODE.idle;
  let termOpen = false;
  let hooked = false;
  let origConsoleError = null;
  let saveInFlight = false;
  let leaveHooksBound = false;
  let keyHooksBound = false;
  let termRenderRaf = 0;

  function isCapturing() {
    return mode === MODE.recording || termOpen;
  }

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch (_) {
      return String(Date.now());
    }
  }

  function fingerprint(message, stack, source) {
    const msg = String(message || '').replace(/\s+/g, ' ').trim().slice(0, 400);
    const top = String(stack || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join('|');
    const src = String(source || '').replace(/\?v=\d+/g, '');
    return `${msg}::${top || src}`.slice(0, 800);
  }

  /**
   * Map stack / message cues onto report categories (engine-oriented).
   * @returns {'calculation'|'render'|'electromagnetism'|'UI'}
   */
  function categorize(message, stack, source) {
    const hay = [
      String(message || ''),
      String(stack || ''),
      String(source || ''),
    ].join('\n').toLowerCase();

    if (
      /electromagnet|bobbin|magnet(?:ic|s)?|pole.?piece|flatwork|chamfer|coil.?gap|understack|baseplate|bhmax|\bbr\b|\bhc\b|μr|mur\b/.test(hay)
      && !/materials\.js/.test(hay)
    ) {
      return 'electromagnetism';
    }
    if (
      /schematic|peek|svg|render|draw(?:ing)?|paint|canvas|viewport|wire-visible|wire-stack|placeholder|css|layout|getboundingclientrect/.test(hay)
    ) {
      return 'render';
    }
    if (
      /calcengines|calcmaterials|circuit.?anal|compute(?:circuit|bobbin)|formula|impedance|inductance|resistiv|ρ|rho.?l|ohmpermeter|electrical_?formula|network|dcr|eddy/.test(hay)
    ) {
      return 'calculation';
    }
    if (
      /gate\.js|ui|panel|toolbar|dropdown|settings|status-bar|commands|workspace-page|pointer|keydown|domexception|queryselector/.test(hay)
    ) {
      return 'UI';
    }
    if (/materials\.js|engines\.js|assets\.js/.test(hay)) {
      return 'calculation';
    }
    if (/app\.js/.test(hay)) {
      if (/schematic|peek|svg|wire/.test(hay)) return 'render';
      if (/bobbin|magnet/.test(hay)) return 'electromagnetism';
      return 'UI';
    }
    return 'UI';
  }

  function normalizeError(input, extras) {
    const level = extras?.level || 'error';
    let message = '';
    let stack = '';
    let source = extras?.source || '';

    if (input == null) {
      message = String(extras?.message || 'Unknown error');
    } else if (typeof input === 'string') {
      message = input;
    } else if (input instanceof Error) {
      message = input.message || input.name || String(input);
      stack = input.stack || '';
    } else if (typeof input === 'object') {
      message = String(input.message || input.reason || input.error || input);
      stack = String(input.stack || '');
      if (input.filename) source = String(input.filename);
    } else {
      message = String(input);
    }

    if (extras?.stack && !stack) stack = String(extras.stack);
    if (Array.isArray(extras?.args) && extras.args.length) {
      const rest = extras.args.slice(1).map((a) => {
        try {
          if (a instanceof Error) return a.stack || a.message;
          if (typeof a === 'object') return JSON.stringify(a);
          return String(a);
        } catch (_) {
          return String(a);
        }
      }).filter(Boolean);
      if (rest.length) message = `${message} | ${rest.join(' | ')}`.slice(0, 1200);
      const errArg = extras.args.find((a) => a instanceof Error);
      if (errArg?.stack && !stack) stack = errArg.stack;
    }

    const category = extras?.category && CATEGORIES.includes(extras.category)
      ? extras.category
      : categorize(message, stack, source);

    return {
      message: message || '(empty)',
      stack: stack || '',
      source: source || '',
      category,
      level,
    };
  }

  function capture(input, extras) {
    if (!isCapturing()) return null;
    const norm = normalizeError(input, extras);
    const key = fingerprint(norm.message, norm.stack, norm.source);
    const at = nowIso();
    const existing = entries.get(key);
    if (existing) {
      existing.count += 1;
      existing.lastAt = at;
      if (norm.stack && norm.stack.length > existing.stack.length) {
        existing.stack = norm.stack;
      }
      scheduleTermRender();
      return existing;
    }
    const row = {
      key,
      category: norm.category,
      message: norm.message,
      stack: norm.stack,
      source: norm.source,
      count: 1,
      firstAt: at,
      lastAt: at,
      level: norm.level,
    };
    entries.set(key, row);
    scheduleTermRender();
    return row;
  }

  function formatLine(row) {
    const countTag = row.count >= CONSOLIDATE_AFTER ? `[×${row.count}] ` : '';
    const once = row.count > 1 && row.count < CONSOLIDATE_AFTER
      ? ` (${row.count}×)`
      : '';
    return `- ${countTag}${row.message}${once}`;
  }

  function formatStackBrief(stack) {
    if (!stack) return [];
    return String(stack)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 6)
      .map((l) => `  ${l}`);
  }

  function buildReportText() {
    const byCat = Object.fromEntries(CATEGORIES.map((c) => [c, []]));
    entries.forEach((row) => {
      const cat = byCat[row.category] ? row.category : 'UI';
      byCat[cat].push(row);
    });

    CATEGORIES.forEach((c) => {
      byCat[c].sort((a, b) => b.count - a.count || a.message.localeCompare(b.message));
    });

    const lines = [
      '# Bugtest report',
      '',
      `- Product: ${APP_META.product}`,
      `- Label: ${APP_META.label}`,
      `- Build: ${APP_META.build}`,
      `- Engine: errorreporting`,
      `- Captured: ${nowIso()}`,
      `- Entry count: ${entries.size}`,
      `- Total events: ${[...entries.values()].reduce((n, r) => n + r.count, 0)}`,
      '',
      '## How to use (Cursor)',
      '- Fix by category ownership: calculation → CalcEngines circuit/materials; electromagnetism → bobbin*/EM; render → schematic/peek/SVG; UI → chrome/panels.',
      `- Repeats ≥${CONSOLIDATE_AFTER} are collapsed as \`[×N]\` on one line.`,
      '- Prefer the top stack frames for file:line jumps.',
      '',
    ];

    CATEGORIES.forEach((cat) => {
      const rows = byCat[cat];
      const events = rows.reduce((n, r) => n + r.count, 0);
      lines.push(`## ${cat} (${rows.length} unique / ${events} events)`);
      lines.push('');
      if (!rows.length) {
        lines.push('_None._');
        lines.push('');
        return;
      }
      rows.forEach((row) => {
        lines.push(formatLine(row));
        if (row.source) lines.push(`  source: ${row.source}`);
        lines.push(`  first: ${row.firstAt} · last: ${row.lastAt}`);
        formatStackBrief(row.stack).forEach((s) => lines.push(s));
        lines.push('');
      });
    });

    lines.push('## Raw index (fingerprint)');
    lines.push('');
    entries.forEach((row) => {
      lines.push(`- \`${row.key.slice(0, 120)}\` → ${row.category} ×${row.count}`);
    });
    lines.push('');

    return lines.join('\n');
  }

  /** Round clock to nearest half-hour for the Desktop filename. */
  function closestHalfHourParts(date = new Date()) {
    const d = new Date(date.getTime());
    const totalMins = d.getHours() * 60 + d.getMinutes() + (d.getSeconds() >= 30 ? 1 : 0);
    const rounded = Math.round(totalMins / 30) * 30;
    let mins = ((rounded % (24 * 60)) + (24 * 60)) % (24 * 60);
    return {
      hour: Math.floor(mins / 60),
      minute: mins % 60,
      day: d.getDate(),
      month: MONTH_ABBR[d.getMonth()] || String(d.getMonth() + 1),
    };
  }

  /** e.g. Bugtest-b555-14h30-09-Sep.txt */
  function suggestedFileName(date = new Date()) {
    const p = closestHalfHourParts(date);
    const hh = String(p.hour).padStart(2, '0');
    const mm = String(p.minute).padStart(2, '0');
    const dd = String(p.day).padStart(2, '0');
    return `Bugtest-b${APP_META.build}-${hh}h${mm}-${dd}-${p.month}.txt`;
  }

  function setStatus(msg) {
    if (typeof global.setStatus === 'function') {
      try { global.setStatus(msg); } catch (_) { /* ignore */ }
      return;
    }
    const el = document.getElementById('status-text');
    if (el) el.textContent = msg;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function termLogEl() {
    return document.querySelector('[data-bugtest-term-log]');
  }

  function termPanelEl() {
    return document.querySelector('[data-bugtest-term]');
  }

  function renderTerm() {
    const log = termLogEl();
    if (!log) return;
    if (!entries.size) {
      log.innerHTML = '<p class="bugtest-term__empty">No errors yet.</p>';
      return;
    }
    const rows = [...entries.values()].sort((a, b) => {
      if (a.lastAt === b.lastAt) return b.count - a.count;
      return a.lastAt < b.lastAt ? 1 : -1;
    });
    const html = rows.slice(0, 80).map((row) => {
      const count = row.count >= CONSOLIDATE_AFTER
        ? `<span class="bugtest-term__count">[×${row.count}]</span> `
        : row.count > 1
          ? `<span class="bugtest-term__count">(${row.count}×)</span> `
          : '';
      return [
        '<p class="bugtest-term__line">',
        `<span class="bugtest-term__cat">${escapeHtml(row.category)}</span> `,
        count,
        `<span class="bugtest-term__msg">${escapeHtml(row.message)}</span>`,
        '</p>',
      ].join('');
    }).join('');
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 28;
    log.innerHTML = html;
    if (nearBottom) log.scrollTop = log.scrollHeight;
  }

  function scheduleTermRender() {
    if (!termOpen) return;
    if (termRenderRaf) return;
    termRenderRaf = requestAnimationFrame(() => {
      termRenderRaf = 0;
      renderTerm();
    });
  }

  function setTermOpen(open) {
    termOpen = !!open;
    const panel = termPanelEl();
    if (panel) {
      panel.classList.toggle('hidden', !termOpen);
      if (termOpen) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    }
    if (termOpen) {
      installHooks();
      renderTerm();
    }
    syncBadges();
  }

  function toggleTerm() {
    setTermOpen(!termOpen);
  }

  function isTypingContext() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      if (el.closest?.('[hidden], .hidden')) return false;
      return true;
    }
    return !!el.isContentEditable;
  }

  function syncBadges() {
    document.querySelectorAll('[data-bugtest-badge]').forEach((el) => {
      const title = el.querySelector('[data-bugtest-title]');
      const build = el.querySelector('[data-bugtest-build]');
      if (title) title.textContent = APP_META.label;
      if (build) build.textContent = String(APP_META.build);
      el.dataset.mode = mode;
      el.classList.toggle('is-recording', mode === MODE.recording);
      el.classList.remove('is-save-as');
      const tip = mode === MODE.idle
        ? 'Bugtest — click to record · ` terminal'
        : 'Recording — click to save on Desktop · ` terminal';
      el.setAttribute('title', tip);
      el.setAttribute('aria-label', tip);
    });
  }

  function installHooks() {
    if (hooked) return;
    hooked = true;
    origConsoleError = console.error.bind(console);
    console.error = function bugtestConsoleError(...args) {
      try {
        capture(args[0], { level: 'error', args });
      } catch (_) { /* never break logging */ }
      return origConsoleError(...args);
    };
    global.addEventListener('error', (ev) => {
      capture(ev.error || ev.message, {
        level: 'error',
        source: ev.filename ? `${ev.filename}:${ev.lineno || 0}:${ev.colno || 0}` : '',
        stack: ev.error?.stack,
        message: ev.message,
      });
    });
    global.addEventListener('unhandledrejection', (ev) => {
      capture(ev.reason, { level: 'unhandledrejection' });
    });
  }

  function bindKeyHooks() {
    if (keyHooksBound) return;
    keyHooksBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingContext()) return;
      const isTick = e.key === '`' || e.code === 'Backquote';
      if (!isTick) {
        if (termOpen && e.key === 'Escape') {
          e.preventDefault();
          setTermOpen(false);
        }
        return;
      }
      e.preventDefault();
      toggleTerm();
    }, true);
  }

  function waitForPywebviewApi(timeoutMs = 2500) {
    return new Promise((resolve) => {
      const api = global.pywebview?.api;
      if (api && typeof api.save_text_to_desktop === 'function') {
        resolve(api);
        return;
      }
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        global.removeEventListener('pywebviewready', onReady);
        resolve(value);
      };
      const onReady = () => finish(global.pywebview?.api || null);
      global.addEventListener('pywebviewready', onReady);
      window.setTimeout(() => finish(global.pywebview?.api || null), timeoutMs);
    });
  }

  async function writeTextToDesktop(name, text) {
    const api = await waitForPywebviewApi();
    if (api && typeof api.save_text_to_desktop === 'function') {
      const path = await api.save_text_to_desktop(name, text);
      return { ok: true, path: String(path || name), via: 'desktop' };
    }
    // Browser fallback — Downloads (cannot force Desktop without native bridge)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true, path: name, via: 'download' };
  }

  async function stopAndSave(opts = {}) {
    if (mode !== MODE.recording) return false;
    if (saveInFlight) return false;
    saveInFlight = true;
    const quiet = !!opts.quiet;
    const name = suggestedFileName();
    const text = buildReportText();
    mode = MODE.idle;
    syncBadges();
    try {
      const result = await writeTextToDesktop(name, text);
      entries.clear();
      if (!quiet) {
        if (result.via === 'desktop') setStatus(`Bugtest saved to Desktop · ${name}`);
        else setStatus(`Bugtest saved · ${name}`);
      }
      return true;
    } catch (err) {
      mode = MODE.recording;
      syncBadges();
      if (!quiet) setStatus('Bugtest — Desktop save failed');
      if (origConsoleError) origConsoleError(err);
      return false;
    } finally {
      saveInFlight = false;
    }
  }

  function bindLeaveHooks() {
    if (leaveHooksBound) return;
    leaveHooksBound = true;
    const flush = () => {
      if (mode !== MODE.recording) return;
      void stopAndSave({ quiet: true });
    };
    // App close / navigate away — not mere tab blur
    global.addEventListener('pagehide', flush);
    global.addEventListener('beforeunload', flush);
  }

  async function onBadgeActivate(ev) {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();

    if (mode === MODE.idle) {
      mode = MODE.recording;
      installHooks();
      bindLeaveHooks();
      syncBadges();
      return;
    }

    await stopAndSave();
  }

  function bindBadges() {
    document.querySelectorAll('[data-bugtest-badge]').forEach((el) => {
      if (el.dataset.bugtestBound === '1') return;
      el.dataset.bugtestBound = '1';
      el.addEventListener('click', onBadgeActivate);
    });
    const term = termPanelEl();
    if (term && term.dataset.bugtestTermBound !== '1') {
      term.dataset.bugtestTermBound = '1';
      term.addEventListener('mousedown', (e) => e.stopPropagation());
      term.addEventListener('click', (e) => e.stopPropagation());
    }
    syncBadges();
    bindLeaveHooks();
    bindKeyHooks();
  }

  function getState() {
    return {
      mode,
      termOpen,
      build: APP_META.build,
      label: APP_META.label,
      entryCount: entries.size,
      totalEvents: [...entries.values()].reduce((n, r) => n + r.count, 0),
    };
  }

  const api = Object.freeze({
    id: 'errorreporting',
    APP_META,
    CATEGORIES,
    CONSOLIDATE_AFTER,
    MODE,
    capture,
    categorize,
    buildReportText,
    suggestedFileName,
    bindBadges,
    syncBadges,
    getState,
    stopAndSave,
    setTermOpen,
    toggleTerm,
    startRecording() {
      mode = MODE.recording;
      installHooks();
      bindLeaveHooks();
      syncBadges();
    },
  });

  global.ErrorReporting = api;
  global.APP_META = APP_META;

  if (global.CalcEngines && typeof global.CalcEngines === 'object') {
    try {
      Object.defineProperty(global.CalcEngines, 'ERRORREPORTING', {
        value: 'errorreporting',
        enumerable: true,
        configurable: false,
      });
    } catch (_) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindBadges);
  } else {
    bindBadges();
  }
})(typeof window !== 'undefined' ? window : globalThis);
