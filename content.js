(() => {
  const LOG_PREFIX = '[TabSearch]';
  const DEFAULT_SETTINGS = {
    mode: 'doubleTapModifier',
    modifier: 'Alt',
    triggerKey: 'Space',
    doubleTapInterval: 400,
  };

  // Migrate old settings format ('altKey' → 'Alt')
  const MIGRATE_MAP = {
    altKey: 'Alt',
    metaKey: 'Meta',
    ctrlKey: 'Control',
    shiftKey: 'Shift',
  };

  let settings = { ...DEFAULT_SETTINGS };
  let lastTapTime = 0;
  let overlayVisible = false;
  let modifierWasClean = false;

  console.log(LOG_PREFIX, 'content script loaded on', location.href);

  chrome.storage.sync.get('shortcutSettings', (result) => {
    if (result.shortcutSettings) {
      const s = result.shortcutSettings;
      // Migrate old format
      if (MIGRATE_MAP[s.modifier]) {
        s.modifier = MIGRATE_MAP[s.modifier];
      }
      if (!s.mode) {
        s.mode = DEFAULT_SETTINGS.mode;
      }
      Object.assign(settings, s);
    }
    console.log(LOG_PREFIX, 'settings loaded:', JSON.stringify(settings));
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.shortcutSettings) {
      const s = changes.shortcutSettings.newValue;
      if (MIGRATE_MAP[s.modifier]) s.modifier = MIGRATE_MAP[s.modifier];
      if (!s.mode) s.mode = DEFAULT_SETTINGS.mode;
      Object.assign(settings, s);
      console.log(LOG_PREFIX, 'settings updated:', JSON.stringify(settings));
    }
  });

  // --- Double-tap modifier detection (keyup based) ---

  document.addEventListener('keydown', (e) => {
    if (settings.mode === 'doubleTapModifier') {
      if (e.key === settings.modifier) {
        modifierWasClean = true;
      } else {
        modifierWasClean = false;
      }
    }
    if (settings.mode === 'modifierPlusTrigger') {
      handleModifierPlusTrigger(e);
    }
  }, true);

  document.addEventListener('keyup', (e) => {
    if (settings.mode !== 'doubleTapModifier') return;
    if (e.key !== settings.modifier) return;
    if (!modifierWasClean) return;

    const now = Date.now();
    console.log(LOG_PREFIX, 'modifier keyup detected, gap:', now - lastTapTime, 'ms');
    if (now - lastTapTime < settings.doubleTapInterval) {
      lastTapTime = 0;
      console.log(LOG_PREFIX, 'double-tap triggered!');
      toggleOverlay();
    } else {
      lastTapTime = now;
    }
  }, true);

  // --- Modifier + double-tap trigger ---

  function handleModifierPlusTrigger(e) {
    const modProp = settings.modifier.toLowerCase() + 'Key';
    if (e.code === settings.triggerKey && e[modProp]) {
      const now = Date.now();
      if (now - lastTapTime < settings.doubleTapInterval) {
        e.preventDefault();
        e.stopPropagation();
        lastTapTime = 0;
        toggleOverlay();
      } else {
        lastTapTime = now;
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }

  // --- Overlay ---

  function toggleOverlay() {
    overlayVisible ? removeOverlay() : createOverlay();
  }

  function createOverlay() {
    if (document.getElementById('tab-search-overlay')) return;

    // Use shadow DOM to avoid CSP issues and page style interference
    const host = document.createElement('div');
    host.id = 'tab-search-overlay';
    const shadow = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      .backdrop {
        position: fixed; top: 0; left: 0;
        width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.4);
        z-index: 2147483647;
        display: flex; justify-content: center; align-items: flex-start;
        padding-top: 15vh;
      }
      iframe {
        width: 460px; height: 520px;
        border: none; border-radius: 12px;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
        background: #fff;
      }
    `;

    const backdrop = document.createElement('div');
    backdrop.className = 'backdrop';

    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('popup.html') + '?overlay=1';
    iframe.allow = '';

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) removeOverlay();
    });

    backdrop.appendChild(iframe);
    shadow.appendChild(style);
    shadow.appendChild(backdrop);
    document.documentElement.appendChild(host);
    overlayVisible = true;
    console.log(LOG_PREFIX, 'overlay created');

    // Fallback: if iframe fails to load (CSP), send message to background to open popup
    iframe.addEventListener('error', () => {
      console.warn(LOG_PREFIX, 'iframe blocked by CSP, falling back to messaging');
      removeOverlay();
      chrome.runtime.sendMessage({ action: 'openPopup' });
    });
  }

  function removeOverlay() {
    const el = document.getElementById('tab-search-overlay');
    if (el) el.remove();
    overlayVisible = false;
  }

  window.addEventListener('message', (e) => {
    if (e.data === 'tab-search-close') removeOverlay();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlayVisible) removeOverlay();
  }, true);
})();
