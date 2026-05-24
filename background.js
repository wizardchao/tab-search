const STORAGE_KEY = 'tab_last_activated';

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { tabId } = activeInfo;
  try {
    const data = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {};
    data[tabId] = Date.now();
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
  } catch (e) {
    // Tab may have been closed before storage write
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const data = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {};
    delete data[tabId];
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
  } catch (e) {
    // Ignore cleanup errors
  }
});

// Migrate old shortcut settings on install/update
chrome.runtime.onInstalled.addListener(() => {
  const MIGRATE_MAP = { altKey: 'Alt', metaKey: 'Meta', ctrlKey: 'Control', shiftKey: 'Shift' };
  chrome.storage.sync.get('shortcutSettings', (result) => {
    if (result.shortcutSettings) {
      const s = result.shortcutSettings;
      let changed = false;
      if (MIGRATE_MAP[s.modifier]) { s.modifier = MIGRATE_MAP[s.modifier]; changed = true; }
      if (!s.mode) { s.mode = 'doubleTapModifier'; changed = true; }
      if (changed) chrome.storage.sync.set({ shortcutSettings: s });
    }
  });
});

// Fallback: open popup when content script can't create overlay (CSP)
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === 'openPopup') {
    chrome.action.openPopup().catch(() => {
      // openPopup may fail without user gesture, fallback: focus the tab
      if (sender.tab) {
        chrome.tabs.update(sender.tab.id, { active: true });
      }
    });
  }
});
