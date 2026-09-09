/**
 * Temporary unlock gate — self-contained overlay; never wraps or transforms editor UI.
 * Remove gate.js / gate.css / #app-gate markup when the gate is retired.
 */
(function () {
  'use strict';

  const UNLOCK_KEY = 'endo-asd-temp-unlocked';
  const PASSWORD = 'froge';

  const gate = document.getElementById('app-gate');
  const unveil = document.getElementById('app-gate-unveil');
  const gateStyle = document.getElementById('app-gate-style');

  if (!gate) return;

  function destroyGate() {
    document.body.classList.remove('is-app-gated');
    gate.remove();
    unveil?.remove();
    gateStyle?.remove();
  }

  try {
    const unlocked = sessionStorage.getItem(UNLOCK_KEY) === '1'
      || sessionStorage.getItem('gwv-temp-unlocked') === '1';
    if (unlocked) {
      try { sessionStorage.setItem(UNLOCK_KEY, '1'); } catch (_) { /* ignore */ }
      destroyGate();
      return;
    }
  } catch (_) { /* ignore */ }

  const form = document.getElementById('app-gate-form');
  const input = document.getElementById('app-gate-input');
  const maskEl = document.getElementById('app-gate-mask');
  const errorEl = document.getElementById('app-gate-error');
  const spinner = document.getElementById('app-gate-spinner');
  const logo = document.getElementById('app-gate-logo');
  if (!form || !input) return;

  let unlocking = false;

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function syncTerminalMask() {
    if (!maskEl) return;
    const n = String(input.value || '').length;
    maskEl.textContent = n ? '•'.repeat(n) : '';
  }

  function showError() {
    if (!errorEl) return;
    errorEl.hidden = false;
    errorEl.classList.remove('is-wiggle');
    void errorEl.offsetWidth;
    errorEl.classList.add('is-wiggle');
    const onEnd = () => {
      errorEl.classList.remove('is-wiggle');
      errorEl.removeEventListener('animationend', onEnd);
    };
    errorEl.addEventListener('animationend', onEnd);
  }

  async function playUnlockUnveil() {
    if (!unveil) {
      destroyGate();
      return;
    }

    unveil.hidden = false;
    unveil.removeAttribute('aria-hidden');
    unveil.classList.remove('is-clearing', 'is-welcome-done');

    gate.classList.add('is-unlocking');
    await delay(480);
    gate.style.display = 'none';

    await delay(100);
    unveil.classList.add('is-clearing');
    await delay(900);
    destroyGate();
  }

  document.body.classList.add('is-app-gated');
  syncTerminalMask();

  const bubbles = gate.querySelectorAll('.app-gate__blob');
  logo?.addEventListener('click', (e) => {
    e.preventDefault();
    bubbles.forEach((bubble) => {
      const hue = Math.floor(Math.random() * 360);
      const saturation = 35 + Math.floor(Math.random() * 35);
      const lightness = 28 + Math.floor(Math.random() * 22);
      bubble.style.backgroundColor = `hsl(${hue} ${saturation}% ${lightness}%)`;
    });
  });

  function unlock() {
    if (unlocking) return;
    unlocking = true;
    input.disabled = true;
    if (errorEl) errorEl.hidden = true;
    if (spinner) {
      spinner.hidden = false;
      spinner.removeAttribute('aria-hidden');
    }
    try {
      sessionStorage.setItem(UNLOCK_KEY, '1');
    } catch (_) { /* ignore */ }
    window.setTimeout(() => {
      playUnlockUnveil().catch(destroyGate);
    }, 560);
  }

  input.addEventListener('input', syncTerminalMask);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (unlocking) return;
    if (String(input.value || '') === PASSWORD) {
      unlock();
      return;
    }
    showError();
    input.select();
    syncTerminalMask();
  });

  window.setTimeout(() => input.focus(), 40);

  document.addEventListener('keydown', (e) => {
    if (!document.body.classList.contains('is-app-gated')) return;
    if (unlocking) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      input.focus();
    }
  }, true);

  // ── Check update (git remote / archive) ─────────────────────────────
  const checkBtn = document.getElementById('app-gate-check-update');
  const updateStatus = document.getElementById('app-gate-update-status');

  function setUpdateStatus(text, kind) {
    if (!updateStatus) return;
    const msg = String(text || '').trim();
    if (!msg) {
      updateStatus.hidden = true;
      updateStatus.textContent = '';
      updateStatus.classList.remove('is-error', 'is-ok', 'is-busy');
      return;
    }
    updateStatus.hidden = false;
    updateStatus.textContent = msg;
    updateStatus.classList.toggle('is-error', kind === 'error');
    updateStatus.classList.toggle('is-ok', kind === 'ok');
    updateStatus.classList.toggle('is-busy', kind === 'busy');
  }

  function syncGateBuildBadge(build) {
    if (build == null || !Number.isFinite(Number(build))) return;
    gate.querySelectorAll('[data-bugtest-build]').forEach((el) => {
      el.textContent = String(build);
    });
  }

  async function callUpdateApi(action) {
    // Prefer pywebview bridge (desktop); fall back to local HTTP endpoints.
    try {
      const api = window.pywebview?.api;
      if (api && typeof api[action] === 'function') {
        const result = await api[action]();
        return result || {};
      }
    } catch (_) { /* use HTTP */ }
    const path = action === 'install_update'
      ? '/__endo/update/install'
      : '/__endo/update/check';
    const res = await fetch(path, {
      method: action === 'install_update' ? 'POST' : 'GET',
      cache: 'no-store',
    });
    return res.json();
  }

  async function onCheckUpdate() {
    if (!checkBtn || checkBtn.disabled) return;
    checkBtn.disabled = true;
    setUpdateStatus('Checking remote…', 'busy');
    try {
      const check = await callUpdateApi('check_for_update');
      if (!check || check.ok === false) {
        setUpdateStatus(check?.message || 'Update check failed', 'error');
        return;
      }
      syncGateBuildBadge(check.localBuild);
      if (!check.needsUpdate) {
        setUpdateStatus(check.message || 'Up to date', 'ok');
        return;
      }
      setUpdateStatus(`${check.message}\nInstalling…`, 'busy');
      const install = await callUpdateApi('install_update');
      if (!install || install.ok === false) {
        setUpdateStatus(install?.message || 'Install failed', 'error');
        return;
      }
      syncGateBuildBadge(install.localBuild ?? check.remoteBuild);
      const restart = install.restartRequired
        ? '\nRestart the app to load the new build.'
        : '';
      setUpdateStatus((install.message || 'Updated') + restart, 'ok');
    } catch (err) {
      setUpdateStatus(err?.message || String(err) || 'Update failed', 'error');
    } finally {
      checkBtn.disabled = false;
    }
  }

  checkBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onCheckUpdate();
  });
}());
