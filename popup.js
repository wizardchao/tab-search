const STORAGE_KEY = 'tab_last_activated';
const DISMISSED_KEY = 'tab_dismissed_closed';
const MAX_CLOSED = 5;
const SIMILARITY_WEIGHT = 0.7;
const RECENCY_WEIGHT = 0.3;
const DEBOUNCE_MS = 150;
const IS_OVERLAY = new URLSearchParams(location.search).has('overlay');

let allTabs = [];
let activationTimes = {};
let dismissedClosed = new Set();
let selectedIndex = 0;
let filteredTabs = [];
let debounceTimer = null;

const searchInput = document.getElementById('search-input');
const tabList = document.getElementById('tab-list');
const tabCount = document.getElementById('tab-count');
const emptyState = document.getElementById('empty-state');
const clearBtn = document.getElementById('clear-btn');
const closeBtn = document.getElementById('close-btn');

async function fetchClosedTabs() {
  const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 });
  return sessions
    .filter(s => s.tab && s.tab.url && !s.tab.url.startsWith('chrome://') && !dismissedClosed.has(s.tab.sessionId))
    .map(s => ({
      id: `closed_${s.tab.sessionId}`,
      windowId: s.tab.windowId || 0,
      title: s.tab.title || '',
      url: s.tab.url,
      favIconUrl: s.tab.favIconUrl || '',
      closed: true,
      sessionId: s.tab.sessionId,
      lastModified: (s.lastModified || 0) * 1000,
    }));
}

function deduplicateTabs(openTabs, closedTabs) {
  const openUrls = new Set(openTabs.map(t => t.url));
  const filteredClosed = closedTabs
    .filter(t => !openUrls.has(t.url))
    .sort((a, b) => b.lastModified - a.lastModified)
    .slice(0, MAX_CLOSED);
  const sortedOpen = [...openTabs].sort((a, b) => (activationTimes[b.id] || 0) - (activationTimes[a.id] || 0));
  return [...sortedOpen, ...filteredClosed];
}

async function init() {
  const [tabs, stored, dismissed] = await Promise.all([
    chrome.tabs.query({}),
    chrome.storage.local.get(STORAGE_KEY),
    chrome.storage.local.get(DISMISSED_KEY),
  ]);
  activationTimes = stored[STORAGE_KEY] || {};
  dismissedClosed = new Set(dismissed[DISMISSED_KEY] || []);
  const closedTabs = await fetchClosedTabs();
  allTabs = deduplicateTabs(tabs, closedTabs);
  tabCount.textContent = `${tabs.length} tabs`;
  renderTabs(allTabs);
}

// --- Fuzzy matching & scoring ---

function computeSimilarity(query, text) {
  if (!query || !text) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // Exact substring match gets high score
  const idx = t.indexOf(q);
  if (idx !== -1) {
    // Bonus for matching at word boundary or start
    const posBonus = idx === 0 ? 0.3 : t[idx - 1] === ' ' || t[idx - 1] === '/' ? 0.15 : 0;
    return 0.7 + posBonus;
  }

  // Character-by-character fuzzy match
  let qi = 0;
  let consecutive = 0;
  let maxConsecutive = 0;
  let matchCount = 0;
  let lastMatchIdx = -2;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      matchCount++;
      consecutive = (ti === lastMatchIdx + 1) ? consecutive + 1 : 1;
      maxConsecutive = Math.max(maxConsecutive, consecutive);
      lastMatchIdx = ti;
      qi++;
    }
  }

  if (qi < q.length) return 0; // Not all chars matched

  const coverage = matchCount / q.length;
  const density = matchCount / t.length;
  const consecutiveBonus = maxConsecutive / q.length;

  return (coverage * 0.3 + density * 0.2 + consecutiveBonus * 0.5) * 0.65;
}

function scoreTab(tab, query) {
  const recency = tab.closed ? (tab.lastModified || 0) : (activationTimes[tab.id] || 0);
  const openBoost = tab.closed ? 0 : 1e15; // Open tabs always rank above closed
  if (!query) {
    return openBoost + recency;
  }
  const titleScore = computeSimilarity(query, tab.title);
  const urlScore = computeSimilarity(query, tab.url) * 0.8;
  const similarity = Math.max(titleScore, urlScore);
  return openBoost + SIMILARITY_WEIGHT * similarity + RECENCY_WEIGHT * recency;
}

function getRecencyScore(tabId) {
  const ts = activationTimes[tabId];
  if (!ts) return 0;
  const age = Date.now() - ts;
  // Decay: tabs accessed in last 5 min get ~1.0, 1 hour gets ~0.5, 1 day gets ~0.1
  return Math.max(0, 1 - Math.log10(1 + age / 60000) / 3.5);
}

// --- Highlight matched characters ---

