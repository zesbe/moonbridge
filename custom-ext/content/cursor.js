// Content script: visual indicators on the page during agent runs.
// - Phantom cursor (orange agent-style arrow) that flies to targets
// - Orange glow border around viewport
// - Floating "Stop agent" pill at bottom
// - Element highlight ring + click pulse
// - Toast messages
//
// Listens to chrome.runtime messages from the sidepanel:
//   CC_SHOW           - show glow + stop button
//   CC_HIDE           - hide all
//   CC_CURSOR {x, y}  - animate cursor to position
//   CC_PULSE {x, y}   - click pulse animation
//   CC_HIGHLIGHT {sel}- ring around element (by selector)
//   CC_UNHIGHLIGHT
//   CC_TOAST {text}   - transient toast
//   CC_PING           - heartbeat
//
// Sends:
//   CC_STOP_REQUESTED - user clicked the stop pill

(() => {
  if (window.__cc_indicator_loaded__) return;
  window.__cc_indicator_loaded__ = true;

  const Z = 2147483646;
  const ACCENT = '#D97757';
  const ACCENT_BG = '#FAF9F5';

  let glowEl = null;
  let stopEl = null;
  let cursorEl = null;
  let highlightEl = null;
  let toastEl = null;
  let toastTimer = null;
  let lastX = null, lastY = null;
  let active = false;

  function injectStyles() {
    if (document.getElementById('cc-styles')) return;
    const s = document.createElement('style');
    s.id = 'cc-styles';
    s.textContent = `
      @keyframes cc-pulse {
        0% { opacity: 0.85; transform: translate3d(var(--x), var(--y), 0) scale(0.5); }
        100% { opacity: 0; transform: translate3d(var(--x), var(--y), 0) scale(2.4); }
      }
      @keyframes cc-glow {
        0%, 100% { opacity: 0.55; }
        50% { opacity: 1; }
      }
      @keyframes cc-toast-in {
        from { opacity: 0; transform: translate(-50%, 8px); }
        to   { opacity: 1; transform: translate(-50%, 0); }
      }
      #cc-glow-inner { animation: cc-glow 2s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        #cc-glow-inner { animation: none; }
      }
    `;
    document.documentElement.appendChild(s);
  }

  function ensureGlow() {
    if (glowEl) return;
    glowEl = document.createElement('div');
    glowEl.id = 'cc-glow';
    glowEl.setAttribute('aria-hidden', 'true');
    glowEl.style.cssText = `
      position: fixed; inset: 0;
      pointer-events: none; z-index: ${Z};
      opacity: 0; transition: opacity .3s ease;
    `;
    const inner = document.createElement('div');
    inner.id = 'cc-glow-inner';
    inner.style.cssText = `
      position: absolute; inset: 0;
      box-shadow:
        inset 0 0 14px rgba(217,119,87,0.65),
        inset 0 0 26px rgba(217,119,87,0.4),
        inset 0 0 42px rgba(217,119,87,0.18);
    `;
    glowEl.appendChild(inner);
    document.body.appendChild(glowEl);
  }

  function ensureStop() {
    if (stopEl) return;
    stopEl = document.createElement('div');
    stopEl.id = 'cc-stop-wrap';
    stopEl.setAttribute('aria-hidden', 'true');
    stopEl.style.cssText = `
      position: fixed; bottom: 16px; left: 50%;
      transform: translateX(-50%);
      pointer-events: none; z-index: ${Z + 1};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    `;
    const btn = document.createElement('button');
    btn.id = 'cc-stop';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right:8px;vertical-align:middle"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
      <span style="vertical-align:middle">Stop agent</span>
    `;
    btn.style.cssText = `
      pointer-events: auto;
      padding: 9px 14px;
      background: ${ACCENT_BG}; color: #141413;
      border: 0.5px solid rgba(31,30,29,.4);
      border-radius: 12px;
      font-weight: 600; font-size: 13px;
      cursor: pointer;
      box-shadow: 0 24px 48px rgba(217,119,87,0.24), 0 4px 14px rgba(217,119,87,0.18);
      transform: translateY(80px); opacity: 0;
      transition: transform .3s cubic-bezier(.4,0,.2,1), opacity .3s;
      display: inline-flex; align-items: center; user-select: none;
    `;
    btn.addEventListener('click', () => {
      try { chrome.runtime.sendMessage({ type: 'CC_STOP_REQUESTED' }); } catch {}
    });
    btn.addEventListener('mouseenter', () => { btn.style.background = '#F0EEE6'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = ACCENT_BG; });
    stopEl.appendChild(btn);
    document.body.appendChild(stopEl);
  }

  function ensureCursor() {
    if (cursorEl) return;
    cursorEl = document.createElement('div');
    cursorEl.id = 'cc-cursor';
    cursorEl.setAttribute('aria-hidden', 'true');
    cursorEl.style.cssText = `
      position: fixed; top: 0; left: 0;
      pointer-events: none; z-index: ${Z + 2};
      transform: translate3d(50vw, 50vh, 0);
      transition: transform 320ms cubic-bezier(.2,0,0,1);
      will-change: transform;
    `;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '28');
    svg.setAttribute('viewBox', '0 0 20 26');
    svg.style.cssText = 'overflow:visible; filter: drop-shadow(0 0 4px rgba(217,119,87,.9)) drop-shadow(0 0 10px rgba(217,119,87,.5));';

    const path = (attrs) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M0 0 L0 18 L4.5 14 L7.5 21.5 L11 20 L8 13 L14 13 Z');
      for (const [k, v] of Object.entries(attrs)) p.setAttribute(k, v);
      return p;
    };
    svg.appendChild(path({ stroke: ACCENT, 'stroke-width': '3', 'stroke-linejoin': 'round', fill: ACCENT }));
    svg.appendChild(path({ fill: ACCENT_BG }));
    cursorEl.appendChild(svg);
    document.body.appendChild(cursorEl);
  }

  function moveCursor(x, y) {
    ensureCursor();
    lastX = x; lastY = y;
    cursorEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function pulseAt(x, y) {
    const dot = document.createElement('div');
    dot.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: 36px; height: 36px;
      margin-left: -18px; margin-top: -18px;
      border: 3px solid ${ACCENT};
      border-radius: 50%;
      pointer-events: none; z-index: ${Z + 1};
      --x: ${x}px; --y: ${y}px;
      animation: cc-pulse 480ms ease-out forwards;
    `;
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 520);
  }

  function highlight(selector) {
    unhighlight();
    let el = null;
    const m = selector?.match?.(/^#ref-(\d+)$/);
    if (m && window.__claudeRefs__) el = window.__claudeRefs__[parseInt(m[1], 10)];
    if (!el && selector) { try { el = document.querySelector(selector); } catch {} }
    if (!el || !el.getBoundingClientRect) return null;
    const r = el.getBoundingClientRect();

    highlightEl = document.createElement('div');
    highlightEl.id = 'cc-highlight';
    highlightEl.setAttribute('aria-hidden', 'true');
    highlightEl.style.cssText = `
      position: fixed; pointer-events: none;
      top: ${r.top - 4}px; left: ${r.left - 4}px;
      width: ${r.width + 8}px; height: ${r.height + 8}px;
      border: 2px solid ${ACCENT};
      border-radius: 6px;
      box-shadow: 0 0 0 3px rgba(217,119,87,.25), 0 0 18px rgba(217,119,87,.45);
      z-index: ${Z};
      transition: opacity .2s;
    `;
    document.body.appendChild(highlightEl);
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function unhighlight() {
    if (highlightEl) {
      highlightEl.remove();
      highlightEl = null;
    }
  }

  function showToast(text) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'cc-toast';
      toastEl.style.cssText = `
        position: fixed; top: 16px; left: 50%;
        transform: translateX(-50%);
        background: rgba(20,20,19,.94); color: #FAF9F5;
        padding: 8px 14px; border-radius: 10px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        font-size: 12.5px; font-weight: 500;
        z-index: ${Z + 3};
        pointer-events: none;
        box-shadow: 0 8px 24px rgba(0,0,0,.25);
        animation: cc-toast-in .2s ease;
        max-width: 80vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      `;
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toastEl) toastEl.style.opacity = '0';
    }, 1800);
  }

  function show() {
    active = true;
    injectStyles();
    ensureGlow();
    ensureStop();
    ensureCursor();
    requestAnimationFrame(() => {
      glowEl.style.opacity = '1';
      const btn = stopEl.querySelector('#cc-stop');
      btn.style.transform = 'translateY(0)';
      btn.style.opacity = '1';
    });
  }

  function hide() {
    active = false;
    if (glowEl) glowEl.style.opacity = '0';
    if (stopEl) {
      const btn = stopEl.querySelector('#cc-stop');
      if (btn) { btn.style.transform = 'translateY(80px)'; btn.style.opacity = '0'; }
    }
    unhighlight();
    setTimeout(() => {
      if (active) return;
      glowEl?.remove(); glowEl = null;
      stopEl?.remove(); stopEl = null;
      cursorEl?.remove(); cursorEl = null;
      toastEl?.remove(); toastEl = null;
    }, 320);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      switch (msg?.type) {
        case 'CC_SHOW': show(); sendResponse({ ok: true }); break;
        case 'CC_HIDE': hide(); sendResponse({ ok: true }); break;
        case 'CC_CURSOR': moveCursor(msg.x, msg.y); sendResponse({ ok: true }); break;
        case 'CC_PULSE': pulseAt(msg.x, msg.y); sendResponse({ ok: true }); break;
        case 'CC_HIGHLIGHT': {
          const c = highlight(msg.selector);
          sendResponse({ ok: true, center: c });
          break;
        }
        case 'CC_UNHIGHLIGHT': unhighlight(); sendResponse({ ok: true }); break;
        case 'CC_TOAST': showToast(msg.text || ''); sendResponse({ ok: true }); break;
        case 'CC_PING': sendResponse({ ok: true, active }); break;
        default: return; // not for us
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
    return true;
  });
})();