function highlightMatch(text, query) {
  if (!query || !text) return escapeHtml(text || '');
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // Try substring match first
  const idx = t.indexOf(q);
  if (idx !== -1) {
    return escapeHtml(text.slice(0, idx)) +
      '<mark>' + escapeHtml(text.slice(idx, idx + query.length)) + '</mark>' +
      escapeHtml(text.slice(idx + query.length));
  }

  // Fuzzy highlight
  let result = '';
  let qi = 0;
  for (let i = 0; i < text.length; i++) {
    if (qi < q.length && t[i] === q[qi]) {
      result += '<mark>' + escapeHtml(text[i]) + '</mark>';
      qi++;
    } else {
      result += escapeHtml(text[i]);
    }
  }
  return result;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Rendering ---

function renderTabs(tabs) {
  filteredTabs = tabs;
  selectedIndex = 0;

  if (tabs.length === 0) {
    tabList.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  const query = searchInput.value.trim();
  const fragment = document.createDocumentFragment();

  // Track window IDs for multi-window badge (open tabs only)
  const windowIds = new Set(allTabs.filter(t => !t.closed).map(t => t.windowId));
  const showWindowBadge = windowIds.size > 1;

  tabs.forEach((tab, i) => {
    const li = document.createElement('li');
    li.className = 'tab-item' + (i === 0 ? ' selected' : '') + (tab.closed ? ' tab-closed' : '');
    li.dataset.index = i;

    const favicon = tab.favIconUrl && tab.favIconUrl.startsWith('http')
      ? `<img class="tab-favicon" src="${escapeHtml(tab.favIconUrl)}" alt="">`
      : `<svg class="tab-favicon" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="2" fill="#e5e7eb"/><text x="8" y="12" text-anchor="middle" font-size="10" fill="#6b7280">T</text></svg>`;

    const closedBadge = tab.closed
      ? `<span class="tab-closed-badge">Closed</span>`
      : '';

    const deleteBtn = tab.closed
      ? `<button type="button" class="tab-delete-btn" title="Remove from list">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>`
      : '';

    const windowBadge = showWindowBadge && !tab.closed
      ? `<span class="tab-window-badge">W${Array.from(windowIds).indexOf(tab.windowId) + 1}</span>`
      : '';

    li.innerHTML = `
      ${favicon}
      <div class="tab-info">
        <div class="tab-title">${highlightMatch(tab.title || 'Untitled', query)}</div>
        <div class="tab-url">${highlightMatch(tab.url || '', query)}</div>
      </div>
      ${closedBadge}${windowBadge}${deleteBtn}
    `;

    li.addEventListener('click', (e) => {
      if (e.target.closest('.tab-delete-btn')) {
        e.stopPropagation();
        dismissClosedTab(tab);
        return;
      }
      switchToTab(tab);
    });
    li.addEventListener('mouseenter', () => {
      selectedIndex = i;
      updateSelection();
    });

    fragment.appendChild(li);
  });

  tabList.innerHTML = '';
  tabList.appendChild(fragment);
}

function updateSelection() {
  const items = tabList.querySelectorAll('.tab-item');
  items.forEach((item, i) => {
    item.classList.toggle('selected', i === selectedIndex);
  });
  // Scroll selected item into view
  items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
}

// --- Tab switching ---

function closePopup() {
  if (IS_OVERLAY) {
    window.parent.postMessage('tab-search-close', '*');
  } else {
    window.close();
  }
}

async function dismissClosedTab(tab) {
  dismissedClosed.add(tab.sessionId);
  await chrome.storage.local.set({ [DISMISSED_KEY]: [...dismissedClosed] });
  allTabs = allTabs.filter(t => t !== tab);
  performSearch();
}

async function switchToTab(tab) {
  if (tab.closed) {
    await chrome.sessions.restore(tab.sessionId);
  } else {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  }
  closePopup();
}

// --- Search ---

function performSearch() {
  const query = searchInput.value.trim();

  if (!query) {
    // Sort by recency when no query
    const sorted = [...allTabs].sort((a, b) => scoreTab(b, '') - scoreTab(a, ''));
    renderTabs(sorted);
    return;
  }

  const scored = allTabs
    .map(tab => ({ tab, score: scoreTab(tab, query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.tab);

  renderTabs(scored);
}

// --- Event listeners ---

searchInput.addEventListener('input', () => {
  clearBtn.style.display = searchInput.value ? 'flex' : 'none';
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(performSearch, DEBOUNCE_MS);
});

clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearBtn.style.display = 'none';
  searchInput.focus();
  performSearch();
});

closeBtn.addEventListener('click', () => {
  closePopup();
});

document.addEventListener('keydown', (e) => {
  const len = filteredTabs.length;
  if (!len) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % len;
      updateSelection();
      break;
    case 'ArrowUp':
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + len) % len;
      updateSelection();
      break;
    case 'Enter':
      e.preventDefault();
      if (filteredTabs[selectedIndex]) {
        switchToTab(filteredTabs[selectedIndex]);
      }
      break;
    case 'Escape':
      closePopup();
      break;
  }
});

init();
